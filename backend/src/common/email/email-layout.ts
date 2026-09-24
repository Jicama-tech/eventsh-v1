import { emailBrand, type EmailBrand } from "./email-brand";

/**
 * The frame every outgoing email goes through, in the instance's brand
 * (email-brand.ts): header band with the wordmark, a card for the message,
 * the sign-off, and a footer carrying the "system-generated, do not reply"
 * notice. Callers write only the middle, with the helpers below, so no
 * template carries its own header, footer, colours or brand name — which is
 * exactly how "EventSH" used to end up in a white-label customer's inbox.
 *
 * WHY IT LOOKS LIKE 2005 HTML. Email clients are not browsers. Outlook renders
 * with Word's engine, Gmail strips <style> blocks and anything it does not
 * recognise, and neither supports flexbox, grid, CSS variables or external
 * stylesheets. So: tables for layout, every style inline, six-digit hex, and
 * `bgcolor` beside every background colour.
 *
 * NO IMAGES IN THE FRAME. A logo would be a remote <img>, which most clients
 * block until the reader clicks "show images" — the brand would vanish exactly
 * when first impressions are made. The wordmark is styled text. (Content images
 * a template genuinely needs, like an inline ticket QR code, go through
 * image().)
 *
 * NO HTML COMMENTS IN THE MARKUP. Anything inside a template string ships to
 * every recipient and shows in "view source"; the reasoning lives here instead.
 * - 600px is the width every client agrees on. It is a max-width on a
 *   100%-wide table, because browsers ignore max-width on a table that has a
 *   fixed width (it overflowed phones); Outlook ignores max-width altogether,
 *   so the `[if mso]` wrapper — seen only by Outlook — holds it at 600 there.
 * - The header band carries its own top radius: a parent cell's radius does
 *   not clip its children in most clients. Outlook squares every corner, so
 *   there the card is square and still consistent.
 * - The accent rule is a 3px table row, not a border: Outlook renders partial
 *   borders inconsistently.
 */

/** Marks HTML that already went through brandedEmail(), so MailService can
 * tell a framed email from a stray fragment (see MailService.frame). */
export const BRANDED_EMAIL_MARKER = '<meta name="x-email-layout" content="branded">';

export function escapeEmailHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const esc = escapeEmailHtml;

const FONT = "font-family:Helvetica,Arial,sans-serif;";

export type BrandedEmail = {
  /** Small caps line above the message — what this is: "Ticket confirmed". */
  preheading?: string;
  /** The line inbox lists show beside the subject. Without it clients scrape
   * the first text they find, usually "Hi Jane,". */
  preview?: string;
  /** The caller's HTML, built with the helpers below. Inserted verbatim:
   * escaping user-supplied values is the caller's job (the helpers that take
   * plain text escape it themselves). */
  body: string;
  /**
   * The organizer this email is sent on behalf of — a ticket, a booking, an
   * invoice for their event. It signs the email, and on a platform brand it
   * heads the email too, with "Powered by EventSH" in the footer, the way
   * those emails always read. On a white-label brand the brand stays at the
   * top: on its own instance the organizer IS the brand.
   */
  organizer?: string;
  /** Replaces the sign-off name, or `false` to leave the sign-off out (an OTP
   * or security code reads wrong signed "Warm regards"). */
  signOff?: string | false;
  /** Replaces the footer's "contact us" link — e.g. the organizer's own email
   * address, when the question belongs to them and not to the platform. */
  contact?: { label: string; href: string };
};

function header(brand: EmailBrand, organizer?: string): string {
  const inner =
    organizer && brand.poweredBy
      ? `<span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;line-height:1.2;font-weight:800;color:#ffffff;">${esc(organizer)}</span>`
      : brand.wordmark();
  return `<a href="${esc(brand.siteUrl)}" style="text-decoration:none;">${inner}</a>`;
}

