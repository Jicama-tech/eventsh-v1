/**
 * Which brand an instance's emails wear.
 *
 * eventsh.com and every white-label deployment run this same backend, and an
 * email is often the only thing a customer ever sees of the instance behind a
 * purchase. So the brand is chosen per INSTANCE, by EMAIL_BRAND in its env, and
 * every email is framed by that brand's template (email-layout.ts): its name,
 * sender, colours, wordmark and footer. A white-label customer's buyers never
 * see "EventSH", and eventsh.com's never see a customer's brand.
 *
 *   EMAIL_BRAND=eventsh       (default) — the platform's own template
 *   EMAIL_BRAND=singadvisor   — SingAdvisor's dedicated instance
 *
 * EMAIL_BRAND_SITE_URL overrides where the wordmark and "contact us" link point.
 * A white-label brand needs it less than it seems: its default is the brand's
 * public site, which is NOT this instance's FRONTEND_BASE_URL (that is the
 * events frontend, e.g. eventsh.singadvisor.com, not singadvisor.com).
 *
 * Adding a brand is one entry in BRANDS. Nothing else in the codebase names a
 * brand — templates ask for emailBrand().name — so a new customer never means
 * hunting for hard-coded strings again.
 *
 * Read at call time, never at import: main.ts runs dotenv.config() after its
 * imports have already been evaluated, so a module-level read would see an
 * empty env and silently fall back to EventSH on every instance.
 */

export type EmailBrandId = "eventsh" | "singadvisor";

type Palette = {
  /** Buttons, links, the preheading and the rule under the header. */
  accent: string;
  /** Headings and emphasised text. */
  ink: string;
  /** Body copy. */
  body: string;
  /** Footer small print. */
  muted: string;
  hairline: string;
  /** Page background behind the card. */
  canvas: string;
  card: string;
  /** Header band behind the wordmark. */
  band: string;
  /** Neutral callout box (note() with the default "info" tone) — a pale
   * tint of the accent, so an informational box reads as this brand's and
   * not as another's blue. Warning/success/danger stay semantic. */
  tint: { bg: string; border: string; text: string };
};

export type EmailBrand = {
  id: EmailBrandId;
  /** The name as it appears in copy: "EventSH", "SingAdvisor". */
  name: string;
  /** Display name on the platform sender's From line. */
  senderName: string;
  tagline: string;
  /** Public site — the wordmark links here. No trailing slash. */
  siteUrl: string;
  /** Where the no-reply footer sends someone who needs a person. */
  contactUrl: string;
  /**
   * A platform brand adds "Powered by <name>" under an organizer's email, the
   * way it always has. A white-label customer's brand IS the organizer on its
   * own instance, so it says nothing of the kind.
   */
  poweredBy: boolean;
  palette: Palette;
  /** The header wordmark: HTML text, never an image (email-layout.ts says why). */
  wordmark: () => string;
};

const trimSlash = (url: string) => url.replace(/\/+$/, "");

const WORDMARK_FONT =
  "font-family:'Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:26px;line-height:1;font-weight:900;letter-spacing:-0.4px;";

const BRANDS: Record<EmailBrandId, (siteOverride?: string) => EmailBrand> = {
  /**
   * The platform. Slate header and blue accent from the existing emails and the
   * favicon (frontend/public/eventsh.svg fills #2f6ab6); the wordmark is the
   * "EventSH" the product calls itself in its sender names and sign-offs.
   */
  eventsh: (siteOverride) => {
    const site = trimSlash(
      siteOverride || process.env.FRONTEND_BASE_URL || "https://eventsh.com",
    );
    return {
      id: "eventsh",
      name: "EventSH",
      senderName: "EventSH",
      tagline: "Events, tickets and bookings — managed in one place.",
      siteUrl: site,
      contactUrl: `${site}/contact`,
      poweredBy: true,
      palette: {
        accent: "#2f6ab6",
        ink: "#0f172a",
        body: "#475569",
        muted: "#64748b",
        hairline: "#e2e8f0",
        canvas: "#f1f5f9",
        card: "#ffffff",
        band: "#0f172a",
        tint: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e3a8a" },
      },
      wordmark: () =>
        `<span style="${WORDMARK_FONT}color:#ffffff;">Event</span><span style="${WORDMARK_FONT}color:#7fb0f0;">SH</span>`,
    };
  },

  /**
   * SingAdvisor's dedicated instance. Mirrors the SingAdvisor Backend's own
   * email frame (singadvisor/Backend/src/common/email-layout.ts) so a ticket
   * from this instance and an enrolment confirmation from SingAdvisor's own
   * app arrive looking like one company: ink band, the logo's lowercase green
   * "sing" and heavy "Advisor" (the white-on-dark Logwhite.png variant), and
   * the site's teal-600 accent.
   */
  singadvisor: (siteOverride) => {
    const site = trimSlash(siteOverride || "https://singadvisor.com");
    return {
      id: "singadvisor",
      name: "SingAdvisor",
      senderName: "SingAdvisor",
      tagline: "Training, events, consultancy and careers — built around people.",
      siteUrl: site,
      contactUrl: `${site}/contact`,
      poweredBy: false,
      palette: {
        accent: "#0d8266",
        ink: "#08111f",
        body: "#4a5567",
        muted: "#8590a2",
        hairline: "#e4e8ee",
        canvas: "#f4f6f9",
        card: "#ffffff",
        band: "#08111f",
        tint: { bg: "#ecf7f3", border: "#b6e2d3", text: "#0a5a47" },
      },
      wordmark: () =>
        `<span style="${WORDMARK_FONT}color:#90d068;">sing</span><span style="${WORDMARK_FONT}color:#ffffff;">Advisor</span>`,
    };
  },
};

let warnedUnknown: string | null = null;

/** The brand this instance's emails wear. See the file header. */
export function emailBrand(): EmailBrand {
  const raw = (process.env.EMAIL_BRAND || "eventsh").trim().toLowerCase();
  const site = process.env.EMAIL_BRAND_SITE_URL?.trim() || undefined;
  if (raw in BRANDS) return BRANDS[raw as EmailBrandId](site);
  if (warnedUnknown !== raw) {
    // Loud once, not per email: a typo here would otherwise quietly put the
    // platform's brand on a customer's mail with nothing in the logs.
    console.warn(
      `EMAIL_BRAND="${raw}" is not a known brand (${Object.keys(BRANDS).join(", ")}) — using eventsh.`,
    );
    warnedUnknown = raw;
  }
  return BRANDS.eventsh(site);
}
