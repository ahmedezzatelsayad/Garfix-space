"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { tr } from "@/lib/i18n-app";
import { LogoMark } from "@/components/site/site-shared";

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
      toast_(tr("تعذّر تحميل محتوى الموقع: ") + (e.message || e), "warn");
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
      // r26: الشعار — يُرسل دائماً حتى لو فارغاً (المسح يحفظ قيمة فارغة ويرجع الافتراضي «G»)
      const logo = String(content.site_logo ?? "").trim();
      payload.site_logo = logo;
      const out = await api.saveSiteContent(payload);
      toast_(tr("✅ تم حفظ محتوى الموقع ({0} حقل) — تحديث الصفحات فوري",[out?.saved ?? 0]));
    } catch (e) {
      toast_(tr("فشل الحفظ: ") + (e.message || e), "warn");
    } finally {
      setSavingContent(false);
    }
  };

  const setField = (k, v) => setContent((p) => ({ ...p, [k]: v }));

  // ── r26: شعار الموقع — رفع ملف محلي (تصغير تلقائي ≤ 240px ثم WebP base64) ──
  const logoInputRef = useRef(null);
  const [logoBusy, setLogoBusy] = useState(false);

  const pickLogoFile = () => logoInputRef.current?.click();

  const onLogoFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // نفس الملف يمكن اختياره مرة أخرى
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|svg\+xml|gif)$/i.test(file.type)) {
      toast_(tr("صيغة غير مدعومة — استخدم PNG أو JPG أو WebP أو SVG"), "warn");
      return;
    }
    setLogoBusy(true);
    const reader = new FileReader();
    reader.onerror = () => { setLogoBusy(false); toast_(tr("تعذّر قراءة الملف"), "warn"); };
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      // SVG: يُستخدم كما هو (خفيف أصلاً) إن كان حجمه معقولاً
      if (file.type === "image/svg+xml") {
        if (dataUrl.length > 18000) {
          setLogoBusy(false);
          toast_(tr("ملف SVG كبير جداً (>{0} حرفاً) — بسّطه أو ارفعه على رابط https", ["18K"]), "warn");
          return;
        }
        setField("site_logo", dataUrl);
        setLogoBusy(false);
        toast_(tr("✅ تم تحميل الشعار — اضغط «حفظ المحتوى» لتطبيقه"));
        return;
      }
      // صور نقطية: تصغير إلى 240px أقصى بعد ثم WebP (شفافية محفوظة)
      const img = new Image();
      img.onerror = () => { setLogoBusy(false); toast_(tr("تعذّر فتح الصورة"), "warn"); };
      img.onload = () => {
        try {
          const MAX = 240;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          const cx = cv.getContext("2d");
          cx.drawImage(img, 0, 0, w, h);
          let out = cv.toDataURL("image/webp", 0.92);
          if (out.length > 18000) out = cv.toDataURL("image/webp", 0.75); // ضغط أكبر إذا لزم
          if (out.length > 18000) {
            setLogoBusy(false);
            toast_(tr("الصورة كبيرة جداً بعد الضغط — استخدم شعاراً أبسط أو رابط https"), "warn");
            return;
          }
          setField("site_logo", out);
          setLogoBusy(false);
          toast_(tr("✅ تم تجهيز الشعار ({0}×{1}) — اضغط «حفظ المحتوى» لتطبيقه", [String(w), String(h)]));
        } catch (err) {
          setLogoBusy(false);
          toast_(tr("تعذّر معالجة الصورة: ") + (err?.message || err), "warn");
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // ── أعضاء الفريق ──
  const openAdd = () =>
    setEditor({ name: "", role: "", bio: "", emoji: "", photoUrl: "", email: "", linkedin: "", twitter: "", sortOrder: (team.length + 1) * 10, published: true });
  const openEdit = (m) => setEditor({ ...m });

  const saveMember = async () => {
    if (!String(editor.name || "").trim()) {
      toast_(tr("اسم العضو مطلوب"), "warn");
      return;
    }
    setSavingMember(true);
    try {
      const data = {
        name: editor.name,
        role: editor.role || tr("عضو الفريق"),
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
      toast_(editor.id ? tr("✅ تم تحديث العضو") : tr("✅ تمت إضافة العضو — يظهر فوراً بصفحة الفريق"));
      setEditor(null);
      await load();
    } catch (e) {
      toast_(tr("فشل الحفظ: ") + (e.message || e), "warn");
    } finally {
      setSavingMember(false);
    }
  };

  const togglePublished = async (m) => {
    try {
      await api.updateTeamMember(m.id, { published: !m.published });
      setTeam((p) => p.map((x) => (x.id === m.id ? { ...x, published: !m.published } : x)));
      toast_(m.published ? tr("📝 العضو أصبح مسودة (لن يظهر بالموقع)") : tr("👁 العضو أصبح منشوراً"));
    } catch (e) {
      toast_(tr("فشل التبديل: ") + (e.message || e), "warn");
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
      toast_(tr("فشل إعادة الترتيب: ") + (e.message || e), "warn");
    }
  };

  const removeMember = async (m) => {
    if (!window.confirm(tr("حذف «{0}» من الفريق نهائياً؟",[m.name]))) return;
    try {
      await api.deleteTeamMember(m.id);
      setTeam((p) => p.filter((x) => x.id !== m.id));
      toast_(tr("🗑 تم حذف العضو"));
    } catch (e) {
      toast_(tr("فشل الحذف: ") + (e.message || e), "warn");
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
          title={tr("الموقع العام — الرئيسية والفريق ورسالة المؤسس")}
          sub={tr("كل ما تحفظه هنا يظهر فوراً للزوار قبل تسجيل الدخول")}
          extra={
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="btn btn-outline" onClick={openPreview("#/")}>{tr("👁 الرئيسية")}</button>
              <button className="btn btn-outline" onClick={openPreview("#/team")}>{tr("👥 الفريق")}</button>
              <button className="btn btn-outline" onClick={openPreview("#/founder")}>{tr("✉️ رسالة المؤسس")}</button>
            </div>
          }
        />
        <div style={{ background: "var(--ia-hover)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "var(--ia-sub)", lineHeight: 1.8 }}>
          {tr("💡 أزرار المعاينة تفتح صفحات الموقع فوق النظام — زر «↩️ العودة للنظام» في شريط الموقع يعيدك هنا.\n          الزائر غير المسجّل يرى الموقع تلقائياً بمجرد فتح التطبيق.")}
        </div>
      </div>

      {/* ── شعار الموقع (r26) ── */}
      <div className="card" style={{ padding: 18 }}>
        <SectionTitle
          icon="🖼️"
          title={tr("شعار الموقع")}
          sub={tr("يظهر في شريط الموقع والتذييل وبوابة الدخول — فارغ = الشعار الذهبي «G» الافتراضي")}
        />
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* المعاينة الحية */}
          <div style={{
            flexShrink: 0, width: 132, height: 96, borderRadius: 12,
            background: "linear-gradient(135deg,#0e1d33,#07111f)",
            border: "1px solid var(--ia-border)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <LogoMark size={52} radius={14} src={content.site_logo || undefined} />
          </div>
          <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              className="inp"
              dir="ltr"
              placeholder="https://example.com/logo.png — أو ارفع ملفاً بالزر المجاور"
              value={content.site_logo?.startsWith("data:") ? "" : (content.site_logo ?? "")}
              onChange={(e) => setField("site_logo", e.target.value.trim())}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                style={{ display: "none" }}
                onChange={onLogoFile}
              />
              <button className="btn btn-outline" onClick={pickLogoFile} disabled={logoBusy}>
                {logoBusy ? tr("⏳ جارٍ المعالجة…") : tr("⬆️ رفع صورة من جهازك")}
              </button>
              {content.site_logo && (
                <button className="btn btn-outline" onClick={() => setField("site_logo", "")} style={{ color: "#DC2626" }}>
                  {tr("🗑️ إزالة الشعار")}
                </button>
              )}
              <span style={{ fontSize: 11, color: "var(--ia-sub)" }}>
                {content.site_logo?.startsWith("data:")
                  ? tr("✅ شعار مرفوع من الجهاز (مضمّن)")
                  : tr("PNG / JPG / WebP / SVG — يُصغَّر تلقائياً إلى 240px")}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ia-sub)", lineHeight: 1.8 }}>
              {tr("بعد اختيار الشعار اضغط «💾 حفظ المحتوى» في القسم التالي — التحديث فوري على صفحات الموقع.")}
            </div>
          </div>
        </div>
      </div>

      {/* ── المحتوى ── */}
      <div className="card" style={{ padding: 18 }}>
        <SectionTitle
          icon="✉️"
          title={tr("رسالة المؤسس ومحتوى الصفحة الرئيسية")}
          sub={tr("فاصل الفقرات في الرسالة: سطر فارغ واحد")}
          extra={
            <button className="btn io-btn" onClick={saveContent} disabled={savingContent}>
              {savingContent ? tr("⏳ جارٍ الحفظ…") : tr("💾 حفظ المحتوى")}
            </button>
          }
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
          {CONTENT_FIELDS.map((f) => (
            <div key={f.key} style={{ gridColumn: f.area || f.key === "hero_title" ? "1/-1" : "auto" }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ia-sub)", display: "block", marginBottom: 6 }}>
                {tr(f.label)}
              </label>
              {f.area ? (
                <textarea
                  className="inp"
                  rows={f.rows || 3}
                  placeholder={tr(f.placeholder)}
                  value={content[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  style={{ resize: "vertical", lineHeight: 1.8 }}
                />
              ) : (
                <input
                  className="inp"
                  placeholder={tr(f.placeholder)}
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
          title={tr("أعضاء الفريق")}
          sub={tr("{0} عضو — الترتيب بالأسهم، والنشر بعين 👁",[team.length])}
          extra={
            <button className="btn io-btn" onClick={openAdd}>{tr("＋ إضافة عضو")}</button>
          }
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {team.length === 0 && (
            <div style={{ textAlign: "center", padding: 24, color: "var(--ia-sub)", fontSize: 13 }}>
              {tr("لا يوجد أعضاء بعد — أضف أول عضو بزر «＋ إضافة عضو»")}
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
                  {tr("ترتيب")} {m.sortOrder} {m.published ? tr("· 👁 منشور") : tr("· 📝 مسودة")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" onClick={() => move(m, -1)} disabled={i === 0} title={tr("أعلى")} style={{ padding: "6px 10px" }}>⬆️</button>
                <button className="btn btn-ghost" onClick={() => move(m, 1)} disabled={i === team.length - 1} title={tr("أسفل")} style={{ padding: "6px 10px" }}>⬇️</button>
                <button className="btn btn-ghost" onClick={() => togglePublished(m)} title={m.published ? tr("تحويل لمسودة") : tr("نشر")} style={{ padding: "6px 10px" }}>
                  {m.published ? "👁" : "📝"}
                </button>
                <button className="btn btn-ghost" onClick={() => openEdit(m)} title={tr("تعديل")} style={{ padding: "6px 10px" }}>✏️</button>
                <button className="btn btn-red" onClick={() => removeMember(m)} title={tr("حذف")} style={{ padding: "6px 10px" }}>🗑</button>
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
              title={editor.id ? tr("تعديل: {0}",[editor.name || tr("عضو")]) : tr("إضافة عضو جديد")}
              sub={tr("الحقول الاختيارية الفارغة تُتجاهل")}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
              {MEMBER_FIELDS.map((f) => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--ia-sub)", display: "block", marginBottom: 6 }}>
                    {tr(f.label)} {f.required && <span style={{ color: "#dc2626" }}>*</span>}
                  </label>
                  {f.area ? (
                    <textarea
                      className="inp" rows={f.rows || 3} placeholder={tr(f.placeholder)}
                      value={editor[f.key] ?? ""}
                      onChange={(e) => setEditor((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      className="inp" placeholder={tr(f.placeholder)}
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
                  {tr("👁 منشور (يظهر بصفحة الفريق)")}
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button className="btn btn-outline" onClick={() => setEditor(null)}>{tr("إلغاء")}</button>
              <button className="btn io-btn" onClick={saveMember} disabled={savingMember}>
                {savingMember ? tr("⏳ جارٍ الحفظ…") : tr("💾 حفظ العضو")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
