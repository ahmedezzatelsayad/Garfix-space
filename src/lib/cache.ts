/**
 * r10: طبقة الكاش — Valkey 8.1 (بديل Redis الفعلي) عبر ioredis
 * مع fallback تلقائي إلى ذاكرة محلية إذا كانت الخدمة غير متاحة،
 * حتى لا يتعطل التطبيق أبداً بسبب الكاش.
 */
import Redis from "ioredis";

const VALKEY_URL = process.env.VALKEY_URL || "redis://127.0.0.1:6379";
const PREFIX = "garfix:";

const globalForCache = globalThis as unknown as {
  valkey: Redis | undefined;
  cacheStats: { hits: number; misses: number; writes: number; valkeyConnected: boolean; lastError: string | null } | undefined;
  memCache: Map<string, { v: string; exp: number }> | undefined;
};

export const cacheStats =
  globalForCache.cacheStats ??
  (globalForCache.cacheStats = { hits: 0, misses: 0, writes: 0, valkeyConnected: false, lastError: null });

const mem = globalForCache.memCache ?? (globalForCache.memCache = new Map());

// اتصال Valkey وحيد على مستوى العملية (lazy + retry ذكي)
if (!globalForCache.valkey) {
  const r = new Redis(VALKEY_URL, {
    maxRetriesPerRequest: 1, // لا نعلّق الطلبات عند تعطل الخدمة
    connectTimeout: 700,
    retryStrategy: (times: number) => Math.min(times * 500, 5000),
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  r.on("ready", () => {
    cacheStats.valkeyConnected = true;
    cacheStats.lastError = null;
  });
  r.on("error", (e: Error) => {
    cacheStats.valkeyConnected = false;
    cacheStats.lastError = e.message?.slice(0, 200) ?? "valkey error";
  });
  r.on("end", () => {
    cacheStats.valkeyConnected = false;
  });
  globalForCache.valkey = r;
}

// ————— ذاكرة محلية (fallback) —————
function memGet(key: string): string | null {
  const hit = mem.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) {
    mem.delete(key);
    return null;
  }
  return hit.v;
}
function memSet(key: string, val: string, ttlSec: number): void {
  if (mem.size > 5000) mem.clear(); // حماية من التضخم
  mem.set(key, { v: val, exp: Date.now() + ttlSec * 1000 });
}

// ————— الواجهة العامة —————
export async function cacheGet(key: string): Promise<string | null> {
  const k = PREFIX + key;
  if (cacheStats.valkeyConnected) {
    try {
      const v = await globalForCache.valkey!.get(k);
      if (v != null) {
        cacheStats.hits++;
        return v;
      }
      cacheStats.misses++;
      return null;
    } catch {
      /* سقط إلى الذاكرة */
    }
  }
  const mv = memGet(k);
  if (mv != null) cacheStats.hits++;
  else cacheStats.misses++;
  return mv;
}

export async function cacheSet(key: string, value: string, ttlSec: number): Promise<void> {
  const k = PREFIX + key;
  cacheStats.writes++;
  memSet(k, value, ttlSec);
  if (cacheStats.valkeyConnected) {
    try {
      await globalForCache.valkey!.set(k, value, "EX", ttlSec);
    } catch {
      /* الذاكرة كافية */
    }
  }
}

export async function cacheDel(key: string): Promise<void> {
  const k = PREFIX + key;
  mem.delete(k);
  if (cacheStats.valkeyConnected) {
    try {
      await globalForCache.valkey!.del(k);
    } catch {}
  }
}

/** حذف كل المفاتيح المطابقة لنمط (SCAN آمن بدل KEYS) */
export async function cacheDelPattern(pattern: string): Promise<number> {
  const p = PREFIX + pattern;
  let n = 0;
  for (const [k] of mem) if (new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$").test(k)) { mem.delete(k); n++; }
  if (cacheStats.valkeyConnected) {
    try {
      const v = globalForCache.valkey!;
      let cursor = "0";
      do {
        const res = await v.scan(cursor, "MATCH", p, "COUNT", 200);
        cursor = res[0];
        const keys = res[1];
        if (keys.length) {
          await v.del(...keys);
          n += keys.length;
        }
      } while (cursor !== "0");
    } catch {}
  }
  return n;
}

/** get-or-set: اقرأ من الكاش وإلا نفّذ المولّد وخزّنه */
export async function cacheWrap<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const raw = await cacheGet(key);
  if (raw != null) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      /* قيمة تالفة — تعامل كـ miss */
    }
  }
  const val = await fn();
  cacheSet(key, JSON.stringify(val), ttlSec).catch(() => {});
  return val;
}

/** إبطال كل ما يتأثر بتغيير الفواتير/المدفوعات (+ سياق المساعد الذكي)
 * دائماً شامل لكل الشركات: الإبطال المحدد بالشركة كان يفوّت مفاتيح «all»
 * والمفاتيح المتقاطعة عند نقل الفواتير بين الشركات. */
export async function invalidateInvoices(_companySlug?: string): Promise<void> {
  await Promise.all(
    ["stats:*", "rev:*", "recent:*", "invoices:*", "purchases:*", "ai:ctx:*"].map((p) => cacheDelPattern(p)),
  );
}

export async function invalidateClients(): Promise<void> {
  await cacheDelPattern("clients:*");
}

/** إبطال كتالوج المنتجات — شامل لكل الشركات + مفتاح «all» */
export async function invalidateCatalog(_companySlug?: string): Promise<void> {
  await cacheDelPattern("catalog:*");
}

export async function invalidateSettings(companySlug?: string): Promise<void> {
  await cacheDelPattern(companySlug ? `settings:${companySlug}:*` : "settings:*");
}

/** حالة الكاش للوحة المراقبة */
export function cacheHealth(): Record<string, unknown> {
  return {
    engine: cacheStats.valkeyConnected ? "valkey" : "memory-fallback",
    valkeyUrl: VALKEY_URL.replace(/:[^:@/]*@/, ":****@"),
    connected: cacheStats.valkeyConnected,
    lastError: cacheStats.lastError,
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: cacheStats.hits + cacheStats.misses > 0 ? +(cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(1) : 0,
    writes: cacheStats.writes,
    memKeys: mem.size,
  };
}
