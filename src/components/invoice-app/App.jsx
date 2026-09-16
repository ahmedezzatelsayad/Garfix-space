"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { api } from "./api";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "./context/AuthContext";
import { logoutUser } from "./firebase/auth";
import AdminDashboard from "./pages/AdminDashboard";
import PurchasesTab from "./components/PurchasesTab";
import AIBulkProcessor from "./components/AIBulkProcessor";
import SmartChat from "./components/SmartChat";
import DeepSeekSettings from "./components/DeepSeekSettings";
import BackupRecovery from "./components/BackupRecovery";
import AccountPanel from "./components/AccountPanel";
import JobsPanel from "./components/JobsPanel";
import CompanyForm from "./components/CompanyForm";
import SiteManager from "./components/SiteManager";
import PublicSite from "../site/PublicSite";
import { fmtMoney, setCurrency, currencySymbol, CURRENCIES } from "./currency";
import ReportsTab from "./components/ReportsTab";
import PaymentsPanel from "./components/PaymentsPanel";
import RemindersPanel from "./components/RemindersPanel";
import { buildStatementHTML } from "./statement";
import { useTheme, txAdapt, softAdapt, chartColors, lighten } from "./theme";
import { tr, useAppI18n, appDir, appLang, companyName, dateLocale } from "@/lib/i18n-app";
// r25: غلاف Business OS العالمي + اللوحة الجديدة + شاشتا المدفوعات/التذكيرات + تجربة التهيئة
import AppShell from "./shell/AppShell";
import DashboardHome from "./dashboard/DashboardHome";
import { PaymentsView, RemindersView } from "./dashboard/OperationsViews";
import Onboarding from "./onboarding/Onboarding";
// r23: دول العالم (195) وتقسيماتها الإدارية (محافظات/مقاطعات) لبطاقة العميل
import { WORLD_COUNTRIES, WORLD_BY_CODE } from "@/lib/countries-world";

// علم الدولة من رمزها (رموز المؤشرات الإقليمية) — نسخة عميل من flagOf الخادم
const flagOf = code => {
  const c = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🌍";
  return String.fromCodePoint(...[...c].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65));
};

// مطابقة الدولة من اسم عربي/إنجليزي أو كود ISO → كود ISO-2 (أو null)
const COUNTRY_LOOKUP = (() => {
  const m = new Map();
  for (const c of WORLD_COUNTRIES) {
    m.set(c.code.toUpperCase(), c.code);
    m.set(c.nameEn.toLowerCase(), c.code);
    m.set(c.nameAr, c.code);
    m.set(c.nameAr.replace(/^ال/, ""), c.code);
  }
  return m;
})();
const countryCodeOf = v => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return COUNTRY_LOOKUP.get(s.toUpperCase()) || COUNTRY_LOOKUP.get(s.toLowerCase()) || COUNTRY_LOOKUP.get(s) || null;
};
const countryLabel = (code, lang) => {
  const c = WORLD_BY_CODE[String(code || "").toUpperCase()];
  if (!c) return String(code || "");
  return lang === "ar" ? c.nameAr : c.nameEn;
};

// تقسيمات العالم (محافظات ومقاطعات كل الدول) — chunk منفصل يُحمّل ديناميكياً مرة واحدة
let _wsPromise = null;
const worldStates = () => (_wsPromise ||= import("@/lib/world-states"));
function useWorldStates() {
  const [ws, setWs] = useState(null);
  useEffect(() => {
    let alive = true;
    worldStates().then(m => { if (alive) setWs(m); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return ws;
}
// تسمية المحافظة بلغة الواجهة (تُطابق الأساس الإنجليزي المخزّن أو الاسم العربي)
const govLabelOf = (ws, country, gov, lang) => {
  if (!gov) return "";
  if (ws) {
    const d = ws.findDivision(country, gov);
    if (d) return ws.divisionLabel(d, lang);
  }
  return gov;
};
// مجموعات الدول لقائمة اختيار الدولة
const REGION_GROUPS = [
  ["arab", "🌍 الدول العربية"],
  ["mena", "🏛️ الشرق الأوسط"],
  ["europe", "🏰 أوروبا"],
  ["asia", "🏯 آسيا"],
  ["americas", "🗽 الأمريكتان"],
  ["africa", "🌍 أفريقيا"],
  ["oceania", "🏝️ أوقيانوسيا"],
];

// ─── Companies Config ─────────────────────────────────────────────
const COMPANIES = {
tawfeer: {
id: "tawfeer", name: "Tawfeer Online Shop", nameAr: "توفير أونلاين شوب",
logo: "🛒", phone: "+96598737207", email: "Info@tawfeeronline.shop",
address: "Kuwait City - Hawally 10078", city: "Hawalli", sellerRef: "Tawfeer",
manager: "Aya Sayed", managerPhone: "+96598737207", color: "#1e3a5f", accent: "#2563eb",
bg: "linear-gradient(135deg,#0f1f3d 0%,#1e3a5f 50%,#0f2444 100%)", cardBg: "#e8f0fe",
emoji: "🛒", sk: "tw_inv_tawfeer_v1",
},
mahhal: {
id: "mahhal", name: "Mahhal Online Store", nameAr: "محلكم أونلاين ستور",
logo: "🏪", phone: "+96597300252", email: "Info@mahhalcom.store",
address: "Kuwait City - Hawally 10078", city: "Hawalli", sellerRef: "Mahhal",
manager: "Admin", managerPhone: "+96597300252", color: "#b8860b", accent: "#d4a017",
bg: "linear-gradient(135deg,#1a1200 0%,#3d2e00 50%,#1a1200 100%)", cardBg: "#fffbeb",
emoji: "🏪", sk: "tw_inv_mahhal_v1",
},
boss: {
id: "boss", name: "Boss Neolife", nameAr: "بوص نيولايف",
logo: "⚡", phone: "+96598737202", email: "Manager@bosslifestyle.store",
address: "Kuwait City 12003", city: "Hawalli", sellerRef: "Germany Tachnlogoy",
manager: "Salla shop", managerPhone: "+96598737202", color: "#cc0000", accent: "#ff2222",
bg: "linear-gradient(135deg,#1a0000 0%,#3d0000 50%,#1a0000 100%)", cardBg: "#fff1f1",
emoji: "⚡", sk: "tw_inv_boss_v1",
},
laqta: {
id: "laqta", name: "Laqta Online Store", nameAr: "لقطة أونلاين",
logo: "♾️", phone: "+96567005397", email: "info@laqtaonline.store",
address: "kuwait city Kuwait City", city: "Hawalli", sellerRef: "Laqta",
manager: "Admin", managerPhone: "+96567005397", color: "#7c3aed", accent: "#a855f7",
bg: "linear-gradient(135deg,#1a0040 0%,#3b0080 50%,#1a0040 100%)", cardBg: "#f5f3ff",
emoji: "♾️", sk: "tw_inv_laqta_v1",
},
};

// ─── Utils ────────────────────────────────────────────────────────
const toW  = s => String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d));
const pN   = s => parseFloat(toW(String(s||0)).replace(/[^\d.]/g,""))||0;
const fKWD = n => fmtMoney(n); // r12: تتبع عملة الشركة النشطة (KWD افتراضياً) — كانت " KD" ثابتة
const fDate= s => { if(!s)return""; const[y,m,d]=s.split("-"); return`${d}/${m}/${y}`; };
const today= ()=> new Date().toISOString().split("T")[0];
const addD = (s,n)=>{ const d=new Date(s); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; };
const norm = p => toW(String(p||"")).replace(/[^\d+]/g,"");
// r9: canonical Kuwaiti phone key — digits only with a leading 965 country-code stripped,
// so "+96595544332", "96595554433" and "95544332" all group to "95544332" (8-digit local).
// Used for customer aggregation, credit-limit keys and outstanding balances ONLY (display keeps the original).
const phKey = p => { const d=norm(p||"").replace(/^\+/g,""); return /^965\d{8}$/.test(d)?d.slice(3):d; };
// r9: credit-limit lookup tolerant to legacy norm-keyed maps (canonical phKey first, exact-norm fallback)
const creditLimitOf=(map,phone)=>{
  const k=phKey(phone||"");
  if(!k)return 0;
  if(map&&map[k]!=null)return pN(map[k]);
  const n=norm(phone||"");
  return pN((map&&map[n])||0);
};
// r18: الضريبة الاختيارية — iTax يحسب مبلغ ضريبة الفاتورة من نسبتها (٪)، وiT يشملها في الإجمالي
const iTax = inv => { const r=pN(inv.taxRate||0); if(!(r>0))return 0; const sub=inv.items.reduce((s,it)=>s+pN(it.qty)*pN(it.price),0); return +(sub*r/100).toFixed(2); };
const iT   = inv => inv.items.reduce((s,it)=>s+pN(it.qty)*pN(it.price),0)+pN(inv.shipping||0)+iTax(inv);
// r18: الضريبة الافتراضية للشركة (من إعداداتها: taxEnabled + defaultTaxRate)
const companyTax = co => { const r=co&&co.dbRow; if(!r) return 0; if(r.taxEnabled===false) return 0; const v=Number(r.defaultTaxRate); return Number.isFinite(v)&&v>0?v:0; };
const nxtN = list=>{ const ns=list.map(i=>parseInt(i.invNum?.replace(/\D/g,"")||0)); return"INV"+(Math.max(0,...ns)+1); };
const getStatus = inv => { if(inv.status==='cancelled')return'cancel'; const tot=iT(inv);const paid=pN(inv.paid||0); return paid>=tot?"paid":paid>0?"part":"unp"; };
const stLabel  = {paid:"مدفوعة",part:"جزئي",unp:"غير مدفوعة",cancel:"ملغية"};
const stColor  = {paid:"#16a34a",part:"#d97706",unp:"#dc2626",cancel:"#6b7280"};

// ── Overdue helper: days past due date (for unpaid/partial invoices) ──
const overdueDays = inv => {
  const st = getStatus(inv);
  if (st === "paid" || st === "cancel") return 0;
  if (!inv.dueDate) return 0;
  const todayStr = new Date().toISOString().split("T")[0];
  if (inv.dueDate >= todayStr) return 0;
  return Math.floor((new Date(todayStr) - new Date(inv.dueDate)) / 86400000);
};

// ── Payment method labels (Arabic) ──
const payMethodLabel = { knet: "كي نت", cash: "نقدي", online: "أونلاين", card: "بطاقة" };

// ── WhatsApp payment-reminder deep link (wa.me supports ?text=) ──
const waReminderHref = (inv, company) => {
  const phone = norm(inv.clientPhone || "").replace(/^\+?965/, "");
  if (!phone) return null;
  const tot = iT(inv), paid = pN(inv.paid || 0), due = tot - paid, od = overdueDays(inv);
  const lines = [
    tr("عميلنا العزيز {0}،",[inv.clientName || ""]),
    tr("تذكير ودّي من {0} 🙏",[companyName(company)]),
    tr("📄 الفاتورة رقم {0} بتاريخ {1}",[inv.invNum,fDate(inv.date)]),
    tr("💰 الإجمالي: {0}",[fKWD(tot)]),
    paid > 0 ? tr("✅ المدفوع: {0} — المتبقي: {1}",[fKWD(paid),fKWD(due)]) : tr("المبلغ المطلوب: {0}",[fKWD(due)]),
    tr("📅 تاريخ الاستحقاق: {0}{1}",[fDate(inv.dueDate),od > 0 ? tr(" (متأخرة {0} يوم)",[od]) : ""]),
    tr(`نرجو التكرم بتسوية المبلغ المتبقي في أقرب وقت 🙏`),
    tr(`شكراً لتعاونكم 🌹`),
    `${companyName(company)} — ${company.phone}`,
  ];
  return `https://wa.me/965${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
};

// ── Fire-and-forget audit log for every sent WhatsApp reminder / payment request / statement ──
function logReminderSent(inv, company, href, channel){
  try{
    let message=null;
    if(href){ const m=href.split("text=")[1]; if(m){ try{ message=decodeURIComponent(m).slice(0,1500); }catch{} } }
    api.logReminder({
      invoiceId: inv.id,
      clientPhone: inv.clientPhone||null,
      clientName: inv.clientName||null,
      companySlug: company?.sk||null,
      channel: channel||"whatsapp",
      message,
      amount: Math.max(0, iT(inv)-pN(inv.paid||0)),
    }).then(()=>{ try{ window.dispatchEvent(new CustomEvent("reminder-logged",{detail:{invoiceId:inv.id}})); }catch{} })
      .catch(()=>{});
  }catch{}
}

// ─── Storage (localStorage) ────────────────────────────────────────
function dbGet(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch{return null;}}
function dbSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}

// ── Per-company payment-gateway link template (KNET / KPay / MyFatoorah) ──
// localStorage tw_paylink_{companyId} = instant cache; server Setting "paylink_tpl" (r9) = cross-device sync.
// Supports {amount}, {invoice}, {phone} placeholders.
function getPayLinkTpl(companyId){ try{ return localStorage.getItem("tw_paylink_"+(companyId||"")) || ""; }catch{ return ""; } }
function setPayLinkTpl(company, tpl){
  const v=String(tpl||"").trim();
  try{ localStorage.setItem("tw_paylink_"+(company?.id||""), v); }catch{}
  if(company?.sk) api.saveSetting(company.sk,"paylink_tpl",v).catch(()=>{}); // r9 write-through to server
}
function buildPayLink(tpl, inv, amount){
  if(!tpl) return "";
  return String(tpl)
    .replace(/\{amount\}/g, String(amount))
    .replace(/\{invoice\}/g, encodeURIComponent(inv?.invNum||""))
    .replace(/\{phone\}/g, encodeURIComponent(inv?.clientPhone||""));
}

// ── WhatsApp payment-request message (used when no gateway link is configured) ──
function payRequestMessage(inv, company, amount, link){
  const lines=[
    tr("عميلنا العزيز {0}،",[inv.clientName||""]),
    tr("طلب دفع من {0} 💳",[companyName(company)]),
    tr("📄 الفاتورة رقم {0} بتاريخ {1}",[inv.invNum,fDate(inv.date)]),
    tr("💰 المبلغ المطلوب: {0}",[fKWD(amount)]),
    link?tr("🔗 للسداد الإلكتروني (كي نت):\n{0}",[link]):"",
    tr(`شكراً لتعاونكم 🌹`),
    `${companyName(company)} — ${company.phone}`,
  ].filter(Boolean);
  return lines.join("\n");
}
const waHrefWithText=(phone,text)=>`https://wa.me/965${norm(phone||"").replace(/^\+?965/,"")}?text=${encodeURIComponent(text)}`;

// ── Per-company client credit limits: { [phone]: limitKD } ──
// localStorage tw_credit_{companyId} = instant cache; server Setting "credit" (r9) = cross-device sync.
function loadCreditMap(companyId){ try{ const v=JSON.parse(localStorage.getItem("tw_credit_"+(companyId||""))||"{}"); return (v&&typeof v==="object")?v:{}; }catch{ return {}; } }
function saveCreditMap(company,map){
  try{ localStorage.setItem("tw_credit_"+(company?.id||""),JSON.stringify(map||{})); }catch{}
  if(company?.sk) api.saveSetting(company.sk,"credit",map||{}).catch(()=>{}); // r9 write-through to server
}
// r9: pull server-side settings into the local caches (server wins; migrates legacy local-only data up).
// Returns the server credit map when present (null otherwise) so callers can update their state.
async function syncSettingsFromServer(company){
  if(!company?.sk)return null;
  try{
    const s=await api.getSettings(company.sk,["paylink_tpl","credit","credit_block"]);
    if(typeof s.paylink_tpl==="string"){
      try{ localStorage.setItem("tw_paylink_"+company.id,s.paylink_tpl); }catch{}
    }else{
      const local=getPayLinkTpl(company.id);
      if(local) api.saveSetting(company.sk,"paylink_tpl",local).catch(()=>{}); // migrate legacy local value up
    }
    if(typeof s.credit_block==="string"){
      try{ localStorage.setItem("tw_credit_block_"+company.id,s.credit_block); }catch{}
    }
    if(s.credit&&typeof s.credit==="object"&&Object.keys(s.credit).length>0){
      try{ localStorage.setItem("tw_credit_"+company.id,JSON.stringify(s.credit)); }catch{}
      return s.credit;
    }
    const localMap=loadCreditMap(company.id);
    if(Object.keys(localMap).length>0) api.saveSetting(company.sk,"credit",localMap).catch(()=>{}); // migrate legacy
    return null;
  }catch{ return null; }
}
// r9: credit hard-block flag (per company) — when "1", non-admin users cannot SAVE an invoice
// that pushes the client over their credit limit; admins save with a warning only.
function getCreditBlock(companyId){ try{ return localStorage.getItem("tw_credit_block_"+(companyId||""))==="1"; }catch{ return false; } }
function setCreditBlock(company,on){
  try{ localStorage.setItem("tw_credit_block_"+(company?.id||""),on?"1":"0"); }catch{}
  if(company?.sk) api.saveSetting(company.sk,"credit_block",on?"1":"0").catch(()=>{});
}
// Outstanding balance for one client phone (non-cancelled invoices, remaining after payments)
// r9: matches via phKey so +965 / 965 / local spellings of the same number all count.
function outstandingOf(invoices, phone){
  const ph=phKey(phone||"");
  if(!ph) return 0;
  return invoices.reduce((s,inv)=>{
    if(inv.status==="cancelled") return s;
    if(phKey(inv.clientPhone||"")!==ph) return s;
    return s+Math.max(0,iT(inv)-pN(inv.paid||0));
  },0);
}

// ─── Invoice file parsers (CSV + Excel) ────────────────────────────
/**
 * Generic invoice importer for CSV and Excel (.xlsx / .xls) files.
 * Supported columns (Arabic + English header variants):
 * Invoice No, Date, Due Date, Customer Name, Phone, Address,
 * Item Name, Item Description, Qty, Unit Price, Shipping, Paid, Notes
 * Rows repeating the same invoice number are merged as multiple items.
 */
function groupInvoiceRows(rawHeaders, rows) {

// Header mapping: file column → our field
const colMap = {
invNum:         ["invoice no","invoice number",tr("رقم الفاتورة"),"inv no",tr("رقم")],
date:           ["date",tr("تاريخ"),"invoice date",tr("تاريخ الفاتورة")],
dueDate:        ["due date",tr("تاريخ الاستحقاق"),"expiry date"],
clientName:     ["customer name","client name",tr("اسم العميل"),tr("الاسم"),"name","customer"],
clientPhone:    ["phone","telephone","mobile",tr("هاتف"),tr("رقم الهاتف"),"customer phone","client phone",tr("جوال")],
clientAddress:  ["address",tr("عنوان"),"customer address","client address",tr("العنوان")],
itemName:       ["item name","product name","item","product",tr("المنتج"),tr("اسم المنتج"),tr("الصنف")],
itemDesc:       ["description","item description",tr("وصف"),tr("الوصف"),"desc"],
qty:            ["qty","quantity",tr("كمية"),tr("الكمية")],
price:          ["unit price","price",tr("سعر"),tr("سعر الوحدة"),tr("السعر")],
shipping:       ["shipping","delivery",tr("توصيل"),tr("شحن")],
paid:           ["paid",tr("مدفوع"),"paid amount",tr("المدفوع")],
notes:          ["notes",tr("ملاحظات"),"note","remarks"],
};

// Find column index for each field
const idx = {};
for (const [field, variants] of Object.entries(colMap)) {
for (const v of variants) {
const i = rawHeaders.findIndex(h => h.includes(v));
if (i !== -1) { idx[field] = i; break; }
}
if (idx[field] === undefined) idx[field] = -1;
}

const get = (row, field) => {
const i = idx[field];
return i >= 0 && i < row.length ? String(row[i] ?? "").replace(/^"|"$/g, "").trim() : "";
};

// Group rows by invoice number (files may repeat invoice rows for multiple items)
const invMap = {};
const errors = [];

rows.forEach((row, ri) => {
if (!row.length || row.every(c => !c)) return;

let invNum = get(row, "invNum") || `IMP${ri+1}`;
const key = invNum;

// Normalize date: handle dd/mm/yyyy → yyyy-mm-dd
const parseDate = s => {
  if (!s) return today();
  // Already yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  // dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  return today();
};

const itemName = get(row, "itemName");
const itemDesc = get(row, "itemDesc");
const qty = pN(get(row, "qty")) || 1;
const price = pN(get(row, "price"));
const item = { name: itemName || tr("منتج"), desc: itemDesc, qty, price };

if (invMap[key]) {
  // Add item to existing invoice
  if (itemName || price) invMap[key].items.push(item);
} else {
  invMap[key] = {
    invNum,
    clientName: get(row, "clientName") || tr("عميل"),
    clientPhone: norm(get(row, "clientPhone")),
    clientAddress: get(row, "clientAddress"),
    items: (itemName || price) ? [item] : [{ name: tr("منتج"), desc: "", qty: 1, price: 0 }],
    shipping: pN(get(row, "shipping")),
    date: parseDate(get(row, "date")),
    dueDate: parseDate(get(row, "dueDate")) || addD(today(), 30),
    paid: pN(get(row, "paid")),
    notes: get(row, "notes"),
  };
}

});

const invoices = Object.values(invMap);
return { invoices, errors, detectedCols: rawHeaders };
}

// Parse a CSV text → invoices (quoted fields supported)
function parseInvoicesCSV(text) {
const lines = text.trim().split(/\r?\n/);
if (lines.length < 2) return { invoices: [], errors: [tr("الملف فارغ أو غير صحيح")] };
const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
const rows = lines.slice(1).map(line => {
const cols = [];
let cur = "", inQ = false;
for (let i = 0; i < line.length; i++) {
const ch = line[i];
if (ch === '"') { inQ = !inQ; }
else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; }
else cur += ch;
}
cols.push(cur.trim());
return cols;
}).filter(r => r.some(c => c.length > 0));
return groupInvoiceRows(rawHeaders, rows);
}

// Parse an Excel (.xlsx / .xls) workbook → invoices (first sheet)
function parseInvoicesExcel(buffer) {
let wb;
try { wb = XLSX.read(buffer, { type: "array" }); }
catch { return { invoices: [], errors: [tr("تعذر قراءة ملف Excel — تأكد أنه بصيغة .xlsx أو .xls")] }; }
const sheetName = wb.SheetNames[0];
if (!sheetName) return { invoices: [], errors: [tr("ملف Excel فارغ")] };
const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "", raw: false });
if (aoa.length < 2) return { invoices: [], errors: [tr("الملف فارغ أو غير صحيح")] };
const rawHeaders = aoa[0].map(h => String(h ?? "").trim().replace(/^"|"$/g, "").toLowerCase());
const rows = aoa.slice(1).filter(r => r.some(c => String(c ?? "").trim() !== ""));
return groupInvoiceRows(rawHeaders, rows);
}

