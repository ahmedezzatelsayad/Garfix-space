#!/usr/bin/env node
/**
 * transform-i18n.js — AST codemod (r20, v2): wraps Arabic UI strings with tr()
 * + logical-direction fixes — ALL edits collected in ORIGINAL src coordinates
 * and applied together in reverse order (no coordinate drift).
 *
 * Edits:
 *  A. tr() wraps (function-level only; jsx-attr gets {tr(...)}; jsx-text → {tr("...")})
 *  B. Direction → logical properties:
 *     - style prop names: marginRight→marginInlineStart, marginLeft→marginInlineEnd,
 *       paddingRight→paddingInlineStart, paddingLeft→paddingInlineEnd
 *     - textAlign:"right"→"start", textAlign:"left"→"end"  (React style values)
 *     - CSS strings/templates (non-Arabic, CSS-looking): text-align:right→start,
 *       text-align:left→end, margin-left:→margin-inline-end:
 *  C. import { tr } from "@/lib/i18n-app" injection (files with tr wraps)
 */
const ts = require("/home/z/my-project/node_modules/typescript");
const fs = require("fs");
const path = require("path");

const ROOT = "/home/z/my-project";
const FILES = [
  "src/components/invoice-app/App.jsx",
  "src/components/invoice-app/statement.js",
  "src/components/invoice-app/currency.js",
  "src/components/invoice-app/context/AuthContext.tsx",
  ...fs.readdirSync(path.join(ROOT, "src/components/invoice-app/components"))
    .filter(f => /\.(jsx|tsx|js)$/.test(f))
    .map(f => `src/components/invoice-app/components/${f}`),
  ...fs.readdirSync(path.join(ROOT, "src/components/invoice-app/pages"))
    .filter(f => /\.(jsx|tsx|js)$/.test(f))
    .map(f => `src/components/invoice-app/pages/${f}`),
  ...fs.readdirSync(path.join(ROOT, "src/components/site"))
    .filter(f => /\.(jsx|tsx|js)$/.test(f))
    .map(f => `src/components/site/${f}`),
];

const AR_LETTER = /[\u0621-\u063A\u0641-\u064A\u0640\u0670-\u06D3\u0750-\u077F]/;
const hasAr = (s) => AR_LETTER.test(String(s || ""));
const DRY = process.argv.includes("--dry");

let totals = { files: 0, tr: 0, jsxText: 0, dirName: 0, dirValue: 0, css: 0, moduleSkipped: 0 };

const DIR_NAME_MAP = {
  marginRight: "marginInlineStart", marginLeft: "marginInlineEnd",
  paddingRight: "paddingInlineStart", paddingLeft: "paddingInlineEnd",
};

