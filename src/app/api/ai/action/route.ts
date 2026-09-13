import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeAiAction, isAiAction } from "@/lib/ai-actions";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/action — تنفيذ إجراء اقترحه المساعد الذكي بعد تأكيد المستخدم.
 * body: { action, args, companySlug? }
 * الإجراءات محصورة في قائمة بيضاء (ai-actions.ts) وكل منها يتحقق من
 * حقوله بصرامة قبل أي كتابة — «إنسان في الحلقة»: لا تنفيذ إلا بضغطة المستخدم.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action;
    if (!isAiAction(action)) {
      return NextResponse.json({ ok: false, errors: ["نوع إجراء غير مسموح"] }, { status: 400 });
    }

    const args =
      body.args && typeof body.args === "object" && !Array.isArray(body.args)
        ? (body.args as Record<string, unknown>)
        : {};
    const companySlug =
      typeof body.companySlug === "string" && body.companySlug.trim() ? body.companySlug.trim() : null;

    // العملة من الشركة الفعّالة (لتظهر الملخصات بعملة الشركة)
    let currency: string | null = null;
    if (companySlug) {
      const co = await db.company.findUnique({ where: { slug: companySlug }, select: { currency: true } });
      currency = co?.currency ?? "KWD";
    }

    const outcome = await executeAiAction(action, args, { companySlug, currency });
    if (!outcome.ok) {
      return NextResponse.json(outcome, { status: 400 });
    }
    return NextResponse.json(outcome, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, errors: [err instanceof Error ? err.message : String(err)] },
      { status: 500 },
    );
  }
}
