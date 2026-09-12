"use client";

import { useEffect, useState } from "react";

// ─── Invoice-app theme: light / dark with persistence ─────────────
// The <html data-theme="..."> attribute drives the --ia-* CSS vars
// declared in src/app/globals.css. A tiny inline script in layout.tsx
// applies the stored choice before first paint (no flash).
// Components read the current mode through useTheme() — the
// MutationObserver keeps every mounted instance in sync when toggled.

const hexRGB = h => {
  const s = String(h || "").replace("#", "");
  const full = s.length === 3 ? s.split("").map(c => c + c).join("") : s;
  const n = parseInt(full, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");

/** Blend two hex colors: a → b by t (0..1). Returns "#rrggbb". */
export const mix = (a, b, t) => {
  const A = hexRGB(a), B = hexRGB(b);
  return "#" + A.map((v, i) => toHex(v + (B[i] - v) * t)).join("");
};

/** Lighten a hex color toward white by t (0..1). */
export const lighten = (c, t) => mix(c, "#ffffff", t);

/**
 * Auto-adapt a TEXT color for dark mode: dark colors get lightened
 * (proportionally to their luminance), bright colors stay as-is.
 * In light mode returns the color unchanged.
 */
export const txAdapt = (c, dark) => {
  if (!dark) return c;
  const [r, g, b] = hexRGB(c);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const t = lum < 80 ? 0.55 : lum < 140 ? 0.4 : lum < 200 ? 0.22 : 0.08;
  return mix(c, "#ffffff", t);
};

/**
 * Dark-mode variant of a pastel soft background (KPI cards, stat boxes):
 * keeps the hue but blends toward the dark card surface (#1a2130 = --ia-card).
 */
export const softAdapt = (pastel, dark) => (dark ? mix(pastel, "#1a2130", 0.85) : pastel);

/** Recharts internals use SVG attributes → CSS vars don't resolve there. */
export const chartColors = dark => dark
  ? { axis: "#9aa7bd", axis2: "#7f8ba3", grid: "#273042", green: "#4ade80", blue: "#93c5fd", violet: "#c4b5fd", amber: "#fbbf24", red: "#f87171" }
  : { axis: "#6b7280", axis2: "#9ca3af", grid: "#f0f0f0", green: "#16a34a", blue: "#2563eb", violet: "#7c3aed", amber: "#d97706", red: "#dc2626" };

export function useTheme() {
  // Start as light to match SSR output; the effect below syncs to the
  // real DOM value right after mount (no hydration mismatch).
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const read = () => setDark(document.documentElement.dataset.theme === "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const toggle = () => {
    const el = document.documentElement;
    const next = el.dataset.theme !== "dark";
    el.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("tw_theme", next ? "dark" : "light"); } catch {}
    setDark(next);
  };

  return { dark, toggle };
}
