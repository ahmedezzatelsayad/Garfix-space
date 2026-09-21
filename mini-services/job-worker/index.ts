/**
 * mini-service: job-worker — عامل طوابير BullMQ (المستهلك)
 * المنفذ: 3041 (HTTP حالة فقط) | الطابور: garfix-tasks على Valkey 6379
 *
 * المهام المعالجة:
 *  - backup           : تفريغ كامل لقاعدة PostgreSQL → download/backups/*.json (نفس صيغة /api/backup)
 *  - cache-warm       : تسخين كاش Valkey عبر نداء مسارات لوحات التحكم والصفحات العامة
 *  - cleanup-backups  : حذف النسخ الأقدم من 14 يوماً مع الاحتفاظ بأحدث 5
 *  - db-maintenance   : VACUUM ANALYZE
 *
 * المهام المجدولة (تُسجَّل عند الإقلاع — upsert):
 *  - backup          يومياً 03:00 (Africa/Cairo)
 *  - cache-warm      كل ساعة
 *  - cleanup-backups سبتاً 04:30
 *  - db-maintenance  يومياً 04:15
 */
import { Worker, Queue } from "bullmq";
import pg from "pg";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const PORT = 3041;
const QUEUE_NAME = "garfix-tasks";
const PROJECT = "/home/z/my-project";
const BACKUP_DIR = path.join(PROJECT, "download", "backups");
const APP = "http://127.0.0.1:3000";

// ————— البيئة —————
function envFromDotenv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of fs.readFileSync(path.join(PROJECT, ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* لا .env */ }
  return out;
}
const dotenv = envFromDotenv();
/** أولوية postgres فقط: متغير البيئة قد يحمل قيمة SQLite قديمة مصدَّرة في الطرفية (مشكلة موثقة r14-infra)
 *  — قيمة file: تُتجاهل لصالح .env أو الافتراضي. */
const pickPgUrl = (...urls: Array<string | undefined>): string =>
  urls.find((u) => typeof u === "string" && u.startsWith("postgres")) ??
  "postgresql://garfix:garfix2024@127.0.0.1:5432/garfix?schema=public";
const DATABASE_URL = pickPgUrl(process.env.DATABASE_URL, dotenv.DATABASE_URL);
const VALKEY_HOST = process.env.VALKEY_HOST || "127.0.0.1";
const VALKEY_PORT = Number(process.env.VALKEY_PORT || 6379);
// r29: Valkey requirepass — كلمة المرور تُقرأ من البيئة أو .env الجذري (حمّاية من تهريب الأوامر عبر بروكسي Caddy)
const VALKEY_PASSWORD = process.env.VALKEY_PASSWORD || dotenv.VALKEY_PASSWORD || undefined;

// ————— عدّادات الحالة (لمنفذ 3041) —————
const state = {
  startedAt: Date.now(),
  processed: 0,
  failed: 0,
  lastJobAt: null as number | null,
  lastError: null as string | null,
  lastResult: null as Record<string, unknown> | null,
  currentJob: null as string | null,
};

// ————— حارس التفرد: نسخة واحدة فقط —————
// إذا كان منفذ 3041 محجوزاً فنسخة أخرى حية — اخرج فوراً قبل إنشاء أي Worker
// (bun --hot يبقي العملية حية بعد خطأ الوحدة — بدون هذا الحارس تتكدس عمال زومبي
//  تستهلك المهام بكود قديم — درس r14).
async function assertSingleton(): Promise<void> {
  const taken = await new Promise<boolean>((resolve) => {
    const s = net.connect({ port: PORT, host: "127.0.0.1", timeout: 500 });
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("error", () => resolve(false));
    s.once("timeout", () => { s.destroy(); resolve(false); });
  });
  if (taken) {
    console.log(`[job-worker] المنفذ ${PORT} محجوز بنسخة أخرى — خروج لتفادي التكرار`);
    process.exit(0);
  }
}
await assertSingleton();

