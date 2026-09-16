/**
 * gx-shell-css — نظام تصميم الغلاف العالمي (r25).
 *
 * GarfiX Business OS shell: شريط جانبي كحلي عميق ثابت + شريط علوي أبيض +
 * منطقة محتوى + لوحة AI يمينية + تنقّل سفلي للجوال.
 *
 * مبادئ:
 *  - خط Inter للاتينية و Cairo/Tajawal للعربية (سقوط تلقائي).
 *  - كل الاتجاهات منطقية (inset-inline/margin-inline/text-align:start) — RTL/LTR تلقائي.
 *  - أرقام جدولية (.gx-num) لكل القيم المالية.
 *  - حركات 150–250ms فقط، بلا مبالغة.
 *  - دعم الوضع الليلي عبر متغيرات --ia-* الموجودة (الشريط الجانبي كحلي دائماً).
 *  - استجابة حتى 390px بلا تمرير أفقي.
 */

export const GX_NAVY = "#07111F";
export const GX_NAVY2 = "#0B1E3A";
export const GX_ROYAL = "#2563EB";
export const GX_GOLD = "#D4AF37";

export const SHELL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Cairo:wght@400;600;700;900&display=swap');

/* ═══ الجذر والهيكل ═══ */
.gx-root{display:flex;min-height:100vh;background:var(--ia-bg);color:var(--ia-text);
  font-family:'Inter','Cairo','Tajawal',sans-serif;-webkit-font-smoothing:antialiased}
.gx-num{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}

/* ═══ الشريط الجانبي الكحلي ═══ */
.gx-sidebar{width:260px;flex-shrink:0;background:linear-gradient(180deg,${GX_NAVY} 0%,${GX_NAVY2} 100%);
  position:sticky;top:0;height:100vh;display:flex;flex-direction:column;z-index:300;
  border-inline-end:1px solid rgba(255,255,255,.06);transition:width .2s cubic-bezier(.2,.8,.3,1)}
.gx-sidebar.gx-collapsed{width:76px}
.gx-sb-scroll{flex:1;overflow-y:auto;overflow-x:hidden;padding:10px 12px 12px;
  scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.14) transparent}
.gx-sb-scroll::-webkit-scrollbar{width:5px}
.gx-sb-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:8px}

.gx-logo{display:flex;align-items:center;gap:10px;padding:16px 14px 10px;min-height:64px}
.gx-logo-mark{width:36px;height:36px;border-radius:11px;flex-shrink:0;
  background:linear-gradient(135deg,#f0d98c 0%,${GX_GOLD} 55%,#a8842a 100%);
  display:flex;align-items:center;justify-content:center;color:#1a1200;font-weight:900;font-size:19px;
  font-family:'Inter','Cairo',sans-serif;box-shadow:0 4px 14px rgba(212,175,55,.35)}
.gx-logo-txt{color:#fff;font-weight:800;font-size:16.5px;letter-spacing:.2px;white-space:nowrap}
.gx-logo-txt b{color:${GX_GOLD}}
.gx-logo-sub{color:rgba(255,255,255,.38);font-size:9.5px;font-weight:600;letter-spacing:1.6px;
  text-transform:uppercase;white-space:nowrap;margin-top:1px}

/* منتقي الشركة */
.gx-co{margin:2px 4px 10px;position:relative}
.gx-co-btn{width:100%;display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.055);
  border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:9px 10px;cursor:pointer;
  color:#fff;font-family:inherit;transition:background .15s,border-color .15s;text-align:start}
.gx-co-btn:hover,.gx-co-btn:focus-visible{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.22)}
.gx-co-logo{width:32px;height:32px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;
  justify-content:center;font-size:16px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.12)}
