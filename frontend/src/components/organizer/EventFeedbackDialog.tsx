import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, RefreshCcw, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import PaymentFeedbackPanel from "./PaymentFeedbackPanel";

const apiURL = __API_URL__;

type Audience = "visitor" | "exhibitor" | "speaker" | "round_table";

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
};

interface FeedbackItem {
  _id: string;
  audience: Audience;
  subjectId: string;
  email: string;
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
              : "text-gray-300"
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
  const [tab, setTab] = useState<Audience>("visitor");

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

  // Pick the first plan-allowed audience that has feedback for default tab.
  // Falls back to the first allowed audience (even if empty) so the active
  // tab is always a tab the plan permits.
  useEffect(() => {
    if (!data || allowedAudiences.length === 0) return;
    const firstWithItems = allowedAudiences.find(
      (a) => data.byAudience[a]?.items?.length > 0,
    );
    setTab(firstWithItems || allowedAudiences[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, allowedAudiences.join("|")]);

  const toggleRefund = async (item: FeedbackItem) => {
    const next: FeedbackItem["refundStatus"] =
      item.refundStatus === "refunded" ? "pending" : "refunded";
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(
        `${apiURL}/feedback/${item._id}/refund-status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ status: next }),
        },
      );
      if (!res.ok) throw new Error("Failed to update");
      setData((prev) =>
        prev
          ? {
              ...prev,
              byAudience: {
                ...prev.byAudience,
                [item.audience]: {
                  ...prev.byAudience[item.audience],
                  items: prev.byAudience[item.audience].items.map((f) =>
                    f._id === item._id ? { ...f, refundStatus: next } : f,
                  ),
                },
              },
            }
          : prev,
      );
      toast({
        title: next === "refunded" ? "Marked as refunded" : "Marked pending",
      });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Feedback</DialogTitle>
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
            <Lock className="h-8 w-8 mx-auto text-slate-400" />
            <div>
              <p className="font-medium text-slate-700">
                Feedback isn't included in your current plan
              </p>
              <p className="text-xs mt-1">
                Upgrade your subscription to collect feedback from visitors,
                exhibitors, speakers, or round-table guests.
              </p>
            </div>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as Audience)}>
            <TabsList
              className="grid w-full"
              style={{
                gridTemplateColumns: `repeat(${allowedAudiences.length}, minmax(0, 1fr))`,
              }}
            >
              {allowedAudiences.map((a) => {
                const b = data.byAudience[a];
                const enabled = b.available > 0;
                return (
                  <TabsTrigger
                    key={a}
                    value={a}
                    disabled={!enabled}
                    className="text-xs flex flex-col gap-0.5 py-2"
                  >
                    <span>{AUDIENCE_LABEL[a]}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {b.count}/{b.available}
                      {b.count > 0 ? ` · ${b.avg}★` : ""}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {allowedAudiences.map((a) => {
              const b = data.byAudience[a];
              return (
                <TabsContent key={a} value={a} className="space-y-3 mt-4">
                  {b.items.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-sm text-muted-foreground">
                        No feedback received yet
                        {b.available === 0
                          ? " — and no bookings exist for this audience."
                          : ` (out of ${b.available} ${AUDIENCE_LABEL[a].toLowerCase()})`}
                        .
                      </CardContent>
                    </Card>
                  ) : (
                    b.items.map((item) => (
                      <Card key={item._id}>
                        <CardContent className="py-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium">
                                {item.email}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {new Date(item.createdAt).toLocaleString()}
                              </div>
                            </div>
                            <Stars value={item.rating} />
                          </div>
                          {item.comment && (
                            <p className="text-sm text-muted-foreground italic">
                              "{item.comment}"
                            </p>
                          )}
                          {a !== "visitor" && (
                            <div className="flex items-center justify-between pt-1 border-t">
                              <Badge
                                variant={
                                  item.refundStatus === "refunded"
                                    ? "default"
                                    : "outline"
                                }
                              >
                                Deposit:{" "}
                                {item.refundStatus === "refunded"
                                  ? "Refunded"
                                  : "Pending"}
                              </Badge>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => toggleRefund(item)}
                              >
                                <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                                {item.refundStatus === "refunded"
                                  ? "Mark pending"
                                  : "Mark refunded"}
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {/* Post-payment feedback for THIS event (rated by payers at checkout).
            Independent of the event-feedback plan gating above. */}
        {organizerId && (eventId || eventTitle) && (
          <div className="mt-4">
            <PaymentFeedbackPanel
              organizerId={organizerId}
              eventId={eventId || undefined}
              eventTitle={eventTitle}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
