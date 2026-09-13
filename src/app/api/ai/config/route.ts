import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEEPSEEK_MODELS, getAiConfig, maskKey } from "@/lib/ai-provider";
import { invalidateSettings } from "@/lib/cache";

// GET /api/ai/config — إعداد DeepSeek الحالي (المفتاح مقنّع)
export async function GET() {
  try {
    const row = await db.aiSetting.findUnique({ where: { provider: "deepseek" } });
    return NextResponse.json({
      provider: "deepseek",
      enabled: row?.enabled ?? false,
      baseUrl: row?.baseUrl ?? "https://api.deepseek.com",
      model: row?.model ?? "deepseek-chat",
      hasKey: !!row?.apiKey,
      keyMasked: maskKey(row?.apiKey ?? null),
      lastTestOk: row?.lastTestOk ?? null,
      lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
      lastTestModel: row?.lastTestModel ?? null,
      lastTestLatency: row?.lastTestLatency ?? null,
      lastTestError: row?.lastTestError ?? null,
      models: DEEPSEEK_MODELS,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT /api/ai/config — حفظ المفتاح/الموديل/التفعيل
export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const current = await db.aiSetting.findUnique({ where: { provider: "deepseek" } });
    const data: Record<string, unknown> = {};

    if (typeof body.apiKey === "string") {
      // "" = حذف المفتاح، نص جديد = استبداله، غيابه = إبقاء القديم
      data.apiKey = body.apiKey.trim() || null;
    }
    if (typeof body.baseUrl === "string" && /^https?:\/\//i.test(body.baseUrl.trim())) {
      data.baseUrl = body.baseUrl.trim().replace(/\/$/, "");
    }
    if (typeof body.model === "string" && /^[\w.-]+$/.test(body.model.trim())) {
      data.model = body.model.trim();
    }
    if (typeof body.enabled === "boolean") {
      // لا يمكن التفعيل بدون مفتاح مخزّن أو مُرسل
      const keyAfter = (data.apiKey as string | null | undefined) ?? current?.apiKey ?? null;
      if (body.enabled && !keyAfter) {
        return NextResponse.json({ error: "لا يمكن التفعيل بدون مفتاح API أولاً" }, { status: 400 });
      }
      data.enabled = body.enabled;
    }

    const row = await db.aiSetting.upsert({
      where: { provider: "deepseek" },
      update: data,
      create: {
        provider: "deepseek",
        ...(data as { apiKey?: string | null; baseUrl?: string; model?: string; enabled?: boolean }),
      },
    });

    await invalidateSettings("ai");

    return NextResponse.json({
      ok: true,
      enabled: row.enabled,
      model: row.model,
      baseUrl: row.baseUrl,
      hasKey: !!row.apiKey,
      keyMasked: maskKey(row.apiKey),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
