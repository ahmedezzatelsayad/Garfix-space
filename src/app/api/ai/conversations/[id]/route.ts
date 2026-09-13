import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/ai/conversations/[id] — رسائل محادثة كاملة
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const convId = Number(id);
    if (!convId || convId <= 0) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });

    const conv = await db.aiConversation.findUnique({
      where: { id: convId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conv) return NextResponse.json({ error: "المحادثة غير موجودة" }, { status: 404 });

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
