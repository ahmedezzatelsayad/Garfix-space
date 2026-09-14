import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getSessionAppUser } from "@/lib/auth-server";
import { getUsageSnapshot, getPlan, FREE_SUBSCRIBER_LIMIT } from "@/lib/plans";


/**
 * r17: لوحة «حسابي» — البروفايل والاشتراك والاستخدام للمستخدم الحالي.
 *
 * GET  /api/subscription            → ملف المشترك + خطته + عدّادات الاستخدام + طلبه المعلّق
 *                                     (الحسابات المدمجة: بطاقة وصول غير محدود بدل الحصص)
 * PUT  /api/subscription { displayName?, phone? }          → تحديث الملف الشخصي (مشترك)
 * POST /api/subscription { action:"request_plan", planCode, note? }  → طلب ترقية (لمرة واحدة معلّقة)
 *      { action:"cancel_request" }                          → إلغاء طلبك المعلّق
 */
export async function GET(req: NextRequest) {
  const sess = getSession(req);
  if (!sess) {
    return NextResponse.json({ error: "الجلسة غير صالحة — سجّل الدخول من جديد", code: "SESSION_REQUIRED" }, { status: 401 });
  }
  try {
    // الحسابات المدمجة (المؤسس/الموظفون) — وصول غير محدود
    const sub = await getSessionAppUser(req);
    if (!sub) {
      return NextResponse.json({
        accountType: "builtin",
        profile: { email: sess.email, displayName: sess.displayName, role: sess.role, phone: null, country: null },
        plan: null,
        usage: null,
        pendingRequest: null,
        note: "حساب مؤسسي مدمج — وصول غير محدود بلا حصص",
      });
    }

    const { appUser } = sub;
    const { plan, usage } = await getUsageSnapshot(appUser);
    const pending = await db.planRequest.findFirst({
      where: { userId: appUser.id, status: "pending" },
      orderBy: { createdAt: "desc" },
    });

    let companies: string[] = [];
    try { companies = JSON.parse(appUser.companies) as string[]; } catch { /* [] */ }

    return NextResponse.json({
      accountType: "subscriber",
      profile: {
        email: appUser.email,
        displayName: appUser.displayName,
        phone: appUser.phone,
        country: appUser.countryCode,
        role: appUser.role,
        companies,
        createdAt: appUser.createdAt.toISOString(),
        planUpdatedAt: appUser.planUpdatedAt ? appUser.planUpdatedAt.toISOString() : null,
      },
      plan,
      usage,
      pendingRequest: pending
        ? { id: pending.id, planCode: pending.planCode, note: pending.note, createdAt: pending.createdAt.toISOString() }
        : null,
      freeSeats: { limit: FREE_SUBSCRIBER_LIMIT },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

const PHONE_RE = /^\+?\d{6,15}$/;

export async function PUT(req: NextRequest) {
  const sub = await getSessionAppUser(req);
  if (!sub) {
    return NextResponse.json({ error: "التعارف متاح للمشتركين المسجّلين فقط", code: "SUBSCRIBER_REQUIRED" }, { status: 403 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: { displayName?: string; phone?: string | null } = {};

    if (typeof body.displayName === "string") {
      const name = body.displayName.trim();
      if (name.length < 2 || name.length > 60) {
        return NextResponse.json({ error: "الاسم مطلوب (2-60 محرفاً)" }, { status: 400 });
      }
      data.displayName = name;
    }
    if (body.phone !== undefined) {
      if (body.phone === null || body.phone === "") {
        data.phone = null;
      } else {
        const p = String(body.phone).trim().replace(/[\s-]/g, "");
        if (!PHONE_RE.test(p)) {
          return NextResponse.json({ error: "صيغة رقم الجوال غير صحيحة" }, { status: 400 });
        }
        data.phone = p;
      }
    }
    if (!Object.keys(data).length) {
      return NextResponse.json({ error: "لا تغييرات مطلوبة" }, { status: 400 });
    }

    const updated = await db.appUser.update({ where: { id: sub.appUser.id }, data });
    return NextResponse.json({
      ok: true,
      profile: { displayName: updated.displayName, phone: updated.phone },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sub = await getSessionAppUser(req);
  if (!sub) {
    return NextResponse.json({ error: "الترقية متاحة للمشتركين المسجّلين فقط", code: "SUBSCRIBER_REQUIRED" }, { status: 403 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "cancel_request") {
      const pending = await db.planRequest.findFirst({ where: { userId: sub.appUser.id, status: "pending" } });
      if (!pending) {
        return NextResponse.json({ error: "لا يوجد طلب معلّق" }, { status: 404 });
      }
      await db.planRequest.delete({ where: { id: pending.id } });
      return NextResponse.json({ ok: true, cancelled: true });
    }

    if (action === "request_plan") {
      const planCode = typeof body.planCode === "string" ? body.planCode.trim() : "";
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
      const plan = await getPlan(planCode);
      if (!plan || plan.code !== planCode) {
        return NextResponse.json({ error: "الخطة غير موجودة" }, { status: 404 });
      }
      if (plan.code === sub.appUser.plan) {
        return NextResponse.json({ error: "هذه خطتك الحالية بالفعل" }, { status: 409 });
      }
      const dup = await db.planRequest.findFirst({ where: { userId: sub.appUser.id, status: "pending" } });
      if (dup) {
        return NextResponse.json(
          { error: "لديك طلب ترقية معلّق بالفعل — انتظر رد المؤسس أو ألغه أولاً", code: "REQUEST_PENDING" },
          { status: 409 },
        );
      }
      const created = await db.planRequest.create({
        data: { userId: sub.appUser.id, planCode: plan.code, note: note || null },
      });
      return NextResponse.json(
        { ok: true, request: { id: created.id, planCode: created.planCode, status: created.status } },
        { status: 201 },
      );
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

