import { useCallback, useEffect, useRef, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import {
  AlertCircle,
  Check,
  Copy,
  Link2,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PhoneField from "@/components/ui/PhoneField";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { t } from "@/i18n/t";
import { isLikelyPhone, phoneDigits } from "@/lib/phone";

const apiURL = __API_URL__;

/** Mirrors EventAgentView in backend/src/modules/event-agents. */
export type EventAgentView = {
  id: string;
  name: string;
  whatsAppNumber: string;
  email: string;
  referralCode: string;
  /** 0 = unlimited. */
  maxUses: number;
  usedCount: number;
  remaining: number | null;
  isActive: boolean;
  lastUsedAt: string | null;
  lastSharedAt: string | null;
  shareCount: number;
  shareLink: string;
  createdAt: string | null;
};

/** An agent typed while the event does not exist yet (create mode). The
 * form creates them, and their codes, right after the event is saved. */
export type QueuedEventAgent = {
  name: string;
  whatsAppNumber: string;
  email: string;
  maxUses: number;
};

type Draft = { name: string; whatsAppNumber: string; email: string; maxUses: string };

const EMPTY_DRAFT: Draft = { name: "", whatsAppNumber: "", email: "", maxUses: "" };

function authHeaders(json = false): Record<string, string> {
  const token = sessionStorage.getItem("token");
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** The human sentence out of a Nest error body (string or array). */
function nestMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { message?: unknown }).message;
  const parts = (Array.isArray(raw) ? raw : [raw]).filter(
    (p): p is string => typeof p === "string" && p.trim() !== "",
  );
  return parts.length ? parts.join(" · ") : null;
}

function isAgent(body: unknown): body is EventAgentView {
  if (!body || typeof body !== "object") return false;
  const b = body as Partial<EventAgentView>;
  return typeof b.id === "string" && typeof b.referralCode === "string";
}

/** wa.me digits for the "send from my phone" fallback. */
function waDigits(phone: string): string | null {
  const digits = phoneDigits(phone);
  return isLikelyPhone(digits) ? digits : null;
}

/** Validate a draft the way the API will, so the form says so first. */
function draftProblem(d: Draft): string | null {
  if (!d.name.trim()) return t("Enter the agent's name.");
  const wa = d.whatsAppNumber.trim();
  const email = d.email.trim();
  if (!wa && !email) return t("Add a WhatsApp number or an email address, so the link can be sent to the agent.");
  if (wa && !isLikelyPhone(wa)) {
    return t("Enter the WhatsApp number with its country code, e.g. +91 98765 43210.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t("Enter a valid email address.");
  const max = d.maxUses.trim();
  if (max && (!/^\d+$/.test(max) || Number(max) > 1_000_000)) {
    return t("Max uses must be a whole number (0 = unlimited).");
  }
  return null;
}

/** POST the agents queued while the event was being created. Used by the
 * event form right after a successful create. Never throws. */
export async function createQueuedEventAgents(
  eventId: string,
  queued: QueuedEventAgent[],
): Promise<{ created: number; failed: number }> {
  let created = 0;
  let failed = 0;
  for (const q of queued) {
    try {
      const res = await fetch(`${apiURL}/events/${encodeURIComponent(eventId)}/agents`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          name: q.name,
          whatsAppNumber: q.whatsAppNumber || undefined,
          email: q.email || undefined,
          maxUses: q.maxUses || 0,
        }),
      });
      if (res.ok) created += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { created, failed };
}

/**
 * The event form's Agents tab.
 *
 * An agent is a promoter the organizer enlists for ONE event. Adding one
 * generates a referral code; the organizer sends the agent the event link
 * carrying it (WhatsApp, email, or from their own phone), and every booking
 * made through that link is credited to the agent in Participants. Each
 * code can be capped at a number of bookings.
 *
 * Agents live in their own collection, so in edit mode this tab talks to the
 * API directly (the event's own Save button does not touch them). While the
 * event is still being created there is no event to attach them to, so they
 * are queued here and created — with their codes — right after the event is
 * saved (see createQueuedEventAgents).
 */
export function EventAgentsTab({
  eventId,
  onQueueChange,
}: {
  /** The saved event's id; null/undefined while it is being created. */
  eventId?: string | null;
  /** Create mode: the queued agents, every time they change. */
  onQueueChange?: (queued: QueuedEventAgent[]) => void;
}) {
  const { toast } = useToast();
  const live = !!eventId;

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [agents, setAgents] = useState<EventAgentView[] | null>(live ? null : []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [queued, setQueued] = useState<QueuedEventAgent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "regenerate"; agent: EventAgentView } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [maxDraft, setMaxDraft] = useState<Record<string, string>>({});

  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onQueueChange?.(queued);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued]);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`${apiURL}/events/${encodeURIComponent(eventId)}/agents`, {
        headers: authHeaders(),
      });
      const body = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (res.ok && Array.isArray(body)) {
        setAgents(body.filter(isAgent));
        setLoadError(null);
      } else {
        setAgents([]);
        setLoadError(nestMessage(body) ?? t("Agents could not be loaded. Try again in a moment."));
      }
    } catch {
      if (mountedRef.current) {
        setAgents([]);
        setLoadError(t("Could not reach the server. Check your internet connection and try again."));
      }
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const failToast = (title: string, body: unknown) =>
    toast({
      duration: 5000,
      variant: "destructive",
      title,
      description: nestMessage(body) ?? t("Please try again."),
    });

  // ---- add -------------------------------------------------------------

  const add = async () => {
    const problem = draftProblem(draft);
    if (problem) {
      toast({ duration: 5000, variant: "destructive", title: t("Check the agent details"), description: problem });
      return;
    }
    const payload: QueuedEventAgent = {
      name: draft.name.trim(),
      whatsAppNumber: draft.whatsAppNumber.trim(),
      email: draft.email.trim().toLowerCase(),
      maxUses: Number(draft.maxUses.trim() || 0),
    };
    if (!live) {
      setQueued((q) => [...q, payload]);
      setDraft(EMPTY_DRAFT);
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`${apiURL}/events/${encodeURIComponent(eventId!)}/agents`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          name: payload.name,
          whatsAppNumber: payload.whatsAppNumber || undefined,
          email: payload.email || undefined,
          maxUses: payload.maxUses,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (res.ok && isAgent(body)) {
        setAgents((prev) => [body, ...(prev ?? [])]);
        setDraft(EMPTY_DRAFT);
        toast({
          duration: 5000,
          title: t("Agent added"),
          description: t("Referral code {code}. Use Share to send them the link.", { code: body.referralCode }),
        });
      } else {
        failToast(t("Agent not added"), body);
      }
    } catch {
      if (mountedRef.current) failToast(t("Agent not added"), null);
    } finally {
      if (mountedRef.current) setAdding(false);
    }
  };

  // ---- per-agent actions ------------------------------------------------

  const patch = async (agent: EventAgentView, changes: Partial<Pick<EventAgentView, "maxUses" | "isActive">>) => {
    if (!eventId || busy) return;
    setBusy(agent.id);
    try {
      const res = await fetch(
        `${apiURL}/events/${encodeURIComponent(eventId)}/agents/${encodeURIComponent(agent.id)}`,
        { method: "PATCH", headers: authHeaders(true), body: JSON.stringify(changes) },
      );
      const body = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (res.ok && isAgent(body)) {
        setAgents((prev) => (prev ?? []).map((a) => (a.id === body.id ? body : a)));
      } else {
        failToast(t("That did not work"), body);
        void load();
      }
    } catch {
      if (mountedRef.current) failToast(t("That did not work"), null);
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const share = async (agent: EventAgentView, channel: "whatsapp" | "email") => {
    if (!eventId || busy) return;
    setBusy(agent.id);
    try {
      const res = await fetch(
        `${apiURL}/events/${encodeURIComponent(eventId)}/agents/${encodeURIComponent(agent.id)}/share`,
        { method: "POST", headers: authHeaders(true), body: JSON.stringify({ channel }) },
      );
      const body = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (!res.ok) {
        failToast(t("Link not sent"), body);
        return;
      }
      const status = channel === "whatsapp" ? body?.whatsapp : body?.email;
      if (status === "sent") {
        toast({
          duration: 4000,
          title: channel === "whatsapp" ? t("Sent on WhatsApp") : t("Sent by email"),
          description: t("{name} has the link with code {code}.", { name: agent.name, code: agent.referralCode }),
        });
        void load();
      } else {
        toast({
          duration: 7000,
          variant: "destructive",
          title: t("Link not sent"),
          description:
            channel === "whatsapp"
              ? t("WhatsApp is not connected. Link your number in Settings › Profile › WhatsApp, or use Open in WhatsApp to send it from your phone.")
              : t("The email could not be sent. Check the address and your email settings."),
        });
      }
    } catch {
      if (mountedRef.current) failToast(t("Link not sent"), null);
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const regenerate = async (agent: EventAgentView) => {
    if (!eventId) return;
    setBusy(agent.id);
    try {
      const res = await fetch(
        `${apiURL}/events/${encodeURIComponent(eventId)}/agents/${encodeURIComponent(agent.id)}/regenerate-code`,
        { method: "POST", headers: authHeaders() },
      );
      const body = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (res.ok && isAgent(body)) {
        setAgents((prev) => (prev ?? []).map((a) => (a.id === body.id ? body : a)));
        toast({ duration: 5000, title: t("New code issued"), description: t("The old link no longer counts. Share the new one.") });
      } else {
        failToast(t("That did not work"), body);
      }
    } catch {
      if (mountedRef.current) failToast(t("That did not work"), null);
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const remove = async (agent: EventAgentView) => {
    if (!eventId) return;
    setBusy(agent.id);
    try {
      const res = await fetch(
        `${apiURL}/events/${encodeURIComponent(eventId)}/agents/${encodeURIComponent(agent.id)}`,
        { method: "DELETE", headers: authHeaders() },
      );
      const body = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (res.ok) {
        setAgents((prev) => (prev ?? []).filter((a) => a.id !== agent.id));
        toast({ duration: 3000, title: t("Agent removed") });
      } else {
        failToast(t("That did not work"), body);
      }
    } catch {
      if (mountedRef.current) failToast(t("That did not work"), null);
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      window.prompt(t("Copy this"), text);
    }
  };

  const phoneMessage = (agent: EventAgentView) =>
    `Hi ${agent.name}! You're an agent for our event. Share this link — every booking made through it is credited to you:\n${agent.shareLink}\nYour referral code: ${agent.referralCode}` +
    (agent.maxUses > 0 ? `\nThis code can be used for up to ${agent.maxUses} bookings.` : "");

  // ---- render ----------------------------------------------------------------

  const usage = (a: EventAgentView) =>
    a.maxUses > 0
      ? t("{used} of {max} uses", { used: a.usedCount, max: a.maxUses })
      : t("{used} uses · unlimited", { used: a.usedCount });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          {t("Agents")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t(
            "Add the people promoting this event. Each agent gets a referral code; share the event link with them and every booking made through it is credited to them in Participants. Set how many bookings a code may be used for, or leave it unlimited.",
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add form */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="agent-name">{t("Agent name")} *</Label>
              <Input
                id="agent-name"
                value={draft.name}
                maxLength={80}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder={t("e.g. Priya Sharma")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-whatsapp">{t("WhatsApp number")}</Label>
              <PhoneField
                id="agent-whatsapp"
                format="e164"
                value={draft.whatsAppNumber}
                onChange={(val) => setDraft((d) => ({ ...d, whatsAppNumber: val }))}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-email">{t("Gmail / email")}</Label>
              <Input
                id="agent-email"
                type="email"
                value={draft.email}
                maxLength={120}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                placeholder="agent@gmail.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-max">{t("Max uses of the referral code")}</Label>
              <Input
                id="agent-max"
                type="number"
                min={0}
                value={draft.maxUses}
                onChange={(e) => setDraft((d) => ({ ...d, maxUses: e.target.value }))}
                placeholder={t("Leave empty for unlimited")}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void add()} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("Add agent")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {live
                ? t("The referral code is generated as soon as the agent is added.")
                : t("Agents are created, and get their referral codes, when you save the event.")}
            </span>
          </div>
        </div>

        {/* Create mode: the queue */}
        {!live && queued.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {queued.map((q, i) => (
              <li key={`${q.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{q.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[q.whatsAppNumber, q.email].filter(Boolean).join(" · ")}
                    {" · "}
                    {q.maxUses > 0 ? t("{max} uses", { max: q.maxUses }) : t("unlimited uses")}
                  </p>
                </div>
                <Badge variant="outline">{t("Code on save")}</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 dark:text-red-400"
                  onClick={() => setQueued((list) => list.filter((_, j) => j !== i))}
                  aria-label={t("Remove")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* Edit mode: the list */}
        {live && agents === null && !loadError && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("Loading agents…")}
          </p>
        )}
        {live && loadError && (
          <div className="flex flex-col items-start gap-2 text-sm text-red-600 dark:text-red-400" role="alert">
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {loadError}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              {t("Try Again")}
            </Button>
          </div>
        )}
        {live && agents && agents.length === 0 && !loadError && (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            {t("No agents yet. Add one above to get a referral code you can share.")}
          </p>
        )}
        {live && agents && agents.length > 0 && (
          <ul className="space-y-3">
            {agents.map((a) => {
              const digits = a.whatsAppNumber ? waDigits(a.whatsAppNumber) : null;
              const exhausted = a.maxUses > 0 && a.usedCount >= a.maxUses;
              const rowBusy = busy === a.id;
              return (
                <li key={a.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{a.name}</p>
                        {!a.isActive && <Badge variant="outline">{t("Paused")}</Badge>}
                        {exhausted && (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            {t("Limit reached")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[a.whatsAppNumber, a.email].filter(Boolean).join(" · ") || t("No contact details")}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs text-muted-foreground">{t("Referral code")}</span>
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm tracking-wider">
                          {a.referralCode}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => void copy(`code-${a.id}`, a.referralCode)}
                          aria-label={t("Copy code")}
                        >
                          {copied === `code-${a.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs font-medium">{usage(a)}</span>
                        {a.lastSharedAt && (
                          <span className="text-xs text-muted-foreground">
                            · {t("shared {count}×", { count: a.shareCount })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-2 lg:items-end">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`agent-max-${a.id}`} className="text-xs text-muted-foreground">
                          {t("Max uses")}
                        </Label>
                        <Input
                          id={`agent-max-${a.id}`}
                          type="number"
                          min={0}
                          className="h-8 w-24"
                          value={maxDraft[a.id] ?? String(a.maxUses)}
                          disabled={rowBusy}
                          onChange={(e) => setMaxDraft((m) => ({ ...m, [a.id]: e.target.value }))}
                          onBlur={() => {
                            const raw = (maxDraft[a.id] ?? String(a.maxUses)).trim();
                            const next = raw === "" ? 0 : Number(raw);
                            setMaxDraft((m) => {
                              const { [a.id]: _drop, ...rest } = m;
                              return rest;
                            });
                            if (!Number.isInteger(next) || next < 0 || next === a.maxUses) return;
                            void patch(a, { maxUses: next });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                        <span className="text-xs text-muted-foreground">{t("0 = unlimited")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`agent-active-${a.id}`} className="text-xs text-muted-foreground">
                          {t("Credit bookings")}
                        </Label>
                        <Switch
                          id={`agent-active-${a.id}`}
                          checked={a.isActive}
                          disabled={rowBusy}
                          onCheckedChange={(on) => void patch(a, { isActive: on })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {a.whatsAppNumber && (
                      <Button type="button" variant="outline" size="sm" disabled={rowBusy} onClick={() => void share(a, "whatsapp")}>
                        {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FaWhatsapp className="h-4 w-4 text-green-600" />}
                        {t("Send on WhatsApp")}
                      </Button>
                    )}
                    {a.email && (
                      <Button type="button" variant="outline" size="sm" disabled={rowBusy} onClick={() => void share(a, "email")}>
                        <Mail className="h-4 w-4" />
                        {t("Send by email")}
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => void copy(`link-${a.id}`, a.shareLink)}>
                      {copied === `link-${a.id}` ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                      {t("Copy link")}
                    </Button>
                    {digits && (
                      <a
                        href={`https://wa.me/${digits}?text=${encodeURIComponent(phoneMessage(a))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-green-200 px-3 text-sm font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
                        title={t("Send the link from your own phone")}
                      >
                        <Send className="h-4 w-4" />
                        {t("Open in WhatsApp")}
                      </a>
                    )}
                    <span className="flex-1" />
                    <Button type="button" variant="ghost" size="sm" disabled={rowBusy} onClick={() => setConfirm({ kind: "regenerate", agent: a })}>
                      <RefreshCw className="h-4 w-4" />
                      {t("New code")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 dark:text-red-400"
                      disabled={rowBusy}
                      onClick={() => setConfirm({ kind: "delete", agent: a })}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("Remove")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "delete"
                ? t("Remove {name}?", { name: confirm?.agent.name ?? "" })
                : t("Issue a new code for {name}?", { name: confirm?.agent.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete"
                ? t("Their link stops being credited. Bookings already credited to them stay in Participants.")
                : t("Links carrying the old code stop being credited. You will need to share the new link.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={confirm?.kind === "delete" ? "bg-red-600 text-white hover:bg-red-700" : undefined}
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                if (!c) return;
                if (c.kind === "delete") void remove(c.agent);
                else void regenerate(c.agent);
              }}
            >
              {confirm?.kind === "delete" ? t("Remove") : t("New code")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
