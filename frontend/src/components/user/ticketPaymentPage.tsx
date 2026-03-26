// ticketPaymentPage.tsx
import React, { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CheckCircle,
  QrCode,
  Calendar,
  MapPin,
  Clock,
  Users,
  Download,
  User,
  Mail,
  Phone,
  Ticket,
  AlertCircle,
  MessageCircle,
  Badge,
  CheckCircle2,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
// import QRCodeLib from "qrcode";
import * as QRCodeReact from "qrcode.react";
import { jwtDecode } from "jwt-decode";
import { OrganizerToken } from "./ticketCart";
import { useCurrency } from "@/hooks/useCurrencyhook";
import jsQR from "jsqr";
import QRCode from "react-qr-code";

interface TicketDetails {
  ticketId: string;
  eventTitle: string;
  eventDate: string;
  eventTime?: string;
  eventVenue?: string;
  customerName: string;
  totalAmount: number;
  qrCode: string; // Base64 dataURL
}

const apiURL = __API_URL__;

export default function TicketPaymentPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const QRCODE = QRCodeReact || (QRCodeReact as any);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentURL, setPaymentURL] = useState("");
  const [showPaymentQR, setShowPaymentQR] = useState(true);
  const [ticketIdForQR, setTicketIdForQR] = useState<string | null>(null); // Store ticket ID for QR
  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [ticketId, setTicketId] = useState("");
  const [dynamicUpiString, setDynamicUpiString] = useState("");
  const [dynamicUENString, setDynamicUENString] = useState("");
  const [country, setCountry] = useState("");
  const [organizerInfo, setOrganizerInfo] = useState(null);
  const [dynamicQR, setDynamicQR] = useState(false);
  const { formatPrice, getSymbol } = useCurrency(country);
  const [uenId, setUenId] = useState("");
  const [mobileId, setMobileId] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60);
  const canvasRef = useRef(null);
  const [upiId, setUpiId] = useState("");

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

  useEffect(() => {
    if (!state?.orderId || !state?.eventInfo) {
      toast({
        duration: 5000,
        title: "Invalid payment data",
        description: "Order information is missing.",
        variant: "destructive",
      });
      navigate(-1);
      return;
    }
  }, [state, navigate, toast]);

  useEffect(() => {
    if (state?.eventInfo?.organizerId) {
      fetchPaymentDetails(state.eventInfo.organizerId);
    }
  }, [state]);

  async function fetchPaymentDetails(id: string) {
    try {
      const response = await fetch(`${apiURL}/organizers/profile-get/${id}`, {
        method: "GET",
      });
      if (!response.ok) throw new Error("Failed to fetch store details");
      const shopData = await response.json();
      setPaymentURL(shopData.data.paymentURL);
      setDynamicQR(shopData?.data?.dynamicQR);
      setMobileId(shopData?.data.phone);
      setCountry(shopData?.data.country);
      setOrganizerInfo(shopData?.data);
    } catch (error) {
      console.error("Error fetching payment details:", error);
    }
  }

  useEffect(() => {
  });

  async function extractUpiFromImage() {
    if (!state?.paymentURL || upiId) return;


    try {
      setLoading(true);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = state?.paymentURL;

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
    if (!state?.paymentURL || uenId) return;

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = state?.paymentURL;

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
    if (!upiId || !state?.total) return "";

    return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
      organizerInfo.organizationName || "Payment",
    )}&am=${state.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
      `Order ${state.ticketId}`,
    )}&tr=${state.ticketId}`;
  }

  async function generateDynamicPayNowQR(): Promise<string> {
    if (!mobileId || !state?.total) return "";

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

      const payNowString = `https://www.sgqrcode.com/paynow?mobile=${cleanedMobileId}&uen=&editable=0&amount=${state.total}&expiry=${encodedExpiry}&ref_id=&company=`;


      setLoading(false);
      return payNowString;
    } catch (error) {
      throw error;
    }
    // Remove +65
  }

  useEffect(() => {
    const loadPaymentData = async () => {
      if (state?.paymentURL && !upiId && country === "IN") {
        extractUpiFromImage();
      }
      if (country === "SG" && mobileId && state?.total) {
        const qr = await generateDynamicPayNowQR();
        setDynamicUENString(qr);
      }
    };
    loadPaymentData();
  }, [
    state?.paymentURL,
    upiId,
    country,
    mobileId,
    state?.total,
    dynamicUENString,
  ]);

  useEffect(() => {
    const loadDynamicData = async () => {
      if (upiId && state?.total && country === "IN") {
        const upiStr = generateDynamicUpi();
        setDynamicUpiString(upiStr);
      }
      if (uenId && state?.total && country === "SG") {
        const upiStr = await generateDynamicPayNowQR();
        // const upiStr = `https://www.sgqrcode.com/paynow?mobile=90037950&uen=&editable=0&amount=10&expiry=2026%2F01%2F24%2001%3A00&ref_id=&company=`;
        setDynamicUENString(upiStr);
      }
    };
    loadDynamicData();
  }, [upiId, state?.total, uenId, country]);

  // 🔒 Generate secure QR payload
  const generateSecureTicketPayload = (ticketId: string): string => {
    return JSON.stringify({
      warning:
        "❌ Normal scanners not allowed. Please use the Eventsh app to scan this ticket.",
      type: "eventsh-ticket",
      ticketId: ticketId,
      eventId: state.eventId || state.eventInfo.id,
      issuedAt: new Date().toISOString(),
    });
  };

  // ✅ Generate QR code AFTER canvas is mounted
  useEffect(() => {
    if (paymentSubmitted && ticketIdForQR && qrCanvasRef.current) {
      const qrData = generateSecureTicketPayload(ticketIdForQR);
      QRCODE.toCanvas(qrCanvasRef.current, qrData, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "M",
      }).catch(console.error);
    }
  }, [paymentSubmitted, ticketIdForQR]);

  const handlePaymentCompletion = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const formattedTickets = state.tickets.map((t) => ({
        type: t.ticketType,
        quantity: t.quantity,
        price: t.price,
      }));

      const eventInfo = {
        id: state.eventInfo.id,
        title: state.eventInfo.title,
        organizationName: state.eventInfo.organizationName,
        venue: state.eventInfo.venue,
        date: state.eventInfo.date,
        time: state.eventInfo.time,
        image: state.eventInfo.image || "",
        organizerId: state.eventInfo.organizerId,
      };

      const customerDetails = {
        firstName: state.customerDetails.firstName,
        lastName: state.customerDetails.lastName,
        // email: state.customerDetails.email,
        whatsapp: state.customerDetails.whatsapp,
        emergencyContact: state.customerDetails.emergencyContact || "",
      };

      const orderData = {
        ticketId: state.ticketId,
        eventId: state.eventId || state.eventInfo.id,
        organizerId: state.organizerId || state.eventInfo.organizerId,
        tickets: formattedTickets,
        customerDetails,
        coupon: state.coupon || null,
        eventInfo,
        discount: state.discount || 0,
        total: state.total,
        paymentConfirmed: true,
        purchaseDate: new Date().toISOString(),
        notes: state.notes || "",
      };

      const res = await fetch(`${apiURL}/tickets/create-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create ticket order");
      }

      const result = await res.json();
      const actualTicketId = orderData.ticketId;

      setTicketId(actualTicketId);

      // ✅ Set ticket ID → triggers useEffect to generate QR
      setTicketIdForQR(actualTicketId);
      setShowPaymentQR(false);
      setPaymentSubmitted(true);
      const token = sessionStorage.getItem("token");
      if (token) {
        const decode = jwtDecode<OrganizerToken>(token);
        const role = decode.roles[0];

        if (role === "user") {
          sessionStorage.removeItem("token");
        }
      }
      localStorage.removeItem("ticketCart");

      await fetchTicket(actualTicketId);

      toast({
        duration: 5000,
        title: "Payment Completed!",
        description: "Your tickets have been generated successfully.",
      });
    } catch (err) {
      toast({
        duration: 5000,
        title: "Payment failed",
        description: err.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadTicket = () => {
    const canvas = qrCanvasRef.current;
    if (canvas) {
      const link = document.createElement("a");
      link.download = `eventsh-ticket-${state.orderId}.png`;
      link.href = canvas.toDataURL();
      link.click();
      toast({
        duration: 5000,
        title: "Ticket Downloaded",
        description: "Your ticket QR code has been saved.",
      });
    }
  };

  const getWhatsappLink = () => {
    if (!state?.whatsAppNumber) return "#";
    const ticketsList = state.tickets
      ?.map(
        (ticket) =>
          `• ${ticket.ticketType} (Qty: ${ticket.quantity}) - ${formatPrice(
            ticket.price * ticket.quantity,
          )}`,
      )
      .join("\n");

    const eventInfo = `
🎫 Event: ${state.eventInfo.title}
📅 Date: ${new Date(state.eventInfo.date).toLocaleDateString()}
🕒 Time: ${state.eventInfo.time}
📍 Venue: ${state.eventInfo.venue}
    `;

    const customerInfo = `
👤 Customer: ${state.customerDetails.firstName} ${state.customerDetails.lastName}
📧 Email: ${state.customerDetails.email}
📱 Phone: ${state.customerDetails.whatsapp}
    `;

    const text = encodeURIComponent(
      `Hello, I have purchased tickets for your event (Order: ${state.orderId}):
      
${eventInfo}

Tickets:
${ticketsList}

${customerInfo}

Total Amount: ${formatPrice(state.total)}

Please confirm my ticket booking. Thank you!`,
    );

    const phone = state.whatsAppNumber.replace(/\D/g, "");
    return `https://wa.me/${phone}?text=${text}`;
  };

  if (!state?.orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">
            Loading payment info...
          </h2>
        </div>
      </div>
    );
  }

  const handleBack = async () => {
    // await sessionStorage.removeItem("token");
    navigate(-1);
  };

  async function fetchTicket(ticketId: string) {
    try {
      const res = await fetch(`${apiURL}/tickets/by-ticket-id/${ticketId}`);
      if (!res.ok) throw new Error("Failed to fetch ticket");
      const data = await res.json();

      // Adapt this part based on your API data structure
      const ticketData: TicketDetails = {
        ticketId: data.ticketId,
        eventTitle: data.eventId.title,
        eventDate: new Date(data.eventId.startDate).toLocaleDateString(),
        eventTime: data.eventId.time,
        eventVenue: data.eventId.location,
        customerName: data.customerName,
        totalAmount: data.totalAmount,
        qrCode: data.qrCode, // Assumed base64 data URL string stored in DB or generated
      };

      setTicket(ticketData);

      // Draw QR code onto canvas if available
      if (qrCanvasRef.current && ticketData.qrCode) {
        const ctx = qrCanvasRef.current.getContext("2d");
        if (!ctx) return;
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, 300, 300);
          ctx.drawImage(img, 0, 0, 300, 300);
        };
        img.src = ticketData.qrCode;
      }
    } catch (error) {
      console.error(error);
    }
  }

  const generateWhatsAppMessage = () => {
    const itemsList = state.cartItems
      ?.map(
        (item) =>
          `• ${item.productName} (Qty: ${item.quantity}) - ${formatPrice(
            item.price * item.quantity,
          )}`,
      )
      .join("\n");

    const deliveryInfo =
      state.orderType === "delivery" && state.deliveryAddress
        ? `\n📍 Delivery Address:\n${state.deliveryAddress.street}, ${
            state.deliveryAddress.city
          }, ${state.deliveryAddress.state} - ${state.deliveryAddress.zipCode}${
            state.deliveryAddress.instructions
              ? `\nInstructions: ${state.deliveryAddress.instructions}`
              : ""
          }`
        : state.orderType === "pickup"
          ? `\n🏪 Pickup Details:\nDate: ${state.pickupDate}\nTime: ${state.pickupTime}\nAddress:`
          : "";

    const message = `Hi, I want to purchase from your shop:\n\n${itemsList}\n\nTotal Amount: ${formatPrice(state.total)}\n\n${deliveryInfo}
    \n\nPlease confirm this order.`;

    return encodeURIComponent(message);
  };

  const getWhatsAppLink = () => {
    const shopPhone = state.whatsAppNumber?.replace(/\D/g, ""); // Remove non-digits
    return `https://wa.me/${shopPhone}?text=${generateWhatsAppMessage()}`;
  };

  const handleDownloadPdf = () => {
    if (!ticket) return;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: [600, 800],
    });

    const margin = 20;

    const html = `
  <div style="font-family: Arial, sans-serif;max-height:900px; max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; padding: 20px;">
    <div style="background: #3b82f6; color: white; padding: 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">EVENTSH TICKET</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${ticket.eventTitle}</p>
    </div>
    <div style="padding: 25px;">
      <h2 style="color: #1e293b; font-size: 18px; margin-bottom: 20px; text-align: center;">Ticket Details</h2>
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
        <p><strong>Attendee:</strong> ${ticket.customerName}</p>
        <p><strong>Date:</strong> ${ticket.eventDate}</p>
        <p><strong>Time:</strong> ${ticket.eventTime || "N/A"}</p>
        <p><strong>Venue:</strong> ${ticket.eventVenue || "N/A"}</p>
        <p><strong>Total Amount:</strong> ${formatPrice(ticket.totalAmount)}</p>
      </div>
      <p style="margin-bottom: 10px; font-weight: 600; color: #1e293b; width: 100%; text-align: center;">Scan at Event Entrance</p>
      <div style="text-align: center; margin: 25px 0; display: flex; justify-content: center; align-items: center;">
          <img src="${
            ticket.qrCode
          }" alt="Ticket QR Code" style="width: 200px; height: 200px; border: 2px solid #e2e8f0; border-radius: 8px;" />
      </div>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px;">
        <p style="margin: 0; color: #dc2626; font-size: 14px;">
          <strong>Important:</strong> This QR code can ONLY be scanned using the official Eventsh app.<br>
        </p>
      </div>
    </div>
    <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
      <p style="margin: 0;">© ${new Date().getFullYear()} Eventsh. All rights reserved.</p>
    </div>
  </div>
`;

    // Use jsPDF's html method to render
    doc.html(html, {
      callback: () => {
        doc.save(`eventsh-ticket-${ticket.ticketId.slice(8)}.pdf`);
      },
      x: margin,
      y: margin,
      width: 560,
      windowWidth: 600,
    });
  };

  async function handleDownload() {
    if (!state?.paymentURL) {
      toast({
        duration: 5000,
        title: "No QR code available",
        variant: "destructive",
      });
      return;
    }
    try {
      const response = await fetch(state?.paymentURL);
      if (!response.ok) {
        throw new Error("Failed to fetch image for download.");
      }
      const imageBlob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(imageBlob);
      link.download = `payment-qr-order-${state.merchantName}.png`;
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" onClick={() => handleBack()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Ticket Payment</h1>
              <p className="text-muted-foreground">Complete your purchase</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Event Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="relative overflow-hidden rounded-lg h-48"
                    style={{
                      backgroundImage: `url(${apiURL}${state.eventInfo.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-end p-6">
                      <div className="text-white">
                        <h3 className="text-2xl font-bold">
                          {state.eventInfo.title}
                        </h3>
                        <p className="text-white/80">
                          {state.eventInfo.organizationName}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{state.eventInfo.venue}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        {new Date(state.eventInfo.date).toLocaleDateString()} at{" "}
                        {state.eventInfo.time}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {showPaymentQR ? (
                <>
                  {state.total > 1000 && !state.hasDocVerification ? (
                    <Card className="mt-6 border-slate-200 bg-slate-50">
                      {/* STATUS BAR */}
                      <div className="flex flex-col md:flex-row items-center justify-between gap-2 px-6 py-3 bg-slate-100 border-b border-slate-200 rounded-t-lg">
                        <div className="text-xs md:text-sm text-slate-700">
                          <span className="font-semibold">
                            Payment pending.
                          </span>{" "}
                          Complete the payment and then select{" "}
                          <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded">
                            "I Have Completed Payment"
                          </span>{" "}
                          so the shop can confirm your order.
                        </div>
                        {/* <div className="text-xs md:text-sm text-slate-800">
                    Amount:{" "}
                    <span className="font-semibold">
                      {formatPrice(state.total)}
                    </span>
                  </div> */}
                      </div>

                      <CardContent className="space-y-4 pt-4">
                        {/* TITLE + BADGE */}
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                          <div>
                            <p className="text-sm md:text-base font-semibold text-slate-900">
                              Manual payment required for this order
                            </p>
                            <p className="text-xs md:text-sm text-slate-700 mt-1">
                              The shop’s business verification is still in
                              progress, so this high‑value payment is handled
                              through a simple manual confirmation flow.
                            </p>
                          </div>
                          <Badge className="bg-slate-100 text-slate-800 border-slate-300 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            Verification in review
                          </Badge>
                        </div>

                        {/* STEPS */}
                        <div className="bg-white border border-slate-200 rounded-lg p-4">
                          <p className="text-sm font-semibold text-slate-900">
                            How to complete the payment
                          </p>
                          <ol className="mt-2 text-xs sm:text-sm text-slate-700 space-y-1.5 list-decimal list-inside">
                            <li>
                              Agree with the shop on the exact amount and
                              payment method.
                            </li>
                            <li>
                              Pay using UPI, bank transfer, or card as shared by
                              the shop.
                            </li>
                            <li>
                              Once you have paid, come back to this page and
                              click{" "}
                              <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded">
                                "I Have Completed Payment"
                              </span>{" "}
                              to submit your confirmation.
                            </li>
                          </ol>
                        </div>

                        {/* INFO NOTE */}
                        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-3">
                          <p className="text-xs text-slate-700">
                            After the shop finishes business verification,
                            high‑value orders like this can also be paid using
                            automatic QR‑based payments. Until then, this manual
                            confirmation step helps keep both buyer and seller
                            safe.
                          </p>
                        </div>

                        {/* WHATSAPP CONNECT (UNCHANGED) */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-slate-900">
                            Contact the shop for payment confirmation
                          </p>
                          <a
                            href={getWhatsAppLink()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 shadow-sm"
                          >
                            <MessageCircle className="w-5 h-5" />
                            Send order details via WhatsApp
                          </a>
                          <p className="text-xs text-slate-600">
                            The order amount and details will be auto‑filled in
                            WhatsApp. After the shop confirms the payment, click{" "}
                            <span className="font-mono bg-slate-200 px-1 rounded">
                              "I Have Completed Payment"
                            </span>{" "}
                            here to continue.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    /* ✅ GST VERIFIED OR AMOUNT ≤ 1000 - SHOW QR CODE */
                    <Card className="mt-6">
                      <CardHeader className="text-center">
                        <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                          <QrCode className="w-6 h-6 text-blue-600" />
                          Complete Your Payment
                        </CardTitle>
                        <div className="text-4xl font-bold text-green-600 mt-4">
                          {formatPrice(state.total)}
                        </div>
                      </CardHeader>
                      <CardContent className="text-center space-y-6">
                        {state.total === 0 && (
                          <div className="flex flex-col items-center gap-6 p-8 bg-green-50 rounded-xl border-2 border-green-200 shadow-sm text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                              <CheckCircle2 className="w-12 h-12 text-green-600" />
                            </div>

                            <div className="space-y-2">
                              <h3 className="text-2xl font-bold text-green-800">
                                Free Entry Confirmed!
                              </h3>
                              <p className="text-gray-600 max-w-xs mx-auto">
                                As an{" "}
                                <span className="font-semibold text-green-700">
                                  Exhibitor Operator
                                </span>
                                , your entry to this event is complimentary.
                              </p>
                            </div>

                            <div className="bg-white p-4 rounded-lg border border-green-100 w-full">
                              <p className="text-sm text-gray-500 italic">
                                "No payment is required for your registration."
                              </p>
                            </div>

                            {/* <Button
                              className="w-full py-6 text-lg font-semibold bg-green-600 hover:bg-green-700 transition-colors"
                              onClick={handlePayClick} // Assuming this function handles the final ticket generation logic
                            >
                              Generate My Free Ticket
                            </Button>

                            <p className="text-xs text-green-600 font-medium animate-pulse">
                              Click above to finalize your registration
                            </p> */}
                          </div>
                        )}
                        {/* Dynamic QR Code */}
                        {dynamicQR && country === "IN" && state.total > 0 && (
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
                        {!dynamicQR && country === "IN" && state.total > 0 && (
                          <div>
                            {!dynamicQR && state?.paymentURL ? (
                              <img
                                src={state?.paymentURL}
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
                        {dynamicQR && country === "SG" && state.total > 0 && (
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
                                          {state?.whatsAppNumber}
                                        </span>
                                      </p>
                                    </div>
                                  )}
                                  {uenId && mobileId === null && (
                                    <div>
                                      <p className="font-semibold text-lg text-green-700">
                                        If the QR code fails, Pay Directly to
                                        UEN: {uenId}.
                                      </p>

                                      <p className="text-sm text-gray-600">
                                        WhatsAppNumber:{" "}
                                        <span className="font-medium">
                                          {state?.whatsAppNumber}
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
                        {!dynamicQR && country === "SG" && state.total > 0 && (
                          <div>
                            {!dynamicQR && state?.paymentURL ? (
                              <img
                                src={state?.paymentURL}
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
                            disabled={!state?.paymentURL}
                            className="flex-1"
                          >
                            <Download className="mr-2 h-5 w-5" />
                            Download QR
                          </Button>
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

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Ticket className="h-5 w-5" />
                        Your Tickets
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {state.tickets?.map((ticket, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center p-4 bg-muted rounded-lg"
                          >
                            <div>
                              <h4 className="font-semibold">
                                {ticket.ticketType}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {formatPrice(ticket.price)} × {ticket.quantity}
                              </p>
                            </div>
                            <div className="text-right font-semibold">
                              {formatPrice(ticket.price * ticket.quantity)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Customer Info
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>
                          {state.customerDetails.firstName}{" "}
                          {state.customerDetails.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{state.customerDetails.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{state.customerDetails.whatsapp}</span>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : null}

              {/* ✅ SECURE TICKET QR DISPLAY */}
              {paymentSubmitted && ticket && (
                <Card className="border-green-200 bg-green-50 p-4 max-w-lg mx-auto">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="h-5 w-5" />
                      Your Secure Ticket
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* On-screen ticket preview like PDF */}
                    <div
                      style={{
                        fontFamily: "Arial, sans-serif",
                        maxWidth: 560,
                        margin: "0 auto",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        overflow: "hidden",
                        padding: 20,
                        backgroundColor: "white",
                      }}
                    >
                      <div
                        style={{
                          background:
                            "linear-gradient(135deg, #3b82f6, #6366f1)",
                          color: "white",
                          padding: 30,
                          textAlign: "center",
                        }}
                      >
                        <h1 style={{ margin: 0, fontSize: 24 }}>
                          EVENTSH TICKET
                        </h1>
                        <p style={{ margin: "8px 0 0 0", opacity: 0.9 }}>
                          {ticket.eventTitle}
                        </p>
                      </div>

                      <div style={{ padding: 25 }}>
                        <h2
                          style={{
                            color: "#1e293b",
                            fontSize: 18,
                            marginBottom: 20,
                          }}
                        >
                          Ticket Details
                        </h2>
                        <div
                          style={{
                            background: "#f8fafc",
                            padding: 15,
                            paddingBottom: 10,
                            borderRadius: 8,
                            marginBottom: 20,
                          }}
                        >
                          <p style={{ marginBottom: 10 }}>
                            <strong>🎫 Ticket ID:</strong>{" "}
                            {ticket.ticketId.slice(8)}
                          </p>
                          <p style={{ marginBottom: 10 }}>
                            <strong>👤 Attendee:</strong> {ticket.customerName}
                          </p>
                          <p style={{ marginBottom: 10 }}>
                            <strong>📅 Date:</strong> {ticket.eventDate}
                          </p>
                          <p style={{ marginBottom: 10 }}>
                            <strong>🕒 Time:</strong>{" "}
                            {ticket.eventTime || "N/A"}
                          </p>
                          <p style={{ marginBottom: 10 }}>
                            <strong>📍 Venue:</strong>{" "}
                            {ticket.eventVenue || "N/A"}
                          </p>
                          <p style={{ marginBottom: 10 }}>
                            <strong>💰 Total Amount:</strong>
                            {formatPrice(ticket.totalAmount)}
                          </p>
                        </div>

                        <div>
                          <p
                            style={{
                              marginBottom: 15,
                              fontWeight: 600,
                              color: "#1e293b",
                              width: "100%",
                              textAlign: "center", // center-align text inside p
                            }}
                          >
                            Scan at Event Entrance
                          </p>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            textAlign: "center",
                            margin: "25px 0",
                          }}
                        >
                          {/* <p
                            style={{
                              marginBottom: 15,
                              fontWeight: 600,
                              color: "#1e293b",
                              width: "100%",
                              textAlign: "center", // center-align text inside p
                            }}
                          >
                            Scan at Event Entrance
                          </p> */}
                          <img
                            src={ticket.qrCode}
                            alt="Ticket QR Code"
                            style={{
                              width: 300,
                              height: 300,
                              border: "2px solid #e2e8f0",
                              borderRadius: 8,
                            }}
                          />
                        </div>

                        <div
                          style={{
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: 8,
                            padding: 15,
                            marginTop: 20,
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              color: "#dc2626",
                              fontSize: 14,
                            }}
                          >
                            ⚠️ <strong>Important:</strong> This QR code can ONLY
                            be scanned using the official Eventsh app.
                            <br />
                            Normal camera scanners will not work.
                          </p>
                        </div>
                      </div>
                      <div
                        style={{
                          background: "#f1f5f9",
                          padding: 15,
                          textAlign: "center",
                          fontSize: 12,
                          color: "#64748b",
                        }}
                      >
                        <p style={{ margin: 0 }}>
                          &copy; {new Date().getFullYear()} Eventsh. All rights
                          reserved.
                        </p>
                      </div>
                    </div>

                    {/* Download button */}
                    <div className="mt-4 flex justify-center">
                      <Button
                        onClick={handleDownloadPdf}
                        variant="buttonOutline"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Ticket
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatPrice(state.subtotal) || "0.00"}</span>
                  </div>
                  {state.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount ({state.discount}%)</span>
                      <span>
                        -{formatPrice((state.subtotal * state.discount) / 100)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Tax</span>
                    <span>{formatPrice(state.tax) || "0.00"}</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{formatPrice(state.total) || "0.00"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {!paymentSubmitted ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Complete Payment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {state.total > 0 ? (
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={handlePaymentCompletion}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Processing..." : "Payment Done"}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={handlePaymentCompletion}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Generating..." : "Click To Generate"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="text-center py-6">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold text-green-700">
                      Payment Successful!
                    </h3>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Need Help?</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="buttonOutline"
                    className="w-full"
                    onClick={() => window.open(getWhatsappLink(), "_blank")}
                  >
                    <FaWhatsapp className="h-4 w-4 mr-2 text-green-600" />
                    Contact Organizer
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
