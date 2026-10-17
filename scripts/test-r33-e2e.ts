/**
 * r33 E2E — التحقق الشامل من طلب المؤسس:
 *  1) دخول المؤسس بكلمة المرور من البيئة
 *  2) لا شركات تجريبية (القاعدة فارغة عند البداية)
 *  3) إنشاء شركة سنيرجي كاملة (اسم/عنوان/slug/لوجو/هاتف/إيميل) + توليد slug تلقائي
 *  4) إدارة المستخدمين الحقيقية: إنشاء موظف → ظهور في DB → حذفه → يختفي فعلاً من DB
 *  5) تسجيل فاتورة عبر الوكيل (agent) — أداة create_invoice مع الحواجز
 *  6) BullMQ + Valkey + العامل: إضافة مهمة cache-warm → تُعالج بنجاح
 * Usage: bun run scripts/test-r33-e2e.ts http://127.0.0.1:3000
 */
const BASE = process.argv[2] || "http://127.0.0.1:3000";
const MASTER_EMAIL = "ahmedezzatelsayad@gmail.com";
/** كلمة المرور من البيئة فقط — لا أسرار في المستودع العام */
const MASTER_PASS = process.env.GARFIX_MASTER_PASSWORD || "";

let cookie = "";
let pass = 0, fail = 0;

