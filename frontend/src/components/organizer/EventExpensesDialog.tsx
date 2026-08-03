import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Receipt,
  Paperclip,
  CheckCircle2,
  XCircle,
  Trash2,
  Clock,
} from "lucide-react";

const apiURL = __API_URL__;

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

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-warning/15 text-warning",
  Approved: "bg-success/15 text-success",
  Rejected: "bg-destructive/15 text-destructive",
};

interface Expense {
  _id: string;
  title: string;
  category: string;
  amount: number;
  spentAt?: string;
  paidTo?: string;
  notes?: string;
  receipt?: string;
  recordedBy?: string;
  recordedByRole?: string;
  status: string;
  approvedBy?: string;
  approvedByRole?: string;
  decidedAt?: string;
  rejectionReason?: string;
}

function currencySymbol(country?: string): string {
  return country === "SG" ? "SG$" : "₹";
}
function money(amount: number, country?: string): string {
  return `${currencySymbol(country)}${Number(amount || 0).toLocaleString()}`;
}

/**
 * Event expenses with their approval cycle.
 *
 * Anyone on the team — organizer or operator — can log spend. It stays
 * Pending, and out of the event's profit figure, until the organizer or an
 * operator granted approval rights signs it off.
 */
export default function EventExpensesDialog({
  open,
  onClose,
  eventId,
  eventTitle,
}: {
  open: boolean;
  onClose: () => void;
  eventId?: string;
  eventTitle?: string;
}) {
  const [rows, setRows] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  // Organizer's country code ("SG" / "IN"), so amounts match the rest of the
  // app rather than defaulting.
  const [currency, setCurrency] = useState<string>("IN");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [paidTo, setPaidTo] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const authHeader = () => {
    const token = sessionStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiURL}/expenses/event/${eventId}`, {
        headers: authHeader(),
      });
      const j = await res.json();
      setRows(Array.isArray(j?.data) ? j.data : []);
      setTotal(Number(j?.total) || 0);
      setPendingTotal(Number(j?.pendingTotal) || 0);
      if (j?.currency) setCurrency(j.currency);
    } catch {
      toast({ variant: "destructive", title: "Couldn't load expenses" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const add = async () => {
    if (!eventId) return;
    if (!title.trim() || !Number(amount)) {
      toast({
        variant: "destructive",
        title: "A description and an amount are required",
      });
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("eventId", eventId);
      fd.append("title", title.trim());
      fd.append("amount", String(Number(amount)));
      fd.append("category", category);
      if (paidTo.trim()) fd.append("paidTo", paidTo.trim());
      if (notes.trim()) fd.append("notes", notes.trim());
      if (receipt) fd.append("receipt", receipt);
      const res = await fetch(`${apiURL}/expenses`, {
        method: "POST",
        headers: authHeader(),
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "");
      setTitle("");
      setAmount("");
      setPaidTo("");
      setNotes("");
      setCategory("Other");
      setReceipt(null);
      setAddOpen(false);
      await load();
      toast({
        title: "Expense submitted",
        description: "It'll count once an approver signs it off.",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't record the expense",
        description: e?.message || undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const decide = async (row: Expense, approve: boolean) => {
    let reason: string | undefined;
    if (!approve) {
      reason = window.prompt("Reason for rejecting this expense?") || undefined;
      if (reason === undefined) return;
    }
    setDecidingId(row._id);
    try {
      const res = await fetch(`${apiURL}/expenses/${row._id}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ approve, reason }),
      });
      const j = await res.json();
      // Surfaces "you don't have permission" rather than a generic failure.
      if (!res.ok) throw new Error(j?.message || "");
      await load();
      toast({ title: j.message });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't update the expense",
        description: e?.message || undefined,
      });
    } finally {
      setDecidingId(null);
    }
  };

  const remove = async (row: Expense) => {
    try {
      const res = await fetch(`${apiURL}/expenses/${row._id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error();
      await load();
      toast({ title: "Expense removed" });
    } catch {
      toast({ variant: "destructive", title: "Couldn't remove the expense" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Expenses
            {eventTitle ? ` — ${eventTitle}` : ""}
          </DialogTitle>
          <DialogDescription>
            Anything you or an operator paid for out of pocket. Each entry needs
            approval before it counts against the event's profit.
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 flex-1 space-y-3 overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border p-3 text-center">
              <div className="text-lg font-bold text-success">
                {money(total, currency)}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Approved
              </div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <div className="text-lg font-bold text-warning">
                {money(pendingTotal, currency)}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Awaiting approval
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setAddOpen((o) => !o)}>
              <Plus className="mr-1 h-4 w-4" /> Add expense
            </Button>
          </div>

          {addOpen && (
            <div className="grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">What was it for? *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Taxi to venue, banner printing"
                />
              </div>
              <div>
                <Label className="text-xs">Amount *</Label>
                <Input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={currencySymbol(currency)}
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Paid to</Label>
                <Input
                  value={paidTo}
                  onChange={(e) => setPaidTo(e.target.value)}
                  placeholder="Shop / person"
                />
              </div>
              <div>
                <Label className="text-xs">Receipt (image or PDF)</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Note (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={add} disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit for approval
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing logged yet. Anything you or an operator paid for out of
              pocket belongs here.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r._id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.title}</span>
                        <Badge
                          className={`${STATUS_STYLES[r.status] || "bg-stone-100 text-stone-600"} hover:bg-transparent`}
                        >
                          {r.status}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {r.category}
                        {r.paidTo ? ` · ${r.paidTo}` : ""}
                        {r.spentAt
                          ? ` · ${new Date(r.spentAt).toLocaleDateString()}`
                          : ""}
                        {r.recordedBy
                          ? ` · added by ${r.recordedBy}${r.recordedByRole ? ` (${r.recordedByRole})` : ""}`
                          : ""}
                      </div>
                      {r.status === "Approved" && r.approvedBy && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          Approved by {r.approvedBy}
                          {r.approvedByRole ? ` (${r.approvedByRole})` : ""}
                          {r.decidedAt
                            ? ` on ${new Date(r.decidedAt).toLocaleDateString()}`
                            : ""}
                        </div>
                      )}
                      {r.status === "Rejected" && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-destructive">
                          <XCircle className="h-3 w-3" />
                          Rejected
                          {r.approvedBy ? ` by ${r.approvedBy}` : ""}
                          {r.rejectionReason ? ` — ${r.rejectionReason}` : ""}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.receipt && (
                        <a
                          href={`${apiURL}${r.receipt}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          title="View receipt"
                        >
                          <Paperclip className="h-3.5 w-3.5" /> Invoice
                        </a>
                      )}
                      <span className="font-semibold">
                        {money(r.amount, currency)}
                      </span>
                    </div>
                  </div>

                  {r.status === "Pending" && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
                      <span className="flex items-center gap-1 text-[11px] text-warning">
                        <Clock className="h-3 w-3" /> Awaiting approval
                      </span>
                      <div className="ml-auto flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-success/30 text-success hover:bg-success/10"
                          onClick={() => decide(r, true)}
                          disabled={decidingId === r._id}
                        >
                          {decidingId === r._id ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/30 text-destructive hover:bg-destructive/10"
                          onClick={() => decide(r, false)}
                          disabled={decidingId === r._id}
                        >
                          <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(r)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t pt-3">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
