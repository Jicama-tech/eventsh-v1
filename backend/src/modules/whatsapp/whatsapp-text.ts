/**
 * Making caller-typed text safe to send from an ORGANIZER'S OWN WhatsApp
 * number.
 *
 * A message from a real organizer's number is a trusted identity to phish
 * from, and several of the notifications mirrored onto it carry text somebody
 * else typed — a visitor's name at a public checkout, a vendor's business
 * name, a supplier's note. These helpers are applied to exactly those parts;
 * text the organizer itself wrote (its name, its event titles) is left alone.
 */

/**
 * A person's name, or "Guest" when it does not look like one: letters and
 * marks in any script, spaces, apostrophes, hyphens and dots, at most 40
 * characters, and no "word.word" a phone would turn into a link. Anything else
 * — a digit, an "@", an invisible character, a line break — is replaced
 * rather than edited, because a false positive only costs a less personal
 * greeting. NFKC first, so full-width look-alikes are judged as what they
 * look like.
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

/**
 * Free text (a note, a message, a business name) for a WhatsApp line: one
 * line, no control or invisible characters, cut to `max`, and anything that
 * looks like a link replaced — so a stranger cannot use the organizer's
 * number to deliver a clickable URL.
 */
export function plainText(text: unknown, max = 200): string {
  const cleaned = String(text ?? "")
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /(?:https?:\/\/|www\.)\S*|[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[\p{L}]{2,}\S*/giu,
      "[link removed]",
    );
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}
