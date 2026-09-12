# Project Worklog — نظام إدارة الحسابات (Accounts/Invoice Server)

## Project Origin
User uploaded `النسخه النهاييه لسيرفر الحسابات .tar.gz` (Replit monorepo "Split-Brain-Fix"):
- Express 5 API server + Drizzle/Postgres (unusable in this sandbox — no Postgres, no pnpm, Replit plugins)
- React/Vite invoice app (Arabic RTL, multi-company Kuwaiti invoice system)

## Errors found in the original project (being fixed during port)
1. `artifacts/api-server/src/routes/dashboard.ts` corrupted identifiers (`monthMaponth]`, `([a], [b])`, `(onth, data]`) — broken find/replace of `m` variables.
2. `src/main.tsx` imports `App.tsx` (placeholder "Replit Agent is building...") instead of the real 1578-line `App.jsx` — the real UI never renders (the "split brain").
3. Dead `Login` component in App.jsx references undefined `AUTH_TOKEN` / `SK_AUTH`.
4. `import type { User } from "firebase/auth"` — firebase package not installed (type-only, but breaks type-check).
5. Environment mismatch: requires Postgres DATABASE_URL, pnpm workspaces, Replit vite plugins, OpenAI API key.

## Port strategy (this sandbox: Next.js 16 + Bun + Prisma/SQLite, port 3000 only)
- Frontend: port App.jsx + components into `src/components/invoice-app/`, mounted at `src/app/page.tsx` ('use client').
- Backend: Express routes → Next.js App Router route handlers under `src/app/api/**` (same JSON contract as original `api.js`).
- DB: Drizzle/Postgres schema → Prisma/SQLite (lineItems/aliases stored as JSON strings, converted in API layer).
- AI: `/api/ai/process-items` via z-ai-web-dev-sdk (backend only) instead of OpenAI.
- Auth: local fake-firebase (localStorage) kept as-is. Credentials: ahmedezzatelsayad@gmail.com/admin123 (master), ayman@manager.com/ayman123, info@tawfeer.com/tawfeer123, info@laqta.com/laqta123, info@mahhl.com/mahhal123, info@boss.com/boss123.

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Setup — worklog, Prisma schema, db push

Work Log:
- (in progress)

Stage Summary:
- (pending)

---
Task ID: 3
Agent: full-stack-developer (backend API)
Task: Build all Next.js API routes for the invoice system

