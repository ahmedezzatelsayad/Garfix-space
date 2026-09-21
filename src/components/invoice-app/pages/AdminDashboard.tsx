"use client";

import { useState, useEffect, useRef } from "react";
import { getAllUsers, updateUserProfile, deleteUserRecord, ALL_COMPANIES, seedUserProfiles } from "../firebase/users";
import { useAuth } from "../context/AuthContext";
import CreateUserModal, { PERM_LIST, EMPLOYEE_DEFAULTS } from "../components/CreateUserModal";
import ResendPanel from "../components/ResendPanel";
import SubscriptionsPanel from "../components/SubscriptionsPanel";
import { MASTER_EMAIL } from "../firebase/auth";
import { tr, appDir } from "@/lib/i18n-app";

interface UserRecord {
  uid: string;
  email: string;
  displayName?: string;
  companies?: string[];
  role?: string;
  permissions?: Record<string, number>;
}

interface EditingUser extends UserRecord {
  companies: string[];
  role: string;
  permissions: Record<string, number>;
}

const COMPANY_LABELS: Record<string, string> = {
  tawfeer: "توفير 🛒",
  mahhal:  "محلكم 🏪",
  boss:    "بوص ⚡",
  laqta:   "لقطة ♾️",
};

const COMPANIES_INFO = [
  { id:"tawfeer", name:"توفير أونلاين شوب",  color:"#1e3a5f", emoji:"🛒" },
  { id:"mahhal",  name:"محلكم أونلاين ستور", color:"#b8860b", emoji:"🏪" },
  { id:"boss",    name:"بوص نيولايف",         color:"#cc0000", emoji:"⚡" },
  { id:"laqta",   name:"لقطة أونلاين",        color:"var(--ia-vio-tx)", emoji:"♾️" },
];

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  viewer:   { label:"عرض فقط",      color:"var(--ia-warn-tx)", bg:"var(--ia-warn-bg)" },
  editor:   { label:"وصول كامل",    color:"var(--ia-ok-tx)", bg:"var(--ia-ok-bg)" },
  employee: { label:"موظف طلبات",   color:"var(--ia-vio-tx)", bg:"var(--ia-vio-bg)" },
  admin:    { label:"مدير",          color:"var(--ia-blue-tx)", bg:"var(--ia-blue-bg)" },
};

const ROLE_PERM_PRESETS: Record<string, Record<string, number>> = {
  viewer:   { create_invoice:0,print_invoice:0,view_customers:1,bulk_input:0,edit_invoice:0,delete_invoice:0,edit_customer:0,delete_customer:0,export_data:0 },
  employee: { ...EMPLOYEE_DEFAULTS },
  editor:   { create_invoice:1,print_invoice:1,view_customers:1,bulk_input:1,edit_invoice:1,delete_invoice:1,edit_customer:1,delete_customer:1,export_data:1 },
};

function getStoredLogo(id: string): string | null {
  try { return localStorage.getItem(`tw_logo_${id}`) || null; } catch (_) { return null; }
}

interface AdminDashboardProps {
  onClose: () => void;
  companies?: Array<{ id: string; nameAr: string; emoji?: string; color?: string }>;
}

