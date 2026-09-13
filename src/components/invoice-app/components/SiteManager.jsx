"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

/**
 * r13: تبويب 🌐 الموقع (للمدير فقط) — إدارة محتوى الموقع العام:
 *  • رسالة المؤسس وعناوين الصفحة الرئيسية (site_content)
 *  • أعضاء الفريق: إضافة/تعديل/حذف/ترتيب/نشر (team_members)
 * المعاينة: الأزرار تفتح صفحات الموقع فوق النظام عبر روابط الـ hash.
 */

const CONTENT_FIELDS = [
  { key: "site_name", label: "اسم الموقع (العربي)", placeholder: "الشركة القابضة المتحدة", max: 80 },
  { key: "site_name_en", label: "اسم الموقع (اللاتيني)", placeholder: "United Holding Group", max: 60 },
  { key: "hero_badge", label: "شارة البطل", placeholder: "نظام إدارة الحسابات المتكامل", max: 80 },
  { key: "hero_title", label: "عنوان الصفحة الرئيسية", placeholder: "إدارة مالية ذكية لكل شركاتك…", max: 120 },
  { key: "hero_sub", label: "النص التعريفي", placeholder: "من الفاتورة الأولى حتى آخر دينار…", max: 400, area: true, rows: 3 },
  { key: "founder_name", label: "اسم المؤسس", placeholder: "أحمد عزت السيد", max: 80 },
  { key: "founder_title", label: "لقب المؤسس", placeholder: "المؤسس والرئيس التنفيذي", max: 80 },
  { key: "founder_emoji", label: "أفاتار المؤسس (إيموجي)", placeholder: "👨‍💼", max: 8 },
  { key: "founder_photo", label: "صورة المؤسس (رابط https)", placeholder: "https://…", max: 400, url: true },
  { key: "founder_message", label: "نص رسالة المؤسس", placeholder: "اكتب الرسالة هنا… (فاصل فقرات: سطر فارغ)", max: 8000, area: true, rows: 12 },
  { key: "founder_signature", label: "التوقيع", placeholder: "أحمد عزت السيد", max: 80 },
  { key: "contact_phone", label: "هاتف التواصل", placeholder: "+965…", max: 30 },
  { key: "contact_email", label: "بريد التواصل", placeholder: "info@…", max: 120 },
  { key: "contact_address", label: "العنوان", placeholder: "الكويت — حولي", max: 120 },
];

const MEMBER_FIELDS = [
  { key: "name", label: "الاسم", required: true, max: 120, placeholder: "اسم العضو" },
  { key: "role", label: "الدور", max: 120, placeholder: "مدير العمليات" },
  { key: "bio", label: "نبذة", max: 600, area: true, rows: 3, placeholder: "نبذة قصيرة تظهر بصفحة الفريق" },
  { key: "emoji", label: "أفاتار (إيموجي)", max: 8, placeholder: "🧑‍💼" },
  { key: "photoUrl", label: "صورة (رابط https)", max: 400, url: true, placeholder: "https://…" },
  { key: "email", label: "بريد", max: 200, placeholder: "name@company.com" },
  { key: "linkedin", label: "لينكدإن", max: 400, url: true, placeholder: "https://linkedin.com/in/…" },
  { key: "twitter", label: "تويتر/إكس", max: 400, url: true, placeholder: "https://x.com/…" },
  { key: "sortOrder", label: "الترتيب (رقم)", num: true, placeholder: "10" },
];