for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  const src = fs.readFileSync(full, "utf8");
  const kind = rel.endsWith(".tsx") ? ts.ScriptKind.TSX : rel.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JSX;
  const sf = ts.createSourceFile(full, src, ts.ScriptTarget.ES2022, true, kind);

  const edits = []; // {pos, end, text, tag}
  const moduleLevel = [];

  const enclosingFunc = (chain) => [...chain].reverse().some(p =>
    ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p) ||
    ts.isMethodDeclaration(p) || ts.isConstructorDeclaration(p) || ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p));

  const inTrCall = (node, parents) => {
    const p = parents[parents.length - 1];
    return p && ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === "tr" && p.arguments[0] === node;
  };

  const isPropKey = (node, parents) => {
    const p = parents[parents.length - 1];
    return p && (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment?.(p) === false && false) && p.name === node;
  };

  function fixCss(text) {
    let out = text, n = 0;
    out = out.replace(/text-align\s*:\s*right/g, () => { n++; return "text-align:start"; });
    out = out.replace(/text-align\s*:\s*left/g, () => { n++; return "text-align:end"; });
    out = out.replace(/margin-left\s*:/g, () => { n++; return "margin-inline-end:"; });
    return [out, n];
  }

  (function walk(node, parents) {
    const chain = [...parents, node];
    const p = parents[parents.length - 1];

    // ── A. tr() wraps ──
    if (ts.isStringLiteral(node) && hasAr(node.text)) {
      const isJsxAttr = p && ts.isJsxAttribute(p);
      if (!enclosingFunc(chain)) moduleLevel.push(node.text.slice(0, 50));
      else if (!inTrCall(node, parents) && !(p && ts.isPropertyAssignment(p) && p.name === node)) {
        const raw = src.slice(node.getStart(sf), node.getEnd());
        edits.push({ pos: node.getStart(sf), end: node.getEnd(), text: isJsxAttr ? `{tr(${raw})}` : `tr(${raw})`, tag: "tr" });
        totals.tr++;
      }
    } else if (ts.isNoSubstitutionTemplateLiteral(node) && hasAr(node.text)) {
      if (!enclosingFunc(chain)) moduleLevel.push(node.text.slice(0, 50));
      else if (!inTrCall(node, parents)) {
        const raw = src.slice(node.getStart(sf), node.getEnd());
        edits.push({ pos: node.getStart(sf), end: node.getEnd(), text: `tr(${raw})`, tag: "tr" });
        totals.tr++;
      }
    } else if (ts.isTemplateExpression(node)) {
      const fullText = node.getText(sf);
      if (hasAr(fullText)) {
        if (!enclosingFunc(chain)) moduleLevel.push(fullText.slice(0, 50));
        else if (!inTrCall(node, parents)) {
          let pattern = node.head.text;
          const args = [];
          for (const span of node.templateSpans) {
            pattern += `{${args.length}}` + span.literal.text;
            args.push(span.expression.getText(sf));
          }
          if (hasAr(pattern)) {
            const call = args.length ? `tr(${JSON.stringify(pattern)},[${args.join(",")}])` : `tr(${JSON.stringify(pattern)})`;
            edits.push({ pos: node.getStart(sf), end: node.getEnd(), text: call, tag: "tr" });
            totals.tr++;
          }
        }
      }
    } else if (ts.isJsxText(node) && hasAr(node.getText(sf))) {
      if (!enclosingFunc(chain)) moduleLevel.push(node.getText(sf).slice(0, 50));
      else {
        const raw = node.getText(sf);
        const lead = raw.length - raw.trimStart().length;
        const trail = raw.length - raw.trimEnd().length;
        edits.push({
          pos: node.getStart(sf) + lead, end: node.getEnd() - trail,
          text: `{tr(${JSON.stringify(raw.trim())})}`, tag: "jsxtext",
        });
        totals.jsxText++;
      }
    }

    // ── B1. style prop name → logical ──
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && DIR_NAME_MAP[node.name.text]) {
      edits.push({ pos: node.name.getStart(sf), end: node.name.getEnd(), text: DIR_NAME_MAP[node.name.text], tag: "dirname" });
      totals.dirName++;
    }

    // ── B2. textAlign value → start/end ──
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === "textAlign" &&
        ts.isStringLiteral(node.initializer) && (node.initializer.text === "right" || node.initializer.text === "left")) {
      edits.push({
        pos: node.initializer.getStart(sf), end: node.initializer.getEnd(),
        text: node.initializer.text === "right" ? '"start"' : '"end"', tag: "dirvalue",
      });
      totals.dirValue++;
    }

    // ── B3. CSS fixes inside non-Arabic CSS-looking template/string literals ──
    const isLiteralish = ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node);
    if (isLiteralish && !hasAr(node.text)) {
      const t = node.text;
      if (t.includes("{") && t.includes("}") && /text-align\s*:\s*(right|left)|margin-left\s*:/.test(t)) {
        const [fixed, n] = fixCss(t);
        if (n > 0) {
          const raw = src.slice(node.getStart(sf), node.getEnd());
          const quote = raw[0];
          if (quote === "`") {
            edits.push({ pos: node.getStart(sf), end: node.getEnd(), text: "`" + fixed + "`", tag: "css" });
          } else {
            edits.push({ pos: node.getStart(sf), end: node.getEnd(), text: JSON.stringify(fixed), tag: "css" });
          }
          totals.css++;
        }
      }
    }

    node.forEachChild(child => walk(child, chain));
  })(sf, []);

  // dedupe overlapping edits (keep first — e.g. css literal inside a tr-wrapped template is Arabic → excluded anyway)
  edits.sort((a, b) => a.pos - b.pos || b.end - a.end);
  const applied = [];
  let lastEnd = -1;
  for (const e of edits) {
    if (e.pos >= lastEnd) { applied.push(e); lastEnd = e.end; }
  }

  let out = src;
  for (let i = applied.length - 1; i >= 0; i--) {
    const e = applied[i];
    out = out.slice(0, e.pos) + e.text + out.slice(e.end);
  }

  // ── C. import injection (position: after last top-level import — recompute on out) ──
  const hasTrWrap = applied.some(e => e.tag === "tr" || e.tag === "jsxtext");
  let importAdded = false;
  if (hasTrWrap && !/from\s+"@\/lib\/i18n-app"/.test(out)) {
    let insertPos = 0, found = false;
    for (const st of sf.statements) {
      if (ts.isImportDeclaration(st)) { insertPos = st.getEnd(); found = true; }
      else if (found) break;
    }
    out = out.slice(0, insertPos) + `\nimport { tr } from "@/lib/i18n-app";` + out.slice(insertPos);
    importAdded = true;
  }

  totals.moduleSkipped += moduleLevel.length;
  if (applied.length || moduleLevel.length) {
    totals.files++;
    if (!DRY) fs.writeFileSync(full, out);
    const byTag = {};
    for (const e of applied) byTag[e.tag] = (byTag[e.tag] || 0) + 1;
    console.log(`${path.basename(rel)}: ${JSON.stringify(byTag)}${importAdded ? " +import" : ""}${moduleLevel.length ? ` moduleSkip=${moduleLevel.length}` : ""}`);
  }
}

console.log(`\nTOTALS: ${JSON.stringify(totals)}${DRY ? " (DRY)" : ""}`);
