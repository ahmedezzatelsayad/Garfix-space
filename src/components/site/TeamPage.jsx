"use client";

import { memberAvatar } from "./site-shared";

/** r13: صفحة الفريق — بطاقة المؤسس + شبكة أعضاء الفريق (من /api/site/team)
 *  r16: أسماء الفريق حُذفت بطلب المؤسس — الصفحة تركّز على المؤسس أحمد عزت الصياد،
 *  والمدير يستطيع إضافة أعضاء لاحقاً من تبويب «🌐 الموقع» إن رغب. */
export default function TeamPage({ team, content }) {
  const members = team || null; // null = loading, [] = فارغ
  const goFounder = (e) => {
    e.preventDefault();
    location.hash = "#/founder";
  };

  return (
    <div>
      <section className="s-section" style={{ paddingBottom: 20 }}>
        <div style={{ textAlign: "center" }} className="s-fade">
          <div className="s-chip">✦ عائلة واحدة</div>
          <h1 className="s-section-title" style={{ marginTop: 14 }}>فريق العمل</h1>
          <p className="s-section-sub" style={{ marginBottom: 0 }}>
            الأشخاص الذين يقفون خلف كل فاتورة صحيحة وكل تقرير في وقته
          </p>
        </div>

        {/* بطاقة المؤسس */}
        <div
          className="s-card s-fade s-fade-1"
          style={{
            display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", marginTop: 34,
            borderColor: "rgba(201,162,39,.45)", background: "linear-gradient(135deg,rgba(201,162,39,.1),rgba(255,255,255,.03))",
          }}
        >
          {memberAvatar({ name: content.founder_name, emoji: content.founder_emoji, photoUrl: content.founder_photo }, 96)}
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="s-chip" style={{ marginBottom: 8, fontSize: 10.5 }}>⭐ المؤسس</div>
            <b style={{ fontSize: 20, display: "block", marginBottom: 4 }}>{content.founder_name}</b>
            <div style={{ color: "#c9a227", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{content.founder_title}</div>
            <p style={{ margin: 0, color: "rgba(255,255,255,.55)", fontSize: 13, lineHeight: 1.9 }}>
              صاحب الرؤية الذي بدأ النظام من سؤال بسيط — وما زال يقرأ كل ملاحظة تصلنا بنفسه.
            </p>
          </div>
          <a className="s-btn s-btn-outline" href="#/founder" onClick={goFounder} style={{ flexShrink: 0 }}>
            رسالة المؤسس ←
          </a>
        </div>

        {/* شبكة الأعضاء */}
        <div className="s-team-grid" style={{ marginTop: 26 }}>
          {members === null &&
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="s-card" style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 74, height: 74, margin: "0 auto 14px", borderRadius: "50%",
                    background: "rgba(255,255,255,.06)", animation: "sPulse 1.6s ease-in-out infinite",
                  }}
                />
                <div style={{ height: 14, width: "60%", margin: "0 auto 8px", borderRadius: 6, background: "rgba(255,255,255,.08)" }} />
                <div style={{ height: 10, width: "40%", margin: "0 auto", borderRadius: 6, background: "rgba(201,162,39,.18)" }} />
              </div>
            ))}

          {members !== null && members.length === 0 && (
            <div className="s-card" style={{ gridColumn: "1/-1", textAlign: "center", padding: 44 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏛️</div>
              <b style={{ fontSize: 16 }}>بنية مركّزة بقيادة المؤسس مباشرة</b>
              <p style={{ color: "rgba(255,255,255,.5)", fontSize: 13, margin: "8px auto 0", maxWidth: 420, lineHeight: 1.9 }}>
                كل ملاحظة وكل طلب ميزة يمرّ على المؤسس نفسه — هكذا نضمن أن النظام يكبر بما ينفع التجّار فعلاً، لا بما يبدو جيداً في العروض فقط.
              </p>
            </div>
          )}

          {members &&
            members.map((m, i) => (
              <div key={m.id || i} className={`s-card s-card-hover s-fade s-fade-${(i % 4) + 1}`} style={{ textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                  {memberAvatar(m, 74)}
                </div>
                <b style={{ fontSize: 15.5, display: "block", marginBottom: 4 }}>{m.name}</b>
                <div style={{ color: "#c9a227", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>{m.role}</div>
                {m.bio && (
                  <p style={{ color: "rgba(255,255,255,.55)", fontSize: 12.5, lineHeight: 1.85, margin: "0 0 12px" }}>{m.bio}</p>
                )}
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  {m.email && (
                    <a className="s-social" href={`mailto:${m.email}`} aria-label={`بريد ${m.name}`} title={m.email}>
                      ✉️
                    </a>
                  )}
                  {m.linkedin && (
                    <a className="s-social" href={m.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`لينكدإن ${m.name}`}>
                      in
                    </a>
                  )}
                  {m.twitter && (
                    <a className="s-social" href={m.twitter} target="_blank" rel="noopener noreferrer" aria-label={`تويتر ${m.name}`}>
                      𝕏
                    </a>
                  )}
                </div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
