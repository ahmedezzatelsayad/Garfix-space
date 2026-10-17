/**
 * r34 — تفعيل DeepSeek كالمزوّد الأساسي للوكيل والمساعد الذكي.
 * Usage: DATABASE_URL=<url> bun run scripts/enable-deepseek.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const KEY = process.argv[2] || "";

async function main() {
  if (!KEY.startsWith("sk-")) {
    console.error("مرّر المفتاح: bun run scripts/enable-deepseek.ts sk-...");
    process.exit(1);
  }
  const row = await db.aiSetting.upsert({
    where: { provider: "deepseek" },
    update: { apiKey: KEY, baseUrl: "https://api.deepseek.com", model: "deepseek-chat", enabled: true },
    create: { provider: "deepseek", apiKey: KEY, baseUrl: "https://api.deepseek.com", model: "deepseek-chat", enabled: true },
  });
  console.log("✅ DeepSeek أساسي:", JSON.stringify({ provider: row.provider, model: row.model, enabled: row.enabled, key: `${row.apiKey.slice(0, 5)}••••${row.apiKey.slice(-4)}` }));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
