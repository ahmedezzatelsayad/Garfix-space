import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/pdf — HTML → PDF proxy.
 * Body: { html: string, filename?: string, format?: "A4"|"A5", landscape?: boolean }
 * Forwards to the pdf-service mini-service on 127.0.0.1:3040 (server-to-server,
 * never exposed through the gateway) and streams the PDF back as an attachment.
 */
const PDF_SERVICE = "http://127.0.0.1:3040/";
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
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
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "فشل توليد ملف PDF", detail: detail.slice(0, 300) },
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
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}.pdf"; filename*=UTF-8''${utf8Name}.pdf`,
      "Cache-Control": "no-store",
    },
  });
}
