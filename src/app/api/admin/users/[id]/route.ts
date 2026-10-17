import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { hashPassword } from "@/lib/passwords";
import { serializeAppUser } from "../route";

/**
 * تعديل/حذف مستخدم (app_users) — جلسة مدير إلزامية.
 *
 * PATCH  /api/admin/users/[id] { displayName?, companies?, role?, permissions?, password? }
 *        → 200 { user }  — لا يمكن جعل دور المستخدم admin (المؤسس فقط من البيئة).
 * DELETE /api/admin/users/[id] → 200 { ok: true }
 *        — حذف حقيقي من قاعدة البيانات (كان محصوراً على localStorage وهمي).
 *        — لا يمكن للمدير حذف حسابه الشخصي (حماية من الإغلاق الذاتي).
 */

interface Params {
  params: Promise<{ id: string }>;
}

const STAFF_ROLES = new Set(["viewer", "employee", "editor"]);
const KNOWN_PERMS = new Set([
  "create_invoice", "print_invoice", "edit_invoice", "delete_invoice",
  "view_customers", "edit_customer", "delete_customer",
  "bulk_input", "export_data", "reports_access", "settings_access",
  "finance_access", "employee_management",
]);

function bad(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const { id: idParam } = await params;
    const id = Number.parseInt(idParam, 10);
    if (!Number.isInteger(id) || id <= 0) return bad("معرف المستخدم غير صالح");

    const existing = await db.appUser.findUnique({ where: { id } });
    if (!existing) return bad("المستخدم غير موجود", 404);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: Record<string, string> = {};

    if (body.displayName !== undefined) {
      const dn = String(body.displayName ?? "").trim();
      if (!dn) return bad("الاسم لا يمكن أن يكون فارغاً");
      if (dn.length > 120) return bad("الاسم طويل جداً (الحد 120 محرفاً)");
      data.displayName = dn;
    }

    if (body.role !== undefined) {
      const role = String(body.role ?? "");
      if (!STAFF_ROLES.has(role)) return bad("دور غير مسموح — الأدوار المتاحة: viewer | employee | editor");
      data.role = role;
      if (role !== "employee") data.permissions = "{}"; // الصلاحيات التفصيلية للموظف فقط
    }

    if (body.password !== undefined) {
      const password = String(body.password ?? "");
      if (password.length < 6) return bad("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      data.passwordHash = hashPassword(password);
    }

    if (body.companies !== undefined) {
      if (!Array.isArray(body.companies)) return bad("قائمة الشركات يجب أن تكون مصفوفة");
      const companies = [...new Set(body.companies.map((s) => String(s ?? "").trim()).filter(Boolean))].slice(0, 50);
      for (const slug of companies) {
        const exists = await db.company.findUnique({ where: { slug }, select: { slug: true } });
        if (!exists) return bad(`الشركة «${slug}» غير موجودة`);
      }
      data.companies = JSON.stringify(companies);
    }

    if (body.permissions !== undefined) {
      if (!body.permissions || typeof body.permissions !== "object" || Array.isArray(body.permissions)) {
        return bad("الصلاحيات يجب أن تكون كائناً {key: 0|1}");
      }
      const perms: Record<string, number> = {};
      for (const [k, v] of Object.entries(body.permissions as Record<string, unknown>)) {
        if (KNOWN_PERMS.has(k)) perms[k] = v ? 1 : 0;
      }
      data.permissions = JSON.stringify(perms);
    }

    if (Object.keys(data).length === 0) return bad("لا حقول للتحديث");

    const row = await db.appUser.update({ where: { id }, data });
    return NextResponse.json({ user: serializeAppUser(row) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const { id: idParam } = await params;
    const id = Number.parseInt(idParam, 10);
    if (!Number.isInteger(id) || id <= 0) return bad("معرف المستخدم غير صالح");

    const existing = await db.appUser.findUnique({ where: { id } });
    if (!existing) return bad("المستخدم غير موجود", 404);

    // حماية من الحذف الذاتي — المدير يحذف الآخرين لا نفسه من اللوحة
    const { getSession } = await import("@/lib/auth-server");
    const sess = getSession(req);
    if (sess && sess.email === existing.email) {
      return bad("لا يمكنك حذف حسابك الحالي — استخدم حساباً آخر للحذف", 409, "SELF_DELETE");
    }

    // تنظيف ما يعتمد على المستخدم قبل حذفه (فواتير الاستخدام وطلبات الخطط)
    await db.usageCounter.deleteMany({ where: { userId: id } });
    await db.planRequest.deleteMany({ where: { userId: id } });
    await db.appUser.delete({ where: { id } });

    return NextResponse.json({ ok: true, deleted: existing.email });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
