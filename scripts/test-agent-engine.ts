/**
 * اختبار E2E لمحرك الوكيل (المرحلة 2) — عبر HTTP مباشرة:
 *  1. دخول المدير العام
 *  2. حلقة قراءة (سؤال عن الفواتير) — تحقق من أحداث Think→Act→Observe
 *  3. حاجز وضع القراءة: طلب كتابة → READONLY_MODE + بطاقة تأكيد
 *  4. لحظة الإبهار (وضع auto): «اعمل شركة تبيع ملابس ومتجر ليها»
 *     → شركة ERP + متجر Garfix Stores + ربط storesSlug
 *  5. سجل التدقيق: كل الاستدعاءات مدوّنة
 *  6. الحاجز المالي: إلغاء فاتورة كبيرة → AMOUNT_CAP
 *  7. أمن provision-store: توقيع خاطئ → 401
 */
const ERP = "http://localhost:3000";
const STORES = "http://localhost:3001";
const RUN_SUFFIX = Date.now().toString(36).slice(-4); // قابلية تكرار: لواحق فريدة لكل تشغيلة

let failures = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗ FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

/** مهلة بين التشغيلات — يمنع حد معدل المزوّد المدمج من تكسير الجولة */
const pause = (ms = 2500) => new Promise(r => setTimeout(r, ms));

async function login() {
  const res = await fetch(`${ERP}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ahmedezzatelsayad@gmail.com", password: "admin123" }),
  });
  const cookie = res.headers.get("set-cookie")?.split(";")[0] || "";
  const data = await res.json().catch(() => ({}));
  return { cookie, data };
}

/** يستهلك بثّ SSE ويعيد الأحداث المفسرّة */
async function runAgent(cookie, body) {
  const res = await fetch(`${ERP}/api/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { httpStatus: res.status, error: err.error || `HTTP ${res.status}`, events: [] };
  }
  const text = await res.text();
  const events = [];
  for (const part of text.split("\n\n")) {
    const lines = part.split("\n");
    let ev = "";
    let dataStr = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) ev = line.slice(7).trim();
      else if (line.startsWith("data: ")) dataStr += line.slice(6);
    }
    if (ev) {
      try { events.push({ ev, data: JSON.parse(dataStr) }); } catch { events.push({ ev, data: {} }); }
    }
  }
  return { httpStatus: 200, events };
}

const evType = (run, t) => run.events.filter(e => e.ev === t);

