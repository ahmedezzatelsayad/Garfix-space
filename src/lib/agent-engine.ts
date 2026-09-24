/**
 * المرحلة 2 (Agent Engine): محرك الوكيل — حلقة Think → Act → Observe حقيقية.
 *
 * كيف تعمل الحلقة:
 *  1. THINK: نموذج الذكاء يقرر ماذا يفعل — إما استدعاء أداة (كتلة garfix-tool)
 *     أو الجواب النهائي للمستخدم.
 *  2. ACT: الخادم ينفّذ الأداة عبر runAgentTool (حواجز + تدقيق agent_audit_log).
 *  3. OBSERVE: نتيجة الأداة تُحقن برسالة نظام [TOOL_RESULT] وتُعاد للنموذج.
 *  4. تكرار حتى الجواب النهائي أو بلوغ AGENT_MAX_STEPS.
 *
 * البث: AsyncGenerator من أحداث SSE — الواجهة ترى الحلقة مباشرة
 * (كل فكرة، كل استدعاء أداة، كل نتيجة، لحظة طلب التأكيد، والجواب النهائي).
 *
 * وضعا التشغيل:
 *  - readonly (افتراضي): أدوات الكتابة محجوبة → ببطاقة تأكيد للمستخدم
 *    (confirmToken) → إعادة تشغيل بالمصادقة (mode=confirmed) تنفّذ الأفعال
 *    المُصرّح بها فقط ثم يشرح الوكيل النتائج.
 *  - auto: تنفيذ مباشر ضمن الحواجز (سقف مالي، لا حذف، whitelist).
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { chatCompleteStream, deepSeekActive, type ChatMessage } from "@/lib/ai-provider";
import { runAgentTool, agentToolsPrompt, isAgentTool } from "@/lib/agent-tools";
import { cacheGet, cacheSet } from "@/lib/cache";
import { currencyOf } from "@/lib/currency-shared";

export const AGENT_MAX_STEPS = (() => {
  const n = parseInt(process.env.AGENT_MAX_STEPS || "", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 8;
})();

export const CONFIRM_TTL_SECONDS = 300; // بطاقة التأكيد صالحة 5 دقائق

export interface AgentHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface AgentEvent {
  type: "meta" | "turn_start" | "thought" | "turn_end" | "tool_call" | "tool_result" | "confirmation_required" | "final" | "done" | "error";
  [k: string]: unknown;
}

export interface AgentRunOptions {
  message: string;
  history: AgentHistoryItem[];
  companySlug: string | null;
  companyName?: string | null;
  currency?: string | null;
  userEmail: string;
  isAdmin: boolean;
  mode: "readonly" | "auto";
  /** عند وجوده: تنفيذ الأفعال المُصادَقة سابقاً (بطاقة التأكيد) */
  confirmToken?: string;
}

/* ————— بروتوكول استدعاء الأداة ————— */

interface ParsedToolCall {
  tool: string;
  args: Record<string, unknown>;
}

/** يفصل كتل garfix-tool عن نص الرد — كتلة واحدة كحد أقصى تُنفَّذ */
export function parseToolCall(content: string): { text: string; call: ParsedToolCall | null } {
  if (!content) return { text: content || "", call: null };
  let call: ParsedToolCall | null = null;
  const text = String(content).replace(
    /```garfix-tool\s*\n([\s\S]*?)```/g,
    (full, inner: string) => {
      if (call) return ""; // كتلة ثانية — تُحذف ولا تُنفَّذ (أداة واحدة لكل رسالة)
      try {
        const obj = JSON.parse(inner.trim()) as { tool?: unknown; args?: unknown };
        if (obj && typeof obj.tool === "string") {
          call = {
            tool: obj.tool,
            args: obj.args && typeof obj.args === "object" && !Array.isArray(obj.args)
              ? (obj.args as Record<string, unknown>)
              : {},
          };
          return "";
        }
      } catch {
        /* JSON غير صالح — تعرض ككتلة نص */
      }
      return full;
    },
  );
  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), call };
}

/* ————— السياق ————— */

