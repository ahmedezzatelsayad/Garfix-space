import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  SESSION_TTL_SECONDS,
  COOKIE_SECURE,
  makeSessionToken,
  verifyCredentials,
  clientIp,
  loginRateLimited,
  noteLoginFailure,
  noteLoginSuccess,
} from "@/lib/auth-server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";

/**
 * POST /api/auth/login { email, password }
 * → 200 { ok, user } + كوكي جلسة httpOnly موقّعة (تُطلبها المسارات الإدارية)
 * → 401 بيانات خاطئة / 429 محاولات كثيرة
 * r16: يقبل الآن أيضاً المشتركين المسجّلين ذاتياً (AppUser — scrypt)؛
 * يُعاد معهم دورهم وشركاتهم ليبني الواجهة ملفهم الشخصي مباشرة.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    if (await loginRateLimited(ip)) {
      return NextResponse.json(
        { error: "محاولات كثيرة — انتظر بضع دقائق ثم حاول مجدداً" },
        { status: 429 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "البريد وكلمة المرور مطلوبان" }, { status: 400 });
    }

    // 1) الحسابات المدمجة (بصمات SHA-256 ثابتة)
    let user = verifyCredentials(email, password) as
      | { email: string; displayName: string; role: string; companies?: string[]; kind?: string }
      | null;

    // 2) المشتركون المسجّلون ذاتياً (AppUser — scrypt من قاعدة البيانات)
    if (!user) {
      const appUser = await db.appUser.findUnique({ where: { email } });
      if (appUser && verifyPassword(password, appUser.passwordHash)) {
        let companies: string[] = [];
        try { companies = JSON.parse(appUser.companies) as string[]; } catch { /* [] */ }
        user = {
          email: appUser.email,
          displayName: appUser.displayName,
          role: "subscriber",
          companies,
          kind: "registered",
        };
      }
    }

    if (!user) {
      await noteLoginFailure(ip);
      // رسالة موحّدة حتى لا يُكشف أي بريد مسجّل من عدمه
      return NextResponse.json(
        { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
        { status: 401 },
      );
    }

    await noteLoginSuccess(ip);
    const res = NextResponse.json({
      ok: true,
      user: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        companies: user.companies || [],
        kind: user.kind || "builtin",
      },
    });
    res.cookies.set(COOKIE_NAME, makeSessionToken(user), {
      httpOnly: true,
      sameSite: "lax",
      secure: COOKIE_SECURE, // r28: فعّل COOKIE_SECURE=true عند النشر خلف HTTPS
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
