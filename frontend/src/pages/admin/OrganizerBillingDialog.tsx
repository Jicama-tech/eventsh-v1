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
import { Loader2, Receipt, Plus, X } from "lucide-react";
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
  totals: { billable: number; paid: number; owed: number };
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

  useEffect(() => {
    if (open) {
      setData(null);
      setBreakdown(null);
      setShowPay(false);
      fetchBilling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizerId]);

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
