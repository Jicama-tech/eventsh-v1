import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Circle, Download, Loader2, Eye } from "lucide-react";
import { useCountry } from "@/hooks/useCountry";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { isFieldEnabled } from "@/lib/registrationFormFields";
import { t } from "@/i18n/t";

interface RoundTableBookingsProps {
  eventId: string;
  registrationFormFields?: { roundTable?: Record<string, boolean> } | null;
}

const RoundTableBookings = ({
  eventId,
  registrationFormFields,
}: RoundTableBookingsProps) => {
  const guestDetailsOn = isFieldEnabled(
    registrationFormFields,
    "roundTable",
    "seatGuests",
  );
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // Round-tables tab filters (search + payment status).
  const [rtSearch, setRtSearch] = useState("");
  const [rtPaymentFilter, setRtPaymentFilter] = useState("all");
  const { toast } = useToast();
  const apiURL = __API_URL__;
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${apiURL}/round-table-bookings/event/${eventId}`
        );
        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            setBookings(result.data || []);
          }
        }
      } catch {
        toast({
          title: "Failed to load round table bookings",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchBookings();
    }
  }, [eventId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700";
      case "Pending":
        return "bg-yellow-100 text-yellow-700";
      case "Submitted":
        return "bg-blue-100 text-blue-700";
      case "Failed":
        return "bg-red-100 text-red-700";
      case "Refunded":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleConfirmPayment = useCallback(async (bookingId: string) => {
    setConfirmingId(bookingId);
    try {
      const res = await fetch(`${apiURL}/round-table-bookings/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Payment Confirmed!", description: "QR ticket generated and sent to visitor via WhatsApp.", duration: 5000 });
        // Refresh bookings
        setBookings((prev) => prev.map((b) => b._id === bookingId ? { ...b, paymentStatus: "Paid" } : b));
      } else {
        toast({ title: "Confirmation failed", description: result.message, variant: "destructive", duration: 5000 });
      }
    } catch {
      toast({ title: "Confirmation failed", variant: "destructive" });
    } finally {
      setConfirmingId(null);
    }
  }, [apiURL, toast]);

  // IMPORTANT: this hook MUST stay above any early returns. React requires
  // hooks to be called in the same order on every render — moving useMemo
  // below an `if (...) return` triggers "Rendered more hooks than during the
  // previous render" and blanks the screen as soon as bookings load.
  const { totalRevenue, totalSeats, confirmedCount, submittedCount } = useMemo(() => {
    const paid = bookings.filter((b) => b.paymentStatus === "Paid");
    const submitted = bookings.filter((b) => b.paymentStatus === "Submitted");
    return {
      totalRevenue: paid.reduce((sum, b) => sum + (b.amount || 0), 0),
      totalSeats: paid.reduce((sum, b) => sum + (b.numberOfSeats || 0), 0),
      confirmedCount: paid.length,
      submittedCount: submitted.length,
    };
  }, [bookings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Circle size={48} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No round table bookings yet</p>
        </CardContent>
      </Card>
    );
  }

  const filteredBookings = bookings.filter((b) => {
    const q = rtSearch.trim().toLowerCase();
    if (q) {
      const hay = [b.visitorName, b.visitorEmail, b.visitorPhone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (rtPaymentFilter !== "all" && b.paymentStatus !== rtPaymentFilter)
      return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {bookings.length}
            </p>
            <p className="text-xs text-muted-foreground">Total Bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            {submittedCount > 0 ? (
              <>
                <p className="text-2xl font-bold text-blue-600">{submittedCount}</p>
                <p className="text-xs text-blue-500 font-medium">Awaiting Confirmation</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-green-600">{confirmedCount}</p>
                <p className="text-xs text-muted-foreground">Confirmed</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{totalSeats}</p>
            <p className="text-xs text-muted-foreground">Seats Booked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {formatPrice(totalRevenue)}
            </p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Bookings List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Circle size={16} />
            Round Table Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Round Tables filter — search + payment status. */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="text"
              placeholder={t("Search visitor, email or phone\u2026")}
              value={rtSearch}
              onChange={(e) => setRtSearch(e.target.value)}
              className="w-64 rounded-md border px-3 py-2 text-sm"
            />
            <select
              value={rtPaymentFilter}
              onChange={(e) => setRtPaymentFilter(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option value="all">All payments</option>
              <option value="Paid">Paid</option>
              <option value="Submitted">Submitted</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunded</option>
            </select>
            <span className="ml-auto text-sm text-muted-foreground">
              Showing {filteredBookings.length} of {bookings.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Visitor</th>
                  <th className="pb-3 pr-4 font-medium">Table</th>
                  <th className="pb-3 pr-4 font-medium">Seats</th>
                  <th className="pb-3 pr-4 font-medium">Amount</th>
                  <th className="pb-3 pr-4 font-medium">Payment</th>
                  <th className="pb-3 pr-4 font-medium">Check-In</th>
                  <th className="pb-3 pr-4 font-medium">Action</th>
                  <th className="pb-3 font-medium">Ticket</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No bookings match your filters.
                    </td>
                  </tr>
                )}
                {filteredBookings.map((booking) => (
                  <tr
                    key={booking._id}
                    className="border-b last:border-0 hover:bg-muted"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium text-foreground">
                        {booking.visitorName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {booking.visitorEmail}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {booking.visitorPhone}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{booking.tableName}</p>
                      <Badge variant="secondary" className="text-[10px] mt-0.5">
                        {booking.tableCategory}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <p>
                        {booking.isWholeTable
                          ? "Whole Table"
                          : `Chair(s): ${booking.selectedChairIndices?.map((c: number) => c + 1).join(", ")}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {booking.numberOfSeats} seat(s)
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 mt-1 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <Eye size={12} className="mr-1" /> See Details
                      </Button>
                    </td>
                    <td className="py-3 pr-4 font-semibold">
                      {formatPrice(booking.amount)}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        className={`text-xs ${getStatusColor(booking.paymentStatus)}`}
                      >
                        {booking.paymentStatus}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      {booking.hasCheckedIn ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          {booking.hasCheckedOut ? "Checked Out" : "Checked In"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {booking.paymentStatus === "Submitted" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                          disabled={confirmingId === booking._id}
                          onClick={() => handleConfirmPayment(booking._id)}
                        >
                          {confirmingId === booking._id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            "Confirm"
                          )}
                        </Button>
                      )}
                      {booking.paymentStatus === "Pending" && (
                        <span className="text-xs text-muted-foreground">Awaiting payment</span>
                      )}
                      {booking.paymentStatus === "Paid" && (
                        <span className="text-xs text-green-600 font-medium">Confirmed</span>
                      )}
                    </td>
                    <td className="py-3">
                      {booking.paymentStatus === "Paid" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={async () => {
                            try {
                              const res = await fetch(
                                `${apiURL}/round-table-bookings/download-ticket/${booking._id}`
                              );
                              if (!res.ok) throw new Error("Download failed");
                              const blob = await res.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `ticket_${booking._id}.pdf`;
                              a.click();
                              window.URL.revokeObjectURL(url);
                            } catch {
                              toast({
                                title: "Download failed",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <Download size={14} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {/* Detail Dialog — Radix-based so it nests cleanly inside other dialogs
          (the Participants > Round Tables tab opens this from inside another
          Dialog, and a hand-rolled fixed overlay clashed with the parent's
          focus trap and z-index management). */}
      <Dialog
        open={!!selectedBooking}
        onOpenChange={(open) => !open && setSelectedBooking(null)}
      >
        {selectedBooking && (
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">{t("Booking Details")}</DialogTitle>
              <DialogDescription className="text-xs">
                ID: {selectedBooking._id}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Visitor */}
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visitor</p>
                <p className="font-semibold text-foreground">{selectedBooking.visitorName}</p>
                <p className="text-xs text-muted-foreground">{selectedBooking.visitorEmail}</p>
                <p className="text-xs text-muted-foreground">{selectedBooking.visitorPhone}</p>
              </div>

              {/* Table Info */}
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Table</p>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{selectedBooking.tableName}</p>
                  <Badge variant="secondary" className="text-[10px]">{selectedBooking.tableCategory}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedBooking.isWholeTable ? "Whole Table" : "Individual Chairs"} &middot; {selectedBooking.numberOfSeats} seat(s)
                </p>
                <p className="text-xs text-muted-foreground">
                  Chairs: {selectedBooking.selectedChairIndices?.map((c: number) => c + 1).join(", ")}
                </p>
              </div>

              {/* Guest Details */}
              {guestDetailsOn && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Guest Details</p>
                {selectedBooking.seatGuests && selectedBooking.seatGuests.length > 0 ? (
                  <div className="space-y-2">
                    {selectedBooking.selectedChairIndices?.map((chairIdx: number) => {
                      const guest = selectedBooking.seatGuests?.find((g: any) => g.chairIndex === chairIdx);
                      return (
                        <div key={chairIdx} className="flex items-start gap-2 bg-muted rounded-lg px-3 py-2">
                          <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                            {chairIdx + 1}
                          </div>
                          {guest?.name ? (
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{guest.name}</p>
                              {guest.whatsApp && <p className="text-xs text-muted-foreground">{guest.whatsApp}</p>}
                              {guest.email && <p className="text-xs text-muted-foreground">{guest.email}</p>}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground italic mt-0.5">Not assigned</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No guest details provided.</p>
                )}
              </div>
              )}

              {/* Payment & Status */}
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment & Status</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-bold text-foreground">{formatPrice(selectedBooking.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment</span>
                  <Badge className={`text-xs ${getStatusColor(selectedBooking.paymentStatus)}`}>
                    {selectedBooking.paymentStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Check-In</span>
                  <span className="text-sm">
                    {selectedBooking.hasCheckedIn
                      ? selectedBooking.hasCheckedOut ? "Checked Out" : "Checked In"
                      : "Not yet"}
                  </span>
                </div>
                {selectedBooking.checkInTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Check-In Time</span>
                    <span className="text-xs text-muted-foreground">{new Date(selectedBooking.checkInTime).toLocaleString()}</span>
                  </div>
                )}
                {selectedBooking.checkOutTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Check-Out Time</span>
                    <span className="text-xs text-muted-foreground">{new Date(selectedBooking.checkOutTime).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Download ticket */}
              {selectedBooking.paymentStatus === "Paid" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    try {
                      const res = await fetch(`${apiURL}/round-table-bookings/download-ticket/${selectedBooking._id}`);
                      if (!res.ok) throw new Error("Download failed");
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `ticket_${selectedBooking._id}.pdf`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    } catch {
                      toast({ title: "Download failed", variant: "destructive" });
                    }
                  }}
                >
                  <Download size={14} className="mr-2" /> Download Ticket
                </Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default RoundTableBookings;
