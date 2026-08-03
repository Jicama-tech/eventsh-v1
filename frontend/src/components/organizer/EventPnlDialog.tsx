import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Download,
  Receipt,
  Paperclip,
} from "lucide-react";

const apiURL = __API_URL__;

interface PnlLine {
  key: string;
  label: string;
  amount: number;
  count: number;
}
const EXPENSE_CATEGORIES = [
  "Venue",
  "Staff",
  "Marketing",
  "Printing",
  "Transport",
  "Food & Beverage",
  "Equipment",
  "Permits & Licences",
  "Other",
];

/** One approved expense, itemised beneath the cost breakdown. */
interface ExpenseRow {
  _id: string;
  title: string;
  category: string;
  amount: number;
  spentAt?: string;
  paidTo?: string;
  receipt?: string;
  recordedBy?: string;
  recordedByRole?: string;
  approvedBy?: string;
}

interface Pnl {
  event: { id: string; title: string; startDate?: string; endDate?: string };
  currency: string;
  revenue: PnlLine[];
  costs: PnlLine[];
  totals: {
    revenue: number;
    costs: number;
    netProfit: number;
    margin: number | null;
  };
  expected: {
    exhibitorOutstanding: number;
    speakerOutstanding: number;
    sponsorPipeline: number;
    supplierOutstanding: number;
    /** Logged but not yet approved — excluded from the cost total. */
    pendingExpenses?: number;
  };
}

function currencySymbol(country?: string): string {
  return country === "SG" ? "SG$" : "₹";
}
function money(amount: number, country?: string): string {
  const n = Number(amount || 0);
  const sign = n < 0 ? "-" : "";
  return `${sign}${currencySymbol(country)}${Math.abs(n).toLocaleString()}`;
}
/** jsPDF's built-in Helvetica has no ₹ glyph — use the ISO code in exports. */
function moneyPdf(amount: number, country?: string): string {
  const n = Number(amount || 0);
  const sign = n < 0 ? "-" : "";
  const iso = country === "SG" ? "SGD" : "INR";
  return `${sign}${iso} ${Math.abs(n).toLocaleString()}`;
}

/**
 * Profit-and-loss report for a single event, opened from the event's action
 * row next to Venue Layout. Downloadable as a PDF.
 */
