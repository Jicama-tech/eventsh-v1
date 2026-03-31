import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Circle, Download, Loader2, Eye, X } from "lucide-react";
import { useCountry } from "@/hooks/useCountry";
import { useCurrency } from "@/hooks/useCurrencyhook";

interface RoundTableBookingsProps {
  eventId: string;
}

const RoundTableBookings = ({ eventId }: RoundTableBookingsProps) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
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
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-600";
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Circle size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No round table bookings yet</p>
        </CardContent>
      </Card>
    );
  }

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

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">
              {bookings.length}
            </p>
            <p className="text-xs text-gray-500">Total Bookings</p>
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
                <p className="text-xs text-gray-500">Confirmed</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{totalSeats}</p>
            <p className="text-xs text-gray-500">Seats Booked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {formatPrice(totalRevenue)}
            </p>
            <p className="text-xs text-gray-500">Revenue</p>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
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
                {bookings.map((booking) => (
                  <tr
                    key={booking._id}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-800">
                        {booking.visitorName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {booking.visitorEmail}
                      </p>
                      <p className="text-xs text-gray-400">
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
                      <p className="text-xs text-gray-400">
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
                        <span className="text-xs text-gray-400">-</span>
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
                        <span className="text-xs text-gray-400">Awaiting payment</span>
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
      {/* Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedBooking(null)}>
          <Card className="w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div>
                <CardTitle className="text-base">Booking Details</CardTitle>
                <p className="text-xs text-gray-400 mt-1">ID: {selectedBooking._id}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedBooking(null)}>
                <X size={16} />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Visitor */}
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Visitor</p>
                <p className="font-semibold text-gray-800">{selectedBooking.visitorName}</p>
                <p className="text-xs text-gray-500">{selectedBooking.visitorEmail}</p>
                <p className="text-xs text-gray-500">{selectedBooking.visitorPhone}</p>
              </div>

              {/* Table Info */}
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Table</p>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800">{selectedBooking.tableName}</p>
                  <Badge variant="secondary" className="text-[10px]">{selectedBooking.tableCategory}</Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {selectedBooking.isWholeTable ? "Whole Table" : "Individual Chairs"} &middot; {selectedBooking.numberOfSeats} seat(s)
                </p>
                <p className="text-xs text-gray-500">
                  Chairs: {selectedBooking.selectedChairIndices?.map((c: number) => c + 1).join(", ")}
                </p>
              </div>

              {/* Guest Details */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Guest Details</p>
                {selectedBooking.seatGuests && selectedBooking.seatGuests.length > 0 ? (
                  <div className="space-y-2">
                    {selectedBooking.selectedChairIndices?.map((chairIdx: number) => {
                      const guest = selectedBooking.seatGuests?.find((g: any) => g.chairIndex === chairIdx);
                      return (
                        <div key={chairIdx} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                          <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                            {chairIdx + 1}
                          </div>
                          {guest?.name ? (
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800">{guest.name}</p>
                              {guest.whatsApp && <p className="text-xs text-gray-500">{guest.whatsApp}</p>}
                              {guest.email && <p className="text-xs text-gray-400">{guest.email}</p>}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 italic mt-0.5">Not assigned</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No guest details provided.</p>
                )}
              </div>

              {/* Payment & Status */}
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment & Status</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Amount</span>
                  <span className="font-bold text-gray-800">{formatPrice(selectedBooking.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Payment</span>
                  <Badge className={`text-xs ${getStatusColor(selectedBooking.paymentStatus)}`}>
                    {selectedBooking.paymentStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Check-In</span>
                  <span className="text-sm">
                    {selectedBooking.hasCheckedIn
                      ? selectedBooking.hasCheckedOut ? "Checked Out" : "Checked In"
                      : "Not yet"}
                  </span>
                </div>
                {selectedBooking.checkInTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Check-In Time</span>
                    <span className="text-xs text-gray-500">{new Date(selectedBooking.checkInTime).toLocaleString()}</span>
                  </div>
                )}
                {selectedBooking.checkOutTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Check-Out Time</span>
                    <span className="text-xs text-gray-500">{new Date(selectedBooking.checkOutTime).toLocaleString()}</span>
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RoundTableBookings;
