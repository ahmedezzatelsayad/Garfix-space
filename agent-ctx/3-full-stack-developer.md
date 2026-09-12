# Task ID: 3 — Backend API routes (Next.js App Router)

Agent: full-stack-developer (backend API)
Scope: `src/app/api/**` + `src/lib/serialize.ts` only. No frontend files touched. Dev server (PID 1164, started 18:25) left running — never killed/restarted. Prisma schema untouched (already pushed).

## Created files (15)
- `src/lib/serialize.ts` — shared helpers: `num()`, `parseJsonArray()` (try/catch → []), `readBody()`, `parseIdParam()`, `todayISODate()`, serializers for Invoice/ProductCatalog/PurchaseInvoice (JSON-string columns parsed back to arrays, Float fields as numbers), dashboard helpers `invoiceTotal()` / `invoicePaymentStatus()`.
- `src/app/api/healthz/route.ts` — GET → {"status":"ok"}
- `src/app/api/invoices/route.ts` — GET (filters: companySlug exact, status exact, search contains clientName; orderBy createdAt desc) + POST (subtotal = num||lineItems-reduce||0; total = num||sub+ship; taxAmount = sub*rate/100; defaults INV${ts}/عميل/today/draft; lineItems JSON.stringify; 201 serialized; 400 on error)
- `src/app/api/invoices/[id]/route.ts` — GET/PUT/DELETE. PUT: partial-update semantics; FIXED original `num(x) ?? num(y)` bug with explicit `x !== undefined ? num(x) : num(existing)` checks (subtotal/shipping/total/taxRate); taxAmount only written when taxRate provided (original parity); @updatedAt auto-touches; 404 when missing; DELETE → 204.
- `src/app/api/invoices/[id]/status/route.ts` — PATCH {status} → serialized invoice (400 if status missing, 404 if invoice missing)
- `src/app/api/clients/route.ts` — GET (optional ?search= case-insensitive on name/email after fetch, createdAt desc) + POST (name required → 400 otherwise) → 201
- `src/app/api/clients/[id]/route.ts` — GET (client + totalInvoices + totalRevenue + serialized invoices by clientId), PUT (partial: name/email/phone/company/address), DELETE → 204
- `src/app/api/dashboard/stats/route.ts` — correct logic (original file was corrupted per worklog; rewrote from contract): payment-derived status cancel/paid/part/unp; paid→revenue+=tot; part→revenue+=paid, outstanding+=tot-paid, sentCount++; unp→outstanding+=tot, draftCount++; status==="overdue"→overdueCount++; overdue stays 0 (original parity); totalClients = db.client.count()
- `src/app/api/dashboard/recent-invoices/route.ts` — first 10 serialized, newest first
- `src/app/api/dashboard/revenue-by-month/route.ts` — group by issueDate.substring(0,7), revenue = subtotal+shipping, sorted ascending, slice(-12)
- `src/app/api/purchase-invoices/route.ts` — GET (companySlug filter, createdAt desc, items/sourceInvoiceIds parsed) + POST (defaults PUR${ts}/today/""/[]/[]/0; JSON.stringify items+sourceInvoiceIds; 201 parsed)
- `src/app/api/purchase-invoices/[id]/route.ts` — DELETE → 204 (deleteMany, no 404 — original parity)
- `src/app/api/catalog/route.ts` — GET (aliases parsed, prices number|null) + POST (400 "name required"; aliases→JSON string; 201 parsed)
- `src/app/api/catalog/[id]/route.ts` — PUT (partial; 404 if missing) + DELETE → 204
- `src/app/api/ai/process-items/route.ts` — z-ai-web-dev-sdk (BACKEND ONLY). System prompt copied EXACTLY from original ai-process.ts (Kuwaiti parser, Arabic numeral words, ٥=5, catalog matching, confidence 0.0–1.0, JSON-only response schema). SDK pattern: `ZAI.create()` → `chat.completions.create({ messages: [{role:'assistant', content: systemPrompt},{role:'user', content: rawText.trim()}], thinking: {type:'disabled'} })`. Strips ```json fences; extracts obj.items ?? obj.results ?? obj.products ?? [] (array used directly); 500 {error:"AI returned invalid JSON", raw} on parse failure; 400 {error:"rawText is required"}.

## Test results (curl against localhost:3000)
- healthz → {"status":"ok"}; all empty-state GETs → []
- POST invoice TEST1 → 201, lineItems parsed back to array, subtotal 3, total 3.5, shipping 0.5, paid 1 (contract numbers exact)
- GET ?companySlug filter, ?search (Arabic contains), by-id, 404 for missing id
- PUT partial {paid:3} → subtotal/shipping/total preserved (bug fix verified); PUT full frontend-style → subtotal 8, taxAmount 0.8, total 9, 2 items
- PATCH status → updated; missing status → 400
- Dashboard stats with data: {totalRevenue:2, outstanding:7, sentCount:1} for part-paid invoice (tot 9, paid 2) ✓; revenue-by-month → [{"month":"2025-01","revenue":9,"invoiceCount":1}] ✓; recent-invoices → 10 cap, lineItems parsed
- Catalog POST/GET/PUT/DELETE, 400 "name required", 404 on missing id
- Purchase-invoices POST (parsed items + sourceInvoiceIds), defaults verified (PUR…, today, "", [], 0), DELETE ×2 → 204
- Clients POST/GET/list+search/by-id (totals)/PUT/DELETE, 404 on missing
- AI: empty rawText → 400; real Arabic call → 200 with 3 items: ثلاثة→qty 3 matched catalog id 1 (confidence 1, purchasePrice 1.5), خمسة→5, "2 حليب"→2 — all numerals parsed correctly
- Cleanup: all test rows deleted (invoices/purchases/catalog/clients all return [] — DB left clean)
- `bunx eslint src/app/api src/lib/serialize.ts --ext .ts` → exit 0, zero errors; `tsc --noEmit` → zero errors in my files
- dev.log: no runtime errors from routes (only expected 400/404 JSON responses). Note: one "EADDRINUSE :::3000" at log line 1 came from the init-script's duplicate start attempt — original dev server (PID 1164) never stopped, verified alive via ps/ss.

## Notes for next agents
- Frontend `api.js` contract fully satisfied; `fromApiInvoice` reads invoiceNumber/lineItems/issueDate/paid/etc. — all present in serialized responses.
- Original PUT quirk kept: `total`/`subtotal` columns only rewritten when those keys are present in the body (frontend always sends them, so UI totals stay correct).
- Catalog GET ordered by id asc for determinism (original had no ORDER BY).
- `/api` root still returns template {"message":"Hello, world!"} — harmless, left in place.
