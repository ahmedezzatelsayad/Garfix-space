/**
 * r10: ترحيل البيانات من SQLite (custom.db) إلى PostgreSQL (garfix)
 * يقرأ كل جدول ديناميكياً عبر PRAGMA table_info ويحافظ على المعرفات (ids)
 * ثم يعيد ضبط تسلسلات PostgreSQL حتى تستمر الإدراجات الجديدة بشكل صحيح.
 * التشغيل: DATABASE_URL=postgresql://... bun scripts/migrate-sqlite-to-pg.ts
 */
import { Database } from "bun:sqlite";
import { Client } from "pg";

const SQLITE_PATH = process.argv[2] || "/home/z/my-project/db/custom.db";

// اقرأ DATABASE_URL من .env مباشرة (أفضل من الاعتماد على بيئة الشل)
async function loadDotEnv(): Promise<string> {
  try {
    const envFile = await Bun.file("/home/z/my-project/.env").text();
    const match = envFile.match(/^DATABASE_URL=(.+)$/m);
    if (match) return match[1].trim();
  } catch {}
  return "postgresql://garfix:garfix2024@127.0.0.1:5432/garfix?schema=public";
}
const PG_URL = await loadDotEnv();

// جداول النظام الأساسية فقط (بدون sqlite_sequence)
const TABLES = [
  "Company",
  "clients",
  "invoices",
  "payments",
  "product_catalog",
  "purchase_invoices",
  "reminder_logs",
  "settings",
];

// Prisma/SQLite تخزّن DateTime كعدد ملّي ثانية — PostgreSQL يحتاج نص ISO
const DATE_COLS = new Set(["createdAt", "updatedAt"]);
function toPgValue(col: string, v: unknown): unknown {
  if (DATE_COLS.has(col)) {
    if (typeof v === "number") return new Date(v).toISOString();
    if (typeof v === "string" && /^\d{10,}$/.test(v.trim())) return new Date(Number(v)).toISOString();
  }
  return v === undefined ? null : v;
}

async function main() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pg = new Client({ connectionString: PG_URL });
  await pg.connect();

  console.log(`🚚 ترحيل ${SQLITE_PATH} → ${PG_URL.replace(/:[^:@/]*@/,":****@")}`);
  let totalRows = 0;

  for (const table of TABLES) {
    const cols = sqlite
      .query(`PRAGMA table_info("${table}")`)
      .all() as { name: string }[];
    if (!cols.length) {
      console.log(`⏭️  ${table}: غير موجودة في SQLite — تخطي`);
      continue;
    }
    const colNames = cols.map((c) => c.name);
    const rows = sqlite.query(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];

    if (rows.length) {
      const colList = colNames.map((c) => `"${c}"`).join(", ");
      const placeholders = colNames.map((_, i) => `$${i + 1}`).join(", ");
      const sql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
      for (const row of rows) {
        const values = colNames.map((c) => toPgValue(c, row[c]));
        await pg.query(sql, values);
      }
    }

    // إعادة ضبط التسلسل حتى لا تتعارض الإدراجات القادمة
    const seq = await pg.query(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false) AS v`
    );
    console.log(`✅ ${table}: ${rows.length} صفوف (التسلسل ← ${seq.rows[0]?.v ?? "-"})`);
    totalRows += rows.length;
  }

  console.log(`\n🎉 اكتمل الترحيل: ${totalRows} صفاً إجمالاً`);

  // تحقق سريع من التطابق
  for (const table of TABLES) {
    const s = (sqlite.query(`SELECT COUNT(*) c FROM "${table}"`).get() as { c: number }).c;
    const p = (await pg.query(`SELECT COUNT(*) c FROM "${table}"`)).rows[0].c;
    const mark = Number(s) === Number(p) ? "✔" : "✘ عدم تطابق!";
    console.log(`${mark} ${table}: sqlite=${s} pg=${p}`);
  }

  sqlite.close();
  await pg.end();
}

main().catch((e) => {
  console.error("❌ فشل الترحيل:", e);
  process.exit(1);
});
