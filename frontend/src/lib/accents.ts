/**
 * Accent colours for stat cards and initial avatars.
 *
 * Ported from kioscart-v1 so the two products' dashboards look like siblings.
 * Keep them in sync: if you change a hue here, change it there.
 *
 * Two palettes, two different jobs:
 *
 *   STAT_ACCENTS   — categorical identity for KPI tiles. Assigned in FIXED
 *                    ORDER per surface (card 1 is always blue, card 2 always
 *                    emerald…), never cycled by rank, so a card keeps its
 *                    colour when a sibling is added or hidden.
 *
 *   AVATAR_ACCENTS — identity-by-hash for a person with no photo. Not a data
 *                    encoding: nothing is read *off* the colour, it just makes
 *                    a row scannable, so hashing over a wider ring is fine.
 *
 * Both were validated rather than eyeballed:
 *
 *   STAT_ACCENTS (the six 600 steps) passes the categorical checks in BOTH
 *   modes — lightness band, chroma floor, normal-vision separation and >=3:1
 *   contrast against the light and dark surfaces. The one warning is
 *   amber<->emerald at CVD deltaE 7.9 (protan), inside the 6-8 floor band that is
 *   legal only alongside a second encoding: every tile pairs its colour with a
 *   distinct icon AND a text label, so identity never rests on hue alone.
 *
 *   AVATAR_ACCENTS carries text, so it answers to WCAG instead: every pair
 *   clears AA body contrast (worst 4.51:1 light, 8.02:1 dark).
 *
 * Keep the 600 step if you add a stat hue, and re-run the validator.
 */

export type StatAccent = {
  /** Icon glyph colour. The validated 600 step, which sits in both bands. */
  icon: string;
  /** Tinted chip behind the glyph. Carries no meaning on its own. */
  chip: string;
  /** Hairline that ties the tile to its hue without flooding the card. */
  ring: string;
};

export const STAT_ACCENTS: StatAccent[] = [
  {
    icon: "text-blue-600 dark:text-blue-500",
    chip: "bg-blue-50 dark:bg-blue-950/40",
    ring: "border-l-blue-600 dark:border-l-blue-500",
  },
  {
    icon: "text-emerald-600 dark:text-emerald-500",
    chip: "bg-emerald-50 dark:bg-emerald-950/40",
    ring: "border-l-emerald-600 dark:border-l-emerald-500",
  },
  {
    icon: "text-amber-600 dark:text-amber-500",
    chip: "bg-amber-50 dark:bg-amber-950/40",
    ring: "border-l-amber-600 dark:border-l-amber-500",
  },
  {
    icon: "text-rose-600 dark:text-rose-500",
    chip: "bg-rose-50 dark:bg-rose-950/40",
    ring: "border-l-rose-600 dark:border-l-rose-500",
  },
  {
    icon: "text-violet-600 dark:text-violet-500",
    chip: "bg-violet-50 dark:bg-violet-950/40",
    ring: "border-l-violet-600 dark:border-l-violet-500",
  },
  {
    icon: "text-cyan-600 dark:text-cyan-500",
    chip: "bg-cyan-50 dark:bg-cyan-950/40",
    ring: "border-l-cyan-600 dark:border-l-cyan-500",
  },
];

/**
 * Accent for the nth stat tile on a surface. Pass the tile's own index, not a
 * rank derived from its value — colour follows the entity, never its position
 * in a sort. Surfaces with more than six tiles wrap, which is why no surface
 * here has more than six.
 */
export function statAccent(index: number): StatAccent {
  return STAT_ACCENTS[index % STAT_ACCENTS.length];
}

/**
 * Status accents — RESERVED. These four say what state a thing is in, so they
 * never double as "the fifth categorical colour". A status tile always ships
 * its icon and label too; the hue on its own is never the message.
 */
export const STATUS_ACCENTS: Record<
  "good" | "warning" | "critical" | "neutral",
  StatAccent
> = {
  good: {
    icon: "text-emerald-600 dark:text-emerald-500",
    chip: "bg-emerald-50 dark:bg-emerald-950/40",
    ring: "border-l-emerald-600 dark:border-l-emerald-500",
  },
  warning: {
    icon: "text-amber-600 dark:text-amber-500",
    chip: "bg-amber-50 dark:bg-amber-950/40",
    ring: "border-l-amber-600 dark:border-l-amber-500",
  },
  critical: {
    icon: "text-rose-600 dark:text-rose-500",
    chip: "bg-rose-50 dark:bg-rose-950/40",
    ring: "border-l-rose-600 dark:border-l-rose-500",
  },
  neutral: {
    icon: "text-muted-foreground",
    chip: "bg-muted",
    ring: "border-l-border",
  },
};

/** Background + initials colour. Both halves are needed for the contrast to hold. */
export const AVATAR_ACCENTS: string[] = [
  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  "bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
];

/**
 * Stable colour for one person. The same customer keeps the same colour across
 * reloads, pages and re-sorts because it is derived from their identity, not
 * from their position in a list.
 *
 * Seed with the most stable thing available — an id beats a name, since a name
 * can be edited. FNV-1a, and `>>> 0` to stay unsigned.
 */
export function avatarAccent(seed: string | undefined | null): string {
  const s = String(seed ?? "");
  if (!s) return "bg-muted text-muted-foreground";
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return AVATAR_ACCENTS[h % AVATAR_ACCENTS.length];
}

/** First letters of the first and last word, e.g. "Asha R Patel" -> "AP". */
export function initials(name: string | undefined | null): string {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}
