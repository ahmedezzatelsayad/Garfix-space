import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  unauthorizedResponse,
  actionRateLimited,
  noteActionFailure,
} from "@/lib/auth-server";

/**
 * POST /api/pdf — HTML → PDF proxy.
 * Body: { html: string, filename?: string, format?: "A4"|"A5", landscape?: boolean }
 * Forwards to the pdf-service mini-service on 127.0.0.1:3040 (server-to-server,
 * never exposed through the gateway) and streams the PDF back as an attachment.
 *
 * r29 (S4): تتطلب جلسة صالحة — كانت تفتح Chromium مجهولاً لكل زائر (5MB لكل
 * طلب = ناقل DoS). الخدمة تعرض HTML قد جهّزه العميل نفسه من بياناته (لا تقرأ
 * الفواتير من الخادم) فلا يوجد ملكية مستأجر إضافية تُفحص هنا.
 * r29 (H7): تفاصيل خطأ المنبع تُسجَّل خادمياً ولا تُعاد للعميل.
 */
const PDF_SERVICE = "http://127.0.0.1:3040/";
const MAX_BYTES = 5 * 1024 * 1024;

// حد خفيف لكل مستخدم (جلسة) — طباعة/تصدير 30 ملفاً كل 5 دقائق كافية للدفعات العادية
const PDF_WINDOW_MS = 5 * 60 * 1000;
const PDF_MAX_JOBS = 30;

export async function POST(req: NextRequest) {
  const sess = getSession(req);
  if (!sess) return unauthorizedResponse();

  if (await actionRateLimited("pdf", sess.email, PDF_MAX_JOBS, PDF_WINDOW_MS)) {
    return NextResponse.json(
      { error: "كثفت توليد ملفات PDF — انتظر قليلاً ثم حاول مجدداً", code: "PDF_RATE_LIMITED" },
      { status: 429 },
    );
  }

  let body: { html?: string; filename?: string; format?: string; landscape?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const { html, filename, format, landscape } = body ?? {};
  if (typeof html !== "string" || html.length === 0) {
    return NextResponse.json({ error: "محتوى HTML مفقود" }, { status: 400 });
  }
  if (Buffer.byteLength(html, "utf8") > MAX_BYTES) {
    return NextResponse.json({ error: "المحتوى كبير جداً" }, { status: 413 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(PDF_SERVICE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, format, landscape }),
    });
  } catch {
    return NextResponse.json(
      { error: "خدمة توليد PDF غير متاحة حالياً، حاول مرة أخرى" },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    // r29 (H7): التفاصيل تُسجَّل خادمياً فقط — كانت تُسرَّب للعميل
    const detail = await upstream.text().catch(() => "");
    console.error("[pdf] upstream error:", upstream.status, detail.slice(0, 300));
    return NextResponse.json(
      { error: "فشل توليد ملف PDF" },
      { status: 502 },
    );
  }

  // HTTP headers are ByteStrings (latin-1): Arabic must go through RFC 5987
  // encoding. The browser-side a.download attribute (which handles the real
  // Arabic filename) is what normally names the file; this header is a fallback.
  const rawName = (filename || "invoice").slice(0, 120);
  const asciiName = rawName.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "invoice";
  const utf8Name = encodeURIComponent(rawName).replace(/'/g, "%27");
  const pdf = await upstream.arrayBuffer();

  await noteActionFailure("pdf", sess.email, PDF_WINDOW_MS); // عدّاد الاستخدام

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}.pdf"; filename*=UTF-8''${utf8Name}.pdf`,
      "Cache-Control": "no-store",
    },
  });
}
