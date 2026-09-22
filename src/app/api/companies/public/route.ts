import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheWrap } from "@/lib/cache";

/**
 * r26 — تكامل Garfix.io: قائمة عامة (بلا مصادقة) بشركات ERP المتاحة للربط.
 * تُستخدم في لوحة مؤسس Garfix.io لبناء رابط ERP مخصص لكل عميل (?co=<code>).
 * لا تُرجع إلا حقول غير حساسة: الكود/الاسم/الإيموجي — بلا هواتف أو إعدادات مالية.
 * CORS مفتوح عمداً: المنصة (garfix.io) تعمل على أصل مختلف وتجلب هذه القائمة من المتصفح.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// نفس الشركات المدمجة في الواجهة (App.jsx COMPANIES) — fallback ثابت + سجل الخادم
const BUILTIN_PUBLIC = [
  { code: "tawfeer", name: "Tawfeer Online Shop", nameAr: "توفير أونلاين شوب", emoji: "🛒" },
  { code: "mahhal", name: "Mahhal Store", nameAr: "محل ستور", emoji: "🏪" },
  { code: "boss", name: "Boss Electronics", nameAr: "بوس إلكترونيكس", emoji: "⚡" },
  { code: "laqta", name: "Laqta Trading", nameAr: "لقطه للتجارة", emoji: "♾️" },
];

export async function GET() {
  const list = await cacheWrap("companies:public", 300, async () => {
    const out = [...BUILTIN_PUBLIC];
    try {
      const rows = await db.company.findMany({
        select: { code: true, slug: true, name: true, nameAr: true, emoji: true },
        orderBy: { id: "asc" },
      });
      for (const r of rows) {
        const code = r.code || r.slug;
        if (!code || out.some((c) => c.code === code)) continue; // المدمجة أولاً
        out.push({ code, name: r.name, nameAr: r.nameAr || r.name, emoji: r.emoji || "🏢" });
      }
    } catch {
      // إن تعذّر الوصول للقاعدة نُرجع القائمة المدمجة فقط
    }
    return out;
  });
  return NextResponse.json({ companies: list }, { headers: CORS });
}
