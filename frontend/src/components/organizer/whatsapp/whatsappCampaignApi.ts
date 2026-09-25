import { useEffect, useRef } from "react";
import { t as i18nT } from "@/i18n/t";

/**
 * The wire types and small helpers shared by the WhatsApp screens.
 *
 * Kept apart from the components on purpose: a module that exports both
 * components and plain functions defeats React Fast Refresh, and the
 * connection card, the composer, the progress view and the opt-out switch all
 * need these.
 *
 * The shapes mirror backend/src/modules/campaigns and modules/whatsapp. The
 * server is the source of truth for everything that is sent: names, numbers,
 * the rendered text and the skip reasons all come from it, never from the
 * list the browser happens to hold.
 */

export const apiURL = __API_URL__;

/** Mirrors OrganizerWhatsappState in the backend. */
export type WhatsappStatus =
  | "off"
  | "disconnected"
  | "connecting"
  | "awaiting-scan"
  | "connected";

export type WhatsappState = {
  enabled: boolean;
  status: WhatsappStatus;
  qr: string | null;
  qrExpiresAt: string | null;
  number: string | null;
  connectedAt: string | null;
  lastError: string | null;
};

export function isWhatsappState(body: unknown): body is WhatsappState {
  if (!body || typeof body !== "object") return false;
  const b = body as { enabled?: unknown; status?: unknown };
  return typeof b.enabled === "boolean" && typeof b.status === "string";
}

/** Where a campaign's contacts come from (CONTACT_SOURCES on the server). */
export type ContactSource =
  | "tickets"
  | "stalls"
  | "speakers"
  | "roundtables"
  | "workshops"
  | "spaces"
  | "members"
  | "rsvps"
  | "sponsors"
  | "suppliers"
  | "crm"
  | "all";

/** English labels double as i18n keys. */
export const SOURCE_LABEL: Record<ContactSource, string> = {
  all: "Everyone",
  tickets: "Ticket buyers",
  stalls: "Stall vendors",
  speakers: "Speakers",
  roundtables: "Round-table bookers",
  workshops: "Workshop bookers",
  spaces: "Space registrants",
  members: "Members",
  rsvps: "RSVP guests",
  sponsors: "Sponsors",
  suppliers: "Suppliers",
  crm: "CRM contacts",
};

export const SOURCES: ContactSource[] = [
  "all",
  "tickets",
  "stalls",
  "speakers",
  "roundtables",
  "workshops",
  "spaces",
  "members",
  "rsvps",
  "sponsors",
  "suppliers",
  "crm",
];

/**
 * Audience groups as the organizer thinks of them. Each maps to one or more
 * server sources; the composer lets the organizer tick one group or several.
 * Labels double as i18n keys.
 */
export type AudienceGroup =
  | "exhibitors"
  | "visitors"
  | "speakers"
  | "sponsors"
  | "suppliers"
  | "members"
  | "crm";

export const GROUPS: ReadonlyArray<{
  key: AudienceGroup;
  label: string;
  hint: string;
  sources: Exclude<ContactSource, "all">[];
}> = [
  { key: "exhibitors", label: "Exhibitors", hint: "Stall vendors", sources: ["stalls"] },
  {
    key: "visitors",
    label: "Visitors",
    // Mirrors the dashboard's Visitors tab: ticket buyers merged with the
    // customers the organizer added by hand (the CRM list).
    hint: "Ticket buyers, round-table, workshop and scheduled-space bookers, RSVP guests and CRM customers",
    sources: ["tickets", "roundtables", "workshops", "spaces", "rsvps", "crm"],
  },
  { key: "speakers", label: "Speakers", hint: "Speaker applicants", sources: ["speakers"] },
  { key: "sponsors", label: "Sponsors", hint: "Sponsor applicants", sources: ["sponsors"] },
  { key: "suppliers", label: "Suppliers", hint: "Supplier contacts", sources: ["suppliers"] },
  { key: "members", label: "Members", hint: "Membership holders", sources: ["members"] },
  { key: "crm", label: "CRM contacts", hint: "Customers added by hand in My Users (also part of Visitors)", sources: ["crm"] },
];

/** The server sources behind a set of ticked groups, in GROUPS order. */
export function sourcesForGroups(groups: ReadonlySet<AudienceGroup>): Exclude<ContactSource, "all">[] {
  const out: Exclude<ContactSource, "all">[] = [];
  for (const g of GROUPS) if (groups.has(g.key)) out.push(...g.sources);
  return out;
}

