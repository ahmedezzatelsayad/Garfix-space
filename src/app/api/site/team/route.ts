import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheWrap, cacheDelPattern } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth-server";

/**
 * GET  /api/site/team          → { team } المنشورون فقط (عام — صفحة الفريق)
 * GET  /api/site/team?all=1    → الكل بما فيه المسودات (مدير)
 * POST /api/site/team {…}      → إضافة عضو (مدير — تبويب 🌐 الموقع)
 */

interface MemberInput {
  name: string;
  role: string;
  bio: string | null;
  emoji: string | null;
  photoUrl: string | null;
  email: string | null;
  linkedin: string | null;
  twitter: string | null;
  sortOrder: number;
  published: boolean;
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

export async function GET(req: NextRequest) {
  try {
    const wantAll = req.nextUrl.searchParams.get("all") === "1";
    if (wantAll) {
      const denied = requireAdmin(req);
      if (denied) return denied;
    }
    const cacheKey = wantAll ? "site:team:all" : "site:team:public";
    const team = await cacheWrap(cacheKey, 60, async () => {
      const rows = await db.teamMember.findMany({
        where: wantAll ? undefined : { published: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      return rows.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        bio: m.bio,
        emoji: m.emoji,
        photoUrl: m.photoUrl,
        email: m.email,
        linkedin: m.linkedin,
        twitter: m.twitter,
        sortOrder: m.sortOrder,
        published: m.published,
      }));
    });
    return NextResponse.json({ team });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = str(body.name, 120);
    if (!name) return NextResponse.json({ error: "اسم العضو مطلوب" }, { status: 400 });

    const photo = url(body.photoUrl);
    const linkedin = url(body.linkedin);
    const twitter = url(body.twitter);
    if ([photo, linkedin, twitter].includes(undefined)) {
      return NextResponse.json({ error: "روابط الصور/لينكدإن/تويتر يجب أن تبدأ بـ http(s)://" }, { status: 400 });
    }

    const data: MemberInput = {
      name,
      role: str(body.role, 120) || "عضو الفريق",
      bio: str(body.bio, 600) ?? null,
      emoji: str(body.emoji, 8) ?? null,
      photoUrl: photo ?? null,
      email: str(body.email, 200) ?? null,
      linkedin: linkedin ?? null,
      twitter: twitter ?? null,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.max(-9999, Math.min(9999, Math.round(Number(body.sortOrder)))) : 99,
      published: body.published === undefined ? true : !!body.published,
    };

    const row = await db.teamMember.create({ data });
    await cacheDelPattern("site:team:*");
    return NextResponse.json({ member: { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
