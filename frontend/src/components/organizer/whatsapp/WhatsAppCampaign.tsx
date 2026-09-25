import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { jwtDecode } from "jwt-decode";
import {
  AlertCircle,
  BellOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { t as i18nT } from "@/i18n/t";
import {
  campaignName,
  firstNameOf,
  KNOWN_PLACEHOLDERS,
  render,
  validate,
  waDigits,
  type CampaignVars,
} from "@/lib/campaignTemplate";
import {
  apiText,
  apiURL,
  AudienceGroup,
  authHeaders,
  BADGE_CLASS,
  CampaignEvent,
  CampaignPreview,
  CampaignRequest,
  CampaignSummary,
  Contact,
  ContactSource,
  EVENT_SCOPED_SOURCES,
  eventImageUrl,
  GROUPS,
  isContactId,
  isInFlight,
  isPreview,
  isSummary,
  LIST_POLL_MS,
  nestMessage,
  SOURCE_LABEL,
  sourcesForGroups,
  useMounted,
  usePoll,
} from "./whatsappCampaignApi";
import { CampaignHistory, CampaignRunView } from "./WhatsAppCampaignRun";

/** The campaign DTO's limits, so the browser stops the typing instead of the
 * API answering with a class-validator sentence. */
const TEMPLATE_MAX = 3000;
const MAX_CONTACT_IDS = 1000;
/** The most a single campaign may send (the service's MAX_SENDABLE). */
const MAX_SENDABLE = 1000;
/** WhatsApp's caption limit when the event image goes with the text. */
const CAPTION_MAX = 1024;
/** Long enough that a preview is not fired per keystroke, short enough that
 * it has usually landed by the time the organizer looks across. */
const PREVIEW_DEBOUNCE_MS = 800;

/** Radix Select cannot hold an empty value, so "every event" needs a name. */
const ALL_EVENTS = "all";

/** Why a row cannot be ticked. English, and the i18n key. */
type Block = "Opted out" | "No WhatsApp";

type AudienceRow = Contact & { block: Block | null; digits: string };

/** The organization's name and country, from the login token. */
function readOrganizer(): { name?: string; country?: string } {
  try {
    const token = sessionStorage.getItem("token");
    if (!token) return {};
    const decoded = jwtDecode<{ organizationName?: string; name?: string; country?: string }>(token);
    return { name: decoded?.organizationName || decoded?.name, country: decoded?.country };
  } catch {
    return {};
  }
}

/** The dashboard scrolls inside its <main>, not the window, so "the top" is
 * the top of the nearest ancestor that scrolls. */
function scrollToTop(el: HTMLElement | null) {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const { overflowY } = window.getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      node.scrollTop = 0;
      return;
    }
  }
  window.scrollTo(0, 0);
}

/**
 * WhatsApp › Campaigns.
 *
 * A campaign really goes out: from the organizer's linked WhatsApp, one
 * personalised message per contact, paced by the server. Three views share
 * the screen: New campaign and History as tabs, and one campaign's progress
 * on top of both. The composer stays mounted (hidden) while another view is
 * up, so a half-written message survives a look at the history.
 */
