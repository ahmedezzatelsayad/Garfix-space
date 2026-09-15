#!/usr/bin/env python3
"""
build-dict.py — Builds src/lib/app-dict-en.ts from:
  1. scripts/arabic-strings.json  (exact keys extracted via AST)
  2. scripts/translations-main.tsv (my AR→EN translations, trimmed keys)
  3. Giant HTML print templates are auto-translated via a curated label map
     + RTL→LTR mirroring (text-align/border-left/border-right swaps).
Validates: full coverage + {N} placeholder parity. Emits the TS module.
"""
import json, re, sys

ROOT = "/home/z/my-project"
data = json.load(open(f"{ROOT}/scripts/arabic-strings.json"))
details = data["details"]

# ── 1. Load TSV translations ──
tsv = {}
for line in open(f"{ROOT}/scripts/translations-main.tsv", encoding="utf-8"):
    line = line.rstrip("\n")
    if not line.strip() or "\t" not in line:
        continue
    ar, en = line.split("\t", 1)
    ar = ar.replace("\\n", "\n").strip()
    en = en.replace("\\n", "\n")
    tsv[ar] = en
print(f"TSV entries: {len(tsv)}")

# ── 2. HTML label map for giant print templates (longest first) ──
HTML_LABELS = [
    ("الشركة القابضة المتحدة ذ.م.م", "United Holding Group LLC"),
    ("تقادم الذمم (Aging)", "Receivables Aging"),
    ("نظام المشتريات المتكامل", "Integrated Purchases System"),
    ("كشف حساب {0} — {1}", "Account statement {0} — {1}"),
    ("فاتورة مشتريات {0}", "Purchase invoice {0}"),
    ("إجمالي فاتورة المشتريات", "Purchase invoice total"),
    ("📅 تاريخ الفاتورة:", "📅 Invoice date:"),
    ("فاتورة سارية", "active invoice"),
    ("شاملة الملغاة", "including cancelled"),
    ("إجمالي الفواتير", "Total Invoices"),
    ("الرصيد المستحق", "Outstanding Balance"),
    ("تاريخ الإصدار", "Issue Date"),
    ("تاريخ الاستحقاق", "Due Date"),
    ("المبلغ المستحق", "Amount Due"),
    ("المجموع الجزئي", "Subtotal"),
    ("إجمالي الفاتورة", "Invoice Total"),
    ("إجمالي المبيعات", "Total Sales"),
    ("إجمالي المدفوع", "Total Paid"),
    ("الرصيد النهائي", "Final Balance"),
    ("إجمالي الشراء (KD)", "Purchase Total (KD)"),
    ("سعر الشراء (KD)", "Purchase Price (KD)"),
    ("الكمية الإجمالية", "Total Qty"),
    ("المنتج / الخدمة", "Product / Service"),
    ("سجل الدفعات", "Payments History"),
    ("📦 فاتورة مشتريات", "📦 Purchase Invoice"),
    ("تم الإنشاء:", "Created:"),
    ("اسم المنتج", "Product Name"),
    ("المجموع الكلي", "Grand Total"),
    ("المورد:", "Supplier:"),
    ("ملاحظات:", "Notes:"),
    ("حتى تاريخ", "As of"),
    ("الرقم:", "No.:"),
    ("تاريخ الفاتورة", "Invoice Date"),
    ("التاريخ:", "Date:"),
    ("مدفوع", "Paid"),
    ("التاريخ", "Date"),
    ("الطريقة", "Method"),
    ("الفاتورة", "Invoice"),
    ("المتبقي", "Remaining"),
    ("الاستحقاق", "Due"),
    ("الإجمالي", "Total"),
    ("المدفوع", "Paid"),
    ("المبلغ", "Amount"),
    ("الحالة", "Status"),
    ("ملاحظة", "Note"),
    ("المسؤول", "Manager"),
    ("العميل", "Customer"),
    ("الوصف", "Description"),
    ("الكمية", "Qty"),
    ("سعر الوحدة", "Unit Price"),
    ("التوصيل", "Delivery"),
    ("صادرة إلى", "Billed To"),
    ("فـاتـورة", "INVOICE"),
    ("رقم", "No."),
    ("منتج", "product"),
    ("قطعة إجمالية", "total pcs"),
    ("كشف حساب", "Account Statement"),
    ("الضريبة", "Tax"),
    ("المورد", "Supplier"),
    ("فاتورة", "invoice"),
    ("ملاحظات", "Notes"),
]
HTML_LABELS.sort(key=lambda x: -len(x[0]))

