import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionScope, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";

/**
 * r29 (S3): محادثات المساعد الذكي — تتطلب جلسة؛ المدير يرى الكل، والمشترك/
 * الموظف يرى محادثاته الخاصة (ownerEmail) أو محادثات شركاته المتاحة فقط.
 */

// GET /api/ai/conversations?companySlug=&limit= — قائمة محادثات المساعد الذكي
export async function GET(req: NextRequest) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const companySlug = req.nextUrl.searchParams.get("companySlug")?.trim() || undefined;
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50, 100);

    if (companySlug && !scope.all && !scope.slugs.includes(companySlug)) {
      return forbiddenCompanyResponse();
    }

    const rows = await db.aiConversation.findMany({
      where: companySlug
        ? { companySlug }
        : scope.all
          ? {}
          : {
              OR: [
                { ownerEmail: scope.session.email }, // r29: محادثاته الخاصة
                { companySlug: { in: scope.slugs } }, // r29: أو محادثات شركاته
              ],
            },
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
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id || id <= 0) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
    const exists = await db.aiConversation.findUnique({ where: { id } });
    if (!exists) return NextResponse.json({ error: "المحادثة غير موجودة" }, { status: 404 });
    // r29 (S3): حذف محادثة الغير → 403 (صاحبها أو شركة متاحة أو مدير فقط)
    const ownerOk =
      scope.all ||
      exists.ownerEmail === scope.session.email ||
      (exists.companySlug ? scope.slugs.includes(exists.companySlug) : false);
    if (!ownerOk) return forbiddenCompanyResponse();
    await db.aiConversation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
