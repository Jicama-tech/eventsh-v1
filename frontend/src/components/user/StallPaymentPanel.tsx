import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrencyhook";
import QRCode from "react-qr-code";
import jsQR from "jsqr";
import { buildPayNowQrUrl } from "@/lib/paynowQr";
import { QrCode, Download, Clock, Camera, Loader2 } from "lucide-react";

const apiURL = __API_URL__;

interface StallPaymentPanelProps {
  organizerId: string;
  amount: number;
  /** Vendor WhatsApp shown as the manual-payment fallback contact. */
  whatsAppNumber?: string;
  /** Reference embedded in the UPI note (usually the stall/booking id). */
  reference?: string;
  transactionId: string;
  onTransactionIdChange: (v: string) => void;
  screenshot: File | null;
  onScreenshotChange: (f: File | null) => void;
  /** Fires with the best shareable payment link (UPI deep link / PayNow QR
   * image / static QR URL) so a caller can offer a "Copy pay link" action. */
  onLinkReady?: (link: string) => void;
}

/**
 * The dynamic payment panel used on the Table Payment page — dynamic QR
 * (UPI for India, PayNow for Singapore) or the organizer's static QR, plus
 * bank-transfer details and a transaction-proof (id + screenshot) capture.
 * Extracted so the stall "Edit Request" difference-payment dialog shows the
 * exact same experience. Amount is fixed (the difference owed).
 */