def transform_html_template(ar: str) -> str:
    out = ar
    for ar_label, en_label in HTML_LABELS:
        out = out.replace(ar_label, en_label)
    # RTL → LTR mirroring
    out = out.replace('dir="rtl"', 'dir="ltr"').replace('lang="ar"', 'lang="en"')
    out = out.replace("direction:rtl", "direction:ltr")
    # swap text-align / border sides (two-step with sentinels)
    out = out.replace("text-align:right", "@@TA_R@@").replace("text-align:left", "@@TA_L@@")
    out = out.replace("@@TA_R@@", "text-align:left").replace("@@TA_L@@", "text-align:right")
    out = out.replace("border-left:", "@@BL@@").replace("border-right:", "@@BR@@")
    out = out.replace("@@BL@@", "border-right:").replace("@@BR@@", "border-left:")
    out = out.replace("border-left:", "@@BL2@@") if "@@BL2@@" in out else out
    out = out.replace("@@BL2@@", "border-left:")
    return out

# ── 3. Assemble exact-key dictionary ──
APP_EN = {}
missing, auto_html = [], []
for d in details:
    key = d["text"]  # exact (untrimmed for template-expr; trimmed otherwise)
    if d["kind"] == "template-expr":
        trimmed_key = key.strip()
        if trimmed_key in tsv:
            APP_EN[key] = tsv[trimmed_key]
        elif "<" in key and ("/" in key or "div" in key or "tr" in key or "span" in key or "DOCTYPE" in key):
            APP_EN[key] = transform_html_template(key)
            auto_html.append(key[:60])
        else:
            missing.append(key[:80])
    else:
        if key in tsv:
            APP_EN[key] = tsv[key]
        else:
            missing.append(f"[{d['kind']}] {key[:80]}")

# dedupe check for tsv entries that never matched (typos)
used = {v.strip() for v in APP_EN.values()}  # not useful; check keys instead
matched_tsv_keys = set()
for d in details:
    if d["kind"] == "template-expr":
        if d["text"].strip() in tsv:
            matched_tsv_keys.add(d["text"].strip())
    else:
        if d["text"] in tsv:
            matched_tsv_keys.add(d["text"])
unused_tsv = [k for k in tsv if k not in matched_tsv_keys]


# ── 3.5 Extra entries (server-side data names not captured by AST extraction) ──
EXTRAS = {
    "المجاني التأسيسي": "Founders Free",
    "البداية": "Starter",
    "الاحترافية": "Professional",
    "الأعمال": "Business",
    "🎁 لأول ١٠٠ مشترك": "🎁 For the first 100 subscribers",
    "مشترك": "subscriber(s)",
    "📊 الرئيسية": "📊 Dashboard",
    "إيرادات: {0}": "Revenue: {0}",
    "نسخة قديمة — ستُرحَّل بياناتها تلقائياً (المستخدمون وسجل التدقيق يُتخطيان)": "Legacy backup — data will be migrated automatically (users and audit log are skipped)",
}
APP_EN.update(EXTRAS)

# ── 4. Validate placeholder parity ──
def pholders(s):
    return sorted(re.findall(r"\{(\d+)\}", s))
parity_errors = []
for k, v in APP_EN.items():
    if pholders(k) != pholders(v):
        parity_errors.append((k[:60], pholders(k), pholders(v)))

print(f"APP_EN entries: {len(APP_EN)}")
print(f"Auto-translated HTML templates: {len(auto_html)}")
print(f"Missing translations: {len(missing)}")
for m in missing[:25]:
    print(f"  MISSING: {m}")
print(f"Unused TSV keys (possible typos): {len(unused_tsv)}")
for u in unused_tsv[:25]:
    print(f"  UNUSED: {u[:80]}")
print(f"Placeholder parity errors: {len(parity_errors)}")
for k, a, b in parity_errors[:10]:
    print(f"  PARITY: {k} AR={a} EN={b}")

if missing or parity_errors:
    print("\n>>> ERRORS — fix and re-run")
    sys.exit(1)

# ── 5. Emit TS module ──
lines = [
    "/**",
    " * app-dict-en: قاموس ترجمة التطبيق (عربي → إنجليزي) — r20.",
    " * المفاتيح هي النصوص العربية المصدر نفسها (من استخراج AST لكامل التطبيق)،",
    " * والقيم ترجمات إنجليزية كاملة تشمل قوالب الطباعة HTML (مقلوبة الاتجاه LTR).",
    " * مولّد آلياً بسكربت scripts/build-dict.py — أعد توليده بعد أي تعديل نصوص.",
    " */",
    "",
    "export const APP_EN: Record<string, string> = {",
]
for k in sorted(APP_EN):
    lines.append(f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(APP_EN[k], ensure_ascii=False)},")
lines.append("};")
lines.append("")
open(f"{ROOT}/src/lib/app-dict-en.ts", "w", encoding="utf-8").write("\n".join(lines))
print(f"\n✅ written {ROOT}/src/lib/app-dict-en.ts ({len(APP_EN)} entries)")
