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
import {
  Loader2,
  Receipt,
  Plus,
  X,
  QrCode,
  ExternalLink,
  FileText,
} from "lucide-react";
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

/**
 * Platform fees are billed in a single currency, read off the live rates
 * rather than hardcoded, so changing it in Settings -> Billing rates flows
 * through to every figure here and to the invoice. Defaults to SGD, which is
 * the only currency the platform collects in.
 */
const money = (v: number, currency = "SGD") =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: currency || "SGD",
    // "SGD 2,015.00", not "$2,015.00" — en-SG renders its own currency as a
    // bare "$", which on an admin screen is indistinguishable from USD.
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v || 0);

interface PaymentConfig {
  companyName: string;
  companyUEN: string;
  platformUPIId: string;
}

/**
 * The platform invoices and collects in SGD only, so the super-admin side
 * always settles through corporate PayNow against the company UEN, wherever
 * the organizer happens to be registered. This deliberately no longer
 * branches on organizer.country — the organizer-facing checkout
 * (BillingPaymentDialog) still carries its own region logic and is
 * unchanged.
 */
const SETTLEMENT = {
  scheme: "PAYNOW" as const,
  currency: "SGD" as const,
  label: "PayNow · Singapore",
};

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
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(
    null,
  );
  const [qrAmount, setQrAmount] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrIntent, setQrIntent] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  // Static is the default: the same QR keeps working after a part-payment,
  // and it is what goes on the invoice. Untick to lock a specific amount
  // into a one-shot QR instead.
  const [qrStatic, setQrStatic] = useState(true);
  const [invoiceBusy, setInvoiceBusy] = useState(false);

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
      setQrStatic(true);
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

  // Billing currency comes from the live rates so every figure on screen, in
  // the QR and on the invoice agree.
  const cur = data?.rates.currency || SETTLEMENT.currency;

  // The payee proxy is the company UEN from the singleton PaymentConfig the
  // super-admin maintains (seeded server-side, editable in Settings). If it
  // is somehow empty, point at Settings rather than letting the QR endpoint
  // reject the request.
  const proxy = paymentConfig?.companyUEN || "";

  /**
   * Ask the backend for a PayNow QR. `staticQr` builds a re-usable
   * amount-less one against the company UEN (the default, and what the
   * invoice embeds); otherwise the amount is baked in for a single payment.
   * Returns the QR so the invoice can await it, and also parks it in state
   * for the on-screen panel.
   */
  const requestQr = async (opts: {
    staticQr: boolean;
    amount?: number;
    billNumber: string;
  }): Promise<{ qr: string; intent: string }> => {
    if (!proxy) {
      throw new Error(
        "Company UEN isn't set. Configure it in Settings → Payment Settings.",
      );
    }
    if (!paymentConfig?.companyName) {
      throw new Error(
        "Company Name isn't set. Configure it in Settings → Payment Settings.",
      );
    }
    const params = new URLSearchParams({
      scheme: SETTLEMENT.scheme,
      payeeId: proxy,
      payeeName: paymentConfig.companyName,
      amount: opts.staticQr ? "" : (opts.amount ?? 0).toFixed(2),
      billNumber: opts.billNumber,
      currency: SETTLEMENT.currency,
      ...(opts.staticQr ? { static: "1" } : {}),
    });
    // /payments/generate-qr is public (no JWT guard) — fetch directly.
    const res = await fetch(`${apiURL}/payments/generate-qr?${params}`);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `HTTP ${res.status}`);
    }
    return (await res.json()) as { qr: string; intent: string };
  };

  const billNumber = `ORG-${organizerId?.slice(-6) || "BILL"}`;

  const generateQr = async () => {
    const amt = Number(qrAmount);
    if (!qrStatic && (!Number.isFinite(amt) || amt <= 0)) {
      setQrError("Enter a positive amount");
      return;
    }
    setQrLoading(true);
    setQrError(null);
    setQrImage(null);
    setQrIntent(null);
    try {
      const json = await requestQr({
        staticQr: qrStatic,
        amount: amt,
        billNumber,
      });
      setQrImage(json.qr);
      setQrIntent(json.intent);
    } catch (e: any) {
      setQrError(e?.message || "Failed to generate QR");
    } finally {
      setQrLoading(false);
    }
  };

  /**
   * Pull the static QR, then hand everything to the invoice builder. The
   * layout itself lives in lib/organizerInvoice so it can be exercised
   * without standing up the dialog, and so jspdf only loads on demand.
   */
  const downloadInvoice = async () => {
    if (!data) return;
    setInvoiceBusy(true);
    try {
      const qr = await requestQr({ staticQr: true, billNumber });
      const { buildOrganizerInvoice } = await import("@/lib/organizerInvoice");
      const { pdf, invoiceNo, fileName } = await buildOrganizerInvoice({
        billing: data,
        company: {
          name: paymentConfig?.companyName || "Eventsh",
          uen: paymentConfig?.companyUEN || "",
        },
        qrDataUrl: qr.qr,
      });
      pdf.save(fileName);
      toast({ title: "Invoice downloaded", description: invoiceNo });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't generate the invoice",
        description: e?.message,
      });
    } finally {
      setInvoiceBusy(false);
    }
  };

  const summary = useMemo(() => {
    if (!data) return null;
    return [
      {
        label: "Total expense",
        value: data.totals.billable,
        color: "text-slate-900",
      },
      {
        label: "Paid to Eventsh",
        value: data.totals.paid,
        color: "text-emerald-600",
      },
      { label: "Still owed", value: data.totals.owed, color: "text-rose-600" },
    ];
  }, [data]);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 pr-6">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-amber-600" />
                  {data?.organizer.organizationName ||
                    data?.organizer.name ||
                    "Organizer expenses"}
                </DialogTitle>
                <DialogDescription>
                  What this organizer owes Eventsh in platform fees, in {cur}.
                  Rates: {money(data?.rates.stall ?? 20, cur)}/stall ·{" "}
                  {money(data?.rates.roundTable ?? 20, cur)}/booked-table ·{" "}
                  {money(data?.rates.chair ?? 5, cur)}/chair ·{" "}
                  {money(data?.rates.speaker ?? 20, cur)}/speaker ·{" "}
                  {money(data?.rates.membership ?? 5, cur)}/active-membership
                </DialogDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadInvoice}
                disabled={!data || invoiceBusy}
                className="shrink-0"
              >
                {invoiceBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Building…
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate invoice
                  </>
                )}
              </Button>
            </div>
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
                      {money(s.value, cur)}
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
                          <TableHead className="text-center">
                            Stalls sold
                          </TableHead>
                          <TableHead className="text-center">
                            Tables booked
                          </TableHead>
                          <TableHead className="text-center">Chairs</TableHead>
                          <TableHead className="text-center">
                            Speakers
                          </TableHead>
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
                              {money(e.amount, cur)}
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
                          <TableHead className="text-center">Rate</TableHead>
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
                            {money(data.rates.membership, cur)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {money(data.memberships.amount, cur)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Pay-by-QR panel — always corporate PayNow against the
                  company UEN, since the platform collects in SGD only. */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    Pay by QR
                  </h3>
                  <span className="text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5">
                    {SETTLEMENT.label}
                  </span>
                </div>

                <div className="rounded-md border bg-slate-50 p-3 space-y-3">
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={qrStatic}
                      onChange={(e) => setQrStatic(e.target.checked)}
                      disabled={qrLoading}
                    />
                    <span>
                      Static UEN QR
                      <span className="block text-xs text-slate-500">
                        Re-usable, carries no amount — the payer types it. This
                        is the QR the invoice embeds. Untick to lock a single
                        amount into the QR instead.
                      </span>
                    </span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Amount ({cur})</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={qrStatic ? "" : qrAmount}
                        onChange={(e) => setQrAmount(e.target.value)}
                        placeholder={
                          qrStatic ? "Payer enters the amount" : "0.00"
                        }
                        disabled={qrLoading || qrStatic}
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
                        alt={`${SETTLEMENT.label} payment QR`}
                        className="w-48 h-48 rounded-md border bg-white p-2"
                      />
                      <div className="flex-1 space-y-2 text-sm">
                        <div>
                          Scan this QR with any{" "}
                          <strong>PayNow-enabled bank app</strong>
                          {qrStatic ? (
                            <>
                              {" "}
                              to pay <strong>{proxy}</strong>. The QR has no
                              amount in it — the payer enters what they are
                              settling.
                            </>
                          ) : (
                            <>
                              {" "}
                              to pay{" "}
                              <strong>{money(Number(qrAmount), cur)}</strong>.
                            </>
                          )}
                        </div>
                        {qrIntent && (
                          <Button variant="outline" size="sm" asChild>
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
                          <em>Record payment</em> below to log it against this
                          bill.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
                      <Label className="text-xs">Amount ({cur})</Label>
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
                              {money(p.amount, cur)}
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
            <DialogTitle>{breakdown?.event.title || "Loading…"}</DialogTitle>
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
            <li
              key={i}
              className="px-3 py-2 text-sm flex justify-between gap-3"
            >
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
