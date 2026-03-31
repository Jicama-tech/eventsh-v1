import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  QrCode,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrencyhook";
import QRCode from "react-qr-code";
import jsQR from "jsqr";

const RoundTablePaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const apiURL = __API_URL__;

  const state = location.state as {
    bookings: any[];
    eventTitle: string;
    totalAmount: number;
    organizerId: string;
  } | null;

  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedBookings, setConfirmedBookings] = useState<any[]>([]);

  // Payment QR states
  const [paymentStatus, setPaymentStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [organizer, setOrganizer] = useState<any>(null);
  const [country, setCountry] = useState("");
  const { formatPrice } = useCurrency(country);
  const [upiId, setUpiId] = useState("");
  const [dynamicQR, setDynamicQR] = useState(false);
  const [dynamicUpiString, setDynamicUpiString] = useState("");
  const [mobileId, setMobileId] = useState("");
  const [dynamicUENString, setDynamicUENString] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60);

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;

  const totalAmount = state?.totalAmount || 0;

  // Timer
  useEffect(() => {
    if (!dynamicUpiString && !dynamicUENString) return;
    setTimeLeft(24 * 60 * 60);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [dynamicUpiString, dynamicUENString]);

  function formatTime(seconds: number) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  // Fetch organizer payment info
  useEffect(() => {
    if (!state?.organizerId) return;
    const fetchOrganizer = async () => {
      try {
        setPaymentStatus("loading");
        const res = await fetch(`${apiURL}/organizers/profile-get/${state.organizerId}`);
        const result = await res.json();
        if (result.data) {
          setOrganizer(result.data);
          setDynamicQR(result.data.dynamicQR || false);
          setMobileId(result.data.phone || "");
          setCountry(result.data.country || "IN");
          setPaymentStatus("ready");
        } else {
          setPaymentStatus("failed");
        }
      } catch {
        setPaymentStatus("failed");
      }
    };
    fetchOrganizer();
  }, [state?.organizerId]);

  // Build full payment QR URL
  const paymentQRImageUrl = organizer?.paymentURL
    ? organizer.paymentURL.startsWith("http")
      ? organizer.paymentURL
      : `${apiURL}${organizer.paymentURL}`
    : "";

  // Extract UPI from organizer's payment QR image
  useEffect(() => {
    if (!paymentQRImageUrl || upiId || country !== "IN") return;
    const extractUpi = async () => {
      try {
        setLoading(true);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = paymentQRImageUrl;
        await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        if (imageData) {
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data?.startsWith("upi://pay")) {
            const params = new URLSearchParams(code.data.replace("upi://pay?", ""));
            const extracted = params.get("pa");
            if (extracted) setUpiId(extracted);
          }
        }
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };
    extractUpi();
  }, [paymentQRImageUrl, upiId, country]);

  // Generate dynamic UPI string
  function generateDynamicUpi(): string {
    if (!upiId || !totalAmount) return "";
    return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
      organizer?.organizationName || "Payment"
    )}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(
      `Round Table - ${state?.eventTitle || ""}`
    )}`;
  }

  // Generate PayNow QR for SG
  async function generateDynamicPayNowQR(): Promise<string> {
    if (!mobileId || !totalAmount) return "";
    const cleanedMobileId = mobileId.startsWith("+65") ? mobileId.substring(3) : mobileId;
    const now = new Date();
    const expiryTime = new Date(now.getTime() + 90 * 60 * 60 * 1000);
    const formattedExpiry = `${expiryTime.getFullYear()}/${String(expiryTime.getMonth() + 1).padStart(2, "0")}/${String(expiryTime.getDate()).padStart(2, "0")} ${String(expiryTime.getHours()).padStart(2, "0")}:${String(expiryTime.getMinutes()).padStart(2, "0")}`;
    return `https://www.sgqrcode.com/paynow?mobile=${cleanedMobileId}&uen=&editable=0&amount=${totalAmount}&expiry=${encodeURIComponent(formattedExpiry)}&ref_id=&company=`;
  }

  // Auto-generate QR when showQR or dependencies change
  useEffect(() => {
    const loadDynamic = async () => {
      if (showQR && totalAmount > 0) {
        if (upiId && country === "IN") {
          setDynamicUpiString(generateDynamicUpi());
        }
        if (mobileId && country === "SG") {
          const qr = await generateDynamicPayNowQR();
          setDynamicUENString(qr);
        }
      }
    };
    loadDynamic();
  }, [upiId, totalAmount, country, showQR, mobileId]);

  const handlePayClick = () => {
    if (!isMobile) { setShowQR(true); return; }
    const paymentUrl = dynamicUpiString || dynamicUENString || "";
    if (!paymentUrl) return;
    if (isIOS) window.location.assign(paymentUrl);
    else window.location.href = paymentUrl;
  };

  const handleSubmitPayment = async () => {
    setConfirming(true);
    try {
      const submitPromises = (state?.bookings || []).map((booking) =>
        fetch(`${apiURL}/round-table-bookings/submit-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: booking._id }),
        }).then((r) => r.json())
      );
      const results = await Promise.all(submitPromises);
      const failed = results.filter((r) => !r.success);
      const successful = results.filter((r) => r.success);

      if (failed.length > 0) {
        toast({ title: "Submission failed", description: failed.map((f) => f.message).join("; "), variant: "destructive", duration: 5000 });
      }
      if (successful.length > 0) {
        setConfirmed(true);
        setConfirmedBookings(successful.map((r) => r.data));
        toast({ title: "Payment Submitted!", description: "The organizer will review and confirm your payment. Your ticket will be sent via WhatsApp.", duration: 8000 });
      }
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive", duration: 5000 });
    } finally {
      setConfirming(false);
    }
  };

  if (!state || !state.bookings || state.bookings.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <p className="text-gray-500 mb-4">No booking data found.</p>
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft size={16} className="mr-2" /> Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Round Table Booking</h1>
            <p className="text-sm text-gray-500">{state.eventTitle}</p>
          </div>
        </div>

        {/* Booking Details */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.bookings.map((booking, idx) => (
              <div key={booking._id || idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border">
                <div>
                  <p className="font-semibold text-sm">{booking.tableName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">{booking.tableCategory}</Badge>
                    <span className="text-xs text-gray-500">
                      {booking.sellingMode === "table" ? `Whole table (${booking.numberOfSeats} seats)` : `${booking.numberOfSeats} chair(s)`}
                    </span>
                  </div>
                </div>
                <span className="font-bold text-sm text-gray-800">{formatPrice(booking.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 border-t">
              <span className="font-bold text-gray-800">Total Amount</span>
              <span className="font-bold text-lg text-purple-600">{formatPrice(totalAmount)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Section */}
        {!confirmed ? (
          <>
            {/* Payment QR */}
            {paymentStatus === "loading" && (
              <Card className="rounded-2xl border-blue-200 bg-blue-50">
                <CardContent className="pt-6 flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                  <p className="text-blue-900">Loading payment details...</p>
                </CardContent>
              </Card>
            )}

            {paymentStatus === "ready" && (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="text-center">
                  <CardTitle className="flex items-center justify-center gap-2">
                    <QrCode className="w-5 h-5 text-blue-600" />
                    Pay {formatPrice(totalAmount)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  {!showQR ? (
                    <Button
                      className="w-full py-6 text-lg font-bold bg-blue-600 hover:bg-blue-700 rounded-xl"
                      onClick={() => setShowQR(true)}
                    >
                      Generate Payment QR for {formatPrice(totalAmount)}
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      {/* Timer */}
                      {(dynamicUpiString || dynamicUENString) && (
                        <div className="bg-gray-100 rounded-lg px-4 py-2 inline-block">
                          <span className="text-xs text-gray-500">Expires in: </span>
                          <span className="font-mono font-bold text-sm">{formatTime(timeLeft)}</span>
                        </div>
                      )}

                      {/* Case 1: India + Dynamic QR + UPI extracted */}
                      {country === "IN" && dynamicQR && dynamicUpiString && (
                        <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl shadow-lg border-2 border-blue-200">
                          <QRCode value={dynamicUpiString} size={260} fgColor="#000000" bgColor="#ffffff" />
                          <Button className="w-full py-4 text-base font-semibold" onClick={handlePayClick}>
                            {isMobile ? "Tap to Pay" : "Scan with any UPI App"}
                          </Button>
                          <p className="text-xs text-gray-500">Google Pay, PhonePe, Paytm, etc.</p>
                        </div>
                      )}

                      {/* Case 2: India + Dynamic QR ON but UPI not yet extracted — loading */}
                      {country === "IN" && dynamicQR && !dynamicUpiString && loading && (
                        <div className="flex justify-center animate-pulse">
                          <div className="w-64 h-64 bg-gray-100 rounded-xl border-4 border-dashed border-gray-300 flex items-center justify-center">
                            <div className="text-center text-gray-500">
                              <QrCode className="w-12 h-12 mx-auto mb-2" />
                              <p>Generating Dynamic QR...</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Case 3: India + Dynamic QR ON but UPI extraction failed — fallback to static */}
                      {country === "IN" && dynamicQR && !dynamicUpiString && !loading && paymentQRImageUrl && (
                        <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl shadow-lg border-2 border-blue-200">
                          <img src={paymentQRImageUrl} alt="Payment QR" className="w-64 h-64 object-contain" />
                          <p className="font-bold text-lg text-green-700">Pay {formatPrice(totalAmount)}</p>
                          <p className="text-xs text-gray-500">Scan QR and enter the amount manually</p>
                        </div>
                      )}

                      {/* Case 4: India + Dynamic QR OFF — show static image */}
                      {country === "IN" && !dynamicQR && paymentQRImageUrl && (
                        <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl shadow-lg border-2 border-blue-200">
                          <img src={paymentQRImageUrl} alt="Payment QR" className="w-64 h-64 object-contain" />
                          <p className="font-bold text-lg text-green-700">Pay {formatPrice(totalAmount)}</p>
                          <p className="text-xs text-gray-500">Scan QR and enter the amount manually</p>
                        </div>
                      )}

                      {/* Case 5: Singapore + PayNow dynamic QR ready */}
                      {country === "SG" && dynamicUENString && (
                        <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl shadow-lg border-2 border-blue-200">
                          <QRCode value={dynamicUENString} size={260} fgColor="#000000" bgColor="#ffffff" />
                          <p className="font-bold text-lg text-green-700">Pay {formatPrice(totalAmount)}</p>
                          <p className="text-xs text-gray-500">Scan with PayNow / DBS / OCBC</p>
                        </div>
                      )}

                      {/* Case 6: Singapore but no phone for PayNow — fallback to static QR */}
                      {country === "SG" && !dynamicUENString && paymentQRImageUrl && (
                        <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl shadow-lg border-2 border-blue-200">
                          <img src={paymentQRImageUrl} alt="Payment QR" className="w-64 h-64 object-contain" />
                          <p className="font-bold text-lg text-green-700">Pay {formatPrice(totalAmount)}</p>
                          <p className="text-xs text-gray-500">Scan QR and enter the amount manually</p>
                        </div>
                      )}

                      {/* Case 7: Other countries or no QR at all — show static if available */}
                      {country !== "IN" && country !== "SG" && paymentQRImageUrl && (
                        <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl shadow-lg border-2 border-blue-200">
                          <img src={paymentQRImageUrl} alt="Payment QR" className="w-64 h-64 object-contain" />
                          <p className="font-bold text-lg text-green-700">Pay {formatPrice(totalAmount)}</p>
                          <p className="text-xs text-gray-500">Scan QR to make payment</p>
                        </div>
                      )}

                      {/* Case 8: No QR image at all */}
                      {!paymentQRImageUrl && !dynamicUpiString && !dynamicUENString && !loading && (
                        <div className="p-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl text-center">
                          <p className="text-yellow-800 font-semibold">No payment QR configured</p>
                          <p className="text-yellow-600 text-sm mt-1">Please contact the organizer for payment instructions.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Confirm after payment */}
                  {showQR && (
                    <div className="border-t pt-4 mt-4">
                      <p className="text-sm text-gray-600 mb-3">
                        After completing payment, click below to notify the organizer:
                      </p>
                      <Button
                        className="w-full py-5 rounded-xl text-base font-bold bg-green-600 hover:bg-green-700"
                        onClick={handleSubmitPayment}
                        disabled={confirming}
                      >
                        {confirming ? (
                          <><Loader2 size={18} className="mr-2 animate-spin" /> Submitting...</>
                        ) : (
                          "I Have Paid - Submit for Confirmation"
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {paymentStatus === "failed" && (
              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <p className="text-sm text-gray-600">
                    Could not load payment QR. You can still submit your booking for organizer confirmation:
                  </p>
                  <Button
                    className="w-full py-5 rounded-xl text-base font-bold bg-purple-600 hover:bg-purple-700"
                    onClick={handleSubmitPayment}
                    disabled={confirming}
                  >
                    {confirming ? (
                      <><Loader2 size={18} className="mr-2 animate-spin" /> Submitting...</>
                    ) : (
                      "Submit Payment for Confirmation"
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="rounded-2xl shadow-sm border-amber-200">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-amber-700">Payment Submitted!</h3>
              <p className="text-sm text-gray-600 max-w-sm mx-auto">
                Your payment has been submitted for review. Once the organizer confirms, your QR ticket will be sent to your WhatsApp automatically.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-2">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">What happens next?</p>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-[10px] font-bold mt-0.5 flex-shrink-0">1</div>
                  <p className="text-xs text-gray-600">Organizer reviews your payment</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-[10px] font-bold mt-0.5 flex-shrink-0">2</div>
                  <p className="text-xs text-gray-600">Payment is confirmed</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-[10px] font-bold mt-0.5 flex-shrink-0">3</div>
                  <p className="text-xs text-gray-600">QR ticket is sent to your WhatsApp</p>
                </div>
              </div>

              {confirmedBookings.length > 0 && (
                <div className="space-y-2">
                  {confirmedBookings.map((booking) => (
                    <div key={booking._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border text-left">
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{booking.tableName}</p>
                        <p className="text-xs text-gray-500">{booking.numberOfSeats} seat(s)</p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700 text-xs">Awaiting Confirmation</Badge>
                    </div>
                  ))}
                </div>
              )}

              <Button className="w-full rounded-xl mt-4" onClick={() => navigate(-1)}>
                Back to Event
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default RoundTablePaymentPage;