function agentSystemPrompt(opts: AgentRunOptions, mode: "readonly" | "auto" | "confirmed"): string {
  const cur = currencyOf(opts.currency);
  const scopeLine = opts.companySlug
    ? `الشركة الفعّالة: «${opts.companyName || opts.companySlug}» (مفتاحها ${opts.companySlug}) — كل الأدوات تنحصر في نطاقها.`
    : opts.isAdmin
      ? "النطاق: كل الشركات (أنت تعمل مع مدير عام)."
      : "النطاق: لا شركة محددة — اطلب من المستخدم تحديد شركة أولاً.";
  return [
    `أنت «وكيل جارفِكس» (Garfix Agent) — وكيل إجرائي ذكي داخل نظام ERP كويتي متعدد الشركات (واجهة عربية RTL).`,
    `أنت لست شاتاً عادياً: تفكّر، تستدعي أدوات حقيقية، تقرأ نتائجها، ثم تُكمل حتى إنجاز المهمة.`,
    `أجب بالعربية الفصحى الواضحة، ونظّم إجابتك بعناوين ونقاط عند الحاجة.`,
    ``,
    `— اليوم: ${todayArabic()} | العملة المرجعية: ${cur.ar} (${cur.code})`,
    `— ${scopeLine}`,
    ``,
    agentToolsPrompt(mode),
  ].join("\n");
}

