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
  ArrowDownCircle,
  ArrowUpCircle,
  Award,
  Coins,
  History,
  Loader2,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BuyTokensDialog } from "./BuyTokensDialog";
import { symbolForCode } from "@/data/currencies";

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

function symbolFor(currency?: string) {
  return symbolForCode(currency);
}

const LEDGER_LABEL: Record<LedgerEntry["type"], string> = {
  topup: "Top-up",
  debit: "Fee",
  credit: "Refund",
  admin_adjust: "Adjustment",
  baseline: "Baseline",
};

export function PlatformFeesPanel() {
  const { toast } = useToast();
  const [data, setData] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [buyTokensOpen, setBuyTokensOpen] = useState(false);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${apiURL}/tokens/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
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
    fetchWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currencySymbol = symbolFor(data?.region?.currency);
  const events = data?.events || [];
  const memberships = data?.memberships || { totalOwed: 0, rows: [] };
  const ledger = data?.ledger || [];
  const balance = data?.wallet?.balance ?? 0;

  const usedThisMonth = ledger
    .filter((l) => {
      if (l.type !== "debit") return false;
      const d = new Date(l.createdAt);
      const now = new Date();
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    })
    .reduce((s, l) => s + l.amount, 0);
  const recentTopUps = ledger.filter((l) => l.type === "topup").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" /> Tokens
          </h2>
          <p className="text-muted-foreground text-sm">
            One prepaid balance shared across every event you run. 1 token
            = 1 {data?.region?.currency || "unit"}. Fees are deducted
            automatically as attendees, exhibitors, and speakers confirm.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchWallet}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setBuyTokensOpen(true)}>
            <Coins className="h-4 w-4 mr-2" />
            Buy tokens
          </Button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Balance
            </div>
            <div
              className={`text-2xl font-bold ${
                balance < 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {balance} tokens
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Used this month
            </div>
            <div className="text-2xl font-bold text-slate-700">
              {usedThisMonth} tokens
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Top-ups so far
            </div>
            <div className="text-2xl font-bold text-slate-700">
              {recentTopUps}
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
            Memberships ({memberships.rows.length})
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />
            History ({ledger.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Events
              </CardTitle>
              <CardDescription>
                Token usage per event — tickets, stalls, speakers, sponsors,
                tables, chairs, workshops, and suppliers all draw from the
                same wallet.
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
                  register, token usage will appear here.
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead className="text-center">Tickets</TableHead>
                        <TableHead className="text-center">Stalls</TableHead>
                        <TableHead className="text-center">Tables</TableHead>
                        <TableHead className="text-center">Chairs</TableHead>
                        <TableHead className="text-center">Speakers</TableHead>
                        <TableHead className="text-center">Workshops</TableHead>
                        <TableHead className="text-center">Sponsors</TableHead>
                        <TableHead className="text-center">Suppliers</TableHead>
                        <TableHead className="text-right">
                          Tokens used
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((e) => (
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
              {!data?.region && data && (
                <p className="text-xs text-amber-600 mt-2">
                  Your country doesn't have a QR scheme configured. Contact
                  support to top up tokens off-band.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memberships" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4" /> Memberships
              </CardTitle>
              <CardDescription>
                Each active exhibitor membership draws tokens from your
                wallet, same rate as every other category.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && !memberships.rows.length ? (
                <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : !memberships.rows.length ? (
                <div className="py-10 text-center text-slate-500">
                  No active exhibitor memberships yet — once one is
                  confirmed, token usage appears here.
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Exhibitor</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead className="text-right">
                          Paid to you
                        </TableHead>
                        <TableHead className="text-right">
                          Tokens used
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memberships.rows.map((m) => (
                        <TableRow key={m._id}>
                          <TableCell>
                            <div className="font-medium">
                              {m.exhibitorName || "—"}
                            </div>
                          </TableCell>
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
                            Total tokens used
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {memberships.totalOwed.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" /> Recent activity
              </CardTitle>
              <CardDescription>
                Every top-up, fee deduction, refund, and admin adjustment to
                your wallet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && !ledger.length ? (
                <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : !ledger.length ? (
                <div className="py-10 text-center text-slate-500">
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
                        const isCredit = l.type === "topup" || l.type === "credit";
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BuyTokensDialog
        open={buyTokensOpen}
        onClose={() => setBuyTokensOpen(false)}
        onSubmitted={() => {
          setBuyTokensOpen(false);
          fetchWallet();
        }}
      />
    </div>
  );
}
