// Theme model + presets for the public Marriage Eventfront. The organizer
// edits a MarriageTheme in the Create/Edit Wedding form ("Design" tab); the
// value is stored on the event at `marriage.theme` and read back by
// MarriageEventFront to skin the page (colors, fonts, hero, sections, etc).
//
// Keep this file framework-light: it's imported by both the form and the
// public page, and the resolver/palette builder must be pure so a missing or
// partial theme always falls back to the Classic Rose defaults.

import type { CSSProperties } from "react";

export type MarriageHeadingFont =
  | "serif"
  | "playfair"
  | "sans"
  | "script"
  | "dancing";
export type MarriageCornerStyle = "rounded" | "minimal";
export type MarriageHeroHeight = "full" | "tall" | "compact";
export type MarriageHeroLayout = "stacked" | "inline";
export type MarriageHeadingStyle = "icon" | "line" | "ornament";
export type MarriageBackgroundPattern = "none" | "dots" | "hearts" | "lattice";
export type MarriageFontScale = "cozy" | "normal" | "grand";
export type MarriageGalleryLayout =
  | "masonry"
  | "grid"
  | "carousel"
  | "collage";
// How the "Our Story" moments are arranged on the public page.
//   spine   — alternating left/right timeline with a vertical spine + dots
//   cards   — centered stack of image cards, no spine
//   feature — large alternating side-by-side image/text blocks (magazine)
export type MarriageStoryLayout = "spine" | "cards" | "feature";
export type MarriageMonogramStyle = "mandala" | "ring" | "minimal";
// Botanical floral decoration framing the hero (line-art leaves + blossoms).
export type MarriageFloralAccents = "none" | "corners" | "frame";
// A decorative emblem at the very top of the invitation. Includes optional
// devotional motifs (Ganesha, Om) common on Indian wedding cards, plus
// non-religious florals so the page suits every couple.
export type MarriageTopMotif =
  | "none"
  | "ganesha"
  | "om"
  | "lotus"
  | "kalash"
  | "floral";

// Toggle each major page section on/off.
export interface MarriageSections {
  countdown: boolean;
  welcome: boolean;
  story: boolean;
  ceremonies: boolean;
  gallery: boolean;
  contact: boolean;
}

export interface MarriageTheme {
  // Which preset the organizer started from. "custom" once they hand-edit a
  // color — purely informational (the individual fields drive rendering).
  preset: string;
  primaryColor: string; // main accent — names underline, buttons, icons
  accentColor: string; // secondary accent — decorative touches
  bgColor: string; // page background
  textColor: string; // base body text
  headingFont: MarriageHeadingFont;
  heroOverlay: number; // 0..80 — darkness of the gradient over the hero banner
  cornerStyle: MarriageCornerStyle;
  // ---- expanded design controls ----
  heroHeight: MarriageHeroHeight;
  heroLayout: MarriageHeroLayout;
  heroTagline: string; // e.g. "are getting married"
  showMonogram: boolean; // couple initials badge in the hero
  monogramStyle: MarriageMonogramStyle; // which monogram treatment to draw
  topMotif: MarriageTopMotif; // devotional / floral emblem above the monogram
  floralAccents: MarriageFloralAccents; // botanical framing of the hero
  headingStyle: MarriageHeadingStyle; // section heading treatment
  backgroundPattern: MarriageBackgroundPattern;
  fontScale: MarriageFontScale; // overall display-heading size
  galleryLayout: MarriageGalleryLayout; // how the photo gallery is arranged
  storyLayout: MarriageStoryLayout; // how the "Our Story" moments are arranged
  animations: boolean; // scroll-cue bounce + subtle motion
  sections: MarriageSections;
}

export interface MarriagePreset {
  key: string;
  label: string;
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  headingFont: MarriageHeadingFont;
}

