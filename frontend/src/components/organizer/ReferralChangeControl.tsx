import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/i18n/t";
import type { AgentOption } from "@/lib/participants";

const apiURL = __API_URL__;

/** What the server hands back after a reassignment; merge it into the booking. */
export interface ReferralPatch {
  referralCode: string;
  referralAgentId: string;
  referralAgentName: string;
  referralOperatorId: string;
  referralOperatorName: string;
  statusHistory?: any[];
  referralHistory?: any[];
}

export type ReferralBookingKind =
  | "ticket"
  | "stall"
  | "speaker"
  | "roundTable"
  | "scheduledSpace"
  | "workshop";

/**
 * "Change" link + dialog for moving a booking's referral to another agent of
 * the same event (or to none). The server logs who did it on the booking's
 * timeline - organizer-side only, the visitor never sees it - and takes the
 * name from the signed-in user's token.
 */
export function ReferralChangeControl({
  eventId,
  kind,
  bookingId,
  currentAgentId,
  onChanged,
}: {
  eventId: string;
  kind: ReferralBookingKind;
  bookingId: string;
  /** The agent the booking is credited to now, if any. */
  currentAgentId?: string | null;
  onChanged: (patch: ReferralPatch) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AgentOption[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [choice, setChoice] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const authHeaders = (json = false): Record<string, string> => {
    const token = sessionStorage.getItem("token");
    return {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Load the event's agents each time the dialog opens.
  useEffect(() => {
    if (!open || !eventId) return;
    let cancelled = false;
    setAgents(null);
    setLoadError(false);
    setChoice("");
    fetch(`${apiURL}/events/${encodeURIComponent(eventId)}/agents`, {
      headers: authHeaders(),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((j) => {
        if (cancelled) return;
        const list: any[] = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
        setAgents(
          list.map((a) => ({
            id: String(a.id ?? a._id),
            name: String(a.name || "Agent"),
            code: String(a.referralCode || ""),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setAgents([]);
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  const save = async () => {
    if (!choice) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${apiURL}/events/${encodeURIComponent(eventId)}/agents/reassign`,
        {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({
            kind,
            bookingId,
            agentId: choice === "direct" ? null : choice,
          }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Couldn't change the referral");
      onChanged(body.data as ReferralPatch);
      toast({ title: t("Referral updated") });
      setOpen(false);
    } catch (e: any) {
      toast({
        title: t("Couldn't change the referral"),
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const options = (agents || []).filter((a) => a.id !== String(currentAgentId || ""));

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        onClick={() => setOpen(true)}
      >
        {t("Change")}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Change referral")}</DialogTitle>
            <DialogDescription>
              {t(
                "Credit this booking to a different agent. The change is recorded on the timeline with your name. Only you and your team see it - the person who booked is not told.",
              )}
            </DialogDescription>
          </DialogHeader>
          {agents === null ? (
            <div className="py-6 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : loadError ? (
            <p className="text-sm text-red-500">{t("Couldn't load this event's agents.")}</p>
          ) : (
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger>
                <SelectValue placeholder={t("Choose an agent")} />
              </SelectTrigger>
              <SelectContent>
                {options.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.code ? ` · ${a.code}` : ""}
                  </SelectItem>
                ))}
                <SelectItem value="direct">{t("No agent (direct booking)")}</SelectItem>
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button disabled={saving || !choice} onClick={save}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Change referral")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** One organizer-only referral history entry, shown on tickets and round tables. */
export function ReferralHistoryList({ history }: { history?: any[] }) {
  if (!history || history.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-semibold text-muted-foreground">
        {t("Referral history")}
      </p>
      {[...history]
        .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
        .map((h, i) => (
          <div key={i} className="text-xs">
            <p>{h.note}</p>
            <p className="text-muted-foreground">
              {h.changedAt ? new Date(h.changedAt).toLocaleString() : ""}
            </p>
          </div>
        ))}
    </div>
  );
}
