import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  SESSION_TTL_SECONDS,
  makeSessionToken,
  verifyCredentials,
  clientIp,
  loginRateLimited,
  noteLoginFailure,
  noteLoginSuccess,
} from "@/lib/auth-server";

/**
 * POST /api/auth/login { email, password }
 * → 200 { ok, user } + كوكي جلسة httpOnly موقّعة (تُطلبها المسارات الإدارية)
 * → 401 بيانات خاطئة / 429 محاولات كثيرة
 * تُستدعى تلقائياً من loginUser() في firebase/auth.js (نفس لحظة الدخول المحلي).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    if (loginRateLimited(ip)) {
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

    const user = verifyCredentials(email, password);
    if (!user) {
      noteLoginFailure(ip);
      // رسالة موحّدة حتى لا يُكشف أي بريد مسجّل من عدمه
      return NextResponse.json(
        { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
        { status: 401 },
      );
    }

    noteLoginSuccess(ip);
    const res = NextResponse.json({
      ok: true,
      user: { email: user.email, displayName: user.displayName, role: user.role },
    });
    res.cookies.set(COOKIE_NAME, makeSessionToken(user), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