function SectionTitle({ icon, title, sub, extra }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
        {sub && <div style={{ color: "var(--ia-sub)", fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
      {extra}
    </div>
  );
}

export default function SiteManager({ toast }) {
  const toast_ = toast || (() => {});
  const [loading, setLoading] = useState(true);
  const [savingContent, setSavingContent] = useState(false);
  const [content, setContent] = useState({});
  const [team, setTeam] = useState([]);
  const [editor, setEditor] = useState(null); // { …fields } عند التعديل/الإضافة
  const [savingMember, setSavingMember] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, t] = await Promise.all([api.getSiteContent(), api.listTeam(true)]);
      setContent(c || {});
      setTeam(t || []);
    } catch (e) {
      toast_("تعذّر تحميل محتوى الموقع: " + (e.message || e), "warn");
    } finally {
      setLoading(false);
    }
  }, [toast_]);

  useEffect(() => { load(); }, [load]);

  const openPreview = (hash) => () => { location.hash = hash; };

  const saveContent = async () => {
    setSavingContent(true);
    try {
      const payload = {};
      for (const f of CONTENT_FIELDS) {
        const v = String(content[f.key] ?? "").trim();
        if (v) payload[f.key] = v;
      }
      const out = await api.saveSiteContent(payload);
      toast_(`✅ تم حفظ محتوى الموقع (${out?.saved ?? 0} حقل) — تحديث الصفحات فوري`);
    } catch (e) {
      toast_("فشل الحفظ: " + (e.message || e), "warn");
    } finally {
      setSavingContent(false);
    }
  };

  const setField = (k, v) => setContent((p) => ({ ...p, [k]: v }));

  // ── أعضاء الفريق ──
  const openAdd = () =>
    setEditor({ name: "", role: "", bio: "", emoji: "", photoUrl: "", email: "", linkedin: "", twitter: "", sortOrder: (team.length + 1) * 10, published: true });
  const openEdit = (m) => setEditor({ ...m });

  const saveMember = async () => {
    if (!String(editor.name || "").trim()) {
      toast_("اسم العضو مطلوب", "warn");
      return;
    }
    setSavingMember(true);
    try {
      const data = {
        name: editor.name,
        role: editor.role || "عضو الفريق",
        bio: editor.bio || "",
        emoji: editor.emoji || "",
        photoUrl: editor.photoUrl || "",
        email: editor.email || "",
        linkedin: editor.linkedin || "",
        twitter: editor.twitter || "",
        sortOrder: Number(editor.sortOrder) || 99,
        published: !!editor.published,
      };
      if (editor.id) await api.updateTeamMember(editor.id, data);
      else await api.createTeamMember(data);
      toast_(editor.id ? "✅ تم تحديث العضو" : "✅ تمت إضافة العضو — يظهر فوراً بصفحة الفريق");
      setEditor(null);
      await load();
    } catch (e) {
      toast_("فشل الحفظ: " + (e.message || e), "warn");
    } finally {
      setSavingMember(false);
    }
  };

  const togglePublished = async (m) => {
    try {
      await api.updateTeamMember(m.id, { published: !m.published });
      setTeam((p) => p.map((x) => (x.id === m.id ? { ...x, published: !m.published } : x)));
      toast_(m.published ? "📝 العضو أصبح مسودة (لن يظهر بالموقع)" : "👁 العضو أصبح منشوراً");
    } catch (e) {
      toast_("فشل التبديل: " + (e.message || e), "warn");
    }
  };

  const move = async (m, dir) => {
    const idx = team.findIndex((x) => x.id === m.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= team.length) return;
    const other = team[swapIdx];
    try {
      await Promise.all([
        api.updateTeamMember(m.id, { sortOrder: other.sortOrder }),
        api.updateTeamMember(other.id, { sortOrder: m.sortOrder }),
      ]);
      setTeam((p) => {
        const arr = [...p];
        [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
        return arr;
      });
    } catch (e) {
      toast_("فشل إعادة الترتيب: " + (e.message || e), "warn");
    }
  };

  const removeMember = async (m) => {
    if (!window.confirm(`حذف «${m.name}» من الفريق نهائياً؟`)) return;
    try {
      await api.deleteTeamMember(m.id);
      setTeam((p) => p.filter((x) => x.id !== m.id));
      toast_("🗑 تم حذف العضو");
    } catch (e) {
      toast_("فشل الحذف: " + (e.message || e), "warn");
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div className="sk sk-lg" style={{ width: "40%", marginBottom: 12 }} />
        <div className="sk sk-sm" style={{ width: "80%", marginBottom: 8 }} />
        <div className="sk sk-sm" style={{ width: "60%" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── معاينة ── */}
      <div className="card" style={{ padding: 18 }}>
        <SectionTitle
          icon="🌐"
          title="الموقع العام — الرئيسية والفريق ورسالة المؤسس"
          sub="كل ما تحفظه هنا يظهر فوراً للزوار قبل تسجيل الدخول"
          extra={
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="btn btn-outline" onClick={openPreview("#/")}>👁 الرئيسية</button>
              <button className="btn btn-outline" onClick={openPreview("#/team")}>👥 الفريق</button>
              <button className="btn btn-outline" onClick={openPreview("#/founder")}>✉️ رسالة المؤسس</button>
            </div>
          }
        />
        <div style={{ background: "var(--ia-hover)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "var(--ia-sub)", lineHeight: 1.8 }}>
          💡 أزرار المعاينة تفتح صفحات الموقع فوق النظام — زر «↩️ العودة للنظام» في شريط الموقع يعيدك هنا.
          الزائر غير المسجّل يرى الموقع تلقائياً بمجرد فتح التطبيق.
        </div>
      </div>

      {/* ── المحتوى ── */}
      <div className="card" style={{ padding: 18 }}>
        <SectionTitle
          icon="✉️"
          title="رسالة المؤسس ومحتوى الصفحة الرئيسية"
          sub="فاصل الفقرات في الرسالة: سطر فارغ واحد"
          extra={
            <button className="btn aliphia-btn" onClick={saveContent} disabled={savingContent}>
              {savingContent ? "⏳ جارٍ الحفظ…" : "💾 حفظ المحتوى"}
            </button>
          }
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
          {CONTENT_FIELDS.map((f) => (
            <div key={f.key} style={{ gridColumn: f.area || f.key === "hero_title" ? "1/-1" : "auto" }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ia-sub)", display: "block", marginBottom: 6 }}>
                {f.label}
              </label>
              {f.area ? (
                <textarea
                  className="inp"
                  rows={f.rows || 3}
                  placeholder={f.placeholder}
                  value={content[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  style={{ resize: "vertical", lineHeight: 1.8 }}
                />
              ) : (
                <input
                  className="inp"
                  placeholder={f.placeholder}
                  value={content[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── الفريق ── */}
      <div className="card" style={{ padding: 18 }}>
        <SectionTitle
          icon="👥"
          title="أعضاء الفريق"
          sub={`${team.length} عضو — الترتيب بالأسهم، والنشر بعين 👁`}
          extra={
            <button className="btn aliphia-btn" onClick={openAdd}>＋ إضافة عضو</button>
          }
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {team.length === 0 && (
            <div style={{ textAlign: "center", padding: 24, color: "var(--ia-sub)", fontSize: 13 }}>
              لا يوجد أعضاء بعد — أضف أول عضو بزر «＋ إضافة عضو»
            </div>
          )}
          {team.map((m, i) => (
            <div
              key={m.id}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                background: "var(--ia-hover)", borderRadius: 10, flexWrap: "wrap",
                opacity: m.published ? 1 : 0.55,
              }}
            >
              <div
                style={{
                  width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#c9a227,#a07c1a)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0, color: "#fff", fontWeight: 800,
                }}
                aria-hidden="true"
              >
                {m.photoUrl ? (
                  <img src={m.photoUrl} alt={m.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  m.emoji || (m.name || "؟").charAt(0)
                )}
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <b style={{ fontSize: 14 }}>{m.name}</b>
                <span style={{ color: "var(--ia-sub)", fontSize: 12, marginInlineStart: 8 }}>{m.role}</span>
                <div style={{ fontSize: 11, color: "var(--ia-muted)", marginTop: 2 }}>
                  ترتيب {m.sortOrder} {m.published ? "· 👁 منشور" : "· 📝 مسودة"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" onClick={() => move(m, -1)} disabled={i === 0} title="أعلى" style={{ padding: "6px 10px" }}>⬆️</button>
                <button className="btn btn-ghost" onClick={() => move(m, 1)} disabled={i === team.length - 1} title="أسفل" style={{ padding: "6px 10px" }}>⬇️</button>
                <button className="btn btn-ghost" onClick={() => togglePublished(m)} title={m.published ? "تحويل لمسودة" : "نشر"} style={{ padding: "6px 10px" }}>
                  {m.published ? "👁" : "📝"}
                </button>
                <button className="btn btn-ghost" onClick={() => openEdit(m)} title="تعديل" style={{ padding: "6px 10px" }}>✏️</button>
                <button className="btn btn-red" onClick={() => removeMember(m)} title="حذف" style={{ padding: "6px 10px" }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── محرر العضو ── */}
      {editor && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
            animation: "fadeUp .2s",
          }}
          onClick={(e) => e.target === e.currentTarget && setEditor(null)}
        >
          <div className="card" style={{ maxWidth: 640, width: "100%", maxHeight: "88vh", overflowY: "auto", padding: 20 }}>
            <SectionTitle
              icon={editor.id ? "✏️" : "＋"}
              title={editor.id ? `تعديل: ${editor.name || "عضو"}` : "إضافة عضو جديد"}
              sub="الحقول الاختيارية الفارغة تُتجاهل"
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
              {MEMBER_FIELDS.map((f) => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ia-sub)", display: "block", marginBottom: 6 }}>
                    {f.label} {f.required && <span style={{ color: "#dc2626" }}>*</span>}
                  </label>
                  {f.area ? (
                    <textarea
                      className="inp" rows={f.rows || 3} placeholder={f.placeholder}
                      value={editor[f.key] ?? ""}
                      onChange={(e) => setEditor((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      className="inp" placeholder={f.placeholder}
                      value={editor[f.key] ?? ""}
                      onChange={(e) => setEditor((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  id="tm-published" type="checkbox" checked={!!editor.published}
                  onChange={(e) => setEditor((p) => ({ ...p, published: e.target.checked }))}
                />
                <label htmlFor="tm-published" style={{ fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  👁 منشور (يظهر بصفحة الفريق)
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button className="btn btn-outline" onClick={() => setEditor(null)}>إلغاء</button>
              <button className="btn aliphia-btn" onClick={saveMember} disabled={savingMember}>
                {savingMember ? "⏳ جارٍ الحفظ…" : "💾 حفظ العضو"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
