# Task r3-b — Backend payments API (agent: full-stack-developer)

## Task
Payment records backend: Prisma Payment model + GET/POST `/api/invoices/[id]/payments` + DELETE `/api/payments/[id]`, with atomic invoice `paid` updates and clamping.

## Files created / modified
1. `prisma/schema.prisma` — added `model Payment` (table `payments`) + `payments Payment[]` reverse relation on `Invoice`.
   - **Deviation from spec (justified):** the task spec'd `id String @default(cuid())` / `invoiceId String`, but the existing `Invoice.id` is `Int @id @default(autoincrement())` and Prisma requires FK type == referenced PK type. Adapted to `Int` ids (matches `parseIdParam()` and every other model in the schema). All other fields exactly as specced (`amount Float`, `method String @default("knet")`, `date String` YYYY-MM-DD, `note String?`, `createdAt DateTime @default(now())`, `onDelete: Cascade`).
2. `src/app/api/invoices/[id]/payments/route.ts` —
   - GET: payments for invoice, `orderBy: date desc, createdAt desc`, serialized `{id, invoiceId, amount, method, date, note, createdAt}`; 400 invalid id, 404 invoice not found.
   - POST: validates `amount > 0` (400 `"المبلغ يجب أن يكون أكبر من صفر"`); creates payment + bumps `invoice.paid = currentPaid + amount` inside ONE `db.$transaction` (interactive); clamps against total = `subtotal + taxAmount + shipping` → 400 `"المبلغ يتجاوز المتبقي على الفاتورة"` if exceeded; 404 invoice; 201 + serialized payment. **Invoice `status` deliberately untouched** (frontend derives display status from paid vs total). Defaults: `method` → "knet", `date` → today, `note` → null.
   - Uses a local `PaymentRouteError(status, message)` class so transaction-internal errors map to proper HTTP statuses.
3. `src/app/api/payments/[id]/route.ts` — DELETE: transaction finds payment (404 if missing), rolls parent invoice back `paid = max(0, paid − amount)`, deletes payment → 204.

## Helpers reused
`num()`, `readBody()`, `parseIdParam()`, `todayISODate()` from `src/lib/serialize.ts`; route style copied from `src/app/api/invoices/[id]/route.ts` (`RouteContext = { params: Promise<{id:string}> }` awaited — Next 16).

## ⚠ Operational note for future agents
After `prisma db push` regenerates the client, the **running dev server keeps the old PrismaClient in memory** (`db.payment` was `undefined` → route returned 400 TypeError). Touching `src/lib/db.ts` did NOT help (module cache). Fix: `touch next.config.ts` — Next dev detects the config change and **restarts itself** ("Found a change… Restarting"), reloading `@prisma/client`. No manual `bun run dev` needed. Remember this after any future schema change.

## Test results (curl, dev server :3000, invoice INV10007 id=8: paid 12, total 23.9)
| Step | Result |
|---|---|
| GET /api/invoices | 200, picked id 8 |
| GET /api/invoices/8/payments (before) | 200 `[]` |
| POST {amount:1.000, method:"knet", date, note} | **201** `{id:1, invoiceId:8, amount:1, method:"knet", …}` |
| GET /api/invoices/8 | paid **13** ✓ (+1) |
| GET payments list | 200, 1 row ✓ |
| POST amount 15 (remaining 10.9) | **400** `{"error":"المبلغ يتجاوز المتبقي على الفاتورة"}` ✓ |
| POST amount 0 / −5 | **400** `"المبلغ يجب أن يكون أكبر من صفر"` ✓ |
| POST/GET invoice 99999 | **404** `{"error":"Not found"}` ✓ |
| paid after failed posts | unchanged 13 ✓ |
| POST exact remaining 11.9 | **201**, paid = 23.9 == total (boundary allowed), status still "draft" ✓ |
| POST 0.001 more | **400** clamp ✓ |
| DELETE /api/payments/1 | **204**, paid back to 12 ✓ |
| DELETE /api/payments/999 | **404** ✓ |
| Cleanup + final DB check | 14 invoices, all `paid` values match original snapshot, `payments` table 0 rows ✓ |

## Quality gates
- `bunx eslint "src/app/api/invoices/[id]/payments" "src/app/api/payments" --ext .ts` → **0 errors**.
- `bunx tsc --noEmit` → 0 errors under `src/` (remaining errors are pre-existing scaffold: examples/, skills/).
- `bun run lint` full-project currently reports 2 errors + 1 warning — **all in the parallel frontend agent's files** (`PaymentsPanel.jsx`, `ReportsTab.jsx`, task r3-a), NOT in my backend files.
- `dev.log` tail: only 200/201/204/400/404 with expected codes; no runtime errors. (One HTML 404 in the log was my typo'd URL `/payports`.)

## Frontend contract check (integration with r3-a)
`src/components/invoice-app/api.js` already calls `listPayments` GET `/invoices/{id}/payments`, `addPayment` POST with `{amount, method, date, note}` (note:null handled), `deletePayment` DELETE `/payments/{id}` — **100% aligned with my routes**.
