import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, isReservedAccountEmail } from "@/lib/auth-server";
import { hashPassword } from "@/lib/passwords";

/**
 * إدارة المستخدمين الحقيقية (بديل localStorage الوهمي) — جلسة مدير إلزامية.
 *
 * GET  /api/admin/users → { users: [...] }   كل حسابات app_users (موظفون + مشتركون)
 * POST /api/admin/users { email, password, displayName, companies[], role, permissions }
 *                      → 201 { user }        إنشاء موظف (viewer|employee|editor)
 *
 * - كلمات المرور scrypt (salt$hash) — لا نص صريح أبداً.
 * - الحذف والتعديل في /api/admin/users/[id].
 * - دور admin غير قابل للإنشاء من هنا (المؤسس فقط، حسابه من البيئة).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
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

function safeJsonList(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.map((s) => String(s ?? "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function safeJsonMap(raw: string | null | undefined): Record<string, number> {
  try {
    const v = JSON.parse(raw || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      if (KNOWN_PERMS.has(k)) out[k] = n ? 1 : 0;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeAppUser(u: {
  id: number; email: string; displayName: string; role: string; plan: string;
  companies: string; permissions: string; phone: string | null; createdAt: Date;
}) {
  return {
    id: u.id,
    uid: String(u.id), // توافق مع الواجهة القديمة التي تستخدم uid
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    plan: u.plan,
    phone: u.phone,
    companies: safeJsonList(u.companies),
    permissions: safeJsonMap(u.permissions),
    createdAt: u.createdAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const rows = await db.appUser.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json({ users: rows.map(serializeAppUser) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = (typeof body.displayName === "string" ? body.displayName.trim() : "") || email;
    const role = typeof body.role === "string" && STAFF_ROLES.has(body.role) ? body.role : "employee";

    if (!EMAIL_RE.test(email)) return bad("صيغة البريد الإلكتروني غير صحيحة");
    if (password.length < 6) return bad("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    if (isReservedAccountEmail(email)) {
      return bad("هذا البريد محجوز للنظام — اختر بريداً آخر", 409, "EMAIL_RESERVED");
    }
    if (displayName.length > 120) return bad("الاسم طويل جداً (الحد 120 محرفاً)");

    let companies: string[] = [];
    if (body.companies !== undefined) {
      if (!Array.isArray(body.companies)) return bad("قائمة الشركات يجب أن تكون مصفوفة");
      companies = [...new Set(body.companies.map((s) => String(s ?? "").trim()).filter(Boolean))].slice(0, 50);
      for (const slug of companies) {
        const exists = await db.company.findUnique({ where: { slug }, select: { slug: true } });
        if (!exists) return bad(`الشركة «${slug}» غير موجودة`);
      }
    }

    let permissions: Record<string, number> = {};
    if (body.permissions !== undefined) {
      if (!body.permissions || typeof body.permissions !== "object" || Array.isArray(body.permissions)) {
        return bad("الصلاحيات يجب أن تكون كائناً {key: 0|1}");
      }
      for (const [k, v] of Object.entries(body.permissions as Record<string, unknown>)) {
        if (KNOWN_PERMS.has(k)) permissions[k] = v ? 1 : 0;
      }
    }

    const dup = await db.appUser.findUnique({ where: { email }, select: { id: true } });
    if (dup) return bad("هذا البريد مسجل مسبقاً — اختر بريداً آخر", 409, "EMAIL_TAKEN");

    const row = await db.appUser.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        displayName,
        role,
        plan: "staff",
        companies: JSON.stringify(companies),
        permissions: JSON.stringify(permissions),
      },
    });

    return NextResponse.json({ user: serializeAppUser(row) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
