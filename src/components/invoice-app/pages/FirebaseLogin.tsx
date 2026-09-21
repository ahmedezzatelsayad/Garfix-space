"use client";

import { useState, useEffect } from "react";
import { loginUser, registerUser, requestPasswordReset, fetchFreeSeats } from "../firebase/auth";
import { useTheme } from "../theme";
import {
  AlertCircle, ArrowRight, Check, Eye, EyeOff, Gift, Loader2,
  LogIn, Moon, Send, ShieldCheck, Sparkles, Sun,
} from "lucide-react";
import { useI18n, LanguageSwitcher } from "@/lib/i18n-context";
import { tr } from "@/lib/i18n-app";
import { LogoMark, fxFromUsd } from "@/components/site/site-shared";
import HeroDashboardMockup from "@/components/site/HeroDashboardMockup";

/**
 * r24: صفحة الدخول تحوّلت إلى «بوابة SaaS»:
 *  - يسار: نموذج الدخول/التسجيل/الاستعادة (كل المنطق الأصلي محفوظ).
 *  - يمين: معاينة حية للوحة GarfiX (موكاب بعملة قابلة للتبديل) + نقاط ثقة.
 *  - أعلى: اللغة + العملة + السمة. أسفل: شريط «مجاني لأول 100 شركة».
 *  - #/login?mode=register يفتح تبويب التسجيل مباشرة (زر «ابدأ مجاناً» باللاندينج).
 */
type Mode = "login" | "register" | "forgot";

const QUICK_CURRENCIES = ["USD", "KWD", "EUR"];

