import { TRANSLATIONS, LANGUAGES } from "../src/lib/i18n";

const langs = Object.keys(TRANSLATIONS);
const enKeys = Object.keys(TRANSLATIONS["en"] || {});
console.log("Languages:", langs.length, "| en keys:", enKeys.length);

for (const l of langs) {
  const keys = Object.keys(TRANSLATIONS[l] || {});
  const missing = enKeys.filter((k) => !(k in (TRANSLATIONS[l] || {})));
  if (missing.length > 0) {
    console.log(`[${l}] ${keys.length} keys, missing ${missing.length}: ${missing.join(", ")}`);
  }
}
