import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheWrap, cacheDelPattern } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth-server";

/**
 * GET  /api/site/content → { content: { key: value } }   (عام — صفحات الموقع)
 * PUT  /api/site/content { content: { key: value, … } }  (مدير — تبويب 🌐 الموقع)
 * المفاتيح: founder_name | founder_title | founder_message | hero_title | hero_sub | …
 */

const KEY_RE = /^[a-z0-9_]{1,60}$/;
const VALUE_MAX = 20_000;

export async function GET() {
  try {
    const content = await cacheWrap("site:content", 60, async () => {
      const rows = await db.siteContent.findMany();
      const out: Record<string, string> = {};
      for (const r of rows) out[r.key] = r.value;
      return out;
    });
    return NextResponse.json({ content });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as { content?: unknown };
    const content = (body.content ?? {}) as Record<string, unknown>;
    const entries = Object.entries(content).filter(([k, v]) => {
      if (!KEY_RE.test(k)) return false;
      if (typeof v !== "string") return false;
      return true;
    });
    if (!entries.length) {
      return NextResponse.json({ error: "لا توجد حقول صالحة للحفظ (مفاتيح a-z0-9_ وقيم نصية)" }, { status: 400 });
    }

    for (const [key, value] of entries) {
      await db.siteContent.upsert({
        where: { key },
        update: { value: value.slice(0, VALUE_MAX) },
        create: { key, value: value.slice(0, VALUE_MAX) },
      });
    }
    await cacheDelPattern("site:*");

    return NextResponse.json({ ok: true, saved: entries.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