/** Wrap a message body in the instance's brand frame. */
export function brandedEmail({
  preheading,
  preview,
  body,
  organizer,
  signOff,
  contact,
}: BrandedEmail): string {
  const brand = emailBrand();
  const c = brand.palette;
  const org = organizer?.trim() || undefined;
  const signer = signOff === false ? null : signOff?.trim() || org || `The ${brand.name} Team`;
  const help = contact ?? { label: "contact us here", href: brand.contactUrl };
  const muted = `color:${c.muted};text-decoration:underline;`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${BRANDED_EMAIL_MARKER}
<title>${esc(brand.name)}</title>
</head>
<body style="margin:0;padding:0;background-color:${c.canvas};">
${
  preview
    ? `<div style="display:none;font-size:1px;color:${c.canvas};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(
        preview,
      )}${"&#847;&zwnj;&nbsp;".repeat(30)}</div>`
    : ""
}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.canvas}" style="background-color:${c.canvas};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr>
          <td bgcolor="${c.card}" style="background-color:${c.card};border:1px solid ${c.hairline};border-radius:10px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" bgcolor="${c.band}" style="padding:24px 32px;background-color:${c.band};border-radius:9px 9px 0 0;">${header(
                  brand,
                  org,
                )}</td>
              </tr>
              <tr><td bgcolor="${c.accent}" height="3" style="height:3px;line-height:3px;font-size:3px;background-color:${c.accent};">&nbsp;</td></tr>
              <tr>
                <td style="padding:32px;${FONT}font-size:15px;line-height:1.65;color:${c.body};">
                  ${
                    preheading
                      ? `<p style="margin:0 0 18px 0;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${c.accent};">${esc(
                          preheading,
                        )}</p>`
                      : ""
                  }
                  ${body}
                  ${
                    signer
                      ? `<p style="margin:22px 0 0 0;${FONT}font-size:15px;line-height:1.6;color:${c.body};">Warm regards,<br /><strong style="color:${c.ink};font-weight:600;">${esc(
                          signer,
                        )}</strong></p>`
                      : ""
                  }
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 4px 0 4px;${FONT}font-size:12px;line-height:1.6;color:${c.muted};">
            <p style="margin:0 0 14px 0;padding:0 0 14px 0;border-bottom:1px solid ${c.hairline};color:${c.body};">
              <strong style="color:${c.body};font-weight:600;">This is a system-generated email, so please do not reply to it.</strong> If you need help, <a href="${esc(
                help.href,
              )}" style="color:${c.body};text-decoration:underline;">${esc(help.label)}</a>.
            </p>
            ${
              org && brand.poweredBy
                ? `<p style="margin:0 0 6px 0;">Sent on behalf of ${esc(org)} &middot; Powered by ${esc(brand.name)}</p>`
                : ""
            }
            <p style="margin:0 0 6px 0;">${esc(brand.tagline)}</p>
            <p style="margin:0;">&copy; ${new Date().getFullYear()} ${esc(brand.name)} &middot; <a href="${esc(
              brand.siteUrl,
            )}" style="${muted}">${esc(brand.siteUrl.replace(/^https?:\/\//, ""))}</a></p>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

/*
 * Body helpers. Inline styles are not inherited in Outlook, so every element
 * carries its own; using these is what keeps a template from drifting off the
 * brand. Each reads the brand at call time, like brandedEmail().
 *
 * Escaping convention: a parameter named `text`/`label` is PLAIN TEXT and is
 * escaped here; a parameter named `html` is inserted verbatim and must already
 * be safe (escape any user-supplied value in it with escapeEmailHtml).
 */

/** A paragraph. */
export const p = (html: string) => {
  const c = emailBrand().palette;
  return `<p style="margin:0 0 14px 0;${FONT}font-size:15px;line-height:1.65;color:${c.body};">${html}</p>`;
};

/** Bold, in the ink colour. Escapes. */
export const strong = (text: string) =>
  `<strong style="color:${emailBrand().palette.ink};font-weight:600;">${esc(text)}</strong>`;

/** The message's headline, in a display serif. Escapes. */
export const heading = (text: string) =>
  `<h1 style="margin:0 0 14px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;font-weight:700;color:${emailBrand().palette.ink};">${esc(
    text,
  )}</h1>`;

/** A smaller section heading inside the body. Escapes. */
export const subheading = (text: string) =>
  `<h2 style="margin:22px 0 10px 0;${FONT}font-size:16px;line-height:1.4;font-weight:700;color:${emailBrand().palette.ink};">${esc(
    text,
  )}</h2>`;

/** An inline link in the accent colour — a bare <a> renders in the client's
 * default blue in Outlook. Escapes both. */
export const link = (label: string, url: string) =>
  `<a href="${esc(url)}" style="color:${emailBrand().palette.accent};text-decoration:underline;">${esc(label)}</a>`;

/**
 * A call-to-action button. Padding on the CELL, never the anchor: Word's
 * engine ignores padding on inline elements. No whitespace inside the <a>,
 * or some clients underline a stray space either side. Escapes both.
 */