export default function FirebaseLogin() {
  const { t, dir, lang } = useI18n(); // الدخول بلغات العالم (يُغذّى من LangProvider في PublicSite)
  const [mode, setMode] = useState<Mode>(() =>
    typeof window !== "undefined" && /mode=register/i.test(window.location.hash || "") ? "register" : "login"
  );
  const [email,    setEmail]    = useState("");
  const [pass,     setPass]     = useState("");
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [pass2,    setPass2]    = useState("");
  const [err,      setErr]      = useState("");
  const [okMsg,    setOkMsg]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [seats,    setSeats]    = useState<{ registered: number; limit: number; remaining: number; freeOpen: boolean } | null>(null);
  const [cur, setCur] = useState("USD"); // عملة المعاينة الحية
  const [siteLogo, setSiteLogo] = useState(""); // r26: شعار الموقع المخصص (إن وُجد)
  const [sessionExpired, setSessionExpired] = useState(false); // r19/r29: بانر انتهاء الجلسة (مرة واحدة)
  const { dark, toggle } = useTheme();

  // عدّاد المقاعد المجانية المتبقية + شعار الموقع من إدارة المحتوى
  useEffect(() => {
    let alive = true;
    fetchFreeSeats().then(s => alive && setSeats(s)).catch(() => {});
    fetch("/api/site/content")
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j?.content?.site_logo) setSiteLogo(String(j.content.site_logo)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // r19 (أُعيد تطبيقه في r29): شريط كهرماني لمرة واحدة بعد الخروج التلقائي من انتهاء
  // جلسة الخادم — يُضبط من AuthContext (garfix_session_expired) ويُمسح بعد العرض.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("garfix_session_expired") === "1") {
        setSessionExpired(true);
        sessionStorage.removeItem("garfix_session_expired");
      }
    } catch { /* sessionStorage محجوب */ }
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m); setErr(""); setOkMsg("");
  };

  const doLogin = async () => {
    if (!email || !pass) return;
    setLoading(true); setErr(""); setOkMsg("");
    try {
      await loginUser(email.trim(), pass);
    } catch (e: any) {
      const msgs: Record<string, string> = {
        "auth/user-not-found":     tr("البريد الإلكتروني غير مسجل"),
        "auth/wrong-password":     tr("كلمة المرور غلط"),
        "auth/invalid-credential": tr("الإيميل أو الباسورد غلط"),
        "auth/too-many-requests":  tr("محاولات كثيرة، حاول بعد قليل"),
        "auth/invalid-email":      tr("صيغة الإيميل غير صحيحة"),
      };
      setErr(e.serverMessage || msgs[e.code] || tr("خطأ: {0}",[e.code || e.message]));
      setLoading(false);
    }
  };

  const doRegister = async () => {
    if (!name.trim() || !email.trim() || !pass || !pass2) {
      setErr(tr("أكمل كل الحقول المطلوبة")); return;
    }
    if (pass !== pass2) {
      setErr(tr("كلمتا المرور غير متطابقتين")); return;
    }
    setLoading(true); setErr(""); setOkMsg("");
    try {
      const { remaining } = await registerUser({
        displayName: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password: pass,
      });
      // نجاح — المستخدم دخل التطبيق مباشرة (registerUser يبني الجلسة محلياً)
      setOkMsg(tr("تم إنشاء حسابك بنجاح{0}",[typeof remaining === "number" ? tr(" — متبقي {0} مقعداً مجانياً",[remaining]) : ""]));
    } catch (e: any) {
      setErr(e.message || tr("تعذر إنشاء الحساب"));
      setSeats(null);
      fetchFreeSeats().then(s => setSeats(s)).catch(() => {});
      setLoading(false);
    }
  };

  const doForgot = async () => {
    if (!email.trim()) { setErr(tr("أدخل بريدك الإلكتروني")); return; }
    setLoading(true); setErr(""); setOkMsg("");
    try {
      const message = await requestPasswordReset(email.trim());
      setOkMsg(message);
    } catch (e: any) {
      setErr(e.message || tr("تعذر إرسال رسالة الاستعادة"));
    } finally {
      setLoading(false);
    }
  };

  const submitBtn = (disabled: boolean, onClick: () => void, icon: React.ReactNode, label: string) => (
    <button onClick={onClick} disabled={disabled} style={{
      width:"100%",border:"none",borderRadius:12,padding:"13px",
      background:disabled?"rgba(255,255,255,.06)":"linear-gradient(135deg,#d4af37,#9a7318)",
      color:disabled?"rgba(255,255,255,.25)":"#fff",
      fontFamily:"inherit",fontSize:14.5,fontWeight:800,
      cursor:disabled?"not-allowed":"pointer",
      boxShadow:disabled?"none":"0 6px 22px rgba(201,162,39,.45)",
      letterSpacing:".5px",transition:"all .2s",
      display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,
    }}>
      {loading ? <Loader2 size={16} className="g-spin" aria-hidden="true" /> : icon} {loading ? "…" : label}
    </button>
  );

  const field = (label: string, id: string, children: React.ReactNode) => (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={{ fontSize: 11, color: "rgba(201,162,39,.8)", display: "block", marginBottom: 7, fontWeight: 700, letterSpacing: ".6px" }}>{label}</label>
      {children}
    </div>
  );

  const msgBox = (text: string, ok: boolean) => (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      background: ok ? "rgba(22,163,74,.1)" : "rgba(220,38,38,.1)",
      border: `1px solid ${ok ? "rgba(22,163,74,.28)" : "rgba(220,38,38,.28)"}`,
      borderRadius: 10, padding: "9px 14px", color: ok ? "#86efac" : "#fca5a5",
      fontSize: 12, marginBottom: 14, lineHeight: 1.8,
    }}>
      {ok ? <Check size={14} style={{ marginTop: 3, flexShrink: 0 }} aria-hidden="true" /> : <AlertCircle size={14} style={{ marginTop: 3, flexShrink: 0 }} aria-hidden="true" />}
      <span>{text}</span>
    </div>
  );

  const TAB: Record<Mode, string> = { login: t("login.signIn"), register: t("login.signUp"), forgot: t("login.forgot") };

  const trustPoints = [
    tr("مجاني لأول 100 شركة — بلا بطاقة"),
    tr("27 لغة وأي عملة لكل شركة"),
    tr("فواتير PDF عربية كاملة"),
    tr("مساعد ذكي ينفّذ بعد مراجعتك"),
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(150deg,#07111f 0%,#0b1e3a 45%,#070e1c 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter','Cairo','Tajawal',sans-serif", direction: dir,
      padding: "76px 20px 28px", position: "relative", overflow: "hidden", gap: 18,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Tajawal:wght@300;400;500;700;800&family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box}
        .g-inp{width:100%;background:rgba(255,255,255,.05);border:1.5px solid rgba(201,162,39,.25);border-radius:11px;padding:13px 16px;color:#fff;font-family:inherit;font-size:14px;outline:none;transition:all .2s;}
        .g-inp::placeholder{color:rgba(255,255,255,.28);}
        .g-inp:focus{border-color:#c9a227;background:rgba(201,162,39,.07);box-shadow:0 0 0 3px rgba(201,162,39,.1);}
        .g-spin{animation:gSpin 1s linear infinite}
        @keyframes gSpin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @media(max-width:960px){.g-preview{display:none!important}}
        @media(max-width:560px){.g-curbar{display:none!important}}
      `}</style>

      {/* خلفية زخرفية */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-15%",right:"-8%",width:"480px",height:"480px",background:"radial-gradient(circle,rgba(201,162,39,.08) 0%,transparent 70%)",borderRadius:"50%"}}/>
        <div style={{position:"absolute",bottom:"-20%",left:"-8%",width:"400px",height:"400px",background:"radial-gradient(circle,rgba(37,99,235,.07) 0%,transparent 70%)",borderRadius:"50%"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.012) 1px,transparent 1px)",backgroundSize:"56px 56px"}}/>
      </div>

      {/* الشريط العلوي: عودة + لغة + عملة + سمة */}
      <div style={{position:"fixed",top:0,insetInline:0,zIndex:20,display:"flex",alignItems:"center",gap:10,padding:"14px 18px",background:"linear-gradient(180deg,rgba(7,17,31,.92),rgba(7,17,31,0))"}}>
        <a
          href="#/"
          onClick={(e)=>{e.preventDefault();location.hash="#/";}}
          style={{
            display:"inline-flex",alignItems:"center",gap:7,
            background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.14)",
            borderRadius:10,padding:"7px 13px",color:"#fff",textDecoration:"none",
            fontSize:12.5,fontWeight:700,flexShrink:0,
          }}
        >
          <ArrowRight size={14} aria-hidden="true" style={{transform:dir==="rtl"?"none":"scaleX(-1)"}} /> {t("nav.home")}
        </a>
        <span style={{flex:1}} />
        <div className="g-curbar" style={{display:"flex",gap:4,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,padding:3}}>
          {QUICK_CURRENCIES.map((c) => (
            <button key={c} type="button" onClick={() => setCur(c)} style={{
              border:"none",borderRadius:8,padding:"5px 10px",fontFamily:"'Inter',sans-serif",
              fontSize:11,fontWeight:800,cursor:"pointer",transition:"all .18s",
              background:cur===c?"linear-gradient(135deg,#c9a227,#9a7318)":"transparent",
              color:cur===c?"#fff":"rgba(255,255,255,.5)",
            }}>{c}</button>
          ))}
        </div>
        <LanguageSwitcher compact />
        <button onClick={toggle} title={dark?tr("التبديل إلى الوضع النهاري"):tr("التبديل إلى الوضع الليلي")} aria-label={tr("تبديل السمة")} type="button" style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.14)",borderRadius:10,padding:"7px 11px",cursor:"pointer",display:"inline-flex",alignItems:"center",color:dark?"#e5c558":"rgba(255,255,255,.75)"}}>
          {dark ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
        </button>
      </div>

      {/* البوابة: نموذج + معاينة */}
      <div style={{
        width:"100%",maxWidth:1020,display:"flex",gap:34,alignItems:"center",justifyContent:"center",
        flexWrap:"wrap",animation:"fadeUp .55s ease",position:"relative",
      }}>
        {/* ── يسار/يمين حسب اللغة: النموذج ── */}
        <div style={{width:"100%",maxWidth:430,order:1}}>
          {/* r19/r29: بانر انتهاء الجلسة — لمرة واحدة بعد الخروج التلقائي */}
          {sessionExpired && (
            <div role="alert" style={{
              display:"flex",alignItems:"flex-start",gap:9,
              background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.4)",
              borderRadius:12,padding:"11px 15px",color:"#fbbf24",
              fontSize:12.5,fontWeight:700,lineHeight:1.8,marginBottom:16,
              animation:"fadeUp .4s ease both",
            }}>
              <span aria-hidden="true" style={{fontSize:15,lineHeight:1.4}}>⌛</span>
              <span>{tr("انتهت جلستك على الخادم — سجّل الدخول من جديد")}</span>
            </div>
          )}
          {/* رأس البوابة — التموضع الجديد */}
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",position:"relative",animation:"float 4s ease-in-out infinite"}}>
              <LogoMark size={74} radius={22} fontSize={38} src={siteLogo || undefined} />
            </div>
            <div style={{color:"rgba(201,162,39,.75)",fontSize:10,fontWeight:800,letterSpacing:3,textTransform:"uppercase",marginBottom:9,fontFamily:"'Inter',sans-serif"}}>
              AI BUSINESS OS
            </div>
            <div style={{color:"#fff",fontSize:22,fontWeight:900,lineHeight:1.3,marginBottom:6,textShadow:"0 2px 20px rgba(201,162,39,.15)"}}>
              {mode === "register" ? tr("أنشئ شركتك الآن") : mode === "forgot" ? t("login.forgotTitle") : tr("أهلاً بك مجدداً")}
            </div>
            <div style={{color:"rgba(255,255,255,.5)",fontSize:12.5,fontWeight:600}}>
              {tr("لوحة واحدة للفواتير والعملاء والتحصيل — بأي عملة وبلغتك")}
            </div>
          </div>

          <div style={{
            background:"rgba(255,255,255,.04)",backdropFilter:"blur(24px)",
            borderRadius:"20px",border:"1px solid rgba(201,162,39,.18)",
            boxShadow:"0 24px 64px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.07)",
            padding:"24px 24px",
          }}>
            {/* مبدّل الوضع: دخول / تسجيل */}
            {mode !== "forgot" && (
              <div style={{display:"flex",gap:4,background:"rgba(255,255,255,.05)",borderRadius:11,padding:4,marginBottom:18}}>
                {(["login","register"] as Mode[]).map(m => (
                  <button key={m} type="button" onClick={()=>switchMode(m)} style={{
                    flex:1, border:"none", borderRadius:9, padding:"9px 10px", fontFamily:"inherit",
                    fontSize:13, fontWeight:800, cursor:"pointer", transition:"all .2s",
                    display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,
                    background: mode===m ? "linear-gradient(135deg,#c9a227,#9a7318)" : "transparent",
                    color: mode===m ? "#fff" : "rgba(255,255,255,.55)",
                    boxShadow: mode===m ? "0 4px 14px rgba(201,162,39,.35)" : "none",
                  }}>
                    {m==="login" ? <LogIn size={14} aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
                    {m==="login" ? t("login.signIn") : t("login.signUp")}
                  </button>
                ))}
              </div>
            )}

            {mode === "forgot" ? (
              <>
                <p style={{color:"rgba(255,255,255,.55)",fontSize:12.5,lineHeight:1.9,margin:"0 0 18px",textAlign:"center"}}>
                  {t("login.forgotHint")}
                </p>
                {field(t("login.email"), "gw-forgot-email",
                  <input id="gw-forgot-email" className="g-inp" type="email" placeholder="example@company.com"
                    value={email} onChange={e=>{setEmail(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&doForgot()}/>)}
                {err && msgBox(err, false)}
                {okMsg && msgBox(okMsg, true)}
                {submitBtn(loading||!email, doForgot, <Send size={15} aria-hidden="true" />, t("login.send"))}
                <button type="button" onClick={()=>switchMode("login")} style={{
                  width:"100%",marginTop:12,background:"none",border:"none",color:"rgba(255,255,255,.5)",
                  fontFamily:"inherit",fontSize:12.5,fontWeight:700,cursor:"pointer",
                }}>{`← ${t("login.back")}`}</button>
              </>
            ) : mode === "register" ? (
              <>
                {field(`${t("login.name")} *`, "gw-reg-name",
                  <input id="gw-reg-name" className="g-inp" placeholder={tr("أحمد محمد")} value={name}
                    onChange={e=>{setName(e.target.value);setErr("");}}/>)}
                {field(`${t("login.email")} *`, "gw-reg-email",
                  <input id="gw-reg-email" className="g-inp" type="email" placeholder="example@company.com" value={email}
                    onChange={e=>{setEmail(e.target.value);setErr("");}}/>)}
                {field(t("login.phone"), "gw-reg-phone",
                  <input id="gw-reg-phone" className="g-inp" type="tel" dir="ltr" style={{textAlign:"start"}} placeholder="+965 9XXX XXXX" value={phone}
                    onChange={e=>{setPhone(e.target.value);setErr("");}}/>)}
                {field(`${t("login.password")} *`, "gw-reg-pass",
                  <div style={{position:"relative"}}>
                    <input id="gw-reg-pass" className="g-inp" type={showPass?"text":"password"} placeholder="••••••••••" value={pass}
                      onChange={e=>{setPass(e.target.value);setErr("");}} style={{paddingInlineEnd:"42px"}}/>
                    <button type="button" onClick={()=>setShowPass(p=>!p)} aria-label={tr("إظهار كلمة المرور")} style={{position:"absolute",insetInlineEnd:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"rgba(255,255,255,.4)",cursor:"pointer",display:"inline-flex"}}>
                      {showPass ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>)}
                {field(`${t("login.password")} *`, "gw-reg-pass2",
                  <input id="gw-reg-pass2" className="g-inp" type={showPass?"text":"password"} placeholder="••••••••••" value={pass2}
                    onChange={e=>{setPass2(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&doRegister()}/>)}
                {err && msgBox(err, false)}
                {okMsg && msgBox(okMsg, true)}
                {submitBtn(
                  loading||!name||!email||!pass||!pass2||(!!seats && !seats.freeOpen),
                  doRegister,
                  <Sparkles size={15} aria-hidden="true" />,
                  seats&&!seats.freeOpen ? t("pricing.seatsFull") : t("login.signUp")
                )}
                <p style={{color:"rgba(255,255,255,.35)",fontSize:11.5,margin:"13px 0 0",textAlign:"center",lineHeight:1.8}}>
                  {tr("بإنشائك الحساب ستحصل على شركة خاصة بك بعد أول دخول — فواتير وعملاء وتقارير بلا أي تكلفة")}
                </p>
              </>
            ) : (
              <>
                {field(t("login.email"), "gw-login-email",
                  <input id="gw-login-email" className="g-inp" type="email" placeholder="example@company.com"
                    value={email} onChange={e=>{setEmail(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&doLogin()}/>)}
                {field(t("login.password"), "gw-login-pass",
                  <div style={{position:"relative"}}>
                    <input id="gw-login-pass" className="g-inp" type={showPass?"text":"password"} placeholder="••••••••••"
                      value={pass} onChange={e=>{setPass(e.target.value);setErr("");}}
                      onKeyDown={e=>e.key==="Enter"&&doLogin()} style={{paddingInlineEnd:"42px"}}/>
                    <button type="button" onClick={()=>setShowPass(p=>!p)} aria-label={tr("إظهار كلمة المرور")} style={{position:"absolute",insetInlineEnd:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"rgba(255,255,255,.4)",cursor:"pointer",display:"inline-flex"}}>
                      {showPass ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>)}
                <div style={{textAlign:"end",marginBottom:16}}>
                  <button type="button" onClick={()=>switchMode("forgot")} style={{
                    background:"none",border:"none",color:"rgba(201,162,39,.75)",fontFamily:"inherit",
                    fontSize:11.5,fontWeight:700,cursor:"pointer",padding:0,
                  }}>{t("login.forgot")}</button>
                </div>
                {err && msgBox(err, false)}
                {submitBtn(loading||!email||!pass, doLogin, <LogIn size={15} aria-hidden="true" />, t("login.signIn"))}
              </>
            )}
          </div>

          {/* أسفل النموذج: مجاني لأول 100 شركة (عدّاد حي) */}
          {seats && mode !== "forgot" && (
            <div style={{
              display:"flex",alignItems:"center",gap:10,justifyContent:"center",flexWrap:"wrap",
              marginTop:16,padding:"11px 16px",borderRadius:14,
              background: seats.freeOpen ? "rgba(201,162,39,.09)" : "rgba(220,38,38,.09)",
              border:`1px solid ${seats.freeOpen ? "rgba(201,162,39,.3)" : "rgba(220,38,38,.28)"}`,
            }}>
              <Gift size={16} color={seats.freeOpen ? "#e5c558" : "#fca5a5"} aria-hidden="true" />
              {seats.freeOpen ? (
                <span style={{color:"#e5c558",fontSize:12.5,fontWeight:800,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
                  {tr("مجاناً لأول")} {seats.limit} {tr("شركة")}
                  <span style={{color:"rgba(255,255,255,.55)",fontWeight:700}}>
                    {tr("— متبقي")} <b className="s-num" style={{color:"#e5c558",fontSize:13.5}}>{seats.remaining}</b> {tr("مقعداً")}
                  </span>
                </span>
              ) : (
                <span style={{color:"#fca5a5",fontSize:12.5,fontWeight:800}}>
                  {tr("انتهت المقاعد المجانية (")}{seats.limit}/{seats.limit})
                </span>
              )}
              <span style={{width:54,height:5,borderRadius:4,overflow:"hidden",background:"rgba(255,255,255,.12)",position:"relative",flexShrink:0}} aria-hidden="true">
                <span style={{
                  position:"absolute",insetInlineEnd:0,top:0,bottom:0,
                  width:`${seats.freeOpen ? ((seats.limit - seats.remaining) / seats.limit) * 100 : 100}%`,
                  background: seats.freeOpen ? "linear-gradient(90deg,#c9a227,#e5c558)" : "#dc2626",
                  borderRadius:4,transition:"width .5s ease",display:"block",
                }}/>
              </span>
            </div>
          )}
        </div>

        {/* ── الجانب الآخر: المعاينة الحية ── */}
        <div className="g-preview" style={{flex:1,minWidth:300,maxWidth:520,order:2}}>
          <div style={{marginBottom:16,textAlign:"center"}}>
            <span className="s-chip" style={{fontSize:11.5}}>
              <Sparkles size={13} aria-hidden="true" /> {tr("معاينة حية — هكذا ستبدو لوحتك")}
            </span>
          </div>
          <HeroDashboardMockup currency={cur} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginTop:18,maxWidth:520}}>
            {trustPoints.map((p) => (
              <div key={p} style={{
                display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:700,color:"rgba(255,255,255,.72)",
                background:"rgba(255,255,255,.035)",border:"1px solid rgba(255,255,255,.09)",borderRadius:12,padding:"9px 12px",
              }}>
                <Check size={13} color="#34d399" strokeWidth={3} aria-hidden="true" style={{flexShrink:0}} />
                {p}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* تذييل البوابة */}
      <div style={{textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:10.5,letterSpacing:1,display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",justifyContent:"center",fontFamily:"'Inter','Cairo',sans-serif"}}>
        <ShieldCheck size={12} aria-hidden="true" />
        <span>SECURE AUTHENTICATION · GarfiX — AI BUSINESS OS</span>
        <span className="s-num" style={{color:"rgba(229,197,88,.55)",fontWeight:700}}>
          {fxFromUsd(10, cur, lang)} {tr("شهرياً لكل شركة — بعد أول 100 شركة مجاناً")}
        </span>
      </div>
    </div>
  );
}
