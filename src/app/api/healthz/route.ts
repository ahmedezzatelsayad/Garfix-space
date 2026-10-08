import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheHealth } from "@/lib/cache";

// GET /api/healthz — صحة النظام: التطبيق + PostgreSQL + Valkey
// r32 (تدقيق 10/10): رسالة خطأ قاعدة البيانات لا تُكشف علناً (كانت تسرّب
// تفاصيل DSN/المزوّد) — تُسجَّل في سجلات الخادم فقط ويُعاد "degraded" عام.
export async function GET() {
  let dbOk = false;
  let dbError: string | null = null;
  let dbLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
    console.error("[healthz] database check failed:", dbError);
  }

  const cache = cacheHealth();
  const status = dbOk ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      database: { engine: "postgresql", ok: dbOk, latencyMs: dbLatencyMs, error: dbOk ? null : "unavailable" },
      cache,
      time: new Date().toISOString(),
    },
    { status: 200 },
  );
}
