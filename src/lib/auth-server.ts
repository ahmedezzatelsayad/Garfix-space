import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet, cacheDel, cacheIncr } from "./cache";

/**
 * r13: أمان الخادم — جلسات موقّعة (httpOnly cookie) + تحقق موحّد من الصلاحيات.
 *
 * - العمليات الإدارية الخطيرة تتطلب جلسة مدير صالحة موقّعة بـ HMAC-SHA256.
 * - r33: أزيلت الحسابات التجريبية الخمسة نهائياً (كانت خلف DEMO_MODE) — لا بيانات
 *   تجريبية في الكود ولا في القاعدة؛ حساب المؤسس الوحيد يأتي من GARFIX_MASTER_PASSWORD.
 * - COOKIE_SECURE=true يجعل كوكيز الجلسة secure (فعّلها خلف HTTPS فقط).
 * - تحديد معدل الدخول عبر Valkey (طبقة الكاش) بدل الذاكرة — يصمد أمام إعادة التشغيل
 *   ويُشارَك بين العمليات، مع سقوط آمن للذاكرة عند غياب Valkey.
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

// ── r28: إعدادات الجاهزية للإنتاج من متغيرات البيئة ──
/**
 * r32 (تدقيق 10/10): كلمة مرور المؤسس بلا قيمة افتراضية — تفشل الدخول مغلقاً
 * عندما لا تُضبط GARFIX_MASTER_PASSWORD (كان الافتراضي admin123 — خطر علني مباشر).
 * التطوير/العرض: اضبطها في .env — الإنتاج: سر قوي إلزامي.
 */
const MASTER_PASS = process.env.GARFIX_MASTER_PASSWORD || "";
/** r28: أضف COOKIE_SECURE=true عند النشر خلف HTTPS ليصبح كوكي الجلسة secure */
export const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

const MASTER_EMAIL = "ahmedezzatelsayad@gmail.com";

// بريد المؤسس محجوز دوماً — لا يمكن التسجيل الذاتي به (منع انتحال المدير)
const RESERVED_EMAILS = new Set([MASTER_EMAIL]);

function buildUsers(): ServerUser[] {
  // r33: حساب المؤسس الوحيد المدمج — بلا كلمة مرور مضبوطة لا يُبنى (فشل مغلق)
  const defs = MASTER_PASS
    ? [{ email: MASTER_EMAIL, pass: MASTER_PASS, displayName: "أحمد عزت الصياد", role: "admin" as const }]
    : [];
  return defs.map(({ email, pass, displayName, role }) => ({ email, hash: sha256(pass), displayName, role }));
}

const SERVER_USERS = buildUsers();

/**
 * r16: بريد المؤسس المدمج — محجوز: لا يجوز التسجيل به (منع انتحال المدير)
 */
export function isReservedAccountEmail(email: string): boolean {
  return RESERVED_EMAILS.has((email || "").trim().toLowerCase());
}

// ── سر التوقيع: يُولَّد مرة ويُخزَّن في db/session-secret (خارج git) ──
const SECRET_FILE = path.join(process.cwd(), "db", "session-secret");

/**
 * r32 (تدقيق 10/10): SESSION_SECRET من البيئة له الأولوية (يعمل مع النشر متعدد
 * النسخ حيث الملف غير مشترك)، ثم ملف db/session-secret، ثم توليد جديد.
 */
