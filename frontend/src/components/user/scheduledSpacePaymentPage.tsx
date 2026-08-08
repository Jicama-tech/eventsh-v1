import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Upload,
  X,
  QrCode,
  Clock,
  AlertCircle,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrencyhook";
import QRCode from "react-qr-code";
import jsQR from "jsqr";
import { buildPayNowQrUrl } from "@/lib/paynowQr";

const apiURL = __API_URL__;

interface SelectedSlot {
  positionId: string;
  templateId: string;
  slotId: string;
  spaceName: string;
  facilityType?: string;
  slotLabel?: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
}

interface OrderData {
  requestId: string;
  eventId: string;
  eventInfo?: { title?: string; date?: string; venue?: string };
  registrant?: { name?: string; email?: string };
  selectedSlots: SelectedSlot[];
  total: number;
}

function formatTime(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Payment page for a confirmed Scheduled Space registration. Modeled on
// tablePaymentPage.tsx's dynamic-QR shape: a country-aware QR (dynamic UPI
// for India — decoded from the organizer's uploaded static QR and
// re-encoded with the exact amount; dynamic PayNow for Singapore via
// buildPayNowQrUrl) with a 24h countdown and mobile deep-link, falling back
// to the organizer's plain uploaded QR when dynamic QR isn't enabled or
// can't be generated. Simpler than Stalls in one respect: no minimum/full
// payment split — a slot is always paid for in full.
export default function ScheduledSpacePaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const orderData = location.state as OrderData | null;

  const [country, setCountry] = useState("");
  const { formatPrice } = useCurrency(country);
  const [organizer, setOrganizer] = useState<any>(null);
  const [paymentQR, setPaymentQR] = useState<string | null>(null);
  const [dynamicQR, setDynamicQR] = useState(false);
  const [mobileId, setMobileId] = useState("");
  const [upiId, setUpiId] = useState("");
  const [uenId, setUenId] = useState("");
  const [upiExtractFailed, setUpiExtractFailed] = useState(false);
  const [dynamicUpiString, setDynamicUpiString] = useState("");
  const [dynamicUENString, setDynamicUENString] = useState("");
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60);

  const [transactionId, setTransactionId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const pickScreenshot = (f: File | null) => {
    setScreenshot(f);
    setScreenshotPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : "";
    });
  };

  useEffect(() => {
    if (!orderData?.eventId) return;
    (async () => {
      try {
        const eventRes = await fetch(`${apiURL}/events/${orderData.eventId}`);
        const eventJson = await eventRes.json();
        const event = eventJson?.data || eventJson;
        const organizerId = event?.organizer?._id || event?.organizer;
        setCountry(event?.organizer?.country || "");
        if (!organizerId) return;
        const orgRes = await fetch(
          `${apiURL}/organizers/profile-get/${organizerId}`,
        );
        const orgJson = await orgRes.json();
        if (orgJson?.data) {
          setOrganizer(orgJson.data);
          if (orgJson.data.paymentURL) {
            setPaymentQR(apiURL + orgJson.data.paymentURL);
          }
          setDynamicQR(!!orgJson.data.dynamicQR);
          setMobileId(orgJson.data.phone || "");
          setCountry(orgJson.data.country || "");
        }
      } catch {
        // Non-fatal — the visitor can still submit a transaction id without
        // seeing the QR preview.
      }
    })();
  }, [orderData?.eventId]);

  // Decode the organizer's uploaded static QR image to pull out the UPI id
  // (India) or the UEN proxy (Singapore), so a dynamic, amount-baked QR can
  // be generated from it — same jsQR-based extraction as tablePaymentPage.
  async function extractUpiFromImage() {
    if (!paymentQR || upiId) return;
    try {
      setUpiExtractFailed(false);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = paymentQR;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Payment QR image failed to load"));
        setTimeout(() => reject(new Error("Payment QR image load timed out")), 10000);
      });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      const code =
        imageData && jsQR(imageData.data, imageData.width, imageData.height);
      const extractedUpi = code?.data?.startsWith("upi://pay")
        ? new URLSearchParams(code.data.replace("upi://pay?", "")).get("pa")
        : null;
      if (extractedUpi) setUpiId(extractedUpi);
      else setUpiExtractFailed(true);
    } catch (error) {
      console.error("QR decode failed:", error);
      setUpiExtractFailed(true);
    }
  }

  function extractUenFromPayNowQR(qrData: string): string | null {
    try {
      let pos = 0;
      while (pos + 4 < qrData.length) {
        const id = qrData.slice(pos, pos + 2);
        const lenHex = qrData.slice(pos + 2, pos + 4);
        const len = parseInt(lenHex, 16);
        const value = qrData.slice(pos + 4, pos + 4 + len);
        if (id === "01" && value === "01") {
          const nextPos = pos + 4 + len;
          if (nextPos + 4 < qrData.length) {
            const fieldId = qrData.slice(nextPos, nextPos + 2);
            const uenLenHex = qrData.slice(nextPos + 2, nextPos + 4);
            const uenLen = parseInt(uenLenHex, 16);
            const uen = qrData.slice(nextPos + 4, nextPos + 4 + uenLen);
            if (
              fieldId === "02" &&
              uen.length >= 9 &&
              uen.length <= 10 &&
              /^[A-Z0-9]+$/.test(uen)
            ) {
              return uen;
            }
          }
        }
        pos += 4 + len;
      }
    } catch (error) {
      console.error("UEN parse error:", error);
    }
    return null;
  }

  async function extractUenFromImage() {
    if (!paymentQR || uenId) return;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = paymentQR;
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
      const code =
        imageData && jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        const uen = extractUenFromPayNowQR(code.data);
        if (uen) setUenId(uen);
      }
    } catch (error) {
      console.error("PayNow QR decode failed:", error);
    }
  }

  function generateDynamicUpi(): string {
    if (!upiId || !orderData) return "";
    return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
      organizer?.organizationName || "Payment",
    )}&am=${orderData.total}&cu=INR&tn=${encodeURIComponent(
      `Scheduled Space ${orderData.requestId}`,
    )}&tr=${orderData.requestId}`;
  }

  async function generateDynamicPayNowQR(): Promise<string> {
    if (!orderData) return "";
    const url = buildPayNowQrUrl({
      organizer: {
        UENNumber: organizer?.UENNumber,
        payNowId: organizer?.payNowId || organizer?.phone || mobileId,
      },
      amount: orderData.total,
    });
    return url || "";
  }

  const handlePayClick = () => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (!isIOS && !isAndroid) return;
    if (!dynamicUpiString) return;
    if (isIOS) window.location.assign(dynamicUpiString);
    else window.location.href = dynamicUpiString;
  };

  async function handleDownload() {
    if (!paymentQR) {
      toast({
        duration: 5000,
        title: "No QR code available",
        variant: "destructive",
      });
      return;
    }
    try {
      const response = await fetch(paymentQR);
      if (!response.ok) throw new Error("Failed to fetch image for download.");
      const imageBlob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(imageBlob);
      link.download = `payment-qr-${orderData?.requestId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch {
      toast({
        duration: 5000,
        title: "Download failed",
        description: "Could not download the QR image. Please try again.",
        variant: "destructive",
      });
    }
  }

  // Kick off extraction / dynamic-QR generation once we know the organizer's
  // country and have their static QR (India) or UEN/mobile (Singapore).
  useEffect(() => {
    if (!dynamicQR || !orderData) return;
    if (country === "IN" && paymentQR && !upiId && !upiExtractFailed) {
      extractUpiFromImage();
    }
    if (country === "SG" && paymentQR && !uenId) {
      extractUenFromImage();
    }
    if (country === "SG" && (organizer?.UENNumber || mobileId)) {
      generateDynamicPayNowQR().then(setDynamicUENString);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicQR, country, paymentQR, upiId, uenId, mobileId, organizer]);

  useEffect(() => {
    if (upiId && country === "IN" && orderData?.total) {
      setDynamicUpiString(generateDynamicUpi());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upiId, country, orderData?.total, organizer]);

  useEffect(() => {
    if (!dynamicUpiString && !dynamicUENString) return;
    setTimeLeft(24 * 60 * 60);
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [dynamicUpiString, dynamicUENString]);

  if (!orderData?.requestId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">
            Loading payment info…
          </h2>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `${apiURL}/scheduled-spaces/${orderData.requestId}/select-slots`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedSlots: orderData.selectedSlots.map((s) => ({
              positionId: s.positionId,
              templateId: s.templateId,
              slotId: s.slotId,
            })),
            paidAmount: orderData.total,
            transactionId: transactionId.trim() || undefined,
            paymentMethod: paymentMethod || undefined,
          }),
        },
      );
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.message || "Failed to submit payment");
      }

      // Screenshot goes up as a separate multipart call, same two-step shape
      // as the Stalls flow — the main submit stays plain JSON.
      if (screenshot) {
        try {
          const fd = new FormData();
          fd.append("requestId", orderData.requestId);
          fd.append("screenshot", screenshot);
          await fetch(`${apiURL}/scheduled-spaces/upload-transaction-screenshot`, {
            method: "POST",
            body: fd,
          });
        } catch {
          // Non-fatal — the transaction id (if any) already went through;
          // the organizer can still verify from that.
        }
      }

      setSubmitted(true);
      toast({
        duration: 5000,
        title: "Payment submitted",
        description: "The organizer will confirm your booking shortly.",
      });
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Couldn't submit payment",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <h2 className="text-xl font-semibold">Payment Submitted</h2>
            <p className="text-sm text-muted-foreground">
              The organizer will confirm your payment and send your check-in
              QR shortly. You can check your status from the event page.
            </p>
            <Button className="w-full" onClick={() => navigate(-1)}>
              Back to Event
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Scheduled Space Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orderData.eventInfo?.title && (
              <p className="text-sm text-muted-foreground">
                {orderData.eventInfo.title}
              </p>
            )}
            <div className="space-y-2">
              {orderData.selectedSlots.map((s, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>
                    {s.spaceName} — {s.date} {s.startTime}-{s.endTime}
                    {s.slotLabel ? ` (${s.slotLabel})` : ""}
                  </span>
                  <span>{formatPrice(s.price)}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatPrice(orderData.total)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-xl">
              <QrCode className="w-5 h-5 text-blue-600" />
              Complete Your Payment
            </CardTitle>
            <div className="text-3xl font-bold text-green-600 mt-2">
              {formatPrice(orderData.total)}
            </div>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {dynamicQR && country === "IN" && (
              <>
                {dynamicUpiString ? (
                  <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl shadow-lg border-2 border-blue-200">
                    <QRCode
                      value={dynamicUpiString}
                      size={240}
                      fgColor="#000000"
                      bgColor="#ffffff"
                    />
                    <Button className="w-full" onClick={handlePayClick}>
                      Click to Pay
                    </Button>
                    <p className="font-bold text-green-700">
                      📱 Scan with any Payment App
                    </p>
                  </div>
                ) : upiExtractFailed && paymentQR ? (
                  <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl shadow-lg border-2 border-blue-200">
                    <img
                      src={paymentQR}
                      alt="Payment QR Code"
                      className="w-64 h-64 object-contain"
                    />
                    <p className="text-sm text-gray-600 text-center">
                      Scan this QR with any UPI app and enter the amount{" "}
                      {formatPrice(orderData.total)} manually.
                    </p>
                  </div>
                ) : (
                  <div className="flex justify-center animate-pulse">
                    <div className="w-64 h-64 bg-gray-100 rounded-xl border-4 border-dashed border-gray-300 flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <QrCode className="w-10 h-10 mx-auto mb-2" />
                        <p className="text-sm">Generating Payment QR…</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {dynamicQR && country === "SG" && (
              <>
                {dynamicUENString ? (
                  <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl shadow-lg border-2 border-blue-200">
                    <img
                      src={dynamicUENString}
                      alt="PayNow QR"
                      className="w-60 h-60 rounded-xl shadow-lg"
                    />
                    <p className="font-bold text-green-700">
                      📱 Scan with any Payment App
                    </p>
                    {organizer?.UENNumber || uenId ? (
                      <p className="text-sm font-semibold text-green-700">
                        If the QR code fails, pay directly to UEN:{" "}
                        {organizer?.UENNumber || uenId}
                      </p>
                    ) : mobileId ? (
                      <p className="text-sm font-semibold text-green-700">
                        If the QR code fails, pay directly to mobile number:{" "}
                        {mobileId}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex justify-center animate-pulse">
                    <div className="w-64 h-64 bg-gray-100 rounded-xl border-4 border-dashed border-gray-300 flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <QrCode className="w-10 h-10 mx-auto mb-2" />
                        <p className="text-sm">Generating Payment QR…</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {(!dynamicQR || !["IN", "SG"].includes(country)) &&
              (paymentQR ? (
                <img
                  src={paymentQR}
                  alt="Payment QR Code"
                  className="mx-auto w-64 h-64 object-contain border rounded-lg"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  The organizer hasn't set up a payment QR yet. Contact them
                  to arrange payment, then confirm below.
                </p>
              ))}

            {(dynamicUpiString || dynamicUENString) &&
              (timeLeft > 0 ? (
                <div className="flex items-center justify-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
                  <Clock className="w-4 h-4 text-yellow-700" />
                  <p className="text-sm font-semibold text-yellow-800">
                    QR expires in {formatTime(timeLeft)}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  <AlertCircle className="w-4 h-4 text-red-700" />
                  <p className="text-sm font-semibold text-red-800">
                    QR has expired. Please refresh to generate a new one.
                  </p>
                </div>
              ))}

            {paymentQR && (
              <Button variant="outline" className="w-full" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" /> Download QR
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">After Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-gray-500">
              Optional: add your transaction ID or a payment screenshot so
              the organizer can verify faster. If you can't, just tap{" "}
              <span className="font-medium">I have Paid</span> — you can send
              proof to the organizer directly and they'll confirm it.
            </p>
            <div>
              <Label>Transaction / Reference ID</Label>
              <Input
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. UPI ref number"
              />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Input
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="e.g. UPI, Bank Transfer"
              />
            </div>
            <div>
              <Label>Transaction Screenshot</Label>
              <input
                type="file"
                accept="image/*"
                id="ss-tx-screenshot"
                className="hidden"
                onChange={(e) => pickScreenshot(e.target.files?.[0] || null)}
              />
              {screenshotPreview ? (
                <div className="relative mt-1">
                  <img
                    src={screenshotPreview}
                    alt="Screenshot"
                    className="w-full max-h-40 object-contain rounded border"
                  />
                  <button
                    type="button"
                    onClick={() => pickScreenshot(null)}
                    className="absolute top-1 right-1 rounded-full bg-white border shadow p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="ss-tx-screenshot"
                  className="mt-1 flex flex-col items-center justify-center gap-1 rounded border border-dashed py-4 cursor-pointer text-muted-foreground hover:border-gray-400"
                >
                  <Upload className="h-4 w-4" />
                  <span className="text-xs">Upload payment screenshot</span>
                </label>
              )}
            </div>
            {!transactionId.trim() && !screenshot && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No screenshot or transaction ID? No problem — submit anyway
                and send your payment proof to the organizer directly.
              </p>
            )}
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                "I have Paid"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