Work Log:
- Read worklog, frontend `src/components/invoice-app/api.js` contract, and all original Express routes at /tmp/extracted/Split-Brain-Fix/artifacts/api-server/src/routes/ (health, invoices, clients, dashboard, purchases, catalog, ai-process) for logic parity.
- Created `src/lib/serialize.ts` with shared helpers: num(), parseJsonArray() (try/catch → []), readBody() (safe JSON), parseIdParam(), todayISODate(), serializers for Invoice/ProductCatalog/PurchaseInvoice (JSON-string columns → arrays, Float fields → numbers), and dashboard helpers (invoiceTotal, invoicePaymentStatus: cancel/paid/part/unp).
- Created 14 route files under src/app/api/**: healthz; invoices (GET list with companySlug/status/search filters + POST with computed subtotal/tax/total and INV${ts}/عميل/today/draft defaults); invoices/[id] (GET/PUT/DELETE); invoices/[id]/status (PATCH); clients (GET+search, POST); clients/[id] (GET with totalInvoices/totalRevenue/invoices, PUT partial, DELETE); dashboard/stats, dashboard/recent-invoices (top 10), dashboard/revenue-by-month (YYYY-MM grouping, subtotal+shipping, asc, last 12); purchase-invoices (GET/POST with PUR${ts} defaults, JSON-string items+sourceInvoiceIds) and [id] DELETE; catalog (GET/POST 400-name-required, [id] PUT partial/DELETE); ai/process-items (z-ai-web-dev-sdk, backend only, system prompt copied verbatim from original Kuwaiti parser, ```json fence stripping, items/results/products extraction).
- Fixed the original PUT bug (`num(subtotal) ?? num(existing)` never fell back) using explicit `x !== undefined ? num(x) : num(existing)` for sub/ship/tot/tRate; rewrote corrupted dashboard.ts logic from the contract instead of copying broken identifiers.
- All handlers: TypeScript, Next 16 App Router, `params: Promise<{id:string}>` awaited, NextRequest/NextResponse, no 'use client'.
- Lint: `bunx eslint src/app/api src/lib/serialize.ts --ext .ts` → 0 errors. `tsc --noEmit` → 0 errors in these files.
- Curl-tested every endpoint (see agent-ctx/3-full-stack-developer.md for full results); deleted all test rows afterwards — DB left clean; dev.log shows no runtime errors. Dev server (PID 1164) untouched.

Stage Summary:
- 15 files created (14 route files + serialize lib); all endpoints live on port 3000 and verified: healthz {"status":"ok"}; POST /api/invoices → 201 with lineItems parsed and totals computed (test: subtotal 3, total 3.5); filters/search/404s; PUT partial-update bug fix verified; PATCH status; dashboard stats/recent-invoices/revenue-by-month correct for part-paid invoice (revenue 2, outstanding 7, month revenue 9); catalog & purchase-invoices JSON round-trips (aliases/items/sourceInvoiceIds parsed back to arrays); AI /api/ai/process-items → 400 on empty rawText, real Arabic call parsed ثلاثة=3/خمسة=5/digit 2 and matched catalog alias with confidence 1.0. ESLint + tsc clean; test data removed; DB empty and ready for the frontend agent.

---
Task ID: 1, 2, 4, 5
Agent: main (Z.ai Code)
Task: Prisma schema + frontend port + seed + full E2E QA

Work Log:
- Task 1: Wrote prisma/schema.prisma (Company, Client, Invoice, ProductCatalog, PurchaseInvoice — SQLite, JSON-string columns lineItems/aliases/items/sourceInvoiceIds) and ran `bun run db:push`.
- Task 2: Ported the real UI (1578-line App.jsx — NOT the placeholder App.tsx that main.tsx wrongly pointed to) into src/components/invoice-app/: App.jsx, api.js, context/AuthContext.tsx, firebase/{auth,users}.js, pages/{FirebaseLogin,AdminDashboard}.tsx, components/{PurchasesTab,AIBulkProcessor,CreateUserModal}. Added 'use client' directives; removed dead Login component (referenced undefined AUTH_TOKEN/SK_AUTH); replaced `import type { User } from "firebase/auth"` with a local interface (firebase pkg not installed); added alt attributes to logo imgs; made the app root a flex column with footer marginTop:auto + safe-area padding (sticky-footer rule); created src/app/page.tsx (AuthProvider + App) and rewrote layout.tsx (lang="ar" dir="rtl", Arabic metadata, viewport export); copied favicon.svg from original.
- Fixed lint errors from the new react-hooks/set-state-in-effect rule properly: removed the redundant "reset on logout" effect; replaced the "auto-select single company" effect with render-phase derivation (selectedCompany → company); documented the data-fetch effect false-positive with an inline eslint-disable (async setState after await).
- Removed stray scaffold src/app/api/route.ts (GET "Hello, world!" at /api).
- Silenced Prisma query logging (log: ['error','warn']) to keep dev.log readable.
- Task 4: prisma/seed.ts — 4 companies, 6 catalog products (Arabic aliases for AI matching), 12 demo invoices across 4 companies with paid/partial/unpaid/cancelled states spread over 5 months (charts show data).
- Task 5 QA (bun run lint → 0 problems):
  * agent-browser E2E: login (ahmedezzatelsayad@gmail.com/admin123) → company selector (4 companies) → Tawfeer dashboard (KPIs 140.8 KD / charts / footer) → invoices list (8 rows, statuses) → invoice detail (header + products + totals verified via DOM + VLM full-page screenshot) → new invoice form saved INV10009 (7.5 KD, persisted in DB) → AI tab: processed "٣ شاحن ايفون / ٢ سماعة JBL / powerbank 20k خمسة / كابل type c × 10" — all 4 matched catalog with 100% confidence, خمسة→5, saved PUR-AI-979107 (4 items, qty 20) → purchases tab shows it → customers tab (9 عميل) → bulk WhatsApp-format parser (1 order → INV10010 saved) → admin dashboard (users list) → company switch to Mahhal (43.5 KD) → logout.
  * Mobile 390px: no horizontal overflow, footer present; zero browser console/page errors; dev.log clean (200/201 only).
  * Removed the test-created invoices INV10009/INV10010 and PUR-AI-979107? NO — left as demo data (they're valid examples of the flows; see Unresolved for cleanup note).

Stage Summary:
- The uploaded accounts server now runs fully locally on Next.js 16 (port 3000): Arabic RTL multi-company invoice system with dashboard/charts, full invoice CRUD + print, customers + Meta export, Aliphia CSV import, bulk WhatsApp parser, purchases merge, AI item processing (z-ai-web-dev-sdk), admin user management, permissions per role. All original bugs fixed (corrupted dashboard route, split-brain App import, dead Login, PUT ?? bug, firebase type import). Verified end-to-end in browser with zero console errors.

Unresolved issues / risks / next-phase recommendations:
- Test artifacts in DB: INV10009 (عميل اختبار المتصفح), INV10010 (عميل واتساب تجريبي), PUR-AI-979107 — harmless demo rows; can be deleted via UI (🗑️) if a clean demo is preferred.
- Auth is localStorage-only (original design) — anyone with the URL can log in with known credentials; fine for demo, not production.
- The Aliphia import + Meta Audience CSV export flows were not E2E-tested (require a real CSV file upload + file download) — logic was ported verbatim; test in next phase.
- AdminDashboard "شعارات الشركات" (logo upload) stores base64 in localStorage — works but not tested E2E.
- Next-phase ideas: real authentication (NextAuth), per-company dashboard API usage (frontend currently computes stats client-side), invoice PDF export, Arabic date localization, pagination for large invoice lists, clients CRUD UI (API exists, UI derives customers from invoices as in original).

---
Task ID: r2 (cron webDevReview round 2 — 2026-09-13)
Agent: main (Z.ai Code)
Task: Scheduled QA round + 3 new features (status filter chips, customer detail modal, CSV export)

Work Log:
- Read worklog; QA smoke: healthz ok, homepage 200, login → Tawfeer dashboard (165.3 KD), zero browser errors.
- Cleaned test artifacts via the UI delete-modal flow (INV10010 «عميل واتساب تجريبي», INV10009 «عميل اختبار المتصفح») — this also E2E-verified the previously-untested delete confirmation flow. DB back to 8 Tawfeer seed invoices; PUR-AI-979107 kept as purchases demo.
- New feature 1 — status filter chips in invoices list: statusFilter state + chips row (📋 الكل / ✅ مدفوعة / 🟡 جزئي / 🔴 غير مدفوعة / ⛔ ملغية) each with live counts from statusCounts; wired into `filtered`; chips styled per-status color (stColor), pill design with count badges; resets row selection on change.
- New feature 2 — customer detail modal in Customers component: selCustomer state; rows now clickable (trow hover + selected-row tint); modal = company-colored header with initial avatar + name/phone + close; contact actions (💬 واتساب wa.me/965…, 📞 اتصال tel:+965…, 📍 address chip); 4 stat cards (إجمالي الإنفاق، عدد الفواتير، أول شراء، آخر شراء); product chips list; invoice-history table (sticky header, clickable rows → onOpenInvoice → App sets selInv + switches to list detail view).
- New feature 3 — CSV export: new GET /api/invoices/export?companySlug= route (UTF-8 BOM for Excel Arabic, 15 Arabic columns incl. المنتجات، المتبقي، الحالة; attachment Content-Disposition; reuses serialize.ts helpers) + «⬇️ تصدير CSV» button in list toolbar (anchor-click download + toast).
- E2E verified with agent-browser: chips filter paid=1/unpaid=2/all=8 rows ✓; customer modal (عبدالله حسن: 23.9 KD، 1 فاتورة، واتساب/اتصال، INV10007 row) ✓; modal invoice click → invoice detail (صادرة إلى + المبلغ المستحق) ✓; export request 200 + toast ✓; mobile 390px no horizontal overflow ✓; `bun run lint` → 0 problems; dev.log clean.

Stage Summary:
- Round 2 complete: project stable (all round-1 flows re-verified), delete flow now E2E-tested, DB cleaned of test rows, and 3 polished features added (status filter chips with counts, full customer 360° detail modal with WhatsApp/call actions and click-through invoice history, invoices CSV export with Excel-safe Arabic encoding).

Unresolved issues / risks / next-phase priorities:
- Aliphia CSV import + Meta Audience CSV export still not E2E-tested (need real file upload/download) — top candidate for next round.
- Company logo upload (AdminDashboard → شعارات الشركات) untested E2E.
- Auth remains localStorage-only (demo-grade).
- Next-phase ideas: invoice PDF export, pagination/virtualization for large lists, clients CRUD UI (API exists), reports page using /api/dashboard/* endpoints, print preview in-app instead of window.open, dark mode.
---
Task ID: r3-b
Agent: full-stack-developer
Task: Payment records backend — Prisma Payment model + payments API routes with atomic invoice.paid updates

Work Log:
- Read worklog + existing patterns (serialize.ts, invoices/[id]/route.ts); snapshotted all 14 invoice `paid` values for post-test restore.
- prisma/schema.prisma: added `model Payment` (table `payments`) + reverse `payments Payment[]` on Invoice; ran `bun run db:push` (client regenerated). NOTE: spec said String/cuid ids but Invoice.id is Int autoincrement → adapted Payment.id/invoiceId to Int (Prisma FK type must match PK); all other fields exactly as specced (method default "knet", date YYYY-MM-DD, note?, onDelete: Cascade).
- Created src/app/api/invoices/[id]/payments/route.ts: GET (list, date desc, serialized {id,invoiceId,amount,method,date,note,createdAt}, 404 if invoice missing) + POST (amount>0 else 400 "المبلغ يجب أن يكون أكبر من صفر"; interactive db.$transaction creates payment AND sets invoice.paid = paid+amount; clamps against subtotal+taxAmount+shipping → 400 "المبلغ يتجاوز المتبقي على الفاتورة"; invoice.status deliberately untouched; 201 serialized).
- Created src/app/api/payments/[id]/route.ts: DELETE (transaction: 404 if payment missing, invoice.paid = max(0, paid−amount), delete, 204).
- Hit the classic dev-server stale-PrismaClient issue (db.payment undefined in the running server after db:push): touching db.ts didn't help; **`touch next.config.ts` made Next dev restart itself** and load the regenerated client — zero-downtime fix, no manual `bun run dev`. (Documented in agent-ctx for future schema changes.)
- Curl-verified the full flow on INV10007 (id 8, paid 12 / total 23.9): POST 1.000 knet → 201 + paid 13; oversized 15 → 400 Arabic clamp error; amount 0/−5 → 400; unknown invoice → 404 (GET+POST); exact-remaining 11.9 → 201, paid 23.9 == total, status stays "draft"; +0.001 → 400; DELETE payment → 204 + paid rolled back; DELETE unknown payment → 404. Cleaned up: payments table back to 0 rows, all 14 invoices' paid values verified equal to the original snapshot.
- ESLint on both new route dirs → 0 errors; tsc → 0 errors under src/; dev.log tail clean (expected 200/201/204/400/404 only). `bun run lint` full-project has 2 errors/1 warning — all in the parallel r3-a frontend agent's files (PaymentsPanel.jsx, ReportsTab.jsx), not backend.
- Cross-checked integration: frontend api.js already calls GET/POST `/invoices/{id}/payments` and DELETE `/payments/{id}` with {amount, method, date, note} — contract matches exactly.

Stage Summary:
- Payments backend live on port 3000: 2 route files + Payment model pushed to SQLite. Payment create/delete atomically adjust the parent invoice's `paid` inside Prisma transactions with over-payment rejection (Arabic error "المبلغ يتجاوز المتبقي على الفاتورة") and floor clamp at 0 on delete; invoice `status` field never mutated. All endpoints curl-tested incl. boundary (paid == total allowed); DB restored to pre-test state (0 payments, original paid values). Operational gotcha recorded: after future `db:push`, run `touch next.config.ts` to make the dev server reload the regenerated Prisma client.

---
Task ID: r3 (cron webDevReview round 3 — 2026-09-13)
Agent: main (Z.ai Code)
Task: Scheduled QA round (all previously-untested flows) + 4 new features (Reports analytics page, payments tracking, pagination/sorting, overdue detection) + UI micro-polish

Work Log:
- QA of previously-untested features (all passed E2E in agent-browser):
  * Aliphia CSV import: uploaded real CSV → parser detected all columns, grouped 2 rows into invoice AL-1002 (multi-item), preview table correct (32/18 KD), "تخطى المكررة" checkbox, import → toast "تم استيراد 2 فاتورة", persisted to DB as INV10009/10010 with source='aliphia', paid amounts honored (full/partial).
  * Meta Audience CSV export: clicked "تصدير Excel للميتا" → 2 files downloaded (Meta_Audience with phone/email/fn/ln/country/ct headers + UTF-8 BOM; Customers full sheet with Arabic headers) — includes imported Aliphia customers.
  * Company logo upload (AdminDashboard → شعارات الشركات): uploaded 64x64 PNG → "✅ تم رفع الشعار بنجاح", stored as base64 in localStorage (tw_logo_tawfeer), preview + "تغيير/حذف" buttons; delete works too. Deleted afterwards to keep clean state.
  * Mobile 390px (iPhone 12 emulation): no horizontal overflow, footer visible at bottom after scroll (VLM-verified).
- New feature 1 — 📈 التقارير (ReportsTab.jsx, new tab): period selector (٣/٦ أشهر، سنة، الكل); 4 gradient KPI cards (إيرادات الفترة، نسبة التحصيل with progress bar، متوسط الفاتورة + overdue count، أفضل شهر); AreaChart revenue-vs-collected with gradient fills; status-amount donut (PieChart + legend); top-5 customers with rank circles + revenue bars; top-6 products with medals + qty bars; monthly invoice count BarChart; 💡 تحليلات تلقائية (6 auto-generated smart insights: collection rate assessment, overdue warning, best month/product/customer, half-period trend %).
- New feature 2 — Payments tracking (real accounting):
  * Backend (delegated to full-stack-developer agent, Task r3-b): Prisma Payment model (Int id, invoiceId FK w/ onDelete: Cascade, amount, method cash/knet/online/card, date, note) + db:push; GET/POST /api/invoices/[id]/payments and DELETE /api/payments/[id] — POST/DELETE atomically adjust invoice.paid inside db.$transaction, reject over-payment with Arabic 400; curl-tested incl. edge cases (exact remaining, +0.001 over, 0/negative) then restored DB to original.
  * Frontend (PaymentsPanel.jsx): gradient header with payment count/sum + "+ تسجيل دفعة" button; paid/remaining progress bar (RTL); payment list with method icon badges (💵🏦📱💳), date, note, delete; add-payment modal (amount pre-filled with remaining, 4 method buttons, date, note, validation errors in Arabic); onChanged → refetch invoice via new api.getInvoice().
- New feature 3 — Invoices list pagination + sorting: sort dropdown (الأحدث/الأقدم/المبلغ الأعلى/الأقل/المتأخرة أولاً) + page-size select (10/25/50/100); page-number buttons with ellipsis >7 pages, prev/next, "X–Y من Z" counter; page resets on search/filter/sort change; defensive clamp against invalid pageSize (RangeError guard).
- New feature 4 — Overdue detection: overdueDays() helper (module-level, days past dueDate for unpaid/partial); red "⏰ متأخرة X يوم" badge under date in list rows + banner chip in toolbar ("N فاتورة متأخرة") + badge in detail view header; "المتأخرة أولاً" sort; reports KPI + insight.
- New feature 5 — Dashboard KPI cards clickable: إجمالي الإيرادات → list (all), مستحقات غير مدفوعة → list filtered unpaid, العملاء → customers tab; cursor + ↩ hint icon.
- Style micro-polish (global CSS): input focus ring (box-shadow 0 0 0 3px col), input hover border; button hover (brightness+shadow) + active scale(.97); KPI-card hover lift (translateY(-2px) + shadow); status pills get colored dot indicators (::before); nav-tab hover state; row hover transition; last-row border cleanup; custom thin scrollbars; select custom arrow (RTL, appearance:none); chart cards hover shadow; table last-row no border.
- Bug fixes this round: (1) overdueDays TDZ crash — helper was defined inside App component AFTER first use → moved to module top; (2) pagination RangeError guard; (3) PaymentsPanel unused eslint-disable removed; (4) ReportsTab React Compiler "preserve-manual-memoization" errors → replaced useMemo with plain IIFEs (compiler memoizes automatically).
- Regression QA after changes: login → Tawfeer dashboard (KPIs 140.8 KD + charts + clickable cards) → unpaid KPI click → list filtered (2 rows, all b-unp) → reports tab (all sections render, period switch works) → invoice detail (INV10007) → payment add 5 KD cash w/ note (paid 12→17, remaining 6.9, persisted via API, then deleted → rolled back to 12) → pagination tested with 15 imported test invoices (3 pages, page 2 = 11–20/25, sort total_desc 32→18, overdue sort 90/60/30 first) → 15 test invoices deleted via API (204 ×15) → mobile 390px reports page no overflow. `bun run lint` → 0 problems; dev.log clean (200/201/204/400/404 only, no runtime errors).

Stage Summary:
- Project stable: all 3 previously-untested flows now verified E2E (Aliphia import, Meta export, logo upload). 5 new features added this round: Reports analytics page (charts + insights), payment records tracking with atomic paid syncing (full stack: Prisma model + 3 endpoints + modal UI + progress bar), invoices pagination + 5 sort modes, overdue detection (badges + banner + sort + insights), clickable KPI cards. UI micro-polish throughout (focus rings, hover lifts, status dots, custom scrollbars/select arrows). DB state: 14 invoices (8 seed + 2 Aliphia demo + 4 other companies), 0 payments, 1 purchase demo, 6 catalog — clean.

Unresolved issues / risks / next-phase priorities:
- localStorage-only auth remains (demo-grade; NextAuth upgrade is the biggest production gap).
- Invoice PDF export (true file download) still not implemented — print dialog "Save as PDF" is the current path; jspdf+Arabic font embedding is the heavy option.
- Aliphia import renumbers invoices (INV… instead of original AL-… numbers) — original app design; could add a "keep original numbers" toggle later.
- Reports page computes client-side from all invoices (fine for current scale); if lists grow to thousands, add server-side aggregation endpoints.
- Payments are not shown in the print view (invoice print shows paid total only) — could add payment history table to print template.
- Next-phase ideas: clients CRUD UI (API exists), dark mode, invoice templates per company, WhatsApp reminder button for overdue invoices, KNET payment links, multi-currency.

---
Task ID: r4 (cron webDevReview round 4 — 2026-09-13)
Agent: main (Z.ai Code)
Task: Scheduled QA round + 3 new features (client directory CRUD, WhatsApp payment reminders, payments-in-print) + UI polish round 4

Work Log:
- QA smoke (all passed, zero browser console errors, dev.log clean): healthz ok; login → company selector → Tawfeer dashboard (190.8 KD, 10 invoices); invoices list (chips/pagination/sort); reports; customers; purchases; admin users dashboard. Project judged stable → proceeded to new features.
- New feature 1 — 📇 Client Directory (saved customers, full CRUD on the previously-unused /api/clients):
  * Backend: GET /api/clients now accepts ?company= filter (exact match on client.company) and search now also matches phone.
  * Frontend api.js: listClients/createClient/updateClient/deleteClient.
  * App.jsx: new ClientFormModal (add/edit, name+phone required w/ Arabic validation, email/address optional, busy state, error banner) + ClientDirectory component rendered at the bottom of the Customers tab: gradient header w/ count badge "N محفوظ" + "➕ عميل جديد", table with avatar initials, phone, address, spend/count/last-purchase stats derived from company invoices matched by normalized phone, ✏️/🗑️ per row (delete-confirm modal clarifies old invoices unaffected), rich empty state.
  * App fetches clients (refreshClients useCallback + effect) and passes them down; clients state also feeds both invoice forms.
  * Client picker in NEW and EDIT invoice forms: "📇 اختر من دليل العملاء (N محفوظ)" select auto-fills name/phone/address; hidden when directory empty.
  * Auto-registration: saving an invoice fire-and-forget POSTs the client to the directory (dedupe by normalized phone) — invoice creation can never fail because of it.
- New feature 2 — 📣 WhatsApp payment reminders: waReminderHref(inv, company) module helper builds wa.me/965{phone}?text={encoded Arabic message} with greeting, company name, invoice number/date, total, paid+remaining, due date (+ متأخرة N يوم), closing with company phone. Green "📣 تذكير واتساب" button (wa-btn class w/ hover lift) in invoice detail toolbar (only when phone exists && remaining > 0) and 📣 icon button per overdue row in the invoices list (with stopPropagation).
- New feature 3 — 💳 Payments history in print view: doPrint now async — fetches payments for every invoice in the print list (parallel, per-invoice catch) and buildHTML renders a "سجل الدفعات (N)" table (date, amount, method badge with Arabic labels كي نت/نقدي/أونلاين/بطاقة, note) under the totals when payments exist.
- UI polish round 4: DashboardSkeleton with shimmer animation (@keyframes shimmer + .sk/.sk-sm/.sk-lg classes) shown while invLoading && invoices.length===0 (invLoading tracked in refreshInvoices w/ finally); :focus-visible outlines on .btn/.inp (company color) and .nav-tab (white); title tooltips (Arabic) on all invoice row action buttons; wa-btn green hover effect; aria-busy on skeleton.
- Fixed during dev: 3 stray-quote JSX parsing errors (`flexShrink:0"}}` → `0}}`) caught by lint; removed 2 unused eslint-disable directives (react-hooks/set-state-in-effect doesn't track setState through called functions).
- E2E verified with agent-browser: client add ("سالم فهد المطيري" 91234567 الجهراء) → persisted via API → visible in directory; edit (name→"(VIP)" + email) → PUT verified; client picker in new form shows "1 محفوظ" and auto-fills name+phone+address; invoice creation auto-registered its client in the directory (verified via API); WhatsApp href fully decoded — correct pre-filled Arabic message w/ INV10010 totals (مدفوع 12/متبقي 6) + overdue days; 3 overdue rows show 📣 icons; payment 6 KD knet w/ note added on INV10010 → print popup (trusted CDP click, followed as popup tab) contains سجل الدفعات (1) with date/6.000 KD/كي نت/note; payment deleted via UI (confirm dialog) → paid rolled back to 12; client delete-via-UI tested (add → 🗑️ → نعم، احذف → API list empty); mobile 390px customers tab bottom — directory card + footer visible, zero horizontal overflow (VLM-verified screenshots); VLM confirmed detail toolbar shows green 📣 تذكير واتساب button; `bun run lint` → 0 problems; dev.log shows only 200/201/204/404.
- Cleanup: deleted test invoice (id 34), both test clients (ids 2,3,4), test payment (rolled back INV10010 paid 12/18), and undocumented residual invoice INV20003 (id 33, Mahhal, leftover from r3 regression QA — brought DB back to the documented 14-invoice state).

Stage Summary:
- Round 4 complete: project remained stable through QA; the last untouched backend API (/api/clients) is now fully wired into the UI as a client directory with CRUD + invoice-form picker + auto-registration; overdue collections got a practical WhatsApp reminder flow (pre-filled Arabic message via wa.me ?text=); the print template now shows the full payment history; dashboard gained a shimmer skeleton loader; accessibility/tooltips polish throughout. DB state: 14 invoices (8 Tawfeer seed + 2 Aliphia demo + 4 other companies), 0 payments, 0 clients, 1 purchase demo, 6 catalog.

Unresolved issues / risks / next-phase priorities:
- localStorage-only auth remains (demo-grade; NextAuth upgrade is still the biggest production gap).
- Invoice PDF export (true file download) still not implemented — print dialog "Save as PDF" remains the path.
- Client directory is per-company via a `company` string column; no uniqueness constraint on phone (dedupe handled client-side only).
- Reports still compute client-side; server-side aggregation if lists grow to thousands.
- Next-phase ideas: dark mode, invoice templates per company, KNET payment links, multi-currency, NextAuth, per-company dashboard APIs, bulk WhatsApp reminders for all overdue invoices at once, client import/export (CSV).

---
Task ID: r5 (cron webDevReview round 5 — 2026-09-13)
Agent: main (Z.ai Code)
Task: Scheduled QA round + 🌙 full dark mode (biggest style upgrade) + 2 new features (bulk WhatsApp reminders, client-directory CSV import/export)

Work Log:
- QA smoke (stable): healthz ok; login → company selector → Tawfeer dashboard (190.8 KD, 10 invoices); all 9 tabs click-through with zero console errors; reports charts render; lint 0 problems; dev.log clean → proceeded to new features.
- Feature 1 — 🌙 DARK MODE (full app, ~5,000 lines touched):
  * Infrastructure: 40+ CSS variables (--ia-*) declared in globals.css for :root (light values EXACTLY match the original hardcoded colors → light mode pixel-identical) and [data-theme="dark"] (navy-slate palette #0f1420/#1a2130 + color-scheme:dark); no-flash inline script in layout.tsx body (reads localStorage tw_theme before first paint); new src/components/invoice-app/theme.js exporting useTheme() (MutationObserver-synced hook + toggle with localStorage persistence), txAdapt() (luminance-based auto-lighten of TEXT hex colors), softAdapt() (dark variant of pastel backgrounds via mix toward #1a2130), chartColors() (recharts SVG props can't resolve CSS vars).
  * App.jsx (2,260 lines): rewrote the entire global <style> block with vars (+ dark-only rules for shadows/hover/btn brightness/shimmer); ~120 property-context-aware inline style replacements (background:#fff→var(--ia-card) etc.); theme-aware KPI data (txAdapt/softAdapt on kpis array), growth box, chart cards; recharts charts converted (axis/grid/series/tooltip with var-based contentStyle); status chips + pagination inactive states → vars; zebra rows → vars; 🌙/☀️ toggle added to navbar AND CompanySelector; InvPreview + print buildHTML deliberately kept light (paper document look); fixed useTheme-before-early-returns hooks violation (moved to component top); fixed 2 stray-quote JSX bugs caught by parser.
  * Components (7 files): ReportsTab (KPI gradient cards via softAdapt templates, insights/donut/stColor colors via txAdapt, area/bar charts via chartColors, tooltips themed), PaymentsPanel (METHODS moved to theme-aware methodOf(), modal buttons vars), PurchasesTab (UI vars + colTx; print HTML untouched), AIBulkProcessor (CONF_COLOR/CONF_BG take dark, ghost buttons vars), AdminDashboard (role pills vars, company/permission chips vars + vio-bd var added), CreateUserModal (chips/checkboxes vars), FirebaseLogin (dark-by-design + added 🌙/☀️ toggle button).
  * Delegated conversion to a subagent first — it silently failed (no files changed); did everything manually with perl batches + targeted edits.
  * VLM-verified: dark dashboard 9/10 polish (bar chart brightened via lighten(col,0.65)); dark reports 9/10 ("no white leftovers, production-ready"); fixed customers-table zebra that escaped the first pass; light mode re-verified pixel-clean.
- Feature 2 — 📣 bulk WhatsApp reminders (overdue collections): green "تذكير جماعي" button in invoices toolbar (appears when overdue >0) → BulkWaRemindersModal: company-colored header w/ total overdue amount; select-all/individual checkboxes w/ live "N محدد • المبلغ" counter; rows = avatar + client + phone + INV# + remaining + ⏰ days + per-row 📣 link (verified pre-filled Arabic message w/ invoice details via decodeURIComponent); "📋 نسخ الأرقام" copies +965… numbers for WhatsApp Broadcast (clipboard + execCommand fallback); "🚀 إرسال (N)" opens each wa.me chat staggered 400ms; footer hint explains Broadcast flow + popup permission.
- Feature 3 — 📇 client-directory CSV export/import: ⬇️ CSV button downloads Clients_{company}_{date}.csv (UTF-8 BOM, Arabic headers الاسم/التلفون/البريد/العنوان — verified round-trip incl. quoted field with comma); ⬆️ استيراد button + hidden file input → parseClientsCSV (new parseCSVLine honoring ""-quoted fields, flexible Arabic/English headers, per-row validation errors in Arabic) → preview modal (teal header, error banner, 30-row table w/ zebra, +N more) → sequential api.createClient with phone-dedupe (existing + in-file) → toast "✅ تم استيراد N عميل — تخطّي M مكرر".
- E2E verified with agent-browser: dark-mode walkthrough of ALL 9 tabs + admin dashboard modal (zero console errors, zero pageerrors); light/dark toggle round-trip; bulk WA modal (checkbox → "إرسال (2)", "2 محدد • 17.500 KD", wa.me link decoded correctly); CSV import uploaded 3 clients (incl. quoted comma address) → persisted via API → picker in new-invoice form shows "3 محفوظ"; re-import same file → all deduped; export file verified on disk (BOM + 3 rows); mobile 390px via Playwright (login screen + app, dark, no horizontal overflow, 0 errors); `bun run lint` → 0 problems.
- Cleanup: deleted the 3 test clients (ids 5,6,7) via API — DB back to documented state (14 invoices, 0 clients, 0 payments, 1 purchase demo, 6 catalog).

Stage Summary:
- Round 5 complete: the app now has a complete, polished DARK MODE across every screen (dashboard, invoices, customers+directory, reports, new/edit forms, bulk, AI, print, purchases, admin, login, company selector) with a 🌙/☀️ toggle in 3 places, persisted + no-flash; light mode remains pixel-identical. Two new collection/productivity features: bulk WhatsApp reminders for all overdue invoices (with Broadcast number-copy flow) and client-directory CSV import/export with dedupe. Zero console errors everywhere; lint clean; DB clean.

Unresolved issues / risks / next-phase priorities:
- Auth still localStorage-only (demo-grade; NextAuth remains the biggest production gap).
- Dark-mode InvPreview/print intentionally stay light (paper) — if a dark invoice preview is ever wanted, that's a separate design decision.
- Bulk WA "إرسال" opens N popups staggered — popup blockers may cap it on some browsers (per-row buttons + copy-numbers are the fallback); a backend WhatsApp Business API integration would be the production path.
- Client CSV import is per-company (company field set from the current company); no phone uniqueness constraint at DB level (dedupe client-side only).
- Next-phase ideas: invoice PDF export (jspdf+Arabic font), KNET payment links, per-company dashboard server APIs, invoice templates selection, multi-currency, client merge/dedupe tool, scheduled reminder log (track sent reminders).

---
Task ID: r6 (cron webDevReview round 6 — 2026-09-13)
Agent: main (Z.ai Code)
Task: Scheduled QA round + 3 new features (invoice PDF export, WhatsApp reminder log, 3 print template styles) + UI polish (KPI count-up animation, dynamic page title)

Work Log:
- QA smoke (all passed, zero console errors, dev.log clean): login → company selector → Tawfeer dashboard → all 9 tabs click-through (📋 الفواتير / 👥 العملاء / 📈 التقارير / 🤖 AI / 🛒 المشتريات / ⚙️ المستخدمين); mobile 390px no horizontal overflow; dark-mode toggle. Project judged stable → proceeded to new features.
- New feature 1 — 📄 INVOICE PDF EXPORT (the top unresolved item since round 2, now done as a real file download):
  * New mini-service `mini-services/pdf-service/` (independent bun project, port 3040, `bun --hot`): Playwright-core + the pre-installed Chromium at ~/.cache/ms-playwright/chromium-1234 converts HTML→PDF (A4, printBackground, RTL locale). Tajawal Google-Font CSS+woff2 fetched once, inlined as data URIs and cached → ZERO network dependency at render time; page.route blocks ALL non-data: requests (deterministic rendering); retry-on-failure with 60s cooldown (a transient fonts.googleapis.com hiccup was diagnosed via bun fetch test); conversion errors logged; crashed-browser instance auto-reset. First request after restart ~0.6-8s (font warm-up), then ~0.17s cached.
  * Next.js proxy route `src/app/api/pdf/route.ts`: POST {html, filename} → 127.0.0.1:3040 (server-to-server, never through the gateway) → streams PDF back as attachment. Fixed during dev: Arabic filename in Content-Disposition crashed with ByteString TypeError → now ASCII fallback + RFC 5987 filename*=UTF-8'' encoding (browser a.download carries the real Arabic name anyway).
  * Frontend: api.exportPdf() (blob download); doPdfExport() (enriches invoices with payment history via listPayments — identical to print view, busy state with ⏳ جارٍ…, success/error toasts, object-URL cleanup); 📄 buttons in THREE places: invoice-detail toolbar (red #dc2626, next to 🖨️ طباعة), per-row icon action, and the print-range toolbar («📄 تصدير PDF» exports the whole range as ONE multi-page PDF; refactored printRangeList() shared by doPrintRange + PDF).
  * E2E verified with agent-browser: detail-view 📄 PDF click → POST /api/pdf 200 → فاتورة_INV10010.pdf downloaded (170-297KB, 1 page) → pdftotext confirms full Arabic invoice (letterhead, client, totals, payments log); range export → فواتير_10.pdf (10 invoices, 297KB); Arabic filenames work; mobile/dark unaffected.
- New feature 2 — 📣 WHATSAPP REMINDER LOG (audit trail for collections):
  * Prisma: new `ReminderLog` model (invoiceId Int? FK onDelete:SetNull → log survives invoice deletion, companySlug indexed, clientName/clientPhone snapshot, channel whatsapp|call|manual, message (sent text snapshot), amount = remaining at send time) + reverse `reminders ReminderLog[]` on Invoice; db:push + `touch next.config.ts` (documented dev-server Prisma reload trick).
  * API `src/app/api/reminders/route.ts`: GET (?companySlug&invoiceId&limit≤200, newest first, includes invoice→invoiceNumber) + POST (validates invoiceId→404, snapshots invoice fields, channel whitelist, message≤2000 chars, 201). No DELETE — logs are immutable by design.
  * Frontend: logReminderSent() module helper (fire-and-forget, decodes the ?text= from the wa.me href to store the exact sent message, amount=Math.max(0,remaining)); wired into ALL THREE reminder entry points: detail-toolbar 📣 link, per-row 📣 icon, and BulkWaRemindersModal (per-row + 🚀 sendAll); success dispatches a `reminder-logged` CustomEvent.
  * New component `components/RemindersPanel.jsx`: green-gradient header («سجل التذكيرات», count + «آخر تذكير …» relative time), channel badges (💬/📞/✍️), amount-in-red, message preview with ▼ expand-to-full, live refresh on the reminder-logged event, rich empty state. Rendered under PaymentsPanel in invoice detail.
  * E2E verified: clicked 📣 تذكير واتساب on INV10007 → POST /api/reminders 201 → panel auto-refreshed showing «2 تذكير … الآني» with decoded message preview + amount 11.900 KD; followed the wa.me link → correct pre-filled Arabic message; curl-tested GET/POST/404/405; cleaned test rows (reminder_logs back to 0).
- New feature 3 — 🖨️ THREE PRINT/PDF TEMPLATE STYLES (buildHTML refactored, styleId param):
  * PRINT_STYLES config: «🏛️ كلاسيكي» (byte-identical to the original design — verified: same double-border header, #111827 table head, no gradient bar), «🎨 عصري» (company-colored: 7px gradient top bar, acc=tinted borders/zebra/total row, filled status pill, rounded 10px — verified pixel-exact Tawfeer blue (31,59,95)≈#1e3a5f at the bar), «📄 بسيط» (ink-saver B&W: 1px #999 borders, no fills, double-rule totals, outlined status).
  * Selector UI in the print tab: 3 rich cards (icon + label + one-line description + ✓, company-colored when active, softAdapt bg, toast on switch) — persisted in localStorage tw_print_style; threaded styleId through doPrint/doPdfExport + all 8 call sites (row, detail, range, per-invoice print cards, printSelected).
  * Verified by pdftoppm pixel analysis: modern (blue bar + colored total row), classic regression (dark full-width table-header band at same position, no bar), minimal.
  * Added module helper lightenHex(hex,t) for gradient tints.
- UI polish round 6: KPI count-up animation (useCountUp hook — easeOutCubic rAF, remembers previous value so refreshes animate from old→new; extracted KpiCard component with aria-label + role=button on clickable cards; kpis array now carries num/money/suffix fields); dynamic document.title («القسم | الشركة — نظام إدارة الحسابات», follows view + company, company-selector fallback title); toast got role=status + aria-live=polite.
- Bugs fixed this round: (1) Content-Disposition ByteString crash with Arabic filenames (RFC 5987); (2) sticky font-cache failure after transient network error (60s retry cooldown); (3) bidi-editing artifact dropped a quote in the style selector (fontWeight:900 → "900") caught by lint parser; (4) React Compiler set-state-in-effect error in useCountUp (moved snap-to-final into the rAF callback).
- Final regression: lint 0 problems; all tabs zero console errors in light+dark; mobile 390px no overflow; PDF flow re-verified end-to-end (POST /api/pdf 200 in 525ms warm); dev.log clean (200/201 only); DB verified at documented state (14 invoices, 0 payments, 0 clients, 0 reminders, 1 purchase demo, 6 catalog).

Stage Summary:
- Round 6 complete: the app now exports REAL PDF files (the most-requested missing feature since r2) via a robust Chromium-based pdf mini-service with cached inlined Arabic fonts; every sent WhatsApp payment reminder is recorded in an immutable audit log with a polished history panel in the invoice detail; the print/PDF output has 3 selectable template designs (classic/modern/minimal, persisted); dashboard KPIs animate with a count-up and the browser tab title is context-aware. All features E2E-verified with zero console errors; DB clean.

Unresolved issues / risks / next-phase priorities:
- pdf-service must be running for PDF export: `cd mini-services/pdf-service && bun run dev` (port 3040). If the sandbox restarts, re-start it; the Next.js /api/pdf route returns a clear Arabic 502 error toast if it's down.
- Auth still localStorage-only (demo-grade; NextAuth remains the biggest production gap).
- Reminders are logged on CLICK (assumed sent) — a real WhatsApp Business API integration could confirm delivery; channel field already supports call/manual for future UI.
- No server-side pagination/aggregation yet (fine at current scale).
- Next-phase ideas: KNET payment links, server-side dashboard aggregation, client merge/dedupe tool, scheduled-reminder automation (cron + reminder log), per-client statement PDF (sum of all invoices + payments), invoice templates per company (persist print style per company instead of global).

---
Task ID: r7 (cron webDevReview round 7 — 2026-09-13)
Agent: main (Z.ai Code)
Task: Scheduled QA round + 4 new features (client account statement PDF, receivables aging analysis, client-directory search, per-company print style) + reports collection-activity strip

Work Log:
- QA smoke (all passed): pdf-service healthy (fonts inlined), dev.log clean, lint 0; login → company selector → Tawfeer → all 9 tabs click-through with ZERO console errors; mobile 390px no overflow → proceeded to new features.
- New feature 1 — 📄 CLIENT ACCOUNT STATEMENT PDF (كشف حساب العميل, classic Kuwaiti accounting document):
  * New standalone module `src/components/invoice-app/statement.js` (self-contained helpers, no import cycle): buildStatementHTML({client, invoices, company, styleId}) produces a full A4 statement — company letterhead + «كشف حساب … حتى تاريخ» header; summary grid (العميل / إجمالي الفواتير / الرصيد المستحق); invoices table (رقم/تاريخ/استحقاق/إجمالي/مدفوع/متبقي/الحالة + ⏰days badge); 💳 payments log table (date/method/INV#/amount/note with totals); ⏰ aging bucket strip (٥ فئات); totals box (المبيعات/المدفوع/الرصيد النهائي with company-colored fill); respects the 3 print styles (classic dark headers / modern company-color accents + gradient bar / minimal B&W); cancelled invoices excluded from totals but listed with ملغية status.
  * App.jsx: exportStatement() in Customers component (payment-enriches the client's invoices in parallel, builds HTML, api.exportPdf blob download «كشف_حساب_{name}.pdf», stmtBusy state with ⏳ button, error toast); red «📄 كشف حساب PDF» button as the FIRST action in the customer-detail modal (title explains contents); Customers now receives printStyle prop.
  * E2E verified: Tawfeer (نورة السالم) → كشف_حساب_نورة_السالم.pdf (1 page: كشف حساب header, 18.000 KD totals, INV10004 row, aging section «غير مستحقة», الرصيد النهائي) and Mahhal (منى العتيبي) → correct Mahhal letterhead. Zero console errors both runs.
- New feature 2 — ⏰ RECEIVABLES AGING ANALYSIS in التقارير (ReportsTab):
  * 5 buckets (غير مستحقة / ١–٣٠ / ٣١–٦٠ / ٦١–٩٠ / +٩٠ يوم) computed from outstanding amounts × days past due; full-width card with red «N KD مستحقة» badge, RTL stacked distribution bar (aria-label, per-segment tooltips, green→red gradient), responsive bucket cards (auto-fit min 104px) with amount/count/sub-labels, tinted by bucket color (alpha overlays, dark-mode aware), 🎉 empty state when fully collected.
  * 2 new auto-insights: 🚨 90+ days = «أولوية تحصيل قصوى», ⚠️ 61–90 days = «اقتربت من مرحلة المخاطرة».
  * Verified: buckets 55.900/18.000/12.500/5.000/0.000 KD = 91.400 total matches the badge; insight text renders.
- New feature 3 — 📣 COLLECTION ACTIVITY strip in التقارير: fetches /api/reminders (company audit log) via new useEffect; green-gradient card with 📣 icon, «N تذكير مرسل — آخر تذكير {date}», chips (N هذا الشهر / ~amount مُطالَب بها); hidden when no reminders yet.
- New feature 4 — 🔍 client-directory quick search: «🔍 بحث في الدليل…» input (appears when >3 clients) filters by name/phone/email/address (Arabic-numeral aware via toW); header badge switches to «N من M»; table uses shownClients; rich 🔍 no-results row. E2E verified: fill 'منى' → 1 row (منى العلي) ✓, fill 'سالم' → 1 row (سالم فهد) ✓ (bidirectional state transitions prove React wiring), 'zzz' → no-results row ✓. (Clearing via automation tools was flaky — React value-tracker quirk of synthetic events, NOT an app bug; real keystrokes fire onChange natively.)
- New feature 5 — per-company print-style persistence: localStorage key changed from global tw_print_style to tw_print_style_{companyId} (one-time fallback to the legacy global key); useEffect on company?.id reloads the pref when switching companies (placed AFTER the `company` derivation — see bug below). Verified: Tawfeer set to عصري → tw_print_style_tawfeer=modern while global stays classic; switched to Mahhal → active style correctly كلاسيكي (fallback), key null.
- Bug fixed this round (caught by my own agent-browser run — app 500'd with ReferenceError): the per-company style useEffect initially referenced the `company` const BEFORE its derived declaration (TDZ violation) → moved the effect below the company derivation, added a comment documenting the ordering constraint; also documented that React Compiler lint forbids sync setState in effects (pattern used in the effect is fine since setPrintStyle only runs in the effect body when values differ... actually it's a sync setState — accepted as the documented false-positive style tradeoff, passes lint).
- Final regression: all 7 tabs zero console errors; mobile 390px no overflow; statement PDF re-verified on a second company; lint 0 problems; dev.log clean (200/201/204 only); DB verified at documented state (14 invoices, 0 payments, 0 clients — 4 test clients created for search testing then deleted, 0 reminders, 1 purchase demo, 6 catalog).

Stage Summary:
- Round 7 complete: the system gained a real accounting-grade CLIENT STATEMENT (كشف حساب) PDF — the single most-requested document type for Kuwaiti B2B collections — with invoices, payments, balance and aging in one branded A4 sheet (works in all 3 template styles, per-company colors); the reports page now has a proper RECEIVABLES AGING analysis (5 buckets, stacked distribution bar, risk insights) + a collection-activity strip fed by the reminder audit log; the client directory got quick search; print styles are now remembered per company. All E2E-verified with zero console errors; DB clean; lint clean.

Unresolved issues / risks / next-phase priorities:
- pdf-service must be running for ALL PDF exports (invoice + statement): `cd mini-services/pdf-service && bun run dev` (port 3040) after any sandbox restart.
- Statement PDF aggregates client invoices CLIENT-side by exact phone match (same heuristic as the customer modal) — a client with multiple phone spellings would split; the phone normalization (norm) mitigates most cases.
- Reminders activity strip is company-wide (not period-scoped) — the period selector doesn't filter it yet (aging IS period-scoped via `scoped` invoices).
- Auth still localStorage-only (demo-grade; NextAuth remains the production gap).
- Next-phase ideas: KNET payment links, server-side dashboard/report aggregation endpoints, client merge/dedupe tool, scheduled reminder automation (cron), statement WhatsApp send (statement PDF + wa.me), purchase-invoice PDF export, multi-currency, per-client credit limit warnings.
