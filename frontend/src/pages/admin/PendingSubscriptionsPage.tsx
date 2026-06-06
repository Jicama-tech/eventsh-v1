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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Hourglass,
  Receipt,
  CreditCard,
  Package,
  Zap,
} from "lucide-react";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/hooks/use-toast";

const apiURL = __API_URL__;

type RowType = "subscription" | "event_fee";

interface UnifiedRow {
  _id: string;
  type: RowType;
  // Subscription rows only: "plan" (full plan purchase) or "addon"
  // (prorated feature add-on purchase).
  subType?: "plan" | "addon";
  organizer: {
    _id?: string;
    name?: string;
    organizationName?: string;
    email?: string;
    whatsAppNumber?: string;
    country?: string;
  } | null;
  // For subscription rows: plan; for event_fee rows: event title shows here.
  itemLabel: string;
  itemSub?: string;
  amount: number;
  currency: string;
  scheme: "UPI" | "PAYNOW";
  status: "awaiting_payment" | "submitted" | "confirmed" | "rejected";
  ref: string;
  submittedAt: string | null;
  createdAt: string;
}

function symbol(c: string) {
  if (c === "INR") return "₹";
  if (c === "SGD") return "SG$";
  return "$";
}

/**
 * Unified pending-payments page — merges subscription-purchase requests and
 * per-event-fee requests. Confirm/Reject dispatches to the right backend
 * route based on the row's `type`. Exported under the original name so the
 * existing AdminDashboard lazy import keeps working without rename.
 */
