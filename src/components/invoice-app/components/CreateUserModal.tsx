"use client";

import { useState } from "react";
import { createUser, ALL_COMPANIES } from "../firebase/users";
import { tr, appDir } from "@/lib/i18n-app";

// r12: قائمة شركات ديناميكية من الخادم (fallback للافتراضيات الثابتة)


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
  { value:"viewer",   label:"عرض فقط 👁️",      desc:"يشوف الفواتير والعملاء فقط",    color:"var(--ia-warn-tx)" },
  { value:"employee", label:"موظف طلبات 👤",    desc:"صلاحيات مخصصة قابلة للتعديل",  color:"var(--ia-vio-tx)" },
  { value:"editor",   label:"وصول كامل ✏️",     desc:"إنشاء وتعديل وحذف وتصدير",     color:"var(--ia-ok-tx)" },
];

interface CreateUserModalProps {
  onClose: () => void;
  onCreated?: () => void;
  companies?: Array<{ id: string; nameAr: string; emoji?: string }>;
}

export default function CreateUserModal({ onClose, onCreated, companies }: CreateUserModalProps) {
  // r12: شركات الخادم إن وُجدت، وإلا الافتراضية
  const COMPANY_IDS: string[] = companies && companies.length ? companies.map(c => c.id) : ALL_COMPANIES;
  const DYN_LABELS: Record<string, string> = {};
  (companies || []).forEach(c => { DYN_LABELS[c.id] = `${c.nameAr} ${c.emoji || "🏢"}`; });
  const labelOf = (id: string): string => DYN_LABELS[id] || COMPANY_LABELS[id] || id;
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
      setErr(tr("يرجى تعبئة جميع الحقول واختيار شركة واحدة على الأقل")); return;
    }
    if (form.password.length < 6) { setErr(tr("كلمة المرور يجب أن تكون 6 أحرف على الأقل")); return; }
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
        "auth/email-already-in-use": tr("هذا الإيميل مسجل مسبقاً — اختر إيميل آخر"),
        "auth/invalid-email":         tr("صيغة الإيميل غير صحيحة"),
        "auth/weak-password":         tr("كلمة المرور ضعيفة جداً (6 أحرف على الأقل)"),
        "auth/configuration-not-found":tr("يرجى تفعيل Email/Password في Firebase Console"),
        "auth/network-request-failed": tr("تعذّر الاتصال بالإنترنت — تحقق من الشبكة وأعد المحاولة"),
        "auth/too-many-requests":      tr("محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة"),
      };
      setErr(msgs[e.code] || e.message || tr("حدث خطأ غير متوقع، يرجى المحاولة مجدداً"));
      setLoading(false);
    }
  };

  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:3000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",
      fontFamily:"'Cairo','Tajawal',sans-serif",direction:appDir(),
    }} onClick={onClose}>
      <div style={{
        background:"var(--ia-card)",borderRadius:"18px",width:"100%",maxWidth:"560px",
        maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",
        boxShadow:"0 24px 64px rgba(0,0,0,.35)",
      }} onClick={e=>e.stopPropagation()}>

        <div style={{background:"#1e3a5f",padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{color:"#fff",fontWeight:900,fontSize:"16px"}}>{tr("➕ إضافة موظف جديد")}</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"6px 12px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>{tr("✕ إغلاق")}</button>
        </div>

        <div style={{padding:"20px 22px",overflowY:"auto",flex:1}}>
          <div style={{display:"grid",gap:"14px"}}>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
              <div>
                <label style={lbl}>{tr("الاسم الكامل")}</label>
                <input style={inp} placeholder={tr("اسم الموظف")} value={form.displayName} onChange={e=>setForm(f=>({...f,displayName:e.target.value}))}/>
              </div>
              <div>
                <label style={lbl}>{tr("البريد الإلكتروني *")}</label>
                <input style={inp} type="email" placeholder="user@example.com" value={form.email} onChange={e=>{setForm(f=>({...f,email:e.target.value}));setErr("");}}/>
              </div>
            </div>

            <div>
              <label style={lbl}>{tr("كلمة المرور *")}</label>
              <div style={{position:"relative"}}>
                <input style={{...inp,paddingInlineEnd:"40px"}} type={showPass?"text":"password"} placeholder={tr("6 أحرف على الأقل")} value={form.password} onChange={e=>{setForm(f=>({...f,password:e.target.value}));setErr("");}}/>
                <span onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:"15px",color:"var(--ia-muted)"}}>{showPass?"🙈":"👁️"}</span>
              </div>
            </div>

            <div>
              <label style={lbl}>{tr("الشركات المسموح بها *")}</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                {COMPANY_IDS.map((id: string)=>{
                  const active=form.companies.includes(id);
                  return(
                    <div key={id} onClick={()=>toggleCompany(id)} style={{border:`2px solid `,borderRadius:"10px",padding:"9px 12px",cursor:"pointer",background:active?"var(--ia-blue-bg)":"var(--ia-row-alt)",transition:"all .15s",display:"flex",alignItems:"center",gap:"8px"}}>
                      <div style={{width:"16px",height:"16px",borderRadius:"4px",border:`2px solid `,background:active?"#1e3a5f":"var(--ia-card)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {active&&<span style={{color:"#fff",fontSize:"10px",fontWeight:900}}>✓</span>}
                      </div>
                      <span style={{fontSize:"12px",fontWeight:active?700:400,color:active?"var(--ia-blue-tx)":"var(--ia-text2)"}}>{labelOf(id)}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:"6px",display:"flex",gap:"8px"}}>
                <button onClick={()=>setForm(f=>({...f,companies:COMPANY_IDS}))} style={{fontSize:"11px",color:"var(--ia-link)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>{tr("تحديد الكل")}</button>
                <span style={{color:"var(--ia-muted)"}}>|</span>
                <button onClick={()=>setForm(f=>({...f,companies:[]}))} style={{fontSize:"11px",color:"var(--ia-red-tx)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>{tr("إلغاء الكل")}</button>
              </div>
            </div>

            <div>
              <label style={lbl}>{tr("نوع الصلاحية")}</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px"}}>
                {ROLES.map(r=>{
                  const active=form.role===r.value;
                  return(
                    <div key={r.value} onClick={()=>setRole(r.value)} style={{border:`2px solid `,borderRadius:"10px",padding:"11px 10px",cursor:"pointer",background:active?r.color+"12":"var(--ia-row-alt)",transition:"all .15s"}}>
                      <div style={{fontWeight:700,fontSize:"12px",color:active?r.color:"var(--ia-text2)",marginBottom:"3px"}}>{tr(r.label)}</div>
                      <div style={{fontSize:"10px",color:"var(--ia-muted)",lineHeight:1.4}}>{tr(r.desc)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {form.role==="employee"&&(
              <div style={{background:"var(--ia-vio-bg)",borderRadius:"12px",padding:"14px",border:"1.5px solid var(--ia-vio-bd)"}}>
                <div style={{fontSize:"11px",fontWeight:800,color:"var(--ia-vio-tx)",letterSpacing:".5px",textTransform:"uppercase",marginBottom:"10px"}}>{tr("⚙️ الصلاحيات التفصيلية")}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                  {PERM_LIST.map(p=>{
                    const active=!!form.permissions[p.key];
                    return(
                      <div key={p.key} onClick={()=>togglePerm(p.key)} style={{display:"flex",alignItems:"center",gap:"8px",padding:"7px 10px",borderRadius:"8px",cursor:"pointer",background:active?"var(--ia-vio-bg)":"var(--ia-card)",border:`1.5px solid `,transition:"all .12s"}}>
                        <div style={{width:"16px",height:"16px",borderRadius:"4px",border:`2px solid `,background:active?"#7c3aed":"var(--ia-card)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {active&&<span style={{color:"#fff",fontSize:"10px",fontWeight:900}}>✓</span>}
                        </div>
                        <span style={{fontSize:"11.5px",fontWeight:active?700:400,color:active?"var(--ia-vio-tx)":"var(--ia-sub)"}}>{p.icon} {tr(p.label)}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{marginTop:"8px",display:"flex",gap:"8px"}}>
                  <button onClick={()=>setForm(f=>({...f,permissions:Object.fromEntries(PERM_LIST.map(p=>[p.key,1]))}))} style={{fontSize:"11px",color:"var(--ia-vio-tx)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>{tr("تفعيل الكل")}</button>
                  <span style={{color:"var(--ia-muted)"}}>|</span>
                  <button onClick={()=>setForm(f=>({...f,permissions:Object.fromEntries(PERM_LIST.map(p=>[p.key,0]))}))} style={{fontSize:"11px",color:"var(--ia-red-tx)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>{tr("إلغاء الكل")}</button>
                </div>
              </div>
            )}

            {err&&<div style={{background:"var(--ia-red-bg)",border:"1px solid var(--ia-red-bd)",borderRadius:"8px",padding:"9px 14px",color:"var(--ia-red-tx)",fontSize:"13px"}}>❌ {err}</div>}

            <button onClick={handleCreate} disabled={loading} style={{width:"100%",border:"none",borderRadius:"10px",padding:"13px",background:loading?"var(--ia-ghost-bg)":"#1e3a5f",color:loading?"var(--ia-muted)":"#fff",fontFamily:"inherit",fontSize:"15px",fontWeight:700,cursor:loading?"not-allowed":"pointer"}}>
              {loading?tr("جارٍ الإنشاء..."):tr("✅ إنشاء الموظف")}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize:"12px",color:"var(--ia-sub)",display:"block",marginBottom:"5px",fontWeight:700 };
const inp: React.CSSProperties = { width:"100%",border:"1.5px solid var(--ia-border2)",borderRadius:"8px",padding:"10px 14px",fontFamily:"'Cairo','Tajawal',sans-serif",fontSize:"13px",background:"var(--ia-card)",outline:"none" };