.gx-co-name{font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gx-co-role{font-size:10px;color:rgba(255,255,255,.45);font-weight:600;white-space:nowrap}
.gx-co-menu{position:absolute;top:calc(100% + 6px);inset-inline-start:0;width:calc(100% - 8px);
  background:#101d33;border:1px solid rgba(255,255,255,.14);border-radius:14px;
  box-shadow:0 18px 50px rgba(0,0,0,.55);padding:6px;z-index:50;animation:gxMenuIn .18s ease;
  max-height:300px;overflow-y:auto}
.gx-co-item{display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:9px;cursor:pointer;
  border:none;background:transparent;color:rgba(255,255,255,.85);font-family:inherit;font-size:12.5px;
  font-weight:600;width:100%;text-align:start;transition:background .12s}
.gx-co-item:hover,.gx-co-item:focus-visible{background:rgba(255,255,255,.09);color:#fff}
.gx-co-item.gx-on{background:rgba(37,99,235,.22);color:#fff}
.gx-co-item .gx-co-cur{margin-inline-start:auto;font-size:10px;color:rgba(255,255,255,.4);direction:ltr}

/* مجموعات التنقل */
.gx-grp{margin-top:14px}
.gx-grp-label{font-size:9.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
  color:rgba(255,255,255,.32);padding:0 10px 6px;white-space:nowrap}
.gx-nav-item{display:flex;align-items:center;gap:11px;width:100%;padding:8px 10px;border-radius:10px;
  border:none;background:transparent;color:rgba(255,255,255,.66);cursor:pointer;font-family:inherit;
  font-size:13px;font-weight:600;text-align:start;transition:background .15s,color .15s;
  position:relative;white-space:nowrap;margin-bottom:1px}
.gx-nav-item svg{flex-shrink:0;opacity:.85}
.gx-nav-item:hover,.gx-nav-item:focus-visible{background:rgba(255,255,255,.07);color:#fff;outline:none}
.gx-nav-item:focus-visible{box-shadow:inset 0 0 0 2px rgba(37,99,235,.7)}
.gx-nav-item.gx-active{background:linear-gradient(90deg,rgba(37,99,235,.28),rgba(37,99,235,.1));
  color:#fff;box-shadow:inset 0 0 0 1px rgba(37,99,235,.35)}
.gx-nav-item.gx-active svg{opacity:1;color:#7cb0ff}
.gx-nav-item.gx-active::before{content:"";position:absolute;inset-inline-start:-12px;top:20%;bottom:20%;
  width:3px;border-radius:0 4px 4px 0;background:${GX_GOLD}}
[dir="rtl"] .gx-nav-item.gx-active::before{border-radius:4px 0 0 4px}
.gx-nav-badge{margin-inline-start:auto;background:rgba(239,68,68,.9);color:#fff;font-size:9.5px;
  font-weight:800;border-radius:99px;padding:1px 6px;min-width:18px;text-align:center}
.gx-nav-badge.gx-amber{background:rgba(245,158,11,.92)}

/* بطاقة الاشتراك + المساعدة */
.gx-sub-card{margin:12px 4px 8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
  border-radius:14px;padding:12px}
.gx-sub-card .gx-plan{color:#fff;font-size:12.5px;font-weight:800;display:flex;align-items:center;gap:7px}
.gx-sub-card .gx-price{color:${GX_GOLD};font-size:15px;font-weight:800;margin-top:5px;letter-spacing:.2px}
.gx-sub-card .gx-price span{color:rgba(255,255,255,.45);font-size:10.5px;font-weight:600}
.gx-sub-manage{margin-top:9px;width:100%;border:none;border-radius:9px;padding:7px;cursor:pointer;
  background:rgba(255,255,255,.09);color:#fff;font-family:inherit;font-size:11.5px;font-weight:700;
  transition:background .15s}
.gx-sub-manage:hover{background:rgba(255,255,255,.16)}
.gx-help{display:flex;flex-direction:column;gap:1px;margin:0 4px 8px}
.gx-help a,.gx-help button{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:9px;
  border:none;background:transparent;color:rgba(255,255,255,.45);font-family:inherit;font-size:11.5px;
  font-weight:600;cursor:pointer;text-align:start;text-decoration:none;transition:color .15s,background .15s}
.gx-help a:hover,.gx-help button:hover{color:rgba(255,255,255,.85);background:rgba(255,255,255,.05)}
.gx-sb-collapse{border:none;background:transparent;color:rgba(255,255,255,.4);cursor:pointer;
  padding:9px;border-radius:9px;display:flex;align-items:center;justify-content:center;margin:4px 8px 10px;
  transition:color .15s,background .15s}
.gx-sb-collapse:hover{color:#fff;background:rgba(255,255,255,.07)}

/* الطي: إخفاء النصوص */
.gx-collapsed .gx-logo-txt,.gx-collapsed .gx-logo-sub,.gx-collapsed .gx-grp-label,
.gx-collapsed .gx-nav-item span,.gx-collapsed .gx-co-name,.gx-collapsed .gx-co-role,
.gx-collapsed .gx-sub-card,.gx-collapsed .gx-help,.gx-collapsed .gx-nav-badge{display:none}
.gx-collapsed .gx-logo{justify-content:center;padding-inline:0}
.gx-collapsed .gx-co-btn{justify-content:center;padding:7px}
.gx-collapsed .gx-nav-item{justify-content:center;padding:10px 0}
.gx-collapsed .gx-sb-collapse{margin-inline:auto}

/* ═══ العمود الرئيسي ═══ */
.gx-main{flex:1;min-width:0;display:flex;flex-direction:column}

/* الشريط العلوي */
.gx-topbar{position:sticky;top:0;z-index:200;background:var(--ia-card);
  border-bottom:1px solid var(--ia-border);display:flex;align-items:center;gap:8px;
  padding:0 16px;height:60px}
.gx-burger{display:none;border:none;background:transparent;color:var(--ia-sub);cursor:pointer;
  padding:8px;border-radius:9px}
.gx-burger:hover{background:var(--ia-hover)}
.gx-search{display:flex;align-items:center;gap:9px;background:var(--ia-inp-bg);cursor:pointer;
  border:1.5px solid var(--ia-border2);border-radius:11px;padding:8px 13px;min-width:0;
  flex:0 1 420px;color:var(--ia-sub);font-family:inherit;font-size:13px;transition:border-color .15s,box-shadow .15s}
.gx-search:hover{border-color:var(--ia-muted)}
.gx-search .gx-search-ph{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  text-align:start;font-weight:500}
.gx-kbd{display:inline-flex;gap:3px;flex-shrink:0}
.gx-kbd kbd{background:var(--ia-card);border:1px solid var(--ia-border2);border-bottom-width:2px;
  border-radius:6px;padding:1px 6px;font-family:'Inter',sans-serif;font-size:10.5px;font-weight:700;
  color:var(--ia-sub)}
.gx-top-spacer{flex:1}

.gx-top-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:7px;
  border:1.5px solid transparent;background:transparent;color:var(--ia-sub);cursor:pointer;
  font-family:inherit;font-size:12.5px;font-weight:700;padding:7px 11px;border-radius:10px;
  transition:background .15s,color .15s,border-color .15s;white-space:nowrap}
.gx-top-btn:hover{background:var(--ia-hover);color:var(--ia-text)}
.gx-top-btn:focus-visible{outline:2.5px solid ${GX_ROYAL};outline-offset:1px}
.gx-top-btn .gx-tb-flag{font-size:15px;line-height:1}
.gx-top-btn .gx-tb-label{max-width:96px;overflow:hidden;text-overflow:ellipsis}
.gx-dot-badge{position:absolute;top:4px;inset-inline-end:4px;min-width:16px;height:16px;border-radius:99px;
  background:#EF4444;color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;
  justify-content:center;padding:0 4px;border:2px solid var(--ia-card);box-sizing:content-box;
  margin:-2px}

/* قوائم منسدلة عامة */
.gx-menu{position:absolute;top:calc(100% + 8px);inset-inline-end:0;min-width:230px;
  background:var(--ia-card);border:1px solid var(--ia-border2);border-radius:14px;
  box-shadow:0 18px 50px rgba(15,23,42,.18);padding:6px;z-index:400;animation:gxMenuIn .16s ease}
.gx-menu.gx-menu-start{inset-inline-end:auto;inset-inline-start:0}
.gx-menu-scroll{max-height:340px;overflow-y:auto}
.gx-menu-label{font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;
  color:var(--ia-muted);padding:7px 10px 5px}
.gx-menu-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;cursor:pointer;
  border:none;background:transparent;color:var(--ia-text2);font-family:inherit;font-size:13px;
  font-weight:600;width:100%;text-align:start;transition:background .12s}
.gx-menu-item:hover,.gx-menu-item:focus-visible{background:var(--ia-hover);color:var(--ia-text);outline:none}
.gx-menu-item .gx-mi-end{margin-inline-start:auto;color:var(--ia-muted);font-size:11px;direction:ltr}
.gx-menu-sep{height:1px;background:var(--ia-border);margin:5px 8px}

/* المستخدم */
.gx-user{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:11px;cursor:pointer;
  border:none;background:transparent;font-family:inherit;transition:background .15s}
.gx-user:hover{background:var(--ia-hover)}
.gx-avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,${GX_NAVY2},${GX_ROYAL});
  color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;
  flex-shrink:0;letter-spacing:.3px}
.gx-user-meta{display:flex;flex-direction:column;align-items:flex-start;line-height:1.25;min-width:0}
.gx-user-name{font-size:12.5px;font-weight:700;color:var(--ia-text);max-width:120px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.gx-user-role{font-size:10px;color:var(--ia-muted);font-weight:600}

/* ═══ المحتوى ═══ */
.gx-content{flex:1;width:100%;max-width:1280px;margin:0 auto;padding:20px 24px 8px;min-width:0}

/* ═══ لوحة AI الجانبية ═══ */
.gx-ai-wrap{width:380px;flex-shrink:0;border-inline-start:1px solid var(--ia-border);
  background:var(--ia-card);position:sticky;top:0;height:100vh;display:flex;flex-direction:column;z-index:150}
.gx-ai-head{padding:13px 16px;border-bottom:1px solid var(--ia-border);display:flex;align-items:center;
  gap:9px;background:linear-gradient(135deg,${GX_NAVY} 0%,#12233f 100%);color:#fff;flex-shrink:0}
.gx-ai-badge{background:rgba(212,175,55,.18);color:${GX_GOLD};border:1px solid rgba(212,175,55,.4);
  font-size:9px;font-weight:800;letter-spacing:1px;border-radius:6px;padding:2px 7px;text-transform:uppercase}
.gx-ai-body{flex:1;min-height:0;display:flex;flex-direction:column}

/* ═══ لوحة الأوامر ⌘K ═══ */
.gx-cp-overlay{position:fixed;inset:0;background:rgba(7,17,31,.5);backdrop-filter:blur(3px);
  z-index:900;display:flex;align-items:flex-start;justify-content:center;padding:12vh 16px 16px;
  animation:gxMenuIn .15s ease}
.gx-cp{width:100%;max-width:620px;background:var(--ia-card);border:1px solid var(--ia-border2);
  border-radius:18px;box-shadow:0 30px 90px rgba(7,17,31,.4);overflow:hidden;
  display:flex;flex-direction:column;max-height:64vh}
.gx-cp-head{display:flex;align-items:center;gap:11px;padding:15px 18px;border-bottom:1px solid var(--ia-border)}
.gx-cp-input{flex:1;border:none;outline:none;background:transparent;font-family:inherit;font-size:15px;
  color:var(--ia-text);font-weight:600}
.gx-cp-input::placeholder{color:var(--ia-muted);font-weight:500}
.gx-cp-list{overflow-y:auto;padding:6px}
.gx-cp-item{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:11px;cursor:pointer;
  border:none;background:transparent;width:100%;text-align:start;font-family:inherit;transition:background .1s}
.gx-cp-item.gx-sel{background:rgba(37,99,235,.1);box-shadow:inset 0 0 0 1.5px rgba(37,99,235,.35)}
.gx-cp-item .gx-cp-icon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;
  justify-content:center;flex-shrink:0;background:var(--ia-soft);color:var(--ia-text2)}
.gx-cp-item .gx-cp-title{font-size:13.5px;font-weight:700;color:var(--ia-text);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.gx-cp-item .gx-cp-sub{font-size:11px;color:var(--ia-muted);font-weight:500;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.gx-cp-foot{padding:9px 16px;border-top:1px solid var(--ia-border);display:flex;gap:14px;
  font-size:10.5px;color:var(--ia-muted);font-weight:600}

/* ═══ الجوال: تنقّل سفلي + FAB ═══ */
.gx-bottom-nav{display:none;position:fixed;bottom:0;inset-inline:0;z-index:500;
  background:var(--ia-card);border-top:1px solid var(--ia-border2);
  padding:4px 6px calc(4px + env(safe-area-inset-bottom));
  box-shadow:0 -6px 24px rgba(7,17,31,.08)}
.gx-bn-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;
  border:none;background:transparent;color:var(--ia-muted);font-family:inherit;font-size:9.5px;
  font-weight:700;cursor:pointer;border-radius:10px;transition:color .15s;min-width:0}
.gx-bn-item.gx-active{color:${GX_ROYAL}}
.gx-bn-item span{max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gx-bn-ai{color:${GX_GOLD}}
.gx-fab{position:fixed;inset-inline-end:18px;bottom:calc(74px + env(safe-area-inset-bottom));z-index:600;
  width:54px;height:54px;border-radius:17px;border:none;cursor:pointer;color:#fff;
  background:linear-gradient(135deg,${GX_ROYAL} 0%,#1d4ed8 100%);display:none;align-items:center;
  justify-content:center;box-shadow:0 10px 28px rgba(37,99,235,.4);transition:transform .15s,box-shadow .15s}
.gx-fab:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(37,99,235,.5)}
.gx-fab:active{transform:scale(.93)}
.gx-fab-menu{position:fixed;inset-inline-end:18px;bottom:calc(136px + env(safe-area-inset-bottom));z-index:600;
  background:var(--ia-card);border:1px solid var(--ia-border2);border-radius:16px;
  box-shadow:0 18px 50px rgba(15,23,42,.22);padding:6px;width:216px;animation:gxMenuIn .18s ease}
.gx-fab-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:11px;cursor:pointer;
  border:none;background:transparent;color:var(--ia-text2);font-family:inherit;font-size:13px;font-weight:700;
  width:100%;text-align:start;transition:background .12s}
.gx-fab-item:hover{background:var(--ia-hover)}
.gx-fab-item.gx-ai{color:#7c3aed}

/* غطاء الجوال + الشريط المنزلق */
.gx-sb-backdrop{display:none}

@keyframes gxMenuIn{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes gxFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.gx-anim{animation:gxFadeUp .22s ease}

/* ═══ استجابة ═══ */
@media (max-width:1279px){
  .gx-sidebar{position:fixed;inset-block:0;inset-inline-start:0;height:100vh;
    transform:translateX(-100%);visibility:hidden;transition:transform .22s cubic-bezier(.2,.8,.3,1),visibility .22s}
  [dir="rtl"] .gx-sidebar{transform:translateX(100%)}
  .gx-sidebar.gx-open{transform:translateX(0);visibility:visible}
  .gx-sb-backdrop{display:block;position:fixed;inset:0;background:rgba(7,17,31,.55);z-index:290;
    animation:gxMenuIn .15s ease}
  .gx-burger{display:inline-flex}
  .gx-ai-wrap{display:none}
}
@media (max-width:900px){
  .gx-fab{display:flex}
  .gx-content{padding:14px 14px 96px}
  .gx-topbar{padding:0 10px;gap:6px;height:54px}
  .gx-search{flex:1}
  .gx-search .gx-search-ph{display:none}
  .gx-search{border-radius:10px;padding:8px 10px}
  .gx-search .gx-kbd{display:none}
  .gx-top-btn .gx-tb-label,.gx-top-btn .gx-tb-cur{display:none}
  .gx-top-btn{padding:7px 8px}
  .gx-user-meta{display:none}
  .gx-bottom-nav{display:flex}
}
@media (max-width:720px){
  /* الجوال الضيق: نُخفي منتقي الدولة (اللغة/العملة تكفيان) ليتسع الشريط بلا تمرير */
  .gx-tb-country{display:none}
}
@media (max-width:480px){
  .gx-search .gx-kbd{display:none}
  .gx-tb-theme{display:none}
  .gx-user{padding:6px 5px}
}
@media (max-width:640px){
  .gx-co-menu{width:min(280px,86vw)}
}
@media print{.gx-sidebar,.gx-topbar,.gx-bottom-nav,.gx-fab,.gx-ai-wrap{display:none!important}.gx-content{max-width:100%;padding:0}}
`;
