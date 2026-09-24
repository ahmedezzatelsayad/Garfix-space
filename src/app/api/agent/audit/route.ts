import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionScope, unauthorizedResponse } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * المرحلة 2 (Agent Engine): GET /api/agent/audit — سجل تدقيق الوكيل.
 *
 * كل استدعاء أداة (نجح / حُجب / فشل) مع وسائطه المعقّمة ونتيجته ومدته
 * ومن شغّله وفي أي شركة وبأي وضع.
 *
 * الوصول:
 *  - المدير العام: كل السجل (مع فلاتر user/company/tool/blocked).
 *  - المشترك/الموظف: تشغيلاته فقط ضمن شركاته المتاحة.
 *
 * query: ?limit=50&user=&company=&tool=&blocked=&runId=
 */
export async function GET(req: NextRequest) {
  const scope = await getSessionScope(req);
  if (!scope) return unauthorizedResponse();

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get("limit") || "50", 10) || 50, 1), 200);
  const filterUser = sp.get("user")?.trim().toLowerCase() || null;
  const filterCompany = sp.get("company")?.trim() || null;
  const filterTool = sp.get("tool")?.trim() || null;
  const filterBlocked = sp.get("blocked")?.trim() || null;
  const filterRun = sp.get("runId")?.trim() || null;

  const where: Record<string, unknown> = {};
  if (scope.all) {
    if (filterUser) where.userEmail = filterUser;
  } else {
    // المستخدم يرى تشغيلاته فقط (وكلها أصلاً محصورة بشركاته)
    where.userEmail = scope.session.email;
  }
  if (filterCompany) where.companySlug = filterCompany;
  else if (!scope.all && scope.slugs.length) where.companySlug = { in: [...scope.slugs, null] };
  if (filterTool) where.tool = filterTool;
  if (filterBlocked) where.blocked = filterBlocked;
  if (filterRun) where.runId = filterRun;

  const rows = await db.agentAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // إحصاءة سريعة فوق آخر 500 استدعاء في نفس النطاق
  const stats = await db.agentAuditLog.groupBy({
    by: ["tool"],
    where: scope.all
      ? {}
      : { userEmail: scope.session.email },
    _count: { _all: true },
    orderBy: { _count: { tool: "desc" } },
    take: 20,
  });

  return NextResponse.json({
    entries: rows.map((r) => ({
      id: r.id,
      runId: r.runId,
      step: r.step,
      tool: r.tool,
      kind: r.kind,
      args: safeJson(r.args),
      ok: r.ok,
      blocked: r.blocked,
      result: safeJson(r.result),
      durationMs: r.durationMs,
      userEmail: r.userEmail,
      companySlug: r.companySlug,
      mode: r.mode,
      createdAt: r.createdAt.toISOString(),
    })),
    toolCounts: stats.map((s) => ({ tool: s.tool, count: s._count._all })),
  });
}

function safeJson(s: string | null): unknown {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
