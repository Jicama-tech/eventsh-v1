import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarClock,
  Loader2,
  Eye,
  Check,
  X,
  CheckCircle2,
  CreditCard,
  Plus,
  Send,
} from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { useCountry } from "@/hooks/useCountry";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { isFieldEnabled } from "@/lib/registrationFormFields";
import StatusTimeline from "@/components/StatusTimeline";

const apiURL = __API_URL__;

interface ScheduledSpaceRequestsProps {
  eventId: string;
  registrationFormFields?: { scheduledSpace?: Record<string, boolean> } | null;
}

// Who is performing an action, for the timeline. Resolved from the JWT: an
// operator account → the operator's name; the organizer → "Organizer".
// Sent as `changedBy` so every timeline entry shows who did it — same
// resolution EventAttendees.tsx uses for Stalls.
const getActorLabel = (): string => {
  try {
    const token = sessionStorage.getItem("token");
    if (!token) return "Organizer";
    const d: any = jwtDecode(token);
    if (d?.operatorId) {
      return (
        (d.name && String(d.name).trim()) ||
        (d.email && String(d.email).trim()) ||
        "Operator"
      );
    }
    return "Organizer";
  } catch {
    return "Organizer";
  }
};

const ScheduledSpaceRequests = ({
  eventId,
  registrationFormFields,
}: ScheduledSpaceRequestsProps) => {
  const scheduledSpaceFieldOn = (key: string) =>
    isFieldEnabled(registrationFormFields, "scheduledSpace", key);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  // Per-action note/reason drafts — reset whenever a different request is
  // opened so text from one review doesn't leak into the next.
  const [approveNote, setApproveNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [confirmNote, setConfirmNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [standaloneNote, setStandaloneNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [resendingTicket, setResendingTicket] = useState(false);

  const openReview = (req: any) => {
    setSelected(req);
    setApproveNote("");
    setRejectReason("");
    setConfirmNote("");
    setCancelReason("");
    setNoteFormOpen(false);
    setStandaloneNote("");
  };

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiURL}/scheduled-spaces/event/${eventId}`);
      if (res.ok) {
        const result = await res.json();
        if (result.success) setRequests(result.data || []);
      }
    } catch {
      toast({
        title: "Failed to load scheduled space requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) fetchRequests();
  }, [eventId, fetchRequests]);

  const refreshOne = (updated: any) => {
    setRequests((prev) =>
      prev.map((r) => (r._id === updated._id ? updated : r)),
    );
    setSelected(updated);
  };

  const updateStatus = async (
    status: "Confirmed" | "Rejected" | "Cancelled",
    reasonOrNote?: string,
  ) => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${apiURL}/scheduled-spaces/${selected._id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            notes: status === "Confirmed" ? reasonOrNote : undefined,
            cancellationReason:
              status === "Rejected" || status === "Cancelled"
                ? reasonOrNote
                : undefined,
            changedBy: getActorLabel(),
          }),
        },
      );
      const result = await res.json();
      if (result.success) {
        refreshOne(result.data);
        await fetchRequests();
        toast({
          title:
            status === "Confirmed"
              ? "Registration approved"
              : status === "Rejected"
                ? "Registration rejected"
                : "Booking cancelled",
        });
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      toast({
        title: "Couldn't update status",
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
      const res = await fetch(`${apiURL}/scheduled-spaces/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selected._id,
          notes: confirmNote.trim() || undefined,
          changedBy: getActorLabel(),
        }),
      });
      const result = await res.json();
      if (result.success) {
        refreshOne(result.data);
        await fetchRequests();
        toast({
          title: "Payment confirmed",
          description: "The check-in QR has been issued and emailed.",
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

  const resendTicket = async () => {
    if (!selected) return;
    setResendingTicket(true);
    try {
      const res = await fetch(
        `${apiURL}/scheduled-spaces/${selected._id}/resend-ticket`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changedBy: getActorLabel() }),
        },
      );
      const result = await res.json();
      if (result.success) {
        refreshOne(result.data);
        await fetchRequests();
        toast({
          title: "Ticket resent",
          description: "The registrant's check-in QR was emailed again.",
        });
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      toast({
        title: "Couldn't resend ticket",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setResendingTicket(false);
    }
  };

  const addStandaloneNote = async () => {
    if (!selected || !standaloneNote.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`${apiURL}/scheduled-spaces/${selected._id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: standaloneNote.trim(),
          addedBy: getActorLabel(),
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      refreshOne(result.data);
      await fetchRequests();
      setStandaloneNote("");
      setNoteFormOpen(false);
    } catch (err: any) {
      toast({
        title: "Couldn't add note",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setAddingNote(false);
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
      case "Processing":
        return "bg-purple-100 text-purple-700";
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
          <CalendarClock size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No scheduled space requests yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Requests appear here once a visitor registers from the "Book a
            Scheduled Space" card on the event page.
          </p>
        </CardContent>
      </Card>
    );
  }

  const filtered = requests.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = [r.name, r.email, r.organization, r.purpose]
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
            <CalendarClock size={16} />
            Scheduled Space Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="text"
              placeholder="Search name, email, organization…"
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
              <option value="Processing">Processing</option>
              <option value="Completed">Completed</option>
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
                  <th className="pb-3 pr-4 font-medium">Registrant</th>
                  <th className="pb-3 pr-4 font-medium">Selected Slots</th>
                  <th className="pb-3 pr-4 font-medium">Total</th>
                  <th className="pb-3 pr-4 font-medium">Payment</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No requests match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((req) => (
                  <tr
                    key={req._id}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-800">{req.name}</p>
                      <p className="text-xs text-gray-400">{req.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      {(req.selectedSlots || []).length === 0 ? (
                        <span className="text-xs text-gray-400">
                          Not picked yet
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          {req.selectedSlots.map((s: any, i: number) => (
                            <p key={i} className="text-xs text-gray-600">
                              {s.spaceName} — {s.date} {s.startTime}-
                              {s.endTime}
                            </p>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {req.slotsTotal > 0
                        ? formatPrice(req.slotsTotal)
                        : "—"}
                    </td>
                    <td className="py-3 pr-4">{req.paymentStatus}</td>
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
              <DialogTitle className="text-base">{selected.name}</DialogTitle>
              <DialogDescription className="text-xs">
                {selected.email} &middot;{" "}
                <Badge className={`text-xs ${getStatusColor(selected.status)}`}>
                  {selected.status}
                </Badge>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Registrant
                </p>
                <p className="font-semibold text-gray-800">{selected.name}</p>
                <p className="text-xs text-gray-500">{selected.email}</p>
                {scheduledSpaceFieldOn("whatsappNumber") &&
                  selected.whatsappNumber && (
                    <p className="text-xs text-gray-500">
                      WhatsApp: {selected.whatsappNumber}
                    </p>
                  )}
                {scheduledSpaceFieldOn("phone") && selected.phone && (
                  <p className="text-xs text-gray-500">
                    Phone: {selected.phone}
                  </p>
                )}
                {scheduledSpaceFieldOn("facilityType") &&
                  selected.facilityTypeRequested && (
                    <p className="text-xs text-gray-500">
                      Space type: {selected.facilityTypeRequested}
                    </p>
                  )}
                {scheduledSpaceFieldOn("organization") &&
                  selected.organization && (
                    <p className="text-xs text-gray-500">
                      {selected.organization}
                    </p>
                  )}
                {scheduledSpaceFieldOn("purpose") && selected.purpose && (
                  <p className="text-sm text-gray-600 mt-1">
                    {selected.purpose}
                  </p>
                )}
                {scheduledSpaceFieldOn("companions") &&
                  (selected.companions || []).length > 0 && (
                    <div className="pt-1">
                      <p className="text-xs font-semibold text-gray-500">
                        Coming with:
                      </p>
                      <p className="text-xs text-gray-600">
                        {selected.companions.join(", ")}
                      </p>
                    </div>
                  )}
              </div>

              {(selected.selectedSlots || []).length > 0 && (
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Selected Slots
                  </p>
                  {selected.selectedSlots.map((s: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between text-sm text-gray-700"
                    >
                      <span>
                        {s.spaceName} — {s.date} {s.startTime}-{s.endTime}
                        {s.slotLabel ? ` (${s.slotLabel})` : ""}
                      </span>
                      <span>{formatPrice(s.price)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold border-t pt-1 mt-1">
                    <span>Total</span>
                    <span>{formatPrice(selected.slotsTotal || 0)}</span>
                  </div>
                </div>
              )}

              {/* Payment Proof — transaction id + screenshot, same shape as
                  the Stalls "Transaction Details from Vendor" card. */}
              {(selected.transactionId || selected.transactionScreenshot) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                    <CreditCard size={14} />
                    Payment Proof
                  </p>
                  {selected.transactionId && (
                    <div>
                      <p className="text-xs text-amber-700">
                        Transaction ID / Reference
                      </p>
                      <p className="font-mono font-bold text-sm text-gray-800 bg-white rounded px-3 py-1.5 border border-amber-200 mt-1">
                        {selected.transactionId}
                      </p>
                    </div>
                  )}
                  {selected.transactionScreenshot && (
                    <div>
                      <p className="text-xs text-amber-700 mb-1">
                        Payment Screenshot
                      </p>
                      <a
                        href={
                          /^https?:\/\//.test(selected.transactionScreenshot)
                            ? selected.transactionScreenshot
                            : `${apiURL}${selected.transactionScreenshot}`
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={
                            /^https?:\/\//.test(selected.transactionScreenshot)
                              ? selected.transactionScreenshot
                              : `${apiURL}${selected.transactionScreenshot}`
                          }
                          alt="Transaction Screenshot"
                          className="max-w-xs max-h-60 rounded-lg border border-amber-200 shadow-sm"
                        />
                      </a>
                    </div>
                  )}
                  {selected.paymentMethod && (
                    <p className="text-xs text-amber-700">
                      Payment Method:{" "}
                      <span className="font-semibold">
                        {selected.paymentMethod}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {selected.status === "Completed" && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-green-800 text-sm">
                    <CheckCircle2 size={16} />
                    {selected.hasCheckedIn
                      ? `Checked in at ${new Date(selected.checkInTime).toLocaleString()}`
                      : "Confirmed — not checked in yet"}
                  </div>
                  {selected.qrCodeImage && (
                    <img
                      src={selected.qrCodeImage}
                      alt="Check-in QR code"
                      className="mx-auto w-32 h-32"
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={resendingTicket}
                    onClick={resendTicket}
                  >
                    {resendingTicket ? (
                      <Loader2 size={14} className="mr-1 animate-spin" />
                    ) : (
                      <Send size={14} className="mr-1" />
                    )}
                    Resend Ticket
                  </Button>
                </div>
              )}

              {selected.status === "Rejected" && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {selected.cancellationReason || "This request was rejected."}
                </div>
              )}

              {selected.status === "Pending" && (
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="approve-notes" className="text-xs">
                      Notes (optional)
                    </Label>
                    <Textarea
                      id="approve-notes"
                      placeholder="Add any notes for the registrant..."
                      value={approveNote}
                      onChange={(e) => setApproveNote(e.target.value)}
                      rows={2}
                      disabled={busy}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={busy}
                      onClick={() => updateStatus("Confirmed", approveNote.trim() || undefined)}
                    >
                      <Check size={14} className="mr-1" /> Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 hover:text-red-700"
                      disabled={busy}
                      onClick={() => updateStatus("Rejected", rejectReason.trim() || undefined)}
                    >
                      <X size={14} className="mr-1" /> Reject
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor="reject-reason" className="text-xs">
                      Rejection reason (shown to the registrant, optional)
                    </Label>
                    <Textarea
                      id="reject-reason"
                      placeholder="Add a reason if you're rejecting..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                      disabled={busy}
                    />
                  </div>
                </div>
              )}

              {selected.status === "Confirmed" && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  Approved — waiting for the registrant to pick a space & slot
                  and submit payment.
                </div>
              )}

              {selected.status === "Processing" && (
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="confirm-notes" className="text-xs">
                      Notes (optional)
                    </Label>
                    <Textarea
                      id="confirm-notes"
                      placeholder="Add any notes for the registrant..."
                      value={confirmNote}
                      onChange={(e) => setConfirmNote(e.target.value)}
                      rows={2}
                      disabled={busy}
                    />
                  </div>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={busy}
                    onClick={confirmPayment}
                  >
                    {busy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      "Confirm Payment & Issue QR"
                    )}
                  </Button>
                </div>
              )}

              {(selected.status === "Confirmed" ||
                selected.status === "Processing") && (
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="cancel-notes" className="text-xs">
                      Cancellation reason (optional)
                    </Label>
                    <Textarea
                      id="cancel-notes"
                      placeholder="Add a reason if you're cancelling..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={2}
                      disabled={busy}
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full text-red-600 hover:text-red-700"
                    disabled={busy}
                    onClick={() => updateStatus("Cancelled", cancelReason.trim() || undefined)}
                  >
                    Cancel Booking
                  </Button>
                </div>
              )}

              {/* Status History & Notes — same colored timeline as the rest
                  of the app, plus a free-standing "Add Note" that doesn't
                  change status. */}
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status History & Notes
                  </p>
                  {!noteFormOpen && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setNoteFormOpen(true)}
                    >
                      <Plus size={12} /> Add Note
                    </Button>
                  )}
                </div>
                {noteFormOpen && (
                  <div className="mb-3 rounded-md border bg-muted/30 p-2 space-y-2">
                    <Textarea
                      placeholder="What happened? Visible on the timeline."
                      value={standaloneNote}
                      onChange={(e) => setStandaloneNote(e.target.value)}
                      rows={2}
                      disabled={addingNote}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setNoteFormOpen(false);
                          setStandaloneNote("");
                        }}
                        disabled={addingNote}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1"
                        onClick={addStandaloneNote}
                        disabled={addingNote || !standaloneNote.trim()}
                      >
                        {addingNote ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Save Note
                      </Button>
                    </div>
                  </div>
                )}
                <StatusTimeline history={selected.statusHistory} />
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default ScheduledSpaceRequests;