// Curated palettes. The first is the default and matches the original
// rose/stone look the Eventfront shipped with, so existing weddings are
// unchanged until an organizer picks something new.
export const MARRIAGE_PRESETS: MarriagePreset[] = [
  { key: "classicRose", label: "Classic Rose", primaryColor: "#b76e79", accentColor: "#d9a566", bgColor: "#fdf8f5", textColor: "#44403c", headingFont: "serif" },
  { key: "royalGold", label: "Royal Gold", primaryColor: "#bf9b4f", accentColor: "#7a5c2e", bgColor: "#fbf7ef", textColor: "#423a28", headingFont: "playfair" },
  { key: "emeraldGarden", label: "Emerald Garden", primaryColor: "#2f6f5e", accentColor: "#c2864e", bgColor: "#f4f8f5", textColor: "#2f3a33", headingFont: "serif" },
  { key: "dustyBlue", label: "Dusty Blue", primaryColor: "#6b8cae", accentColor: "#c2a878", bgColor: "#f6f8fb", textColor: "#3a4350", headingFont: "serif" },
  { key: "midnight", label: "Midnight", primaryColor: "#d4af7a", accentColor: "#8a9bb5", bgColor: "#1b1f2e", textColor: "#e8e3d8", headingFont: "playfair" },
  { key: "blushMinimal", label: "Blush Minimal", primaryColor: "#c98b8b", accentColor: "#b0a8a0", bgColor: "#ffffff", textColor: "#4a4a4a", headingFont: "sans" },
  { key: "sageCream", label: "Sage & Cream", primaryColor: "#7d8c6a", accentColor: "#b99c6b", bgColor: "#f7f6ef", textColor: "#3f4436", headingFont: "serif" },
  { key: "terracotta", label: "Terracotta", primaryColor: "#c1654a", accentColor: "#caa35a", bgColor: "#fbf4ee", textColor: "#4a392f", headingFont: "playfair" },
  { key: "lavenderLilac", label: "Lavender Lilac", primaryColor: "#8b7bb0", accentColor: "#c69bbf", bgColor: "#f8f5fb", textColor: "#403a4d", headingFont: "dancing" },
  { key: "burgundyWine", label: "Burgundy Wine", primaryColor: "#7c2e3b", accentColor: "#c79a4e", bgColor: "#1f1418", textColor: "#ecdcd6", headingFont: "playfair" },
  { key: "oceanBreeze", label: "Ocean Breeze", primaryColor: "#2f7d8c", accentColor: "#e0b15a", bgColor: "#f2f8f9", textColor: "#283a3e", headingFont: "serif" },
  { key: "peachCoral", label: "Peach Coral", primaryColor: "#e08a6e", accentColor: "#e3b58a", bgColor: "#fff7f3", textColor: "#4d3a31", headingFont: "dancing" },
  { key: "regalPurple", label: "Regal Purple", primaryColor: "#6d4b8f", accentColor: "#caa052", bgColor: "#1c1726", textColor: "#e9e2f0", headingFont: "playfair" },
  { key: "monoNoir", label: "Mono Noir", primaryColor: "#1f1f1f", accentColor: "#9a8c6b", bgColor: "#ffffff", textColor: "#222222", headingFont: "sans" },
];

const ALL_SECTIONS_ON: MarriageSections = {
  countdown: true,
  welcome: true,
  story: true,
  ceremonies: true,
  gallery: true,
  contact: true,
};

export const DEFAULT_MARRIAGE_THEME: MarriageTheme = {
  preset: "classicRose",
  primaryColor: "#b76e79",
  accentColor: "#d9a566",
  bgColor: "#fdf8f5",
  textColor: "#44403c",
  headingFont: "serif",
  heroOverlay: 45,
  cornerStyle: "rounded",
  heroHeight: "full",
  heroLayout: "stacked",
  heroTagline: "are getting married",
  showMonogram: false,
  monogramStyle: "mandala",
  topMotif: "none",
  floralAccents: "corners",
  headingStyle: "ornament",
  backgroundPattern: "none",
  fontScale: "normal",
  galleryLayout: "masonry",
  storyLayout: "spine",
  animations: true,
  sections: { ...ALL_SECTIONS_ON },
};

