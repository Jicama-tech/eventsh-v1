/**
 * Partner-domain embed registry.
 *
 * Some external sites (jicama.tech, etc.) reverse-proxy a path on their own
 * domain to eventsh.com so the eventsh React app appears to live under their
 * brand. This file is the single source of truth that maps an embedding
 * hostname to the eventsh organizer slug whose storefront should appear at
 * `/events` on that domain.
 *
 * Adding a new partner is a one-line change here — the App router and the
 * OrganizerStorefront link helper both read from this map.
 */
const EMBED_HOSTS: Record<string, string> = {
  "jicama.tech": "jicama-tech-singapore",
};

function currentHost(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname.replace(/^www\./, "");
}

/**
 * Returns the organizer slug to embed at `/events` for the current hostname,
 * or `null` when we're on the canonical eventsh.com domain. Used by the
 * router to decide whether `/events` renders the listing page (eventsh.com)
 * or a specific organizer's storefront (partner domain).
 */
export function getEmbedOrgSlug(): string | null {
  return EMBED_HOSTS[currentHost()] ?? null;
}

/**
 * Returns the URL prefix to use when linking to an event detail page for the
 * given organizer slug. On a partner domain whose embed slug matches, the
 * prefix is `/events` so links stay inside the partner's URL space. On
 * eventsh.com the prefix is the canonical `/<orgSlug>/events`.
 */
export function getEventBasePath(orgSlug: string | undefined): string {
  const embedSlug = getEmbedOrgSlug();
  if (embedSlug && embedSlug === orgSlug) return "/events";
  return `/${orgSlug}/events`;
}

/** Canonical eventsh.com origin used when escaping a partner-embed domain. */
export const CANONICAL_ORIGIN = "https://eventsh.com";

/**
 * Returns the correct URL for links that point at pages only available on
 * the canonical eventsh.com app — auth, dashboards, admin tools, etc. On
 * eventsh.com the returned path is relative (so React Router handles it).
 * On a partner-embed host, it's an absolute eventsh.com URL so the browser
 * leaves the partner domain (Nginx only proxies `/events*` on embeds, and
 * React Router on the embed only knows about `/events*` routes).
 */
export function getCanonicalAppUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (getEmbedOrgSlug()) return `${CANONICAL_ORIGIN}${normalized}`;
  return normalized;
}
