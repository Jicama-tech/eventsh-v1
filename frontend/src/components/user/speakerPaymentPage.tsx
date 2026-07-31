import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mic,
  QrCode,
  Clock,
  Calendar,
  MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrencyhook";
import QRCode from "react-qr-code";
import PaymentFeedbackDialog from "./PaymentFeedbackDialog";
import jsQR from "jsqr";
import { buildPayNowQrUrl } from "@/lib/paynowQr";

const SpeakerPaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const apiURL = __API_URL__;

  const orderData = location.state as any;

  const [isProcessing, setIsProcessing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    "loading" | "ready" | "success" | "failed"
  >("loading");
  const [organizer, setOrganizer] = useState<any>(null);
  // The ORGANIZER's country decides UPI vs PayNow eligibility — not the
  // visitor's own locale (useCountry()), which is what this page used to
  // read, silently breaking PayNow for every Singapore organizer.
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

  const fee = Number(orderData?.fee) || 0;
  const isFree = !orderData?.isCharged || fee <= 0;

  useEffect(() => {
    if (!orderData || !orderData.speakerRequestId) {
      toast({
        title: "No Order Data",
        description: "Please complete the speaker application first",
        variant: "destructive",
      });
      navigate(-1);
      return;
    }
    if (isFree) {
      setPaymentStatus("ready");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer
  useEffect(() => {
    if (!dynamicUpiString && !dynamicUENString) return;
    setTimeLeft(24 * 60 * 60);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [dynamicUpiString, dynamicUENString]);

  useEffect(() => {
    if (timeLeft === 0 && !isFree) {
      const timer = setTimeout(() => navigate(-1), 2000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, navigate, isFree]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Fetch organizer payment info
  useEffect(() => {
    if (!orderData?.organizerId || isFree) return;
    fetchOrganizerPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderData?.organizerId]);

  const fetchOrganizerPayment = async () => {
    try {
      setPaymentStatus("loading");
      const res = await fetch(
        `${apiURL}/organizers/profile-get/${orderData.organizerId}`,
      );
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
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        if (imageData) {
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data?.startsWith("upi://pay")) {
            const params = new URLSearchParams(
              code.data.replace("upi://pay?", ""),
            );
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

  // Generate dynamic UPI string (India)
  function generateDynamicUpi(): string {
    if (!upiId || !fee) return "";
    return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
      organizer?.organizationName || "Payment",
    )}&am=${fee}&cu=INR&tn=${encodeURIComponent(
      `Speaker slot fee - ${orderData?.eventTitle || ""}`,
    )}`;
  }

  // Generate PayNow QR for SG (UEN-first; mobile proxy fallback)
  async function generateDynamicPayNowQR(): Promise<string> {
    if (!fee) return "";
    return (
      buildPayNowQrUrl({
        organizer: {
          UENNumber: organizer?.UENNumber,
          payNowId: organizer?.payNowId || organizer?.phone || mobileId,
        },
        amount: fee,
      }) || ""
    );
  }

  // Auto-generate QR when showQR or dependencies change
  useEffect(() => {
    const loadDynamic = async () => {
      if (showQR && fee > 0) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upiId, fee, country, showQR, mobileId]);

  const handlePayClick = () => {
    if (!isMobile) {
      setShowQR(true);
      return;
    }
    const paymentUrl = dynamicUpiString || dynamicUENString || "";
    if (!paymentUrl) return;
    if (isIOS) window.location.assign(paymentUrl);
    else window.location.href = paymentUrl;
  };

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(
        `${apiURL}/speaker-requests/${orderData.speakerRequestId}/payment-status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentStatus: "Paid",
            notes: "Payment submitted by speaker",
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setPaymentStatus("success");
        toast({
          title: "Payment Submitted!",
          description: "The organizer will verify and issue your speaker pass.",
        });
        setShowFeedback(true);
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to confirm payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!orderData) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-bold text-lg">Speaker Slot Payment</h1>
            <p className="text-xs text-muted-foreground">Complete payment to confirm your speaker slot</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Success State */}
        {paymentStatus === "success" && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="py-8 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h2 className="text-xl font-bold text-green-800">Payment Submitted!</h2>
              <p className="text-green-700 text-sm">
                The organizer will verify your payment and issue your speaker pass via WhatsApp.
              </p>
              <Button onClick={() => navigate(-1)} variant="outline">
                Back to Event
              </Button>
            </CardContent>
          </Card>
        )}

        {paymentStatus !== "success" && (
          <>
            {/* Event & Session Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mic className="h-5 w-5 text-purple-600" />
                  Session Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{orderData.eventTitle}</p>
                    <p className="text-sm text-muted-foreground">{orderData.eventDate}</p>
                  </div>
                </div>
                {orderData.eventLocation && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm">{orderData.eventLocation}</p>
                  </div>
                )}
                <Separator />
                <div>
                  <p className="text-sm font-medium">Speaker: {orderData.speakerName}</p>
                  {orderData.sessionTopic && (
                    <p className="text-sm text-muted-foreground mt-1">Session: {orderData.sessionTopic}</p>
                  )}
                  {orderData.sessionTime && (
                    <p className="text-sm text-muted-foreground">Time: {orderData.sessionTime}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  {isFree ? "Booking Summary" : "Payment Summary"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Speaker Slot Fee</span>
                  <span className="font-bold text-lg">{isFree ? "Free" : formatPrice(fee)}</span>
                </div>
                {!isFree && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Total Amount</span>
                      <span className="font-bold text-xl text-primary">{formatPrice(fee)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Timer - only for paid */}
            {!isFree && (dynamicUpiString || dynamicUENString) && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-muted-foreground">Payment expires in</span>
                <Badge variant="outline" className="font-mono">{formatTime(timeLeft)}</Badge>
              </div>
            )}

            {/* Free speaker - just confirm */}
            {isFree && paymentStatus === "ready" && (
              <Card>
                <CardContent className="py-6 space-y-4">
                  <div className="text-center">
                    <Mic className="h-12 w-12 text-purple-500 mx-auto mb-3" />
                    <h3 className="font-bold text-lg">Confirm Your Speaker Slot</h3>
                    <p className="text-sm text-muted-foreground mt-1">This is a free slot. Click below to confirm your session.</p>
                  </div>
                  <Button
                    className="w-full h-12 text-base font-semibold"
                    style={{ backgroundColor: "#6366f1" }}
                    disabled={isProcessing}
                    onClick={handleConfirmPayment}
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Confirming...</>
                    ) : (
                      <><CheckCircle2 className="h-5 w-5 mr-2" /> Confirm My Speaker Slot</>
                    )}
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground">
                    The organizer will issue your speaker pass via WhatsApp.
                  </p>
                </CardContent>
              </Card>
            )}

            {!isFree && paymentStatus === "loading" && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">Loading payment details...</p>
                </CardContent>
              </Card>
            )}

            {!isFree && paymentStatus === "ready" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-center">
                    {organizer?.organizationName || "Organizer"} - Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!showQR ? (
                    <Button
                      className="w-full py-6 text-lg font-bold"
                      style={{ backgroundColor: "#6366f1" }}
                      onClick={() => setShowQR(true)}
                    >
                      Generate Payment QR for {formatPrice(fee)}
                    </Button>
                  ) : (
                    <>
                      {/* Case 1: India + Dynamic QR + UPI extracted */}
                      {country === "IN" && dynamicQR && dynamicUpiString && (
                        <div className="flex flex-col items-center gap-3">
                          <div className="bg-white p-4 rounded-xl border-2 shadow-sm">
                            <QRCode value={dynamicUpiString} size={200} />
                          </div>
                          <p className="text-xs text-muted-foreground text-center">Scan with any UPI app to pay</p>
                          {isMobile && (
                            <Button onClick={handlePayClick} className="w-full" style={{ backgroundColor: "#6366f1" }}>
                              Pay {formatPrice(fee)} via UPI
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Case 2: India + Dynamic QR ON but UPI not yet extracted */}
                      {country === "IN" && dynamicQR && !dynamicUpiString && loading && (
                        <div className="flex justify-center animate-pulse">
                          <div className="w-52 h-52 bg-gray-100 rounded-xl border-4 border-dashed border-gray-300 flex items-center justify-center">
                            <div className="text-center text-gray-500">
                              <QrCode className="w-12 h-12 mx-auto mb-2" />
                              <p className="text-sm">Generating Dynamic QR...</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Case 3/4: India, static QR (extraction failed or dynamic off) */}
                      {country === "IN" &&
                        !dynamicUpiString &&
                        !loading &&
                        paymentQRImageUrl && (
                          <div className="flex flex-col items-center gap-3">
                            <img
                              src={paymentQRImageUrl}
                              alt="Payment QR"
                              className="w-52 h-52 object-contain border rounded-xl"
                            />
                            <p className="text-xs text-muted-foreground text-center">Scan the organizer's payment QR code</p>
                          </div>
                        )}

                      {/* Case 5: Singapore + PayNow dynamic QR ready. dynamicUENString is
                          already a rendered QR image URL (sgqrcode.com), not raw payload
                          text — render it directly, don't re-encode it as a new QR. */}
                      {country === "SG" && dynamicUENString && (
                        <div className="flex flex-col items-center gap-3">
                          <img
                            src={dynamicUENString}
                            alt="PayNow QR"
                            className="w-52 h-52 object-contain border-2 rounded-xl shadow-sm"
                          />
                          <p className="text-xs text-muted-foreground text-center">Scan with PayNow / DBS / OCBC</p>
                        </div>
                      )}

                      {/* Case 6: Singapore, no PayNow proxy — static fallback */}
                      {country === "SG" && !dynamicUENString && paymentQRImageUrl && (
                        <div className="flex flex-col items-center gap-3">
                          <img
                            src={paymentQRImageUrl}
                            alt="Payment QR"
                            className="w-52 h-52 object-contain border rounded-xl"
                          />
                          <p className="text-xs text-muted-foreground text-center">Scan the organizer's payment QR code</p>
                        </div>
                      )}

                      {/* Case 7: Other countries — static if available */}
                      {country !== "IN" && country !== "SG" && paymentQRImageUrl && (
                        <div className="flex flex-col items-center gap-3">
                          <img
                            src={paymentQRImageUrl}
                            alt="Payment QR"
                            className="w-52 h-52 object-contain border rounded-xl"
                          />
                          <p className="text-xs text-muted-foreground text-center">Scan the organizer's payment QR code</p>
                        </div>
                      )}

                      {/* Case 8: No QR at all */}
                      {!paymentQRImageUrl &&
                        !dynamicUpiString &&
                        !dynamicUENString &&
                        !loading && (
                          <div className="text-center py-6 text-muted-foreground">
                            <p>Payment QR code not available. Please contact the organizer directly.</p>
                          </div>
                        )}
                    </>
                  )}

                  <Separator />

                  {/* Confirm Payment Button */}
                  <Button
                    className="w-full h-12 text-base font-semibold"
                    style={{ backgroundColor: "#6366f1" }}
                    disabled={isProcessing}
                    onClick={handleConfirmPayment}
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processing...</>
                    ) : (
                      <><CheckCircle2 className="h-5 w-5 mr-2" /> I've Completed the Payment</>
                    )}
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground">
                    After clicking, the organizer will verify your payment and issue your speaker pass via WhatsApp.
                  </p>
                </CardContent>
              </Card>
            )}

            {!isFree && paymentStatus === "failed" && (
              <Card className="border-red-200">
                <CardContent className="py-8 text-center space-y-3">
                  <p className="text-red-600 font-medium">Failed to load payment details</p>
                  <Button variant="outline" onClick={fetchOrganizerPayment}>Retry</Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <PaymentFeedbackDialog
        open={showFeedback}
        onOpenChange={setShowFeedback}
        paymentType="speaker"
        organizerId={orderData?.organizerId}
        eventTitle={orderData?.eventTitle}
        payerName={orderData?.speakerName}
        bookingId={orderData?.speakerRequestId}
        amount={fee}
        onDone={() => navigate(-1)}
      />
    </div>
  );
};

export default SpeakerPaymentPage;
