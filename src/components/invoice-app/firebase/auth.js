export const MASTER_EMAIL = "ahmedezzatelsayad@gmail.com";

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

/**
 * الدخول خادمياً بالكامل (PostgreSQL) — لا حسابات مدمجة في المتصفح.
 * كان هنا مصفوفة CREDENTIALS بحسابات تجريبية hardcode (admin123 وغيرها) —
 * أزيلت نهائياً: فشل الخادم = فشل الدخول (لا باب خلفي في الواجهة).
 */
export async function loginUser(email, password) {
  const e = (email || "").trim().toLowerCase();

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e, password }),
    });
    if (res.ok) {
      const data = await res.json();
      const u = data.user || {};
      const user = {
        uid: btoa(e),
        email: e,
        displayName: u.displayName || e.split("@")[0],
        role: u.role,                    // "subscriber" للمشتركين المسجّلين
        companies: u.companies || [],    // slugs شركات المستخدم
        permissions: u.permissions || {}, // r33: الصلاحيات التفصيلية من الخادم
        plan: u.plan,
      };
      setStored(user);
      notify(user);
      return user;
    }
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = res.status === 429 ? "auth/too-many-requests" : "auth/invalid-credential";
    if (data.error) err.serverMessage = data.error;
    throw err;
  } catch (netErr) {
    if (netErr && netErr.code) throw netErr; // خطأ صريح من الخادم (401/429)
    const err = new Error("تعذّر الاتصال بالخادم — تحقق من الإنترنت ثم أعد المحاولة");
    err.code = "auth/network-request-failed";
    throw err;
  }
}

/** r16: التسجيل الذاتي — «مجاناً لأول 100 مشترك» (تسجيل + دخول بضغطة واحدة) */
export async function registerUser({ displayName, email, phone, password }) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName, email, phone, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.code || `register/${res.status}`;
    throw err;
  }
  const u = data.user || {};
  const user = {
    uid: btoa(u.email),
    email: u.email,
    displayName: u.displayName,
    role: u.role || "subscriber",
    companies: u.companies || [],
    plan: u.plan || "free_early",
  };
  setStored(user);
  notify(user);
  return { user, remaining: data.remaining };
}

/** r16: عدّاد المقاعد المجانية (الموقع العام + صفحة الدخول) */
export async function fetchFreeSeats() {
  try {
    const res = await fetch("/api/auth/register");
    if (res.ok) return await res.json();
  } catch { /* دون اتصال */ }
  return null;
}

/** r16: «هل نسيت كلمة السر؟» — يرسل بريد استعادة عبر Resend */
export async function requestPasswordReset(email) {
  const res = await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.code || `forgot/${res.status}`;
    throw err;
  }
  return data.message || "إذا كان البريد مسجلاً لدينا فستصلك رسالة الاستعادة خلال دقائق";
}

/** r16: إعادة تعيين كلمة المرور بالرمز من رسالة البريد (#/reset?token=…) */
export async function resetPasswordWithToken(token, password) {
  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.code || `reset/${res.status}`;
    throw err;
  }
  return true;
}

/** r16: تحديث ملف المشترك من الخادم بعد إنشاء شركته (تظهر فوراً في المُنتقي) */
export async function refreshAuthUser() {
  const stored = getStored();
  if (!stored || !stored.role) return stored; // الحسابات المدمجة بلا دور خادمي
  try {
    const res = await fetch("/api/auth/profile");
    if (res.ok) {
      const data = await res.json();
      if (data.profile) {
        const user = {
          ...stored,
          displayName: data.profile.displayName || stored.displayName,
          companies: Array.isArray(data.profile.companies) ? data.profile.companies : stored.companies,
        };
        setStored(user);
        notify(user);
        return user;
      }
    }
  } catch { /* دون اتصال — نُبقي المخزّن */ }
  return stored;
}

export async function logoutUser() {
  // مسح جلسة الخادم أيضاً
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
