// Canonical country → currency table, keyed by ISO-2 country code.
//
// Organizers can now register from any country, so the currency shown across
// the dashboard/forms/tickets must follow the organizer's country. This is the
// single source of truth the `useCurrency` hook reads from. The backend keeps a
// mirror of this table at `backend/src/common/currency.util.ts` — keep the two
// in sync when adding/adjusting an entry.
//
// `symbol` is what we render everywhere money appears. We deliberately use an
// explicit, unambiguous symbol (e.g. "SG$" for Singapore, "US$" is left as "$")
// rather than the browser-locale default, which often collapses distinct
// currencies onto a bare "$". `locale` only drives digit grouping/decimals.

export interface CurrencyConfig {
  symbol: string;
  code: string; // ISO-4217
  locale: string;
}

export const COUNTRY_CURRENCY: Record<string, CurrencyConfig> = {
  AF: { symbol: "؋", code: "AFN", locale: "fa-AF" },
  AL: { symbol: "L", code: "ALL", locale: "sq-AL" },
  DZ: { symbol: "DA", code: "DZD", locale: "ar-DZ" },
  AD: { symbol: "€", code: "EUR", locale: "ca-AD" },
  AO: { symbol: "Kz", code: "AOA", locale: "pt-AO" },
  AG: { symbol: "EC$", code: "XCD", locale: "en-AG" },
  AR: { symbol: "AR$", code: "ARS", locale: "es-AR" },
  AM: { symbol: "֏", code: "AMD", locale: "hy-AM" },
  AU: { symbol: "A$", code: "AUD", locale: "en-AU" },
  AT: { symbol: "€", code: "EUR", locale: "de-AT" },
  AZ: { symbol: "₼", code: "AZN", locale: "az-AZ" },
  BS: { symbol: "B$", code: "BSD", locale: "en-BS" },
  BH: { symbol: "BD", code: "BHD", locale: "ar-BH" },
  BD: { symbol: "৳", code: "BDT", locale: "bn-BD" },
  BB: { symbol: "Bds$", code: "BBD", locale: "en-BB" },
  BY: { symbol: "Br", code: "BYN", locale: "be-BY" },
  BE: { symbol: "€", code: "EUR", locale: "nl-BE" },
  BZ: { symbol: "BZ$", code: "BZD", locale: "en-BZ" },
  BJ: { symbol: "CFA", code: "XOF", locale: "fr-BJ" },
  BT: { symbol: "Nu.", code: "BTN", locale: "dz-BT" },
  BO: { symbol: "Bs", code: "BOB", locale: "es-BO" },
  BA: { symbol: "KM", code: "BAM", locale: "bs-BA" },
  BW: { symbol: "P", code: "BWP", locale: "en-BW" },
  BR: { symbol: "R$", code: "BRL", locale: "pt-BR" },
  BN: { symbol: "B$", code: "BND", locale: "ms-BN" },
  BG: { symbol: "лв", code: "BGN", locale: "bg-BG" },
  BF: { symbol: "CFA", code: "XOF", locale: "fr-BF" },
  BI: { symbol: "FBu", code: "BIF", locale: "fr-BI" },
  KH: { symbol: "៛", code: "KHR", locale: "km-KH" },
  CM: { symbol: "FCFA", code: "XAF", locale: "fr-CM" },
  CA: { symbol: "C$", code: "CAD", locale: "en-CA" },
  CV: { symbol: "$", code: "CVE", locale: "pt-CV" },
  CF: { symbol: "FCFA", code: "XAF", locale: "fr-CF" },
  TD: { symbol: "FCFA", code: "XAF", locale: "fr-TD" },
  CL: { symbol: "CL$", code: "CLP", locale: "es-CL" },
  CN: { symbol: "¥", code: "CNY", locale: "zh-CN" },
  CO: { symbol: "CO$", code: "COP", locale: "es-CO" },
  KM: { symbol: "CF", code: "KMF", locale: "fr-KM" },
  CG: { symbol: "FCFA", code: "XAF", locale: "fr-CG" },
  CR: { symbol: "₡", code: "CRC", locale: "es-CR" },
  HR: { symbol: "€", code: "EUR", locale: "hr-HR" },
  CU: { symbol: "CU$", code: "CUP", locale: "es-CU" },
  CY: { symbol: "€", code: "EUR", locale: "el-CY" },
  CZ: { symbol: "Kč", code: "CZK", locale: "cs-CZ" },
  CD: { symbol: "FC", code: "CDF", locale: "fr-CD" },
  DK: { symbol: "kr", code: "DKK", locale: "da-DK" },
  DJ: { symbol: "Fdj", code: "DJF", locale: "fr-DJ" },
  DM: { symbol: "EC$", code: "XCD", locale: "en-DM" },
  DO: { symbol: "RD$", code: "DOP", locale: "es-DO" },
  EC: { symbol: "$", code: "USD", locale: "es-EC" },
  EG: { symbol: "E£", code: "EGP", locale: "ar-EG" },
  SV: { symbol: "$", code: "USD", locale: "es-SV" },
  GQ: { symbol: "FCFA", code: "XAF", locale: "es-GQ" },
  ER: { symbol: "Nfk", code: "ERN", locale: "ti-ER" },
  EE: { symbol: "€", code: "EUR", locale: "et-EE" },
  SZ: { symbol: "E", code: "SZL", locale: "en-SZ" },
  ET: { symbol: "Br", code: "ETB", locale: "am-ET" },
  FJ: { symbol: "FJ$", code: "FJD", locale: "en-FJ" },
  FI: { symbol: "€", code: "EUR", locale: "fi-FI" },
  FR: { symbol: "€", code: "EUR", locale: "fr-FR" },
  GA: { symbol: "FCFA", code: "XAF", locale: "fr-GA" },
  GM: { symbol: "D", code: "GMD", locale: "en-GM" },
  GE: { symbol: "₾", code: "GEL", locale: "ka-GE" },
  DE: { symbol: "€", code: "EUR", locale: "de-DE" },
  GH: { symbol: "GH₵", code: "GHS", locale: "en-GH" },
  GR: { symbol: "€", code: "EUR", locale: "el-GR" },
  GD: { symbol: "EC$", code: "XCD", locale: "en-GD" },
  GT: { symbol: "Q", code: "GTQ", locale: "es-GT" },
  GN: { symbol: "FG", code: "GNF", locale: "fr-GN" },
  GW: { symbol: "CFA", code: "XOF", locale: "pt-GW" },
  GY: { symbol: "G$", code: "GYD", locale: "en-GY" },
  HT: { symbol: "G", code: "HTG", locale: "fr-HT" },
  HN: { symbol: "L", code: "HNL", locale: "es-HN" },
  HK: { symbol: "HK$", code: "HKD", locale: "zh-HK" },
  HU: { symbol: "Ft", code: "HUF", locale: "hu-HU" },
  IS: { symbol: "kr", code: "ISK", locale: "is-IS" },
  IN: { symbol: "₹", code: "INR", locale: "en-IN" },
  ID: { symbol: "Rp", code: "IDR", locale: "id-ID" },
  IR: { symbol: "﷼", code: "IRR", locale: "fa-IR" },
  IQ: { symbol: "ID", code: "IQD", locale: "ar-IQ" },
  IE: { symbol: "€", code: "EUR", locale: "en-IE" },
  IL: { symbol: "₪", code: "ILS", locale: "he-IL" },
  IT: { symbol: "€", code: "EUR", locale: "it-IT" },
  CI: { symbol: "CFA", code: "XOF", locale: "fr-CI" },
  JM: { symbol: "J$", code: "JMD", locale: "en-JM" },
  JP: { symbol: "¥", code: "JPY", locale: "ja-JP" },
  JO: { symbol: "JD", code: "JOD", locale: "ar-JO" },
  KZ: { symbol: "₸", code: "KZT", locale: "kk-KZ" },
  KE: { symbol: "KSh", code: "KES", locale: "en-KE" },
  KI: { symbol: "A$", code: "AUD", locale: "en-KI" },
  XK: { symbol: "€", code: "EUR", locale: "sq-XK" },
  KW: { symbol: "KD", code: "KWD", locale: "ar-KW" },
  KG: { symbol: "с", code: "KGS", locale: "ky-KG" },
  LA: { symbol: "₭", code: "LAK", locale: "lo-LA" },
  LV: { symbol: "€", code: "EUR", locale: "lv-LV" },
  LB: { symbol: "LL", code: "LBP", locale: "ar-LB" },
  LS: { symbol: "L", code: "LSL", locale: "en-LS" },
  LR: { symbol: "L$", code: "LRD", locale: "en-LR" },
  LY: { symbol: "LD", code: "LYD", locale: "ar-LY" },
  LI: { symbol: "CHF", code: "CHF", locale: "de-LI" },
  LT: { symbol: "€", code: "EUR", locale: "lt-LT" },
  LU: { symbol: "€", code: "EUR", locale: "fr-LU" },
  MO: { symbol: "MOP$", code: "MOP", locale: "zh-MO" },
  MG: { symbol: "Ar", code: "MGA", locale: "fr-MG" },
  MW: { symbol: "MK", code: "MWK", locale: "en-MW" },
  MY: { symbol: "RM", code: "MYR", locale: "ms-MY" },
  MV: { symbol: "Rf", code: "MVR", locale: "dv-MV" },
  ML: { symbol: "CFA", code: "XOF", locale: "fr-ML" },
  MT: { symbol: "€", code: "EUR", locale: "mt-MT" },
  MH: { symbol: "$", code: "USD", locale: "en-MH" },
  MR: { symbol: "UM", code: "MRU", locale: "ar-MR" },
  MU: { symbol: "Rs", code: "MUR", locale: "en-MU" },
  MX: { symbol: "MX$", code: "MXN", locale: "es-MX" },
  FM: { symbol: "$", code: "USD", locale: "en-FM" },
  MD: { symbol: "L", code: "MDL", locale: "ro-MD" },
  MC: { symbol: "€", code: "EUR", locale: "fr-MC" },
  MN: { symbol: "₮", code: "MNT", locale: "mn-MN" },
  ME: { symbol: "€", code: "EUR", locale: "sr-ME" },
  MA: { symbol: "DH", code: "MAD", locale: "ar-MA" },
  MZ: { symbol: "MT", code: "MZN", locale: "pt-MZ" },
  MM: { symbol: "K", code: "MMK", locale: "my-MM" },
  NA: { symbol: "N$", code: "NAD", locale: "en-NA" },
  NR: { symbol: "A$", code: "AUD", locale: "en-NR" },
  NP: { symbol: "रू", code: "NPR", locale: "ne-NP" },
  NL: { symbol: "€", code: "EUR", locale: "nl-NL" },
  NZ: { symbol: "NZ$", code: "NZD", locale: "en-NZ" },
  NI: { symbol: "C$", code: "NIO", locale: "es-NI" },
  NE: { symbol: "CFA", code: "XOF", locale: "fr-NE" },
  NG: { symbol: "₦", code: "NGN", locale: "en-NG" },
  KP: { symbol: "₩", code: "KPW", locale: "ko-KP" },
  MK: { symbol: "ден", code: "MKD", locale: "mk-MK" },
  NO: { symbol: "kr", code: "NOK", locale: "nb-NO" },
  OM: { symbol: "OR", code: "OMR", locale: "ar-OM" },
  PK: { symbol: "Rs", code: "PKR", locale: "en-PK" },
  PW: { symbol: "$", code: "USD", locale: "en-PW" },
  PS: { symbol: "₪", code: "ILS", locale: "ar-PS" },
  PA: { symbol: "B/.", code: "PAB", locale: "es-PA" },
  PG: { symbol: "K", code: "PGK", locale: "en-PG" },
  PY: { symbol: "₲", code: "PYG", locale: "es-PY" },
  PE: { symbol: "S/", code: "PEN", locale: "es-PE" },
  PH: { symbol: "₱", code: "PHP", locale: "en-PH" },
  PL: { symbol: "zł", code: "PLN", locale: "pl-PL" },
  PT: { symbol: "€", code: "EUR", locale: "pt-PT" },
  QA: { symbol: "QR", code: "QAR", locale: "ar-QA" },
  RO: { symbol: "lei", code: "RON", locale: "ro-RO" },
  RU: { symbol: "₽", code: "RUB", locale: "ru-RU" },
  RW: { symbol: "FRw", code: "RWF", locale: "rw-RW" },
  KN: { symbol: "EC$", code: "XCD", locale: "en-KN" },
  LC: { symbol: "EC$", code: "XCD", locale: "en-LC" },
  VC: { symbol: "EC$", code: "XCD", locale: "en-VC" },
  WS: { symbol: "WS$", code: "WST", locale: "en-WS" },
  SM: { symbol: "€", code: "EUR", locale: "it-SM" },
  ST: { symbol: "Db", code: "STN", locale: "pt-ST" },
  SA: { symbol: "SR", code: "SAR", locale: "ar-SA" },
  SN: { symbol: "CFA", code: "XOF", locale: "fr-SN" },
  RS: { symbol: "дин", code: "RSD", locale: "sr-RS" },
  SC: { symbol: "SR", code: "SCR", locale: "en-SC" },
  SL: { symbol: "Le", code: "SLE", locale: "en-SL" },
  SG: { symbol: "SG$", code: "SGD", locale: "en-SG" },
  SK: { symbol: "€", code: "EUR", locale: "sk-SK" },
  SI: { symbol: "€", code: "EUR", locale: "sl-SI" },
  SB: { symbol: "SI$", code: "SBD", locale: "en-SB" },
  SO: { symbol: "Sh", code: "SOS", locale: "so-SO" },
  ZA: { symbol: "R", code: "ZAR", locale: "en-ZA" },
  KR: { symbol: "₩", code: "KRW", locale: "ko-KR" },
  SS: { symbol: "SSP", code: "SSP", locale: "en-SS" },
  ES: { symbol: "€", code: "EUR", locale: "es-ES" },
  LK: { symbol: "Rs", code: "LKR", locale: "si-LK" },
  SD: { symbol: "SDG", code: "SDG", locale: "ar-SD" },
  SR: { symbol: "Sr$", code: "SRD", locale: "nl-SR" },
  SE: { symbol: "kr", code: "SEK", locale: "sv-SE" },
  CH: { symbol: "CHF", code: "CHF", locale: "de-CH" },
  SY: { symbol: "LS", code: "SYP", locale: "ar-SY" },
  TW: { symbol: "NT$", code: "TWD", locale: "zh-TW" },
  TJ: { symbol: "SM", code: "TJS", locale: "tg-TJ" },
  TZ: { symbol: "TSh", code: "TZS", locale: "sw-TZ" },
  TH: { symbol: "฿", code: "THB", locale: "th-TH" },
  TL: { symbol: "$", code: "USD", locale: "pt-TL" },
  TG: { symbol: "CFA", code: "XOF", locale: "fr-TG" },
  TO: { symbol: "T$", code: "TOP", locale: "en-TO" },
  TT: { symbol: "TT$", code: "TTD", locale: "en-TT" },
  TN: { symbol: "DT", code: "TND", locale: "ar-TN" },
  TR: { symbol: "₺", code: "TRY", locale: "tr-TR" },
  TM: { symbol: "m", code: "TMT", locale: "tk-TM" },
  TV: { symbol: "A$", code: "AUD", locale: "en-TV" },
  UG: { symbol: "USh", code: "UGX", locale: "en-UG" },
  UA: { symbol: "₴", code: "UAH", locale: "uk-UA" },
  AE: { symbol: "AED", code: "AED", locale: "ar-AE" },
  GB: { symbol: "£", code: "GBP", locale: "en-GB" },
  US: { symbol: "$", code: "USD", locale: "en-US" },
  UY: { symbol: "$U", code: "UYU", locale: "es-UY" },
  UZ: { symbol: "soʻm", code: "UZS", locale: "uz-UZ" },
  VU: { symbol: "VT", code: "VUV", locale: "en-VU" },
  VA: { symbol: "€", code: "EUR", locale: "it-VA" },
  VE: { symbol: "Bs.", code: "VES", locale: "es-VE" },
  VN: { symbol: "₫", code: "VND", locale: "vi-VN" },
  YE: { symbol: "YR", code: "YER", locale: "ar-YE" },
  ZM: { symbol: "ZK", code: "ZMW", locale: "en-ZM" },
  ZW: { symbol: "Z$", code: "ZWL", locale: "en-ZW" },
};

