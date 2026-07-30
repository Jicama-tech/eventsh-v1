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

interface WorkshopHostRequestsProps {
  eventId: string;
}

const WorkshopHostRequests = ({ eventId }: WorkshopHostRequestsProps) => {
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
        return "bg-green-100 text-green-700";
      case "Pending":
        return "bg-yellow-100 text-yellow-700";
      case "Confirmed":
        return "bg-blue-100 text-blue-700";
      case "Rejected":
        return "bg-red-100 text-red-700";
      case "Cancelled":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <GraduationCap size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No workshop host applications yet</p>
          <p className="text-xs text-gray-400 mt-1">
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
            <span className="ml-auto text-sm text-gray-500">
              Showing {filtered.length} of {requests.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Host</th>
                  <th className="pb-3 pr-4 font-medium">Workshop</th>
                  <th className="pb-3 pr-4 font-medium">Visitor Price</th>
                  <th className="pb-3 pr-4 font-medium">Hosting Fee</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No applications match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((req) => (
                  <tr
                    key={req._id}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-800">
                        {req.hostName}
                      </p>
                      <p className="text-xs text-gray-400">{req.hostEmail}</p>
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
                      <Badge className={`text-xs ${getStatusColor(req.status)}`}>
                        {req.status}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
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
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Host
                </p>
                <p className="font-semibold text-gray-800">
                  {selected.hostName}
                </p>
                <p className="text-xs text-gray-500">{selected.hostEmail}</p>
                {selected.hostPhone && (
                  <p className="text-xs text-gray-500">{selected.hostPhone}</p>
                )}
                {selected.hostBio && (
                  <p className="text-sm text-gray-600 mt-1">
                    {selected.hostBio}
                  </p>
                )}
              </div>

              {(selected.hostAccountName || selected.hostAccountDetails) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                    Payout Account
                  </p>
                  {selected.hostAccountName && (
                    <p className="text-sm text-gray-800">
                      {selected.hostAccountName}
                    </p>
                  )}
                  {selected.hostAccountDetails && (
                    <p className="text-sm text-gray-600">
                      {selected.hostAccountDetails}
                    </p>
                  )}
                </div>
              )}

              {selected.workshopDescription && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Description
                  </p>
                  <p className="text-sm text-gray-600">
                    {selected.workshopDescription}
                  </p>
                </div>
              )}

              {selected.status === "Completed" ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  This workshop is live and bookable on the event page.
                </div>
              ) : (
                <div className="rounded-lg border p-3 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                    Awaiting the host's hosting-fee payment.
                  </div>
                )}

              {selected.status === "Confirmed" &&
                selected.isCharged &&
                selected.hostingFee > 0 &&
                selected.paymentStatus === "Paid" && (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
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
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={busy}
                    onClick={approve}
                  >
                    <Check size={14} className="mr-1" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-red-600 hover:text-red-700"
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
