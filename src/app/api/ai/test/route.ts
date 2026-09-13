import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testDeepSeek } from "@/lib/ai-provider";
import { invalidateSettings } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth-server";

/**
 * POST /api/ai/test { apiKey?, baseUrl?, model? }
 * اختبار اتصال فعلي بـ DeepSeek (جلب الموديلات + إكمال مصغّر) وتخزين نتيجة آخر اختبار.
 * المفتاح: المُرسل في الطلب، أو المخزّن في قاعدة البيانات.
 * r13: أصبح للمديرين فقط (جلسة إدارية) — كان مفقوداً من المستودع فعاد 404 في r12.
 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const stored = await db.aiSetting.findUnique({ where: { provider: "deepseek" } });
    const key =
      (typeof body.apiKey === "string" && body.apiKey.trim()) || stored?.apiKey || "";
    const baseUrl =
      (typeof body.baseUrl === "string" && /^https?:\/\//i.test(body.baseUrl.trim()) && body.baseUrl.trim()) ||
      stored?.baseUrl ||
      "https://api.deepseek.com";
    const model =
      (typeof body.model === "string" && /^[\w.-]+$/.test(body.model.trim()) && body.model.trim()) ||
      stored?.model ||
      "deepseek-chat";

    if (!key) {
      return NextResponse.json(
        { ok: false, error: "لا يوجد مفتاح API — أدخل المفتاح أولاً" },
        { status: 400 },
      );
    }

    const result = await testDeepSeek(key, baseUrl.replace(/\/$/, ""), model);

    // تخزين نتيجة آخر اختبار (بلا المفتاح نفسه)
    await db.aiSetting.upsert({
      where: { provider: "deepseek" },
      update: {
        lastTestOk: result.ok,
        lastTestedAt: new Date(),
        lastTestModel: model,
        lastTestLatency: result.latencyMs ?? null,
        lastTestError: result.ok ? null : (result.error ?? null),
      },
      create: {
        provider: "deepseek",
        baseUrl,
        model,
        lastTestOk: result.ok,
        lastTestedAt: new Date(),
        lastTestModel: model,
        lastTestLatency: result.latencyMs ?? null,
        lastTestError: result.ok ? null : (result.error ?? null),
      },
    });
    await invalidateSettings("ai");

    return NextResponse.json(result, { status: result.ok ? 200 : 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
