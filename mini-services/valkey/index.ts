/**
 * mini-service: Valkey (بديل Redis الفعلي) — مشرِف يعيد تشغيل الخادم تلقائياً
 * المنفذ: 6379 (داخلي فقط) | البيانات: /home/z/my-project/db/valkey-data
 */
import { spawn } from "node:child_process";

const BIN = "/home/z/my-project/infra/valkey/valkey-8.1.1/src/valkey-server";
const CONF = "/home/z/my-project/infra/valkey/valkey.conf";
const PORT = 6379;

console.log(`[valkey-service] starting Valkey on 127.0.0.1:${PORT}`);

let child: ReturnType<typeof spawn> | null = null;
let restarts = 0;

function start(): void {
  child = spawn(BIN, [CONF], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  child.stdout?.on("data", (d: Buffer) => {
    const line = d.toString().trim();
    if (line) console.log(`[valkey] ${line}`);
  });
  child.stderr?.on("data", (d: Buffer) => console.error(`[valkey:err] ${d.toString().trim()}`));

  child.on("exit", (code, signal) => {
    restarts++;
    console.warn(`[valkey-service] exited (code=${code} signal=${signal}) — restart #${restarts}`);
    if (restarts < 50) setTimeout(start, Math.min(1000 * restarts, 10000));
    else console.error("[valkey-service] too many restarts — giving up");
  });
}

// إيقاف نظيف عند إنهاء الخدمة
process.on("SIGTERM", () => {
  console.log("[valkey-service] SIGTERM — stopping valkey-server");
  child?.kill("SIGTERM");
  process.exit(0);
});
process.on("SIGINT", () => {
  child?.kill("SIGTERM");
  process.exit(0);
});

start();
