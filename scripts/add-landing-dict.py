#!/usr/bin/env python3
# r24: إضافة ترجمات EN الجديدة (اللاندينج العالمية + بوابة الدخول) إلى app-dict-en.ts
# يضيف المفاتيح الناقصة فقط (بلا تكرار) قبل نهاية الكائن مباشرة.
import json, re, io

PATH = "/home/z/my-project/src/lib/app-dict-en.ts"

NEW = {
  # ── PublicNavbar ──
  "ابدأ مجاناً": "Start Free",
  "مجاناً": "Free",
  "ابدأ مجاناً — لأول 100 شركة": "Start Free — first 100 companies",

  # ── HomePage: شريط الجاهزية + البطل ──
  "يعمل في 196 دولة": "Live in 196 countries",
  "28 لغة": "28 languages",
  "أي عملة": "Any currency",
  "AI Business OS — نظام تشغيل الأعمال الذكي": "AI Business OS — Invoices · Payments · Operations",
  "جارفيكس — نظام تشغيل ذكي للفواتير والمدفوعات وإدارة الشركات": "GarfiX — AI Business OS for Invoices, Payments & Operations",
  "أدِر الفواتير، التحصيل، العملاء، التقارير، والذكاء الاصطناعي من لوحة واحدة — لأي شركة في أي دولة، بأي عملة وبلغتك.": "Run invoices, payments, customers, reports, and AI actions from one global dashboard — any company, any country, any currency, in your language.",
  "دخول النظام": "Enter App",
  "شاهد عرض الـ90 ثانية": "Watch 90-sec Demo",
  "مجاني لأول {0} شركة — متبقي {1} مقعداً · بلا بطاقة": "Free for first {0} companies — {1} seats left · No card required",
  "مجاني لأول 100 شركة · بلا بطاقة ولا التزام": "Free for first 100 companies · No card, no commitment",
  "جرّبها بنفسك — بدّل اللغة والعملة والضريبة وشاهد النظام يتكيّف فوراً": "Try it yourself — switch language, currency, and tax, and watch the system adapt instantly",

  # ── أقسام اللاندينج ──
  "كل ما تحتاجه لتشغيل شركتك — في نظام واحد": "Everything you need to run your company — in one system",
  "وحدات قائمة فعلاً داخل GarfiX اليوم — ليست وعوداً على خارطة طريق": "Modules that exist in GarfiX today — not roadmap promises",
  "ذكاء اصطناعي ينفّذ — ولا يكتفي بالكلام": "AI that executes — not just talks",
  "اطلب فاتورة أو عميلاً أو دفعة من الشات، راجع المسودة كاملة، ثم وافق — يُنشأ كل شيء داخل نظامك": "Ask for an invoice, customer, or payment from chat, review the full draft, then approve — everything is created inside your system",
  "من فوضى واتساب إلى محاسبة نظيفة في ثوانٍ": "From WhatsApp chaos to clean accounting in seconds",
  "مصمم لطريقة عمل التجار فعلاً — لا شاشات معقدة ولا مصطلحات مترجمة حرفياً": "Built for how merchants actually work — no complex screens, no literally-translated jargon",
  "تسعير واحد واضح — بلا مفاجآت": "One clear price — no surprises",
  "ابدأ مجاناً لأول 100 شركة، ثم {0} شهرياً لكل شركة — بإلغاء في أي وقت": "Start free for the first 100 companies, then {0} per company per month — cancel anytime",
  "التسعير التفصيلي حسب بلدك ←": "Full country-based pricing",
  "مبني برؤية واضحة — وثقة تُكتسب بفاتورة": "Built on a clear vision — trust earned one invoice at a time",
  "نظام واحد ينمو مع كل شركة تنضم — ويتعلم من كل فاتورة تُصدر": "One system that grows with every company that joins — and learns from every invoice you issue",
  "شركات تعمل على GarfiX اليوم": "Companies running on GarfiX today",
  "جاهز تشغّل شركتك بذكاء؟": "Ready to run your company intelligently?",
  "أنشئ حسابك الآن — مجاناً لأول 100 شركة، بدون بطاقة ولا التزام. أول فاتورتك خلال دقيقتين.": "Create your account now — free for the first 100 companies, no card, no commitment. Your first invoice in two minutes.",
  "أنشئ حسابك المجاني": "Create your free account",

  # ── HeroDashboardMockup ──
  "صباح الخير، أحمد": "Good morning, Ahmed",
  "إجمالي الإيراد": "Total Revenue",
  "محصَّل": "Paid",
  "معلَّق": "Pending",
  "بحث…": "Search…",
  "نظرة على الإيراد": "Revenue Overview",
  "بانتظار الموافقة": "Pending approval",
  "بنك طاقة": "Power Bank",
  "شاحن سريع": "Fast Charger",
  "التوصيل": "Delivery",
  "مجاني": "Free",
  "أنشئ فاتورة لأحمد: 3 بنوك طاقة، شاحنين، والتوصيل مجاني": "Create an invoice for Ahmed: 3 power banks, 2 chargers, delivery free",
  "جاهزة للمراجعة — بانتظار موافقتك": "Ready for review — awaiting your approval",
  "اسأل GarfiX AI أي شيء…": "Ask GarfiX AI anything…",

  # ── GlobalControlStrip ──
  "اللغة": "Language",
  "الاتجاه": "Direction",
  "العملة": "Currency",
  "الضريبة": "Tax",
  "VAT مفعّل": "VAT enabled",
  "بدون ضريبة": "VAT disabled",
  "الدولة": "Country",

  # ── MODULES (FeatureModuleCard) ──
  "المدفوعات والتحصيل": "Payments & Collections",
  "إنشاء وتعديل، PDF عربي كامل، حالات دفع، واستيراد Excel/CSV.": "Create & edit, full Arabic PDF, payment statuses, Excel/CSV import.",
  "دفعات جزئية، روابط دفع، وتذكيرات واتساب للحوال المتأخرة.": "Partial payments, payment links, and WhatsApp reminders for overdue balances.",
  "العملاء 360°": "Customers 360°",
  "سجل موحّد للعميل، حد ائتمان، دمج المكررات، وكشف حساب تفصيلي.": "Unified customer record, credit limit, duplicate merging, and detailed statements.",
  "التقارير": "Reports",
  "مؤشرات لحظية، أعمار الديون، أفضل العملاء، وأفضل المنتجات.": "Live KPIs, debt aging, top customers, and top products.",
  "المساعد الذكي": "AI Assistant",
  "أنشئ فاتورة أو عميلاً أو دفعة من الشات — مع مراجعتك قبل التنفيذ.": "Create an invoice, customer, or payment from chat — with your review before execution.",
  "تعدد الشركات": "Multi-company",
  "لكل شركة عملتها ولونها وشعارها ومستخدموها وصلاحياتهم.": "Each company has its own currency, color, logo, users, and permissions.",

  # ── AiActionDemo ──
  "إعادة تشغيل العرض": "Replay demo",
  "إعادة": "Replay",
  "يحلّل الطلب ويرتب الفاتورة…": "Parsing the request and building the invoice…",
  "مسودة فاتورة — بانتظار مراجعتك": "Invoice draft — awaiting your review",
  "أحمد": "Ahmed",
  "المجموع الفرعي": "Subtotal",
  "ضريبة القيمة المضافة ({0}%)": "VAT ({0}%)",
  "معطّلة": "Disabled",
  "الموافقة والإنشاء": "Approve & Create",
  "تم إنشاء الفاتورة INV-1024 وإرسالها للعميل": "Invoice INV-1024 created and sent to the customer",
  "اكتب طلبك بلغتك": "Write your request in your language",
  "فاتورة، عميل، دفعة، أو سؤال تحليلي — من نفس الشات.": "Invoice, customer, payment, or an analytics question — all from the same chat.",
  "AI يجهّز الكيان كاملاً": "AI prepares the full entity",
  "يفهم البنود والكميات والأسعار ويرتب كل الحقول.": "It understands items, quantities, and prices, and fills every field.",
  "لا تنفيذ بدون مراجعتك": "No execution without your review",
  "كل إجراء يظهر كمسودة أولاً — أنت من يوافق وينشئ.": "Every action appears as a draft first — you approve, then it's created.",

  # ── PricingCard ──
  "باقة واحدة واضحة": "One simple plan",
  "/ شركة / شهرياً": "/ company / month",
  "أساس التسعير — بالدولار الأمريكي": "Pricing base — US Dollar",
  "تقريب تقريبي بعملة العرض — الأساس بالدولار": "Approximate display in your currency — base is USD",
  "فواتير غير محدودة مع PDF عربي كامل": "Unlimited invoices with full Arabic PDF",
  "عملاء غير محدودون مع سجل 360°": "Unlimited customers with 360° records",
  "مساعد ذكي جاهز — ينفذ بعد مراجعتك": "AI assistant ready — executes after your review",
  "تعدد العملات والشركات": "Multi-currency & multi-company",
  "دعم ضريبة القيمة المضافة": "VAT support",
  "تحصيل وتذكيرات واتساب": "Collections & WhatsApp reminders",
  "إلغاء في أي وقت — بلا التزام": "Cancel anytime — no commitment",
  "ابدأ مجاناً — بلا بطاقة": "Start Free — no card required",
  "مجاناً لأول {0} شركة": "Free for first {0} companies",
  "شركة": "companies",
  "تفاصيل الباقات حسب بلدك في صفحة التسعير — التسجيل الذاتي مفتوح الآن لأول 100 شركة.": "Plan details by country on the pricing page — self sign-up is open now for the first 100 companies.",

  # ── FounderTrustBlock ──
  "رسالة المؤسس": "Founder's message",
  "دولة بتغطية تسعيرية حسب بلد الزائر": "countries with geo-based pricing",
  "لغة لواجهة الموقع مع RTL/LTR كامل": "site languages with full RTL/LTR",
  "لكل شركة عملتها ورمزها وكسورها": "each company has its currency, symbol, and decimals",
  "PDF عربي": "Arabic PDF",
  "فواتير جاهزة للطباعة والإرسال": "print & send ready invoices",

  # ── BeforeAfter ──
  "قبل — الوضع الحالي": "Before — the old way",
  "طلبات واتساب متفرقة تضيع بين الشاتات": "Scattered WhatsApp requests lost between chats",
  "ملفات Excel غير متزامنة بين الفريق": "Excel files out of sync across the team",
  "أرقام ناقصة ومبالغ غير محدَّثة": "Missing numbers and stale amounts",
  "تحصيل متأخر بلا تذكير منظم": "Late collections with no organized reminders",
  "محتاج فاتورة آخر شهر 🙏": "I need last month's invoice 🙏",
  "أرسلها لك بكرة إن شاء الله": "I'll send it tomorrow, God willing",
  "آخر دفعة كانت كام بالضبط؟": "What exactly was the last payment?",
  "أنت": "You",
  "نسخة نهائية_v7 (محدثة 2).xlsx": "Final_v7 (updated 2).xlsx",
  "بعد — مع GarfiX": "After — with GarfiX",
  "كل طلب يتحول لفاتورة PDF منظمة في ثوانٍ": "Every request becomes an organized PDF invoice in seconds",
  "سجل عميل موحّد مع كشف حساب كامل": "A unified customer record with a full statement",
  "تذكيرات واتساب تلقائية للحوال المتأخرة": "Automatic WhatsApp reminders for overdue balances",
  "تقارير لحظية للإيراد والتحصيل": "Live reports for revenue and collections",
  "تذكير أُرسل تلقائياً": "Reminder auto-sent",
  "التحصيل +34%": "Collections +34%",
  "عميل موحّد 360°": "Unified customer 360°",

  # ── FirebaseLogin (بوابة SaaS) ──
  "أهلاً بك مجدداً": "Welcome back",
  "أنشئ شركتك الآن": "Create your company now",
  "لوحة واحدة للفواتير والعملاء والتحصيل — بأي عملة وبلغتك": "One dashboard for invoices, customers, and collections — any currency, your language",
  "إظهار كلمة المرور": "Show password",
  "مجاني لأول 100 شركة — بلا بطاقة": "Free for first 100 companies — no card",
  "28 لغة وأي عملة لكل شركة": "28 languages and any currency per company",
  "فواتير PDF عربية كاملة": "Full Arabic PDF invoices",
  "مساعد ذكي ينفّذ بعد مراجعتك": "AI assistant that executes after your review",
  "معاينة حية — هكذا ستبدو لوحتك": "Live preview — this is what your dashboard looks like",
  "تم إنشاء حسابك بنجاح{0}": "Your account was created successfully{0}",
  "شهرياً لكل شركة — بعد أول 100 شركة مجاناً": "per company/month — after the first 100 companies free",

  # ── PublicSite (الفوتر العالمي) ──
  "GarfiX — نظام تشغيل ذكي للفواتير والمدفوعات وإدارة الشركات: تعدد الشركات والعملات، المدفوعات الجزئية، وتذكيرات واتساب — لأي شركة في أي دولة.": "GarfiX — AI Business OS for invoices, payments & operations: multi-company, multi-currency, partial payments, and WhatsApp reminders — for any company in any country.",
  "إنشاء حساب مجاني": "Create a free account",
}

with io.open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

# المفاتيح الموجودة (سطر يبدأ بمفتاح مقتبس)
existing = set(re.findall(r'^\s*"((?:[^"\\]|\\.)*)":', src, re.M))

added, skipped = [], []
lines = []
for k, v in NEW.items():
    if k in existing:
        skipped.append(k)
        continue
    lines.append(f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)},")
    added.append(k)

if lines:
    # الإدراج قبل الإغلاقة الأخيرة "};"
    idx = src.rstrip().rfind("};")
    if idx < 0:
        raise SystemExit("لم يُعثر على نهاية الكائن `};`")
    block = (
        "  // ── r24: اللاندينج العالمية + بوابة الدخول (مضافة يدوياً — أبقِها عند إعادة التوليد) ──\n"
        + "\n".join(lines) + "\n"
    )
    out = src[:idx] + block + src[idx:]
    with io.open(PATH, "w", encoding="utf-8") as f:
        f.write(out)

print(f"أُضيف {len(added)} مفتاحاً جديداً، وتُخطّي {len(skipped)} موجوداً")
if skipped:
    print("الموجودة مسبقاً:", "; ".join(skipped[:12]), "…")
