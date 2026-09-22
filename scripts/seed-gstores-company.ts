/**
 * seed-gstores-company.ts — شركة «منصة متاجر Garfix» في ERP مربوطة
 * بمتجر garfix-demo (المرحلة 1: استقبال فواتير أوامر المتاجر).
 *
 * npx tsx scripts/seed-gstores-company.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const company = await db.company.upsert({
    where: { slug: "gs_platform_v1" },
    update: { storesSlug: "garfix-demo" },
    create: {
      name: "Garfix Stores Platform",
      nameAr: "منصة متاجر جارفكس",
      slug: "gs_platform_v1",
      code: "gstores",
      currency: "KWD",
      emoji: "🏗️",
      storesSlug: "garfix-demo",
      phone: "+96598737207",
      email: "stores@garfix.io",
      city: "Kuwait",
    },
  });
  console.log("[seed-gstores] ✔", JSON.stringify({
    id: company.id,
    slug: company.slug,
    code: company.code,
    storesSlug: company.storesSlug,
  }));
}

main()
  .catch((e) => { console.error("[seed-gstores] FAILED:", e.message); process.exit(1); })
  .finally(() => db.$disconnect());
