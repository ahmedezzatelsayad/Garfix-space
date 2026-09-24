import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { runAgentLoop, encodeAgentEvent, type AgentHistoryItem } from "@/lib/agent-engine";
import {
  getSessionScope,
  requireCompanyAccess,
  unauthorizedResponse,
  aiRateLimited,
  noteAiAction,
  aiRateLimitedResponse,
} from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * المرحلة 2 (Agent Engine): POST /api/agent/run — تشغيل حلقة الوكيل (SSE).
 *
 * body: { message, companySlug?, companyName?, history?, mode?: "readonly"|"auto", confirmToken? }
 *
 * الأمان (نفس سياسة r29-S3 على مستوى البيانات):
 *  - جلسة صالحة إلزامية + حد معدل الذكاء (30/5 دقائق لكل مستخدم).
 *  - سياق الشركة يتطلب ملكيتها (المدير يجتاز).
 *  - أدوات الكتابة إما محجوبة (وضع القراءة الافتراضي) حتى تأكيد المستخدم
 *    عبر confirmToken، أو تعمل ضمن الحواجز في وضع auto (سقف مالي + لا حذف).
 *  - كل استدعاء أداة يُدوَّن في agent_audit_log بمعرف التشغيلة.
 */
export async function POST(req: NextRequest) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();
    const userEmail = scope.session.email;
    const isAdmin = scope.all;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const confirmToken = typeof body.confirmToken === "string" ? body.confirmToken.trim() : undefined;

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!confirmToken && !message) {
      return json400("الرسالة فارغة");
    }
    if (message.length > 4000) {
      return json400("الرسالة طويلة جداً (الحد 4000 حرف)");
    }

    const companySlug =
      typeof body.companySlug === "string" && body.companySlug.trim() ? body.companySlug.trim() : null;
    const companyName = typeof body.companyName === "string" ? body.companyName : null;
    const mode = body.mode === "auto" ? "auto" : "readonly";
    const history = Array.isArray(body.history)
      ? (body.history as AgentHistoryItem[])
          .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
          .slice(-6)
      : [];

    // ملكية الشركة (المدير يجتاز؛ بلا شركة = المدير فقط)
    const denied = await requireCompanyAccess(req, companySlug);
    if (denied) return denied;

    // حد المعدل — كل تشغيلة وكيل تُحتسب إجراء ذكاء
    if (await aiRateLimited(userEmail)) return aiRateLimitedResponse();
    await noteAiAction(userEmail);

    // العملة من الشركة الفعّالة
    let currency: string | null = null;
    if (companySlug) {
      const co = await db.company.findUnique({ where: { slug: companySlug }, select: { currency: true } });
      currency = co?.currency ?? "KWD";
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const ev of runAgentLoop({
            message,
            history,
            companySlug,
            companyName,
            currency,
            userEmail,
            isAdmin,
            mode,
            confirmToken,
          })) {
            controller.enqueue(encoder.encode(encodeAgentEvent(ev)));
          }
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e);
          controller.enqueue(
            encoder.encode(encodeAgentEvent({ type: "error", error: err })),
          );
          controller.enqueue(
            encoder.encode(encodeAgentEvent({ type: "done", runId: "-", steps: 0, latencyMs: 0 })),
          );
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function json400(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
