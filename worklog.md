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

---
Task ID: r8 (cron webDevReview round 8 — 2026-09-13)
Agent: main (Z.ai Code)
Task: Scheduled QA round + 3 new features (purchase-invoice PDF export, KNET payment-link generator, client credit limits & warnings)

Work Log:
- Read full worklog (r1–r7 history). State check: pdf-service healthy (fonts inlined), Next healthz ok, dev.log clean — the only ReferenceError visible in dev.log was the historical r7 TDZ error (already fixed; verified the useEffect sits after the `company` derivation in current code, followed by 200s). Lint 0.
- QA smoke via agent-browser (named session r8-qa): login (real-keystroke workaround for React value-tracker quirk — `fill` alone doesn't fire onChange) → company selector → Tawfeer → ALL tabs click-through (dashboard/invoices/customers/reports/bulk/AI/print/purchases + invoice detail view) — ZERO console errors; dark toggle ok; mobile 390px no overflow. Judged stable → new features.
- New feature 1 — 📦 PURCHASE-INVOICE PDF EXPORT (the last document type without PDF):
  * PurchasesTab.jsx: refactored `printPurchaseInvoice` into pure `buildPurchaseHTML(pi, company)` (returns HTML string) + thin print wrapper; font switched Cairo→Tajawal link + `'Tajawal','Cairo',Arial` stack so pdf-service inlines it deterministically (matches invoice/statement docs); new `exportPurchasePdf()` (blob download via api.exportPdf, busy state, toasts) + red "📄 PDF" button next to 🖨️ طباعة in each purchase row (disabled/⏳ while busy).
  * E2E: clicked 📄 on PUR-AI-97910 → POST /api/pdf 200 (570ms) → فاتورة_مشتريات_PUR-AI-979107.pdf (49KB) downloaded; pdftotext confirms full Arabic doc (فاتورة مشتريات، توفير اونلاين شوب، 12/09/2026، 4 منتج، 20 قطعة...). Print window verified via window.open patch (fires exactly once).
- New feature 2 — 💳 KNET PAYMENT-LINK GENERATOR (r8's top next-phase idea):
  * Module helpers: `getPayLinkTpl/setPayLinkTpl` (localStorage `tw_paylink_{companyId}`), `buildPayLink` (placeholders {amount}/{invoice}/{phone}), `payRequestMessage` (Arabic payment-request text), `waHrefWithText`.
  * New `PayLinkModal` component: teal-gradient header with inv# + remaining; editable amount with "↺ المتبقي" reset; generated-link box (monospace, user-select:all) when template configured; amber onboarding card with "⚙️ إعداد الآن" when not; collapsible gateway-template editor (monospace ltr input, placeholder docs, per-company persistence note); green WhatsApp message preview; footer: 📋 نسخ رابط الدفع (clipboard + execCommand fallback, ✅ state), 📣 إرسال واتساب (logs to reminder audit via logReminderSent), إغلاق.
  * Wired: teal "💳 رابط الدفع" button in invoice-detail toolbar (only when remaining > 0), state `payLinkInv`.
  * E2E: opened on INV10010 (المتبقي 6.000 KD) → configured template `https://kpay.com.kw/pay/TWF123?amt={amount}&ref={invoice}` → saved (localStorage verified) → generated link `...amt=6&ref=INV10010` → WA message contains full payment request incl. the link → copy button flips to "✅ تم النسخ". VLM read back all elements correctly in dark mode. Test template cleaned afterward.
- New feature 3 — 💳 CLIENT CREDIT LIMITS & WARNINGS (credit control):
  * Module helpers: `loadCreditMap/saveCreditMap` (localStorage `tw_credit_{companyId}` → {phone: limitKD}), `outstandingOf(invoices, phone)` (sum of non-cancelled remaining, phone-normalized).
  * Customers component: render-time state sync pattern (lint-clean, mirrors `company` derivation) for creditMap + per-customer input buffer; customer-detail modal gained a "💳 حد الائتمان" card: outstanding/limit figures, color-coded utilization bar (green<50/yellow<80/orange<100/red≥100 with width+color transitions), status chip (🟢 ضمن الحد الآمن / 🟡 استهلاك متوسط / 🔴 قارب استنفاد / ⛔ تجاوز الحد بمقدار X), limit input + 💾 حفظ الحد + 📦 إزالة.
  * Customers table: new "الرصيد المستحق" column (class `col-credit`, hidden <680px like col-date) showing outstanding / limit + ⛔ chip when over; stats grid gained conditional 4th card "متجاوزو حد الائتمان" (auto-fit layout when present).
  * New-invoice form: live `role=alert` banner (amber ≥80% / red over-limit) computing existing outstanding + current form total vs the entered phone's limit.
  * E2E: set limit 15.000 for خالد المطيري (outstanding 20.000) → chip "⛔ تجاوز الحد بمقدار 5.000 KD", bar 100% red (VLM: 9/10 polish) → table cell "20.000 KD / 15.000 KD⛔" → stat card "متجاوزو حد الائتمان 1 عميل" → new-form phone 94422110 → banner "⛔ تجاوز حد الائتمان — الرصيد الحالي 20.000 KD + هذه الفاتورة 0.000 KD = 20.000 KD (الحد 15.000 KD) بفارق 5.000 KD…". Test localStorage key cleaned.
- Final regression: all 8 tabs zero console errors (light+dark); mobile 390px no horizontal overflow; credit column correctly display:none at 390px; `bun run lint` 0 problems; dev.log 200-only; DB verified at documented state (10 Tawfeer invoices/14 total, 0 clients, 0 payments, 0 reminders, 1 purchase demo, 6 catalog).

Stage Summary:
- Round 8 complete: every document type in the system is now exportable to PDF (sales invoices, statements since r6/r7, purchase invoices now); collections gained a KNET payment-link generator (per-company gateway template with {amount}/{invoice} placeholders, WhatsApp payment request + audit log); and the system gained real credit-control (per-client limits with utilization bar, over-limit chips in directory/table, live warning banner on new-invoice creation). All E2E-verified with zero console errors; localStorage + DB left at clean documented state; lint clean.

Unresolved issues / risks / next-phase priorities:
- Pay-link template is per-browser localStorage (per company) — not synced to DB/backend; a settings model in Prisma would make it company-wide across devices.
- Credit limits likewise localStorage-only, keyed by normalized phone (same multi-spelling caveat as statement aggregation); no hard block on invoice save (warning-only by design).
- PayLinkModal logs a reminder on WA send — a dedicated "payment_request" channel value could distinguish requests from reminders in the audit log (channel whitelist currently whatsapp|call|manual).
- Auth still localStorage-only (NextAuth remains the production gap). pdf-service must be re-started after sandbox restart (`cd mini-services/pdf-service && bun run dev`, port 3040).
- Next-phase ideas: server-side dashboard/report aggregation endpoints, client merge/dedupe tool, scheduled reminder automation (cron + reminder log), multi-currency, per-client statement WhatsApp send, KNET payment-link per-company persisted in DB, credit-limit hard-block option for non-admin roles.

---
Task ID: r9-qa (cron webDevReview round 9 — QA phase — 2026-09-13)
Agent: main (Z.ai Code)
Task: Scheduled QA round: health check + agent-browser full walkthrough; fix any bugs found before new-feature development.

Work Log:
- State check: Next healthz ok; pdf-service healthy (fonts inlined); dev.log clean (200/201 only); lint 0 problems.
- Fresh agent-browser session (previous session's error buffer held 2 STALE r7-era TDZ ReferenceErrors that `errors --clear` fails to evict — verified stale: fresh session login → company select → all tabs = 0 errors).
- Full walkthrough in fresh session: login (real keystrokes) → company selector → Tawfeer → all 9 tabs + invoice detail + purchases — ZERO console errors, ZERO page errors; dark-mode toggle round-trip ok; mobile 390px no horizontal overflow (scrollWidth 390 = innerWidth 390).
- BUG FOUND & FIXED — print windows had NO <title> (popup tab showed empty title): sales-invoice buildHTML and statement buildStatementHTML lacked <title> (only PurchasesTab had one). Added `<title>فاتورة {invNum} — {company.nameAr}</title>` / `فواتير (N) — …` to App.jsx buildHTML and `<title>كشف حساب {client.name} — {c.name}</title>` to statement.js. First attempt used wrong field name (`invoiceNumber` → rendered "فاتورة 2" using DB id); corrected to `invNum` (matching doPdfExport's filename pattern).
- E2E verified: clicked print chip INV10001 → popup title now "فاتورة INV10001 — توفير أونلاين شوب" ✓.
- Also diagnosed: `agent-browser` follows window.open print popups (context switches to the document.write'd window — that's automation behavior, not an app bug; closed via window.close()).

Stage Summary:
- Project judged STABLE. One real (minor) bug found (missing print-window titles) and fixed + verified. No blockers for new-feature development.

Unresolved issues / risks / next-phase priorities:
- Proceeding to r9 features: (1) server-side settings persistence (pay-link template + credit limits localStorage → Prisma DB), (2) statement WhatsApp send + payment_request/statement audit channels, (3) Reports top-clients leaderboard + print-chip polish.

---
Task ID: r9 (cron webDevReview round 9 — 2026-09-13)
Agent: main (Z.ai Code)
Task: QA round (1 bug fixed) + 5 new features: server-side settings persistence (Prisma Setting model), credit hard-block enforcement, statement WhatsApp send, payment_request/statement audit channels, phKey phone canonicalization + print-chip polish.

Work Log:
- QA phase (see r9-qa entry above): project stable, zero errors; fixed print-window missing <title> (App.jsx buildHTML + statement.js; field name corrected to invNum after first attempt rendered "فاتورة 2").
- New feature 1 — ⚙️ SERVER-SIDE SETTINGS PERSISTENCE (the top r8 risk: "localStorage-only, not synced across devices"):
  * Prisma: new `Setting` model {key, value JSON-string, companySlug, @@unique([key, companySlug])} + db:push.
  * API `src/app/api/settings/route.ts`: GET ?companySlug&keys (≤20 keys, regex-validated, parsed JSON values, corrupted → null) + PUT upsert (64KB value cap, Arabic error messages). curl-verified round-trip (string + object values, 400s for missing slug / bad key).
  * api.js: getSettings/saveSetting; logReminder now passes companySlug through (BUG FOUND: it was silently dropped — invoice-derived reminders worked via API-side invoice snapshot, but statement logs have no invoice → slug was null; fixed + re-verified).
  * App.jsx write-through pattern: localStorage = instant cache, every save ALSO PUTs to the server (setPayLinkTpl/saveCreditMap/setCreditBlock now take the company object); syncSettingsFromServer(company) runs on company change (App-level effect + Customers effect + PayLinkModal mount effect), server wins + LEGACY local-only values auto-migrate up; settingsTick bump re-renders the new-invoice form's credit banner after sync lands.
  * Settings persisted: paylink_tpl (KNET template string), credit (map phone→limit), credit_block ("1"/"0").
  * E2E: company select → GET /api/settings fires; credit limit save → PUT 200; pay-link template save → localStorage + server both hold "https://kpay.com.kw/pay/TWF9?amt={amount}&ref={invoice}"; modal re-open reconciles from server.
- New feature 2 — ⛔ CREDIT HARD-BLOCK ENFORCEMENT (r8 next-phase idea "credit-limit hard-block option for non-admin roles"):
  * saveInvoice pre-check: limit>0 AND credit_block on AND (outstanding + new total) > limit → non-admin gets "⛔ منع الحفظ — … الرصيد + هذه الفاتورة = … (الحد …)" error toast and the save is aborted (form stays); admin proceeds with "⚠️ تجاوز… مسموح لك بصفتك مدير النظام" warning.
  * Admin-only toggle card in Customers tab (appears when ≥1 client has a limit): red/green state banner explaining the policy + "🔒 تفعيل / 🚫 تعطيل المنع الصارم" button; per-company, synced to server.
  * E2E VERIFIED BOTH PATHS: as admin (ahmedezzat) over-limit save → warning + POST /api/invoices 201 (INV10011 created, then deleted); as employee (info@tawfeer.com/tawfeer123 — NOTE ayman@manager.com is ALSO role:admin in fake-firebase users.js, so the true non-admin test account is the employee) over-limit save → "⛔ منع الحفظ — الرصيد 31.000 + 3.000 = 34.000 (الحد 15.000)" + stillOnForm:true + NO POST in dev.log. Hard-block is CLIENT-side enforcement only (a technical user could hit the API directly) — consistent with the demo-grade auth model.
- New feature 3 — 📨 CLIENT STATEMENT VIA WHATSAPP (r8 next-phase idea):
  * statementSummaryOf(cust) + statementWaHref(cust) build a concise Arabic كشف حساب message (greeting, company, date, invoice count, total sales, paid, outstanding balance — or 🎉 fully-settled variant, oldest overdue days, settle request, company phone).
  * "📨 كشف الحساب واتساب (18.000 KD)" green button in the customer-detail modal (balance-aware label, tooltip, wa-btn class); sendStatementWa logs the audit entry (channel "statement", amount=balance, full message snapshot, invoiceId null) + dispatches reminder-logged event.
  * E2E: message decoded correctly (all 10 lines, correct figures); POST /api/reminders 201 with channel statement + companySlug (after the api.js fix) + amount 18.
- New feature 4 — 💳 PAYMENT_REQUEST audit channel: PayLinkModal WA send now logs channel "payment_request" (r8 note "could distinguish requests from reminders"). API whitelist extended to whatsapp|call|manual|payment_request|statement; RemindersPanel CHANNELS gained 💳 طلب دفع (teal) and 📄 كشف حساب (violet) badges. E2E: INV10007 → payment_request log with the full payment-request message; badge renders in the panel.
- New feature 5 — 📞 phKey PHONE CANONICALIZATION (r7/r8 documented risk "multi-spelling phones split"):
  * Module helper phKey: digits-only with leading 965 country-code stripped when followed by exactly 8 digits → "+96512345678"/"96512345678"/"12345678" all → "12345678".
  * Applied to: customer aggregation (groups merge; display phone upgrades to the LONGEST spelling), customerInvoices filter, outstandingOf, statement custInvs filters (PDF + summary), credit-map keys (saveCredit) + creditLimitOf lookup helper (phKey first, legacy norm-key fallback for old caches).
  * NOTE: verified during testing that the 2 نورة السالم rows are genuinely DIFFERENT numbers (95544332 vs 95554433 from +96595554433) — a data-entry discrepancy, not a spelling split; phKey is defensive canonicalization for the real spelling-split case.
- Style polish — 🖨️ print-tab invoice chips upgraded: status pill (b-paid/b-part/b-unp/b-cancel classes) + issue date (📅) + count in the section header ("أو اضغط على فاتورة لطباعتها — N فاتورة") + hover lift (.print-chip:hover translateY(-2px) + shadow, dark-mode aware) + minWidth 150px. Verified: "INV10001 | مدفوعة | محمد أبو العينين | 11.900 KD | 📅 15/04/2026 | 🖨️ اضغط للطباعة".
- PayLinkModal hint updated: "💾 يُحفظ لشركة … على الخادم — يتزامن تلقائياً عبر كل الأجهزة" (was "يُحفظ محلياً فقط").
- Bugs fixed this round: (1) print windows missing <title> (sales invoices + statements; purchases already had one); (2) title field name invoiceNumber→invNum; (3) api.js logReminder dropped companySlug (statement logs got null slug); (4) bidi artifact: stray quote after lineHeight:1.6 caught by lint parser (same class as the r6 incident).
- Cleanup: test invoices 35/36 deleted (DB back to 14 invoices); settings table cleared (3 rows); reminder_logs cleared (2 rows); browser localStorage tw_paylink/tw_credit/tw_credit_block_tawfeer removed.
- Final regression (fresh browser session): login → Tawfeer → ALL 9 tabs → 0 page errors, 0 console errors/warnings; dark toggle round-trip ok; mobile 390px no horizontal overflow (390=390); lint 0 problems; dev.log clean (200/201 only); pdf-service healthy (fonts inlined).

Stage Summary:
- Round 9 complete: company settings (KNET pay-link template, per-client credit limits, hard-block flag) now live on the server and sync across devices with legacy localStorage auto-migration; credit limits gained real enforcement (non-admins blocked from saving over-limit invoices, admins warned); clients can receive a concise account statement over WhatsApp (audited as channel "statement"); payment requests are distinguishable from reminders in the audit trail; phone matching is canonically normalized (+965/965/local merge); print windows carry proper titles and the print tab chips show status/date with hover polish. One real bug found in QA (missing print titles) and one during dev (dropped companySlug) — both fixed and E2E-verified. DB/settings/localStorage left at clean documented state; lint clean.

Unresolved issues / risks / next-phase priorities:
- Credit hard-block is client-side only — server-side enforcement would need the API to know the user role (blocked until real auth; NextAuth remains the production gap).
- phKey canonicalization is defensive; genuinely different numbers entered for the same client (Nora's 95544332 vs 95554433) still produce separate customer rows — a client merge/dedupe tool remains the next-phase fix.
- ReminderLog GET on the reports collection strip is company-wide (not period-scoped) — still pending from r7.
- agent-browser follows window.open/wa.me popups — during automation use window.close() to return; app unaffected.
- pdf-service must be re-started after sandbox restart (port 3040).
- Next-phase ideas: client merge/dedupe tool, server-side dashboard aggregation endpoints, scheduled reminder automation (cron), per-period collection stats, invoice PDF direct-to-WhatsApp, multi-currency, NextAuth.

---
Task ID: r10
Agent: main (Z.ai Code)
Task: PostgreSQL فعلي + Valkey (بديل Redis) + صفحة DeepSeek API بموديلات مدفوعة وزر اختبار + شات ذكي متصل بكامل المشروع + زر Recovery بجانب النسخة الاحتياطية + رفع المشروع على GitHub (Garfix-space)

Work Log:
- بنية تحتية فعلية (بدون root): تنزيل حزم postgresql-17 deb واستخراجها إلى infra/pg + initdb مع unix_socket_directories=/tmp (إصلاح مشكلة /var/run/postgresql) + تشغيل على 127.0.0.1:5432 (role: garfix / db: garfix).
- Valkey 8.1.1: تجميع من المصدر (jemalloc غير متاح → MALLOC=libc + بناء deps يدوياً: lua عبر أعلام valkey، hdr_histogram، fpconv، hiredis، fast_float) — يعمل على 127.0.0.1:6379 بإعداد LRU (maxmemory 256mb) وبيانات في db/valkey-data.
- ترحيل قاعدة البيانات SQLite → PostgreSQL: تحويل provider في prisma/schema.prisma + .env + سكريبت scripts/migrate-sqlite-to-pg.ts (bun:sqlite → pg، تحويل أعمدة التاريخ من ملّي-ثانية إلى ISO، حفظ الids، إعادة ضبط sequences) — تم التحقق: تطابق كل الجداول (4 شركات، 14 فاتورة، 1 عميل، 6 كتالوج، 1 مشتريات).
- ملاحظة مهمة: متغير DATABASE_URL القديم (sqlite) يطفو في بيئة الشل ويتفوق على .env — تشغيل next dev يجب أن يكون مع env صريح أو بدون المتغير نهائياً (الحارس keepalive يمرر القيمة الصحيحة).
- نماذج Prisma جديدة: AiSetting (مزوّد deepseek: المفتاح/baseUrl/model/enabled/نتيجة آخر اختبار) + AiConversation + AiMessage (محادثات المساعد محفوظة لكل شركة).
- طبقة الكاش src/lib/cache.ts: ioredis → Valkey مع fallback ذاكرة محلية عند تعطل الخدمة + إحصاءات (hits/misses/hitRate) + cacheWrap/get/set/del/delPattern (SCAN آمن) + دوال إبطال.
- دمج الكاش في المسارات الساخنة: dashboard/stats (30s) + revenue-by-month (60s) + recent-invoices (30s) + invoices list (15s) + clients (30s) + catalog (60s) + settings (60s) + purchases (30s) + سياق المساعد ai:ctx (20s) — مع إبطال عند كل كتابة (POST/PUT/DELETE/payments/status/clients/catalog/settings/purchases).
- BUG مكتشف وإصلاحه: الإبطال المحدد بالشركة كان يفوّت مفاتيح «all» (طلبات بلا companySlug ترى بيانات قديمة حتى انتهاء TTL) — أصبح الإبطال شاملاً دائماً؛ تم التحقق (حذف فاتورة → القائمة تتحدث فوراً 13→12 بلا انتظار).
- مزوّد الذكاء الموحّد src/lib/ai-provider.ts: chatComplete + chatCompleteStream (SSE حقيقي من DeepSeek مع دعم reasoning_content للموديل المفكر) + testDeepSeek (GET /models + إكمال مصغّر + قياس زمن) + DEEPSEEK_MODELS (deepseek-chat V3 / deepseek-reasoner R1) + سقوط آمن تلقائي للمزوّد المدمج z-ai-web-dev-sdk عند أي فشل.
- src/lib/ai-context.ts: بناء لقطة حيّة من كامل المشروع (شركات بلا _count → groupBy بديل بعد اكتشاف خطأ Prisma: Company بلا علاقات، أُصلح بالعدّ اليدوي) + تحويلها إلى system prompt عربي (مؤشرات، أعلى المديونيات، أحدث الفواتير، عينة الكتالوج، آخر التذكيرات).
- مسارات جديدة: /api/ai/config (GET/PUT بمفتاح مقنّع + منع تفعيل بلا مفتاح) + /api/ai/test (اختبار فعلي يحفظ النتيجة) + /api/ai/chat (SSE: meta/delta/reasoning/error/done + حفظ الرسائل والمحادثات) + /api/ai/conversations(+[id]) + /api/backup (تنزيل نسخة كاملة، بدون مفتاح DeepSeek لأمان) + /api/recovery (استعادة استبدالية ذرّية داخل transaction مع إعادة ضبط sequences وحدود أمان).
- /api/ai/process-items: يمر الآن عبر المزوّد الموحّد (DeepSeek عند التفعيل + json mode) بدل ZAI المباشر.
- /api/healthz موسّع: حالة PostgreSQL (زمن الاستجابة) + حالة Valkey (المحرك/nسبة الإصابة/آخر خطأ).
- واجهة (3 تبويبات جديدة في App.jsx): 💬 المساعد الذكي (SmartChat.jsx: بث SSE بمؤشر كتابة، فقاعات RTL، markdown، سلسلة تفكير قابلة للطي، محادثات جانبية محفوظة + حذف، اقتراحات جاهزة، إيقاف البث، عنوان صفحة ديناميكي) — 🧠 DeepSeek (DeepSeekSettings.jsx: بطاقة حالة، إدخال مفتاح مع إظهار/إخفاء، اختيار موديل ببطاقات وأشرطة سرعة/عمق، أزرار حفظ/اختبار/تفعيل بتأكيد مزدوج، نتيجة اختبار مفصلة بالزمن والموديلات، شرح التوجيه) — 💾 النظام (BackupRecovery.jsx: تنزيل نسخة + معاينة ملف الاستعادة وعدّاداته + كتابة كلمة «استعادة» للتأكيد + شريط نتيجة + مراقبة حيّة لـ PostgreSQL/Valkey كل 15 ثانية) — التبويبان DeepSeek والنظام للمدير فقط، والشات للجميع.
- mini-services جديدة: postgres (مشرِف pg_isready كل 5s) + valkey (مشرِف يعيد valkey-server) + keepalive (الحارس الرئيسي: يفحص 5432/6379/3040/3000 كل 8s ويعيد تشغيل أي خدمة متوقفة detached — أثبت نفسه بإعادة next dev تلقائياً بعد سقوطه).
- اكتشاف سلوك بيئة: العمليات الخلفية تُقتل عشوائياً عند نهايات استدعاءات — الحل المعمول: double-fork `( setsid nohup … & )` + حارس keepalive دائم؛ postgres نجا دائماً (pg_ctl يانعنِف بشكل صحيح).
- رفع GitHub: .gitignore موسّع (db/ infra/ download/ upload/ tool-results/ agent-ctx/ examples/ tests/ logs) + .env.example + commit (40 ملفاً، +2915) + push ناجح بBranch main جديد على github.com/ahmedezzatelsayad/Garfix-space بالتوكن مرة واحدة عبر URL صريح (لم يُخزّن في git config).

Stage Summary:
- الجولة 10 مكتملة: النظام الآن يعمل على PostgreSQL 17 فعلي + كاش Valkey 8.1 فعلي (بديل Redis) مع سقوط آمن للذاكرة، وكل مميزات الذكاء الاصطناعي (المساعد الذكي + معالجة العناصر) تمر عبر DeepSeek عند تفعيله (اختبار الاتصال وزر التفعيل واختيار الموديل المدفوع V3/R1 يعملان فعلياً — تم التحقق بمفتاح وهمي: 401 Authentication Fails ظهر كما هو متوقع) وإلا بالمزوّد المدمج. المساعد الذكي يجيب ببيانات حقيقية (10 فواتير، 92.900 د.ك، مديونيات بالأرقام والهواتف). زر Recovery بجانب النسخة الاحتياطية يعمل E2E كاملاً (حذف فاتورتين → رفع النسخة → 14 فاتورة رجعت + sequences سليمة id=18 بعد الاستعادة). الحارس keepalive يضمن بقاء الخدمات الأربع. المشروع مرفوع على GitHub. QA شامل: login → شركة → كل التبويبات الجديدة → شات SSE → اختبار DeepSeek → استعادة → وضع ليلي → موبايل 390px (صفر overflow برمجياً) → lint نظيف → dev.log نظيف (200/201/204 فقط). VLM أكد سلامة الوضع الليلي بصرياً.

Unresolved issues / risks / next-phase priorities:
- مفتاح DeepSeek الحقيقي غير مضبوط بعد (المستخدم يدخله من تبويب 🧠 DeepSeek → لصق → اختبار الاتصال → تفعيل) — كل شيء جاهز ومختبر عدا ذلك.
- مزود DeepSeek إذا انقطع أثناء البث: الجزء المُرسل يبقى ثم يظهر خطأ — لا استئناف جزئي (مقبول).
- الحارس keepalive نفسه قد يُقتل من البيئة بعد فترة طويلة — عند أي توقف شامل: شغّل `cd mini-services/keepalive && ( setsid nohup bun run dev > service.log 2>&1 < /dev/null & )` وسيعيد كل الخدمات تلقائياً (مهم بعد أي restart للـ sandbox: نفس الأمر يكفي).
- الـ cron webDevReview كل 15 دقيقة مسؤول عن الجولات القادمة (QA مستمر + تطوير).
- أفكار المرحلة القادمة: أدوات فعلية للمساعد (إنشاء فاتورة/تذكير من الشات مباشرة)، دمج العملاء المكررين (phKey)، ضبط إطار زمني للتقارير في الشات، صفحة إعدادات لكل شركة داخل النظام، NextAuth للتوثيق الفعلي على الخادم، تصدير CSV/Excel من صفحة النظام.

---
Task ID: r10-fix1
Agent: main (Z.ai Code)
Task: إصلاح موثوقية إعادة التشغيل الذاتي

Work Log:
- اكتشاف: كاش Turbopack (.next) يفسد عند قتل next dev فجأة (panic: Failed to restore task data) → GET / ترجع 500 بعد أي إعادة تشغيل بالكاش القديم.
- الحل النهائي: keepalive الآن يمسح .next قبل كل إعادة تشغيل لـ next dev — تم التحقق بدورة كاملة (قتل السيرفر → الحارس اكتشف → مسح الكاش → إعادة تشغيل → GET / 200 في 2.5 ثانية).
- التحقق الختامي بالمتصفح بعد إعادة التشغيل الذاتية: التطبيق يرندر + اختيار الشركة + تبويب المساعد الذكي يعمل (CHAT_OK_AFTER_RESTART).

Stage Summary:
- البنية التحتية الآن ذاتية الإصلاح بالكامل: أي سقوط لأي خدمة (pg/valkey/pdf/next) يُصلح خلال ≤ 8 ثوانٍ تلقائياً وبكاش نظيف.

---
Task ID: r11
Agent: main (Z.ai Code — cron webDevReview)
Task: جولة مراجعة دورية: QA شامل + أداة دمج العملاء المكررين (أولوية r9 الموثقة)

Work Log:
- QA افتتاحي: الخدمات الأربع حية (keepalive)، healthz سليم، dev.log نظيف، login → شركة → تبويبات بدون أخطاء.
- ميزة جديدة — 🔀 دمج العملاء المكررين (حل خطر r9 «نورة السالم صفّين برقمين مختلفين»):
  * API جديد POST /api/clients/merge: دمج ذرّي داخل transaction — يوحّد فواتير المصدر (مطابقة phKey: +965/965/محلي) على اسم/رقم/عنوان الهدف + يحذف صفوف دليل clients للمصدر + يحدّث/ينشئ صف الهدف + يبطل الكاش (invoices + clients + ai:ctx) + تحقق من المدخلات (لا دمج مع نفسه، مفتاح مطلوب).
  * api.js: mergeClients().
  * واجهة: زر «🔀 دمج مكرر» للمدير في مودال تفاصيل العميل → مودال دمج مفصّل (هيدر متدرّج كهرماني→أخضر، بطاقة مصدر + بطاقة هدف/منتقي بحث قابل للتمرير بحد 30، سطر معاينة «سيُنقل X فاتورة»، تحذير أحمر، زر تنفيذ بتأكيد مزدوج، حالات تحميل) + استدعاء refreshInvoices وrefreshClients بعد النجاح (إصلاح stale لدليل العملاء).
- إصلاح أثناء الجولة: بعد الدمج كان صف الدليل القديم يظهر (state قديم) — أُضيف refreshClients() بعد onMerged.
- E2E مثبت: نورة السالم كانت صفّين (95544332: فاتورة واحدة 18 د.ك + +96595554433: فاتورة واحدة مدفوع 6) → دمج من مودال العميل → النتيجة: صف واحد 2 فاتورة 36.000 د.ك والمنتجات موحدة والفواتيرتان (INV10004/INV10010) على الرقم الموحد + جدول clients نضيف (0 صفوف قديمة) + POST /api/clients/merge 200.
- تحسينات ستايل: مودال دمج كامل التصميم (تدرّجات، بطاقات ملونة قابلة للتمييز، hover أخضر للمنتقي، أفاتار بأول حرف، شرائح إحصاء) + وضع ليلي متوافق (txAdapt/softAdapt) — VLM أكد سلامة الوضع الليلي لتبويب العملاء.
- lint نظيف، لا أخطاء متصفح، نسخة احتياطية احترازية أُخذت قبل الدمج (/tmp/pre-merge-backup.json).

Stage Summary:
- r11 مكتملة: خطر «العملاء المكررين» الموثق منذ r9 أصبح له حل فعلي E2E (أداة دمج ذرّية للمدير مع معاينة وتأكيد مزدوج) — وأول حالة استخدام حقيقية نُفّذت (توحيد نورة السالم). البيانات الآن أنظف والمساعد الذكي سيقرأ العملاء موحّدين (تم إبطال ai:ctx).

Unresolved issues / risks / next-phase priorities:
- DeepSeek الحقيقي ما زال غير مضبوط (إدخال المستخدم مطلوب).
- دليل clients يظهر أحياناً صفوف «جديد» فارغة عند إضافة عميل من نموذج جديد دون حفظ — مراجعة سلوك نموذج العميل الجديد جولة قادمة.
- أفكار تالية: أدوات المساعد الذكي (إنشاء فاتورة/تذكير من الشات)، تصدير CSV/Excel من تبويب النظام، إطار زمني للتقارير في الشات، NextAuth.

---
Task ID: r12-readme
Agent: general-purpose (README writer)
Task: كتابة README احترافي لمستودع Garfix-space

Work Log:
- قرأت worklog.md كاملاً (443 سطراً — الجولات r1→r11) لاستخراج الحقائق: الميزات، البنية التحتية (PostgreSQL 17 بدون root في infra/pg، Valkey 8.1.1 مبني من المصدر MALLOC=libc، حارس keepalive كل 8 ثوانٍ)، مزوّد DeepSeek الموحّد، النسخ الاحتياطي/Recovery الذرّي، والأخطاء الحقيقية وحلولها (كاش Turbopack، DATABASE_URL الطافي من الشل، عميل Prisma القديم).
- قرأت package.json (scripts: db:push/generate/migrate، bun runtime)، prisma/schema.prisma (11 نموذجاً: Company/Client/Invoice/Payment/ProductCatalog/PurchaseInvoice/ReminderLog/Setting/AiSetting/AiConversation/AiMessage)، .env (DATABASE_URL فقط) — لا يوجد .env.example على القرص رغم ذكره في r10.
- استخرجت شجرة الـ API الفعلية بـ ls/find: 27 ملف route.ts، وتحققت من methods كل مسار بـ rg (عدّلت جدول الـ API ليطابق الواقع بدقة: GET/DELETE على /api/ai/conversations?id= وليس على [id]؛ PUT/DELETE على catalog/[id]؛ DELETE فقط على purchase-invoices/[id]).
- قرأت mini-services (keepalive/index.ts كاملاً: المنافذ 3000/5432/6379/3040، مسح .next قبل إعادة تشغيل Next، تمرير DATABASE_URL الصريحة، double-fork setsid/nohup؛ postgres و valkey supervisors) و firebase/users.js (الحسابات الستة وأدوارها) و TABS في App.jsx (12 تبويباً + زر المستخدمين) و src/lib/cache.ts (VALKEY_URL) و src/lib/ai-provider.ts (المفتاح من DB وليس env).
- اكتشفت تفاوتاً موثّقاً: DeepSeekSettings.jsx يستدعي POST /api/ai/test بينما المسار غير موجود في المستودع ولا في git — أدرجته كملاحظة صريحة في قسم استكشاف الأخطاء (الحل: التفعيل عبر /api/ai/config).
- كتبت README.md (~526 سطراً): بانر ASCII متوسّط برمجياً + 8 شارات shields.io بلوحة ألوان متناسقة بلا indigo/blue أساسي (black/slate/teal/emerald/amber/rose)؛ جدول محتويات بـ 17 قسماً بروابط عربية؛ نظرة عامة؛ الميزات في 6 أقسام (فواتير/مدفوعات/عملاء/تقارير/AI/نظام)؛ 12 لقطة شاشة placeholder بمسارات docs/screenshots/*.png مع TODO؛ مخطط معماري ASCII مولّد بـ Python بمحاذاة مضبوطة (متصفح→Next.js:3000→PG:5432/Valkey:6379، pdf-service:3040، DeepSeek خارجي، keepalive)؛ جدول الـ 27 مساراً؛ جدول نماذج البيانات الـ 11؛ متطلبات التشغيل؛ تثبيت من 7 خطوات بأوامر bun قابلة للنسخ (بما فيها أمر الحارس الواحد بعد إعادة تشغيل الجهاز) مع خياري البنية التحتية (خادم خاص أو إعادة إعداد infra بدون root — مع التنبيه أن infra/ و db/ في .gitignore)؛ جدول متغيرات البيئة؛ جدول الحسابات الستة مع تحذير تغيير كلمات المرور وأمان localStorage/NextAuth؛ جدول استخدام الـ 13 تبويباً؛ خطوات DeepSeek API الست مع جدول الموديلات V3/R1؛ البنية التحتية و keepalive؛ النسخ الاحتياطي/الاستعادة؛ 9 مشاكل حقيقية وحلولها من worklog؛ خارطة طريق بجدول أولويات من أفكار r10/r11؛ المساهمة؛ الرخصة مع اقتراح MIT.
- تدقيق نهائي: تصحيح خطأ إملائي (ESLint)، إعادة توليد المخطط المعماري بمحاذاة أعمدة مضبوطة برمجياً (14 تصحيح إحداثيات صناديق/موصلات)، والتحقق الآلي أن كل الروابط الداخلية الـ 23 تحل إلى العناوين الـ 36.

Stage Summary:
- README.md إنتاجي مكتمل (526 سطراً) في جذر المستودع: عربي أولاً بعناوين إنجليزية تقنية مزدوجة، Markdown نظيف متوافق GitHub (جداول/ code blocks بأسماء لغات صحيحة/روابط داخلية محقّقة)، أوامر bun فقط وصحيحة للمشروع تحديداً، وكل الحقائق من worklog والملفات بلا مبالغة — بما فيها توثيق الصادق حول التوثيق localStorage والتقني (مسار /api/ai/test غير المضمّن). الأقسام الـ 17 تغطي جميع متطلبات المهمة (البانر+الشارات، المحتويات، الميزات، لقطات placeholder، المعمارية ASCII، نماذج البيانات، المتطلبات، التثبيت، البيئة، الحسابات، الاستخدام، DeepSeek، البنية التحتية، النسخ/الاستعادة، استكشاف الأخطاء، خارطة الطريق، المساهمة+MIT). لم يُكتب أي ملف آخر.

---
Task ID: r12
Agent: main (Z.ai Code)
Task: README احترافي للريبو + مراجعة أخطاء أخيرة + إضافة شركة وتعديل بيانات الشركات + العملة من الإعدادات

Work Log:
- **إنعاش البنية التحتية بعد إعادة تشغيل الـ sandbox** (فُقد infra/ وdb/postgres-data لأنها في .gitignore): إعادة تنزيل PostgreSQL 17.11 debs → infra/pg (initdb مع unix_socket_directories عبر postgresql.conf) → إنشاء role garfix/db garfix → `db push` → تشغيل scripts/migrate-sqlite-to-pg.ts (استعادة كاملة: 4 شركات، 14 فاتورة، 1 عميل، 6 كتالوج، 1 مشتريات — تطابق حالة r10). إصلاح .env (كانت بعلامات تنصيص تكسر URL parsing في سكريبت الترحيل).
- **إعادة بناء Valkey 8.1.1 من المصدر**: اكتشاف أن التاربال يضم deps كاملة المصدر — المسار الصحيح: استخراج نظيف ثم `make -C deps hiredis linenoise hdr_histogram fpconv lua fast_float_c_interface` + `make -C src valkey-server MALLOC=libc` (لا تبنِ valkey-cli — فشل تجميعه غير ضروري). conf في infra/valkey/valkey.conf (LRU 256mb, AOF, بيانات db/valkey-data). Valkey يعمل والمزوّد متصل (healthz: engine=valkey).
- **إصلاح keepalive**: spawnDetached يفحص وجود الثنائية قبل spawn (كان ينهار بENOENT عند غياب valkey-server) + كل ensure* بcatch مستقل.
- **خطآن حقيقيان مكتشفان في المراجعة النهائية وإصلاحهما**: ① مسار /api/ai/test كان مفقوداً من المستودع رغم استدعاء DeepSeekSettings.jsx له (زر اختبار الاتصال كان سيرجع 404) — أُنشئ المسار كاملاً (يقرأ المفتاح من الطلب أو المخزّن + يخزّن نتيجة آخر اختبار)؛ ② .env.example كان مبتلعاً بنمط .env* في .gitignore — أُنشئ الملف + استثناء !.env.example.
- **مخطط Prisma**: Company أصبح بروفايل كامل قابل للتعديل: code (فريد، للتوجيه) + currency (افتراضي KWD) + nameAr/phone/email/address/city/sellerRef/manager/managerPhone/color/accent/cardBg/emoji/logo + updatedAt. أعمدة أُضيفت يدوياً بSQL مع backfill للـ code والاسم العربي للشركات الأربع.
- **API جديد**: GET/POST /api/companies (قائمة مُخزَّنة بكاش 60ث + إنشاء بتحقق كامل: تفرد code/slug، hex للألوان، عملة 3 أحرف، توليد code/slug من الاسم) + PUT /api/companies/[slug] (تحديث جزئي؛ slug/code غير قابلين للتغيير) + إبطال كاش companies:* وai:ctx:*.
- **نظام العملات (currency.js)**: جدول 12 عملة (KWD/BHD/OMR بـ3 منازل، الباقي بـ2) بأعلام ورموز عربية + مخزن مستوى وحدة مع مستمعي رندر (setCurrency/fmtMoney/currencySymbol/useCurrency). fKWD في App.jsx وstatement.js وPaymentsPanel وReportsTab وfKD في SmartChat أصبحت كلها fmtMoney (الاسم نفسه للدوال = صفر تغيير في ~100 استدعاء). placeholder «السعر KD» أصبح ديناميكياً برمز العملة.
- **واجهة الشركات**: CompanyForm.jsx (مودال إضافة/تعديل: هيدر متدرّج بلون الشركة، معاينة حيّة لبطاقة الشركة، 4 أقسام: أساسيات/منتقي عملة بشارات وأعلام/اتصال/هوية بصرية بمنتقي ألوان) — CompanySelector: بطاقة «＋ إضافة شركة جديدة» (مدير فقط) + زر «✏️ تعديل» على كل بطاقة (يظهر hover) + شارة العلم والكود على كل بطاقة — زر «🏢✏️» في النافبار لتعديل الشركة النشطة فوراً — دمج DB فوق COMPANIES الثابتة (حقول غير الفارغة تتفوق) — المدير يرى كل الشركات بما فيها الجديدة — AdminDashboard وCreateUserMedia أصبحا يستقبلان قائمة الشركات الفعلية (تعيين الموظفين لأي شركة).
- **إصلاحان أثناء QA**: ① `as const` TS في ملف jsx فكّ الـ parsing — أُزيلت؛ ② مودال الشركة كان يُرندر فقط في الشجرة الرئيسية وليس في مسار early return لشاشة الاختيار — نُقل ليشمل المسارين؛ ③ ReferenceError في SectionTitle (color بدل c)؛ ④ overflow أفقي 390px بسبب زر النافبار الجديد — أُصلح بإخفاء نصوص الأزرار وتقليص الفراغات ≤420px (scrollWidth=390 بالضبط).
- **README.md احترافي** (وكيل متخصص، 526 سطراً): بانر + 8 شارات shields.io + 17 قسماً (ميزات، معمارية ASCII، 27 مسار API، نموذج بيانات، تثبيت bun، DeepSeek، استكشاف أخطاء بـ9 مشاكل حقيقية من worklog، خارطة طريق).
- **QA E2E كامل**: إضافة «جرفكس للتجارة المحدودة» بعملة SAR من الواجهة (ظهرت فوراً في البطاقات والـAPI) → تعديلها لـUSD + مدير (تحقق في DB) → دخولها: KPIs «250.00 $» بعد فاتورة اختبار → العودة لتوفير: «190.800 د.ك» فوراً → لوحة المستخدمين تعرض الشركات الديناميكية → كل التبويبات بلا أخطاء كونسول → ليلي + موبايل 390px نظيف → بيانات الاختبار نُظفت (4 شركات KWD كما كانت) → lint نظيف → dev.log نظيف → healthz: postgresql+valkey متصلان.
- لقطات: download/r12-*.png (المودال، الملء، البطاقات مع جرفكس، لوحة USD، الليلي، الموبايل، لوحة الإدارة).

Stage Summary:
- r12 مكتملة: الشركات صارت تُدار من الواجهة (إضافة/تعديل كامل البروفايل) والعملة إعداد لكل شركة يسري على كل تنسيقات المبالغ في التطبيق والطباعة والشات والتقارير. خطأ /api/ai/test المفقود (404 مخفي) أُصلح. البنية التحتية ذاتية الإنعاش بعد إعادة تشغيل الـ sandbox (الوثيقة: أمر keepalive الواحد يعيد كل شيء). README إنتاجي في الجذر.

Unresolved issues / risks / next-phase priorities:
- حذف شركة غير منفذ (عمداً — أخطر من الإضافة؛ يتطلب حماية من فقدان فواتيرها) — إن لزم: DELETE /api/companies/[slug] مع منع الحذف عند وجود فواتير.
- إسناد صلاحيات الموظفين للشركات الجديدة يعمل من لوحة الإدارة، لكن SEED_PROFILES للموظفين الافتراضيين ما زال بقائمة ثابتة (المستخدمون الجدد فقط ديناميكيون).
- نسخة الاستعادة لا تتضمن شركات مضافة بعد أخذ النسخة (سلوك طبيعي للنسخ الاحتياطية).
- next-phase: زر حذف شركة محمي، رفع لقطات README إلى docs/screenshots، أدوات المساعد الذكي (إنشاء فاتورة من الشات)، NextAuth.
---
Task ID: 1-infra
Agent: general-purpose (infra revival)
Task: إعادة بناء PostgreSQL 17 + Valkey 8.1.1 + تشغيل كل الخدمات بعد إعادة تشغيل الـ sandbox

Work Log:
- قرأت وصفات الإنعاش الموثقة في worklog (r10 / r10-fix1 / r12) والتزمت بها حرفياً: مسارات infra/pg وvalkey-8.1.1 وdb/postgres-data وdb/valkey-data وأمر keepalive الواحد.
- PostgreSQL 17.11 (Debian trixie): `apt-get download postgresql-17 postgresql-client-17 libpq5` في /tmp/pgdebs → `dpkg-deb -x` إلى infra/pg — ldd نظيف من أول مرة (كل مكتبات النظام موجودة، لم تلزم libllvm/icu إضافية). initdb -U garfix --auth=trust كمستخدم z.
- postgresql.conf: `unix_socket_directories = '/tmp'` (تفادي مشكلة /var/run/postgresql) + `listen_addresses = '127.0.0.1'` + port 5432. تشغيل عبر pg_ctl مع LD_LIBRARY_PATH=infra/pg/usr/lib/x86_64-linux-gnu. ALTER ROLE garfix PASSWORD 'garfix2024' + CREATE DATABASE garfix OWNER garfix.
- إصلاح .env: كانت DATABASE_URL=file:...custom.db (بلا تنصيص لكن خاطئة) → أصبحت postgresql://garfix:garfix2024@127.0.0.1:5432/garfix?schema=public بلا علامات تنصيص.
- `DATABASE_URL=... bun run db:push` نجح (Prisma 6.19.2، توليد Client تلقائي).
- مشكلة حقيقية أثناء الترحيل: جدول Company في SQLite القديم لا يحوي عمود updatedAt الجديد (مطلوب NOT NULL بلا default في PG) → فشل الإدراج. الحل المؤقت: `ALTER TABLE "Company" ALTER COLUMN "updatedAt" SET DEFAULT now()` قبل الترحيل ثم DROP DEFAULT بعده — قاعدة البيانات الآن مطابقة للمخطط تماماً (لا default خفي يظهر كـ diff في db:push قادم).
- `bun scripts/migrate-sqlite-to-pg.ts` نجح كاملاً: 4 شركات، 1 عميل، 14 فاتورة، 6 كتالوج، 1 مشتريات، 0 مدفوعات/تذكيرات/إعدادات + إعادة ضبط كل sequences (Company←5، invoices←18) — تطابق sqlite=pg في كل الجداول الثمانية.
- Valkey 8.1.1 من المصدر (تاربال GitHub → infra/valkey/valkey-8.1.1): `make -C deps hiredis linenoise hdr_histogram fpconv lua fast_float_c_interface` ثم `make -C src valkey-server MALLOC=libc` (لم يُبنَ valkey-cli عمداً كما في الوصفة) — الثنائية 12.7MB جاهزة (malloc=libc).
- infra/valkey/valkey.conf: bind 127.0.0.1، port 6379، daemonize no، dir db/valkey-data، maxmemory 256mb، allkeys-lru، appendonly yes. اختبار يدوي: تشغيل detached → ioredis من node_modules: PING=PONG وSET/GET يعملان وversion=8.1.1 → إيقاف نظيف (kill بالـ PID — ملاحظة: pkill -f بالنمط الكامل لا يطابق لأن valkey يغيّر عنوان العملية إلى "valkey-server 127.0.0.1:6379").
- تشغيل الحارس: `cd mini-services/keepalive && ( setsid nohup bun run dev > service.log 2>&1 < /dev/null & )` — اكتشف Valkey/pdf/next متوقفة فأعادها كلها تلقائياً (مسح .next ثم next dev) خلال ثوانٍ.

Stage Summary:
- كل الخدمات الأربع حية: PostgreSQL 127.0.0.1:5432 (pg_isready: accepting connections) • Valkey 127.0.0.1:6379 (AOF في db/valkey-data) • pdf-service :3040 (chromium جاهز) • next dev :3000 (Ready in 970ms).
- التحقق: GET /api/healthz → 200 {"status":"ok","database":{"engine":"postgresql","ok":true,"latencyMs":2},"cache":{"engine":"valkey","connected":true,...,"hits":1,"misses":1,"writes":1}} (الكاش يعمل فعلياً على Valkey وليس fallback الذاكرة) • GET / → 200 • GET /api/companies → 4 شركات (Tawfeer/Mahhal/Boss Neolife/Laqta) • psql: Company=4 وinvoices=14 • next-dev.log وdev.log بلا أي أخطاء (فقط 200) • keepalive service.log نظيف.
- انحراف وحيد عن الوصفة: default مؤقت لعمود Company.updatedAt أثناء الترحيل (شرح أعلاه) أُزيل بعده — بسبب أعمدة r12 غير الموجودة في SQLite القديم.

---
Task ID: r13
Agent: main (Z.ai Code)
Task: تحديث README + تدقيق الأمان العام + واجهة موقع عام متعدد الصفحات (الفريق + رسالة المؤسس) — طلب المستخدم: «حدث ال readme وتحقق من الامان العام واعمل واجهه بصفحات متعدده للموقع خاصة بالفريق ورسالة المؤسس»

Work Log:
- **إنعاش البنية التحتية** (subagent 1-infra): إعادة بناء PostgreSQL 17.11 + Valkey 8.1.1 من الصفر بعد فقدان infra/ (وصفة r10/r12 الموثقة)، ترحيل البيانات من db/custom.db (4 شركات/14 فاتورة)، keepalive يعمل — healthz: postgresql+valkey متصلان. مشكلة وحيدة: عمود updatedAt الناقص في SQLite القديم عند الترحيل (حُل بـ DEFAULT مؤقت ثم حذفه).
- **اكتشاف جوهري — سر «المسار المفقود» في r12**: سطر `test` الحرفي في .gitignore كان يبتلع أي مسار اسمه test — بما فيه src/app/api/ai/test/route.ts! لهذا «اختفى» المسار من المستودع رغم إنشائه في r12. أُصلح النمط إلى `/test` (الجذر فقط) وأُعيد إنشاء المسار كاملاً + حماية مدير.
- **الأمان (طبقة جلسات الخادم)**: src/lib/auth-server.ts — كوكي garfix_sess httpOnly موقّع HMAC-SHA256 (سر عشوائي في db/session-secret، صلاحية 30 يوماً، timingSafeEqual) + كلمات مرور الخادم كبصمات SHA-256 (لا نص صريح في الملف الجديد) + تحديد معدل الدخول 10 محاولات/5 دقائق/IP + رسائل خطأ موحّدة (لا تكشف وجود البريد).
- **مسارات الجلسة**: POST /api/auth/login (يعمل تلقائياً من loginUser في firebase/auth.js fire-and-forget — التجربة المحلية كما هي) + POST /api/auth/logout (يستدعى من logoutUser) + GET /api/auth/me.
- **حماية المسارات الإدارية (requireAdmin)**: companies POST+PUT، ai/config PUT، ai/test POST، backup GET، recovery POST، clients/merge POST، site/content PUT، site/team POST+PUT+DELETE. موظف بجلسة = 403 (تم التحقق)، بلا جلسة = 401 (تم التحقق بـ curl)، نسخ احتياطي عبر الواجهة بجلسة المدير = 200 (تم التحقق E2E).
- **ترويسات أمان** في next.config.ts: X-Content-Type-Options nosniff + Referrer-Policy + Permissions-Policy + no-store على backup/recovery/auth (بلا X-Frame-Options حتى لا تتعطل لوحة المعاينة).
- **تدقيق الأسرار**: لا remote في git (التوكن لم يُخزّن — جيد)، لا PAT في HEAD (git grep)، مفتاح DeepSeek مقنّع في GET config ومستبعد من النسخة الاحتياطية (محقّق)، .env في .gitignore.
- **نماذج جديدة**: TeamMember (اسم/دور/نبذة/إيموجي/صورة/تواصل/ترتيب/نشر) + SiteContent (مفتاح/قيمة — 14 مفتاحاً مزروعة: رسالة المؤسس، عناوين البطل، التواصل…) + scripts/seed-site.ts (upsert آمن لا يستبدل تعديلات المدير).
- **مسارات الموقع**: GET /api/site/stats (عام: أعداد فقط) + GET/PUT /api/site/content + GET /api/site/team (?all=1 للمدير) + PUT/DELETE /api/site/team/[id] — بكاش Valkey وإبطال site:*.
- **الموقع العام متعدد الصفحات** (src/components/site/): توجيه hash داخل مسار / الواحد (#/ الرئيسية، #/team الفريق، #/founder رسالة المؤسس، #/login الدخول) — الزائر غير المسجل يرى الموقع تلقائياً بدل شاشة الدخول، والمدير يعاين الصفحات فوق النظام بزر «↩️ العودة للنظام». تصميم كحلي+ذهبي بهوية شاشة الدخول: نافبار عصبي (برغر موبايل)، هيترو ببطاقة فاتورة عائمة وإحصاءات حية، 6 بطاقات مزايا، شريط الشركات (من API)، تيعير المؤسس، صفحة فريق (بطاقة مؤسس مميزة + شبكة أعضاء بأفاتارات وسوشيال)، صفحة رسالة المؤسس (تصميم خطاب بعلامة اقتباس وتوقيع)، فوتر ملتصق بأسفل (mt-auto + safe-area).
- **تبويب 🌐 الموقع (مدير فقط)**: SiteManager.jsx — تحرير كل محتوى الموقع (14 حقلاً) + إدارة أعضاء الفريق (إضافة/تعديل/حذف/ترتيب بالأسهم/نشر-مسودة) + أزرار معاينة فورية للصفحات الثلاث.
- **إصلاحات أثناء QA**: ① عنوان الصفحة: React يعيد تطبيق عنوان metadata بعد اكتمال hydration فيكتب فوق عنوان العميل — الحل: إعادة ضبط متأخرة (700ms) في PublicSite وApp + توحيد عنوان الرئيسية مع metadata؛ ② خطأ TDZ: useState(sitePage) كان معلناً بعد تأثير يستخدمه في deps — أُعيد ترتيب الـ hooks؛ ③ BUG فعلي في API الفريق: القيمة الفارغة "" لحقول الروابط كانت تُرفض كرابط غير صالح (400) — أُعيدت دالة url() للتمييز بين «غير مُرسل» و«امسح القيمة»؛ ④ overflow موبايل 390px (كان 724px): تنقل nav بـ display:inline يتغلب على media query (أُصبح CSS class)، صف النافبار ضاق (برغر خارج الشاشة) — أزرار CTA بنص قصير للموبايل + اسم البراند بـ ellipsis + شبكة الفوتر لموبايل عمودية + كرات الخلفية داخل الحدود — النتيجة 390=390 بالضبط على كل الصفحات؛ ⑤ عنوان layout metadata أصبح اسم الموقع.
- **QA E2E كامل**: زائر → الرئيسية (إحصاءات حية 4/14/1) → الفريق → المؤسس → دخول المدير (كوكي جلسة) → تعديل عنوان البطل وحفظه → ظهوره فوراً في الصفحة العامة → إضافة عضو «سالم الاختبار» (POST 201 بعد إصلاح ③) → ظهوره بصفحة الفريق → حذفه (DELETE 204) → تنزيل نسخة احتياطية من الواجهة (200 بجلسة المدير) → خروج → عودة للموقع + مسح الجلسة → دخول موظف: لا تبويبات إدارية، لوحة توفير تعمل → ليلي/نهاري سليم → موبايل 390px نظيف → جلسة متصفح جديدة كاملة: صفر أخطاء كونسول وصفحة. VLM على 3 لقطات: 9/10 للثلاث (تصميم احترافي، RTL سليم، بلا عيوب).
- **لقطات حقيقية للريبو**: docs/screenshots/ (8 لقطات: site-home, site-team, site-founder, site-manager, app-dashboard, app-dark, login, site-mobile) — بدل الـ placeholders التي كانت في README.
- lint: 0 أخطاء (تحذير واحد قديم من r11). dev.log نظيف (200/201/204/400/401/403 المقصودة فقط).

Stage Summary:
- r13 مكتملة: للمشروع الآن واجهة موقع عام حقيقية متعددة الصفحات (رئيسية/فريق/رسالة مؤسس/دخول) يراها الزائر قبل تسجيل الدخول، ويتحرر محتواها كاملاً من داخل النظام (تبويب 🌐 الموقع) — الرسالة والأعضاء من قاعدة البيانات مع قيم افتراضية عاملة. طبقة أمان خادمية فعلية (جلسات موقعة httpOnly + حماية 8 مسارات إدارية + تحديد معدل + ترويسات) دون كسر أي تدفق قائم. جذرا «اختفاء مسار ai/test» (نمط test في .gitignore) اكتُشف وأُصلح. README يُحدَّث بمعيار الجولة (شعبة r13-readme).

Unresolved issues / risks / next-phase priorities:
- التوثيق للعمليات غير الإدارية (فواتير/مدفوعات/عملاء) ما زال محلياً — الموظف الحقيقي غير المعروف للخادم (مستخدم CreateUserModal) لا يحصل على جلسة (عملياته غير الإدارية تعمل كالمعتاد). NextAuth يبقى الحل الجذري.
- تحديد المعدل في الذاكرة يُصفَّر عند إعادة التشغيل (مقبول demo-grade؛ Valkey متاح للترقية).
- صور الأعضاء روابط فقط (لا رفع ملفات) — رفع الصور فكرة قادمة.
- صفحات الموقع لا تملك meta/OG منفصلة لكل صفحة (SPA بمسار واحد) — SEO محدود بطبيعته.
- next-phase: NextAuth، فرض الأدوار على كل عمليات الكتابة، رفع صور الفريق، أدوات المساعد الذكي (إنشاء فاتورة من الشات)، تصدير CSV/Excel من تبويب النظام.
---
Task ID: r13-readme
Agent: general-purpose (README updater)
Task: تحديث README بجولة r13 (الموقع العام + الأمان + المسارات الجديدة + لقطات حقيقية)

Work Log:
- قرأت آخر أقسام worklog (r13 كاملاً + 1-infra + r12 + r10) ثم README.md كاملاً (526 سطراً) لالتقاط البنية والأسلوب والحقائق القائمة.
- تحققت من الملفات الفعلية قبل الكتابة: prisma/schema.prisma (13 نموذجاً — TeamMember/SiteContent جديدتان) • 37 ملف route.ts فعلي في src/app/api (وليس ~34 ولا 27 القديمة) مع تعداد methods كل مسار بـ rg • next.config.ts (ترويسات الأمان + no-store على backup/recovery/auth) • .gitignore (`/test` الجذرية بعد الإصلاح) • src/lib/auth-server.ts (garfix_sess · HMAC-SHA256 · 30 يوماً · timingSafeEqual · SHA-256 digests · 10 محاولات/5 دقائق in-memory) • requireAdmin في 10 ملفات مسار (companies POST+PUT · ai/config+test · backup · recovery · clients/merge · site/content+team+[id]) • scripts/seed-site.ts (14 مفتاح محتوى + 4 أعضاء، upsert) • TABS في App.jsx (13 تبويباً مع 🌐 الموقع بين DeepSeek والنظام) • SiteManager.jsx وsrc/components/site/ (PublicSite/HomePage/TeamPage/FounderPage) • firebase/auth.js (fire-and-forget على /api/auth/login و/logout) • docs/screenshots (8 لقطات PNG موجودة فعلاً).
- عدّلت README جراحياً (MultiEdit + تحرير سطري مُتحقَّق منه بـ Python بعد فشل مطابقة نصوص عربية مشكولة حرفياً): البانر/الشارات كما هي (لا اعتماديات جديدة) + سطرين في المقدمة؛ جدول محتويات من 17 إلى 19 قسماً؛ صفان جديدان في جدول النظرة العامة (الموقع العام + طبقة الأمان)؛ قسم ميزات «🌐 الموقع العام» جديد + تحديث ميزات النظام (إدارة الشركات/العملة + بند الأمان)؛ قسم كامل جديد «🌐 الموقع العام (Public Website)» (جدول الصفحات الأربع بالهاشات + معاينة المدير + المصدر DB + SiteManager)؛ استبدال 12 لقطة placeholder بـ 8 لقطات حقيقية مضمّنة <img> بعرض 800 (و390 للجوال) مقسمة 3 مجموعات؛ 27→37 مساراً في المخطط المعماري (نفس عرض الصند تماماً)؛ جدول API موسّع (المصادقة والجلسات + الشركات + الموقع العام + ai/test) مع ملاحظة الـ 37 والحماية؛ نموذج البيانات 11→13 مع صف Company كامل البروفايل + صفّا TeamMember/SiteContent + ملاحظة seed-site؛ قسم كامل جديد «🔒 الأمان (Security)» بأربعة أقسام فرعية (الجلسات الموقّعة / تحديد المعدل ومنع التعداد / جدول requireAdmin مع نتائج 401/403/200 / ترويسات الأمان) + «الحدود المتبقية» بصدق؛ أمر seed-site في خطوة 3 من التثبيت؛ خطوة 7 تشير للموقع العام و #/login؛ ملاحظة db/session-secret في متغيرات البيئة؛ تحديث تحذير الحسابات (طبقة الجلسات منذ r13)؛ تبويب 🌐 الموقع في جدول الاستخدام (13 تبويباً)؛ ملاحظة حماية backup/recovery؛ 3 مشاكل جديدة في استكشاف الأخطاء (نمط test في .gitignore / عنوان metadata بعد hydration / inline display:flex ضد media queries) + إعادة كتابة ملاحظة ai/test القديمة؛ خارطة طريق محدّثة (NextAuth مبنيّة فوق جلسات r13 + فرض الأدوار على كل الكتابات + رفع صور الفريق + SEO لكل صفحة) وجدول «✅ منجز حديثاً» (جلسات r13، الموقع العام، اللقطات الحقيقية، جذر ai/test، عملة/شركات r12) وحذف بند «تعدد العملات» المنجز.
- تدقيق آلي نهائي: 666 سطراً • 49 عنواناً بلا slugs مكررة • 34 رابطاً داخلياً كلها تحل (بخوارزمية GitHub) • 8 مسارات صور محلية كلها موجودة • صفر أوامر npm/yarn/pnpm • لا بقايا «27 مسار/11 نموذجاً/TODO placeholders» • جداول سليمة الأعمدة • تصحيح mode الملف إلى 644.

Stage Summary:
- README محدَّث إلى معيار نهاية r13 (526→666 سطراً، +190/−51): أقسام جديدة للموقع العام والأمان، لقطات حقيقية بدل placeholders، 37 مسار API و13 نموذجاً و13 تبويباً مطابقة للكود الفعلي، وخارطة طريق صادقة (منجز r13/r12 مقابل المتبقي). خيّرتُ الحقيقة المُتحقَّقة على التقديرات: عدد المسارات الفعلي 37 (وليس ~34 المتوقع) لأن مسارات الشركات (r12، بعد كتابة README الأصلي) كانت غائبة من الجدول القديم أصلاً — أُضيفت. تفاوتات سابقة أُصلحت: صف Company كان مختصراً بلا code/currency/البروفايل، وملاحظة «ai/test غير مضمّن» أصبحت غير صحيحة بعد r13 فأُعيدت صياغتها بالسبب الجذري (.gitignore). لم يُلمس أي ملف غير README.md.

---
Task ID: r13-close
Agent: main (Z.ai Code)
Task: إغلاق جولة r13 — رفع GitHub + الكرون + التحقق الختامي

Work Log:
- README.md محدَّث بواسطة وكيل متخصص (r13-readme): 526→666 سطراً — قسمان جديدان (🌐 الموقع العام + 🔒 الأمان)، 19 بنداً في المحتويات، 37 مسار API موثقة بالتحقق الفعلي، 13 نموذج بيانات، 8 لقطات شاشة حقيقية بدل الـ placeholders، استكشاف أخطاء موسع بـ3 حوادث حقيقية جديدة، خارطة طريق محدثة. تحقق آلي: 34/34 روابط داخلية سليمة، 8/8 مسارات لقطات موجودة.
- اكتشافات تدقيق الريبو من الوكيل: جدول API القديم كان ينقصه مسارات الشركات كاملة، نموذج Company كان موثقاً بصيغة r10 القديمة، «تعدد العملات» كان في خارطة الطريق رغم إنجازه في r12 — كلها صُححت.
- Git: commit 2efbeab (44 ملفاً: +38/−6) — دفع ناجح إلى github.com/ahmedezzatelsayad/Garfix-space (main: d08ba17..2efbeab) بالتوكن مرة أخرى عبر URL صريح؛ لا remote ولا credentials في git config (متحقق).
- كرون webDevReview أُنشئ (job_id 382639) كل 15 دقيقة — يشمل تعليمات إنعاش البنية التحتية بعد أي إعادة تشغيل للـ sandbox (وصفة worklog r10/r12/1-infra + seed-site).
- تحقق ختامي: healthz سليم (postgresql 7ms، valkey متصل بنسبة إصابة 98.3%)، GET / و #/team = 200، team API يرجع الأعضاء، dev.log بلا أي خطأ، المنافذ الأربعة تستمع (3000/5432/6379/3040)، lint نظيف (تحذير قديم واحد فقط).

Stage Summary:
- r13 مكتملة ومرفوعة: موقع عام متعدد الصفحات (الرئيسية/الفريق/رسالة المؤسس/الدخول) يُدار محتواه من تبويب 🌐 الموقع داخل النظام، طبقة أمان خادمية موقّعة تحمي كل المسارات الإدارية، جذر مشكلة «اختفاء مسار ai/test» (نمط test في .gitignore) مكتشف ومصلح، README احترافي محدَّث بلقطات حقيقية، والمستودع على GitHub محدَّث. الكرون الدوري مسؤول عن الجولات القادمة.

---
Task ID: 14-infra
Agent: general-purpose (infra revival)
Task: إعادة بناء PostgreSQL 17 + Valkey 8.1.1 + تشغيل كل الخدمات بعد إعادة تشغيل الـ sandbox (تنفيذ حرفي لوصفة 1-infra)

Work Log:
- الحالة عند البدء: infra/ محذوفة كلياً، لا عمليات postgres/valkey/next/bun، المنافذ 3000/5432/6379/3040 مغلقة، db/custom.db (SQLite) باقٍ كمصدر للترحيل، .env ما زال يشير إلى file:...custom.db.
- PostgreSQL 17.11 (Debian trixie): apt-get download للثلاث حزم في /tmp/pgdebs → dpkg-deb -x إلى infra/pg (لاحظ: يجب mkdir -p infra/pg أولاً وإلا فشل الاستخراج بـ "failed to create directory") — ldd نظيف. initdb -U garfix --auth=trust كمستخدم z مع LD_LIBRARY_PATH=infra/pg/usr/lib/x86_64-linux-gnu.
- postgresql.conf: unix_socket_directories='/tmp' + listen_addresses='127.0.0.1' + port=5432. pg_ctl start → pg_isready: accepting connections. ALTER ROLE garfix PASSWORD 'garfix2024' + CREATE DATABASE garfix OWNER garfix.
- إصلاح .env: DATABASE_URL=file:...custom.db → postgresql://garfix:garfix2024@127.0.0.1:5432/garfix?schema=public (سطر واحد فقط؛ لا VALKEY_URL ولا أسطر أخرى موجودة).
- اكتشاف مهم: متغير DATABASE_URL القديم (file:...custom.db) كان مصدَّراً في بيئة الشل المستمر للجلسة ويتفوق على .env في Bun → seed-site فشل بـ "URL must start with postgresql://" رغم صحة .env. الحل: unset DATABASE_URL في الجلسة (ونفس الشيء يلزم لأي سكربت يعتمد process.env) — ثم نجح.
- `DATABASE_URL=... bun run db:push` نجح (Prisma 6.19.2 + توليد Client).
- مشكلة updatedAt المعروفة تكررت حرفياً (SQLite القديم بلا العمود → 23502 not-null) → SET DEFAULT now() → الترحيل نجح → DROP DEFAULT (المخطط مطابق تماماً الآن).
- `bun scripts/migrate-sqlite-to-pg.ts`: 4 شركات (Tawfeer/Mahhal/Boss Neolife/Laqta)، 1 عميل، 14 فاتورة، 6 كتالوج، 1 مشتريات + إعادة ضبط sequences (Company←5، invoices←18) — تطابق sqlite=pg في الجداول الثمانية.
- `bun scripts/seed-site.ts` (بعد unset): site_content=14 مفتاحاً + team_members=4 أعضاء.
- Valkey 8.1.1 من المصدر: تاربال GitHub (3.8MB) → infra/valkey/valkey-8.1.1 → make deps (hiredis linenoise hdr_histogram fpconv lua fast_float_c_interface) → make -C src valkey-server MALLOC=libc (12.66MB، بلا valkey-cli عمداً). valkey.conf: bind 127.0.0.1، port 6379، daemonize no، dir db/valkey-data، maxmemory 256mb، allkeys-lru، appendonly yes.
- تشغيل الحارس: `cd mini-services/keepalive && ( setsid nohup bun run dev > service.log 2>&1 < /dev/null & )` — اكتشف Valkey/pdf/next متوقفة فأعادها كلها (مسح .next ثم next dev) خلال ~20 ثانية.

Stage Summary:
- كل الخدمات الأربع حية: PostgreSQL 127.0.0.1:5432 (pg_isready ok) • Valkey 127.0.0.1:6379 (AOF في db/valkey-data) • pdf-service :3040 (chromium جاهز) • next dev :3000 (Ready in 1043ms).
- التحقق النهائي: GET /api/healthz → 200 status=ok مع database engine=postgresql ok=true (latency 1–37ms) و cache engine=valkey connected=true — والكاش يعمل فعلياً على Valkey (hits=1/misses=3/writes=3/memKeys=3 بعد طلبات متكررة، ليس fallback الذاكرة) • GET / → 200 • GET /api/companies → 4 شركات • GET /api/site/team → 4 أعضاء • GET /api/site/stats → {companies:4, invoices:14, clients:1, currencies:1} • psql: Company=4/invoices=14/product_catalog=6/site_content=14/team_members=4 • dev.log وnext-dev.log صفر أخطاء (200 فقط) • keepalive service.log وpdf service.log نظيفة • ioredis من node_modules: PING=PONG وversion=8.1.1 وSET/GET يعملان.
- انحرافان صغيران عن الوصفة (كلاهما موثق أعلاه): ① mkdir -p infra/pg قبل dpkg-deb -x؛ ② unset DATABASE_URL في الشل المستمر لأن قيمة قديمة مصدَّرة كانت تتغلب على .env (جذر فشل seed-site الأول) — درس مهم لأي إحياء قادم: تحقق من `env | grep DATABASE` قبل تشغيل السكربتات.

---
Task ID: r14
Agent: main (Z.ai Code)
Task: إضافة BullMQ كطبقة طوابير مهام خلفية كاملة فوق Valkey (طلب المستخدم: «هل ضفت bullq»)

Work Log:
- إحياء البنية التحتية بعد إعادة إنشاء الـ sandbox بالكامل (ضاع infra/ ورجعت .env لـ SQLite): وكيل فرعي 14-infra نفّذ وصفة 1-infra حرفياً — PostgreSQL 17.11 + Valkey 8.1.1 + ترحيل البيانات (4 شركات/14 فاتورة) + seed-site + keepalive يدير كل الخدمات. اكتشاف جديد وُثّق: متغير DATABASE_URL=file:... القديم كان مصدَّراً في بيئة الشل ويتفوق على .env في Bun.
- تثبيت bullmq@6.3.4 في المشروع الرئيسي + ioredis صراحةً في job-worker (كان يحلّها عبر مجلد الأب).
- src/lib/queue.ts: جانب المنتِج — طابور «garfix-tasks» (globalThis-cached)، قائمة بيضاء JOB_TYPES، enqueueJob، workerHealth (نبض :3041 بمهلة 800ms)، queueOverview (عدادات + Job Schedulers + آخر 24 مهمة مكتملة/فاشلة بالمدد والنتائج).
- mini-services/job-worker (منفذ 3041): عامل BullMQ بمعالجات: backup (نفس صيغة /api/backup حرفياً — مفاتيح camelCase وأسماء الجداول الحقيقية مع @@map حتى تستعيدها زر Recovery مباشرة، + جداول الموقع العام team_members/site_content) · cache-warm (23 نقطة نهاية: 3 عامة + 5×4 شركات) · cleanup-backups (14 يوماً مع الاحتفاظ بأحدث 5) · db-maintenance (VACUUM ANALYZE). سجّل 4 Job Schedulers بـ upsertJobScheduler (backup 03:00 يومياً · cache-warm كل ساعة · cleanup سبتاً 04:30 · VACUUM 04:15 — Africa/Cairo). حارس تفرد: خروج فوري إذا كان 3041 محجوزاً.
- API: src/app/api/jobs/route.ts — GET (إحصائيات شاملة) + POST (enqueue/retry/remove) بـ requireAdmin. اختبار curl: 401 بلا جلسة، رفض اسم مهمة خارج القائمة البيضاء، enqueue يعمل والمهمة تُعالج فوراً.
- واجهة JobsPanel.jsx في تبويب 💬 النظام (تحت BackupRecovery): 6 بطاقات عدادات + بطاقة العامل (معالجة/فاشلة/مدة/آخر مهمة/تعالج الآن) + أزرار تنفيذ فوري للمهام الأربع + جدول المجدولة بمواعيدها التالية + جدول آخر 24 مهمة (حالة/مدة/قبل كم/مقتطف نتيجة عربي لكل نوع) + زر إعادة محاولة للفاشلة + تحديث تلقائي كل 5 ثوانٍ + رسالة «مدير فقط» لغير المديرين.
- keepalive: أضيف ensureJobWorker (المنفذ 3041) — والحارس التقف التعديل تلقائياً بـ hot-reload وأشغّل العامل بنفسه (اختُبر فعلياً بقتل كل العمال — أعادها خلال ثوانٍ).
- Valkey: تغيير maxmemory-policy من allkeys-lru إلى noeviction (مطلب BullMQ الصارم — بيانات الطوابير لا تُخلَت) مع إعادة تشغيل عبر الحارس؛ الكاش له سقوط آمن للذاكرة عند امتلاء الذاكرة.
- مشاكل حقيقية حُلّت أثناء التطوير: (1) BullMQ v6 يرفض «:» في اسم الطابور → garfix-tasks؛ (2) getRepeatableJobs/removeRepeatableByKey غير موجودين في v6 → واجهة Job Schedulers (upsertJobScheduler/getJobSchedulers)؛ (3) عمال زومبي: bun --hot يبقي العملية حية بعد خطأ الوحدة (EADDRINUSE) مع Worker نشط بالكود القديم يستهلك المهام — 9 نسخ تراكمت! الحل: حارس التفرد + قتل الانتومبي بالـ PID؛ (4) DATABASE_URL=file: القديم المصدر بالشل جعل العامل يتصل بـ PG بدور z → pickPgUrl يقبل postgres فقط.
- next.config.ts: serverExternalPackages: [bullmq, ioredis] (require ديناميكي + روابط أصلية).
- README: مخطط معماري محدَّث (صندوقا job-worker والجدولة + 5 منافذ للحارس + noeviction) · جدول API صف «طوابير المهام» + 38 مساراً · ميزة BullMQ في قسم النظام · قسم كامل «طوابير المهام الخلفية (BullMQ)» بجدول المهام الأربع وجدولها · صف النسخ التلقائي في قسم Backup · خطوتا تثبيت/تشغيل job-worker · صفان جديدان في استكشاف الأخطاء (عامل متوقف + تحذير noeviction) · خارطة طريق (التذكيرات المجدولة عبر BullMQ) · جدول منجز r14 · لقطة r14-jobs-panel.png في قسم لقطات التطبيق.
- تحقق نهائي: المهام الأربع مكتملة (backup 29ms/24.2KB ببيانات مطابقة · cache-warm 23 نقطة بلا أخطاء · cleanup سياسة صحيحة · VACUUM 81ms) · العدادات متطابقة بين الطابور والعامل · agent-browser: لوحة تعمل (جداول + أزرار + إشعارات toast) بلا أي خطأ console، VLM قيّم اللقطة «احترافية ونظيفة ومناسبة لبيئة الإنتاج»، لقطة جوال 390px · lint نظيف (تحذير قديم واحد) · dev.log بلا أخطاء.

Stage Summary:
- BullMQ يعمل من طرف إلى طرف: نسخ احتياطية تلقائية يومياً 03:00 قابلة للاستعادة بزر Recovery، تسخين كاش ساعي، تنظيف أسبوعي، وصيانة قاعدة يومية — مع لوحة مراقبة حيّة للمدير وAPI محمي.
- 5 خدمات الآن تحت الحارس: 3000 · 5432 · 6379 · 3040 · 3041.
- دروس موثقة للجولات القادمة: noeviction إلزامي لـ BullMQ · حارس التفرد يمنع زومبي bun --hot · متغيرات الشل القديمة تتفوق على .env.

---
Task ID: 15-infra
Agent: general-purpose (infra revival)
Task: إعادة بناء PostgreSQL 17 + Valkey 8.1.1 + تشغيل كل الخدمات الخمس بعد إعادة تشغيل الـ sandbox (تنفيذ حرفي لوصفة 1-infra/14-infra)

Work Log:
- الحالة عند البدء: infra/ محذوفة كلياً، لا عمليات postgres/valkey/next/bun، المنافذ 3000/5432/6379/3040/3041 مغلقة، db/custom.db (SQLite) باقٍ كمصدر للترحيل، .env يشير إلى file:...custom.db — ومتغير DATABASE_URL القديم (file:) مصدَّر في بيئة الجلسة (يُعاد حقنه مع كل أمر شل جديد — unset لا يستمر بين الأوامر؛ لذا شُغّلت السكربتات مع unset/بادئة DATABASE_URL في نفس سطر الأمر).
- PostgreSQL 17.11 (17.11-0+deb13u1، Debian trixie): apt-get download للثلاث حزم في /tmp/pgdebs → dpkg-deb -x إلى infra/pg (بعد mkdir -p) — ldd نظيف بلا مكتبات ناقصة. initdb -U garfix --auth=trust كمستخدم z إلى db/postgres-data (مسار PG_DATA الثابت في keepalive) مع LD_LIBRARY_PATH=infra/pg/usr/lib/x86_64-linux-gnu.
- postgresql.conf: unix_socket_directories='/tmp' + listen_addresses='127.0.0.1' + port=5432 → pg_ctl start → pg_isready: accepting connections. ALTER ROLE garfix PASSWORD 'garfix2024' + CREATE DATABASE garfix OWNER garfix (psql عبر LD_LIBRARY_PATH).
- إصلاح .env: DATABASE_URL=file:...custom.db → postgresql://garfix:garfix2024@127.0.0.1:5432/garfix?schema=public (سطر واحد، بلا تنصيص).
- `DATABASE_URL=... bun run db:push` نجح (Prisma 6.19.2 + توليد Client، 70ms).
- مشكلة updatedAt المعروفة تكررت حرفياً (جدول SQLite Company بلا العمود — أعمدة SQLite: id/name/slug/firebaseOwnerId/createdAt فقط) → SET DEFAULT now() قبل الترحيل → DROP DEFAULT بعده (تحقق information_schema: column_default فارغ — المخطط مطابق تماماً).
- `bun scripts/migrate-sqlite-to-pg.ts`: 26 صفاً — 4 شركات (Tawfeer/Mahhal/Boss Neolife/Laqta)، 1 عميل، 14 فاتورة، 6 كتالوج، 1 مشتريات، 0 مدفوعات/تذكيرات/إعدادات + إعادة ضبط sequences (Company←5، invoices←18) — تطابق sqlite=pg في الجداول الثمانية كلها.
- `unset DATABASE_URL && bun scripts/seed-site.ts` نجح: site_content=14 مفتاحاً + team_members=4 أعضاء.
- Valkey 8.1.1 من المصدر: تاربال GitHub (3.7MB) → infra/valkey/valkey-8.1.1 → make -C deps (hiredis linenoise hdr_histogram fpconv lua fast_float_c_interface) → make -C src valkey-server MALLOC=libc (12.66MB، بلا valkey-cli عمداً). valkey.conf: bind 127.0.0.1، port 6379، daemonize no، dir db/valkey-data، maxmemory 256mb، **maxmemory-policy noeviction** (مطلب BullMQ — درس r14، وليس allkeys-lru القديم)، appendonly yes.
- اختبار يدوي لفkey قبل التسليم للحارس: تشغيل detached → ioredis: PING=PONG، version=8.1.1، policy=noeviction، maxmemory=268435456، SET/GET يعملان → إيقاف بالـ PID (3209) ليملك الحارس دورة الحياة.
- تشغيل الحارس: `cd mini-services/keepalive && ( setsid nohup bun run dev > service.log 2>&1 < /dev/null & )` — اكتشف Valkey/pdf-service/job-worker/Next متوقفة فأعادها كلها (مسح .next ثم next dev) خلال ~30 ثانية.

Stage Summary:
- كل الخدمات الخمس حية تحت الحارس (PID 3269): PostgreSQL 127.0.0.1:5432 (pg_isready ok) • Valkey 127.0.0.1:6379 (noeviction مؤكدة حيّة، AOF يكتب في db/valkey-data/appendonlydir) • pdf-service :3040 (chromium جاهز) • job-worker :3041 (عامل BullMQ + 4 Job Schedulers مسجلة: backup 03:00 يومياً · cache-warm كل ساعة · cleanup سبتاً 04:30 · VACUUM 04:15) • next dev :3000 (Ready in 960ms).
- التحقق النهائي: GET /api/healthz → 200 status=ok مع database engine=postgresql ok=true (latency 1–44ms) و cache engine=valkey connected=true — والكاش يعمل فعلياً على Valkey (hits=2/misses=2/writes=2/memKeys=2 بعد طلبات متكررة، ليس fallback الذاكرة) • GET / → 200 • GET /api/companies → 4 شركات • GET /api/site/team → 4 أعضاء • http://127.0.0.1:3041/healthz → ok=true (bullmq@6، الطابور garfix-tasks) • psql: Company=4/invoices=14/clients=1/product_catalog=6/site_content=14/team_members=4 • dev.log وnext-dev.log صفر أخطاء (200 فقط) • keepalive/pdf/job-worker service.log نظيفة.
- انحرافان موثقان سلفاً تكررا كمتوقع (كلاهما من دروس 14-infra): ① mkdir -p infra/pg قبل dpkg-deb -x؛ ② متغير DATABASE_URL=file: القديم مصدَّر في بيئة الشل ويتفوق على .env في Bun — والحل هنا أدق: الحقن يتكرر مع كل أمر شل جديد، فلا يكفي unset مرة واحدة بل ضمن نفس سطر التشغيل (أو بادئة DATABASE_URL=postgresql://... صراحة). لا انحرافات أخرى عن الوصفة — لم تلزم أي خطوة 12 (إعادة تشغيل valkey بسياسة صحيحة) لأن الوضع noeviction منذ الإنشاء ومؤكد حيّاً عبر CONFIG GET.

---
Task ID: r15
Agent: main (Z.ai Code)
Task: إكمال الشات الذكي + ثبات التطبيق بلا zoom + تحقق شامل — طلب المستخدم: «خلص الشات الذكي وخلي التطبيق ثابت بدون zoom ف المنصفح وتحقق من كل شي»

Work Log:
- **إنعاش البنية التحتية** (subagent 15-infra): إعادة بناء PostgreSQL 17.11 + Valkey 8.1.1 (noeviction) + ترحيل البيانات (4 شركات/14 فاتورة) + seed-site + keepalive — كل الخدمات الخمس حية (3000/5432/6379/3040/3041)، healthz سليم، الكاش يعمل فعلياً على Valkey.
- **ثبات بلا zoom (طلب المستخدم)**: viewport في layout.tsx أصبح maximumScale=1 + userScalable=false + interactiveWidget="resizes-content" (قفل تكبير + منع قفزة iOS عند التركيز + سلوك موحّد مع لوحة المفاتيح). شبكة أمان في globals.css: كل حقول الإدخال (‎.inp/input/textarea/select) بخط 16px على الوسائط اللمسية أو عرض ≤640px — إيقاف تكبير المتصفح التلقائي على الجوال نهائياً (سطح المكتب 13px كما كان). تحقق فعلي: iPhone 16 emulation (393px) → inp=16px + scrollWidth=clientWidth=393 بلا أي overflow.
- **إكمال الشات الذكي — إجراءات تنفيذية حقيقية (الميزة الكبرى)**:
  - `src/lib/currency-shared.ts` (جديد): جدول العملات آمن للخادم (مطابق لجدول الواجهة) — fmtMoneyFor/currencyOf.
  - `src/lib/ai-actions.ts` (جديد): 5 إجراءات بقائمة بيضاء: create_client · create_invoice · register_payment · add_catalog_item · log_reminder — كل إجراء: تحقق صارم (هواتف/بريد/تواريخ ISO/مبالغ موجبة/بنود صالحة) ثم تنفيذ بنفس منطق مسارات API القائمة + إبطال الكاش المناسب + ملخص عربي بالعملة الصحيحة. create_invoice يولّد الترقيم بنفس قاعدة التطبيق (INV + max+1) ويحفظ source="smart-chat". register_payment يرفض تجاوز المتبقي على الفاتورة. actionProtocolPrompt() يوثّق بروتوكول ```garfix-action {json}``` في system prompt بقواعد صارمة (بلا اختراع أسعار، سؤال عند النقص، بلا نص داخل الكتلة).
  - `src/app/api/ai/action/route.ts` (جديد): POST {action, args, companySlug} → قائمة بيضاء + تحقق + تنفيذ + العملة من الشركة الفعّالة. «إنسان في الحلقة»: لا كتابة إلا بضغط المستخدم «تنفيذ» في الواجهة.
  - `ai-context.ts`: العملة صارت من Company.currency الفعلية (كانت «د.ك» ثابتة رغم r12!) — كل مبالغ الـ system prompt بمنازل العملة الصحيحة + سطر عملة صريح للموديل + حقن بروتوكول الإجراءات.
  - `SmartChat.jsx` (إعادة كتابة موسّعة): parseActionBlocks() (متسامح: أي كتلة كود JSON فيها action صالح تُنزع من النص) + بطاقات إجراء أنيقة (أيقونة/عنوان/حقول عربية ببطاقة الإجمالي بعملة الشركة/أزرار «تنفيذ الآن» و«تجاهل»/حالة executing بسبينر/نتيجة خضراء أو حمراء/حالة «إجراء من محادثة سابقة» للتاريخ بلا إعادة تنفيذ) + زر 📋 نسخ أي رد (بتأكيد «تم النسخ») + زر ⬇️ تصدير المحادثة كاملة Markdown + اقتراحات إجرائية جديدة بشارة «⚡ أمثلة إجرائية — سأنفّذها فعلياً» + تحديث placeholder وعداد الرسائل.
  - `App.jsx`: SmartChat يستقبل onDataChanged → refreshInvoices + refreshClients بعد كل إجراء ناجح (تحقق فعلي في dev.log: POST /api/ai/action 201 يتبعه GET invoices + clients فوراً).
- **إصلاح صفري**: عند التنقل داخل الشات اكتُشف أن stats الموقع كانت «0» — transient أثناء أول compile بعد إعادة تشغيل الخادم فقط (بعد reload: 4/14/1 صحيحة من الـ API).
- **QA E2E شامل** (agent-browser): اختبار curl لكل الإجراءات الخمسة (201 + أخطاء تحقق 400 الصحيحة: اسم مفقود/هاتف فاقد صلاحية/مبلغ يتجاوز المتبقي/إجراء خارج القائمة) ثم مسح بيانات الاختبار. E2E في المتصفح: طلب «أنشئ فاتورة لسارة الأحمد ببندين…» → المساعد رد بشرح + كتلة garfix-action **JSON صالحة 100%** + سحب هاتف سارة من السياق الحي → بطاقة الإجراء (العميل/الهاتف/البنود/الإجمالي 36.000 د.ك/الاستحقاق) → «تنفيذ» → «تم إنشاء الفاتورة INV10011 بإجمالي 36.000 د.ك (2 بند)» → الفاتورة ظهرت في تبويب الفواتير (بعد ربط onDataChanged) → إعادة تحميل: المحادثة تُسترجع بالبطاقة بحالة «إجراء من محادثة سابقة» والـ JSON الخام مخفي تماماً (0 ظهور). نسخ ✓ تصدير ✓ إيجابيات: أعدت إنشاء عميل «نادي التجار الكويتي» من الشات للتقاط لقطتي التوثيق ثم مسحته.
- **تحقق كل شي**: كل التبويبات (Dashboard/الفواتير/العملاء/التقارير/مشتريات/AI/الشات/طباعة/DeepSeek/الموقع/النظام) صفر أخطاء كونسول · صفحات الموقع العام (#/ #/team #/founder) نظيفة · لوحة BullMQ حية (🟢 العامل يعمل + تنفيذ فوري cache-warm: 23 نقطة 227ms) · ليلي/نهاري سليم · موبايل 393px بلا overflow (شاشة الشات + نموذج فاتورة جديدة بخط 16px) · VLM قيّم لقطات الجوال 9/10 و8/10 (RTL سليم، إنتاجية) · lint: 0 أخطاء (تحذير r11 القديم فقط) · dev.log نظيف.
- **README محدَّث**: ميزة الإجراءات التنفيذية + النسخ/التصدير + عملة الشركة في الشات (قسم الذكاء) · صف /api/ai/action في جدول API (38→39 مساراً) · لقطتا r15-chat-action-card/done في قسم لقطات التطبيق · خارطة الطريق: حذف بند «أدوات المساعد الذكي» المنجز (وتحديث ملاحظة فرض الأدوار لتشمل إجراءات الشات) · صفان جديدان في جدول «منجز حديثاً».
- لقطات جديدة: docs/screenshots/r15-chat-action-card.png + r15-chat-action-done.png + download/r15-chat-mobile.png + r15-chat-dark.png + r15-newinvoice-mobile.png + r15-dashboard.png.
- بيانات الاختبار نُظفت بعد كل تحقق (14 فاتورة / 1 عميل / 0 محادثات / 4 شركات كما كانت).

Stage Summary:
- r15 مكتملة: المساعد الذكي صار **يكمل عمله فعلياً** — يحلل بيانات الشركة الحيّة بعملتها الصحيحة، وعند الطلب يجهّز إجراءً حقيقياً (فاتورة/عميل/دفعة/صنف/تذكير) ببطاقة مراجعة لا تُنفّذ إلا بتأكيد المستخدم، والنتيجة تظهر في الشات وتنعكس فوراً على قوائم النظام. التطبيق الآن «ثابت بلا zoom»: لا تكبير على الإطلاق + لا قفزة تلقائية عند التركيز على الجوال. تحقق شامل لكل الصفحات والميزات والخدمات الخمس بلا أي خطأ.

Unresolved issues / risks / next-phase priorities:
- إجراءات الشات مثل باقي عمليات الكتابة غير الإدارية: بلا توثيق خادمي (كما وُثّق بأمانة في README) — NextAuth + فرض الأدوار على كل الكتابات يبقى الأولوية القصوى.
- الموديل المدمج قد يخطئ أحياناً في تفاصيل صغيرة مقترحة من عنده (لوحظ سنة استحقاق 2026 بدل 2025 مرة) — البطاقة تعرض كل التفاصيل قبل التنفيذ ليمتنع المستخدم عند الشك؛ تحسين لاحق: تحقق ذكي من التواريخ المستقبلية البعيدة.
- تحديد معدل على /api/ai/action غير منفذ (عمليات الكتابة الأخرى مثله) — مرشح للإضافة مع فرض الأدوار.
- next-phase: NextAuth، فرض الأدوار على كل الكتابة (بما فيها ai/action)، تحديد معدل بالإجراءات، أتمتة التذكيرات عبر BullMQ (معالج reminder جاهز الإطار)، إطار زمني للتقارير في الشات.
