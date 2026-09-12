import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheHealth } from "@/lib/cache";

// GET /api/healthz — صحة النظام: التطبيق + PostgreSQL + Valkey
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
  }

  const cache = cacheHealth();
  const status = dbOk ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      database: { engine: "postgresql", ok: dbOk, latencyMs: dbLatencyMs, error: dbError },
      cache,
      time: new Date().toISOString(),
    },
    { status: 200 },
  );
}
