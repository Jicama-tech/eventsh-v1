import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Hourglass,
  Loader2,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BillingPaymentDialog } from "./BillingPaymentDialog";

const apiURL = __API_URL__;

interface Claim {
  _id: string;
  status: "awaiting_payment" | "submitted" | "confirmed";
  amount: number;
  currency: string;
  ref: string;
  submittedAt: string | null;
  confirmedAt: string | null;
}

interface EventRow {
  eventId: string;
  title: string;
  startDate: string;
  endDate?: string;
  status?: string;
  stallsSold: number;
  tablesBooked: number;
  chairsBooked: number;
  speakersBooked: number;
  amount: number;
  claim: Claim | null;
}

interface BillingResponse {
  organizer: {
    _id: string;
    name?: string;
    organizationName?: string;
    country?: string;
  };
  rates: {
    stallRate: number;
    roundTableRate: number;
    chairRate: number;
    speakerRate: number;
    currency: string;
  };
  events: EventRow[];
  region: { scheme: "UPI" | "PAYNOW"; currency: string } | null;
}

function symbolFor(currency?: string) {
  if (currency === "INR") return "₹";
  if (currency === "SGD") return "S$";
  return "$";
}

export function PlatformFeesPanel() {
  const { toast } = useToast();
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [payingEvent, setPayingEvent] = useState<{
    eventId: string;
    title: string;
  } | null>(null);

  const fetchBilling = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${apiURL}/billing-payments/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as BillingResponse;
      setData(json);
    } catch (e: any) {
      toast({
        title: "Failed to load platform fees",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const region = data?.region;
  const currencySymbol = symbolFor(region?.currency || data?.rates?.currency);

  const events = data?.events || [];
  const totalOwed = events
    .filter((e) => !e.claim || e.claim.status !== "confirmed")
    .reduce((s, e) => s + (e.amount || 0), 0);
  const totalPaid = events
    .filter((e) => e.claim?.status === "confirmed")
    .reduce((s, e) => s + (e.claim?.amount || 0), 0);
  const pendingCount = events.filter(
    (e) => e.claim?.status === "submitted" || e.claim?.status === "awaiting_payment",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" /> Platform Fees
          </h2>
          <p className="text-muted-foreground text-sm">
            Per-event fees owed to Eventsh. Pay each event with a
            country-specific QR; admin confirms and a receipt is sent to your
            WhatsApp + email.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchBilling}
          disabled={loading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Outstanding
            </div>
            <div className="text-2xl font-bold text-rose-600">
              {currencySymbol}
              {totalOwed.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Paid so far
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {currencySymbol}
              {totalPaid.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Awaiting confirmation
            </div>
            <div className="text-2xl font-bold text-amber-600">
              {pendingCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Events
          </CardTitle>
          <CardDescription>
            Rate is {currencySymbol}
            {data?.rates.stallRate ?? 20}/stall · {currencySymbol}
            {data?.rates.roundTableRate ?? 20}/booked-table · {currencySymbol}
            {data?.rates.chairRate ?? 5}/chair · {currencySymbol}
            {data?.rates.speakerRate ?? 20}/speaker.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && events.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : events.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              No events yet — once attendees, exhibitors, or speakers
              register, fees will appear here.
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead className="text-center">Stalls</TableHead>
                    <TableHead className="text-center">Tables</TableHead>
                    <TableHead className="text-center">Chairs</TableHead>
                    <TableHead className="text-center">Speakers</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => {
                    const claim = e.claim;
                    const isPaid = claim?.status === "confirmed";
                    const isSubmitted = claim?.status === "submitted";
                    const isAwaiting = claim?.status === "awaiting_payment";
                    return (
                      <TableRow key={e.eventId}>
                        <TableCell>
                          <div className="font-medium">{e.title}</div>
                          <div className="text-xs text-slate-500">
                            {e.startDate
                              ? new Date(e.startDate).toLocaleDateString()
                              : ""}
                            {e.endDate
                              ? ` – ${new Date(e.endDate).toLocaleDateString()}`
                              : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {e.stallsSold}
                        </TableCell>
                        <TableCell className="text-center">
                          {e.tablesBooked}
                        </TableCell>
                        <TableCell className="text-center">
                          {e.chairsBooked}
                        </TableCell>
                        <TableCell className="text-center">
                          {e.speakersBooked}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {currencySymbol}
                          {e.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {isPaid ? (
                            <Badge className="bg-emerald-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
                            </Badge>
                          ) : isSubmitted ? (
                            <Badge className="bg-amber-500">
                              <Hourglass className="h-3 w-3 mr-1" /> Awaiting
                              admin
                            </Badge>
                          ) : isAwaiting ? (
                            <Badge variant="outline" className="text-slate-500">
                              <Hourglass className="h-3 w-3 mr-1" /> In
                              progress
                            </Badge>
                          ) : e.amount > 0 ? (
                            <Badge variant="outline" className="text-rose-600 border-rose-200">
                              Owed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-400">
                              —
                            </Badge>
                          )}
                          {claim?.ref && (
                            <div className="text-[10px] font-mono text-slate-400 mt-1">
                              {claim.ref}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            disabled={
                              e.amount <= 0 ||
                              isPaid ||
                              isSubmitted ||
                              !region
                            }
                            onClick={() =>
                              setPayingEvent({
                                eventId: e.eventId,
                                title: e.title,
                              })
                            }
                          >
                            {isPaid
                              ? "Paid"
                              : isSubmitted
                                ? "Submitted"
                                : isAwaiting
                                  ? "Resume"
                                  : "Pay"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {!region && data && (
            <p className="text-xs text-amber-600 mt-2">
              Your country doesn't have a QR scheme configured. Contact
              support to settle event fees off-band.
            </p>
          )}
        </CardContent>
      </Card>

      <BillingPaymentDialog
        open={!!payingEvent}
        onClose={() => setPayingEvent(null)}
        eventId={payingEvent?.eventId || null}
        eventTitle={payingEvent?.title || ""}
        onSubmitted={() => {
          setPayingEvent(null);
          fetchBilling();
        }}
      />
    </div>
  );
}
