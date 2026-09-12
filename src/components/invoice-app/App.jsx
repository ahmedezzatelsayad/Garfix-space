"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "./context/AuthContext";
import { logoutUser } from "./firebase/auth";
import FirebaseLogin from "./pages/FirebaseLogin";
import AdminDashboard from "./pages/AdminDashboard";
import PurchasesTab from "./components/PurchasesTab";
import AIBulkProcessor from "./components/AIBulkProcessor";
import ReportsTab from "./components/ReportsTab";
import PaymentsPanel from "./components/PaymentsPanel";
import RemindersPanel from "./components/RemindersPanel";
import { useTheme, txAdapt, softAdapt, chartColors, lighten } from "./theme";

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
const fKWD = n => pN(n).toFixed(3)+" KD";
const fDate= s => { if(!s)return""; const[y,m,d]=s.split("-"); return`${d}/${m}/${y}`; };
const today= ()=> new Date().toISOString().split("T")[0];
const addD = (s,n)=>{ const d=new Date(s); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; };
const norm = p => toW(String(p||"")).replace(/[^\d+]/g,"");
const iT   = inv => inv.items.reduce((s,it)=>s+pN(it.qty)*pN(it.price),0)+pN(inv.shipping||0);
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
    `عميلنا العزيز ${inv.clientName || ""}،`,
    `تذكير ودّي من ${company.nameAr} 🙏`,
    `📄 الفاتورة رقم ${inv.invNum} بتاريخ ${fDate(inv.date)}`,
    `💰 الإجمالي: ${fKWD(tot)}`,
    paid > 0 ? `✅ المدفوع: ${fKWD(paid)} — المتبقي: ${fKWD(due)}` : `المبلغ المطلوب: ${fKWD(due)}`,
    `📅 تاريخ الاستحقاق: ${fDate(inv.dueDate)}${od > 0 ? ` (متأخرة ${od} يوم)` : ""}`,
    `نرجو التكرم بتسوية المبلغ المتبقي في أقرب وقت 🙏`,
    `شكراً لتعاونكم 🌹`,
    `${company.nameAr} — ${company.phone}`,
  ];
  return `https://wa.me/965${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
};

// ── Fire-and-forget audit log for every sent WhatsApp reminder ──
function logReminderSent(inv, company, href){
  try{
    let message=null;
    if(href){ const m=href.split("text=")[1]; if(m){ try{ message=decodeURIComponent(m).slice(0,1500); }catch{} } }
    api.logReminder({
      invoiceId: inv.id,
      clientPhone: inv.clientPhone||null,
      clientName: inv.clientName||null,
      companySlug: company?.sk||null,
      channel: "whatsapp",
      message,
      amount: Math.max(0, iT(inv)-pN(inv.paid||0)),
    }).then(()=>{ try{ window.dispatchEvent(new CustomEvent("reminder-logged",{detail:{invoiceId:inv.id}})); }catch{} })
      .catch(()=>{});
  }catch{}
}

// ─── Storage (localStorage) ────────────────────────────────────────
function dbGet(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch{return null;}}
function dbSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}

// ─── Aliphia CSV Parser ───────────────────────────────────────────
/**

- Aliphia exports CSV with these common columns (Arabic + English headers):
- Invoice No, Date, Customer Name, Customer Phone, Customer Address,
- Item Name, Item Description, Qty, Unit Price, Total, Shipping, Paid, Notes, Due Date
- The parser is flexible — tries multiple header variants.
  */
  function parseAliphiaCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { invoices: [], errors: ["الملف فارغ أو غير صحيح"] };

// Parse header row — normalize
const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());

// Header mapping: aliphia field → our field
const colMap = {
invNum:         ["invoice no","invoice number","رقم الفاتورة","inv no","رقم"],
date:           ["date","تاريخ","invoice date","تاريخ الفاتورة"],
dueDate:        ["due date","تاريخ الاستحقاق","expiry date"],
clientName:     ["customer name","client name","اسم العميل","الاسم","name","customer"],
clientPhone:    ["phone","telephone","mobile","هاتف","رقم الهاتف","customer phone","client phone","جوال"],
clientAddress:  ["address","عنوان","customer address","client address","العنوان"],
itemName:       ["item name","product name","item","product","المنتج","اسم المنتج","الصنف"],
itemDesc:       ["description","item description","وصف","الوصف","desc"],
qty:            ["qty","quantity","كمية","الكمية"],
price:          ["unit price","price","سعر","سعر الوحدة","السعر"],
shipping:       ["shipping","delivery","توصيل","شحن"],
paid:           ["paid","مدفوع","paid amount","المدفوع"],
notes:          ["notes","ملاحظات","note","remarks"],
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

// Parse data rows
const rows = lines.slice(1).map(line => {
// Handle quoted CSV values
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

const get = (row, field) => {
const i = idx[field];
return i >= 0 && i < row.length ? row[i].replace(/^"|"$/g, "").trim() : "";
};

// Group rows by invoice number (Aliphia may repeat invoice rows for multiple items)
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
const item = { name: itemName || "منتج", desc: itemDesc, qty, price };

if (invMap[key]) {
  // Add item to existing invoice
  if (itemName || price) invMap[key].items.push(item);
} else {
  invMap[key] = {
    invNum,
    clientName: get(row, "clientName") || "عميل",
    clientPhone: norm(get(row, "clientPhone")),
    clientAddress: get(row, "clientAddress"),
    items: (itemName || price) ? [item] : [{ name: "منتج", desc: "", qty: 1, price: 0 }],
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

// ─── Aliphia Import Modal ─────────────────────────────────────────
function AliphiaImportModal({ company, existingInvoices, onImport, onClose }) {
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
if (!["csv", "txt"].includes(ext)) {
setErrors(["يرجى رفع ملف CSV فقط"]);
return;
}
const reader = new FileReader();
reader.onload = (e) => {
// Try UTF-8 first, fallback handled by browser
const text = e.target.result;
const result = parseAliphiaCSV(text);
setParsed(result.invoices);
setErrors(result.errors || []);
setDetectedCols(result.detectedCols || []);
setStep(1);
};
reader.readAsText(file, "UTF-8");
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
    source: "aliphia",
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
fontFamily:"'Cairo','Tajawal',sans-serif",direction:"rtl"
}} onClick={onClose}>
<div style={{
background:"var(--ia-card)",borderRadius:"18px",width:"100%",maxWidth:"620px",
maxHeight:"88vh",overflow:"hidden",display:"flex",flexDirection:"column",
boxShadow:"0 24px 64px rgba(0,0,0,.35)",animation:"fadeUp .25s"
}} onClick={e=>e.stopPropagation()}>

    {/* Header */}
    <div style={{background:col,padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
      <div>
        <div style={{color:"#fff",fontWeight:900,fontSize:"16px"}}>📥 استيراد من Aliphia</div>
        <div style={{color:"rgba(255,255,255,.7)",fontSize:"12px",marginTop:"2px"}}>{company.nameAr}</div>
      </div>
      <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"6px 12px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>✕ إغلاق</button>
    </div>

    {/* Steps indicator */}
    <div style={{display:"flex",borderBottom:"1px solid #e5e7eb",background:"var(--ia-row-alt)",padding:"0 22px",flexShrink:0}}>
      {["رفع الملف","معاينة البيانات","تم الاستيراد"].map((s,i) => (
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
            <div style={{fontWeight:700,color:"var(--ia-sky-tx)",marginBottom:"6px",fontSize:"13px"}}>📋 كيف تصدّر من Aliphia؟</div>
            <ol style={{fontSize:"12px",color:"var(--ia-sky-tx2)",paddingRight:"18px",lineHeight:"1.9",margin:0}}>
              <li>ادخل على حسابك في <b>aliphia.com</b></li>
              <li>اذهب إلى <b>الفواتير</b> أو <b>العملاء</b></li>
              <li>اضغط على زر <b>تصدير / Export</b></li>
              <li>اختر صيغة <b>CSV</b> واحفظ الملف</li>
              <li>ارفع الملف هنا ⬇️</li>
            </ol>
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
            <div style={{fontWeight:700,fontSize:"15px",color:"var(--ia-text)",marginBottom:"5px"}}>اسحب ملف CSV هنا</div>
            <div style={{color:"var(--ia-sub)",fontSize:"12px",marginBottom:"14px"}}>أو اضغط للاختيار من جهازك</div>
            <div style={{display:"inline-block",background:col,color:"#fff",padding:"9px 22px",borderRadius:"8px",fontWeight:700,fontSize:"13px"}}>اختر ملف CSV</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>

          {errors.length>0&&(
            <div style={{background:"var(--ia-red-bg)",border:"1px solid #fca5a5",borderRadius:"8px",padding:"10px 14px",color:"var(--ia-red-tx)",fontSize:"12px"}}>
              ❌ {errors.join(" | ")}
            </div>
          )}

          <div style={{background:"var(--ia-soft)",borderRadius:"8px",padding:"12px 16px",marginTop:"14px",fontSize:"11px",color:"var(--ia-sub)",lineHeight:"1.8"}}>
            <b>الأعمدة المدعومة:</b> رقم الفاتورة، التاريخ، اسم العميل، الهاتف، العنوان، اسم المنتج، الكمية، السعر، التوصيل، المدفوع، الملاحظات
          </div>
        </div>
      )}

      {/* STEP 1 — Preview */}
      {step===1&&(
        <div>
          <div style={{display:"flex",gap:"10px",marginBottom:"14px",flexWrap:"wrap",alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:"14px",color:"var(--ia-text)"}}>
                تم تحليل <span style={{color:colTx}}>{parsed.length}</span> فاتورة
                {dupCount>0&&<span style={{color:"var(--ia-warn-tx)",marginRight:"6px",fontSize:"12px"}}>({dupCount} مكررة)</span>}
              </div>
              <div style={{fontSize:"12px",color:"var(--ia-sub)",marginTop:"3px"}}>الأعمدة المكتشفة: {detectedCols.slice(0,6).join("، ")}{detectedCols.length>6?"...":""}</div>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer",fontSize:"12px",fontWeight:700,color:"var(--ia-text2)",background:"var(--ia-chip)",padding:"7px 12px",borderRadius:"8px",border:"1px solid var(--ia-border)"}}>
              <input type="checkbox" checked={skipDup} onChange={e=>setSkipDup(e.target.checked)} style={{accentColor:col}}/>
              تخطى المكررة
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
                  {["#","العميل","الهاتف","المنتجات","المبلغ","التاريخ","حالة"].map(h=>(
                    <th key={h} style={{padding:"9px 10px",fontWeight:700,color:"var(--ia-sub)",textAlign:"right",fontSize:"11px"}}>{h}</th>
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
                      <td style={{padding:"8px 10px",direction:"ltr",textAlign:"right",color:"var(--ia-link)"}}>{inv.clientPhone||"—"}</td>
                      <td style={{padding:"8px 10px",color:"var(--ia-sub)",maxWidth:"140px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inv.items.map(it=>it.name).join("، ")}</td>
                      <td style={{padding:"8px 10px",fontWeight:700}}>{fKWD(tot)}</td>
                      <td style={{padding:"8px 10px",color:"var(--ia-sub)"}}>{fDate(inv.date)}</td>
                      <td style={{padding:"8px 10px"}}>
                        {isDup
                          ? <span style={{background:"var(--ia-warn-bg)",color:"var(--ia-warn-tx)",borderRadius:"20px",padding:"2px 8px",fontSize:"10px",fontWeight:700}}>مكرر</span>
                          : <span style={{background:"var(--ia-ok-bg)",color:"var(--ia-ok-tx)",borderRadius:"20px",padding:"2px 8px",fontSize:"10px",fontWeight:700}}>جديد</span>
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
              {importing?"⏳ جارٍ الاستيراد...":`💾 استيراد ${toImport.length} فاتورة`}
            </button>
            <button style={{background:"var(--ia-ghost-bg)",color:"var(--ia-ghost-tx)",border:"none",borderRadius:"9px",padding:"12px 18px",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}} onClick={()=>setStep(0)}>← رجوع</button>
          </div>
        </div>
      )}

      {/* STEP 2 — Done */}
      {step===2&&(
        <div style={{textAlign:"center",padding:"32px 20px"}}>
          <div style={{fontSize:"64px",marginBottom:"12px"}}>✅</div>
          <div style={{fontSize:"20px",fontWeight:900,color:"var(--ia-text)",marginBottom:"8px"}}>تم الاستيراد بنجاح!</div>
          <div style={{fontSize:"14px",color:"var(--ia-sub)",marginBottom:"24px"}}>
            تم إضافة <span style={{fontWeight:900,color:colTx,fontSize:"18px"}}>{importedCount}</span> فاتورة من Aliphia
            {dupCount>0&&skipDup&&<div style={{marginTop:"4px",color:"var(--ia-warn-tx)",fontSize:"12px"}}>تم تخطى {dupCount} فاتورة مكررة</div>}
          </div>
          <button style={{background:col,color:"#fff",border:"none",borderRadius:"9px",padding:"12px 32px",fontFamily:"inherit",fontSize:"14px",fontWeight:700,cursor:"pointer"}} onClick={onClose}>
            عرض الفواتير ←
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
const ship=pN(inv.shipping||0);const tot=sub+ship;const paid=pN(inv.paid||0);
const due=tot-paid;
const isCancelled=inv.status==='cancelled';
const stC=isCancelled?"#6b7280":due<=0?"#16a34a":paid>0?"#b45309":"#dc2626";
const stT=isCancelled?"ملغية":due<=0?"مدفوعة":paid>0?"مدفوعة جزئياً":"غير مدفوعة";
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
return `<div class="page">
${isCancelled?`<div class="watermark">ملغية</div>`:""}
${S.topBar?`<div style="height:7px;background:linear-gradient(90deg,${acc},${lightenHex(acc,.25)});border-radius:4px;margin-bottom:12px;"></div>`:""}
<div style="position:relative;z-index:1;">

<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:${S.id==="modern"?"0":"14px"};border-bottom:${S.headerBorder};${S.id==="modern"?"border-bottom:none;":""}margin-bottom:16px;${S.id==="modern"?"border-bottom:2px solid "+acc+";padding-bottom:12px;":""}">
  <div style="display:flex;align-items:flex-start;gap:14px;">
    ${logoBlock}
    <div>
      <div style="font-size:18px;font-weight:900;color:${titleColor};margin-bottom:4px;letter-spacing:-.3px;">${c.name}</div>
      <div style="font-size:10px;color:#6b7280;line-height:2.1;">${c.nameAr}<br/>${c.address} — ${c.city}<br/><span style="direction:ltr;display:inline-block;">${c.phone}</span> &nbsp;|&nbsp; ${c.email}</div>
    </div>
  </div>
  <div style="text-align:left;">
    <div style="font-size:32px;font-weight:${S.titleWeight};color:${titleColor};letter-spacing:-2px;line-height:1;margin-bottom:4px;">فـاتـورة</div>
    <div style="font-size:11px;color:#6b7280;font-weight:600;direction:ltr;margin-bottom:8px;"># ${inv.invNum}</div>
    <div style="display:inline-block;${S.statusBadge(stC,stT)};border-radius:${S.id==="modern"?"20px":"4px"};padding:3px 14px;font-size:11px;font-weight:800;letter-spacing:.5px;">${stT}</div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1.9fr 1fr 1fr;border:${boxBorder};border-radius:${S.radius};overflow:hidden;margin-bottom:16px;">
  <div style="padding:12px 16px;border-left:${S.id==="minimal"?"1px solid #999":S.id==="modern"?`1.5px solid ${acc}30`:"1.5px solid #d1d5db"};">
    <div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">صادرة إلى</div>
    <div style="font-size:15px;font-weight:800;color:#111;margin-bottom:3px;">${inv.clientName||"—"}</div>
    <div style="font-size:12.5px;font-weight:700;direction:ltr;text-align:right;color:#374151;margin-bottom:2px;">${inv.clientPhone||""}</div>
    ${inv.clientAddress?`<div style="font-size:11px;color:#6b7280;margin-top:2px;">${inv.clientAddress}</div>`:""}
  </div>
  <div style="padding:12px 14px;border-left:${S.id==="minimal"?"1px solid #999":S.id==="modern"?`1.5px solid ${acc}30`:"1.5px solid #d1d5db"};">
    <div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">تاريخ الإصدار</div>
    <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:10px;">${fDate(inv.date)}</div>
    <div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">تاريخ الاستحقاق</div>
    <div style="font-size:13px;font-weight:700;color:#111;">${fDate(inv.dueDate)}</div>
  </div>
  <div style="padding:12px 14px;background:${amountBg};">
    <div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">المبلغ المستحق</div>
    <div style="font-size:21px;font-weight:900;color:${S.amountColor===true?(due<=0?"#16a34a":acc):(S.amountColor===false?"#111":stC)};direction:ltr;text-align:right;line-height:1.1;margin-bottom:10px;">${isCancelled?"—":fKWD(due)}</div>
    <div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">المسؤول</div>
    <div style="font-size:12px;font-weight:700;color:#374151;">${c.manager}</div>
  </div>
