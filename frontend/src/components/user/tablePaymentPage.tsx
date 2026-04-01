import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Table as TableIcon,
  Plus,
  CreditCard,
  Download,
  Clock,
  QrCode,
  Loader,
  CheckCircle,
  Calendar,
  Camera,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrencyhook";
import QRCode from "react-qr-code";
import jsQR from "jsqr";
import { Input } from "../ui/input";

const TablePaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const apiURL = __API_URL__;

  // Get data from navigation state
  const orderData = location.state;

  // State
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<
    "minimum" | "full"
  >("minimum");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentQRCode, setPaymentQRCode] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    "loading" | "ready" | "success" | "failed"
  >("loading");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [country, setCountry] = useState("");
  const { formatPrice, getSymbol } = useCurrency(country);
  const [dynamicQR, setDynamicQR] = useState(false);
  const [uenId, setUenId] = useState("");
  const [organizer, setOrganizer] = useState(null);
  const [mobileId, setMobileId] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60);
  const canvasRef = useRef(null);
  const [upiId, setUpiId] = useState("");
  const [dynamicUpiString, setDynamicUpiString] = useState("");
  const [dynamicUENString, setDynamicUENString] = useState("");
  const [AmountToBePaid, setAmountToBePaid] = useState(0);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Bank transfer & transaction verification
  const [paymentMode, setPaymentMode] = useState<"qr" | "bank">("qr");
  const [transactionId, setTransactionId] = useState("");
  const [transactionScreenshot, setTransactionScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState("");

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;

  const handlePayClick = () => {
    if (!isMobile) {
      setShowQR(true);
      return;
    }

    const paymentUrl = dynamicUpiString || dynamicUENString || "";

    if (!paymentUrl) {
      console.error("No payment URL available");
      return;
    }

    if (isIOS) {
      window.location.assign(paymentUrl);
    } else {
      window.location.href = paymentUrl;
    }
  };

  useEffect(() => {
    if (!dynamicUpiString && !dynamicUENString) return;

    setTimeLeft(24 * 60 * 60); // reset to 24 hrs when QR changes

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

  function formatTime(seconds: number) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
      2,
      "0",
    )}:${String(secs).padStart(2, "0")}`;
  }

  useEffect(() => {
    if (timeLeft === 0) {
      // Optional: short delay so user can see expiry message
      const timer = setTimeout(() => {
        navigate(-1); // go to previous page
      }, 2000); // 2 seconds

      return () => clearTimeout(timer);
    }
  }, [timeLeft, navigate]);

  // Validate data and fetch organizer QR on mount
  useEffect(() => {
    if (!orderData || !orderData.stallRequestId) {
      toast({
        duration: 5000,
        title: "No Order Data",
        description: "Please select tables first",
        variant: "destructive",
      });
      navigate(-1);
      return;
    }

    fetchOrganizerQRCode();
  }, [orderData, navigate, toast]);

  // Fetch organizer's QR code
  const fetchOrganizerQRCode = async () => {
    try {
      setPaymentStatus("loading");

      const response = await fetch(
        `${apiURL}/organizers/profile-get/${orderData.eventInfo.organizerId}`,
      );
      const result = await response.json();

      if (result.data) {
        setOrganizer(result.data);
        setPaymentQRCode(result.data.paymentURL);
        setPaymentStatus("ready");
        setDynamicQR(result?.data?.dynamicQR);
        setMobileId(result?.data?.phone);
        setCountry(result?.data?.country);
      } else {
        throw new Error("No QR code found for organizer");
      }
    } catch (error: any) {
      console.error("Error fetching QR code:", error);
      setPaymentStatus("failed");
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to load payment QR code",
        variant: "destructive",
      });
    }
  };

  // Calculate totals
  // Replace your existing `totals` object with this:
  const originalTotals = {
    depositTotal: orderData?.priceSummary?.depositTotal || 0,
    tablesTotal: orderData?.priceSummary?.tablesTotal || 0,
    addOnsTotal: orderData?.priceSummary?.addOnsTotal || 0,
    grandTotal: orderData?.priceSummary?.grandTotal || 0,
    minimumPayment: orderData?.minimumPayment || 0,
    fullPayment: orderData?.priceSummary?.grandTotal || 0,
    remainingAfterBooking: 0,
  };

  originalTotals.remainingAfterBooking =
    originalTotals.grandTotal - originalTotals.minimumPayment;

  // Calculate the flat discount amount based on the percentage
  const discountAmount = originalTotals.fullPayment * (discount / 100);

  // Apply the discount percentage across all payment options
  const totals = {
    ...originalTotals,
    minimumPayment: originalTotals.minimumPayment * (1 - discount / 100),
    remainingAfterBooking:
      originalTotals.remainingAfterBooking * (1 - discount / 100),
    fullPayment: Math.max(0, originalTotals.fullPayment - discountAmount),
  };

  const getAmountToPay = () => {
    if (selectedPaymentOption === "full") {
      return totals.fullPayment;
    } else {
      return totals.minimumPayment;
    }
  };

  // Event countdown + 60-day payment rule
  const getDaysUntilEvent = () => {
    if (!orderData?.eventInfo?.startDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(orderData.eventInfo.startDate);
    start.setHours(0, 0, 0, 0);
    return Math.ceil(
      (start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
  };

  const daysUntilEvent = getDaysUntilEvent();
  const showMinimumPayment = daysUntilEvent === null || daysUntilEvent > 60;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    try {
      setIsApplyingCoupon(true);
      const response = await fetch(`${apiURL}/coupons/Validate-Event-Coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim(),
          eventId: orderData?.eventId || orderData?.eventInfo?.id,
          orderAmount: originalTotals.fullPayment,
        }),
      });

      if (response.ok) {
        const couponData = await response.json();
        let calculatedDiscount = 0;

        if (couponData.discountPercentage) {
          calculatedDiscount = couponData.discountPercentage;
        } else if (couponData.flatDiscountAmount) {
          // Convert flat discount to percentage to apply evenly across minimum/full payments
          calculatedDiscount =
            (couponData.flatDiscountAmount / originalTotals.fullPayment) * 100;
        }

        setDiscount(calculatedDiscount);
        setAppliedCoupon(couponCode.trim());

        toast({
          title: "Coupon applied!",
          description: `You got ${couponData.discountPercentage ? `${couponData.discountPercentage}%` : `${formatPrice(couponData.flatDiscountAmount)}`} discount`,
        });
      } else {
        throw new Error("Invalid coupon code");
      }
    } catch (error) {
      toast({
        title: "Invalid coupon",
        description: "Please check your coupon code and try again.",
        variant: "destructive",
      });
      setDiscount(0);
      setAppliedCoupon("");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // Fix your existing useEffect dependency array:
  useEffect(() => {
    // Force full payment if event is within 60 days
    if (!showMinimumPayment && selectedPaymentOption === "minimum") {
      setSelectedPaymentOption("full");
    }
    setAmountToBePaid(getAmountToPay());
  }, [selectedPaymentOption, discount, showMinimumPayment]);

  const handlePaymentConfirmation = async () => {
    try {
      setIsProcessing(true);

      const amountToPay = getAmountToPay();

      // Map selectedTables correctly to match DTO/schema
      const mappedSelectedTables = orderData.selectedTables.map((table) => ({
        tableId: table.tableId || table.positionId || "", // fallback keys
        positionId: table.positionId,
        tableName: table.tableName || table.name || "",
        tableType: table.tableType || table.type || "",
        layoutName: table.layoutName || "",
        price: Number(table.price),
        depositAmount: Number(table.depositAmount),
      }));

      // Map selectedAddOns correctly with quantity
      const mappedSelectedAddOns = (orderData.selectedAddOns || []).map(
        (addon) => ({
          addOnId: addon.addOnId || addon.id || "",
          name: addon.name,
          price: Number(addon.price),
          quantity:
            addon.quantity && addon.quantity > 0 ? Number(addon.quantity) : 1,
        }),
      );

      // Validate that required fields are strings and numbers
      if (
        mappedSelectedTables.some(
          (t) =>
            typeof t.tableId !== "string" ||
            typeof t.tableName !== "string" ||
            typeof t.tableType !== "string",
        )
      ) {
        throw new Error(
          "Selected tables must have valid tableId, tableName, and tableType strings",
        );
      }
      if (
        mappedSelectedAddOns.some(
          (a) =>
            typeof a.addOnId !== "string" ||
            typeof a.quantity !== "number" ||
            a.quantity < 1,
        )
      ) {
        throw new Error("Add-ons must have valid addOnId and quantity >= 1");
      }

      // Make PATCH API call with mapped data
      const response = await fetch(
        `${apiURL}/stalls/${orderData.stallRequestId}/select-tables-and-addons`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedTables: mappedSelectedTables,
            selectedAddOns: mappedSelectedAddOns,
            paymentType: selectedPaymentOption,
            paidAmount: amountToPay,
            couponCodeApplied: appliedCoupon || null,
            paymentStatus: "pending",
            transactionId: transactionId || null,
            paymentMethod: paymentMode,
          }),
        },
      );

      const result = await response.json();

      if (result.success) {
        setPaymentStatus("success");
        setBookingId(result.data?._id);

        // Upload transaction screenshot if provided
        if (transactionScreenshot && result.data?._id) {
          try {
            const ssFormData = new FormData();
            ssFormData.append("stallId", result.data._id);
            ssFormData.append("screenshot", transactionScreenshot);
            if (transactionId) ssFormData.append("transactionId", transactionId);
            await fetch(`${apiURL}/stalls/upload-transaction-screenshot`, {
              method: "POST",
              body: ssFormData,
            });
          } catch {
            // Non-critical
          }
        }

        toast({
          duration: 5000,
          title: "Success!",
          description: "Your booking has been submitted. The organizer will confirm your payment.",
        });

        // Auto redirect to event page after 3s
        // setTimeout(() => {
        //   navigate(`/event/${orderData.eventId}`, { replace: true });
        // }, 3000);
        // setTimeout(() => {
        //     navigate(`/organizers/${}/events/${orderData.eventId}`, { replace: true }, 3000);
        // })
      } else {
        throw new Error(result.message || "Payment processing failed");
      }
    } catch (error: any) {
      console.error("Payment Confirmation Error:", error);
      setPaymentStatus("failed");
      toast({
        duration: 5000,
        title: "Error",
        description: error.message || "Failed to confirm payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!orderData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  async function extractUpiFromImage() {
    if (!orderData?.paymentURL || upiId) return;

    try {
      setLoading(true);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = orderData?.paymentURL;

      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData?.data, imageData?.width, imageData?.height);

      if (code?.data?.startsWith("upi://pay")) {
        const params = new URLSearchParams(code.data.replace("upi://pay?", ""));
        const extractedUpi = params.get("pa");

        if (extractedUpi) {
          setUpiId(extractedUpi);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error("❌ QR decode failed:", error);
    }
  }

  async function extractUenFromImage() {
    if (!orderData?.paymentURL || uenId) return;

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = orderData?.paymentURL;

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
      const code = jsQR(imageData?.data, imageData?.width!, imageData?.height!);

      if (code?.data) {
        const uen = extractUenFromPayNowQR(code.data);
        if (uen) {
          setUenId(uen);
        }
      }
    } catch (error) {
      console.error("❌ PayNow QR decode failed:", error);
    }
  }

  function extractUenFromPayNowQR(qrData: string): string | null {
    try {
      let pos = 0;
      let foundProxyType = false;

      while (pos + 4 < qrData.length) {
        const id = qrData.slice(pos, pos + 2);
        const lenHex = qrData.slice(pos + 2, pos + 4);
        const len = parseInt(lenHex, 16);

        const value = qrData.slice(pos + 4, pos + 4 + len);

        // Look for proxy type field (ID=01, value="01" for UEN proxy)
        if (id === "01" && value === "01") {
          foundProxyType = true;
          // Next field should be ID=02 (UEN value)
          const nextPos = pos + 4 + len;
          if (nextPos + 4 < qrData.length) {
            const uenId = qrData.slice(nextPos, nextPos + 2);
            const uenLenHex = qrData.slice(nextPos + 2, nextPos + 4);
            const uenLen = parseInt(uenLenHex, 16);
            const uen = qrData.slice(nextPos + 4, nextPos + 4 + uenLen);

            // Validate UEN format
            if (
              uenId === "02" &&
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
    } catch (e) {
      console.error("UEN parse error:", e);
    }
    return null;
  }

  function generateDynamicUpi(): string {
    if (!upiId || AmountToBePaid === undefined || AmountToBePaid === null)
      return "";

    return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
      organizer.organizationName || "Payment",
    )}&am=${AmountToBePaid}&cu=INR&tn=${encodeURIComponent(
      `Stall ${orderData.orderId}`,
    )}&tr=${orderData.orderId}`;
  }

  async function generateDynamicPayNowQR(): Promise<string> {
    if (!mobileId || AmountToBePaid === undefined || AmountToBePaid === null)
      return "";

    try {
      setLoading(true);
      const cleanedMobileId = mobileId.startsWith("+65")
        ? mobileId.substring(3)
        : mobileId;

      // Execution time
      const now = new Date();

      // Expiry = now + 90 hours
      const expiryTime = new Date(now.getTime() + 90 * 60 * 60 * 1000);

      // Format: YYYY/MM/DD HH:mm (sgqrcode requirement)
      const formattedExpiry =
        expiryTime.getFullYear() +
        "/" +
        String(expiryTime.getMonth() + 1).padStart(2, "0") +
        "/" +
        String(expiryTime.getDate()).padStart(2, "0") +
        " " +
        String(expiryTime.getHours()).padStart(2, "0") +
        ":" +
        String(expiryTime.getMinutes()).padStart(2, "0");

      const encodedExpiry = encodeURIComponent(formattedExpiry);

      const payNowString = `https://www.sgqrcode.com/paynow?mobile=${cleanedMobileId}&uen=&editable=0&amount=${AmountToBePaid}&expiry=${encodedExpiry}&ref_id=&company=`;

      setLoading(false);
      return payNowString;
    } catch (error) {
      throw error;
    }
    // Remove +65
  }

  useEffect(() => {
    const loadPaymentData = async () => {
      if (orderData.paymentURL && !upiId && country === "IN") {
        extractUpiFromImage();
      }
      if (country === "SG" && mobileId && AmountToBePaid) {
        const qr = await generateDynamicPayNowQR();
        setDynamicUENString(qr);
      }
    };
    loadPaymentData();
  }, [
    orderData?.paymentURL,
    upiId,
    country,
    mobileId,
    AmountToBePaid,
    dynamicUENString,
  ]);

  useEffect(() => {
    const loadDynamicData = async () => {
      // Only generate if we have an amount AND the user clicked the button
      if (showQR && AmountToBePaid > 0) {
        if (upiId && country === "IN") {
          const upiStr = generateDynamicUpi();
          setDynamicUpiString(upiStr);
        }
        if ((uenId || mobileId) && country === "SG") {
          const qr = await generateDynamicPayNowQR();
          setDynamicUENString(qr);
        }
      }
    };
    loadDynamicData();
  }, [upiId, AmountToBePaid, uenId, country, showQR]); // Added showQR to dependencies

  async function handleDownload() {
    if (!orderData?.paymentURL) {
      toast({
        duration: 5000,
        title: "No QR code available",
        variant: "destructive",
      });
      return;
    }
    try {
      const response = await fetch(orderData?.paymentURL);
      if (!response.ok) {
        throw new Error("Failed to fetch image for download.");
      }
      const imageBlob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(imageBlob);
      link.download = `payment-qr-order-${organizer.organizationName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      toast({
        duration: 5000,
        title: "Download failed",
        description: "Could not download the QR image. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="buttonOutline"
            size="icon"
            onClick={() => navigate(-1)}
            disabled={isProcessing}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Complete Your Booking</h1>
            <p className="text-gray-600">
              {paymentStatus === "success"
                ? "Your table booking has been created"
                : "Review your selection and complete payment"}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Side - Payment Section */}
          <div className="md:col-span-2 space-y-6">
            {/* Event Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle>Event Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Event Countdown Banner */}
                  {daysUntilEvent !== null && (
                    <div
                      className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium ${
                        daysUntilEvent <= 0
                          ? "bg-red-50 border-red-300 text-red-800"
                          : daysUntilEvent <= 60
                            ? "bg-orange-50 border-orange-300 text-orange-800"
                            : "bg-blue-50 border-blue-200 text-blue-800"
                      }`}
                    >
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span>
                        {daysUntilEvent <= 0
                          ? "This event has already started!"
                          : `Event starts in ${daysUntilEvent} day${daysUntilEvent === 1 ? "" : "s"}`}
                      </span>
                      {daysUntilEvent > 0 && daysUntilEvent <= 60 && (
                        <span className="ml-auto text-xs font-semibold bg-orange-200 text-orange-900 px-2 py-0.5 rounded">
                          Full payment required
                        </span>
                      )}
                    </div>
                  )}
                  <div>
                    <Label className="text-gray-600 text-sm">Event Name</Label>
                    <p className="font-semibold text-lg">
                      {orderData?.eventInfo?.title || "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-600 text-sm">Venue</Label>
                    <p className="font-semibold text-lg">
                      {orderData?.eventInfo?.location || "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-600 text-sm">Event Date</Label>
                    <p className="font-semibold">
                      {orderData?.eventInfo?.startDate
                        ? new Date(
                            orderData.eventInfo.startDate,
                          ).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Selected Tables */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TableIcon className="h-5 w-5" />
                  Selected Tables ({orderData?.selectedTables?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {orderData?.selectedTables?.map((table: any, index: number) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 bg-blue-50 border border-blue-200 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold text-sm">
                        {table.name} • {table.type} Table
                      </p>
                      <p className="font-semibold texr-sm">
                        {table.layoutName}
                      </p>
                      <p className="text-xs text-gray-600">
                        {table.width}cm × {table.height}cm
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatPrice(table.price)}</p>
                      <p className="text-xs text-gray-600">
                        Deposit: {formatPrice(table.depositAmount) || 0}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Selected Add-ons */}
            {orderData?.selectedAddOns &&
              orderData.selectedAddOns.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Add-ons ({orderData.selectedAddOns.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {orderData.selectedAddOns.map(
                      (addon: any, index: number) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-lg"
                        >
                          <div>
                            <p className="font-semibold text-sm">
                              {addon.name}
                            </p>
                          </div>
                          <p className="font-bold">
                            {formatPrice(addon.price)}
                          </p>
                        </div>
                      ),
                    )}
                  </CardContent>
                </Card>
              )}

            {/* Payment Options */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <RadioGroup
                    value={selectedPaymentOption}
                    onValueChange={(value: "minimum" | "full") => {
                      setSelectedPaymentOption(value);
                      setShowQR(false); // Reset QR if they change option
                    }}
                    className="grid gap-4"
                    disabled={paymentStatus === "success"}
                  >
                    {/* Minimum Payment — hidden if event < 60 days away */}
                    {showMinimumPayment ? (
                      <div
                        className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          selectedPaymentOption === "minimum"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <RadioGroupItem
                          value="minimum"
                          id="minimum"
                          className="mt-1"
                        />
                        <Label
                          htmlFor="minimum"
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-semibold">Minimum Payment</div>
                          <div className="text-sm text-gray-600">
                            Pay deposit and booking amount now
                          </div>
                          <div className="mt-2">
                            <p className="text-sm text-gray-700">
                              Pay: {formatPrice(totals.minimumPayment)}
                            </p>
                            <p className="text-xs text-orange-600 font-semibold">
                              Remaining:{" "}
                              {formatPrice(totals.remainingAfterBooking)}
                            </p>
                          </div>
                        </Label>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 p-4 border-2 border-orange-300 bg-orange-50 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-orange-800">
                            Minimum Payment Unavailable
                          </p>
                          <p className="text-sm text-orange-700">
                            Event is less than 60 days away — full payment is
                            required.
                            {daysUntilEvent !== null && (
                              <span className="font-bold">
                                {" "}
                                ({daysUntilEvent} day
                                {daysUntilEvent === 1 ? "" : "s"} remaining)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Full Payment — always visible */}
                    <div
                      className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedPaymentOption === "full"
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <RadioGroupItem value="full" id="full" className="mt-1" />
                      <Label htmlFor="full" className="flex-1 cursor-pointer">
                        <div className="font-semibold">
                          Full Payment
                          {!showMinimumPayment && (
                            <span className="ml-2 text-xs font-semibold text-white bg-orange-500 px-2 py-0.5 rounded">
                              Required
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          Pay everything now (deposit + full table price +
                          add-ons)
                        </div>
                        <div className="mt-2">
                          <p className="text-sm text-gray-700 font-bold">
                            Pay: {formatPrice(totals.fullPayment)}
                          </p>
                          <p className="text-xs text-green-600 font-semibold">
                            No balance — fully paid
                          </p>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* Payment Mode Selector */}
                  {AmountToBePaid > 0 && organizer?.bankTransferEnabled && (
                    <div className="mt-4 mb-2">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Payment Method</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setPaymentMode("qr")}
                          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium border-2 transition-all ${paymentMode === "qr" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500"}`}>
                          QR / UPI Payment
                        </button>
                        <button type="button" onClick={() => setPaymentMode("bank")}
                          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium border-2 transition-all ${paymentMode === "bank" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"}`}>
                          Bank Transfer
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bank Transfer Details */}
                  {paymentMode === "bank" && organizer?.bankTransferEnabled && AmountToBePaid > 0 && (
                    <div className="mt-4 p-4 border-2 border-green-200 bg-green-50/50 rounded-xl space-y-3">
                      <p className="font-semibold text-sm text-green-800">Bank Transfer Details</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-500">Account Holder:</span><p className="font-medium">{organizer.accountHolderName || "—"}</p></div>
                        <div><span className="text-gray-500">Bank:</span><p className="font-medium">{organizer.bankName || "—"}</p></div>
                        <div><span className="text-gray-500">Account No:</span><p className="font-medium font-mono">{organizer.bankAccountNumber || "—"}</p></div>
                        {organizer.bankIfscCode && <div><span className="text-gray-500">IFSC:</span><p className="font-medium font-mono">{organizer.bankIfscCode}</p></div>}
                        {organizer.bankSwiftCode && <div><span className="text-gray-500">SWIFT:</span><p className="font-medium font-mono">{organizer.bankSwiftCode}</p></div>}
                        {organizer.bankBranch && <div><span className="text-gray-500">Branch:</span><p className="font-medium">{organizer.bankBranch}</p></div>}
                        {organizer.bankBranchCode && <div><span className="text-gray-500">Branch Code:</span><p className="font-medium">{organizer.bankBranchCode}</p></div>}
                      </div>
                      <div className="text-center pt-2 border-t border-green-200">
                        <p className="text-lg font-bold text-green-700">Transfer Amount: {formatPrice(AmountToBePaid)}</p>
                      </div>
                    </div>
                  )}

                  {/* Transaction Verification */}
                  {AmountToBePaid > 0 && (showQR || paymentMode === "bank") && (
                    <div className="mt-4 p-4 border rounded-xl bg-gray-50/50 space-y-3">
                      <p className="font-semibold text-sm text-gray-700">Payment Verification</p>
                      <p className="text-xs text-gray-500">Provide your transaction details so the organizer can verify your payment.</p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Transaction ID / Reference Number</label>
                          <Input
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="e.g. UPI123456789 or bank ref number"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Transaction Screenshot</label>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-3">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setTransactionScreenshot(file);
                                  setScreenshotPreview(URL.createObjectURL(file));
                                }
                              }}
                              className="hidden"
                              id="tx-screenshot"
                            />
                            {screenshotPreview ? (
                              <div className="relative">
                                <img src={screenshotPreview} alt="Screenshot" className="w-full max-h-40 object-contain rounded" />
                                <button type="button" onClick={() => { setTransactionScreenshot(null); setScreenshotPreview(""); }}
                                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">✕</button>
                              </div>
                            ) : (
                              <label htmlFor="tx-screenshot" className="flex flex-col items-center cursor-pointer py-2">
                                <Camera className="h-6 w-6 text-gray-400 mb-1" />
                                <span className="text-xs text-gray-500">Upload payment screenshot</span>
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6">
                    {AmountToBePaid > 0 ? (
                      paymentMode === "qr" && !showQR ? (
                        <Button
                          className="w-full py-6 text-lg font-bold bg-blue-600 hover:bg-blue-700"
                          onClick={() => setShowQR(true)}
                        >
                          Generate QR for {formatPrice(AmountToBePaid)}
                        </Button>
                      ) : null
                    ) : (
                      <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl text-center">
                        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                        <h3 className="font-bold text-green-800 text-lg">
                          Complimentary Entry
                        </h3>
                        <p className="text-green-700 text-sm">
                          A 100% discount has been applied. No payment is
                          required for this booking.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">You selected: </span>
                    {selectedPaymentOption === "minimum"
                      ? "Minimum Payment"
                      : "Full Payment"}
                  </p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">
                    {formatPrice(getAmountToPay())}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* QR Code Section - Auto Loaded */}
            {paymentStatus === "loading" && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6 flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                  <p className="text-blue-900">Loading payment QR code...</p>
                </CardContent>
              </Card>
            )}

            {paymentStatus === "ready" && paymentQRCode && (
              <Card>
                <CardHeader className="text-center">
                  <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                    <QrCode className="w-6 h-6 text-blue-600" />
                    Complete Your Payment
                  </CardTitle>
                  <div className="text-4xl font-bold text-green-600 mt-4">
                    {formatPrice(AmountToBePaid)}
                  </div>
                </CardHeader>
                <CardContent className="text-center space-y-6">
                  {AmountToBePaid > 0 && showQR ? (
                    <>
                      {/* Dynamic QR Code */}
                      {dynamicQR && country === "IN" && (
                        <div>
                          {dynamicUpiString ? (
                            <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl shadow-lg border-2 border-blue-200">
                              <QRCode
                                value={dynamicUpiString}
                                size={280}
                                fgColor="#000000ff"
                                bgColor="#ffffff"
                              />

                              <Button
                                className="w-full py-6 text-lg font-semibold"
                                onClick={handlePayClick}
                              >
                                Click to Pay
                              </Button>
                              <div className="text-center space-y-2">
                                <p className="font-bold text-lg text-green-700">
                                  📱 Scan with any Payment App
                                </p>
                                {/* <p className="text-xs text-gray-600">
                          Google Pay, PhonePe, Paytm, etc.
                        </p> */}
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-center animate-pulse">
                              <div className="w-72 h-72 bg-gray-100 rounded-xl border-4 border-dashed border-gray-300 flex items-center justify-center">
                                <div className="text-center text-gray-500">
                                  <QrCode className="w-12 h-12 mx-auto mb-2" />
                                  <p>Generating Payment QR...</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}{" "}
                      {!dynamicQR && country === "IN" && (
                        <div>
                          {!dynamicQR && orderData?.paymentURL ? (
                            <img
                              src={orderData?.paymentURL}
                              alt="Payment QR Code"
                              className="mx-auto w-72 h-72 object-contain"
                            />
                          ) : (
                            <div className="flex justify-center animate-pulse">
                              <div className="w-72 h-72 bg-gray-100 rounded-xl border-4 border-dashed border-gray-300 flex items-center justify-center">
                                <div className="text-center text-gray-500">
                                  <QrCode className="w-12 h-12 mx-auto mb-2" />
                                  <p>Loading Payment QR...</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {dynamicQR && country === "SG" && (
                        <div>
                          {dynamicUENString ? (
                            <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl shadow-lg border-2 border-blue-200">
                              <img
                                src={dynamicUENString}
                                alt="PayNow QR"
                                className="w-[280px] h-[280px] rounded-xl shadow-lg"
                              />

                              <div className="text-center space-y-2">
                                <p className="font-bold text-lg text-green-700">
                                  📱 Scan with any Payment App
                                </p>
                                {mobileId && !uenId && (
                                  <div>
                                    <p className="font-semibold text-lg text-green-700">
                                      If the QR code fails, Pay Directly to
                                      Mobile Number:
                                      {mobileId}.
                                    </p>

                                    <p className="text-sm text-gray-600">
                                      WhatsAppNumber:{" "}
                                      <span className="font-medium">
                                        {orderData?.whatsAppNumber}
                                      </span>
                                    </p>
                                  </div>
                                )}
                                {uenId && mobileId === null && (
                                  <div>
                                    <p className="font-semibold text-lg text-green-700">
                                      If the QR code fails, Pay Directly to UEN:{" "}
                                      {uenId}.
                                    </p>

                                    <p className="text-sm text-gray-600">
                                      WhatsAppNumber:{" "}
                                      <span className="font-medium">
                                        {orderData?.whatsAppNumber}
                                      </span>
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-center animate-pulse">
                              <div className="w-72 h-72 bg-gray-100 rounded-xl border-4 border-dashed border-gray-300 flex items-center justify-center">
                                <div className="text-center text-gray-500">
                                  <QrCode className="w-12 h-12 mx-auto mb-2" />
                                  <p>Generating Payment QR...</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {!dynamicQR && country === "SG" && (
                        <div>
                          {!dynamicQR && orderData?.paymentURL ? (
                            <img
                              src={orderData?.paymentURL}
                              alt="Payment QR Code"
                              className="mx-auto w-72 h-72 object-contain"
                            />
                          ) : (
                            <div className="flex justify-center animate-pulse">
                              <div className="w-72 h-72 bg-gray-100 rounded-xl border-4 border-dashed border-gray-300 flex items-center justify-center">
                                <div className="text-center text-gray-500">
                                  <QrCode className="w-12 h-12 mx-auto mb-2" />
                                  <p>Loading Payment QR...</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Shop Details */}
                      {/* Payment Instructions */}
                      {timeLeft > 0 && (
                        <div className="flex items-center justify-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
                          <Clock className="w-4 h-4 text-yellow-700" />
                          <p className="text-sm font-semibold text-yellow-800">
                            QR expires in {formatTime(timeLeft)}
                          </p>
                        </div>
                      )}
                      {timeLeft === 0 && (
                        <div className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                          <AlertCircle className="w-4 h-4 text-red-700" />
                          <p className="text-sm font-semibold text-red-800">
                            QR has expired. Please refresh to generate a new
                            one.
                          </p>
                        </div>
                      )}
                    </>
                  ) : AmountToBePaid > 0 && !showQR ? (
                    <div className="py-12 text-gray-400">
                      <QrCode className="w-16 h-16 mx-auto mb-2 opacity-20" />
                      <p>
                        Select a payment option above to generate your QR code
                      </p>
                    </div>
                  ) : null}

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-bold text-green-800">
                      ✅ After Payment
                    </p>
                    <p className="text-xs text-green-700">
                      Once your payment is successful, Click the "I have
                      Completed Payment" to complete your order.
                    </p>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* <Button
                      onClick={handlePayNow}
                      disabled={isDecoding || isSubmitting}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      {isDecoding ? (
                        <>
                          <Loader className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Scan className="mr-2 h-5 w-5" />
                          Scan & Pay Now
                        </>
                      )}
                    </Button> */}
                    <Button
                      onClick={handleDownload}
                      variant="outline"
                      disabled={!orderData?.paymentURL}
                      className="flex-1"
                    >
                      <Download className="mr-2 h-5 w-5" />
                      Download QR
                    </Button>
                  </div>
                  <Button
                    onClick={handlePaymentConfirmation}
                    disabled={isProcessing} // Assuming you have an isSubmitting state
                    className="w-full py-6 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-md transition-all transform hover:scale-[1.02]"
                  >
                    {isProcessing ? (
                      <>
                        <Loader className="mr-2 h-5 w-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-6 w-6" />{" "}
                        {/* Import CheckCircle from lucide-react */}I have
                        Completed Payment
                      </>
                    )}
                  </Button>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs text-blue-700">
                      <span className="font-semibold">Note:</span> Clicking the
                      button above will notify the Organizer to verify your
                      payment and process your order.
                    </p>
                  </div>
                  {/* Shop Info */}
                  {/* <div className="border-t pt-4 text-xs text-gray-600 space-y-1">
                    <p>
                      <span className="font-semibold">📍 Pickup:</span>{" "}
                      {state.merchantName}
                    </p>
                    <p>
                      <span className="font-semibold">📅 Date:</span>{" "}
                      {state.pickupDate}
                    </p>
                    <p>
                      <span className="font-semibold">⏰ Time:</span>{" "}
                      {state.pickupTime}
                    </p>
                  </div> */}
                </CardContent>
              </Card>
            )}

            {/* Success Message */}
            {paymentStatus === "success" && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <CheckCircle2 className="h-20 w-20 text-green-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-green-900 mb-2">
                      Booking Confirmed!
                    </h3>
                    <p className="text-green-700 mb-4">
                      Your table booking request has been submitted successfully
                    </p>
                    {bookingId && (
                      <p className="text-sm text-green-600 font-mono bg-white p-2 rounded">
                        Booking ID: {bookingId}
                      </p>
                    )}
                    {/* <p className="text-sm text-gray-600 mt-4">
                      Redirecting to event page...
                    </p> */}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error Message */}
            {paymentStatus === "failed" && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <AlertCircle className="h-8 w-8 text-red-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-red-900">
                        Failed to Load Payment
                      </h3>
                      <p className="text-sm text-red-700 mt-1">
                        Please try again or contact support
                      </p>
                      <Button
                        onClick={() => fetchOrganizerQRCode()}
                        className="mt-4"
                      >
                        Try Again
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Side - Order Summary */}
          <div className="space-y-6">
            <div className="sticky top-4">
              {/* Price Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Tables Rental</span>
                    <span className="font-semibold">
                      {formatPrice(totals.tablesTotal)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-700">Deposit</span>
                    <span className="font-semibold">
                      {formatPrice(totals.depositTotal)}
                    </span>
                  </div>

                  {totals.addOnsTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">Add-ons</span>
                      <span className="font-semibold">
                        {formatPrice(totals.addOnsTotal)}
                      </span>
                    </div>
                  )}

                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount ({discount.toFixed(1)}%)</span>
                      <span>
                        -
                        {formatPrice(
                          originalTotals.fullPayment * (discount / 100),
                        )}
                      </span>
                    </div>
                  )}

                  <Separator className="my-2" />

                  <div className="flex justify-between text-lg font-bold">
                    <span>Grand Total</span>
                    <span className="text-green-600">
                      {formatPrice(totals.fullPayment)}{" "}
                      {/* Changed from totals.grandTotal */}
                    </span>
                  </div>

                  {selectedPaymentOption === "minimum" && (
                    <div className="text-center pt-4 bg-orange-50 p-3 rounded">
                      <p className="text-xs text-orange-600 font-semibold mb-1">
                        REMAINING TO PAY LATER
                      </p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatPrice(totals.remainingAfterBooking)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* New Coupon Card */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Coupon Code</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      disabled={
                        paymentStatus === "success" || appliedCoupon !== ""
                      }
                    />
                    {appliedCoupon ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCouponCode("");
                          setAppliedCoupon("");
                          setDiscount(0);
                        }}
                        disabled={paymentStatus === "success" || isProcessing}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        onClick={handleApplyCoupon}
                        disabled={
                          !couponCode.trim() ||
                          isApplyingCoupon ||
                          paymentStatus === "success"
                        }
                        size="sm"
                      >
                        {isApplyingCoupon ? "..." : "Apply"}
                      </Button>
                    )}
                  </div>
                  {discount > 0 && (
                    <p className="text-sm text-green-600 font-medium">
                      Coupon applied successfully!
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Shopkeeper Info */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Vendor Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-gray-600">Name:</Label>
                    <p className="font-semibold">
                      {orderData?.shopkeeperDetails?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Business:</Label>
                    <p className="font-semibold">
                      {orderData?.shopkeeperDetails?.businessName || "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Email: </Label>
                    <a
                      href={`mailto:${orderData?.shopkeeperDetails?.email}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      {orderData?.shopkeeperDetails?.email || "N/A"}
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TablePaymentPage;
