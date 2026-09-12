"use client";

import { useState } from "react";
import { createUser, ALL_COMPANIES } from "../firebase/users";

const COMPANY_LABELS: Record<string, string> = {
  tawfeer: "توفير أونلاين شوب 🛒",
  mahhal:  "محلكم أونلاين ستور 🏪",
  boss:    "بوص نيولايف ⚡",
  laqta:   "لقطة أونلاين ♾️",
};

export const PERM_LIST: Array<{ key: string; label: string; icon: string; group: string }> = [
  { key:"create_invoice",  label:"إنشاء فواتير",   icon:"➕", group:"فواتير" },
  { key:"print_invoice",   label:"طباعة الفواتير", icon:"🖨️", group:"فواتير" },
  { key:"edit_invoice",    label:"تعديل الفواتير", icon:"✏️", group:"فواتير" },
  { key:"delete_invoice",  label:"حذف الفواتير",  icon:"🗑️", group:"فواتير" },
  { key:"view_customers",  label:"عرض العملاء",   icon:"👥", group:"عملاء" },
  { key:"edit_customer",   label:"تعديل العملاء", icon:"✏️", group:"عملاء" },
  { key:"delete_customer", label:"حذف العملاء",  icon:"🗑️", group:"عملاء" },
  { key:"bulk_input",      label:"الإدخال المجمع",icon:"📦", group:"أخرى" },
  { key:"export_data",     label:"تصدير البيانات",icon:"⬇️", group:"أخرى" },
];

export const EMPLOYEE_DEFAULTS: Record<string, number> = {
  create_invoice:1, print_invoice:1, view_customers:1, bulk_input:1,
  edit_invoice:1, delete_invoice:1, edit_customer:1, delete_customer:1,
  export_data:0,
};

const ROLE_PERM_PRESETS: Record<string, Record<string, number>> = {
  viewer:   { create_invoice:0,print_invoice:0,view_customers:1,bulk_input:0,edit_invoice:0,delete_invoice:0,edit_customer:0,delete_customer:0,export_data:0 },
  employee: { ...EMPLOYEE_DEFAULTS },
  editor:   { create_invoice:1,print_invoice:1,view_customers:1,bulk_input:1,edit_invoice:1,delete_invoice:1,edit_customer:1,delete_customer:1,export_data:1 },
};

const ROLES = [
  { value:"viewer",   label:"عرض فقط 👁️",      desc:"يشوف الفواتير والعملاء فقط",    color:"#b45309" },
  { value:"employee", label:"موظف طلبات 👤",    desc:"صلاحيات مخصصة قابلة للتعديل",  color:"#7c3aed" },
  { value:"editor",   label:"وصول كامل ✏️",     desc:"إنشاء وتعديل وحذف وتصدير",     color:"#15803d" },
];

interface CreateUserModalProps {
  onClose: () => void;
  onCreated?: () => void;
}

