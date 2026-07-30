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
import { GraduationCap, Download, Loader2, Eye } from "lucide-react";
import { useCountry } from "@/hooks/useCountry";
import { useCurrency } from "@/hooks/useCurrencyhook";

interface WorkshopBookingsProps {
  eventId: string;
}

const WorkshopBookings = ({ eventId }: WorkshopBookingsProps) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [wsSearch, setWsSearch] = useState("");
  const [wsPaymentFilter, setWsPaymentFilter] = useState("all");
  const { toast } = useToast();
  const apiURL = __API_URL__;
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${apiURL}/workshop-bookings/event/${eventId}`
        );
        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            setBookings(result.data || []);
          }
        }
      } catch {
        toast({
          title: "Failed to load workshop bookings",
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
      const res = await fetch(`${apiURL}/workshop-bookings/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Payment Confirmed!", description: "QR ticket generated and emailed to the visitor.", duration: 5000 });
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

  // IMPORTANT: this hook MUST stay above any early returns — see the
  // identical note in RoundTableBookings.tsx.
  const { totalRevenue, totalSeats, confirmedCount, submittedCount } = useMemo(() => {
    const paid = bookings.filter((b) => b.paymentStatus === "Paid");
    const submitted = bookings.filter((b) => b.paymentStatus === "Submitted");
    return {
      totalRevenue: paid.reduce((sum, b) => sum + (b.amount || 0), 0),
      totalSeats: paid.reduce((sum, b) => sum + (b.quantity || 0), 0),
      confirmedCount: paid.length,
      submittedCount: submitted.length,
    };
  }, [bookings]);

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
          <GraduationCap size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No workshop bookings yet</p>
        </CardContent>
      </Card>
    );
  }

  const filteredBookings = bookings.filter((b) => {
    const q = wsSearch.trim().toLowerCase();
    if (q) {
      const hay = [b.visitorName, b.visitorEmail, b.visitorPhone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (wsPaymentFilter !== "all" && b.paymentStatus !== wsPaymentFilter)
      return false;
    return true;
  });

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
            <GraduationCap size={16} />
            Workshop Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="text"
              placeholder="Search visitor, email or phone…"
              value={wsSearch}
              onChange={(e) => setWsSearch(e.target.value)}
              className="w-64 rounded-md border px-3 py-2 text-sm"
            />
            <select
              value={wsPaymentFilter}
              onChange={(e) => setWsPaymentFilter(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option value="all">All payments</option>
              <option value="Paid">Paid</option>
              <option value="Submitted">Submitted</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunded</option>
            </select>
            <span className="ml-auto text-sm text-gray-500">
              Showing {filteredBookings.length} of {bookings.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Visitor</th>
                  <th className="pb-3 pr-4 font-medium">Workshop</th>
                  <th className="pb-3 pr-4 font-medium">Qty</th>
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
                      className="py-8 text-center text-gray-500"
                    >
                      No bookings match your filters.
                    </td>
                  </tr>
                )}
                {filteredBookings.map((booking) => (
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
                      <p className="font-medium">{booking.itemName}</p>
                      <Badge variant="secondary" className="text-[10px] mt-0.5">
                        {booking.bookingType === "package" ? "Package" : "Workshop"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 mt-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 block"
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <Eye size={12} className="mr-1" /> See Details
                      </Button>
                    </td>
                    <td className="py-3 pr-4">{booking.quantity}</td>
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
                          Checked In
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
                                `${apiURL}/workshop-bookings/download-ticket/${booking._id}`
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

      <Dialog
        open={!!selectedBooking}
        onOpenChange={(open) => !open && setSelectedBooking(null)}
      >
        {selectedBooking && (
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">Booking Details</DialogTitle>
              <DialogDescription className="text-xs">
                ID: {selectedBooking._id}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Visitor</p>
                <p className="font-semibold text-gray-800">{selectedBooking.visitorName}</p>
                <p className="text-xs text-gray-500">{selectedBooking.visitorEmail}</p>
                <p className="text-xs text-gray-500">{selectedBooking.visitorPhone}</p>
              </div>

              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Workshop</p>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800">{selectedBooking.itemName}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedBooking.bookingType === "package" ? "Package" : "Workshop"}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">
                  Quantity: {selectedBooking.quantity}
                </p>
                {selectedBooking.bookingType === "package" && (
                  <p className="text-xs text-gray-500">
                    Includes {selectedBooking.sessionIds?.length || 0} workshop(s)
                  </p>
                )}
              </div>

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
                    {selectedBooking.hasCheckedIn ? "Checked In" : "Not yet"}
                  </span>
                </div>
                {selectedBooking.checkInTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Check-In Time</span>
                    <span className="text-xs text-gray-500">{new Date(selectedBooking.checkInTime).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {selectedBooking.paymentStatus === "Paid" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    try {
                      const res = await fetch(`${apiURL}/workshop-bookings/download-ticket/${selectedBooking._id}`);
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

export default WorkshopBookings;