/** Display labels (i18n keys) for a campaign's audience: group names when
 * the campaign stored its sources, "Everyone" when they cover every group,
 * else the single source's label. */
export function audienceLabels(c: { source: ContactSource; sources?: ContactSource[] }): string[] {
  const list = (c.sources ?? []).filter(
    (s): s is Exclude<ContactSource, "all"> => s !== "all" && s in SOURCE_LABEL,
  );
  if (list.length === 0) return [SOURCE_LABEL[c.source] ?? c.source];
  if (GROUPS.every((g) => g.sources.every((s) => list.includes(s)))) return [SOURCE_LABEL.all];
  const labels: string[] = [];
  for (const s of list) {
    // A source that is its own group (CRM) is named as such; one that only
    // exists inside a bigger group (tickets) takes that group's name.
    const group =
      GROUPS.find((g) => g.sources.length === 1 && g.sources[0] === s) ??
      GROUPS.find((g) => g.sources.includes(s));
    const label = group ? group.label : SOURCE_LABEL[s];
    if (!labels.includes(label)) labels.push(label);
  }
  return labels;
}

/** Sources that can be narrowed to one event. */
export const EVENT_SCOPED_SOURCES: ReadonlySet<ContactSource> = new Set<ContactSource>([
  "all",
  "tickets",
  "stalls",
  "speakers",
  "roundtables",
  "workshops",
  "spaces",
  "rsvps",
  "sponsors",
]);

export type Contact = {
  id: string;
  source: Exclude<ContactSource, "all">;
  name: string;
  email: string;
  phone: string;
  eventId: string | null;
  eventTitle: string;
  createdAt: string | null;
};

export type CampaignEvent = {
  id: string;
  title: string;
  startDate: string | null;
  hasImage: boolean;
  /** As stored ("/uploads/events/x.webp" or a full URL); null when none. */
  image?: string | null;
};

/** A browser-loadable URL for an event image the API stored. */
export function eventImageUrl(image: string | null | undefined): string | null {
  const raw = String(image ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${apiURL}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

/** The request both preview and send use, so the two can never disagree
 * about who the audience is or what they receive. */
export type CampaignRequest = {
  template: string;
  /** Single-source form, kept for the server's older shape. */
  source: ContactSource;
  /** The ticked groups' sources; wins over `source` on the server. */
  sources?: ContactSource[];
  eventId?: string;
  contactIds?: string[];
  allContacts?: boolean;
  attachEventImage?: boolean;
  /** With `eventId`: false keeps every contact and uses the event only for
   * the message details; true (default) limits to that event's bookers. */
  filterByEvent?: boolean;
};

export type CampaignPreview = {
  total: number;
  willSend: number;
  willSkip: number;
  /** Skip reason (an English sentence that doubles as the i18n key) → count. */
  skipped: Record<string, number>;
  unknownPlaceholders: string[];
  hasImage: boolean;
  warnings: string[];
  estimatedMinutes: number;
  dailyRemaining: number;
  connected: boolean;
  /** Up to 20, sendable contacts only, rendered exactly as they will go. */
  samples: Array<{ contactId: string; name: string; phone: string; text: string }>;
};

export type CampaignStatus =
  | "queued"
  | "sending"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

export type CampaignSummary = {
  id: string;
  createdAt: string;
  status: CampaignStatus;
  total: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  pendingCount: number;
  templatePreview: string;
  source: ContactSource;
  sources?: ContactSource[];
  eventTitle: string;
  audienceByEvent?: boolean;
  hasImage: boolean;
  lastError: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdByName: string | null;
};

export type RecipientStatus = "pending" | "sent" | "failed" | "skipped";

export type CampaignDetail = CampaignSummary & {
  template: string;
  recipients: Array<{
    contactId: string;
    name: string;
    /** Masked by the server ("…3210"); the full number never leaves it. */
    phone: string;
    status: RecipientStatus;
    reason: string | null;
    sentAt: string | null;
  }>;
};

/** The runner is still working through the list — worth polling. */
export function isInFlight(status: CampaignStatus | undefined): boolean {
  return status === "queued" || status === "sending";
}

/** `<source>:<24-hex id>[:<index>]` — what the DTO accepts. */
export function isContactId(id: unknown): id is string {
  return typeof id === "string" && /^[a-z]+:[a-f0-9]{24}(?::\d{1,3})?$/i.test(id);
}

/**
 * `ref.current` is true exactly while the component is mounted, so an answer
 * that lands after the screen closed is dropped instead of setting state on
 * nothing. Set in the effect, not the initial value: StrictMode runs the
 * cleanup and the setup once more on mount, and the second setup must win.
 */
export function useMounted() {
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
}

/** How often a list of campaigns is re-read while one of them is running. */
export const LIST_POLL_MS = 10000;

/**
 * Run `tick` every `everyMs` while `active`: a hidden tab skips its ticks
 * (nobody is looking) and catches up the moment it is shown, and the interval
 * dies with the component. Overlap is the caller's job — every `load` that
 * uses this refuses to start while one is in flight.
 */
export function usePoll(active: boolean, everyMs: number, tick: () => void) {
  const tickRef = useRef(tick);
  tickRef.current = tick;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (!document.hidden) tickRef.current();
    }, everyMs);
    const onVisible = () => {
      if (!document.hidden) tickRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, everyMs]);
}

