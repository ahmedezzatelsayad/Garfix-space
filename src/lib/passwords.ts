import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

/**
 * r16: كلمات المرور للمشتركين المسجّلين ذاتياً (AppUser)
 * - التخزين: scrypt (salt$hash) — ملح عشوائي 16 بايت لكل كلمة مرور
 * - التحقق: مقارنة زمن ثابت (timingSafeEqual) لمنع هجمات التوقيت
 * - لا نص صريح ولا تشفير قابل للعكس في أي مكان
 */

const KEYLEN = 64; // بايت مفتاح scrypt المشتق

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return `${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = String(stored || "").split("$");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  if (!/^[0-9a-f]+$/i.test(salt) || !/^[0-9a-f]+$/i.test(hash)) return false;
  try {
    const candidate = scryptSync(password, salt, KEYLEN);
    const expected = Buffer.from(hash, "hex");
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

/** SHA-256 أحادي الاتجاه لتخزين رموز الاستعادة (لا يُخزَّن الرمز نفسه) */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** توليد رمز استعادة عشوائي (64 محرفاً hex) */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}