async function main() {
  console.log("═══ 1) دخول المدير ═══");
  const { cookie } = await login();
  ok("دخول المدير", !!cookie);

  console.log("\n═══ 2) حلقة القراءة — «شو الفواتير غير المدفوعة؟» ═══");
  const readRun = await runAgent(cookie, {
    message: "شو الفواتير غير المدفوعة في توفير؟ رتّبها لي باختصار",
    companySlug: "tw_inv_tawfeer_v1",
    mode: "readonly",
  });
  ok("HTTP 200", readRun.httpStatus === 200, `status=${readRun.httpStatus} ${readRun.error || ""}`);
  ok("حدث meta", evType(readRun, "meta").length === 1);
  ok("حدث turn_start", evType(readRun, "turn_start").length >= 1);
  ok("حدث thought", evType(readRun, "thought").length >= 1);
  const toolCalls = evType(readRun, "tool_call");
  const toolResults = evType(readRun, "tool_result");
  ok("استدعاء أداة (ACT)", toolCalls.length >= 1, toolCalls.map(t => t.data.tool).join(", "));
  ok("نتيجة أداة (OBSERVE)", toolResults.length >= 1 && toolResults.every(r => typeof r.data.summary === "string"));
  ok("قراءة نجحت", toolResults.some(r => r.data.ok === true));
  const readToolNames = toolCalls.map(t => t.data.tool);
  ok("أداة قراءة فقط", readToolNames.every(n => ["search", "list_invoices", "list_customers", "list_payments", "company_stats"].includes(n)), readToolNames.join(","));
  ok("حدث final", evType(readRun, "final").length >= 1);
  ok("حدث done", evType(readRun, "done").length === 1, `steps=${evType(readRun, "done")[0]?.data.steps}`);
  console.log("   الجواب النهائي:", String(evType(readRun, "final")[0]?.data.text || "").slice(0, 220).replace(/\n/g, " | "));

  console.log("\n═══ 3) حاجز وضع القراءة — طلب كتابة بدون تأكيد ═══");
  await pause();
  const guardCoName = `شركة الحاجز ${RUN_SUFFIX}`;
  const guardRun = await runAgent(cookie, {
    message: `اعمل لي شركة اسمها «${guardCoName}» وبلد الكويت`,
    companySlug: "tw_inv_tawfeer_v1",
    mode: "readonly",
  });
  const guardBlocked = evType(guardRun, "tool_result").filter(r => r.data.blocked === "READONLY_MODE");
  ok("الكتابة محجوبة (READONLY_MODE)", guardBlocked.length >= 1);
  const confirm = evType(guardRun, "confirmation_required");
  ok("بطاقة تأكيد صدرت", confirm.length === 1, `actions=${confirm[0]?.data.actions?.length}`);
  ok("لا شركة أُنشئت فعلياً", guardBlocked.every(r => r.data.ok === false));
  const guardFinalText = String(evType(guardRun, "final")[0]?.data.text || "");
  console.log("   رد الوكيل:", guardFinalText.slice(0, 200).replace(/\n/g, " | "));

  console.log("\n═══ 3b) مسار التأكيد — ضغطة المستخدم تنفّذ فعلًا ═══");
  if (confirm[0]?.data?.token) {
    await pause();
    const confirmRun = await runAgent(cookie, {
      message: `اعمل لي شركة اسمها «${guardCoName}»`,
      companySlug: "tw_inv_tawfeer_v1",
      mode: "readonly",
      confirmToken: confirm[0].data.token,
    });
    const confirmedResults = evType(confirmRun, "tool_result").filter(r => r.data.confirmed === undefined);
    ok("الفعل المؤكد نُفّذ", evType(confirmRun, "tool_call").some(t => t.data.confirmed === true), evType(confirmRun, "tool_call").map(t => `${t.data.tool}${t.data.confirmed ? "(✓)" : ""}`).join(","));
    const createdAfterConfirm = await (await fetch(`${ERP}/api/companies`, { headers: { Cookie: cookie } })).json();
    ok(`الشركة «${guardCoName}» وُجدت بعد التأكيد`, (createdAfterConfirm.companies || []).some(c => c.name?.includes(guardCoName) || c.nameAr?.includes(guardCoName)));
    ok("شرح النتائج صدر", evType(confirmRun, "final").length >= 1, String(evType(confirmRun, "final")[0]?.data.text || "").slice(0, 120).replace(/\n/g, " | "));
    void confirmedResults;
  } else {
    ok("مسار التأكيد", false, "لا توكن تأكيد — فشل القسم 3");
  }

  console.log("\n═══ 4) لحظة الإبهار (auto) — «اعمل شركة تبيع ملابس ومتجر ليها» ═══");
  await pause(4000);
  const wowSlug = `threads-${RUN_SUFFIX}`;
  const wowRun = await runAgent(cookie, {
    message: `اعمل شركة تبيع ملابس ومتجر ليها — سموها Threads ومتجرها ${wowSlug}`,
    mode: "auto",
  });
  const wowTools = evType(wowRun, "tool_call").map(t => t.data.tool);
  ok("استدعى create_store", wowTools.includes("create_store"), wowTools.join(","));
  const wowStoreResult = evType(wowRun, "tool_result").find(r => r.data.tool === "create_store");
  ok("المتجر أُنشئ فعلاً", wowStoreResult?.data.ok === true, String(wowStoreResult?.data.summary || "").slice(0, 200).replace(/\n/g, " | "));
  ok("final موجود", evType(wowRun, "final").length >= 1);

  // تحقق مباشر من قاعدتي البيانات عبر APIs
  const companies = await (await fetch(`${ERP}/api/companies`, { headers: { Cookie: cookie } })).json();
  const wowCompany = (companies.companies || []).find(c => c.name?.toLowerCase().includes("threads") && c.storesSlug);
  ok("شركة Threads مرتبطة بمتجر في ERP", !!wowCompany, wowCompany ? `slug=${wowCompany.slug} storesSlug=${wowCompany.storesSlug}` : "غير موجودة/غير مرتبطة");
  const storeCheck = await (await fetch(`${STORES}/api/storefront/${wowSlug}`)).json().catch(() => ({}));
  ok(`متجر ${wowSlug} في Stores`, !!storeCheck.storefront && String(storeCheck.storefront.name || "").toLowerCase().includes("threads"), JSON.stringify(storeCheck).slice(0, 130));

  console.log("\n═══ 5) سجل التدقيق ═══");
  const audit = await (await fetch(`${ERP}/api/agent/audit?limit=50`, { headers: { Cookie: cookie } })).json();
  ok("استدعاءات مدوّنة", (audit.entries || []).length >= 2, `count=${(audit.entries || []).length}`);
  ok("استدعاء محجوب مدوَّن", (audit.entries || []).some(e => e.blocked === "READONLY_MODE"));
  ok("استدعاء ناجح مدوَّن", (audit.entries || []).some(e => e.ok === true));
  const anonAudit = await fetch(`${ERP}/api/agent/audit`);
  ok("التدقيق يتطلب جلسة (401)", anonAudit.status === 401);

  console.log("\n═══ 6) الحاجز المالي — إلغاء فاتورة كبيرة ═══");
  // أنشئ فاتورة ضخمة (يدوياً عبر API الرسمي) ثم اطلب من الوكيل إلغاءها
  const invRes = await fetch(`${ERP}/api/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      companySlug: "tw_inv_tawfeer_v1",
      clientName: "عميل الحاجز المالي",
      lineItems: [{ name: "بند ضخم", qty: 1, price: 99999 }],
      issueDate: "2026-09-24",
      dueDate: "2026-10-24",
    }),
  });
  const invData = await invRes.json().catch(() => ({}));
  const invNumber = invData?.invoice?.invoiceNumber || invData?.invoiceNumber;
  ok("فاتورة ضخمة أُنشئت (يدوياً)", !!invNumber, invNumber || JSON.stringify(invData).slice(0, 120));
  if (invNumber) {
    await pause();
    const capRun = await runAgent(cookie, {
      message: `حدّث حالة الفاتورة رقم ${invNumber} إلى «ملغاة» الآن — نفّذ أداة التحديث مباشرة`,
      companySlug: "tw_inv_tawfeer_v1",
      mode: "auto",
    });
    const capResult = evType(capRun, "tool_result").find(r => r.data.tool === "update_invoice_status");
    ok("الحاجز المالي حجب الإلغاء (AMOUNT_CAP)", capResult?.data.blocked === "AMOUNT_CAP", String(capResult?.data.summary || "").slice(0, 160).replace(/\n/g, " | "));
  }

  console.log("\n═══ 7) أمن provision-store ═══");
  const badSig = await fetch(`${STORES}/api/webhooks/erp/provision-store`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Garfix-Signature": "sha256=deadbeef" },
    body: JSON.stringify({ store: { slug: "x-test", name: "Test" }, owner: { name: "X" } }),
  });
  ok("توقيع خاطئ مرفوض (401)", badSig.status === 401);

  console.log(`\n${failures === 0 ? "✅ كل الاختبارات نجحت" : `❌ ${failures} فشل`}`);
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error("خطأ عام:", e); process.exit(1); });