// ─── Import Modal (CSV / Excel) ───────────────────────────────────
function ImportModal({ company, existingInvoices, onImport, onClose }) {
const [step, setStep] = useState(0); // 0=upload, 1=preview, 2=done
const [parsed, setParsed] = useState([]);
const [errors, setErrors] = useState([]);
const [detectedCols, setDetectedCols] = useState([]);
const [importing, setImporting] = useState(false);
const [skipDup, setSkipDup] = useState(true);
const [importedCount, setImportedCount] = useState(0);
const fileRef = useRef();
const col = company.color;
const { dark } = useTheme();
const colTx = txAdapt(col, dark);

const existingNums = new Set(existingInvoices.map(i => i.invNum));

const handleFile = (file) => {
if (!file) return;
const ext = file.name.split(".").pop().toLowerCase();
if (["csv", "txt"].includes(ext)) {
const reader = new FileReader();
reader.onload = (e) => {
const result = parseInvoicesCSV(String(e.target.result || ""));
setParsed(result.invoices);
setErrors(result.errors || []);
setDetectedCols(result.detectedCols || []);
setStep(1);
};
reader.readAsText(file, "UTF-8");
} else if (["xlsx", "xls"].includes(ext)) {
const reader = new FileReader();
reader.onload = (e) => {
const result = parseInvoicesExcel(new Uint8Array(e.target.result));
setParsed(result.invoices);
setErrors(result.errors || []);
setDetectedCols(result.detectedCols || []);
setStep(1);
};
reader.readAsArrayBuffer(file);
} else {
setErrors([tr("يرجى رفع ملف CSV أو Excel بصيغة .xlsx أو .xls")]);
}
};

const handleDrop = (e) => {
e.preventDefault();
const file = e.dataTransfer.files[0];
if (file) handleFile(file);
};

const toImport = skipDup ? parsed.filter(p => !existingNums.has(p.invNum)) : parsed;
const dupCount = parsed.length - toImport.length;

const doImport = async () => {
setImporting(true);
const newInvs = [];
toImport.forEach(b => {
  const running = [...existingInvoices, ...newInvs];
  newInvs.push({
    id: Date.now() + Math.random(),
    invNum: nxtN(running),
    clientName: b.clientName,
    clientPhone: b.clientPhone,
    clientAddress: b.clientAddress,
    items: b.items,
    shipping: b.shipping,
    date: b.date,
    dueDate: b.dueDate,
    paid: b.paid,
    notes: b.notes,
    createdAt: new Date().toISOString(),
    source: "import",
  });
});
await new Promise(r => setTimeout(r, 400));
setImportedCount(toImport.length);
setImporting(false);
setStep(2);
onImport(newInvs);
};

return (
<div style={{
position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:2000,
display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",
fontFamily:"'Cairo','Tajawal',sans-serif",direction:appDir()
}} onClick={onClose}>
<div style={{
background:"var(--ia-card)",borderRadius:"18px",width:"100%",maxWidth:"620px",
maxHeight:"88vh",overflow:"hidden",display:"flex",flexDirection:"column",
boxShadow:"0 24px 64px rgba(0,0,0,.35)",animation:"fadeUp .25s"
}} onClick={e=>e.stopPropagation()}>

    {/* Header */}
    <div style={{background:col,padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
      <div>
        <div style={{color:"#fff",fontWeight:900,fontSize:"16px"}}>{tr("📥 استيراد الفواتير (CSV / Excel)")}</div>
        <div style={{color:"rgba(255,255,255,.7)",fontSize:"12px",marginTop:"2px"}}>{company.nameAr}</div>
      </div>
      <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"6px 12px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>{tr("✕ إغلاق")}</button>
    </div>

    {/* Steps indicator */}
    <div style={{display:"flex",borderBottom:"1px solid #e5e7eb",background:"var(--ia-row-alt)",padding:"0 22px",flexShrink:0}}>
      {[tr("رفع الملف"),tr("معاينة البيانات"),tr("تم الاستيراد")].map((s,i) => (
        <div key={i} style={{padding:"10px 16px",fontSize:"12px",fontWeight:700,borderBottom:`2px solid ${step===i?col:"transparent"}`,color:step===i?col:step>i?"#16a34a":"#9ca3af",cursor:"pointer",transition:"all .2s"}} onClick={()=>i<step&&setStep(i)}>
          {step>i?"✓ ":""}{s}
        </div>
      ))}
    </div>

    <div style={{padding:"22px",overflowY:"auto",flex:1}}>

      {/* STEP 0 — Upload */}
      {step===0&&(
        <div>
          <div style={{background:"var(--ia-sky-bg)",border:"1.5px solid var(--ia-sky-bd)",borderRadius:"10px",padding:"14px 16px",marginBottom:"18px"}}>
            <div style={{fontWeight:700,color:"var(--ia-sky-tx)",marginBottom:"6px",fontSize:"13px"}}>{tr("📋 الصيغ المدعومة: Excel (.xlsx / .xls) و CSV")}</div>
            <ul style={{fontSize:"12px",color:"var(--ia-sky-tx2)",paddingInlineStart:"18px",lineHeight:"1.9",margin:0}}>
              <li>{tr("أعدّ ملفك في")} <b>Excel</b> {tr("أو صدّره من أي نظام محاسبة")}</li>
              <li>{tr("رؤوس الأعمدة تدعم")} <b>{tr("العربية والإنجليزية")}</b> {tr("معاً")}</li>
              <li>{tr("تكرار رقم الفاتورة في أكثر من سطر يُدمج تلقائياً كبنود متعددة")}</li>
              <li>{tr("الفواتير المكررة (بنفس الرقم) يمكن تخطيها اختيارياً")}</li>
            </ul>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={e=>e.preventDefault()}
            onClick={()=>fileRef.current?.click()}
            style={{
              border:`2px dashed ${col}66`,borderRadius:"14px",padding:"40px 20px",
              textAlign:"center",cursor:"pointer",transition:"all .2s",background:`${col}07`,
              marginBottom:"16px"
            }}
            onMouseEnter={e=>{e.currentTarget.style.background=`${col}12`;e.currentTarget.style.borderColor=col;}}
            onMouseLeave={e=>{e.currentTarget.style.background=`${col}07`;e.currentTarget.style.borderColor=`${col}66`;}}
          >
            <div style={{fontSize:"44px",marginBottom:"10px"}}>📂</div>
            <div style={{fontWeight:700,fontSize:"15px",color:"var(--ia-text)",marginBottom:"5px"}}>{tr("اسحب ملف CSV أو Excel هنا")}</div>
            <div style={{color:"var(--ia-sub)",fontSize:"12px",marginBottom:"14px"}}>{tr("أو اضغط للاختيار من جهازك")}</div>
            <div style={{display:"inline-block",background:col,color:"#fff",padding:"9px 22px",borderRadius:"8px",fontWeight:700,fontSize:"13px"}}>{tr("اختر ملف CSV / Excel")}</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>

          {errors.length>0&&(
            <div style={{background:"var(--ia-red-bg)",border:"1px solid #fca5a5",borderRadius:"8px",padding:"10px 14px",color:"var(--ia-red-tx)",fontSize:"12px"}}>
              ❌ {errors.join(" | ")}
            </div>
          )}

          <div style={{background:"var(--ia-soft)",borderRadius:"8px",padding:"12px 16px",marginTop:"14px",fontSize:"11px",color:"var(--ia-sub)",lineHeight:"1.8"}}>
            <b>{tr("الأعمدة المدعومة:")}</b> {tr("رقم الفاتورة، التاريخ، اسم العميل، الهاتف، العنوان، اسم المنتج، الكمية، السعر، التوصيل، المدفوع، الملاحظات")}
          </div>
        </div>
      )}

      {/* STEP 1 — Preview */}
      {step===1&&(
        <div>
          <div style={{display:"flex",gap:"10px",marginBottom:"14px",flexWrap:"wrap",alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:"14px",color:"var(--ia-text)"}}>
                {tr("تم تحليل")} <span style={{color:colTx}}>{parsed.length}</span> {tr("فاتورة")}
                {dupCount>0&&<span style={{color:"var(--ia-warn-tx)",marginInlineStart:"6px",fontSize:"12px"}}>({dupCount} {tr("مكررة)")}</span>}
              </div>
              <div style={{fontSize:"12px",color:"var(--ia-sub)",marginTop:"3px"}}>{tr("الأعمدة المكتشفة:")} {detectedCols.slice(0,6).join("، ")}{detectedCols.length>6?"...":""}</div>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer",fontSize:"12px",fontWeight:700,color:"var(--ia-text2)",background:"var(--ia-chip)",padding:"7px 12px",borderRadius:"8px",border:"1px solid var(--ia-border)"}}>
              <input type="checkbox" checked={skipDup} onChange={e=>setSkipDup(e.target.checked)} style={{accentColor:col}}/>
              {tr("تخطى المكررة")}
            </label>
          </div>

          {errors.length>0&&(
            <div style={{background:"var(--ia-warn-bg)",border:"1px solid var(--ia-warn-bd)",borderRadius:"8px",padding:"10px 14px",color:"var(--ia-warn-tx2)",fontSize:"12px",marginBottom:"12px"}}>
              ⚠️ {errors.join(" | ")}
            </div>
          )}

          {/* Preview table */}
          <div style={{border:"1px solid var(--ia-border)",borderRadius:"10px",overflow:"hidden",marginBottom:"14px",maxHeight:"320px",overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead>
                <tr style={{background:"var(--ia-soft)",borderBottom:"2px solid var(--ia-border2)",position:"sticky",top:0}}>
                  {["#",tr("العميل"),tr("الهاتف"),tr("المنتجات"),tr("المبلغ"),tr("التاريخ"),tr("حالة")].map(h=>(
                    <th key={h} style={{padding:"9px 10px",fontWeight:700,color:"var(--ia-sub)",textAlign:"start",fontSize:"11px"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.map((inv,i) => {
                  const tot = inv.items.reduce((s,it)=>s+it.qty*it.price,0)+inv.shipping;
                  const isDup = existingNums.has(inv.invNum);
                  return (
                    <tr key={i} style={{borderBottom:"1px solid var(--ia-border3)",background:isDup?"var(--ia-warn-bg)":i%2===0?"var(--ia-card)":"var(--ia-row-alt)",opacity:isDup&&skipDup?.7:1}}>
                      <td style={{padding:"8px 10px",fontWeight:700,color:colTx}}>{inv.invNum}</td>
                      <td style={{padding:"8px 10px",fontWeight:600}}>{inv.clientName}</td>
                      <td style={{padding:"8px 10px",direction:"ltr",textAlign:"start",color:"var(--ia-link)"}}>{inv.clientPhone||"—"}</td>
                      <td style={{padding:"8px 10px",color:"var(--ia-sub)",maxWidth:"140px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inv.items.map(it=>it.name).join("، ")}</td>
                      <td style={{padding:"8px 10px",fontWeight:700}}>{fKWD(tot)}</td>
                      <td style={{padding:"8px 10px",color:"var(--ia-sub)"}}>{fDate(inv.date)}</td>
                      <td style={{padding:"8px 10px"}}>
                        {isDup
                          ? <span style={{background:"var(--ia-warn-bg)",color:"var(--ia-warn-tx)",borderRadius:"20px",padding:"2px 8px",fontSize:"10px",fontWeight:700}}>{tr("مكرر")}</span>
                          : <span style={{background:"var(--ia-ok-bg)",color:"var(--ia-ok-tx)",borderRadius:"20px",padding:"2px 8px",fontSize:"10px",fontWeight:700}}>{tr("جديد")}</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{display:"flex",gap:"8px"}}>
            <button
              style={{flex:1,background:toImport.length===0?"var(--ia-ghost-bg)":col,color:toImport.length===0?"var(--ia-muted)":"#fff",border:"none",borderRadius:"9px",padding:"12px",fontFamily:"inherit",fontSize:"14px",fontWeight:700,cursor:toImport.length===0?"not-allowed":"pointer",transition:"all .2s"}}
              onClick={doImport}
              disabled={importing||toImport.length===0}
            >
              {importing?tr("⏳ جارٍ الاستيراد..."):tr("💾 استيراد {0} فاتورة",[toImport.length])}
            </button>
            <button style={{background:"var(--ia-ghost-bg)",color:"var(--ia-ghost-tx)",border:"none",borderRadius:"9px",padding:"12px 18px",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}} onClick={()=>setStep(0)}>{tr("← رجوع")}</button>
          </div>
        </div>
      )}

      {/* STEP 2 — Done */}
      {step===2&&(
        <div style={{textAlign:"center",padding:"32px 20px"}}>
          <div style={{fontSize:"64px",marginBottom:"12px"}}>✅</div>
          <div style={{fontSize:"20px",fontWeight:900,color:"var(--ia-text)",marginBottom:"8px"}}>{tr("تم الاستيراد بنجاح!")}</div>
          <div style={{fontSize:"14px",color:"var(--ia-sub)",marginBottom:"24px"}}>
            {tr("تم إضافة")} <span style={{fontWeight:900,color:colTx,fontSize:"18px"}}>{importedCount}</span> {tr("فاتورة من الملف")}
            {dupCount>0&&skipDup&&<div style={{marginTop:"4px",color:"var(--ia-warn-tx)",fontSize:"12px"}}>{tr("تم تخطى")} {dupCount} {tr("فاتورة مكررة")}</div>}
          </div>
          <button style={{background:col,color:"#fff",border:"none",borderRadius:"9px",padding:"12px 32px",fontFamily:"inherit",fontSize:"14px",fontWeight:700,cursor:"pointer"}} onClick={onClose}>
            {tr("عرض الفواتير ←")}
          </button>
        </div>
      )}
    </div>
  </div>
</div>

);
}

// ─── Logo helper ──────────────────────────────────────────────────
function getLogoImg(companyId){try{return localStorage.getItem(`tw_logo_${companyId}`)||null;}catch{return null;}}

// ─── Print ────────────────────────────────────────────────────────
// Three print/PDF template styles:
//  classic — the original design (dark headers, bordered boxes)
//  modern  — company-colored accents (gradient bar, tinted table, filled badges)
//  minimal — ink-saver black & white (thin lines, no fills)
const PRINT_STYLES = {
  classic: {
    id: "classic", label: "كلاسيكي", icon: "🏛️",
    headerBorder: "3px double #111827", titleColor: "#111827", titleWeight: "900",
    boxBorder: "1.5px solid #d1d5db", radius: "8px", amountBg: "#f9fafb",
    theadBg: "#111827", theadColor: "#fff", theadBorder: "1px solid rgba(255,255,255,.12)",
    zebra: i => (i % 2 === 1 ? "#f9fafb" : "#fff"), rowBorder: "#e5e7eb",
    totalBg: "#111827", totalColor: "#fff", totalTopBorder: "2px solid #111827",
    statusBadge: (stC, stT) => `border:2px solid ${stC};color:${stC};background:transparent`,
    topBar: null, amountColor: null,
  },
  modern: {
    id: "modern", label: "عصري", icon: "🎨",
    headerBorder: "none", titleColor: null, titleWeight: "900",
    boxBorder: "1.5px solid", radius: "10px", amountBg: null,
    theadBg: null, theadColor: "#fff", theadBorder: "1px solid rgba(255,255,255,.18)",
    zebra: i => (i % 2 === 1 ? "" : ""), rowBorder: null,
    totalBg: null, totalColor: "#fff", totalTopBorder: "2px solid",
    statusBadge: (stC, stT) => `border:2px solid ${stC};color:#fff;background:${stC}`,
    topBar: true, amountColor: true,
  },
  minimal: {
    id: "minimal", label: "بسيط", icon: "📄",
    headerBorder: "2px solid #000", titleColor: "#000", titleWeight: "800",
    boxBorder: "1px solid #999", radius: "0px", amountBg: "#fff",
    theadBg: "#fff", theadColor: "#000", theadBorder: "1px solid #000",
    zebra: i => "#fff", rowBorder: "#ddd",
    totalBg: "#fff", totalColor: "#000", totalTopBorder: "2px double #000",
    statusBadge: (stC, stT) => `border:1.5px solid #111;color:#111;background:transparent`,
    topBar: null, amountColor: false,
  },
};

function buildHTML(invList, company, styleId){
const c = company;
const S = PRINT_STYLES[styleId] || PRINT_STYLES.classic;
// modern/minimal style accent colors resolve at build time
const acc = S.id === "modern" ? (c.color || "#1e3a5f") : "#111827";
const boxBorder = S.id === "modern" ? `1.5px solid ${acc}40` : S.boxBorder;
const amountBg = S.id === "modern" ? `${acc}0d` : S.amountBg;
const theadBg = S.id === "modern" ? `linear-gradient(135deg,${acc},${lightenHex(acc,.18)})` : S.theadBg;
const theadBgStyle = S.id === "modern" ? `background:${theadBg}` : `background:${S.theadBg}`;
const rowBorder = S.id === "modern" ? `${acc}1f` : S.rowBorder;
const zebraOf = S.id === "modern" ? (i => (i % 2 === 1 ? `${acc}08` : "#fff")) : S.zebra;
const totalBgStyle = S.id === "modern" ? `background:${acc}` : `background:${S.totalBg}`;
const totalTopBorder = S.id === "modern" ? `2px solid ${acc}` : S.totalTopBorder;
const titleColor = S.titleColor || (S.id === "modern" ? acc : "#111827");
const logoImg=getLogoImg(c.id);
const logoBlock=logoImg
  ?`<img src="${logoImg}" style="width:80px;height:80px;object-fit:contain;border-radius:6px;border:1.5px solid #e5e7eb;background:#fff;flex-shrink:0;"/>`
  :`<div style="width:80px;height:80px;background:${S.id==="minimal"?"#fff":acc};color:${S.id==="minimal"?"#111":"#fff"};border-radius:6px;${S.id==="minimal"?"border:2px solid #111;":""}display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:22px;text-align:center;flex-shrink:0;line-height:1.2;font-weight:900;">${c.logo}<span style="font-size:8px;font-weight:700;opacity:.75;margin-top:2px;letter-spacing:1.5px;">${c.id.toUpperCase()}</span></div>`;

const pages = invList.map(inv => {
const sub=inv.items.reduce((s,it)=>s+pN(it.qty)*pN(it.price),0);
const taxR=pN(inv.taxRate||0);const tax=+(sub*taxR/100).toFixed(2);
const ship=pN(inv.shipping||0);const tot=sub+tax+ship;const paid=pN(inv.paid||0);
const due=tot-paid;
const isCancelled=inv.status==='cancelled';
const stC=isCancelled?"#6b7280":due<=0?"#16a34a":paid>0?"#b45309":"#dc2626";
const stT=isCancelled?tr("ملغية"):due<=0?tr("مدفوعة"):paid>0?tr("مدفوعة جزئياً"):tr("غير مدفوعة");
const empty=Math.max(0,5-inv.items.length);
const itemRows=inv.items.map((it,i)=>`
<tr style="background:${zebraOf(i)};border-bottom:1px solid ${rowBorder};">
  <td style="padding:9px 8px;text-align:center;color:#9ca3af;font-size:11px;border-left:1px solid ${rowBorder};">${i+1}</td>
  <td style="padding:9px 12px;font-weight:600;color:#111;">${it.name||""}</td>
  <td style="padding:9px 12px;color:#6b7280;font-size:11.5px;">${it.desc||""}</td>
  <td style="padding:9px 10px;text-align:center;font-weight:600;border-right:1px solid ${rowBorder};border-left:1px solid ${rowBorder};">${it.qty}</td>
  <td style="padding:9px 12px;text-align:left;direction:ltr;border-left:1px solid ${rowBorder};">${fKWD(it.price)}</td>
  <td style="padding:9px 12px;text-align:left;font-weight:700;direction:ltr;">${fKWD(pN(it.qty)*pN(it.price))}</td>
</tr>`).join("");
const emptyRows=Array.from({length:empty}).map(()=>`<tr style="border-bottom:1px solid #f0f0f0;"><td colspan="6" style="height:32px;"></td></tr>`).join("");
return tr("<div class=\"page\">\n{0}\n{1}\n<div style=\"position:relative;z-index:1;\">\n\n<div style=\"display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:{2};border-bottom:{3};{4}margin-bottom:16px;{5}\">\n  <div style=\"display:flex;align-items:flex-start;gap:14px;\">\n    {6}\n    <div>\n      <div style=\"font-size:18px;font-weight:900;color:{7};margin-bottom:4px;letter-spacing:-.3px;\">{8}</div>\n      <div style=\"font-size:10px;color:#6b7280;line-height:2.1;\">{9}<br/>{10} — {11}<br/><span style=\"direction:ltr;display:inline-block;\">{12}</span> &nbsp;|&nbsp; {13}</div>\n    </div>\n  </div>\n  <div style=\"text-align:left;\">\n    <div style=\"font-size:32px;font-weight:{14};color:{15};letter-spacing:-2px;line-height:1;margin-bottom:4px;\">فـاتـورة</div>\n    <div style=\"font-size:11px;color:#6b7280;font-weight:600;direction:ltr;margin-bottom:8px;\"># {16}</div>\n    <div style=\"display:inline-block;{17};border-radius:{18};padding:3px 14px;font-size:11px;font-weight:800;letter-spacing:.5px;\">{19}</div>\n  </div>\n</div>\n\n<div style=\"display:grid;grid-template-columns:1.9fr 1fr 1fr;border:{20};border-radius:{21};overflow:hidden;margin-bottom:16px;\">\n  <div style=\"padding:12px 16px;border-left:{22};\">\n    <div style=\"font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;\">صادرة إلى</div>\n    <div style=\"font-size:15px;font-weight:800;color:#111;margin-bottom:3px;\">{23}</div>\n    <div style=\"font-size:12.5px;font-weight:700;direction:ltr;text-align:start;color:#374151;margin-bottom:2px;\">{24}</div>\n    {25}\n  </div>\n  <div style=\"padding:12px 14px;border-left:{26};\">\n    <div style=\"font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;\">تاريخ الإصدار</div>\n    <div style=\"font-size:13px;font-weight:700;color:#111;margin-bottom:10px;\">{27}</div>\n    <div style=\"font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;\">تاريخ الاستحقاق</div>\n    <div style=\"font-size:13px;font-weight:700;color:#111;\">{28}</div>\n  </div>\n  <div style=\"padding:12px 14px;background:{29};\">\n    <div style=\"font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;\">المبلغ المستحق</div>\n    <div style=\"font-size:21px;font-weight:900;color:{30};direction:ltr;text-align:start;line-height:1.1;margin-bottom:10px;\">{31}</div>\n    <div style=\"font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;\">المسؤول</div>\n    <div style=\"font-size:12px;font-weight:700;color:#374151;\">{32}</div>\n  </div>\n</div>\n\n<table style=\"width:100%;border-collapse:collapse;border:{33};border-radius:{34};overflow:hidden;margin-bottom:14px;\">\n  <thead>\n    <tr style=\"{35};color:{36};{37}\">\n      <th style=\"padding:10px 8px;width:30px;text-align:center;font-size:10.5px;font-weight:700;border-left:{38};\">#</th>\n      <th style=\"padding:10px 14px;text-align:start;font-size:11px;font-weight:700;\">المنتج / الخدمة</th>\n      <th style=\"padding:10px 12px;text-align:start;font-size:11px;font-weight:700;\">الوصف</th>\n      <th style=\"padding:10px 10px;text-align:center;font-size:11px;font-weight:700;width:52px;border-left:{39};border-right:{40};\">الكمية</th>\n      <th style=\"padding:10px 12px;text-align:left;font-size:11px;font-weight:700;width:94px;border-left:{41};\">سعر الوحدة</th>\n      <th style=\"padding:10px 12px;text-align:left;font-size:11px;font-weight:700;width:94px;\">الإجمالي</th>\n    </tr>\n  </thead>\n  <tbody>{42}{43}</tbody>\n</table>\n\n<div style=\"display:flex;justify-content:flex-end;margin-bottom:14px;\">\n  <table style=\"min-width:260px;border-collapse:collapse;border:{44};border-radius:{45};overflow:hidden;\">\n    <tr style=\"border-bottom:1px solid {46};\"><td style=\"padding:7px 16px;color:#6b7280;font-size:12.5px;\">المجموع الجزئي</td><td style=\"padding:7px 16px;text-align:left;font-size:12.5px;font-weight:600;direction:ltr;\">{47}</td></tr>\n    {48}\n    {49}\n    <tr style=\"{50};color:{51};\"><td style=\"padding:10px 16px;font-size:13.5px;font-weight:800;\">إجمالي الفاتورة</td><td style=\"padding:10px 16px;text-align:left;font-size:13.5px;font-weight:900;direction:ltr;\">{52}</td></tr>\n    <tr style=\"border-bottom:1px solid {53};\"><td style=\"padding:7px 16px;font-size:12.5px;color:#374151;\">المدفوع</td><td style=\"padding:7px 16px;text-align:left;font-size:12.5px;font-weight:700;direction:ltr;\">{54}</td></tr>\n    <tr style=\"border-top:{55};\"><td style=\"padding:10px 16px;font-size:13.5px;font-weight:800;color:{56};\">{57}</td><td style=\"padding:10px 16px;text-align:left;font-size:14px;font-weight:900;color:{58};direction:ltr;\">{59}</td></tr>\n  </table>\n</div>\n\n{60}\n\n{61}\n\n<div style=\"padding-top:10px;border-top:{62};display:flex;justify-content:space-between;align-items:center;\">\n  <div style=\"font-size:9.5px;color:#9ca3af;font-weight:600;\">الشركة القابضة المتحدة ذ.م.م &nbsp;—&nbsp; United Holding Group LLC</div>\n  <div style=\"font-size:10.5px;font-weight:800;color:{63};\">{64} &nbsp;|&nbsp; {65}</div>\n</div>\n\n</div></div>",[isCancelled?tr(`<div class="watermark">ملغية</div>`):"",S.topBar?`<div style="height:7px;background:linear-gradient(90deg,${acc},${lightenHex(acc,.25)});border-radius:4px;margin-bottom:12px;"></div>`:"",S.id==="modern"?"0":"14px",S.headerBorder,S.id==="modern"?"border-bottom:none;":"",S.id==="modern"?"border-bottom:2px solid "+acc+";padding-bottom:12px;":"",logoBlock,titleColor,c.name,companyName(c),c.address,c.city,c.phone,c.email,S.titleWeight,titleColor,inv.invNum,S.statusBadge(stC,stT),S.id==="modern"?"20px":"4px",stT,boxBorder,S.radius,S.id==="minimal"?"1px solid #999":S.id==="modern"?`1.5px solid ${acc}30`:"1.5px solid #d1d5db",inv.clientName||"—",inv.clientPhone||"",inv.clientAddress?`<div style="font-size:11px;color:#6b7280;margin-top:2px;">${inv.clientAddress}</div>`:"",S.id==="minimal"?"1px solid #999":S.id==="modern"?`1.5px solid ${acc}30`:"1.5px solid #d1d5db",fDate(inv.date),fDate(inv.dueDate),amountBg,S.amountColor===true?(due<=0?"#16a34a":acc):(S.amountColor===false?"#111":stC),isCancelled?"—":fKWD(due),c.manager,boxBorder,S.radius,theadBgStyle,S.theadColor,S.id==="minimal"?"border-bottom:2px solid #000;":"",S.id==="minimal"?"1px solid #ddd":"1px solid "+S.theadBorder,S.id==="minimal"?"1px solid #ddd":"1px solid "+S.theadBorder,S.id==="minimal"?"1px solid #ddd":"1px solid "+S.theadBorder,S.id==="minimal"?"1px solid #ddd":"1px solid "+S.theadBorder,itemRows,emptyRows,boxBorder,S.id==="minimal"?"0px":"6px",rowBorder,fKWD(sub),tax>0?tr("<tr style=\"border-bottom:1px solid {0};\"><td style=\"padding:7px 16px;color:#6b7280;font-size:12.5px;\">الضريبة ({1}%)</td><td style=\"padding:7px 16px;text-align:left;font-size:12.5px;font-weight:600;direction:ltr;\">{2}</td></tr>",[rowBorder,taxR,fKWD(tax)]):"",ship>0?tr("<tr style=\"border-bottom:1px solid {0};\"><td style=\"padding:7px 16px;color:#6b7280;font-size:12.5px;\">التوصيل</td><td style=\"padding:7px 16px;text-align:left;font-size:12.5px;font-weight:600;direction:ltr;\">{1}</td></tr>",[rowBorder,fKWD(ship)]):"",totalBgStyle,S.totalColor,fKWD(tot),rowBorder,fKWD(paid),totalTopBorder,stC,isCancelled?tr("الحالة"):tr("المبلغ المستحق"),stC,isCancelled?stT:fKWD(due),(inv._pays&&inv._pays.length)?tr("\n<div style=\"display:flex;justify-content:flex-end;margin-bottom:14px;\">\n  <table style=\"min-width:320px;border-collapse:collapse;border:{0};border-radius:{1};overflow:hidden;\">\n    <thead><tr style=\"background:{2};border-bottom:{3};\">\n      <th colspan=\"4\" style=\"padding:8px 14px;text-align:start;font-size:10.5px;font-weight:800;color:{4};letter-spacing:.5px;\">💳 سجل الدفعات ({5})</th>\n    </tr></thead>\n    <tbody>\n      {6}\n    </tbody>\n  </table>\n</div>",[boxBorder,S.id==="minimal"?"0px":"6px",S.id==="minimal"?"#fff":S.id==="modern"?`${acc}12`:"#f3f4f6",S.id==="minimal"?"2px solid #000":"1.5px solid "+(S.id==="modern"?acc+"40":"#d1d5db"),S.id==="modern"?acc:"#374151",inv._pays.length,inv._pays.map(p=>`<tr style="border-bottom:1px solid ${S.id==="minimal"?"#eee":"#f0f0f0"};">
        <td style="padding:6px 14px;color:#6b7280;font-size:11.5px;">${fDate(p.date)}</td>
        <td style="padding:6px 14px;font-weight:700;color:#16a34a;font-size:11.5px;direction:ltr;text-align:left;">${fKWD(p.amount)}</td>
        <td style="padding:6px 14px;"><span style="background:${S.id==="minimal"?"transparent":"#dcfce7"};color:${S.id==="minimal"?"#15803d":"#15803d"};${S.id==="minimal"?"border:1px solid #999;":""}border-radius:4px;padding:1px 8px;font-size:10.5px;font-weight:700;">${tr(payMethodLabel[p.method]||p.method||"—")}</span></td>
        <td style="padding:6px 14px;color:#9ca3af;font-size:10.5px;">${p.note||""}</td>
      </tr>`).join("")]):"",inv.notes?tr("<div style=\"border:{0};border-radius:{1};padding:10px 14px;margin-bottom:12px;background:{2};{3}\"><div style=\"font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;\">ملاحظات</div><div style=\"font-size:12px;color:#374151;line-height:1.75;\">{4}</div></div>",[boxBorder,S.id==="minimal"?"0px":"6px",S.id==="modern"?`${acc}08`:"#f9fafb",S.id==="minimal"?"background:#fff;":"",inv.notes]):"",S.id==="minimal"?"1px solid #999":"1.5px solid #d1d5db",S.id==="modern"?acc:"#374151",c.nameAr,c.phone]);
});
const printDocTitle=invList.length===1?tr("فاتورة {0} — {1}",[invList[0].invNum||invList[0].invoiceNumber||invList[0].id,companyName(c)]):tr("فواتير ({0}) — {1}",[invList.length,companyName(c)]);
return `<!DOCTYPE html><html lang="${appLang()}" dir="${appDir()}"><head><meta charset="utf-8"><title>${printDocTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;background:#fff}
body{font-family:'Tajawal','Cairo',Arial,sans-serif;direction:rtl;color:#1a1a2e;font-size:13px}
.page{padding:10mm;page-break-after:always;page-break-inside:avoid;width:100%;position:relative;overflow:hidden}
.page:last-child{page-break-after:auto}
.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-28deg);font-size:80px;font-weight:900;color:rgba(0,0,0,.055);letter-spacing:6px;pointer-events:none;z-index:0;white-space:nowrap;font-family:'Tajawal',sans-serif}
@page{size:A4;margin:6mm}
@media print{
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{width:100%!important;overflow:visible!important}
  .page{padding:8mm!important;page-break-after:always;page-break-inside:avoid}
  .page:last-child{page-break-after:auto}
}
</style></head><body>${pages.join("")}</body></html>`;
}

// lightenHex: lighten a hex color by t (0..1) toward white — print-template helper
function lightenHex(hex,t){
const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex||""));
if(!m)return hex;
const r=Math.round(parseInt(m[1],16)+(255-parseInt(m[1],16))*t);
const g=Math.round(parseInt(m[2],16)+(255-parseInt(m[2],16))*t);
const b=Math.round(parseInt(m[3],16)+(255-parseInt(m[3],16))*t);
return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

async function doPrint(list, company, styleId){
if(!list.length)return;
const w=window.open("","_blank","width=900,height=700");
if(!w){alert(tr("يرجى السماح بالـ Popups"));return;}
// Enrich each invoice with its payment records so the print view can show them
const enriched=await Promise.all(list.map(async inv=>{
  let pays=[];
  try{ pays=(await api.listPayments(inv.id))||[]; }catch{}
  return {...inv,_pays:pays};
}));
w.document.open();w.document.write(buildHTML(enriched, company, styleId));w.document.close();
setTimeout(()=>{try{w.focus();w.print();}catch(e){}},900);
}

// ─── PDF export (HTML → PDF via /api/pdf, downloads a real .pdf file) ──
async function doPdfExport(list, company, opts){
const {toast, setBusy, styleId}=opts||{};
const t=typeof toast==="function"?toast:()=>{};
if(!list.length)return;
try{
  if(setBusy)setBusy(true);
  // Enrich with payment records so the PDF shows the full payment history
  const enriched=await Promise.all(list.map(async inv=>{
    let pays=[];
    try{ pays=(await api.listPayments(inv.id))||[]; }catch{}
    return {...inv,_pays:pays};
  }));
  const html=buildHTML(enriched, company, styleId);
  const base=list.length===1?tr("فاتورة_{0}",[(list[0].invNum||list[0].id)]):tr("فواتير_{0}",[list.length]);
  const blob=await api.exportPdf(html, base);
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`${base}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  t(list.length===1?tr("✅ تم تصدير الفاتورة إلى PDF"):tr("✅ تم تصدير ")+list.length+tr(" فواتير إلى PDF"));
}catch(e){
  t((e&&e.message)||tr("فشل تصدير PDF"),"err");
}finally{
  if(setBusy)setBusy(false);
}
}

// ─── Bulk parser ──────────────────────────────────────────────────
function parseBulk(text){
return text.split(/\n\s*\n/).map(b=>b.trim()).filter(b=>b.length>5).map(block=>{
const g=pats=>{for(const p of pats){const m=block.match(p);if(m)return m[1].trim();}return"";};
const nameR=g([/📍[^:\n]*[: ]\s*([^\n]+)/,/الاسم[^:\n]*[:]\s*([^\n]+)/]);
const phoneR=g([/📞[^:\n]*[: ]\s*([^\n]+)/,/الهاتف[^:\n]*[:]\s*([^\n]+)/]);
const addr=g([/🏠[^:\n]*[: ]\s*([^\n]+)/,/العنوان[^:\n]*[:]\s*([^\n]+)/]);
const prod=g([/🛠️[^:\n]*[: ]\s*([^\n]+)/,/الطلب[^:\n]*[:]\s*([^\n]+)/]);
const priceR=g([/💰[^:\n]*[: ]\s*([^\n]+)/,/السعر[^:\n]*[:]\s*([^\n]+)/]);
const delR=g([/🚚[^:\n]*[: ]\s*([^\n]+)/,/التوصيل[^:\n]*[:]\s*([^\n]+)/]);
const phone=norm(phoneR);
const free=delR.includes(tr("مجاني"))||delR.toLowerCase().includes("free");
return{clientName:nameR||phone||tr("عميل"),clientPhone:phone,clientAddress:addr,
items:[{name:prod||tr("منتج"),desc:"",qty:1,price:pN(priceR)}],
shipping:free?0:pN(delR),date:today(),dueDate:addD(today(),30),paid:0,notes:""};
});
}

// ─── CSV Export (no external library) ─────────────────────────────
function toCSV(headers, rows) {
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.map(esc).join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\r\n");
}
function downloadCSV(csv, filename) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
// Parse ONE CSV line honoring double-quoted fields ("" escapes a quote)
function parseCSVLine(line) {
  const out = []; let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}
// Build client rows from a header array + data-row arrays (shared by CSV + Excel import)
// r23: البحث يشمل العربية الخام + الإنجليزية معاً — الاستيراد يعمل بأي لغة واجهة
function buildClientsRows(headers, dataRows) {
  const find = (...names) => headers.findIndex(h => names.some(n => h === n || h.includes(n)));
  const iName = find("الاسم", tr("الاسم"), "name");
  const iPhone = find("التلفون", "الهاتف", "الجوال", tr("التلفون"), "phone", "mobile");
  const iEmail = find("الايميل", "البريد", tr("البريد"), "email");
  const iAddr = find("العنوان", "المنطقة", tr("العنوان"), "address");
  // r23: الدولة + المحافظة (تقبل العربية/الإنجليزية/كود ISO)
  const iCountry = find("الدولة", "البلد", "بلد", tr("الدولة"), "country");
  const iGov = find("المحافظة", "المقاطعة", "الولاية", tr("المحافظة / المقاطعة"), "governorate", "state", "province", "region");
  if (iName < 0 || iPhone < 0) return { rows: [], errors: [tr("الأعمدة المطلوبة: الاسم + التلفون")] };
  const rows = [], errors = [];
  dataRows.forEach((cells, i) => {
    const name = String(cells[iName] ?? "").trim();
    const phone = norm(String(cells[iPhone] ?? ""));
    if (!name && !phone) return;
    if (!phone) { errors.push(tr("سطر {0}: بدون تلفون — تم تخطيه",[i + 2])); return; }
    rows.push({
      name: name || phone,
      phone,
      email: iEmail >= 0 ? String(cells[iEmail] ?? "").trim() || null : null,
      address: iAddr >= 0 ? String(cells[iAddr] ?? "").trim() || null : null,
      country: iCountry >= 0 ? countryCodeOf(cells[iCountry]) : null,
      governorate: iGov >= 0 ? String(cells[iGov] ?? "").trim() || null : null,
    });
  });
  return { rows, errors };
}
// Parse a clients CSV: flexible Arabic/English headers, returns {rows, errors}
function parseClientsCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], errors: [tr("الملف فارغ أو غير صحيح")] };
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const dataRows = lines.slice(1).filter(l => l.trim()).map(l => parseCSVLine(l));
  return buildClientsRows(headers, dataRows);
}
// Parse a clients Excel (.xlsx / .xls): first sheet, same flexible headers
function parseClientsExcel(buffer) {
  let wb;
  try { wb = XLSX.read(buffer, { type: "array" }); }
  catch { return { rows: [], errors: [tr("تعذر قراءة ملف Excel — تأكد أنه بصيغة .xlsx أو .xls")] }; }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [tr("ملف Excel فارغ")] };
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "", raw: false });
  if (aoa.length < 2) return { rows: [], errors: [tr("الملف فارغ أو غير صحيح")] };
  const headers = aoa[0].map(h => String(h ?? "").toLowerCase());
  const dataRows = aoa.slice(1).filter(r => r.some(c => String(c ?? "").trim() !== ""));
  return buildClientsRows(headers, dataRows);
}
function exportMetaAudience(invoices){
const map={};
[...invoices].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)).forEach(inv=>{
const ph=inv.clientPhone||"";if(!ph)return;
if(!map[ph]){map[ph]={phone:ph,name:inv.clientName||"",address:inv.clientAddress||"",totalSpent:0,invoiceCount:0,lastDate:inv.date,email:""};}
map[ph].totalSpent+=iT(inv);map[ph].invoiceCount+=1;
if(inv.date>map[ph].lastDate)map[ph].lastDate=inv.date;
});
const rows=Object.values(map);
// Sheet 1 – Meta Audience format
const metaHeaders=["phone","email","fn","ln","country","ct"];
const metaRows=rows.map(r=>({
  phone:"+965"+r.phone.replace(/^\+?965/,""),email:r.email||"",
  fn:r.name.split(" ")[0]||"",ln:r.name.split(" ").slice(1).join(" ")||"",
  country:"KW",ct:"Kuwait",
}));
// Sheet 2 – Full customer data
const fullHeaders=[tr("رقم الهاتف"),tr("الاسم"),tr("العنوان"),tr("إجمالي المشتريات"),tr("عدد الفواتير"),tr("آخر شراء"),tr("للميتا (هاتف)")];
const fullRows=rows.map(r=>({
  "رقم الهاتف":r.phone,"الاسم":r.name,"العنوان":r.address,
  "إجمالي المشتريات":r.totalSpent.toFixed(3),"عدد الفواتير":r.invoiceCount,
  "آخر شراء":fDate(r.lastDate),"للميتا (هاتف)":"+965"+r.phone.replace(/^\+?965/,""),
}));
downloadCSV(toCSV(metaHeaders, metaRows), `Meta_Audience_${today()}.csv`);
setTimeout(()=>downloadCSV(toCSV(fullHeaders, fullRows), `Customers_${today()}.csv`), 300);
}

// ─── Company Selector ─────────────────────────────────────────────
function CompanySelector({ onSelect, companies, onAdd, onEdit }) {
const { profile, isAdmin } = useAuth();
const { dark, toggle } = useTheme();
// r16: السقوط للشركات الافتراضية للمدير فقط — المشترك بلا شركات يُوجّه لإنشاء شركته
const isSubscriber = profile?.role === "subscriber";
const cols = companies && companies.length > 0 ? companies : (isAdmin ? Object.values(COMPANIES) : []);
const gridCols = cols.length === 1 ? "repeat(1,1fr)" : cols.length === 2 ? "repeat(2,1fr)" : "repeat(2,1fr)";
const canAdd = isAdmin || isSubscriber; // r16: المشترك ينشئ شركته الخاصة
return (
<div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cairo','Tajawal',sans-serif",direction:appDir(),padding:"20px",position:"relative",overflow:"hidden"}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap'); *{box-sizing:border-box} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}} @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}} .co-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px 20px;cursor:pointer;transition:all .3s cubic-bezier(.4,0,.2,1);text-align:center;animation:fadeUp .5s ease both;position:relative;overflow:hidden;} .co-card::before{content:"";position:absolute;inset:0;opacity:0;transition:opacity .3s;background:radial-gradient(circle at 50% 0%,var(--co-color) 0%,transparent 70%);} .co-card:hover,.co-card:active{transform:translateY(-4px) scale(1.02);border-color:var(--co-color);box-shadow:0 20px 60px rgba(0,0,0,.5),0 0 0 1px var(--co-color)} .co-card:hover::before,.co-card:active::before{opacity:.15} .co-icon{font-size:40px;margin-bottom:12px;display:block;animation:float 3s ease-in-out infinite} .co-grid{display:grid;gap:14px} .co-edit{position:absolute;top:10px;insetInlineEnd:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:8px;color:rgba(255,255,255,.75);padding:4px 9px;font-size:12px;cursor:pointer;font-family:inherit;opacity:0;transition:all .2s;z-index:2} .co-card:hover .co-edit{opacity:1} .co-edit:hover{background:rgba(255,255,255,.18);color:#fff} .co-add{border:2px dashed rgba(255,255,255,.15);background:rgba(255,255,255,.02);border-radius:20px;padding:28px 20px;cursor:pointer;text-align:center;animation:fadeUp .5s ease both;transition:all .25s;color:rgba(255,255,255,.4)} .co-add:hover{border-color:#10b981;color:#10b981;background:rgba(16,185,129,.06);transform:translateY(-4px)} @media(min-width:600px){.co-grid{grid-template-columns:repeat(4,1fr)}}`}</style>
<div style={{position:"fixed",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none"}}/>
<button onClick={toggle} title={dark?tr("التبديل إلى الوضع النهاري"):tr("التبديل إلى الوضع الليلي")} aria-label={tr("تبديل السمة")} style={{position:"fixed",top:"16px",insetInlineEnd:"16px",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"8px",padding:"7px 12px",fontSize:"14px",cursor:"pointer",zIndex:10,transition:"all .2s"}}>{dark?"☀️":"🌙"}</button>
<div style={{width:"100%",maxWidth:"900px",animation:"fadeUp .4s"}}>
<div style={{textAlign:"center",marginBottom:"36px"}}>
<div style={{fontSize:"12px",fontWeight:700,letterSpacing:"3px",textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:"12px"}}>{tr("نظام إدارة الفواتير")}</div>
<div style={{fontSize:"28px",fontWeight:900,color:"#fff",lineHeight:1.2,marginBottom:"8px",background:"linear-gradient(135deg,#fff 0%,rgba(255,255,255,.6) 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{tr("اختر الشركة")}</div>
<div style={{color:"rgba(255,255,255,.35)",fontSize:"12px"}}>
  {profile?.displayName ? tr("مرحباً {0} — ",[profile.displayName]) : ""}
  {cols.length} {tr("شركة متاحة لك")}
</div>
</div>
{cols.length === 0 ? (
  canAdd ? (
    <div style={{textAlign:"center",padding:"40px 20px",color:"rgba(255,255,255,.55)",animation:"fadeUp .5s ease"}}>
      <div style={{fontSize:"44px",marginBottom:"14px"}}>🚀</div>
      <div style={{fontSize:"19px",fontWeight:900,color:"#fff",marginBottom:"8px"}}>{isSubscriber?tr("أنشئ شركتك الأولى وابدإ الفواتير"):tr("أضف شركتك الأولى")}</div>
      <div style={{fontSize:"12.5px",lineHeight:1.9,marginBottom:"22px",maxWidth:380,marginInline:"auto"}}>
        {isSubscriber
          ? tr("شركة واحدة خاصة بك: فواتير وعملاء وتقارير ومساعد ذكي — كاملة مجاناً ضمن أول 100 مشترك.")
          : tr("بيانات كاملة + العملة من شاشة واحدة.")}
      </div>
      <button onClick={()=>onAdd&&onAdd()} style={{background:"linear-gradient(135deg,#10b981,#059669)",border:"none",borderRadius:"12px",padding:"14px 34px",color:"#fff",fontFamily:"inherit",fontSize:"15px",fontWeight:800,cursor:"pointer",boxShadow:"0 8px 26px rgba(16,185,129,.35)"}}>{tr("＋ إنشاء شركتي الآن")}</button>
    </div>
  ) : (
  <div style={{textAlign:"center",padding:"48px",color:"rgba(255,255,255,.4)"}}>
    <div style={{fontSize:"40px",marginBottom:"12px"}}>🔒</div>
    <div style={{fontSize:"16px",fontWeight:700}}>{tr("لا توجد شركات مخصصة لحسابك")}</div>
    <div style={{fontSize:"12px",marginTop:"8px"}}>{tr("تواصل مع المدير لإضافة صلاحيات")}</div>
  </div>
  )
) : (
  <div className="co-grid" style={{gridTemplateColumns:gridCols}}>
  {cols.map((co, i) => (
  <div key={co.id} className="co-card" style={{"--co-color":co.color,animationDelay:`${i*0.1}s`}} onClick={() => onSelect(co)}>
  {isAdmin&&onEdit&&<button className="co-edit" title={tr("تعديل بيانات الشركة")} onClick={e=>{e.stopPropagation();onEdit(co);}}>{tr("✏️ تعديل")}</button>}
  <span className="co-icon" style={{animationDelay:`${i*0.5}s`}}>{co.logo}</span>
  <div style={{fontSize:"16px",fontWeight:900,color:"#fff",marginBottom:"6px"}}>{companyName(co)}</div>
  <div style={{fontSize:"11px",color:"rgba(255,255,255,.4)",marginBottom:"12px",direction:"ltr"}}>{co.name}</div>
  <div style={{display:"inline-flex",alignItems:"center",gap:"6px",background:`${co.color}22`,border:`1px solid ${co.color}44`,borderRadius:"20px",padding:"5px 14px"}}>
  <div style={{width:"6px",height:"6px",borderRadius:"50%",background:co.color,flexShrink:0}}/>
  <span style={{fontSize:"11px",color:co.color,fontWeight:700,direction:"ltr"}}>{co.phone}</span>
  </div>
  <div style={{marginTop:"10px",display:"flex",gap:"6px",justifyContent:"center"}}>
  <span style={{fontSize:"10.5px",fontWeight:800,color:"rgba(255,255,255,.55)",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:"20px",padding:"3px 10px",direction:"ltr"}}>{(CURRENCIES[co.currency]||CURRENCIES.KWD).flag} {(CURRENCIES[co.currency]||CURRENCIES.KWD).code}</span>
  </div>
  <div style={{marginTop:"10px",padding:"8px",borderRadius:"8px",background:"rgba(255,255,255,.04)",fontSize:"11px",color:"rgba(255,255,255,.3)"}}>{co.email}</div>
  </div>
  ))}
  {canAdd&&onAdd&&(
  <div className="co-add" style={{animationDelay:`${cols.length*0.1}s`}} onClick={()=>onAdd()} role="button" aria-label={tr("إضافة شركة جديدة")}>
  <div style={{fontSize:34,marginBottom:10,lineHeight:1}}>＋</div>
  <div style={{fontSize:14,fontWeight:900,marginBottom:4,color:"inherit"}}>{tr("إضافة شركة جديدة")}</div>
  <div style={{fontSize:11,lineHeight:1.6}}>{tr("بيانات كاملة + العملة")}<br/>{tr("من شاشة واحدة")}</div>
  </div>
  )}
  </div>
)}
<div style={{textAlign:"center",marginTop:"32px",display:"flex",alignItems:"center",justifyContent:"center",gap:"12px"}}>
  <span style={{color:"rgba(255,255,255,.15)",fontSize:"11px"}}>Invoice System v3.0 • Multi-Company</span>
  {isAdmin && (
    <button onClick={async()=>{await logoutUser();}} style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"6px",padding:"4px 12px",color:"rgba(255,255,255,.4)",fontFamily:"inherit",fontSize:"11px",cursor:"pointer"}}>{tr("خروج")}</button>
  )}
</div>
</div>
</div>
);
}

// ─── Invoice Preview ──────────────────────────────────────────────
function InvPreview({inv, company}){
const c = company;
const sub=inv.items.reduce((s,it)=>s+pN(it.qty)*pN(it.price),0);
const taxR=pN(inv.taxRate||0);const tax=+(sub*taxR/100).toFixed(2);
const ship=pN(inv.shipping||0);const tot=sub+tax+ship;const paid=pN(inv.paid||0);
const due=tot-paid;
const isCancelled=inv.status==='cancelled';
const stC=stColor[getStatus(inv)];
const stT=tr(stLabel[getStatus(inv)]);
const empty=Math.max(0,5-inv.items.length);
const logoImg=getLogoImg(c.id);
const TH={background:c.color,color:"#fff",padding:"9px 10px",fontSize:"11.5px",fontWeight:700,textAlign:"start"};
const TD={padding:"9px 10px",fontSize:"12px",borderBottom:"1px solid #f0f0f0"};
return(
<div style={{background:"#fff",padding:"20px",direction:appDir(),fontFamily:"'Tajawal','Cairo',sans-serif",fontSize:"13px",color:"#1a1a2e"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"14px"}}>
  <div style={{display:"flex",alignItems:"flex-start",gap:"13px"}}>
    {logoImg
      ?<div style={{width:"72px",height:"72px",borderRadius:"9px",overflow:"hidden",border:`1px solid ${c.color}33`,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><img src={logoImg} alt={c.name} style={{width:"100%",height:"100%",objectFit:"contain"}}/></div>
      :<div style={{width:"72px",height:"72px",background:c.color,color:"#fff",borderRadius:"9px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:"22px",textAlign:"center",flexShrink:0,lineHeight:1.2,fontWeight:900}}>{c.logo}<span style={{fontSize:"8px",fontWeight:700,opacity:.85,marginTop:"2px",letterSpacing:"1px"}}>{c.id.toUpperCase()}</span></div>
    }
    <div>
      <div style={{fontSize:"18px",fontWeight:900,color:c.color,marginBottom:"4px"}}>{c.name}</div>
      <div style={{fontSize:"11px",color:"#777",lineHeight:"1.85"}}>{c.address}<br/>{c.city}<br/>📞 {c.phone}</div>
    </div>
  </div>
  <div style={{textAlign:"end"}}>
    <div style={{fontSize:"28px",fontWeight:900,color:c.color,letterSpacing:"-1px",lineHeight:1}}>{tr("فـاتـورة")}</div>
    <div style={{fontSize:"12px",color:"#999",marginTop:"5px",direction:"ltr"}}>{inv.invNum}</div>
    <div style={{marginTop:"8px",display:"inline-block",background:stC,color:"#fff",borderRadius:"6px",padding:"3px 12px",fontSize:"11px",fontWeight:700}}>{stT}</div>
  </div>
</div>
<div style={{height:"3px",background:`linear-gradient(to left,${c.color},${c.color}22)`,borderRadius:"3px",marginBottom:"14px"}}/>
<div style={{display:"flex",border:"1px solid #ebebeb",borderRadius:"9px",overflow:"hidden",marginBottom:"16px"}}>
  <div style={{flex:"1.7",padding:"12px 14px",borderLeft:"1px solid #ebebeb"}}>
    <div style={{fontSize:"9px",fontWeight:700,color:c.color,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"6px"}}>{tr("صادرة إلى")}</div>
    <div style={{fontSize:"15px",fontWeight:800,color:"#111",marginBottom:"3px"}}>{inv.clientName||""}</div>
    <div style={{fontSize:"12px",fontWeight:700,color:c.color,direction:"ltr",textAlign:"start",marginBottom:"3px"}}>{inv.clientPhone||""}</div>
    {inv.clientAddress&&<div style={{fontSize:"11px",color:"#777"}}>{inv.clientAddress}</div>}
  </div>
  <div style={{flex:"1",padding:"12px 14px",borderLeft:"1px solid #ebebeb"}}>
    <div style={{fontSize:"9px",fontWeight:700,color:c.color,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"5px"}}>{tr("تاريخ الفاتورة")}</div>
    <div style={{fontSize:"12px",fontWeight:700,marginBottom:"10px"}}>{fDate(inv.date)}</div>
    <div style={{fontSize:"9px",fontWeight:700,color:c.color,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"5px"}}>{tr("تاريخ الاستحقاق")}</div>
    <div style={{fontSize:"12px",fontWeight:700}}>{fDate(inv.dueDate)}</div>
  </div>
  <div style={{flex:"1",padding:"12px 14px"}}>
    <div style={{fontSize:"9px",fontWeight:700,color:c.color,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"5px"}}>{tr("المبلغ المستحق")}</div>
    <div style={{fontSize:"20px",fontWeight:900,color:stC,direction:"ltr",textAlign:"start",lineHeight:1}}>{fKWD(due)}</div>
    <div style={{marginTop:"10px",fontSize:"9px",fontWeight:700,color:c.color,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"5px"}}>{tr("المسؤول")}</div>
    <div style={{fontSize:"11px",fontWeight:600}}>{c.manager}</div>
  </div>
</div>
<table style={{width:"100%",borderCollapse:"collapse",marginBottom:"14px"}}>
<thead><tr style={{background:c.color}}>
  <th style={{...TH,width:"28px",textAlign:"center"}}>#</th>
  {[tr("المنتج / الخدمة"),tr("الوصف"),tr("الكمية"),tr("سعر الوحدة"),tr("الإجمالي")].map(h=><th key={h} style={TH}>{h}</th>)}
</tr></thead>
<tbody>
{inv.items.map((it,i)=>(
<tr key={i} style={{background:i%2===1?"#f7f8fc":"#fff"}}>
<td style={{...TD,textAlign:"center",color:"#aaa",fontSize:"11px"}}>{i+1}</td>
<td style={{...TD,fontWeight:600}}>{it.name||""}</td>
<td style={{...TD,color:"#666",fontSize:"11.5px"}}>{it.desc||""}</td>
<td style={{...TD,textAlign:"center"}}>{it.qty}</td>
<td style={{...TD,textAlign:"end",direction:"ltr"}}>{fKWD(it.price)}</td>
<td style={{...TD,textAlign:"end",fontWeight:700,direction:"ltr"}}>{fKWD(pN(it.qty)*pN(it.price))}</td>
</tr>
))}
{Array.from({length:empty}).map((_,i)=>(
<tr key={"e"+i}><td colSpan={6} style={{height:"32px",borderBottom:"1px solid #f5f5f7"}}></td></tr>
))}
</tbody>
</table>
<div style={{display:"flex",justifyContent:"flex-end",marginBottom:"14px"}}>
<table style={{minWidth:"245px",borderCollapse:"collapse"}}>
<tbody>
<tr><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",color:"#666",fontSize:"12.5px"}}>{tr("المجموع الجزئي")}</td><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",textAlign:"end",fontWeight:600,fontSize:"12.5px",direction:"ltr"}}>{fKWD(sub)}</td></tr>
{tax>0&&<tr><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",color:"#666",fontSize:"12.5px"}}>{tr("الضريبة (")}{taxR}%)</td><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",textAlign:"end",fontWeight:600,fontSize:"12.5px",direction:"ltr"}}>{fKWD(tax)}</td></tr>}
{ship>0&&<tr><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",color:"#666",fontSize:"12.5px"}}>{tr("التوصيل")}</td><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",textAlign:"end",fontWeight:600,fontSize:"12.5px",direction:"ltr"}}>{fKWD(ship)}</td></tr>}
<tr style={{background:c.color}}><td style={{padding:"9px 14px",color:"#fff",fontWeight:800,fontSize:"13px"}}>{tr("إجمالي الفاتورة")}</td><td style={{padding:"9px 14px",color:"#fff",fontWeight:900,fontSize:"13px",textAlign:"end",direction:"ltr"}}>{fKWD(tot)}</td></tr>
<tr><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",color:"#16a34a",fontSize:"12.5px"}}>{tr("المدفوع")}</td><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",textAlign:"end",fontWeight:600,color:"#16a34a",fontSize:"12.5px",direction:"ltr"}}>{fKWD(paid)}</td></tr>
<tr style={{background:"#111827"}}><td style={{padding:"9px 14px",color:"#fff",fontWeight:800,fontSize:"13px"}}>{tr("المبلغ المستحق")}</td><td style={{padding:"9px 14px",color:stC,fontWeight:900,fontSize:"14px",textAlign:"end",direction:"ltr"}}>{fKWD(due)}</td></tr>
</tbody>
</table>
{inv.notes&&<div style={{marginTop:"14px",color:"#666",fontSize:"12px",borderTop:"1px solid #eee",paddingTop:"10px"}}>{tr("ملاحظات:")} {inv.notes}</div>}
</div>
</div>
);
}

// ─── Client Directory (saved customers, backed by /api/clients) ────
function ClientFormModal({initial, company, onSave, onClose}){
const col=company.color;
const [name,setName]=useState(initial?.name||"");
const [phone,setPhone]=useState(initial?.phone||"");
const [email,setEmail]=useState(initial?.email||"");
const [address,setAddress]=useState(initial?.address||"");
const [country,setCountry]=useState(initial?.country||"");
const [gov,setGov]=useState(initial?.governorate||"");
const ws=useWorldStates(); // r23: تقسيمات العالم (chunk ديناميكي)
const lang=appLang();
const [err,setErr]=useState("");
const [busy,setBusy]=useState(false);
const isEdit=!!initial?.id;
const divisions=ws?ws.divisionsOf(country):null; // null = جارٍ التحميل

return(
<div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",direction:appDir()}} onClick={busy?undefined:onClose}>
  <div className="card" style={{width:"100%",maxWidth:"460px",overflow:"hidden",display:"flex",flexDirection:"column",animation:"fadeUp .25s"}} onClick={e=>e.stopPropagation()}>

    <div style={{background:isEdit?"#f59e0b":col,padding:"15px 20px",display:"flex",alignItems:"center",gap:"12px",flexShrink:0}}>
      <div style={{width:"40px",height:"40px",background:"rgba(255,255,255,.18)",borderRadius:"11px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"19px",flexShrink:0}}>
        {isEdit?"✏️":"📇"}
      </div>
      <div style={{flex:1,color:"#fff"}}>
        <div style={{fontWeight:900,fontSize:"15px"}}>{isEdit?tr("تعديل بيانات العميل"):tr("إضافة عميل جديد")}</div>
        <div style={{fontSize:"11.5px",opacity:.75}}>{tr("سيتم حفظه في دليل")} {companyName(company)}</div>
      </div>
      <button onClick={onClose} disabled={busy} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"6px 12px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer",flexShrink:0}}>✕</button>
    </div>

    <div style={{padding:"18px 20px"}}>
      <div className="form-2col" style={{marginBottom:"10px"}}>
        <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("الاسم *")}</label>
          <input className="inp" placeholder={tr("مثال: عبدالله حسن")} value={name} onChange={e=>setName(e.target.value)} autoFocus/></div>
        <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("التلفون *")}</label>
          <input className="inp" style={{direction:"ltr",textAlign:"start"}} placeholder="9xxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)}/></div>
      </div>
      <div style={{marginBottom:"10px"}}>
        <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("البريد الإلكتروني (اختياري)")}</label>
        <input className="inp" style={{direction:"ltr",textAlign:"start"}} placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)}/>
      </div>

      {/* r23: الدولة والمحافظة — كل دول العالم (195) وتقسيماتها */}
      <div className="form-2col" style={{marginBottom:"10px"}}>
        <div>
          <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("🌍 الدولة")}</label>
          <select className="inp" value={country} onChange={e=>{setCountry(e.target.value);setGov("");}}>
            <option value="">{tr("🌍 اختر الدولة")}</option>
            {REGION_GROUPS.map(([region,label])=>{
              const list=WORLD_COUNTRIES.filter(c=>c.region===region);
              if(!list.length)return null;
              return <optgroup key={region} label={tr(label)}>{list.map(c=>(
                <option key={c.code} value={c.code}>{flagOf(c.code)} {lang==="ar"?c.nameAr:c.nameEn}</option>
              ))}</optgroup>;
            })}
          </select>
        </div>
        <div>
          <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("🏙️ المحافظة / المقاطعة")}</label>
          <select className="inp" value={gov} onChange={e=>setGov(e.target.value)} disabled={!country}>
            <option value="">{!country?"—":divisions==null?tr("⏳ جارٍ التحميل…"):divisions.length?tr("— بدون محافظة —"):tr("— بلا تقسيمات —")}</option>
            {divisions&&divisions.map(d=>(
              <option key={d.n} value={d.n}>{ws.divisionLabel(d,lang)}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{marginBottom:"14px"}}>
        <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("العنوان (اختياري)")}</label>
        <input className="inp" placeholder={tr("المنطقة / العنوان")} value={address} onChange={e=>setAddress(e.target.value)}/>
      </div>

      {err&&<div style={{background:"var(--ia-red-bg)",border:"1px solid var(--ia-red-bd)",color:"var(--ia-red-tx)",borderRadius:"8px",padding:"8px 12px",fontSize:"12px",fontWeight:700,marginBottom:"12px"}}>⚠️ {err}</div>}

      <div style={{display:"flex",gap:"8px"}}>
        <button className="btn" disabled={busy} style={{background:isEdit?"#f59e0b":col,color:"#fff",flex:1,fontSize:"14px",padding:"10px",opacity:busy?.7:1}} 
          onClick={async()=>{
            if(!name.trim()){setErr(tr("اسم العميل مطلوب"));return;}
            if(!norm(phone)){setErr(tr("رقم التلفون مطلوب"));return;}
            setBusy(true);
            try{
              await onSave({name:name.trim(),phone:norm(phone),email:email.trim()||null,address:address.trim()||null,country:country||null,governorate:gov||null});
            }catch(e){
              setBusy(false);
              setErr(tr("تعذّر الحفظ — تحقق من الاتصال ثم أعد المحاولة"));
            }
          }}>
          {busy?tr("⏳ جارٍ الحفظ..."):isEdit?tr("💾 حفظ التعديلات"):tr("➕ إضافة العميل")}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={onClose}>{tr("إلغاء")}</button>
      </div>
    </div>
  </div>
</div>
);
}

function ClientDirectory({clients, invoices, company, canEdit, onRefresh, toast_}){
const { dark } = useTheme();
const col = company.color;
const colTx = txAdapt(col, dark);
const cardBg = softAdapt(company.cardBg, dark);
const ws = useWorldStates(); // r23: تقسيمات العالم — للتسمية المحلية
const lang = appLang();
const [modal,setModal]=useState(null); // {mode:'add'} | {mode:'edit', client}
const [del,setDel]=useState(null);
const [imp,setImp]=useState(null);   // clients-CSV import preview: {rows, errors, file}
const [impBusy,setImpBusy]=useState(false);
const [dirSearch,setDirSearch]=useState(""); // quick filter for the directory table
const impFileRef=useRef();

// r25: أحداث الإجراءات السريعة من الغلاف العالمي (لوحة الأوامر/الإجراءات/FAB)
useEffect(()=>{
  const onAdd=()=>setModal({mode:"add"});
  const onOpen=e=>{ const d=e?.detail||{}; if(d.phone||d.name) setDirSearch(String(d.phone||d.name)); };
  window.addEventListener("garfix-add-customer",onAdd);
  window.addEventListener("garfix-open-customer",onOpen);
  return ()=>{ window.removeEventListener("garfix-add-customer",onAdd); window.removeEventListener("garfix-open-customer",onOpen); };
},[]);

// ── CSV export of the saved-client directory ──
// r23: أعمدة الدولة والمحافظة + رؤوس مترجمة تتبع لغة الواجهة (كانت ثابتة بالعربية)
const clientExportColumns = () => [
  [tr("الاسم"), c => c.name || ""],
  [tr("التلفون"), c => c.phone || ""],
  [tr("البريد"), c => c.email || ""],
  [tr("العنوان"), c => c.address || ""],
  [tr("الدولة"), c => c.country ? `${flagOf(c.country)} ${countryLabel(c.country, lang)}` : ""],
  [tr("المحافظة"), c => govLabelOf(ws, c.country, c.governorate, lang)],
];
const exportClientsCSV = () => {
  if (!clients.length) { toast_(tr("لا يوجد عملاء محفوظون للتصدير"),"warn"); return; }
  const cols = clientExportColumns();
  const headers = cols.map(([h]) => h);
  const rows = clients.map(c => Object.fromEntries(cols.map(([h, fn]) => [h, fn(c)])));
  downloadCSV(toCSV(headers, rows), `Clients_${company.id}_${today()}.csv`);
  toast_(tr("⬇️ تم تنزيل دليل العملاء (") + clients.length + tr(" عميل)"));
};

// r20: Excel export of the saved-client directory (.xlsx, RTL)
const exportClientsExcel = () => {
  if (!clients.length) { toast_(tr("لا يوجد عملاء محفوظون للتصدير"),"warn"); return; }
  const cols = clientExportColumns();
  const headers = cols.map(([h]) => h);
  const rows = clients.map(c => Object.fromEntries(cols.map(([h, fn]) => [h, fn(c)])));
  const wsx = XLSX.utils.json_to_sheet(rows, { header: headers });
  wsx["!cols"] = [{wch:24},{wch:16},{wch:26},{wch:30},{wch:20},{wch:26}];
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, wsx, tr("العملاء"));
  XLSX.writeFile(wb, `Clients_${company.id}_${today()}.xlsx`);
  toast_(tr("📊 تم تنزيل دليل العملاء Excel (") + clients.length + tr(" عميل)"));
};

// ── CSV import (dedupes by phone against the current directory) ──
// r23: يقبل عمودَي الدولة (عربي/إنجليزي/كود) والمحافظة (عربي/إنجليزي — يُطبّع للأساس)
const doImportClients = async () => {
  if (!imp?.rows?.length) return;
  setImpBusy(true);
  const existing = new Set(clients.map(c => norm(c.phone || "")));
  const seen = new Set();
  let added = 0, skipped = 0;
  const wsStates = await worldStates().catch(() => null);
  for (const r of imp.rows) {
    const ph = norm(r.phone);
    if (existing.has(ph) || seen.has(ph)) { skipped++; continue; }
    seen.add(ph);
    let gov = r.governorate || null;
    if (gov && wsStates) {
      const d = wsStates.findDivision(r.country, gov);
      if (d) gov = d.n; // طبّع للاسم الأساسي
    }
    try { await api.createClient({ name: r.name, phone: ph, email: r.email || null, address: r.address || null, country: r.country || null, governorate: gov, company: company.id }); added++; }
    catch { skipped++; }
  }
  setImpBusy(false);
  setImp(null);
  onRefresh();
  toast_(added ? tr("✅ تم استيراد {0} عميل{1}",[added,skipped ? tr(" — تخطّي {0} مكرر/غير صالح",[skipped]) : ""]) : tr("لم يُضف أي عميل جديد (كله مكرر)"), added ? "ok" : "warn");
};

// Spend stats per normalized phone, derived from the company invoices
const stats={};
invoices.forEach(inv=>{
const ph=norm(inv.clientPhone||"");
if(!ph)return;
if(!stats[ph])stats[ph]={spent:0,count:0,lastDate:""};
stats[ph].spent+=iT(inv);stats[ph].count+=1;
if(inv.date>stats[ph].lastDate)stats[ph].lastDate=inv.date;
});

const saveClient=async data=>{
if(modal.mode==="add"){
  await api.createClient({...data,company:company.id});
  toast_(tr("✅ تم إضافة ")+data.name+tr(" إلى الدليل"));
}else{
  await api.updateClient(modal.client.id,data);
  toast_(tr("✅ تم تحديث بيانات ")+data.name);
}
setModal(null);
onRefresh();
};

const confirmDelClient=async()=>{
try{ await api.deleteClient(del.id); }catch{}
setDel(null);
onRefresh();
toast_(tr("🗑️ تم حذف ")+(del.name||tr("العميل"))+tr(" من الدليل"),"warn");
};

// quick search filter (name / phone / email / address / country / governorate)
const shownClients=dirSearch
 ?clients.filter(c=>{const s=toW(dirSearch).toLowerCase();return (c.name||"").toLowerCase().includes(s)||norm(c.phone||"").includes(s)||(c.email||"").toLowerCase().includes(s)||(c.address||"").includes(s)||(c.country?countryLabel(c.country,lang):"").toLowerCase().includes(s)||(govLabelOf(ws,c.country,c.governorate,lang)||"").includes(s);})
 :clients;

return(
<div className="card" style={{overflow:"hidden",animation:"fadeUp .25s"}}>
  {/* Section header */}
  <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"14px 18px",borderBottom:"1.5px solid var(--ia-border3)",background:"linear-gradient(135deg,var(--ia-soft),var(--ia-card))",flexWrap:"wrap"}}>
    <div style={{width:"38px",height:"38px",background:cardBg,border:`1.5px solid ${col}33`,borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0}}>📇</div>
    <div style={{flex:1,minWidth:"150px"}}>
      <div style={{fontSize:"14px",fontWeight:900,color:"var(--ia-text)"}}>{tr("دليل العملاء المحفوظين")}</div>
      <div style={{fontSize:"11px",color:"var(--ia-muted)",fontWeight:600}}>{tr("للاستخدام السريع عند إنشاء الفواتير — يُحفظ لكل شركة على حدة")}</div>
    </div>
    <span style={{background:"var(--ia-blue-bg)",color:"var(--ia-blue-tx)",borderRadius:"20px",padding:"3px 11px",fontSize:"11px",fontWeight:800}}>{dirSearch?shownClients.length+tr(" من ")+clients.length:clients.length+tr(" محفوظ")}</span>
    {clients.length>3&&(
      <input className="inp" placeholder={tr("🔍 بحث في الدليل…")} value={dirSearch} onChange={e=>setDirSearch(e.target.value)}
        style={{width:"170px",padding:"6px 10px",fontSize:"12px",borderRadius:"8px"}}
        aria-label={tr("بحث في دليل العملاء")}/>
    )}
    <button className="btn" title={tr("تنزيل الدليل كملف CSV (يفتح في Excel)")} style={{background:"var(--ia-ghost-bg)",color:"var(--ia-ghost-tx)",padding:"7px 11px",fontSize:"12px"}} onClick={exportClientsCSV}>⬇️ CSV</button>
    <button className="btn" title={tr("تنزيل الدليل كملف Excel (.xlsx)")} style={{background:"var(--ia-ghost-bg)",color:"var(--ia-ghost-tx)",padding:"7px 11px",fontSize:"12px"}} onClick={exportClientsExcel}>📊 Excel</button>
    {canEdit&&<button className="btn" title={tr("استيراد عملاء من ملف CSV أو Excel (الاسم + التلفون مطلوبان)")} style={{background:"#0f766e",color:"#fff",padding:"7px 11px",fontSize:"12px"}} onClick={()=>impFileRef.current?.click()}>{tr("⬆️ استيراد")}</button>}
    <input ref={impFileRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:"none"}} onChange={e=>{
      const file=e.target.files[0];
      e.target.value="";
      if(!file)return;
      const ext=file.name.split(".").pop().toLowerCase();
      if(["xlsx","xls"].includes(ext)){
        const reader=new FileReader();
        reader.onload=()=>{
          const res=parseClientsExcel(new Uint8Array(reader.result));
          if(!res.rows.length){toast_("❌ "+(res.errors[0]||tr("ملف غير صالح")),"warn");return;}
          setImp(res);
        };
        reader.onerror=()=>toast_(tr("❌ تعذّر قراءة الملف"),"warn");
        reader.readAsArrayBuffer(file);
      }else{
        const reader=new FileReader();
        reader.onload=()=>{
          const res=parseClientsCSV(String(reader.result||""));
          if(!res.rows.length){toast_("❌ "+(res.errors[0]||tr("ملف غير صالح")),"warn");return;}
          setImp(res);
        };
        reader.onerror=()=>toast_(tr("❌ تعذّر قراءة الملف"),"warn");
        reader.readAsText(file,"utf-8");
      }
    }}/>
    {canEdit&&<button className="btn" style={{background:col,color:"#fff",padding:"7px 13px",fontSize:"12px"}} onClick={()=>setModal({mode:"add"})}>{tr("➕ عميل جديد")}</button>}
  </div>

  {clients.length===0?(
    <div style={{padding:"34px",textAlign:"center",color:"var(--ia-muted)"}}>
      <div style={{fontSize:"34px",marginBottom:"8px"}}>📇</div>
      <div style={{fontWeight:700,fontSize:"13px",marginBottom:"4px"}}>{tr("لا يوجد عملاء محفوظون بعد")}</div>
      <div style={{fontSize:"12px",marginBottom:"14px"}}>{tr("أضف عميلك الأول ليظهر هنا، أو سيُضاف تلقائياً عند إنشاء أول فاتورة له")}</div>
      {canEdit&&<button className="btn" style={{background:col,color:"#fff"}} onClick={()=>setModal({mode:"add"})}>{tr("➕ إضافة عميل")}</button>}
    </div>
  ):(
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr style={{background:"var(--ia-soft)",borderBottom:"2px solid var(--ia-border2)"}}>
          {[tr("العميل"),tr("التلفون"),tr("العنوان"),tr("إجمالي الإنفاق"),tr("الفواتير"),tr("آخر شراء"),""].map(h=>(
            <th key={h} style={{padding:"10px 12px",fontSize:"11px",fontWeight:700,color:"var(--ia-sub)",textAlign:"start",textTransform:"uppercase",letterSpacing:".3px",whiteSpace:"nowrap"}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {shownClients.map((c,i)=>{
            const ph=norm(c.phone||"");
            const st=stats[ph];
            return(
              <tr key={c.id} className="trow" style={{borderBottom:"1px solid var(--ia-border3)",background:i%2===0?"var(--ia-card)":"var(--ia-row-alt)"}}>
                <td style={{padding:"10px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"9px"}}>
                    <div style={{width:"32px",height:"32px",background:cardBg,border:`1px solid ${col}33`,color:colTx,borderRadius:"9px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:900,flexShrink:0}}>
                      {(c.name||"؟").trim().charAt(0)}
                    </div>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:"13px"}}>{c.name}</div>
                      {c.email&&<div style={{fontSize:"10.5px",color:"var(--ia-muted)",direction:"ltr",textAlign:"start"}}>{c.email}</div>}
                    </div>
                  </div>
                </td>
                <td style={{padding:"10px 12px",direction:"ltr",textAlign:"start",color:"var(--ia-link)",fontSize:"12.5px",fontWeight:600,whiteSpace:"nowrap"}}>{c.phone||"—"}</td>
                <td style={{padding:"10px 12px",color:"var(--ia-sub)",fontSize:"12px",maxWidth:"150px"}}>
                  <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.address||"—"}</div>
                  {(c.country||c.governorate)&&(
                    <div title={govLabelOf(ws,c.country,c.governorate,lang)} style={{fontSize:"10.5px",color:"var(--ia-muted)",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {c.country?flagOf(c.country):"📍"} {[govLabelOf(ws,c.country,c.governorate,lang),c.country?countryLabel(c.country,lang):""].filter(Boolean).join(lang==="ar"?"، ":", ")}
                    </div>
                  )}
                </td>
                <td style={{padding:"10px 12px",fontWeight:800,color:st?colTx:"var(--ia-muted)",whiteSpace:"nowrap"}}>{st?fKWD(st.spent):"—"}</td>
                <td style={{padding:"10px 12px",textAlign:"center"}}>
                  {st?<span style={{background:"var(--ia-blue-bg)",color:"var(--ia-blue-tx)",borderRadius:"20px",padding:"2px 9px",fontSize:"11px",fontWeight:700}}>{st.count}</span>
                     :<span style={{color:"#d1d5db",fontSize:"11px"}}>{tr("جديد")}</span>}
                </td>
                <td style={{padding:"10px 12px",color:"var(--ia-sub)",fontSize:"11.5px",whiteSpace:"nowrap"}}>{st?fDate(st.lastDate):"—"}</td>
                <td style={{padding:"10px 12px"}} onClick={e=>e.stopPropagation()}>
                  {canEdit&&(
                    <div style={{display:"flex",gap:"4px"}}>
                      <button className="btn" title={tr("تعديل بيانات العميل")} style={{background:"#f59e0b",color:"#fff",padding:"5px 9px",fontSize:"12px"}} onClick={()=>setModal({mode:"edit",client:c})}>✏️</button>
                      <button className="btn btn-red" title={tr("حذف من الدليل")} style={{padding:"5px 9px",fontSize:"12px"}} onClick={()=>setDel(c)}>🗑️</button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {shownClients.length===0&&dirSearch&&(
            <tr><td colSpan={7} style={{padding:"24px",textAlign:"center",color:"var(--ia-muted)"}}>
              <div style={{fontSize:"22px",marginBottom:"6px"}}>🔍</div>
              {tr("لا نتائج مطابقة للبحث «")}{dirSearch}{tr("» — جرّب اسماً أو رقماً آخر")}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )}

  {/* Add / Edit modal */}
  {modal&&(
    <ClientFormModal
      initial={modal.mode==="edit"?modal.client:null}
      company={company}
      onSave={saveClient}
      onClose={()=>setModal(null)}
    />
  )}

  {/* CSV import preview / confirm */}
  {imp&&(
    <div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",direction:appDir()}} onClick={()=>impBusy?undefined:setImp(null)}>
      <div className="card" style={{width:"100%",maxWidth:"480px",maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column",animation:"fadeUp .25s"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:"#0f766e",padding:"14px 18px",display:"flex",alignItems:"center",gap:"11px",flexShrink:0}}>
          <div style={{width:"38px",height:"38px",background:"rgba(255,255,255,.18)",borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px"}}>⬆️</div>
          <div style={{flex:1,color:"#fff"}}>
            <div style={{fontWeight:900,fontSize:"14.5px"}}>{tr("استيراد عملاء من CSV")}</div>
            <div style={{fontSize:"11.5px",opacity:.8}}>{imp.rows.length} {tr("صف صالح — سيُتخطى المكرر تلقائياً")}</div>
          </div>
          <button onClick={()=>setImp(null)} disabled={impBusy} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"6px 12px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"14px 18px"}}>
          {imp.errors.length>0&&(
            <div style={{background:"var(--ia-warn-bg)",border:"1px solid var(--ia-warn-bd)",color:"var(--ia-warn-tx2)",borderRadius:"8px",padding:"8px 12px",fontSize:"11.5px",marginBottom:"10px",lineHeight:1.7}}>⚠️ {imp.errors.slice(0,4).join(" | ")}{imp.errors.length>4?` (+${imp.errors.length-4})`:""}</div>
          )}
          <div style={{border:"1px solid var(--ia-border)",borderRadius:"9px",overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead><tr style={{background:"var(--ia-soft)"}}>
                {["#",tr("الاسم"),tr("التلفون"),tr("البريد"),tr("العنوان")].map(h=>(<th key={h} style={{padding:"7px 10px",fontSize:"10.5px",fontWeight:800,color:"var(--ia-sub)",textAlign:"start"}}>{h}</th>))}
              </tr></thead>
              <tbody>
                {imp.rows.slice(0,30).map((r,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid var(--ia-border3)",background:i%2===0?"var(--ia-card)":"var(--ia-row-alt)"}}>
                    <td style={{padding:"6px 10px",color:"var(--ia-muted)",fontWeight:700}}>{i+1}</td>
                    <td style={{padding:"6px 10px",fontWeight:700}}>{r.name}</td>
                    <td style={{padding:"6px 10px",direction:"ltr",textAlign:"start",color:"var(--ia-link)",fontWeight:600}}>{r.phone}</td>
                    <td style={{padding:"6px 10px",direction:"ltr",textAlign:"start",color:"var(--ia-muted)",fontSize:"11px"}}>{r.email||"—"}</td>
                    <td style={{padding:"6px 10px",color:"var(--ia-sub)",fontSize:"11px",maxWidth:"110px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.address||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {imp.rows.length>30&&<div style={{textAlign:"center",fontSize:"11px",color:"var(--ia-muted)",marginTop:"8px"}}>{tr("… و")} {imp.rows.length-30} {tr("عميل آخر")}</div>}
        </div>
        <div style={{display:"flex",gap:"9px",padding:"13px 18px",borderTop:"1px solid var(--ia-border3)",background:"var(--ia-soft)",flexShrink:0}}>
          <button className="btn" disabled={impBusy} style={{background:"#0f766e",color:"#fff",flex:1,fontSize:"13.5px",padding:"10px",opacity:impBusy?.7:1}} onClick={doImportClients}>
            {impBusy?tr("⏳ جارٍ الاستيراد..."):tr("💾 استيراد {0} عميل",[imp.rows.length])}
          </button>
          <button className="btn" disabled={impBusy} style={{background:"var(--ia-ghost-bg)",color:"var(--ia-ghost-tx)",fontSize:"13px",padding:"10px 14px"}} onClick={()=>setImp(null)}>{tr("إلغاء")}</button>
        </div>
      </div>
    </div>
  )}

  {/* Delete confirmation */}
  {del&&(
    <div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",direction:appDir()}} onClick={()=>setDel(null)}>
      <div className="card" style={{padding:"26px 30px",textAlign:"center",maxWidth:"330px",animation:"fadeUp .2s"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:"36px",marginBottom:"8px"}}>🗑️</div>
        <div style={{fontWeight:800,fontSize:"14.5px",marginBottom:"6px"}}>{tr("حذف العميل من الدليل؟")}</div>
        <div style={{color:"var(--ia-sub)",fontSize:"12.5px",marginBottom:"16px",lineHeight:1.7}}>
          {tr("سيتم حذف")} <b>{del.name}</b> {tr("من دليل العملاء.")}<br/>
          <span style={{fontSize:"11px",color:"var(--ia-muted)"}}>{tr("فواتيره السابقة لن تتأثر.")}</span>
        </div>
        <div style={{display:"flex",gap:"9px",justifyContent:"center"}}>
          <button className="btn btn-red" onClick={confirmDelClient}>{tr("نعم، احذف")}</button>
          <button className="btn btn-ghost" onClick={()=>setDel(null)}>{tr("إلغاء")}</button>
        </div>
      </div>
    </div>
  )}
</div>
);
}

// ─── Customers ────────────────────────────────────────────────────
function Customers({invoices, company, onImportDone, onOpenInvoice, clients, refreshClients, toast_, printStyle, onMerged}){
const { perms, isAdmin } = useAuth();
const { dark } = useTheme();
const col = company.color;
const colTx = txAdapt(col, dark);
const cardBg = softAdapt(company.cardBg, dark);
const [search,setSearch]=useState("");
const [sort,setSort]=useState("spent");
const [showImport,setShowImport]=useState(false);
const [selCustomer,setSelCustomer]=useState(null);
const [stmtBusy,setStmtBusy]=useState(false);
// r11: دمج العملاء المكررين
const [mergeOpen,setMergeOpen]=useState(false);
const [mergeTarget,setMergeTarget]=useState(null);
const [mergeSearch,setMergeSearch]=useState("");
const [mergeBusy,setMergeBusy]=useState(false);
const [mergeArmed,setMergeArmed]=useState(false);
// r9: credit hard-block enforcement flag (admin-controlled, synced server-side)
const [creditBlock,setCreditBlockState]=useState(()=>getCreditBlock(company?.id));
const toggleCreditBlock=()=>{
  const v=!creditBlock;
  setCreditBlockState(v);
  setCreditBlock(company,v);
  toast_(v?tr("⛔ تم تفعيل المنع الصارم لتجاوز حدود الائتمان — لن يستطيع غير المديرين حفظ فواتير متجاوزة"):tr("✅ تم تعطيل المنع الصارم — سيقتصر الأمر على التحذير فقط"));
};
// ── Credit limits (per-company, localStorage) ──
const [creditMap,setCreditMap]=useState(()=>loadCreditMap(company?.id));
const [creditCo,setCreditCo]=useState(company?.id);
const [creditInput,setCreditInput]=useState("");
const [creditFor,setCreditFor]=useState(null);
// render-time sync when company or selected customer changes (lint-clean pattern, like `company` derivation)
if(creditCo!==company?.id){ setCreditCo(company?.id); setCreditMap(loadCreditMap(company?.id)); setCreditInput(""); setCreditBlockState(getCreditBlock(company?.id)); }
if(selCustomer&&creditFor!==norm(selCustomer.phone)){ setCreditFor(norm(selCustomer.phone)); setCreditInput(""); }

// r9: pull server-side credit limits + hard-block flag (cross-device sync — server map replaces local cache)
useEffect(()=>{
  let live=true;
  if(!company?.sk)return;
  syncSettingsFromServer(company).then(map=>{
    if(!live)return;
    setCreditBlockState(getCreditBlock(company.id));
    if(!map)return;
    setCreditMap(prev=>JSON.stringify(prev)===JSON.stringify(map)?prev:map);
  });
  return()=>{live=false;};
},[company?.sk]);

const saveCredit=()=>{
  const ph=phKey(selCustomer?.phone||"");
  if(!ph)return;
  const map={...creditMap};
  const v=pN(creditInput);
  if(v>0)map[ph]=v; else delete map[ph];
  setCreditMap(map);
  saveCreditMap(company,map);
  toast_(v>0?tr("✅ تم تعيين حد الائتمان {0}",[fKWD(v)]):tr("🗑️ تم إزالة حد الائتمان"));
};

// ── Client account statement PDF (كشف حساب) ──
const exportStatement=async cust=>{
  if(stmtBusy||!cust)return;
  try{
    setStmtBusy(true);
    const custInvs=invoices.filter(inv=>phKey(inv.clientPhone||"")===phKey(cust.phone));
    const enriched=await Promise.all(custInvs.map(async inv=>{
      let pays=[];
      try{ pays=(await api.listPayments(inv.id))||[]; }catch{}
      return {...inv,_pays:pays};
    }));
    const html=buildStatementHTML({client:cust,invoices:enriched,company,styleId:printStyle||"classic"});
    const base=tr("كشف_حساب_")+String(cust.name||tr("عميل")).replace(/\s+/g,"_").slice(0,40);
    const blob=await api.exportPdf(html,base);
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=base+".pdf";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    toast_(tr("✅ تم تصدير كشف الحساب PDF"));
  }catch(e){
    toast_((e&&e.message)||tr("فشل تصدير كشف الحساب"),"err");
  }finally{
    setStmtBusy(false);
  }
};

// ── r9: concise account-statement summary over WhatsApp (logged as channel "statement") ──
const statementSummaryOf=cust=>{
  const custInvs=invoices.filter(inv=>phKey(inv.clientPhone||"")===phKey(cust.phone)&&inv.status!=="cancelled");
  const billed=custInvs.reduce((s,i)=>s+iT(i),0);
  const paid=custInvs.reduce((s,i)=>s+pN(i.paid||0),0);
  const bal=Math.max(0,billed-paid);
  const openInvs=custInvs.filter(i=>iT(i)-pN(i.paid||0)>0.0001);
  const oldest=openInvs.reduce((m,i)=>Math.max(m,overdueDays(i)),0);
  return{custInvs,billed,paid,bal,oldest};
};
const statementWaHref=cust=>{
  if(!cust?.phone)return "";
  const {custInvs,billed,paid,bal,oldest}=statementSummaryOf(cust);
  const lines=[
    tr("عميلنا العزيز {0}،",[cust.name]),
    tr("📋 كشف حساب من {0} حتى {1}",[companyName(company),new Date().toLocaleDateString(dateLocale())]),
    tr("🧾 عدد الفواتير: {0}",[custInvs.length]),
    tr("💰 إجمالي المبيعات: {0}",[fKWD(billed)]),
    tr("✅ المدفوع: {0}",[fKWD(paid)]),
    bal>0?tr("⏳ الرصيد المستحق: {0}",[fKWD(bal)]):tr(`🎉 لا يوجد رصيد مستحق — حسابكم مسدد بالكامل`),
    bal>0&&oldest>0?tr("⏰ أقدم استحقاق متأخر: {0} يوم",[oldest]):"",
    bal>0?tr(`نرجو التكرم بمراجعة الحساب وتسوية الرصيد، ويمكننا إرسال كشف حساب PDF مفصل عند الطلب.`):"",
    tr(`شكراً لتعاونكم 🌹`),
    `${companyName(company)} — ${company.phone}`,
  ].filter(Boolean);
  return waHrefWithText(cust.phone,lines.join("\n"));
};
const sendStatementWa=cust=>{
  const href=statementWaHref(cust);
  if(!href){toast_(tr("لا يوجد رقم هاتف لهذا العميل"),"warn");return;}
  const {bal}=statementSummaryOf(cust);
  try{
    api.logReminder({
      invoiceId:null,
      clientPhone:cust.phone||null,
      clientName:cust.name||null,
      companySlug:company?.sk||null,
      channel:"statement",
      message:decodeURIComponent(href.split("text=")[1]||"").slice(0,1500),
      amount:bal,
    }).then(()=>{try{window.dispatchEvent(new CustomEvent("reminder-logged",{detail:{invoiceId:null}}));}catch{}}).catch(()=>{});
  }catch{}
  toast_(tr("📣 تم فتح محادثة كشف الحساب"));
};

const map={};
// r9: group by canonical phKey so phone spellings (+965 / 965 / local) merge into one customer;
// the DISPLAY phone upgrades to the longest spelling seen (nicest for calls/WhatsApp).
[...invoices].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)).forEach(inv=>{
const ph=phKey(inv.clientPhone||"");
if(!map[ph])map[ph]={phone:ph,name:inv.clientName||ph||"—",address:inv.clientAddress||"",totalSpent:0,count:0,lastDate:"",firstDate:inv.date,products:[]};
const rawPh=inv.clientPhone||"";
if(rawPh.length>map[ph].phone.length)map[ph].phone=rawPh;
map[ph].totalSpent+=iT(inv);map[ph].count+=1;
if(!map[ph].lastDate||inv.date>map[ph].lastDate)map[ph].lastDate=inv.date;
inv.items.forEach(it=>{if(it.name&&!map[ph].products.includes(it.name))map[ph].products.push(it.name);});
});
let customers=Object.values(map);
if(search){const s=toW(search).toLowerCase();customers=customers.filter(c=>c.phone.includes(s)||c.name.toLowerCase().includes(s));}
customers.sort((a,b)=>sort==="spent"?b.totalSpent-a.totalSpent:sort==="count"?b.count-a.count:b.lastDate.localeCompare(a.lastDate));

const customerInvoices=selCustomer?invoices.filter(inv=>phKey(inv.clientPhone||"")===phKey(selCustomer.phone)).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)):[];

return(
<div>
{showImport&&(
<ImportModal
company={company}
existingInvoices={invoices}
onImport={list=>{onImportDone(list);setShowImport(false);}}
onClose={()=>setShowImport(false)}
/>
)}

{/* ── Customer Detail Modal ── */}
{selCustomer&&(
<div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",direction:appDir()}} onClick={()=>setSelCustomer(null)}>
<div className="card" style={{width:"100%",maxWidth:"640px",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",animation:"fadeUp .25s"}} onClick={e=>e.stopPropagation()}>

  {/* Modal header */}
  <div style={{background:col,padding:"16px 20px",display:"flex",alignItems:"center",gap:"12px",flexShrink:0}}>
    <div style={{width:"46px",height:"46px",background:"rgba(255,255,255,.18)",borderRadius:"12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",fontWeight:900,color:"#fff",flexShrink:0}}>
      {(selCustomer.name||"؟").trim().charAt(0)}
    </div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{color:"#fff",fontWeight:900,fontSize:"15px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selCustomer.name}</div>
      <div style={{color:"rgba(255,255,255,.75)",fontSize:"12px",direction:"ltr",textAlign:"start"}}>{selCustomer.phone||"—"}</div>
    </div>
    <button onClick={()=>setSelCustomer(null)} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"6px 12px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer",flexShrink:0}}>{tr("✕ إغلاق")}</button>
  </div>

  <div style={{overflowY:"auto",flex:1,padding:"18px 20px"}}>

    {/* Contact actions */}
    <div style={{display:"flex",gap:"8px",marginBottom:"14px",flexWrap:"wrap"}}>
      <button onClick={()=>exportStatement(selCustomer)} disabled={stmtBusy}
        title={tr("تصدير كشف حساب كامل: كل الفواتير والمدفوعات والرصيد وتقادم الذمم")}
        style={{background:stmtBusy?"#991b1b":"#dc2626",border:"none",color:"#fff",borderRadius:"8px",padding:"9px 16px",fontFamily:"inherit",fontSize:"12.5px",fontWeight:800,cursor:stmtBusy?"wait":"pointer",boxShadow:"0 2px 8px rgba(0,0,0,.15)"}}>
        {stmtBusy?tr("⏳ جاري التجهيز…"):tr("📄 كشف حساب PDF")}
      </button>
      {selCustomer.phone&&(()=>{ // r9: WhatsApp statement summary (balance-aware label)
        const {bal}=statementSummaryOf(selCustomer);
        return(
        <a href={statementWaHref(selCustomer)} target="_blank" rel="noopener noreferrer" className="btn wa-btn"
          title={tr("إرسال ملخص كشف الحساب عبر واتساب: عدد الفواتير، إجمالي المبيعات، المدفوع والرصيد المستحق — يُسجَّل في سجل التحصيل")}
          onClick={()=>sendStatementWa(selCustomer)}
          style={{color:"#fff",textDecoration:"none",padding:"9px 16px"}}>
          {bal>0?tr("📨 كشف الحساب واتساب ({0})",[fKWD(bal)]):tr("📨 كشف الحساب واتساب")}
        </a>
        );
      })()}
      {selCustomer.phone&&(
        <>
        <a href={`https://wa.me/965${selCustomer.phone.replace(/^\+?965/,"")}`} target="_blank" rel="noopener noreferrer" className="btn" style={{background:"#16a34a",color:"#fff",textDecoration:"none",padding:"9px 16px"}}>{tr("💬 واتساب")}</a>
        <a href={`tel:+965${selCustomer.phone.replace(/^\+?965/,"")}`} className="btn" style={{background:"#2563eb",color:"#fff",textDecoration:"none",padding:"9px 16px"}}>{tr("📞 اتصال")}</a>
        </>
      )}
      {isAdmin&&selCustomer&&(
        <button onClick={()=>{setMergeOpen(true);setMergeTarget(null);setMergeSearch("");setMergeArmed(false);}}
          title={tr("دمج هذا العميل مع عميل آخر مكرر — تُنقل كل فواتيره وتُوحّد الاسم والرقم (مفيد لمن أُدخل برقمين مختلفين)")}
          style={{
            background:softAdapt("#fef3c7",dark),color:txAdapt("#92400e",dark),
            border:`1.5px dashed ${txAdapt("#f59e0b",dark)}`,borderRadius:"8px",
            padding:"9px 14px",fontFamily:"inherit",fontSize:"12.5px",fontWeight:800,cursor:"pointer",
            transition:"all .18s",
          }}
          onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 3px 10px rgba(245,158,11,.25)";}}
          onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}
        >{tr("🔀 دمج مكرر")}</button>
      )}
      {selCustomer.address&&(
        <div style={{display:"inline-flex",alignItems:"center",gap:"6px",background:"var(--ia-soft)",border:"1px solid var(--ia-border)",borderRadius:"8px",padding:"9px 14px",fontSize:"12px",color:"var(--ia-text2)",fontWeight:600,flex:1,minWidth:"140px"}}>
          📍 {selCustomer.address}
        </div>
      )}
    </div>

    {/* Stats */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px",marginBottom:"16px"}}>
      <div style={{background:cardBg,borderRadius:"10px",padding:"10px 14px",border:`1px solid ${col}22`}}>
        <div style={{fontSize:"10px",color:"var(--ia-sub)",fontWeight:700,marginBottom:"3px"}}>{tr("إجمالي الإنفاق")}</div>
        <div style={{fontSize:"16px",fontWeight:900,color:colTx}}>{fKWD(selCustomer.totalSpent)}</div>
      </div>
      <div style={{background:"var(--ia-blue-bg)",borderRadius:"10px",padding:"10px 14px",border:"1px solid #93c5fd44"}}>
        <div style={{fontSize:"10px",color:"var(--ia-blue-tx2)",fontWeight:700,marginBottom:"3px"}}>{tr("عدد الفواتير")}</div>
        <div style={{fontSize:"16px",fontWeight:900,color:"var(--ia-blue-tx)"}}>{selCustomer.count} {tr("فاتورة")}</div>
      </div>
      <div style={{background:"var(--ia-ok-bg)",borderRadius:"10px",padding:"10px 14px",border:"1px solid #86efac44"}}>
        <div style={{fontSize:"10px",color:"var(--ia-ok-tx2)",fontWeight:700,marginBottom:"3px"}}>{tr("أول شراء")}</div>
        <div style={{fontSize:"13px",fontWeight:800,color:"var(--ia-ok-tx)"}}>{fDate(selCustomer.firstDate)}</div>
      </div>
      <div style={{background:"var(--ia-warn-bg)",borderRadius:"10px",padding:"10px 14px",border:"1px solid #fde68a44"}}>
        <div style={{fontSize:"10px",color:"var(--ia-warn-tx2)",fontWeight:700,marginBottom:"3px"}}>{tr("آخر شراء")}</div>
        <div style={{fontSize:"13px",fontWeight:800,color:"var(--ia-warn-tx)"}}>{fDate(selCustomer.lastDate)}</div>
      </div>
    </div>

    {/* Credit limit & outstanding */}
    {selCustomer.phone&&(()=>{
      const limit=creditLimitOf(creditMap,selCustomer.phone);
      const hasLimit=limit>0;
      const out=outstandingOf(invoices,selCustomer.phone);
      const pct=hasLimit?Math.min(999,out/limit*100):0;
      const over=hasLimit&&out>limit;
      const barColor=!hasLimit?"var(--ia-border2)":pct<50?"#16a34a":pct<80?"#d97706":pct<100?"#ea580c":"#dc2626";
      const chip=over
        ?{t:tr("⛔ تجاوز الحد بمقدار {0}",[fKWD(out-limit)]),c:"var(--ia-red-tx)",bg:"var(--ia-red-bg)",bd:"var(--ia-red-bd)"}
        :hasLimit&&pct>=80
        ?{t:tr("🔴 قارب استنفاد الحد"),c:"var(--ia-red-tx)",bg:"var(--ia-red-bg)",bd:"var(--ia-red-bd)"}
        :hasLimit&&pct>=50
        ?{t:tr("🟡 استهلاك متوسط للحد"),c:"var(--ia-warn-tx)",bg:"var(--ia-warn-bg)",bd:"#fde68a66"}
        :hasLimit
        ?{t:tr("🟢 ضمن الحد الآمن"),c:"var(--ia-ok-tx)",bg:"var(--ia-ok-bg)",bd:"#86efac55"}
        :null;
      const shown=creditInput!==""?creditInput:(hasLimit?String(creditLimitOf(creditMap,selCustomer.phone)||""):"");
      return(
      <div style={{background:"var(--ia-soft)",border:"1px solid var(--ia-border)",borderRadius:"10px",padding:"13px 15px",marginBottom:"16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"9px",flexWrap:"wrap"}}>
          <div style={{fontSize:"11px",fontWeight:900,color:"var(--ia-sub)",textTransform:"uppercase",letterSpacing:".5px"}}>{tr("💳 حد الائتمان")}</div>
          {chip&&<span style={{fontSize:"11px",fontWeight:800,color:chip.c,background:chip.bg,border:`1px solid ${chip.bd}`,borderRadius:"20px",padding:"2px 10px"}}>{chip.t}</span>}
          <div style={{flex:1}}/>
          <div style={{direction:appDir(),display:"flex",gap:"10px",alignItems:"baseline"}}>
            <span style={{fontSize:"13px",fontWeight:900,color:over?"var(--ia-red-tx)":"var(--ia-text)"}}>{fKWD(out)}</span>
            <span style={{fontSize:"10px",color:"var(--ia-muted)"}}>{tr("مستحق")}</span>
            {hasLimit&&<><span style={{color:"var(--ia-muted)"}}>/</span><span style={{fontSize:"13px",fontWeight:800,color:colTx}}>{fKWD(limit)}</span><span style={{fontSize:"10px",color:"var(--ia-muted)"}}>{tr("الحد")}</span></>}
          </div>
        </div>
        {/* utilization bar */}
        {hasLimit&&(
          <div style={{marginBottom:"10px"}}>
            <div style={{height:"8px",background:"var(--ia-border2)",borderRadius:"50px",overflow:"hidden",direction:"ltr"}}>
              <div style={{height:"100%",width:Math.min(100,pct)+"%",background:barColor,borderRadius:"50px",transition:"width .3s,background .3s"}}/>
            </div>
            <div style={{fontSize:"10px",color:"var(--ia-muted)",marginTop:"3px",textAlign:"end",direction:"ltr"}}>{pct.toFixed(0)}{tr("% مستخدم")}{over?tr(` — الرجاء التحصيل قبل فتح فواتير جديدة`):""}</div>
          </div>
        )}
        {/* limit editor */}
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <input className="inp" style={{width:"130px",direction:"ltr",textAlign:"start",padding:"7px 10px",fontSize:"12px"}} type="number" step="0.5" min="0"
            placeholder={tr("حد ائتمان (KD)")} value={shown} onChange={e=>setCreditInput(e.target.value)}
            title={tr("الحد الأقصى للديون المسموح بها لهذا العميل")}/>
          <button className="btn" style={{background:col,color:"#fff",fontSize:"12px",padding:"7px 14px"}} onClick={saveCredit}>{tr("💾 حفظ الحد")}</button>
          {hasLimit&&<button className="btn btn-ghost" style={{fontSize:"11.5px",padding:"7px 12px"}} onClick={()=>{setCreditInput("0");}}>{tr("🗑️ إزالة")}</button>}
          {!hasLimit&&<span style={{fontSize:"10.5px",color:"var(--ia-muted)"}}>{tr("بدون حد — يُستخدم للتنبيه عند إنشاء فواتير جديدة")}</span>}
        </div>
      </div>
      );
    })()}

    {/* Products purchased */}
    {selCustomer.products.length>0&&(
      <div style={{marginBottom:"16px"}}>
        <div style={{fontSize:"11px",fontWeight:900,color:"var(--ia-sub)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"8px"}}>{tr("🛍️ المنتجات المشتراة (")}{selCustomer.products.length})</div>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
          {selCustomer.products.map(p=>(
            <span key={p} style={{background:"var(--ia-chip)",border:"1px solid var(--ia-border)",borderRadius:"20px",padding:"4px 12px",fontSize:"11.5px",color:"var(--ia-text2)",fontWeight:600}}>{p}</span>
          ))}
        </div>
      </div>
    )}

    {/* Invoice history */}
    <div style={{fontSize:"11px",fontWeight:900,color:"var(--ia-sub)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"8px"}}>{tr("🧾 سجل الفواتير — اضغط لعرض الفاتورة")}</div>
    <div style={{border:"1px solid var(--ia-border)",borderRadius:"10px",overflow:"hidden",maxHeight:"300px",overflowY:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12.5px"}}>
        <thead><tr style={{background:"var(--ia-soft)",position:"sticky",top:0,zIndex:1}}>
          {[tr("رقم"),tr("التاريخ"),tr("الإجمالي"),tr("المدفوع"),tr("الحالة")].map(h=>(
            <th key={h} style={{padding:"8px 12px",fontSize:"10.5px",fontWeight:700,color:"var(--ia-sub)",textAlign:"start"}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {customerInvoices.map((inv,i)=>{
            const st=getStatus(inv);
            return(
              <tr key={inv.id} onClick={()=>{setSelCustomer(null);if(onOpenInvoice)onOpenInvoice(inv);}}
                style={{borderBottom:"1px solid var(--ia-border3)",background:i%2===0?"var(--ia-card)":"var(--ia-row-alt)",cursor:"pointer"}}>
                <td style={{padding:"8px 12px"}}><span className="b-inv">{inv.invNum}</span></td>
                <td style={{padding:"8px 12px",color:"var(--ia-sub)",fontSize:"11px"}}>{fDate(inv.date)}</td>
                <td style={{padding:"8px 12px",fontWeight:800,color:colTx}}>{fKWD(iT(inv))}</td>
                <td style={{padding:"8px 12px",color:"#16a34a",fontWeight:600}}>{fKWD(pN(inv.paid||0))}</td>
                <td style={{padding:"8px 12px"}}><span className={`b-${st}`}>{tr(stLabel[st])}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
</div>
</div>
)}

{/* ── r11: Merge Customers Modal ── */}
{mergeOpen&&selCustomer&&(()=>{
  const srcCount=customerInvoices.length;
  const srcPh=phKey(selCustomer.phone);
  const others=customers.filter(c=>phKey(c.phone)!==srcPh);
  const filteredOthers=mergeSearch?others.filter(c=>c.phone.includes(mergeSearch)||c.name.toLowerCase().includes(mergeSearch.toLowerCase())):others;
  const tgtCount=mergeTarget?mergeTarget.count:0;
  const runMerge=async()=>{
    if(!mergeTarget||mergeBusy)return;
    if(!mergeArmed){setMergeArmed(true);return;}
    setMergeBusy(true);
    try{
      const res=await api.mergeClients({
        companySlug:company?.sk,
        from:{phone:selCustomer.phone,name:selCustomer.name},
        to:{phone:mergeTarget.phone,name:mergeTarget.name,address:mergeTarget.address||""},
      });
      toast_(res?.message||tr("✅ تم دمج {0} فاتورة بنجاح",[res?.merged??srcCount]));
      setMergeOpen(false);
      setSelCustomer(null);
      if(onMerged){try{await onMerged();}catch{}}
      try{refreshClients&&refreshClients();}catch{} // r11: حدّث دليل العملاء (حذف صف المصدر)
    }catch(e){
      toast_(tr("فشل الدمج: ")+(e.message||tr("خطأ غير معروف")),"warn");
    }finally{
      setMergeBusy(false);
      setMergeArmed(false);
    }
  };
  return(
  <div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",direction:appDir()}} onClick={()=>!mergeBusy&&setMergeOpen(false)}>
    <div className="card" style={{width:"100%",maxWidth:"560px",maxHeight:"92vh",overflowY:"auto",animation:"fadeUp .25s"}} onClick={e=>e.stopPropagation()}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#b45309,#15803d)",padding:"14px 18px",display:"flex",alignItems:"center",gap:10,margin:"-1px -1px 0"}}>
        <span style={{fontSize:20}}>🔀</span>
        <div style={{flex:1,color:"#fff"}}>
          <div style={{fontWeight:900,fontSize:15}}>{tr("دمج العملاء المكررين")}</div>
          <div style={{fontSize:11.5,opacity:.85}}>{tr("نقل فواتير المصدر إلى العميل الهدف وتوحيد الاسم والرقم")}</div>
        </div>
        <button onClick={()=>!mergeBusy&&setMergeOpen(false)} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"6px 12px",color:"#fff",fontFamily:"inherit",fontSize:12.5,fontWeight:700,cursor:"pointer"}}>{tr("✕ إغلاق")}</button>
      </div>

      <div style={{padding:"16px 18px"}}>
        {/* بطاقة المصدر */}
        <div style={{background:softAdapt("#fef3c7",dark),border:`1.5px solid ${txAdapt("#fbbf24",dark)}55`,borderRadius:12,padding:"12px 14px",marginBottom:10}}>
          <div style={{fontSize:10.5,fontWeight:800,color:txAdapt("#92400e",dark),marginBottom:6}}>{tr("المصدر — سيُدمج في الهدف (لا فواتير تبقى باسمه)")}</div>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div style={{width:38,height:38,borderRadius:10,background:txAdapt("#d97706",dark),color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16,flexShrink:0}}>{(selCustomer.name||"؟").trim().charAt(0)}</div>
            <div style={{flex:1,minWidth:120}}>
              <div style={{fontWeight:900,fontSize:13.5,color:"var(--ia-text)"}}>{selCustomer.name}</div>
              <div style={{fontSize:12,color:"var(--ia-sub)",direction:"ltr",textAlign:"start"}}>{selCustomer.phone}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:15,fontWeight:900,color:txAdapt("#b45309",dark)}}>{srcCount}</div>
              <div style={{fontSize:10,color:"var(--ia-sub)",fontWeight:700}}>{tr("فاتورة")}</div>
            </div>
          </div>
        </div>

        {/* السهم */}
        <div style={{textAlign:"center",fontSize:18,color:"var(--ia-sub)",margin:"2px 0 10px"}}>{mergeTarget?"⬇️":tr("اختر العميل الهدف ⬇️")}</div>

        {/* بطاقة الهدف/المنتقي */}
        {mergeTarget?(
          <div style={{background:softAdapt("#f0fdf4",dark),border:`1.5px solid ${txAdapt("#86efac",dark)}55`,borderRadius:12,padding:"12px 14px",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div style={{width:38,height:38,borderRadius:10,background:"#16a34a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16,flexShrink:0}}>{(mergeTarget.name||"؟").trim().charAt(0)}</div>
              <div style={{flex:1,minWidth:120}}>
                <div style={{fontWeight:900,fontSize:13.5,color:"var(--ia-text)"}}>{mergeTarget.name} <span style={{fontSize:10.5,fontWeight:800,color:txAdapt("#15803d",dark)}}>{tr("الهدف ✓")}</span></div>
                <div style={{fontSize:12,color:"var(--ia-sub)",direction:"ltr",textAlign:"start"}}>{mergeTarget.phone}</div>
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:15,fontWeight:900,color:txAdapt("#15803d",dark)}}>{tgtCount}+{srcCount}</div>
                <div style={{fontSize:10,color:"var(--ia-sub)",fontWeight:700}}>{tr("فاتورة بعد الدمج")}</div>
              </div>
              <button onClick={()=>{setMergeTarget(null);setMergeArmed(false);}} disabled={mergeBusy} className="btn btn-outline" style={{padding:"5px 10px",fontSize:11.5}}>{tr("تغيير")}</button>
            </div>
          </div>
        ):(
          <div style={{border:`1.5px solid var(--ia-border2)`,borderRadius:12,padding:10,marginBottom:10}}>
            <input className="inp" style={{marginBottom:8,padding:"8px 12px"}} placeholder={tr("🔍 ابحث باسم أو رقم العميل الهدف...")} value={mergeSearch} onChange={e=>setMergeSearch(e.target.value)}/>
            <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
              {filteredOthers.length===0?(
                <div style={{padding:14,textAlign:"center",fontSize:12.5,color:"var(--ia-sub)"}}>{tr("لا يوجد عملاء آخرون مطابقون")}</div>
              ):filteredOthers.slice(0,30).map(c=>(
                <button key={c.phone} onClick={()=>{setMergeTarget(c);setMergeArmed(false);}} disabled={mergeBusy}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,border:"1px solid var(--ia-border)",background:"var(--ia-card)",cursor:"pointer",fontFamily:"inherit",textAlign:"start",transition:"all .15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=txAdapt("#16a34a",dark);e.currentTarget.style.background=softAdapt("#f0fdf4",dark);}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--ia-border)";e.currentTarget.style.background="var(--ia-card)";}}>
                  <div style={{width:30,height:30,borderRadius:8,background:softAdapt("#f1f5f9",dark),display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,flexShrink:0}}>{(c.name||"؟").charAt(0)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12.5,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                    <div style={{fontSize:11,color:"var(--ia-sub)",direction:"ltr",textAlign:"start"}}>{c.phone}</div>
                  </div>
                  <span style={{fontSize:10.5,fontWeight:800,color:"var(--ia-sub)",background:softAdapt("#f1f5f9",dark),padding:"2px 8px",borderRadius:12,whiteSpace:"nowrap"}}>{c.count} {tr("فاتورة •")} {fKWD(c.totalSpent)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ملخص وتحذير */}
        {mergeTarget&&(
          <div style={{background:softAdapt("#fef2f2",dark),border:`1px solid ${txAdapt("#fca5a5",dark)}55`,borderRadius:10,padding:"10px 12px",marginBottom:12,fontSize:12,lineHeight:1.9,color:"var(--ia-text2)"}}>
            {tr("سيُنقل")} <b style={{color:txAdapt("#b45309",dark)}}>{srcCount} {tr("فاتورة")}</b> {tr("من «")}{selCustomer.name}{tr("» إلى «")}{mergeTarget.name}{tr("» ويتوحّد الاسم والرقم على العميل الهدف.")}
            <br/>{tr("⚠️ لا يمكن التراجع مباشرة — احتفظ بنسخة احتياطية من تبويب 💾 النظام قبل الدمج عند الشك.")}</div>
        )}

        {/* الأزرار */}
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-outline" onClick={()=>setMergeOpen(false)} disabled={mergeBusy} style={{flex:1,justifyContent:"center"}}>{tr("إلغاء")}</button>
          <button onClick={runMerge} disabled={!mergeTarget||mergeBusy}
            style={{flex:1.4,justifyContent:"center",border:"none",borderRadius:8,padding:"10px 16px",fontFamily:"inherit",fontSize:13,fontWeight:800,cursor:!mergeTarget||mergeBusy?"not-allowed":"pointer",color:"#fff",
              background:mergeArmed?"#dc2626":"#15803d",opacity:!mergeTarget||mergeBusy?.55:1,transition:"all .18s"}}>
            {mergeBusy?tr("⏳ جارٍ الدمج…"):mergeArmed?tr("⚠️ متأكد؟ اضغط مجدداً للتنفيذ"):tr("🔀 تنفيذ الدمج")}
          </button>
        </div>
      </div>
    </div>
  </div>
  );
})()}

<div style={{display:"flex",gap:"10px",marginBottom:"14px",alignItems:"center",flexWrap:"wrap"}}>
<input className="inp" style={{flex:1,minWidth:"200px",padding:"9px 14px"}} placeholder={tr("🔍 ابحث باسم العميل أو التلفون...")} value={search} onChange={e=>setSearch(e.target.value)}/>
<select className="inp" style={{width:"auto",padding:"9px 12px"}} value={sort} onChange={e=>setSort(e.target.value)}>
<option value="spent">{tr("ترتيب: أعلى إنفاق")}</option>
<option value="count">{tr("ترتيب: أكثر فواتير")}</option>
<option value="last">{tr("ترتيب: آخر شراء")}</option>
</select>
{/* ── Import Button (CSV / Excel) ── */}
<button
className="btn"
style={{background:"#0f766e",color:"#fff",whiteSpace:"nowrap",gap:"6px",border:"none",display:"inline-flex",alignItems:"center"}}
onClick={()=>setShowImport(true)}
>
<span style={{fontSize:"15px"}}>📥</span> {tr("استيراد CSV / Excel")}
</button>
{!!perms.export_data&&<button className="btn" style={{background:col,color:"#fff",whiteSpace:"nowrap"}} onClick={()=>exportMetaAudience(invoices)}>{tr("⬇️ تصدير Excel للميتا")}</button>}
</div>
<div style={{display:"grid",gridTemplateColumns:customers.some(c=>creditLimitOf(creditMap,c.phone)>0)?"repeat(auto-fit,minmax(150px,1fr))":"repeat(3,1fr)",gap:"10px",marginBottom:"14px"}}>
{[
{l:tr("إجمالي العملاء"),v:customers.length+tr(" عميل"),c:colTx,bg:cardBg},
{l:tr("إجمالي الإنفاق"),v:fKWD(customers.reduce((s,c)=>s+c.totalSpent,0)),c:txAdapt("#16a34a",dark),bg:softAdapt("#dcfce7",dark)},
{l:tr("متوسط الإنفاق / عميل"),v:fKWD(customers.length?customers.reduce((s,c)=>s+c.totalSpent,0)/customers.length:0),c:txAdapt("#7c3aed",dark),bg:softAdapt("#ede9fe",dark)},
...(customers.some(c=>creditLimitOf(creditMap,c.phone)>0)?[(()=>{
  const overN=customers.filter(c=>{const l=creditLimitOf(creditMap,c.phone);return l>0&&outstandingOf(invoices,c.phone)>l;}).length;
  return{l:tr("متجاوزو حد الائتمان"),v:overN+tr(" عميل"),c:overN>0?txAdapt("#dc2626",dark):txAdapt("#16a34a",dark),bg:overN>0?softAdapt("#fee2e2",dark):softAdapt("#dcfce7",dark)};
})()]:[]),
].map(s=>(
<div key={s.l} style={{background:s.bg,borderRadius:"10px",padding:"12px 16px",border:`1px solid ${s.c}22`}}>
<div style={{fontSize:"10px",color:"var(--ia-sub)",fontWeight:700,textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
<div style={{fontSize:"16px",fontWeight:900,color:s.c}}>{s.v}</div>
</div>
))}
</div>

{/* r9: credit hard-block enforcement toggle (admins only) */}
{isAdmin&&customers.some(c=>creditLimitOf(creditMap,c.phone)>0)&&(
<div style={{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap",background:creditBlock?"var(--ia-red-bg)":"var(--ia-soft)",border:`1.5px solid ${creditBlock?"var(--ia-red-bd)":"var(--ia-border2)"}`,borderRadius:"10px",padding:"11px 16px",marginBottom:"14px"}}>
<span style={{fontSize:"18px"}}>{creditBlock?"⛔":"🟢"}</span>
<div style={{flex:1,minWidth:"220px"}}>
<div style={{fontSize:"13px",fontWeight:900,color:creditBlock?"var(--ia-red-tx)":"var(--ia-text)"}}>{tr("المنع الصارم لتجاوز حدود الائتمان")}</div>
<div style={{fontSize:"11px",color:"var(--ia-sub)",lineHeight:1.6}}>{creditBlock?tr("مُفعّل: لا يستطيع غير المديرين حفظ فاتورة تتجاوز حد ائتمان العميل — يُطبَّق على مستوى الشركة ويُزامن عبر الأجهزة."):tr("غير مُفعّل: يتجاوز الحد يُظهر تحذيراً فقط دون منع الحفظ.")}</div>
</div>
<button onClick={toggleCreditBlock}
title={tr("تبديل سياسة إنفاذ حدود الائتمان لهذه الشركة")}
style={{background:creditBlock?"#dc2626":col,color:"#fff",border:"none",borderRadius:"8px",padding:"8px 16px",fontFamily:"inherit",fontSize:"12.5px",fontWeight:800,cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,.12)",whiteSpace:"nowrap"}}>
{creditBlock?tr("🚫 تعطيل المنع الصارم"):tr("🔒 تفعيل المنع الصارم")}
</button>
</div>
)}
{customers.length===0?(
<div className="card" style={{padding:"48px",textAlign:"center",color:"var(--ia-muted)"}}><div style={{fontSize:"40px",marginBottom:"10px"}}>👥</div><div style={{fontWeight:600}}>{tr("لا توجد عملاء")}</div></div>
):(
<div className="card" style={{overflow:"hidden"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><tr style={{background:"var(--ia-soft)",borderBottom:"2px solid var(--ia-border2)"}}>
{[tr("العميل"),tr("التلفون"),tr("إجمالي الإنفاق"),tr("عدد الفواتير"),tr("آخر شراء"),tr("الرصيد المستحق"),tr("المنتجات"),tr("للميتا")].map(h=>(
<th key={h} className={h===tr("الرصيد المستحق")?"col-credit":undefined} style={{padding:"10px 12px",fontSize:"11px",fontWeight:700,color:"var(--ia-sub)",textAlign:"start",textTransform:"uppercase",letterSpacing:".3px"}}>{h}</th>
))}
</tr></thead>
<tbody>
{customers.map((c,i)=>(
<tr key={c.phone} onClick={()=>setSelCustomer(c)}
style={{borderBottom:"1px solid var(--ia-border3)",background:selCustomer&&selCustomer.phone===c.phone?`${col}0d`:(i%2===0?"var(--ia-card)":"var(--ia-row-alt)"),cursor:"pointer"}}
className="trow">
<td style={{padding:"11px 12px",fontWeight:600,fontSize:"13px"}}>{c.name}</td>
<td style={{padding:"11px 12px",direction:"ltr",textAlign:"start",color:"var(--ia-link)",fontSize:"13px"}}>{c.phone}</td>
<td style={{padding:"11px 12px",fontWeight:700,color:colTx}}>{fKWD(c.totalSpent)}</td>
<td style={{padding:"11px 12px",textAlign:"center"}}><span style={{background:"var(--ia-blue-bg)",color:"var(--ia-blue-tx)",borderRadius:"20px",padding:"2px 8px",fontSize:"11px",fontWeight:700}}>{c.count}</span></td>
<td style={{padding:"11px 12px",color:"var(--ia-sub)",fontSize:"12px"}}>{fDate(c.lastDate)}</td>
<td className="col-credit" style={{padding:"11px 12px"}}>{(()=>{
  const out=outstandingOf(invoices,c.phone);
  const lim=creditLimitOf(creditMap,c.phone);
  const over=lim>0&&out>lim;
  return(
  <span style={{fontSize:"12px",fontWeight:800,color:out<=0?"var(--ia-muted)":over?"var(--ia-red-tx)":"var(--ia-warn-tx)"}}>
    {out>0?fKWD(out):"—"}
    {lim>0&&<span style={{fontSize:"10px",color:"var(--ia-muted)",fontWeight:600}}> / {fKWD(lim)}</span>}
    {over&&<span style={{background:"var(--ia-red-bg)",color:"var(--ia-red-tx)",border:"1px solid var(--ia-red-bd)",borderRadius:"20px",padding:"0 7px",fontSize:"10px",fontWeight:800,marginInlineStart:"5px",display:"inline-block"}}>⛔</span>}
  </span>
  );
})()}</td>
<td style={{padding:"11px 12px",fontSize:"11px",color:"var(--ia-sub)",maxWidth:"160px"}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.products.join("، ")}</div></td>
<td style={{padding:"11px 12px"}}><span style={{background:"var(--ia-sky-bg)",color:"var(--ia-sky-tx)",borderRadius:"6px",padding:"2px 8px",fontSize:"11px",fontWeight:700,direction:"ltr",display:"inline-block"}}>+965{c.phone.replace(/^\+?965/,"")}</span></td>
</tr>
))}
</tbody>
</table>
</div>
)}

{/* Saved-client directory (CRUD backed by /api/clients) */}
<div style={{marginTop:"16px"}}>
<ClientDirectory
  clients={clients||[]}
  invoices={invoices}
  company={company}
  canEdit={!!perms.create_invoice}
  onRefresh={refreshClients}
  toast_={toast_}
/>
</div>
</div>
);
}

// ─── KNET payment-link modal (single invoice) ──────────────────────
function PayLinkModal({ inv, company, onClose, toast_ }) {
const { dark } = useTheme();
const remaining = Math.max(0, iT(inv) - pN(inv.paid || 0));
const [amount, setAmount] = useState(String(remaining.toFixed(3)));
const [tpl, setTpl] = useState(() => getPayLinkTpl(company?.id));
const [showCfg, setShowCfg] = useState(false);
const [copied, setCopied] = useState(false);
// r9: reconcile with the server-side company setting (cross-device sync) on mount
useEffect(()=>{
  let live=true;
  if(!company?.sk)return;
  api.getSettings(company.sk,["paylink_tpl"]).then(s=>{
    if(!live||typeof s.paylink_tpl!=="string")return;
    try{ localStorage.setItem("tw_paylink_"+(company?.id||""),s.paylink_tpl); }catch{}
    setTpl(prev=>prev!==s.paylink_tpl?s.paylink_tpl:prev);
  }).catch(()=>{});
  return()=>{live=false;};
},[company?.sk]);
const amt = pN(amount) || 0;
const link = buildPayLink(tpl, inv, amt);
const msg = payRequestMessage(inv, company, amt, link);
const waHref = waHrefWithText(inv.clientPhone, msg);
const hasPhone = !!norm(inv.clientPhone||"");
const teal = "#0d9488", tealTx = txAdapt(teal, dark);
const tealBg = softAdapt("#ccfbf1", dark);

const copyLink = async () => {
  if (!link) { toast_(tr("لا يوجد رابط دفع مُعد — أضف قالب بوابة الدفع أولاً"), "warn"); return; }
  try { await navigator.clipboard.writeText(link); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = link; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch {}
    ta.remove();
  }
  setCopied(true); setTimeout(() => setCopied(false), 1800);
  toast_(tr("📋 تم نسخ رابط الدفع"));
};

const saveTpl = () => {
  setPayLinkTpl(company, tpl);
  toast_(tpl.trim() ? tr("✅ تم حفظ قالب بوابة الدفع (يتزامن عبر أجهزتك)") : tr("🗑️ تم مسح قالب بوابة الدفع"));
};

return(
<div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:2600,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",direction:appDir()}} onClick={onClose}>
<div className="card" style={{width:"100%",maxWidth:"480px",overflow:"hidden",display:"flex",flexDirection:"column",animation:"fadeUp .25s"}} onClick={e=>e.stopPropagation()}>

  {/* Header */}
  <div style={{background:"linear-gradient(135deg,#0f766e,#0d9488)",padding:"16px 20px",display:"flex",alignItems:"center",gap:"12px",flexShrink:0}}>
    <div style={{width:"42px",height:"42px",background:"rgba(255,255,255,.18)",borderRadius:"12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px"}}>💳</div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{color:"#fff",fontWeight:900,fontSize:"15px"}}>{tr("رابط الدفع الإلكتروني")}</div>
      <div style={{color:"rgba(255,255,255,.8)",fontSize:"12px"}}>{tr("فاتورة")} <b>{inv.invNum}</b> {tr("— المتبقي")} <b>{fKWD(remaining)}</b></div>
    </div>
    <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"6px 12px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>✕</button>
  </div>

  <div style={{overflowY:"auto",flex:1,padding:"16px 20px"}}>

    {/* Amount */}
    <label style={{fontSize:"11px",color:"var(--ia-sub)",fontWeight:700,display:"block",marginBottom:"5px"}}>{tr("💰 المبلغ المطلوب (KD)")}</label>
    <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
      <input className="inp" style={{direction:"ltr",textAlign:"start",fontWeight:800,fontSize:"15px"}} type="number" step="0.001" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/>
      <button className="btn" style={{background:tealBg,color:tealTx,whiteSpace:"nowrap",fontSize:"12px"}} onClick={()=>setAmount(remaining.toFixed(3))} title={tr("إرجاع المبلغ إلى المتبقي الفعلي على الفاتورة")}>{tr("↺ المتبقي")}</button>
    </div>

    {/* Generated link */}
    {link ? (
      <div style={{marginBottom:"14px"}}>
        <div style={{fontSize:"11px",color:"var(--ia-sub)",fontWeight:700,marginBottom:"5px"}}>{tr("🔗 رابط الدفع الجاهز")}</div>
        <div dir="ltr" style={{background:tealBg,border:"1px solid #0d948844",borderRadius:"8px",padding:"10px 12px",fontSize:"11.5px",fontFamily:"monospace",color:tealTx,wordBreak:"break-all",userSelect:"all"}}>{link}</div>
      </div>
    ) : (
      <div style={{background:"var(--ia-warn-bg)",border:"1px solid #fde68a66",borderRadius:"10px",padding:"12px 14px",marginBottom:"14px",fontSize:"12.5px",color:"var(--ia-warn-tx)",lineHeight:1.7}}>
        <b>{tr("⚙️ لم يُضبط رابط بوابة الدفع بعد.")}</b><br/>
        {tr("أضف قالب رابط بوابة الدفع (KPay / MyFatoorah / kNET…) مرة واحدة، وسيتولّى النظام توليد الروابط تلقائياً لكل فاتورة. يمكنك أيضاً إرسال طلب دفع عبر واتساب بدون رابط.")}
        <button className="btn" style={{background:"var(--ia-warn-bg)",border:"1px solid var(--ia-warn-tx)",color:"var(--ia-warn-tx)",fontSize:"11.5px",marginTop:"8px"}} onClick={()=>setShowCfg(true)}>{tr("⚙️ إعداد الآن")}</button>
      </div>
    )}

    {/* Gateway template configuration (collapsible) */}
    {showCfg && (
      <div style={{background:"var(--ia-soft)",border:"1px dashed var(--ia-border2)",borderRadius:"10px",padding:"12px 14px",marginBottom:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:900,color:"var(--ia-text)",marginBottom:"4px"}}>{tr("⚙️ قالب رابط بوابة الدفع")}</div>
        <div style={{fontSize:"11px",color:"var(--ia-sub)",lineHeight:1.7,marginBottom:"8px"}}>
          {tr("الصق رابط بوابة الدفع الخاص بالشركة واستخدم العناصر البديلة:")}
          <span dir="ltr" style={{fontFamily:"monospace",color:tealTx}}>{"{amount}"}</span> {tr("للمبلغ،")}
          <span dir="ltr" style={{fontFamily:"monospace",color:tealTx}}>{"{invoice}"}</span> {tr("لرقم الفاتورة.")}
        </div>
        <div style={{display:"flex",gap:"8px"}}>
          <input className="inp" dir="ltr" style={{fontFamily:"monospace",fontSize:"11.5px"}} placeholder="https://kpay.com.kw/pay/XXXX?amt={amount}" value={tpl} onChange={e=>setTpl(e.target.value)}/>
          <button className="btn" style={{background:teal,color:"#fff",whiteSpace:"nowrap"}} onClick={saveTpl}>{tr("💾 حفظ")}</button>
        </div>
        <div style={{fontSize:"10.5px",color:"var(--ia-muted)",marginTop:"6px"}}>{tr("💾 يُحفظ لشركة")} {company?.nameAr} {tr("على الخادم — يتزامن تلقائياً عبر كل الأجهزة")}</div>
      </div>
    )}
    {!showCfg && link && (
      <button className="btn btn-ghost" style={{fontSize:"11.5px",marginBottom:"14px",padding:"6px 12px"}} onClick={()=>setShowCfg(true)}>{tr("⚙️ تعديل قالب بوابة الدفع")}</button>
    )}

    {/* WhatsApp preview */}
    <div style={{background:softAdapt("#dcfce7",dark),border:"1px solid #86efac55",borderRadius:"10px",padding:"11px 14px",fontSize:"12px",color:"var(--ia-text2)",whiteSpace:"pre-wrap",lineHeight:1.8,maxHeight:"170px",overflowY:"auto"}}>
      <div style={{fontSize:"11px",fontWeight:900,color:txAdapt("#15803d",dark),marginBottom:"4px"}}>{tr("📣 معاينة رسالة الطلب (واتساب)")}</div>
      {msg}
    </div>
  </div>

  {/* Footer actions */}
  <div style={{padding:"14px 20px",borderTop:"1px solid var(--ia-border)",display:"flex",gap:"8px",flexShrink:0,flexWrap:"wrap"}}>
    <button className="btn" style={{background:teal,color:"#fff",flex:1,justifyContent:"center"}} onClick={copyLink}>{copied?tr("✅ تم النسخ"):tr("📋 نسخ رابط الدفع")}</button>
    {hasPhone && (
      <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn wa-btn" style={{color:"#fff",textDecoration:"none",flex:1,justifyContent:"center"}}
        onClick={()=>logReminderSent(inv,company,waHref,"payment_request")}>{tr("📣 إرسال واتساب")}</a>
    )}
    <button className="btn btn-ghost" onClick={onClose}>{tr("إغلاق")}</button>
  </div>
</div>
</div>
);
}

// ─── Bulk WhatsApp reminders modal (overdue collections) ──────────
function BulkWaRemindersModal({ overdue, company, onClose, toast_ }) {
const { dark } = useTheme();
const col = company.color;
const colTx = txAdapt(col, dark);
// only invoices that actually have a reachable phone can be messaged
const sendable = overdue.filter(inv => waReminderHref(inv, company));
const [sel, setSel] = useState(() => sendable.map(i => i.id));
const [copied, setCopied] = useState(false);
const allSel = sendable.length > 0 && sendable.every(i => sel.includes(i));
const toggleAll = () => setSel(allSel ? [] : sendable.map(i => i.id));
const toggleOne = id => setSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
const chosen = sendable.filter(i => sel.includes(i.id));
const totalDue = chosen.reduce((s, i) => s + (iT(i) - pN(i.paid || 0)), 0);

const copyNumbers = async () => {
  const nums = chosen.map(i => "+965" + norm(i.clientPhone || "").replace(/^\+?965/, ""));
  if (!nums.length) { toast_(tr("لا توجد فواتير محددة"), "warn"); return; }
  const text = nums.join(", ");
  try { await navigator.clipboard.writeText(text); }
  catch {
    // fallback for older browsers / non-secure contexts
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch {}
    ta.remove();
  }
  setCopied(true); setTimeout(() => setCopied(false), 1800);
  toast_(tr("📋 تم نسخ ") + nums.length + tr(" رقم — الصقها في قائمة Broadcast في واتساب"));
};

const sendAll = () => {
  if (!chosen.length) { toast_(tr("حدّد فاتورة واحدة على الأقل"), "warn"); return; }
  chosen.forEach((inv, i) => {
    const href = waReminderHref(inv, company);
    logReminderSent(inv, company, href);
    setTimeout(() => { try { window.open(href, "_blank"); } catch {} }, i * 400);
  });
  toast_(tr("🚀 جارٍ فتح واتساب لـ ") + chosen.length + tr(" عميل"));
};

return(
<div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:2200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",direction:appDir()}} onClick={onClose}>
  <div className="card" style={{width:"100%",maxWidth:"560px",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",animation:"fadeUp .25s"}} onClick={e=>e.stopPropagation()}>

    {/* Header */}
    <div style={{background:col,padding:"15px 20px",display:"flex",alignItems:"center",gap:"12px",flexShrink:0}}>
      <div style={{width:"42px",height:"42px",background:"rgba(255,255,255,.18)",borderRadius:"11px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",flexShrink:0}}>📣</div>
      <div style={{flex:1,minWidth:0,color:"#fff"}}>
        <div style={{fontWeight:900,fontSize:"15px"}}>{tr("تذكير جماعي بالسداد")}</div>
        <div style={{fontSize:"11.5px",opacity:.8}}>{sendable.length} {tr("فاتورة متأخرة بإجمالي متبقٍ")} {fKWD(overdue.reduce((s,i)=>s+iT(i)-pN(i.paid||0),0))}</div>
      </div>
      <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"6px 12px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer",flexShrink:0}}>✕</button>
    </div>

    {/* Actions bar */}
    <div style={{display:"flex",gap:"8px",alignItems:"center",padding:"12px 18px",borderBottom:"1px solid var(--ia-border3)",background:"var(--ia-soft)",flexWrap:"wrap",flexShrink:0}}>
      <label style={{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer",fontSize:"12px",fontWeight:800,color:"var(--ia-text2)",userSelect:"none"}}>
        <input type="checkbox" checked={allSel} onChange={toggleAll} style={{accentColor:col,cursor:"pointer",width:"15px",height:"15px"}}/>
        {tr("تحديد الكل")}
      </label>
      <span style={{fontSize:"11.5px",fontWeight:700,color:"var(--ia-sub)"}}>{chosen.length} {tr("محدد •")} {fKWD(totalDue)}</span>
      <div style={{flex:1}}/>
      <button className="btn" style={{background:copied?"#15803d":"#2563eb",color:"#fff",padding:"6px 12px",fontSize:"12px"}} onClick={copyNumbers}>{copied?tr("✅ تم النسخ"):tr("📋 نسخ الأرقام")}</button>
      <button className="btn wa-btn" style={{color:"#fff",padding:"6px 12px",fontSize:"12px"}} onClick={sendAll}>{tr("🚀 إرسال (")}{chosen.length})</button>
    </div>

    {/* Rows */}
    <div style={{overflowY:"auto",flex:1,padding:"10px 14px"}}>
      {sendable.length===0?(
        <div style={{textAlign:"center",color:"var(--ia-muted)",padding:"32px 0"}}>
          <div style={{fontSize:"34px",marginBottom:"8px"}}>👍</div>
          <div style={{fontWeight:700,fontSize:"13px"}}>{tr("كل الفواتير المتأخرة بلا أرقام تلفون")}</div>
        </div>
      ):sendable.map(inv=>{
        const checked=sel.includes(inv.id);
        const due=iT(inv)-pN(inv.paid||0);
        const od=overdueDays(inv);
        return(
          <div key={inv.id} onClick={()=>toggleOne(inv.id)}
            style={{display:"flex",alignItems:"center",gap:"10px",padding:"9px 10px",borderRadius:"9px",marginBottom:"6px",cursor:"pointer",
              background:checked?`${col}0d`:"var(--ia-card)",border:`1px solid ${checked?`${col}33`:"var(--ia-border)"}`,transition:"all .12s"}}>
            <input type="checkbox" checked={checked} onChange={()=>toggleOne(inv.id)} onClick={e=>e.stopPropagation()} style={{accentColor:col,cursor:"pointer",width:"15px",height:"15px",flexShrink:0}}/>
            <div style={{width:"30px",height:"30px",background:softAdapt(company.cardBg,dark),border:`1px solid ${col}33`,color:colTx,borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:900,flexShrink:0}}>
              {(inv.clientName||"؟").trim().charAt(0)}
            </div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontWeight:700,fontSize:"12.5px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inv.clientName||inv.clientPhone}</div>
              <div style={{fontSize:"10.5px",color:"var(--ia-sub)",direction:"ltr",textAlign:"start"}}>{inv.clientPhone}</div>
            </div>
            <span className="b-inv" style={{flexShrink:0}}>{inv.invNum}</span>
            <div style={{textAlign:"end",flexShrink:0,minWidth:"70px"}}>
              <div style={{fontWeight:900,fontSize:"12.5px",color:"var(--ia-red-tx)",direction:"ltr"}}>{fKWD(due)}</div>
              <div style={{fontSize:"10px",fontWeight:800,color:"var(--ia-red-tx)"}}>⏰ {od} {tr("يوم")}</div>
            </div>
            <a href={waReminderHref(inv,company)} target="_blank" rel="noopener noreferrer" className="btn wa-btn" title={tr("إرسال تذكير لهذا العميل")}
              style={{color:"#fff",padding:"5px 8px",fontSize:"12px",textDecoration:"none",flexShrink:0}}
              onClick={e=>{e.stopPropagation();logReminderSent(inv,company,waReminderHref(inv,company));}}>📣</a>
          </div>
        );
      })}
    </div>

    {/* Footer hint */}
    <div style={{padding:"10px 18px",borderTop:"1px solid var(--ia-border3)",background:"var(--ia-soft)",fontSize:"11px",color:"var(--ia-sub)",lineHeight:1.7,flexShrink:0}}>
      {tr("💡 سيفتح زر «إرسال» محادثة واتساب لكل عميل على حدة (برسالة جاهزة).\n      لإرسال قائمة تذكير واحدة للجميع استخدم «نسخ الأرقام» ثم أنشئ")} <b>Broadcast</b> {tr("في واتساب.\n      اسمح بالـ Popups للمتصفح.")}
    </div>
  </div>
</div>
);
}

// ─── MAIN APP ─────────────────────────────────────────────────────

// r22: قائمة التبويبات كدالة مستوى-وحدة تُستدعى وقت الرندر — تُترجم بلغة
// اللحظة (كانت تُقيَّم بثابت داخل الرندر نفسه فتبقى بلغة الوصول الأولى)
const TABS_LIST=()=>[
{id:"dash",l:tr("📊 الرئيسية")},
{id:"list",l:tr("📋 الفواتير")},
{id:"customers",l:tr("👥 العملاء")},
{id:"payments",l:tr("💳 المدفوعات")},
{id:"reports",l:tr("📈 التقارير")},
{id:"new",l:tr("➕ جديد")},
{id:"bulk",l:tr("📦 مجمع")},
{id:"ai",l:"🤖 AI"},
{id:"chat",l:tr("💬 المساعد الذكي")},
{id:"print",l:tr("🖨️ طباعة")},
{id:"purchase",l:tr("🛒 المشتريات")},
{id:"reminders",l:tr("🔔 التذكيرات")},
{id:"account",l:tr("👤 حسابي")},
{id:"help",l:tr("❓ المساعدة")},
{id:"deepseek",l:"🧠 DeepSeek"},
{id:"site",l:tr("🌐 الموقع")},
{id:"system",l:tr("💾 النظام")},
];

export default function App(){
const { user, profile, loading: authLoading, isAdmin, canEdit, allowedCompanies, perms } = useAuth();
// r20: i18n التطبيق — مزامنة اللغة العالمية + إعادة رندر الشجرة عند التبديل
const { dir, lang } = useAppI18n();
// r22: التبويبات تُحسب كل رندر — تترجم فوراً عند تبديل اللغة (TABS_LIST معرّفة أعلى الوحدة)
const TABS=TABS_LIST();
const [selectedCompany,setCompany]=useState(null);
const [invoices,setInvoices]=useState([]);
const [view,setView]=useState("dash");
const [search,setSearch]=useState("");
const [selInv,setSelInv]=useState(null);
const [printRange,setPrintRange]=useState({from:"",to:""});
const [bulkText,setBulkText]=useState("");
const [bulkParsed,setBulkParsed]=useState([]);
const [bulkStep,setBulkStep]=useState(0);
// r16: معالجة الإدخال المجمع بالذكاء الاصطناعي (زر المعالجة والإضافة)
const [bulkAiBusy,setBulkAiBusy]=useState(false);
const [bulkAiUsed,setBulkAiUsed]=useState(false);
const [bulkAiErr,setBulkAiErr]=useState("");
const [toast,setToast]=useState(null);
const [pdfBusy,setPdfBusy]=useState(false);
const [printStyle,setPrintStyle]=useState("classic");
const [,setSettingsTick]=useState(0); // r9: re-render tick after server settings land (credit banner in the new-invoice form re-reads localStorage)
const setPStyle=v=>{setPrintStyle(v);try{localStorage.setItem("tw_print_style_"+(company?.id||""),v);}catch{}};
const [delModal,setDelModal]=useState(null);
const [showImportModal,setShowImportModal]=useState(false);
const [showAdmin,setShowAdmin]=useState(false);
const [editingInv,setEditingInv]=useState(null);
const [editForm,setEditForm]=useState(null);
const [selectedIds,setSelectedIds]=useState([]);
const [statusFilter,setStatusFilter]=useState("all");
const [purchasePreSelect,setPurchasePreSelect]=useState([]);
const [page,setPage]=useState(1);
const [pageSize,setPageSize]=useState(10);
const [sortKey,setSortKey]=useState("date_desc");
const [clients,setClients]=useState([]);
const [invLoading,setInvLoading]=useState(false);
const [showBulkWa,setShowBulkWa]=useState(false); // bulk WhatsApp reminders modal
const [payLinkInv,setPayLinkInv]=useState(null); // KNET payment-link modal invoice
const [dbCompanies,setDbCompanies]=useState(null); // r12: سجل الشركات من الخادم (null = لم يُحمّل)
const [companyModal,setCompanyModal]=useState(null); // r12: {mode:'create'} | {mode:'edit',company}
const [onboardingSkipped,setOnboardingSkipped]=useState(()=>{ // r25: تخطّي/إتمام التهيئة (عبر التخزين المحلي)
  try{ return localStorage.getItem("garfix_onboarded")==="1"; }catch{ return false; }
});
const [invError,setInvError]=useState(false); // r25: فشل تحميل الفواتير — حالة خطأ قابلة للإجراء
const { dark, toggle } = useTheme();   // light/dark theme (hooks must run before early returns)

const emptyForm=()=>({clientName:"",clientPhone:"",clientAddress:"",items:[{name:"",desc:"",qty:1,price:""}],shipping:0,taxRate:"",date:today(),dueDate:addD(today(),30),paid:0,notes:""});
const [form,setForm]=useState(emptyForm());

// Filter available companies based on user permissions
// r12: يُدمج سجل الخادم فوق الإعدادات المحلية — المدير يرى كل الشركات (بما فيها المضافة حديثاً)،
// والموظف يرى فقط ما في قائمته. حقول DB غير الفارغة تتفوق على الافتراضيات hard-coded.
const COMPANIES_MERGED = (() => {
  const merged = {};
  for (const [k, co] of Object.entries(COMPANIES)) merged[k] = co;
  for (const row of dbCompanies || []) {
    const base = Object.values(COMPANIES).find(c => c.sk === row.slug);
    if (base) {
      merged[base.id] = {
        ...base,
        ...(row.name && { name: row.name }),
        ...(row.nameAr && { nameAr: row.nameAr }),
        ...(row.phone && { phone: row.phone }),
        ...(row.email && { email: row.email }),
        ...(row.address && { address: row.address }),
        ...(row.city && { city: row.city }),
        ...(row.sellerRef && { sellerRef: row.sellerRef }),
        ...(row.manager && { manager: row.manager }),
        ...(row.managerPhone && { managerPhone: row.managerPhone }),
        ...(row.color && { color: row.color }),
        ...(row.accent && { accent: row.accent }),
        ...(row.cardBg && { cardBg: row.cardBg }),
        ...(row.emoji && { emoji: row.emoji, logo: row.emoji }),
        currency: row.currency || "KWD",
        dbRow: row,
      };
    } else {
      // شركة مضافة كلياً من الواجهة — بلا افتراضيات محلية
      merged[row.code || row.slug] = {
        id: row.code || row.slug, sk: row.slug, name: row.name, nameAr: row.nameAr || row.name,
        logo: row.emoji || "🏢", phone: row.phone || "", email: row.email || "", address: row.address || "",
        city: row.city || "", sellerRef: row.sellerRef || "", manager: row.manager || "", managerPhone: row.managerPhone || "",
        color: row.color || "#334155", accent: row.accent || "#64748b",
        bg: `linear-gradient(135deg, ${(row.color || "#334155")} 0%, #0f172a 100%)`,
        cardBg: row.cardBg || "#f1f5f9", emoji: row.emoji || "🏢",
        currency: row.currency || "KWD", dbRow: row,
      };
    }
  }
  return merged;
})();

// r16: مطابقة بالكود (الأنظمة المدمجة) أو بالـ slug (شركات المشتركين المسجّلين من الخادم)
const availableCompanies = Object.values(COMPANIES_MERGED).filter(co =>
  isAdmin ? true : (allowedCompanies.includes(co.id) || allowedCompanies.includes(co.sk))
);

// Auto-direct single-company users straight to their dashboard (skip selector).
// Derived during render instead of an effect (lint-clean, no cascading renders):
// when logged out (allowedCompanies empty) this resolves back to null automatically.
const company = (!authLoading && selectedCompany===null && availableCompanies.length===1)
  ? availableCompanies[0]
  : selectedCompany;

// r12: سجل الشركات من الخادم — يُحمّل مرة بعد الدخول (الإعدادات hard-coded تبقى fallback)
useEffect(()=>{
  if(!user)return;
  let live=true;
  api.listCompanies().then(rows=>{ if(live)setDbCompanies(rows); }).catch(()=>{ if(live)setDbCompanies([]); });
  return()=>{live=false;};
},[user?.uid]);

// r12: عملة الجلسة تتبع الشركة النشطة — كل تنسيقات المبالغ (fKWD→fmtMoney) تقرأها
useEffect(()=>{
  if(!company)return;
  setCurrency(company.currency||"KWD");
},[company?.id,company?.currency]);

// per-company persisted print style (falls back to the legacy global key once).
// Must run AFTER the `company` derivation above (TDZ) and before early returns.
useEffect(()=>{
  if(!company)return;
  let v="classic";
  try{ v=localStorage.getItem("tw_print_style_"+company.id)||localStorage.getItem("tw_print_style")||"classic"; }catch{}
  setPrintStyle(v);
},[company?.id]);

// r9: sync server-side company settings (pay-link template + credit limits) into the
// localStorage caches whenever the company changes; server wins, legacy local-only
// values are migrated up. Bumping the tick re-renders the new-invoice form so its
// live credit-limit banner re-reads the refreshed cache.
useEffect(()=>{
  if(!company)return;
  let live=true;
  syncSettingsFromServer(company).then(()=>{ if(live)setSettingsTick(t=>t+1); });
  return()=>{live=false;};
},[company?.id]);

const refreshInvoices = useCallback(async () => {
  if (!company) return;
  setInvLoading(true);
  setInvError(false);
  try {
    const invs = await api.listInvoices(company.sk);
    if (invs.length === 0) {
      const local = dbGet(company.sk) || [];
      if (local.length > 0) {
        for (const inv of local) {
          try { await api.createInvoice({ ...inv, companySlug: company.sk }, company.sk); } catch {}
        }
        const migrated = await api.listInvoices(company.sk);
        setInvoices(migrated);
        dbSet(company.sk, migrated);
        return;
      }
    }
    setInvoices(invs);
    dbSet(company.sk, invs);
  } catch {
    setInvoices(dbGet(company.sk) || []);
    setInvError(true); // r25: حالة خطأ قابلة للإجراء في اللوحة
  } finally {
    setInvLoading(false);
  }
}, [company]);

useEffect(()=>{
if(!company)return;
// refreshInvoices is async — every setState inside it runs after an await,
// so this is the standard data-fetching effect, not a synchronous cascade.
 
refreshInvoices();
},[company, refreshInvoices]);

const refreshClients = useCallback(async () => {
  if (!company) return;
  try { setClients((await api.listClients(company.id)) || []); } catch {}
}, [company]);

useEffect(()=>{
if(!company)return;
// Same async data-fetching pattern as refreshInvoices above.
 
refreshClients();
},[company, refreshClients]);

const logout=async()=>{ await logoutUser(); setCompany(null); };

const persist=useCallback(async list=>{
setInvoices(list);
if(company)dbSet(company.sk,list);
},[company]);

const toast_=(msg,type="ok")=>{setToast({msg,type});setTimeout(()=>setToast(null),2600);};

// r16: بعد حفظ شركة (إضافة/تعديل) — أعد تحميل السجل وحدّث الشركة النشطة فوراً إن كانت هي
// وللمشترك المسجّل: حدّث ملفه من الخادم (شركته الجديدة تظهر فوراً في المُنتقي)
const onCompanySaved=async()=>{
  setCompanyModal(null);
  try{
    const rows=await api.listCompanies();
    setDbCompanies(rows);
    setCompany(c=>{
      if(!c)return c;
      const row=rows.find(r=>r.slug===c.sk);
      if(!row)return c;
      return {...c,
        ...(row.name&&{name:row.name}), ...(row.nameAr&&{nameAr:row.nameAr}),
        ...(row.phone&&{phone:row.phone}), ...(row.email&&{email:row.email}),
        ...(row.address&&{address:row.address}), ...(row.city&&{city:row.city}),
        ...(row.sellerRef&&{sellerRef:row.sellerRef}), ...(row.manager&&{manager:row.manager}),
        ...(row.managerPhone&&{managerPhone:row.managerPhone}),
        ...(row.color&&{color:row.color}), ...(row.accent&&{accent:row.accent}),
        ...(row.cardBg&&{cardBg:row.cardBg}), ...(row.emoji&&{emoji:row.emoji,logo:row.emoji}),
        currency:row.currency||c.currency||"KWD", dbRow:row};
    });
    // r16: المشترك المسجّل — مزامنة ملفه (قائمة شركاته) من الخادم
    const { refreshAuthUser } = await import("./firebase/auth");
    refreshAuthUser().catch(()=>{});
  }catch{}
};
const setField=(k,v)=>setForm(f=>({...f,[k]:v}));
const setItem=(i,k,v)=>setForm(f=>{const items=[...f.items];items[i]={...items[i],[k]:v};return{...f,items};});
const setEditField=(k,v)=>setEditForm(f=>({...f,[k]:v}));
const setEditItem=(i,k,v)=>setEditForm(f=>{const items=[...f.items];items[i]={...items[i],[k]:v};return{...f,items};});

const openEdit=(inv)=>{
  setEditingInv(inv);
  setEditForm({
    clientName:inv.clientName||"",clientPhone:inv.clientPhone||"",
    clientAddress:inv.clientAddress||"",
    items:inv.items.map(it=>({...it})),
    shipping:inv.shipping??0,taxRate:inv.taxRate??0,date:inv.date,dueDate:inv.dueDate,
    paid:inv.paid??0,notes:inv.notes||"",status:inv.status||"",
  });
  setSelInv(null);
  setView("edit");
};

const updateInvoice=async()=>{
  if(!editForm.clientPhone&&!editForm.clientName){toast_(tr("يرجى إدخال التلفون أو الاسم"),"warn");return;}
  const phone=norm(editForm.clientPhone);const name=editForm.clientName||phone||tr("عميل");
  const updated={...editingInv,clientName:name,clientPhone:phone,
    clientAddress:editForm.clientAddress,
    items:editForm.items.map(it=>({...it,qty:parseInt(toW(String(it.qty)))||1,price:pN(it.price)})),
    shipping:pN(editForm.shipping),taxRate:(editForm.taxRate!==""&&editForm.taxRate!=null?pN(editForm.taxRate):companyTax(company)),date:editForm.date,dueDate:editForm.dueDate,
    paid:pN(editForm.paid),notes:editForm.notes,status:editForm.status||"",updatedAt:new Date().toISOString()};
  const list=invoices.map(inv=>inv.id===updated.id?updated:inv);
  await persist(list);
  api.updateInvoice(updated.id,{...updated,companySlug:company?.sk}).then(()=>refreshInvoices()).catch(()=>{});
  toast_(tr("✅ تم تحديث الفاتورة ")+updated.invNum);
  setEditingInv(null);setEditForm(null);setView("list");
};

const toggleSelect=(id)=>setSelectedIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
const deleteSelected=async()=>{
  if(!selectedIds.length)return;
  if(!confirm(tr("هل تريد حذف {0} فاتورة؟",[selectedIds.length])))return;
  const list=invoices.filter(inv=>!selectedIds.includes(inv.id));
  await persist(list);
  Promise.all(selectedIds.map(id=>api.deleteInvoice(id))).then(()=>refreshInvoices()).catch(()=>{});
  toast_(tr("🗑️ تم حذف {0} فاتورة",[selectedIds.length]),"warn");
  setSelectedIds([]);
};
const printSelected=()=>{
  const list=invoices.filter(inv=>selectedIds.includes(inv.id)).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  if(list.length)doPrint(list,company,printStyle);
};

// Auto-register the invoice's client in the saved-client directory (dedupe by phone).
// Fire-and-forget: directory is a convenience, invoice creation must never fail because of it.
const autoRegisterClient = (inv) => {
  if (!company || !inv) return;
  const phone = norm(inv.clientPhone || "");
  if (!phone) return;
  if (clients.some(c => norm(c.phone || "") === phone)) return;
  api.createClient({
    name: inv.clientName || phone,
    phone,
    email: null,
    address: inv.clientAddress || null,
    company: company.id,
  }).then(() => refreshClients()).catch(() => {});
};

const saveInvoice=async()=>{
if(!form.clientPhone&&!form.clientName){toast_(tr("يرجى إدخال التلفون أو الاسم"),"warn");return;}
const phone=norm(form.clientPhone);
const name=form.clientName||phone||tr("عميل");
// r9: credit hard-block — when the company enforces limits and the client would exceed
// theirs, non-admin users are blocked from saving (admins proceed with a warning toast).
{
  const lim=creditLimitOf(loadCreditMap(company.id),phone);
  if(lim>0&&getCreditBlock(company.id)){
    const out=outstandingOf(invoices,phone);
    const sub=form.items.reduce((s,it)=>s+(parseInt(toW(it.qty))||1)*pN(it.price),0)+pN(form.shipping);
    if(out+sub>lim){
      if(!isAdmin){
        toast_(tr("⛔ منع الحفظ — تجاوز حد الائتمان: الرصيد {0} + هذه الفاتورة {1} = {2} (الحد {3}). يرجى التحصيل أولاً أو مراجعة الإدارة.",[fKWD(out),fKWD(sub),fKWD(out+sub),fKWD(lim)]),"err");
        return;
      }
      toast_(tr("⚠️ تم تجاوز حد الائتمان بفارق {0} — الحفظ مسموح لك بصفتك مدير النظام",[fKWD(out+sub-lim)]),"warn");
    }
  }
}
const newInv={id:Date.now(),invNum:nxtN(invoices),clientName:name,clientPhone:phone,
clientAddress:form.clientAddress,items:form.items.map(it=>({...it,qty:parseInt(toW(it.qty))||1,price:pN(it.price)})),
shipping:pN(form.shipping),taxRate:(form.taxRate!==""&&form.taxRate!=null?pN(form.taxRate):companyTax(company)),date:form.date,dueDate:form.dueDate,paid:pN(form.paid),notes:form.notes,createdAt:new Date().toISOString()};
const list=[...invoices,newInv];
await persist(list);
api.createInvoice({...newInv,companySlug:company?.sk},company?.sk).then(()=>refreshInvoices()).catch(()=>{});
autoRegisterClient(newInv);
toast_(tr("✅ تم حفظ الفاتورة ")+newInv.invNum);
setForm(emptyForm());setView("list");
};

const confirmDelete=async()=>{
if(!delModal)return;
const list=invoices.filter(i=>i.id!==delModal.id);
await persist(list);
api.deleteInvoice(delModal.id).then(()=>refreshInvoices()).catch(()=>{});
setDelModal(null);
if(selInv?.id===delModal.id)setSelInv(null);
toast_(tr("🗑️ تم الحذف"),"warn");
};

const saveBulk=async()=>{
const list=[...invoices];
const newBulk=[];
bulkParsed.forEach(b=>{
  const running=[...list,...newBulk];
  newBulk.push({id:Date.now()+Math.random(),invNum:nxtN(running),
  clientName:b.clientName||b.clientPhone||tr("عميل"),clientPhone:norm(b.clientPhone),
  clientAddress:b.clientAddress,items:b.items,shipping:pN(b.shipping||0),
  date:b.date,dueDate:b.dueDate,paid:0,notes:"",createdAt:new Date().toISOString()});
});
await persist([...list,...newBulk]);
api.bulkCreateInvoices(newBulk.map(v=>({...v,taxRate:v.taxRate??companyTax(company)})),company?.sk).then(()=>refreshInvoices()).catch(()=>{});
setBulkStep(2);toast_(tr("✅ تم حفظ {0} فاتورة",[bulkParsed.length]));
};

// r16: معالجة الإدخال المجمع بالذكاء الاصطناعي — «زرار المعالجة والإضافة بالذكاء الاصطناعي»
// نص حر بأي صيغة (إيموجي واتساب / عادي / مختلط) → طلبات منظّمة للمراجعة ثم الحفظ
const processBulkAI=async()=>{
  if(!bulkText.trim())return;
  setBulkAiBusy(true);setBulkAiErr("");
  try{
    const res=await fetch("/api/ai/process-bulk",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({rawText:bulkText.trim()}),
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);
    const orders=(data.orders||[]).map(o=>({
      clientName:o.clientName||tr("عميل"),
      clientPhone:o.clientPhone||"",
      clientAddress:o.clientAddress||"",
      items:(o.items||[]).map(it=>({name:it.name||tr("منتج"),desc:it.desc||"",qty:Number(it.qty)||1,price:String(it.price??"")})),
      shipping:Number(o.shipping)||0,
      date:today(),dueDate:addD(today(),30),paid:0,notes:"",
    }));
    if(!orders.length)throw new Error(tr("لم يُستخرج أي طلب من النص"));
    setBulkParsed(orders);
    setBulkAiUsed(true);
    setBulkStep(1);
    toast_(tr("🤖 عولج {0} طلب بالذكاء الاصطناعي",[orders.length]));
  }catch(e){
    setBulkAiErr(e.message||tr("تعذرّت المعالجة الذكية"));
  }finally{
    setBulkAiBusy(false);
  }
};

const printRangeList=()=>{
const fn=parseInt(toW(printRange.from).replace(/\D/g,""))||0;
const tn=parseInt(toW(printRange.to).replace(/\D/g,""))||999999;
return invoices.filter(inv=>{const n=parseInt(inv.invNum?.replace(/\D/g,"")||0);return n>=fn&&n<=tn;})
.sort((a,b)=>parseInt(a.invNum?.replace(/\D/g,"")||0)-parseInt(b.invNum?.replace(/\D/g,"")||0));
};
const doPrintRange=()=>{
const list=printRangeList();
if(!list.length){toast_(tr("لا توجد فواتير في هذا النطاق"),"warn");return;}
doPrint(list, company, printStyle);
};

const SORTS={
  // r22: التسميات نصوص عربية خام — تُترجم وقت الرندر (tr عند العرض) لا وقت تحميل الوحدة
  date_desc:{label:"الأحدث أولاً",fn:(a,b)=>new Date(b.createdAt)-new Date(a.createdAt)},
  date_asc:{label:"الأقدم أولاً",fn:(a,b)=>new Date(a.createdAt)-new Date(b.createdAt)},
  total_desc:{label:"المبلغ: الأعلى",fn:(a,b)=>iT(b)-iT(a)},
  total_asc:{label:"المبلغ: الأقل",fn:(a,b)=>iT(a)-iT(b)},
  overdue:{label:"المتأخرة أولاً",fn:(a,b)=>overdueDays(b)-overdueDays(a)},
};
const filtered=invoices.filter(inv=>{
if(statusFilter!=="all"&&getStatus(inv)!==statusFilter)return false;
if(!search)return true;
const s=toW(search).toLowerCase();
return inv.clientPhone?.includes(s)||inv.clientName?.toLowerCase().includes(s)||inv.invNum?.toLowerCase().includes(s);
}).sort(SORTS[sortKey]?.fn||SORTS.date_desc.fn);
const safePS = (Number.isFinite(pageSize) && pageSize > 0) ? Math.floor(pageSize) : 10;
const totalPages=Math.max(1,Math.ceil(filtered.length/safePS));
const safePage=Math.min(Math.max(1,page),totalPages);
const pageInvs=filtered.slice((safePage-1)*safePS,safePage*safePS);
const goToPage=p=>setPage(Math.max(1,Math.min(totalPages,Math.round(p)||1)));
const statusCounts={all:invoices.length,paid:0,part:0,unp:0,cancel:0};
invoices.forEach(inv=>{statusCounts[getStatus(inv)]=(statusCounts[getStatus(inv)]||0)+1;});
const overdueList=invoices.filter(inv=>overdueDays(inv)>0);
const allSel=pageInvs.length>0&&pageInvs.every(inv=>selectedIds.includes(inv.id));
const toggleSelectAll=()=>setSelectedIds(allSel?[]:pageInvs.map(inv=>inv.id));

const exportInvoicesCSV=()=>{
  if(!company)return;
  const a=document.createElement("a");
  a.href=`/api/invoices/export?companySlug=${encodeURIComponent(company.sk)}`;
  a.download=`Invoices_${company.id}_${today()}.csv`;
  document.body.appendChild(a);a.click();a.remove();
  toast_(tr("⬇️ تم تنزيل ملف CSV"));
};

// r20: تصدير Excel (.xlsx) — نفس أعمدة تصدير CSV مع تنسيق RTL للعربية
const exportInvoicesExcel=()=>{
  if(!company)return;
  const rows=invoices.map(inv=>{
    const st=getStatus(inv);
    const items=inv.items||[];
    return {
      [tr("رقم الفاتورة")]:inv.invNum,
      "العميل":inv.clientName,
      "الهاتف":inv.clientPhone||"",
      "العنوان":inv.clientAddress||"",
      [tr("التاريخ")]:inv.date,
      "تاريخ الاستحقاق":inv.dueDate,
      [tr("المنتجات")]:items.map(it=>`${it.name} × ${it.qty||1}`).join(" ، "),
      [tr("عدد المنتجات")]:items.length,
      [tr("التوصيل")]:Number(pN(inv.shipping||0).toFixed(3)),
      [tr("الإجمالي")]:Number(iT(inv).toFixed(3)),
      [tr("المدفوع")]:Number(pN(inv.paid||0).toFixed(3)),
      [tr("المتبقي")]:Number(Math.max(0,iT(inv)-pN(inv.paid||0)).toFixed(3)),
      [tr("الحالة")]:tr(stLabel[st]||st),
      [tr("ملاحظات")]:inv.notes||"",
    };
  });
  const ws=XLSX.utils.json_to_sheet(rows);
  ws["!cols"]=[{wch:13},{wch:22},{wch:16},{wch:22},{wch:12},{wch:14},{wch:42},{wch:11},{wch:10},{wch:12},{wch:12},{wch:12},{wch:12},{wch:28}];
  const wb=XLSX.utils.book_new();
  wb.Workbook={Views:[{RTL:true}]};
  XLSX.utils.book_append_sheet(wb,ws,tr("الفواتير"));
  XLSX.writeFile(wb,`Invoices_${company.id}_${today()}.xlsx`);
  toast_(tr("📊 تم تنزيل ملف Excel"));
};

// r16: توجيه hash داخل مسار / الواحد — #/ أو #/team أو #/founder أو #/login أو #/reset?token=…
// تفتح صفحات الموقع العام (للزائر قبل الدخول، وللمدير كمعاينة بعد الدخول)
const [sitePage,setSitePage]=useState(null);
useEffect(()=>{
  const apply=()=>{
    const m=location.hash.match(/^#\/(team|founder|login|reset|pricing)?(\?.*)?$/);
    setSitePage(m?(m[1]||"home"):null);
  };
  apply();
  window.addEventListener("hashchange",apply);
  return ()=>window.removeEventListener("hashchange",apply);
},[]);

// dynamic browser-tab title: "القسم | الشركة — نظام إدارة الحسابات"
useEffect(()=>{
  // r13: الموقع العام يضبط عنوانه بنفسه (قبل الدخول أو عند المعاينة عبر hash)
  if(sitePage||!user)return;
  const extra={edit:tr("تعديل فاتورة"),bulk:tr("الإدخال المجمع")};
  const t=TABS.find(x=>x.id===view);
  const tabLabel=t?t.l.replace(/^\S+\s/,""):(extra[view]||"");
  const apply=()=>{document.title=company
    ?tr("{0}{1} — نظام إدارة الحسابات",[tabLabel?tabLabel+" | ":"",companyName(company)])
    :tr("نظام إدارة الحسابات — الشركة القابضة المتحدة");};
  apply();
  // React قد يعيد تطبيق عنوان metadata عند اكتمال الإنعاش — إعادة ضبط متأخرة تفوز بالسباق
  const id=setTimeout(apply,700);
  return ()=>clearTimeout(id);
},[company,view,sitePage,user,lang]);
// بعد دخول المستخدم من #/login: ننظّف الهاش بلا قفزة ونعود للتطبيق
useEffect(()=>{
  if(user&&sitePage==="login"){
    history.replaceState(null,"",location.pathname+location.search);
    setSitePage(null);
  }
},[user,sitePage]);

if(authLoading&&!sitePage)return(
<div style={{minHeight:"100vh",background:"#0f1f3d",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"Cairo,sans-serif",fontSize:"16px",flexDirection:"column",gap:"16px"}}>
<div style={{fontSize:"40px"}}>🛒</div><div>{tr("جارٍ التحميل...")}</div>
</div>
);

// r13: صفحات الموقع العام (hash) — تعمل قبل الدخول وكمعاينة بعده
const enterApp=()=>{
  history.replaceState(null,"",location.pathname+location.search);
  setSitePage(null);
};
if(sitePage&&!(sitePage==="login"&&user)){
  return <PublicSite page={sitePage} authed={!!user} onEnterApp={enterApp}/>;
}

// الزائر غير المسجّل: يرى الموقع العام (الرئيسية) — الدخول من زر «تسجيل الدخول»
if(!user)return <PublicSite page="home" authed={false} onEnterApp={()=>{}}/>;
if(!company){
  // r25: المشترك بلا شركات → تجربة تهيئة Business OS (شركة جديدة في أقل من دقيقتين، بلا دفع)
  const isSubscriberUser = profile?.role === "subscriber";
  if(isSubscriberUser && availableCompanies.length===0 && !onboardingSkipped && !companyModal){
    return <Onboarding
      onDone={async (row, quickKey)=>{
        try{ localStorage.setItem("garfix_onboarded","1"); }catch{}
        setOnboardingSkipped(true);
        try{
          const rows=await api.listCompanies();
          setDbCompanies(rows);
          const { refreshAuthUser } = await import("./firebase/auth");
          refreshAuthUser().catch(()=>{});
          if(row){
            // تحديد الشركة الجديدة فوراً (بنفس منطق دمج سجل الخادم)
            setCompany({
              id: row.code || row.slug, sk: row.slug, name: row.name, nameAr: row.nameAr || row.name,
              logo: row.emoji || "🏢", phone: row.phone || "", email: row.email || "", address: row.address || "",
              city: row.city || "", sellerRef: row.sellerRef || "", manager: row.manager || "", managerPhone: row.managerPhone || "",
              color: row.color || "#334155", accent: row.accent || row.color || "#64748b",
              bg: `linear-gradient(135deg, ${(row.color || "#334155")} 0%, #0f172a 100%)`,
              cardBg: row.cardBg || "#f1f5f9", emoji: row.emoji || "🏢", currency: row.currency || "KWD", dbRow: row,
            });
          }
        }catch{}
        // نقطة البدء السريع المختارة
        setView(quickKey==="createInvoice"?"new":quickKey==="addCustomer"?"customers":quickKey==="importData"?"list":quickKey==="askAI"?"chat":"dash");
        if(quickKey==="importData") setTimeout(()=>setShowImportModal(true),400);
      }}
      onCancel={()=>{ try{ localStorage.setItem("garfix_onboarded","1"); }catch{} setOnboardingSkipped(true); }}
    />;
  }
  return <>
  <CompanySelector companies={availableCompanies} onSelect={co=>{setCompany(co);setView("dash");}} onAdd={()=>setCompanyModal({mode:"create"})} onEdit={co=>setCompanyModal({mode:"edit",company:co})}/>
  {companyModal&&(
    <CompanyForm
      mode={companyModal.mode}
      company={companyModal.company}
      onClose={()=>setCompanyModal(null)}
      onSaved={onCompanySaved}
      toast={toast_}
    />
  )}
</>;
}

const col = company.color;
const colTx = txAdapt(col, dark);          // readable company color for TEXT on cards
const cardBg = softAdapt(company.cardBg, dark); // soft tinted surface (KPI/summary boxes)

// ── r25: أسلاك غلاف Business OS ─────────────────────────────────────
// تبديل الشركة مباشرة من منتقي الشريط الجانبي
const switchToCompany = co => {
  if(!co || co.id===company.id) return;
  setCompany(co); setView("dash"); setSelInv(null); setSearch(""); setSelectedIds([]);
};
// إجراءات لوحة الأوامر/الإجراءات السريعة/FAB — تفتح مسار العمل المناسب فوراً
const quickAction = (key, payload) => {
  switch(key){
    case "createInvoice": setView("new"); setSelInv(null); break;
    case "addCustomer":
      setView("customers"); setSelInv(null);
      setTimeout(()=>window.dispatchEvent(new CustomEvent("garfix-add-customer")),90);
      break;
    case "recordPayment": setView("payments"); break;
    case "importData": setView("list"); setShowImportModal(true); break;
    case "viewReports": setView("reports"); break;
    case "askAI": setView("chat"); setSelInv(null); break;
    case "openInvoice": if(payload){ setSelInv(payload); setView("list"); } break;
    case "openCustomer":
      setView("customers");
      if(payload) setTimeout(()=>window.dispatchEvent(new CustomEvent("garfix-open-customer",{detail:{phone:payload.phone,name:payload.name}})),90);
      break;
  }
};
// إجراءات صفوف اللوحة (عرض/تعديل/تكرار/PDF/إرسال/تسجيل دفعة/تذكير/جماعي/عميل)
const waOpen = inv => {
  const href=waReminderHref(inv,company);
  if(href){ logReminderSent(inv,company,href); window.open(href,"_blank","noopener"); }
};
const invCallbacks = {
  onView: inv=>{ setSelInv(inv); setView("list"); },
  onEdit: inv=>openEdit(inv),
  onDuplicate: inv=>{
    setForm({
      clientName:inv.clientName||"",clientPhone:inv.clientPhone||"",clientAddress:inv.clientAddress||"",
      items:(inv.items||[]).map(it=>({...it})),
      shipping:inv.shipping??0,taxRate:inv.taxRate??"",date:today(),dueDate:addD(today(),30),
      paid:0,notes:inv.notes||"",
    });
    setView("new"); setSelInv(null);
    toast_(tr("✅ فاتورة مكررة — جاهزة للتعديل"));
  },
  onPdf: inv=>{ doPdfExport([inv],company,{toast:toast_,setBusy:setPdfBusy,styleId:printStyle}); },
  onSend: inv=>waOpen(inv),
  onRecordPayment: inv=>{ setSelInv(inv); setView("list"); },
  onSendReminder: row=>{ // صف عميل من اللوحة → أفتح فاتورته المتأخرة الأبرز
    const inv=(row.invs||[]).slice().sort((a,b)=>overdueDays(b)-overdueDays(a))[0];
    if(inv) waOpen(inv);
    else toast_(tr("لا فاتورة متبقية لهذا العميل"),"warn");
  },
  onBulkRemind: ()=>{ if(overdueList.length) setShowBulkWa(true); },
  onOpenCustomer: row=>{
    setView("customers");
    setTimeout(()=>window.dispatchEvent(new CustomEvent("garfix-open-customer",{detail:{phone:row.phone,name:row.name}})),90);
  },
};
// تنبيهات الشريط العلوي (مشتقة من البيانات الحية)
const paidTodayCount=invoices.filter(i=>i.date===today()&&getStatus(i)==="paid").length;
const shellAlerts=[];
if(overdueList.length) shellAlerts.push({id:"overdue",kind:"bad",title:tr("{0} فاتورة متأخرة عن الاستحقاق",[overdueList.length]),sub:tr("اطّلع وأرسل تذكيرات السداد"),go:()=>setView("reminders")});
if(paidTodayCount) shellAlerts.push({id:"paidtoday",kind:"ok",title:tr("{0} فواتير حُصّلت اليوم",[paidTodayCount]),sub:tr("تحصيل يمشي بشكل ممتاز"),go:()=>setView("payments")});
shellAlerts.push({id:"ai",kind:"ai",title:tr("GarfiX AI جاهز"),sub:tr("اسأل بياناتك ونفّذ الإجراءات بمراجعة بشرية"),go:()=>setView("chat")});
const overdueCount = overdueList.length;
const canAddCompany = isAdmin || profile?.role === "subscriber";

return(
<AppShell
  dir={dir}
  view={view}
  onNavigate={v=>{setView(v);setSelInv(null);setBulkStep(0);}}
  company={company}
  companies={availableCompanies}
  onSwitchCompany={switchToCompany}
  onAddCompany={canAddCompany?()=>setCompanyModal({mode:"create"}):undefined}
  onEditCompany={co=>setCompanyModal({mode:"edit",company:co})}
  user={user} profile={profile} isAdmin={isAdmin} perms={perms}
  dark={dark} onToggleTheme={toggle}
  invoices={invoices} clients={clients}
  alerts={shellAlerts} onOpenAlert={a=>a.go&&a.go()}
  onLogout={logout} onOpenUsers={()=>setShowAdmin(true)}
  onManagePlan={()=>setView("account")}
  overdueCount={overdueCount}
  onAction={quickAction}
  onRefreshData={()=>{ refreshInvoices(); refreshClients(); }}
>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap'); *{box-sizing:border-box} .inp{width:100%;border:1.5px solid var(--ia-border2);border-radius:8px;padding:9px 12px;font-family:inherit;font-size:13px;background:var(--ia-inp-bg);color:var(--ia-text);outline:none;transition:border .15s,box-shadow .15s} .inp:focus{border-color:${col};box-shadow:0 0 0 3px ${col}1a} .inp:hover{border-color:var(--ia-muted)} .inp::placeholder{color:var(--ia-muted)} .btn{border:none;border-radius:8px;padding:9px 16px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:5px;white-space:nowrap} .btn:hover{filter:brightness(1.06);box-shadow:0 2px 10px rgba(0,0,0,.12)} .btn:active{opacity:.85;transform:scale(.97)} .btn-ghost{background:var(--ia-ghost-bg);color:var(--ia-ghost-tx)} .btn-outline{background:transparent;border:1.5px solid var(--ia-border2);color:var(--ia-text2)} .btn-outline:hover{border-color:${col};color:${colTx}} .btn-red{background:#dc2626;color:#fff} .card{background:var(--ia-card);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.07);border:1px solid var(--ia-border)} [data-theme="dark"] .card{box-shadow:0 1px 3px rgba(0,0,0,.35)} .trow{transition:background .12s} .trow:hover,.trow:active{background:var(--ia-hover);cursor:pointer} .inv-table tbody tr:last-child td{border-bottom:none} .b-paid{background:var(--ia-ok-bg);color:var(--ia-ok-tx);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700} .b-paid::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ia-ok-tx);margin-inline-end:5px;vertical-align:middle} .b-part{background:var(--ia-warn-bg);color:var(--ia-warn-tx);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700} .b-part::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ia-warn-tx);margin-inline-end:5px;vertical-align:middle} .b-unp{background:var(--ia-red-bg);color:var(--ia-red-tx);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700} .b-unp::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ia-red-tx);margin-inline-end:5px;vertical-align:middle} .b-cancel{background:var(--ia-chip);color:var(--ia-sub);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700;text-decoration:line-through} .b-inv{background:var(--ia-blue-bg);color:var(--ia-blue-tx);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700;letter-spacing:.3px} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} @keyframes garfixAIPulse{0%,100%{transform:scale(1);box-shadow:0 10px 28px rgba(0,0,0,.4)}50%{transform:scale(1.06);box-shadow:0 12px 34px rgba(0,0,0,.5)}} @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}} .io-btn{background:#0f766e;} .inv-table{width:100%;border-collapse:collapse} .inv-table th{padding:10px 10px;font-size:11px;font-weight:700;color:var(--ia-sub);text-align:start;text-transform:uppercase;letter-spacing:.3px} .inv-table td{padding:10px 10px;border-bottom:1px solid var(--ia-border3);font-size:13px} .col-addr,.col-date,.col-phone,.col-credit{display:none} @media(min-width:500px){.col-phone{display:table-cell}} @media(min-width:680px){.col-date{display:table-cell}.col-credit{display:table-cell}} .form-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px} .form-3col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px} .item-row{display:grid;grid-template-columns:2fr 65px 110px auto;gap:7px;margin-bottom:7px;align-items:center} @media(max-width:500px){.form-2col{grid-template-columns:1fr}.form-3col{grid-template-columns:1fr 1fr}.item-row{grid-template-columns:1fr 55px 90px auto}} .kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px} .kpi-grid>div{transition:transform .18s,box-shadow .18s} .kpi-grid>div:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.08)} @media(min-width:600px){.kpi-grid{grid-template-columns:repeat(4,1fr)}} .chart-grid{display:grid;grid-template-columns:1fr;gap:12px} @media(min-width:680px){.chart-grid{grid-template-columns:1.7fr 1fr}} .print-grid{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end} @media(max-width:480px){.print-grid{grid-template-columns:1fr 1fr;} .print-grid .print-btn{grid-column:1/-1}} .cust-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px} @media(max-width:480px){.cust-stats{grid-template-columns:1fr}} .io-btn{background:linear-gradient(135deg,#0f766e,#0d9488)!important;border:none;box-shadow:0 2px 8px rgba(15,118,110,.3);transition:all .2s!important} .io-btn:hover{box-shadow:0 4px 14px rgba(15,118,110,.45)!important;transform:translateY(-1px)} ::-webkit-scrollbar{width:9px;height:9px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:var(--ia-border2);border-radius:8px;border:2px solid var(--ia-bg)} ::-webkit-scrollbar-thumb:hover{background:var(--ia-muted)} .sk{position:relative;overflow:hidden;background:var(--ia-skel);border-radius:6px} .sk::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);animation:shimmer 1.4s infinite} [data-theme="dark"] .sk::after{background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent)} @keyframes shimmer{100%{transform:translateX(100%)}} .sk-sm{height:11px} .sk-lg{height:22px} .btn:focus-visible,.inp:focus-visible{outline:2.5px solid ${col};outline-offset:2px} .wa-btn{background:#16a34a!important;transition:all .18s!important} .wa-btn:hover{background:#15803d!important;box-shadow:0 4px 14px rgba(22,163,74,.4)!important;transform:translateY(-1px)} .garfix-ai-bubble{transition:transform .18s cubic-bezier(.2,.8,.3,1)} .garfix-ai-bubble:hover{animation-play-state:paused;transform:scale(1.1)} .garfix-ai-bubble:active{transform:scale(.93)} .garfix-ai-bubble:hover .garfix-ai-tip,.garfix-ai-bubble:focus-visible .garfix-ai-tip{opacity:1;transform:translateY(0)} .garfix-ai-bubble:focus-visible{outline:2.5px solid ${col};outline-offset:3px} @media(max-width:900px){.garfix-ai-bubble{display:none}} select.inp{cursor:pointer;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:left 10px center;padding-left:26px} .print-chip:hover{transform:translateY(-2px);border-color:var(--ia-muted)!important;box-shadow:0 5px 16px rgba(0,0,0,.09)} [data-theme="dark"] .print-chip:hover{box-shadow:0 5px 16px rgba(0,0,0,.45)} .chart-grid>div{transition:box-shadow .18s} .chart-grid>div:hover{box-shadow:0 4px 16px rgba(0,0,0,.06)} [data-theme="dark"] .chart-grid>div:hover{box-shadow:0 4px 16px rgba(0,0,0,.4)} [data-theme="dark"] .kpi-grid>div:hover{box-shadow:0 6px 18px rgba(0,0,0,.45)} [data-theme="dark"] .btn:hover{filter:brightness(1.15)}`}</style>

  {/* Admin Dashboard Modal */}
  {showAdmin&&<AdminDashboard onClose={()=>setShowAdmin(false)} companies={availableCompanies}/>}
  {companyModal&&(
    <CompanyForm
      mode={companyModal.mode}
      company={companyModal.company}
      onClose={()=>setCompanyModal(null)}
      onSaved={onCompanySaved}
      toast={toast_}
    />
  )}

  {/* Import Modal (CSV / Excel) — Invoices tab */}
  {showImportModal&&(
    <ImportModal
      company={company}
      existingInvoices={invoices}
      onImport={async newInvs=>{
        setInvoices(p=>[...p,...newInvs]);
        api.bulkCreateInvoices(newInvs.map(v=>({...v,taxRate:v.taxRate??companyTax(company)})),company?.sk).then(()=>refreshInvoices()).catch(()=>{});
        setShowImportModal(false);
        toast_(tr("✅ تم استيراد {0} فاتورة من الملف",[newInvs.length]));
        setView("list");
      }}
      onClose={()=>setShowImportModal(false)}
    />
  )}

  {/* Toast */}
  {toast&&<div role="status" aria-live="polite" style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:toast.type==="warn"?"#f59e0b":"#16a34a",color:"#fff",padding:"8px 20px",borderRadius:"50px",fontWeight:700,fontSize:"13px",boxShadow:"0 4px 16px rgba(0,0,0,.2)",animation:"toastIn .2s",whiteSpace:"nowrap"}}>{toast.msg}</div>}

  {/* Bulk WhatsApp reminders modal (overdue) */}
  {showBulkWa&&(
    <BulkWaRemindersModal
      overdue={overdueList}
      company={company}
      onClose={()=>setShowBulkWa(false)}
      toast_={toast_}
    />
  )}

  {/* KNET payment-link modal */}
  {payLinkInv&&(
    <PayLinkModal
      inv={payLinkInv}
      company={company}
      onClose={()=>setPayLinkInv(null)}
      toast_={toast_}
    />
  )}

  {/* Delete Modal */}
  {delModal&&(
    <div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setDelModal(null)}>
      <div className="card" style={{padding:"28px 32px",textAlign:"center",maxWidth:"320px",animation:"fadeUp .2s"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:"38px",marginBottom:"8px"}}>🗑️</div>
        <div style={{fontWeight:700,fontSize:"15px",marginBottom:"6px"}}>{tr("تأكيد الحذف")}</div>
        <div style={{color:"var(--ia-sub)",fontSize:"13px",marginBottom:"18px"}}>{tr("سيتم حذف الفاتورة")} <b>{delModal.invNum}</b> {tr("نهائياً")}</div>
        <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
          <button className="btn btn-red" onClick={confirmDelete}>{tr("نعم، احذف")}</button>
          <button className="btn btn-ghost" onClick={()=>setDelModal(null)}>{tr("إلغاء")}</button>
        </div>
      </div>
    </div>
  )}

  <div className="gx-anim">

    {/* DASHBOARD — r25: لوحة GarfiX Business OS الإنتاجية */}
    {view==="dash"&&(
      <DashboardHome
        invoices={invoices}
        clients={clients}
        company={company}
        companiesCount={availableCompanies.length}
        usersCount={clients.length||1}
        loading={invLoading}
        error={invError&&invoices.length===0}
        onRetry={()=>{ refreshInvoices(); refreshClients(); }}
        profileName={profile?.displayName||""}
        onNavigate={go=>{ if(go&&go.status)setStatusFilter(go.status); setView(go&&go.view?go.view:go); setSelInv(null); }}
        onAction={quickAction}
        invCallbacks={invCallbacks}
        statusFilterSetter={setStatusFilter}
      />
    )}

    {/* CUSTOMERS */}
    {view==="customers"&&(
      <div style={{animation:"fadeUp .25s"}}>
        <Customers
          invoices={invoices}
          company={company}
          clients={clients}
          refreshClients={refreshClients}
          toast_={toast_}
          printStyle={printStyle}
          onMerged={refreshInvoices}
          onOpenInvoice={inv=>{setSelInv(inv);setView("list");}}
          onImportDone={async newInvs=>{
            setInvoices(p=>[...p,...newInvs]);
            api.bulkCreateInvoices(newInvs.map(v=>({...v,taxRate:v.taxRate??companyTax(company)})),company?.sk).then(()=>refreshInvoices()).catch(()=>{});
            toast_(tr(`✅ تم استيراد البيانات من الملف بنجاح`));
          }}
        />
      </div>
    )}

    {/* LIST */}
    {view==="list"&&!selInv&&(
      <div style={{animation:"fadeUp .25s"}}>
        <div style={{display:"flex",gap:"10px",marginBottom:"10px",alignItems:"center",flexWrap:"wrap"}}>
          <input className="inp" style={{flex:1,padding:"10px 14px",minWidth:"180px"}} placeholder={tr("🔍 ابحث بالتلفون أو الاسم أو رقم الفاتورة...")} value={search} onChange={e=>{setSearch(e.target.value);setSelectedIds([]);setPage(1);}}/>
          <button className="btn io-btn" style={{color:"#fff",gap:"6px"}} onClick={()=>setShowImportModal(true)}>
            <span style={{fontSize:"15px"}}>📥</span> {tr("استيراد CSV / Excel")}
          </button>
          <button className="btn io-btn" style={{color:"#fff",gap:"6px"}} onClick={exportInvoicesCSV}>
            <span style={{fontSize:"15px"}}>⬇️</span> {tr("تصدير CSV")}
          </button>
          <button className="btn io-btn" style={{color:"#fff",gap:"6px"}} onClick={exportInvoicesExcel}>
            <span style={{fontSize:"15px"}}>📊</span> {tr("تصدير Excel")}
          </button>
          <span style={{fontSize:"12px",color:"var(--ia-sub)",whiteSpace:"nowrap"}}>{filtered.length} {tr("فاتورة")}</span>
        </div>

        {/* Sort + page size bar */}
        <div style={{display:"flex",gap:"8px",marginBottom:"12px",alignItems:"center",flexWrap:"wrap"}}>
          <select className="inp" style={{width:"auto",padding:"6px 10px",fontSize:"12px",fontWeight:700,color:"var(--ia-text2)"}} value={sortKey} onChange={e=>{setSortKey(e.target.value);setPage(1);}}>
            {Object.entries(SORTS).map(([k,v])=><option key={k} value={k}>↕️ {tr(v.label)}</option>)}
          </select>
          <select className="inp" style={{width:"auto",padding:"6px 10px",fontSize:"12px",fontWeight:700,color:"var(--ia-text2)"}} value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>
            {[10,25,50,100].map(n=><option key={n} value={n}>{n} {tr("/ صفحة")}</option>)}
          </select>
          <div style={{flex:1}}/>
          {overdueList.length>0&&(
            <span style={{fontSize:"11.5px",fontWeight:800,color:"var(--ia-red-tx)",background:"var(--ia-red-bg)",border:"1px solid var(--ia-red-bd)",borderRadius:"20px",padding:"4px 12px"}}>⏰ {overdueList.length} {tr("فاتورة متأخرة عن الاستحقاق")}</span>
          )}
          {overdueList.length>0&&(
            <button className="btn wa-btn" style={{color:"#fff",padding:"6px 12px",fontSize:"12px",gap:"5px"}} onClick={()=>setShowBulkWa(true)} title={tr("إرسال تذكير واتساب لكل العملاء المتأخرين")}>
              <span style={{fontSize:"13px"}}>📣</span> {tr("تذكير جماعي")}
            </button>
          )}
        </div>

        {/* Status filter chips */}
        <div style={{display:"flex",gap:"7px",marginBottom:"12px",flexWrap:"wrap",alignItems:"center"}}>
          {["all","paid","part","unp","cancel"].map(sf=>{
            const active=statusFilter===sf;
            const cnt=statusCounts[sf]||0;
            const c=txAdapt(stColor[sf]||col, dark);
            return(
              <button key={sf} onClick={()=>{setStatusFilter(sf);setSelectedIds([]);setPage(1);}}
                style={{
                  border:`1.5px solid ${active?c:"var(--ia-border)"}`,
                  background:active?`${c}14`:"var(--ia-card)",
                  color:active?c:"var(--ia-sub)",
                  borderRadius:"20px",
                  padding:"5px 13px",
                  fontFamily:"inherit",
                  fontSize:"12px",
                  fontWeight:700,
                  cursor:"pointer",
                  transition:"all .15s",
                  display:"inline-flex",
                  alignItems:"center",
                  gap:"6px",
                }}>
                {sf==="all"?tr("📋 الكل"):sf==="paid"?"✅ ":sf==="part"?"🟡 ":sf==="unp"?"🔴 ":"⛔ "}{sf!=="all"?tr(stLabel[sf]):""}
                <span style={{background:active?`${c}22`:"var(--ia-chip)",borderRadius:"12px",padding:"1px 7px",fontSize:"10px",fontWeight:900}}>{cnt}</span>
              </button>
            );
          })}
        </div>

        {/* Bulk actions bar */}
        {selectedIds.length>0&&(
          <div style={{display:"flex",gap:"8px",alignItems:"center",background:`${col}0d`,border:`1.5px solid ${col}33`,borderRadius:"9px",padding:"9px 14px",marginBottom:"10px",flexWrap:"wrap"}}>
            <span style={{fontSize:"13px",fontWeight:800,color:colTx}}>{selectedIds.length} {tr("محدد")}</span>
            <div style={{flex:1}}/>
            {!!perms.print_invoice&&<button className="btn" style={{background:col,color:"#fff",padding:"6px 12px",fontSize:"12px"}} onClick={printSelected}>{tr("🖨️ طباعة المحددة")}</button>}
            <button className="btn" style={{background:"#7c3aed",color:"#fff",padding:"6px 12px",fontSize:"12px"}} onClick={()=>{setPurchasePreSelect([...selectedIds]);setSelectedIds([]);setView("purchase");}}>{tr("🛒 توليد فاتورة مشتريات")}</button>
            {!!perms.delete_invoice&&<button className="btn btn-red" style={{padding:"6px 12px",fontSize:"12px"}} onClick={deleteSelected}>{tr("🗑️ حذف المحددة")}</button>}
            <button className="btn btn-ghost" style={{padding:"6px 10px",fontSize:"12px"}} onClick={()=>setSelectedIds([])}>{tr("✕ إلغاء التحديد")}</button>
          </div>
        )}

        {filtered.length===0?(
          <div className="card" style={{padding:"56px",textAlign:"center",color:"var(--ia-muted)"}}>
            <div style={{fontSize:"44px",marginBottom:"10px"}}>📄</div>
            <div style={{fontWeight:600,marginBottom:"14px"}}>{tr("لا توجد فواتير")}</div>
            <button className="btn io-btn" style={{color:"#fff"}} onClick={()=>setShowImportModal(true)}>{tr("📥 استورد فواتيرك (CSV / Excel)")}</button>
          </div>
        ):(
          <div className="card" style={{overflow:"hidden"}}>
            <table className="inv-table">
              <thead><tr style={{background:"var(--ia-soft)",borderBottom:"2px solid var(--ia-border2)"}}>
                <th style={{width:"38px",textAlign:"center",padding:"8px"}}>
                  <input type="checkbox" checked={allSel} onChange={toggleSelectAll}
                    style={{cursor:"pointer",width:"15px",height:"15px",accentColor:col}}/>
                </th>
                <th>{tr("رقم")}</th><th>{tr("العميل")}</th>
                <th className="col-phone">{tr("التلفون")}</th>
                <th className="col-date">{tr("التاريخ")}</th>
                <th>{tr("المبلغ")}</th><th>{tr("الحالة")}</th><th></th>
              </tr></thead>
              <tbody>
                {pageInvs.map(inv=>{
                  const st=getStatus(inv);
                  const isSel=selectedIds.includes(inv.id);
                  return(
                    <tr key={inv.id} className="trow" onClick={()=>setSelInv(inv)}
                      style={{background:isSel?`${col}0a`:""}}>
                      <td onClick={e=>e.stopPropagation()} style={{textAlign:"center",padding:"8px"}}>
                        <input type="checkbox" checked={isSel} onChange={()=>toggleSelect(inv.id)}
                          style={{cursor:"pointer",width:"15px",height:"15px",accentColor:col}}/>
                      </td>
                      <td>
                        <span className="b-inv">{inv.invNum}</span>
                        {(inv.source==="import")&&<span title={tr("فاتورة مستوردة من ملف")} style={{marginInlineStart:"4px",fontSize:"10px",background:"#ccfbf1",color:"#0f766e",borderRadius:"4px",padding:"1px 5px",fontWeight:700}}>📥</span>}
                      </td>
                      <td style={{fontWeight:600}}>{inv.clientName}</td>
                      <td className="col-phone" style={{direction:"ltr",textAlign:"start",color:"var(--ia-link)"}}>{inv.clientPhone}</td>
                      <td className="col-date" style={{color:"var(--ia-sub)",fontSize:"12px"}}>
                        {fDate(inv.date)}
                        {overdueDays(inv)>0&&(
                          <span style={{display:"block",marginTop:"2px",fontSize:"10px",fontWeight:800,color:"var(--ia-red-tx)",background:"var(--ia-red-bg)",borderRadius:"4px",padding:"1px 6px",width:"fit-content"}}>
                            {tr("⏰ متأخرة")} {overdueDays(inv)} {tr("يوم")}
                          </span>
                        )}
                      </td>
                      <td style={{fontWeight:700}}>{fKWD(iT(inv))}</td>
                      <td>
                        <span className={`b-${st}`}>{tr(stLabel[st])}</span>
                      </td>
                      <td onClick={e=>e.stopPropagation()}>
                        <div style={{display:"flex",gap:"4px"}}>
                          {overdueDays(inv)>0&&norm(inv.clientPhone)&&(
                            <a href={waReminderHref(inv,company)} target="_blank" rel="noopener noreferrer" className="btn wa-btn"
                              title={tr("إرسال تذكير بالسداد عبر واتساب (رسالة جاهزة)")}
                              style={{color:"#fff",padding:"5px 8px",fontSize:"12px",textDecoration:"none"}}
                              onClick={e=>{e.stopPropagation();logReminderSent(inv,company,waReminderHref(inv,company));}}>
                              📣
                            </a>
                          )}
                          {!!perms.print_invoice&&<button className="btn" title={tr("طباعة الفاتورة")} style={{background:col,color:"#fff",padding:"5px 8px",fontSize:"12px"}} onClick={e=>{e.stopPropagation();doPrint([inv],company,printStyle);}}>🖨️</button>}
                          {!!perms.print_invoice&&<button className="btn" title={tr("تصدير PDF")} disabled={pdfBusy} style={{background:"#dc2626",color:"#fff",padding:"5px 8px",fontSize:"12px"}} onClick={e=>{e.stopPropagation();doPdfExport([inv],company,{toast:toast_,setBusy:setPdfBusy,styleId:printStyle});}}>📄</button>}
                          {!!perms.edit_invoice&&<button className="btn" title={tr("تعديل الفاتورة")} style={{background:"#f59e0b",color:"#fff",padding:"5px 8px",fontSize:"12px"}} onClick={e=>{e.stopPropagation();openEdit(inv);}}>✏️</button>}
                          {!!perms.delete_invoice&&<button className="btn btn-red" title={tr("حذف الفاتورة")} style={{padding:"5px 8px",fontSize:"12px"}} onClick={e=>{e.stopPropagation();setDelModal(inv);}}>🗑️</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filtered.length>0&&totalPages>1&&(
          <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"12px",flexWrap:"wrap",justifyContent:"center"}}>
            <button className="btn btn-ghost" style={{padding:"5px 12px",fontSize:"12px",opacity:safePage<=1?.5:1}} disabled={safePage<=1} onClick={()=>goToPage(safePage-1)}>{tr("→ السابق")}</button>
            {Array.from({length:totalPages}).slice(0,7).map((_,i)=>{
              let p=i+1;
              if(totalPages>7){
                if(p>4&&p<totalPages-2){
                  if(p===5)return<span key={p} style={{color:"var(--ia-muted)",fontSize:"12px",padding:"0 2px"}}>…</span>;
                  return null;
                }
              }
              const active=p===safePage;
              return(
                <button key={p} onClick={()=>goToPage(p)} style={{
                  border:`1.5px solid ${active?col:"var(--ia-border)"}`,background:active?col:"var(--ia-card)",
                  color:active?"#fff":"var(--ia-sub)",borderRadius:"7px",padding:"4px 11px",
                  fontFamily:"inherit",fontSize:"12px",fontWeight:800,cursor:"pointer",transition:"all .15s",
                }}>{p}</button>
              );
            })}
            <button className="btn btn-ghost" style={{padding:"5px 12px",fontSize:"12px",opacity:safePage>=totalPages?.5:1}} disabled={safePage>=totalPages} onClick={()=>goToPage(safePage+1)}>{tr("التالي ←")}</button>
            <span style={{fontSize:"11px",color:"var(--ia-muted)",marginInlineStart:"8px"}}>{(safePage-1)*safePS+1}–{Math.min(safePage*safePS,filtered.length)} {tr("من")} {filtered.length}</span>
          </div>
        )}
      </div>
    )}

    {/* REPORTS */}
    {view==="reports"&&(
      <div>
        <ReportsTab invoices={invoices} company={company}/>
      </div>
    )}

    {/* DETAIL */}
    {view==="list"&&selInv&&(
      <div style={{animation:"fadeUp .25s"}}>
        <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap",alignItems:"center"}}>
          <button className="btn btn-ghost" onClick={()=>setSelInv(null)}>{tr("← رجوع")}</button>
          {!!perms.print_invoice&&<button className="btn" title={tr("طباعة الفاتورة")} style={{background:col,color:"#fff"}} onClick={()=>doPrint([selInv],company,printStyle)}>{tr("🖨️ طباعة")}</button>}
          {!!perms.print_invoice&&<button className="btn" title={tr("تصدير الفاتورة إلى ملف PDF")} style={{background:"#dc2626",color:"#fff"}} disabled={pdfBusy} onClick={()=>doPdfExport([selInv],company,{toast:toast_,setBusy:setPdfBusy,styleId:printStyle})}>{pdfBusy?tr("⏳ جاري…"):"📄 PDF"}</button>}
          {!!perms.edit_invoice&&<button className="btn" title={tr("تعديل الفاتورة")} style={{background:"#f59e0b",color:"#fff"}} onClick={()=>openEdit(selInv)}>{tr("✏️ تعديل")}</button>}
          {!!perms.delete_invoice&&<button className="btn btn-red" title={tr("حذف الفاتورة")} onClick={()=>setDelModal(selInv)}>{tr("🗑️ حذف")}</button>}
          {(()=>{
            const href=waReminderHref(selInv,company);
            return href&&iT(selInv)-pN(selInv.paid||0)>0?(
              <a href={href} target="_blank" rel="noopener noreferrer" className="btn wa-btn"
                title={tr("إرسال تذكير بالسداد عبر واتساب (رسالة جاهزة)")}
                style={{color:"#fff",textDecoration:"none"}}
                onClick={()=>logReminderSent(selInv,company,href)}>
                {tr("📣 تذكير واتساب")}
              </a>
            ):null;
          })()}
          {iT(selInv)-pN(selInv.paid||0)>0&&(
            <button className="btn" title={tr("توليد رابط دفع إلكتروني (كي نت) وإرساله للعميل")}
              style={{background:"#0d9488",color:"#fff"}}
              onClick={()=>setPayLinkInv(selInv)}>
              {tr("💳 رابط الدفع")}
            </button>
          )}
          {overdueDays(selInv)>0&&(
            <span style={{fontSize:"12px",fontWeight:800,color:"var(--ia-red-tx)",background:"var(--ia-red-bg)",border:"1px solid var(--ia-red-bd)",borderRadius:"20px",padding:"5px 14px"}}>{tr("⏰ متأخرة")} {overdueDays(selInv)} {tr("يوم عن الاستحقاق")}</span>
          )}
        </div>
        <div className="card" style={{overflow:"hidden"}}><InvPreview inv={selInv} company={company}/></div>
        <PaymentsPanel inv={selInv} company={company} canEdit={!!perms.edit_invoice} onChanged={async()=>{
          await refreshInvoices();
          try{ const fresh=await api.getInvoice(selInv.id); if(fresh)setSelInv(fresh); }catch{}
        }}/>
        <RemindersPanel inv={selInv} company={company}/>
      </div>
    )}

    {/* NEW */}
    {view==="new"&&(
      <div className="card" style={{padding:"24px",animation:"fadeUp .25s"}}>
        <div style={{fontSize:"16px",fontWeight:900,color:colTx,marginBottom:"18px"}}>{tr("➕ فاتورة جديدة —")} {company.nameAr}</div>
        <div style={{fontSize:"10px",fontWeight:700,color:"var(--ia-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"9px"}}>{tr("بيانات العميل")}</div>
        {clients.length>0&&(
          <div style={{marginBottom:"10px"}}>
            <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("📇 اختر من دليل العملاء (")}{clients.length} {tr("محفوظ)")}</label>
            <select className="inp" value="" onChange={e=>{
              const c=clients.find(x=>String(x.id)===e.target.value);
              if(c){
                setField("clientName",c.name||"");
                setField("clientPhone",c.phone||"");
                // r23: عند غياب العنوان — املأه بالمحافظة والدولة (بلغة الواجهة)
                if(c.address){setField("clientAddress",c.address);}
                else{
                  setField("clientAddress","");
                  worldStates().then(ws=>{
                    const gl=govLabelOf(ws,c.country,c.governorate,appLang());
                    const cl=c.country?countryLabel(c.country,appLang()):"";
                    const geo=[gl,cl].filter(Boolean).join(appLang()==="ar"?"، ":", ");
                    if(geo)setField("clientAddress",geo);
                  }).catch(()=>{});
                }
              }
            }}>
              <option value="">{tr("— إدخال يدوي (عميل جديد) —")}</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` (${c.phone})`:""}</option>)}
            </select>
          </div>
        )}
        <div className="form-2col" style={{marginBottom:"10px"}}>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("الاسم (اختياري)")}</label>
            <input className="inp" placeholder={tr("اسم العميل")} value={form.clientName} onChange={e=>setField("clientName",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("رقم التلفون *")}</label>
            <input className="inp" placeholder="97479196" value={form.clientPhone} onChange={e=>setField("clientPhone",e.target.value)}/></div>
        </div>
        <div style={{marginBottom:"12px"}}>
          <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("العنوان")}</label>
          <input className="inp" placeholder={tr("المنطقة / العنوان")} value={form.clientAddress} onChange={e=>setField("clientAddress",e.target.value)}/>
        </div>
        <div className="form-3col" style={{marginBottom:"14px"}}>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("تاريخ الفاتورة")}</label>
            <input className="inp" type="date" value={form.date} onChange={e=>setField("date",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("تاريخ الاستحقاق")}</label>
            <input className="inp" type="date" value={form.dueDate} onChange={e=>setField("dueDate",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("المدفوع (KD)")}</label>
            <input className="inp" placeholder="0.000" value={form.paid} onChange={e=>setField("paid",e.target.value)}/></div>
        </div>
        <div style={{fontSize:"10px",fontWeight:700,color:"var(--ia-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"9px"}}>{tr("المنتجات")}</div>
        {form.items.map((it,i)=>(
          <div key={i} className="item-row">
            <input className="inp" placeholder={tr("اسم المنتج *")} value={it.name} onChange={e=>setItem(i,"name",e.target.value)}/>
            <input className="inp" type="number" min="1" value={it.qty} onChange={e=>setItem(i,"qty",e.target.value)}/>
            <input className="inp" placeholder={tr("السعر {0}",[currencySymbol()])} value={it.price} onChange={e=>setItem(i,"price",e.target.value)}/>
            {form.items.length>1?<button className="btn btn-red" style={{padding:"8px 10px"}} onClick={()=>setForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}))}>✕</button>:<div/>}
          </div>
        ))}
        <button className="btn btn-outline" style={{marginBottom:"12px",fontSize:"12px"}} onClick={()=>setForm(f=>({...f,items:[...f.items,{name:"",desc:"",qty:1,price:""}]}))}>{tr("+ إضافة منتج")}</button>
        <div className="form-3col" style={{marginBottom:"12px"}}>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("التوصيل (")}{currencySymbol()}{tr(") — 0 للمجاني")}</label>
            <input className="inp" placeholder="0.000" value={form.shipping} onChange={e=>setField("shipping",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("🧾 الضريبة (٪) — اختيارية")}{companyTax(company)>0?tr(" — افتراضي الشركة {0}٪",[companyTax(company)]):""}</label>
            <input className="inp" type="number" min="0" max="100" step="0.5" inputMode="decimal" placeholder={String(companyTax(company)||0)} value={form.taxRate} onChange={e=>setField("taxRate",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("ملاحظات")}</label>
            <input className="inp" value={form.notes} onChange={e=>setField("notes",e.target.value)}/></div>
        </div>
        {(()=>{const sub=form.items.reduce((s,it)=>s+(parseInt(toW(it.qty))||1)*pN(it.price),0);const ship=pN(form.shipping);const rate=form.taxRate!==""&&form.taxRate!=null?pN(form.taxRate):companyTax(company);const tax=+(sub*rate/100).toFixed(2);const tot=sub+tax+ship;
          return(<div style={{background:cardBg,borderRadius:"9px",padding:"11px 16px",marginBottom:"14px",display:"flex",gap:"16px",fontSize:"13px",border:`1px solid ${col}22`,flexWrap:"wrap"}}>
            <span>{tr("المجموع:")} <b>{fKWD(sub)}</b></span>
            {tax>0&&<span>{tr("الضريبة (")}{rate}%): <b>{fKWD(tax)}</b></span>}
            {ship>0&&<span>{tr("التوصيل:")} <b>{fKWD(ship)}</b></span>}
            <span style={{fontWeight:900,color:colTx}}>{tr("الإجمالي:")} <b>{fKWD(tot)}</b></span>
          </div>);})()}
        {/* Live credit-limit warning for the entered client phone */}
        {(()=>{const ph=norm(form.clientPhone||"");
          if(!ph)return null;
          const lim=creditLimitOf(loadCreditMap(company.id),ph);
          if(lim<=0)return null;
          const out=outstandingOf(invoices,ph);
          const sub=form.items.reduce((s,it)=>s+(parseInt(toW(it.qty))||1)*pN(it.price),0)+pN(form.shipping);
          const tot=out+sub;
          const pct=tot/lim*100;
          if(pct<80)return null;
          const over=tot>lim;
          return(
          <div role="alert" style={{background:over?"var(--ia-red-bg)":"var(--ia-warn-bg)",border:`1.5px solid ${over?"var(--ia-red-bd)":"#fde68a66"}`,borderRadius:"10px",padding:"11px 15px",marginBottom:"14px",fontSize:"12.5px",fontWeight:700,lineHeight:1.8,color:over?"var(--ia-red-tx)":"var(--ia-warn-tx)"}}>
            {over
              ?tr("⛔ تجاوز حد الائتمان — الرصيد الحالي {0} + هذه الفاتورة {1} = {2} (الحد {3}) بفارق {4}. يُنصح بالتحصيل أولاً.",[fKWD(out),fKWD(sub),fKWD(tot),fKWD(lim),fKWD(tot-lim)])
              :tr("⚠️ اقتراب من حد الائتمان — {0} من {1} ({2}%) بعد إضافة هذه الفاتورة.",[fKWD(tot),fKWD(lim),pct.toFixed(0)])}
          </div>
          );
        })()}
        <div style={{display:"flex",gap:"8px"}}>
          <button className="btn" style={{background:"#16a34a",color:"#fff",flex:1,fontSize:"14px",padding:"11px"}} onClick={saveInvoice}>{tr("💾 حفظ الفاتورة")}</button>
          <button className="btn btn-ghost" onClick={()=>{setForm(emptyForm());setView("list");}}>{tr("إلغاء")}</button>
        </div>
      </div>
    )}

    {/* EDIT */}
    {view==="edit"&&editForm&&(
      <div className="card" style={{padding:"24px",animation:"fadeUp .25s"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"18px"}}>
          <div style={{fontSize:"16px",fontWeight:900,color:"#f59e0b"}}>{tr("✏️ تعديل الفاتورة")}</div>
          <span className="b-inv">{editingInv?.invNum}</span>
          <div style={{flex:1}}/>
          <button className="btn btn-ghost" style={{fontSize:"12px"}} onClick={()=>{setView("list");setEditingInv(null);setEditForm(null);}}>{tr("← إلغاء")}</button>
        </div>

        <div style={{fontSize:"10px",fontWeight:700,color:"var(--ia-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"9px"}}>{tr("بيانات العميل")}</div>
        {clients.length>0&&(
          <div style={{marginBottom:"10px"}}>
            <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("📇 اختر من دليل العملاء (استبدال البيانات)")}</label>
            <select className="inp" value="" onChange={e=>{
              const c=clients.find(x=>String(x.id)===e.target.value);
              if(c){
                setEditField("clientName",c.name||"");
                setEditField("clientPhone",c.phone||"");
                setEditField("clientAddress",c.address||"");
                // r23: عند غياب العنوان — املأه بالمحافظة والدولة (بلغة الواجهة)
                if(!c.address){
                  worldStates().then(ws=>{
                    const gl=govLabelOf(ws,c.country,c.governorate,appLang());
                    const cl=c.country?countryLabel(c.country,appLang()):"";
                    const geo=[gl,cl].filter(Boolean).join(appLang()==="ar"?"، ":", ");
                    if(geo)setEditField("clientAddress",geo);
                  }).catch(()=>{});
                }
              }
            }}>
              <option value="">{tr("— تعديل يدوي —")}</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` (${c.phone})`:""}</option>)}
            </select>
          </div>
        )}
        <div className="form-2col" style={{marginBottom:"10px"}}>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("الاسم")}</label>
            <input className="inp" placeholder={tr("اسم العميل")} value={editForm.clientName} onChange={e=>setEditField("clientName",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("رقم التلفون *")}</label>
            <input className="inp" placeholder="97479196" value={editForm.clientPhone} onChange={e=>setEditField("clientPhone",e.target.value)}/></div>
        </div>
        <div style={{marginBottom:"12px"}}>
          <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("العنوان")}</label>
          <input className="inp" placeholder={tr("المنطقة / العنوان")} value={editForm.clientAddress} onChange={e=>setEditField("clientAddress",e.target.value)}/>
        </div>
        <div className="form-3col" style={{marginBottom:"14px"}}>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("تاريخ الفاتورة")}</label>
            <input className="inp" type="date" value={editForm.date} onChange={e=>setEditField("date",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("تاريخ الاستحقاق")}</label>
            <input className="inp" type="date" value={editForm.dueDate} onChange={e=>setEditField("dueDate",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("المدفوع (KD)")}</label>
            <input className="inp" placeholder="0.000" value={editForm.paid} onChange={e=>setEditField("paid",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("حالة الطلب")}</label>
            <select className="inp" value={editForm.status||""} onChange={e=>setEditField("status",e.target.value)}>
              <option value="">{tr("تلقائي (حسب المدفوع)")}</option>
              <option value="cancelled">{tr("ملغية ✕")}</option>
            </select>
          </div>
        </div>

        <div style={{fontSize:"10px",fontWeight:700,color:"var(--ia-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"9px"}}>{tr("المنتجات")}</div>
        {editForm.items.map((it,i)=>(
          <div key={i} className="item-row">
            <input className="inp" placeholder={tr("اسم المنتج *")} value={it.name} onChange={e=>setEditItem(i,"name",e.target.value)}/>
            <input className="inp" type="number" min="1" value={it.qty} onChange={e=>setEditItem(i,"qty",e.target.value)}/>
            <input className="inp" placeholder={tr("السعر {0}",[currencySymbol()])} value={it.price} onChange={e=>setEditItem(i,"price",e.target.value)}/>
            {editForm.items.length>1
              ?<button className="btn btn-red" style={{padding:"8px 10px"}} onClick={()=>setEditForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}))}>✕</button>
              :<div/>}
          </div>
        ))}
        <button className="btn btn-outline" style={{marginBottom:"12px",fontSize:"12px"}} onClick={()=>setEditForm(f=>({...f,items:[...f.items,{name:"",desc:"",qty:1,price:""}]}))}>{tr("+ إضافة منتج")}</button>

        <div className="form-3col" style={{marginBottom:"12px"}}>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("التوصيل (")}{currencySymbol()}{tr(") — 0 للمجاني")}</label>
            <input className="inp" placeholder="0.000" value={editForm.shipping} onChange={e=>setEditField("shipping",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("🧾 الضريبة (٪) — اختيارية")}{companyTax(company)>0?tr(" — افتراضي الشركة {0}٪",[companyTax(company)]):""}</label>
            <input className="inp" type="number" min="0" max="100" step="0.5" inputMode="decimal" placeholder={String(companyTax(company)||0)} value={editForm.taxRate} onChange={e=>setEditField("taxRate",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("ملاحظات")}</label>
            <input className="inp" value={editForm.notes} onChange={e=>setEditField("notes",e.target.value)}/></div>
        </div>

        {(()=>{
          const sub=editForm.items.reduce((s,it)=>(parseInt(toW(String(it.qty)))||1)*pN(it.price)+s,0);
          const ship=pN(editForm.shipping);const rate=editForm.taxRate!==""&&editForm.taxRate!=null?pN(editForm.taxRate):companyTax(company);const tax=+(sub*rate/100).toFixed(2);const tot=sub+tax+ship;
          return(
            <div style={{background:cardBg,borderRadius:"9px",padding:"11px 16px",marginBottom:"14px",display:"flex",gap:"16px",fontSize:"13px",border:`1px solid ${col}22`,flexWrap:"wrap"}}>
              <span>{tr("المجموع:")} <b>{fKWD(sub)}</b></span>
              {tax>0&&<span>{tr("الضريبة (")}{rate}%): <b>{fKWD(tax)}</b></span>}
              {ship>0&&<span>{tr("التوصيل:")} <b>{fKWD(ship)}</b></span>}
              <span style={{fontWeight:900,color:colTx}}>{tr("الإجمالي:")} <b>{fKWD(tot)}</b></span>
            </div>
          );
        })()}

        <div style={{display:"flex",gap:"8px"}}>
          <button className="btn" style={{background:"#f59e0b",color:"#fff",flex:1,fontSize:"14px",padding:"11px"}} onClick={updateInvoice}>{tr("💾 حفظ التعديلات")}</button>
          <button className="btn btn-ghost" onClick={()=>{setView("list");setEditingInv(null);setEditForm(null);}}>{tr("إلغاء")}</button>
        </div>
      </div>
    )}

    {/* BULK */}
    {view==="bulk"&&(
      <div className="card" style={{padding:"24px",animation:"fadeUp .25s"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"5px",flexWrap:"wrap"}}>
          <div style={{fontSize:"16px",fontWeight:900,color:colTx}}>{tr("📦 إدخال مجمع")}</div>
          <span style={{background:"rgba(124,58,237,.12)",color:"#7c3aed",border:"1px solid rgba(124,58,237,.25)",borderRadius:"20px",padding:"2px 10px",fontSize:"10.5px",fontWeight:800}}>{tr("🤖 بالذكاء الاصطناعي")}</span>
        </div>
        <p style={{fontSize:"12px",color:"var(--ia-sub)",marginBottom:"16px"}}>
          {tr("كل طلب يفصله سطر فارغ — يقبل صيغة الإيموجي أو")} <b>{tr("أي صيغة حرة")}</b> {tr("(عربي/إنجليزي): المساعد الذكي يفهم ويستخرج الطلبات والأسعار والتوصيل")}
        </p>
        {bulkStep===0&&(
          <>
            <textarea className="inp" style={{minHeight:"200px",resize:"vertical",marginBottom:"10px",fontSize:"12px",lineHeight:"1.7"}}
              value={bulkText} onChange={e=>{setBulkText(e.target.value);setBulkAiErr("");setBulkAiUsed(false);}}
              placeholder={tr("📍 الاسم: محمد أبو العينين\n📞 الهاتف: 97479196\n🏠 العنوان: حولي\n🛠️ الطلب: ماتور بوص واحد حصان\n💰 السعر: 11.900\n🚚 التوصيل: مجاني")}/>
            {bulkAiErr&&(
              <div style={{background:"var(--ia-red-bg)",border:"1px solid var(--ia-red-bd)",borderRadius:"8px",padding:"10px 14px",color:"var(--ia-red-tx)",fontSize:"12.5px",marginBottom:"10px"}}>
                ❌ {bulkAiErr}
              </div>
            )}
            {bulkAiBusy?(
              <div style={{display:"flex",alignItems:"center",gap:"12px",background:"rgba(124,58,237,.07)",border:"1.5px solid rgba(124,58,237,.25)",borderRadius:"10px",padding:"16px 18px"}}>
                <div style={{fontSize:"26px",animation:"spin 1s linear infinite"}}>🤖</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:13.5,color:"#7c3aed",marginBottom:3}}>{tr("جارٍ المعالجة بالذكاء الاصطناعي…")}</div>
                  <div style={{fontSize:11.5,color:"var(--ia-sub)"}}>{tr("يقرأ النص، يستخرج العملاء والمنتجات والكميات والأسعار والتوصيل")}</div>
                </div>
                <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
              </div>
            ):(
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                <button className="btn" style={{background:"linear-gradient(135deg,#7c3aed,#6d28d9)",color:"#fff",flex:2,justifyContent:"center",padding:"13px",fontSize:"14px",minWidth:"210px",boxShadow:"0 4px 14px rgba(124,58,237,.3)"}}
                  onClick={processBulkAI} disabled={!bulkText.trim()}>
                  {tr("🤖 معالجة وإضافة بالذكاء الاصطناعي")}
                </button>
                <button className="btn btn-outline" style={{flex:1,justifyContent:"center",padding:"13px",minWidth:"130px"}}
                  onClick={()=>{setBulkParsed(parseBulk(bulkText));setBulkAiUsed(false);setBulkStep(1);}}>
                  {tr("🔍 معاينة سريعة")}
                </button>
              </div>
            )}
            <p style={{fontSize:"11px",color:"var(--ia-muted)",margin:"10px 0 0"}}>
              {tr("💡 «المعاينة السريعة» تستخدم المحلل المحلي لصيغة الإيموجي فقط — زرّ الذكاء الاصطناعي يفهم أي صيغة")}
            </p>
          </>
        )}
        {bulkStep===1&&(
          <>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px",flexWrap:"wrap"}}>
              <div style={{color:"#16a34a",fontWeight:800}}>✅ {bulkParsed.length} {tr("طلب جاهز")}</div>
              {bulkAiUsed&&(
                <span style={{background:"rgba(124,58,237,.1)",color:"#7c3aed",border:"1px solid rgba(124,58,237,.25)",borderRadius:"20px",padding:"2px 10px",fontSize:"10.5px",fontWeight:800}}>{tr("⚡ عولج بالذكاء الاصطناعي")}</span>
              )}
            </div>
          <div style={{maxHeight:"360px",overflow:"auto",marginBottom:"12px"}}>
            {bulkParsed.map((b,i)=>{const tot=b.items.reduce((s,it)=>s+it.qty*pN(it.price),0)+pN(b.shipping||0);
              return(<div key={i} style={{border:"1px solid var(--ia-border)",borderRadius:"8px",padding:"10px 14px",marginBottom:"6px",background:"var(--ia-row-alt)"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <div><b>{b.clientName}</b> <span style={{color:"var(--ia-link)",fontSize:"12px",direction:"ltr"}}>{b.clientPhone}</span>
                    {b.clientAddress&&<span style={{color:"var(--ia-sub)",fontSize:"11px",marginInlineStart:"6px"}}> — {b.clientAddress}</span>}</div>
                  <b style={{color:colTx}}>{fKWD(tot)}</b>
                </div>
                <div style={{fontSize:"12px",color:"var(--ia-sub)",marginTop:"4px"}}>
                  {b.items.map((it,j)=><span key={j}>{it.name} × {it.qty} — {fKWD(it.price)} </span>)}
                  {b.shipping===0&&<span style={{color:"#16a34a"}}>{tr("| توصيل مجاني")}</span>}
                </div>
              </div>);})}
          </div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            <button className="btn" style={{background:"#16a34a",color:"#fff",flex:1,fontSize:"13.5px",padding:"11px"}} onClick={saveBulk}>{tr("💾 إضافة الفواتير (")}{bulkParsed.length})</button>
            <button className="btn" style={{background:"linear-gradient(135deg,#7c3aed,#6d28d9)",color:"#fff",padding:"11px 16px"}} onClick={()=>{setBulkStep(0);}} disabled={bulkAiBusy}>{tr("🤖 إعادة معالجة بالذكاء")}</button>
            <button className="btn btn-ghost" onClick={()=>setBulkStep(0)}>{tr("← تعديل النص")}</button>
          </div></>
        )}
        {bulkStep===2&&(
          <div style={{textAlign:"center",padding:"36px"}}>
            <div style={{fontSize:"48px",marginBottom:"8px"}}>✅</div>
            <div style={{fontSize:"16px",fontWeight:700,marginBottom:"14px"}}>{tr("تم حفظ")} {bulkParsed.length} {tr("فاتورة!")}</div>
            <div style={{display:"flex",gap:"8px",justifyContent:"center",flexWrap:"wrap"}}>
              <button className="btn" style={{background:col,color:"#fff"}} onClick={()=>{setBulkStep(0);setBulkText("");setBulkParsed([]);}}>{tr("إدخال جديد")}</button>
              <button className="btn" style={{background:"#7c3aed",color:"#fff"}} onClick={()=>{setBulkStep(0);setView("purchase");}}>{tr("🛒 توليد فاتورة مشتريات")}</button>
              <button className="btn btn-ghost" onClick={()=>{setBulkStep(0);setView("list");}}>{tr("عرض الفواتير")}</button>
            </div>
          </div>
        )}
      </div>
    )}

    {/* PRINT */}
    {view==="print"&&(
      <div style={{animation:"fadeUp .25s"}}>
        <div className="card" style={{padding:"22px",marginBottom:"12px"}}>
          <div style={{fontSize:"16px",fontWeight:900,color:colTx,marginBottom:"14px"}}>{tr("🖨️ طباعة من رقم إلى رقم")}</div>
          <div style={{display:"flex",gap:"10px",marginBottom:"16px",flexWrap:"wrap"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:"var(--ia-muted)",textTransform:"uppercase",letterSpacing:".5px",alignSelf:"center"}}>{tr("نمط الفاتورة:")}</div>
            {Object.values(PRINT_STYLES).map(st=>(
              <button key={st.id} onClick={()=>{setPStyle(st.id);toast_(tr("تم اختيار نمط {0}",[tr(st.label)]));}}
                title={tr("نمط {0}{1}",[tr(st.label),st.id==="modern"?tr(" — بألوان الشركة"):st.id==="minimal"?tr(" — أبيض وأسود موفّر للحبر"):""])}
                style={{flex:"1",minWidth:"120px",maxWidth:"180px",border:printStyle===st.id?`2px solid ${col}`:"1.5px solid var(--ia-border2)",borderRadius:"10px",padding:"10px 12px",background:printStyle===st.id?softAdapt(company.cardBg,dark):"var(--ia-inp-bg)",cursor:"pointer",fontFamily:"inherit",transition:"all .15s",display:"flex",alignItems:"center",gap:"8px"}}>
                <span style={{fontSize:"18px"}}>{st.icon}</span>
                <div style={{textAlign:"start",minWidth:0,flex:1}}>
                  <div style={{fontSize:"12.5px",fontWeight:900,color:printStyle===st.id?colTx:"var(--ia-text)"}}>{tr(st.label)}</div>
                  <div style={{fontSize:"10px",color:"var(--ia-sub)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{st.id==="classic"?tr("التصميم الأصلي"):st.id==="modern"?tr("ألوان الشركة"):tr("أبيض وأسود")}</div>
                </div>
                {printStyle===st.id&&<span style={{fontSize:"13px",color:colTx,fontWeight:"900"}}>✓</span>}
              </button>
            ))}
          </div>
          <div className="print-grid">
            <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("من رقم الفاتورة")}</label>
              <input className="inp" placeholder={tr("INV10001 أو 10001")} value={printRange.from} onChange={e=>setPrintRange(r=>({...r,from:e.target.value}))}/></div>
            <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>{tr("إلى رقم الفاتورة")}</label>
              <input className="inp" placeholder={tr("INV10010 أو 10010")} value={printRange.to} onChange={e=>setPrintRange(r=>({...r,to:e.target.value}))}/></div>
            <button className="btn print-btn" style={{background:col,color:"#fff",height:"40px"}} onClick={doPrintRange}>{tr("🖨️ طباعة")}</button>
            <button className="btn" title={tr("تصدير الفواتير في النطاق إلى ملف PDF واحد")} disabled={pdfBusy} style={{background:"#dc2626",color:"#fff",height:"40px"}} onClick={()=>{const list=printRangeList();doPdfExport(list,company,{toast:toast_,setBusy:setPdfBusy,styleId:printStyle});}}>{pdfBusy?tr("⏳ جاري…"):tr("📄 تصدير PDF")}</button>
          </div>
          <p style={{fontSize:"11px",color:"var(--ia-muted)",marginTop:"8px"}}>{tr("⚠️ يجب السماح بالـ Popups في المتصفح لتعمل الطباعة")}</p>
        </div>
        <div className="card" style={{padding:"20px"}}>
          <div style={{fontSize:"11px",fontWeight:700,color:"var(--ia-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"10px"}}>{tr("أو اضغط على فاتورة لطباعتها —")} {invoices.length} {tr("فاتورة")}</div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            {invoices.slice().sort((a,b)=>parseInt(a.invNum?.replace(/\D/g,"")||0)-parseInt(b.invNum?.replace(/\D/g,"")||0)).map(inv=>{
              const st=getStatus(inv);
              return(
              <div key={inv.id} style={{border:`1px solid ${col}33`,borderRadius:"10px",padding:"10px 14px",background:cardBg,fontSize:"12px",cursor:"pointer",transition:"all .18s",minWidth:"150px"}}
                className="print-chip"
                onClick={()=>doPrint([inv],company,printStyle)}>
                <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                  <span style={{fontWeight:800,color:colTx,letterSpacing:".3px"}}>{inv.invNum}</span>
                  <span style={{flex:1}}/>
                  <span className={`b-${st}`} style={{fontSize:"10px",padding:"1px 8px"}}>{tr(stLabel[st])}</span>
                </div>
                <div style={{color:"var(--ia-sub)",marginTop:"3px",fontSize:"11px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"170px"}}>{inv.clientName}</div>
                <div style={{display:"flex",alignItems:"baseline",gap:"8px",marginTop:"3px"}}>
                  <span style={{fontWeight:800,fontSize:"12.5px"}}>{fKWD(iT(inv))}</span>
                  <span style={{color:"var(--ia-muted)",fontSize:"10px"}}>📅 {fDate(inv.date)}</span>
                </div>
                <div style={{color:colTx,marginTop:"5px",fontSize:"10px",fontWeight:700}}>{tr("🖨️ اضغط للطباعة")}</div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    )}

    {/* PURCHASES */}
    {/* AI BULK PROCESSOR */}
    {view==="ai"&&(
      <div style={{animation:"fadeUp .25s"}}>
        <AIBulkProcessor
          company={company}
          onPurchaseSaved={()=>{}}
        />
      </div>
    )}

    {view==="chat"&&(
      <div style={{animation:"fadeUp .25s"}}>
        <SmartChat company={company} onDataChanged={()=>{ refreshInvoices(); refreshClients(); }} />
      </div>
    )}

    {view==="account"&&(
      <div style={{animation:"fadeUp .25s"}}>
        <AccountPanel toast_={toast_} />
      </div>
    )}

    {view==="deepseek"&&(
      <div style={{animation:"fadeUp .25s"}}>
        <DeepSeekSettings company={company} />
      </div>
    )}

    {view==="site"&&(
      <div style={{animation:"fadeUp .25s"}}>
        <SiteManager toast={toast_} />
      </div>
    )}

    {view==="system"&&(
      <div style={{animation:"fadeUp .25s", display:"flex", flexDirection:"column", gap:14}}>
        <BackupRecovery company={company} />
        <JobsPanel company={company} toast={toast_} />
      </div>
    )}

    {view==="purchase"&&(
      <div style={{animation:"fadeUp .25s"}}>
        <PurchasesTab
          company={company}
          invoices={invoices}
          preSelectIds={purchasePreSelect}
          onClearPreSelect={()=>setPurchasePreSelect([])}
        />
      </div>
    )}

    {/* r25: شاشة المدفوعات — مجموعة MAIN في الشريط الجانبي */}
    {view==="payments"&&(
      <PaymentsView
        invoices={invoices}
        canEdit={!!perms.edit_invoice}
        onRecordPayment={invCallbacks.onRecordPayment}
        onSendReminder={invCallbacks.onSendReminder}
        onView={invCallbacks.onView}
        onPdf={invCallbacks.onPdf}
      />
    )}

    {/* r25: شاشة التذكيرات — مجموعة OPERATIONS في الشريط الجانبي */}
    {view==="reminders"&&(
      <RemindersView
        invoices={invoices}
        canEdit={!!perms.edit_invoice}
        onSendReminder={inv=>waOpen(inv)}
        onBulkRemind={()=>{ if(overdueList.length) setShowBulkWa(true); }}
        onView={invCallbacks.onView}
      />
    )}

    {/* r25: شاشة المساعدة */}
    {view==="help"&&(
      <div className="card" style={{padding:"26px",animation:"fadeUp .25s"}}>
        <div style={{fontSize:17,fontWeight:900,marginBottom:6}}>{tr("المساعدة والدعم")}</div>
        <div style={{fontSize:13,color:"var(--ia-sub)",lineHeight:1.9,marginBottom:16}}>
          {tr("GarfiX نظام تشغيل أعمال عالمي: فواتير وعملاء ومدفوعات وتقارير وذكاء اصطناعي — لأي شركة في أي دولة. اختر ما يناسبك:")}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
          {[
            {t:tr("التوثيق"),s:tr("أدلة الاستخدام والميزات"),go:()=>window.open("https://garfix.app","_blank","noopener")},
            {t:tr("الدعم عبر واتساب"),s:tr("رد سريع من فريق GarfiX"),go:()=>window.open("https://wa.me/201033514479","_blank","noopener")},
            {t:tr("اسأل GarfiX AI"),s:tr("مساعد متصل ببيانات شركتك"),go:()=>setView("chat")},
            {t:tr("التكاملات"),s:tr("إعداد مزوّد الذكاء الاصطناعي"),go:()=>setView("deepseek")},
          ].map((h,i)=>(
            <button key={i} className="btn btn-outline" style={{flexDirection:"column",alignItems:"flex-start",gap:4,padding:"14px 16px",borderRadius:"12px"}} onClick={h.go}>
              <b style={{fontSize:13}}>{h.t}</b>
              <span style={{fontSize:11,color:"var(--ia-sub)",fontWeight:600}}>{h.s}</span>
            </button>
          ))}
        </div>
      </div>
    )}

    {view!=="chat"&&(
      /* r22+r23: فقاعة Garfix AI العائمة — وصول سريع للمساعد من أي شاشة
         + تلميح عند التحويم + تغذية بصرية عند اللمس/النقر */
      <button
        onClick={()=>{setView("chat");setSelInv(null);setBulkStep(0);}}
        className="garfix-ai-bubble"
        title={tr("Garfix AI — المساعد الذكي")}
        aria-label={tr("Garfix AI — المساعد الذكي")}
        style={{position:"fixed",bottom:"calc(18px + env(safe-area-inset-bottom))",insetInlineEnd:18,zIndex:900,width:54,height:54,borderRadius:"50%",border:"2px solid rgba(255,255,255,.35)",cursor:"pointer",background:`linear-gradient(135deg,${col},${company.accent||col})`,color:"#fff",fontSize:23,boxShadow:"0 10px 28px rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",animation:"garfixAIPulse 2.6s ease-in-out infinite",WebkitTapHighlightColor:"transparent",overflow:"visible"}}
      >
        <span style={{filter:"drop-shadow(0 1px 3px rgba(0,0,0,.35))"}}>🤖</span>
        <span style={{position:"absolute",bottom:"-4px",insetInlineEnd:"-4px",background:"#e5c558",color:"#1a1200",borderRadius:"9px",fontSize:8,fontWeight:900,padding:"1px 4px",border:"1.5px solid #fff",letterSpacing:".3px"}}>AI</span>
        <span className="garfix-ai-tip" style={{position:"absolute",bottom:"calc(100% + 10px)",insetInlineEnd:0,background:"var(--ia-card)",border:"1px solid var(--ia-border2)",color:"var(--ia-text)",borderRadius:"9px",padding:"5px 11px",fontSize:11,fontWeight:800,whiteSpace:"nowrap",opacity:0,pointerEvents:"none",transform:"translateY(5px)",transition:"opacity .2s,transform .2s",boxShadow:"0 6px 18px rgba(0,0,0,.18)"}}>
          {tr("اسأل Garfix AI ✨")}
        </span>
      </button>
    )}

    {/* Footer — r23: هيكل أوضح (الشركة + المؤسس + العلامة) */}
    <div style={{textAlign:"center",padding:"18px 14px 22px",marginTop:"auto",borderTop:"1px solid var(--ia-border)",fontSize:"12px",color:"var(--ia-muted)",paddingBottom:"calc(22px + env(safe-area-inset-bottom))",display:"flex",flexDirection:"column",gap:4,alignItems:"center"}}>
      <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",justifyContent:"center"}}>
        <span style={{fontSize:13}}>{company.emoji||"🏛️"}</span>
        <b style={{color:"var(--ia-sub)",fontSize:11.5}}>{companyName(company)}</b>
        <span style={{opacity:.4}}>·</span>
        <span style={{fontSize:10.5,opacity:.75,letterSpacing:.5}}>Garfix</span>
      </div>
      <div>
        {tr("تم البرمجة والتطوير بواسطة")}{" "}
        <a href="https://wa.me/201033514479" target="_blank" rel="noopener noreferrer"
          style={{color:col,textDecoration:"none",fontWeight:700}}>
          {tr("أحمد عزت الصياد")}
        </a>
      </div>
    </div>

  </div>
</AppShell>

);
}