// Font stacks per heading style. The script choices only apply a cursive
// face to large display headings — body copy stays a readable serif so the
// page is still legible.
export const HEADING_FONTS: Record<
  MarriageHeadingFont,
  { label: string; heading: string; body: string }
> = {
  serif: {
    label: "Elegant Serif",
    heading: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    body: "'Cormorant Garamond', Georgia, serif",
  },
  playfair: {
    label: "Playfair Display",
    heading: "'Playfair Display', Georgia, serif",
    body: "'Cormorant Garamond', Georgia, serif",
  },
  sans: {
    label: "Modern Sans",
    heading: "'Poppins', ui-sans-serif, system-ui, sans-serif",
    body: "'Poppins', ui-sans-serif, system-ui, sans-serif",
  },
  script: {
    label: "Romantic Script",
    heading: "'Great Vibes', cursive",
    body: "'Cormorant Garamond', Georgia, serif",
  },
  dancing: {
    label: "Dancing Script",
    heading: "'Dancing Script', cursive",
    body: "'Cormorant Garamond', Georgia, serif",
  },
};

// Option lists (label + value) for the form's selects.
export const HERO_HEIGHTS: { value: MarriageHeroHeight; label: string }[] = [
  { value: "full", label: "Full screen" },
  { value: "tall", label: "Tall" },
  { value: "compact", label: "Compact" },
];
export const HERO_LAYOUTS: { value: MarriageHeroLayout; label: string }[] = [
  { value: "stacked", label: "Stacked names" },
  { value: "inline", label: "Names on one line" },
];
export const HEADING_STYLES: { value: MarriageHeadingStyle; label: string }[] = [
  { value: "icon", label: "Icon badge" },
  { value: "line", label: "Minimal line" },
  { value: "ornament", label: "Ornament" },
];
export const MONOGRAM_STYLES: {
  value: MarriageMonogramStyle;
  label: string;
}[] = [
  { value: "mandala", label: "Mandala seal" },
  { value: "ring", label: "Beaded ring" },
  { value: "minimal", label: "Minimal" },
];
export const TOP_MOTIFS: { value: MarriageTopMotif; label: string }[] = [
  { value: "none", label: "None" },
  { value: "ganesha", label: "Ganesha" },
  { value: "om", label: "Om (ॐ)" },
  { value: "lotus", label: "Lotus" },
  { value: "kalash", label: "Kalash" },
  { value: "floral", label: "Floral spray" },
];
export const FLORAL_ACCENTS: {
  value: MarriageFloralAccents;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "corners", label: "Floral corners (top & bottom)" },
  { value: "frame", label: "Floral frame (all corners)" },
];
export const BACKGROUND_PATTERNS: {
  value: MarriageBackgroundPattern;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "dots", label: "Dots" },
  { value: "hearts", label: "Hearts" },
  { value: "lattice", label: "Lattice" },
];
export const FONT_SCALES: { value: MarriageFontScale; label: string }[] = [
  { value: "cozy", label: "Cozy" },
  { value: "normal", label: "Normal" },
  { value: "grand", label: "Grand" },
];
export const GALLERY_LAYOUTS: {
  value: MarriageGalleryLayout;
  label: string;
}[] = [
  { value: "masonry", label: "Masonry (natural heights)" },
  { value: "grid", label: "Uniform grid" },
  { value: "carousel", label: "Swipe carousel" },
  { value: "collage", label: "Featured collage" },
];
export const STORY_LAYOUTS: {
  value: MarriageStoryLayout;
  label: string;
}[] = [
  { value: "spine", label: "Timeline (alternating)" },
  { value: "cards", label: "Stacked cards" },
  { value: "feature", label: "Feature (side-by-side)" },
];
export const SECTION_LABELS: { key: keyof MarriageSections; label: string }[] = [
  { key: "countdown", label: "Countdown" },
  { key: "welcome", label: "Welcome note" },
  { key: "story", label: "Our story" },
  { key: "ceremonies", label: "Ceremonies / functions" },
  { key: "gallery", label: "Photo gallery" },
  { key: "contact", label: "Contact card" },
];

