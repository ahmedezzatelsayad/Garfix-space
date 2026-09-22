/**
 * test-webhook-idempotency.ts — إعادة إرسال نفس حدثي order.created و
 * order.status_changed مرتين بتوقيع صحيح: النتيجة يجب أن تبقى فاتورة واحدة
 * ودفعة واحدة (القيود الفريدة externalRef تصدّ التكرار).
 */
import { createHmac } from "node:crypto";

const ERP = "http://localhost:3000/api/webhooks/stores";
const SECRET = "whsec_garfix_stores_p1";

const orderCreated = {
  event: "order.created",
  store: { slug: "garfix-demo", name: "بوتيك جارفكس التجريبي" },
  order: {
    number: "ORD-IDEM-TEST-1",
    customer: { name: "اختبار التكرار", phone: "55998877", governorate: "محافظة العاصمة", area: "الدسمة", address: "شارع 5" },
    items: [{ name: "سماعات لاسلكية Air Buds", quantity: 1, price: 8.0 }],
    subtotal: 8.0, shipping: 1.5, total: 9.5, currency: "KWD", affiliateCode: "GS-DEMO",
  },
};
const orderDelivered = {
  event: "order.status_changed",
  order: { number: "ORD-IDEM-TEST-1", status: "delivered" },
};

async function send(payload: object) {
  const raw = JSON.stringify(payload);
  const sig = createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  const res = await fetch(ERP, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Garfix-Signature": `sha256=${sig}` },
    body: raw,
  });
  return `${res.status} ${JSON.stringify(await res.json()).slice(0, 120)}`;
}

async function main() {
  console.log("created #1:", await send(orderCreated));
  console.log("created #2 (replay):", await send(orderCreated));
  console.log("delivered #1:", await send(orderDelivered));
  console.log("delivered #2 (replay):", await send(orderDelivered));
}

main();
