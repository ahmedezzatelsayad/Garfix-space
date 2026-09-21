import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateResetToken, hashToken } from "@/lib/passwords";
import { clientIp, actionRateLimited, noteActionFailure, clearActionFailures } from "@/lib/auth-server";
import { getResendConfig, sendEmail, resetPasswordEmail } from "@/lib/resend";

/**
 * r16: «هل نسيت كلمة السر؟» — بريد استعادة عبر Resend (المفتاح يُضبط من لوحة المؤسس)
 *
 * POST /api/auth/forgot-password { email }
 *   → 200 { ok, message } — الرد موحّد دائماً (لا يكشف وجود البريد)
 *   → 503 خدمة البريد غير مهيأة (المؤسس لم يضبط مفتاح Resend بعد)
 *
 * الأمان: رمز 32 بايت عشوائي، يُخزَّن بصمته SHA-256 فقط، صلاحية 30 دقيقة،
 * استخدام واحد، وربط رموز جديدة يلغي القديمة لنفس البريد.
 */
const TOKEN_TTL_MINUTES = 30;
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (await actionRateLimited("forgot", ip, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json({ error: "محاولات كثيرة — انتظر ربع ساعة ثم حاول مجدداً" }, { status: 429 });
  }
  // r29 (H8/C6): العدّاد يُزد عند الفشل فقط (بريد غير صالح / فشل الإرسال) — كان
  // يزيد على كل طلب فكانت استعادة 503 «غير مهيأة» أو نجاحات متتالية تحجب المستخدم.
  const fail = async () => {
    await noteActionFailure("forgot", ip, WINDOW_MS);
  };

  // خدمة البريد مهيأة؟ (نرد قبل أي استعلام حتى لا يتسرب وجود البريد)
  const cfg = await getResendConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "خدمة البريد غير مهيأة بعد — يضيف المؤسس مفتاح Resend من لوحة الإدارة", code: "EMAIL_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    await fail();
    return NextResponse.json({ error: "البريد الإلكتروني مطلوب" }, { status: 400 });
  }

  const GENERIC_OK = { ok: true, message: "إذا كان هذا البريد مسجلاً لدينا فستصلك رسالة الاستعادة خلال دقائق" };

  try {
    const appUser = await db.appUser.findUnique({ where: { email } });
    if (!appUser) {
      // بريد غير مسجل — نفس الرد تماماً (لا تسريب معلومات)
      return NextResponse.json(GENERIC_OK);
    }

    // توليد الرمز وتخزين بصمته (القديمة لنفس البريد تُلغى)
    const token = generateResetToken();
    await db.passwordReset.deleteMany({ where: { email, usedAt: null } });
    await db.passwordReset.create({
      data: {
        email,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
      },
    });

    // رابط الاستعادة — r29 (C8): من متغير بيئة موثوق فقط (APP_BASE_URL أو SITE_URL
    // كما في sitemap/robots)؛ كان يُبنى من هيدر Host المُتحكَّم به من العميل خلف
    // البوابة (reset-poisoning: ضحية تستلم رابطاً لموقع المهاجم). بلا متغير بيئة
    // يُرسل رابط نسبي (يُهيَّأ عند النشر بضبط APP_BASE_URL في .env).
    const base = (process.env.APP_BASE_URL || process.env.SITE_URL || "")
      .trim()
      .replace(/\/+$/, "");
    const resetUrl = `${base || ""}/#/reset?token=${token}`;

    const sent = await sendEmail({
      to: email,
      subject: `استعادة كلمة المرور — ${appUser.displayName}`,
      html: resetPasswordEmail(appUser.displayName, resetUrl, TOKEN_TTL_MINUTES),
    });
    if (!sent.ok) {
      console.error("[forgot-password] send failed:", sent.error);
      await fail();
      // خطأ الإرسال يظهر (مفتاح غير صالح مثلاً) — بلا كشف معلومات إضافية
      return NextResponse.json({ error: `تعذر إرسال البريد: ${sent.error}` }, { status: 502 });
    }

    // r29 (H8/C6): نجاح الإرسال يصفرّ العدّاد (نفس نمط الدخول/التسجيل)
    await clearActionFailures("forgot", ip);

    return NextResponse.json(GENERIC_OK);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