function todayArabic(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ————— حلقة الوكيل ————— */

export async function* runAgentLoop(opts: AgentRunOptions): AsyncGenerator<AgentEvent> {
  const t0 = Date.now();
  const runId = randomUUID();
  const { active, cfg } = await deepSeekActive();
  const model = active && cfg ? cfg.model : "builtin";
  const provider = active ? "deepseek" : "builtin";

  /* ——— مسار المصادقة: تنفيذ الأفعال المؤكدة ثم شرح النتائج ——— */
  if (opts.confirmToken) {
    const raw = await cacheGet(`agent:confirm:${opts.confirmToken}`);
    if (!raw) {
      yield { type: "error", error: "بطاقة التأكيد منتهية أو غير موجودة — أعد طلب العملية من الوكيل" };
      yield { type: "done", runId, steps: 0, latencyMs: Date.now() - t0, model, provider };
      return;
    }
    try {
      const pending = JSON.parse(raw) as {
        actions: { tool: string; args: Record<string, unknown> }[];
        companySlug: string | null;
        userEmail: string;
      };
      if (pending.userEmail !== opts.userEmail) {
        yield { type: "error", error: "بطاقة التأكيد لا تخص هذه الجلسة" };
        yield { type: "done", runId, steps: 0, latencyMs: Date.now() - t0, model, provider };
        return;
      }
      yield { type: "meta", runId, model, provider, mode: "confirmed", actions: pending.actions.length, scope: opts.companySlug || "كل الشركات" };

      const results: string[] = [];
      let step = 0;
      for (const action of pending.actions.slice(0, 3)) {
        step++;
        yield { type: "tool_call", step, tool: action.tool, kind: "write", args: action.args, confirmed: true };
        const rec = await runAgentTool(action.tool, action.args, {
          companySlug: pending.companySlug ?? opts.companySlug,
          currency: opts.currency ?? null,
          userEmail: opts.userEmail,
          isAdmin: opts.isAdmin,
          mode: "confirmed",
          runId,
          step,
        });
        yield {
          type: "tool_result",
          step,
          tool: rec.tool,
          ok: rec.outcome.ok,
          blocked: rec.blocked,
          summary: rec.outcome.summary,
          durationMs: rec.durationMs,
        };
        results.push(`[TOOL_RESULT] ${rec.tool} → ${rec.outcome.summary}`);
      }

      // فقرة شرح أخيرة من النموذج فوق النتائج المنفَّذة
      const messages: ChatMessage[] = [
        { role: "system", content: agentSystemPrompt(opts, "confirmed") },
        ...opts.history.slice(-6).map(normalizeHistory),
        { role: "user", content: opts.message },
        {
          role: "user",
          content:
            `نفّذتُ الأفعال التي صادق عليها المستخدم للتو. النتائج:\n${results.join("\n")}\n` +
            `اكتب للمستخدم فقرة موجزة عربية تشرح ما تم وما بقي (بلا كتل أدوات).`,
        },
      ];
      yield { type: "turn_start", step: step + 1, final: true };
      let final = "";
      for await (const chunk of chatCompleteStream(messages, { maxTokens: 1500 })) {
        if (chunk.error) { yield { type: "error", error: chunk.error }; continue; }
        if (chunk.delta) { final += chunk.delta; yield { type: "thought", step: step + 1, text: chunk.delta, final: true }; }
      }
      yield { type: "final", text: final };
      yield { type: "done", runId, steps: step, latencyMs: Date.now() - t0, model, provider, confirmed: true };
      return;
    } catch (e) {
      yield { type: "error", error: `تعذر تنفيذ التأكيد: ${e instanceof Error ? e.message : String(e)}` };
      yield { type: "done", runId, steps: 0, latencyMs: Date.now() - t0, model, provider };
      return;
    }
  }

  /* ——— الحلقة الطبيعية ——— */
  yield {
    type: "meta",
    runId,
    model,
    provider,
    mode: opts.mode,
    scope: opts.companySlug || "كل الشركات",
  };

  const messages: ChatMessage[] = [
    { role: "system", content: agentSystemPrompt(opts, opts.mode) },
    ...opts.history.slice(-6).map(normalizeHistory),
    { role: "user", content: opts.message },
  ];

  const pendingActions: { tool: string; args: Record<string, unknown> }[] = [];
  let steps = 0;
  let finalText = "";

  try {
    while (steps < AGENT_MAX_STEPS) {
      steps++;
      yield { type: "turn_start", step: steps };

      // THINK — بثّ الفكرة حية
      let content = "";
      for await (const chunk of chatCompleteStream(messages, { maxTokens: 2000 })) {
        if (chunk.error) { yield { type: "error", error: chunk.error }; continue; }
        if (chunk.delta) {
          content += chunk.delta;
          yield { type: "thought", step: steps, text: chunk.delta };
        } else if (chunk.reasoning) {
          yield { type: "thought", step: steps, text: chunk.reasoning, reasoning: true };
        }
      }

      const { text, call } = parseToolCall(content);

      if (!call || !isAgentTool(call.tool)) {
        // لا استدعاء أداة → هذا الجواب النهائي
        yield { type: "turn_end", step: steps, hasToolCall: false };
        finalText = text || content;
        yield { type: "final", text: finalText };
        break;
      }

      yield { type: "turn_end", step: steps, hasToolCall: true, thoughtText: text };

      // ACT — تنفيذ الأداة بالحواجز والتدقيق
      yield { type: "tool_call", step: steps, tool: call.tool, args: call.args };
      const rec = await runAgentTool(call.tool, call.args, {
        companySlug: opts.companySlug,
        currency: opts.currency ?? null,
        userEmail: opts.userEmail,
        isAdmin: opts.isAdmin,
        mode: opts.mode,
        runId,
        step: steps,
      });

      // OBSERVE — النتيجة تعود للنموذج (وتُعرض للمستخدم)
      yield {
        type: "tool_result",
        step: steps,
        tool: rec.tool,
        ok: rec.outcome.ok,
        blocked: rec.blocked,
        summary: rec.outcome.summary,
        durationMs: rec.durationMs,
      };

      if (rec.blocked === "READONLY_MODE") {
        // العملية بانتظار تأكيد المستخدم — جُمّعت في بطاقة واحدة
        pendingActions.push({ tool: rec.tool, args: call.args });
      }

      // اربط رسالة النموذج بالسياق ثم حقن الملاحظة
      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content: `[TOOL_RESULT] ${rec.tool} → ${rec.outcome.summary}${
          rec.outcome.data ? `\nDATA: ${JSON.stringify(rec.outcome.data).slice(0, 800)}` : ""
        }\n(أداة أخرى إن لزم، أو الجواب النهائي للمستخدم${rec.blocked === "READONLY_MODE" ? " — وذكّره بتأكيد العملية من البطاقة" : ""})`,
      });
    }

    if (steps >= AGENT_MAX_STEPS && !finalText) {
      finalText = "بلغتُ الحد الأقصى لخطوات الحلقة في هذه التشغيلة — أكمل من هنا بطلب جديد.";
      yield { type: "final", text: finalText };
    }

    // بطاقة التأكيد الموحدة (إن وُجدت أعمال كتابة محجوبة)
    if (pendingActions.length) {
      const token = randomUUID();
      await cacheSet(
        `agent:confirm:${token}`,
        JSON.stringify({
          actions: pendingActions,
          companySlug: opts.companySlug,
          userEmail: opts.userEmail,
        }),
        CONFIRM_TTL_SECONDS,
      );
      yield { type: "confirmation_required", token, actions: pendingActions, ttlSeconds: CONFIRM_TTL_SECONDS };
    }

    yield { type: "done", runId, steps, latencyMs: Date.now() - t0, model, provider };
  } catch (e) {
    yield { type: "error", error: e instanceof Error ? e.message : String(e) };
    yield { type: "done", runId, steps, latencyMs: Date.now() - t0, model, provider };
  }
}

function normalizeHistory(h: AgentHistoryItem): ChatMessage {
  return { role: h.role, content: String(h.content || "").slice(0, 2000) };
}

/* ————— ترميز SSE ————— */

export function encodeAgentEvent(ev: AgentEvent): string {
  const type = ev.type;
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ev)) {
    if (k !== "type") rest[k] = v;
  }
  return `event: ${type}\ndata: ${JSON.stringify(rest)}\n\n`;
}
