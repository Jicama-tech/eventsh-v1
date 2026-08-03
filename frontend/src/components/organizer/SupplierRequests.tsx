import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Link2,
  Loader2,
  ClipboardList,
  Save,
  Inbox,
  Eye,
  CheckCircle2,
  XCircle,
  Handshake,
  Clock,
  Paperclip,
  Building2,
  Phone,
  Mail,
  Wallet,
  Sparkles,
  PackageOpen,
} from "lucide-react";

const apiURL = __API_URL__;

interface RequirementItem {
  id: string;
  label: string;
  description?: string;
  quantity?: string;
}

// Per-requirement coverage: what's committed, by whom, and what's left.
interface FulfilmentRow {
  id: string;
  label: string;
  required: number;
  served: number;
  remaining: number;
  tracked: boolean;
  fullyServed: boolean;
  suppliers: Array<{ supplierName: string; quantity: number; price: number }>;
}

interface SupplierConfig {
  enabled: boolean;
  linkPath?: string;
  currency: string;
  requirements: RequirementItem[];
  instructions: string;
}

interface QuotationItem {
  requirementLabel: string;
  quantity?: number;
  price: number;
  note?: string;
  checkedInQty?: number;
  checkedOutQty?: number;
}
// One transfer towards the quote — organizers commonly pay an advance first
// and the balance later.
interface PaymentInstallment {
  amount: number;
  paidDate?: string;
  method?: string;
  reference?: string;
  proofScreenshot?: string;
  notes?: string;
  recordedBy?: string;
}
interface StatusHistoryEntry {
  status: string;
  note?: string;
  changedAt: string;
  changedBy?: string;
}
interface Quotation {
  _id: string;
  status: string;
  quotationTotal: number;
  /** Set once a price is negotiated — this is what's actually owed. */
  agreedTotal?: number;
  quotationNotes?: string;
  quotationAttachment?: string;
  validUntil?: string;
  createdAt: string;
  quotationItems?: QuotationItem[];
  accountDetails?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscSwiftUen?: string;
    upiPaynowId?: string;
  };
  payment?: {
    amountPaid?: number;
    // Outstanding difference (quote − paid so far), maintained by the backend.
    balanceDue?: number;
    installments?: PaymentInstallment[];
    reference?: string;
    proofScreenshot?: string;
    invoice?: string;
    confirmedBySupplier?: boolean;
    notes?: string;
  };
  statusHistory?: StatusHistoryEntry[];
  supplierId?: {
    name?: string;
    companyName?: string;
    serviceCategory?: string;
    email?: string;
    businessEmail?: string;
    phone?: string;
  };
}

// SG$ for Singapore, ₹ (INR) for everything else — matches the app convention.
function currencySymbol(country?: string): string {
  return country === "SG" ? "SG$" : "₹";
}
function money(amount: number, country?: string): string {
  return `${currencySymbol(country)}${Number(amount || 0).toLocaleString()}`;
}

const STATUS_STYLES: Record<string, string> = {
  Quoted: "bg-warning/15 text-warning",
  Approved: "bg-primary/15 text-primary",
  Negotiating: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "Partially Paid": "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  Paid: "bg-success/15 text-success",
  Completed: "bg-success/15 text-success",
  Rejected: "bg-destructive/15 text-destructive",
  Cancelled: "bg-muted text-muted-foreground",
};

// Paid-so-far / outstanding for a quotation. Prefers the balance the backend
// maintains, falling back to the difference for records written before
// part-payments existed.
/** Negotiated figure when there is one, else the original quote. */
function payableOf(q: Quotation): number {
  const agreed = Number(q.agreedTotal);
  return Number.isFinite(agreed) && agreed > 0
    ? agreed
    : Number(q.quotationTotal) || 0;
}

function paymentSummary(q: Quotation) {
  const total = payableOf(q);
  const paid = Number(q.payment?.amountPaid) || 0;
  const balance =
    q.payment?.balanceDue != null
      ? Number(q.payment.balanceDue)
      : Math.max(0, total - paid);
  return { total, paid, balance };
}

