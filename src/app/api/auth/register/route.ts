import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import { COOKIE_NAME, SESSION_TTL_SECONDS, COOKIE_SECURE, makeSessionToken, clientIp, isReservedAccountEmail, actionRateLimited, noteActionFailure } from "@/lib/auth-server";
import { detectCountry } from "@/lib/geo";
import { LANGUAGES } from "@/lib/i18n";

/**
 * r16: التسجيل الذاتي — «مجاناً لأول 100 مشترك»
 *
 * GET  /api/auth/register → { registered, limit, remaining, freeOpen }
 *   (عام — يغذّي عداد المقاعد المتبقية في الموقع وصفحة الدخول)
 * POST /api/auth/register { displayName, email, phone?, password }
 *   → 201 { ok, user, remaining } + كوكي جلسة httpOnly (تسجيل + دخول بضغطة واحدة)
 *   → 409 البريد مستخدم / 403 انتهت المقاعد المجانية / 400 بيانات غير صالحة / 429 محاولات كثيرة
 */

export const FREE_SUBSCRIBER_LIMIT = 100;

// ── تحديد معدل التسجيل لكل IP (10 محاولات / 15 دقيقة) — r28: عبر Valkey ──
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d{6,15}$/;

export async function GET() {
  try {
    const registered = await db.appUser.count();
    const remaining = Math.max(0, FREE_SUBSCRIBER_LIMIT - registered);
    return NextResponse.json({
      registered,
      limit: FREE_SUBSCRIBER_LIMIT,
      remaining,
      freeOpen: registered < FREE_SUBSCRIBER_LIMIT,
    });
  } catch {
    return NextResponse.json({ registered: 0, limit: FREE_SUBSCRIBER_LIMIT, remaining: FREE_SUBSCRIBER_LIMIT, freeOpen: true });
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (await actionRateLimited("register", ip, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json({ error: "محاولات كثيرة — انتظر ربع ساعة ثم حاول مجدداً" }, { status: 429 });
  }
  await noteActionFailure("register", ip, WINDOW_MS);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    // ── تحقق صارم من المدخلات ──
    if (displayName.length < 2 || displayName.length > 60) {
      return NextResponse.json({ error: "الاسم مطلوب (2-60 محرفاً)" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "صيغة البريد الإلكتروني غير صحيحة" }, { status: 400 });
    }
    if (password.length < 8 || password.length > 100) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });
    }
    if (phone && !PHONE_RE.test(phone.replace(/[\s-]/g, ""))) {
      return NextResponse.json({ error: "صيغة رقم الجوال غير صحيحة" }, { status: 400 });
    }
    // منع انتحال حسابات النظام المدمجة (المدير/الموظفون)
    if (isReservedAccountEmail(email)) {
      return NextResponse.json({ error: "هذا البريد محجوز لحساب قائم — استخدم «نسيت كلمة المرور؟» أو بريداً آخر" }, { status: 409 });
    }

    // ── المقاعد المجانية ──
    const registered = await db.appUser.count();
    if (registered >= FREE_SUBSCRIBER_LIMIT) {
      return NextResponse.json(
        { error: "انتهت المقاعد المجانية لأول 100 مشترك — تواصل معنا لتفعيل حسابك", code: "FREE_LIMIT_REACHED" },
        { status: 403 },
      );
    }

    // ── تفرّد البريد ──
    const dup = await db.appUser.findUnique({ where: { email } });
    if (dup) {
      return NextResponse.json({ error: "هذا البريد مسجّل مسبقاً — سجّل الدخول مباشرة" }, { status: 409 });
    }

    // ── الإنشاء ──
    // r18: بلد التسجيل من الـ IP + اللغة المفضلة (اختيارية من الواجهة)
    const geo = await detectCountry(req);
    const langCodes = new Set(LANGUAGES.map((l) => l.code));
    const langRaw = typeof body.lang === "string" ? body.lang.trim().toLowerCase() : "";
    const lang = langCodes.has(langRaw) ? langRaw : null;

    const user = await db.appUser.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        displayName,
        phone: phone.replace(/[\s-]/g, "") || null,
        role: "subscriber",
        plan: "free_early",
        companies: "[]",
        countryCode: geo.code,
        lang,
      },
    });

    const remaining = Math.max(0, FREE_SUBSCRIBER_LIMIT - (registered + 1));

    // تسجيل + دخول بضغطة واحدة: كوكي جلسة موقّعة (بلا أي صلاحيات إدارية خادمياً)
    const res = NextResponse.json(
      {
        ok: true,
        user: {
          email: user.email,
          displayName: user.displayName,
          role: "subscriber",
          plan: user.plan,
          companies: [],
        },
        remaining,
      },
      { status: 201 },
    );
    res.cookies.set(COOKIE_NAME, makeSessionToken({ email: user.email, displayName: user.displayName, role: "viewer" }), {
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
