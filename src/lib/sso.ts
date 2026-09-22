/**
 * ── المرحلة 1 (تكامل Garfix Stores): SSO — ERP هو مالك الهوية (IdP) ──
 *
 * النموذج: Authorization Code مبسّط بمقاييس OAuth2:
 *  1) الخدمة الشريكة (Garfix Stores) توجّه المستخدم إلى
 *     /api/auth/sso/authorize?redirect_uri=…&state=…
 *  2) إن لم توجد جلسة ERP → يُعاد التوجيه إلى /?sso_login=1&sso_next=…#/login
 *     فتُكمل الواجهة تسجيل الدخول الطبيعي ثم ترتد إلى authorize مجدداً.
 *  3) عند وجود جلسة صالحة يُصدر كوداً لمرة واحدة (TTL 120 ثانية) ويُعاد
 *     التوجيه إلى redirect_uri?code=…&state=…
 *  4) تُبادل الخدمة الشريكة الكود عبر POST /api/auth/sso/token من الخادم
 *     (server-to-server) فتستلم بيانات المستخدم — والكود يُستهلك فوراً.
 *
 * التخزين: أكواد لمرة واحدة في Valkey (طبقة الكاش) بسقوط آمن للذاكرة —
 * نفس فلسفة r28 لحدود المعدل. prefix مستقل كي لا يتزاحم مع مفاتيح الأعمال.
 */
import { randomBytes } from "node:crypto";
import { cacheGet, cacheSet, cacheDel } from "./cache";

const CODE_PREFIX = "sso:code:";
const CODE_TTL_SECONDS = 120;

export interface SsoUserPayload {
  /** subject — بريد حساب ERP (معرّف موحد عبر الأنظمة) */
  sub: string;
  email: string;
  displayName: string;
  /** admin | employee | viewer | subscriber */
  role: string;
  issuedAt: number;
}

/** يصدر كوداً لمرة واحدة مرتبطاً بـ redirect_uri (إلزامي لمنع سرقة الكود). */
export async function issueSsoCode(
  user: Omit<SsoUserPayload, "issuedAt">,
  redirectUri: string,
): Promise<string> {
  const code = randomBytes(24).toString("base64url");
  const payload: SsoUserPayload = { ...user, issuedAt: Date.now() };
  await cacheSet(
    CODE_PREFIX + code,
    JSON.stringify({ user: payload, redirectUri }),
    CODE_TTL_SECONDS,
  );
  return code;
}

/**
 * يستهلك كوداً: يعيد بيانات المستخدم إذا كان صالحاً وغير مستهلك ومطابقاً
 * لنفس redirect_uri الذي صُدر له، وإلا يعيد null. الاستهلاك حذف فوري.
 */
export async function consumeSsoCode(
  code: string,
  redirectUri: string,
): Promise<SsoUserPayload | null> {
  const raw = await cacheGet(CODE_PREFIX + code);
  if (!raw) return null;
  await cacheDel(CODE_PREFIX + code); // لمرة واحدة — حتى لو فشل التحقق بعدها
  try {
    const parsed = JSON.parse(raw) as { user: SsoUserPayload; redirectUri: string };
    if (parsed.redirectUri !== redirectUri) return null;
    if (Date.now() - parsed.user.issuedAt > CODE_TTL_SECONDS * 1000) return null;
    return parsed.user;
  } catch {
    return null;
  }
}

/** قائمة عناوين إعادة التوجيه المسموحة (بيئة — فاصلة بينها). */
export function ssoAllowedRedirects(): string[] {
  return (process.env.SSO_ALLOWED_REDIRECTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** مطابقة صارمة (origin + path) — لا سوابق، لا أحرف بديلة. */
export function isAllowedRedirect(uri: string): boolean {
  const list = ssoAllowedRedirects();
  if (!list.length) return false;
  try {
    const u = new URL(uri);
    if (u.search || u.hash) return false; // الكود لا يُلحق بمعاملات إضافية
    return list.some((allowed) => {
      try {
        const a = new URL(allowed);
        return a.origin === u.origin && a.pathname === u.pathname;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
