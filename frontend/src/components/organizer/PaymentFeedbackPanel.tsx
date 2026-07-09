import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, MessageSquare } from "lucide-react";
import { format } from "date-fns";

const apiURL = __API_URL__;

const TYPE_LABEL: Record<string, string> = {
  vendor: "Stall booking",
  stall_edit: "Stall edit",
  visitor: "Ticket",
  speaker: "Speaker",
  round_table: "Round table",
};

const TYPE_COLOR: Record<string, string> = {
  vendor: "bg-blue-100 text-blue-700",
  stall_edit: "bg-amber-100 text-amber-700",
  visitor: "bg-green-100 text-green-700",
  speaker: "bg-purple-100 text-purple-700",
  round_table: "bg-pink-100 text-pink-700",
};

interface PaymentFeedbackRow {
  _id: string;
  paymentType: string;
  rating: number;
  comment?: string;
  payerName?: string;
  payerEmail?: string;
  eventId?: string;
  eventTitle?: string;
  amount?: number;
  createdAt: string;
  organizerId?: any;
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${
            value >= n ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Lists post-payment feedback. In organizer mode it fetches only that
 * organizer's feedback; in admin mode it fetches everything platform-wide
 * (and shows which organizer each row belongs to), with a type filter.
 */
export default function PaymentFeedbackPanel({
  organizerId,
  admin = false,
  eventId,
  eventTitle,
}: {
  organizerId?: string;
  admin?: boolean;
  /** When set (organizer mode), only this event's feedback is shown. */
  eventId?: string;
  eventTitle?: string;
}) {
  const [items, setItems] = useState<PaymentFeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const url = admin
          ? `${apiURL}/payment-feedback${filter !== "all" ? `?paymentType=${filter}` : ""}`
          : `${apiURL}/payment-feedback/organizer/${organizerId}`;
        const res = await fetch(url);
        const json = await res.json();
        if (cancelled) return;
        setItems(json?.items || []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizerId, admin, filter]);

  // Narrow to this event when embedded in a per-event view (match by id, or by
  // title for flows that only carry an event title — speaker / round-table).
  const scoped =
    eventId || eventTitle
      ? items.filter(
          (i) =>
            (eventId && String(i.eventId) === String(eventId)) ||
            (eventTitle && i.eventTitle === eventTitle),
        )
      : items;

  const shown =
    admin || filter === "all"
      ? scoped
      : scoped.filter((i) => i.paymentType === filter);

  const count = shown.length;
  const avg = count
    ? Math.round(
        (shown.reduce((s, i) => s + (i.rating || 0), 0) / count) * 10,
      ) / 10
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" /> Payment Feedback
            {count > 0 && (
              <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                · {avg}
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                ({count})
              </span>
            )}
          </CardTitle>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All types</option>
            <option value="vendor">Stall booking</option>
            <option value="stall_edit">Stall edit</option>
            <option value="visitor">Ticket</option>
            <option value="speaker">Speaker</option>
            <option value="round_table">Round table</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No payment feedback yet. It appears here after payers rate their
            experience at checkout.
          </p>
        ) : (
          <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
            {shown.map((f) => (
              <div
                key={f._id}
                className="rounded-lg border p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Stars value={f.rating} />
                    <Badge
                      className={TYPE_COLOR[f.paymentType] || "bg-gray-100"}
                    >
                      {TYPE_LABEL[f.paymentType] || f.paymentType}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {f.createdAt
                      ? format(new Date(f.createdAt), "MMM d, yyyy · h:mm a")
                      : ""}
                  </span>
                </div>
                {f.comment && (
                  <p className="text-sm text-gray-700">{f.comment}</p>
                )}
                <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-xs text-muted-foreground">
                  {f.payerName && <span>👤 {f.payerName}</span>}
                  {f.payerEmail && <span>{f.payerEmail}</span>}
                  {f.eventTitle && <span>🎪 {f.eventTitle}</span>}
                  {admin && f.organizerId?.organizationName && (
                    <span className="font-medium text-gray-600">
                      🏢 {f.organizerId.organizationName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