// Neutral fallback for an unknown / not-yet-resolved country.
export const FALLBACK_CURRENCY: CurrencyConfig = {
  symbol: "$",
  code: "USD",
  locale: "en-US",
};

// organizer.country is stored inconsistently — ISO-2 ("SG"), full name
// ("Singapore"), or ISO-3 ("SGP"). Map the common non-ISO-2 forms back to ISO-2
// so currency resolves regardless of which form was persisted.
const NAME_TO_ISO2: Record<string, string> = {
  INDIA: "IN",
  IND: "IN",
  SINGAPORE: "SG",
  SGP: "SG",
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  USA: "US",
  "UNITED KINGDOM": "GB",
  UK: "GB",
  "UNITED ARAB EMIRATES": "AE",
  UAE: "AE",
  AUSTRALIA: "AU",
  CANADA: "CA",
};

/** Normalize any stored country form to an ISO-2 code, or "" if unknown. */
export function toIso2(country?: string | null): string {
  if (!country) return "";
  const raw = String(country).trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (upper.length === 2 && COUNTRY_CURRENCY[upper]) return upper;
  if (NAME_TO_ISO2[upper]) return NAME_TO_ISO2[upper];
  // Last resort: match against a known ISO-2 anyway (e.g. "sg").
  if (COUNTRY_CURRENCY[upper]) return upper;
  return "";
}