export default function SupplierRequests({ eventId }: { eventId: string }) {
  const [config, setConfig] = useState<SupplierConfig | null>(null);
  const [reqs, setReqs] = useState<RequirementItem[]>([]);
  const [instructions, setInstructions] = useState("");
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  // Requirements derived from confirmed bookings, plus the counts behind them.
  const [suggestions, setSuggestions] = useState<RequirementItem[]>([]);
  const [suggestionMeta, setSuggestionMeta] = useState<{
    stallsCounted: number;
    addOnTypes: number;
  } | null>(null);
  // True when the list on screen came from bookings and hasn't been saved yet.
  const [prefilled, setPrefilled] = useState(false);
  const [fulfilment, setFulfilment] = useState<FulfilmentRow[]>([]);

  // Quotation detail dialog + the organizer's action-note sub-dialog.
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [action, setAction] = useState<
    null | "Approved" | "Rejected" | "Negotiating"
  >(null);
  const [actionNote, setActionNote] = useState("");
  // Price agreed at this step, sent with a counter-offer or approval.
  const [actionAmount, setActionAmount] = useState("");
  // Per-line quantities the operator is receiving / returning right now.
  const [checkQty, setCheckQty] = useState<Record<string, string>>({});
  const [checkBusy, setCheckBusy] = useState<"in" | "out" | null>(null);

  // Mirror the server's rules so the buttons can't offer an impossible move:
  // nothing leaves that never arrived, and nothing is received twice.
  const venueItems = selected?.quotationItems || [];
  const anyToReturn = venueItems.some(
    (i) => (Number(i.checkedInQty) || 0) > (Number(i.checkedOutQty) || 0),
  );
  const allReceived =
    venueItems.length > 0 &&
    venueItems.every((i) => {
      const quoted = Number(i.quantity) || 0;
      return quoted > 0 && (Number(i.checkedInQty) || 0) >= quoted;
    });

  /**
   * Record goods arriving at or leaving the venue. Independent of payment —
   * a supplier often delivers before the balance is settled.
   */
  const submitCheck = async (direction: "in" | "out") => {
    if (!selected) return;
    const entries = Object.entries(checkQty)
      .map(([requirementLabel, v]) => ({
        requirementLabel,
        quantity: Number(v) || 0,
      }))
      .filter((e) => e.quantity > 0);
    if (entries.length === 0) {
      toast({
        variant: "destructive",
        title: "Enter how many you're checking " + direction,
      });
      return;
    }
    setCheckBusy(direction);
    try {
      const res = await fetch(
        `${apiURL}/suppliers/request/${selected._id}/check`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ direction, entries }),
        },
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "");
      setSelected((x) => (x ? { ...x, ...j.data } : x));
      setQuotes((qs) =>
        qs.map((q) => (q._id === j.data._id ? { ...q, ...j.data } : q)),
      );
      setCheckQty({});
      toast({
        title: direction === "in" ? "Items checked in" : "Items checked out",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't update the items",
        description: e?.message || undefined,
      });
    } finally {
      setCheckBusy(null);
    }
  };
  const [actionBusy, setActionBusy] = useState(false);
  // Record-payment sub-dialog (organizer pays the supplier + uploads proof).
  const [payOpen, setPayOpen] = useState(false);
  const [payFile, setPayFile] = useState<File | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payReference, setPayReference] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payBusy, setPayBusy] = useState(false);

  const token = sessionStorage.getItem("token");
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, qRes, sRes, fRes] = await Promise.all([
        fetch(`${apiURL}/suppliers/event/${eventId}/config`, {
          headers: authHeaders,
        }),
        fetch(`${apiURL}/suppliers/event/${eventId}`, { headers: authHeaders }),
        // What's actually sold for this event — spaces booked and add-ons
        // purchased — totalled up ready to drop into the requirements.
        fetch(`${apiURL}/suppliers/event/${eventId}/requirement-suggestions`, {
          headers: authHeaders,
        }),
        // How much of each requirement is already committed by suppliers.
        fetch(`${apiURL}/suppliers/event/${eventId}/fulfilment`, {
          headers: authHeaders,
        }),
      ]);
      const cJson = await cRes.json();
      const qJson = await qRes.json();
      const sJson = sRes.ok ? await sRes.json() : null;
      const fJson = fRes.ok ? await fRes.json() : null;
      setFulfilment(fJson?.data?.requirements || []);
      const cfg: SupplierConfig | undefined = cJson?.data;
      const suggested: RequirementItem[] = sJson?.data?.requirements || [];

      setConfig(cfg || null);
      setSuggestions(suggested);
      setSuggestionMeta(sJson?.data || null);
      setInstructions(cfg?.instructions || "");
      setQuotes(Array.isArray(qJson?.data) ? qJson.data : []);

      // Nothing saved yet → prefill straight from the bookings so the
      // organizer just reviews and saves. Once they've saved their own list
      // we leave it alone; the button below re-syncs on demand.
      const saved = cfg?.requirements || [];
      setReqs(saved.length > 0 ? saved : suggested);
      setPrefilled(saved.length === 0 && suggested.length > 0);
    } catch {
      toast({ variant: "destructive", title: "Couldn't load suppliers" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Merge the sold-items list into whatever is on screen: existing rows keep
  // the organizer's wording but take the fresh count; new ones are appended.
  const syncFromBookings = () => {
    if (suggestions.length === 0) {
      toast({
        title: "Nothing sold yet",
        description:
          "No add-ons have been purchased on this event's confirmed bookings yet.",
      });
      return;
    }
    setReqs((prev) => {
      const byId = new Map(prev.map((r) => [r.id, r]));
      for (const s of suggestions) {
        const existing = byId.get(s.id);
        byId.set(s.id, existing ? { ...existing, quantity: s.quantity } : s);
      }
      return [...byId.values()];
    });
    toast({
      title: "Requirements updated from bookings",
      description: `${suggestionMeta?.addOnTypes ?? 0} add-on(s) across ${suggestionMeta?.stallsCounted ?? 0} confirmed booking(s)`,
    });
  };

  useEffect(() => {
    load();
  }, [load]);

  const addReq = () =>
    setReqs((r) => [
      ...r,
      { id: `r${Date.now()}`, label: "", quantity: "", description: "" },
    ]);
  const updateReq = (i: number, patch: Partial<RequirementItem>) =>
    setReqs((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeReq = (i: number) =>
    setReqs((r) => r.filter((_, idx) => idx !== i));

  const saveReqs = async () => {
    // Send ONLY the fields the backend allows — the API rejects any unknown
    // property (e.g. a leftover `budget`), so we build clean objects here.
    const cleaned = reqs
      .filter((r) => r.label.trim())
      .map((r) => ({
        id: r.id,
        label: r.label.trim(),
        quantity: r.quantity || "",
        description: r.description || "",
      }));
    setSaving(true);
    try {
      const res = await fetch(`${apiURL}/suppliers/event/${eventId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ requirements: cleaned, instructions }),
      });
      if (!res.ok) throw new Error();
      const j = await res.json();
      setConfig(j.data);
      setReqs(j.data.requirements || []);
      setPrefilled(false);
      toast({ title: "Requirements saved" });
    } catch {
      toast({ variant: "destructive", title: "Couldn't save requirements" });
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (enabled: boolean) => {
    setConfig((c) => (c ? { ...c, enabled } : c)); // optimistic
    try {
      const res = await fetch(`${apiURL}/suppliers/event/${eventId}/enabled`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
      const j = await res.json();
      setConfig(j.data);
    } catch {
      toast({ variant: "destructive", title: "Couldn't update the link" });
      load();
    }
  };

  const linkUrl = config?.linkPath
    ? `${window.location.origin}${config.linkPath}`
    : "";

  const copyLink = () => {
    if (!linkUrl) return;
    navigator.clipboard?.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast({ title: "Private link copied" });
  };

  // Approve / Reject / Negotiate — sends the organizer's decision + note to the
  // request's status endpoint, then refreshes and closes both dialogs.
  const submitAction = async () => {
    if (!selected || !action) return;
    if (action !== "Approved" && !actionNote.trim()) {
      toast({
        variant: "destructive",
        title:
          action === "Rejected"
            ? "Please add a reason"
            : "Please add your offer",
      });
      return;
    }
    setActionBusy(true);
    try {
      const body: Record<string, string> = { status: action };
      if (action === "Rejected") body.rejectionReason = actionNote.trim();
      else if (actionNote.trim()) body.notes = actionNote.trim();
      // Carrying the figure through means payments settle against what was
      // actually agreed, not the original quote.
      if (action !== "Rejected" && Number(actionAmount) > 0) {
        body.agreedAmount = String(Number(actionAmount));
      }
      const res = await fetch(
        `${apiURL}/suppliers/request/${selected._id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error();
      const j = await res.json();
      const updated: Quotation = j.data;
      // Reflect the change in the open detail dialog + the table.
      setSelected((s) => (s ? { ...s, ...updated } : s));
      setQuotes((qs) =>
        qs.map((q) => (q._id === updated._id ? { ...q, ...updated } : q)),
      );
      const verb =
        action === "Approved"
          ? "approved"
          : action === "Rejected"
            ? "rejected"
            : "sent to the supplier";
      toast({ title: `Quotation ${verb}` });
      setAction(null);
      setActionNote("");
      setActionAmount("");
    } catch {
      toast({ variant: "destructive", title: "Couldn't update the quotation" });
    } finally {
      setActionBusy(false);
    }
  };

  // Organizer records the payment they made to the supplier + proof screenshot.
  const submitPayment = async () => {
    if (!selected) return;
    setPayBusy(true);
    try {
      const fd = new FormData();
      if (payFile) fd.append("proofScreenshot", payFile);
      if (payAmount.trim()) fd.append("amountPaid", payAmount.trim());
      if (payReference.trim()) fd.append("reference", payReference.trim());
      if (payNote.trim()) fd.append("notes", payNote.trim());
      const res = await fetch(
        `${apiURL}/suppliers/request/${selected._id}/record-payment`,
        { method: "POST", headers: authHeaders, body: fd },
      );
      const j = await res.json();
      // Surface the backend's reason (e.g. "already paid in full") rather than
      // a generic failure — the amount rules live server-side.
      if (!res.ok) throw new Error(j?.message || "");
      const updated: Quotation = j.data;
      setSelected((s) => (s ? { ...s, ...updated } : s));
      setQuotes((qs) =>
        qs.map((q) => (q._id === updated._id ? { ...q, ...updated } : q)),
      );
      const left = paymentSummary(updated).balance;
      toast({
        title:
          left > 0
            ? `Part payment recorded — ${money(left, currency)} still due`
            : "Payment recorded — quotation settled",
      });
      setPayOpen(false);
      setPayFile(null);
      setPayAmount("");
      setPayReference("");
      setPayNote("");
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't record the payment",
        description: e?.message || undefined,
      });
    } finally {
      setPayBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const currency = config?.currency;
  // Paid / outstanding for the quotation open in the detail dialog.
  const selectedPay = selected
    ? paymentSummary(selected)
    : { total: 0, paid: 0, balance: 0 };

  return (
    <div className="space-y-4">
      {/* ── Requirements editor ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-primary" />
            What you need from suppliers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-filled from what's sold, so the organizer reviews rather
              than retypes. */}
          {prefilled && (
            <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-primary">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Prefilled from the add-ons sold for this event —{" "}
                <strong>{suggestionMeta?.addOnTypes ?? 0}</strong> add-on(s)
                across <strong>{suggestionMeta?.stallsCounted ?? 0}</strong>{" "}
                confirmed booking(s). Edit anything you like, then Save.
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">
              Instructions (optional)
            </Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. All quotes should include GST and delivery."
              className="mt-1 min-h-[60px]"
            />
          </div>

          <div className="space-y-3">
            {reqs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No requirements yet — add the things you need suppliers to quote
                for.
              </p>
            )}
            {reqs.map((r, i) => (
              <div
                key={r.id}
                className="rounded-xl border p-3 space-y-2 bg-muted/20"
              >
                {/* Name and quantity share one line; description sits below */}
                <div className="flex items-start gap-2">
                  <Input
                    value={r.label}
                    onChange={(e) => updateReq(i, { label: e.target.value })}
                    placeholder="Requirement (e.g. Catering)"
                    className="flex-1 font-medium"
                  />
                  <Input
                    value={r.quantity || ""}
                    onChange={(e) => updateReq(i, { quantity: e.target.value })}
                    placeholder="Qty (e.g. 200)"
                    className="w-32 shrink-0 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-stone-400 hover:text-destructive"
                    onClick={() => removeReq(i)}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={r.description || ""}
                  onChange={(e) =>
                    updateReq(i, { description: e.target.value })
                  }
                  placeholder="Description (optional)"
                  className="text-sm"
                />

                {/* Quantity served — who's covering how much, and what's left */}
                {(() => {
                  const f = fulfilment.find((x) => x.id === r.id);
                  if (!f || !f.tracked) return null;
                  return (
                    <div
                      className={`rounded-lg border p-2 text-xs ${
                        f.fullyServed
                          ? "border-success/30 bg-success/10"
                          : "border-warning/30 bg-warning/10"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                        <span className="flex items-center gap-1.5">
                          {f.fullyServed ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <PackageOpen className="h-3.5 w-3.5 text-warning" />
                          )}
                          Served {f.served} of {f.required}
                        </span>
                        <span
                          className={
                            f.fullyServed ? "text-success" : "text-warning"
                          }
                        >
                          {f.fullyServed
                            ? "Fully covered"
                            : `${f.remaining} still to source`}
                        </span>
                      </div>
                      {f.suppliers.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 border-t pt-1.5">
                          {f.suppliers.map((sup, k) => (
                            <li
                              key={k}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="text-muted-foreground">
                                {sup.supplierName}
                              </span>
                              <span className="font-medium">
                                {sup.quantity} · {money(sup.price, currency)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addReq}>
              <Plus className="mr-1 h-4 w-4" /> Add requirement
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={syncFromBookings}
              title="Re-count the add-ons purchased on this event's confirmed bookings"
            >
              <Sparkles className="mr-1 h-4 w-4" /> Sync from bookings
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveReqs}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              Save requirements
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Private link ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-5 w-5 text-primary" />
            Private supplier link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Share this link with as many suppliers as you like (WhatsApp
            broadcast, email, etc.) — each supplier fills their own quotation.
            It is <strong>not</strong> shown on your public event page. Turn it
            off any time to stop accepting new quotations.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Input readOnly value={linkUrl} className="flex-1 text-xs" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={copyLink}
              disabled={!linkUrl}
            >
              {copied ? (
                <Check className="mr-1 h-4 w-4 text-success" />
              ) : (
                <Copy className="mr-1 h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={!!config?.enabled}
              onCheckedChange={toggleEnabled}
            />
            <span className="text-sm text-muted-foreground">
              {config?.enabled
                ? "Accepting quotations"
                : "Paused — turn on to accept quotations"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Quotations ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Supplier quotations
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={load}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No quotations yet. Share the link above with your suppliers.
            </p>
          ) : (
            <div className="app-scroll overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2">Supplier</th>
                    <th className="px-2 py-2">Service</th>
                    <th className="px-2 py-2 text-right">Quote</th>
                    <th className="px-2 py-2 text-center">Status</th>
                    <th className="px-2 py-2">Submitted</th>
                    <th className="px-2 py-2 text-center">View</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q._id} className="border-b last:border-0">
                      <td className="px-2 py-3">
                        <div className="font-medium">
                          {q.supplierId?.name || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {q.supplierId?.companyName || q.supplierId?.email || ""}
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        {q.supplierId?.serviceCategory || "—"}
                      </td>
                      <td className="px-2 py-3 text-right font-medium">
                        {money(q.quotationTotal, currency)}
                        {/* Show what's still owed once part of it is paid */}
                        {paymentSummary(q).paid > 0 &&
                          paymentSummary(q).balance > 0 && (
                            <div className="text-xs font-normal text-warning">
                              {money(paymentSummary(q).balance, currency)} due
                            </div>
                          )}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <Badge
                          className={`${STATUS_STYLES[q.status] || "bg-stone-100 text-stone-600"} hover:bg-transparent`}
                        >
                          {q.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-3 text-xs text-muted-foreground">
                        {q.createdAt
                          ? new Date(q.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelected(q);
                            setAction(null);
                            setActionNote("");
                            setActionAmount("");
                          }}
                          title="View quotation"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Quotation detail dialog (stall-style) ───────────────── */}
      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setAction(null);
            setActionNote("");
                            setActionAmount("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {selected.supplierId?.name || "Supplier"}
                  <Badge
                    className={`${STATUS_STYLES[selected.status] || "bg-stone-100 text-stone-600"} hover:bg-transparent`}
                  >
                    {selected.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Submitted{" "}
                  {selected.createdAt
                    ? new Date(selected.createdAt).toLocaleString()
                    : "—"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                {/* Supplier details */}
                <section className="rounded-xl border p-3">
                  <h4 className="mb-2 flex items-center gap-1.5 font-semibold">
                    <Building2 className="h-4 w-4 text-primary" /> Supplier
                    details
                  </h4>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <Detail label="Name" value={selected.supplierId?.name} />
                    <Detail
                      label="Company"
                      value={selected.supplierId?.companyName}
                    />
                    <Detail
                      label="Service"
                      value={selected.supplierId?.serviceCategory}
                    />
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {selected.supplierId?.email || "—"}
                    </div>
                    {selected.supplierId?.businessEmail && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        {selected.supplierId.businessEmail}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {selected.supplierId?.phone || "—"}
                    </div>
                  </div>
                </section>

                {/* Organizer requirements */}
                <section className="rounded-xl border p-3">
                  <h4 className="mb-2 flex items-center gap-1.5 font-semibold">
                    <ClipboardList className="h-4 w-4 text-primary" /> Your
                    requirements
                  </h4>
                  {reqs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No specific requirements were listed.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {reqs.map((r) => (
                        <li key={r.id} className="text-xs">
                          <span className="font-medium">{r.label}</span>
                          {(r.quantity || r.description) && (
                            <span className="text-muted-foreground">
                              {" — "}
                              {[r.quantity, r.description]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* The quotation */}
                <section className="rounded-xl border p-3">
                  <h4 className="mb-2 font-semibold">Quotation</h4>
                  {selected.quotationItems &&
                  selected.quotationItems.length > 0 ? (
                    <div className="space-y-1.5">
                      {selected.quotationItems.map((it, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2"
                        >
                          <span>
                            {it.requirementLabel}
                            {it.quantity ? (
                              <span className="ml-1 font-medium">
                                × {it.quantity}
                              </span>
                            ) : null}
                            {it.note ? (
                              <span className="text-xs text-muted-foreground">
                                {" "}
                                ({it.note})
                              </span>
                            ) : null}
                          </span>
                          <span className="font-medium">
                            {money(it.price, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No line items — see notes below.
                    </p>
                  )}
                  <div className="mt-2 space-y-1 border-t pt-2">
                    {selected.agreedTotal ? (
                      <>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Original quote</span>
                          <span className="line-through">
                            {money(selected.quotationTotal, currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-semibold text-primary">
                          <span>Agreed after negotiation</span>
                          <span>{money(selected.agreedTotal, currency)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between font-semibold">
                        <span>Total quote</span>
                        <span>{money(selected.quotationTotal, currency)}</span>
                      </div>
                    )}
                  </div>
                  {selected.quotationNotes && (
                    <p className="mt-2 rounded-lg bg-muted/40 p-2 text-xs">
                      {selected.quotationNotes}
                    </p>
                  )}
                  {selected.quotationAttachment && (
                    <a
                      href={`${apiURL}${selected.quotationAttachment}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5" /> View attachment
                    </a>
                  )}
                </section>

                {/* Receiving goods at the venue — available once approved,
                    regardless of how much has been paid. */}
                {["Approved", "Partially Paid", "Paid", "Completed"].includes(
                  selected.status,
                ) &&
                  (selected.quotationItems?.length || 0) > 0 && (
                    <section className="rounded-xl border p-3">
                      <h4 className="mb-2 flex items-center gap-1.5 font-semibold">
                        <PackageOpen className="h-4 w-4 text-primary" /> Items at
                        the venue
                      </h4>
                      <ul className="space-y-2">
                        {selected.quotationItems!.map((it, i) => {
                          const quoted = Number(it.quantity) || 0;
                          const inQty = Number(it.checkedInQty) || 0;
                          const outQty = Number(it.checkedOutQty) || 0;
                          return (
                            <li
                              key={i}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-2 py-1.5 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-medium">
                                  {it.requirementLabel}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {inQty} in · {outQty} out
                                  {quoted ? ` · of ${quoted} quoted` : ""}
                                  {quoted && inQty >= quoted
                                    ? " · fully received"
                                    : ""}
                                  {inQty > 0 && outQty >= inQty
                                    ? " · fully returned"
                                    : ""}
                                </div>
                              </div>
                              <Input
                                type="number"
                                min="0"
                                max={
                                  quoted
                                    ? String(Math.max(quoted - inQty, inQty - outQty))
                                    : undefined
                                }
                                className="h-8 w-24"
                                placeholder="Qty"
                                value={checkQty[it.requirementLabel] || ""}
                                onChange={(e) =>
                                  setCheckQty((p) => ({
                                    ...p,
                                    [it.requirementLabel]: e.target.value,
                                  }))
                                }
                              />
                            </li>
                          );
                        })}
                      </ul>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-success/30 text-success hover:bg-success/10"
                          onClick={() => submitCheck("in")}
                          disabled={checkBusy !== null || allReceived}
                        >
                          {checkBusy === "in" ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <PackageOpen className="mr-1.5 h-4 w-4" />
                          )}
                          Check in
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => submitCheck("out")}
                          disabled={checkBusy !== null || !anyToReturn}
                        >
                          Check out
                        </Button>
                      </div>
                      {/* Say why a button is off rather than leaving it dead. */}
                      {!anyToReturn && (
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          Nothing to check out yet — items have to be checked in
                          first.
                        </p>
                      )}
                      {allReceived && (
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          Every item has been fully checked in.
                        </p>
                      )}
                    </section>
                  )}

                {/* Payout account details */}
                {selected.accountDetails &&
                  (selected.accountDetails.accountHolderName ||
                    selected.accountDetails.bankName ||
                    selected.accountDetails.accountNumber ||
                    selected.accountDetails.upiPaynowId) && (
                    <section className="rounded-xl border p-3">
                      <h4 className="mb-2 flex items-center gap-1.5 font-semibold">
                        <Wallet className="h-4 w-4 text-primary" /> Payout
                        account
                      </h4>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        <Detail
                          label="Account holder"
                          value={selected.accountDetails.accountHolderName}
                        />
                        <Detail
                          label="Bank"
                          value={selected.accountDetails.bankName}
                        />
                        <Detail
                          label="Account no."
                          value={selected.accountDetails.accountNumber}
                        />
                        <Detail
                          label="IFSC / SWIFT / UEN"
                          value={selected.accountDetails.ifscSwiftUen}
                        />
                        <Detail
                          label="UPI / PayNow"
                          value={selected.accountDetails.upiPaynowId}
                        />
                      </div>
                    </section>
                  )}

                {/* Payment — running total across instalments + what's left */}
                {selected.payment &&
                  (selected.payment.proofScreenshot ||
                    selected.payment.invoice ||
                    selected.payment.amountPaid) && (
                    <section className="rounded-xl border p-3">
                      <h4 className="mb-2 flex items-center gap-1.5 font-semibold">
                        <Wallet className="h-4 w-4 text-primary" /> Payment
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total quote
                          </span>
                          <span>{money(selectedPay.total, currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Paid so far
                          </span>
                          <span className="font-medium text-success">
                            {money(selectedPay.paid, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-1.5 font-semibold">
                          <span>Balance due</span>
                          <span
                            className={
                              selectedPay.balance > 0
                                ? "text-warning"
                                : "text-success"
                            }
                          >
                            {money(selectedPay.balance, currency)}
                          </span>
                        </div>

                        {/* Instalment breakdown */}
                        {(selected.payment.installments?.length || 0) > 0 && (
                          <ul className="space-y-1 border-t pt-1.5">
                            {selected.payment.installments!.map((p, i) => (
                              <li
                                key={i}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="min-w-0 text-muted-foreground">
                                  {p.paidDate
                                    ? new Date(p.paidDate).toLocaleDateString()
                                    : `Payment ${i + 1}`}
                                  {p.reference ? ` · ${p.reference}` : ""}
                                  {p.proofScreenshot && (
                                    <a
                                      href={`${apiURL}${p.proofScreenshot}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="ml-1.5 inline-flex items-center text-primary hover:underline"
                                      title="View proof"
                                    >
                                      <Paperclip className="h-3 w-3" />
                                    </a>
                                  )}
                                </span>
                                <span className="shrink-0 font-medium">
                                  {money(p.amount, currency)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="flex flex-wrap gap-3 pt-1">
                          {selected.payment.proofScreenshot && (
                            <a
                              href={`${apiURL}${selected.payment.proofScreenshot}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                            >
                              <Paperclip className="h-3.5 w-3.5" /> Latest
                              payment proof
                            </a>
                          )}
                          {selected.payment.invoice && (
                            <a
                              href={`${apiURL}${selected.payment.invoice}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                            >
                              <Paperclip className="h-3.5 w-3.5" /> Supplier
                              invoice
                            </a>
                          )}
                        </div>
                        {selected.payment.confirmedBySupplier && (
                          <p className="flex items-center gap-1 pt-1 text-success">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Payment
                            confirmed by supplier
                          </p>
                        )}
                      </div>
                    </section>
                  )}

                {/* Status timeline */}
                <section className="rounded-xl border p-3">
                  <h4 className="mb-2 flex items-center gap-1.5 font-semibold">
                    <Clock className="h-4 w-4 text-primary" /> Timeline
                  </h4>
                  {selected.statusHistory &&
                  selected.statusHistory.length > 0 ? (
                    <ol className="space-y-2">
                      {selected.statusHistory.map((h, i) => {
                        // Check-ins carry the status unchanged, so label them by
                        // what actually happened instead of repeating "Paid".
                        const isIn = h.note?.startsWith("Checked in:");
                        const isOut = h.note?.startsWith("Checked out:");
                        return (
                        <li key={i} className="flex gap-2">
                          <span
                            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                              isIn
                                ? "bg-success"
                                : isOut
                                  ? "bg-warning"
                                  : "bg-primary"
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium">
                                {isIn
                                  ? "Checked in"
                                  : isOut
                                    ? "Checked out"
                                    : h.status}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {h.changedAt
                                  ? new Date(h.changedAt).toLocaleString()
                                  : ""}
                                {h.changedBy ? ` · ${h.changedBy}` : ""}
                              </span>
                            </div>
                            {h.note && (
                              <p className="text-xs text-muted-foreground">
                                {isIn || isOut
                                  ? h.note.replace(/^Checked (in|out): /, "")
                                  : h.note}
                              </p>
                            )}
                          </div>
                        </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No history yet.
                    </p>
                  )}
                </section>
              </div>

              {/* Negotiation actions — while the quote is still open */}
              {["Quoted", "Negotiating"].includes(selected.status) && (
                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="flex-1 border-success/30 text-success hover:bg-success/10"
                    onClick={() => {
                      setActionNote("");
                            setActionAmount("");
                      setAction("Approved");
                    }}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900/30"
                    onClick={() => {
                      setActionNote("");
                            setActionAmount("");
                      setAction("Negotiating");
                    }}
                  >
                    <Handshake className="mr-1.5 h-4 w-4" /> Negotiate
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setActionNote("");
                            setActionAmount("");
                      setAction("Rejected");
                    }}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Reject
                  </Button>
                </DialogFooter>
              )}

              {/* Payment action — after approval the organizer pays (in one go
                  or in instalments) and uploads proof. Stays available while a
                  balance is outstanding, and once settled so proof can be
                  re-uploaded. */}
              {["Approved", "Partially Paid", "Paid"].includes(
                selected.status,
              ) && (
                <DialogFooter>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setPayFile(null);
                      // Default to whatever is still outstanding — the
                      // organizer can lower it to record an advance instead.
                      setPayAmount(
                        selectedPay.balance > 0
                          ? String(selectedPay.balance)
                          : "",
                      );
                      setPayReference("");
                      setPayNote("");
                      setPayOpen(true);
                    }}
                  >
                    <Wallet className="mr-1.5 h-4 w-4" />
                    {selectedPay.balance <= 0
                      ? "Update payment proof"
                      : selectedPay.paid > 0
                        ? "Record balance payment"
                        : "Record payment"}
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Record payment sub-dialog ───────────────────────────── */}
      <Dialog open={payOpen} onOpenChange={(o) => !o && setPayOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedPay.balance <= 0
                ? "Update payment proof"
                : selectedPay.paid > 0
                  ? "Record balance payment"
                  : "Record payment"}
            </DialogTitle>
            <DialogDescription>
              {selectedPay.balance > 0
                ? "Log the payment you made to the supplier and attach a screenshot as proof. Pay less than the balance to record an advance — the rest stays outstanding."
                : "This quotation is settled. You can re-upload the proof or correct the reference."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {/* Running totals so the organizer sees exactly what's left */}
            {selectedPay.total > 0 && (
              <div className="space-y-1 rounded-lg bg-muted/40 p-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total quote</span>
                  <span>{money(selectedPay.total, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid so far</span>
                  <span className="text-success">
                    {money(selectedPay.paid, currency)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>Balance due</span>
                  <span
                    className={
                      selectedPay.balance > 0
                        ? "text-warning"
                        : "text-success"
                    }
                  >
                    {money(selectedPay.balance, currency)}
                  </span>
                </div>
              </div>
            )}
            {selectedPay.balance > 0 && (
              <div>
                <Label className="text-xs">Amount paid now</Label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={`Amount (${currencySymbol(currency)})`}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Leave as-is to settle the balance in full, or lower it to
                  record a part payment — the difference stays due.
                </p>
              </div>
            )}
            <div>
              <Label className="text-xs">Reference (optional)</Label>
              <Input
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                placeholder="UTR / transaction ref"
              />
            </div>
            <div>
              <Label className="text-xs">
                Payment screenshot (image or PDF)
              </Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setPayFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <Label className="text-xs">Note (optional)</Label>
              <Textarea
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Anything the supplier should know."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitPayment} disabled={payBusy}>
              {payBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Action note sub-dialog ──────────────────────────────── */}
      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action === "Approved"
                ? "Approve quotation"
                : action === "Rejected"
                  ? "Reject quotation"
                  : "Negotiate"}
            </DialogTitle>
            <DialogDescription>
              {action === "Approved"
                ? "Add a message for the supplier (optional)."
                : action === "Rejected"
                  ? "Let the supplier know why."
                  : "Send your counter-offer or terms to the supplier."}
            </DialogDescription>
          </DialogHeader>
          {action !== "Rejected" && (
            <div className="mb-2">
              <Label className="text-xs">
                {action === "Approved"
                  ? "Agreed price (optional)"
                  : "Your counter-offer"}
              </Label>
              <Input
                type="number"
                min="0"
                value={actionAmount}
                onChange={(e) => setActionAmount(e.target.value)}
                placeholder={
                  selected ? String(payableOf(selected)) : currencySymbol(currency)
                }
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Leave blank to keep the current amount. Whatever you set here is
                what gets paid.
              </p>
            </div>
          )}
          <Textarea
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            placeholder={
              action === "Approved"
                ? "e.g. Looks good — let's proceed."
                : action === "Rejected"
                  ? "Reason for rejection"
                  : "e.g. Can you do ₹45,000 including delivery?"
            }
            className="min-h-[90px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button onClick={submitAction} disabled={actionBusy}>
              {actionBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action === "Approved"
                ? "Approve"
                : action === "Rejected"
                  ? "Reject"
                  : "Send offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small labelled value used across the quotation detail dialog.
function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="truncate">{value || "—"}</div>
    </div>
  );
}
