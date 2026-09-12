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
position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:2000,
display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",
fontFamily:"'Cairo','Tajawal',sans-serif",direction:"rtl"
}} onClick={onClose}>
<div style={{
background:"#fff",borderRadius:"18px",width:"100%",maxWidth:"620px",
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
    <div style={{display:"flex",borderBottom:"1px solid #e5e7eb",background:"#fafafa",padding:"0 22px",flexShrink:0}}>
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
          <div style={{background:"#f0f9ff",border:"1.5px solid #bae6fd",borderRadius:"10px",padding:"14px 16px",marginBottom:"18px"}}>
            <div style={{fontWeight:700,color:"#0369a1",marginBottom:"6px",fontSize:"13px"}}>📋 كيف تصدّر من Aliphia؟</div>
            <ol style={{fontSize:"12px",color:"#0c4a6e",paddingRight:"18px",lineHeight:"1.9",margin:0}}>
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
            <div style={{fontWeight:700,fontSize:"15px",color:"#111",marginBottom:"5px"}}>اسحب ملف CSV هنا</div>
            <div style={{color:"#6b7280",fontSize:"12px",marginBottom:"14px"}}>أو اضغط للاختيار من جهازك</div>
            <div style={{display:"inline-block",background:col,color:"#fff",padding:"9px 22px",borderRadius:"8px",fontWeight:700,fontSize:"13px"}}>اختر ملف CSV</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>

          {errors.length>0&&(
            <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:"8px",padding:"10px 14px",color:"#b91c1c",fontSize:"12px"}}>
              ❌ {errors.join(" | ")}
            </div>
          )}

          <div style={{background:"#f8f9fa",borderRadius:"8px",padding:"12px 16px",marginTop:"14px",fontSize:"11px",color:"#6b7280",lineHeight:"1.8"}}>
            <b>الأعمدة المدعومة:</b> رقم الفاتورة، التاريخ، اسم العميل، الهاتف، العنوان، اسم المنتج، الكمية، السعر، التوصيل، المدفوع، الملاحظات
          </div>
        </div>
      )}

      {/* STEP 1 — Preview */}
      {step===1&&(
        <div>
          <div style={{display:"flex",gap:"10px",marginBottom:"14px",flexWrap:"wrap",alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:"14px",color:"#111"}}>
                تم تحليل <span style={{color:col}}>{parsed.length}</span> فاتورة
                {dupCount>0&&<span style={{color:"#b45309",marginRight:"6px",fontSize:"12px"}}>({dupCount} مكررة)</span>}
              </div>
              <div style={{fontSize:"12px",color:"#6b7280",marginTop:"3px"}}>الأعمدة المكتشفة: {detectedCols.slice(0,6).join("، ")}{detectedCols.length>6?"...":""}</div>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer",fontSize:"12px",fontWeight:700,color:"#374151",background:"#f3f4f6",padding:"7px 12px",borderRadius:"8px",border:"1px solid #e5e7eb"}}>
              <input type="checkbox" checked={skipDup} onChange={e=>setSkipDup(e.target.checked)} style={{accentColor:col}}/>
              تخطى المكررة
            </label>
          </div>

          {errors.length>0&&(
            <div style={{background:"#fef3c7",border:"1px solid #fde68a",borderRadius:"8px",padding:"10px 14px",color:"#92400e",fontSize:"12px",marginBottom:"12px"}}>
              ⚠️ {errors.join(" | ")}
            </div>
          )}

          {/* Preview table */}
          <div style={{border:"1px solid #e5e7eb",borderRadius:"10px",overflow:"hidden",marginBottom:"14px",maxHeight:"320px",overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead>
                <tr style={{background:"#f8fafc",borderBottom:"2px solid #e5e7eb",position:"sticky",top:0}}>
                  {["#","العميل","الهاتف","المنتجات","المبلغ","التاريخ","حالة"].map(h=>(
                    <th key={h} style={{padding:"9px 10px",fontWeight:700,color:"#6b7280",textAlign:"right",fontSize:"11px"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.map((inv,i) => {
                  const tot = inv.items.reduce((s,it)=>s+it.qty*it.price,0)+inv.shipping;
                  const isDup = existingNums.has(inv.invNum);
                  return (
                    <tr key={i} style={{borderBottom:"1px solid #f3f4f6",background:isDup?"#fffbeb":i%2===0?"#fff":"#fafafa",opacity:isDup&&skipDup?.7:1}}>
                      <td style={{padding:"8px 10px",fontWeight:700,color:col}}>{inv.invNum}</td>
                      <td style={{padding:"8px 10px",fontWeight:600}}>{inv.clientName}</td>
                      <td style={{padding:"8px 10px",direction:"ltr",textAlign:"right",color:"#2563eb"}}>{inv.clientPhone||"—"}</td>
                      <td style={{padding:"8px 10px",color:"#555",maxWidth:"140px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inv.items.map(it=>it.name).join("، ")}</td>
                      <td style={{padding:"8px 10px",fontWeight:700}}>{fKWD(tot)}</td>
                      <td style={{padding:"8px 10px",color:"#6b7280"}}>{fDate(inv.date)}</td>
                      <td style={{padding:"8px 10px"}}>
                        {isDup
                          ? <span style={{background:"#fef3c7",color:"#b45309",borderRadius:"20px",padding:"2px 8px",fontSize:"10px",fontWeight:700}}>مكرر</span>
                          : <span style={{background:"#dcfce7",color:"#15803d",borderRadius:"20px",padding:"2px 8px",fontSize:"10px",fontWeight:700}}>جديد</span>
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
              style={{flex:1,background:toImport.length===0?"#e5e7eb":col,color:toImport.length===0?"#9ca3af":"#fff",border:"none",borderRadius:"9px",padding:"12px",fontFamily:"inherit",fontSize:"14px",fontWeight:700,cursor:toImport.length===0?"not-allowed":"pointer",transition:"all .2s"}}
              onClick={doImport}
              disabled={importing||toImport.length===0}
            >
              {importing?"⏳ جارٍ الاستيراد...":`💾 استيراد ${toImport.length} فاتورة`}
            </button>
            <button style={{background:"#e5e7eb",color:"#374151",border:"none",borderRadius:"9px",padding:"12px 18px",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}} onClick={()=>setStep(0)}>← رجوع</button>
          </div>
        </div>
      )}

      {/* STEP 2 — Done */}
      {step===2&&(
        <div style={{textAlign:"center",padding:"32px 20px"}}>
          <div style={{fontSize:"64px",marginBottom:"12px"}}>✅</div>
          <div style={{fontSize:"20px",fontWeight:900,color:"#111",marginBottom:"8px"}}>تم الاستيراد بنجاح!</div>
          <div style={{fontSize:"14px",color:"#6b7280",marginBottom:"24px"}}>
            تم إضافة <span style={{fontWeight:900,color:col,fontSize:"18px"}}>{importedCount}</span> فاتورة من Aliphia
            {dupCount>0&&skipDup&&<div style={{marginTop:"4px",color:"#b45309",fontSize:"12px"}}>تم تخطى {dupCount} فاتورة مكررة</div>}
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
function buildHTML(invList, company){
const c = company;
const logoImg=getLogoImg(c.id);
const logoBlock=logoImg
  ?`<img src="${logoImg}" style="width:80px;height:80px;object-fit:contain;border-radius:6px;border:1.5px solid #e5e7eb;background:#fff;flex-shrink:0;"/>`
  :`<div style="width:80px;height:80px;background:#111827;color:#fff;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:22px;text-align:center;flex-shrink:0;line-height:1.2;font-weight:900;">${c.logo}<span style="font-size:8px;font-weight:700;opacity:.75;margin-top:2px;letter-spacing:1.5px;">${c.id.toUpperCase()}</span></div>`;

const pages = invList.map(inv => {
const sub=inv.items.reduce((s,it)=>s+pN(it.qty)*pN(it.price),0);
const ship=pN(inv.shipping||0);const tot=sub+ship;const paid=pN(inv.paid||0);
const due=tot-paid;
const isCancelled=inv.status==='cancelled';
const stC=isCancelled?"#6b7280":due<=0?"#16a34a":paid>0?"#b45309":"#dc2626";
const stT=isCancelled?"ملغية":due<=0?"مدفوعة":paid>0?"مدفوعة جزئياً":"غير مدفوعة";
const empty=Math.max(0,5-inv.items.length);
const itemRows=inv.items.map((it,i)=>`
<tr style="background:${i%2===1?"#f9fafb":"#fff"};border-bottom:1px solid #e5e7eb;">
  <td style="padding:9px 8px;text-align:center;color:#9ca3af;font-size:11px;border-left:1px solid #e5e7eb;">${i+1}</td>
  <td style="padding:9px 12px;font-weight:600;color:#111;">${it.name||""}</td>
  <td style="padding:9px 12px;color:#6b7280;font-size:11.5px;">${it.desc||""}</td>
  <td style="padding:9px 10px;text-align:center;font-weight:600;border-right:1px solid #e5e7eb;border-left:1px solid #e5e7eb;">${it.qty}</td>
  <td style="padding:9px 12px;text-align:left;direction:ltr;border-left:1px solid #e5e7eb;">${fKWD(it.price)}</td>
  <td style="padding:9px 12px;text-align:left;font-weight:700;direction:ltr;">${fKWD(pN(it.qty)*pN(it.price))}</td>
</tr>`).join("");
const emptyRows=Array.from({length:empty}).map(()=>`<tr style="border-bottom:1px solid #f0f0f0;"><td colspan="6" style="height:32px;"></td></tr>`).join("");
return `<div class="page">
${isCancelled?`<div class="watermark">ملغية</div>`:""}
<div style="position:relative;z-index:1;">

<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px double #111827;margin-bottom:16px;">
  <div style="display:flex;align-items:flex-start;gap:14px;">
    ${logoBlock}
    <div>
      <div style="font-size:18px;font-weight:900;color:#111827;margin-bottom:4px;letter-spacing:-.3px;">${c.name}</div>
      <div style="font-size:10px;color:#6b7280;line-height:2.1;">${c.nameAr}<br/>${c.address} — ${c.city}<br/><span style="direction:ltr;display:inline-block;">${c.phone}</span> &nbsp;|&nbsp; ${c.email}</div>
    </div>
  </div>
  <div style="text-align:left;">
    <div style="font-size:32px;font-weight:900;color:#111827;letter-spacing:-2px;line-height:1;margin-bottom:4px;">فـاتـورة</div>
    <div style="font-size:11px;color:#6b7280;font-weight:600;direction:ltr;margin-bottom:8px;"># ${inv.invNum}</div>
    <div style="display:inline-block;border:2px solid ${stC};color:${stC};border-radius:4px;padding:3px 14px;font-size:11px;font-weight:800;letter-spacing:.5px;">${stT}</div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1.9fr 1fr 1fr;border:1.5px solid #d1d5db;border-radius:8px;overflow:hidden;margin-bottom:16px;">
  <div style="padding:12px 16px;border-left:1.5px solid #d1d5db;">
    <div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">صادرة إلى</div>
    <div style="font-size:15px;font-weight:800;color:#111;margin-bottom:3px;">${inv.clientName||"—"}</div>
    <div style="font-size:12.5px;font-weight:700;direction:ltr;text-align:right;color:#374151;margin-bottom:2px;">${inv.clientPhone||""}</div>
    ${inv.clientAddress?`<div style="font-size:11px;color:#6b7280;margin-top:2px;">${inv.clientAddress}</div>`:""}
  </div>
  <div style="padding:12px 14px;border-left:1.5px solid #d1d5db;">
    <div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">تاريخ الإصدار</div>
    <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:10px;">${fDate(inv.date)}</div>
    <div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">تاريخ الاستحقاق</div>
    <div style="font-size:13px;font-weight:700;color:#111;">${fDate(inv.dueDate)}</div>
  </div>
  <div style="padding:12px 14px;background:#f9fafb;">
    <div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">المبلغ المستحق</div>
    <div style="font-size:21px;font-weight:900;color:${stC};direction:ltr;text-align:right;line-height:1.1;margin-bottom:10px;">${isCancelled?"—":fKWD(due)}</div>
    <div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">المسؤول</div>
    <div style="font-size:12px;font-weight:700;color:#374151;">${c.manager}</div>
  </div>
</div>

<table style="width:100%;border-collapse:collapse;border:1.5px solid #d1d5db;border-radius:8px;overflow:hidden;margin-bottom:14px;">
  <thead>
    <tr style="background:#111827;color:#fff;">
      <th style="padding:10px 8px;width:30px;text-align:center;font-size:10.5px;font-weight:700;border-left:1px solid rgba(255,255,255,.12);">#</th>
      <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;">المنتج / الخدمة</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;">الوصف</th>
      <th style="padding:10px 10px;text-align:center;font-size:11px;font-weight:700;width:52px;border-left:1px solid rgba(255,255,255,.12);border-right:1px solid rgba(255,255,255,.12);">الكمية</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;width:94px;border-left:1px solid rgba(255,255,255,.12);">سعر الوحدة</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;width:94px;">الإجمالي</th>
    </tr>
  </thead>
  <tbody>${itemRows}${emptyRows}</tbody>
</table>

<div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
  <table style="min-width:260px;border-collapse:collapse;border:1.5px solid #d1d5db;border-radius:6px;overflow:hidden;">
    <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:7px 16px;color:#6b7280;font-size:12.5px;">المجموع الجزئي</td><td style="padding:7px 16px;text-align:left;font-size:12.5px;font-weight:600;direction:ltr;">${fKWD(sub)}</td></tr>
    ${ship>0?`<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:7px 16px;color:#6b7280;font-size:12.5px;">التوصيل</td><td style="padding:7px 16px;text-align:left;font-size:12.5px;font-weight:600;direction:ltr;">${fKWD(ship)}</td></tr>`:""}
    <tr style="background:#111827;color:#fff;"><td style="padding:10px 16px;font-size:13.5px;font-weight:800;">إجمالي الفاتورة</td><td style="padding:10px 16px;text-align:left;font-size:13.5px;font-weight:900;direction:ltr;">${fKWD(tot)}</td></tr>
    <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:7px 16px;font-size:12.5px;color:#374151;">المدفوع</td><td style="padding:7px 16px;text-align:left;font-size:12.5px;font-weight:700;direction:ltr;">${fKWD(paid)}</td></tr>
    <tr style="border-top:2px solid #111827;"><td style="padding:10px 16px;font-size:13.5px;font-weight:800;color:${stC};">${isCancelled?"الحالة":"المبلغ المستحق"}</td><td style="padding:10px 16px;text-align:left;font-size:14px;font-weight:900;color:${stC};direction:ltr;">${isCancelled?stT:fKWD(due)}</td></tr>
  </table>
</div>

${inv.notes?`<div style="border:1.5px solid #d1d5db;border-radius:6px;padding:10px 14px;margin-bottom:12px;background:#f9fafb;"><div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">ملاحظات</div><div style="font-size:12px;color:#374151;line-height:1.75;">${inv.notes}</div></div>`:""}

<div style="padding-top:10px;border-top:1.5px solid #d1d5db;display:flex;justify-content:space-between;align-items:center;">
  <div style="font-size:9.5px;color:#9ca3af;font-weight:600;">الشركة القابضة المتحدة ذ.م.م &nbsp;—&nbsp; United Holding Group LLC</div>
  <div style="font-size:10.5px;font-weight:800;color:#374151;">${c.nameAr} &nbsp;|&nbsp; ${c.phone}</div>
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

function doPrint(list, company){
if(!list.length)return;
const w=window.open("","_blank","width=900,height=700");
if(!w){alert("يرجى السماح بالـ Popups");return;}
w.document.open();w.document.write(buildHTML(list, company));w.document.close();
setTimeout(()=>{try{w.focus();w.print();}catch(e){}},900);
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
const cols = companies && companies.length > 0 ? companies : Object.values(COMPANIES);
const gridCols = cols.length === 1 ? "repeat(1,1fr)" : cols.length === 2 ? "repeat(2,1fr)" : "repeat(2,1fr)";
return (
<div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cairo','Tajawal',sans-serif",direction:"rtl",padding:"20px",position:"relative",overflow:"hidden"}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap'); *{box-sizing:border-box} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}} @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}} .co-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px 20px;cursor:pointer;transition:all .3s cubic-bezier(.4,0,.2,1);text-align:center;animation:fadeUp .5s ease both;position:relative;overflow:hidden;} .co-card::before{content:"";position:absolute;inset:0;opacity:0;transition:opacity .3s;background:radial-gradient(circle at 50% 0%,var(--co-color) 0%,transparent 70%);} .co-card:hover,.co-card:active{transform:translateY(-4px) scale(1.02);border-color:var(--co-color);box-shadow:0 20px 60px rgba(0,0,0,.5),0 0 0 1px var(--co-color)} .co-card:hover::before,.co-card:active::before{opacity:.15} .co-icon{font-size:40px;margin-bottom:12px;display:block;animation:float 3s ease-in-out infinite} .co-grid{display:grid;gap:14px} @media(min-width:600px){.co-grid{grid-template-columns:repeat(4,1fr)}}`}</style>
<div style={{position:"fixed",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none"}}/>
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

// ─── Dashboard ────────────────────────────────────────────────────
function Dashboard({invoices, company}){
const now=new Date();
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
const col = company.color;
const months6=Array.from({length:6}).map((_,i)=>{
const d=new Date(now);d.setMonth(d.getMonth()-5+i);
const key=mk(d);const label=d.toLocaleDateString("ar",{month:"short"});
const rev=invoices.filter(x=>x.date?.startsWith(key)).reduce((s,x)=>s+iT(x),0);
const cnt=invoices.filter(x=>x.date?.startsWith(key)).length;
return{label,rev,cnt};
});
const kpis=[
{icon:"💰",label:"إجمالي الإيرادات",val:fKWD(totR),sub:`${invoices.length} فاتورة`,c:col,bg:company.cardBg},
{icon:"📅",label:"إيرادات هذا الشهر",val:fKWD(tR),sub:`${tInvs.length} فاتورة`,c:"#16a34a",bg:"#dcfce7",badge:`${gUp?"▲":"▼"} ${Math.abs(gPct).toFixed(1)}%`,badgeC:gUp?"#16a34a":"#dc2626"},
{icon:"⏳",label:"مستحقات غير مدفوعة",val:fKWD(unpaidA),sub:`${unpaid.length} فاتورة`,c:"#b45309",bg:"#fef3c7"},
{icon:"👥",label:"إجمالي العملاء",val:uniqueC+" عميل",sub:`متوسط ${fKWD(avg)}`,c:"#7c3aed",bg:"#ede9fe"},
];
return(
<div>
<div className="kpi-grid">
{kpis.map(k=>(
<div key={k.label} style={{background:k.bg,borderRadius:"14px",padding:"14px 16px",border:`1.5px solid ${k.c}22`}}>
<div style={{fontSize:"22px",marginBottom:"6px"}}>{k.icon}</div>
<div style={{fontSize:"10px",color:"#6b7280",fontWeight:700,textTransform:"uppercase",letterSpacing:".4px",marginBottom:"3px"}}>{k.label}</div>
<div style={{fontSize:"17px",fontWeight:900,color:k.c,direction:"ltr",textAlign:"right"}}>{k.val}</div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"5px"}}>
<span style={{fontSize:"11px",color:"#6b7280"}}>{k.sub}</span>
{k.badge&&<span style={{fontSize:"11px",fontWeight:700,color:k.badgeC,background:k.badgeC+"1a",padding:"1px 8px",borderRadius:"20px"}}>{k.badge}</span>}
</div>
</div>
))}
</div>
<div className="chart-grid">
<div style={{background:"#fff",borderRadius:"14px",padding:"18px 20px",border:"1.5px solid #e5e7eb"}}>
<div style={{fontSize:"13px",fontWeight:700,color:col,marginBottom:"14px"}}>📈 الإيرادات الشهرية</div>
<ResponsiveContainer width="100%" height={170}>
<BarChart data={months6} margin={{top:0,right:4,bottom:0,left:0}}>
<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
<XAxis dataKey="label" tick={{fontSize:11,fill:"#6b7280",fontFamily:"Cairo"}} axisLine={false} tickLine={false}/>
<YAxis tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false}/>
<Tooltip formatter={v=>[fKWD(v),"الإيرادات"]} contentStyle={{fontFamily:"Cairo",fontSize:12,borderRadius:8,direction:"rtl"}}/>
<Bar dataKey="rev" fill={col} radius={[5,5,0,0]}/>
</BarChart>
</ResponsiveContainer>
</div>
<div style={{background:"#fff",borderRadius:"14px",padding:"18px 20px",border:"1.5px solid #e5e7eb",display:"flex",flexDirection:"column"}}>
<div style={{fontSize:"13px",fontWeight:700,color:col,marginBottom:"14px"}}>🧾 عدد الفواتير شهرياً</div>
<ResponsiveContainer width="100%" height={130}>
<LineChart data={months6} margin={{top:4,right:8,bottom:0,left:0}}>
<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
<XAxis dataKey="label" tick={{fontSize:11,fill:"#6b7280",fontFamily:"Cairo"}} axisLine={false} tickLine={false}/>
<YAxis tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false} allowDecimals={false}/>
<Tooltip formatter={v=>[v+" فاتورة","عدد"]} contentStyle={{fontFamily:"Cairo",fontSize:12,borderRadius:8}}/>
<Line type="monotone" dataKey="cnt" stroke="#16a34a" strokeWidth={3} dot={{r:4,fill:"#16a34a"}} activeDot={{r:6}}/>
</LineChart>
</ResponsiveContainer>
<div style={{marginTop:"auto",paddingTop:"10px"}}>
<div style={{textAlign:"center",background:gUp?"#dcfce7":"#fee2e2",borderRadius:"8px",padding:"7px"}}>
<span style={{fontWeight:900,fontSize:"13px",color:gUp?"#16a34a":"#dc2626"}}>{gUp?"▲":"▼"} نمو {Math.abs(gPct).toFixed(1)}% عن الشهر الماضي</span>
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

// ─── Customers ────────────────────────────────────────────────────
function Customers({invoices, company, onImportDone}){
const { perms } = useAuth();
const [search,setSearch]=useState("");
const [sort,setSort]=useState("spent");
const [showImport,setShowImport]=useState(false);
const col = company.color;

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
{l:"إجمالي العملاء",v:customers.length+" عميل",c:col,bg:company.cardBg},
{l:"إجمالي الإنفاق",v:fKWD(customers.reduce((s,c)=>s+c.totalSpent,0)),c:"#16a34a",bg:"#dcfce7"},
{l:"متوسط الإنفاق / عميل",v:fKWD(customers.length?customers.reduce((s,c)=>s+c.totalSpent,0)/customers.length:0),c:"#7c3aed",bg:"#ede9fe"},
].map(s=>(
<div key={s.l} style={{background:s.bg,borderRadius:"10px",padding:"12px 16px",border:`1px solid ${s.c}22`}}>
<div style={{fontSize:"10px",color:"#6b7280",fontWeight:700,textTransform:"uppercase",marginBottom:"4px"}}>{s.l}</div>
<div style={{fontSize:"16px",fontWeight:900,color:s.c}}>{s.v}</div>
</div>
))}
</div>
{customers.length===0?(
<div className="card" style={{padding:"48px",textAlign:"center",color:"#9ca3af"}}><div style={{fontSize:"40px",marginBottom:"10px"}}>👥</div><div style={{fontWeight:600}}>لا توجد عملاء</div></div>
):(
<div className="card" style={{overflow:"hidden"}}>
<table style={{width:"100%",borderCollapse:"collapse"}}>
<thead><tr style={{background:"#f8fafc",borderBottom:"2px solid #e5e7eb"}}>
{["العميل","التلفون","إجمالي الإنفاق","عدد الفواتير","آخر شراء","المنتجات","للميتا"].map(h=>(
<th key={h} style={{padding:"10px 12px",fontSize:"11px",fontWeight:700,color:"#6b7280",textAlign:"right",textTransform:"uppercase",letterSpacing:".3px"}}>{h}</th>
))}
</tr></thead>
<tbody>
{customers.map((c,i)=>(
<tr key={c.phone} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
<td style={{padding:"11px 12px",fontWeight:600,fontSize:"13px"}}>{c.name}</td>
<td style={{padding:"11px 12px",direction:"ltr",textAlign:"right",color:"#2563eb",fontSize:"13px"}}>{c.phone}</td>
<td style={{padding:"11px 12px",fontWeight:700,color:col}}>{fKWD(c.totalSpent)}</td>
<td style={{padding:"11px 12px",textAlign:"center"}}><span style={{background:"#dbeafe",color:"#1d4ed8",borderRadius:"20px",padding:"2px 8px",fontSize:"11px",fontWeight:700}}>{c.count}</span></td>
<td style={{padding:"11px 12px",color:"#6b7280",fontSize:"12px"}}>{fDate(c.lastDate)}</td>
<td style={{padding:"11px 12px",fontSize:"11px",color:"#555",maxWidth:"160px"}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.products.join("، ")}</div></td>
<td style={{padding:"11px 12px"}}><span style={{background:"#e0f2fe",color:"#0369a1",borderRadius:"6px",padding:"2px 8px",fontSize:"11px",fontWeight:700,direction:"ltr",display:"inline-block"}}>+965{c.phone.replace(/^\+?965/,"")}</span></td>
</tr>
))}
</tbody>
</table>
</div>
)}
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
const [delModal,setDelModal]=useState(null);
const [showAliphia,setShowAliphia]=useState(false);
const [showAdmin,setShowAdmin]=useState(false);
const [editingInv,setEditingInv]=useState(null);
const [editForm,setEditForm]=useState(null);
const [selectedIds,setSelectedIds]=useState([]);
const [purchasePreSelect,setPurchasePreSelect]=useState([]);

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
  }
}, [company]);

useEffect(()=>{
if(!company)return;
// refreshInvoices is async — every setState inside it runs after an await,
// so this is the standard data-fetching effect, not a synchronous cascade.
// eslint-disable-next-line react-hooks/set-state-in-effect
refreshInvoices();
},[company, refreshInvoices]);

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
  if(list.length)doPrint(list,company);
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

const doPrintRange=()=>{
const fn=parseInt(toW(printRange.from).replace(/\D/g,""))||0;
const tn=parseInt(toW(printRange.to).replace(/\D/g,""))||999999;
const list=invoices.filter(inv=>{const n=parseInt(inv.invNum?.replace(/\D/g,"")||0);return n>=fn&&n<=tn;})
.sort((a,b)=>parseInt(a.invNum?.replace(/\D/g,"")||0)-parseInt(b.invNum?.replace(/\D/g,"")||0));
if(!list.length){toast_("لا توجد فواتير في هذا النطاق","warn");return;}
doPrint(list, company);
};

const filtered=invoices.filter(inv=>{
if(!search)return true;
const s=toW(search).toLowerCase();
return inv.clientPhone?.includes(s)||inv.clientName?.toLowerCase().includes(s)||inv.invNum?.toLowerCase().includes(s);
}).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
const allSel=filtered.length>0&&filtered.every(inv=>selectedIds.includes(inv.id));
const toggleSelectAll=()=>setSelectedIds(allSel?[]:filtered.map(inv=>inv.id));

const TABS=[
{id:"dash",l:"📊 Dashboard"},
{id:"list",l:"📋 الفواتير"},
{id:"customers",l:"👥 العملاء"},
{id:"new",l:"➕ جديد"},
{id:"bulk",l:"📦 مجمع"},
{id:"ai",l:"🤖 AI"},
{id:"print",l:"🖨️ طباعة"},
{id:"purchase",l:"🛒 المشتريات"},
];

if(authLoading)return(
<div style={{minHeight:"100vh",background:"#0f1f3d",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"Cairo,sans-serif",fontSize:"16px",flexDirection:"column",gap:"16px"}}>
<div style={{fontSize:"40px"}}>🛒</div><div>جارٍ التحميل...</div>
</div>
);

if(!user)return <FirebaseLogin/>;
if(!company)return <CompanySelector companies={availableCompanies} onSelect={co=>{setCompany(co);setView("dash");}}/>;

const col = company.color;

return(
<div dir="rtl" style={{minHeight:"100vh",background:"#f3f4f6",fontFamily:"'Cairo','Tajawal',sans-serif",color:"#111",display:"flex",flexDirection:"column"}}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap'); *{box-sizing:border-box} .inp{width:100%;border:1.5px solid #d1d5db;border-radius:8px;padding:9px 12px;font-family:inherit;font-size:13px;background:#fff;outline:none;transition:border .15s} .inp:focus{border-color:${col}} .btn{border:none;border-radius:8px;padding:9px 16px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:5px;white-space:nowrap} .btn:active{opacity:.85} .btn-ghost{background:#e5e7eb;color:#374151} .btn-outline{background:transparent;border:1.5px solid #d1d5db;color:#374151} .btn-outline:hover{border-color:${col};color:${col}} .btn-red{background:#dc2626;color:#fff} .card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.07);border:1px solid #e5e7eb} .trow:hover,.trow:active{background:#f0f4ff;cursor:pointer} .b-paid{background:#dcfce7;color:#15803d;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700} .b-part{background:#fef3c7;color:#b45309;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700} .b-unp{background:#fee2e2;color:#b91c1c;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700} .b-cancel{background:#f3f4f6;color:#6b7280;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700;text-decoration:line-through} .b-inv{background:#dbeafe;color:#1d4ed8;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}} .navbar{background:${col};position:sticky;top:0;z-index:200;box-shadow:0 2px 12px rgba(0,0,0,.25)} .navbar-top{display:flex;align-items:center;padding:0 12px;height:48px;gap:6px} .navbar-tabs{display:flex;overflow-x:auto;padding:4px 12px 6px;gap:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none} .navbar-tabs::-webkit-scrollbar{display:none} .aliphia-btn{background:#0f766e;} .nav-tab{background:transparent;color:rgba(255,255,255,.7);border:1px solid transparent;border-radius:6px;padding:5px 11px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all .15s} .nav-tab.active{background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.25)} .nav-tab:active{background:rgba(255,255,255,.2)} .inv-table{width:100%;border-collapse:collapse} .inv-table th{padding:10px 10px;font-size:11px;font-weight:700;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:.3px} .inv-table td{padding:10px 10px;border-bottom:1px solid #f3f4f6;font-size:13px} .col-addr,.col-date,.col-phone{display:none} @media(min-width:500px){.col-phone{display:table-cell}} @media(min-width:680px){.col-date{display:table-cell}} .form-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px} .form-3col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px} .item-row{display:grid;grid-template-columns:2fr 65px 110px auto;gap:7px;margin-bottom:7px;align-items:center} @media(max-width:500px){.form-2col{grid-template-columns:1fr}.form-3col{grid-template-columns:1fr 1fr}.item-row{grid-template-columns:1fr 55px 90px auto}} .kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px} @media(min-width:600px){.kpi-grid{grid-template-columns:repeat(4,1fr)}} .chart-grid{display:grid;grid-template-columns:1fr;gap:12px} @media(min-width:680px){.chart-grid{grid-template-columns:1.7fr 1fr}} .print-grid{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end} @media(max-width:480px){.print-grid{grid-template-columns:1fr 1fr;} .print-grid .print-btn{grid-column:1/-1}} .cust-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px} @media(max-width:480px){.cust-stats{grid-template-columns:1fr}} .aliphia-btn{background:linear-gradient(135deg,#0f766e,#0d9488)!important;border:none;box-shadow:0 2px 8px rgba(15,118,110,.3);transition:all .2s!important} .aliphia-btn:hover{box-shadow:0 4px 14px rgba(15,118,110,.45)!important;transform:translateY(-1px)}`}</style>

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
  {toast&&<div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:toast.type==="warn"?"#f59e0b":"#16a34a",color:"#fff",padding:"8px 20px",borderRadius:"50px",fontWeight:700,fontSize:"13px",boxShadow:"0 4px 16px rgba(0,0,0,.2)",animation:"toastIn .2s",whiteSpace:"nowrap"}}>{toast.msg}</div>}

  {/* Delete Modal */}
  {delModal&&(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setDelModal(null)}>
      <div className="card" style={{padding:"28px 32px",textAlign:"center",maxWidth:"320px",animation:"fadeUp .2s"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:"38px",marginBottom:"8px"}}>🗑️</div>
        <div style={{fontWeight:700,fontSize:"15px",marginBottom:"6px"}}>تأكيد الحذف</div>
        <div style={{color:"#6b7280",fontSize:"13px",marginBottom:"18px"}}>سيتم حذف الفاتورة <b>{delModal.invNum}</b> نهائياً</div>
        <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
          <button className="btn btn-red" onClick={confirmDelete}>نعم، احذف</button>
          <button className="btn btn-ghost" onClick={()=>setDelModal(null)}>إلغاء</button>
        </div>
      </div>
    </div>
  )}

  <div style={{maxWidth:"1040px",width:"100%",margin:"0 auto",padding:"18px 14px",flex:1}}>

    {/* DASHBOARD */}
    {view==="dash"&&<div style={{animation:"fadeUp .25s"}}><Dashboard invoices={invoices} company={company}/></div>}

    {/* CUSTOMERS */}
    {view==="customers"&&(
      <div style={{animation:"fadeUp .25s"}}>
        <Customers
          invoices={invoices}
          company={company}
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
          <input className="inp" style={{flex:1,padding:"10px 14px",minWidth:"180px"}} placeholder="🔍 ابحث بالتلفون أو الاسم أو رقم الفاتورة..." value={search} onChange={e=>{setSearch(e.target.value);setSelectedIds([]);}}/>
          <button className="btn aliphia-btn" style={{color:"#fff",gap:"6px"}} onClick={()=>setShowAliphia(true)}>
            <span style={{fontSize:"15px"}}>📥</span> استيراد Aliphia
          </button>
          <span style={{fontSize:"12px",color:"#6b7280",whiteSpace:"nowrap"}}>{filtered.length} فاتورة</span>
        </div>

        {/* Bulk actions bar */}
        {selectedIds.length>0&&(
          <div style={{display:"flex",gap:"8px",alignItems:"center",background:`${col}0d`,border:`1.5px solid ${col}33`,borderRadius:"9px",padding:"9px 14px",marginBottom:"10px",flexWrap:"wrap"}}>
            <span style={{fontSize:"13px",fontWeight:800,color:col}}>{selectedIds.length} محدد</span>
            <div style={{flex:1}}/>
            {!!perms.print_invoice&&<button className="btn" style={{background:col,color:"#fff",padding:"6px 12px",fontSize:"12px"}} onClick={printSelected}>🖨️ طباعة المحددة</button>}
            <button className="btn" style={{background:"#7c3aed",color:"#fff",padding:"6px 12px",fontSize:"12px"}} onClick={()=>{setPurchasePreSelect([...selectedIds]);setSelectedIds([]);setView("purchase");}}>🛒 توليد فاتورة مشتريات</button>
            {!!perms.delete_invoice&&<button className="btn btn-red" style={{padding:"6px 12px",fontSize:"12px"}} onClick={deleteSelected}>🗑️ حذف المحددة</button>}
            <button className="btn btn-ghost" style={{padding:"6px 10px",fontSize:"12px"}} onClick={()=>setSelectedIds([])}>✕ إلغاء التحديد</button>
          </div>
        )}

        {filtered.length===0?(
          <div className="card" style={{padding:"56px",textAlign:"center",color:"#9ca3af"}}>
            <div style={{fontSize:"44px",marginBottom:"10px"}}>📄</div>
            <div style={{fontWeight:600,marginBottom:"14px"}}>لا توجد فواتير</div>
            <button className="btn aliphia-btn" style={{color:"#fff"}} onClick={()=>setShowAliphia(true)}>📥 استورد فواتيرك من Aliphia</button>
          </div>
        ):(
          <div className="card" style={{overflow:"hidden"}}>
            <table className="inv-table">
              <thead><tr style={{background:"#f8fafc",borderBottom:"2px solid #e5e7eb"}}>
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
                {filtered.map(inv=>{
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
                      <td className="col-phone" style={{direction:"ltr",textAlign:"right",color:"#2563eb"}}>{inv.clientPhone}</td>
                      <td className="col-date" style={{color:"#6b7280",fontSize:"12px"}}>{fDate(inv.date)}</td>
                      <td style={{fontWeight:700}}>{fKWD(iT(inv))}</td>
                      <td><span className={`b-${st}`}>{stLabel[st]}</span></td>
                      <td onClick={e=>e.stopPropagation()}>
                        <div style={{display:"flex",gap:"4px"}}>
                          {!!perms.print_invoice&&<button className="btn" style={{background:col,color:"#fff",padding:"5px 8px",fontSize:"12px"}} onClick={e=>{e.stopPropagation();doPrint([inv],company);}}>🖨️</button>}
                          {!!perms.edit_invoice&&<button className="btn" style={{background:"#f59e0b",color:"#fff",padding:"5px 8px",fontSize:"12px"}} onClick={e=>{e.stopPropagation();openEdit(inv);}}>✏️</button>}
                          {!!perms.delete_invoice&&<button className="btn btn-red" style={{padding:"5px 8px",fontSize:"12px"}} onClick={e=>{e.stopPropagation();setDelModal(inv);}}>🗑️</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}

    {/* DETAIL */}
    {view==="list"&&selInv&&(
      <div style={{animation:"fadeUp .25s"}}>
        <div style={{display:"flex",gap:"8px",marginBottom:"12px",flexWrap:"wrap"}}>
          <button className="btn btn-ghost" onClick={()=>setSelInv(null)}>← رجوع</button>
          {!!perms.print_invoice&&<button className="btn" style={{background:col,color:"#fff"}} onClick={()=>doPrint([selInv],company)}>🖨️ طباعة</button>}
          {!!perms.edit_invoice&&<button className="btn" style={{background:"#f59e0b",color:"#fff"}} onClick={()=>openEdit(selInv)}>✏️ تعديل</button>}
          {!!perms.delete_invoice&&<button className="btn btn-red" onClick={()=>setDelModal(selInv)}>🗑️ حذف</button>}
        </div>
        <div className="card" style={{overflow:"hidden"}}><InvPreview inv={selInv} company={company}/></div>
      </div>
    )}

    {/* NEW */}
    {view==="new"&&(
      <div className="card" style={{padding:"24px",animation:"fadeUp .25s"}}>
        <div style={{fontSize:"16px",fontWeight:900,color:col,marginBottom:"18px"}}>➕ فاتورة جديدة — {company.nameAr}</div>
        <div style={{fontSize:"10px",fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"9px"}}>بيانات العميل</div>
        <div className="form-2col" style={{marginBottom:"10px"}}>
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>الاسم (اختياري)</label>
            <input className="inp" placeholder="اسم العميل" value={form.clientName} onChange={e=>setField("clientName",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>رقم التلفون *</label>
            <input className="inp" placeholder="97479196" value={form.clientPhone} onChange={e=>setField("clientPhone",e.target.value)}/></div>
        </div>
        <div style={{marginBottom:"12px"}}>
          <label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>العنوان</label>
          <input className="inp" placeholder="المنطقة / العنوان" value={form.clientAddress} onChange={e=>setField("clientAddress",e.target.value)}/>
        </div>
        <div className="form-3col" style={{marginBottom:"14px"}}>
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>تاريخ الفاتورة</label>
            <input className="inp" type="date" value={form.date} onChange={e=>setField("date",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>تاريخ الاستحقاق</label>
            <input className="inp" type="date" value={form.dueDate} onChange={e=>setField("dueDate",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>المدفوع (KD)</label>
            <input className="inp" placeholder="0.000" value={form.paid} onChange={e=>setField("paid",e.target.value)}/></div>
        </div>
        <div style={{fontSize:"10px",fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"9px"}}>المنتجات</div>
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
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>التوصيل (KD) — 0 للمجاني</label>
            <input className="inp" placeholder="0.000" value={form.shipping} onChange={e=>setField("shipping",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>ملاحظات</label>
            <input className="inp" value={form.notes} onChange={e=>setField("notes",e.target.value)}/></div>
        </div>
        {(()=>{const sub=form.items.reduce((s,it)=>s+(parseInt(toW(it.qty))||1)*pN(it.price),0);const ship=pN(form.shipping);const tot=sub+ship;
          return(<div style={{background:company.cardBg,borderRadius:"9px",padding:"11px 16px",marginBottom:"14px",display:"flex",gap:"16px",fontSize:"13px",border:`1px solid ${col}22`}}>
            <span>المجموع: <b>{fKWD(sub)}</b></span>{ship>0&&<span>التوصيل: <b>{fKWD(ship)}</b></span>}
            <span style={{fontWeight:900,color:col}}>الإجمالي: <b>{fKWD(tot)}</b></span>
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

        <div style={{fontSize:"10px",fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"9px"}}>بيانات العميل</div>
        <div className="form-2col" style={{marginBottom:"10px"}}>
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>الاسم</label>
            <input className="inp" placeholder="اسم العميل" value={editForm.clientName} onChange={e=>setEditField("clientName",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>رقم التلفون *</label>
            <input className="inp" placeholder="97479196" value={editForm.clientPhone} onChange={e=>setEditField("clientPhone",e.target.value)}/></div>
        </div>
        <div style={{marginBottom:"12px"}}>
          <label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>العنوان</label>
          <input className="inp" placeholder="المنطقة / العنوان" value={editForm.clientAddress} onChange={e=>setEditField("clientAddress",e.target.value)}/>
        </div>
        <div className="form-3col" style={{marginBottom:"14px"}}>
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>تاريخ الفاتورة</label>
            <input className="inp" type="date" value={editForm.date} onChange={e=>setEditField("date",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>تاريخ الاستحقاق</label>
            <input className="inp" type="date" value={editForm.dueDate} onChange={e=>setEditField("dueDate",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>المدفوع (KD)</label>
            <input className="inp" placeholder="0.000" value={editForm.paid} onChange={e=>setEditField("paid",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>حالة الطلب</label>
            <select className="inp" value={editForm.status||""} onChange={e=>setEditField("status",e.target.value)}>
              <option value="">تلقائي (حسب المدفوع)</option>
              <option value="cancelled">ملغية ✕</option>
            </select>
          </div>
        </div>

        <div style={{fontSize:"10px",fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"9px"}}>المنتجات</div>
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
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>التوصيل (KD) — 0 للمجاني</label>
            <input className="inp" placeholder="0.000" value={editForm.shipping} onChange={e=>setEditField("shipping",e.target.value)}/></div>
          <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>ملاحظات</label>
            <input className="inp" value={editForm.notes} onChange={e=>setEditField("notes",e.target.value)}/></div>
        </div>

        {(()=>{
          const sub=editForm.items.reduce((s,it)=>(parseInt(toW(String(it.qty)))||1)*pN(it.price)+s,0);
          const ship=pN(editForm.shipping);const tot=sub+ship;
          return(
            <div style={{background:company.cardBg,borderRadius:"9px",padding:"11px 16px",marginBottom:"14px",display:"flex",gap:"16px",fontSize:"13px",border:`1px solid ${col}22`}}>
              <span>المجموع: <b>{fKWD(sub)}</b></span>
              {ship>0&&<span>التوصيل: <b>{fKWD(ship)}</b></span>}
              <span style={{fontWeight:900,color:col}}>الإجمالي: <b>{fKWD(tot)}</b></span>
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
        <div style={{fontSize:"16px",fontWeight:900,color:col,marginBottom:"5px"}}>📦 إدخال مجمع</div>
        <p style={{fontSize:"12px",color:"#6b7280",marginBottom:"16px"}}>كل طلب يفصله سطر فارغ — يدعم صيغة الإيموجي</p>
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
              return(<div key={i} style={{border:"1px solid #e5e7eb",borderRadius:"8px",padding:"10px 14px",marginBottom:"6px",background:"#fafaf9"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <div><b>{b.clientName}</b> <span style={{color:"#2563eb",fontSize:"12px",direction:"ltr"}}>{b.clientPhone}</span>
                    {b.clientAddress&&<span style={{color:"#6b7280",fontSize:"11px",marginRight:"6px"}}> — {b.clientAddress}</span>}</div>
                  <b style={{color:col}}>{fKWD(tot)}</b>
                </div>
                <div style={{fontSize:"12px",color:"#555",marginTop:"4px"}}>
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
          <div style={{fontSize:"16px",fontWeight:900,color:col,marginBottom:"14px"}}>🖨️ طباعة من رقم إلى رقم</div>
          <div className="print-grid">
            <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>من رقم الفاتورة</label>
              <input className="inp" placeholder="INV10001 أو 10001" value={printRange.from} onChange={e=>setPrintRange(r=>({...r,from:e.target.value}))}/></div>
            <div><label style={{fontSize:"11px",color:"#6b7280",display:"block",marginBottom:"4px"}}>إلى رقم الفاتورة</label>
              <input className="inp" placeholder="INV10010 أو 10010" value={printRange.to} onChange={e=>setPrintRange(r=>({...r,to:e.target.value}))}/></div>
            <button className="btn print-btn" style={{background:col,color:"#fff",height:"40px"}} onClick={doPrintRange}>🖨️ طباعة</button>
          </div>
          <p style={{fontSize:"11px",color:"#9ca3af",marginTop:"8px"}}>⚠️ يجب السماح بالـ Popups في المتصفح لتعمل الطباعة</p>
        </div>
        <div className="card" style={{padding:"20px"}}>
          <div style={{fontSize:"11px",fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"10px"}}>أو اضغط على فاتورة لطباعتها</div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            {invoices.slice().sort((a,b)=>parseInt(a.invNum?.replace(/\D/g,"")||0)-parseInt(b.invNum?.replace(/\D/g,"")||0)).map(inv=>(
              <div key={inv.id} style={{border:`1px solid ${col}33`,borderRadius:"8px",padding:"10px 14px",background:company.cardBg,fontSize:"12px",cursor:"pointer",transition:"all .15s"}}
                onClick={()=>doPrint([inv],company)}>
                <div style={{fontWeight:700,color:col}}>{inv.invNum}</div>
                <div style={{color:"#555",marginTop:"2px",fontSize:"11px"}}>{inv.clientName}</div>
                <div style={{fontWeight:700,marginTop:"2px"}}>{fKWD(iT(inv))}</div>
                <div style={{color:col,marginTop:"4px",fontSize:"10px"}}>🖨️ اضغط للطباعة</div>
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
    <div style={{textAlign:"center",padding:"18px 14px 22px",marginTop:"auto",borderTop:"1px solid #e5e7eb",fontSize:"12px",color:"#9ca3af",paddingBottom:"calc(22px + env(safe-area-inset-bottom))"}}>
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