// Tailwind class maps for structural sizing (read directly by the page).
export const HERO_HEIGHT_CLASS: Record<MarriageHeroHeight, string> = {
  full: "min-h-[92vh]",
  tall: "min-h-[78vh]",
  compact: "min-h-[60vh]",
};
export const HERO_NAME_CLASS: Record<MarriageFontScale, string> = {
  cozy: "text-4xl sm:text-6xl",
  normal: "text-5xl sm:text-7xl",
  grand: "text-6xl sm:text-8xl",
};

// Single Google Fonts request covering every heading option.
export const MARRIAGE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Poppins:wght@300;400;500;600&family=Great+Vibes&family=Dancing+Script:wght@400;500;600;700&display=swap";

// ---- color helpers (pure, hex in / css color out) -----------------------

function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return { r: 0, g: 0, b: 0 };
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(hex: string, a: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function mixHex(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  const r = Math.round(A.r + (B.r - A.r) * t);
  const g = Math.round(A.g + (B.g - A.g) * t);
  const bl = Math.round(A.b + (B.b - A.b) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Build the CSS background-image for a decorative page pattern, tinted with
// the theme's primary/accent so it always matches the palette.
function patternImage(
  pattern: MarriageBackgroundPattern,
  primary: string,
  accent: string,
): { image: string; size: string } {
  if (pattern === "dots") {
    return {
      image: `radial-gradient(${rgba(primary, 0.16)} 1.6px, transparent 1.7px)`,
      size: "22px 22px",
    };
  }
  if (pattern === "lattice") {
    const c = rgba(primary, 0.09);
    return {
      image: `repeating-linear-gradient(45deg, ${c} 0 1px, transparent 1px 16px), repeating-linear-gradient(-45deg, ${c} 0 1px, transparent 1px 16px)`,
      size: "auto",
    };
  }
  if (pattern === "hearts") {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24'><path d='M12 21s-7.4-4.6-7.4-10.1A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7.4 2.9C19.4 16.4 12 21 12 21z' fill='${accent}' fill-opacity='0.5'/></svg>`;
    return {
      image: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
      size: "46px 46px",
    };
  }
  return { image: "none", size: "auto" };
}

// Merge a possibly-partial/garbage stored theme onto the defaults so callers
// always get a complete, valid MarriageTheme.
export function resolveMarriageTheme(
  raw?: Partial<MarriageTheme> | null,
): MarriageTheme {
  const t = raw && typeof raw === "object" ? raw : {};
  const d = DEFAULT_MARRIAGE_THEME;

  const fontKeys: MarriageHeadingFont[] = [
    "serif",
    "playfair",
    "sans",
    "script",
    "dancing",
  ];
  const headingFont = fontKeys.includes(t.headingFont as MarriageHeadingFont)
    ? (t.headingFont as MarriageHeadingFont)
    : d.headingFont;

  const overlay = Number(t.heroOverlay);
  const oneOf = <T extends string>(v: unknown, allowed: T[], fb: T): T =>
    allowed.includes(v as T) ? (v as T) : fb;

  const s = (t.sections && typeof t.sections === "object"
    ? t.sections
    : {}) as Partial<MarriageSections>;

  return {
    preset: typeof t.preset === "string" ? t.preset : d.preset,
    primaryColor: t.primaryColor || d.primaryColor,
    accentColor: t.accentColor || d.accentColor,
    bgColor: t.bgColor || d.bgColor,
    textColor: t.textColor || d.textColor,
    headingFont,
    heroOverlay: Number.isFinite(overlay)
      ? Math.min(80, Math.max(0, overlay))
      : d.heroOverlay,
    cornerStyle: t.cornerStyle === "minimal" ? "minimal" : "rounded",
    heroHeight: oneOf(t.heroHeight, ["full", "tall", "compact"], d.heroHeight),
    heroLayout: oneOf(t.heroLayout, ["stacked", "inline"], d.heroLayout),
    heroTagline:
      typeof t.heroTagline === "string" ? t.heroTagline : d.heroTagline,
    showMonogram: t.showMonogram === true,
    monogramStyle: oneOf(
      t.monogramStyle,
      ["mandala", "ring", "minimal"],
      d.monogramStyle,
    ),
    topMotif: oneOf(
      t.topMotif,
      ["none", "ganesha", "om", "lotus", "kalash", "floral"],
      d.topMotif,
    ),
    floralAccents: oneOf(
      t.floralAccents,
      ["none", "corners", "frame"],
      d.floralAccents,
    ),
    headingStyle: oneOf(
      t.headingStyle,
      ["icon", "line", "ornament"],
      d.headingStyle,
    ),
    backgroundPattern: oneOf(
      t.backgroundPattern,
      ["none", "dots", "hearts", "lattice"],
      d.backgroundPattern,
    ),
    fontScale: oneOf(t.fontScale, ["cozy", "normal", "grand"], d.fontScale),
    galleryLayout: oneOf(
      t.galleryLayout,
      ["masonry", "grid", "carousel", "collage"],
      d.galleryLayout,
    ),
    storyLayout: oneOf(
      t.storyLayout,
      ["spine", "cards", "feature"],
      d.storyLayout,
    ),
    animations: t.animations !== false,
    sections: {
      countdown: s.countdown !== false,
      welcome: s.welcome !== false,
      story: s.story !== false,
      ceremonies: s.ceremonies !== false,
      gallery: s.gallery !== false,
      contact: s.contact !== false,
    },
  };
}

export interface MarriagePalette {
  vars: CSSProperties;
  isDark: boolean;
  headingFont: string;
  bodyFont: string;
}

// Turn a resolved theme into the CSS custom properties consumed by
// MarriageEventFront (and the form's live preview). Derives surface/border/
// muted shades so dark themes (e.g. Midnight) stay readable.
export function buildMarriagePalette(theme: MarriageTheme): MarriagePalette {
  const isDark = luminance(theme.bgColor) < 0.4;
  const fonts = HEADING_FONTS[theme.headingFont];

  const surface = isDark ? mixHex(theme.bgColor, "#ffffff", 0.08) : "#ffffff";
  const muted = mixHex(theme.textColor, theme.bgColor, 0.45);
  const radius = theme.cornerStyle === "rounded" ? "1.5rem" : "0.375rem";
  const pattern = patternImage(
    theme.backgroundPattern,
    theme.primaryColor,
    theme.accentColor,
  );

  const vars = {
    "--w-primary": theme.primaryColor,
    "--w-accent": theme.accentColor,
    "--w-bg": theme.bgColor,
    "--w-text": theme.textColor,
    "--w-surface": surface,
    "--w-muted": muted,
    "--w-heading-font": fonts.heading,
    "--w-body-font": fonts.body,
    "--w-radius": radius,
    "--w-primary-soft": rgba(theme.primaryColor, 0.12),
    "--w-primary-tint": rgba(theme.primaryColor, 0.06),
    "--w-primary-border": rgba(theme.primaryColor, 0.28),
    "--w-accent-soft": rgba(theme.accentColor, 0.16),
    "--w-on-hero": "#ffffff",
    "--w-hero-overlay": String(theme.heroOverlay / 100),
    "--w-pattern-image": pattern.image,
    "--w-pattern-size": pattern.size,
  } as CSSProperties;

  return { vars, isDark, headingFont: fonts.heading, bodyFont: fonts.body };
}

// Couple initials for the optional hero monogram, e.g. "A & D".
export function coupleMonogram(p1?: string, p2?: string): string {
  const a = (p1 || "").trim().charAt(0).toUpperCase();
  const b = (p2 || "").trim().charAt(0).toUpperCase();
  if (a && b) return `${a} & ${b}`;
  return a || b || "";
}
