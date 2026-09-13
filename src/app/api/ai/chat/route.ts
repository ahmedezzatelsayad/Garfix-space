import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { chatCompleteStream, deepSeekActive, type ChatMessage } from "@/lib/ai-provider";
import { buildProjectContext, contextToSystemPrompt } from "@/lib/ai-context";

export const dynamic = "force-dynamic";

// POST /api/ai/chat — الشات الذكي المتصل بكامل المشروع (SSE بثّ حيّ)
// body: { message, conversationId?, companySlug?, companyName? }
export async function POST(req: NextRequest) {
  const t0 = Date.now();
  let conversationId: number | null = null;
  let model = "builtin";
  let provider = "builtin";

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const companySlug = typeof body.companySlug === "string" && body.companySlug.trim() ? body.companySlug.trim() : undefined;
    const companyName = typeof body.companyName === "string" ? body.companyName : undefined;
    if (typeof body.conversationId === "number" && body.conversationId > 0) {
      conversationId = body.conversationId;
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "الرسالة فارغة" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (message.length > 4000) {
      return new Response(JSON.stringify({ error: "الرسالة طويلة جداً (الحد 4000 حرف)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // إنشاء/إيجاد المحادثة
    let conversation = null as { id: number; title: string; companySlug: string | null } | null;
    if (conversationId) {
      conversation = await db.aiConversation.findUnique({ where: { id: conversationId } });
    }
    if (!conversation) {
      conversation = await db.aiConversation.create({
        data: {
          title: message.slice(0, 60),
          companySlug: companySlug ?? null,
        },
      });
      conversationId = conversation.id;
    }

    // حفظ رسالة المستخدم
    await db.aiMessage.create({
      data: { conversationId: conversation.id, role: "user", content: message },
    });

    // سجل المحادثة (آخر 20 رسالة) + سياق المشروع الحيّ
    const history = await db.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 40,
    });
    const { active, cfg } = await deepSeekActive();
    if (active && cfg) {
      model = cfg.model;
      provider = "deepseek";
      await db.aiConversation.update({
        where: { id: conversation.id },
        data: { model },
      });
    }

    const snapshot = await buildProjectContext({ companySlug, companyName });
    const systemPrompt = contextToSystemPrompt(snapshot);

    const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];
    for (const m of history.slice(-20)) {
      if (m.role === "user" || m.role === "assistant") {
        messages.push({ role: m.role, content: m.content });
      }
    }

    // ————— بثّ SSE —————
    const encoder = new TextEncoder();
    const convId = conversation.id;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        send("meta", { conversationId: convId, model, provider, scope: snapshot.scope });

        let full = "";
        let firstTokenMs: number | null = null;
        try {
          for await (const chunk of chatCompleteStream(messages, { maxTokens: 3072 })) {
            if (chunk.error) {
              send("error", { error: chunk.error });
              continue;
            }
            if (chunk.delta) {
              if (firstTokenMs === null) firstTokenMs = Date.now() - t0;
              full += chunk.delta;
              send("delta", { text: chunk.delta });
            } else if (chunk.reasoning) {
              send("reasoning", { text: chunk.reasoning });
            } else if (chunk.done) {
              send("phase", { phase: "done" });
            }
          }
        } catch (e) {
          send("error", { error: e instanceof Error ? e.message : String(e) });
        }

        const latencyMs = Date.now() - t0;
        try {
          if (full.trim()) {
            const saved = await db.aiMessage.create({
              data: {
                conversationId: convId,
                role: "assistant",
                content: full,
                model,
                latencyMs,
              },
            });
            await db.aiConversation.update({
              where: { id: convId },
              data: { updatedAt: new Date() },
            });
            send("done", {
              messageId: saved.id,
              latencyMs,
              firstTokenMs,
              model,
              provider,
            });
          } else {
            send("done", { messageId: null, latencyMs, firstTokenMs: null, model, provider, empty: true });
          }
        } catch (e) {
          send("done", { messageId: null, latencyMs, error: e instanceof Error ? e.message : String(e) });
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