// ————— اتصال PostgreSQL —————
async function pgClient(): Promise<pg.Client> {
  const c = new pg.Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

// ————— معالجات المهام —————

/** جداول النسخة الاحتياطية — مطابقة لصيغة /api/backup (مفاتيح camelCase + أسماء الجداول الحقيقية)
 *  حتى تستطيع زر Recovery استعادة النسخ التلقائية مباشرة. + جداول الموقع العام (r13) */
const BACKUP_TABLES: ReadonlyArray<[key: string, table: string]> = [
  ["companies", "Company"],
  ["clients", "clients"],
  ["invoices", "invoices"],
  ["payments", "payments"],
  ["productCatalog", "product_catalog"],
  ["purchaseInvoices", "purchase_invoices"],
  ["reminderLogs", "reminder_logs"],
  ["settings", "settings"],
  ["aiConversations", "ai_conversations"],
  ["aiMessages", "ai_messages"],
  ["teamMembers", "team_members"],
  ["siteContent", "site_content"],
];

async function jobBackup(): Promise<Record<string, unknown>> {
  const c = await pgClient();
  try {
    const data: Record<string, Record<string, unknown>[]> = {};
    const counts: Record<string, number> = {};
    for (const [key, table] of BACKUP_TABLES) {
      const r = await c.query(`SELECT * FROM "${table}"`);
      data[key] = r.rows;
      counts[key] = r.rowCount ?? 0;
    }
    const dump = {
      app: "garfix-accounts",
      version: 2,
      engine: "postgresql",
      generatedAt: new Date().toISOString(),
      counts,
      data,
    };
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    const file = path.join(BACKUP_DIR, `garfix-backup-auto-${stamp}.json`);
    const json = JSON.stringify(dump, null, 2);
    fs.writeFileSync(file, json, "utf8");
    return { file: path.basename(file), bytes: Buffer.byteLength(json), counts, rows: Object.values(counts).reduce((a, b) => a + b, 0) };
  } finally {
    await c.end();
  }
}

async function jobCacheWarm(): Promise<Record<string, unknown>> {
  const c = await pgClient();
  let slugs: string[] = [];
  try {
    const r = await c.query(`SELECT slug FROM "Company"`);
    slugs = r.rows.map((x: { slug: string }) => x.slug);
  } finally {
    await c.end();
  }
  const warmed: string[] = [];
  const errors: string[] = [];
  const hit = async (p: string) => {
    try {
      const res = await fetch(`${APP}${p}`, { cache: "no-store" });
      warmed.push(`${p} → ${res.status}`);
      if (!res.ok) errors.push(`${p}: HTTP ${res.status}`);
    } catch (e) {
      errors.push(`${p}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  await hit("/api/companies");
  await hit("/api/site/stats");
  await hit("/api/site/team");
  for (const s of slugs) {
    await hit(`/api/dashboard/stats?companySlug=${encodeURIComponent(s)}`);
    await hit(`/api/dashboard/revenue-by-month?companySlug=${encodeURIComponent(s)}`);
    await hit(`/api/dashboard/recent-invoices?companySlug=${encodeURIComponent(s)}`);
    await hit(`/api/catalog?companySlug=${encodeURIComponent(s)}`);
    await hit(`/api/clients?company=${encodeURIComponent(s)}`);
  }
  return { companies: slugs.length, warmed: warmed.length, errors: errors.length ? errors.slice(0, 5) : [] };
}

async function jobCleanupBackups(opts: { days?: number; keepMin?: number }): Promise<Record<string, unknown>> {
  const days = Math.max(1, Number(opts.days ?? 14));
  const keepMin = Math.max(1, Number(opts.keepMin ?? 5));
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("garfix-backup-") && f.endsWith(".json"))
    .map((f) => {
      const full = path.join(BACKUP_DIR, f);
      const st = fs.statSync(full);
      return { f: full, size: st.size, mtime: st.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime); // الأحدث أولاً
  const cutoff = Date.now() - days * 86400_000;
  let deleted = 0;
  let freedBytes = 0;
  files.forEach((x, i) => {
    if (i < keepMin) return; // احتفظ بأحدث N دائماً
    if (x.mtime < cutoff) {
      try {
        fs.unlinkSync(x.f);
        deleted++;
        freedBytes += x.size;
      } catch { /* تجاهل */ }
    }
  });
  return { scanned: files.length, deleted, freedBytes, policy: { days, keepMin } };
}

async function jobDbMaintenance(): Promise<Record<string, unknown>> {
  const c = await pgClient();
  try {
    const t0 = Date.now();
    await c.query("VACUUM ANALYZE");
    return { ok: true, durationMs: Date.now() - t0, command: "VACUUM ANALYZE" };
  } finally {
    await c.end();
  }
}

type JobData = Record<string, unknown> & { days?: number; keepMin?: number };

const processors: Record<string, (d: JobData) => Promise<Record<string, unknown>>> = {
  backup: () => jobBackup(),
  "cache-warm": () => jobCacheWarm(),
  "cleanup-backups": (d) => jobCleanupBackups({ days: d.days, keepMin: d.keepMin }),
  "db-maintenance": () => jobDbMaintenance(),
};

// ————— الطابور + تسجيل المجدولة —————
const queue = new Queue(QUEUE_NAME, {
  connection: { host: VALKEY_HOST, port: VALKEY_PORT, password: VALKEY_PASSWORD, maxRetriesPerRequest: null },
});

async function registerRepeatables(): Promise<void> {
  const defs = [
    { id: "sched-backup", name: "backup", pattern: "0 3 * * *" },
    { id: "sched-cache-warm", name: "cache-warm", pattern: "0 * * * *" },
    { id: "sched-cleanup-backups", name: "cleanup-backups", pattern: "30 4 * * 6" },
    { id: "sched-db-maintenance", name: "db-maintenance", pattern: "15 4 * * *" },
  ];
  for (const d of defs) {
    // upsertJobScheduler يُكرِّر بطبيعته حسب المعرف — آمن للتكرار عند كل إقلاع
    await queue.upsertJobScheduler(d.id, { pattern: d.pattern, tz: "Africa/Cairo" }, { name: d.name, data: {} });
  }
  console.log(`[job-worker] المهام المجدولة مسجلة (Job Schedulers): ${defs.map((d) => `${d.name}(${d.pattern})`).join(" · ")}`);
}

// ————— العامل —————
const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const fn = processors[job.name];
    if (!fn) throw new Error(`نوع مهمة غير معروف: ${job.name}`);
    state.currentJob = `${job.name}#${job.id}`;
    try {
      const res = await fn((job.data ?? {}) as JobData);
      state.lastResult = { name: job.name, at: new Date().toISOString(), res };
      return res;
    } finally {
      state.currentJob = null;
    }
  },
  { connection: { host: VALKEY_HOST, port: VALKEY_PORT, password: VALKEY_PASSWORD, maxRetriesPerRequest: null }, concurrency: 2 },
);

worker.on("completed", (job) => {
  state.processed++;
  state.lastJobAt = Date.now();
  console.log(`[job-worker] ✅ ${job.name}#${job.id} (${job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : "?"}ms)`);
});
worker.on("failed", (job, err) => {
  state.failed++;
  state.lastJobAt = Date.now();
  state.lastError = `${job?.name ?? "?"}: ${err.message}`;
  console.error(`[job-worker] ❌ ${job?.name}#${job?.id} — ${err.message}`);
});
worker.on("error", (e) => {
  state.lastError = e.message;
  console.error(`[job-worker] worker error: ${e.message}`);
});

// ————— منفذ الحالة 3041 —————
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/healthz") {
      return Response.json({
        ok: true,
        service: "job-worker",
        queue: QUEUE_NAME,
        engine: "bullmq@6",
        uptimeSec: Math.round((Date.now() - state.startedAt) / 1000),
        processed: state.processed,
        failed: state.failed,
        currentJob: state.currentJob,
        lastJobAt: state.lastJobAt,
        lastError: state.lastError,
        lastResult: state.lastResult,
        pid: process.pid,
      });
    }
    if (url.pathname === "/stats") {
      const counts = await queue.getJobCounts("waiting", "active", "delayed", "failed", "completed");
      return Response.json({ counts });
    }
    return new Response("not found", { status: 404 });
  },
});

// ————— الإقلاع والإطفاء —————
registerRepeatables().catch((e) => console.error(`[job-worker] تعذر تسجيل المجدولة: ${e.message}`));
console.log(`[job-worker] 🚀 العامل يعمل — طابور «${QUEUE_NAME}» على ${VALKEY_HOST}:${VALKEY_PORT} · الحالة على :${PORT}/healthz`);

async function shutdown(): Promise<void> {
  console.log("[job-worker] إيقاف نظيف…");
  await worker.close().catch(() => {});
  await queue.close().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
