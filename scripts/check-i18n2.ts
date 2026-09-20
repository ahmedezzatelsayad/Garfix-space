import { TRANSLATIONS } from "../src/lib/i18n";
const keys = ["nav.menu","nav.app","hero.badge","hero.ctaPrimary","hero.ctaSecondary","pricing.freeForever","pricing.cancelRequest","pricing.seatsFull","pricing.requestCancelled","login.phone","login.forgotTitle","login.forgotHint","login.send","login.back","login.haveAccount","login.noAccount","login.freeBadge","login.seatsLeftShort","login.success","account.title","account.saved","account.currentPlanBadge","account.unlimitedNote","account.pendingRequest","account.cancelRequest","account.requestNote","account.requestNotePlaceholder","account.memberSince","account.companiesList","common.error","common.retry","common.optional","common.enabled","common.disabled"];
for (const k of keys) {
  console.log(`${k}\n  ar: ${TRANSLATIONS["ar"][k]}\n  en: ${TRANSLATIONS["en"][k]}`);
}
