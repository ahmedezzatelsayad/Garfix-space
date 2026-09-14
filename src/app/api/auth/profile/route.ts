import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";

/**
 * r16: الملف الشخصي للمشترك المسجّل — من جلسة الخادم (كوكي موقّع)
 * GET /api/auth/profile
 *   → 200 { profile: { email, displayName, role, plan, companies, phone } }
 *   → 401 لا جلسة / 404 ليس مشتركاً مسجلاً (حساب مدمج)
 * يستخدمه التطبيق لتحديث قائمة شركات المشترك بعد إنشاء شركته الأولى.
 */
export async function GET(req: NextRequest) {
  const sess = getSession(req);
  if (!sess) {
    return NextResponse.json({ error: "الجلسة غير صالحة" }, { status: 401 });
  }
  try {
    const appUser = await db.appUser.findUnique({ where: { email: sess.email } });
    if (!appUser) {
      return NextResponse.json({ error: "ليس مشتركاً مسجلاً" }, { status: 404 });
    }
    let companies: string[] = [];
    try { companies = JSON.parse(appUser.companies) as string[]; } catch { /* [] */ }
    return NextResponse.json({
      profile: {
        email: appUser.email,
        displayName: appUser.displayName,
        role: appUser.role,
        plan: appUser.plan,
        phone: appUser.phone,
        companies,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