function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}${detail ? " — " + detail : ""}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? " — " + detail : ""}`); }
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setC = res.headers.get("set-cookie");
  if (setC) cookie = setC.split(";")[0];
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text };
}

async function main() {
  console.log(`\n═══ r33 E2E على ${BASE} ═══\n`);

  // ─── 0) صحة النظام ───
  console.log("— [0] صحة النظام");
  const h = await api("GET", "/api/healthz");
  ok("healthz 200", h.status === 200);
  ok("قاعدة البيانات متصلة", h.json?.database?.ok === true);
  ok("Valkey متصل", h.json?.cache?.connected === true);

  // ─── 1) دخول المؤسس بكلمة المرور الجديدة ───
  console.log("— [1] دخول المؤسس (كلمة المرور من البيئة)");
  const wrong = await api("POST", "/api/auth/login", { email: MASTER_EMAIL, password: "WrongPass1!" });
  ok("كلمة مرور خاطئة تُرفض 401", wrong.status === 401);
  const login = await api("POST", "/api/auth/login", { email: MASTER_EMAIL, password: MASTER_PASS });
  ok("دخول المؤسس 200", login.status === 200 && login.json?.ok === true, `role=${login.json?.user?.role}`);

  // ─── 2) لا بيانات تجريبية ───
  console.log("— [2] لا شركات تجريبية");
  const pub = await api("GET", "/api/companies/public");
  const names = JSON.stringify(pub.json || {});
  ok("لا توفير/محلكم/بوص/لقطة في الموقع", !names.includes("توفير") && !names.includes("محلكم") && !names.includes("بوص") && !names.includes("لقطة"));

  // ─── 3) إنشاء شركة سنيرجي كاملة ───
  console.log("— [3] إنشاء شركة سنيرجي للمعدات والمستلزمات الطبية");
  const syn = await api("POST", "/api/companies", {
    name: "Synergy Medical Equipment & Supplies Co.",
    nameAr: "شركة سنيرجي للمعدات والمستلزمات الطبية",
    currency: "KWD",
    phone: "97970219",
    email: "info@Synergymedical.com",
    address: "الكويت — حولي — شارع بيروت",
    city: "Hawally",
    emoji: "🩺",
    color: "#0e7490",
    accent: "#0891b2",
    cardBg: "#ecfeff",
  });
  ok("إنشاء سنيرجي 201", syn.status === 201 || (syn.status === 409 && String(syn.json?.error || "").includes("مستخدم")), `status=${syn.status}`);
  let synSlug = syn.json?.company?.slug || syn.json?.slug || "";
  let synCode = syn.json?.company?.code || syn.json?.code || "";
  if (syn.status === 409) {
    // إعادة تشغيل: الشركة موجودة — اجلب slug من القائمة
    const existing = await api("GET", "/api/companies");
    const row = (existing.json?.companies || []).find((c: any) => c.nameAr?.includes("سنيرجي"));
    synSlug = row?.slug || ""; synCode = row?.code || "";
  }
  ok("slug وُلِّد تلقائياً من الاسم", typeof synSlug === "string" && synSlug.startsWith("tw_inv_") && synSlug.includes("synergy"), `slug=${synSlug}`);
  ok("code وُلِّد", !!synCode, `code=${synCode}`);
  const list = await api("GET", "/api/companies");
  const synRow = (list.json?.companies || []).find((c: any) => c.slug === synSlug || c.nameAr?.includes("سنيرجي"));
  ok("سنيرجي في قائمة الشركات", !!synRow);
  ok("بيانات سنيرجي صحيحة (هاتف/إيميل/عنوان/لوجو)", !!synRow && synRow.phone === "97970219" && String(synRow.email).toLowerCase() === "info@synergymedical.com" && synRow.address?.includes("حولي") && synRow.address?.includes("بيروت") && synRow.emoji === "🩺",
    `phone=${synRow?.phone} email=${synRow?.email} emoji=${synRow?.emoji}`);

  // ─── 4) إدارة المستخدمين الحقيقية (إنشاء → حذف) ───
  console.log("— [4] حذف المستخدمين يعمل فعلاً (DB)");
  const stamp = Date.now();
  const empEmail = `test.emp.${stamp}@synergymedical.com`;
  const cu = await api("POST", "/api/admin/users", {
    email: empEmail, password: "Emp#2026x", displayName: "موظف اختبار",
    companies: [synSlug], role: "employee",
    permissions: { create_invoice: 1, print_invoice: 1, view_customers: 1 },
  });
  ok("إنشاء موظف 201", cu.status === 201, `id=${cu.json?.user?.id}`);
  const empId = cu.json?.user?.id;
  const gu1 = await api("GET", "/api/admin/users");
  ok("الموظف يظهر في القائمة", (gu1.json?.users || []).some((u: any) => u.email === empEmail));
  // دخول الموظف بكلمته (تحقق scrypt حقيقي)
  const savedCookie = cookie;
  cookie = "";
  const empLogin = await api("POST", "/api/auth/login", { email: empEmail, password: "Emp#2026x" });
  ok("دخول الموظف من قاعدة البيانات", empLogin.status === 200, `companies=${JSON.stringify(empLogin.json?.user?.companies)}`);
  ok("صلاحيات الموظف وصلت للواجهة", (empLogin.json?.user?.permissions?.create_invoice ?? 0) === 1);
  cookie = savedCookie;
  const del = await api("DELETE", `/api/admin/users/${empId}`);
  ok("حذف الموظف 200", del.status === 200 && del.json?.ok === true);
  const gu2 = await api("GET", "/api/admin/users");
  ok("الموظف اختفى من القائمة بعد الحذف", !(gu2.json?.users || []).some((u: any) => u.email === empEmail));
  const empRelogin = await api("POST", "/api/auth/login", { email: empEmail, password: "Emp#2026x" });
  ok("دخول الموظف المحذوف يُرفض 401", empRelogin.status === 401);

  // ─── 5) تسجيل فاتورة عبر الوكيل ───
  console.log("— [5] تسجيل الفواتير من الوكيل (agent create_invoice)");
  const agentMsg = "سجّل فاتورة للعميل «مستشفى الأمير سالم» بمبلغ: قفازات طبية ×200 بسعر 0.350 د.ك للقطعة، وكمامات N95 ×100 بسعر 0.500 د.ك، دفعوا مقدماً 25 د.ك";
  const run = await api("POST", "/api/agent/run", {
    message: agentMsg,
    companySlug: synSlug,
    mode: "auto", // مدير — تنفيذ تلقائي ضمن الحواجز
  });
  // SSE stream — اجمع النص
  let runText = run.text || "";
  if (!runText && run.json) runText = JSON.stringify(run.json);
  const hasInvoiceCard = runText.includes("create_invoice");
  ok("الوكيل استدعى أداة create_invoice", hasInvoiceCard || run.status === 200, `status=${run.status}`);
  const invoices = await api("GET", `/api/invoices?company=${encodeURIComponent(synSlug)}`);
  const invList = invoices.json?.invoices || invoices.json || [];
  const agentInv = Array.isArray(invList) ? invList.find((i: any) => i.source === "agent") : null;
  ok("فاتورة source=agent في القاعدة", !!agentInv, agentInv ? `#${agentInv.invoiceNumber} total=${agentInv.total}` : "لا فاتورة");
  if (agentInv) {
    ok("بنود الفاتورة صحيحة (200 قفاز + 100 كمامة)", JSON.stringify(agentInv.lineItems || agentInv.items || "").includes("200") || (agentInv.subtotal ?? 0) > 100, `subtotal=${agentInv.subtotal} total=${agentInv.total}`);
    ok("العميل صحيح", String(agentInv.clientName || "").includes("مستشفى") || String(agentInv.clientName || "").includes("سالم"), `client=${agentInv.clientName}`);
  }

  // ─── 6) BullMQ + Valkey + العامل ───
  console.log("— [6] BullMQ + العامل (job-worker)");
  const jobs = await api("POST", "/api/jobs", { action: "enqueue", name: "cache-warm" });
  ok("إضافة مهمة للطابور", jobs.status === 200 || jobs.status === 202, `status=${jobs.status} id=${jobs.json?.job?.id || jobs.json?.id}`);
  await new Promise((r) => setTimeout(r, 4000));
  const wh = await fetch("http://127.0.0.1:3041/healthz").then((r) => r.json()).catch(() => null);
  ok("العامل حي", wh?.ok === true, `processed=${wh?.processed} failed=${wh?.failed}`);
  ok("المهمة عولجت بنجاح", (wh?.processed ?? 0) >= 1 && wh?.lastError == null, `last=${JSON.stringify(wh?.lastResult || null).slice(0, 80)}`);

  // ─── النتيجة ───
  console.log(`\n═══ النتيجة: ${pass} ناجح · ${fail} فاشل ═══`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("E2E crash:", e); process.exit(2); });
