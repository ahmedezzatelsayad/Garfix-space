"use client";

import { useState, useEffect } from "react";
import { loginUser, registerUser, requestPasswordReset, fetchFreeSeats } from "../firebase/auth";
import { useTheme } from "../theme";
import { useI18n, LanguageSwitcher } from "@/lib/i18n-context";

/**
 * r16: صفحة الدخول الشاملة:
 *  - تسجيل الدخول (الحسابات المدمجة + المشتركين المسجّلين من الخادم)
 *  - إنشاء حساب جديد — «🎁 مجاناً لأول 100 مشترك» مع عدّاد المقاعد المتبقية
 *  - «هل نسيت كلمة السر؟» — بريد استعادة عبر Resend (المفتاح من لوحة المؤسس)
 */
type Mode = "login" | "register" | "forgot";

export default function FirebaseLogin() {
  const { t, dir, lang } = useI18n(); // r18: الدخول بلغات العالم (يُغذّى من LangProvider في PublicSite)
  const [mode, setMode] = useState<Mode>("login");
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
  const { dark, toggle } = useTheme();

  // عدّاد المقاعد المجانية المتبقية (يظهر بشارة حيّة)
  useEffect(() => {
    let alive = true;
    fetchFreeSeats().then(s => alive && setSeats(s)).catch(() => {});
    return () => { alive = false; };
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
        "auth/user-not-found":     "البريد الإلكتروني غير مسجل",
        "auth/wrong-password":     "كلمة المرور غلط",
        "auth/invalid-credential": "الإيميل أو الباسورد غلط",
        "auth/too-many-requests":  "محاولات كثيرة، حاول بعد قليل",
        "auth/invalid-email":      "صيغة الإيميل غير صحيحة",
      };
      setErr(e.serverMessage || msgs[e.code] || `خطأ: ${e.code || e.message}`);
      setLoading(false);
    }
  };

  const doRegister = async () => {
    if (!name.trim() || !email.trim() || !pass || !pass2) {
      setErr("أكمل كل الحقول المطلوبة"); return;
    }
    if (pass !== pass2) {
      setErr("كلمتا المرور غير متطابقتين"); return;
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
      setOkMsg(`🎉 تم إنشاء حسابك بنجاح${typeof remaining === "number" ? ` — متبقي ${remaining} مقعداً مجانياً` : ""}`);
    } catch (e: any) {
      setErr(e.message || "تعذر إنشاء الحساب");
      setSeats(null);
      fetchFreeSeats().then(s => setSeats(s)).catch(() => {});
      setLoading(false);
    }
  };

  const doForgot = async () => {
    if (!email.trim()) { setErr("أدخل بريدك الإلكتروني"); return; }
    setLoading(true); setErr(""); setOkMsg("");
    try {
      const message = await requestPasswordReset(email.trim());
      setOkMsg(`📧 ${message}`);
    } catch (e: any) {
      setErr(e.message || "تعذر إرسال رسالة الاستعادة");
    } finally {
      setLoading(false);
    }
  };

  const freeBadge = seats && mode !== "forgot" && (
    <div style={{
      display: "flex", alignItems: "center", gap: 9, justifyContent: "center",
      background: seats.freeOpen ? "rgba(201,162,39,.1)" : "rgba(220,38,38,.1)",
      border: `1px solid ${seats.freeOpen ? "rgba(201,162,39,.35)" : "rgba(220,38,38,.3)"}`,
      borderRadius: 10, padding: "9px 14px", marginBottom: 16, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 16 }}>🎁</span>
      {seats.freeOpen ? (
        <span style={{ color: "#e5c558", fontSize: 12.5, fontWeight: 800 }}>
          مجاناً لأول {seats.limit} مشترك
          <span style={{ color: "rgba(255,255,255,.55)", fontWeight: 700, marginInlineStart: 8 }}>
            — متبقي {seats.remaining} مقعداً
          </span>
        </span>
      ) : (
        <span style={{ color: "#fca5a5", fontSize: 12.5, fontWeight: 800 }}>
          انتهت المقاعد المجانية ({seats.limit}/{seats.limit})
        </span>
      )}
      <span style={{
        width: 44, height: 5, borderRadius: 4, overflow: "hidden",
        background: "rgba(255,255,255,.12)", position: "relative", flexShrink: 0,
      }}>
        <span style={{
          position: "absolute", insetInlineEnd: 0, top: 0, bottom: 0,
          width: `${seats.freeOpen ? ((seats.limit - seats.remaining) / seats.limit) * 100 : 100}%`,
          background: seats.freeOpen ? "linear-gradient(90deg,#c9a227,#e5c558)" : "#dc2626",
          borderRadius: 4, transition: "width .5s ease",
        }} />
      </span>
    </div>
  );

  const TAB: Record<Mode, string> = { login: t("login.signIn"), register: t("login.signUp"), forgot: t("login.forgot") };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(150deg,#06111f 0%,#0d1e35 45%,#070e1c 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Cairo','Tajawal',sans-serif", direction: dir,
      padding: "20px", position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Tajawal:wght@300;400;500;700;800&display=swap');
        *{box-sizing:border-box}
        .g-inp{width:100%;background:rgba(255,255,255,.05);border:1.5px solid rgba(201,162,39,.25);border-radius:9px;padding:13px 16px;color:#fff;font-family:inherit;font-size:14px;outline:none;transition:all .2s;}
        .g-inp::placeholder{color:rgba(255,255,255,.28);}
        .g-inp:focus{border-color:#c9a227;background:rgba(201,162,39,.07);box-shadow:0 0 0 3px rgba(201,162,39,.1);}
        @keyframes fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse-ring{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.9;transform:scale(1.04)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      `}</style>

      <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-15%",right:"-8%",width:"480px",height:"480px",background:"radial-gradient(circle,rgba(201,162,39,.07) 0%,transparent 70%)",borderRadius:"50%"}}/>
        <div style={{position:"absolute",bottom:"-20%",left:"-8%",width:"400px",height:"400px",background:"radial-gradient(circle,rgba(37,99,235,.05) 0%,transparent 70%)",borderRadius:"50%"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.012) 1px,transparent 1px)",backgroundSize:"56px 56px"}}/>
      </div>

      {/* Light/dark theme toggle (persisted app-wide) */}
      <button onClick={toggle} title={dark?"التبديل إلى الوضع النهاري":"التبديل إلى الوضع الليلي"} aria-label="تبديل السمة" type="button" style={{position:"fixed",top:"16px",insetInlineEnd:"16px",background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.14)",borderRadius:"8px",padding:"7px 12px",fontSize:"14px",cursor:"pointer",zIndex:10,transition:"all .2s"}}>{dark?"☀️":"🌙"}</button>
      {/* r18: منتقي لغات العالم — أعلى الشاشة بجوار مبدّل السمة */}
      <div style={{position:"fixed",top:"16px",insetInlineStart:"16px",zIndex:10}}><LanguageSwitcher compact /></div>

      <div style={{width:"100%",maxWidth:"420px",animation:"fadeUp .55s ease",position:"relative"}}>

        <div style={{textAlign:"center",marginBottom:"32px"}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"86px",height:"86px",margin:"0 auto 20px",position:"relative",animation:"float 4s ease-in-out infinite"}}>
            <div style={{position:"absolute",inset:0,border:"1.5px solid rgba(201,162,39,.35)",borderRadius:"50%",animation:"pulse-ring 3s ease-in-out infinite"}}/>
            <div style={{position:"absolute",inset:"7px",border:"1px solid rgba(201,162,39,.18)",borderRadius:"50%"}}/>
            <div style={{width:"60px",height:"60px",background:"linear-gradient(135deg,#c9a227,#a07c1a)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"28px",boxShadow:"0 6px 24px rgba(201,162,39,.4)"}}>🏛️</div>
          </div>

          <div style={{color:"rgba(201,162,39,.65)",fontSize:"10px",fontWeight:700,letterSpacing:"3px",textTransform:"uppercase",marginBottom:"12px"}}>
            نظام إدارة الحسابات المتكامل
          </div>
          <div style={{color:"#fff",fontSize:"23px",fontWeight:900,lineHeight:1.25,marginBottom:"6px",textShadow:"0 2px 20px rgba(201,162,39,.15)"}}>
            الشركة القابضة المتحدة
          </div>
          <div style={{color:"#c9a227",fontSize:"16px",fontWeight:700,marginBottom:"5px"}}>ذ.م.م</div>
          <div style={{color:"rgba(255,255,255,.22)",fontSize:"10px",letterSpacing:"2.5px",textTransform:"uppercase"}}>
            United Holding Group LLC
          </div>
        </div>

        <div style={{
          background:"rgba(255,255,255,.04)",backdropFilter:"blur(24px)",
          borderRadius:"18px",border:"1px solid rgba(201,162,39,.18)",
          boxShadow:"0 24px 64px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.07)",
          padding:"28px 26px",
        }}>
          {/* مبدّل الوضع: دخول / تسجيل */}
          {mode !== "forgot" && (
            <div style={{display:"flex",gap:4,background:"rgba(255,255,255,.05)",borderRadius:10,padding:4,marginBottom:20}}>
              {(["login","register"] as Mode[]).map(m => (
                <button key={m} type="button" onClick={()=>switchMode(m)} style={{
                  flex:1, border:"none", borderRadius:8, padding:"9px 10px", fontFamily:"inherit",
                  fontSize:13, fontWeight:800, cursor:"pointer", transition:"all .2s",
                  background: mode===m ? "linear-gradient(135deg,#c9a227,#9a7318)" : "transparent",
                  color: mode===m ? "#fff" : "rgba(255,255,255,.55)",
                  boxShadow: mode===m ? "0 4px 14px rgba(201,162,39,.35)" : "none",
                }}>{m==="login" ? `🔑 ${t("login.signIn")}` : `✨ ${t("login.signUp")}`}</button>
              ))}
            </div>
          )}

          {freeBadge}

          {mode === "forgot" ? (
            <>
              <div style={{fontSize:"11px",color:"rgba(201,162,39,.6)",fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"22px",textAlign:"center",borderBottom:"1px solid rgba(201,162,39,.12)",paddingBottom:"16px"}}>
                {t("login.forgotTitle")}
              </div>
              <p style={{color:"rgba(255,255,255,.55)",fontSize:12.5,lineHeight:1.9,margin:"0 0 18px",textAlign:"center"}}>
                {t("login.forgotHint")}
              </p>
              <div style={{marginBottom:"14px"}}>
                <label style={{fontSize:"11px",color:"rgba(201,162,39,.75)",display:"block",marginBottom:"7px",fontWeight:700,letterSpacing:".6px"}}>{t("login.email")}</label>
                <input className="g-inp" type="email" placeholder="example@company.com"
                  value={email} onChange={e=>{setEmail(e.target.value);setErr("");}}
                  onKeyDown={e=>e.key==="Enter"&&doForgot()}/>
              </div>
              {err && (
                <div style={{background:"rgba(220,38,38,.1)",border:"1px solid rgba(220,38,38,.28)",borderRadius:"8px",padding:"9px 14px",color:"#fca5a5",fontSize:"12px",marginBottom:"14px",lineHeight:1.8}}>
                  ❌ {err}
                </div>
              )}
              {okMsg && (
                <div style={{background:"rgba(22,163,74,.1)",border:"1px solid rgba(22,163,74,.28)",borderRadius:"8px",padding:"9px 14px",color:"#86efac",fontSize:"12px",marginBottom:"14px",lineHeight:1.8}}>
                  {okMsg}
                </div>
              )}
              <button onClick={doForgot} disabled={loading||!email} style={{
                width:"100%",border:"none",borderRadius:"9px",padding:"14px",
                background:loading||!email?"rgba(255,255,255,.06)":"linear-gradient(135deg,#c9a227,#9a7318)",
                color:loading||!email?"rgba(255,255,255,.25)":"#fff",
                fontFamily:"inherit",fontSize:"15px",fontWeight:800,
                cursor:loading||!email?"not-allowed":"pointer",
                boxShadow:loading||!email?"none":"0 6px 22px rgba(201,162,39,.45)",
                letterSpacing:".5px",transition:"all .2s",
              }}>{loading?"⏳ …":`📨 ${t("login.send")}`}</button>
              <button type="button" onClick={()=>switchMode("login")} style={{
                width:"100%",marginTop:12,background:"none",border:"none",color:"rgba(255,255,255,.5)",
                fontFamily:"inherit",fontSize:12.5,fontWeight:700,cursor:"pointer",
              }}>{`← ${t("login.back")}`}</button>
            </>
          ) : mode === "register" ? (
            <>
              <div style={{fontSize:"11px",color:"rgba(201,162,39,.6)",fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"22px",textAlign:"center",borderBottom:"1px solid rgba(201,162,39,.12)",paddingBottom:"16px"}}>
                {t("login.freeBadge")}
              </div>

              <div style={{marginBottom:"14px"}}>
                <label style={{fontSize:"11px",color:"rgba(201,162,39,.75)",display:"block",marginBottom:"7px",fontWeight:700,letterSpacing:".6px"}}>{t("login.name")} *</label>
                <input className="g-inp" placeholder="أحمد محمد" value={name}
                  onChange={e=>{setName(e.target.value);setErr("");}}/>
              </div>

              <div style={{marginBottom:"14px"}}>
                <label style={{fontSize:"11px",color:"rgba(201,162,39,.75)",display:"block",marginBottom:"7px",fontWeight:700,letterSpacing:".6px"}}>{t("login.email")} *</label>
                <input className="g-inp" type="email" placeholder="example@company.com" value={email}
                  onChange={e=>{setEmail(e.target.value);setErr("");}}/>
              </div>

              <div style={{marginBottom:"14px"}}>
                <label style={{fontSize:"11px",color:"rgba(201,162,39,.75)",display:"block",marginBottom:"7px",fontWeight:700,letterSpacing:".6px"}}>{t("login.phone")}</label>
                <input className="g-inp" type="tel" dir="ltr" style={{textAlign:"right"}} placeholder="+965 9XXX XXXX" value={phone}
                  onChange={e=>{setPhone(e.target.value);setErr("");}}/>
              </div>

              <div style={{marginBottom:"14px"}}>
                <label style={{fontSize:"11px",color:"rgba(201,162,39,.75)",display:"block",marginBottom:"7px",fontWeight:700,letterSpacing:".6px"}}>{t("login.password")} *</label>
                <div style={{position:"relative"}}>
                  <input className="g-inp" type={showPass?"text":"password"} placeholder="••••••••••" value={pass}
                    onChange={e=>{setPass(e.target.value);setErr("");}} style={{paddingLeft:"42px"}}/>
                  <span onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",left:"13px",top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:"15px",opacity:.4}}>{showPass?"🙈":"👁️"}</span>
                </div>
              </div>

              <div style={{marginBottom:"20px"}}>
                <label style={{fontSize:"11px",color:"rgba(201,162,39,.75)",display:"block",marginBottom:"7px",fontWeight:700,letterSpacing:".6px"}}>{t("login.password")} *</label>
                <input className="g-inp" type={showPass?"text":"password"} placeholder="••••••••••" value={pass2}
                  onChange={e=>{setPass2(e.target.value);setErr("");}}
                  onKeyDown={e=>e.key==="Enter"&&doRegister()}/>
              </div>

              {err && (
                <div style={{background:"rgba(220,38,38,.1)",border:"1px solid rgba(220,38,38,.28)",borderRadius:"8px",padding:"9px 14px",color:"#fca5a5",fontSize:"12px",marginBottom:"14px"}}>
                  ❌ {err}
                </div>
              )}
              {okMsg && (
                <div style={{background:"rgba(22,163,74,.1)",border:"1px solid rgba(22,163,74,.28)",borderRadius:"8px",padding:"9px 14px",color:"#86efac",fontSize:"12px",marginBottom:"14px"}}>
                  {okMsg}
                </div>
              )}

              <button onClick={doRegister} disabled={loading||!name||!email||!pass||!pass2||(seats&&!seats.freeOpen)} style={{
                width:"100%",border:"none",borderRadius:"9px",padding:"14px",
                background:(loading||!name||!email||!pass||!pass2||(seats&&!seats.freeOpen))?"rgba(255,255,255,.06)":"linear-gradient(135deg,#c9a227,#9a7318)",
                color:(loading||!name||!email||!pass||!pass2||(seats&&!seats.freeOpen))?"rgba(255,255,255,.25)":"#fff",
                fontFamily:"inherit",fontSize:"15px",fontWeight:800,
                cursor:(loading||!name||!email||!pass||!pass2||(seats&&!seats.freeOpen))?"not-allowed":"pointer",
                boxShadow:(loading||!name||!email||!pass||!pass2||(seats&&!seats.freeOpen))?"none":"0 6px 22px rgba(201,162,39,.45)",
                letterSpacing:".5px",transition:"all .2s",
              }}>{seats&&!seats.freeOpen ? t("pricing.seatsFull") : loading ? "⏳ …" : `✨ ${t("login.signUp")} ←`}</button>

              <p style={{color:"rgba(255,255,255,.35)",fontSize:11.5,margin:"14px 0 0",textAlign:"center",lineHeight:1.8}}>
                بإنشائك الحساب ستحصل على شركة خاصة بك بعد أول دخول — فواتير وعملاء وتقارير بلا أي تكلفة
              </p>
            </>
          ) : (
            <>
              <div style={{fontSize:"11px",color:"rgba(201,162,39,.6)",fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"22px",textAlign:"center",borderBottom:"1px solid rgba(201,162,39,.12)",paddingBottom:"16px"}}>
                {t("login.title")}
              </div>

              <div style={{marginBottom:"14px"}}>
                <label style={{fontSize:"11px",color:"rgba(201,162,39,.75)",display:"block",marginBottom:"7px",fontWeight:700,letterSpacing:".6px"}}>{t("login.email")}</label>
                <input className="g-inp" type="email" placeholder="example@company.com"
                  value={email} onChange={e=>{setEmail(e.target.value);setErr("");}}
                  onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
              </div>

              <div style={{marginBottom:"8px"}}>
                <label style={{fontSize:"11px",color:"rgba(201,162,39,.75)",display:"block",marginBottom:"7px",fontWeight:700,letterSpacing:".6px"}}>{t("login.password")}</label>
                <div style={{position:"relative"}}>
                  <input className="g-inp" type={showPass?"text":"password"} placeholder="••••••••••"
                    value={pass} onChange={e=>{setPass(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&doLogin()} style={{paddingLeft:"42px"}}/>
                  <span onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",left:"13px",top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:"15px",opacity:.4}}>{showPass?"🙈":"👁️"}</span>
                </div>
              </div>

              <div style={{textAlign:"left",marginBottom:"20px"}}>
                <button type="button" onClick={()=>switchMode("forgot")} style={{
                  background:"none",border:"none",color:"rgba(201,162,39,.75)",fontFamily:"inherit",
                  fontSize:11.5,fontWeight:700,cursor:"pointer",padding:0,
                }}>{t("login.forgot")}</button>
              </div>

              {err && (
                <div style={{background:"rgba(220,38,38,.1)",border:"1px solid rgba(220,38,38,.28)",borderRadius:"8px",padding:"9px 14px",color:"#fca5a5",fontSize:"12px",marginBottom:"14px"}}>
                  ❌ {err}
                </div>
              )}

              <button onClick={doLogin} disabled={loading||!email||!pass} style={{
                width:"100%",border:"none",borderRadius:"9px",padding:"14px",
                background:loading||!email||!pass?"rgba(255,255,255,.06)":"linear-gradient(135deg,#c9a227,#9a7318)",
                color:loading||!email||!pass?"rgba(255,255,255,.25)":"#fff",
                fontFamily:"inherit",fontSize:"15px",fontWeight:800,
                cursor:loading||!email||!pass?"not-allowed":"pointer",
                boxShadow:loading||!email||!pass?"none":"0 6px 22px rgba(201,162,39,.45)",
                letterSpacing:".5px",transition:"all .2s",
              }}>{loading?"⏳ …":`${t("login.signIn")} ←`}</button>
            </>
          )}
        </div>

        <div style={{textAlign:"center",marginTop:"22px",color:"rgba(255,255,255,.14)",fontSize:"10px",letterSpacing:"1.5px"}}>
          SECURE AUTHENTICATION SYSTEM v4.0
        </div>
      </div>
    </div>
  );
}