export default function StallPaymentPanel({
  organizerId,
  amount,
  whatsAppNumber,
  reference,
  transactionId,
  onTransactionIdChange,
  screenshot,
  onScreenshotChange,
  onLinkReady,
}: StallPaymentPanelProps) {
  const { toast } = useToast();
  const [organizer, setOrganizer] = useState<any>(null);
  const [country, setCountry] = useState("");
  const { formatPrice } = useCurrency(country);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [dynamicQR, setDynamicQR] = useState(false);
  const [mobileId, setMobileId] = useState("");
  const [uenId, setUenId] = useState("");
  const [upiId, setUpiId] = useState("");
  const [dynamicUpiString, setDynamicUpiString] = useState("");
  const [dynamicUENString, setDynamicUENString] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"qr" | "bank">("qr");
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60);
  const [screenshotPreview, setScreenshotPreview] = useState("");

  const paymentURL = organizer?.paymentURL || "";

  // Surface the best shareable payment link to the caller (UPI deep link opens
  // the vendor's payment app with the amount; PayNow/static are QR image URLs).
  useEffect(() => {
    const link = dynamicUpiString || dynamicUENString || paymentURL;
    if (link) onLinkReady?.(link);
  }, [dynamicUpiString, dynamicUENString, paymentURL, onLinkReady]);

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;

  // Fetch organizer payment profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("loading");
        const res = await fetch(
          `${apiURL}/organizers/profile-get/${organizerId}`,
        );
        const result = await res.json();
        if (cancelled) return;
        if (result.data) {
          setOrganizer(result.data);
          setDynamicQR(result.data.dynamicQR);
          setMobileId(result.data.phone);
          setCountry(result.data.country);
          setStatus("ready");
        } else {
          throw new Error("No payment profile found");
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("failed");
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load payment details.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizerId]);

  // 24h QR countdown once shown.
  useEffect(() => {
    if (!showQR) return;
    setTimeLeft(24 * 60 * 60);
    const t = setInterval(
      () => setTimeLeft((p) => (p <= 1 ? 0 : p - 1)),
      1000,
    );
    return () => clearInterval(t);
  }, [showQR, dynamicUpiString, dynamicUENString]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(
      Math.floor((s % 3600) / 60),
    ).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Read the organizer's static UPI/UEN out of their uploaded QR image.
  async function extractFromImage(kind: "upi" | "uen") {
    if (!paymentURL) return;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = paymentURL;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const data = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(data?.data as any, data?.width as any, data?.height as any);
      if (!code?.data) return;
      if (kind === "upi" && code.data.startsWith("upi://pay")) {
        const params = new URLSearchParams(code.data.replace("upi://pay?", ""));
        const pa = params.get("pa");
        if (pa) setUpiId(pa);
      } else if (kind === "uen") {
        const uen = extractUenFromPayNowQR(code.data);
        if (uen) setUenId(uen);
      }
    } catch {
      /* decode failed — fall back to static QR image */
    }
  }

  function extractUenFromPayNowQR(qrData: string): string | null {
    try {
      let pos = 0;
      while (pos + 4 < qrData.length) {
        const id = qrData.slice(pos, pos + 2);
        const len = parseInt(qrData.slice(pos + 2, pos + 4), 16);
        const value = qrData.slice(pos + 4, pos + 4 + len);
        if (id === "01" && value === "01") {
          const nextPos = pos + 4 + len;
          if (nextPos + 4 < qrData.length) {
            const uenId2 = qrData.slice(nextPos, nextPos + 2);
            const uenLen = parseInt(qrData.slice(nextPos + 2, nextPos + 4), 16);
            const uen = qrData.slice(nextPos + 4, nextPos + 4 + uenLen);
            if (
              uenId2 === "02" &&
              uen.length >= 9 &&
              uen.length <= 10 &&
              /^[A-Z0-9]+$/.test(uen)
            )
              return uen;
          }
        }
        pos += 4 + len;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  const generateDynamicUpi = () =>
    !upiId || !amount
      ? ""
      : `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
          organizer?.organizationName || "Payment",
        )}&am=${amount}&cu=INR&tn=${encodeURIComponent(
          `Stall ${reference || ""}`,
        )}&tr=${reference || ""}`;

  const generateDynamicPayNowQR = () =>
    !amount
      ? ""
      : buildPayNowQrUrl({
          organizer: {
            UENNumber: organizer?.UENNumber,
            payNowId: organizer?.payNowId || organizer?.phone || mobileId,
          },
          amount,
        }) || "";

  // Pre-read the static QR + build the SG PayNow string.
  useEffect(() => {
    if (status !== "ready") return;
    if (country === "IN" && paymentURL && !upiId) extractFromImage("upi");
    if (country === "SG") {
      if (paymentURL && !uenId) extractFromImage("uen");
      if (mobileId || organizer?.UENNumber)
        setDynamicUENString(generateDynamicPayNowQR());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, country, paymentURL, mobileId, amount]);

  // Build the IN UPI string once shown.
  useEffect(() => {
    if (!showQR || !amount) return;
    if (country === "IN" && upiId) setDynamicUpiString(generateDynamicUpi());
    if (country === "SG" && (uenId || mobileId))
      setDynamicUENString(generateDynamicPayNowQR());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQR, upiId, uenId, country, amount]);

  const handlePayClick = () => {
    if (!isMobile) {
      setShowQR(true);
      return;
    }
    const url = dynamicUpiString || dynamicUENString || "";
    if (url) window.location.href = url;
  };

  async function handleDownload() {
    if (!paymentURL) return;
    try {
      const r = await fetch(paymentURL);
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `payment-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch {
      toast({ variant: "destructive", title: "Download failed" });
    }
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600 mb-3" />
        <p className="text-sm text-gray-600">Loading payment details…</p>
      </div>
    );
  }
  if (status === "failed") {
    return (
      <p className="py-8 text-center text-sm text-red-600">
        Couldn't load payment details. Please close and try again.
      </p>
    );
  }

  const bankEnabled = organizer?.bankTransferEnabled;

  return (
    <div className="space-y-4">
      {/* Amount */}
      <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-3 text-center">
        <p className="text-xs text-gray-500">Additional amount to pay</p>
        <p className="text-2xl font-bold text-blue-700">
          {formatPrice(amount)}
        </p>
      </div>

      {/* QR / Bank switch */}
      {bankEnabled && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPaymentMode("qr")}
            className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium ${
              paymentMode === "qr"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-500"
            }`}
          >
            QR Payment
          </button>
          <button
            type="button"
            onClick={() => setPaymentMode("bank")}
            className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium ${
              paymentMode === "bank"
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-gray-200 text-gray-500"
            }`}
          >
            Bank Transfer
          </button>
        </div>
      )}

      {/* Bank details */}
      {paymentMode === "bank" && bankEnabled && (
        <div className="space-y-2 rounded-xl border-2 border-green-200 bg-green-50/50 p-4">
          <p className="text-sm font-semibold text-green-800">
            Bank Transfer Details
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Account Holder:</span>
              <p className="font-medium">
                {organizer.accountHolderName || "—"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Bank:</span>
              <p className="font-medium">{organizer.bankName || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500">Account No:</span>
              <p className="font-mono font-medium">
                {organizer.bankAccountNumber || "—"}
              </p>
            </div>
            {organizer.bankIfscCode && (
              <div>
                <span className="text-gray-500">IFSC:</span>
                <p className="font-mono font-medium">{organizer.bankIfscCode}</p>
              </div>
            )}
            {organizer.payNowId && (
              <div className="col-span-2">
                <span className="text-gray-500">PayNow ID:</span>
                <p className="font-mono font-medium">{organizer.payNowId}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR display */}
      {paymentMode === "qr" && (
        <div className="text-center">
          {!showQR ? (
            <Button
              className="w-full bg-blue-600 py-5 text-base font-semibold hover:bg-blue-700"
              onClick={() => setShowQR(true)}
            >
              <QrCode className="mr-2 h-5 w-5" />
              Show QR to pay {formatPrice(amount)}
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-blue-200 bg-white p-4 shadow-sm">
              {/* Dynamic UPI (India) */}
              {dynamicQR && country === "IN" && dynamicUpiString ? (
                <>
                  <QRCode value={dynamicUpiString} size={220} />
                  {isMobile && (
                    <Button
                      className="w-full py-4 font-semibold"
                      onClick={handlePayClick}
                    >
                      Click to Pay
                    </Button>
                  )}
                </>
              ) : dynamicQR && country === "SG" && dynamicUENString ? (
                <>
                  <img
                    src={dynamicUENString}
                    alt="PayNow QR"
                    className="h-[220px] w-[220px] rounded-lg"
                  />
                  {(organizer?.UENNumber || uenId) && (
                    <p className="text-sm font-semibold text-green-700">
                      If the QR fails, pay to UEN:{" "}
                      {organizer?.UENNumber || uenId}
                    </p>
                  )}
                  {!organizer?.UENNumber && !uenId && mobileId && (
                    <p className="text-sm font-semibold text-green-700">
                      If the QR fails, pay to mobile: {mobileId}
                    </p>
                  )}
                </>
              ) : paymentURL ? (
                // Static organizer QR fallback.
                <img
                  src={paymentURL}
                  alt="Payment QR"
                  className="mx-auto h-56 w-56 object-contain"
                />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-xl border-4 border-dashed border-gray-300 text-gray-400">
                  <div className="text-center">
                    <QrCode className="mx-auto mb-2 h-10 w-10" />
                    <p className="text-xs">Generating QR…</p>
                  </div>
                </div>
              )}

              <p className="text-sm font-bold text-green-700">
                📱 Scan with any payment app
              </p>
              {whatsAppNumber && (
                <p className="text-xs text-gray-500">
                  Your WhatsApp: {whatsAppNumber}
                </p>
              )}
              {paymentURL && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" /> Download QR
                </Button>
              )}
              {timeLeft > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5">
                  <Clock className="h-4 w-4 text-yellow-700" />
                  <span className="text-xs font-semibold text-yellow-800">
                    QR expires in {formatTime(timeLeft)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Transaction proof */}
      <div className="space-y-3 rounded-xl border bg-gray-50/60 p-3">
        <p className="text-sm font-semibold text-gray-700">
          Payment verification <span className="text-red-500">*</span>
        </p>
        <p className="text-xs text-gray-500">
          After paying, enter your transaction ID or upload the payment
          screenshot so the organizer can verify it.
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Transaction ID / reference
          </label>
          <Input
            value={transactionId}
            onChange={(e) => onTransactionIdChange(e.target.value)}
            placeholder="e.g. UPI123456789 / bank ref"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Transaction screenshot
          </label>
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-3">
            <input
              type="file"
              accept="image/*"
              id="amend-tx-screenshot"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                onScreenshotChange(f);
                setScreenshotPreview(f ? URL.createObjectURL(f) : "");
              }}
            />
            {screenshotPreview ? (
              <div className="relative">
                <img
                  src={screenshotPreview}
                  alt="Screenshot"
                  className="max-h-40 w-full rounded object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    onScreenshotChange(null);
                    setScreenshotPreview("");
                  }}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label
                htmlFor="amend-tx-screenshot"
                className="flex cursor-pointer flex-col items-center py-2"
              >
                <Camera className="mb-1 h-6 w-6 text-gray-400" />
                <span className="text-xs text-gray-500">
                  Upload payment screenshot
                </span>
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
