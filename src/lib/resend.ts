import { db } from "@/lib/db";
import { cacheDelPattern } from "@/lib/cache";

/**
 * r16: طبقة Resend لإرسال البريد — «هل نسيت كلمة السر؟»
 * - المفتاح وبريد المرسل يُضبطان من لوحة المؤسس (AdminDashboard) ويُخزَّنان
 *   في جدول Setting بمفتاح resend_config مع companySlug = "__global__".
 * - الإرسال عبر REST API الرسمي (https://api.resend.com/emails) — لا مكتبات خارجية.
 * - عند غياب المفتاح: sendEmail يعيد ok:false مع خطأ واضح يظهر للمؤسس.
 */

export interface ResendConfig {
  apiKey: string;
  from: string; // مثال: Garfix <onboarding@resend.dev>
  fromName?: string;
}

const SETTING_KEY = "resend_config";
const SETTING_SCOPE = "__global__";

export async function getResendConfig(): Promise<ResendConfig | null> {
  try {
    const row = await db.setting.findUnique({
      where: { key_companySlug: { key: SETTING_KEY, companySlug: SETTING_SCOPE } },
    });
    if (!row) return null;
    const parsed = JSON.parse(row.value) as Partial<ResendConfig>;
    if (!parsed.apiKey) return null;
    return {
      apiKey: String(parsed.apiKey),
      from: String(parsed.from || "onboarding@resend.dev"),
      fromName: parsed.fromName ? String(parsed.fromName) : undefined,
    };
  } catch {
    return null;
  }
}

export async function saveResendConfig(cfg: Partial<ResendConfig>): Promise<ResendConfig> {
  const current = (await getResendConfig()) || { apiKey: "", from: "onboarding@resend.dev" };
  const next: ResendConfig = {
    apiKey: typeof cfg.apiKey === "string" && cfg.apiKey.trim() ? cfg.apiKey.trim() : current.apiKey,
    from: typeof cfg.from === "string" && cfg.from.trim() ? cfg.from.trim() : current.from,
    fromName: typeof cfg.fromName === "string" ? cfg.fromName.trim() : current.fromName,
  };
  await db.setting.upsert({
    where: { key_companySlug: { key: SETTING_KEY, companySlug: SETTING_SCOPE } },
    update: { value: JSON.stringify(next) },
    create: { key: SETTING_KEY, companySlug: SETTING_SCOPE, value: JSON.stringify(next) },
  });
  await cacheDelPattern("resend:*");
  return next;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/** إرسال بريد فعلي عبر Resend — blocking fetch بمهلة 15 ثانية */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const cfg = await getResendConfig();
  if (!cfg || !cfg.apiKey) {
    return { ok: false, error: "خدمة البريد غير مهيأة — أضف مفتاح Resend من لوحة المؤسس" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        from: cfg.fromName ? `${cfg.fromName} <${cfg.from}>` : cfg.from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      // رسائل خطأ Resend الشائعة بشكل عربي واضح
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: `مفتاح Resend غير صالح (HTTP ${res.status}) — راجع اللوحة` };
      }
      return { ok: false, error: `Resend HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** قوالب البريد الجاهزة (عربية RTL بتصميم ذهبي داكن يطابق هوية النظام) */
export function resetPasswordEmail(displayName: string, resetUrl: string, minutesValid = 30): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>استعادة كلمة المرور</title></head>
<body style="margin:0;padding:0;background:#0b1626;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:linear-gradient(160deg,#101d33,#0b1626);border:1px solid rgba(201,162,39,.35);border-radius:16px;padding:36px 30px;text-align:center">
      <div style="width:64px;height:64px;margin:0 auto 18px;background:linear-gradient(135deg,#c9a227,#a07c1a);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px">🏛️</div>
      <div style="color:#c9a227;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:8px">نظام إدارة الحسابات</div>
      <h1 style="color:#fff;font-size:20px;margin:0 0 14px">استعادة كلمة المرور</h1>
      <p style="color:rgba(255,255,255,.75);font-size:14px;line-height:1.9;margin:0 0 8px">
        مرحباً <b style="color:#e5c558">${displayName}</b>،
      </p>
      <p style="color:rgba(255,255,255,.6);font-size:13px;line-height:1.9;margin:0 0 26px">
        تلقينا طلباً لإعادة تعيين كلمة مرور حسابك. اضغط الزر أدناه لاختيار كلمة مرور جديدة —
        الرابط صالح لمدة <b style="color:#e5c558">${minutesValid} دقيقة</b> ولمرة واحدة فقط.
      </p>
      <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#c9a227,#9a7318);color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:14px 38px;border-radius:10px;box-shadow:0 6px 22px rgba(201,162,39,.4)">إعادة تعيين كلمة المرور ←</a>
      <p style="color:rgba(255,255,255,.35);font-size:11.5px;line-height:1.8;margin:26px 0 0">
        إذا لم تطلب أنت هذا التغيير فتجاهل هذه الرسالة وستبقى كلمة مرورك الحالية كما هي.<br>
        © ${new Date().getFullYear()} الشركة القابضة المتحدة — الكويت
      </p>
    </div>
  </div>
</body>
</html>`;
}
