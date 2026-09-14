import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, hashToken } from "@/lib/passwords";
import { clientIp } from "@/lib/auth-server";

/**
 * r16: إعادة تعيين كلمة المرور بالرمز البريدي (من رسالة Resend)
 *
 * POST /api/auth/reset-password { token, password }
 *   → 200 { ok } — كلمة المرور الجديدة تُخزَّن scrypt وكل رموز البريد تُستهلك
 *   → 400 رمز/كلمة غير صالحة / 410 انتهت صلاحية الرمز أو استُخدم / 404 لا يوجد
 */
const MAX_ATTEMPTS = 12;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  attempts.set(ip, list);
  return list.length >= MAX_ATTEMPTS;
}
function noteAttempt(ip: string): void {
  const list = attempts.get(ip) || [];
  list.push(Date.now());
  attempts.set(ip, list);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "محاولات كثيرة — انتظر ربع ساعة ثم حاول مجدداً" }, { status: 429 });
  }
  noteAttempt(ip);

  const body = (await req.json().catch(() => ({}))) as { token?: unknown; password?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !/^[0-9a-f]{16,}$/i.test(token)) {
    return NextResponse.json({ error: "رمز الاستعادة غير صالح" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 100) {
    return NextResponse.json({ error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });
  }

  try {
    const row = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row) {
      return NextResponse.json({ error: "رمز الاستعادة غير موجود" }, { status: 404 });
    }
    if (row.usedAt) {
      return NextResponse.json({ error: "استُخدم هذا الرمز مسبقاً — اطلب رسالة جديدة", code: "TOKEN_USED" }, { status: 410 });
    }
    if (row.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "انتهت صلاحية الرمز (30 دقيقة) — اطلب رسالة جديدة", code: "TOKEN_EXPIRED" }, { status: 410 });
    }

    const appUser = await db.appUser.findUnique({ where: { email: row.email } });
    if (!appUser) {
      return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
    }

    // تحديث كلمة المرور + استهلاك الرمز + إبطال بقية رموز نفس البريد
    await db.$transaction([
      db.appUser.update({
        where: { email: row.email },
        data: { passwordHash: hashPassword(password) },
      }),
      db.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      db.passwordReset.deleteMany({ where: { email: row.email, usedAt: null, NOT: { id: row.id } } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
