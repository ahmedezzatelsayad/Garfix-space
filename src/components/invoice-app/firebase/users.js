import { MASTER_EMAIL } from "./auth";

export const ALL_COMPANIES = ["tawfeer", "mahhal", "boss", "laqta"];

const EMPLOYEE_PERMS = {
  bulk_input:1, create_invoice:1, print_invoice:1, view_customers:1,
  edit_invoice:1, edit_customer:1, delete_invoice:1, delete_customer:1,
  export_data:0, reports_access:0, settings_access:0, finance_access:0,
  employee_management:0,
};

const SEED_PROFILES = [
  { uid: btoa("info@tawfeer.com"),  email:"info@tawfeer.com",  displayName:"توفير أونلاين",   companies:["tawfeer"],                          role:"employee", permissions:EMPLOYEE_PERMS },
  { uid: btoa("info@laqta.com"),    email:"info@laqta.com",    displayName:"لقطة",             companies:["laqta"],                            role:"employee", permissions:EMPLOYEE_PERMS },
  { uid: btoa("info@mahhl.com"),    email:"info@mahhl.com",    displayName:"محلكم أونلاين",    companies:["mahhal"],                           role:"employee", permissions:EMPLOYEE_PERMS },
  { uid: btoa("info@boss.com"),     email:"info@boss.com",     displayName:"بوص نيولايف",      companies:["boss"],                             role:"employee", permissions:EMPLOYEE_PERMS },
  { uid: btoa("ayman@manager.com"), email:"ayman@manager.com", displayName:"أيمن - مدير",      companies:["tawfeer","mahhal","boss","laqta"],   role:"admin",    permissions:{} },
  { uid: btoa(MASTER_EMAIL),        email:MASTER_EMAIL,         displayName:"أحمد عزت الصياد",   companies:ALL_COMPANIES,                        role:"admin",    permissions:{} },
];

const SK_EXTRA = "__inv_extra_users__";

function getExtra() {
  try { return JSON.parse(localStorage.getItem(SK_EXTRA)) || []; } catch { return []; }
}
function setExtra(arr) {
  localStorage.setItem(SK_EXTRA, JSON.stringify(arr));
}

function allProfiles() {
  return [...SEED_PROFILES, ...getExtra()];
}

export function isMasterAdmin(email) {
  return email === MASTER_EMAIL;
}

export async function getUserProfile(uid) {
  return allProfiles().find(p => p.uid === uid) || null;
}

export async function getAllUsers() {
  return allProfiles();
}

export async function createUser({ email, password, displayName, companies, role, permissions }) {
  const uid = btoa((email || "").trim().toLowerCase());
  const extra = getExtra();
  if (allProfiles().find(p => p.uid === uid)) throw new Error("المستخدم موجود مسبقاً");
  const profile = { uid, email, displayName: displayName || email, companies: companies || [], role: role || "viewer", permissions: permissions || {} };
  extra.push(profile);
  setExtra(extra);
  return uid;
}

export async function updateUserProfile(uid, data) {
  const extra = getExtra();
  const idx = extra.findIndex(p => p.uid === uid);
  if (idx >= 0) { extra[idx] = { ...extra[idx], ...data }; setExtra(extra); }
}

export async function deleteUserRecord(uid) {
  setExtra(getExtra().filter(p => p.uid !== uid));
}

export async function seedUserProfiles() {
  return SEED_PROFILES.map(p => ({ email: p.email, ok: true }));
}
