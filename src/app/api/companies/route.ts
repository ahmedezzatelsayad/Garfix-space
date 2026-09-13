import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheWrap, cacheDelPattern } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth-server";

/**
 * r12: إدارة الشركات — سجل كامل قابل للتعديل من الواجهة (كانت hard-coded في الواجهة فقط).
 *
 * GET  /api/companies                → { companies: CompanyProfile[] }
 * POST /api/companies  { name, nameAr?, currency?, phone?, email?, address?, city?,
 *                        sellerRef?, manager?, managerPhone?, color?, accent?,
 *                        cardBg?, emoji?, code?, slug? }
 *                                     → 201 { company }  (code/slug تُولَّد من الاسم عند غيابهما)
 */

interface CompanyProfile {
  slug: string;
  code: string;
  name: string;
  nameAr: string | null;
  currency: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  sellerRef: string | null;
  manager: string | null;
  managerPhone: string | null;
  color: string | null;
  accent: string | null;
  cardBg: string | null;
  emoji: string | null;
  logo: string | null;
  createdAt: string;
  updatedAt: string;
}

function serializeCompany(c: {
  slug: string;
  code: string | null;
  name: string;
  nameAr: string | null;
  currency: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  sellerRef: string | null;
  manager: string | null;
  managerPhone: string | null;
  color: string | null;
  accent: string | null;
  cardBg: string | null;
  emoji: string | null;
  logo: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CompanyProfile {
  return {
    slug: c.slug,
    code: c.code ?? c.slug,
    name: c.name,
    nameAr: c.nameAr,
    currency: c.currency,
    phone: c.phone,
    email: c.email,
    address: c.address,
    city: c.city,
    sellerRef: c.sellerRef,
    manager: c.manager,
    managerPhone: c.managerPhone,
    color: c.color,
    accent: c.accent,
    cardBg: c.cardBg,
    emoji: c.emoji,
    logo: c.logo,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// ── التحقق من المدخلات ──
const HEX = /^#[0-9a-fA-F]{6}$/;
const CURRENCY = /^[A-Z]{3}$/;

function str(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

function latinSlug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || `co-${Date.now().toString(36)}`
  );
}

export async function GET() {
  try {
    const companies = await cacheWrap("companies:all", 60, async () => {
      const rows = await db.company.findMany({ orderBy: { id: "asc" } });
      return rows.map(serializeCompany);
    });
    return NextResponse.json({ companies });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // r13: إضافة شركة = عملية إدارية — تتطلب جلسة مدير
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const name = str(body.name);
    if (!name) {
      return NextResponse.json({ error: "اسم الشركة (الإنجليزي) مطلوب" }, { status: 400 });
    }

    // code قصير للتوجيه في الواجهة + slug مفتاح التخزين
    let code = str(body.code, 24)?.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!code) code = latinSlug(name);

    let slug = str(body.slug, 60);
    if (!slug) slug = `tw_inv_${code}_v1`;

    // تحقق من التفرد
    const dupCode = await db.company.findFirst({ where: { code } });
    if (dupCode) {
      return NextResponse.json(
        { error: `الكود "${code}" مستخدم مسبقاً — اختر كوداً آخر` },
        { status: 409 },
      );
    }
    const dupSlug = await db.company.findUnique({ where: { slug } });
    if (dupSlug) {
      return NextResponse.json(
        { error: `المفتاح "${slug}" مستخدم مسبقاً` },
        { status: 409 },
      );
    }

    const currency = str(body.currency, 3)?.toUpperCase();
    if (currency && !CURRENCY.test(currency)) {
      return NextResponse.json(
        { error: "رمز العملة يجب أن يكون 3 أحرف لاتينية (مثل KWD)" },
        { status: 400 },
      );
    }

    const color = str(body.color, 7);
    const accent = str(body.accent, 7);
    if ((color && !HEX.test(color)) || (accent && !HEX.test(accent))) {
      return NextResponse.json({ error: "الألوان يجب أن تكون hex مثل #1e3a5f" }, { status: 400 });
    }

    const row = await db.company.create({
      data: {
        name,
        slug,
        code,
        currency: currency || "KWD",
        nameAr: str(body.nameAr) ?? name,
        phone: str(body.phone) ?? null,
        email: str(body.email) ?? null,
        address: str(body.address) ?? null,
        city: str(body.city) ?? null,
        sellerRef: str(body.sellerRef) ?? null,
        manager: str(body.manager) ?? null,
        managerPhone: str(body.managerPhone) ?? null,
        color: color ?? "#334155",
        accent: accent ?? color ?? "#64748b",
        cardBg: str(body.cardBg) ?? "#f1f5f9",
        emoji: str(body.emoji, 8) ?? "🏢",
        logo: str(body.emoji, 8) ?? "🏢",
      },
    });

    await cacheDelPattern("companies:*");
    await cacheDelPattern("ai:ctx:*"); // لقطة الشركات في سياق المساعد الذكي

    return NextResponse.json({ company: serializeCompany(row) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
