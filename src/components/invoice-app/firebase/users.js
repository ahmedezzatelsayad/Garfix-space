import { MASTER_EMAIL } from "./auth";

/**
 * إدارة المستخدمين عبر الخادم (قاعدة البيانات) — بديل localStorage الوهمي.
 * كان هذا الملف يحتفظ بـ 6 حسابات hardcode + تخزين متصفحي، فما كان أي حذف
 * يُطبَّق فعلياً. الآن كل العمليات تمر على /api/admin/users (app_users).
 */

// ————— الملف الشخصي للجلسة الحالية —————

/** الملف الشخصي للمستخدم الحالي من الخادم (app_users) — null للحساب المدمج (المؤسس) */
export async function getUserProfile() {
  try {
    const res = await fetch("/api/auth/profile");
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.profile) return null;
    const p = data.profile;
    let permissions = {};
    try {
      // /api/auth/profile يُعيد permissions اختيارياً — احتياطاً نقرأه إن وُجد
      permissions = p.permissions && typeof p.permissions === "object" ? p.permissions : {};
    } catch { permissions = {}; }
    return {
      uid: p.email,
      email: p.email,
      displayName: p.displayName,
      companies: Array.isArray(p.companies) ? p.companies : [],
      role: p.role || "subscriber",
      permissions,
    };
  } catch {
    return null;
  }
}

export function isMasterAdmin(email) {
  return email === MASTER_EMAIL;
}

// ————— إدارة المستخدمين (لوحة الإدارة — جلسة مدير) —————

export async function getAllUsers() {
  const res = await fetch("/api/admin/users");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `HTTP ${res.status}`);
    if (res.status === 401) err.code = "permission-denied";
    else if (res.status === 403) err.code = "permission-denied";
    throw err;
  }
  const data = await res.json();
  return Array.isArray(data.users) ? data.users : [];
}

/** إنشاء موظف — عبر الخادم (scrypt في قاعدة البيانات) */
export async function createUser({ email, password, displayName, companies, role, permissions }) {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName, companies, role, permissions }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.code || `create/${res.status}`;
    throw err;
  }
  return data.user;
}

export async function updateUserProfile(uid, data) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.code = body.code || `update/${res.status}`;
    throw err;
  }
  return body.user;
}

/** حذف حقيقي من قاعدة البيانات — كان يعمل على localStorage فقط فلا شيء يُحذف فعلياً */
export async function deleteUserRecord(uid) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, { method: "DELETE" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.code = body.code || `delete/${res.status}`;
    throw err;
  }
  return true;
}
