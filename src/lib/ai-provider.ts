/**
 * r10: طبقة مزوّد الذكاء الاصطناعي الموحّدة
 * - عند تفعيل DeepSeek (بمفتاح API صالح) تمرّ كل مميزات AI عبر DeepSeek
 *   (chat / reasoner — الموديلات المدفوعة) مع بثّ حيّ (SSE streaming).
 * - عند التعطل أو عدم الضبط يسقط تلقائياً إلى المزوّد المدمج z-ai-web-dev-sdk.
 */
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiConfigRow {
  provider: string;
  apiKey: string | null;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

/** كتالوج موديلات DeepSeek المدفوعة (للعرض في صفحة الإعدادات) */
export const DEEPSEEK_MODELS: { id: string; name: string; desc: string; tag: string; speed: number; depth: number }[] = [
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat — V3",
    desc: "الموديل العامّي السريع: محادثات، تحليل بيانات، صياغة رسائل وتقارير فورية بتكلفة منخفضة.",
    tag: "متوازن • الأوفر",
    speed: 5,
    depth: 4,
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner — R1",
    desc: "موديل التفكير العميق المتسلسل: تحليل مالي معقّد، تدقيق أرقام، مقارنات ومسائل متعددة الخطوات.",
    tag: "الأذكى • تفكير عميق",
    speed: 3,
    depth: 5,
  },
];

/** يقرأ إعداد DeepSeek من قاعدة البيانات */
export async function getAiConfig(): Promise<AiConfigRow | null> {
  const row = await db.aiSetting.findUnique({ where: { provider: "deepseek" } });
  if (!row) return null;
  return {
    provider: row.provider,
    apiKey: row.apiKey,
    baseUrl: row.baseUrl || "https://api.deepseek.com",
    model: row.model || "deepseek-chat",
    enabled: row.enabled,
  };
}

export function maskKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 5)}${"•".repeat(Math.min(18, key.length - 8))}${key.slice(-4)}`;
}

/** هل DeepSeek مفعّل وبمفتاح؟ */
export async function deepSeekActive(): Promise<{ active: boolean; cfg: AiConfigRow | null }> {
  const cfg = await getAiConfig();
  return { active: !!(cfg && cfg.enabled && cfg.apiKey), cfg };
}

interface CompleteOpts {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  modelOverride?: string;
}

export interface CompletionResult {
  content: string;
  model: string;
  provider: "deepseek" | "builtin";
  latencyMs: number;
}

/** استدعاء غير متصل (blocking) — يُستخدم في process-items والاختبارات */
export async function chatComplete(messages: ChatMessage[], opts: CompleteOpts = {}): Promise<CompletionResult> {
  const { active, cfg } = await deepSeekActive();
  const t0 = Date.now();

  if (active && cfg) {
    const model = opts.modelOverride || cfg.model;
    try {
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          temperature: opts.json ? 0.1 : opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens ?? 2048,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`DeepSeek ${res.status}: ${errText.slice(0, 300)}`);
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return {
        content: data.choices?.[0]?.message?.content ?? "",
        model,
        provider: "deepseek",
        latencyMs: Date.now() - t0,
      };
    } catch (e) {
      // سقوط آمن إلى المزوّد المدمج
      console.warn("[ai-provider] DeepSeek failed → builtin fallback:", e instanceof Error ? e.message : e);
    }
  }

  // المزوّد المدمج (z-ai-web-dev-sdk)
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: "disabled" },
  });
  return {
    content: completion.choices[0]?.message?.content ?? "",
    model: "builtin",
    provider: "builtin",
    latencyMs: Date.now() - t0,
  };
}

/** جزء واحد من البثّ */
export interface StreamChunk {
  delta?: string;
  reasoning?: string;
  done?: boolean;
  error?: string;
}

/**
 * استدعاء متصل (streaming) — AsyncGenerator من المقاطع النصية.
 * DeepSeek: بثّ SSE حقيقي. المدمج: إرسال الجواب كاملاً كمقطع واحد.
 */
export async function* chatCompleteStream(
  messages: ChatMessage[],
  opts: CompleteOpts = {},
): AsyncGenerator<StreamChunk> {
  const { active, cfg } = await deepSeekActive();

  if (active && cfg) {
    const model = opts.modelOverride || cfg.model;
    try {
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens ?? 3072,
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(`DeepSeek ${res.status}: ${errText.slice(0, 300)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            yield { done: true };
            return;
          }
          try {
            const obj = JSON.parse(payload) as {
              choices?: { delta?: { content?: string; reasoning_content?: string } }[];
            };
            const delta = obj.choices?.[0]?.delta;
            if (delta?.content) yield { delta: delta.content };
            else if (delta?.reasoning_content) yield { reasoning: delta.reasoning_content };
          } catch {
            /* سطر SSE غير مكتمل — تجاهل */
          }
        }
      }
      yield { done: true };
      return;
    } catch (e) {
      // سقوط آمن: أكمل بالمزوّد المدمج
      console.warn("[ai-provider] DeepSeek stream failed → builtin fallback:", e instanceof Error ? e.message : e);
    }
  }

  // المدمج — جواب واحد كامل
  try {
    const r = await chatComplete(messages, opts);
    if (r.content) yield { delta: r.content };
    yield { done: true };
  } catch (e) {
    yield { error: e instanceof Error ? e.message : String(e) };
  }
}

export interface TestResult {
  ok: boolean;
  latencyMs: number;
  chatLatencyMs?: number;
  model?: string;
  models?: string[];
  reply?: string;
  error?: string;
}

/** اختبار اتصال فعلي: جلب قائمة الموديلات + إكمال مصغّر وقياس الزمن */
export async function testDeepSeek(key: string, baseUrl: string, model: string): Promise<TestResult> {
  const t0 = Date.now();
  const base = baseUrl.replace(/\/$/, "");
  try {
    const modelsRes = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!modelsRes.ok) {
      const errText = await modelsRes.text().catch(() => "");
      return { ok: false, latencyMs: Date.now() - t0, error: `HTTP ${modelsRes.status} — ${errText.slice(0, 200) || "فشل الوصول إلى DeepSeek"}` };
    }
    const modelsData = (await modelsRes.json()) as { data?: { id: string }[] };
    const models = (modelsData.data ?? []).map((m) => m.id);

    // إكمال مصغّر للتأكد أن المفتاح يقبض الفوترة فعلاً
    const t1 = Date.now();
    const chatRes = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "اختبار اتصال — رد بكلمة واحدة: تم" }],
        max_tokens: 8,
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!chatRes.ok) {
      const errText = await chatRes.text().catch(() => "");
      return { ok: false, latencyMs: Date.now() - t0, models, error: `HTTP ${chatRes.status} — ${errText.slice(0, 200)}` };
    }
    const chatData = (await chatRes.json()) as { choices?: { message?: { content?: string } }[] };
    return {
      ok: true,
      latencyMs: Date.now() - t0,
      chatLatencyMs: Date.now() - t1,
      model,
      models,
      reply: chatData.choices?.[0]?.message?.content?.trim().slice(0, 60),
    } as TestResult;
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}
