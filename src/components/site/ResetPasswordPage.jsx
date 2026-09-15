"use client";

import { useState, useEffect } from "react";
import { resetPasswordWithToken } from "../invoice-app/firebase/auth";
import { tr, appDir } from "@/lib/i18n-app";

/**
 * r16: صفحة إعادة تعيين كلمة المرور — تُفتح من رابط رسالة البريد (#/reset?token=…)
 * نمط بصري مطابق لصفحة الدخول (ذهبي داكن RTL).
 */
export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const m = location.hash.match(/[?&]token=([0-9a-f]+)/i);
    setToken(m ? m[1] : "");
  }, []);

  const goLogin = (e) => {
    if (e) e.preventDefault();
    location.hash = "#/login";
  };

  const doReset = async () => {
    if (!pass || !pass2) { setErr(tr("أدخل كلمة المرور الجديدة وتأكيدها")); return; }
    if (pass !== pass2) { setErr(tr("كلمتا المرور غير متطابقتين")); return; }
    setLoading(true); setErr(""); setOkMsg("");
    try {
      await resetPasswordWithToken(token, pass);
      setOkMsg(tr("✅ تم تعيين كلمة المرور الجديدة — يمكنك الدخول الآن"));
      setPass(""); setPass2("");
      setTimeout(() => { location.hash = "#/login"; }, 1600);
    } catch (e) {
      setErr(e.message || tr("تعذر إعادة التعيين — اطلب رابطاً جديداً"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir={appDir()} style={{
      minHeight: "100vh", background: "linear-gradient(150deg,#06111f 0%,#0d1e35 45%,#070e1c 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Cairo','Tajawal',sans-serif", padding: 20, position: "relative",
    }}>
      <style>{`
        .r-inp{width:100%;background:rgba(255,255,255,.05);border:1.5px solid rgba(201,162,39,.25);border-radius:9px;padding:13px 16px;color:#fff;font-family:inherit;font-size:14px;outline:none;transition:all .2s}
        .r-inp::placeholder{color:rgba(255,255,255,.28)}
        .r-inp:focus{border-color:#c9a227;background:rgba(201,162,39,.07);box-shadow:0 0 0 3px rgba(201,162,39,.1)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <a href="#/login" onClick={goLogin} style={{
        position: "fixed", top: 16, insetInlineStart: 16, zIndex: 50,
        background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.14)",
        borderRadius: 8, padding: "7px 14px", color: "#fff", textDecoration: "none",
        fontSize: 13, fontWeight: 700, fontFamily: "Cairo,sans-serif",
      }}>{tr("← الدخول")}</a>

      <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp .5s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{
            width: 72, height: 72, margin: "0 auto 16px", borderRadius: "50%",
            background: "linear-gradient(135deg,#c9a227,#a07c1a)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30,
            boxShadow: "0 6px 24px rgba(201,162,39,.4)",
          }}>🔐</div>
          <div style={{ color: "#fff", fontSize: 21, fontWeight: 900, marginBottom: 6 }}>{tr("كلمة مرور جديدة")}</div>
          <div style={{ color: "rgba(255,255,255,.45)", fontSize: 12.5 }}>{tr("اختر كلمة مرور قوية لحسابك — 8 أحرف على الأقل")}</div>
        </div>

        <div style={{
          background: "rgba(255,255,255,.04)", backdropFilter: "blur(24px)", borderRadius: 18,
          border: "1px solid rgba(201,162,39,.18)", padding: "26px 24px",
          boxShadow: "0 24px 64px rgba(0,0,0,.55)",
        }}>
          {!token ? (
            <>
              <div style={{ background: "rgba(220,38,38,.1)", border: "1px solid rgba(220,38,38,.28)", borderRadius: 8, padding: "12px 14px", color: "#fca5a5", fontSize: 12.5, lineHeight: 1.9, textAlign: "center" }}>
                {tr("⚠️ الرابط لا يحتوي رمز استعادة صالحاً.")}<br />{tr("اطلب رسالة جديدة من صفحة الدخول («هل نسيت كلمة السر؟»)")}
              </div>
              <button onClick={goLogin} style={{
                width: "100%", marginTop: 16, border: "none", borderRadius: 9, padding: 13,
                background: "linear-gradient(135deg,#c9a227,#9a7318)", color: "#fff",
                fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer",
              }}>{tr("العودة لتسجيل الدخول ←")}</button>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: "rgba(201,162,39,.75)", display: "block", marginBottom: 7, fontWeight: 700 }}>{tr("كلمة المرور الجديدة")}</label>
                <div style={{ position: "relative" }}>
                  <input className="r-inp" type={showPass ? "text" : "password"} placeholder="••••••••••" value={pass}
                    onChange={e => { setPass(e.target.value); setErr(""); }} style={{ paddingInlineEnd: 42 }}/>
                  <span onClick={() => setShowPass(p => !p)} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", cursor: "pointer", fontSize: 15, opacity: .4 }}>{showPass ? "🙈" : "👁️"}</span>
                </div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 11, color: "rgba(201,162,39,.75)", display: "block", marginBottom: 7, fontWeight: 700 }}>{tr("تأكيد كلمة المرور")}</label>
                <input className="r-inp" type={showPass ? "text" : "password"} placeholder="••••••••••" value={pass2}
                  onChange={e => { setPass2(e.target.value); setErr(""); }}
                  onKeyDown={e => e.key === "Enter" && doReset()} style={{ paddingInlineEnd: 42 }}/>
              </div>

              {err && (
                <div style={{ background: "rgba(220,38,38,.1)", border: "1px solid rgba(220,38,38,.28)", borderRadius: 8, padding: "9px 14px", color: "#fca5a5", fontSize: 12, marginBottom: 14 }}>
                  ❌ {err}
                </div>
              )}
              {okMsg && (
                <div style={{ background: "rgba(22,163,74,.1)", border: "1px solid rgba(22,163,74,.28)", borderRadius: 8, padding: "9px 14px", color: "#86efac", fontSize: 12, marginBottom: 14 }}>
                  {okMsg}
                </div>
              )}

              <button onClick={doReset} disabled={loading || !pass || !pass2} style={{
                width: "100%", border: "none", borderRadius: 9, padding: 14,
                background: (loading || !pass || !pass2) ? "rgba(255,255,255,.06)" : "linear-gradient(135deg,#c9a227,#9a7318)",
                color: (loading || !pass || !pass2) ? "rgba(255,255,255,.25)" : "#fff",
                fontFamily: "inherit", fontSize: 15, fontWeight: 800,
                cursor: (loading || !pass || !pass2) ? "not-allowed" : "pointer",
                boxShadow: (loading || !pass || !pass2) ? "none" : "0 6px 22px rgba(201,162,39,.45)",
              }}>{loading ? tr("⏳ جارٍ الحفظ...") : tr("💾 حفظ كلمة المرور الجديدة")}</button>

              <p style={{ color: "rgba(255,255,255,.3)", fontSize: 11, margin: "14px 0 0", textAlign: "center", lineHeight: 1.8 }}>
                {tr("الرمز صالح 30 دقيقة ولمرة واحدة فقط — من رسالة الاستعادة")}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