export function PendingSubscriptionsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectingType, setRejectingType] = useState<RowType | null>(null);
  const [reason, setReason] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    try {
      const [subRes, evRes] = await Promise.all([
        adminFetch(`${apiURL}/subscriptions/admin/pending`),
        adminFetch(`${apiURL}/billing-payments/admin/pending`),
      ]);
      // 401 on either kicks the global session-expired listener — bail.
      if (subRes.status === 401 || evRes.status === 401) return;
      const [subData, evData] = await Promise.all([
        subRes.ok ? subRes.json() : [],
        evRes.ok ? evRes.json() : [],
      ]);
      const subRows: UnifiedRow[] = (subData || []).map((r: any) => ({
        _id: r._id,
        type: "subscription",
        subType: r.type === "addon" ? "addon" : "plan",
        organizer: r.organizer,
        // Add-on rows show the add-on name with the host plan as the
        // subtitle; plan rows keep the existing plan + validity labels.
        itemLabel:
          r.type === "addon"
            ? r.addOnName || "Add-on"
            : r.plan?.planName || "—",
        itemSub:
          r.type === "addon"
            ? `on ${r.plan?.planName || "current plan"} · prorated`
            : r.plan?.validityInDays
              ? `${r.plan.validityInDays} days`
              : undefined,
        amount: r.amount,
        currency: r.currency,
        scheme: r.scheme,
        status: r.status,
        ref: r.ref,
        submittedAt: r.submittedAt,
        createdAt: r.createdAt,
      }));
      const evRows: UnifiedRow[] = (evData || []).map((r: any) => {
        const counts = [
          r.stallsSold ? `${r.stallsSold} stalls` : null,
          r.tablesBooked ? `${r.tablesBooked} tables` : null,
          r.chairsBooked ? `${r.chairsBooked} chairs` : null,
          r.speakersBooked ? `${r.speakersBooked} speakers` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return {
          _id: r._id,
          type: "event_fee",
          organizer: r.organizer,
          itemLabel: r.event?.title || "Event",
          itemSub: counts || undefined,
          amount: r.amount,
          currency: r.currency,
          scheme: r.scheme,
          status: r.status,
          ref: r.ref,
          submittedAt: r.submittedAt,
          createdAt: r.createdAt,
        };
      });
      const merged = [...subRows, ...evRows].sort((a, b) => {
        const ax = new Date(a.submittedAt || a.createdAt || 0).getTime();
        const bx = new Date(b.submittedAt || b.createdAt || 0).getTime();
        return bx - ax;
      });
      setRows(merged);
    } catch (e: any) {
      toast({
        title: "Failed to load pending payments",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmBase = (type: RowType) =>
    type === "subscription"
      ? `${apiURL}/subscriptions/admin`
      : `${apiURL}/billing-payments/admin`;

  const confirm = async (row: UnifiedRow) => {
    const verb =
      row.type === "subscription"
        ? row.subType === "addon"
          ? `activate the "${row.itemLabel}" add-on`
          : `activate "${row.itemLabel}"`
        : `mark "${row.itemLabel}" paid`;
    if (
      !window.confirm(
        `Confirm payment of ${symbol(row.currency)}${row.amount} and ${verb}? A receipt will be sent to the organizer.`,
      )
    ) {
      return;
    }
    setActingId(row._id);
    try {
      const res = await adminFetch(
        `${confirmBase(row.type)}/${row._id}/confirm`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(data?.message || `HTTP ${res.status}`);
      const wa = data?.whatsapp;
      const em = data?.email;
      const parts: string[] = [];
      parts.push(wa?.sent ? "WhatsApp: sent" : `WhatsApp: ${wa?.error || "failed"}`);
      parts.push(em?.sent ? "Email: sent" : `Email: ${em?.error || "failed"}`);
      const allOk = wa?.sent && em?.sent;
      toast({
        title: allOk ? "Confirmed & receipt sent" : "Confirmed",
        description: parts.join(" · "),
        variant: allOk ? "default" : "destructive",
      });
      await fetchRows();
    } catch (e: any) {
      toast({
        title: "Couldn't confirm",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectingId || !rejectingType) return;
    setActingId(rejectingId);
    try {
      const res = await adminFetch(
        `${confirmBase(rejectingType)}/${rejectingId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(data?.message || `HTTP ${res.status}`);
      toast({ title: "Request rejected" });
      setRejectingId(null);
      setRejectingType(null);
      setReason("");
      await fetchRows();
    } catch (e: any) {
      toast({
        title: "Couldn't reject",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" /> Pending Payments
          </h1>
          <p className="text-sm text-muted-foreground">
            Verify organizer-submitted payments — subscription purchases and
            per-event platform fees — and trigger receipts.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchRows}
          disabled={loading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Awaiting verification</CardTitle>
          <CardDescription>
            "Submitted" rows mean the organizer clicked <em>I have paid</em>.
            "Awaiting payment" rows mean they opened checkout but haven't
            submitted yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              No pending payment requests.
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Organizer</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={`${r.type}-${r._id}`}>
                      <TableCell>
                        {r.type === "subscription" && r.subType === "addon" ? (
                          <Badge variant="outline" className="text-purple-600 border-purple-200">
                            <Zap className="h-3 w-3 mr-1" /> Add-On
                          </Badge>
                        ) : r.type === "subscription" ? (
                          <Badge variant="outline" className="text-indigo-600 border-indigo-200">
                            <Package className="h-3 w-3 mr-1" /> Subscription
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-200">
                            <CreditCard className="h-3 w-3 mr-1" /> Event Fee
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {r.organizer?.organizationName ||
                            r.organizer?.name ||
                            "—"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {r.organizer?.email}
                        </div>
                        <div className="text-xs text-slate-500">
                          {r.organizer?.whatsAppNumber || "no WA #"} ·{" "}
                          {r.organizer?.country || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.itemLabel}</div>
                        {r.itemSub && (
                          <div className="text-xs text-slate-500">
                            {r.itemSub}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {symbol(r.currency)}
                        {r.amount}
                        <div className="text-xs font-normal text-slate-500">
                          {r.scheme === "UPI" ? "UPI" : "PayNow"}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.ref}
                      </TableCell>
                      <TableCell>
                        {r.status === "submitted" ? (
                          <Badge className="bg-amber-500">Submitted</Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-slate-500"
                          >
                            <Hourglass className="h-3 w-3 mr-1" /> Awaiting
                            payment
                          </Badge>
                        )}
                        {r.submittedAt && (
                          <div className="text-xs text-slate-500 mt-1">
                            {new Date(r.submittedAt).toLocaleString()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            onClick={() => confirm(r)}
                            disabled={
                              actingId === r._id ||
                              r.status !== "submitted"
                            }
                          >
                            {actingId === r._id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectingId(r._id);
                              setRejectingType(r.type);
                            }}
                            disabled={actingId === r._id}
                          >
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!rejectingId}
        onOpenChange={(v) => {
          if (!v) {
            setRejectingId(null);
            setRejectingType(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payment request</DialogTitle>
            <DialogDescription>
              The organizer will need to start checkout again.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Couldn't verify transfer"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectingId(null);
                setRejectingType(null);
              }}
              disabled={!!actingId}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitReject}
              disabled={!!actingId}
            >
              {actingId ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
