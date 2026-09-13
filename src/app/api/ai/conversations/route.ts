import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/ai/conversations?companySlug=&limit= — قائمة محادثات المساعد الذكي
export async function GET(req: NextRequest) {
  try {
    const companySlug = req.nextUrl.searchParams.get("companySlug") ?? undefined;
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50, 100);

    const rows = await db.aiConversation.findMany({
      where: companySlug ? { companySlug } : {},
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        companySlug: true,
        model: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        companySlug: r.companySlug,
        model: r.model,
        messageCount: r._count.messages,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/ai/conversations?id=123 — حذف محادثة واحدة
export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id || id <= 0) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
    const exists = await db.aiConversation.findUnique({ where: { id } });
    if (!exists) return NextResponse.json({ error: "المحادثة غير موجودة" }, { status: 404 });
    await db.aiConversation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
