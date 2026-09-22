import { NextRequest, NextResponse } from "next/server";
import { consumeSsoCode } from "@/lib/sso";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/sso/token — استبدال كود لمرة واحدة ببيانات المستخدم.
 *
 * يستدعى من خادم الخدمة الشريكة (Garfix Stores) فقط — server-to-server،
 * لا يحتاج CORS ولا كوكيز. الجسم: { code, redirect_uri }.
 *
 * الاستجابة الناجحة: { ok: true, user: { sub, email, displayName, role } }
 * الكود يُستهلك فور أول استبدال (ناجح أو فاشل) — إعادة الإرسال تعطي 400.
 */
export async function POST(req: NextRequest) {
  let body: { code?: unknown; redirect_uri?: unknown };
  try {
    body = (await req.json()) as { code?: unknown; redirect_uri?: unknown };
  } catch {
    return NextResponse.json({ error: "جسم غير صالح" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri : "";
  if (!code || !redirectUri) {
    return NextResponse.json(
      { error: "code و redirect_uri مطلوبان" },
      { status: 400 },
    );
  }

  const user = await consumeSsoCode(code, redirectUri);
  if (!user) {
    return NextResponse.json(
      { error: "الكود غير صالح أو منتهي أو مستهلك" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    user: {
      sub: user.sub,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  });
}
