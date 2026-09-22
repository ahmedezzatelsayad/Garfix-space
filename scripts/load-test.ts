/**
 * r29: اختبار الحمل (Load Test) — GarfiX
 * يشغَّل بـ: bun scripts/load-test.ts
 * المراحل: تسخين → مزيج قراءة (عام + مصادق) → رفض مجهول 401 → انفجار دخول → استمرارية الصفحة الرئيسية.
 * المقاييس: RPS + متوسط/p50/p95/p99/max زمن الاستجابة + توزيع أكواد الحالة + أخطاء الشبكة + RSS لعملية Next.
 */
const BASE = process.env.LOAD_BASE || "http://127.0.0.1:3000";
const COMPANY = "tw_inv_tawfeer_v1";

const PUBLIC_ENDPOINTS = [
  "/api/healthz",
  "/api/site/content",
  "/api/pricing",
];
const AUTH_ENDPOINTS = [
  "/api/companies",
  `/api/invoices?companySlug=${COMPANY}`,
  `/api/clients?companySlug=${COMPANY}`,
  `/api/dashboard/stats?companySlug=${COMPANY}`,
  `/api/dashboard/recent-invoices?companySlug=${COMPANY}`,
  `/api/dashboard/revenue-by-month?companySlug=${COMPANY}`,
];
const GATED_ANON = [
  "/api/invoices",
  "/api/clients",
  "/api/companies",
  "/api/catalog",
  "/api/purchase-invoices",
  `/api/dashboard/stats?companySlug=${COMPANY}`,
  "/api/reminders",
  "/api/settings",
  "/api/ai/conversations",
];

type Sample = { ms: number; status: number; endpoint: string; netErr?: boolean };

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}
function fmt(n: number): string {
  return n >= 100 ? n.toFixed(0) : n.toFixed(1);
}
function summarize(phase: string, samples: Sample[], durSec: number): void {
  const ok = samples.filter((s) => !s.netErr);
  const lat = ok.map((s) => s.ms).sort((a, b) => a - b);
  const rps = durSec > 0 ? samples.length / durSec : 0;
  const byStatus = new Map<number, number>();
  for (const s of samples) byStatus.set(s.netErr ? 0 : s.status, (byStatus.get(s.netErr ? 0 : s.status) ?? 0) + 1);
  const statusStr = [...byStatus.entries()].sort((a, b) => a[0] - b[0])
    .map(([c, n]) => `${c === 0 ? "NET_ERR" : c}×${n}`).join(" ");
  const srvErr = samples.filter((s) => s.status >= 500).length;
  console.log(
    `| ${phase.padEnd(26)} | ${String(samples.length).padStart(5)} | ${fmt(rps).padStart(7)} req/s | ${fmt(lat.reduce((a, b) => a + b, 0) / (lat.length || 1)).padStart(7)}ms | ${fmt(pct(lat, 50)).padStart(7)}ms | ${fmt(pct(lat, 95)).padStart(8)}ms | ${fmt(pct(lat, 99)).padStart(8)}ms | ${fmt(lat[lat.length - 1] ?? 0).padStart(8)}ms | ${statusStr}${srvErr > 0 ? `  ⚠️ ${srvErr} × 5xx` : ""}`
  );
}

async function once(url: string, cookie?: string, timeoutMs = 30000): Promise<Sample> {
  const t0 = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: cookie ? { cookie } : {},
      signal: ctrl.signal,
      redirect: "manual",
    });
    // نستهلك الجسم حتى لا تتسرب اتصالات
    await res.arrayBuffer().catch(() => undefined);
    return { ms: performance.now() - t0, status: res.status, endpoint: url };
  } catch (e) {
    return { ms: performance.now() - t0, status: 0, endpoint: url, netErr: true };
  } finally {
    clearTimeout(timer);
  }
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "ahmedezzatelsayad@gmail.com", password: "admin123" }),
  });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0];
}

