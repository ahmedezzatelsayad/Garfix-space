import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/ai-provider";
import { getSession, getSessionAppUser, aiRateLimited, noteAiAction, aiRateLimitedResponse } from "@/lib/auth-server";
import { checkAiQuota, incrAiInvoices } from "@/lib/plans";

/**
 * r16: الإدخال المجمع بالذكاء الاصطناعي — «زرار المعالجة والإضافة بالذكاء الاصطناعي»
 *
 * POST /api/ai/process-bulk { rawText }
 *   → 200 { orders: BulkOrder[], model, provider, latencyMs }
 *
 * يحوّل نصاً حراً (عربي/إنجليزي/مختلط — بصيغة الإيموجي أو أي صيغة أخرى) إلى
 * طلبات منظّمة جاهزة للمراجعة ثم الحفظ كفواتير — بلا افتراض أي أسعار غائبة.
 * تحقق صارم بعد الموديل: كميات 1-9999، أسعار ≥ 0، أسماء نصية، هاتف منظّف.
 */

interface BulkItem {
  name: string;
  desc: string;
  qty: number;
  price: string;
}
interface BulkOrder {
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  items: BulkItem[];
  shipping: number;
}

const MAX_TEXT = 20_000;
const MAX_ORDERS = 50;

export async function POST(req: NextRequest) {
  // جلسة صالحة مطلوبة (أي دور — نفس سياسة بقية مميزات AI)
  const sess = getSession(req);
  if (!sess) {
    return NextResponse.json({ error: "الجلسة غير صالحة — سجّل الدخول من جديد", code: "SESSION_REQUIRED" }, { status: 401 });
  }

  // r29 (S3): حد معدل موحّد لمسارات الذكاء (30 إجراء/5 دقائق لكل مستخدم)
  const userId = sess.email;
  if (await aiRateLimited(userId)) return aiRateLimitedResponse();

  try {
    const body = await readJsonBody(req);
    const rawText = typeof body.rawText === "string" ? body.rawText : "";
    if (!rawText.trim()) {
      return NextResponse.json({ error: "أدخل نص الطلبات أولاً" }, { status: 400 });
    }
    if (rawText.length > MAX_TEXT) {
      return NextResponse.json({ error: `النص أطول من الحد (${MAX_TEXT} محرف)` }, { status: 413 });
    }

    // r17: حصة المشترك — فواتير الذكاء الاصطناعي الشهرية محدودة بخطته
    // (تُحتسب بعدد الطلبات المستخرجة فعلياً؛ التقدير المبدئي يمنع تجاوز الحد بطلبات ضخمة)
    const subscriber = await getSessionAppUser(req);
    if (subscriber) {
      const blocks = rawText.split(/\n\s*\n/).filter((b) => b.trim()).length;
      const quota = await checkAiQuota(subscriber.appUser, Math.max(1, Math.min(blocks, MAX_ORDERS)));
      if (!quota.ok) {
        return NextResponse.json(
          { error: quota.message, code: quota.code, usage: quota.usage },
          { status: 403 },
        );
      }
    }

    const systemPrompt = `You are the bulk-order parser for a Kuwaiti invoicing system (Arabic-first).
Input: free-form text of MULTIPLE customer orders, separated by blank lines (each block = one customer order).
Orders may be in Arabic, English or mixed, in ANY format — the common Kuwaiti WhatsApp format uses emoji fields:
📍 الاسم (name) · 📞 الهاتف (phone) · 🏠 العنوان (address) · 🛠️ الطلب (product) · 💰 السعر (price) · 🚚 التوصيل (delivery).
But also accept any other layout (plain lines "name phone product qty price", tables, etc.).

Rules:
- ONE order per blank-line-separated block. If a block contains multiple different products for the same customer, emit them as multiple items of that single order.
- Quantity: detect Arabic numerals (٥=5), Arabic words (واحد=1 … عشرة=10, اربع=4 …), digits, "×2". Default 1.
- price = unit price per item. shipping = delivery fee (0 if "مجاني"/"free"/absent). All numbers as plain digits.
- Phone: digits only with optional leading + (keep as given, strip spaces/dashes). clientAddress: "" if absent.
- If price is absent for an item → price = "" (NEVER invent prices).
- clientName: use the given name; if only a phone exists, use the phone as name.
- Clean up each product name (fix typos, remove filler words) but keep it short and faithful.

Respond ONLY with a JSON object: { "orders": [ { "clientName": "", "clientPhone": "", "clientAddress": "", "items": [ { "name": "", "desc": "", "qty": 1, "price": "" } ], "shipping": 0 } ] }
No markdown, no commentary. prices as strings or numbers (we accept both).`;

    const completion = await chatComplete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawText.trim() },
      ],
      { json: true, maxTokens: 4000 },
    );

    // r29 (S3): احتساب الإجراء عند نداء المزوّد فعلياً
    await noteAiAction(userId);

    let parsed: unknown;
    try {
      const raw = (completion.content || "{}")
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "المعالجة الذكية أرجعت بيانات غير صالحة — حاول مرة أخرى", raw: (completion.content || "").slice(0, 400) }, { status: 502 });
    }

    const rec = (parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}) as Record<string, unknown>;
    const ordersRaw = Array.isArray(rec.orders) ? rec.orders : Array.isArray(parsed) ? parsed : [];

    // ── تحقق وتطبيع بعد الموديل (لا نثق بأي مدخل) ──
    const num = (v: unknown): number => {
      const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^\d.]/g, ""));
      return Number.isFinite(n) ? n : NaN;
    };
    const cleanStr = (v: unknown, max = 120): string =>
      typeof v === "string" ? v.trim().slice(0, max) : "";

    const orders: BulkOrder[] = [];
    for (const o of ordersRaw.slice(0, MAX_ORDERS)) {
      if (!o || typeof o !== "object") continue;
      const r = o as Record<string, unknown>;
      const itemsRaw = Array.isArray(r.items) ? r.items : [];
      const items: BulkItem[] = [];
      for (const it of itemsRaw.slice(0, 60)) {
        if (!it || typeof it !== "object") continue;
        const ir = it as Record<string, unknown>;
        const name = cleanStr(ir.name, 140) || cleanStr(ir.product, 140);
        if (!name) continue;
        const qty = Math.min(9999, Math.max(1, Math.round(num(ir.qty)) || 1));
        const priceN = num(ir.price);
        items.push({
          name,
          desc: cleanStr(ir.desc, 200),
          qty,
          price: Number.isFinite(priceN) && priceN >= 0 ? String(Math.min(priceN, 1_000_000)) : "",
        });
      }
      if (!items.length) continue;
      const shipN = num(r.shipping);
      orders.push({
        clientName: cleanStr(r.clientName, 120) || cleanStr(r.client_name, 120) || "عميل",
        clientPhone: cleanStr(r.clientPhone, 20).replace(/[^\d+]/g, ""),
        clientAddress: cleanStr(r.clientAddress, 160),
        items,
        shipping: Number.isFinite(shipN) && shipN > 0 ? Math.min(shipN, 100_000) : 0,
      });
    }

    if (!orders.length) {
      return NextResponse.json({ error: "لم يستطع المساعد استخراج أي طلب من النص — وضّح الطلبات (كل طلب بسطر/كتلة)" }, { status: 422 });
    }

    // r17: احتساب الاستخدام الفعلي للمشترك (بعد نجاح المعالجة)
    if (subscriber) {
      await incrAiInvoices(subscriber.appUser.id, orders.length);
    }

    return NextResponse.json({
      orders,
      model: completion.model,
      provider: completion.provider,
      latencyMs: completion.latencyMs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function readJsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
