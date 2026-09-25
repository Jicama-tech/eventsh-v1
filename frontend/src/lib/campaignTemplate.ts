/**
 * The WhatsApp campaign template language, browser side.
 *
 * A campaign message is written once and personalised per contact:
 * `Hello {{name}}` arrives as `Hello Vansh Sharma`. The backend renders every
 * message that is actually SENT (and every preview sample), so this copy
 * exists for three things only: the instant "unknown placeholder" check while
 * typing, the placeholder chips, and the one-by-one wa.me links offered when
 * the organizer has no linked WhatsApp to send from.
 *
 * Because a wa.me link is sent by hand from the organizer's own phone, it
 * must say exactly what the server would have said — so the rules below are a
 * contract shared with the backend, not a loose imitation: THIS FILE HAS A
 * TWIN in backend/src/modules/campaigns/campaign-template.ts. Change one side
 * and the other must change with it.
 *
 * Rendering is two passes, in this order:
 *
 *  1. Spintax. Every single-brace group with at least one `|` and no braces
 *     inside — `{Hi|Hello|Hey}` — becomes ONE of its options. The choice is a
 *     hash of the seed (the contact id) and the group's position, so the same
 *     contact always gets the same wording: the preview for contact X is
 *     exactly what X receives, and a resumed campaign does not reshuffle.
 *     `{{…}}` tokens are skipped whole, so the `|` of `{{name|friend}}` is
 *     never read as spintax.
 *
 *  2. Variables. `{{ key }}` / `{{ key | fallback }}` become the contact's
 *     value, else the fallback, else a default (`there` for names, empty for
 *     the rest). A key we do not know is left exactly as written, so a typo
 *     shows up in the preview instead of silently vanishing.
 */

/** Every placeholder a template may use, in the order the chips show them. */
export type PlaceholderKey =
  | "name"
  | "first_name"
  | "organizer_name"
  | "event"
  | "event_date"
  | "event_venue"
  | "event_link";

/**
 * The chips in the composer. `label` is English and doubles as the i18n key —
 * this module stays free of the translator so it can run under plain node.
 */
export const KNOWN_PLACEHOLDERS: ReadonlyArray<{
  key: PlaceholderKey;
  label: string;
}> = [
  { key: "name", label: "Name" },
  { key: "first_name", label: "First name" },
  { key: "organizer_name", label: "Organizer name" },
  { key: "event", label: "Event" },
  { key: "event_date", label: "Event date" },
  { key: "event_venue", label: "Venue" },
  { key: "event_link", label: "Event link" },
];

const KNOWN_KEYS: ReadonlySet<string> = new Set(
  KNOWN_PLACEHOLDERS.map((p) => p.key),
);

/**
 * What an empty value becomes when the template gives no fallback of its own.
 * "Hi there" reads as a greeting; "Hi " reads as a bug. Keys not listed here
 * (a missing venue, say) collapse to nothing.
 */
const DEFAULT_FALLBACK: Partial<Record<PlaceholderKey, string>> = {
  name: "there",
  first_name: "there",
};

export type CampaignVars = Partial<Record<PlaceholderKey, string>>;

/**
 * Pass 1. The first alternative swallows a whole `{{…}}` token (lazily, to
 * the first `}}`) so nothing inside it is spun; the second is a single-brace
 * group, spun only when it holds a `|`.
 */
const SPIN_SCAN = /\{\{[\s\S]*?\}\}|\{[^{}]*\}/g;

/** Pass 1 after the template's last `}}`, where only single-brace groups can
 * match (see the backend twin for why the template is cut there). */
const SINGLE = /\{[^{}]*\}/g;

/** Pass 2, and the validator. A key is letters and underscores only; the
 * optional fallback is anything up to the closing `}}` except a brace. */
const VARIABLE = /\{\{\s*([A-Za-z_]+)\s*(?:\|([^{}]*))?\}\}/g;

/** 32-bit FNV-1a over UTF-16 code units — the same units the backend's loop
 * sees, so a name in Devanagari hashes identically on both sides. */
export function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function spin(template: string, seed: string): string {
  let n = 0;
  const pick = (match: string) => {
    if (match.startsWith("{{")) return match;
    const inner = match.slice(1, -1);
    if (!inner.includes("|")) return match;
    const options = inner.split("|");
    const choice = options[fnv1a32(`${seed}:${n}`) % options.length];
    n += 1;
    return choice;
  };
  const last = template.lastIndexOf("}}");
  const cut = last < 0 ? 0 : last + 2;
  return (
    template.slice(0, cut).replace(SPIN_SCAN, pick) +
    template.slice(cut).replace(SINGLE, pick)
  );
}

