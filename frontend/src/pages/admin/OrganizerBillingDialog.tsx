import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Receipt, Plus, X, QrCode, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminFetch";

const apiURL = __API_URL__;

interface BillingResponse {
  organizer: {
    _id: string;
    name: string;
    organizationName: string;
    email: string;
    country?: string;
    createdAt?: string;
  };
  rates: {
    stall: number;
    roundTable: number;
    chair: number;
    speaker: number;
    membership: number;
    currency: string;
  };
  events: Array<{
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
  }>;
  // Active membership count + membership-tier amount for this organizer.
  // Surfaced separately from the per-event rows because memberships are
  // organizer-scoped, not event-scoped.
  memberships?: { active: number; amount: number };
  totals: {
    eventsBillable?: number;
    membershipsBillable?: number;
    billable: number;
    paid: number;
    owed: number;
  };
  payments: Array<{
    _id: string;
    amount: number;
    paidOn: string;
    note: string;
    recordedBy: string | null;
  }>;
}

interface BreakdownResponse {
  event: { _id: string; title: string; startDate: string; endDate?: string };
  stalls: Array<{ positionId: string; name: string; bookedBy: string | null }>;
  rounds: Array<{
    positionId: string;
    name: string;
    chairs: number;
    isFullyBooked: boolean;
  }>;
  speakers: Array<{
    _id: string;
    name: string;
    email: string;
    status: string;
    updatedAt?: string;
  }>;
}

const fmtUsd = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    v || 0,
  );

interface PaymentConfig {
  companyName: string;
  companyUEN: string;
  platformUPIId: string;
}

/**
 * Map the organizer's stored country to a QR scheme + currency. Registration
 * writes 2-letter ISO codes ("IN" / "SG", see organizerRegister.tsx:28), but
 * older rows occasionally hold the full name — accept both.
 */
type Region =
  | { scheme: "UPI"; currency: "INR"; label: "UPI · India" }
  | { scheme: "PAYNOW"; currency: "SGD"; label: "PayNow · Singapore" }
  | null;

function regionFromCountry(country?: string): Region {
  const c = (country || "").trim().toLowerCase();
  if (c === "in" || c === "india") {
    return { scheme: "UPI", currency: "INR", label: "UPI · India" };
  }
  if (c === "sg" || c === "singapore" || c === "sgp") {
    return { scheme: "PAYNOW", currency: "SGD", label: "PayNow · Singapore" };
  }
  return null;
}

