export const MASTER_EMAIL = "ahmedezzatelsayad@gmail.com";

const CREDENTIALS = {
  [MASTER_EMAIL]:       "admin123",
  "ayman@manager.com":  "ayman123",
  "info@tawfeer.com":   "tawfeer123",
  "info@laqta.com":     "laqta123",
  "info@mahhl.com":     "mahhal123",
  "info@boss.com":      "boss123",
};

const LISTENERS = new Set();
const SK = "__inv_auth_user__";

function getStored() {
  try { return JSON.parse(localStorage.getItem(SK)); } catch { return null; }
}
function setStored(u) {
  if (u) localStorage.setItem(SK, JSON.stringify(u));
  else localStorage.removeItem(SK);
}
function notify(u) {
  LISTENERS.forEach(cb => { try { cb(u); } catch {} });
}

export async function loginUser(email, password) {
  const e = (email || "").trim().toLowerCase();
  const expected = CREDENTIALS[e];
  if (!expected) {
    const err = new Error("user not found"); err.code = "auth/user-not-found"; throw err;
  }
  if (password !== expected) {
    const err = new Error("wrong password"); err.code = "auth/wrong-password"; throw err;
  }
  const user = { uid: btoa(e), email: e, displayName: e.split("@")[0] };
  setStored(user);
  notify(user);
  // r13: جلسة خادم موقّعة (httpOnly cookie) — تفتح المسارات الإدارية المحمية.
  // fire-and-forget: التجربة المحلية كما هي؛ فشل الخادم لا يمنع الدخول.
  fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: e, password }),
  }).catch(() => {});
  return user;
}

export async function logoutUser() {
  // r13: مسح جلسة الخادم أيضاً
  fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  setStored(null);
  notify(null);
}

export function onAuthChange(callback) {
  LISTENERS.add(callback);
  const stored = getStored();
  setTimeout(() => { try { callback(stored); } catch {} }, 0);
  return () => LISTENERS.delete(callback);
}