export function authHeaders(json = false): Record<string, string> {
  // Read per request rather than once per render: the token can be replaced
  // (re-login in another tab) while the screen sits open.
  const token = sessionStorage.getItem("token");
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Sentences the campaign API builds with a number or a list inside, so they
 * cannot be dictionary keys as they stand. Each is matched and re-said
 * through a key with a `{placeholder}` instead.
 */
const DYNAMIC_MESSAGES: Array<{
  pattern: RegExp;
  say: (m: RegExpMatchArray) => string;
}> = [
  {
    pattern: /^Your message uses unknown placeholders:\s*([\s\S]*)$/,
    say: (m) => `${i18nT("Your message uses unknown placeholders:")} ${m[1]}`,
  },
  {
    pattern: /^Daily limit reached \((\d+) messages\)\. Resume tomorrow\.$/,
    say: (m) =>
      i18nT("Daily limit reached ({count} messages). Resume tomorrow.", {
        count: m[1],
      }),
  },
  {
    pattern: /^A campaign can go to at most (\d+) contacts\. Select fewer contacts\.$/,
    say: (m) =>
      i18nT("A campaign can go to at most {count} contacts. Select fewer contacts.", {
        count: m[1],
      }),
  },
];

/** A sentence from the API in the organizer's language when we know it.
 * The API's sentences are fixed English, so they double as i18n keys — an
 * unknown one falls through `t()` unchanged. */
export function apiText(message: string | null | undefined): string {
  const text = String(message ?? "").trim();
  if (!text) return "";
  for (const { pattern, say } of DYNAMIC_MESSAGES) {
    const m = text.match(pattern);
    if (m) return say(m);
  }
  return i18nT(text);
}

/**
 * The human sentence out of a Nest error body, translated when we know it.
 * `message` is a string for the service's own errors but an array of strings
 * when the global ValidationPipe rejects the body, so both shapes are read.
 */
export function nestMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { message?: unknown }).message;
  const parts = (Array.isArray(raw) ? raw : [raw]).filter(
    (p): p is string => typeof p === "string" && p.trim() !== "",
  );
  return parts.length ? parts.map((p) => apiText(p)).join(" · ") : null;
}

export function isPreview(body: unknown): body is CampaignPreview {
  if (!body || typeof body !== "object") return false;
  const b = body as Partial<CampaignPreview>;
  return typeof b.willSend === "number" && Array.isArray(b.samples);
}

export function isSummary(body: unknown): body is CampaignSummary {
  if (!body || typeof body !== "object") return false;
  const b = body as Partial<CampaignSummary>;
  return typeof b.id === "string" && typeof b.status === "string";
}

export function isDetail(body: unknown): body is CampaignDetail {
  return (
    isSummary(body) &&
    Array.isArray((body as Partial<CampaignDetail>).recipients)
  );
}

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  queued: "Queued",
  sending: "Sending",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
};

// Coloured badges carry an explicit dark pair: the light tints read as glare
// on the dark card, and the dark ones vanish on the light one.
const NEUTRAL = "border-border bg-muted text-muted-foreground";
const AMBER =
  "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300";
const GREEN =
  "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300";
const RED =
  "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300";
const BLUE =
  "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300";

export const STATUS_CLASS: Record<CampaignStatus, string> = {
  queued: BLUE,
  sending: BLUE,
  paused: AMBER,
  completed: GREEN,
  cancelled: NEUTRAL,
  failed: RED,
};

export const BADGE_CLASS = { neutral: NEUTRAL, amber: AMBER, red: RED, green: GREEN } as const;

/** A timestamp as the organizer's browser writes dates. */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