/** The message one contact receives. `seed` is that contact's id. */
export function render(
  template: string,
  vars: CampaignVars,
  seed: string,
): string {
  const spun = spin(String(template ?? ""), String(seed ?? ""));

  return spun.replace(
    VARIABLE,
    (whole: string, rawKey: string, fallback: string | undefined) => {
      const key = rawKey.toLowerCase() as PlaceholderKey;
      if (!KNOWN_KEYS.has(key)) return whole;
      const value = vars?.[key];
      if (value != null && value !== "") return String(value);
      if (fallback !== undefined) return fallback.trim();
      return DEFAULT_FALLBACK[key] ?? "";
    },
  );
}

/** The placeholders a template uses that we do not know, lowercased and
 * de-duplicated in first-seen order. */
export function validate(template: string): { unknown: string[] } {
  const unknown: string[] = [];
  for (const match of String(template ?? "").matchAll(VARIABLE)) {
    const key = match[1].toLowerCase();
    if (!KNOWN_KEYS.has(key) && !unknown.includes(key)) unknown.push(key);
  }
  return { unknown };
}

// ── The values that fill the placeholders ────────────────────────────────
//
// Everything below mirrors backend/src/modules/campaigns/campaign-audience.ts
// and whatsapp-text.ts. The server computes these for every real send; the
// copies here only fill the hand-sent wa.me messages, which must read the
// same as what the server would have sent.

/**
 * A person's name, or `fallback` when it does not look like one — the
 * backend's `plainName`, kept character for character.
 */
export function plainName(name: unknown, fallback = "Guest"): string {
  const oneLine = String(name ?? "")
    .normalize("NFKC")
    .replace(/[  ]+/g, " ")
    .trim();
  const looksLikeAName =
    /^[\p{L}\p{M}' .-]{1,40}$/u.test(oneLine) &&
    !/[\p{L}\p{M}-]\.[\p{L}]{2,}/u.test(oneLine);
  return looksLikeAName ? oneLine : fallback;
}

/** Names that are placeholders somebody's code wrote, not a person's name. */
const NOT_A_NAME = [/^guest( user)?$/i, /^walk-?\s?in/i, /^customer$/i, /^unknown$/i, /^n\/?a$/i];

function cleanCandidate(candidate: unknown): string {
  return String(candidate ?? "")
    .replace(/\b(?:undefined|null)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The `{{name}}` value: the first candidate that looks like a real person's
 * name, cleaned by plainName, or "" so the template's fallback applies. A
 * candidate equal to the local part of the contact's email is passed over.
 */
export function campaignName(
  candidates: unknown[],
  email?: string | null,
): string {
  const emailPrefix = String(email ?? "")
    .split("@")[0]
    .trim()
    .toLowerCase();
  for (const candidate of candidates) {
    const trimmed = cleanCandidate(candidate);
    if (!trimmed) continue;
    if (NOT_A_NAME.some((pattern) => pattern.test(trimmed))) continue;
    if (emailPrefix && trimmed.toLowerCase() === emailPrefix) continue;
    const clean = plainName(trimmed, "");
    if (clean) return clean;
  }
  return "";
}

/** `{{first_name}}`: the first word of the resolved name ("" stays ""). */
export function firstNameOf(name: string): string {
  return String(name ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * A stored number as wa.me wants it — full international digits — or null
 * when it is too short to be one. The server completes national numbers
 * with the organizer's country; here, with the dial code the dashboard's
 * country hook knows, when given. A number without a country code and no
 * dial code to complete it gets no link rather than one to a stranger.
 */
export function waDigits(phone: unknown, dialCode?: string | null): string | null {
  const raw = String(phone ?? "").trim();
  let digits = raw.replace(/\D/g, "");
  if (!raw.startsWith("+")) {
    if (digits.startsWith("00")) {
      digits = digits.slice(2);
    } else {
      const calling = String(dialCode ?? "").replace(/\D/g, "");
      if (calling) {
        const local = digits.startsWith("0") ? digits.slice(1) : digits;
        if (local.length > 0 && local.length <= 10 && !digits.startsWith(calling)) {
          digits = calling + local;
        }
      }
    }
  }
  return digits.length >= 8 ? digits : null;
}