/** Resolve a country (any stored form) to its currency config. */
export function currencyForCountry(country?: string | null): CurrencyConfig {
  const iso2 = toIso2(country);
  return (iso2 && COUNTRY_CURRENCY[iso2]) || FALLBACK_CURRENCY;
}

// Reverse lookup by ISO-4217 code, for records that persist only the currency
// code (e.g. a plan/membership doc's `currency`) rather than a country.
const CODE_TO_CONFIG: Record<string, CurrencyConfig> = Object.values(
  COUNTRY_CURRENCY,
).reduce(
  (acc, cfg) => {
    if (!acc[cfg.code]) acc[cfg.code] = cfg;
    return acc;
  },
  {} as Record<string, CurrencyConfig>,
);

/** Resolve a stored ISO-4217 code (INR/SGD/USD/…) to its currency config. */
export function currencyForCode(code?: string | null): CurrencyConfig {
  if (!code) return FALLBACK_CURRENCY;
  return CODE_TO_CONFIG[String(code).trim().toUpperCase()] || FALLBACK_CURRENCY;
}

/** Just the display symbol for a stored ISO-4217 code. */
export function symbolForCode(code?: string | null): string {
  return currencyForCode(code).symbol;
}

/** Just the display symbol for a country (any stored form). */
export function symbolForCountry(country?: string | null): string {
  return currencyForCountry(country).symbol;
}
