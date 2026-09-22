import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { issueSsoCode, isAllowedRedirect } from "@/lib/sso";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/sso/authorize?redirect_uri=…&state=…
 *
 * بوابة الدخول الموحد (ERP = IdP):
 *  - جلسة صالحة → إصدار كود لمرة واحدة وإعادة توجيه إلى redirect_uri?code&state.
 *  - لا جلسة → إعادة توجيه إلى صفحة الدخول (SPA) مع sso_next ليكمل الرحلة بعد الدخول.
 *
 * الأمان:
 *  - redirect_uri يجب أن يطابق بدقة أحد عناوين SSO_ALLOWED_REDIRECTS (env).
 *  - الكود مرتبط بـ redirect_uri نفسه (يُتحقق منه مرة أخرى عند الاستبدال).
 *  - state يعود كما ورد (حماية CSRF على الخدمة الشريكة).
 */
export async function GET(req: NextRequest) {
  const redirectUri = req.nextUrl.searchParams.get("redirect_uri") || "";
  const state = req.nextUrl.searchParams.get("state") || "";

  if (!redirectUri || !isAllowedRedirect(redirectUri)) {
    return NextResponse.json(
      { error: "redirect_uri غير مسموح — أضِفه إلى SSO_ALLOWED_REDIRECTS" },
      { status: 400 },
    );
  }

  const session = getSession(req);
  if (!session) {
    // لا جلسة → صفحة الدخول، وبعد الدخول ترتد الواجهة إلى هذا المسار نفسه
    const self =
      req.nextUrl.origin +
      req.nextUrl.pathname +
      `?redirect_uri=${encodeURIComponent(redirectUri)}` +
      (state ? `&state=${encodeURIComponent(state)}` : "");
    const loginUrl =
      req.nextUrl.origin +
      `/?sso_login=1&sso_next=${encodeURIComponent(self)}#/login`;
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  const code = await issueSsoCode(
    {
      sub: session.email,
      email: session.email,
      displayName: session.displayName,
      role: session.role,
    },
    redirectUri,
  );

  const back = new URL(redirectUri);
  back.searchParams.set("code", code);
  if (state) back.searchParams.set("state", state);
  return NextResponse.redirect(back.toString(), { status: 302 });
}