export default function AdminDashboard({ onClose, companies }: AdminDashboardProps) {
  const { user } = useAuth();

// r12: قائمة شركات ديناميكية — تأتي من الخادم (تدعم الشركات المضافة حديثاً) مع الرجوع للافتراضيات
const COMPANY_IDS: string[] = (companies && companies.length ? companies.map(c => c.id) : ALL_COMPANIES);
const DYN_LABELS: Record<string, string> = {};
(companies && companies.length ? companies : []).forEach(c => { DYN_LABELS[c.id] = `${c.nameAr} ${c.emoji || "🏢"}`; });
const labelOf = (id: string): string => DYN_LABELS[id] || COMPANY_LABELS[id] || id;
  const [users,        setUsers]        = useState<UserRecord[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showCreate,   setShowCreate]   = useState(false);
  const [editingUser,  setEditingUser]  = useState<EditingUser | null>(null);
  const [delConfirm,   setDelConfirm]   = useState<UserRecord | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; type: string } | null>(null);
  const [activeTab,    setActiveTab]    = useState("users");
  const [seeding,      setSeeding]      = useState(false);
  const [seedDone,     setSeedDone]     = useState(false);
  const [logos,        setLogos]        = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [loadErr, setLoadErr] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      // Timeout after 12 seconds to prevent infinite loading
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject({ code: "__timeout__", message: "timeout" }), 12000)
      );

      const list = await Promise.race([getAllUsers(), timeout]) as any[];

      // r29 (M9): أُزيل ضجيج console التشخيصي (سجلات حقبة Firestore لا تطابق
      // الخلفية الحالية) — لوحة الإنتاج تبقى نظيفة للمشغّل.
      setUsers((list as UserRecord[]).filter((u) => u.email !== user?.email));
    } catch (e: any) {
      const code: string = e?.code ?? "";
      const msg: string  = e?.message ?? String(e);

      // r29 (M9): رسائل مُعاد صياغتها لواقع PostgreSQL/الواجهة المحلية —
      // كانت كلها تشير لـ Firebase Console/Firestore وهو غير موجود أصلاً.
      if (code === "__timeout__") {
        setLoadErr(tr("انتهت مهلة تحميل المستخدمين (12 ث) — تحقق من الاتصال بالخادم ثم أعد المحاولة."));
      } else if (code === "permission-denied") {
        setLoadErr(tr("مرفوض — تحقق من صلاحيات حسابك بهذا الإجراء ثم أعد المحاولة."));
      } else if (code === "not-found") {
        setLoadErr(tr("قائمة المستخدمين فارغة بعد — أضف أول مستخدم وستُنشأ تلقائياً."));
      } else if (
        code.includes("unavailable") ||
        code.includes("network") ||
        msg.includes("network") ||
        msg.includes("Failed to fetch")
      ) {
        setLoadErr(tr("تعذّر الاتصال بالخادم — تحقق من الإنترنت وأعد المحاولة."));
      } else {
        setLoadErr(tr("خطأ تحميل المستخدمين{0}: {1}",[code ? ` [${code}]` : "",msg || tr("غير معروف")]));
      }
    } finally {
      // Always unblock loading — no matter what happens above
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  useEffect(() => {
    const stored: Record<string, string> = {};
    COMPANIES_INFO.forEach(c => { const v = getStoredLogo(c.id); if (v) stored[c.id] = v; });
    setLogos(stored);
  }, []);

  const toast_ = (msg: string, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const handleSeed = async () => {
    if (seeding || seedDone) return;
    setSeeding(true);
    try {
      const results = await seedUserProfiles();
      const failed = results.filter((r: any) => !r.ok);
      if (failed.length === 0) {
        toast_(tr("✅ تم إنشاء بيانات المستخدمين الـ 5 بنجاح"));
        setSeedDone(true);
        await loadUsers();
      } else {
        toast_(tr("❌ فشل {0} من 5 — {1}",[failed.length,failed.map((r: any)=>r.email).join(", ")]), "err");
      }
    } catch (e: any) {
      toast_(tr("❌ خطأ: ") + e.message, "err");
    }
    setSeeding(false);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await updateUserProfile(editingUser.uid, {
        displayName: editingUser.displayName,
        companies:   editingUser.companies,
        role:        editingUser.role,
        permissions: editingUser.role === "employee" ? (editingUser.permissions || {}) : {},
      });
      toast_(tr("✅ تم تحديث بيانات المستخدم"));
      setEditingUser(null);
      await loadUsers();
    } catch (_) {
      toast_(tr("❌ حدث خطأ أثناء الحفظ"), "err");
    }
    setSaving(false);
  };

  const handleDelete = async (uid: string) => {
    try {
      await deleteUserRecord(uid);
      toast_(tr("🗑️ تم حذف المستخدم"), "warn");
      setDelConfirm(null);
      await loadUsers();
    } catch (_) {
      toast_(tr("❌ حدث خطأ أثناء الحذف"), "err");
    }
  };

  const toggleEditCompany = (id: string) => {
    if (!editingUser) return;
    const companies = editingUser.companies.includes(id)
      ? editingUser.companies.filter(c => c !== id)
      : [...editingUser.companies, id];
    setEditingUser(e => e ? ({ ...e, companies }) : null);
  };

  const toggleEditPerm = (key: string) => {
    setEditingUser(e => e ? ({
      ...e,
      permissions: { ...(e.permissions || {}), [key]: (e.permissions?.[key]) ? 0 : 1 },
    }) : null);
  };

  const setEditRole = (role: string) => {
    setEditingUser(e => e ? ({
      ...e, role,
      permissions: { ...(ROLE_PERM_PRESETS[role] || {}) },
    }) : null);
  };

  const handleLogoFile = (companyId: string, file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast_(tr("❌ حجم الصورة كبير جداً (الحد 2MB)"), "err"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const b64 = e.target?.result as string;
      localStorage.setItem(`tw_logo_${companyId}`, b64);
      setLogos(prev => ({ ...prev, [companyId]: b64 }));
      toast_(tr("✅ تم رفع الشعار بنجاح"));
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = (companyId: string) => {
    localStorage.removeItem(`tw_logo_${companyId}`);
    setLogos(prev => { const n = { ...prev }; delete n[companyId]; return n; });
    toast_(tr("🗑️ تم حذف الشعار"), "warn");
  };

  const TABS = [
    { id:"users", label:tr("👥 المستخدمون") },
    { id:"subscriptions", label:tr("💳 الاشتراكات") },
    { id:"logos", label:tr("🏢 شعارات الشركات") },
    { id:"resend", label:tr("📧 بريد Resend") },
  ];

  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:2500,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",
      fontFamily:"'Cairo','Tajawal',sans-serif",direction:appDir(),
    }} onClick={onClose}>
      <div style={{
        background:"var(--ia-chip)",borderRadius:"18px",width:"100%",maxWidth:"820px",
        maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",
        boxShadow:"0 24px 64px rgba(0,0,0,.4)",
      }} onClick={e=>e.stopPropagation()}>

        <div style={{background:"#1e3a5f",padding:"16px 22px",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
            <div>
              <div style={{color:"#fff",fontWeight:900,fontSize:"17px"}}>{tr("⚙️ لوحة إدارة النظام")}</div>
              <div style={{color:"rgba(255,255,255,.5)",fontSize:"12px",marginTop:"2px"}}>{tr("الشركة القابضة المتحدة ذ.م.م")}</div>
            </div>
            <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
              {activeTab==="users"&&(
                <button onClick={()=>setShowCreate(true)} style={{background:"#2563eb",border:"none",borderRadius:"8px",padding:"8px 16px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>{tr("➕ موظف جديد")}</button>
              )}
              {user?.email===MASTER_EMAIL&&activeTab==="users"&&!seedDone&&(
                <button onClick={handleSeed} disabled={seeding} style={{
                  background:seeding?"#374151":"#7c3aed",border:"none",borderRadius:"8px",
                  padding:"8px 14px",color:"#fff",fontFamily:"inherit",fontSize:"12px",
                  fontWeight:700,cursor:seeding?"not-allowed":"pointer",opacity:seeding?.7:1,
                }}>
                  {seeding?tr("⏳ جارٍ الإنشاء..."):tr("🚀 تفعيل الحسابات الـ5")}
                </button>
              )}
              <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:"8px",padding:"8px 14px",color:"#fff",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>{tr("✕ إغلاق")}</button>
            </div>
          </div>
          <div style={{display:"flex",gap:"4px"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
                background:activeTab===t.id?"#fff":"rgba(255,255,255,.12)",
                color:activeTab===t.id?"#1e3a5f":"rgba(255,255,255,.8)",
                border:"none",borderRadius:"8px 8px 0 0",padding:"7px 16px",
                fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer",transition:"all .15s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {toast&&(
          <div style={{position:"fixed",top:"70px",left:"50%",transform:"translateX(-50%)",zIndex:9999,
            background:toast.type==="warn"?"#f59e0b":toast.type==="err"?"#dc2626":"#16a34a",
            color:"#fff",padding:"8px 20px",borderRadius:"50px",fontWeight:700,fontSize:"13px",boxShadow:"0 4px 16px rgba(0,0,0,.2)",
          }}>{toast.msg}</div>
        )}

        <div style={{overflowY:"auto",flex:1,padding:"16px"}}>

          {activeTab==="users"&&(
            loading?(
              <div style={{textAlign:"center",padding:"48px",color:"var(--ia-sub)"}}>
                <div style={{fontSize:"36px",marginBottom:"10px"}}>⏳</div>{tr("جارٍ تحميل المستخدمين...")}
              </div>
            ):loadErr?(
              <div style={{background:"var(--ia-red-bg)",border:"1px solid var(--ia-red-bd)",borderRadius:"12px",padding:"20px 24px",color:"var(--ia-red-tx)",fontSize:"13px",lineHeight:1.7}}>
                <div style={{fontWeight:800,fontSize:"15px",marginBottom:"8px"}}>{tr("❌ فشل تحميل المستخدمين")}</div>
                <div style={{marginBottom:"16px"}}>{loadErr}</div>
                <button onClick={loadUsers} style={{background:"#b91c1c",color:"#fff",border:"none",borderRadius:"8px",padding:"8px 18px",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>{tr("🔄 إعادة المحاولة")}</button>
              </div>
            ):users.length===0?(
              <div style={{textAlign:"center",padding:"48px",color:"var(--ia-muted)"}}>
                <div style={{fontSize:"40px",marginBottom:"10px"}}>👥</div>
                <div style={{fontWeight:600,marginBottom:"14px"}}>{tr("لا يوجد موظفون مسجلون بعد")}</div>
                <button onClick={()=>setShowCreate(true)} style={{background:"#1e3a5f",color:"#fff",border:"none",borderRadius:"8px",padding:"10px 20px",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>{tr("➕ أضف أول موظف")}</button>
              </div>
            ):(
              <div style={{display:"grid",gap:"10px"}}>
                {users.map(u=>(
                  <div key={u.uid} style={{background:"var(--ia-card)",borderRadius:"12px",padding:"16px 18px",border:"1px solid var(--ia-border)",boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>
                    {editingUser?.uid===u.uid?(
                      <div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"12px"}}>
                          <div>
                            <label style={lbl}>{tr("الاسم")}</label>
                            <input style={inp} value={editingUser.displayName||""}
                              onChange={e=>setEditingUser(ev=>ev?({...ev,displayName:e.target.value}):null)}/>
                          </div>
                          <div>
                            <label style={lbl}>{tr("نوع الصلاحية")}</label>
                            <select style={inp} value={editingUser.role} onChange={e=>setEditRole(e.target.value)}>
                              <option value="viewer">{tr("عرض فقط 👁️")}</option>
                              <option value="employee">{tr("موظف طلبات 👤")}</option>
                              <option value="editor">{tr("وصول كامل ✏️")}</option>
                            </select>
                          </div>
                        </div>

                        <div style={{marginBottom:"12px"}}>
                          <label style={lbl}>{tr("الشركات")}</label>
                          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                            {COMPANY_IDS.map((id: string)=>{
                              const active=editingUser.companies.includes(id);
                              return(
                                <div key={id} onClick={()=>toggleEditCompany(id)} style={{
                                  border:`2px solid `,
                                  borderRadius:"8px",padding:"5px 12px",cursor:"pointer",
                                  background:active?"var(--ia-blue-bg)":"var(--ia-row-alt)",fontSize:"12px",
                                  fontWeight:active?700:400,color:active?"var(--ia-blue-tx)":"var(--ia-sub)",
                                }}>{labelOf(id)}</div>
                              );
                            })}
                          </div>
                        </div>

                        {editingUser.role==="employee"&&(
                          <div style={{background:"var(--ia-vio-bg)",borderRadius:"10px",padding:"12px 14px",border:"1.5px solid var(--ia-vio-bd)",marginBottom:"12px"}}>
                            <div style={{fontSize:"11px",fontWeight:800,color:"var(--ia-vio-tx)",letterSpacing:".5px",marginBottom:"10px"}}>{tr("⚙️ الصلاحيات التفصيلية")}</div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px"}}>
                              {PERM_LIST.map(p=>{
                                const active=!!(editingUser.permissions?.[p.key]??EMPLOYEE_DEFAULTS[p.key]);
                                return(
                                  <div key={p.key} onClick={()=>toggleEditPerm(p.key)} style={{
                                    display:"flex",alignItems:"center",gap:"7px",padding:"6px 9px",
                                    borderRadius:"7px",cursor:"pointer",
                                    background:active?"var(--ia-vio-bg)":"var(--ia-card)",
                                    border:`1.5px solid `,
                                    transition:"all .12s",
                                  }}>
                                    <div style={{width:"14px",height:"14px",borderRadius:"3px",border:`2px solid ${active?"#7c3aed":"#d1d5db"}`,background:active?"#7c3aed":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                      {active&&<span style={{color:"#fff",fontSize:"9px",fontWeight:900}}>✓</span>}
                                    </div>
                                    <span style={{fontSize:"11px",fontWeight:active?700:400,color:active?"var(--ia-vio-tx)":"var(--ia-sub)"}}>{p.icon} {p.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{marginTop:"8px",display:"flex",gap:"8px"}}>
                              <button onClick={()=>setEditingUser(e=>e?({...e,permissions:Object.fromEntries(PERM_LIST.map(p=>[p.key,1]))}):null)} style={{fontSize:"11px",color:"var(--ia-vio-tx)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>{tr("تفعيل الكل")}</button>
                              <span style={{color:"var(--ia-muted)"}}>|</span>
                              <button onClick={()=>setEditingUser(e=>e?({...e,permissions:Object.fromEntries(PERM_LIST.map(p=>[p.key,0]))}):null)} style={{fontSize:"11px",color:"var(--ia-red-tx)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>{tr("إلغاء الكل")}</button>
                            </div>
                          </div>
                        )}

                        <div style={{display:"flex",gap:"8px"}}>
                          <button onClick={handleSaveEdit} disabled={saving} style={{background:"#1e3a5f",color:"#fff",border:"none",borderRadius:"8px",padding:"8px 16px",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>
                            {saving?tr("جارٍ الحفظ..."):tr("💾 حفظ")}
                          </button>
                          <button onClick={()=>setEditingUser(null)} style={{background:"var(--ia-ghost-bg)",color:"var(--ia-text2)",border:"none",borderRadius:"8px",padding:"8px 14px",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>{tr("إلغاء")}</button>
                        </div>
                      </div>
                    ):(
                      <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                        <div style={{width:"44px",height:"44px",borderRadius:"50%",background:"var(--ia-blue-bg)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",flexShrink:0}}>
                          {u.role==="employee"?"👤":"👥"}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:"14px",color:"var(--ia-text)"}}>{u.displayName||u.email}</div>
                          <div style={{fontSize:"12px",color:"var(--ia-sub)",marginTop:"2px"}}>{u.email}</div>
                          <div style={{display:"flex",gap:"5px",marginTop:"6px",flexWrap:"wrap",alignItems:"center"}}>
                            {(()=>{
                              const r=ROLE_LABELS[u.role||"viewer"]||ROLE_LABELS.viewer;
                              return <span style={{background:r.bg,color:r.color,borderRadius:"20px",padding:"2px 10px",fontSize:"11px",fontWeight:700}}>{r.label}</span>;
                            })()}
                            {u.companies?.map(c=>(
                              <span key={c} style={{background:"var(--ia-sky-bg)",color:"var(--ia-sky-tx)",borderRadius:"20px",padding:"2px 10px",fontSize:"11px",fontWeight:600}}>{labelOf(c)}</span>
                            ))}
                            {u.role==="employee"&&(()=>{
                              const perms=u.permissions||EMPLOYEE_DEFAULTS;
                              const count=PERM_LIST.filter(p=>perms[p.key]).length;
                              return <span style={{background:"var(--ia-vio-bg)",color:"var(--ia-vio-tx)",border:"1px solid var(--ia-vio-bd)",borderRadius:"20px",padding:"2px 10px",fontSize:"11px",fontWeight:700}}>{count} {tr("صلاحية")}</span>;
                            })()}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:"6px",flexShrink:0}}>
                          <button onClick={()=>setEditingUser({
                            ...u,
                            companies: u.companies||[],
                            role: u.role||"viewer",
                            permissions: u.role==="employee" ? (u.permissions||{...EMPLOYEE_DEFAULTS}) : {...(ROLE_PERM_PRESETS[u.role||"viewer"]||{})},
                          })} style={{background:"var(--ia-blue-bg)",color:"var(--ia-blue-tx)",border:"none",borderRadius:"8px",padding:"7px 12px",fontFamily:"inherit",fontSize:"12px",fontWeight:700,cursor:"pointer"}}>{tr("✏️ تعديل")}</button>
                          <button onClick={()=>setDelConfirm(u)} style={{background:"var(--ia-red-bg)",color:"var(--ia-red-tx)",border:"none",borderRadius:"8px",padding:"7px 12px",fontFamily:"inherit",fontSize:"12px",fontWeight:700,cursor:"pointer"}}>🗑️</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab==="logos"&&(
            <div>
              <div style={{background:"var(--ia-card)",borderRadius:"12px",padding:"14px 18px",border:"1px solid var(--ia-border)",marginBottom:"14px",fontSize:"12px",color:"var(--ia-sub)",lineHeight:"1.7"}}>
                {tr("💡 ارفع شعار لكل شركة — سيظهر في الفواتير عند الطباعة والمعاينة. الحجم الأقصى 2MB.")}
              </div>
              <div style={{display:"grid",gap:"12px"}}>
                {COMPANIES_INFO.map(c=>(
                  <div key={c.id} style={{background:"var(--ia-card)",borderRadius:"14px",padding:"18px 20px",border:"1px solid var(--ia-border)",display:"flex",alignItems:"center",gap:"18px",boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>
                    <div style={{width:"80px",height:"80px",borderRadius:"12px",overflow:"hidden",border:`2px solid ${c.color}33`,background:"var(--ia-row-alt)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {logos[c.id]
                        ?<img src={logos[c.id]} alt={c.name} style={{width:"100%",height:"100%",objectFit:"contain"}}/>
                        :<div style={{width:"100%",height:"100%",background:c.color,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:"24px",fontWeight:900,lineHeight:1.2}}>
                          {c.emoji}<span style={{fontSize:"8px",fontWeight:700,opacity:.8,marginTop:"2px",letterSpacing:"1px"}}>{c.id.toUpperCase()}</span>
                        </div>
                      }
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:"15px",color:c.color,marginBottom:"3px"}}>{c.name}</div>
                      <div style={{fontSize:"11px",color:"var(--ia-muted)",marginBottom:"12px"}}>
                        {logos[c.id]?tr("✅ شعار مخصص مرفوع"):tr("⚪ لا يوجد شعار — يستخدم الشعار الافتراضي")}
                      </div>
                      <div style={{display:"flex",gap:"8px"}}>
                        <input type="file" accept="image/*" style={{display:"none"}} ref={el => { fileRefs.current[c.id] = el; }} onChange={e=>handleLogoFile(c.id,e.target.files?.[0]||null)}/>
                        <button onClick={()=>fileRefs.current[c.id]?.click()} style={{background:c.color,color:"#fff",border:"none",borderRadius:"8px",padding:"8px 16px",fontFamily:"inherit",fontSize:"12px",fontWeight:700,cursor:"pointer"}}>📤 {logos[c.id]?tr("تغيير الشعار"):tr("رفع شعار")}</button>
                        {logos[c.id]&&<button onClick={()=>removeLogo(c.id)} style={{background:"var(--ia-red-bg)",color:"var(--ia-red-tx)",border:"none",borderRadius:"8px",padding:"8px 12px",fontFamily:"inherit",fontSize:"12px",fontWeight:700,cursor:"pointer"}}>{tr("🗑️ حذف")}</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab==="subscriptions"&&(
            <SubscriptionsPanel toast_={toast_} />
          )}
          {activeTab==="resend"&&(
            <ResendPanel toast_={toast_} />
          )}
        </div>
      </div>

      {showCreate&&(
        <CreateUserModal
          onClose={()=>setShowCreate(false)}
          onCreated={()=>{ toast_(tr("✅ تم إنشاء المستخدم")); loadUsers(); }}
          companies={companies}
        />
      )}

      {delConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setDelConfirm(null)}>
          <div style={{background:"var(--ia-card)",borderRadius:"16px",padding:"28px 32px",textAlign:"center",maxWidth:"320px",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:"36px",marginBottom:"8px"}}>🗑️</div>
            <div style={{fontWeight:700,fontSize:"15px",marginBottom:"6px"}}>{tr("تأكيد الحذف")}</div>
            <div style={{color:"var(--ia-sub)",fontSize:"13px",marginBottom:"18px"}}>{tr("سيتم حذف سجل")} <b>{delConfirm.displayName||delConfirm.email}</b> {tr("نهائياً")}</div>
            <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
              <button onClick={()=>handleDelete(delConfirm.uid)} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:"8px",padding:"9px 20px",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>{tr("نعم، احذف")}</button>
              <button onClick={()=>setDelConfirm(null)} style={{background:"var(--ia-ghost-bg)",color:"var(--ia-text2)",border:"none",borderRadius:"8px",padding:"9px 16px",fontFamily:"inherit",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>{tr("إلغاء")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize:"11px",color:"var(--ia-sub)",display:"block",marginBottom:"4px",fontWeight:700 };
const inp: React.CSSProperties = { width:"100%",border:"1.5px solid var(--ia-border2)",borderRadius:"8px",padding:"9px 12px",fontFamily:"'Cairo','Tajawal',sans-serif",fontSize:"13px",background:"var(--ia-card)",outline:"none" };
