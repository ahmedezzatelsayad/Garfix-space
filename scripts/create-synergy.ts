/**
 * r33 — إنشاء شركة سنيرجي للمعدات والمستلزمات الطبية في قاعدة الإنتاج (Neon).
 * idempotent: upsert على slug — آمنة للإعادة.
 * Usage: DATABASE_URL=<neon> bun run scripts/create-synergy.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const data = {
    name: "Synergy Medical Equipment & Supplies Co.",
    nameAr: "شركة سنيرجي للمعدات والمستلزمات الطبية",
    slug: "tw_inv_synergy_v1",
    code: "synergy",
    currency: "KWD",
    phone: "97970219",
    email: "info@Synergymedical.com",
    address: "الكويت - حولي - شارع بيروت",
    city: "Hawally",
    color: "#0e7490",
    accent: "#0891b2",
    cardBg: "#ecfeff",
    emoji: "🩺",
    logo: "🩺",
    taxEnabled: false, // الكويت بلا ضريبة قيمة مضافة حالياً
    defaultTaxRate: 0,
  };

  const row = await db.company.upsert({
    where: { slug: data.slug },
    update: { ...data },
    create: { ...data },
  });

  console.log("✅ شركة سنيرجي جاهزة:", JSON.stringify({
    id: row.id, slug: row.slug, code: row.code, nameAr: row.nameAr,
    phone: row.phone, email: row.email, address: row.address, emoji: row.emoji,
  }, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