export function WhatsAppCampaignScreen() {
  const [tab, setTab] = useState<"new" | "history">("new");
  const [runId, setRunId] = useState<string | null>(null);
  const [composerVisits, setComposerVisits] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    scrollToTop(rootRef.current);
  }, [runId]);

  return (
    <div ref={rootRef} className="space-y-6">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <FaWhatsapp className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          {i18nT("WhatsApp Campaigns")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {i18nT(
            "Send a personalised message to the attendees, vendors and contacts you choose, from your own WhatsApp.",
          )}
        </p>
      </div>

      <Card className="w-full">
        <CardContent className="p-4 pt-6 sm:p-6">
          <div className={runId ? "hidden" : undefined}>
            <Tabs
              value={tab}
              onValueChange={(v) => {
                const next = v === "history" ? "history" : "new";
                if (next === "new") setComposerVisits((n) => n + 1);
                setTab(next);
              }}
            >
              <TabsList className="grid w-full grid-cols-2 sm:inline-grid sm:w-auto">
                <TabsTrigger value="new">{i18nT("New campaign")}</TabsTrigger>
                <TabsTrigger value="history">{i18nT("History")}</TabsTrigger>
              </TabsList>
              <TabsContent value="new" forceMount className="mt-4 data-[state=inactive]:hidden">
                <CampaignComposer
                  onOpenRun={setRunId}
                  refreshKey={composerVisits}
                  onScreen={tab === "new" && !runId}
                />
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                {!runId && <CampaignHistory onOpen={setRunId} />}
              </TabsContent>
            </Tabs>
          </div>

          {runId && (
            <CampaignRunView
              key={runId}
              id={runId}
              onBack={() => {
                setRunId(null);
                setTab("history");
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * The New campaign tab: who, what, a preview of exactly what they get, and
 * Send.
 *
 * The preview is the server's, not a guess made here. It renders each sample
 * with the contact's real name and the same spintax choice the send will
 * make, and it is where the skip reasons, the time estimate and the daily
 * allowance come from. Send is only offered for the preview on screen: any
 * edit makes it stale, and a stale preview cannot be sent.
 */
function CampaignComposer({
  onOpenRun,
  refreshKey,
  onScreen,
}: {
  onOpenRun: (id: string) => void;
  /** Bumped each time the organizer comes back to this tab. */
  refreshKey: number;
  /** This tab is the view on screen (it stays mounted when it is not). */
  onScreen: boolean;
}) {
  const { toast } = useToast();
  const mountedRef = useMounted();
  // The add-on that sends from the organizer's own number. Without it, or
  // without a linked phone, the screen still personalises and previews —
  // sending falls back to one wa.me chat per contact, from the organizer's
  // phone.
  const { isModuleEnabled, loading: planLoading } = useSubscription();
  const waPlan = isModuleEnabled("whatsappConnect");
  const organizer = useMemo(readOrganizer, []);

  // The audience is one group or several (Exhibitors, Visitors, …); each
  // group is one or more server sources. `source` keeps the single-source
  // shape the server also accepts, and labels rows when lists are mixed.
  const [groups, setGroups] = useState<Set<AudienceGroup>>(
    () => new Set<AudienceGroup>(["visitors"]),
  );
  const sources = useMemo(() => sourcesForGroups(groups), [groups]);
  const sourcesKey = sources.join(",");
  const source: ContactSource = sources.length === 1 ? sources[0] : "all";
  const allGroupsOn = groups.size === GROUPS.length;
  const toggleGroup = (key: AudienceGroup) =>
    setGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const [eventId, setEventId] = useState<string>(ALL_EVENTS);
  // Off: the chosen event only fills {{event}} details and the image, and
  // every contact in the ticked groups stays listed. On: only that event's
  // bookers. Off by default — "tell all my visitors about this event".
  const [eventOnly, setEventOnly] = useState(false);
  const eventChosen = eventId !== ALL_EVENTS;
  const [events, setEvents] = useState<CampaignEvent[] | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [contactsTruncated, setContactsTruncated] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  /** Bumped by the Retry button after a failed contacts read. */
  const [contactsRetry, setContactsRetry] = useState(0);
  // The list is read when the composer opens; coming back to it (from the
  // history, a campaign run, or another dashboard tab) reads it again so a
  // booking or customer added meanwhile shows up without a page reload.
  const wasOnScreenRef = useRef(false);
  useEffect(() => {
    if (onScreen && wasOnScreenRef.current) setContactsRetry((n) => n + 1);
    wasOnScreenRef.current = onScreen;
  }, [onScreen]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [template, setTemplate] = useState("");
  const [attachImage, setAttachImage] = useState(false);
  const [optedOut, setOptedOut] = useState<Set<string>>(() => new Set());
  const [optOutBusy, setOptOutBusy] = useState<string | null>(null);
  /** null = not known yet. Seeded by /whatsapp/status, then kept current by
   * every preview (which answers `connected` too). */
  const [connected, setConnected] = useState<boolean | null>(null);
  const [active, setActive] = useState<CampaignSummary | null>(null);

  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sampleIndex, setSampleIndex] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const startingRef = useRef(false);
  const previewSeqRef = useRef(0);
  const previewAbortRef = useRef<AbortController | null>(null);
  const contactsSeqRef = useRef(0);

  const eventScoped = sources.some((s) => EVENT_SCOPED_SOURCES.has(s));
  const chosenEvent = useMemo(
    () => (eventId !== ALL_EVENTS ? events?.find((e) => e.id === eventId) ?? null : null),
    [events, eventId],
  );

  // ---- one-off reads ----------------------------------------------------

  useEffect(() => {
    const getJson = async (path: string) => {
      const res = await fetch(`${apiURL}${path}`, { headers: authHeaders() });
      return { ok: res.ok, body: await res.json().catch(() => null) };
    };
    void getJson("/campaigns/whatsapp/events")
      .then(({ ok, body }) => {
        if (!mountedRef.current) return;
        setEvents(ok && Array.isArray(body?.events) ? body.events : []);
      })
      .catch(() => mountedRef.current && setEvents([]));
    void getJson("/campaigns/whatsapp/opt-outs")
      .then(({ ok, body }) => {
        if (!mountedRef.current || !ok || !Array.isArray(body?.phoneDigits)) return;
        setOptedOut(new Set(body.phoneDigits.map(String)));
      })
      .catch(() => undefined);
    return () => {
      previewAbortRef.current?.abort();
    };
  }, [mountedRef]);

  // The contact list for the chosen source and event. Re-read on change;
  // only the newest answer is applied.
  useEffect(() => {
    const seq = ++contactsSeqRef.current;
    setContacts(null);
    setContactsError(null);
    if (!sourcesKey) {
      // No group ticked: nothing to list (and nothing to send).
      setContacts([]);
      setContactsTruncated(false);
      return;
    }
    const params = new URLSearchParams({ sources: sourcesKey });
    if (eventScoped && eventOnly && eventId !== ALL_EVENTS) params.set("eventId", eventId);
    fetch(`${apiURL}/campaigns/whatsapp/contacts?${params.toString()}`, { headers: authHeaders() })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!mountedRef.current || seq !== contactsSeqRef.current) return;
        if (res.ok && Array.isArray(body?.contacts)) {
          setContacts(body.contacts.filter((c: Contact) => isContactId(c?.id)));
          setContactsTruncated(!!body.truncated);
        } else {
          setContacts([]);
          setContactsError(nestMessage(body) ?? i18nT("Contacts could not be loaded. Try again in a moment."));
        }
      })
      .catch(() => {
        if (!mountedRef.current || seq !== contactsSeqRef.current) return;
        setContacts([]);
        setContactsError(i18nT("Could not reach the server. Check your internet connection and try again."));
      });
  }, [sourcesKey, eventId, eventScoped, eventOnly, contactsRetry, mountedRef]);

  /** The "a campaign is sending / paused" banner. */
  const activeLoadingRef = useRef(false);
  const loadActive = useCallback(async () => {
    if (activeLoadingRef.current) return;
    activeLoadingRef.current = true;
    try {
      const res = await fetch(`${apiURL}/campaigns/whatsapp`, { headers: authHeaders() });
      const body = await res.json().catch(() => null);
      if (!mountedRef.current || !res.ok || !Array.isArray(body)) return;
      const current = body
        .filter(isSummary)
        .find((c) => isInFlight(c.status) || c.status === "paused");
      setActive(current ?? null);
    } catch {
      // Only a courtesy banner; the server refuses a second campaign anyway.
    } finally {
      activeLoadingRef.current = false;
    }
  }, [mountedRef]);

  useEffect(() => {
    void loadActive();
  }, [loadActive, refreshKey]);

  usePoll(onScreen && isInFlight(active?.status), LIST_POLL_MS, () => void loadActive());

  // The link status, once the plan is known to include the add-on.
  const planKnownOn = !planLoading && waPlan;
  useEffect(() => {
    if (!planKnownOn) return;
    fetch(`${apiURL}/whatsapp/status`, { headers: authHeaders() })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!mountedRef.current || !res.ok || typeof body?.status !== "string") return;
        setConnected((current) => current ?? body.status === "connected");
      })
      .catch(() => undefined);
  }, [planKnownOn, mountedRef]);

  const manualMode = (!planLoading && !waPlan) || connected === false;

  // ---- audience -----------------------------------------------------------

  const rows = useMemo<AudienceRow[]>(() => {
    const out: AudienceRow[] = [];
    for (const c of contacts ?? []) {
      const digits = String(c.phone ?? "").replace(/\D/g, "");
      const block: Block | null = !digits
        ? "No WhatsApp"
        : optedOut.has(digits)
          ? "Opted out"
          : null;
      out.push({ ...c, block, digits });
    }
    return out;
  }, [contacts, optedOut]);

  const selectableIds = useMemo(() => rows.filter((r) => !r.block).map((r) => r.id), [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    const digits = q.replace(/\D/g, "");
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.eventTitle.toLowerCase().includes(q) ||
        (digits !== "" && r.digits.includes(digits)),
    );
  }, [rows, search]);

  const chosenIds = useMemo(
    () => selectableIds.filter((id) => selected.has(id)),
    [selectableIds, selected],
  );
  const everyone = chosenIds.length > 0 && chosenIds.length === selectableIds.length;

  // A new group set or audience scope is a new list: what was ticked no
  // longer applies. (Changing the event with the filter off keeps the list.)
  useEffect(() => {
    setSelected(new Set());
  }, [sourcesKey, eventId, eventOnly]);

  const toggleContact = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const selectVisible = (on: boolean) => {
    const next = new Set(selected);
    let room = MAX_CONTACT_IDS - chosenIds.length;
    let left = 0;
    for (const r of visible) {
      if (r.block) continue;
      if (!on) next.delete(r.id);
      else if (next.has(r.id)) continue;
      else if (room > 0) {
        next.add(r.id);
        room -= 1;
      } else left += 1;
    }
    setSelected(next);
    if (left > 0) {
      toast({
        duration: 6000,
        title: i18nT("Up to {count} contacts per campaign", { count: MAX_CONTACT_IDS }),
        description: i18nT(
          "{count} more were not selected. Send this campaign, then select them for the next one.",
          { count: left },
        ),
      });
    }
  };

  /** The "Marketing messages" switch for one row: off records an opt-out by
   * number, which every campaign honours — including one already sending. */
  const setOptOut = async (row: AudienceRow, out: boolean) => {
    if (optOutBusy) return;
    setOptOutBusy(row.id);
    try {
      const res = await fetch(
        `${apiURL}/campaigns/whatsapp/opt-outs/${encodeURIComponent(row.id)}`,
        { method: "PUT", headers: authHeaders(true), body: JSON.stringify({ optedOut: out }) },
      );
      const body = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (res.ok && typeof body?.optedOut === "boolean") {
        const digits = String(body.phoneDigits || row.digits);
        setOptedOut((prev) => {
          const next = new Set(prev);
          if (body.optedOut) next.add(digits);
          else next.delete(digits);
          return next;
        });
        toast({
          duration: body.optedOut ? 5000 : 3000,
          title: body.optedOut
            ? i18nT("Marketing messages turned off")
            : i18nT("Marketing messages turned on"),
          description: body.optedOut
            ? i18nT("Campaigns already sending or paused will skip this number too.")
            : undefined,
        });
        return;
      }
      toast({
        duration: 5000,
        variant: "destructive",
        title: i18nT("That did not work"),
        description: nestMessage(body) ?? i18nT("Please try again."),
      });
    } catch {
      if (mountedRef.current) {
        toast({
          duration: 5000,
          variant: "destructive",
          title: i18nT("That did not work"),
          description: i18nT("Could not reach the server. Check your internet connection and try again."),
        });
      }
    } finally {
      if (mountedRef.current) setOptOutBusy(null);
    }
  };

  // ---- the request ------------------------------------------------------------

  const problem: string | null =
    chosenIds.length > MAX_CONTACT_IDS && !everyone
      ? i18nT("Choose up to {count} contacts per campaign.", { count: MAX_CONTACT_IDS })
      : null;

  const body = useMemo<CampaignRequest | null>(() => {
    if (!template.trim() || chosenIds.length === 0 || problem) return null;
    const req: CampaignRequest = { template, source, sources };
    if (eventId !== ALL_EVENTS) {
      req.eventId = eventId;
      req.filterByEvent = eventScoped && eventOnly;
    }
    // The ticked ids by name whenever the DTO's cap allows. `allContacts`
    // makes the server re-read the whole list at send time, so it is kept
    // for the one selection a list cannot carry: more than 1000.
    if (everyone && chosenIds.length > MAX_CONTACT_IDS) req.allContacts = true;
    else req.contactIds = chosenIds;
    if (chosenEvent?.hasImage && attachImage) req.attachEventImage = true;
    return req;
  }, [template, chosenIds, everyone, problem, source, sources, eventScoped, eventOnly, eventId, chosenEvent, attachImage]);

  const bodyKey = body ? JSON.stringify(body) : null;

  // ---- preview ------------------------------------------------------------------

  const runPreview = useCallback(
    async (req: CampaignRequest, key: string) => {
      previewAbortRef.current?.abort();
      const controller = new AbortController();
      previewAbortRef.current = controller;
      const seq = ++previewSeqRef.current;
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res = await fetch(`${apiURL}/campaigns/whatsapp/preview`, {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify(req),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (!mountedRef.current || seq !== previewSeqRef.current) return;
        if (res.ok && isPreview(data)) {
          setPreview(data);
          setPreviewKey(key);
          setSampleIndex(0);
          setConnected(data.connected === true);
        } else {
          setPreview(null);
          setPreviewKey(null);
          setPreviewError(
            nestMessage(data) ?? i18nT("The preview could not be loaded. Try again in a moment."),
          );
        }
      } catch {
        if (controller.signal.aborted) return;
        if (!mountedRef.current || seq !== previewSeqRef.current) return;
        setPreviewError(
          i18nT("Could not reach the server. Check your internet connection and try again."),
        );
      } finally {
        if (mountedRef.current && seq === previewSeqRef.current) setPreviewLoading(false);
      }
    },
    [mountedRef],
  );

  const bodyRef = useRef(body);
  bodyRef.current = body;
  useEffect(() => {
    if (!bodyKey) {
      previewAbortRef.current?.abort();
      previewSeqRef.current += 1;
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }
    const id = window.setTimeout(() => {
      if (bodyRef.current) void runPreview(bodyRef.current, bodyKey);
    }, PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [bodyKey, runPreview]);

  const fresh = !!preview && previewKey === bodyKey && !previewLoading;
  const unknownHere = useMemo(() => validate(template).unknown, [template]);
  const unknown = useMemo(() => {
    const all = [...unknownHere];
    if (fresh) {
      for (const k of preview?.unknownPlaceholders ?? []) {
        if (!all.includes(k)) all.push(k);
      }
    }
    return all;
  }, [unknownHere, fresh, preview]);

  const samples = preview?.samples ?? [];
  const sample = samples[Math.min(sampleIndex, Math.max(0, samples.length - 1))] ?? null;

  const canSend =
    !manualMode &&
    connected === true &&
    fresh &&
    (preview?.willSend ?? 0) > 0 &&
    (preview?.willSend ?? 0) <= MAX_SENDABLE &&
    unknown.length === 0 &&
    !starting;

  // ---- send -----------------------------------------------------------------------

  const start = async () => {
    const req = body;
    const key = bodyKey;
    if (!req || !key || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
      const res = await fetch(`${apiURL}/campaigns/whatsapp`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(req),
      });
      const data = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (res.ok && isSummary(data)) {
        toast({ duration: 3000, title: i18nT("Campaign started") });
        setSelected(new Set());
        setPreview(null);
        setPreviewKey(null);
        setActive(isInFlight(data.status) ? data : null);
        onOpenRun(data.id);
        return;
      }
      toast({
        duration: 6000,
        variant: "destructive",
        title: i18nT("Campaign not started"),
        description: nestMessage(data) ?? i18nT("Please try again."),
      });
      void runPreview(req, key);
    } catch {
      if (mountedRef.current) {
        toast({
          duration: 5000,
          variant: "destructive",
          title: i18nT("Campaign not started"),
          description: i18nT("Could not reach the server. Check your internet connection and try again."),
        });
      }
    } finally {
      startingRef.current = false;
      if (mountedRef.current) {
        setStarting(false);
        setConfirmOpen(false);
      }
    }
  };

  // ---- hand-sent fallback -----------------------------------------------------

  /** The same text the server would send, rendered here for one contact, as
   * a wa.me link. Event values come from the chosen event; an organizer-wide
   * message has only the contact's event title to offer. */
  const handReady = manualMode && template.trim() !== "" && unknownHere.length === 0;
  const waLink = (row: AudienceRow): string | null => {
    if (!handReady || row.block) return null;
    const digits = waDigits(row.phone, null);
    if (!digits) return null;
    const name = campaignName([row.name], row.email);
    const vars: CampaignVars = {
      organizer_name: organizer.name ?? "",
      event: chosenEvent?.title ?? row.eventTitle ?? "",
      event_date: chosenEvent?.startDate
        ? new Date(chosenEvent.startDate).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "",
      event_venue: "",
      event_link: "",
      name,
      first_name: firstNameOf(name),
    };
    const text = render(template, vars, row.id);
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  };

  // ---- message editing ----------------------------------------------------------

  const insertPlaceholder = (key: string) => {
    const token = `{{${key}}}`;
    const el = textareaRef.current;
    const start = el?.selectionStart ?? template.length;
    const end = el?.selectionEnd ?? start;
    const next = template.slice(0, start) + token + template.slice(end);
    if (next.length > TEMPLATE_MAX) return;
    setTemplate(next);
    window.requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="space-y-5">
      {active && (
        <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            {isInFlight(active.status) && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
            {isInFlight(active.status)
              ? i18nT("A campaign is sending right now.")
              : i18nT("A campaign is paused.")}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenRun(active.id)}>
            {i18nT("View progress")}
          </Button>
        </div>
      )}

      {manualMode && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">
              {i18nT("Link your WhatsApp in Settings › Profile › WhatsApp to send campaigns automatically.")}
            </p>
            <p className="text-xs">
              {i18nT(
                "Until then, each contact below has an Open in WhatsApp button with their message already written, to send from your phone one by one.",
              )}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ------------------------------ compose ------------------------------ */}
        <div className="min-w-0 space-y-6">
          {/* Audience */}
          <section className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Label>{i18nT("Send to")}</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() =>
                    setGroups(allGroupsOn ? new Set() : new Set(GROUPS.map((g) => g.key)))
                  }
                >
                  {allGroupsOn ? i18nT("Clear all") : i18nT("Everyone")}
                </button>
              </div>
              {/* One group or several: each chip toggles on its own. */}
              <div className="flex flex-wrap gap-2" role="group" aria-label={i18nT("Send to")}>
                {GROUPS.map((g) => {
                  const on = groups.has(g.key);
                  return (
                    <button
                      key={g.key}
                      type="button"
                      aria-pressed={on}
                      title={i18nT(g.hint)}
                      onClick={() => toggleGroup(g.key)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                      {i18nT(g.label)}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {i18nT(
                  "Tick one group or several. Visitors is the same list as My Users → Visitors: ticket buyers, round-table, workshop and scheduled-space bookers, RSVP guests and the customers you added by hand (CRM).",
                )}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{i18nT("Event")}</Label>
                <Select value={eventId} onValueChange={setEventId} disabled={!events}>
                  <SelectTrigger aria-label={i18nT("Event")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_EVENTS}>{i18nT("All events")}</SelectItem>
                    {(events ?? []).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title || i18nT("Untitled event")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {eventChosen ? (
                  <>
                    <label className="flex cursor-pointer items-start gap-2 pt-1 text-xs text-foreground">
                      <Checkbox
                        checked={eventOnly}
                        onCheckedChange={(v) => setEventOnly(v === true)}
                        disabled={!eventScoped}
                        className="mt-0.5"
                      />
                      <span>{i18nT("Only people who booked this event")}</span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {eventOnly && eventScoped
                        ? i18nT(
                            "Just this event's bookers. Suppliers, Members and CRM contacts have no bookings on an event, so they are left out.",
                          )
                        : i18nT(
                            "Everyone in the ticked groups stays listed; the event fills {{event}} details and the image.",
                          )}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {i18nT("Pick an event to fill {{event}} details, or to limit the list to its bookers.")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor="wa-campaign-search" className="text-sm font-medium">
                {i18nT("Contacts")}
              </Label>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {i18nT("{selected} of {total} selected", {
                  selected: chosenIds.length,
                  total: selectableIds.length,
                })}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="wa-campaign-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={i18nT("Search by name, number or event")}
                  className="pl-8"
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-10 flex-1 sm:flex-none" onClick={() => selectVisible(true)}>
                  {i18nT("Select all")}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-10 flex-1 sm:flex-none" onClick={() => selectVisible(false)}>
                  {i18nT("Select none")}
                </Button>
              </div>
            </div>

            {contacts === null ? (
              <p className="flex items-center gap-2 rounded-md border border-border px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {i18nT("Loading contacts…")}
              </p>
            ) : contactsError ? (
              <div className="flex items-start gap-2 rounded-md border border-border px-3 py-6 text-sm text-red-600 dark:text-red-400" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">{contactsError}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setContactsRetry((n) => n + 1)}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {i18nT("Retry")}
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <p className="rounded-md border border-border px-3 py-6 text-center text-sm text-muted-foreground">
                {groups.size === 0
                  ? i18nT("Tick at least one group above.")
                  : i18nT("No contacts here yet. People appear as they buy tickets, book or register with you.")}
              </p>
            ) : (
              <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {visible.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {i18nT("No contacts match your search.")}
                  </li>
                )}
                {visible.map((row) => {
                  const link = waLink(row);
                  const boxId = `wa-campaign-c-${row.id}`;
                  const canOptOut = !!row.digits;
                  return (
                    <li key={row.id} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        id={boxId}
                        checked={!row.block && selected.has(row.id)}
                        disabled={!!row.block}
                        onCheckedChange={(v) => toggleContact(row.id, v === true)}
                      />
                      <label
                        htmlFor={boxId}
                        className={`min-w-0 flex-1 ${row.block ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                      >
                        <span className="block truncate text-sm font-medium text-foreground">
                          {row.name || row.email || i18nT("Contact")}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[row.phone, sources.length > 1 ? i18nT(SOURCE_LABEL[row.source]) : null, row.eventTitle]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </label>
                      {row.block && (
                        <Badge
                          variant="outline"
                          className={`shrink-0 ${row.block === "Opted out" ? BADGE_CLASS.amber : BADGE_CLASS.neutral}`}
                        >
                          {i18nT(row.block)}
                        </Badge>
                      )}
                      {canOptOut && (
                        <button
                          type="button"
                          className={`shrink-0 rounded-md border px-2 py-1 text-xs ${
                            row.block === "Opted out"
                              ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
                              : "border-border text-muted-foreground hover:bg-muted/50"
                          }`}
                          disabled={optOutBusy !== null}
                          title={
                            row.block === "Opted out"
                              ? i18nT("Allow marketing messages again")
                              : i18nT("Stop marketing messages to this number")
                          }
                          onClick={() => void setOptOut(row, row.block !== "Opted out")}
                        >
                          {optOutBusy === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <BellOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-green-200 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
                        >
                          <FaWhatsapp className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{i18nT("Open in WhatsApp")}</span>
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {contactsTruncated && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {i18nT("This list is very large, so only the most recent contacts are shown. Narrow it down to one event.")}
              </p>
            )}
          </section>

          {/* Message */}
          <section className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor="wa-campaign-message" className="text-sm font-medium">
                {i18nT("Message")}
              </Label>
              <span
                className={`text-xs ${
                  template.length >= TEMPLATE_MAX ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                }`}
              >
                {template.length} / {TEMPLATE_MAX}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {KNOWN_PLACEHOLDERS.map((p) => (
                <Button
                  key={p.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => insertPlaceholder(p.key)}
                >
                  <Plus className="h-3 w-3" />
                  {i18nT(p.label)}
                </Button>
              ))}
            </div>
            <Textarea
              id="wa-campaign-message"
              ref={textareaRef}
              rows={6}
              maxLength={TEMPLATE_MAX}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              // No `vars` here: t() would rewrite the `{…}` inside `{{…}}`.
              placeholder={i18nT("Hi {{first_name}}, {{event}} is on {{event_date}}! Details: {{event_link}}")}
              className="resize-y"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {i18nT("Fallback when a name is missing:")}{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">{"{{name|there}}"}</code>
              {" · "}
              {i18nT("Vary the wording:")}{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">{"{Hi|Hello|Hey}"}</code>
            </p>
            {chosenEvent?.hasImage && attachImage && (
              <p className="text-xs text-muted-foreground">
                {i18nT("With an image attached, WhatsApp allows up to {count} characters per message.", {
                  count: CAPTION_MAX,
                })}
              </p>
            )}
            {unknown.length > 0 && (
              <p role="alert" className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {i18nT("Your message uses unknown placeholders:")}{" "}
                  <span className="font-mono">{unknown.map((k) => `{{${k}}}`).join(", ")}</span>
                  {" — "}
                  {i18nT("Fix or remove them before sending.")}
                </span>
              </p>
            )}
          </section>

          {/* Event image */}
          {chosenEvent && (
            <section className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  {/* Thumbnail of the exact file that will be attached (sent
                      as a JPEG photo, whatever format it was uploaded in). */}
                  {chosenEvent.hasImage && eventImageUrl(chosenEvent.image) && (
                    <img
                      src={eventImageUrl(chosenEvent.image) ?? undefined}
                      alt=""
                      className="h-16 w-24 shrink-0 rounded-md border border-border object-cover"
                    />
                  )}
                  <div className="min-w-0 space-y-0.5">
                    <Label htmlFor="wa-campaign-image" className="cursor-pointer">
                      {i18nT("Attach the event image")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {chosenEvent.hasImage
                        ? i18nT("The event's banner goes out with the message as a photo.")
                        : i18nT("This event has no image. Add one in the event's Media tab.")}
                    </p>
                  </div>
                </div>
                <Switch
                  id="wa-campaign-image"
                  checked={attachImage && chosenEvent.hasImage}
                  disabled={!chosenEvent.hasImage}
                  onCheckedChange={setAttachImage}
                />
              </div>
            </section>
          )}
        </div>

        {/* ------------------------------ preview ------------------------------ */}
        <div className="min-w-0 space-y-4 self-start lg:sticky lg:top-4">
          <section
            className={`space-y-4 rounded-lg border border-border bg-muted/30 p-4 ${preview && !fresh ? "opacity-70" : ""}`}
            aria-busy={previewLoading}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{i18nT("Preview")}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!body || previewLoading}
                onClick={() => body && bodyKey && void runPreview(body, bodyKey)}
              >
                {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {i18nT("Refresh")}
              </Button>
            </div>

            {!body ? (
              <p className="text-sm text-muted-foreground">
                {problem ??
                  i18nT("Write a message and choose contacts to see exactly what each one will receive.")}
              </p>
            ) : previewError && !preview ? (
              <p className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {previewError}
              </p>
            ) : !preview ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {i18nT("Preparing the preview…")}
              </p>
            ) : (
              <>
                {previewError && (
                  <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                    {previewError}
                  </p>
                )}

                {sample ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 text-sm">
                        <span className="text-muted-foreground">
                          {i18nT("Contact {current} of {total}", {
                            current: Math.min(sampleIndex, samples.length - 1) + 1,
                            total: samples.length,
                          })}
                        </span>
                        <span className="block truncate font-medium text-foreground">
                          {sample.name || i18nT("Contact")}{" "}
                          <span className="font-normal text-muted-foreground">{sample.phone}</span>
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={i18nT("Previous contact")}
                          disabled={sampleIndex <= 0}
                          onClick={() => setSampleIndex((i) => Math.max(0, i - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={i18nT("Next contact")}
                          disabled={sampleIndex >= samples.length - 1}
                          onClick={() => setSampleIndex((i) => Math.min(samples.length - 1, i + 1))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {/* A WhatsApp-like chat: the wallpaper and the outgoing
                        bubble in WhatsApp's own light and dark colours. */}
                    <div className="rounded-lg bg-[#efeae2] p-3 dark:bg-[#0b141a]">
                      <div className="ml-auto w-fit max-w-[90%] rounded-lg rounded-tr-none bg-[#d9fdd3] p-2 text-sm text-neutral-900 shadow-sm dark:bg-[#005c4b] dark:text-neutral-50">
                        {preview.hasImage &&
                          (eventImageUrl(chosenEvent?.image) ? (
                            <img
                              src={eventImageUrl(chosenEvent?.image) ?? undefined}
                              alt=""
                              className="mb-2 max-h-48 w-full rounded-md object-cover"
                            />
                          ) : (
                            <p className="mb-2 rounded bg-black/10 px-2 py-1 text-xs">
                              {i18nT("[event image]")}
                            </p>
                          ))}
                        <p className="whitespace-pre-wrap break-words">{sample.text}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {i18nT("Nobody in this selection can receive a WhatsApp message.")}
                  </p>
                )}

                <div className="space-y-1 text-sm">
                  <p className="font-medium text-foreground">
                    {i18nT("{count} will receive this", { count: preview.willSend })}
                  </p>
                  {preview.willSkip > 0 && (
                    <>
                      <p className="text-muted-foreground">
                        {i18nT("{count} will be skipped", { count: preview.willSkip })}
                      </p>
                      <ul className="space-y-0.5 pl-3 text-xs text-muted-foreground">
                        {Object.entries(preview.skipped ?? {})
                          .filter(([, n]) => Number(n) > 0)
                          .map(([reason, n]) => (
                            <li key={reason}>
                              {apiText(reason)}: {n}
                            </li>
                          ))}
                      </ul>
                    </>
                  )}
                </div>

                {preview.willSend > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {i18nT("Takes about {minutes} min", {
                      minutes: Math.max(1, Math.ceil(preview.estimatedMinutes || 0)),
                    })}
                    {" · "}
                    {i18nT("{count} messages left today", { count: preview.dailyRemaining })}
                  </p>
                )}
                {preview.willSend > preview.dailyRemaining && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {i18nT(
                      "Only {count} can go out today. The campaign pauses at the daily limit — resume it tomorrow for the rest.",
                      { count: preview.dailyRemaining },
                    )}
                  </p>
                )}
                {(preview.warnings ?? []).map((w) => (
                  <p key={w} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {apiText(w)}
                  </p>
                ))}
              </>
            )}
          </section>

          <div className="space-y-2">
            <Button type="button" className="w-full" disabled={!canSend} onClick={() => setConfirmOpen(true)}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {fresh && preview && preview.willSend > 0
                ? i18nT("Send to {count} contacts", { count: preview.willSend })
                : i18nT("Send campaign")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {manualMode
                ? i18nT("Sending needs a linked WhatsApp. Use the Open in WhatsApp buttons to send by hand.")
                : i18nT("Messages go out one at a time, a few seconds apart, from your linked WhatsApp.")}
            </p>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !starting && setConfirmOpen(o)}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {i18nT("Send to {count} contacts?", { count: preview?.willSend ?? 0 })}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="font-medium text-amber-700 dark:text-amber-300">
                  {i18nT(
                    "WhatsApp may block numbers that send unwanted bulk messages. Only message people who expect to hear from you.",
                  )}
                </p>
                <p>
                  {i18nT(
                    "Messages go out one at a time, a few seconds apart, so this takes about {minutes} min. You can stop it at any time.",
                    { minutes: Math.max(1, Math.ceil(preview?.estimatedMinutes || 0)) },
                  )}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={starting}>{i18nT("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={starting}
              className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
              onClick={(e) => {
                // Kept open until the server answers, so a second click
                // cannot start a second campaign.
                e.preventDefault();
                void start();
              }}
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {i18nT("Send now")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
