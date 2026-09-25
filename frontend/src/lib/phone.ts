import { COUNTRIES } from "@/data/countries";

/**
 * One shape for every stored contact / WhatsApp number: E.164 — a leading
 * "+", then the country dial code and the national number, digits only
 * ("+919876543210", "+6591234567"). Every phone field in the app emits this,
 * so the server, WhatsApp sends and wa.me links never have to guess the
 * country.
 */

/** Digits only — strips "+", spaces, dashes, brackets. */
export function phoneDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** "+<digits>" or "" when there is nothing to keep. */
export function toE164(value: string | null | undefined): string {
  const digits = phoneDigits(value);
  return digits ? `+${digits}` : "";
}

/**
 * A dial code ("+91", "91") plus a national number typed separately, as one
 * E.164 string. A national number that already starts with the dial code
 * (someone pasted the full number) is not doubled up.
 */
export function joinDial(
  dial: string | null | undefined,
  national: string | null | undefined,
): string {
  const d = phoneDigits(dial);
  const n = phoneDigits(national);
  if (!n) return "";
  if (!d) return `+${n}`;
  if (String(national ?? "").trim().startsWith("+")) return `+${n}`;
  return `+${d}${n}`;
}

/** Loose sanity check: 7–15 digits, the E.164 range. */
export function isLikelyPhone(value: string | null | undefined): boolean {
  const digits = phoneDigits(value);
  return digits.length >= 7 && digits.length <= 15;
}

/** What react-phone-input-2 wants as `value`: digits incl. dial code, no "+". */
export function toPhoneInputValue(value: string | null | undefined): string {
  return phoneDigits(value);
}

// Dial codes longest-first, so "+971…" is matched before "+9…" and "+1…".
const DIAL_CODES: string[] = Array.from(
  new Set(COUNTRIES.map((c) => phoneDigits(c.dialCode)).filter(Boolean)),
).sort((a, b) => b.length - a.length);

/**
 * Splits a stored number into its dial code and national part, for APIs
 * that still take `countryCode` separately or for a legacy dial-code
 * `<Select>` + digits pair. `dialCode` carries the "+" ("+91"); `iso` is the
 * first country with that code (US before CA for "+1") or "" when unknown.
 */
export function splitE164(value: string | null | undefined): {
  dialCode: string;
  national: string;
  iso: string;
} {
  const digits = phoneDigits(value);
  if (!digits) return { dialCode: "", national: "", iso: "" };
  const code = DIAL_CODES.find((d) => digits.startsWith(d) && digits.length > d.length);
  if (!code) return { dialCode: "", national: digits, iso: "" };
  const country = COUNTRIES.find((c) => phoneDigits(c.dialCode) === code);
  return {
    dialCode: `+${code}`,
    national: digits.slice(code.length),
    iso: country?.code ?? "",
  };
}
