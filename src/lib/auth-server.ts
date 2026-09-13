import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

/**
 * r13: أمان الخادم — جلسات موقّعة (httpOnly cookie) + تحقق موحّد من الصلاحيات.
 *
 * لماذا هذا الملف؟
 * - التوثيق الأصلي محلي بالكامل (localStorage في firebase/auth.js) — أي زائر يمكنه
 *   نظرياً ضرب مسارات الإدارة مباشرة. هذه الطبقة تجعل العمليات الإدارية الخطيرة
 *   (النسخ الاحتياطي، الاستعادة، إعداد DeepSeek، إدارة الشركات، دمج العملاء،
 *   إدارة محتوى الموقع) تتطلب جلسة مدير صالحة موقّعة بـ HMAC-SHA256.
 * - كلمات المرور تُخزَّن هنا كبصمات SHA-256 (وليست نصاً صريحاً) — نفس مصفوفة
 *   الحسابات التجريبية الستة المعروفة في الواجهة.
 *
 * الخدمة العامة الكاملة (NextAuth) ما زالت خارطة الطريق — هذه طبقة دفاع عملية.
 */

export const COOKIE_NAME = "garfix_sess";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 يوماً

export interface SessionUser {
  email: string;
  displayName: string;
  role: "admin" | "employee" | "viewer";
  exp: number; // epoch seconds
}

// ── المستخدمون المعروفون للخادم (بصمات SHA-256 لكلمات المرور) ──
const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

interface ServerUser {
  email: string;
  hash: string;
  displayName: string;
  role: "admin" | "employee";
}

const MASTER_EMAIL = "ahmedezzatelsayad@gmail.com";

function buildUsers(): ServerUser[] {
  const defs: { email: string; pass: string; displayName: string; role: "admin" | "employee" }[] = [
    { email: MASTER_EMAIL, pass: "admin123", displayName: "Ahmed Ezzat", role: "admin" },
    { email: "ayman@manager.com", pass: "ayman123", displayName: "أيمن - مدير", role: "admin" },
    { email: "info@tawfeer.com", pass: "tawfeer123", displayName: "توفير أونلاين", role: "employee" },
    { email: "info@laqta.com", pass: "laqta123", displayName: "لقطة", role: "employee" },
    { email: "info@mahhl.com", pass: "mahhal123", displayName: "محلكم أونلاين", role: "employee" },
    { email: "info@boss.com", pass: "boss123", displayName: "بوص نيولايف", role: "employee" },
  ];
  return defs.map(({ email, pass, displayName, role }) => ({ email, hash: sha256(pass), displayName, role }));
}

const SERVER_USERS = buildUsers();

// ── سر التوقيع: يُولَّد مرة ويُخزَّن في db/session-secret (خارج git) ──
const SECRET_FILE = path.join(process.cwd(), "db", "session-secret");

function getSecret(): Buffer {
  try {
    const hex = fs.readFileSync(SECRET_FILE, "utf8").trim();
    if (/^[0-9a-f]{64,}$/i.test(hex)) return Buffer.from(hex, "hex");
  } catch {
    /* أول تشغيل */
  }
  const secret = randomBytes(48);
  try {
    fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
    fs.writeFileSync(SECRET_FILE, secret.toString("hex"), { mode: 0o600 });
  } catch {
    /* قراءة فقط — سنوقّع بسرٍّ في الذاكرة لهذه الجلسة فقط */
  }
  return secret;
}

const SECRET = getSecret();

// ── الرمز: base64url(payload).hex(hmac) ──
const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64url = (s: string) => Buffer.from(s, "base64url").toString("utf8");
const sign = (data: string) => createHmac("sha256", SECRET).update(data).digest("hex");

export function makeSessionToken(user: { email: string; displayName: string; role: string }): string {
  const payload: SessionUser = {
    email: user.email,
    displayName: user.displayName,
    role: user.role as SessionUser["role"],
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function parseSessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  let expected: string;
  try {
    expected = sign(body);
  } catch {
    return null;
  }
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(unb64url(body)) as SessionUser;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.email !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

/** الجلسة من كوكيز الطلب (إن وُجدت وصحت) */
export function getSession(req: NextRequest): SessionUser | null {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  return parseSessionToken(raw);
}

export function verifyCredentials(email: string, password: string): { email: string; displayName: string; role: string } | null {
  const e = (email || "").trim().toLowerCase();
  const u = SERVER_USERS.find((x) => x.email === e);
  if (!u) return null;
  const h = sha256(password || "");
  const a = Buffer.from(h, "utf8");
  const b = Buffer.from(u.hash, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { email: u.email, displayName: u.displayName, role: u.role };
}

/**
 * حارس المسارات الإدارية — يُستدعى أول سطر في المعالج:
 *   const denied = requireAdmin(req); if (denied) return denied;
 * يعيد NextResponse جاهزاً (401/403) أو null إذا اجتاز الفحص.
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const sess = getSession(req);
  if (!sess) {
    return NextResponse.json(
      { error: "الجلسة غير صالحة — سجّل الخروج ثم الدخول من جديد", code: "SESSION_REQUIRED" },
      { status: 401 },
    );
  }
  if (sess.role !== "admin") {
    return NextResponse.json(
      { error: "هذه العملية تتطلب صلاحيات مدير", code: "ADMIN_REQUIRED" },
      { status: 403 },
    );
  }
  return null;
}

// ── تحديد معدل محاولات الدخول (in-memory — يُصفَّر عند إعادة التشغيل) ──
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, number[]>();

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

/** true = تجاوز الحد (يُحجب) */
export function loginRateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  attempts.set(ip, list);
  return list.length >= MAX_ATTEMPTS;
}

export function noteLoginFailure(ip: string): void {
  const list = attempts.get(ip) || [];
  list.push(Date.now());
  attempts.set(ip, list);
}

export function noteLoginSuccess(ip: string): void {
  attempts.delete(ip);
}
