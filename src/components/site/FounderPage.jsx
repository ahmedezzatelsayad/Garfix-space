"use client";

import { memberAvatar } from "./site-shared";

/** r13: صفحة رسالة المؤسس — رسالة بتصميم خطاب + التوقيع */
export default function FounderPage({ content }) {
  const paragraphs = String(content.founder_message || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const goTeam = (e) => {
    e.preventDefault();
    location.hash = "#/team";
  };
  const goHome = (e) => {
    e.preventDefault();
    location.hash = "#/";
  };

  return (
    <div>
      <section className="s-section" style={{ maxWidth: 860 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }} className="s-fade">
          <div className="s-chip">✦ كلمة من القلب</div>
          <h1 className="s-section-title" style={{ marginTop: 14 }}>رسالة المؤسس</h1>
        </div>

        <article
          className="s-card s-fade s-fade-1"
          style={{
            position: "relative", padding: "40px 34px", borderColor: "rgba(201,162,39,.3)",
            background: "linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.02))",
          }}
        >
          <div className="s-quote-mark" style={{ position: "absolute", top: 18, insetInlineStart: 24 }} aria-hidden="true">
            ❝
          </div>

          {/* ترويسة المؤسس */}
          <header style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 26, marginTop: 10 }}>
            {memberAvatar({ name: content.founder_name, emoji: content.founder_emoji, photoUrl: content.founder_photo }, 84)}
            <div>
              <b style={{ fontSize: 19, display: "block" }}>{content.founder_name}</b>
              <div style={{ color: "#c9a227", fontSize: 12.5, fontWeight: 700, marginTop: 3 }}>{content.founder_title}</div>
            </div>
          </header>

          {/* الرسالة */}
          <div style={{ color: "rgba(255,255,255,.78)", fontSize: 15, lineHeight: 2.15 }}>
            {paragraphs.map((p, i) => (
              <p key={i} style={{ margin: "0 0 18px", whiteSpace: "pre-line" }}>
                {p}
              </p>
            ))}
          </div>

          {/* التوقيع */}
          <footer style={{ marginTop: 28, paddingTop: 22, borderTop: "1px dashed rgba(201,162,39,.3)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 30 }} aria-hidden="true">✍️</span>
            <div>
              <div style={{ fontFamily: "Georgia,'Times New Roman',serif", fontStyle: "italic", fontSize: 21, color: "#e5c558", letterSpacing: 1 }}>
                {content.founder_signature || content.founder_name}
              </div>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: 11, marginTop: 4 }}>
                {content.founder_title} — {content.site_name}
              </div>
            </div>
          </footer>
        </article>

        {/* القيم */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 26 }} className="s-fade s-fade-2">
          {["🎯 الدقة قبل كل شيء", "🤝 البساطة التي يستحقها التاجر", "🚀 التطوير المستمر"].map((v) => (
            <span key={v} className="s-chip" style={{ padding: "8px 18px", fontSize: 12.5 }}>
              {v}
            </span>
          ))}
        </div>

        {/* أزرار التنقل */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 34 }} className="s-fade s-fade-3">
          <a className="s-btn s-btn-gold" href="#/team" onClick={goTeam}>تعرّف على الفريق ←</a>
          <a className="s-btn s-btn-outline" href="#/" onClick={goHome}>العودة للرئيسية</a>
        </div>
      </section>
    </div>
  );
}
