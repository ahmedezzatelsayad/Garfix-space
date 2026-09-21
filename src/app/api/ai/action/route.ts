import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeAiAction, isAiAction } from "@/lib/ai-actions";
import {
  requireCompanyAccess,
  aiRateLimited,
  noteAiAction,
  aiRateLimitedResponse,
  unauthorizedResponse,
  getSessionScope,
} from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/action — تنفيذ إجراء اقترحه المساعد الذكي بعد تأكيد المستخدم.
 * body: { action, args, companySlug? }
 * الإجراءات محصورة في قائمة بيضاء (ai-actions.ts) وكل منها يتحقق من
 * حقوله بصرامة قبل أي كتابة — «إنسان في الحلقة»: لا تنفيذ إلا بضغطة المستخدم.
 * r29 (S3): تتطلب جلسة + ملكية الشركة + حد معدل لكل مستخدم (30/5 دقائق) —
 * كانت كتابات قاعدة بيانات مجهولة الهوية في أي شركة يسمّيها الزائر.
 */
export async function POST(req: NextRequest) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();
    const userId = scope.session.email;

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

    // r29 (S3): تنفيذ إجراء داخل شركة يتطلب ملكيتها (المدير يجتاز دائماً)
    const denied = await requireCompanyAccess(req, companySlug);
    if (denied) return denied;

    // r29 (S3): حد المعدل قبل التنفيذ (كل إجراء مؤكد يُحتسب)
    if (await aiRateLimited(userId)) return aiRateLimitedResponse();

    // العملة من الشركة الفعّالة (لتظهر الملخصات بعملة الشركة)
    let currency: string | null = null;
    if (companySlug) {
      const co = await db.company.findUnique({ where: { slug: companySlug }, select: { currency: true } });
      currency = co?.currency ?? "KWD";
    }

    await noteAiAction(userId);

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
