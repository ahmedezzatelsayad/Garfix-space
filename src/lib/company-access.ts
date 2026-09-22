import { db } from "@/lib/db";

/**
 * r29 (29-fix-api): مطابقة «شركة العميل» عبر كل صيغ تخزينها.
 *
 * عمود Client.company يُكتب تاريخياً بصيغ مختلفة: الاسم العربي (بيانات البذر)،
 * أو الكود (الواجهة ترسل company.id = الكود)، أو الـ slug (شركات المشتركين
 * المسجلين وإجراءات المساعد الذكي). هذه الأداة تُرجع مجموعة القيم المقبولة
 * (slug / code / name / nameAr — بأحرف صغيرة) لكل slug مطلوب، وتُستخدم لعزل
 * العملاء والداشبورد والدمج على مستوى الشركة مهما كانت صيغة التخزين.
 */

/** مجموعة القيم التي تعني «هذا الصف يتبع هذه الشركة» (مقارنة بأحرف صغيرة) */
export async function companyMatchKeys(slugs: string[]): Promise<Set<string>> {
  const keys = new Set<string>();
  const cleaned = [...new Set(slugs.map((s) => String(s ?? "").trim()).filter(Boolean))];
  if (!cleaned.length) return keys;
  try {
    const rows = await db.company.findMany({
      where: { slug: { in: cleaned } },
      select: { slug: true, code: true, name: true, nameAr: true },
    });
    for (const r of rows) {
      for (const v of [r.slug, r.code, r.name, r.nameAr]) {
        const s = String(v ?? "").trim().toLowerCase();
        if (s) keys.add(s);
      }
    }
  } catch {
    /* قاعدة غير متاحة — مجموعة فارغة (لا يُطابق شيء) */
  }
  return keys;
}

/** هل يتبع صف عميلٌ إحدى شركات slugs؟ (قيمة company بأحرف صغيرة عند الاستدعاء) */
export function clientBelongsToKeys(company: string | null | undefined, keys: Set<string>): boolean {
  const v = String(company ?? "").trim().toLowerCase();
  return !!v && keys.has(v);
}
