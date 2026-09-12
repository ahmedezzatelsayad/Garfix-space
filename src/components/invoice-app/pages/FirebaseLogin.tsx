"use client";

import { useState } from "react";
import { loginUser } from "../firebase/auth";

export default function FirebaseLogin() {
  const [email,    setEmail]    = useState("");
  const [pass,     setPass]     = useState("");
  const [err,      setErr]      = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const doLogin = async () => {
    if (!email || !pass) return;
    setLoading(true); setErr("");
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
      setErr(msgs[e.code] || `خطأ: ${e.code}`);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(150deg,#06111f 0%,#0d1e35 45%,#070e1c 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Cairo','Tajawal',sans-serif", direction: "rtl",
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
          <div style={{fontSize:"11px",color:"rgba(201,162,39,.6)",fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"22px",textAlign:"center",borderBottom:"1px solid rgba(201,162,39,.12)",paddingBottom:"16px"}}>
            تسجيل الدخول الآمن
          </div>

          <div style={{marginBottom:"14px"}}>
            <label style={{fontSize:"11px",color:"rgba(201,162,39,.75)",display:"block",marginBottom:"7px",fontWeight:700,letterSpacing:".6px"}}>البريد الإلكتروني</label>
            <input className="g-inp" type="email" placeholder="example@company.com"
              value={email} onChange={e=>{setEmail(e.target.value);setErr("");}}
              onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
          </div>

          <div style={{marginBottom:"20px"}}>
            <label style={{fontSize:"11px",color:"rgba(201,162,39,.75)",display:"block",marginBottom:"7px",fontWeight:700,letterSpacing:".6px"}}>كلمة المرور</label>
            <div style={{position:"relative"}}>
              <input className="g-inp" type={showPass?"text":"password"} placeholder="••••••••••"
                value={pass} onChange={e=>{setPass(e.target.value);setErr("");}}
                onKeyDown={e=>e.key==="Enter"&&doLogin()} style={{paddingLeft:"42px"}}/>
              <span onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",left:"13px",top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:"15px",opacity:.4}}>{showPass?"🙈":"👁️"}</span>
            </div>
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
          }}>{loading?"⏳ جارٍ التحقق...":"دخول ←"}</button>
        </div>

        <div style={{textAlign:"center",marginTop:"22px",color:"rgba(255,255,255,.14)",fontSize:"10px",letterSpacing:"1.5px"}}>
          SECURE AUTHENTICATION SYSTEM v3.0
        </div>
      </div>
    </div>
  );
}
