import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheDelPattern } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth-server";

/**
 * PUT    /api/site/team/[id] — تعديل عضو (مدير)
 * DELETE /api/site/team/[id] — حذف عضو (مدير)
 */

interface Params {
  params: Promise<{ id: string }>;
}

function str(v: unknown, max = 300): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

function url(v: unknown): string | null | undefined {
  // undefined/null = الحقل غير مُرسل (تجاهل) · "" = امسح القيمة · غير صالح = ارفض
  if (v === undefined || v === null) return undefined;
  const t = str(v, 400);
  if (t === undefined) return null;
  return /^https?:\/\//i.test(t) ? t : undefined;
}

export async function PUT(req: NextRequest, { params }: Params) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = str(body.name, 120);
      if (!name) return NextResponse.json({ error: "الاسم لا يمكن أن يكون فارغاً" }, { status: 400 });
      data.name = name;
    }
    if (body.role !== undefined) data.role = str(body.role, 120) || "عضو الفريق";
    if (body.bio !== undefined) data.bio = str(body.bio, 600) ?? null;
    if (body.emoji !== undefined) data.emoji = str(body.emoji, 8) ?? null;
    if (body.email !== undefined) data.email = str(body.email, 200) ?? null;

    for (const k of ["photoUrl", "linkedin", "twitter"] as const) {
      if (body[k] !== undefined) {
        const u = url(body[k]);
        if (u === undefined) {
          return NextResponse.json({ error: `رابط ${k} يجب أن يبدأ بـ http(s)://` }, { status: 400 });
        }
        data[k] = u;
      }
    }
    if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) {
      data.sortOrder = Math.max(-9999, Math.min(9999, Math.round(Number(body.sortOrder))));
    }
    if (body.published !== undefined) data.published = !!body.published;

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: "لا توجد حقول للتحديث" }, { status: 400 });
    }

    const row = await db.teamMember.update({ where: { id }, data });
    await cacheDelPattern("site:team:*");
    return NextResponse.json({ member: { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() } });
  } catch (err) {
    const notFound = err instanceof Error && /not found|does not exist|P2025/i.test(err.message);
    if (notFound) return NextResponse.json({ error: "العضو غير موجود" }, { status: 404 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    }
    await db.teamMember.delete({ where: { id } });
    await cacheDelPattern("site:team:*");
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const notFound = err instanceof Error && /not found|does not exist|P2025/i.test(err.message);
    if (notFound) return NextResponse.json({ error: "العضو غير موجود" }, { status: 404 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
