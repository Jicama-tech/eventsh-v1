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
  GraduationCap,
  CreditCard,
  Clock,
  Calendar,
  MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useCountry } from "@/hooks/useCountry";
import QRCode from "react-qr-code";
import PaymentFeedbackDialog from "./PaymentFeedbackDialog";

const WorkshopRequestPaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const apiURL = __API_URL__;
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  const orderData = location.state as any;

  const [isProcessing, setIsProcessing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [paymentQRCode, setPaymentQRCode] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    "loading" | "ready" | "success" | "failed"
  >("loading");
  const [dynamicQR, setDynamicQR] = useState(false);
  const [dynamicUpiString, setDynamicUpiString] = useState("");
  const [organizer, setOrganizer] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const fee = Number(orderData?.fee) || 0;
  const isFree = !orderData?.isCharged || fee <= 0;

  useEffect(() => {
    if (!orderData || !orderData.workshopRequestId) {
      toast({
        title: "No Order Data",
        description: "Please complete the workshop application first",
        variant: "destructive",
      });
      navigate(-1);
      return;
    }
    if (isFree) {
      setPaymentStatus("ready");
    } else {
      fetchOrganizerPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dynamicUpiString && !paymentQRCode) return;
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
  }, [dynamicUpiString, paymentQRCode]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const fetchOrganizerPayment = async () => {
    try {
      setPaymentStatus("loading");
      const res = await fetch(
        `${apiURL}/organizers/profile-get/${orderData.organizerId}`,
      );
      const result = await res.json();
      if (result.data) {
        setOrganizer(result.data);
        setPaymentQRCode(result.data.paymentURL);
        setDynamicQR(result.data.dynamicQR);
        setPaymentStatus("ready");

        if (result.data.dynamicQR) {
          const upiId = result.data.phone || "";
          const name = encodeURIComponent(
            result.data.organizationName || "EventSH",
          );
          setDynamicUpiString(
            `upi://pay?pa=${upiId}&pn=${name}&am=${fee}&cu=INR`,
          );
        }
      } else {
        setPaymentStatus("failed");
      }
    } catch {
      setPaymentStatus("failed");
    }
  };

  const handlePayClick = () => {
    if (!isMobile) return;
    const paymentUrl = dynamicUpiString || "";
    if (paymentUrl) window.location.href = paymentUrl;
  };

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(
        `${apiURL}/workshop-requests/${orderData.workshopRequestId}/payment-submitted`,
        { method: "PATCH" },
      );
      const data = await res.json();
      if (data.success) {
        setPaymentStatus("success");
        toast({
          title: "Payment Submitted!",
          description:
            "The organizer will verify and publish your workshop.",
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
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-bold text-lg">Workshop Hosting Fee</h1>
            <p className="text-xs text-muted-foreground">
              Complete payment to confirm your workshop slot
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {paymentStatus === "success" && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="py-8 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h2 className="text-xl font-bold text-green-800">
                Payment Submitted!
              </h2>
              <p className="text-green-700 text-sm">
                The organizer will verify your payment and publish your
                workshop.
              </p>
              <Button onClick={() => navigate(-1)} variant="outline">
                Back to Event
              </Button>
            </CardContent>
          </Card>
        )}

        {paymentStatus !== "success" && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                  Workshop Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{orderData.eventTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {orderData.eventDate}
                    </p>
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
                  <p className="text-sm font-medium">
                    Host: {orderData.hostName}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Workshop: {orderData.workshopName}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {isFree ? "Booking Summary" : "Payment Summary"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Hosting Fee</span>
                  <span className="font-bold text-lg">
                    {isFree ? "Free" : formatPrice(fee)}
                  </span>
                </div>
                {!isFree && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Total Amount</span>
                      <span className="font-bold text-xl text-primary">
                        {formatPrice(fee)}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {!isFree && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-muted-foreground">
                  Payment expires in
                </span>
                <Badge variant="outline" className="font-mono">
                  {formatTime(timeLeft)}
                </Badge>
              </div>
            )}

            {paymentStatus === "loading" && !isFree && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Loading payment details...
                  </p>
                </CardContent>
              </Card>
            )}

            {isFree && paymentStatus === "ready" && (
              <Card>
                <CardContent className="py-6 space-y-4">
                  <div className="text-center">
                    <GraduationCap className="h-12 w-12 text-blue-500 mx-auto mb-3" />
                    <h3 className="font-bold text-lg">
                      Confirm Your Workshop Slot
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      This is a free slot. Click below to confirm.
                    </p>
                  </div>
                  <Button
                    className="w-full h-12 text-base font-semibold"
                    style={{ backgroundColor: "#6366f1" }}
                    disabled={isProcessing}
                    onClick={handleConfirmPayment}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />{" "}
                        Confirming...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2" /> Confirm My
                        Workshop
                      </>
                    )}
                  </Button>
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
                  {dynamicQR && dynamicUpiString ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-white p-4 rounded-xl border-2 shadow-sm">
                        <QRCode value={dynamicUpiString} size={200} />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Scan with any UPI app to pay
                      </p>
                      {isMobile && (
                        <Button
                          onClick={handlePayClick}
                          className="w-full"
                          style={{ backgroundColor: "#6366f1" }}
                        >
                          Pay {formatPrice(fee)} via UPI
                        </Button>
                      )}
                    </div>
                  ) : paymentQRCode ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={
                          paymentQRCode.startsWith("/")
                            ? `${apiURL?.replace("/api", "")}${paymentQRCode}`
                            : paymentQRCode
                        }
                        alt="Payment QR"
                        className="w-52 h-52 object-contain border rounded-xl"
                      />
                      <p className="text-xs text-muted-foreground text-center">
                        Scan the organizer's payment QR code
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <p>
                        Payment QR code not available. Please contact the
                        organizer directly.
                      </p>
                    </div>
                  )}

                  <Separator />

                  <Button
                    className="w-full h-12 text-base font-semibold"
                    style={{ backgroundColor: "#6366f1" }}
                    disabled={isProcessing}
                    onClick={handleConfirmPayment}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />{" "}
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2" /> I've
                        Completed the Payment
                      </>
                    )}
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground">
                    After clicking, the organizer will verify your payment and
                    publish your workshop.
                  </p>
                </CardContent>
              </Card>
            )}

            {paymentStatus === "failed" && (
              <Card className="border-red-200">
                <CardContent className="py-8 text-center space-y-3">
                  <p className="text-red-600 font-medium">
                    Failed to load payment details
                  </p>
                  <Button variant="outline" onClick={fetchOrganizerPayment}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <PaymentFeedbackDialog
        open={showFeedback}
        onOpenChange={setShowFeedback}
        paymentType="workshop"
        organizerId={orderData?.organizerId}
        eventTitle={orderData?.eventTitle}
        payerName={orderData?.hostName}
        bookingId={orderData?.workshopRequestId}
        amount={fee}
        onDone={() => navigate(-1)}
      />
    </div>
  );
};

export default WorkshopRequestPaymentPage;
