import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { listPlans, serializePlan, ensurePlans, getUsageSnapshot, FREE_SUBSCRIBER_LIMIT } from "@/lib/plans";

/**
 * r17: لوحة المؤسس — إدارة الاشتراكات والخطط والمشتركين.
 *
 * GET  /api/admin/subscriptions
 *   → { plans, subscribers: [{ …, usage }], requests: [{ …, user, plan }], stats }
 * PUT  /api/admin/subscriptions { code, nameAr?, descAr?, priceUsd?, maxCompanies?,
 *      maxCustomers?, monthlyAiInvoices?, features?, badgeAr?, active?, sortOrder? }
 *   → تحديث تعريف خطة (الحصص والسعر بالدولار)
 * POST /api/admin/subscriptions { action }
 *   - set_plan      { userId, planCode }      → تغيير خطة مشترك مباشرة
 *   - approve_request { requestId }          → اعتماد طلب ترقية (تغيير الخطة + إغلاق الطلب)
 *   - reject_request  { requestId }          → رفض طلب ترقية
 *
 * مدير فقط (requireAdmin) — 401 بلا جلسة، 403 لموظف/مشترك.
 */

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    await ensurePlans();

    const [planRows, users, requestRows] = await Promise.all([
      db.subscriptionPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
      db.appUser.findMany({ orderBy: { createdAt: "desc" } }),
      db.planRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    ]);

    const plans = planRows.map(serializePlan);
    const planByCode = new Map(plans.map((p) => [p.code, p]));

    // استخدام كل مشترك (خطته + عدّاداته) — تسلسلي بسيط (قائمة قصيرة)
    const subscribers = [];
    for (const u of users) {
      const { plan, usage } = await getUsageSnapshot(u);
      let companies: string[] = [];
      try { companies = JSON.parse(u.companies) as string[]; } catch { /* [] */ }
      subscribers.push({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        phone: u.phone,
        plan: u.plan,
        planNameAr: plan.nameAr,
        companies,
        country: u.countryCode,
        createdAt: u.createdAt.toISOString(),
        planUpdatedAt: u.planUpdatedAt ? u.planUpdatedAt.toISOString() : null,
        usage,
      });
    }

    const userById = new Map(users.map((u) => [u.id, u]));
    const requests = requestRows.map((r) => {
      const u = userById.get(r.userId);
      const p = planByCode.get(r.planCode);
      return {
        id: r.id,
        userId: r.userId,
        userEmail: u?.email ?? "—",
        userName: u?.displayName ?? "—",
        userCountry: u?.countryCode ?? null,
        currentPlan: u?.plan ?? "—",
        planCode: r.planCode,
        planNameAr: p?.nameAr ?? r.planCode,
        planPriceUsd: p?.priceUsd ?? 0,
        note: r.note,
        status: r.status,
        handledBy: r.handledBy,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    const byPlan: Record<string, number> = {};
    for (const s of subscribers) byPlan[s.plan] = (byPlan[s.plan] || 0) + 1;

    return NextResponse.json({
      plans,
      subscribers,
      requests,
      stats: {
        totalSubscribers: subscribers.length,
        byPlan,
        pendingRequests: requests.filter((r) => r.status === "pending").length,
        freeRemaining: Math.max(0, FREE_SUBSCRIBER_LIMIT - subscribers.length),
        freeLimit: FREE_SUBSCRIBER_LIMIT,
        mrrUsd: subscribers.reduce((sum, s) => sum + (planByCode.get(s.plan)?.priceUsd ?? 0), 0),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    await ensurePlans();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) return NextResponse.json({ error: "كود الخطة مطلوب" }, { status: 400 });

    const existing = await db.subscriptionPlan.findUnique({ where: { code } });
    if (!existing) return NextResponse.json({ error: "الخطة غير موجودة" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (typeof body.nameAr === "string" && body.nameAr.trim()) data.nameAr = body.nameAr.trim().slice(0, 60);
    if (typeof body.descAr === "string") data.descAr = body.descAr.trim().slice(0, 200);
    if (body.priceUsd !== undefined) {
      const p = num(body.priceUsd);
      if (p === undefined || p < 0 || p > 10000) {
        return NextResponse.json({ error: "السعر بالدولار يجب أن يكون بين 0 و 10000" }, { status: 400 });
      }
      data.priceUsd = Math.round(p * 100) / 100;
    }
    for (const [key, field, max] of [
      ["maxCompanies", "maxCompanies", 100],
      ["maxCustomers", "maxCustomers", 1000000],
      ["monthlyAiInvoices", "monthlyAiInvoices", 100000],
    ] as const) {
      if (body[key] !== undefined) {
        const v = num(body[key]);
        if (v === undefined || v < 0 || v > max || !Number.isInteger(v)) {
          return NextResponse.json({ error: `قيمة ${key} غير صالحة (عدد صحيح 0-${max})` }, { status: 400 });
        }
        data[field] = v;
      }
    }
    if (body.badgeAr !== undefined) {
      data.badgeAr = typeof body.badgeAr === "string" && body.badgeAr.trim() ? body.badgeAr.trim().slice(0, 40) : null;
    }
    if (typeof body.active === "boolean") data.active = body.active;
    if (body.sortOrder !== undefined) {
      const s = num(body.sortOrder);
      if (s === undefined || s < 0 || s > 99) return NextResponse.json({ error: "ترتيب غير صالح" }, { status: 400 });
      data.sortOrder = Math.round(s);
    }
    if (Array.isArray(body.features)) {
      data.features = JSON.stringify(body.features.filter((f) => typeof f === "string" && f.trim()).map((f) => String(f).trim().slice(0, 120)));
    }
    if (!Object.keys(data).length) return NextResponse.json({ error: "لا تغييرات" }, { status: 400 });

    const updated = await db.subscriptionPlan.update({ where: { code }, data });
    return NextResponse.json({ ok: true, plan: serializePlan(updated) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const adminEmail = (getSessionEmail(req) || "").toLowerCase();
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "set_plan") {
      const userId = num(body.userId);
      const planCode = typeof body.planCode === "string" ? body.planCode.trim() : "";
      if (!userId || !planCode) return NextResponse.json({ error: "userId و planCode مطلوبان" }, { status: 400 });
      const [user, plan] = await Promise.all([
        db.appUser.findUnique({ where: { id: userId } }),
        db.subscriptionPlan.findUnique({ where: { code: planCode } }),
      ]);
      if (!user) return NextResponse.json({ error: "المشترك غير موجود" }, { status: 404 });
      if (!plan) return NextResponse.json({ error: "الخطة غير موجودة" }, { status: 404 });
      if (user.plan === plan.code) return NextResponse.json({ error: "هذه خطته الحالية" }, { status: 409 });

      const updated = await db.appUser.update({
        where: { id: userId },
        data: { plan: plan.code, planUpdatedAt: new Date() },
      });
      // أغلق أي طلب معلّق لهذا المستخدم على هذه الخطة
      await db.planRequest.updateMany({
        where: { userId, status: "pending", planCode: plan.code },
        data: { status: "approved", handledBy: adminEmail },
      });
      return NextResponse.json({ ok: true, user: { id: updated.id, plan: updated.plan } });
    }

    if (action === "approve_request" || action === "reject_request") {
      const requestId = num(body.requestId);
      if (!requestId) return NextResponse.json({ error: "requestId مطلوب" }, { status: 400 });
      const request = await db.planRequest.findUnique({ where: { id: requestId } });
      if (!request) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
      if (request.status !== "pending") {
        return NextResponse.json({ error: "الطلب معالَج مسبقاً" }, { status: 409 });
      }

      if (action === "approve_request") {
        const plan = await db.subscriptionPlan.findUnique({ where: { code: request.planCode } });
        if (!plan) return NextResponse.json({ error: "الخطة المطلوبة لم تعد موجودة" }, { status: 404 });
        await db.$transaction([
          db.appUser.update({ where: { id: request.userId }, data: { plan: plan.code, planUpdatedAt: new Date() } }),
          db.planRequest.update({ where: { id: requestId }, data: { status: "approved", handledBy: adminEmail } }),
        ]);
        return NextResponse.json({ ok: true, approved: true });
      }
      await db.planRequest.update({ where: { id: requestId }, data: { status: "rejected", handledBy: adminEmail } });
      return NextResponse.json({ ok: true, approved: false });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function getSessionEmail(req: NextRequest): string | null {
  // البريد من الكوكي الموقّع — عبر getSession في auth-server (نسخة خفيفة محلية)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getSession } = require("@/lib/auth-server") as typeof import("@/lib/auth-server");
  const s = getSession(req);
  return s ? s.email : null;
}
