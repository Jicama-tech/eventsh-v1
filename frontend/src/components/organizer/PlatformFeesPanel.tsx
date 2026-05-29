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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Award,
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

interface MembershipRow {
  _id: string;
  exhibitorName: string;
  exhibitorEmail: string;
  exhibitorWhatsapp: string;
  planName: string;
  startDate?: string;
  endDate?: string;
  amountPaid: number;
  currency: string;
  platformFee: number;
}

interface MembershipsBlock {
  rows: MembershipRow[];
  rate: number;
  total: number;
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
    membershipRate: number;
    currency: string;
  };
  events: EventRow[];
  memberships?: MembershipsBlock;
  region: { scheme: "UPI" | "PAYNOW"; currency: string } | null;
}

function symbolFor(currency?: string) {
  if (currency === "INR") return "₹";
  if (currency === "SGD") return "SG$";
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
  // Drives the memberships-batch checkout dialog. The BillingPaymentDialog
  // is reused with mode="memberships" so QR rendering / status polling /
  // mark-as-paid all share one code path with the per-event flow.
  const [payingMemberships, setPayingMemberships] = useState(false);

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

      <Tabs defaultValue="events" className="space-y-3">
        <TabsList>
          <TabsTrigger value="events" className="flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Events ({events.length})
          </TabsTrigger>
          <TabsTrigger
            value="memberships"
            className="flex items-center gap-1.5"
          >
            <Award className="h-3.5 w-3.5" />
            Memberships ({data?.memberships?.rows?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-0">
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
        </TabsContent>

        <TabsContent value="memberships" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4" /> Memberships
                </CardTitle>
                <CardDescription>
                  Each active exhibitor membership owes a flat{" "}
                  {currencySymbol}
                  {data?.memberships?.rate ?? 5} platform fee. Pay the
                  batch in one go.
                </CardDescription>
              </div>
              {data?.memberships && data.memberships.total > 0 && (
                <Button
                  size="sm"
                  disabled={
                    !region ||
                    data.memberships.claim?.status === "submitted" ||
                    data.memberships.claim?.status === "confirmed"
                  }
                  onClick={() => setPayingMemberships(true)}
                >
                  {data.memberships.claim?.status === "confirmed"
                    ? "Paid"
                    : data.memberships.claim?.status === "submitted"
                      ? "Submitted"
                      : data.memberships.claim?.status === "awaiting_payment"
                        ? "Resume"
                        : `Pay ${currencySymbol}${data.memberships.total.toFixed(
                            2,
                          )}`}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loading && (!data?.memberships?.rows?.length) ? (
                <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : !data?.memberships?.rows?.length ? (
                <div className="py-10 text-center text-slate-500">
                  No active exhibitor memberships yet — once one is
                  confirmed, the platform fee row appears here.
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Exhibitor</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Valid till</TableHead>
                        <TableHead className="text-right">
                          Paid to you
                        </TableHead>
                        <TableHead className="text-right">
                          Platform fee
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.memberships.rows.map((m) => (
                        <TableRow key={m._id}>
                          <TableCell>
                            <div className="font-medium">
                              {m.exhibitorName || m.exhibitorEmail || "—"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {m.exhibitorEmail}
                              {m.exhibitorWhatsapp
                                ? ` · ${m.exhibitorWhatsapp}`
                                : ""}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{m.planName}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {m.endDate
                              ? new Date(m.endDate).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {m.currency} {m.amountPaid.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currencySymbol}
                            {m.platformFee.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/40">
                        <TableCell colSpan={4} className="text-right">
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            Total platform fee
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {currencySymbol}
                          {data.memberships.total.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}

              {data?.memberships?.claim && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                  {data.memberships.claim.status === "confirmed" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Hourglass className="h-3.5 w-3.5" />
                  )}
                  <span className="font-mono">
                    {data.memberships.claim.ref}
                  </span>
                  <span>· {data.memberships.claim.status}</span>
                </div>
              )}

              {!region && data && (
                <p className="text-xs text-amber-600 mt-2">
                  Your country doesn't have a QR scheme configured.
                  Contact support to settle memberships fees off-band.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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

      <BillingPaymentDialog
        open={payingMemberships}
        onClose={() => setPayingMemberships(false)}
        eventId="memberships"
        eventTitle="Membership platform fees"
        mode="memberships"
        onSubmitted={() => {
          setPayingMemberships(false);
          fetchBilling();
        }}
      />
    </div>
  );
}
