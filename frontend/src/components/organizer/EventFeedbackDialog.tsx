import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { t } from "@/i18n/t";

const apiURL = __API_URL__;

type Audience =
  | "visitor"
  | "exhibitor"
  | "speaker"
  | "round_table"
  | "public";

// The Feedback collection uses snake_case audience values to match the
// FeedbackAudience enum on the backend; the subscription module flags use
// camelCase. Map between the two before gating.
const AUDIENCE_TO_PLAN_KEY: Record<
  Audience,
  "visitor" | "exhibitor" | "speaker" | "roundTable"
> = {
  visitor: "visitor",
  exhibitor: "exhibitor",
  speaker: "speaker",
  round_table: "roundTable",
  // Open-link feedback rides the visitor entitlement — it is the same
  // "hear from attendees" capability, just without a ticket behind it.
  public: "visitor",
};

// Audiences that can have a security deposit riding on their feedback.
const DEPOSIT_AUDIENCES = new Set<Audience>([
  "exhibitor",
  "speaker",
  "round_table",
]);

// One flat row, whichever source it came from.
interface MergedRow {
  key: string;
  who: string;
  typeLabel: string;
  rating: number;
  comment: string;
  createdAt: string;
  audience?: Audience;
  item?: FeedbackItem;
}

interface PaymentRow {
  _id: string;
  rating: number;
  comment?: string;
  payerName?: string;
  payerEmail?: string;
  eventId?: string;
  eventTitle?: string;
  createdAt: string;
}

interface FeedbackItem {
  _id: string;
  audience: Audience;
  subjectId: string;
  email: string;
  // Only set for the "public" audience — self-declared, not verified.
  name?: string;
  rating: number;
  comment: string;
  refundStatus: "pending" | "refunded" | "not_applicable";
  createdAt: string;
}

interface Bucket {
  items: FeedbackItem[];
  avg: number;
  count: number;
  available: number;
}

interface ListResponse {
  eventId: string;
  byAudience: Record<Audience, Bucket>;
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  visitor: "Visitors",
  exhibitor: "Exhibitors",
  speaker: "Speakers",
  round_table: "Round Tables",
  public: "Public Link",
};

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={
            value >= n
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground"
          }
        />
      ))}
    </div>
  );
}

export function EventFeedbackDialog({
  eventId,
  eventTitle,
  organizerId,
  open,
  onOpenChange,
}: {
  eventId: string | null;
  eventTitle?: string;
  organizerId?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const { isFeedbackAudienceEnabled } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ListResponse | null>(null);
  // Post-payment ratings live in their own collection, but the organizer just
  // wants "how did this event score" — so they are merged into the same list
  // rather than sitting in a separate panel underneath.
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  // Audiences the active plan actually allows. If the plan has Feedback
  // enabled with no audiences ticked, this is empty — we render an
  // upgrade-prompt empty state in place of the tabs.
  const allowedAudiences = (Object.keys(AUDIENCE_LABEL) as Audience[]).filter(
    (a) => isFeedbackAudienceEnabled(AUDIENCE_TO_PLAN_KEY[a]),
  );

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${apiURL}/events/${eventId}/feedback`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to load");
      setData(json);
    } catch (err: any) {
      toast({
        title: "Could not load feedback",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && eventId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventId]);

  useEffect(() => {
    if (!open || !organizerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiURL}/payment-feedback/organizer/${organizerId}`,
        );
        const json = await res.json();
        if (cancelled) return;
        const rows: PaymentRow[] = json?.items || [];
        // Narrow to this event — by id, or by title for the flows that only
        // carry a title (speaker / round-table checkout).
        setPayments(
          rows.filter(
            (i) =>
              (eventId && String(i.eventId) === String(eventId)) ||
              (eventTitle && i.eventTitle === eventTitle),
          ),
        );
      } catch {
        if (!cancelled) setPayments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizerId, eventId, eventTitle]);


  // Every source, flattened and newest first.
  const allRows: MergedRow[] = [
    ...allowedAudiences.flatMap((a) =>
      (data?.byAudience?.[a]?.items || []).map((item) => ({
        key: `f:${item._id}`,
        who:
          (item.audience === "public" ? item.name : item.email) ||
          item.email ||
          "Anonymous",
        typeLabel: AUDIENCE_LABEL[a],
        rating: item.rating,
        comment: item.comment || "",
        createdAt: item.createdAt,
        audience: a,
        item,
      })),
    ),
    ...payments.map((p) => ({
      key: `p:${p._id}`,
      who: p.payerName || p.payerEmail || "Payer",
      typeLabel: "Payment",
      rating: p.rating,
      comment: p.comment || "",
      createdAt: p.createdAt,
    })),
  ].sort(
    (x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime(),
  );

  const overallCount = allRows.length;
  const overallAvg = overallCount
    ? Math.round(
        (allRows.reduce((sum, r) => sum + (r.rating || 0), 0) / overallCount) *
          10,
      ) / 10
    : 0;

  // Per-source chips, so the single number above stays explainable.
  const typeBreakdown = Object.entries(
    allRows.reduce<Record<string, { count: number; total: number }>>(
      (acc, r) => {
        const k = r.typeLabel;
        acc[k] = acc[k] || { count: 0, total: 0 };
        acc[k].count += 1;
        acc[k].total += r.rating || 0;
        return acc;
      },
      {},
    ),
  ).map(([label, v]) => ({
    key: label,
    label,
    count: v.count,
    avg: Math.round((v.total / v.count) * 10) / 10,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Feedback")}</DialogTitle>
          <DialogDescription>
            {eventTitle ? `${eventTitle} · ` : ""}Aggregate and individual
            feedback for this event.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : !data ? (
          <div className="py-10 text-center text-muted-foreground">
            No data yet.
          </div>
        ) : allowedAudiences.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground space-y-3">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium text-muted-foreground">
                Feedback isn't included in your current plan
              </p>
              <p className="text-xs mt-1">
                Upgrade your subscription to collect feedback from visitors,
                exhibitors, speakers, or round-table guests.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* One headline number. Splitting feedback across tabs meant the
                overall rating for the event was never shown anywhere — you
                had to read five averages and weight them yourself. */}
            <Card>
              <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-semibold">
                      {overallAvg || "—"}
                    </span>
                    <Stars value={Math.round(overallAvg)} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {overallCount === 0
                      ? "No feedback yet"
                      : `${overallCount} response${
                          overallCount === 1 ? "" : "s"
                        } across all sources`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {typeBreakdown.map((b) => (
                    <Badge
                      key={b.key}
                      variant="outline"
                      className="text-[11px] font-normal"
                    >
                      {b.label} {b.count} · {b.avg}★
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {allRows.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No feedback received yet for this event.
                </CardContent>
              </Card>
            ) : (
              allRows.map((row) => (
                <Card key={row.key}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{row.who}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            ({row.typeLabel})
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(row.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <Stars value={row.rating} />
                    </div>
                    {row.comment && (
                      <p className="text-sm text-muted-foreground italic">
                        "{row.comment}"
                      </p>
                    )}
                    {/* Read-only flag, and only while the deposit is still
                        owed. Returning it happens in the stall dialog, off the
                        back of the actual refund — a second toggle here was a
                        rival source of truth that could disagree with the
                        booking's own depositReturned. Nothing to action once
                        it is back, so nothing is shown. */}
                    {row.item &&
                      row.audience &&
                      DEPOSIT_AUDIENCES.has(row.audience) &&
                      row.item.refundStatus !== "refunded" && (
                        <div className="pt-1 border-t">
                          <Badge variant="outline">
                            Return Deposit Pending
                          </Badge>
                        </div>
                      )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