async function pool(total: number, concurrency: number, makeTask: (i: number) => Promise<Sample>): Promise<{ samples: Sample[]; durSec: number }> {
  const samples: Sample[] = [];
  let next = 0;
  const t0 = performance.now();
  const workers = Array.from({ length: concurrency }, async () => {
    for (;;) {
      const i = next++;
      if (i >= total) break;
      samples.push(await makeTask(i));
    }
  });
  await Promise.all(workers);
  return { samples, durSec: (performance.now() - t0) / 1000 };
}

async function sustained(seconds: number, concurrency: number, makeTask: () => Promise<Sample>): Promise<{ samples: Sample[]; durSec: number }> {
  const samples: Sample[] = [];
  const t0 = performance.now();
  const stopAt = t0 + seconds * 1000;
  const workers = Array.from({ length: concurrency }, async () => {
    while (performance.now() < stopAt) samples.push(await makeTask());
  });
  await Promise.all(workers);
  return { samples, durSec: (performance.now() - t0) / 1000 };
}

function nextRssKb(): number {
  try {
    const out = Bun.spawnSync(["ps", "-eo", "pid,rss,comm,args"], { stdout: "pipe" }).stdout.toString();
    let best = 0;
    for (const line of out.split("\n")) {
      if (/(next-server|next dev)/.test(line) && !/grep/.test(line)) {
        const rss = Number(line.trim().split(/\s+/)[1]);
        if (rss > best) best = rss;
      }
    }
    return best;
  } catch {
    return 0;
  }
}

// ————— التنفيذ —————
console.log(`GarfiX Load Test → ${BASE}`);
console.log("| المرحلة                     |  طلبات |      RPS |     متوسط |      p50 |      p95 |      p99 |      max | الأكواد");
console.log("|-" + "-".repeat(120));

const rssBefore = nextRssKb();

// 0) تسخين: كل مسار مرة واحدة (ترجمة مسارات dev-mode)
{
  const warm = [...PUBLIC_ENDPOINTS, "/", ...AUTH_ENDPOINTS];
  const s: Sample[] = [];
  for (const u of warm) s.push(await once(`${BASE}${u}`));
  const dur = s.reduce((a, b) => a + b.ms, 0) / 1000;
  summarize("تسخين (تسلسلي)", s, dur);
}

const cookie = await login();

// 1) مزيج قراءة: عام + مصادق — 1200 طلب بتزامن 40
{
  const mix = [...PUBLIC_ENDPOINTS, "/", ...AUTH_ENDPOINTS, ...AUTH_ENDPOINTS];
  const { samples, durSec } = await pool(1200, 40, (i) => once(`${BASE}${mix[i % mix.length]}`, cookie));
  summarize("مزيج قراءة (40 تزامن)", samples, durSec);
}

// 2) رفض مجهول: 300 طلب بلا كوكي → متوقع 401
{
  const { samples, durSec } = await pool(300, 40, (i) => once(`${BASE}${GATED_ANON[i % GATED_ANON.length]}`));
  summarize("رفض مجهول 401 (40 تزامن)", samples, durSec);
}

// 3) انفجار دخول: 25 دخولاً متزامناً (scrypt)
{
  const loginOnce = async (): Promise<Sample> => {
    const t0 = performance.now();
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "ahmedezzatelsayad@gmail.com", password: "admin123" }),
      });
      await res.arrayBuffer().catch(() => undefined);
      return { ms: performance.now() - t0, status: res.status, endpoint: "/api/auth/login" };
    } catch {
      return { ms: performance.now() - t0, status: 0, endpoint: "/api/auth/login", netErr: true };
    }
  };
  const { samples, durSec } = await pool(25, 25, () => loginOnce());
  summarize("انفجار دخول (25 متزامن)", samples, durSec);
}

// 4) استمرارية الصفحة الرئيسية: 20 ثانية × 15 تزامن (SSR)
{
  const { samples, durSec } = await sustained(20, 15, () => once(`${BASE}/`, cookie, 45000));
  summarize("استمرارية / (20ث × 15)", samples, durSec);
}

const rssAfter = nextRssKb();
console.log();
console.log(`Next RSS: ${(rssBefore / 1024).toFixed(0)}MB → ${(rssAfter / 1024).toFixed(0)}MB`);
console.log("اكتمل اختبار الحمل.");
