import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Loader2, Eye, Check, X } from "lucide-react";
import { useCountry } from "@/hooks/useCountry";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { isFieldEnabled } from "@/lib/registrationFormFields";

interface WorkshopHostRequestsProps {
  eventId: string;
  registrationFormFields?: { workshop?: Record<string, boolean> } | null;
}

const WorkshopHostRequests = ({
  eventId,
  registrationFormFields,
}: WorkshopHostRequestsProps) => {
  const workshopFieldOn = (key: string) =>
    isFieldEnabled(registrationFormFields, "workshop", key);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  const apiURL = __API_URL__;
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  // Draft fields edited in the review dialog before Approve/Save.
  const [draft, setDraft] = useState({
    finalPrice: "0",
    maxSeats: "0",
    proposedStartTime: "",
    proposedEndTime: "",
    isCharged: false,
    hostingFee: "0",
  });

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiURL}/workshop-requests/event/${eventId}`);
      if (res.ok) {
        const result = await res.json();
        if (result.success) setRequests(result.data || []);
      }
    } catch {
      toast({
        title: "Failed to load workshop requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [apiURL, eventId]);

  useEffect(() => {
    if (eventId) fetchRequests();
  }, [eventId, fetchRequests]);

  const openReview = (req: any) => {
    setSelected(req);
    setDraft({
      finalPrice: String(req.finalPrice ?? req.proposedPrice ?? 0),
      maxSeats: String(req.maxSeats ?? 0),
      proposedStartTime: req.proposedStartTime || "",
      proposedEndTime: req.proposedEndTime || "",
      isCharged: !!req.isCharged,
      hostingFee: String(req.hostingFee ?? 0),
    });
  };

  const refreshOne = (updated: any) => {
    setRequests((prev) =>
      prev.map((r) => (r._id === updated._id ? updated : r)),
    );
    setSelected(updated);
  };

  const saveProposalAndFee = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const [proposalRes, feeRes] = await Promise.all([
        fetch(`${apiURL}/workshop-requests/${selected._id}/proposal`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            finalPrice: Number(draft.finalPrice) || 0,
            maxSeats: Number(draft.maxSeats) || 0,
            proposedStartTime: draft.proposedStartTime,
            proposedEndTime: draft.proposedEndTime,
          }),
        }).then((r) => r.json()),
        fetch(`${apiURL}/workshop-requests/${selected._id}/fee`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isCharged: draft.isCharged,
            fee: Number(draft.hostingFee) || 0,
          }),
        }).then((r) => r.json()),
      ]);
      if (feeRes?.data) refreshOne(feeRes.data);
      else if (proposalRes?.data) refreshOne(proposalRes.data);
      toast({ title: "Saved" });
    } catch {
      toast({ title: "Failed to save changes", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await saveProposalAndFee();
      const res = await fetch(
        `${apiURL}/workshop-requests/${selected._id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Confirmed" }),
        },
      );
      const result = await res.json();
      if (result.success) {
        refreshOne(result.data);
        await fetchRequests();
        toast({
          title: "Application approved",
          description: draft.isCharged
            ? "The host will be asked to pay the hosting fee."
            : "The workshop is now live.",
        });
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      toast({
        title: "Approval failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const reject = async (reason?: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${apiURL}/workshop-requests/${selected._id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Rejected", rejectionReason: reason }),
        },
      );
      const result = await res.json();
      if (result.success) {
        refreshOne(result.data);
        await fetchRequests();
        toast({ title: "Application rejected" });
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      toast({
        title: "Rejection failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmPayment = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${apiURL}/workshop-requests/${selected._id}/confirm-payment`,
        { method: "POST" },
      );
      const result = await res.json();
      if (result.success) {
        refreshOne(result.data);
        await fetchRequests();
        toast({
          title: "Payment confirmed",
          description: "The workshop is now live.",
        });
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      toast({
        title: "Confirmation failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-success/15 text-success";
      case "Pending":
        return "bg-warning/15 text-warning";
      case "Confirmed":
        return "bg-primary/15 text-primary";
      case "Rejected":
        return "bg-destructive/15 text-destructive";
      case "Cancelled":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <GraduationCap size={48} className="mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">No workshop host applications yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Turn on "Accept Workshop Host Applications" in the event's
            Workshops tab to let outside hosts apply.
          </p>
        </CardContent>
      </Card>
    );
  }

  const filtered = requests.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = [r.hostName, r.hostEmail, r.workshopName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap size={16} />
            Workshop Host Applications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="text"
              placeholder="Search host, email or workshop…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-md border px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Completed">Live</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <span className="ml-auto text-sm text-muted-foreground">
              Showing {filtered.length} of {requests.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Host</th>
                  <th className="pb-3 pr-4 font-medium">Workshop</th>
                  <th className="pb-3 pr-4 font-medium">Visitor Price</th>
                  <th className="pb-3 pr-4 font-medium">Hosting Fee</th>
                  <th className="pb-3 pr-4 font-medium">Owed to Host</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No applications match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((req) => (
                  <tr
                    key={req._id}
                    className="border-b last:border-0 hover:bg-muted/50"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium text-foreground">
                        {req.hostName}
                      </p>
                      <p className="text-xs text-muted-foreground">{req.hostEmail}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{req.workshopName}</p>
                    </td>
                    <td className="py-3 pr-4">
                      {req.finalPrice > 0
                        ? formatPrice(req.finalPrice)
                        : "Free"}
                    </td>
                    <td className="py-3 pr-4">
                      {req.isCharged && req.hostingFee > 0
                        ? `${formatPrice(req.hostingFee)} (${req.paymentStatus})`
                        : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {req.finalPrice > 0 ? (
                        req.amountOwed > 0 ? (
                          <div>
                            <p className="font-semibold text-warning">
                              {formatPrice(req.amountOwed)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {req.ticketsSold} ticket
                              {req.ticketsSold === 1 ? "" : "s"} sold
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No sales yet
                          </span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge className={`text-xs ${getStatusColor(req.status)}`}>
                        {req.status}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => openReview(req)}
                      >
                        <Eye size={12} className="mr-1" /> Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        {selected && (
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">
                {selected.workshopName}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Applied by {selected.hostName} &middot;{" "}
                <Badge className={`text-xs ${getStatusColor(selected.status)}`}>
                  {selected.status}
                </Badge>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Host
                </p>
                <p className="font-semibold text-foreground">
                  {selected.hostName}
                </p>
                <p className="text-xs text-muted-foreground">{selected.hostEmail}</p>
                {workshopFieldOn("hostPhone") && selected.hostPhone && (
                  <p className="text-xs text-muted-foreground">{selected.hostPhone}</p>
                )}
                {workshopFieldOn("hostBio") && selected.hostBio && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selected.hostBio}
                  </p>
                )}
              </div>

              {((workshopFieldOn("hostAccountName") && selected.hostAccountName) ||
                (workshopFieldOn("hostAccountDetails") &&
                  selected.hostAccountDetails)) && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-1">
                  <p className="text-xs font-semibold text-warning uppercase tracking-wider">
                    Payout Account
                  </p>
                  {workshopFieldOn("hostAccountName") &&
                    selected.hostAccountName && (
                    <p className="text-sm text-foreground">
                      {selected.hostAccountName}
                    </p>
                  )}
                  {workshopFieldOn("hostAccountDetails") &&
                    selected.hostAccountDetails && (
                    <p className="text-sm text-muted-foreground">
                      {selected.hostAccountDetails}
                    </p>
                  )}
                </div>
              )}

              {selected.finalPrice > 0 && selected.status === "Completed" && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-warning uppercase tracking-wider">
                      Owed to Host
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selected.ticketsSold || 0} ticket
                      {selected.ticketsSold === 1 ? "" : "s"} sold
                    </p>
                  </div>
                  <p className="text-lg font-bold text-warning">
                    {formatPrice(selected.amountOwed || 0)}
                  </p>
                </div>
              )}

              {workshopFieldOn("workshopDescription") &&
                selected.workshopDescription && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Description
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selected.workshopDescription}
                  </p>
                </div>
              )}

              {selected.status === "Completed" ? (
                <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
                  This workshop is live and bookable on the event page.
                </div>
              ) : (
                <div className="rounded-lg border p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Adjust before approving
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Visitor Price</Label>
                      <Input
                        type="number"
                        min="0"
                        value={draft.finalPrice}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            finalPrice: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Max Seats</Label>
                      <Input
                        type="number"
                        min="0"
                        value={draft.maxSeats}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, maxSeats: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Start Time</Label>
                      <Input
                        type="time"
                        value={draft.proposedStartTime}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            proposedStartTime: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">End Time</Label>
                      <Input
                        type="time"
                        value={draft.proposedEndTime}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            proposedEndTime: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 border rounded-lg p-2 cursor-pointer">
                    <Switch
                      checked={draft.isCharged}
                      onCheckedChange={(checked) =>
                        setDraft((p) => ({ ...p, isCharged: checked }))
                      }
                    />
                    <span className="text-sm">Charge a hosting fee</span>
                  </label>
                  {draft.isCharged && (
                    <div>
                      <Label className="text-xs">Hosting Fee</Label>
                      <Input
                        type="number"
                        min="0"
                        value={draft.hostingFee}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            hostingFee: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={saveProposalAndFee}
                  >
                    Save Changes
                  </Button>
                </div>
              )}

              {selected.status === "Confirmed" &&
                selected.isCharged &&
                selected.hostingFee > 0 &&
                selected.paymentStatus !== "Paid" && (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                    Awaiting the host's hosting-fee payment.
                  </div>
                )}

              {selected.status === "Confirmed" &&
                selected.isCharged &&
                selected.hostingFee > 0 &&
                selected.paymentStatus === "Paid" && (
                  <Button
                    className="w-full bg-success hover:bg-success/90"
                    disabled={busy}
                    onClick={confirmPayment}
                  >
                    {busy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      "Confirm Payment & Publish"
                    )}
                  </Button>
                )}

              {selected.status === "Pending" && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-success hover:bg-success/90"
                    disabled={busy}
                    onClick={approve}
                  >
                    <Check size={14} className="mr-1" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => reject()}
                  >
                    <X size={14} className="mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default WorkshopHostRequests;
