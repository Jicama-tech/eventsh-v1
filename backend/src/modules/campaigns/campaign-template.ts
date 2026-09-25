/**
 * The campaign template language: `{{name}}`-style placeholders plus
 * `{Hi|Hello|Hey}` spintax.
 *
 * THIS FILE HAS A TWIN. frontend/src/lib/campaignTemplate.ts implements the
 * same rules for the live preview and for the one-by-one "Open in WhatsApp"
 * links, and the two must agree character for character: the preview for
 * contact X is promised to be exactly what X receives. Change one, change
 * the other. The one backend-only addition is renderedLength(), which the
 * browser has no use for.
 *
 * Rendering is two passes, in a fixed order:
 *
 *  1. Spintax, on the raw template. Every `{a|b|c}` that is not part of a
 *     `{{…}}` token becomes ONE of its options. The choice is not random: it
 *     is fnv1a32(seed + ":" + n), where the seed is the contact id and `n`
 *     counts spintax groups left to right. Deterministic, so the preview and
 *     the send pick the same greeting; per contact, so a hundred contacts do
 *     not all get the identical message — which is the pattern WhatsApp
 *     treats as bulk spam.
 *
 *  2. Placeholders, on the result. Values go in as plain text and are never
 *     scanned again, so a contact called "{a|b}" or "{{event}}" cannot inject
 *     markup into the message — the order of the passes is what guarantees it.
 */

/** The placeholders a template may use. Anything else is left in the text
 * as typed and reported by validate(), so a typo is caught before sending
 * rather than delivered to an attendee as "{{nmae}}". */
export const KNOWN_PLACEHOLDERS = [
  "name",
  "first_name",
  "organizer_name",
  "event",
  "event_date",
  "event_venue",
  "event_link",
] as const;

export type CampaignPlaceholder = (typeof KNOWN_PLACEHOLDERS)[number];

export type CampaignVars = Partial<Record<CampaignPlaceholder, string>>;

const KNOWN = new Set<string>(KNOWN_PLACEHOLDERS);

/**
 * What an empty value becomes when the template gives no fallback of its
 * own. A greeting reads "Hi there" rather than "Hi ", which is why the two
 * name keys have one; for a date or a link there is no sensible stand-in,
 * so they simply disappear.
 */
const DEFAULT_FALLBACK: Record<string, string> = {
  name: "there",
  first_name: "there",
};

/**
 * A `{{…}}` token, or a single-brace group with no braces inside. One regex
 * with the double-brace branch FIRST, so at any position a placeholder is
 * consumed whole before its inside could be read as spintax — otherwise
 * `{{name|friend}}` would contain the spintax group `{name|friend}`.
 */
const SPIN_SCAN = /\{\{[\s\S]*?\}\}|\{[^{}]*\}/g;

/** SPIN_SCAN's single-brace branch alone, for the part of a template after
 * its last `}}` (see spin()). */
const SINGLE = /\{[^{}]*\}/g;

/** `{{ key }}` or `{{ key | fallback }}`. The key is letters and
 * underscores; the fallback is anything without a brace, trimmed. */
const PLACEHOLDER = /\{\{\s*([A-Za-z_]+)\s*(?:\|([^{}]*))?\}\}/g;

/** 32-bit FNV-1a over UTF-16 code units — small, fast, and trivially the
 * same in the browser and in Node, which is all the spintax choice needs. */
export function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Pass 1. `n` counts only real spintax groups (ones with a `|`); a plain
 * `{word}` is left as typed and does not shift the choices after it.
 *
 * Split at the last `}}` so the scan stays linear. Run over the whole
 * template, SPIN_SCAN's lazy `\{\{[\s\S]*?\}\}` rescans to the end of the
 * string from every `{{` that has no `}}` after it — quadratic, and a
 * 3000-character "{{{{{{…" took ~10 ms per render, i.e. seconds of blocked
 * event loop for one preview of a thousand contacts. Before the last `}}`
 * every `{{` finds a close and its match consumes what it scanned; after it,
 * a `{{` can never match the double-brace branch, so only the single-brace
 * one can apply there. Same output as one SPIN_SCAN pass, and the counter
 * `n` runs on across both halves.
 */
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

/** Pass 2 for one `{{…}}` match: what it becomes in the message. */
function placeholderText(
  values: Record<string, string | undefined>,
  match: string,
  rawKey: string,
  rawFallback?: string,
): string {
  const key = rawKey.toLowerCase();
  if (!KNOWN.has(key)) return match;
  const value = values[key];
  if (value != null && value !== "") return String(value);
  if (rawFallback !== undefined) return rawFallback.trim();
  return DEFAULT_FALLBACK[key] ?? "";
}

/** Render a template for one contact. See the file note for the rules. */
export function render(
  template: string,
  vars: CampaignVars | Record<string, string | undefined>,
  seed: string,
): string {
  const spun = spin(String(template ?? ""), String(seed ?? ""));
  const values = vars as Record<string, string | undefined>;
  return spun.replace(PLACEHOLDER, (match, rawKey: string, rawFallback?: string) =>
    placeholderText(values, match, rawKey, rawFallback),
  );
}

/**
 * BACKEND ONLY. The length render() would return, without building the
 * string. The audience checks every contact's message against WhatsApp's
 * length limit, and a template of a few hundred `{{event}}` tokens with a
 * long title renders to megabytes per contact — built for a thousand
 * contacts only to be thrown away as "Message too long". Measuring costs one
 * pass over the template, whatever the values hold.
 */
export function renderedLength(
  template: string,
  vars: CampaignVars | Record<string, string | undefined>,
  seed: string,
): number {
  const spun = spin(String(template ?? ""), String(seed ?? ""));
  const values = vars as Record<string, string | undefined>;
  let length = spun.length;
  for (const m of spun.matchAll(PLACEHOLDER)) {
    length += placeholderText(values, m[0], m[1], m[2]).length - m[0].length;
  }
  return length;
}

/** The placeholders in a template that are not known — distinct, lowercased,
 * in the order they first appear. A non-empty list blocks sending. */
export function validate(template: string): { unknown: string[] } {
  const unknown: string[] = [];
  for (const m of String(template ?? "").matchAll(PLACEHOLDER)) {
    const key = m[1].toLowerCase();
    if (!KNOWN.has(key) && !unknown.includes(key)) unknown.push(key);
  }
  return { unknown };
}
