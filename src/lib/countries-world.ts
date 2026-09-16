/**
 * 3-i18n-data: «عملات العالم + الضرائب لكل دولة» — جدول دول العالم لـ Garfix.
 *
 * بيانات صرفة بلا أي استيرادات — آمنة للاستيراد من الواجهة والخادم معاً.
 * 195 مدخلاً: 192 دولة عضواً في الأمم المتحدة + فلسطين (PS) + تايوان (TW) + هونغ كونغ (HK).
 * - العملة: أرقى عملة رسمية شائعة الاستخدام (ISO-4217) — مثل HR/BG→EUR (2023/2025)،
 *   CU→CUP، PA/TL/EC/SV/ZW→USD (دولار دولارات رسمية)، SL→SLE، VE→VES.
 * - الضريبة: النسبة القياسية الحالية (2024-2026) لضريبة القيمة المضافة/GST/ضريبة المبيعات،
 *   و0 عند عدم وجود ضريبة عامة أو عند عدم اليقين (لا تُخترع أرقام). أمثلة موثقة:
 *   KW=0، SA=15، AE=5، CH=8.1، BO=14.9، CM=19.25، CG=18.9 (18% + 5% ضريبة إضافية)،
 *   EE=24 (من 7/2025)، GW=19 (ضريبة قيمة مضافة من 1/2025)، FI=24 (وفق المواصفة).
 * - الترتيب: الدول العربية أولاً (الكويت والخليج ثم الباقي أبجدياً)، ثم
 *   mena→europe→asia→americas→africa→oceania، وأبجدياً بالكود داخل كل مجموعة.
 * - r23: فلسطين (PS) هي الدولة المعروضة لهذه الأرض — بلا أي إدخال آخر.
 */

export type Region = "arab" | "mena" | "europe" | "asia" | "americas" | "africa" | "oceania";

export interface WorldCountry {
  code: string; // ISO-3166 alpha-2 (كبيرة)
  nameAr: string; // الاسم العربي
  nameEn: string; // الاسم الإنجليزي
  currency: string; // أرقى عملة رسمية شائعة (ISO-4217)
  region: Region;
  vat: number; // النسبة القياسية % (0 = لا ضريبة عامة)
  arabic: boolean; // true لأعضاء جامعة الدول العربية (22)
}