</div>

<table style="width:100%;border-collapse:collapse;border:${boxBorder};border-radius:${S.radius};overflow:hidden;margin-bottom:14px;">
  <thead>
    <tr style="${theadBgStyle};color:${S.theadColor};${S.id==="minimal"?"border-bottom:2px solid #000;":""}">
      <th style="padding:10px 8px;width:30px;text-align:center;font-size:10.5px;font-weight:700;border-left:${S.id==="minimal"?"1px solid #ddd":"1px solid "+S.theadBorder};">#</th>
      <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;">المنتج / الخدمة</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;">الوصف</th>
      <th style="padding:10px 10px;text-align:center;font-size:11px;font-weight:700;width:52px;border-left:${S.id==="minimal"?"1px solid #ddd":"1px solid "+S.theadBorder};border-right:${S.id==="minimal"?"1px solid #ddd":"1px solid "+S.theadBorder};">الكمية</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;width:94px;border-left:${S.id==="minimal"?"1px solid #ddd":"1px solid "+S.theadBorder};">سعر الوحدة</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;width:94px;">الإجمالي</th>
    </tr>
  </thead>
  <tbody>${itemRows}${emptyRows}</tbody>
</table>

<div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
  <table style="min-width:260px;border-collapse:collapse;border:${boxBorder};border-radius:${S.id==="minimal"?"0px":"6px"};overflow:hidden;">
    <tr style="border-bottom:1px solid ${rowBorder};"><td style="padding:7px 16px;color:#6b7280;font-size:12.5px;">المجموع الجزئي</td><td style="padding:7px 16px;text-align:left;font-size:12.5px;font-weight:600;direction:ltr;">${fKWD(sub)}</td></tr>
    ${ship>0?`<tr style="border-bottom:1px solid ${rowBorder};"><td style="padding:7px 16px;color:#6b7280;font-size:12.5px;">التوصيل</td><td style="padding:7px 16px;text-align:left;font-size:12.5px;font-weight:600;direction:ltr;">${fKWD(ship)}</td></tr>`:""}
    <tr style="${totalBgStyle};color:${S.totalColor};"><td style="padding:10px 16px;font-size:13.5px;font-weight:800;">إجمالي الفاتورة</td><td style="padding:10px 16px;text-align:left;font-size:13.5px;font-weight:900;direction:ltr;">${fKWD(tot)}</td></tr>
    <tr style="border-bottom:1px solid ${rowBorder};"><td style="padding:7px 16px;font-size:12.5px;color:#374151;">المدفوع</td><td style="padding:7px 16px;text-align:left;font-size:12.5px;font-weight:700;direction:ltr;">${fKWD(paid)}</td></tr>
    <tr style="border-top:${totalTopBorder};"><td style="padding:10px 16px;font-size:13.5px;font-weight:800;color:${stC};">${isCancelled?"الحالة":"المبلغ المستحق"}</td><td style="padding:10px 16px;text-align:left;font-size:14px;font-weight:900;color:${stC};direction:ltr;">${isCancelled?stT:fKWD(due)}</td></tr>
  </table>
</div>

${(inv._pays&&inv._pays.length)?`
<div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
  <table style="min-width:320px;border-collapse:collapse;border:${boxBorder};border-radius:${S.id==="minimal"?"0px":"6px"};overflow:hidden;">
    <thead><tr style="background:${S.id==="minimal"?"#fff":S.id==="modern"?`${acc}12`:"#f3f4f6"};border-bottom:${S.id==="minimal"?"2px solid #000":"1.5px solid "+(S.id==="modern"?acc+"40":"#d1d5db")};">
      <th colspan="4" style="padding:8px 14px;text-align:right;font-size:10.5px;font-weight:800;color:${S.id==="modern"?acc:"#374151"};letter-spacing:.5px;">💳 سجل الدفعات (${inv._pays.length})</th>
    </tr></thead>
    <tbody>
      ${inv._pays.map(p=>`<tr style="border-bottom:1px solid ${S.id==="minimal"?"#eee":"#f0f0f0"};">
        <td style="padding:6px 14px;color:#6b7280;font-size:11.5px;">${fDate(p.date)}</td>
        <td style="padding:6px 14px;font-weight:700;color:#16a34a;font-size:11.5px;direction:ltr;text-align:left;">${fKWD(p.amount)}</td>
        <td style="padding:6px 14px;"><span style="background:${S.id==="minimal"?"transparent":"#dcfce7"};color:${S.id==="minimal"?"#15803d":"#15803d"};${S.id==="minimal"?"border:1px solid #999;":""}border-radius:4px;padding:1px 8px;font-size:10.5px;font-weight:700;">${payMethodLabel[p.method]||p.method||"—"}</span></td>
        <td style="padding:6px 14px;color:#9ca3af;font-size:10.5px;">${p.note||""}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>`:""}

${inv.notes?`<div style="border:${boxBorder};border-radius:${S.id==="minimal"?"0px":"6px"};padding:10px 14px;margin-bottom:12px;background:${S.id==="modern"?`${acc}08`:"#f9fafb"};${S.id==="minimal"?"background:#fff;":""}"><div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">ملاحظات</div><div style="font-size:12px;color:#374151;line-height:1.75;">${inv.notes}</div></div>`:""}

<div style="padding-top:10px;border-top:${S.id==="minimal"?"1px solid #999":"1.5px solid #d1d5db"};display:flex;justify-content:space-between;align-items:center;">
  <div style="font-size:9.5px;color:#9ca3af;font-weight:600;">الشركة القابضة المتحدة ذ.م.م &nbsp;—&nbsp; United Holding Group LLC</div>
  <div style="font-size:10.5px;font-weight:800;color:${S.id==="modern"?acc:"#374151"};">${c.nameAr} &nbsp;|&nbsp; ${c.phone}</div>
</div>

</div></div>`;
});
return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
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
if(!w){alert("يرجى السماح بالـ Popups");return;}
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
  const base=list.length===1?`فاتورة_${(list[0].invNum||list[0].id)}`:`فواتير_${list.length}`;
  const blob=await api.exportPdf(html, base);
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`${base}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  t(list.length===1?"✅ تم تصدير الفاتورة إلى PDF":"✅ تم تصدير "+list.length+" فواتير إلى PDF");
}catch(e){
  t((e&&e.message)||"فشل تصدير PDF","err");
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
const free=delR.includes("مجاني")||delR.toLowerCase().includes("free");
return{clientName:nameR||phone||"عميل",clientPhone:phone,clientAddress:addr,
items:[{name:prod||"منتج",desc:"",qty:1,price:pN(priceR)}],
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
// Parse a clients CSV: flexible Arabic/English headers, returns {rows, errors}
function parseClientsCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], errors: ["الملف فارغ أو غير صحيح"] };
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const find = (...names) => headers.findIndex(h => names.some(n => h === n || h.includes(n)));
  const iName = find("الاسم", "name");
  const iPhone = find("التلفون", "الهاتف", "الجوال", "phone", "mobile");
  const iEmail = find("الايميل", "البريد", "email");
  const iAddr = find("العنوان", "address", "المنطقة");
  if (iName < 0 || iPhone < 0) return { rows: [], errors: ["الأعمدة المطلوبة: الاسم + التلفون"] };
  const rows = [], errors = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = parseCSVLine(lines[i]);
    const name = (cells[iName] || "").trim();
    const phone = norm(cells[iPhone] || "");
    if (!name && !phone) continue;
    if (!phone) { errors.push(`سطر ${i + 1}: بدون تلفون — تم تخطيه`); continue; }
    rows.push({
      name: name || phone,
      phone,
      email: iEmail >= 0 ? (cells[iEmail] || "").trim() || null : null,
      address: iAddr >= 0 ? (cells[iAddr] || "").trim() || null : null,
    });
  }
  return { rows, errors };
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
const fullHeaders=["رقم الهاتف","الاسم","العنوان","إجمالي المشتريات","عدد الفواتير","آخر شراء","للميتا (هاتف)"];
const fullRows=rows.map(r=>({
  "رقم الهاتف":r.phone,"الاسم":r.name,"العنوان":r.address,
  "إجمالي المشتريات":r.totalSpent.toFixed(3),"عدد الفواتير":r.invoiceCount,
  "آخر شراء":fDate(r.lastDate),"للميتا (هاتف)":"+965"+r.phone.replace(/^\+?965/,""),
}));
downloadCSV(toCSV(metaHeaders, metaRows), `Meta_Audience_${today()}.csv`);
setTimeout(()=>downloadCSV(toCSV(fullHeaders, fullRows), `Customers_${today()}.csv`), 300);
}

