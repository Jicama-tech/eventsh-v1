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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Coins,
  History,
  Loader2,
  Wallet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminFetch";

const apiURL = __API_URL__;

interface EventRow {
  eventId: string;
  title: string;
  startDate: string;
  endDate?: string;
  status?: string;
  ticketsSold: number;
  stallsSold: number;
  tablesBooked: number;
  chairsBooked: number;
  speakersBooked: number;
  workshopsBooked: number;
  sponsorsConfirmed: number;
  suppliersConfirmed: number;
  amount: number;
}

interface MembershipRow {
  _id: string;
  exhibitorName: string;
  planName: string;
  amountPaid: number;
  fee: number;
}

interface LedgerEntry {
  _id: string;
  type: "topup" | "debit" | "credit" | "admin_adjust" | "baseline";
  amount: number;
  balanceAfter: number;
  eventId: string | null;
  category?: string;
  description?: string;
  createdAt: string;
}

interface WalletResponse {
  organizer: {
    _id: string;
    name?: string;
    organizationName?: string;
    country?: string;
  };
  wallet: { organizerId: string; balance: number };
  events: EventRow[];
  memberships?: { totalOwed: number; rows: MembershipRow[] };
  ledger: LedgerEntry[];
  region: { scheme: "UPI" | "PAYNOW"; currency: string } | null;
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

const LEDGER_LABEL: Record<LedgerEntry["type"], string> = {
  topup: "Top-up",
  debit: "Fee",
  credit: "Refund",
  admin_adjust: "Adjustment",
  baseline: "Baseline",
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
  const [data, setData] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownResponse | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const fetchWallet = async () => {
    if (!organizerId) return;
    setLoading(true);
    try {
      const res = await adminFetch(
        `${apiURL}/tokens/admin/organizer/${organizerId}`,
      );
      if (res.status === 401) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as WalletResponse;
      setData(json);
    } catch (e: any) {
      toast({
        title: "Failed to load token wallet",
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
      setShowAdjust(false);
      setAdjustDelta("");
      setAdjustNote("");
      fetchWallet();
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

  const submitAdjust = async () => {
    if (!organizerId) return;
    const delta = Number(adjustDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      toast({
        title: "Enter a non-zero amount",
        description: "Positive credits tokens, negative debits them.",
        variant: "destructive",
      });
      return;
    }
    setAdjusting(true);
    try {
      const res = await adminFetch(
        `${apiURL}/tokens/admin/organizer/${organizerId}/adjust`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delta, note: adjustNote }),
        },
      );
      if (res.status === 401) return;
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      toast({ title: "Wallet adjusted" });
      setShowAdjust(false);
      setAdjustDelta("");
      setAdjustNote("");
      await fetchWallet();
    } catch (e: any) {
      toast({
        title: "Couldn't adjust wallet",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setAdjusting(false);
    }
  };

  const balance = data?.wallet?.balance ?? 0;
  const ledger = data?.ledger || [];
  const lifetimeToppedUp = ledger
    .filter((l) => l.type === "topup")
    .reduce((s, l) => s + l.amount, 0);
  const lifetimeUsed = ledger
    .filter((l) => l.type === "debit")
    .reduce((s, l) => s + l.amount, 0);

  const summary = useMemo(
    () => [
      {
        label: "Balance",
        value: `${balance} tokens`,
        color: balance < 0 ? "text-rose-600" : "text-emerald-600",
      },
      {
        label: "Lifetime topped up",
        value: `${lifetimeToppedUp} tokens`,
        color: "text-slate-900",
      },
      {
        label: "Lifetime used",
        value: `${lifetimeUsed} tokens`,
        color: "text-slate-900",
      },
    ],
    [balance, lifetimeToppedUp, lifetimeUsed],
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-amber-600" />
              {data?.organizer.organizationName ||
                data?.organizer.name ||
                "Organizer tokens"}
            </DialogTitle>
            <DialogDescription>
              One prepaid token wallet shared across every event this
              organizer runs — 1 token = 1 unit of{" "}
              {data?.region?.currency || "their local currency"}.
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
                {summary.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg border bg-slate-50 px-4 py-3"
                  >
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {s.label}
                    </div>
                    <div className={`text-2xl font-bold ${s.color}`}>
                      {s.value}
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
                          <TableHead className="text-center">Tickets</TableHead>
                          <TableHead className="text-center">Stalls sold</TableHead>
                          <TableHead className="text-center">Tables booked</TableHead>
                          <TableHead className="text-center">Chairs</TableHead>
                          <TableHead className="text-center">Speakers</TableHead>
                          <TableHead className="text-center">Workshops</TableHead>
                          <TableHead className="text-center">Sponsors</TableHead>
                          <TableHead className="text-center">Suppliers</TableHead>
                          <TableHead className="text-right">Tokens used</TableHead>
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
                              {e.ticketsSold}
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
                            <TableCell className="text-center">
                              {e.workshopsBooked}
                            </TableCell>
                            <TableCell className="text-center">
                              {e.sponsorsConfirmed}
                            </TableCell>
                            <TableCell className="text-center">
                              {e.suppliersConfirmed}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {e.amount.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Memberships — organizer-scoped usage, separate from the
                  per-event grid above. Only rendered when there's at
                  least one active membership for this organizer. */}
              {data.memberships && data.memberships.rows.length > 0 && (
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
                          <TableHead>Exhibitor</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead className="text-right">Paid to organizer</TableHead>
                          <TableHead className="text-right">Tokens used</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.memberships.rows.map((m) => (
                          <TableRow key={m._id}>
                            <TableCell>{m.exhibitorName || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{m.planName}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {m.amountPaid.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {m.fee.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/40">
                          <TableCell colSpan={3} className="text-right">
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                              Total
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {data.memberships.totalOwed.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Adjust wallet — direct credit/debit + note. Also the tool
                  for one-time legacy-balance seeding at cutover. */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    Adjust wallet
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAdjust((v) => !v)}
                  >
                    {showAdjust ? "Cancel" : "Adjust"}
                  </Button>
                </div>
                {showAdjust && (
                  <div className="rounded-md border bg-slate-50 p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                      <div>
                        <Label className="text-xs">
                          Delta (+ credit / − debit)
                        </Label>
                        <Input
                          type="number"
                          step="1"
                          value={adjustDelta}
                          onChange={(e) => setAdjustDelta(e.target.value)}
                          placeholder="e.g. 500 or -200"
                          disabled={adjusting}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Note</Label>
                        <Input
                          value={adjustNote}
                          onChange={(e) => setAdjustNote(e.target.value)}
                          placeholder="Reason for this adjustment"
                          disabled={adjusting}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={submitAdjust} disabled={adjusting}>
                          {adjusting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Saving…
                            </>
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Ledger */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 flex items-center gap-2 mb-2">
                  <History className="h-4 w-4" />
                  Recent activity ({ledger.length})
                </h3>
                {ledger.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">
                    No wallet activity yet.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.map((l) => {
                          const isBaseline = l.type === "baseline";
                          const isCredit =
                            l.type === "topup" || l.type === "credit";
                          return (
                            <TableRow key={l._id}>
                              <TableCell className="text-xs text-slate-500">
                                {new Date(l.createdAt).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    isBaseline
                                      ? "text-slate-500 border-slate-200"
                                      : isCredit
                                        ? "text-emerald-600 border-emerald-200"
                                        : "text-rose-600 border-rose-200"
                                  }
                                >
                                  {isBaseline ? null : isCredit ? (
                                    <ArrowUpCircle className="h-3 w-3 mr-1" />
                                  ) : (
                                    <ArrowDownCircle className="h-3 w-3 mr-1" />
                                  )}
                                  {LEDGER_LABEL[l.type]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {l.description || "—"}
                                {isBaseline && (
                                  <div className="text-xs text-slate-400">
                                    Not charged
                                  </div>
                                )}
                              </TableCell>
                              <TableCell
                                className={`text-right font-semibold ${
                                  isBaseline
                                    ? "text-slate-400 font-normal"
                                    : isCredit
                                      ? "text-emerald-600"
                                      : "text-rose-600"
                                }`}
                              >
                                {isBaseline ? "" : isCredit ? "+" : "-"}
                                {l.amount}
                              </TableCell>
                              <TableCell className="text-right text-slate-500">
                                {l.balanceAfter}
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