export const WORLD_COUNTRIES: WorldCountry[] = [
  // ═══ الدول العربية (22) — الكويت والخليج أولاً ثم الباقي أبجدياً ═══
  { code: "KW", nameAr: "الكويت", nameEn: "Kuwait", currency: "KWD", region: "arab", vat: 0, arabic: true },
  { code: "SA", nameAr: "السعودية", nameEn: "Saudi Arabia", currency: "SAR", region: "arab", vat: 15, arabic: true },
  { code: "AE", nameAr: "الإمارات", nameEn: "United Arab Emirates", currency: "AED", region: "arab", vat: 5, arabic: true },
  { code: "QA", nameAr: "قطر", nameEn: "Qatar", currency: "QAR", region: "arab", vat: 0, arabic: true },
  { code: "BH", nameAr: "البحرين", nameEn: "Bahrain", currency: "BHD", region: "arab", vat: 10, arabic: true },
  { code: "OM", nameAr: "عُمان", nameEn: "Oman", currency: "OMR", region: "arab", vat: 5, arabic: true },
  { code: "DJ", nameAr: "جيبوتي", nameEn: "Djibouti", currency: "DJF", region: "arab", vat: 10, arabic: true },
  { code: "DZ", nameAr: "الجزائر", nameEn: "Algeria", currency: "DZD", region: "arab", vat: 19, arabic: true },
  { code: "EG", nameAr: "مصر", nameEn: "Egypt", currency: "EGP", region: "arab", vat: 14, arabic: true },
  { code: "IQ", nameAr: "العراق", nameEn: "Iraq", currency: "IQD", region: "arab", vat: 15, arabic: true },
  { code: "JO", nameAr: "الأردن", nameEn: "Jordan", currency: "JOD", region: "arab", vat: 16, arabic: true },
  { code: "KM", nameAr: "جزر القمر", nameEn: "Comoros", currency: "KMF", region: "arab", vat: 0, arabic: true },
  { code: "LB", nameAr: "لبنان", nameEn: "Lebanon", currency: "LBP", region: "arab", vat: 11, arabic: true },
  { code: "LY", nameAr: "ليبيا", nameEn: "Libya", currency: "LYD", region: "arab", vat: 0, arabic: true },
  { code: "MA", nameAr: "المغرب", nameEn: "Morocco", currency: "MAD", region: "arab", vat: 20, arabic: true },
  { code: "MR", nameAr: "موريتانيا", nameEn: "Mauritania", currency: "MRU", region: "arab", vat: 16, arabic: true },
  { code: "PS", nameAr: "فلسطين", nameEn: "Palestine", currency: "JOD", region: "arab", vat: 16, arabic: true },
  { code: "SD", nameAr: "السودان", nameEn: "Sudan", currency: "SDG", region: "arab", vat: 17, arabic: true },
  { code: "SO", nameAr: "الصومال", nameEn: "Somalia", currency: "SOS", region: "arab", vat: 0, arabic: true },
  { code: "SY", nameAr: "سوريا", nameEn: "Syria", currency: "SYP", region: "arab", vat: 0, arabic: true },
  { code: "TN", nameAr: "تونس", nameEn: "Tunisia", currency: "TND", region: "arab", vat: 19, arabic: true },
  { code: "YE", nameAr: "اليمن", nameEn: "Yemen", currency: "YER", region: "arab", vat: 5, arabic: true },

  // ═══ الشرق الأوسط غير العربي (mena) ═══
  { code: "IR", nameAr: "إيران", nameEn: "Iran", currency: "IRR", region: "mena", vat: 10, arabic: false },
  { code: "TR", nameAr: "تركيا", nameEn: "Turkey", currency: "TRY", region: "mena", vat: 20, arabic: false },

  // ═══ أوروبا (44) ═══
  { code: "AL", nameAr: "ألبانيا", nameEn: "Albania", currency: "ALL", region: "europe", vat: 20, arabic: false },
  { code: "AD", nameAr: "أندورا", nameEn: "Andorra", currency: "EUR", region: "europe", vat: 4.5, arabic: false },
  { code: "AT", nameAr: "النمسا", nameEn: "Austria", currency: "EUR", region: "europe", vat: 20, arabic: false },
  { code: "BA", nameAr: "البوسنة والهرسك", nameEn: "Bosnia and Herzegovina", currency: "BAM", region: "europe", vat: 17, arabic: false },
  { code: "BE", nameAr: "بلجيكا", nameEn: "Belgium", currency: "EUR", region: "europe", vat: 21, arabic: false },
  { code: "BG", nameAr: "بلغاريا", nameEn: "Bulgaria", currency: "EUR", region: "europe", vat: 20, arabic: false },
  { code: "BY", nameAr: "بيلاروسيا", nameEn: "Belarus", currency: "BYN", region: "europe", vat: 20, arabic: false },
  { code: "CH", nameAr: "سويسرا", nameEn: "Switzerland", currency: "CHF", region: "europe", vat: 8.1, arabic: false },
  { code: "CY", nameAr: "قبرص", nameEn: "Cyprus", currency: "EUR", region: "europe", vat: 19, arabic: false },
  { code: "CZ", nameAr: "التشيك", nameEn: "Czechia", currency: "CZK", region: "europe", vat: 21, arabic: false },
  { code: "DE", nameAr: "ألمانيا", nameEn: "Germany", currency: "EUR", region: "europe", vat: 19, arabic: false },
  { code: "DK", nameAr: "الدنمارك", nameEn: "Denmark", currency: "DKK", region: "europe", vat: 25, arabic: false },
  { code: "EE", nameAr: "إستونيا", nameEn: "Estonia", currency: "EUR", region: "europe", vat: 24, arabic: false },
  { code: "ES", nameAr: "إسبانيا", nameEn: "Spain", currency: "EUR", region: "europe", vat: 21, arabic: false },
  { code: "FI", nameAr: "فنلندا", nameEn: "Finland", currency: "EUR", region: "europe", vat: 24, arabic: false },
  { code: "FR", nameAr: "فرنسا", nameEn: "France", currency: "EUR", region: "europe", vat: 20, arabic: false },
  { code: "GB", nameAr: "المملكة المتحدة", nameEn: "United Kingdom", currency: "GBP", region: "europe", vat: 20, arabic: false },
  { code: "GR", nameAr: "اليونان", nameEn: "Greece", currency: "EUR", region: "europe", vat: 24, arabic: false },
  { code: "HR", nameAr: "كرواتيا", nameEn: "Croatia", currency: "EUR", region: "europe", vat: 25, arabic: false },
  { code: "HU", nameAr: "هنغاريا", nameEn: "Hungary", currency: "HUF", region: "europe", vat: 27, arabic: false },
  { code: "IE", nameAr: "أيرلندا", nameEn: "Ireland", currency: "EUR", region: "europe", vat: 23, arabic: false },
  { code: "IS", nameAr: "آيسلندا", nameEn: "Iceland", currency: "ISK", region: "europe", vat: 24, arabic: false },
  { code: "IT", nameAr: "إيطاليا", nameEn: "Italy", currency: "EUR", region: "europe", vat: 22, arabic: false },
  { code: "LI", nameAr: "ليختنشتاين", nameEn: "Liechtenstein", currency: "CHF", region: "europe", vat: 8.1, arabic: false },
  { code: "LT", nameAr: "ليتوانيا", nameEn: "Lithuania", currency: "EUR", region: "europe", vat: 21, arabic: false },
  { code: "LU", nameAr: "لوكسمبورغ", nameEn: "Luxembourg", currency: "EUR", region: "europe", vat: 17, arabic: false },
  { code: "LV", nameAr: "لاتفيا", nameEn: "Latvia", currency: "EUR", region: "europe", vat: 21, arabic: false },
  { code: "MC", nameAr: "موناكو", nameEn: "Monaco", currency: "EUR", region: "europe", vat: 20, arabic: false },
  { code: "MD", nameAr: "مولدوفا", nameEn: "Moldova", currency: "MDL", region: "europe", vat: 20, arabic: false },
  { code: "ME", nameAr: "الجبل الأسود", nameEn: "Montenegro", currency: "EUR", region: "europe", vat: 21, arabic: false },
  { code: "MK", nameAr: "مقدونيا الشمالية", nameEn: "North Macedonia", currency: "MKD", region: "europe", vat: 19, arabic: false },
  { code: "MT", nameAr: "مالطا", nameEn: "Malta", currency: "EUR", region: "europe", vat: 18, arabic: false },
  { code: "NL", nameAr: "هولندا", nameEn: "Netherlands", currency: "EUR", region: "europe", vat: 21, arabic: false },
  { code: "NO", nameAr: "النرويج", nameEn: "Norway", currency: "NOK", region: "europe", vat: 25, arabic: false },
  { code: "PL", nameAr: "بولندا", nameEn: "Poland", currency: "PLN", region: "europe", vat: 23, arabic: false },
  { code: "PT", nameAr: "البرتغال", nameEn: "Portugal", currency: "EUR", region: "europe", vat: 23, arabic: false },
  { code: "RO", nameAr: "رومانيا", nameEn: "Romania", currency: "RON", region: "europe", vat: 19, arabic: false },
  { code: "RS", nameAr: "صربيا", nameEn: "Serbia", currency: "RSD", region: "europe", vat: 20, arabic: false },
  { code: "RU", nameAr: "روسيا", nameEn: "Russia", currency: "RUB", region: "europe", vat: 20, arabic: false },
  { code: "SE", nameAr: "السويد", nameEn: "Sweden", currency: "SEK", region: "europe", vat: 25, arabic: false },
  { code: "SI", nameAr: "سلوفينيا", nameEn: "Slovenia", currency: "EUR", region: "europe", vat: 22, arabic: false },
  { code: "SK", nameAr: "سلوفاكيا", nameEn: "Slovakia", currency: "EUR", region: "europe", vat: 20, arabic: false },
  { code: "SM", nameAr: "سان مارينو", nameEn: "San Marino", currency: "EUR", region: "europe", vat: 22, arabic: false },
  { code: "UA", nameAr: "أوكرانيا", nameEn: "Ukraine", currency: "UAH", region: "europe", vat: 20, arabic: false },

  // ═══ آسيا (34 — منها TW وHK خارج عضوية الأمم المتحدة) ═══
  { code: "AF", nameAr: "أفغانستان", nameEn: "Afghanistan", currency: "AFN", region: "asia", vat: 10, arabic: false },
  { code: "AM", nameAr: "أرمينيا", nameEn: "Armenia", currency: "AMD", region: "asia", vat: 20, arabic: false },
  { code: "AZ", nameAr: "أذربيجان", nameEn: "Azerbaijan", currency: "AZN", region: "asia", vat: 18, arabic: false },
  { code: "BD", nameAr: "بنغلاديش", nameEn: "Bangladesh", currency: "BDT", region: "asia", vat: 15, arabic: false },
  { code: "BN", nameAr: "بروناي", nameEn: "Brunei", currency: "BND", region: "asia", vat: 0, arabic: false },
  { code: "BT", nameAr: "بوتان", nameEn: "Bhutan", currency: "BTN", region: "asia", vat: 0, arabic: false },
  { code: "CN", nameAr: "الصين", nameEn: "China", currency: "CNY", region: "asia", vat: 13, arabic: false },
  { code: "GE", nameAr: "جورجيا", nameEn: "Georgia", currency: "GEL", region: "asia", vat: 18, arabic: false },
  { code: "HK", nameAr: "هونغ كونغ", nameEn: "Hong Kong", currency: "HKD", region: "asia", vat: 0, arabic: false },
  { code: "ID", nameAr: "إندونيسيا", nameEn: "Indonesia", currency: "IDR", region: "asia", vat: 11, arabic: false },
  { code: "IN", nameAr: "الهند", nameEn: "India", currency: "INR", region: "asia", vat: 18, arabic: false },
  { code: "JP", nameAr: "اليابان", nameEn: "Japan", currency: "JPY", region: "asia", vat: 10, arabic: false },
  { code: "KG", nameAr: "قيرغيزستان", nameEn: "Kyrgyzstan", currency: "KGS", region: "asia", vat: 12, arabic: false },
  { code: "KH", nameAr: "كمبوديا", nameEn: "Cambodia", currency: "KHR", region: "asia", vat: 10, arabic: false },
  { code: "KP", nameAr: "كوريا الشمالية", nameEn: "North Korea", currency: "KPW", region: "asia", vat: 0, arabic: false },
  { code: "KR", nameAr: "كوريا الجنوبية", nameEn: "South Korea", currency: "KRW", region: "asia", vat: 10, arabic: false },
  { code: "KZ", nameAr: "كازاخستان", nameEn: "Kazakhstan", currency: "KZT", region: "asia", vat: 12, arabic: false },
  { code: "LA", nameAr: "لاوس", nameEn: "Laos", currency: "LAK", region: "asia", vat: 10, arabic: false },
  { code: "LK", nameAr: "سريلانكا", nameEn: "Sri Lanka", currency: "LKR", region: "asia", vat: 18, arabic: false },
  { code: "MM", nameAr: "ميانمار", nameEn: "Myanmar", currency: "MMK", region: "asia", vat: 5, arabic: false },
  { code: "MN", nameAr: "منغوليا", nameEn: "Mongolia", currency: "MNT", region: "asia", vat: 10, arabic: false },
  { code: "MV", nameAr: "جزر المالديف", nameEn: "Maldives", currency: "MVR", region: "asia", vat: 8, arabic: false },
  { code: "MY", nameAr: "ماليزيا", nameEn: "Malaysia", currency: "MYR", region: "asia", vat: 10, arabic: false },
  { code: "NP", nameAr: "نيبال", nameEn: "Nepal", currency: "NPR", region: "asia", vat: 13, arabic: false },
  { code: "PH", nameAr: "الفلبين", nameEn: "Philippines", currency: "PHP", region: "asia", vat: 12, arabic: false },
  { code: "PK", nameAr: "باكستان", nameEn: "Pakistan", currency: "PKR", region: "asia", vat: 17, arabic: false },
  { code: "SG", nameAr: "سنغافورة", nameEn: "Singapore", currency: "SGD", region: "asia", vat: 9, arabic: false },
  { code: "TJ", nameAr: "طاجيكستان", nameEn: "Tajikistan", currency: "TJS", region: "asia", vat: 20, arabic: false },
  { code: "TH", nameAr: "تايلاند", nameEn: "Thailand", currency: "THB", region: "asia", vat: 7, arabic: false },
  { code: "TL", nameAr: "تيمور الشرقية", nameEn: "Timor-Leste", currency: "USD", region: "asia", vat: 0, arabic: false },
  { code: "TM", nameAr: "تركمانستان", nameEn: "Turkmenistan", currency: "TMT", region: "asia", vat: 15, arabic: false },
  { code: "TW", nameAr: "تايوان", nameEn: "Taiwan", currency: "TWD", region: "asia", vat: 5, arabic: false },
  { code: "UZ", nameAr: "أوزبكستان", nameEn: "Uzbekistan", currency: "UZS", region: "asia", vat: 12, arabic: false },
  { code: "VN", nameAr: "فيتنام", nameEn: "Vietnam", currency: "VND", region: "asia", vat: 10, arabic: false },

  // ═══ الأمريكتان (35) ═══
  { code: "AG", nameAr: "أنتيغوا وبربودا", nameEn: "Antigua and Barbuda", currency: "XCD", region: "americas", vat: 15, arabic: false },
  { code: "AR", nameAr: "الأرجنتين", nameEn: "Argentina", currency: "ARS", region: "americas", vat: 21, arabic: false },
  { code: "BB", nameAr: "بربادوس", nameEn: "Barbados", currency: "BBD", region: "americas", vat: 17.5, arabic: false },
  { code: "BO", nameAr: "بوليفيا", nameEn: "Bolivia", currency: "BOB", region: "americas", vat: 14.9, arabic: false },
  { code: "BR", nameAr: "البرازيل", nameEn: "Brazil", currency: "BRL", region: "americas", vat: 17, arabic: false },
  { code: "BS", nameAr: "البهاما", nameEn: "Bahamas", currency: "BSD", region: "americas", vat: 10, arabic: false },
  { code: "BZ", nameAr: "بليز", nameEn: "Belize", currency: "BZD", region: "americas", vat: 12.5, arabic: false },
  { code: "CA", nameAr: "كندا", nameEn: "Canada", currency: "CAD", region: "americas", vat: 5, arabic: false },
  { code: "CL", nameAr: "تشيلي", nameEn: "Chile", currency: "CLP", region: "americas", vat: 19, arabic: false },
  { code: "CO", nameAr: "كولومبيا", nameEn: "Colombia", currency: "COP", region: "americas", vat: 19, arabic: false },
  { code: "CR", nameAr: "كوستاريكا", nameEn: "Costa Rica", currency: "CRC", region: "americas", vat: 13, arabic: false },
  { code: "CU", nameAr: "كوبا", nameEn: "Cuba", currency: "CUP", region: "americas", vat: 0, arabic: false },
  { code: "DM", nameAr: "دومينيكا", nameEn: "Dominica", currency: "XCD", region: "americas", vat: 15, arabic: false },
  { code: "DO", nameAr: "جمهورية الدومينيكان", nameEn: "Dominican Republic", currency: "DOP", region: "americas", vat: 18, arabic: false },
  { code: "EC", nameAr: "الإكوادور", nameEn: "Ecuador", currency: "USD", region: "americas", vat: 15, arabic: false },
  { code: "GD", nameAr: "غرينادا", nameEn: "Grenada", currency: "XCD", region: "americas", vat: 15, arabic: false },
  { code: "GT", nameAr: "غواتيمالا", nameEn: "Guatemala", currency: "GTQ", region: "americas", vat: 12, arabic: false },
  { code: "GY", nameAr: "غيانا", nameEn: "Guyana", currency: "GYD", region: "americas", vat: 14, arabic: false },
  { code: "HN", nameAr: "هندوراس", nameEn: "Honduras", currency: "HNL", region: "americas", vat: 15, arabic: false },
  { code: "HT", nameAr: "هايتي", nameEn: "Haiti", currency: "HTG", region: "americas", vat: 10, arabic: false },
  { code: "JM", nameAr: "جامايكا", nameEn: "Jamaica", currency: "JMD", region: "americas", vat: 15, arabic: false },
  { code: "KN", nameAr: "سانت كيتس ونيفيس", nameEn: "Saint Kitts and Nevis", currency: "XCD", region: "americas", vat: 17, arabic: false },
  { code: "LC", nameAr: "سانت لوسيا", nameEn: "Saint Lucia", currency: "XCD", region: "americas", vat: 12.5, arabic: false },
  { code: "MX", nameAr: "المكسيك", nameEn: "Mexico", currency: "MXN", region: "americas", vat: 16, arabic: false },
  { code: "NI", nameAr: "نيكاراغوا", nameEn: "Nicaragua", currency: "NIO", region: "americas", vat: 15, arabic: false },
  { code: "PA", nameAr: "بنما", nameEn: "Panama", currency: "USD", region: "americas", vat: 7, arabic: false },
  { code: "PE", nameAr: "بيرو", nameEn: "Peru", currency: "PEN", region: "americas", vat: 18, arabic: false },
  { code: "PY", nameAr: "باراغواي", nameEn: "Paraguay", currency: "PYG", region: "americas", vat: 10, arabic: false },
  { code: "SR", nameAr: "سورينام", nameEn: "Suriname", currency: "SRD", region: "americas", vat: 10, arabic: false },
  { code: "SV", nameAr: "السلفادور", nameEn: "El Salvador", currency: "USD", region: "americas", vat: 13, arabic: false },
  { code: "TT", nameAr: "ترينيداد وتوباغو", nameEn: "Trinidad and Tobago", currency: "TTD", region: "americas", vat: 12.5, arabic: false },
  { code: "US", nameAr: "الولايات المتحدة", nameEn: "United States", currency: "USD", region: "americas", vat: 0, arabic: false },
  { code: "UY", nameAr: "أوروغواي", nameEn: "Uruguay", currency: "UYU", region: "americas", vat: 22, arabic: false },
  { code: "VC", nameAr: "سانت فينسنت والجرينادين", nameEn: "Saint Vincent and the Grenadines", currency: "XCD", region: "americas", vat: 15, arabic: false },
  { code: "VE", nameAr: "فنزويلا", nameEn: "Venezuela", currency: "VES", region: "americas", vat: 16, arabic: false },

  // ═══ أفريقيا غير العربية (44) ═══
  { code: "AO", nameAr: "أنغولا", nameEn: "Angola", currency: "AOA", region: "africa", vat: 14, arabic: false },
  { code: "BF", nameAr: "بوركينا فاسو", nameEn: "Burkina Faso", currency: "XOF", region: "africa", vat: 18, arabic: false },
  { code: "BJ", nameAr: "بنين", nameEn: "Benin", currency: "XOF", region: "africa", vat: 18, arabic: false },
  { code: "BI", nameAr: "بوروندي", nameEn: "Burundi", currency: "BIF", region: "africa", vat: 18, arabic: false },
  { code: "BW", nameAr: "بوتسوانا", nameEn: "Botswana", currency: "BWP", region: "africa", vat: 14, arabic: false },
  { code: "CD", nameAr: "الكونغو الديمقراطية", nameEn: "DR Congo", currency: "CDF", region: "africa", vat: 16, arabic: false },
  { code: "CF", nameAr: "أفريقيا الوسطى", nameEn: "Central African Republic", currency: "XAF", region: "africa", vat: 19, arabic: false },
  { code: "CG", nameAr: "الكونغو", nameEn: "Congo", currency: "XAF", region: "africa", vat: 18.9, arabic: false },
  { code: "CI", nameAr: "ساحل العاج", nameEn: "Côte d'Ivoire", currency: "XOF", region: "africa", vat: 18, arabic: false },
  { code: "CM", nameAr: "الكاميرون", nameEn: "Cameroon", currency: "XAF", region: "africa", vat: 19.25, arabic: false },
  { code: "CV", nameAr: "الرأس الأخضر", nameEn: "Cabo Verde", currency: "CVE", region: "africa", vat: 15, arabic: false },
  { code: "ER", nameAr: "إريتريا", nameEn: "Eritrea", currency: "ERN", region: "africa", vat: 0, arabic: false },
  { code: "ET", nameAr: "إثيوبيا", nameEn: "Ethiopia", currency: "ETB", region: "africa", vat: 15, arabic: false },
  { code: "GA", nameAr: "الغابون", nameEn: "Gabon", currency: "XAF", region: "africa", vat: 18, arabic: false },
  { code: "GH", nameAr: "غانا", nameEn: "Ghana", currency: "GHS", region: "africa", vat: 15, arabic: false },
  { code: "GM", nameAr: "غامبيا", nameEn: "Gambia", currency: "GMD", region: "africa", vat: 15, arabic: false },
  { code: "GN", nameAr: "غينيا", nameEn: "Guinea", currency: "GNF", region: "africa", vat: 18, arabic: false },
  { code: "GQ", nameAr: "غينيا الاستوائية", nameEn: "Equatorial Guinea", currency: "XAF", region: "africa", vat: 15, arabic: false },
  { code: "GW", nameAr: "غينيا بيساو", nameEn: "Guinea-Bissau", currency: "XOF", region: "africa", vat: 19, arabic: false },
  { code: "KE", nameAr: "كينيا", nameEn: "Kenya", currency: "KES", region: "africa", vat: 16, arabic: false },
  { code: "LR", nameAr: "ليبيريا", nameEn: "Liberia", currency: "LRD", region: "africa", vat: 12, arabic: false },
  { code: "LS", nameAr: "ليسوتو", nameEn: "Lesotho", currency: "LSL", region: "africa", vat: 15, arabic: false },
  { code: "MG", nameAr: "مدغشقر", nameEn: "Madagascar", currency: "MGA", region: "africa", vat: 20, arabic: false },
  { code: "ML", nameAr: "مالي", nameEn: "Mali", currency: "XOF", region: "africa", vat: 18, arabic: false },
  { code: "MU", nameAr: "موريشيوس", nameEn: "Mauritius", currency: "MUR", region: "africa", vat: 15, arabic: false },
  { code: "MW", nameAr: "مالاوي", nameEn: "Malawi", currency: "MWK", region: "africa", vat: 16.5, arabic: false },
  { code: "MZ", nameAr: "موزمبيق", nameEn: "Mozambique", currency: "MZN", region: "africa", vat: 16, arabic: false },
  { code: "NA", nameAr: "ناميبيا", nameEn: "Namibia", currency: "NAD", region: "africa", vat: 15, arabic: false },
  { code: "NE", nameAr: "النيجر", nameEn: "Niger", currency: "XOF", region: "africa", vat: 19, arabic: false },
  { code: "NG", nameAr: "نيجيريا", nameEn: "Nigeria", currency: "NGN", region: "africa", vat: 7.5, arabic: false },
  { code: "RW", nameAr: "رواندا", nameEn: "Rwanda", currency: "RWF", region: "africa", vat: 18, arabic: false },
  { code: "SC", nameAr: "سيشل", nameEn: "Seychelles", currency: "SCR", region: "africa", vat: 15, arabic: false },
  { code: "SL", nameAr: "سيراليون", nameEn: "Sierra Leone", currency: "SLE", region: "africa", vat: 15, arabic: false },
  { code: "SN", nameAr: "السنغال", nameEn: "Senegal", currency: "XOF", region: "africa", vat: 18, arabic: false },
  { code: "SS", nameAr: "جنوب السودان", nameEn: "South Sudan", currency: "SSP", region: "africa", vat: 18, arabic: false },
  { code: "ST", nameAr: "ساو تومي وبرينسيبي", nameEn: "São Tomé and Príncipe", currency: "STN", region: "africa", vat: 15, arabic: false },
  { code: "SZ", nameAr: "إسواتيني", nameEn: "Eswatini", currency: "SZL", region: "africa", vat: 15, arabic: false },
  { code: "TD", nameAr: "تشاد", nameEn: "Chad", currency: "XAF", region: "africa", vat: 18, arabic: false },
  { code: "TG", nameAr: "توغو", nameEn: "Togo", currency: "XOF", region: "africa", vat: 18, arabic: false },
  { code: "TZ", nameAr: "تنزانيا", nameEn: "Tanzania", currency: "TZS", region: "africa", vat: 18, arabic: false },
  { code: "UG", nameAr: "أوغندا", nameEn: "Uganda", currency: "UGX", region: "africa", vat: 18, arabic: false },
  { code: "ZA", nameAr: "جنوب أفريقيا", nameEn: "South Africa", currency: "ZAR", region: "africa", vat: 15, arabic: false },
  { code: "ZM", nameAr: "زامبيا", nameEn: "Zambia", currency: "ZMW", region: "africa", vat: 16, arabic: false },
  { code: "ZW", nameAr: "زيمبابوي", nameEn: "Zimbabwe", currency: "USD", region: "africa", vat: 15, arabic: false },

  // ═══ أوقيانوسيا (14) ═══
  { code: "AU", nameAr: "أستراليا", nameEn: "Australia", currency: "AUD", region: "oceania", vat: 10, arabic: false },
  { code: "FJ", nameAr: "فيجي", nameEn: "Fiji", currency: "FJD", region: "oceania", vat: 15, arabic: false },
  { code: "FM", nameAr: "ميكرونيزيا", nameEn: "Micronesia", currency: "USD", region: "oceania", vat: 0, arabic: false },
  { code: "KI", nameAr: "كيريباتي", nameEn: "Kiribati", currency: "AUD", region: "oceania", vat: 0, arabic: false },
  { code: "MH", nameAr: "جزر مارشال", nameEn: "Marshall Islands", currency: "USD", region: "oceania", vat: 0, arabic: false },
  { code: "NR", nameAr: "ناورو", nameEn: "Nauru", currency: "AUD", region: "oceania", vat: 0, arabic: false },
  { code: "NZ", nameAr: "نيوزيلندا", nameEn: "New Zealand", currency: "NZD", region: "oceania", vat: 15, arabic: false },
  { code: "PG", nameAr: "بابوا غينيا الجديدة", nameEn: "Papua New Guinea", currency: "PGK", region: "oceania", vat: 10, arabic: false },
  { code: "PW", nameAr: "بالاو", nameEn: "Palau", currency: "USD", region: "oceania", vat: 0, arabic: false },
  { code: "SB", nameAr: "جزر سليمان", nameEn: "Solomon Islands", currency: "SBD", region: "oceania", vat: 10, arabic: false },
  { code: "TO", nameAr: "تونغا", nameEn: "Tonga", currency: "TOP", region: "oceania", vat: 15, arabic: false },
  { code: "TV", nameAr: "توفالو", nameEn: "Tuvalu", currency: "AUD", region: "oceania", vat: 0, arabic: false },
  { code: "VU", nameAr: "فانواتو", nameEn: "Vanuatu", currency: "VUV", region: "oceania", vat: 15, arabic: false },
  { code: "WS", nameAr: "ساموا", nameEn: "Samoa", currency: "WST", region: "oceania", vat: 15, arabic: false },
];

/** فهرس سريع بالكود (ISO-3166 alpha-2 كبير) */
export const WORLD_BY_CODE: Record<string, WorldCountry> = {};
for (const c of WORLD_COUNTRIES) {
  if (!(c.code in WORLD_BY_CODE)) WORLD_BY_CODE[c.code] = c;
}

/** أكواد الدول العربية الـ22 (أعضاء جامعة الدول العربية) */
export const ARAB_COUNTRY_CODES: string[] = WORLD_COUNTRIES.filter((c) => c.arabic).map((c) => c.code);

/** دولة عالمية بكودها — null إن كان الكود مجهولاً */
export function worldCountryOf(code: string | null | undefined): WorldCountry | null {
  return WORLD_BY_CODE[String(code ?? "").trim().toUpperCase()] ?? null;
}
