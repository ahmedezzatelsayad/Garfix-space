/**
 * mini-service: PostgreSQL 17 — مشرِف يتأكد من بقاء الخادم حياً
 * المنفذ: 5432 (داخلي فقط) | البيانات: /home/z/my-project/db/postgres-data
 */
import { execFile } from "node:child_process";

const PGBIN = "/home/z/my-project/infra/pg/usr/lib/postgresql/17/bin";
const PGDATA = "/home/z/my-project/db/postgres-data";
const ENV = {
  ...process.env,
  LD_LIBRARY_PATH: "/home/z/my-project/infra/pg/usr/lib/x86_64-linux-gnu",
};
const PORT = 5432;

function run(bin: string, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(`${PGBIN}/${bin}`, args, { env: ENV }, (err, stdout, stderr) => {
      resolve({ code: err ? (err as NodeJS.ErrnoException & { code?: number }).code ?? 1 : 0, out: `${stdout || ""}${stderr || ""}` });
    });
  });
}

async function isReady(): Promise<boolean> {
  const r = await run("pg_isready", ["-h", "127.0.0.1", "-p", String(PORT)]);
  return r.out.includes("accepting connections");
}

async function startPg(): Promise<boolean> {
  console.log(`[postgres-service] starting PostgreSQL on 127.0.0.1:${PORT}`);
  const r = await run("pg_ctl", ["-D", PGDATA, "-o", `-p ${PORT} -h 127.0.0.1`, "-l", `${PGDATA}/pg.log`, "start"]);
  console.log(`[postgres-service] pg_ctl: ${r.out.trim().split("\n").pop()}`);
  return r.code === 0;
}

let checks = 0;
let restarts = 0;

async function main(): Promise<void> {
  console.log(`[postgres-service] supervisor up (checking every 5s)`);
  if (!(await isReady())) await startPg();

  setInterval(async () => {
    checks++;
    if (!(await isReady())) {
      restarts++;
      console.warn(`[postgres-service] not responding (check #${checks}) — restart #${restarts}`);
      await startPg();
    }
  }, 5000);
}

process.on("SIGTERM", async () => {
  console.log("[postgres-service] SIGTERM — stopping postgres");
  await run("pg_ctl", ["-D", PGDATA, "-m", "fast", "stop"]);
  process.exit(0);
});

main();
