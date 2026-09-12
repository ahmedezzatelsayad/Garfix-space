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