export default function EventPnlDialog({
  open,
  onClose,
  eventId,
}: {
  open: boolean;
  onClose: () => void;
  eventId?: string;
}) {
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  // The individual approved expenses behind the "Other expenses" cost line.
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);


  const authHeader = () => {
    const token = sessionStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  useEffect(() => {
    if (!open || !eventId) return;
    let cancelled = false;
    setLoading(true);
    setPnl(null);
    (async () => {
      try {
        const [pRes, eRes] = await Promise.all([
          fetch(`${apiURL}/analytics/event/${eventId}/pnl`, {
            headers: authHeader(),
          }),
          // Itemises the "Other expenses" line — approved entries only, since
          // those are the ones counted.
          fetch(`${apiURL}/expenses/event/${eventId}`, { headers: authHeader() }),
        ]);
        const j = await pRes.json();
        const eJson = eRes.ok ? await eRes.json() : null;
        if (cancelled) return;
        if (!pRes.ok) throw new Error(j?.message || "");
        setPnl(j.data);
        setExpenses(
          (eJson?.data || []).filter((x: any) => x.status === "Approved"),
        );
      } catch {
        if (!cancelled) {
          toast({ variant: "destructive", title: "Couldn't build the report" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  // Text-based PDF (not a screenshot) so the figures stay selectable.
  const downloadPdf = async () => {
    if (!pnl) return;
    setPdfBusy(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const left = 48;
      const right = pageW - 48;
      const cur = pnl.currency;
      let y = 60;

      pdf.setFontSize(18).setFont("helvetica", "bold");
      pdf.text("Profit & Loss", left, y);
      y += 20;
      pdf.setFontSize(11).setFont("helvetica", "normal");
      pdf.text(pnl.event.title || "Event", left, y);
      y += 14;
      pdf.setTextColor(110);
      pdf.text(
        `${pnl.event.startDate ? new Date(pnl.event.startDate).toLocaleDateString() : ""}   ·   Generated ${new Date().toLocaleDateString()}`,
        left,
        y,
      );
      pdf.setTextColor(0);
      y += 24;

      const section = (title: string, lines: PnlLine[], total: number) => {
        pdf.setFont("helvetica", "bold").setFontSize(12);
        pdf.text(title, left, y);
        y += 6;
        pdf.setDrawColor(220).line(left, y, right, y);
        y += 14;
        pdf.setFont("helvetica", "normal").setFontSize(10);
        for (const l of lines) {
          pdf.text(`${l.label}  (${l.count})`, left, y);
          pdf.text(moneyPdf(l.amount, cur), right, y, { align: "right" });
          y += 16;
        }
        pdf.setFont("helvetica", "bold");
        pdf.text("Total", left, y);
        pdf.text(moneyPdf(total, cur), right, y, { align: "right" });
        y += 26;
      };

      section("Money in", pnl.revenue, pnl.totals.revenue);
      section("Money out", pnl.costs, pnl.totals.costs);

      pdf.setDrawColor(150).line(left, y - 10, right, y - 10);
      pdf.setFont("helvetica", "bold").setFontSize(14);
      pdf.text("Net profit", left, y + 8);
      pdf.text(moneyPdf(pnl.totals.netProfit, cur), right, y + 8, {
        align: "right",
      });
      y += 30;
      if (pnl.totals.margin !== null) {
        pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(110);
        pdf.text(`${pnl.totals.margin}% margin`, right, y, { align: "right" });
        pdf.setTextColor(0);
        y += 22;
      }

      if (expenses.length) {
        y += 6;
        pdf.setFont("helvetica", "bold").setFontSize(11);
        pdf.text("What the other expenses were", left, y);
        y += 16;
        pdf.setFont("helvetica", "normal").setFontSize(9);
        for (const x of expenses) {
          const meta = [x.category, x.paidTo].filter(Boolean).join(" · ");
          pdf.text(`${x.title}${meta ? `  (${meta})` : ""}`, left + 10, y);
          pdf.text(moneyPdf(x.amount, cur), right, y, { align: "right" });
          y += 14;
        }
        y += 8;
      }

      const e = pnl.expected;
      const pendingLines = [
        e.exhibitorOutstanding > 0 &&
          `${moneyPdf(e.exhibitorOutstanding, cur)} owed by exhibitors`,
        e.sponsorPipeline > 0 &&
          `${moneyPdf(e.sponsorPipeline, cur)} in sponsorships awaiting verification`,
        e.speakerOutstanding > 0 &&
          `${moneyPdf(e.speakerOutstanding, cur)} in unpaid speaker fees`,
        e.supplierOutstanding > 0 &&
          `${moneyPdf(e.supplierOutstanding, cur)} still owed to suppliers`,
      ].filter(Boolean) as string[];

      if (pendingLines.length) {
        y += 10;
        pdf.setFont("helvetica", "bold").setFontSize(11);
        pdf.text("Not counted yet", left, y);
        y += 16;
        pdf.setFont("helvetica", "normal").setFontSize(10);
        for (const line of pendingLines) {
          pdf.text(`•  ${line}`, left, y);
          y += 15;
        }
      }

      pdf.setFontSize(8).setTextColor(140);
      pdf.text(
        "Only settled money is included in the totals. Generated by EventSH.",
        left,
        pdf.internal.pageSize.getHeight() - 36,
      );

      const safe = (pnl.event.title || "event").replace(/[^a-z0-9]+/gi, "_");
      pdf.save(`${safe}-P&L.pdf`);
      toast({ title: "PDF downloaded" });
    } catch {
      toast({ variant: "destructive", title: "PDF export failed" });
    } finally {
      setPdfBusy(false);
    }
  };

  const cur = pnl?.currency;
  const net = pnl?.totals.netProfit ?? 0;
  const profitable = net >= 0;
  const e = pnl?.expected;
  const anyPending =
    !!e &&
    e.exhibitorOutstanding +
      e.speakerOutstanding +
      e.sponsorPipeline +
      e.supplierOutstanding +
      (e.pendingExpenses || 0) >
      0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> P&amp;L Report
          </DialogTitle>
          <DialogDescription>
            {pnl?.event.title || "Everything in, everything out, per event."}
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 flex-1 space-y-4 overflow-y-auto pr-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !pnl ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Couldn't build this report.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                    <ArrowUpRight className="h-3.5 w-3.5 text-success" /> Money
                    in
                  </div>
                  <div className="mt-1 text-2xl font-bold text-success">
                    {money(pnl.totals.revenue, cur)}
                  </div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                    <ArrowDownRight className="h-3.5 w-3.5 text-destructive" /> Money
                    out
                  </div>
                  <div className="mt-1 text-2xl font-bold text-destructive">
                    {money(pnl.totals.costs, cur)}
                  </div>
                </div>
                <div
                  className={`rounded-2xl border-2 p-4 ${
                    profitable
                      ? "border-success/30 bg-success/10"
                      : "border-destructive/30 bg-destructive/10"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                    {profitable ? (
                      <TrendingUp className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    )}
                    Net profit
                  </div>
                  <div
                    className={`mt-1 text-2xl font-bold ${
                      profitable ? "text-success" : "text-destructive"
                    }`}
                  >
                    {money(net, cur)}
                  </div>
                  {pnl.totals.margin !== null && (
                    <div className="text-xs text-muted-foreground">
                      {pnl.totals.margin}% margin
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <section className="rounded-xl border">
                  <h4 className="border-b bg-success/10 px-3 py-2 text-sm font-semibold text-success">
                    Money in
                  </h4>
                  <ul className="divide-y">
                    {pnl.revenue.map((r) => (
                      <li
                        key={r.key}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <span>
                          {r.label}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({r.count})
                          </span>
                        </span>
                        <span className="shrink-0 font-medium">
                          {money(r.amount, cur)}
                        </span>
                      </li>
                    ))}
                    <li className="flex justify-between px-3 py-2 text-sm font-bold">
                      <span>Total</span>
                      <span>{money(pnl.totals.revenue, cur)}</span>
                    </li>
                  </ul>
                </section>

                <section className="rounded-xl border">
                  <h4 className="border-b bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                    Money out
                  </h4>
                  <ul className="divide-y">
                    {pnl.costs.map((r) => (
                      <li
                        key={r.key}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <span>
                          {r.label}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({r.count})
                          </span>
                        </span>
                        <span className="shrink-0 font-medium">
                          {money(r.amount, cur)}
                        </span>
                      </li>
                    ))}
                    <li className="flex justify-between px-3 py-2 text-sm font-bold">
                      <span>Total</span>
                      <span>{money(pnl.totals.costs, cur)}</span>
                    </li>
                  </ul>
                </section>
              </div>

              {/* What the "Other expenses" line is actually made of */}
              {expenses.length > 0 && (
                <section className="rounded-xl border">
                  <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
                    <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                      <Receipt className="h-4 w-4 text-primary" /> What the other
                      expenses were
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {expenses.length} approved
                    </span>
                  </div>
                  <ul className="divide-y">
                    {expenses.map((x) => (
                      <li
                        key={x._id}
                        className="flex items-start justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium">{x.title}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {x.category}
                            {x.paidTo ? ` · paid to ${x.paidTo}` : ""}
                            {x.spentAt
                              ? ` · ${new Date(x.spentAt).toLocaleDateString()}`
                              : ""}
                            {x.recordedBy ? ` · by ${x.recordedBy}` : ""}
                            {x.approvedBy ? ` · approved by ${x.approvedBy}` : ""}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {x.receipt && (
                            <a
                              href={`${apiURL}${x.receipt}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                              title="View receipt"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <span className="font-medium">
                            {money(x.amount, cur)}
                          </span>
                        </div>
                      </li>
                    ))}
                    <li className="flex justify-between px-3 py-2 text-sm font-bold">
                      <span>Total</span>
                      <span>
                        {money(
                          expenses.reduce((t, x) => t + (Number(x.amount) || 0), 0),
                          cur,
                        )}
                      </span>
                    </li>
                  </ul>
                </section>
              )}

              {anyPending && e && (
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                  <p className="mb-1 flex items-center gap-1.5 font-semibold">
                    <Clock className="h-3.5 w-3.5" /> Not counted yet
                  </p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {e.exhibitorOutstanding > 0 && (
                      <span>
                        {money(e.exhibitorOutstanding, cur)} owed by exhibitors
                      </span>
                    )}
                    {e.sponsorPipeline > 0 && (
                      <span>
                        {money(e.sponsorPipeline, cur)} in sponsorships awaiting
                        verification
                      </span>
                    )}
                    {e.speakerOutstanding > 0 && (
                      <span>
                        {money(e.speakerOutstanding, cur)} in unpaid speaker fees
                      </span>
                    )}
                    {e.supplierOutstanding > 0 && (
                      <span>
                        {money(e.supplierOutstanding, cur)} still owed to
                        suppliers
                      </span>
                    )}
                    {(e.pendingExpenses || 0) > 0 && (
                      <span>
                        {money(e.pendingExpenses || 0, cur)} in expenses awaiting
                        approval
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t pt-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button
            className="flex-1"
            onClick={downloadPdf}
            disabled={!pnl || pdfBusy}
          >
            {pdfBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