function getSecret(): Buffer {
  const envSecret = (process.env.SESSION_SECRET || "").trim();
  if (/^[0-9a-f]{64,}$/i.test(envSecret)) return Buffer.from(envSecret, "hex");
  if (envSecret.length >= 32) return Buffer.from(envSecret, "utf8");
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

/** r16: هل صاحب الجلسة مشترك مسجّل (AppUser)؟ — يقرأ من قاعدة البيانات */
export async function getSessionAppUser(req: NextRequest) {
  const sess = getSession(req);
  if (!sess) return null;
  try {
    const { db } = await import("@/lib/db");
    const appUser = await db.appUser.findUnique({ where: { email: sess.email } });
    if (!appUser) return null;
    let companies: string[] = [];
    try { companies = JSON.parse(appUser.companies) as string[]; } catch { /* [] */ }
    return {
      session: sess,
      appUser,
      companies,
    };
  } catch {
    return null;
  }
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

// ── r29 (29-fix-api): بوابة الجلسة + عزل المستأجرين لمسارات الأعمال ──
// كان مستوى البيانات الأساسي (فواتير/عملاء/كتالوج/مدفوعات/داشبورد/ذكاء) مفتوحاً
// بالكامل بلا جلسة ولا فحص ملكية — هذه الطبقة تُغلقه بنفس نمط requireAdmin.

/** نطاق الشركات المتاحة لجلسة صالحة */
export interface SessionScope {
  session: SessionUser;
  /** true = مدير عام (المؤسس/أيمن) — يرى كل الشركات */
  all: boolean;
  /** slugs الشركات المتاحة (فارغ عندما all=true) */
  slugs: string[];
}

/** 401 موحّد لمسارات الأعمال (بلا جلسة صالحة) */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "الجلسة غير صالحة — سجّل الخروج ثم الدخول من جديد", code: "SESSION_REQUIRED" },
    { status: 401 },
  );
}

/** 403 موحّد لمحاولة الوصول لشركة ليست ضمن شركات الجلسة */
export function forbiddenCompanyResponse(): NextResponse {
  return NextResponse.json(
    { error: "لا يمكنك الوصول إلى بيانات هذه الشركة", code: "OWNER_REQUIRED" },
    { status: 403 },
  );
}

/**
 * حارس الجلسة لمسارات الأعمال — يُستدعى أول سطر في المعالج:
 *   const denied = requireSession(req); if (denied) return denied;
 * يعيد NextResponse (401) أو null إذا وُجدت جلسة صالحة.
 */
export function requireSession(req: NextRequest): NextResponse | null {
  return getSession(req) ? null : unauthorizedResponse();
}

// كاش نطاق خفيف (30 ثانية) حتى لا تضرب عاصفة طلبات الواجهة قاعدة البيانات
// ببحث AppUser/Company في كل طلب — مفتاحه بريد الجلسة ومحدود بعدد المستخدمين.
const scopeCache = new Map<string, { all: boolean; slugs: string[]; exp: number }>();

/**
 * نطاق الجلسة: مدير عام → كل الشركات؛ أي مستخدم آخر (موظف/مشترك) → شركاته
 * من app_users (slugs). أي بريد آخر → نطاق فارغ. يعيد null بلا جلسة صالحة.
 */
export async function getSessionScope(req: NextRequest): Promise<SessionScope | null> {
  const sess = getSession(req);
  if (!sess) return null;
  if (sess.role === "admin") return { session: sess, all: true, slugs: [] };

  const email = (sess.email || "").trim().toLowerCase();
  const cached = scopeCache.get(email);
  if (cached && cached.exp > Date.now()) {
    return { session: sess, all: cached.all, slugs: cached.slugs };
  }

  let slugs: string[] = [];
  try {
    const { db } = await import("@/lib/db");
    const appUser = await db.appUser.findUnique({ where: { email } });
    if (appUser) {
      try {
        slugs = (JSON.parse(appUser.companies) as unknown[])
          .map((s) => String(s ?? "").trim())
          .filter(Boolean);
      } catch {
        slugs = [];
      }
    }
  } catch {
    slugs = []; // قاعدة غير متاحة — نطاق فارغ (أضيق أماناً)
  }

  if (scopeCache.size > 500) scopeCache.clear();
  scopeCache.set(email, { all: false, slugs, exp: Date.now() + 30_000 });
  return { session: sess, all: false, slugs };
}

