#!/usr/bin/env node
/**
 * extract-arabic.js — AST-based extraction of Arabic UI strings from the invoice-app.
 * Uses TypeScript compiler API to precisely find:
 *  - StringLiteral containing Arabic letters (skips pure Arabic-Indic digits like "٠١٢٣٤٥٦٧٨٩")
 *  - NoSubstitutionTemplateLiteral containing Arabic
 *  - TemplateExpression with Arabic (pattern + arg expressions)
 *  - JsxText containing Arabic
 * Tracks whether each occurrence is module-level (needs manual care) or inside a function.
 * Output: /home/z/my-project/scripts/arabic-strings.json
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

// Arabic LETTERS only (excludes Arabic-Indic digits U+0660-0669 & punctuation)
const AR_LETTER = /[\u0621\u0622\u0623\u0624\u0625\u0626\u0627\u0628\u0629\u062A\u062B\u062C\u062D\u062E\u062F\u0630\u0631\u0632\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063A\u063F\u0640\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u0648\u064A\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0670\u0671\u0672-\u06D3\u0750-\u077F]/;
const hasArabicLetters = (s) => AR_LETTER.test(String(s || ""));

function parse(file) {
  const full = path.join(ROOT, file);
  const text = fs.readFileSync(full, "utf8");
  return ts.createSourceFile(full, text, ts.ScriptTarget.ES2022, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : file.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JSX);
}

const results = []; // {file, kind, text, pattern, args, moduleLevel, line, raw}
const seen = new Map(); // unique key -> count

function walk(node, parents, file, sf) {
  const chain = [...parents, node];
  const enclosing = [...chain].reverse().find(p =>
    ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p) ||
    ts.isMethodDeclaration(p) || ts.isConstructorDeclaration(p) || ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p));
  const moduleLevel = !enclosing;
  const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;

  if (ts.isStringLiteral(node) && hasArabicLetters(node.text)) {
    const parent = parents[parents.length - 1];
    const inJsxAttr = parent && ts.isJsxAttribute(parent);
    results.push({ file, kind: inJsxAttr ? "jsx-attr" : "string", text: node.text, moduleLevel, line, pos: node.getStart(), end: node.getEnd() });
  } else if (ts.isNoSubstitutionTemplateLiteral(node) && hasArabicLetters(node.text)) {
    results.push({ file, kind: "template", text: node.text, moduleLevel, line, pos: node.getStart(), end: node.getEnd() });
  } else if (ts.isTemplateExpression(node)) {
    const fullText = node.getText(sf);
    if (hasArabicLetters(fullText)) {
      // build pattern with {i} placeholders
      let pattern = node.head.text;
      const args = [];
      node.templateSpans.forEach(span => {
        pattern += `{${args.length}}` + span.literal.text;
        args.push(span.expression.getText(sf));
      });
      // skip pure digit maps (e.g. "٠١٢٣٤٥٦٧٨٩")
      if (hasArabicLetters(pattern)) {
        results.push({ file, kind: "template-expr", text: pattern, args, moduleLevel, line, pos: node.getStart(), end: node.getEnd() });
      }
    }
  } else if (ts.isJsxText(node) && hasArabicLetters(node.getText(sf))) {
    results.push({ file, kind: "jsx-text", text: node.getText(sf), moduleLevel, line, pos: node.getStart(), end: node.getEnd() });
  }

  node.forEachChild(child => walk(child, chain, file, sf));
}

for (const f of FILES) {
  try {
    const sf = parse(f);
    walk(sf, [], f, sf);
  } catch (e) {
    console.error(`PARSE FAIL ${f}: ${e.message}`);
  }
}

// unique strings report
for (const r of results) {
  const key = r.kind === "template-expr" ? r.text : r.text.trim();
  seen.set(key, (seen.get(key) || 0) + 1);
}

const unique = [...seen.entries()].sort((a, b) => b[1] - a[1]);
const moduleLevelUniques = [...new Set(results.filter(r => r.moduleLevel).map(r => (r.kind === "template-expr" ? r.text : r.text.trim())))];

const report = {
  totalOccurrences: results.length,
  uniqueCount: unique.length,
  moduleLevelUniques,
  uniques: unique.map(([text, count]) => ({ text, count })),
  details: results.map(r => ({ file: r.file, kind: r.kind, line: r.line, moduleLevel: r.moduleLevel, text: r.kind === "template-expr" ? r.text : r.text.trim(), args: r.args })),
};
fs.writeFileSync(path.join(__dirname, "arabic-strings.json"), JSON.stringify(report, null, 1));
console.log(`occurrences: ${results.length}, unique: ${unique.length}, module-level uniques: ${moduleLevelUniques.length}`);
console.log(`per-file:`);
const perFile = {};
for (const r of results) perFile[r.file] = (perFile[r.file] || 0) + 1;
for (const [f, c] of Object.entries(perFile).sort((a, b) => b[1] - a[1])) console.log(`  ${c}\t${f}`);
console.log(`\nMODULE-LEVEL (manual handling):`);
for (const m of moduleLevelUniques) console.log(`  "${m.slice(0, 80)}"`);