export function OrganizerBillingDialog({
  organizerId,
  onClose,
}: {
  organizerId: string | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const open = !!organizerId;
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownResponse | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [payNote, setPayNote] = useState("");
  const [posting, setPosting] = useState(false);

  // Pay-by-QR state. Scheme is auto-derived from organizer.country, proxy is
  // pulled from the singleton platform PaymentConfig (set by super-admin in
  // Settings → Payment Settings). Amount defaults to totals.owed but is
  // editable in case partial payment is being collected.
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [qrAmount, setQrAmount] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrIntent, setQrIntent] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const fetchBilling = async () => {
    if (!organizerId) return;
    setLoading(true);
    try {
      const res = await adminFetch(
        `${apiURL}/admin/organizers/${organizerId}/billing`,
      );
      if (res.status === 401) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as BillingResponse;
      setData(json);
    } catch (e: any) {
      toast({
        title: "Failed to load billing",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentConfig = async () => {
    try {
      const res = await adminFetch(`${apiURL}/admin/payment-config`);
      if (!res.ok) return;
      const json = (await res.json()) as PaymentConfig;
      setPaymentConfig(json);
    } catch {
      // Non-fatal — QR panel will surface a clear "not configured" message.
    }
  };

  useEffect(() => {
    if (open) {
      setData(null);
      setBreakdown(null);
      setShowPay(false);
      setPaymentConfig(null);
      setQrImage(null);
      setQrIntent(null);
      setQrError(null);
      setQrAmount("");
      fetchBilling();
      fetchPaymentConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizerId]);

  // Keep the QR amount in sync with the live "owed" value the first time it
  // loads — but let the operator override it for partial payments.
  useEffect(() => {
    if (data && !qrAmount) {
      setQrAmount(String(data.totals.owed || 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const openBreakdown = async (eventId: string) => {
    if (!organizerId) return;
    setBreakdownLoading(true);
    setBreakdown(null);
    try {
      const res = await adminFetch(
        `${apiURL}/admin/organizers/${organizerId}/events/${eventId}/breakdown`,
      );
      if (res.status === 401) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBreakdown((await res.json()) as BreakdownResponse);
    } catch (e: any) {
      toast({
        title: "Failed to load breakdown",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setBreakdownLoading(false);
    }
  };

  const submitPayment = async () => {
    if (!organizerId) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Enter a positive amount", variant: "destructive" });
      return;
    }
    setPosting(true);
    try {
      const res = await adminFetch(
        `${apiURL}/admin/organizers/${organizerId}/payments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, paidOn: payDate, note: payNote }),
        },
      );
      if (res.status === 401) return;
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      toast({ title: "Payment recorded" });
      setShowPay(false);
      setPayAmount("");
      setPayNote("");
      await fetchBilling();
    } catch (e: any) {
      toast({
        title: "Couldn't record payment",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  const region = useMemo(
    () => regionFromCountry(data?.organizer.country),
    [data?.organizer.country],
  );

  // The payee proxy (UPI VPA for India, corporate UEN for Singapore) comes
  // from the singleton PaymentConfig the super-admin maintains. If the
  // matching field isn't set, surface a pointer to Settings rather than
  // silently letting the QR endpoint reject the request.
  const proxy = useMemo(() => {
    if (!region || !paymentConfig) return "";
    return region.scheme === "UPI"
      ? paymentConfig.platformUPIId
      : paymentConfig.companyUEN;
  }, [region, paymentConfig]);

  const generateQr = async () => {
    if (!region) return;
    const amt = Number(qrAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setQrError("Enter a positive amount");
      return;
    }
    if (!proxy) {
      setQrError(
        region.scheme === "UPI"
          ? "Platform UPI ID isn't set. Configure it in Settings → Payment Settings."
          : "Company UEN isn't set. Configure it in Settings → Payment Settings.",
      );
      return;
    }
    if (!paymentConfig?.companyName) {
      setQrError(
        "Company Name isn't set. Configure it in Settings → Payment Settings.",
      );
      return;
    }
    setQrLoading(true);
    setQrError(null);
    setQrImage(null);
    setQrIntent(null);
    try {
      const params = new URLSearchParams({
        scheme: region.scheme,
        payeeId: proxy,
        payeeName: paymentConfig.companyName,
        amount: amt.toFixed(2),
        billNumber: `ORG-${organizerId?.slice(-6) || "BILL"}`,
        currency: region.currency,
      });
      // /payments/generate-qr is public (no JWT guard) — fetch directly.
      const res = await fetch(`${apiURL}/payments/generate-qr?${params}`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { qr: string; intent: string };
      setQrImage(json.qr);
      setQrIntent(json.intent);
    } catch (e: any) {
      setQrError(e?.message || "Failed to generate QR");
    } finally {
      setQrLoading(false);
    }
  };

  const summary = useMemo(() => {
    if (!data) return null;
    return [
      { label: "Total billable", value: data.totals.billable, color: "text-slate-900" },
      { label: "Total paid", value: data.totals.paid, color: "text-emerald-600" },
      { label: "Outstanding", value: data.totals.owed, color: "text-rose-600" },
    ];
  }, [data]);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-600" />
              {data?.organizer.organizationName ||
                data?.organizer.name ||
                "Organizer billing"}
            </DialogTitle>
            <DialogDescription>
              Platform fee: ${data?.rates.stall ?? 20}/stall · $
              {data?.rates.roundTable ?? 20}/booked-table · $
              {data?.rates.chair ?? 5}/chair · ${data?.rates.speaker ?? 20}
              /speaker · ${data?.rates.membership ?? 5}/active-membership
              /speaker
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {data && !loading && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                {summary?.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg border bg-slate-50 px-4 py-3"
                  >
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {s.label}
                    </div>
                    <div className={`text-2xl font-bold ${s.color}`}>
                      {fmtUsd(s.value)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Events */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Events ({data.events.length})
                  </h3>
                </div>
                {data.events.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">
                    No events created yet.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead className="text-center">Stalls sold</TableHead>
                          <TableHead className="text-center">Tables booked</TableHead>
                          <TableHead className="text-center">Chairs</TableHead>
                          <TableHead className="text-center">Speakers</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.events.map((e) => (
                          <TableRow
                            key={e.eventId}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => openBreakdown(e.eventId)}
                          >
                            <TableCell>
                              <div className="font-medium">{e.title}</div>
                              <div className="text-xs text-slate-500">
                                {new Date(e.startDate).toLocaleDateString()}
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
                              {fmtUsd(e.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Memberships — organizer-scoped fee, separate from the
                  per-event grid above. Only rendered when there's at
                  least one active membership for this organizer. */}
              {data.memberships && data.memberships.active > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                      Memberships
                    </h3>
                  </div>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tier</TableHead>
                          <TableHead className="text-center">
                            Active count
                          </TableHead>
                          <TableHead className="text-center">
                            Rate
                          </TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>
                            <div className="font-medium">
                              Active exhibitor memberships
                            </div>
                            <div className="text-xs text-slate-500">
                              Flat per-active-membership fee
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {data.memberships.active}
                          </TableCell>
                          <TableCell className="text-center">
                            {fmtUsd(data.rates.membership)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {fmtUsd(data.memberships.amount)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Pay-by-QR panel — scheme auto-picked from organizer.country */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    Pay by QR
                  </h3>
                  {region ? (
                    <span className="text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5">
                      {region.label}
                    </span>
                  ) : (
                    <span className="text-xs font-medium rounded-full bg-slate-100 text-slate-600 border px-2 py-0.5">
                      {data.organizer.country || "No country set"}
                    </span>
                  )}
                </div>

                {!region ? (
                  <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-600">
                    QR payment isn't available for this organizer's region (
                    {data.organizer.country || "country not set"}). Use{" "}
                    <em>Record payment</em> below to log a manual settlement.
                  </div>
                ) : (
                  <div className="rounded-md border bg-slate-50 p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                      <div className="sm:col-span-2">
                        <Label className="text-xs">
                          Amount ({region.currency})
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={qrAmount}
                          onChange={(e) => setQrAmount(e.target.value)}
                          placeholder="0.00"
                          disabled={qrLoading}
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <Button onClick={generateQr} disabled={qrLoading}>
                          {qrLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Generating…
                            </>
                          ) : (
                            <>
                              <QrCode className="h-4 w-4 mr-2" />
                              {qrImage ? "Regenerate" : "Generate QR"}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500">
                      Payee:{" "}
                      <span className="font-mono text-slate-700">
                        {proxy || "— not configured —"}
                      </span>
                      {paymentConfig?.companyName && (
                        <>
                          {" · "}
                          <span>{paymentConfig.companyName}</span>
                        </>
                      )}
                    </div>

                    {qrError && (
                      <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">
                        {qrError}
                      </div>
                    )}

                    {qrImage && (
                      <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                        <img
                          src={qrImage}
                          alt={`${region.label} payment QR`}
                          className="w-48 h-48 rounded-md border bg-white p-2"
                        />
                        <div className="flex-1 space-y-2 text-sm">
                          <div>
                            Scan this QR with any{" "}
                            <strong>
                              {region.scheme === "UPI"
                                ? "UPI app (GPay, PhonePe, Paytm…)"
                                : "PayNow-enabled bank app"}
                            </strong>{" "}
                            to pay{" "}
                            <strong>
                              {Number(qrAmount).toFixed(2)} {region.currency}
                            </strong>
                            .
                          </div>
                          {qrIntent && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a
                                href={qrIntent}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open in payment app
                              </a>
                            </Button>
                          )}
                          <div className="text-xs text-slate-500">
                            Once the transfer completes, click{" "}
                            <em>Record payment</em> below to log it against
                            this bill.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Payments + record-payment form */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Payment history ({data.payments.length})
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowPay((v) => !v)}
                  >
                    {showPay ? (
                      <>
                        <X className="h-3 w-3 mr-1" /> Cancel
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3 mr-1" /> Record payment
                      </>
                    )}
                  </Button>
                </div>

                {showPay && (
                  <div className="rounded-md border bg-slate-50 p-3 mb-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                    <div>
                      <Label className="text-xs">Amount (USD)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={posting}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Paid on</Label>
                      <Input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        disabled={posting}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Note (optional)</Label>
                      <Input
                        value={payNote}
                        onChange={(e) => setPayNote(e.target.value)}
                        placeholder="Wire ref, conversation, etc."
                        disabled={posting}
                      />
                    </div>
                    <div className="sm:col-span-4 flex justify-end">
                      <Button onClick={submitPayment} disabled={posting}>
                        {posting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Saving…
                          </>
                        ) : (
                          "Save payment"
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {data.payments.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">
                    No payments recorded.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Note</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.payments.map((p) => (
                          <TableRow key={p._id}>
                            <TableCell>
                              {new Date(p.paidOn).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm text-slate-700">
                              {p.note || (
                                <span className="italic text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-emerald-700">
                              {fmtUsd(p.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drill-down: per-event breakdown */}
      <Dialog
        open={!!breakdown || breakdownLoading}
        onOpenChange={(v) => !v && setBreakdown(null)}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {breakdown?.event.title || "Loading…"}
            </DialogTitle>
            <DialogDescription>
              {breakdown?.event.startDate &&
                new Date(breakdown.event.startDate).toLocaleDateString()}
              {breakdown?.event.endDate
                ? ` – ${new Date(breakdown.event.endDate).toLocaleDateString()}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {breakdownLoading && (
            <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading breakdown…
            </div>
          )}
          {breakdown && (
            <div className="space-y-4">
              <Section
                title={`Booked stalls (${breakdown.stalls.length})`}
                empty="No stalls sold."
                rows={breakdown.stalls.map((s) => ({
                  primary: s.name,
                  secondary: s.bookedBy ? `Booked by ${s.bookedBy}` : "Booked",
                }))}
              />
              <Section
                title={`Booked round tables (${breakdown.rounds.length})`}
                empty="No round tables booked."
                rows={breakdown.rounds.map((r) => ({
                  primary: r.name,
                  secondary: `${r.chairs} chair${
                    r.chairs === 1 ? "" : "s"
                  } booked${r.isFullyBooked ? " · fully booked" : ""}`,
                }))}
              />
              <Section
                title={`Confirmed speakers (${breakdown.speakers.length})`}
                empty="No confirmed speakers."
                rows={breakdown.speakers.map((sp) => ({
                  primary: sp.name,
                  secondary: sp.email,
                }))}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBreakdown(null)}>
              Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ primary: string; secondary?: string }>;
  empty: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-slate-500 italic">{empty}</div>
      ) : (
        <ul className="rounded-md border divide-y bg-white">
          {rows.map((r, i) => (
            <li key={i} className="px-3 py-2 text-sm flex justify-between gap-3">
              <span className="font-medium">{r.primary}</span>
              {r.secondary && (
                <span className="text-slate-500 text-xs truncate">
                  {r.secondary}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
