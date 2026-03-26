import React, { useState, useEffect, useRef } from "react";
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
  CreditCard,
  Clock,
  Calendar,
  MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useCountry } from "@/hooks/useCountry";
import QRCode from "react-qr-code";

const SpeakerPaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const apiURL = __API_URL__;
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  const orderData = location.state;

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentQRCode, setPaymentQRCode] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"loading" | "ready" | "success" | "failed">("loading");
  const [showQR, setShowQR] = useState(false);
  const [dynamicQR, setDynamicQR] = useState(false);
  const [dynamicUpiString, setDynamicUpiString] = useState("");
  const [organizer, setOrganizer] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const isFree = !orderData?.isCharged || !orderData?.fee || orderData.fee <= 0;

  useEffect(() => {
    if (!orderData || !orderData.speakerRequestId) {
      toast({ title: "No Order Data", description: "Please complete the speaker application first", variant: "destructive" });
      navigate(-1);
      return;
    }
    if (isFree) {
      // Free speaker - auto-confirm
      setPaymentStatus("ready");
    } else {
      fetchOrganizerPayment();
    }
  }, []);

  useEffect(() => {
    if (!dynamicUpiString && !paymentQRCode) return;
    setTimeLeft(24 * 60 * 60);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [dynamicUpiString, paymentQRCode]);

  useEffect(() => {
    if (timeLeft === 0) {
      const timer = setTimeout(() => navigate(-1), 2000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, navigate]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const fetchOrganizerPayment = async () => {
    try {
      setPaymentStatus("loading");
      const res = await fetch(`${apiURL}/organizers/profile-get/${orderData.organizerId}`);
      const result = await res.json();
      if (result.data) {
        setOrganizer(result.data);
        setPaymentQRCode(result.data.paymentURL);
        setDynamicQR(result.data.dynamicQR);
        setPaymentStatus("ready");

        if (result.data.dynamicQR) {
          const amount = orderData.fee || 0;
          const upiId = result.data.phone || "";
          const name = encodeURIComponent(result.data.organizationName || "EventSH");
          setDynamicUpiString(`upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR`);
        }
      } else {
        setPaymentStatus("failed");
      }
    } catch (error) {
      setPaymentStatus("failed");
    }
  };

  const handlePayClick = () => {
    if (!isMobile) {
      setShowQR(true);
      return;
    }
    const paymentUrl = dynamicUpiString || "";
    if (paymentUrl) window.location.href = paymentUrl;
  };

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${apiURL}/speaker-requests/${orderData.speakerRequestId}/payment-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "Paid", notes: "Payment submitted by speaker" }),
      });
      const data = await res.json();
      if (data.success) {
        setPaymentStatus("success");
        toast({ title: "Payment Submitted!", description: "The organizer will verify and issue your speaker pass." });
        setTimeout(() => navigate(-1), 2000);
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to confirm payment", variant: "destructive" });
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
                  <CreditCard className="h-5 w-5" />
                  {isFree ? "Booking Summary" : "Payment Summary"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Speaker Slot Fee</span>
                  <span className="font-bold text-lg">{isFree ? "Free" : formatPrice(orderData.fee || 0)}</span>
                </div>
                {!isFree && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Total Amount</span>
                      <span className="font-bold text-xl text-primary">{formatPrice(orderData.fee || 0)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Timer - only for paid */}
            {!isFree && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-muted-foreground">Payment expires in</span>
                <Badge variant="outline" className="font-mono">{formatTime(timeLeft)}</Badge>
              </div>
            )}

            {/* Payment QR */}
            {paymentStatus === "loading" && !isFree && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">Loading payment details...</p>
                </CardContent>
              </Card>
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

            {paymentStatus === "ready" && !isFree && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-center">
                    {organizer?.organizationName || "Organizer"} - Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* QR Code */}
                  {dynamicQR && dynamicUpiString ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-white p-4 rounded-xl border-2 shadow-sm">
                        <QRCode value={dynamicUpiString} size={200} />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">Scan with any UPI app to pay</p>
                      {isMobile && (
                        <Button onClick={handlePayClick} className="w-full" style={{ backgroundColor: "#6366f1" }}>
                          Pay {formatPrice(orderData.fee || 0)} via UPI
                        </Button>
                      )}
                    </div>
                  ) : paymentQRCode ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={paymentQRCode.startsWith("/") ? `${apiURL?.replace("/api", "")}${paymentQRCode}` : paymentQRCode}
                        alt="Payment QR"
                        className="w-52 h-52 object-contain border rounded-xl"
                      />
                      <p className="text-xs text-muted-foreground text-center">Scan the organizer's payment QR code</p>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <p>Payment QR code not available. Please contact the organizer directly.</p>
                    </div>
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

            {paymentStatus === "failed" && (
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
    </div>
  );
};

export default SpeakerPaymentPage;