export const button = (label: string, url: string) => {
  const c = emailBrand().palette;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td align="center" bgcolor="${c.accent}" style="padding:13px 28px;border-radius:6px;"><a href="${esc(
    url,
  )}" style="${FONT}font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(label)}</a></td></tr></table>`;
};

/**
 * A label/value table — ticket ID, venue, amount. The LABEL is escaped; the
 * VALUE is html (callers sometimes pass a link or a <br />), so escape any
 * user-supplied value first. Rows with an empty value are dropped, which is
 * what every "field ? row : ''" in the old templates was doing by hand.
 */
export const details = (rows: Array<[string, string | null | undefined | false]>) => {
  const c = emailBrand().palette;
  const kept = rows.filter(([, v]) => v !== null && v !== undefined && v !== false && String(v) !== "");
  if (kept.length === 0) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.canvas}" style="margin:0 0 18px 0;background-color:${c.canvas};border:1px solid ${c.hairline};border-radius:8px;">${kept
    .map(
      ([label, value], i) =>
        `<tr><td valign="top" style="padding:10px 16px;${i ? `border-top:1px solid ${c.hairline};` : ""}${FONT}font-size:14px;line-height:1.5;color:${c.muted};width:38%;">${esc(
          label,
        )}</td><td valign="top" style="padding:10px 16px;${i ? `border-top:1px solid ${c.hairline};` : ""}${FONT}font-size:14px;line-height:1.5;font-weight:600;color:${c.ink};">${value}</td></tr>`,
    )
    .join("")}</table>`;
};

/** A single label/value line, for one-off facts in running text. Label
 * escaped, value is html. */
export const detail = (label: string, valueHtml: string) =>
  p(`${strong(label)} ${valueHtml}`);

/** A bulleted list. Items are html. Indented with margin, not padding:
 * Outlook's Word engine ignores padding on lists, which leaves the markers
 * clipped at the cell edge. */
export const bullets = (itemsHtml: string[]) => {
  if (itemsHtml.length === 0) return "";
  const c = emailBrand().palette;
  return `<ul style="margin:0 0 14px 24px;padding:0;${FONT}font-size:15px;line-height:1.7;color:${c.body};">${itemsHtml
    .map((i) => `<li style="margin:0 0 6px 0;">${i}</li>`)
    .join("")}</ul>`;
};

/** A numbered list — steps a reader follows in order, where the numbers are
 * part of the instruction. Items are html. */
export const steps = (itemsHtml: string[]) => {
  if (itemsHtml.length === 0) return "";
  const c = emailBrand().palette;
  return `<ol style="margin:0 0 14px 26px;padding:0;${FONT}font-size:15px;line-height:1.7;color:${c.body};">${itemsHtml
    .map((i) => `<li style="margin:0 0 6px 0;">${i}</li>`)
    .join("")}</ol>`;
};

const TONES = {
  success: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" },
  warning: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  danger: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
} as const;

/** A tinted callout box — an important condition, a warning, a status.
 * "info" is the brand's own tint; the other tones are semantic, not brand
 * colours, so a warning reads as one in every brand. Content is html. */
export const note = (
  html: string,
  tone: "info" | keyof typeof TONES = "info",
) => {
  const t = tone === "info" ? emailBrand().palette.tint : TONES[tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;"><tr><td bgcolor="${t.bg}" style="padding:14px 16px;background-color:${t.bg};border:1px solid ${t.border};border-radius:8px;${FONT}font-size:14px;line-height:1.55;color:${t.text};">${html}</td></tr></table>`;
};

/** A one-time code, large and spaced so it can be read and typed. Escapes. */
export const code = (text: string) => {
  const c = emailBrand().palette;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;"><tr><td align="center" bgcolor="${c.canvas}" style="padding:22px 16px;background-color:${c.canvas};border:1px solid ${c.hairline};border-radius:8px;font-family:'Courier New',Courier,monospace;font-size:32px;line-height:1;font-weight:700;letter-spacing:8px;color:${c.ink};">${esc(
    text,
  )}</td></tr></table>`;
};

/** A centred content image — e.g. `cid:` for an inline QR code attachment.
 * Width in px; escapes src and alt. */
export const image = (src: string, alt: string, width = 200) => {
  const c = emailBrand().palette;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;"><tr><td align="center"><img src="${esc(
    src,
  )}" alt="${esc(alt)}" width="${width}" style="display:block;width:${width}px;max-width:100%;height:auto;border:1px solid ${c.hairline};border-radius:8px;" /></td></tr></table>`;
};

/** Small print inside the card — a reference number, a note under a table.
 * Content is html. */
export const small = (html: string) =>
  `<p style="margin:0 0 12px 0;${FONT}font-size:13px;line-height:1.55;color:${emailBrand().palette.muted};">${html}</p>`;