export default function CreateUserModal({ onClose, onCreated }: CreateUserModalProps) {
  const [form, setForm] = useState({
    displayName:"", email:"", password:"",
    companies:[] as string[], role:"employee",
    permissions:{ ...EMPLOYEE_DEFAULTS },
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [showPass, setShowPass] = useState(false);

  const toggleCompany = (id: string) => setForm(f => ({
    ...f, companies: f.companies.includes(id) ? f.companies.filter(c=>c!==id) : [...f.companies,id],
  }));

  const setRole = (role: string) => setForm(f => ({ ...f, role, permissions:{ ...ROLE_PERM_PRESETS[role] } }));

  const togglePerm = (key: string) => setForm(f => ({ ...f, permissions:{ ...f.permissions, [key]: f.permissions[key]?0:1 } }));

  const handleCreate = async () => {
    if (!form.email || !form.password || form.companies.length===0) {
      setErr("يرجى تعبئة جميع الحقول واختيار شركة واحدة على الأقل"); return;
    }
    if (form.password.length < 6) { setErr("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    setLoading(true); setErr("");
    try {
      await createUser({
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim() || form.email.trim(),
        companies: form.companies,
        role: form.role,
        permissions: form.role === "employee" ? form.permissions : {},
      });
      setLoading(false);
      onCreated?.();
      onClose();
    } catch (e: any) {
      const msgs: Record<string, string> = {
        "auth/email-already-in-use": "هذا الإيميل مسجل مسبقاً — اختر إيميل آخر",
        "auth/invalid-email":         "صيغة الإيميل غير صحيحة",
        "auth/weak-password":         "كلمة المرور ضعيفة جداً (6 أحرف على الأقل)",
        "auth/configuration-not-found":"يرجى تفعيل Email/Password في Firebase Console",
        "auth/network-request-failed": "تعذّر الاتصال بالإنترنت — تحقق من الشبكة وأعد المحاولة",
        "auth/too-many-requests":      "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة",
      };
      setErr(msgs[e.code] || e.message || "حدث خطأ غير متوقع، يرجى المحاولة مجدداً");
      setLoading(false);
    }
  };

  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:3000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",
      fontFamily:"'Cairo','Tajawal',sans-serif",direction:"rtl",
    }} onClick={onClose}>
      <div style={{
        background:"#fff",borderRadius:"18px",width:"100%",maxWidth:"560px",
        maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",
        boxShadow:"0 24px 64px rgba(0,0,0,.35)",
      }} onClick={e=>e.stopPropagation()}>

        <div style={{background:"#1e3a5f",padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{color:"#fff",fontWeight:900,fontSize:"16px"}}>➕ إضافة موظف جديد</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"6px 12px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>✕ إغلاق</button>
        </div>

        <div style={{padding:"20px 22px",overflowY:"auto",flex:1}}>
          <div style={{display:"grid",gap:"14px"}}>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
              <div>
                <label style={lbl}>الاسم الكامل</label>
                <input style={inp} placeholder="اسم الموظف" value={form.displayName} onChange={e=>setForm(f=>({...f,displayName:e.target.value}))}/>
              </div>
              <div>
                <label style={lbl}>البريد الإلكتروني *</label>
                <input style={inp} type="email" placeholder="user@example.com" value={form.email} onChange={e=>{setForm(f=>({...f,email:e.target.value}));setErr("");}}/>
              </div>
            </div>

            <div>
              <label style={lbl}>كلمة المرور *</label>
              <div style={{position:"relative"}}>
                <input style={{...inp,paddingLeft:"40px"}} type={showPass?"text":"password"} placeholder="6 أحرف على الأقل" value={form.password} onChange={e=>{setForm(f=>({...f,password:e.target.value}));setErr("");}}/>
                <span onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:"15px",color:"#9ca3af"}}>{showPass?"🙈":"👁️"}</span>
              </div>
            </div>

            <div>
              <label style={lbl}>الشركات المسموح بها *</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                {ALL_COMPANIES.map((id: string)=>{
                  const active=form.companies.includes(id);
                  return(
                    <div key={id} onClick={()=>toggleCompany(id)} style={{border:`2px solid ${active?"#1e3a5f":"#e5e7eb"}`,borderRadius:"10px",padding:"9px 12px",cursor:"pointer",background:active?"#eff6ff":"#fafafa",transition:"all .15s",display:"flex",alignItems:"center",gap:"8px"}}>
                      <div style={{width:"16px",height:"16px",borderRadius:"4px",border:`2px solid ${active?"#1e3a5f":"#d1d5db"}`,background:active?"#1e3a5f":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {active&&<span style={{color:"#fff",fontSize:"10px",fontWeight:900}}>✓</span>}
                      </div>
                      <span style={{fontSize:"12px",fontWeight:active?700:400,color:active?"#1e3a5f":"#374151"}}>{COMPANY_LABELS[id]}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:"6px",display:"flex",gap:"8px"}}>
                <button onClick={()=>setForm(f=>({...f,companies:ALL_COMPANIES}))} style={{fontSize:"11px",color:"#2563eb",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>تحديد الكل</button>
                <span style={{color:"#d1d5db"}}>|</span>
                <button onClick={()=>setForm(f=>({...f,companies:[]}))} style={{fontSize:"11px",color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>إلغاء الكل</button>
              </div>
            </div>

            <div>
              <label style={lbl}>نوع الصلاحية</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px"}}>
                {ROLES.map(r=>{
                  const active=form.role===r.value;
                  return(
                    <div key={r.value} onClick={()=>setRole(r.value)} style={{border:`2px solid ${active?r.color:"#e5e7eb"}`,borderRadius:"10px",padding:"11px 10px",cursor:"pointer",background:active?r.color+"12":"#fafafa",transition:"all .15s"}}>
                      <div style={{fontWeight:700,fontSize:"12px",color:active?r.color:"#374151",marginBottom:"3px"}}>{r.label}</div>
                      <div style={{fontSize:"10px",color:"#9ca3af",lineHeight:1.4}}>{r.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {form.role==="employee"&&(
              <div style={{background:"#faf5ff",borderRadius:"12px",padding:"14px",border:"1.5px solid #ddd6fe"}}>
                <div style={{fontSize:"11px",fontWeight:800,color:"#7c3aed",letterSpacing:".5px",textTransform:"uppercase",marginBottom:"10px"}}>⚙️ الصلاحيات التفصيلية</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                  {PERM_LIST.map(p=>{
                    const active=!!form.permissions[p.key];
                    return(
                      <div key={p.key} onClick={()=>togglePerm(p.key)} style={{display:"flex",alignItems:"center",gap:"8px",padding:"7px 10px",borderRadius:"8px",cursor:"pointer",background:active?"#ede9fe":"#fff",border:`1.5px solid ${active?"#7c3aed":"#e5e7eb"}`,transition:"all .12s"}}>
                        <div style={{width:"16px",height:"16px",borderRadius:"4px",border:`2px solid ${active?"#7c3aed":"#d1d5db"}`,background:active?"#7c3aed":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {active&&<span style={{color:"#fff",fontSize:"10px",fontWeight:900}}>✓</span>}
                        </div>
                        <span style={{fontSize:"11.5px",fontWeight:active?700:400,color:active?"#5b21b6":"#6b7280"}}>{p.icon} {p.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{marginTop:"8px",display:"flex",gap:"8px"}}>
                  <button onClick={()=>setForm(f=>({...f,permissions:Object.fromEntries(PERM_LIST.map(p=>[p.key,1]))}))} style={{fontSize:"11px",color:"#7c3aed",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>تفعيل الكل</button>
                  <span style={{color:"#d1d5db"}}>|</span>
                  <button onClick={()=>setForm(f=>({...f,permissions:Object.fromEntries(PERM_LIST.map(p=>[p.key,0]))}))} style={{fontSize:"11px",color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>إلغاء الكل</button>
                </div>
              </div>
            )}

            {err&&<div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:"8px",padding:"9px 14px",color:"#b91c1c",fontSize:"13px"}}>❌ {err}</div>}

            <button onClick={handleCreate} disabled={loading} style={{width:"100%",border:"none",borderRadius:"10px",padding:"13px",background:loading?"#e5e7eb":"#1e3a5f",color:loading?"#9ca3af":"#fff",fontFamily:"inherit",fontSize:"15px",fontWeight:700,cursor:loading?"not-allowed":"pointer"}}>
              {loading?"جارٍ الإنشاء...":"✅ إنشاء الموظف"}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize:"12px",color:"#6b7280",display:"block",marginBottom:"5px",fontWeight:700 };
const inp: React.CSSProperties = { width:"100%",border:"1.5px solid #d1d5db",borderRadius:"8px",padding:"10px 14px",fontFamily:"'Cairo','Tajawal',sans-serif",fontSize:"13px",background:"#fff",outline:"none" };