// ─── Company Selector ─────────────────────────────────────────────
function CompanySelector({ onSelect, companies }) {
const { profile, isAdmin } = useAuth();
const { dark, toggle } = useTheme();
const cols = companies && companies.length > 0 ? companies : Object.values(COMPANIES);
const gridCols = cols.length === 1 ? "repeat(1,1fr)" : cols.length === 2 ? "repeat(2,1fr)" : "repeat(2,1fr)";
return (
<div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cairo','Tajawal',sans-serif",direction:"rtl",padding:"20px",position:"relative",overflow:"hidden"}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap'); *{box-sizing:border-box} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}} @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}} .co-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px 20px;cursor:pointer;transition:all .3s cubic-bezier(.4,0,.2,1);text-align:center;animation:fadeUp .5s ease both;position:relative;overflow:hidden;} .co-card::before{content:"";position:absolute;inset:0;opacity:0;transition:opacity .3s;background:radial-gradient(circle at 50% 0%,var(--co-color) 0%,transparent 70%);} .co-card:hover,.co-card:active{transform:translateY(-4px) scale(1.02);border-color:var(--co-color);box-shadow:0 20px 60px rgba(0,0,0,.5),0 0 0 1px var(--co-color)} .co-card:hover::before,.co-card:active::before{opacity:.15} .co-icon{font-size:40px;margin-bottom:12px;display:block;animation:float 3s ease-in-out infinite} .co-grid{display:grid;gap:14px} @media(min-width:600px){.co-grid{grid-template-columns:repeat(4,1fr)}}`}</style>
<div style={{position:"fixed",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none"}}/>
<button onClick={toggle} title={dark?"التبديل إلى الوضع النهاري":"التبديل إلى الوضع الليلي"} aria-label="تبديل السمة" style={{position:"fixed",top:"16px",insetInlineEnd:"16px",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"8px",padding:"7px 12px",fontSize:"14px",cursor:"pointer",zIndex:10,transition:"all .2s"}}>{dark?"☀️":"🌙"}</button>
<div style={{width:"100%",maxWidth:"900px",animation:"fadeUp .4s"}}>
<div style={{textAlign:"center",marginBottom:"36px"}}>
<div style={{fontSize:"12px",fontWeight:700,letterSpacing:"3px",textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:"12px"}}>نظام إدارة الفواتير</div>
<div style={{fontSize:"28px",fontWeight:900,color:"#fff",lineHeight:1.2,marginBottom:"8px",background:"linear-gradient(135deg,#fff 0%,rgba(255,255,255,.6) 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>اختر الشركة</div>
<div style={{color:"rgba(255,255,255,.35)",fontSize:"12px"}}>
  {profile?.displayName ? `مرحباً ${profile.displayName} — ` : ""}
  {cols.length} شركة متاحة لك
</div>
</div>
{cols.length === 0 ? (
  <div style={{textAlign:"center",padding:"48px",color:"rgba(255,255,255,.4)"}}>
    <div style={{fontSize:"40px",marginBottom:"12px"}}>🔒</div>
    <div style={{fontSize:"16px",fontWeight:700}}>لا توجد شركات مخصصة لحسابك</div>
    <div style={{fontSize:"12px",marginTop:"8px"}}>تواصل مع المدير لإضافة صلاحيات</div>
  </div>
) : (
  <div className="co-grid" style={{gridTemplateColumns:gridCols}}>
  {cols.map((co, i) => (
  <div key={co.id} className="co-card" style={{"--co-color":co.color,animationDelay:`${i*0.1}s`}} onClick={() => onSelect(co)}>
  <span className="co-icon" style={{animationDelay:`${i*0.5}s`}}>{co.logo}</span>
  <div style={{fontSize:"16px",fontWeight:900,color:"#fff",marginBottom:"6px"}}>{co.nameAr}</div>
  <div style={{fontSize:"11px",color:"rgba(255,255,255,.4)",marginBottom:"12px",direction:"ltr"}}>{co.name}</div>
  <div style={{display:"inline-flex",alignItems:"center",gap:"6px",background:`${co.color}22`,border:`1px solid ${co.color}44`,borderRadius:"20px",padding:"5px 14px"}}>
  <div style={{width:"6px",height:"6px",borderRadius:"50%",background:co.color,flexShrink:0}}/>
  <span style={{fontSize:"11px",color:co.color,fontWeight:700,direction:"ltr"}}>{co.phone}</span>
  </div>
  <div style={{marginTop:"16px",padding:"8px",borderRadius:"8px",background:"rgba(255,255,255,.04)",fontSize:"11px",color:"rgba(255,255,255,.3)"}}>{co.email}</div>
  </div>
  ))}
  </div>
)}
<div style={{textAlign:"center",marginTop:"32px",display:"flex",alignItems:"center",justifyContent:"center",gap:"12px"}}>
  <span style={{color:"rgba(255,255,255,.15)",fontSize:"11px"}}>Invoice System v3.0 • Multi-Company</span>
  {isAdmin && (
    <button onClick={async()=>{await logoutUser();}} style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:"6px",padding:"4px 12px",color:"rgba(255,255,255,.4)",fontFamily:"inherit",fontSize:"11px",cursor:"pointer"}}>خروج</button>
  )}
</div>
</div>
</div>
);
}

// ─── Dashboard skeleton (shown while invoices are being fetched) ──
function DashboardSkeleton({company}){
const col=company.color;
return(
<div aria-busy="true" aria-label="جارٍ تحميل لوحة التحكم">
  <div className="kpi-grid">
    {[0,1,2,3].map(i=>(
      <div key={i} className="card" style={{padding:"16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px"}}>
          <div className="sk" style={{width:"30px",height:"30px",borderRadius:"9px",background:`${col}1a`}}/>
          <div className="sk sk-sm" style={{width:"45%"}}/>
        </div>
        <div className="sk sk-lg" style={{width:"72%",marginBottom:"7px"}}/>
        <div className="sk sk-sm" style={{width:"38%"}}/>
      </div>
    ))}
  </div>
  <div className="chart-grid">
    <div className="card" style={{padding:"18px",minHeight:"230px"}}>
      <div className="sk sk-sm" style={{width:"32%",marginBottom:"14px"}}/>
      <div className="sk" style={{width:"100%",height:"160px"}}/>
    </div>
    <div className="card" style={{padding:"18px",minHeight:"230px"}}>
      <div className="sk sk-sm" style={{width:"40%",marginBottom:"14px"}}/>
      <div className="sk" style={{width:"100%",height:"160px"}}/>
    </div>
  </div>
</div>
);
}

// ── KPI count-up animation hook (easeOutCubic, remembers previous value) ──
function useCountUp(target, duration=850){
const [val,setVal]=useState(0);
const prevRef=useRef(0);
useEffect(()=>{
  const from=prevRef.current;
  const to=typeof target==="number"&&isFinite(target)?target:0;
  const start=performance.now();
  let raf=0;
  const tick=now=>{
    const p=from===to?1:Math.min(1,(now-start)/duration);
    const eased=1-Math.pow(1-p,3);
    setVal(from+(to-from)*eased);
    if(p<1)raf=requestAnimationFrame(tick);
    else prevRef.current=to;
  };
  raf=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(raf);
},[target,duration]);
return val;
}

// Animated KPI card — numbers count up from their previous value
function KpiCard({k, onNavigate}){
const numeric=typeof k.num==="number";
const v=useCountUp(numeric?k.num:0, 850);
const display=numeric
  ? (k.money?fKWD(v):(k.decimals!=null?v.toFixed(k.decimals):String(Math.round(v)))+(k.suffix||""))
  : k.val;
return(
<div key={k.label} style={{background:k.bg,borderRadius:"14px",padding:"14px 16px",border:`1.5px solid ${k.c}22`,...(k.go&&onNavigate?{cursor:"pointer"}:{})}}
  onClick={k.go&&onNavigate?()=>onNavigate(k.go):undefined}
  title={k.go?"اضغط للعرض":""}
  role={k.go&&onNavigate?"button":undefined}
  aria-label={`${k.label}: ${display}`}>
<div style={{fontSize:"22px",marginBottom:"6px"}}>{k.icon}</div>
<div style={{fontSize:"10px",color:"var(--ia-sub)",fontWeight:700,textTransform:"uppercase",letterSpacing:".4px",marginBottom:"3px",display:"flex",alignItems:"center",gap:"5px"}}>{k.label}{k.go&&onNavigate&&<span style={{fontSize:"9px",opacity:.55,fontWeight:900,transform:"scaleX(-1)",display:"inline-block"}}>↩</span>}</div>
<div style={{fontSize:"17px",fontWeight:900,color:k.c,direction:"ltr",textAlign:"right"}}>{display}</div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"5px"}}>
<span style={{fontSize:"11px",color:"var(--ia-sub)"}}>{k.sub}</span>
{k.badge&&<span style={{fontSize:"11px",fontWeight:700,color:k.badgeC,background:k.badgeC+"1a",padding:"1px 8px",borderRadius:"20px"}}>{k.badge}</span>}
</div>
</div>
);
}

function Dashboard({invoices, company, onNavigate}){
const { dark } = useTheme();
const ch = chartColors(dark);
const col = company.color;
const colTx = txAdapt(col, dark);
const cardBg = softAdapt(company.cardBg, dark);
const now = new Date();
const mk=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const tm=mk(now);const pm=mk(new Date(now.getFullYear(),now.getMonth()-1));
const tInvs=invoices.filter(i=>i.date?.startsWith(tm));
const pInvs=invoices.filter(i=>i.date?.startsWith(pm));
const totR=invoices.reduce((s,i)=>s+iT(i),0);
const tR=tInvs.reduce((s,i)=>s+iT(i),0);
const pR=pInvs.reduce((s,i)=>s+iT(i),0);
const unpaid=invoices.filter(i=>pN(i.paid||0)<iT(i));
const unpaidA=unpaid.reduce((s,i)=>s+iT(i)-pN(i.paid||0),0);
const avg=invoices.length?totR/invoices.length:0;
const gPct=pR>0?((tR-pR)/pR*100):tR>0?100:0;
const gUp=gPct>=0;
const uniqueC=new Set(invoices.map(i=>i.clientPhone).filter(Boolean)).size;
const months6=Array.from({length:6}).map((_,i)=>{
const d=new Date(now);d.setMonth(d.getMonth()-5+i);
const key=mk(d);const label=d.toLocaleDateString("ar",{month:"short"});
const rev=invoices.filter(x=>x.date?.startsWith(key)).reduce((s,x)=>s+iT(x),0);
const cnt=invoices.filter(x=>x.date?.startsWith(key)).length;
return{label,rev,cnt};
});
const kpis=[
{icon:"💰",label:"إجمالي الإيرادات",val:fKWD(totR),num:totR,money:true,sub:`${invoices.length} فاتورة`,c:colTx,bg:cardBg,go:{view:"list",status:"all"}},
{icon:"📅",label:"إيرادات هذا الشهر",val:fKWD(tR),num:tR,money:true,sub:`${tInvs.length} فاتورة`,c:txAdapt("#16a34a",dark),bg:softAdapt("#dcfce7",dark),badge:`${gUp?"▲":"▼"} ${Math.abs(gPct).toFixed(1)}%`,badgeC:txAdapt(gUp?"#16a34a":"#dc2626",dark)},
{icon:"⏳",label:"مستحقات غير مدفوعة",val:fKWD(unpaidA),num:unpaidA,money:true,sub:`${unpaid.length} فاتورة`,c:txAdapt("#b45309",dark),bg:softAdapt("#fef3c7",dark),go:{view:"list",status:"unp"}},
{icon:"👥",label:"إجمالي العملاء",val:uniqueC+" عميل",num:uniqueC,suffix:" عميل",sub:`متوسط ${fKWD(avg)}`,c:txAdapt("#7c3aed",dark),bg:softAdapt("#ede9fe",dark),go:{view:"customers"}},
];
return(
<div>
<div className="kpi-grid">
{kpis.map(k=>(
  <KpiCard key={k.label} k={k} onNavigate={onNavigate}/>
))}
</div>
<div className="chart-grid">
<div style={{background:"var(--ia-card)",borderRadius:"14px",padding:"18px 20px",border:"1.5px solid var(--ia-border)"}}>
<div style={{fontSize:"13px",fontWeight:700,color:colTx,marginBottom:"14px"}}>📈 الإيرادات الشهرية</div>
<ResponsiveContainer width="100%" height={170}>
<BarChart data={months6} margin={{top:0,right:4,bottom:0,left:0}}>
<CartesianGrid strokeDasharray="3 3" stroke={ch.grid} vertical={false}/>
<XAxis dataKey="label" tick={{fontSize:11,fill:ch.axis,fontFamily:"Cairo"}} axisLine={false} tickLine={false}/>
<YAxis tick={{fontSize:10,fill:ch.axis2}} axisLine={false} tickLine={false}/>
<Tooltip formatter={v=>[fKWD(v),"الإيرادات"]} contentStyle={{fontFamily:"Cairo",fontSize:12,borderRadius:8,direction:"rtl",background:"var(--ia-card)",border:"1px solid var(--ia-border)",color:"var(--ia-text)"}}/>
<Bar dataKey="rev" fill={dark?lighten(col,0.65):col} radius={[5,5,0,0]}/>
</BarChart>
</ResponsiveContainer>
</div>
<div style={{background:"var(--ia-card)",borderRadius:"14px",padding:"18px 20px",border:"1.5px solid var(--ia-border)",display:"flex",flexDirection:"column"}}>
<div style={{fontSize:"13px",fontWeight:700,color:colTx,marginBottom:"14px"}}>🧾 عدد الفواتير شهرياً</div>
<ResponsiveContainer width="100%" height={130}>
<LineChart data={months6} margin={{top:4,right:8,bottom:0,left:0}}>
<CartesianGrid strokeDasharray="3 3" stroke={ch.grid} vertical={false}/>
<XAxis dataKey="label" tick={{fontSize:11,fill:ch.axis,fontFamily:"Cairo"}} axisLine={false} tickLine={false}/>
<YAxis tick={{fontSize:10,fill:ch.axis2}} axisLine={false} tickLine={false} allowDecimals={false}/>
<Tooltip formatter={v=>[v+" فاتورة","عدد"]} contentStyle={{fontFamily:"Cairo",fontSize:12,borderRadius:8,background:"var(--ia-card)",border:"1px solid var(--ia-border)",color:"var(--ia-text)"}}/>
<Line type="monotone" dataKey="cnt" stroke={ch.green} strokeWidth={3} dot={{r:4,fill:ch.green}} activeDot={{r:6}}/>
</LineChart>
</ResponsiveContainer>
<div style={{marginTop:"auto",paddingTop:"10px"}}>
<div style={{textAlign:"center",background:gUp?softAdapt("#dcfce7",dark):softAdapt("#fee2e2",dark),borderRadius:"8px",padding:"7px"}}>
<span style={{fontWeight:900,fontSize:"13px",color:txAdapt(gUp?"#16a34a":"#dc2626",dark)}}>{gUp?"▲":"▼"} نمو {Math.abs(gPct).toFixed(1)}% عن الشهر الماضي</span>
</div>
</div>
</div>
</div>
</div>
);
}

// ─── Invoice Preview ──────────────────────────────────────────────
function InvPreview({inv, company}){
const c = company;
const sub=inv.items.reduce((s,it)=>s+pN(it.qty)*pN(it.price),0);
const ship=pN(inv.shipping||0);const tot=sub+ship;const paid=pN(inv.paid||0);
const due=tot-paid;
const isCancelled=inv.status==='cancelled';
const stC=stColor[getStatus(inv)];
const stT=stLabel[getStatus(inv)];
const empty=Math.max(0,5-inv.items.length);
const logoImg=getLogoImg(c.id);
const TH={background:c.color,color:"#fff",padding:"9px 10px",fontSize:"11.5px",fontWeight:700,textAlign:"right"};
const TD={padding:"9px 10px",fontSize:"12px",borderBottom:"1px solid #f0f0f0"};
return(
<div style={{background:"#fff",padding:"20px",direction:"rtl",fontFamily:"'Tajawal','Cairo',sans-serif",fontSize:"13px",color:"#1a1a2e"}}>
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
  <div style={{textAlign:"left"}}>
    <div style={{fontSize:"28px",fontWeight:900,color:c.color,letterSpacing:"-1px",lineHeight:1}}>فـاتـورة</div>
    <div style={{fontSize:"12px",color:"#999",marginTop:"5px",direction:"ltr"}}>{inv.invNum}</div>
    <div style={{marginTop:"8px",display:"inline-block",background:stC,color:"#fff",borderRadius:"6px",padding:"3px 12px",fontSize:"11px",fontWeight:700}}>{stT}</div>
  </div>
</div>
<div style={{height:"3px",background:`linear-gradient(to left,${c.color},${c.color}22)`,borderRadius:"3px",marginBottom:"14px"}}/>
<div style={{display:"flex",border:"1px solid #ebebeb",borderRadius:"9px",overflow:"hidden",marginBottom:"16px"}}>
  <div style={{flex:"1.7",padding:"12px 14px",borderLeft:"1px solid #ebebeb"}}>
    <div style={{fontSize:"9px",fontWeight:700,color:c.color,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"6px"}}>صادرة إلى</div>
    <div style={{fontSize:"15px",fontWeight:800,color:"#111",marginBottom:"3px"}}>{inv.clientName||""}</div>
    <div style={{fontSize:"12px",fontWeight:700,color:c.color,direction:"ltr",textAlign:"right",marginBottom:"3px"}}>{inv.clientPhone||""}</div>
    {inv.clientAddress&&<div style={{fontSize:"11px",color:"#777"}}>{inv.clientAddress}</div>}
  </div>
  <div style={{flex:"1",padding:"12px 14px",borderLeft:"1px solid #ebebeb"}}>
    <div style={{fontSize:"9px",fontWeight:700,color:c.color,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"5px"}}>تاريخ الفاتورة</div>
    <div style={{fontSize:"12px",fontWeight:700,marginBottom:"10px"}}>{fDate(inv.date)}</div>
    <div style={{fontSize:"9px",fontWeight:700,color:c.color,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"5px"}}>تاريخ الاستحقاق</div>
    <div style={{fontSize:"12px",fontWeight:700}}>{fDate(inv.dueDate)}</div>
  </div>
  <div style={{flex:"1",padding:"12px 14px"}}>
    <div style={{fontSize:"9px",fontWeight:700,color:c.color,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"5px"}}>المبلغ المستحق</div>
    <div style={{fontSize:"20px",fontWeight:900,color:stC,direction:"ltr",textAlign:"right",lineHeight:1}}>{fKWD(due)}</div>
    <div style={{marginTop:"10px",fontSize:"9px",fontWeight:700,color:c.color,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"5px"}}>المسؤول</div>
    <div style={{fontSize:"11px",fontWeight:600}}>{c.manager}</div>
  </div>
</div>
<table style={{width:"100%",borderCollapse:"collapse",marginBottom:"14px"}}>
<thead><tr style={{background:c.color}}>
  <th style={{...TH,width:"28px",textAlign:"center"}}>#</th>
  {["المنتج / الخدمة","الوصف","الكمية","سعر الوحدة","الإجمالي"].map(h=><th key={h} style={TH}>{h}</th>)}
</tr></thead>
<tbody>
{inv.items.map((it,i)=>(
<tr key={i} style={{background:i%2===1?"#f7f8fc":"#fff"}}>
<td style={{...TD,textAlign:"center",color:"#aaa",fontSize:"11px"}}>{i+1}</td>
<td style={{...TD,fontWeight:600}}>{it.name||""}</td>
<td style={{...TD,color:"#666",fontSize:"11.5px"}}>{it.desc||""}</td>
<td style={{...TD,textAlign:"center"}}>{it.qty}</td>
<td style={{...TD,textAlign:"left",direction:"ltr"}}>{fKWD(it.price)}</td>
<td style={{...TD,textAlign:"left",fontWeight:700,direction:"ltr"}}>{fKWD(pN(it.qty)*pN(it.price))}</td>
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
<tr><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",color:"#666",fontSize:"12.5px"}}>المجموع الجزئي</td><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",textAlign:"left",fontWeight:600,fontSize:"12.5px",direction:"ltr"}}>{fKWD(sub)}</td></tr>
{ship>0&&<tr><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",color:"#666",fontSize:"12.5px"}}>التوصيل</td><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",textAlign:"left",fontWeight:600,fontSize:"12.5px",direction:"ltr"}}>{fKWD(ship)}</td></tr>}
<tr style={{background:c.color}}><td style={{padding:"9px 14px",color:"#fff",fontWeight:800,fontSize:"13px"}}>إجمالي الفاتورة</td><td style={{padding:"9px 14px",color:"#fff",fontWeight:900,fontSize:"13px",textAlign:"left",direction:"ltr"}}>{fKWD(tot)}</td></tr>
<tr><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",color:"#16a34a",fontSize:"12.5px"}}>المدفوع</td><td style={{padding:"6px 14px",borderBottom:"1px solid #f0f0f0",textAlign:"left",fontWeight:600,color:"#16a34a",fontSize:"12.5px",direction:"ltr"}}>{fKWD(paid)}</td></tr>
<tr style={{background:"#111827"}}><td style={{padding:"9px 14px",color:"#fff",fontWeight:800,fontSize:"13px"}}>المبلغ المستحق</td><td style={{padding:"9px 14px",color:stC,fontWeight:900,fontSize:"14px",textAlign:"left",direction:"ltr"}}>{fKWD(due)}</td></tr>
</tbody>
</table>
{inv.notes&&<div style={{marginTop:"14px",color:"#666",fontSize:"12px",borderTop:"1px solid #eee",paddingTop:"10px"}}>ملاحظات: {inv.notes}</div>}
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
const [err,setErr]=useState("");
const [busy,setBusy]=useState(false);
const isEdit=!!initial?.id;

return(
<div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",direction:"rtl"}} onClick={busy?undefined:onClose}>
  <div className="card" style={{width:"100%",maxWidth:"460px",overflow:"hidden",display:"flex",flexDirection:"column",animation:"fadeUp .25s"}} onClick={e=>e.stopPropagation()}>

    <div style={{background:isEdit?"#f59e0b":col,padding:"15px 20px",display:"flex",alignItems:"center",gap:"12px",flexShrink:0}}>
      <div style={{width:"40px",height:"40px",background:"rgba(255,255,255,.18)",borderRadius:"11px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"19px",flexShrink:0}}>
        {isEdit?"✏️":"📇"}
      </div>
      <div style={{flex:1,color:"#fff"}}>
        <div style={{fontWeight:900,fontSize:"15px"}}>{isEdit?"تعديل بيانات العميل":"إضافة عميل جديد"}</div>
        <div style={{fontSize:"11.5px",opacity:.75}}>سيتم حفظه في دليل {company.nameAr}</div>
      </div>
      <button onClick={onClose} disabled={busy} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"6px 12px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer",flexShrink:0}}>✕</button>
    </div>

    <div style={{padding:"18px 20px"}}>
      <div className="form-2col" style={{marginBottom:"10px"}}>
        <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>الاسم *</label>
          <input className="inp" placeholder="مثال: عبدالله حسن" value={name} onChange={e=>setName(e.target.value)} autoFocus/></div>
        <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>التلفون *</label>
          <input className="inp" style={{direction:"ltr",textAlign:"right"}} placeholder="9xxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)}/></div>
      </div>
      <div style={{marginBottom:"10px"}}>
        <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>البريد الإلكتروني (اختياري)</label>
        <input className="inp" style={{direction:"ltr",textAlign:"right"}} placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)}/>
      </div>
      <div style={{marginBottom:"14px"}}>
        <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>العنوان (اختياري)</label>
        <input className="inp" placeholder="المنطقة / العنوان" value={address} onChange={e=>setAddress(e.target.value)}/>
      </div>

      {err&&<div style={{background:"var(--ia-red-bg)",border:"1px solid var(--ia-red-bd)",color:"var(--ia-red-tx)",borderRadius:"8px",padding:"8px 12px",fontSize:"12px",fontWeight:700,marginBottom:"12px"}}>⚠️ {err}</div>}

      <div style={{display:"flex",gap:"8px"}}>
        <button className="btn" disabled={busy} style={{background:isEdit?"#f59e0b":col,color:"#fff",flex:1,fontSize:"14px",padding:"10px",opacity:busy?.7:1}} 
          onClick={async()=>{
            if(!name.trim()){setErr("اسم العميل مطلوب");return;}
            if(!norm(phone)){setErr("رقم التلفون مطلوب");return;}
            setBusy(true);
            try{
              await onSave({name:name.trim(),phone:norm(phone),email:email.trim()||null,address:address.trim()||null});
            }catch(e){
              setBusy(false);
              setErr("تعذّر الحفظ — تحقق من الاتصال ثم أعد المحاولة");
            }
          }}>
          {busy?"⏳ جارٍ الحفظ...":isEdit?"💾 حفظ التعديلات":"➕ إضافة العميل"}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={onClose}>إلغاء</button>
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
const [modal,setModal]=useState(null); // {mode:'add'} | {mode:'edit', client}
const [del,setDel]=useState(null);
const [imp,setImp]=useState(null);   // clients-CSV import preview: {rows, errors, file}
const [impBusy,setImpBusy]=useState(false);
const impFileRef=useRef();

// ── CSV export of the saved-client directory ──
const exportClientsCSV = () => {
  if (!clients.length) { toast_("لا يوجد عملاء محفوظون للتصدير","warn"); return; }
  const headers = ["الاسم","التلفون","البريد","العنوان"];
  const rows = clients.map(c => ({
    "الاسم": c.name || "", "التلفون": c.phone || "",
    "البريد": c.email || "", "العنوان": c.address || "",
  }));
  downloadCSV(toCSV(headers, rows), `Clients_${company.id}_${today()}.csv`);
  toast_("⬇️ تم تنزيل دليل العملاء (" + clients.length + " عميل)");
};

// ── CSV import (dedupes by phone against the current directory) ──
const doImportClients = async () => {
  if (!imp?.rows?.length) return;
  setImpBusy(true);
  const existing = new Set(clients.map(c => norm(c.phone || "")));
  const seen = new Set();
  let added = 0, skipped = 0;
  for (const r of imp.rows) {
    const ph = norm(r.phone);
    if (existing.has(ph) || seen.has(ph)) { skipped++; continue; }
    seen.add(ph);
    try { await api.createClient({ name: r.name, phone: ph, email: r.email || null, address: r.address || null, company: company.id }); added++; }
    catch { skipped++; }
  }
  setImpBusy(false);
  setImp(null);
  onRefresh();
  toast_(added ? `✅ تم استيراد ${added} عميل${skipped ? ` — تخطّي ${skipped} مكرر/غير صالح` : ""}` : "لم يُضف أي عميل جديد (كله مكرر)", added ? "ok" : "warn");
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
  toast_("✅ تم إضافة "+data.name+" إلى الدليل");
}else{
  await api.updateClient(modal.client.id,data);
  toast_("✅ تم تحديث بيانات "+data.name);
}
setModal(null);
onRefresh();
};

const confirmDelClient=async()=>{
try{ await api.deleteClient(del.id); }catch{}
setDel(null);
onRefresh();
toast_("🗑️ تم حذف "+(del.name||"العميل")+" من الدليل","warn");
};

return(
<div className="card" style={{overflow:"hidden",animation:"fadeUp .25s"}}>
  {/* Section header */}
  <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"14px 18px",borderBottom:"1.5px solid var(--ia-border3)",background:"linear-gradient(135deg,var(--ia-soft),var(--ia-card))",flexWrap:"wrap"}}>
    <div style={{width:"38px",height:"38px",background:cardBg,border:`1.5px solid ${col}33`,borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0}}>📇</div>
    <div style={{flex:1,minWidth:"150px"}}>
      <div style={{fontSize:"14px",fontWeight:900,color:"var(--ia-text)"}}>دليل العملاء المحفوظين</div>
      <div style={{fontSize:"11px",color:"var(--ia-muted)",fontWeight:600}}>للاستخدام السريع عند إنشاء الفواتير — يُحفظ لكل شركة على حدة</div>
    </div>
    <span style={{background:"var(--ia-blue-bg)",color:"var(--ia-blue-tx)",borderRadius:"20px",padding:"3px 11px",fontSize:"11px",fontWeight:800}}>{clients.length} محفوظ</span>
    <button className="btn" title="تنزيل الدليل كملف CSV (يفتح في Excel)" style={{background:"var(--ia-ghost-bg)",color:"var(--ia-ghost-tx)",padding:"7px 11px",fontSize:"12px"}} onClick={exportClientsCSV}>⬇️ CSV</button>
    {canEdit&&<button className="btn" title="استيراد عملاء من ملف CSV (الاسم + التلفون مطلوبان)" style={{background:"#0f766e",color:"#fff",padding:"7px 11px",fontSize:"12px"}} onClick={()=>impFileRef.current?.click()}>⬆️ استيراد</button>}
    <input ref={impFileRef} type="file" accept=".csv,.txt" style={{display:"none"}} onChange={e=>{
      const file=e.target.files[0];
      e.target.value="";
      if(!file)return;
      const reader=new FileReader();
      reader.onload=()=>{
        const res=parseClientsCSV(String(reader.result||""));
        if(!res.rows.length){toast_("❌ "+(res.errors[0]||"ملف غير صالح"),"warn");return;}
        setImp(res);
      };
      reader.onerror=()=>toast_("❌ تعذّر قراءة الملف","warn");
      reader.readAsText(file,"utf-8");
    }}/>
    {canEdit&&<button className="btn" style={{background:col,color:"#fff",padding:"7px 13px",fontSize:"12px"}} onClick={()=>setModal({mode:"add"})}>➕ عميل جديد</button>}
  </div>

  {clients.length===0?(
    <div style={{padding:"34px",textAlign:"center",color:"var(--ia-muted)"}}>
      <div style={{fontSize:"34px",marginBottom:"8px"}}>📇</div>
      <div style={{fontWeight:700,fontSize:"13px",marginBottom:"4px"}}>لا يوجد عملاء محفوظون بعد</div>
      <div style={{fontSize:"12px",marginBottom:"14px"}}>أضف عميلك الأول ليظهر هنا، أو سيُضاف تلقائياً عند إنشاء أول فاتورة له</div>
      {canEdit&&<button className="btn" style={{background:col,color:"#fff"}} onClick={()=>setModal({mode:"add"})}>➕ إضافة عميل</button>}
    </div>
  ):(
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr style={{background:"var(--ia-soft)",borderBottom:"2px solid var(--ia-border2)"}}>
          {["العميل","التلفون","العنوان","إجمالي الإنفاق","الفواتير","آخر شراء",""].map(h=>(
            <th key={h} style={{padding:"10px 12px",fontSize:"11px",fontWeight:700,color:"var(--ia-sub)",textAlign:"right",textTransform:"uppercase",letterSpacing:".3px",whiteSpace:"nowrap"}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {clients.map((c,i)=>{
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
                      {c.email&&<div style={{fontSize:"10.5px",color:"var(--ia-muted)",direction:"ltr",textAlign:"right"}}>{c.email}</div>}
                    </div>
                  </div>
                </td>
                <td style={{padding:"10px 12px",direction:"ltr",textAlign:"right",color:"var(--ia-link)",fontSize:"12.5px",fontWeight:600,whiteSpace:"nowrap"}}>{c.phone||"—"}</td>
                <td style={{padding:"10px 12px",color:"var(--ia-sub)",fontSize:"12px",maxWidth:"150px"}}>
                  <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.address||"—"}</div>
                </td>
                <td style={{padding:"10px 12px",fontWeight:800,color:st?colTx:"var(--ia-muted)",whiteSpace:"nowrap"}}>{st?fKWD(st.spent):"—"}</td>
                <td style={{padding:"10px 12px",textAlign:"center"}}>
                  {st?<span style={{background:"var(--ia-blue-bg)",color:"var(--ia-blue-tx)",borderRadius:"20px",padding:"2px 9px",fontSize:"11px",fontWeight:700}}>{st.count}</span>
                     :<span style={{color:"#d1d5db",fontSize:"11px"}}>جديد</span>}
                </td>
                <td style={{padding:"10px 12px",color:"var(--ia-sub)",fontSize:"11.5px",whiteSpace:"nowrap"}}>{st?fDate(st.lastDate):"—"}</td>
                <td style={{padding:"10px 12px"}} onClick={e=>e.stopPropagation()}>
                  {canEdit&&(
                    <div style={{display:"flex",gap:"4px"}}>
                      <button className="btn" title="تعديل بيانات العميل" style={{background:"#f59e0b",color:"#fff",padding:"5px 9px",fontSize:"12px"}} onClick={()=>setModal({mode:"edit",client:c})}>✏️</button>
                      <button className="btn btn-red" title="حذف من الدليل" style={{padding:"5px 9px",fontSize:"12px"}} onClick={()=>setDel(c)}>🗑️</button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
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
    <div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",direction:"rtl"}} onClick={()=>impBusy?undefined:setImp(null)}>
      <div className="card" style={{width:"100%",maxWidth:"480px",maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column",animation:"fadeUp .25s"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:"#0f766e",padding:"14px 18px",display:"flex",alignItems:"center",gap:"11px",flexShrink:0}}>
          <div style={{width:"38px",height:"38px",background:"rgba(255,255,255,.18)",borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px"}}>⬆️</div>
          <div style={{flex:1,color:"#fff"}}>
            <div style={{fontWeight:900,fontSize:"14.5px"}}>استيراد عملاء من CSV</div>
            <div style={{fontSize:"11.5px",opacity:.8}}>{imp.rows.length} صف صالح — سيُتخطى المكرر تلقائياً</div>
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
                {["#","الاسم","التلفون","البريد","العنوان"].map(h=>(<th key={h} style={{padding:"7px 10px",fontSize:"10.5px",fontWeight:800,color:"var(--ia-sub)",textAlign:"right"}}>{h}</th>))}
              </tr></thead>
              <tbody>
                {imp.rows.slice(0,30).map((r,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid var(--ia-border3)",background:i%2===0?"var(--ia-card)":"var(--ia-row-alt)"}}>
                    <td style={{padding:"6px 10px",color:"var(--ia-muted)",fontWeight:700}}>{i+1}</td>
                    <td style={{padding:"6px 10px",fontWeight:700}}>{r.name}</td>
                    <td style={{padding:"6px 10px",direction:"ltr",textAlign:"right",color:"var(--ia-link)",fontWeight:600}}>{r.phone}</td>
                    <td style={{padding:"6px 10px",direction:"ltr",textAlign:"right",color:"var(--ia-muted)",fontSize:"11px"}}>{r.email||"—"}</td>
                    <td style={{padding:"6px 10px",color:"var(--ia-sub)",fontSize:"11px",maxWidth:"110px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.address||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {imp.rows.length>30&&<div style={{textAlign:"center",fontSize:"11px",color:"var(--ia-muted)",marginTop:"8px"}}>… و {imp.rows.length-30} عميل آخر</div>}
        </div>
        <div style={{display:"flex",gap:"9px",padding:"13px 18px",borderTop:"1px solid var(--ia-border3)",background:"var(--ia-soft)",flexShrink:0}}>
          <button className="btn" disabled={impBusy} style={{background:"#0f766e",color:"#fff",flex:1,fontSize:"13.5px",padding:"10px",opacity:impBusy?.7:1}} onClick={doImportClients}>
            {impBusy?"⏳ جارٍ الاستيراد...":`💾 استيراد ${imp.rows.length} عميل`}
          </button>
          <button className="btn" disabled={impBusy} style={{background:"var(--ia-ghost-bg)",color:"var(--ia-ghost-tx)",fontSize:"13px",padding:"10px 14px"}} onClick={()=>setImp(null)}>إلغاء</button>
        </div>
      </div>
    </div>
  )}

  {/* Delete confirmation */}
  {del&&(
    <div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",direction:"rtl"}} onClick={()=>setDel(null)}>
      <div className="card" style={{padding:"26px 30px",textAlign:"center",maxWidth:"330px",animation:"fadeUp .2s"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:"36px",marginBottom:"8px"}}>🗑️</div>
        <div style={{fontWeight:800,fontSize:"14.5px",marginBottom:"6px"}}>حذف العميل من الدليل؟</div>
        <div style={{color:"var(--ia-sub)",fontSize:"12.5px",marginBottom:"16px",lineHeight:1.7}}>
          سيتم حذف <b>{del.name}</b> من دليل العملاء.<br/>
          <span style={{fontSize:"11px",color:"var(--ia-muted)"}}>فواتيره السابقة لن تتأثر.</span>
        </div>
        <div style={{display:"flex",gap:"9px",justifyContent:"center"}}>
          <button className="btn btn-red" onClick={confirmDelClient}>نعم، احذف</button>
          <button className="btn btn-ghost" onClick={()=>setDel(null)}>إلغاء</button>
        </div>
      </div>
    </div>
  )}
</div>
);
}

// ─── Customers ────────────────────────────────────────────────────
function Customers({invoices, company, onImportDone, onOpenInvoice, clients, refreshClients, toast_}){
const { perms } = useAuth();
const { dark } = useTheme();
const col = company.color;
const colTx = txAdapt(col, dark);
const cardBg = softAdapt(company.cardBg, dark);
const [search,setSearch]=useState("");
const [sort,setSort]=useState("spent");
const [showImport,setShowImport]=useState(false);
const [selCustomer,setSelCustomer]=useState(null);

const map={};
[...invoices].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)).forEach(inv=>{
const ph=inv.clientPhone||"";
if(!map[ph])map[ph]={phone:ph,name:inv.clientName||ph||"—",address:inv.clientAddress||"",totalSpent:0,count:0,lastDate:"",firstDate:inv.date,products:[]};
map[ph].totalSpent+=iT(inv);map[ph].count+=1;
if(!map[ph].lastDate||inv.date>map[ph].lastDate)map[ph].lastDate=inv.date;
inv.items.forEach(it=>{if(it.name&&!map[ph].products.includes(it.name))map[ph].products.push(it.name);});
});
let customers=Object.values(map);
if(search){const s=toW(search).toLowerCase();customers=customers.filter(c=>c.phone.includes(s)||c.name.toLowerCase().includes(s));}
customers.sort((a,b)=>sort==="spent"?b.totalSpent-a.totalSpent:sort==="count"?b.count-a.count:b.lastDate.localeCompare(a.lastDate));

const customerInvoices=selCustomer?invoices.filter(inv=>(inv.clientPhone||"")===selCustomer.phone).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)):[];

return(
<div>
{showImport&&(
<AliphiaImportModal
company={company}
existingInvoices={invoices}
onImport={list=>{onImportDone(list);setShowImport(false);}}
onClose={()=>setShowImport(false)}
/>
)}

{/* ── Customer Detail Modal ── */}
{selCustomer&&(
<div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",direction:"rtl"}} onClick={()=>setSelCustomer(null)}>
<div className="card" style={{width:"100%",maxWidth:"640px",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",animation:"fadeUp .25s"}} onClick={e=>e.stopPropagation()}>

  {/* Modal header */}
  <div style={{background:col,padding:"16px 20px",display:"flex",alignItems:"center",gap:"12px",flexShrink:0}}>
    <div style={{width:"46px",height:"46px",background:"rgba(255,255,255,.18)",borderRadius:"12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",fontWeight:900,color:"#fff",flexShrink:0}}>
      {(selCustomer.name||"؟").trim().charAt(0)}
    </div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{color:"#fff",fontWeight:900,fontSize:"15px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selCustomer.name}</div>
      <div style={{color:"rgba(255,255,255,.75)",fontSize:"12px",direction:"ltr",textAlign:"right"}}>{selCustomer.phone||"—"}</div>
    </div>
    <button onClick={()=>setSelCustomer(null)} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"6px 12px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer",flexShrink:0}}>✕ إغلاق</button>
  </div>

  <div style={{overflowY:"auto",flex:1,padding:"18px 20px"}}>

    {/* Contact actions */}
    <div style={{display:"flex",gap:"8px",marginBottom:"14px",flexWrap:"wrap"}}>
      {selCustomer.phone&&(
        <>
        <a href={`https://wa.me/965${selCustomer.phone.replace(/^\+?965/,"")}`} target="_blank" rel="noopener noreferrer" className="btn" style={{background:"#16a34a",color:"#fff",textDecoration:"none",padding:"9px 16px"}}>💬 واتساب</a>
        <a href={`tel:+965${selCustomer.phone.replace(/^\+?965/,"")}`} className="btn" style={{background:"#2563eb",color:"#fff",textDecoration:"none",padding:"9px 16px"}}>📞 اتصال</a>
        </>
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
        <div style={{fontSize:"10px",color:"var(--ia-sub)",fontWeight:700,marginBottom:"3px"}}>إجمالي الإنفاق</div>
        <div style={{fontSize:"16px",fontWeight:900,color:colTx}}>{fKWD(selCustomer.totalSpent)}</div>
      </div>
      <div style={{background:"var(--ia-blue-bg)",borderRadius:"10px",padding:"10px 14px",border:"1px solid #93c5fd44"}}>
        <div style={{fontSize:"10px",color:"var(--ia-blue-tx2)",fontWeight:700,marginBottom:"3px"}}>عدد الفواتير</div>
        <div style={{fontSize:"16px",fontWeight:900,color:"var(--ia-blue-tx)"}}>{selCustomer.count} فاتورة</div>
      </div>
      <div style={{background:"var(--ia-ok-bg)",borderRadius:"10px",padding:"10px 14px",border:"1px solid #86efac44"}}>
        <div style={{fontSize:"10px",color:"var(--ia-ok-tx2)",fontWeight:700,marginBottom:"3px"}}>أول شراء</div>
        <div style={{fontSize:"13px",fontWeight:800,color:"var(--ia-ok-tx)"}}>{fDate(selCustomer.firstDate)}</div>
      </div>
      <div style={{background:"var(--ia-warn-bg)",borderRadius:"10px",padding:"10px 14px",border:"1px solid #fde68a44"}}>
        <div style={{fontSize:"10px",color:"var(--ia-warn-tx2)",fontWeight:700,marginBottom:"3px"}}>آخر شراء</div>
        <div style={{fontSize:"13px",fontWeight:800,color:"var(--ia-warn-tx)"}}>{fDate(selCustomer.lastDate)}</div>
      </div>
    </div>

    {/* Products purchased */}
    {selCustomer.products.length>0&&(
      <div style={{marginBottom:"16px"}}>
        <div style={{fontSize:"11px",fontWeight:900,color:"var(--ia-sub)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"8px"}}>🛍️ المنتجات المشتراة ({selCustomer.products.length})</div>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
          {selCustomer.products.map(p=>(
            <span key={p} style={{background:"var(--ia-chip)",border:"1px solid var(--ia-border)",borderRadius:"20px",padding:"4px 12px",fontSize:"11.5px",color:"var(--ia-text2)",fontWeight:600}}>{p}</span>
          ))}
        </div>
      </div>
    )}

    {/* Invoice history */}
    <div style={{fontSize:"11px",fontWeight:900,color:"var(--ia-sub)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"8px"}}>🧾 سجل الفواتير — اضغط لعرض الفاتورة</div>
    <div style={{border:"1px solid var(--ia-border)",borderRadius:"10px",overflow:"hidden",maxHeight:"300px",overflowY:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12.5px"}}>
        <thead><tr style={{background:"var(--ia-soft)",position:"sticky",top:0,zIndex:1}}>
          {["رقم","التاريخ","الإجمالي","المدفوع","الحالة"].map(h=>(
            <th key={h} style={{padding:"8px 12px",fontSize:"10.5px",fontWeight:700,color:"var(--ia-sub)",textAlign:"right"}}>{h}</th>
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
                <td style={{padding:"8px 12px"}}><span className={`b-${st}`}>{stLabel[st]}</span></td>
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
<div style={{display:"flex",gap:"10px",marginBottom:"14px",alignItems:"center",flexWrap:"wrap"}}>
<input className="inp" style={{flex:1,minWidth:"200px",padding:"9px 14px"}} placeholder="🔍 ابحث باسم العميل أو التلفون..." value={search} onChange={e=>setSearch(e.target.value)}/>
<select className="inp" style={{width:"auto",padding:"9px 12px"}} value={sort} onChange={e=>setSort(e.target.value)}>
<option value="spent">ترتيب: أعلى إنفاق</option>
<option value="count">ترتيب: أكثر فواتير</option>
<option value="last">ترتيب: آخر شراء</option>
</select>
{/* ── Aliphia Import Button ── */}
<button
className="btn"
style={{background:"#0f766e",color:"#fff",whiteSpace:"nowrap",gap:"6px",border:"none",display:"inline-flex",alignItems:"center"}}
onClick={()=>setShowImport(true)}
>
<span style={{fontSize:"15px"}}>📥</span> استيراد Aliphia
</button>
{!!perms.export_data&&<button className="btn" style={{background:col,color:"#fff",whiteSpace:"nowrap"}} onClick={()=>exportMetaAudience(invoices)}>⬇️ تصدير Excel للميتا</button>}
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"14px"}}>
{[
{l:"إجمالي العملاء",v:customers.length+" عميل",c:colTx,bg:cardBg},
{l:"إجمالي الإنفاق",v:fKWD(customers.reduce((s,c)=>s+c.totalSpent,0)),c:txAdapt("#16a34a",dark),bg:softAdapt("#dcfce7",dark)},
{l:"متوسط الإنفاق / عميل",v:fKWD(customers.length?customers.reduce((s,c)=>s+c.totalSpent,0)/customers.length:0),c:txAdapt("#7c3aed",dark),bg:softAdapt("#ede9fe",dark)},
].map(s=>(
<div key={s.l} style={{background:s.bg,borderRadius:"10px",padding:"12px 16px",border:`1px solid ${s.c}22`}}>
<div style={{fontSize:"10px",color:"var(--ia-sub)",fontWeight:700,textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
<div style={{fontSize:"16px",fontWeight:900,color:s.c}}>{s.v}</div>
</div>
))}
</div>
{customers.length===0?(
<div className="card" style={{padding:"48px",textAlign:"center",color:"var(--ia-muted)"}}><div style={{fontSize:"40px",marginBottom:"10px"}}>👥</div><div style={{fontWeight:600}}>لا توجد عملاء</div></div>
):(
<div className="card" style={{overflow:"hidden"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><tr style={{background:"var(--ia-soft)",borderBottom:"2px solid var(--ia-border2)"}}>
{["العميل","التلفون","إجمالي الإنفاق","عدد الفواتير","آخر شراء","المنتجات","للميتا"].map(h=>(
<th key={h} style={{padding:"10px 12px",fontSize:"11px",fontWeight:700,color:"var(--ia-sub)",textAlign:"right",textTransform:"uppercase",letterSpacing:".3px"}}>{h}</th>
))}
</tr></thead>
<tbody>
{customers.map((c,i)=>(
<tr key={c.phone} onClick={()=>setSelCustomer(c)}
style={{borderBottom:"1px solid var(--ia-border3)",background:selCustomer&&selCustomer.phone===c.phone?`${col}0d`:(i%2===0?"var(--ia-card)":"var(--ia-row-alt)"),cursor:"pointer"}}
className="trow">
<td style={{padding:"11px 12px",fontWeight:600,fontSize:"13px"}}>{c.name}</td>
<td style={{padding:"11px 12px",direction:"ltr",textAlign:"right",color:"var(--ia-link)",fontSize:"13px"}}>{c.phone}</td>
<td style={{padding:"11px 12px",fontWeight:700,color:colTx}}>{fKWD(c.totalSpent)}</td>
<td style={{padding:"11px 12px",textAlign:"center"}}><span style={{background:"var(--ia-blue-bg)",color:"var(--ia-blue-tx)",borderRadius:"20px",padding:"2px 8px",fontSize:"11px",fontWeight:700}}>{c.count}</span></td>
<td style={{padding:"11px 12px",color:"var(--ia-sub)",fontSize:"12px"}}>{fDate(c.lastDate)}</td>
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
  if (!nums.length) { toast_("لا توجد فواتير محددة", "warn"); return; }
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
  toast_("📋 تم نسخ " + nums.length + " رقم — الصقها في قائمة Broadcast في واتساب");
};

const sendAll = () => {
  if (!chosen.length) { toast_("حدّد فاتورة واحدة على الأقل", "warn"); return; }
  chosen.forEach((inv, i) => {
    const href = waReminderHref(inv, company);
    logReminderSent(inv, company, href);
    setTimeout(() => { try { window.open(href, "_blank"); } catch {} }, i * 400);
  });
  toast_("🚀 جارٍ فتح واتساب لـ " + chosen.length + " عميل");
};

return(
<div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:2200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",direction:"rtl"}} onClick={onClose}>
  <div className="card" style={{width:"100%",maxWidth:"560px",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",animation:"fadeUp .25s"}} onClick={e=>e.stopPropagation()}>

    {/* Header */}
    <div style={{background:col,padding:"15px 20px",display:"flex",alignItems:"center",gap:"12px",flexShrink:0}}>
      <div style={{width:"42px",height:"42px",background:"rgba(255,255,255,.18)",borderRadius:"11px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",flexShrink:0}}>📣</div>
      <div style={{flex:1,minWidth:0,color:"#fff"}}>
        <div style={{fontWeight:900,fontSize:"15px"}}>تذكير جماعي بالسداد</div>
        <div style={{fontSize:"11.5px",opacity:.8}}>{sendable.length} فاتورة متأخرة بإجمالي متبقٍ {fKWD(overdue.reduce((s,i)=>s+iT(i)-pN(i.paid||0),0))}</div>
      </div>
      <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"6px 12px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer",flexShrink:0}}>✕</button>
    </div>

    {/* Actions bar */}
    <div style={{display:"flex",gap:"8px",alignItems:"center",padding:"12px 18px",borderBottom:"1px solid var(--ia-border3)",background:"var(--ia-soft)",flexWrap:"wrap",flexShrink:0}}>
      <label style={{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer",fontSize:"12px",fontWeight:800,color:"var(--ia-text2)",userSelect:"none"}}>
        <input type="checkbox" checked={allSel} onChange={toggleAll} style={{accentColor:col,cursor:"pointer",width:"15px",height:"15px"}}/>
        تحديد الكل
      </label>
      <span style={{fontSize:"11.5px",fontWeight:700,color:"var(--ia-sub)"}}>{chosen.length} محدد • {fKWD(totalDue)}</span>
      <div style={{flex:1}}/>
      <button className="btn" style={{background:copied?"#15803d":"#2563eb",color:"#fff",padding:"6px 12px",fontSize:"12px"}} onClick={copyNumbers}>{copied?"✅ تم النسخ":"📋 نسخ الأرقام"}</button>
      <button className="btn wa-btn" style={{color:"#fff",padding:"6px 12px",fontSize:"12px"}} onClick={sendAll}>🚀 إرسال ({chosen.length})</button>
    </div>

    {/* Rows */}
    <div style={{overflowY:"auto",flex:1,padding:"10px 14px"}}>
      {sendable.length===0?(
        <div style={{textAlign:"center",color:"var(--ia-muted)",padding:"32px 0"}}>
          <div style={{fontSize:"34px",marginBottom:"8px"}}>👍</div>
          <div style={{fontWeight:700,fontSize:"13px"}}>كل الفواتير المتأخرة بلا أرقام تلفون</div>
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
              <div style={{fontSize:"10.5px",color:"var(--ia-sub)",direction:"ltr",textAlign:"right"}}>{inv.clientPhone}</div>
            </div>
            <span className="b-inv" style={{flexShrink:0}}>{inv.invNum}</span>
            <div style={{textAlign:"left",flexShrink:0,minWidth:"70px"}}>
              <div style={{fontWeight:900,fontSize:"12.5px",color:"var(--ia-red-tx)",direction:"ltr"}}>{fKWD(due)}</div>
              <div style={{fontSize:"10px",fontWeight:800,color:"var(--ia-red-tx)"}}>⏰ {od} يوم</div>
            </div>
            <a href={waReminderHref(inv,company)} target="_blank" rel="noopener noreferrer" className="btn wa-btn" title="إرسال تذكير لهذا العميل"
              style={{color:"#fff",padding:"5px 8px",fontSize:"12px",textDecoration:"none",flexShrink:0}}
              onClick={e=>{e.stopPropagation();logReminderSent(inv,company,waReminderHref(inv,company));}}>📣</a>
          </div>
        );
      })}
    </div>

    {/* Footer hint */}
    <div style={{padding:"10px 18px",borderTop:"1px solid var(--ia-border3)",background:"var(--ia-soft)",fontSize:"11px",color:"var(--ia-sub)",lineHeight:1.7,flexShrink:0}}>
      💡 سيفتح زر «إرسال» محادثة واتساب لكل عميل على حدة (برسالة جاهزة).
      لإرسال قائمة تذكير واحدة للجميع استخدم «نسخ الأرقام» ثم أنشئ <b>Broadcast</b> في واتساب.
      اسمح بالـ Popups للمتصفح.
    </div>
  </div>
</div>
);
}

// ─── MAIN APP ─────────────────────────────────────────────────────
export default function App(){
const { user, profile, loading: authLoading, isAdmin, canEdit, allowedCompanies, perms } = useAuth();
const [selectedCompany,setCompany]=useState(null);
const [invoices,setInvoices]=useState([]);
const [view,setView]=useState("dash");
const [search,setSearch]=useState("");
const [selInv,setSelInv]=useState(null);
const [printRange,setPrintRange]=useState({from:"",to:""});
const [bulkText,setBulkText]=useState("");
const [bulkParsed,setBulkParsed]=useState([]);
const [bulkStep,setBulkStep]=useState(0);
const [toast,setToast]=useState(null);
const [pdfBusy,setPdfBusy]=useState(false);
const [printStyle,setPrintStyle]=useState(()=>{try{return localStorage.getItem("tw_print_style")||"classic";}catch{return"classic";}});
const setPStyle=v=>{setPrintStyle(v);try{localStorage.setItem("tw_print_style",v);}catch{}};
const [delModal,setDelModal]=useState(null);
const [showAliphia,setShowAliphia]=useState(false);
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
const { dark, toggle } = useTheme();   // light/dark theme (hooks must run before early returns)

const emptyForm=()=>({clientName:"",clientPhone:"",clientAddress:"",items:[{name:"",desc:"",qty:1,price:""}],shipping:0,date:today(),dueDate:addD(today(),30),paid:0,notes:""});
const [form,setForm]=useState(emptyForm());

// Filter available companies based on user permissions
const availableCompanies = Object.values(COMPANIES).filter(co =>
  allowedCompanies.includes(co.id)
);

// Auto-direct single-company users straight to their dashboard (skip selector).
// Derived during render instead of an effect (lint-clean, no cascading renders):
// when logged out (allowedCompanies empty) this resolves back to null automatically.
const company = (!authLoading && selectedCompany===null && availableCompanies.length===1)
  ? availableCompanies[0]
  : selectedCompany;

const refreshInvoices = useCallback(async () => {
  if (!company) return;
  setInvLoading(true);
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
const switchCompany=()=>{setCompany(null);setView("dash");setSelInv(null);setSearch("");setSelectedIds([]);};

const persist=useCallback(async list=>{
setInvoices(list);
if(company)dbSet(company.sk,list);
},[company]);

const toast_=(msg,type="ok")=>{setToast({msg,type});setTimeout(()=>setToast(null),2600);};
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
    shipping:inv.shipping??0,date:inv.date,dueDate:inv.dueDate,
    paid:inv.paid??0,notes:inv.notes||"",status:inv.status||"",
  });
  setSelInv(null);
  setView("edit");
};

const updateInvoice=async()=>{
  if(!editForm.clientPhone&&!editForm.clientName){toast_("يرجى إدخال التلفون أو الاسم","warn");return;}
  const phone=norm(editForm.clientPhone);const name=editForm.clientName||phone||"عميل";
  const updated={...editingInv,clientName:name,clientPhone:phone,
    clientAddress:editForm.clientAddress,
    items:editForm.items.map(it=>({...it,qty:parseInt(toW(String(it.qty)))||1,price:pN(it.price)})),
    shipping:pN(editForm.shipping),date:editForm.date,dueDate:editForm.dueDate,
    paid:pN(editForm.paid),notes:editForm.notes,status:editForm.status||"",updatedAt:new Date().toISOString()};
  const list=invoices.map(inv=>inv.id===updated.id?updated:inv);
  await persist(list);
  api.updateInvoice(updated.id,{...updated,companySlug:company?.sk}).then(()=>refreshInvoices()).catch(()=>{});
  toast_("✅ تم تحديث الفاتورة "+updated.invNum);
  setEditingInv(null);setEditForm(null);setView("list");
};

const toggleSelect=(id)=>setSelectedIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
const deleteSelected=async()=>{
  if(!selectedIds.length)return;
  if(!confirm(`هل تريد حذف ${selectedIds.length} فاتورة؟`))return;
  const list=invoices.filter(inv=>!selectedIds.includes(inv.id));
  await persist(list);
  Promise.all(selectedIds.map(id=>api.deleteInvoice(id))).then(()=>refreshInvoices()).catch(()=>{});
  toast_(`🗑️ تم حذف ${selectedIds.length} فاتورة`,"warn");
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
if(!form.clientPhone&&!form.clientName){toast_("يرجى إدخال التلفون أو الاسم","warn");return;}
const phone=norm(form.clientPhone);
const name=form.clientName||phone||"عميل";
const newInv={id:Date.now(),invNum:nxtN(invoices),clientName:name,clientPhone:phone,
clientAddress:form.clientAddress,items:form.items.map(it=>({...it,qty:parseInt(toW(it.qty))||1,price:pN(it.price)})),
shipping:pN(form.shipping),date:form.date,dueDate:form.dueDate,paid:pN(form.paid),notes:form.notes,createdAt:new Date().toISOString()};
const list=[...invoices,newInv];
await persist(list);
api.createInvoice({...newInv,companySlug:company?.sk},company?.sk).then(()=>refreshInvoices()).catch(()=>{});
autoRegisterClient(newInv);
toast_("✅ تم حفظ الفاتورة "+newInv.invNum);
setForm(emptyForm());setView("list");
};

const confirmDelete=async()=>{
if(!delModal)return;
const list=invoices.filter(i=>i.id!==delModal.id);
await persist(list);
api.deleteInvoice(delModal.id).then(()=>refreshInvoices()).catch(()=>{});
setDelModal(null);
if(selInv?.id===delModal.id)setSelInv(null);
toast_("🗑️ تم الحذف","warn");
};

const saveBulk=async()=>{
const list=[...invoices];
const newBulk=[];
bulkParsed.forEach(b=>{
  const running=[...list,...newBulk];
  newBulk.push({id:Date.now()+Math.random(),invNum:nxtN(running),
  clientName:b.clientName||b.clientPhone||"عميل",clientPhone:norm(b.clientPhone),
  clientAddress:b.clientAddress,items:b.items,shipping:pN(b.shipping||0),
  date:b.date,dueDate:b.dueDate,paid:0,notes:"",createdAt:new Date().toISOString()});
});
await persist([...list,...newBulk]);
api.bulkCreateInvoices(newBulk,company?.sk).then(()=>refreshInvoices()).catch(()=>{});
setBulkStep(2);toast_(`✅ تم حفظ ${bulkParsed.length} فاتورة`);
};

const printRangeList=()=>{
const fn=parseInt(toW(printRange.from).replace(/\D/g,""))||0;
const tn=parseInt(toW(printRange.to).replace(/\D/g,""))||999999;
return invoices.filter(inv=>{const n=parseInt(inv.invNum?.replace(/\D/g,"")||0);return n>=fn&&n<=tn;})
.sort((a,b)=>parseInt(a.invNum?.replace(/\D/g,"")||0)-parseInt(b.invNum?.replace(/\D/g,"")||0));
};
const doPrintRange=()=>{
const list=printRangeList();
if(!list.length){toast_("لا توجد فواتير في هذا النطاق","warn");return;}
doPrint(list, company, printStyle);
};

const SORTS={
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
  toast_("⬇️ تم تنزيل ملف CSV");
};

const TABS=[
{id:"dash",l:"📊 Dashboard"},
{id:"list",l:"📋 الفواتير"},
{id:"customers",l:"👥 العملاء"},
{id:"reports",l:"📈 التقارير"},
{id:"new",l:"➕ جديد"},
{id:"bulk",l:"📦 مجمع"},
{id:"ai",l:"🤖 AI"},
{id:"print",l:"🖨️ طباعة"},
{id:"purchase",l:"🛒 المشتريات"},
];

// dynamic browser-tab title: "القسم | الشركة — نظام إدارة الحسابات"
useEffect(()=>{
  const extra={edit:"تعديل فاتورة",bulk:"الإدخال المجمع"};
  const t=TABS.find(x=>x.id===view);
  const tabLabel=t?t.l.replace(/^\S+\s/,""):(extra[view]||"");
  document.title=company
    ?`${tabLabel?tabLabel+" | ":""}${company.nameAr} — نظام إدارة الحسابات`
    :"نظام إدارة الحسابات — الشركة القابضة المتحدة";
},[company,view]);

if(authLoading)return(
<div style={{minHeight:"100vh",background:"#0f1f3d",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"Cairo,sans-serif",fontSize:"16px",flexDirection:"column",gap:"16px"}}>
<div style={{fontSize:"40px"}}>🛒</div><div>جارٍ التحميل...</div>
</div>
);

if(!user)return <FirebaseLogin/>;
if(!company)return <CompanySelector companies={availableCompanies} onSelect={co=>{setCompany(co);setView("dash");}}/>;

const col = company.color;
const colTx = txAdapt(col, dark);          // readable company color for TEXT on cards
const cardBg = softAdapt(company.cardBg, dark); // soft tinted surface (KPI/summary boxes)

return(
<div dir="rtl" style={{minHeight:"100vh",background:"var(--ia-bg)",fontFamily:"'Cairo','Tajawal',sans-serif",color:"var(--ia-text)",display:"flex",flexDirection:"column"}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap'); *{box-sizing:border-box} .inp{width:100%;border:1.5px solid var(--ia-border2);border-radius:8px;padding:9px 12px;font-family:inherit;font-size:13px;background:var(--ia-inp-bg);color:var(--ia-text);outline:none;transition:border .15s,box-shadow .15s} .inp:focus{border-color:${col};box-shadow:0 0 0 3px ${col}1a} .inp:hover{border-color:var(--ia-muted)} .inp::placeholder{color:var(--ia-muted)} .btn{border:none;border-radius:8px;padding:9px 16px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:5px;white-space:nowrap} .btn:hover{filter:brightness(1.06);box-shadow:0 2px 10px rgba(0,0,0,.12)} .btn:active{opacity:.85;transform:scale(.97)} .btn-ghost{background:var(--ia-ghost-bg);color:var(--ia-ghost-tx)} .btn-outline{background:transparent;border:1.5px solid var(--ia-border2);color:var(--ia-text2)} .btn-outline:hover{border-color:${col};color:${colTx}} .btn-red{background:#dc2626;color:#fff} .card{background:var(--ia-card);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.07);border:1px solid var(--ia-border)} [data-theme="dark"] .card{box-shadow:0 1px 3px rgba(0,0,0,.35)} .trow{transition:background .12s} .trow:hover,.trow:active{background:var(--ia-hover);cursor:pointer} .inv-table tbody tr:last-child td{border-bottom:none} .b-paid{background:var(--ia-ok-bg);color:var(--ia-ok-tx);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700} .b-paid::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ia-ok-tx);margin-left:5px;vertical-align:middle} .b-part{background:var(--ia-warn-bg);color:var(--ia-warn-tx);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700} .b-part::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ia-warn-tx);margin-left:5px;vertical-align:middle} .b-unp{background:var(--ia-red-bg);color:var(--ia-red-tx);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700} .b-unp::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ia-red-tx);margin-left:5px;vertical-align:middle} .b-cancel{background:var(--ia-chip);color:var(--ia-sub);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700;text-decoration:line-through} .b-inv{background:var(--ia-blue-bg);color:var(--ia-blue-tx);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700;letter-spacing:.3px} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}} .navbar{background:${col};position:sticky;top:0;z-index:200;box-shadow:0 2px 12px rgba(0,0,0,.25)} .navbar-top{display:flex;align-items:center;padding:0 12px;height:48px;gap:6px} .navbar-tabs{display:flex;overflow-x:auto;padding:4px 12px 6px;gap:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none} .navbar-tabs::-webkit-scrollbar{display:none} .aliphia-btn{background:#0f766e;} .nav-tab{background:transparent;color:rgba(255,255,255,.7);border:1px solid transparent;border-radius:6px;padding:5px 11px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all .15s} .nav-tab:hover{color:#fff;background:rgba(255,255,255,.08)} .nav-tab.active{background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.25)} .nav-tab:active{background:rgba(255,255,255,.2)} .inv-table{width:100%;border-collapse:collapse} .inv-table th{padding:10px 10px;font-size:11px;font-weight:700;color:var(--ia-sub);text-align:right;text-transform:uppercase;letter-spacing:.3px} .inv-table td{padding:10px 10px;border-bottom:1px solid var(--ia-border3);font-size:13px} .col-addr,.col-date,.col-phone{display:none} @media(min-width:500px){.col-phone{display:table-cell}} @media(min-width:680px){.col-date{display:table-cell}} .form-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px} .form-3col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px} .item-row{display:grid;grid-template-columns:2fr 65px 110px auto;gap:7px;margin-bottom:7px;align-items:center} @media(max-width:500px){.form-2col{grid-template-columns:1fr}.form-3col{grid-template-columns:1fr 1fr}.item-row{grid-template-columns:1fr 55px 90px auto}} .kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px} .kpi-grid>div{transition:transform .18s,box-shadow .18s} .kpi-grid>div:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.08)} @media(min-width:600px){.kpi-grid{grid-template-columns:repeat(4,1fr)}} .chart-grid{display:grid;grid-template-columns:1fr;gap:12px} @media(min-width:680px){.chart-grid{grid-template-columns:1.7fr 1fr}} .print-grid{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end} @media(max-width:480px){.print-grid{grid-template-columns:1fr 1fr;} .print-grid .print-btn{grid-column:1/-1}} .cust-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px} @media(max-width:480px){.cust-stats{grid-template-columns:1fr}} .aliphia-btn{background:linear-gradient(135deg,#0f766e,#0d9488)!important;border:none;box-shadow:0 2px 8px rgba(15,118,110,.3);transition:all .2s!important} .aliphia-btn:hover{box-shadow:0 4px 14px rgba(15,118,110,.45)!important;transform:translateY(-1px)} ::-webkit-scrollbar{width:9px;height:9px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:var(--ia-border2);border-radius:8px;border:2px solid var(--ia-bg)} ::-webkit-scrollbar-thumb:hover{background:var(--ia-muted)} .sk{position:relative;overflow:hidden;background:var(--ia-skel);border-radius:6px} .sk::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);animation:shimmer 1.4s infinite} [data-theme="dark"] .sk::after{background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent)} @keyframes shimmer{100%{transform:translateX(100%)}} .sk-sm{height:11px} .sk-lg{height:22px} .btn:focus-visible,.inp:focus-visible{outline:2.5px solid ${col};outline-offset:2px} .nav-tab:focus-visible{outline:2.5px solid #fff;outline-offset:1px} .wa-btn{background:#16a34a!important;transition:all .18s!important} .wa-btn:hover{background:#15803d!important;box-shadow:0 4px 14px rgba(22,163,74,.4)!important;transform:translateY(-1px)} select.inp{cursor:pointer;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:left 10px center;padding-left:26px} .chart-grid>div{transition:box-shadow .18s} .chart-grid>div:hover{box-shadow:0 4px 16px rgba(0,0,0,.06)} [data-theme="dark"] .chart-grid>div:hover{box-shadow:0 4px 16px rgba(0,0,0,.4)} [data-theme="dark"] .kpi-grid>div:hover{box-shadow:0 6px 18px rgba(0,0,0,.45)} [data-theme="dark"] .btn:hover{filter:brightness(1.15)}`}</style>

  {/* Admin Dashboard Modal */}
  {showAdmin&&<AdminDashboard onClose={()=>setShowAdmin(false)}/>}

  {/* Aliphia Import Modal — Invoices tab */}
  {showAliphia&&(
    <AliphiaImportModal
      company={company}
      existingInvoices={invoices}
      onImport={async newInvs=>{
        setInvoices(p=>[...p,...newInvs]);
        api.bulkCreateInvoices(newInvs,company?.sk).then(()=>refreshInvoices()).catch(()=>{});
        setShowAliphia(false);
        toast_(`✅ تم استيراد ${newInvs.length} فاتورة من Aliphia`);
        setView("list");
      }}
      onClose={()=>setShowAliphia(false)}
    />
  )}

  {/* Navbar */}
  <div className="navbar">
    <div className="navbar-top">
      <button onClick={switchCompany} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"6px",padding:"5px 10px",fontFamily:"inherit",fontSize:"12px",fontWeight:700,cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",gap:"4px",flexShrink:0}}>
        {company.logo} <span style={{maxWidth:"80px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{company.nameAr}</span> <span style={{opacity:.6,fontSize:"10px"}}>▼</span>
      </button>
      <div style={{flex:1}}/>
      {isAdmin&&<button onClick={()=>setShowAdmin(true)} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"6px",color:"rgba(255,255,255,.9)",padding:"5px 10px",fontFamily:"inherit",fontSize:"12px",fontWeight:700,cursor:"pointer",flexShrink:0}}>⚙️ المستخدمين</button>}
      <button onClick={toggle} title={dark?"التبديل إلى الوضع النهاري":"التبديل إلى الوضع الليلي"} aria-label="تبديل السمة" style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"6px",color:"#fff",padding:"5px 10px",fontFamily:"inherit",fontSize:"13px",cursor:"pointer",flexShrink:0,lineHeight:1}}>{dark?"☀️":"🌙"}</button>
      <button onClick={logout} style={{background:"rgba(0,0,0,.2)",border:"1px solid rgba(255,255,255,.2)",borderRadius:"6px",color:"rgba(255,255,255,.8)",padding:"5px 10px",fontFamily:"inherit",fontSize:"12px",fontWeight:700,cursor:"pointer",flexShrink:0}}>خروج</button>
    </div>
    <div className="navbar-tabs">
      {TABS.filter(t=>{if(t.id==="new")return!!perms.create_invoice;if(t.id==="bulk")return!!perms.bulk_input;if(t.id==="customers")return!!perms.view_customers;if(t.id==="print")return!!perms.print_invoice;return true;}).map(t=>(
        <button key={t.id} className={`nav-tab${view===t.id?" active":""}`}
          onClick={()=>{setView(t.id);setSelInv(null);setBulkStep(0);}}>
          {t.l}
        </button>
      ))}
    </div>
  </div>

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

  {/* Delete Modal */}
  {delModal&&(
    <div style={{position:"fixed",inset:0,background:"var(--ia-overlay)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setDelModal(null)}>
      <div className="card" style={{padding:"28px 32px",textAlign:"center",maxWidth:"320px",animation:"fadeUp .2s"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:"38px",marginBottom:"8px"}}>🗑️</div>
        <div style={{fontWeight:700,fontSize:"15px",marginBottom:"6px"}}>تأكيد الحذف</div>
        <div style={{color:"var(--ia-sub)",fontSize:"13px",marginBottom:"18px"}}>سيتم حذف الفاتورة <b>{delModal.invNum}</b> نهائياً</div>
        <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
          <button className="btn btn-red" onClick={confirmDelete}>نعم، احذف</button>
          <button className="btn btn-ghost" onClick={()=>setDelModal(null)}>إلغاء</button>
        </div>
      </div>
    </div>
  )}

  <div style={{maxWidth:"1040px",width:"100%",margin:"0 auto",padding:"18px 14px",flex:1}}>

    {/* DASHBOARD */}
    {view==="dash"&&(
      <div style={{animation:"fadeUp .25s"}}>
        {invLoading&&invoices.length===0?(
          <DashboardSkeleton company={company}/>
        ):(
          <Dashboard invoices={invoices} company={company} onNavigate={go=>{if(go.status)setStatusFilter(go.status);setView(go.view);setSelInv(null);}}/>
        )}
      </div>
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
          onOpenInvoice={inv=>{setSelInv(inv);setView("list");}}
          onImportDone={async newInvs=>{
            setInvoices(p=>[...p,...newInvs]);
            api.bulkCreateInvoices(newInvs,company?.sk).then(()=>refreshInvoices()).catch(()=>{});
            toast_(`✅ تم استيراد البيانات من Aliphia`);
          }}
        />
      </div>
    )}

    {/* LIST */}
    {view==="list"&&!selInv&&(
      <div style={{animation:"fadeUp .25s"}}>
        <div style={{display:"flex",gap:"10px",marginBottom:"10px",alignItems:"center",flexWrap:"wrap"}}>
          <input className="inp" style={{flex:1,padding:"10px 14px",minWidth:"180px"}} placeholder="🔍 ابحث بالتلفون أو الاسم أو رقم الفاتورة..." value={search} onChange={e=>{setSearch(e.target.value);setSelectedIds([]);setPage(1);}}/>
          <button className="btn aliphia-btn" style={{color:"#fff",gap:"6px"}} onClick={()=>setShowAliphia(true)}>
            <span style={{fontSize:"15px"}}>📥</span> استيراد Aliphia
          </button>
          <button className="btn" style={{background:"#0f766e",color:"#fff",gap:"6px"}} onClick={exportInvoicesCSV}>
            <span style={{fontSize:"15px"}}>⬇️</span> تصدير CSV
          </button>
          <span style={{fontSize:"12px",color:"var(--ia-sub)",whiteSpace:"nowrap"}}>{filtered.length} فاتورة</span>
        </div>

        {/* Sort + page size bar */}
        <div style={{display:"flex",gap:"8px",marginBottom:"12px",alignItems:"center",flexWrap:"wrap"}}>
          <select className="inp" style={{width:"auto",padding:"6px 10px",fontSize:"12px",fontWeight:700,color:"var(--ia-text2)"}} value={sortKey} onChange={e=>{setSortKey(e.target.value);setPage(1);}}>
            {Object.entries(SORTS).map(([k,v])=><option key={k} value={k}>↕️ {v.label}</option>)}
          </select>
          <select className="inp" style={{width:"auto",padding:"6px 10px",fontSize:"12px",fontWeight:700,color:"var(--ia-text2)"}} value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>
            {[10,25,50,100].map(n=><option key={n} value={n}>{n} / صفحة</option>)}
          </select>
          <div style={{flex:1}}/>
          {overdueList.length>0&&(
            <span style={{fontSize:"11.5px",fontWeight:800,color:"var(--ia-red-tx)",background:"var(--ia-red-bg)",border:"1px solid var(--ia-red-bd)",borderRadius:"20px",padding:"4px 12px"}}>⏰ {overdueList.length} فاتورة متأخرة عن الاستحقاق</span>
          )}
          {overdueList.length>0&&(
            <button className="btn wa-btn" style={{color:"#fff",padding:"6px 12px",fontSize:"12px",gap:"5px"}} onClick={()=>setShowBulkWa(true)} title="إرسال تذكير واتساب لكل العملاء المتأخرين">
              <span style={{fontSize:"13px"}}>📣</span> تذكير جماعي
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
                {sf==="all"?"📋 الكل":sf==="paid"?"✅ ":sf==="part"?"🟡 ":sf==="unp"?"🔴 ":"⛔ "}{sf!=="all"?stLabel[sf]:""}
                <span style={{background:active?`${c}22`:"var(--ia-chip)",borderRadius:"12px",padding:"1px 7px",fontSize:"10px",fontWeight:900}}>{cnt}</span>
              </button>
            );
          })}
        </div>

        {/* Bulk actions bar */}
        {selectedIds.length>0&&(
          <div style={{display:"flex",gap:"8px",alignItems:"center",background:`${col}0d`,border:`1.5px solid ${col}33`,borderRadius:"9px",padding:"9px 14px",marginBottom:"10px",flexWrap:"wrap"}}>
            <span style={{fontSize:"13px",fontWeight:800,color:colTx}}>{selectedIds.length} محدد</span>
            <div style={{flex:1}}/>
            {!!perms.print_invoice&&<button className="btn" style={{background:col,color:"#fff",padding:"6px 12px",fontSize:"12px"}} onClick={printSelected}>🖨️ طباعة المحددة</button>}
            <button className="btn" style={{background:"#7c3aed",color:"#fff",padding:"6px 12px",fontSize:"12px"}} onClick={()=>{setPurchasePreSelect([...selectedIds]);setSelectedIds([]);setView("purchase");}}>🛒 توليد فاتورة مشتريات</button>
            {!!perms.delete_invoice&&<button className="btn btn-red" style={{padding:"6px 12px",fontSize:"12px"}} onClick={deleteSelected}>🗑️ حذف المحددة</button>}
            <button className="btn btn-ghost" style={{padding:"6px 10px",fontSize:"12px"}} onClick={()=>setSelectedIds([])}>✕ إلغاء التحديد</button>
          </div>
        )}

        {filtered.length===0?(
          <div className="card" style={{padding:"56px",textAlign:"center",color:"var(--ia-muted)"}}>
            <div style={{fontSize:"44px",marginBottom:"10px"}}>📄</div>
            <div style={{fontWeight:600,marginBottom:"14px"}}>لا توجد فواتير</div>
            <button className="btn aliphia-btn" style={{color:"#fff"}} onClick={()=>setShowAliphia(true)}>📥 استورد فواتيرك من Aliphia</button>
          </div>
        ):(
          <div className="card" style={{overflow:"hidden"}}>
            <table className="inv-table">
              <thead><tr style={{background:"var(--ia-soft)",borderBottom:"2px solid var(--ia-border2)"}}>
                <th style={{width:"38px",textAlign:"center",padding:"8px"}}>
                  <input type="checkbox" checked={allSel} onChange={toggleSelectAll}
                    style={{cursor:"pointer",width:"15px",height:"15px",accentColor:col}}/>
                </th>
                <th>رقم</th><th>العميل</th>
                <th className="col-phone">التلفون</th>
                <th className="col-date">التاريخ</th>
                <th>المبلغ</th><th>الحالة</th><th></th>
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
                        {inv.source==="aliphia"&&<span style={{marginRight:"4px",fontSize:"10px",background:"#ccfbf1",color:"#0f766e",borderRadius:"4px",padding:"1px 5px",fontWeight:700}}>A</span>}
                      </td>
                      <td style={{fontWeight:600}}>{inv.clientName}</td>
                      <td className="col-phone" style={{direction:"ltr",textAlign:"right",color:"var(--ia-link)"}}>{inv.clientPhone}</td>
                      <td className="col-date" style={{color:"var(--ia-sub)",fontSize:"12px"}}>
                        {fDate(inv.date)}
                        {overdueDays(inv)>0&&(
                          <span style={{display:"block",marginTop:"2px",fontSize:"10px",fontWeight:800,color:"var(--ia-red-tx)",background:"var(--ia-red-bg)",borderRadius:"4px",padding:"1px 6px",width:"fit-content"}}>
                            ⏰ متأخرة {overdueDays(inv)} يوم
                          </span>
                        )}
                      </td>
                      <td style={{fontWeight:700}}>{fKWD(iT(inv))}</td>
                      <td>
                        <span className={`b-${st}`}>{stLabel[st]}</span>
                      </td>
                      <td onClick={e=>e.stopPropagation()}>
                        <div style={{display:"flex",gap:"4px"}}>
                          {overdueDays(inv)>0&&norm(inv.clientPhone)&&(
                            <a href={waReminderHref(inv,company)} target="_blank" rel="noopener noreferrer" className="btn wa-btn"
                              title="إرسال تذكير بالسداد عبر واتساب (رسالة جاهزة)"
                              style={{color:"#fff",padding:"5px 8px",fontSize:"12px",textDecoration:"none"}}
                              onClick={e=>{e.stopPropagation();logReminderSent(inv,company,waReminderHref(inv,company));}}>
                              📣
                            </a>
                          )}
                          {!!perms.print_invoice&&<button className="btn" title="طباعة الفاتورة" style={{background:col,color:"#fff",padding:"5px 8px",fontSize:"12px"}} onClick={e=>{e.stopPropagation();doPrint([inv],company,printStyle);}}>🖨️</button>}
                          {!!perms.print_invoice&&<button className="btn" title="تصدير PDF" disabled={pdfBusy} style={{background:"#dc2626",color:"#fff",padding:"5px 8px",fontSize:"12px"}} onClick={e=>{e.stopPropagation();doPdfExport([inv],company,{toast:toast_,setBusy:setPdfBusy,styleId:printStyle});}}>📄</button>}
                          {!!perms.edit_invoice&&<button className="btn" title="تعديل الفاتورة" style={{background:"#f59e0b",color:"#fff",padding:"5px 8px",fontSize:"12px"}} onClick={e=>{e.stopPropagation();openEdit(inv);}}>✏️</button>}
                          {!!perms.delete_invoice&&<button className="btn btn-red" title="حذف الفاتورة" style={{padding:"5px 8px",fontSize:"12px"}} onClick={e=>{e.stopPropagation();setDelModal(inv);}}>🗑️</button>}
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
            <button className="btn btn-ghost" style={{padding:"5px 12px",fontSize:"12px",opacity:safePage<=1?.5:1}} disabled={safePage<=1} onClick={()=>goToPage(safePage-1)}>→ السابق</button>
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
            <button className="btn btn-ghost" style={{padding:"5px 12px",fontSize:"12px",opacity:safePage>=totalPages?.5:1}} disabled={safePage>=totalPages} onClick={()=>goToPage(safePage+1)}>التالي ←</button>
            <span style={{fontSize:"11px",color:"var(--ia-muted)",marginRight:"8px"}}>{(safePage-1)*safePS+1}–{Math.min(safePage*safePS,filtered.length)} من {filtered.length}</span>
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
          <button className="btn btn-ghost" onClick={()=>setSelInv(null)}>← رجوع</button>
          {!!perms.print_invoice&&<button className="btn" title="طباعة الفاتورة" style={{background:col,color:"#fff"}} onClick={()=>doPrint([selInv],company,printStyle)}>🖨️ طباعة</button>}
          {!!perms.print_invoice&&<button className="btn" title="تصدير الفاتورة إلى ملف PDF" style={{background:"#dc2626",color:"#fff"}} disabled={pdfBusy} onClick={()=>doPdfExport([selInv],company,{toast:toast_,setBusy:setPdfBusy,styleId:printStyle})}>{pdfBusy?"⏳ جاري…":"📄 PDF"}</button>}
          {!!perms.edit_invoice&&<button className="btn" title="تعديل الفاتورة" style={{background:"#f59e0b",color:"#fff"}} onClick={()=>openEdit(selInv)}>✏️ تعديل</button>}
          {!!perms.delete_invoice&&<button className="btn btn-red" title="حذف الفاتورة" onClick={()=>setDelModal(selInv)}>🗑️ حذف</button>}
          {(()=>{
            const href=waReminderHref(selInv,company);
            return href&&iT(selInv)-pN(selInv.paid||0)>0?(
              <a href={href} target="_blank" rel="noopener noreferrer" className="btn wa-btn"
                title="إرسال تذكير بالسداد عبر واتساب (رسالة جاهزة)"
                style={{color:"#fff",textDecoration:"none"}}
                onClick={()=>logReminderSent(selInv,company,href)}>
                📣 تذكير واتساب
              </a>
            ):null;
          })()}
          {overdueDays(selInv)>0&&(
            <span style={{fontSize:"12px",fontWeight:800,color:"var(--ia-red-tx)",background:"var(--ia-red-bg)",border:"1px solid var(--ia-red-bd)",borderRadius:"20px",padding:"5px 14px"}}>⏰ متأخرة {overdueDays(selInv)} يوم عن الاستحقاق</span>
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
        <div style={{fontSize:"16px",fontWeight:900,color:colTx,marginBottom:"18px"}}>➕ فاتورة جديدة — {company.nameAr}</div>
        <div style={{fontSize:"10px",fontWeight:700,color:"var(--ia-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"9px"}}>بيانات العميل</div>
        {clients.length>0&&(
          <div style={{marginBottom:"10px"}}>
            <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>📇 اختر من دليل العملاء ({clients.length} محفوظ)</label>
            <select className="inp" value="" onChange={e=>{
              const c=clients.find(x=>String(x.id)===e.target.value);
              if(c){setField("clientName",c.name||"");setField("clientPhone",c.phone||"");setField("clientAddress",c.address||"");}
            }}>
              <option value="">— إدخال يدوي (عميل جديد) —</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` (${c.phone})`:""}</option>)}
            </select>
          </div>
        )}
        <div className="form-2col" style={{marginBottom:"10px"}}>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>الاسم (اختياري)</label>
            <input className="inp" placeholder="اسم العميل" value={form.clientName} onChange={e=>setField("clientName",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>رقم التلفون *</label>
            <input className="inp" placeholder="97479196" value={form.clientPhone} onChange={e=>setField("clientPhone",e.target.value)}/></div>
        </div>
        <div style={{marginBottom:"12px"}}>
          <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>العنوان</label>
          <input className="inp" placeholder="المنطقة / العنوان" value={form.clientAddress} onChange={e=>setField("clientAddress",e.target.value)}/>
        </div>
        <div className="form-3col" style={{marginBottom:"14px"}}>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>تاريخ الفاتورة</label>
            <input className="inp" type="date" value={form.date} onChange={e=>setField("date",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>تاريخ الاستحقاق</label>
            <input className="inp" type="date" value={form.dueDate} onChange={e=>setField("dueDate",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>المدفوع (KD)</label>
            <input className="inp" placeholder="0.000" value={form.paid} onChange={e=>setField("paid",e.target.value)}/></div>
        </div>
        <div style={{fontSize:"10px",fontWeight:700,color:"var(--ia-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"9px"}}>المنتجات</div>
        {form.items.map((it,i)=>(
          <div key={i} className="item-row">
            <input className="inp" placeholder="اسم المنتج *" value={it.name} onChange={e=>setItem(i,"name",e.target.value)}/>
            <input className="inp" type="number" min="1" value={it.qty} onChange={e=>setItem(i,"qty",e.target.value)}/>
            <input className="inp" placeholder="السعر KD" value={it.price} onChange={e=>setItem(i,"price",e.target.value)}/>
            {form.items.length>1?<button className="btn btn-red" style={{padding:"8px 10px"}} onClick={()=>setForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}))}>✕</button>:<div/>}
          </div>
        ))}
        <button className="btn btn-outline" style={{marginBottom:"12px",fontSize:"12px"}} onClick={()=>setForm(f=>({...f,items:[...f.items,{name:"",desc:"",qty:1,price:""}]}))}>+ إضافة منتج</button>
        <div className="form-2col" style={{marginBottom:"12px"}}>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>التوصيل (KD) — 0 للمجاني</label>
            <input className="inp" placeholder="0.000" value={form.shipping} onChange={e=>setField("shipping",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>ملاحظات</label>
            <input className="inp" value={form.notes} onChange={e=>setField("notes",e.target.value)}/></div>
        </div>
        {(()=>{const sub=form.items.reduce((s,it)=>s+(parseInt(toW(it.qty))||1)*pN(it.price),0);const ship=pN(form.shipping);const tot=sub+ship;
          return(<div style={{background:cardBg,borderRadius:"9px",padding:"11px 16px",marginBottom:"14px",display:"flex",gap:"16px",fontSize:"13px",border:`1px solid ${col}22`}}>
            <span>المجموع: <b>{fKWD(sub)}</b></span>{ship>0&&<span>التوصيل: <b>{fKWD(ship)}</b></span>}
            <span style={{fontWeight:900,color:colTx}}>الإجمالي: <b>{fKWD(tot)}</b></span>
          </div>);})()}
        <div style={{display:"flex",gap:"8px"}}>
          <button className="btn" style={{background:"#16a34a",color:"#fff",flex:1,fontSize:"14px",padding:"11px"}} onClick={saveInvoice}>💾 حفظ الفاتورة</button>
          <button className="btn btn-ghost" onClick={()=>{setForm(emptyForm());setView("list");}}>إلغاء</button>
        </div>
      </div>
    )}

    {/* EDIT */}
    {view==="edit"&&editForm&&(
      <div className="card" style={{padding:"24px",animation:"fadeUp .25s"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"18px"}}>
          <div style={{fontSize:"16px",fontWeight:900,color:"#f59e0b"}}>✏️ تعديل الفاتورة</div>
          <span className="b-inv">{editingInv?.invNum}</span>
          <div style={{flex:1}}/>
          <button className="btn btn-ghost" style={{fontSize:"12px"}} onClick={()=>{setView("list");setEditingInv(null);setEditForm(null);}}>← إلغاء</button>
        </div>

        <div style={{fontSize:"10px",fontWeight:700,color:"var(--ia-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"9px"}}>بيانات العميل</div>
        {clients.length>0&&(
          <div style={{marginBottom:"10px"}}>
            <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>📇 اختر من دليل العملاء (استبدال البيانات)</label>
            <select className="inp" value="" onChange={e=>{
              const c=clients.find(x=>String(x.id)===e.target.value);
              if(c){setEditField("clientName",c.name||"");setEditField("clientPhone",c.phone||"");setEditField("clientAddress",c.address||"");}
            }}>
              <option value="">— تعديل يدوي —</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` (${c.phone})`:""}</option>)}
            </select>
          </div>
        )}
        <div className="form-2col" style={{marginBottom:"10px"}}>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>الاسم</label>
            <input className="inp" placeholder="اسم العميل" value={editForm.clientName} onChange={e=>setEditField("clientName",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>رقم التلفون *</label>
            <input className="inp" placeholder="97479196" value={editForm.clientPhone} onChange={e=>setEditField("clientPhone",e.target.value)}/></div>
        </div>
        <div style={{marginBottom:"12px"}}>
          <label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>العنوان</label>
          <input className="inp" placeholder="المنطقة / العنوان" value={editForm.clientAddress} onChange={e=>setEditField("clientAddress",e.target.value)}/>
        </div>
        <div className="form-3col" style={{marginBottom:"14px"}}>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>تاريخ الفاتورة</label>
            <input className="inp" type="date" value={editForm.date} onChange={e=>setEditField("date",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>تاريخ الاستحقاق</label>
            <input className="inp" type="date" value={editForm.dueDate} onChange={e=>setEditField("dueDate",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>المدفوع (KD)</label>
            <input className="inp" placeholder="0.000" value={editForm.paid} onChange={e=>setEditField("paid",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>حالة الطلب</label>
            <select className="inp" value={editForm.status||""} onChange={e=>setEditField("status",e.target.value)}>
              <option value="">تلقائي (حسب المدفوع)</option>
              <option value="cancelled">ملغية ✕</option>
            </select>
          </div>
        </div>

        <div style={{fontSize:"10px",fontWeight:700,color:"var(--ia-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"9px"}}>المنتجات</div>
        {editForm.items.map((it,i)=>(
          <div key={i} className="item-row">
            <input className="inp" placeholder="اسم المنتج *" value={it.name} onChange={e=>setEditItem(i,"name",e.target.value)}/>
            <input className="inp" type="number" min="1" value={it.qty} onChange={e=>setEditItem(i,"qty",e.target.value)}/>
            <input className="inp" placeholder="السعر KD" value={it.price} onChange={e=>setEditItem(i,"price",e.target.value)}/>
            {editForm.items.length>1
              ?<button className="btn btn-red" style={{padding:"8px 10px"}} onClick={()=>setEditForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}))}>✕</button>
              :<div/>}
          </div>
        ))}
        <button className="btn btn-outline" style={{marginBottom:"12px",fontSize:"12px"}} onClick={()=>setEditForm(f=>({...f,items:[...f.items,{name:"",desc:"",qty:1,price:""}]}))}>+ إضافة منتج</button>

        <div className="form-2col" style={{marginBottom:"12px"}}>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>التوصيل (KD) — 0 للمجاني</label>
            <input className="inp" placeholder="0.000" value={editForm.shipping} onChange={e=>setEditField("shipping",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>ملاحظات</label>
            <input className="inp" value={editForm.notes} onChange={e=>setEditField("notes",e.target.value)}/></div>
        </div>

        {(()=>{
          const sub=editForm.items.reduce((s,it)=>(parseInt(toW(String(it.qty)))||1)*pN(it.price)+s,0);
          const ship=pN(editForm.shipping);const tot=sub+ship;
          return(
            <div style={{background:cardBg,borderRadius:"9px",padding:"11px 16px",marginBottom:"14px",display:"flex",gap:"16px",fontSize:"13px",border:`1px solid ${col}22`}}>
              <span>المجموع: <b>{fKWD(sub)}</b></span>
              {ship>0&&<span>التوصيل: <b>{fKWD(ship)}</b></span>}
              <span style={{fontWeight:900,color:colTx}}>الإجمالي: <b>{fKWD(tot)}</b></span>
            </div>
          );
        })()}

        <div style={{display:"flex",gap:"8px"}}>
          <button className="btn" style={{background:"#f59e0b",color:"#fff",flex:1,fontSize:"14px",padding:"11px"}} onClick={updateInvoice}>💾 حفظ التعديلات</button>
          <button className="btn btn-ghost" onClick={()=>{setView("list");setEditingInv(null);setEditForm(null);}}>إلغاء</button>
        </div>
      </div>
    )}

    {/* BULK */}
    {view==="bulk"&&(
      <div className="card" style={{padding:"24px",animation:"fadeUp .25s"}}>
        <div style={{fontSize:"16px",fontWeight:900,color:colTx,marginBottom:"5px"}}>📦 إدخال مجمع</div>
        <p style={{fontSize:"12px",color:"var(--ia-sub)",marginBottom:"16px"}}>كل طلب يفصله سطر فارغ — يدعم صيغة الإيموجي</p>
        {bulkStep===0&&(
          <><textarea className="inp" style={{minHeight:"200px",resize:"vertical",marginBottom:"10px",fontSize:"12px",lineHeight:"1.7"}}
            value={bulkText} onChange={e=>setBulkText(e.target.value)}
            placeholder={"📍 الاسم: محمد أبو العينين\n📞 الهاتف: 97479196\n🏠 العنوان: حولي\n🛠️ الطلب: ماتور بوص واحد حصان\n💰 السعر: 11.900\n🚚 التوصيل: مجاني"}/>
          <button className="btn" style={{background:col,color:"#fff"}} onClick={()=>{setBulkParsed(parseBulk(bulkText));setBulkStep(1);}}>
            🔍 معاينة ({bulkText.split(/\n\s*\n/).filter(s=>s.trim().length>5).length} طلب)
          </button></>
        )}
        {bulkStep===1&&(
          <><div style={{color:"#16a34a",fontWeight:700,marginBottom:"10px"}}>✅ {bulkParsed.length} طلب جاهز</div>
          <div style={{maxHeight:"360px",overflow:"auto",marginBottom:"12px"}}>
            {bulkParsed.map((b,i)=>{const tot=b.items.reduce((s,it)=>s+it.qty*pN(it.price),0)+pN(b.shipping||0);
              return(<div key={i} style={{border:"1px solid var(--ia-border)",borderRadius:"8px",padding:"10px 14px",marginBottom:"6px",background:"var(--ia-row-alt)"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <div><b>{b.clientName}</b> <span style={{color:"var(--ia-link)",fontSize:"12px",direction:"ltr"}}>{b.clientPhone}</span>
                    {b.clientAddress&&<span style={{color:"var(--ia-sub)",fontSize:"11px",marginRight:"6px"}}> — {b.clientAddress}</span>}</div>
                  <b style={{color:colTx}}>{fKWD(tot)}</b>
                </div>
                <div style={{fontSize:"12px",color:"var(--ia-sub)",marginTop:"4px"}}>
                  {b.items.map((it,j)=><span key={j}>{it.name} × {it.qty} — {fKWD(it.price)} </span>)}
                  {b.shipping===0&&<span style={{color:"#16a34a"}}>| توصيل مجاني</span>}
                </div>
              </div>);})}
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button className="btn" style={{background:"#16a34a",color:"#fff",flex:1}} onClick={saveBulk}>💾 حفظ الكل ({bulkParsed.length})</button>
            <button className="btn btn-ghost" onClick={()=>setBulkStep(0)}>← تعديل</button>
          </div></>
        )}
        {bulkStep===2&&(
          <div style={{textAlign:"center",padding:"36px"}}>
            <div style={{fontSize:"48px",marginBottom:"8px"}}>✅</div>
            <div style={{fontSize:"16px",fontWeight:700,marginBottom:"14px"}}>تم حفظ {bulkParsed.length} فاتورة!</div>
            <div style={{display:"flex",gap:"8px",justifyContent:"center",flexWrap:"wrap"}}>
              <button className="btn" style={{background:col,color:"#fff"}} onClick={()=>{setBulkStep(0);setBulkText("");setBulkParsed([]);}}>إدخال جديد</button>
              <button className="btn" style={{background:"#7c3aed",color:"#fff"}} onClick={()=>{setBulkStep(0);setView("purchase");}}>🛒 توليد فاتورة مشتريات</button>
              <button className="btn btn-ghost" onClick={()=>{setBulkStep(0);setView("list");}}>عرض الفواتير</button>
            </div>
          </div>
        )}
      </div>
    )}

    {/* PRINT */}
    {view==="print"&&(
      <div style={{animation:"fadeUp .25s"}}>
        <div className="card" style={{padding:"22px",marginBottom:"12px"}}>
          <div style={{fontSize:"16px",fontWeight:900,color:colTx,marginBottom:"14px"}}>🖨️ طباعة من رقم إلى رقم</div>
          <div style={{display:"flex",gap:"10px",marginBottom:"16px",flexWrap:"wrap"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:"var(--ia-muted)",textTransform:"uppercase",letterSpacing:".5px",alignSelf:"center"}}>نمط الفاتورة:</div>
            {Object.values(PRINT_STYLES).map(st=>(
              <button key={st.id} onClick={()=>{setPStyle(st.id);toast_(`تم اختيار نمط ${st.label}`);}}
                title={`نمط ${st.label}${st.id==="modern"?" — بألوان الشركة":st.id==="minimal"?" — أبيض وأسود موفّر للحبر":""}`}
                style={{flex:"1",minWidth:"120px",maxWidth:"180px",border:printStyle===st.id?`2px solid ${col}`:"1.5px solid var(--ia-border2)",borderRadius:"10px",padding:"10px 12px",background:printStyle===st.id?softAdapt(company.cardBg,dark):"var(--ia-inp-bg)",cursor:"pointer",fontFamily:"inherit",transition:"all .15s",display:"flex",alignItems:"center",gap:"8px"}}>
                <span style={{fontSize:"18px"}}>{st.icon}</span>
                <div style={{textAlign:"right",minWidth:0,flex:1}}>
                  <div style={{fontSize:"12.5px",fontWeight:900,color:printStyle===st.id?colTx:"var(--ia-text)"}}>{st.label}</div>
                  <div style={{fontSize:"10px",color:"var(--ia-sub)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{st.id==="classic"?"التصميم الأصلي":st.id==="modern"?"ألوان الشركة":"أبيض وأسود"}</div>
                </div>
                {printStyle===st.id&&<span style={{fontSize:"13px",color:colTx,fontWeight:"900"}}>✓</span>}
              </button>
            ))}
          </div>
          <div className="print-grid">
            <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>من رقم الفاتورة</label>
              <input className="inp" placeholder="INV10001 أو 10001" value={printRange.from} onChange={e=>setPrintRange(r=>({...r,from:e.target.value}))}/></div>
            <div><label style={{fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px"}}>إلى رقم الفاتورة</label>
              <input className="inp" placeholder="INV10010 أو 10010" value={printRange.to} onChange={e=>setPrintRange(r=>({...r,to:e.target.value}))}/></div>
            <button className="btn print-btn" style={{background:col,color:"#fff",height:"40px"}} onClick={doPrintRange}>🖨️ طباعة</button>
            <button className="btn" title="تصدير الفواتير في النطاق إلى ملف PDF واحد" disabled={pdfBusy} style={{background:"#dc2626",color:"#fff",height:"40px"}} onClick={()=>{const list=printRangeList();doPdfExport(list,company,{toast:toast_,setBusy:setPdfBusy,styleId:printStyle});}}>{pdfBusy?"⏳ جاري…":"📄 تصدير PDF"}</button>
          </div>
          <p style={{fontSize:"11px",color:"var(--ia-muted)",marginTop:"8px"}}>⚠️ يجب السماح بالـ Popups في المتصفح لتعمل الطباعة</p>
        </div>
        <div className="card" style={{padding:"20px"}}>
          <div style={{fontSize:"11px",fontWeight:700,color:"var(--ia-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"10px"}}>أو اضغط على فاتورة لطباعتها</div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            {invoices.slice().sort((a,b)=>parseInt(a.invNum?.replace(/\D/g,"")||0)-parseInt(b.invNum?.replace(/\D/g,"")||0)).map(inv=>(
              <div key={inv.id} style={{border:`1px solid ${col}33`,borderRadius:"8px",padding:"10px 14px",background:cardBg,fontSize:"12px",cursor:"pointer",transition:"all .15s"}}
                onClick={()=>doPrint([inv],company,printStyle)}>
                <div style={{fontWeight:700,color:colTx}}>{inv.invNum}</div>
                <div style={{color:"var(--ia-sub)",marginTop:"2px",fontSize:"11px"}}>{inv.clientName}</div>
                <div style={{fontWeight:700,marginTop:"2px"}}>{fKWD(iT(inv))}</div>
                <div style={{color:colTx,marginTop:"4px",fontSize:"10px"}}>🖨️ اضغط للطباعة</div>
              </div>
            ))}
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

    {/* Footer */}
    <div style={{textAlign:"center",padding:"18px 14px 22px",marginTop:"auto",borderTop:"1px solid #e5e7eb",fontSize:"12px",color:"var(--ia-muted)",paddingBottom:"calc(22px + env(safe-area-inset-bottom))"}}>
      تم البرمجة والتطوير بواسطة{" "}
      <a href="https://wa.me/201033514479" target="_blank" rel="noopener noreferrer"
        style={{color:col,textDecoration:"none",fontWeight:700}}>
        أحمد الصياد
      </a>
    </div>

  </div>
</div>

);
}