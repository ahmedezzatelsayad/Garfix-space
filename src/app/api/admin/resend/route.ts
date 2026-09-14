import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getResendConfig, saveResendConfig, sendEmail } from "@/lib/resend";

/**
 * r16: إعداد Resend من لوحة المؤسس — «هل نسيت كلمة السر؟»
 *
 * GET  /api/admin/resend → { config: { from, fromName, configured, apiKeyMasked } } (مدير)
 * PUT  /api/admin/resend { apiKey?, from?, fromName? } → 200 { ok, config } (مدير)
 * POST /api/admin/resend { to } → اختبار إرسال فعلي لبريد يحدده المؤسس (مدير)
 */

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 5)}${"•".repeat(Math.min(14, key.length - 9))}${key.slice(-4)}`;
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const cfg = await getResendConfig();
  return NextResponse.json({
    config: {
      from: cfg?.from || "onboarding@resend.dev",
      fromName: cfg?.fromName || "",
      configured: !!cfg?.apiKey,
      apiKeyMasked: cfg ? maskKey(cfg.apiKey) : "",
    },
  });
}

export async function PUT(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : undefined;
  const from = typeof body.from === "string" ? body.from.trim() : undefined;
  const fromName = typeof body.fromName === "string" ? body.fromName.trim() : undefined;

  if (from && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(from)) {
    return NextResponse.json({ error: "بريد المرسل غير صالح (مثال: onboarding@resend.dev)" }, { status: 400 });
  }
  if (apiKey && !/^re_[A-Za-z0-9_]{10,}$/.test(apiKey)) {
    return NextResponse.json({ error: "مفتاح Resend يبدأ عادة بـ re_ — تأكد من نسخه كاملاً" }, { status: 400 });
  }
  // لا معنى لحفظ بلا مفتاح جديد أو موجود
  const current = await getResendConfig();
  if (!current?.apiKey && !apiKey) {
    return NextResponse.json({ error: "أدخل مفتاح Resend API أولاً" }, { status: 400 });
  }

  const cfg = await saveResendConfig({ apiKey, from, fromName });
  return NextResponse.json({
    ok: true,
    config: { from: cfg.from, fromName: cfg.fromName || "", configured: true, apiKeyMasked: maskKey(cfg.apiKey) },
  });
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { to?: unknown };
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
    return NextResponse.json({ error: "أدخل بريداً صالحاً للاختبار" }, { status: 400 });
  }

  const sent = await sendEmail({
    to,
    subject: "بريد اختباري من نظام إدارة الحسابات ✅",
    html: `<!DOCTYPE html><html lang="ar" dir="rtl"><body style="font-family:Tahoma,Arial,sans-serif;background:#0b1626;margin:0;padding:32px">
      <div style="max-width:480px;margin:0 auto;background:#101d33;border:1px solid rgba(201,162,39,.35);border-radius:14px;padding:28px;color:#fff;text-align:center">
        <div style="font-size:34px;margin-bottom:10px">🎉</div>
        <h2 style="color:#e5c558;margin:0 0 10px;font-size:18px">بريد Resend يعمل!</h2>
        <p style="color:rgba(255,255,255,.7);font-size:13px;line-height:1.9;margin:0">
          هذه رسالة اختبارية أرسلها المؤسس من لوحة الإدارة.<br>
          رسائل «نسيت كلمة السر؟» ستصله بهذا القناة نفسها.
        </p>
      </div></body></html>`,
  });
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error || "فشل الإرسال" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: sent.id });
}
