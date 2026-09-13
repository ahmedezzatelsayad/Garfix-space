/**
 * PDF Service — HTML → PDF conversion via Playwright (Chromium headless)
 * Port: 3040 (fixed). Called server-to-server by Next.js route /api/pdf.
 *
 * Robustness: the Tajawal Google-Font stylesheet + woff2 files are fetched once,
 * inlined as data URIs and cached — PDF generation then has ZERO network
 * dependencies (deterministic rendering, no hangs on flaky external fonts).
 *
 * POST /  { html: string, filename?: string, format?: "A4"|"A5", landscape?: boolean }
 *   → 200 application/pdf (binary)
 *   → 400 invalid JSON / missing html
 *   → 500 conversion failure (logged to stdout)
 * GET /healthz → 200 { ok: true, fonts: boolean }
 */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { homedir } from "node:os";

const PORT = 3040;

// Locate a usable Chromium binary from the playwright cache
const CANDIDATES = [
  `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`,
  `${homedir()}/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome`,
  `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux/chrome`,
  `${homedir()}/.cache/ms-playwright/chromium-1200/chrome-linux/chrome`,
];
const EXECUTABLE = CANDIDATES.find((p) => existsSync(p));

let browserPromise: Promise<import("playwright-core").Browser> | null = null;

async function getBrowser() {
  if (!browserPromise) {
    const launchOpts: Parameters<typeof chromium.launch>[0] = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--font-render-hinting=none",
      ],
    };
    if (EXECUTABLE) (launchOpts as Record<string, unknown>).executablePath = EXECUTABLE;
    browserPromise = chromium.launch(launchOpts);
  }
  return browserPromise;
}

// ── Tajawal font inlining (removes external-network dependency) ──────────
const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap";
let fontCssCache: string | null = null;
let fontFailedAt = 0; // last failure timestamp — retry after 60s (transient network errors)

async function getInlinedFontCss(): Promise<string> {
  if (fontCssCache !== null) return fontCssCache;
  if (fontFailedAt && Date.now() - fontFailedAt < 60_000) return "";
  try {
    const res = await fetch(FONT_CSS_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
      signal: AbortSignal.timeout(8000),
    });
    let css = await res.text();
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
    let inlined = 0;
    for (const u of urls) {
      try {
        const fRes = await fetch(u, { signal: AbortSignal.timeout(8000) });
        const b64 = Buffer.from(await fRes.arrayBuffer()).toString("base64");
        css = css.split(u).join(`data:font/woff2;base64,${b64}`);
        inlined++;
      } catch {
        // leave the original url as-is; chromium will fall back to system fonts
      }
    }
    fontCssCache = inlined > 0 ? css : "";
    fontFailedAt = 0;
    console.log(`[pdf-service] Tajawal inlined: ${inlined}/${urls.length} woff2 files`);
  } catch {
    fontCssCache = "";
    fontFailedAt = Date.now();
    console.warn("[pdf-service] Tajawal fetch failed — using system fonts (will retry in 60s)");
  }
  return fontCssCache;
}

/** Replace any fonts.googleapis.com <link> with the cached inline <style>. */
function inlineFonts(html: string, fontCss: string): string {
  if (!fontCss) {
    // Drop the external stylesheet entirely so it can never block rendering
    return html.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, "");
  }
  return html.replace(
    /<link[^>]*fonts\.googleapis\.com[^>]*>/gi,
    `<style>${fontCss}</style>`,
  );
}

const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5 MB safety cap

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    if (req.method === "GET" && new URL(req.url).pathname === "/healthz") {
      return Response.json({
        ok: true,
        chromium: EXECUTABLE ? EXECUTABLE.split("/").slice(-3, -1).join("/") : "bundled",
        fontsInlined: fontCssCache !== null && fontCssCache.length > 0,
      });
    }

    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    let body: { html?: string; filename?: string; format?: string; landscape?: boolean };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { html, format = "A4", landscape = false } = body ?? {};
    if (typeof html !== "string" || html.length === 0) {
      return Response.json({ error: "Missing 'html' field" }, { status: 400 });
    }
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      return Response.json({ error: "html exceeds 5MB limit" }, { status: 413 });
    }
    const paper = format === "A5" ? "A5" : "A4";

    let pdf: Buffer;
    try {
      const fontCss = await getInlinedFontCss();
      const browser = await getBrowser();
      const context = await browser.newContext({ locale: "ar-KW" });
      const page = await context.newPage();
      try {
        // Offline the page: only data: URIs survive, everything else is aborted
        await page.route("**/*", (route) => {
          const url = route.request().url();
          if (url.startsWith("data:")) return route.continue();
          return route.abort();
        });
        await page.setContent(inlineFonts(html, fontCss), {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
        // Bounded wait for the (now inlined) fonts to be ready
        await Promise.race([
          page
            .evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready)
            .catch(() => undefined),
          new Promise((r) => setTimeout(r, 2500)),
        ]);
        pdf = Buffer.from(
          await page.pdf({
            format: paper,
            landscape,
            printBackground: true,
            preferCSSPageSize: false,
            margin: { top: "8mm", bottom: "8mm", left: "6mm", right: "6mm" },
          }),
        );
      } finally {
        await page.close();
        await context.close();
      }
    } catch (err) {
      // Reset the cached browser so a crashed instance is not reused
      browserPromise = null;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[pdf-service] conversion failed: ${message}`);
      return Response.json({ error: "PDF conversion failed", detail: message }, { status: 500 });
    }

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.length),
        "Cache-Control": "no-store",
      },
    });
  },
});

console.log(`[pdf-service] listening on :${PORT} (chromium: ${EXECUTABLE ?? "bundled"})`);
export default server;
