# Worklog

---
Task ID: 1
Agent: Main (Super Z)
Task: إصلاح ال顶栏 المحمول 390px (من جلسة سابقة)

Work Log:
- TopBar.jsx: class `gx-tb-cur` → `gx-tb-curwrap` (حل تعارض مع span الداخلي)
- AppShell.jsx: زر AI أُضيف له class `gx-tb-aitoggle`
- shell-css.js: `@media (max-width:768px)` يخفي lang/curwrap/country/theme/aitoggle
- تم التحقق في المتصفح على 390px: تظهر فقط gx-burger + gx-search + gx-tb-bell + gx-tb-user، scrollW=390=viewport بلا تجاوز

Stage Summary:
- الإصلاح مكتمل ومُتحقق منه بصرياً (لقطة: scripts/mobile-topbar-390.png)

---
Task ID: 2
Agent: Main (Super Z)
Task: حذف إسرائيل نهائياً + إصلاح الاشتراكات/حسابي + تعيين الفاوندر

Work Log:
- حذف إسرائيل:
  - i18n.ts: حذف لغة `he` (العبرية) من LANGUAGES + حذف قاموس HE كاملاً (75 سطراً) + حذف `he: HE` من TRANSLATIONS + تحديث العدّاد 28→27 لغة
  - countries-world.ts: فلسطين `currency: "ILS"` → `"JOD"`
  - geo.ts: حذف `ILS: 3.72` من أسعار الصرف الاحتياطية
  - HelloSlider.jsx: حذف بطاقة "שלום עולם"
  - i18n-app.ts + layout.tsx: حذف "he" من قوائم RTL
  - تحديث كل نصوص "28 لغة" → "27 لغة" في: FirebaseLogin، PublicNavbar، FounderTrustBlock، HelloSlider، Widgets، HomePage، Onboarding، app-dict-en
- تشخيص مشكلة الاشتراكات/حسابي:
  - السبب الجذري: خادم dev قديم كان يحمل متغير DATABASE_URL لـ PostgreSQL بينما schema هو sqlite → كل مسارات API ترجع 500 (PrismaClientInitializationError)
  - الخادم الحالي (بعد إعادة تشغيل الجلسة) يقرأ .env الصحيح ويعمل
  - اختبار curl: /api/auth/login و /api/subscription و /api/admin/subscriptions كلها تعمل
  - اختبار متصفح: تسجيل دخول كفاوندر → اختيار شركة → "حسابي" تعرض بطاقة الحساب المدمج بنجاح → تبويب "الاشتراكات" في لوحة الإدارة يعرض محرر الخطط والمشتركين والطلبات بنجاح، بلا أخطاء console
- الفاوندر:
  - ahmedezzatelsayad@gmail.com هو MASTER_EMAIL في: auth-server.ts (role: admin، كلمة المرور: admin123) و firebase/auth.js و firebase/users.js (كل الشركات + كل الصلاحيات)
  - isAdmin = true في AuthContext → ROLE_DEFAULTS.admin كاملة (13 صلاحية)
  - التحقق بالمتصفح: الظهور كـ "أحمد عزت الصياد Admin" مع وصول لوحة إدارة النظام والشركات الأربع
- next build: ✓ Compiled successfully

Stage Summary:
- إسرائيل/العبرية محذوفة بالكامل (قائمة اللغات 27 بلا עברית — متحقق في UI)
- الاشتراكات وحسابي تعملان (المشكلة كانت بيئة الخادم القديم، حُلّت بإعادة التشغيل)
- الفاوندر مفعّل بكل الصلاحيات (كلمة المرور: admin123)
- لقطات: scripts/account-test.png, scripts/subscriptions-test.png, scripts/mobile-topbar-390.png
