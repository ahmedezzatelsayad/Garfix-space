import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionScope, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";

// GET /api/ai/conversations/[id] — رسائل محادثة كاملة
// r29 (S3): تتطلب جلسة؛ المحادثة يجب أن تكون ملكاً للجلسة (ownerEmail) أو
// ضمن شركاتها المتاحة — كانت قراءة أي محادثة بمعرّفها المتسلسل متاحة للزوار.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const { id } = await params;
    const convId = Number(id);
    if (!convId || convId <= 0) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });

    const conv = await db.aiConversation.findUnique({
      where: { id: convId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conv) return NextResponse.json({ error: "المحادثة غير موجودة" }, { status: 404 });

    const ownerOk =
      scope.all ||
      conv.ownerEmail === scope.session.email ||
      (conv.companySlug ? scope.slugs.includes(conv.companySlug) : false);
    if (!ownerOk) return forbiddenCompanyResponse();

    return NextResponse.json({
      id: conv.id,
      title: conv.title,
      companySlug: conv.companySlug,
      model: conv.model,
      createdAt: conv.createdAt.toISOString(),
      messages: conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        model: m.model,
        latencyMs: m.latencyMs,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