/**
 * حارس مستأجر شركة محددة (S1): المدير العام يجتاز دائماً؛ المشترك/الموظف يجب
 * أن تكون الشركة ضمن شركاته. slug فارغ/غائب = مدير فقط (COMPANY_REQUIRED).
 * يعيد NextResponse (401/403) أو null عند الاجتياز.
 */
export async function requireCompanyAccess(
  req: NextRequest,
  companySlug: string | null | undefined,
): Promise<NextResponse | null> {
  const scope = await getSessionScope(req);
  if (!scope) return unauthorizedResponse();
  if (scope.all) return null;
  const slug = String(companySlug ?? "").trim();
  if (!slug) {
    return NextResponse.json(
      { error: "الشركة مطلوبة — اختر إحدى شركاتك للعمل على بياناتها", code: "COMPANY_REQUIRED" },
      { status: 403 },
    );
  }
  if (!scope.slugs.includes(slug)) return forbiddenCompanyResponse();
  return null;
}

// ── r29 (S3): حد معدل موحّد لمسارات الذكاء الاصطناعي (30 إجراء/5 دقائق لكل مستخدم) ──
const AI_WINDOW_MS = 5 * 60 * 1000;
const AI_MAX_ACTIONS = 30;

/** true = تجاوز الحد (يُحجب 429) — المفتاح rl:ai:{userId} في Valkey */
export async function aiRateLimited(userId: string): Promise<boolean> {
  return actionRateLimited("ai", userId, AI_MAX_ACTIONS, AI_WINDOW_MS);
}

/** سجّل إجراء ذكاء اصطناعي واحداً (كل تنفيذ فعلي يزيد العدّاد) */
export async function noteAiAction(userId: string): Promise<void> {
  await noteActionFailure("ai", userId, AI_WINDOW_MS);
}

/** 429 موحّد لمسارات الذكاء الاصطناعي */
export function aiRateLimitedResponse(): NextResponse {
  return NextResponse.json(
    { error: "كثفت استخدام المساعد الذكي — انتظر خمس دقائق ثم حاول مجدداً", code: "AI_RATE_LIMITED" },
    { status: 429 },
  );
}

// ── r28: تحديد المعدل عبر Valkey (طبقة الكاش) بسقوط آمن للذاكرة ──
// النافذة زمنية ثابتة (TTL) وليست منزلقة — فرق مقبول لحدود بهذا الحجم،
// والمكسب أن العدّاد يصمد أمام إعادة التشغيل ويُشارَك بين العمليات.
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/** محدد عام قابل لإعادة الاستخدام (تسجيل/استعادة/إعادة تعريف…) */
export async function actionRateLimited(scope: string, id: string, max: number, windowMs: number): Promise<boolean> {
  const raw = await cacheGet(`rl:${scope}:${id}`);
  const n = raw ? parseInt(raw, 10) || 0 : 0;
  return n >= max;
}

/**
 * r32 (تدقيق 10/10): تسجيل محاولة بذرّية INCR+EXPIRE — كان get-then-set
 * يسمح بتجاوز الحد تحت تزامن خفيف (عدة طلبات تقرأ نفس العدد ثم تزيده).
 */
export async function noteActionFailure(scope: string, id: string, windowMs: number): Promise<void> {
  await cacheIncr(`rl:${scope}:${id}`, Math.ceil(windowMs / 1000));
}

/** صفّر عدّاد نطاق معين (بعد نجاح مثلاً) */
export async function clearActionFailures(scope: string, id: string): Promise<void> {
  await cacheDel(`rl:${scope}:${id}`);
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

/** true = تجاوز الحد (يُحجب) — r28: صار عبر Valkey */
export async function loginRateLimited(ip: string): Promise<boolean> {
  return actionRateLimited("login", ip, MAX_ATTEMPTS, WINDOW_MS);
}

export async function noteLoginFailure(ip: string): Promise<void> {
  await noteActionFailure("login", ip, WINDOW_MS);
}

export async function noteLoginSuccess(ip: string): Promise<void> {
  await clearActionFailures("login", ip);
}
