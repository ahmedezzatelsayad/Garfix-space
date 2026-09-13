/**
 * mini-service: keepalive — الحارس الرئيسي للبنية التحتية
 * يراقب كل 8 ثوانٍ: PostgreSQL (5432) • Valkey (6379) • pdf-service (3040) • Next.js (3000)
 * ويُعيد تشغيل أي خدمة متوقفة فوراً (spawn detached — تعيش حتى لو أُوقف الحارس لاحقاً).
 */
import { spawn, execFile } from "node:child_process";
import net from "node:net";
import fs from "node:fs";

const PG_BIN = "/home/z/my-project/infra/pg/usr/lib/postgresql/17/bin";
const PG_DATA = "/home/z/my-project/db/postgres-data";
const PG_ENV = {
  ...process.env,
  LD_LIBRARY_PATH: "/home/z/my-project/infra/pg/usr/lib/x86_64-linux-gnu",
};
const VALKEY_BIN = "/home/z/my-project/infra/valkey/valkey-8.1.1/src/valkey-server";
const VALKEY_CONF = "/home/z/my-project/infra/valkey/valkey.conf";
const PROJECT = "/home/z/my-project";
const DATABASE_URL = "postgresql://garfix:garfix2024@127.0.0.1:5432/garfix?schema=public";

function portOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect({ port, host, timeout: 900 });
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("error", () => resolve(false));
    s.once("timeout", () => { s.destroy(); resolve(false); });
  });
}

function spawnDetached(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; log: string }) {
  if (cmd.includes("/") && !fs.existsSync(cmd)) {
    console.warn(`[keepalive] ⚠️ الثنائية غير موجودة بعد: ${cmd} — تخطي`);
    return null;
  }
  const out = fs.openSync(opts.log, "a");
  const child = spawn(cmd, args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();
  return child;
}

async function ensurePostgres(): Promise<void> {
  if (await portOpen(5432)) return;
  console.log("[keepalive] PostgreSQL متوقف — إعادة التشغيل…");
  await new Promise<void>((resolve) => {
    execFile(`${PG_BIN}/pg_ctl`, ["-D", PG_DATA, "-o", "-p 5432 -h 127.0.0.1", "-l", `${PG_DATA}/pg.log`, "start"], { env: PG_ENV }, () => resolve());
  });
}

async function ensureValkey(): Promise<void> {
  if (await portOpen(6379)) return;
  console.log("[keepalive] Valkey متوقف — إعادة التشغيل…");
  spawnDetached(VALKEY_BIN, [VALKEY_CONF], { log: `${PROJECT}/infra/valkey-daemon.log` });
}

async function ensurePdfService(): Promise<void> {
  if (await portOpen(3040)) return;
  console.log("[keepalive] pdf-service متوقف — إعادة التشغيل…");
  spawnDetached("bun", ["run", "dev"], { cwd: `${PROJECT}/mini-services/pdf-service`, log: `${PROJECT}/mini-services/pdf-service/service.log` });
}

async function ensureNextDev(): Promise<void> {
  if (await portOpen(3000)) return;
  console.log("[keepalive] Next.js dev متوقف — مسح كاش Turbopack (يَتلف عند القتل المفاجئ) وإعادة التشغيل…");
  // كاش Turbopack يفسد عند SIGKILL → امسحه قبل كل إعادة تشغيل (إعادة تجميع أبطأ لكن مضمونة)
  try { fs.rmSync(`${PROJECT}/.next`, { recursive: true, force: true }); } catch { /* تجاهل */ }
  spawnDetached("bun", ["run", "dev"], {
    cwd: PROJECT,
    env: { ...process.env, DATABASE_URL },
    log: `${PROJECT}/next-dev.log`,
  });
}

let ticks = 0;
async function main(): Promise<void> {
  console.log(`[keepalive] الحارس الرئيسي يعمل (فحص كل 8 ثوانٍ)`);
  const loop = async () => {
    ticks++;
    try {
      await ensurePostgres().catch((e) => console.error("[keepalive] pg:", e?.message ?? e));
      await ensureValkey().catch((e) => console.error("[keepalive] valkey:", e?.message ?? e));
      await ensurePdfService().catch((e) => console.error("[keepalive] pdf:", e?.message ?? e));
      await ensureNextDev().catch((e) => console.error("[keepalive] next:", e?.message ?? e));
    } catch (e) {
      console.error("[keepalive] خطأ:", e instanceof Error ? e.message : e);
    }
    if (ticks % 450 === 0) console.log(`[keepalive] نبض: ${new Date().toISOString()} (ticks=${ticks})`);
  };
  await loop();
  setInterval(loop, 8000);
}

main();
