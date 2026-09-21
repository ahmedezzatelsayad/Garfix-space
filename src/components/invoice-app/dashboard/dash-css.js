/**
 * dash-css — طبقة تصميم لوحة تحكم GarfiX Business OS (r25).
 *
 * بطاقات 16–20px بحواف ناعمة وحدود رقيقة، شرائح تحكم صغيرة، جداول أعمال
 * كثيفة البيانات، شارات حالة (لون + نقطة + نص — لا لون فقط)، فراغات
 * 4/8/12/16/24/32، وشبكات تستجيب حتى 390px بلا تمرير أفقي.
 */
export const DASH_CSS = `
/* ═══ بطاقات اللوحة ═══ */
.gx-card{background:var(--ia-card);border:1px solid var(--ia-border);border-radius:16px;
  box-shadow:0 1px 2px rgba(15,23,42,.05);display:flex;flex-direction:column;min-width:0}
.gx-card-h{display:flex;align-items:center;gap:10px;padding:15px 18px 0;flex-wrap:wrap}
.gx-card-t{font-size:14px;font-weight:800;color:var(--ia-text);letter-spacing:.1px}
.gx-card-t .gx-ico{display:inline-flex;width:30px;height:30px;border-radius:9px;align-items:center;
  justify-content:center;flex-shrink:0}
.gx-card-sub{font-size:11.5px;color:var(--ia-muted);font-weight:600}
.gx-card-h .gx-sp{flex:1}
.gx-card-b{padding:13px 18px 16px}
.gx-card-b.gx-p0{padding:0}
.gx-link{border:none;background:transparent;color:#2563EB;font-family:inherit;font-size:12px;
  font-weight:700;cursor:pointer;padding:4px 8px;border-radius:8px;display:inline-flex;
  align-items:center;gap:4px;transition:background .15s;white-space:nowrap}
.gx-link:hover{background:rgba(37,99,235,.08)}

/* ═══ شرائح التحكم ═══ */
.gx-chips{display:inline-flex;gap:4px;background:var(--ia-soft);border-radius:11px;padding:3px;flex-wrap:wrap}
.gx-chip{border:none;background:transparent;color:var(--ia-sub);font-family:inherit;font-size:11.5px;
  font-weight:700;padding:5px 12px;border-radius:8px;cursor:pointer;transition:all .15s;white-space:nowrap}
.gx-chip:hover{color:var(--ia-text)}
.gx-chip.on{background:var(--ia-card);color:var(--ia-text);box-shadow:0 1px 3px rgba(15,23,42,.12)}

/* ═══ KPI ═══ */
.gx-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.gx-kpi{background:var(--ia-card);border:1px solid var(--ia-border);border-radius:16px;
  box-shadow:0 1px 2px rgba(15,23,42,.05);padding:15px 17px 11px;display:flex;flex-direction:column;
  cursor:pointer;transition:transform .18s,box-shadow .18s,border-color .18s;min-width:0;text-align:start;
  font-family:inherit;border-width:1px}
.gx-kpi:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(15,23,42,.09);border-color:var(--ia-border2)}
.gx-kpi:focus-visible{outline:2.5px solid #2563EB;outline-offset:2px}
.gx-kpi-top{display:flex;align-items:center;gap:9px;margin-bottom:10px}
.gx-kpi-ico{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.gx-kpi-label{font-size:11px;font-weight:700;color:var(--ia-sub);letter-spacing:.4px;text-transform:uppercase}
.gx-kpi-val{font-size:24px;font-weight:800;color:var(--ia-text);letter-spacing:-.3px;line-height:1.1}
.gx-kpi-foot{display:flex;align-items:center;gap:7px;margin-top:7px;flex-wrap:wrap}
.gx-delta{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:800;
  border-radius:7px;padding:2px 7px}
.gx-delta.up{color:#059669;background:rgba(16,185,129,.1)}
.gx-delta.down{color:#DC2626;background:rgba(239,68,68,.1)}
.gx-delta.flat{color:var(--ia-sub);background:var(--ia-soft)}
.gx-kpi-sub{font-size:11px;color:var(--ia-muted);font-weight:600;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.gx-kpi-spark{margin-top:8px;height:34px;width:100%}

/* ═══ شبكات اللوحة ═══ */
.gx-grid-main{display:grid;grid-template-columns:1.75fr 1fr;gap:14px;margin-top:14px;align-items:start}
.gx-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px;align-items:start}
.gx-grid-23{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:14px;margin-top:14px;align-items:start}
.gx-col{display:flex;flex-direction:column;gap:14px;min-width:0}

/* ═══ جداول أعمال ═══ */
.gx-table{width:100%;border-collapse:collapse}
.gx-table th{font-size:10.5px;font-weight:800;color:var(--ia-muted);text-align:start;
  text-transform:uppercase;letter-spacing:.6px;padding:11px 14px;border-bottom:1px solid var(--ia-border);
  white-space:nowrap}
.gx-table td{padding:11px 14px;border-bottom:1px solid var(--ia-border3);font-size:13px;
  color:var(--ia-text2);vertical-align:middle}
.gx-table tbody tr:last-child td{border-bottom:none}
.gx-table tbody tr{transition:background .12s}
.gx-table tbody tr:hover{background:var(--ia-hover)}
.gx-td-main{font-weight:700;color:var(--ia-text)}
.gx-td-sub{font-size:11px;color:var(--ia-muted);font-weight:500;margin-top:1px}
.gx-invid{font-family:'Inter',monospace;font-size:12px;font-weight:700;color:#2563EB;
  background:rgba(37,99,235,.08);border-radius:7px;padding:3px 8px;white-space:nowrap;direction:ltr}

/* شارات الحالة: لون + نقطة + نص (لا الون وحده) */
.gx-st{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;
  border-radius:8px;padding:3px 10px;white-space:nowrap}
.gx-st::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0}
.gx-st.paid{color:#047857;background:rgba(16,185,129,.11)}
.gx-st.pending{color:#B45309;background:rgba(245,158,11,.13)}
.gx-st.overdue{color:#B91C1C;background:rgba(239,68,68,.1)}
.gx-st.draft{color:var(--ia-sub);background:var(--ia-soft)}
.gx-st.cancel{color:var(--ia-muted);background:var(--ia-soft);text-decoration:line-through}

/* أزرار أيقونية للصفوف */
.gx-rowacts{display:flex;gap:3px;justify-content:flex-end}
.gx-ibtn{border:none;background:transparent;color:var(--ia-sub);cursor:pointer;border-radius:8px;
  padding:6px;display:inline-flex;align-items:center;justify-content:center;transition:all .13s}
.gx-ibtn:hover{background:var(--ia-hover);color:var(--ia-text)}
.gx-ibtn:focus-visible{outline:2px solid #2563EB;outline-offset:1px}
.gx-ibtn.gx-danger:hover{background:rgba(239,68,68,.1);color:#DC2626}
/* r29 (M4): أهداف لمس ≥44px على الأجهزة الخشنة اللمس فقط — الحواسيب تبقى مضغوطة */
@media (pointer:coarse){.gx-ibtn{min-width:44px;min-height:44px}}

/* ═══ الإجراءات السريعة ═══ */
.gx-qas{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-top:14px}
.gx-qa{border:1px solid var(--ia-border);background:var(--ia-card);border-radius:14px;padding:14px;
  display:flex;flex-direction:column;align-items:flex-start;gap:9px;cursor:pointer;font-family:inherit;
  transition:transform .16s,box-shadow .16s,border-color .16s;min-width:0;text-align:start}
.gx-qa:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(15,23,42,.08);border-color:var(--ia-border2)}
.gx-qa:focus-visible{outline:2.5px solid #2563EB;outline-offset:2px}
.gx-qa-ico{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center}
.gx-qa-t{font-size:12.5px;font-weight:800;color:var(--ia-text)}
.gx-qa-s{font-size:10.5px;color:var(--ia-muted);font-weight:600;line-height:1.5}
.gx-qa.gx-primary{border:1.5px solid rgba(37,99,235,.4);background:linear-gradient(135deg,rgba(37,99,235,.07),rgba(37,99,235,.02))}
.gx-qa.gx-ai{border:1.5px solid rgba(212,175,55,.45);background:linear-gradient(135deg,rgba(212,175,55,.08),rgba(124,58,237,.05))}

/* ═══ رؤوس اللوحة ═══ */
.gx-dash-head{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}
.gx-dash-hi{font-size:22px;font-weight:800;color:var(--ia-text);letter-spacing:-.2px}
.gx-dash-hs{font-size:12.5px;color:var(--ia-muted);font-weight:600;margin-top:3px}
.gx-dash-date{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--ia-sub);font-weight:600;
  margin-top:5px;flex-wrap:wrap}
.gx-ranges{display:flex;gap:5px;flex-wrap:wrap;margin-inline-start:auto}
.gx-range{border:1.5px solid var(--ia-border2);background:var(--ia-card);color:var(--ia-sub);
  font-family:inherit;font-size:11.5px;font-weight:700;padding:6px 13px;border-radius:9px;cursor:pointer;
  transition:all .14s;white-space:nowrap}
.gx-range:hover{border-color:var(--ia-muted);color:var(--ia-text)}
.gx-range.on{background:#2563EB;border-color:#2563EB;color:#fff}
.gx-range:focus-visible{outline:2.5px solid #2563EB;outline-offset:2px}
.gx-custom{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.gx-custom input{border:1.5px solid var(--ia-border2);border-radius:9px;padding:5px 9px;font-family:inherit;
  font-size:11.5px;background:var(--ia-inp-bg);color:var(--ia-text)}

/* ═══ ملخص الإيرادات ═══ */
.gx-rev-grid{display:grid;grid-template-columns:minmax(0,1fr) 215px;gap:16px}
.gx-rev-sum{border-inline-start:1px solid var(--ia-border3);padding-inline-start:16px}
.gx-sum{display:flex;flex-direction:column;gap:2px}
.gx-sum-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;
  border-bottom:1px dashed var(--ia-border3)}
.gx-sum-row:last-child{border-bottom:none}
.gx-sum-l{font-size:12px;color:var(--ia-sub);font-weight:600;display:flex;align-items:center;gap:8px}
.gx-sum-v{font-size:14.5px;font-weight:800;color:var(--ia-text)}

/* ═══ الإشعارات والرؤى ═══ */
.gx-alert{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:11px;
  font-size:12.5px;font-weight:600;color:var(--ia-text2);line-height:1.55}
.gx-alert+.gx-alert{margin-top:6px}
.gx-alert.warn{background:rgba(245,158,11,.09)}
.gx-alert.bad{background:rgba(239,68,68,.08)}
.gx-alert.ok{background:rgba(16,185,129,.08)}
.gx-alert .gx-alert-ico{flex-shrink:0;margin-top:1px}
.gx-ai-rec{margin-top:10px;border:1px solid rgba(212,175,55,.35);background:linear-gradient(135deg,rgba(212,175,55,.07),rgba(124,58,237,.04));
  border-radius:13px;padding:13px 15px}
.gx-ai-rec-t{font-size:12.5px;font-weight:800;color:var(--ia-text);display:flex;align-items:center;gap:8px}
.gx-ai-rec-b{font-size:12px;color:var(--ia-text2);font-weight:600;line-height:1.7;margin-top:5px}
.gx-ins-row{display:flex;gap:11px;padding:11px 4px;border-bottom:1px dashed var(--ia-border3);font-size:12.5px}
.gx-ins-row:last-child{border-bottom:none}
.gx-ins-k{width:92px;flex-shrink:0;font-size:10.5px;font-weight:800;color:var(--ia-muted);
  text-transform:uppercase;letter-spacing:.5px;padding-top:2px}
.gx-ins-v{font-weight:600;color:var(--ia-text2);line-height:1.6;min-width:0}

/* ═══ العملاء/المنتجات ═══ */
.gx-cust{display:flex;align-items:center;gap:11px;padding:9px 2px;border-bottom:1px dashed var(--ia-border3)}
.gx-cust:last-child{border-bottom:none}
.gx-cust-av{width:34px;height:34px;border-radius:50%;color:#fff;display:flex;align-items:center;
  justify-content:center;font-weight:800;font-size:12px;flex-shrink:0}
.gx-cust-n{font-size:13px;font-weight:700;color:var(--ia-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gx-cust-s{font-size:11px;color:var(--ia-muted);font-weight:600}
.gx-legend{display:flex;flex-direction:column;gap:7px;margin-top:12px}
.gx-legend-row{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--ia-text2)}
.gx-legend-dot{width:10px;height:10px;border-radius:3.5px;flex-shrink:0}
.gx-legend-v{margin-inline-start:auto;font-weight:800;color:var(--ia-text)}
.gx-legend-p{color:var(--ia-muted);font-weight:700;font-size:11px;min-width:34px;text-align:end}

/* ═══ الحالة العالمية ═══ */
.gx-world{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.gx-world-i{text-align:center;padding:11px 6px;border-radius:12px;background:var(--ia-soft)}
.gx-world-v{font-size:17px;font-weight:800;color:var(--ia-text)}
.gx-world-l{font-size:10px;color:var(--ia-muted);font-weight:700;margin-top:2px;text-transform:uppercase;letter-spacing:.4px}

/* ═══ الحالات الفارغة/الخطأ/التحميل ═══ */
.gx-empty{padding:38px 18px;text-align:center}
.gx-empty-t{font-size:14.5px;font-weight:800;color:var(--ia-text);margin-top:12px}
.gx-empty-s{font-size:12px;color:var(--ia-muted);font-weight:600;margin-top:5px;line-height:1.7;
  max-width:340px;margin-inline:auto}
.gx-err{display:flex;flex-direction:column;align-items:center;gap:10px;padding:34px 18px;text-align:center}
.gx-sk{position:relative;overflow:hidden;background:var(--ia-skel);border-radius:8px}
.gx-sk::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);animation:gxShimmer 1.4s infinite}
[data-theme="dark"] .gx-sk::after{background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent)}
@keyframes gxShimmer{100%{transform:translateX(100%)}}

/* ═══ استجابة اللوحة ═══ */
@media (max-width:1100px){
  .gx-kpis{grid-template-columns:repeat(2,1fr)}
  .gx-qas{grid-template-columns:repeat(3,1fr)}
  .gx-grid-main{grid-template-columns:1fr}
  .gx-grid-23{grid-template-columns:1fr 1fr}
  .gx-grid-3{grid-template-columns:1fr 1fr}
}
@media (max-width:720px){
  .gx-rev-grid{grid-template-columns:1fr}
  .gx-rev-sum{border-inline-start:none;padding-inline-start:0;border-top:1px solid var(--ia-border3);padding-top:8px}
  .gx-kpis{display:flex;overflow-x:auto;gap:10px;scroll-snap-type:x mandatory;
    padding-bottom:6px;margin-inline:-14px;padding-inline:14px;
    scrollbar-width:none}
  .gx-kpis::-webkit-scrollbar{display:none}
  .gx-kpi{scroll-snap-align:start;flex:0 0 200px}
  .gx-qas{grid-template-columns:repeat(2,1fr)}
  .gx-grid-23,.gx-grid-3{grid-template-columns:1fr}
  .gx-world{grid-template-columns:repeat(3,1fr)}
  .gx-dash-hi{font-size:19px}
  .gx-ranges{margin-inline-start:0}
  .gx-kpi-val{font-size:21px}
  .gx-table .gx-hide-m{display:none}
}
@media (max-width:480px){
  .gx-qas{grid-template-columns:repeat(2,1fr)}
  .gx-card-h{padding:13px 14px 0}
  .gx-card-b{padding:11px 14px 14px}
  .gx-table th,.gx-table td{padding:9px 10px}
}
`;
