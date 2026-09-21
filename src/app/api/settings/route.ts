import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheWrap, invalidateSettings } from "@/lib/cache";
import { getSession, requireCompanyAccess, unauthorizedResponse } from "@/lib/auth-server";

/**
 * Server-side company settings (r9) — replaces localStorage-only persistence
 * for the KNET pay-link template and per-client credit limits, so settings
 * now sync across devices/browsers for the same company.
 *
 * GET  /api/settings?companySlug=…&keys=paylink_tpl,credit
 *   → { settings: { paylink_tpl: <parsed JSON value>, credit: <…> } }
 *     (missing keys omitted from the response)
 * PUT  /api/settings
 *   { companySlug, key, value }   (value: any JSON-serialisable object)
 *   → 200 { key, companySlug, value, updatedAt }  (upsert semantics)
 *
 * r29 (S1): القراءة والكتابة تتطلبان جلسة + ملكية الشركة — كانت مفتوحة
 * بالكامل (أي زائر يقرأ/يستبدل إعدادات أي شركة: قوالب روابط الدفع وحدود الائتمان).
 */

const MAX_VALUE_BYTES = 64 * 1024; // 64KB per setting — plenty for maps/templates

export async function GET(req: NextRequest) {
  // r29 (S1): إعدادات شركة = بيانات الشركة — ملكية مطلوبة
  const companySlug0 = req.nextUrl.searchParams.get("companySlug")?.trim() || "";
  const denied = await requireCompanyAccess(req, companySlug0);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const companySlug = searchParams.get("companySlug")?.trim() || "";
  const keysRaw = searchParams.get("keys")?.trim() || "";

  if (!companySlug) {
    return NextResponse.json({ error: "companySlug مطلوب" }, { status: 400 });
  }
  if (!keysRaw) {
    return NextResponse.json({ error: "keys مطلوبة" }, { status: 400 });
  }

  const keys = keysRaw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k && /^[a-zA-Z0-9_.-]+$/.test(k))
    .slice(0, 20);
  if (keys.length === 0) {
    return NextResponse.json({ error: "keys غير صالحة" }, { status: 400 });
  }

  const { settings, companySlug: slugOut } = await cacheWrap(
    `settings:${companySlug}:${keysRaw}`,
    60,
    async () => {
      const rows = await db.setting.findMany({
        where: { companySlug, key: { in: keys } },
        select: { key: true, value: true, updatedAt: true },
      });

      const settings: Record<string, unknown> = {};
      for (const row of rows) {
        try {
          settings[row.key] = JSON.parse(row.value);
        } catch {
          settings[row.key] = null; // corrupted value → treat as absent
        }
      }
      return { settings, companySlug };
    },
  );

  return NextResponse.json({ settings, companySlug: slugOut });
}

export async function PUT(req: NextRequest) {
  // r29 (S1): بوابة الجلسة قبل أي تحقق آخر — الطلبات المجهولة ترى 401 دائماً
  // (وليس 400 من تحقق companySlug الذي يسبق الفحص) حتى لا تتسرب تفاصيل التحقق.
  if (!getSession(req)) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const companySlug = typeof body.companySlug === "string" ? body.companySlug.trim() : "";
  const key = typeof body.key === "string" ? body.key.trim() : "";

  if (!companySlug) {
    return NextResponse.json({ error: "companySlug مطلوب" }, { status: 400 });
  }
  // r29 (S1): كتابة إعدادات شركة غيرك → 403
  const denied = await requireCompanyAccess(req, companySlug);
  if (denied) return denied;
  if (!key || !/^[a-zA-Z0-9_.-]+$/.test(key)) {
    return NextResponse.json({ error: "key غير صالحة" }, { status: 400 });
  }

  // value: any JSON-serialisable payload (object / map / string / number …)
  let serialized: string;
  if (typeof body.value === "string") {
    // plain strings (e.g. pay-link template) are stored as a JSON string
    serialized = JSON.stringify(body.value);
  } else {
    try {
      serialized = JSON.stringify(body.value ?? null);
    } catch {
      return NextResponse.json({ error: "قيمة غير قابلة للتسلسل" }, { status: 400 });
    }
  }
  if (serialized.length > MAX_VALUE_BYTES) {
    return NextResponse.json({ error: "القيمة أكبر من الحد المسموح" }, { status: 413 });
  }

  const saved = await db.setting.upsert({
    where: { key_companySlug: { key, companySlug } },
    update: { value: serialized },
    create: { key, companySlug, value: serialized },
    select: { key: true, companySlug: true, value: true, updatedAt: true },
  });

  await invalidateSettings(companySlug);

  return NextResponse.json({
    key: saved.key,
    companySlug: saved.companySlug,
    value: JSON.parse(saved.value),
    updatedAt: saved.updatedAt?.toISOString?.() ?? saved.updatedAt,
  });
}
