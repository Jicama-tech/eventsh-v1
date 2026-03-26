import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  XCircle,
  RefreshCw,
  Shield,
  AlertCircle,
} from "lucide-react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";

const apiURL = __API_URL__;

interface TicketData {
  ticketId: string;
  eventId: string;
  eventTitle: string;
  customerName: string;
  customerEmail: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  totalAmount: number;
  isUsed: boolean;
  attendance?: boolean;
  status: string;
}

interface Table {
  tableId: string;
  positionId: string;
  tableName: string;
  tableType: string;
  price: number;
  depositAmount: number;
}

interface AddOn {
  addOnId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Shopkeeper {
  _id: string;
  name: string;
  shopName: string;
  email: string;
  businessEmail: string;
  phone: string;
  address: string;
  whatsappNumber: string;
  businessCategory: string;
}

interface Event {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  startDate?: string;
  time?: string;
  endDate?: string;
  endTime?: string;
  organizer?: string;
  location?: string;
}

interface StallData {
  _id: string;
  action: string;
  status: string;
  checkInTime?: string;
  paidAmount?: number;
  remainingAmount?: number;
  Amount?: number;
  shopkeeper: Shopkeeper;
  eventId: Event;
  Tables: Table[];
  AddOns: AddOn[];
}

interface EventData {
  _id: string;
  title: string;
  organizer: {
    whatsAppNumber: string;
    organizationName: string;
  };
}

type ScanMode = "event-ticket" | "stall-ticket" | "speaker-ticket" | null;
type Step =
  | "otp-verification"
  | "mode-selection"
  | "scanning"
  | "checkin-checkout-selection"
  | "success";

export default function QRTicketScanner() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qrCodeRef = useRef<Html5Qrcode | null>(null);

  // States
  const [step, setStep] = useState<Step>("otp-verification");
  const [scanMode, setScanMode] = useState<ScanMode>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [otp, setOtp] = useState("");
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [stallData, setStallData] = useState<StallData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<"success" | "error" | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [pendingStallQR, setPendingStallQR] = useState<string | null>(null);
  const [stallAction, setStallAction] = useState<
    "CHECK_IN" | "CHECK_OUT" | null
  >(null);

  const [pendingSpeakerQR, setPendingSpeakerQR] = useState<string | null>(null);
  const [speakerData, setSpeakerData] = useState<any>(null);
  const [speakerAction, setSpeakerAction] = useState<"CHECK_IN" | "CHECK_OUT" | null>(null);

  // Check-Out confirmation dialog states
  const [showCheckOutConfirmDialog, setShowCheckOutConfirmDialog] =
    useState(false);
  const [checkOutConfirmInput, setCheckOutConfirmInput] = useState("");
  const [checkOutConfirmError, setCheckOutConfirmError] = useState("");

  // Fetch event data
  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const response = await fetch(`${apiURL}/events/${eventId}`);
      if (!response.ok) throw new Error("Failed to fetch event data");
      const data = await response.json();
      setEventData(data.data);
    } catch (error) {
      console.error("Error fetching event:", error);
    }
  };

  // Send OTP to organizer's WhatsApp
  const sendOTP = async () => {
    if (!eventData?.organizer.whatsAppNumber) {
      toast({
        duration: 5000,
        title: "Error",
        description: "Organizer WhatsApp number not found",
        variant: "destructive",
      });
      return;
    }

    setIsSendingOTP(true);
    try {
      const response = await fetch(`${apiURL}/otp/send-whatsapp-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: eventData.organizer.whatsAppNumber,
          role: "organizer",
        }),
      });

      if (!response.ok) throw new Error("Failed to send OTP");

      setOtpSent(true);
      toast({
        duration: 5000,
        title: "OTP Sent",
        description: `OTP sent to Organizer`,
      });
    } catch (error) {
      console.error("Error sending OTP:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to send OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingOTP(false);
    }
  };

  // Verify OTP
  const verifyOTP = async () => {
    if (!otp.trim()) {
      toast({
        duration: 5000,
        title: "Error",
        description: "Please enter the OTP",
        variant: "destructive",
      });
      return;
    }

    setIsVerifyingOTP(true);
    try {
      const response = await fetch(`${apiURL}/otp/verify-chat-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: eventData?.organizer.whatsAppNumber,
          otp: otp,
          role: "organizer",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Invalid OTP");
      }

      toast({
        duration: 5000,
        title: "Success",
        description: "OTP verified successfully",
      });
      setStep("mode-selection");
    } catch (error) {
      console.error("Error verifying OTP:", error);
      toast({
        duration: 5000,
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Invalid OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  // Select scan mode and proceed to scanning
  const handleModeSelection = (mode: ScanMode) => {
    setScanMode(mode);
    setStep("scanning");
  };

  // Initialize QR Scanner
  useEffect(() => {
    if (step === "scanning") {
      startQRScanner();
    }
    return () => {
      if (qrCodeRef.current) {
        qrCodeRef.current.stop();
        qrCodeRef.current = null;
      }
    };
  }, [step]);

  const startQRScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());

      const qrCode = new Html5Qrcode("qr-reader");
      qrCodeRef.current = qrCode;

      const config = {
        fps: 10,
        qrbox: { width: 350, height: 350 },
        aspectRatio: 1.0,
      };

      await qrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure,
      );
    } catch (error) {
      console.error("Error starting QR scanner:", error);
    }
  };

  // Handle successful QR scan
  const onScanSuccess = async (decodedText: string, decodedResult: any) => {
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      if (qrCodeRef.current) {
        await qrCodeRef.current.stop();
        qrCodeRef.current = null;
      }

      if (scanMode === "event-ticket") {
        await handleEventTicketScan(decodedText);
      } else if (scanMode === "stall-ticket") {
        await handleStallTicketScan(decodedText);
      } else if (scanMode === "speaker-ticket") {
        await handleSpeakerTicketScan(decodedText);
      }
    } catch (error) {
      console.error("Error processing QR code:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to process QR code",
      );
      setScanResult("error");

      toast({
        duration: 5000,
        title: "Scan Failed",
        description: error instanceof Error ? error.message : "Invalid QR code",
        variant: "destructive",
      });

      setTimeout(() => {
        setScanResult(null);
        setIsProcessing(false);
        startQRScanner();
      }, 3000);
    }
  };

  // Handle Event Ticket Scan
  const handleEventTicketScan = async (decodedText: string) => {
    const qrData = JSON.parse(decodedText);

    if (!qrData.type || qrData.type !== "eventsh-ticket") {
      throw new Error("Invalid ticket QR code. This QR is not from EventSH.");
    }

    if (!qrData.ticketId) {
      throw new Error("Invalid QR code format. Missing ticket ID.");
    }

    const ticketResponse = await fetch(
      `${apiURL}/tickets/by-ticket-id/${qrData.ticketId}`,
    );

    if (!ticketResponse.ok) {
      throw new Error("Ticket not found or invalid");
    }

    const ticketInfo = await ticketResponse.json();

    if (ticketInfo.eventId._id !== eventId) {
      throw new Error("This ticket is not for this event");
    }

    setTicketData(ticketInfo);

    const attendanceResponse = await fetch(
      `${apiURL}/tickets/mark-attendance/${qrData.ticketId}`,
      { method: "PATCH" },
    );

    if (!attendanceResponse.ok) {
      const errorData = await attendanceResponse.json();
      throw new Error(errorData.message || "Failed to mark attendance");
    }

    setScanResult("success");
    setStep("success");

    toast({
      duration: 5000,
      title: "Success!",
      description: `Attendance marked for ${ticketInfo.customerName}`,
    });
  };

  // Handle Stall Ticket Scan — pause and ask for Check-In or Check-Out
  const handleStallTicketScan = async (decodedText: string) => {
    const qrData = JSON.parse(decodedText);

    if (!qrData.type || qrData.type !== "eventsh-stall-checkin") {
      throw new Error("Invalid stall QR code. This QR is not from EventSH.");
    }

    if (!qrData.stallId) {
      throw new Error("Invalid QR code format. Missing stall ID.");
    }

    // Save the raw QR text and go to selection screen
    setPendingStallQR(decodedText);
    setIsProcessing(false);
    setStep("checkin-checkout-selection");
  };

  // Called when user clicks Check-In or Check-Out button
  const handleStallActionConfirm = async (action: "CHECK_IN" | "CHECK_OUT") => {
    if (!pendingStallQR) return;

    // If CHECK_OUT, show confirmation dialog first
    if (action === "CHECK_OUT") {
      setStallAction("CHECK_OUT");
      setCheckOutConfirmInput("");
      setCheckOutConfirmError("");
      setShowCheckOutConfirmDialog(true);
      return;
    }

    // CHECK_IN — proceed directly
    await processStallAction("CHECK_IN");
  };

  // Called when user confirms CHECK_OUT in the dialog
  const handleCheckOutConfirm = async () => {
    if (checkOutConfirmInput.trim() !== "CHECK_OUT") {
      setCheckOutConfirmError('Please type "CHECK_OUT" exactly to confirm.');
      return;
    }
    setShowCheckOutConfirmDialog(false);
    if (scanMode === "speaker-ticket") {
      await processSpeakerAction("CHECK_OUT");
    } else {
      await processStallAction("CHECK_OUT");
    }
  };

  // Core function that calls the API after action is decided
  const processStallAction = async (action: "CHECK_IN" | "CHECK_OUT") => {
    if (!pendingStallQR) return;
    setIsProcessing(true);
    setStallAction(action);

    try {
      // For CHECK_OUT — validate that the stall has already checked in
      // Validate check-in / check-out state before proceeding
      const qrData = JSON.parse(pendingStallQR);
      const stallCheckResponse = await fetch(
        `${apiURL}/stalls/${qrData.stallId}`,
      );
      const stallCheck = await stallCheckResponse.json();

      if (action === "CHECK_IN") {
        if (stallCheck.data.hasCheckedIn) {
          throw new Error("This exhibitor has already checked in.");
        }
      }

      if (action === "CHECK_OUT") {
        if (!stallCheck.data.hasCheckedIn) {
          throw new Error(
            "This exhibitor has not checked in yet. Cannot check out before checking in.",
          );
        }
        if (stallCheck.data.hasCheckedOut) {
          throw new Error("This exhibitor has already checked out.");
        }
      }

      const stallResponse = await fetch(`${apiURL}/stalls/scan-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeData: pendingStallQR, action }),
      });

      if (!stallResponse.ok) {
        const errorData = await stallResponse.json();
        throw new Error(errorData.message || "Failed to process stall QR");
      }

      const stallInfo = await stallResponse.json();

      if (stallInfo.data.eventId._id !== eventId) {
        throw new Error("This stall is not for this event");
      }

      setStallData(stallInfo.data);
      setScanResult("success");
      setStep("success");

      toast({
        duration: 5000,
        title: "Success!",
        description: `${action === "CHECK_IN" ? "Checked In" : "Checked Out"} successfully for ${stallInfo.data.shopkeeper?.name}`,
      });
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to process stall QR");
      setScanResult("error");
      toast({
        duration: 5000,
        title: "Error",
        description: error.message,
        variant: "destructive",
      });

      // Go back to selection so user can retry
      setTimeout(() => {
        setScanResult(null);
        setIsProcessing(false);
        setStep("checkin-checkout-selection");
      }, 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Speaker Ticket Scan
  const handleSpeakerTicketScan = async (decodedText: string) => {
    const qrData = JSON.parse(decodedText);

    if (!qrData.type || qrData.type !== "eventsh-speaker-checkin") {
      throw new Error("Invalid speaker QR code. This QR is not from EventSH.");
    }

    if (!qrData.speakerRequestId) {
      throw new Error("Invalid QR code format. Missing speaker ID.");
    }

    setPendingSpeakerQR(decodedText);
    setIsProcessing(false);
    setStep("checkin-checkout-selection");
  };

  const handleSpeakerActionConfirm = async (action: "CHECK_IN" | "CHECK_OUT") => {
    if (!pendingSpeakerQR) return;

    if (action === "CHECK_OUT") {
      setSpeakerAction("CHECK_OUT");
      setCheckOutConfirmInput("");
      setCheckOutConfirmError("");
      setShowCheckOutConfirmDialog(true);
      return;
    }

    await processSpeakerAction("CHECK_IN");
  };

  const processSpeakerAction = async (action: "CHECK_IN" | "CHECK_OUT") => {
    if (!pendingSpeakerQR) return;
    setIsProcessing(true);
    setSpeakerAction(action);

    try {
      const qrData = JSON.parse(pendingSpeakerQR);

      // Validate state
      const checkRes = await fetch(`${apiURL}/speaker-requests/${qrData.speakerRequestId}`);
      const checkData = await checkRes.json();
      const req = checkData.data;

      if (action === "CHECK_IN" && req.hasCheckedIn) {
        throw new Error("This speaker has already checked in.");
      }
      if (action === "CHECK_OUT" && !req.hasCheckedIn) {
        throw new Error("This speaker has not checked in yet.");
      }
      if (action === "CHECK_OUT" && req.hasCheckedOut) {
        throw new Error("This speaker has already checked out.");
      }

      const scanRes = await fetch(`${apiURL}/speaker-requests/scan-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeData: pendingSpeakerQR }),
      });

      if (!scanRes.ok) {
        const errorData = await scanRes.json();
        throw new Error(errorData.message || "Failed to process speaker QR");
      }

      const scanInfo = await scanRes.json();

      setSpeakerData(scanInfo.data);
      setScanResult("success");
      setStep("success");

      toast({
        duration: 5000,
        title: "Success!",
        description: `${action === "CHECK_IN" ? "Checked In" : "Checked Out"} successfully for ${scanInfo.data.speakerName}`,
      });
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to process speaker QR");
      setScanResult("error");
      toast({
        duration: 5000,
        title: "Error",
        description: error.message,
        variant: "destructive",
      });

      setTimeout(() => {
        setScanResult(null);
        setIsProcessing(false);
        setStep("checkin-checkout-selection");
      }, 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const onScanFailure = (error: any) => {
    // Ignore scan failures (normal when no QR code is detected)
  };

  const resetScanner = () => {
    setScanResult(null);
    setTicketData(null);
    setStallData(null);
    setSpeakerData(null);
    setPendingSpeakerQR(null);
    setSpeakerAction(null);
    setErrorMessage("");
    setIsProcessing(false);
    setPendingStallQR(null);
    setStallAction(null);
    setShowCheckOutConfirmDialog(false);
    setCheckOutConfirmInput("");
    setCheckOutConfirmError("");
    setStep("scanning");
  };

  const handleBackToModeSelection = () => {
    setScanMode(null);
    setStep("mode-selection");
  };

  // ─── RENDER: OTP Verification ───────────────────────────────────────────────
  const renderOTPVerification = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <Shield className="mx-auto h-12 w-12 text-blue-600 mb-4" />
        <CardTitle>Organizer Verification Required</CardTitle>
        <p className="text-sm text-gray-600">
          For security, we need to verify you're the event organizer
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {eventData && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-medium">{eventData.title}</p>
            <p className="text-sm text-gray-600">
              {eventData.organizer.organizationName}
            </p>
          </div>
        )}

        {!otpSent ? (
          <Button onClick={sendOTP} disabled={isSendingOTP} className="w-full">
            {isSendingOTP ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending OTP...
              </>
            ) : (
              "Send OTP to WhatsApp"
            )}
          </Button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">
                Enter OTP sent to your WhatsApp
              </label>
              <Input
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={verifyOTP}
                disabled={isVerifyingOTP || !otp.trim()}
                className="flex-1"
              >
                {isVerifyingOTP ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify OTP"
                )}
              </Button>
              <Button
                onClick={() => {
                  setOtpSent(false);
                  setOtp("");
                }}
                variant="buttonOutline"
              >
                Resend
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ─── RENDER: Mode Selection ──────────────────────────────────────────────────
  const renderModeSelection = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <Camera className="mx-auto h-12 w-12 text-blue-600 mb-4" />
        <CardTitle>Select Scan Type</CardTitle>
        <p className="text-sm text-gray-600">Choose what you want to scan</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {eventData && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-medium">{eventData.title}</p>
            <p className="text-sm text-gray-600">
              {eventData.organizer.organizationName}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Button
            onClick={() => handleModeSelection("event-ticket")}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Camera className="mr-2 h-4 w-4" />
            Visitor Ticket
          </Button>
          <Button
            onClick={() => handleModeSelection("stall-ticket")}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <Camera className="mr-2 h-4 w-4" />
            Exhibitor Ticket
          </Button>
          <Button
            onClick={() => handleModeSelection("speaker-ticket")}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Camera className="mr-2 h-4 w-4" />
            Speaker Pass
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ─── RENDER: QR Scanner ──────────────────────────────────────────────────────
  const renderScanner = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <Camera className="mx-auto h-12 w-12 text-green-600 mb-4" />
        <CardTitle>
          {scanMode === "event-ticket"
            ? "Scan Event Ticket"
            : scanMode === "speaker-ticket"
              ? "Scan Speaker Pass"
              : "Scan Stall Ticket"}
        </CardTitle>
        <p className="text-sm text-gray-600">
          {scanMode === "event-ticket"
            ? "Point your camera at the attendee's ticket QR code"
            : "Point your camera at the shopkeeper's stall QR code"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div
            id="qr-reader"
            className="w-full rounded-lg overflow-hidden border-2 border-dashed border-gray-300"
            style={{ minHeight: "300px" }}
          />

          {isProcessing && (
            <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-medium">Processing...</p>
              </div>
            </div>
          )}

          {scanResult === "error" && (
            <div className="absolute inset-0 bg-red-50 bg-opacity-95 flex items-center justify-center rounded-lg">
              <div className="text-center p-4">
                <XCircle className="h-12 w-12 text-red-600 mx-auto mb-2" />
                <p className="font-medium text-red-800">Scan Failed</p>
                <p className="text-sm text-red-600 mb-3">{errorMessage}</p>
                <p className="text-xs text-gray-600">Restarting scanner...</p>
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleBackToModeSelection}
          variant="buttonOutline"
          className="w-full mt-4"
        >
          Change Scan Type
        </Button>
      </CardContent>
    </Card>
  );

  // ─── RENDER: Check-In / Check-Out Selection ──────────────────────────────────
  const renderCheckInOutSelection = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <Camera className="mx-auto h-12 w-12 text-green-600 mb-4" />
        <CardTitle>Select Action</CardTitle>
        <p className="text-sm text-gray-600">
          QR code scanned successfully. What would you like to do?
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <p className="text-sm text-green-700 font-medium">
            ✅ QR Code Verified
          </p>
          <p className="text-xs text-green-600 mt-1">
            Please select the action below
          </p>
        </div>

        {/* Error message if check-out validation fails */}
        {scanResult === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        <div className="space-y-3">
          <Button
            onClick={() => scanMode === "speaker-ticket" ? handleSpeakerActionConfirm("CHECK_IN") : handleStallActionConfirm("CHECK_IN")}
            disabled={isProcessing}
            className="w-full bg-green-600 hover:bg-green-700 h-14 text-base"
          >
            {isProcessing && (stallAction === "CHECK_IN" || speakerAction === "CHECK_IN") ? (
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-5 w-5" />
            )}
            Check In
          </Button>

          <Button
            onClick={() => scanMode === "speaker-ticket" ? handleSpeakerActionConfirm("CHECK_OUT") : handleStallActionConfirm("CHECK_OUT")}
            disabled={isProcessing}
            className="w-full bg-orange-500 hover:bg-orange-600 h-14 text-base"
          >
            {isProcessing && (stallAction === "CHECK_OUT" || speakerAction === "CHECK_OUT") ? (
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-5 w-5" />
            )}
            Check Out
          </Button>
        </div>

        <Button
          onClick={() => {
            setPendingStallQR(null);
            setPendingSpeakerQR(null);
            setScanResult(null);
            setStep("scanning");
            startQRScanner();
          }}
          variant="buttonOutline"
          className="w-full"
        >
          Cancel & Rescan
        </Button>
      </CardContent>
    </Card>
  );

  // ─── RENDER: Success — Event Ticket ─────────────────────────────────────────
  const renderSuccessEventTicket = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-600 mb-4" />
        <CardTitle className="text-green-800">Attendance Marked!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ticketData && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="font-semibold text-green-800 mb-2">
              Event Ticket Details
            </h3>
            <div className="space-y-1 text-sm">
              <p>
                <strong>Ticket ID:</strong> {ticketData.ticketId}
              </p>
              <p>
                <strong>Customer:</strong> {ticketData.customerName}
              </p>
              <p>
                <strong>Email:</strong> {ticketData.customerEmail}
              </p>
              <p>
                <strong>Event:</strong> {ticketData.eventTitle}
              </p>
              <p>
                <strong>Amount:</strong> ${ticketData.totalAmount.toFixed(2)}
              </p>
              <p>
                <strong>Status:</strong>
                <span className="ml-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                  Checked In
                </span>
              </p>
            </div>
          </div>
        )}

        <Button onClick={resetScanner} className="w-full">
          Scan Another Ticket
        </Button>
      </CardContent>
    </Card>
  );

  // ─── RENDER: Success — Stall Ticket ─────────────────────────────────────────
  const renderSuccessStallTicket = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-600 mb-4" />
        <CardTitle className="text-green-800">
          {stallAction === "CHECK_OUT"
            ? "Stall Checked Out!"
            : "Stall Checked In!"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stallData && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 space-y-2 text-sm">
            <p>
              <strong>Shopkeeper:</strong> {stallData.shopkeeper.name}
            </p>
            <p>
              <strong>Business:</strong> {stallData.shopkeeper.shopName}
            </p>
            <p>
              <strong>Category:</strong> {stallData.shopkeeper.businessCategory}
            </p>
            <p>
              <strong>Event:</strong> {stallData.eventId.title}
            </p>
            <p>
              <strong>Action:</strong>
              <span
                className={`ml-1 px-2 py-1 rounded-full text-xs font-medium ${
                  stallAction === "CHECK_OUT"
                    ? "bg-orange-100 text-orange-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {stallAction === "CHECK_OUT" ? "Checked Out" : "Checked In"}
              </span>
            </p>

            {stallData.Tables?.length > 0 && (
              <div className="pt-2 border-t border-green-200">
                <p className="font-semibold mb-1">Tables:</p>
                {stallData.Tables.map((table) => (
                  <p key={table.tableId} className="text-xs text-gray-600">
                    {table.tableName} ({table.tableType}) — ${table.price}
                  </p>
                ))}
              </div>
            )}

            {stallData.AddOns?.length > 0 && (
              <div className="pt-2 border-t border-green-200">
                <p className="font-semibold mb-1">Add-Ons:</p>
                {stallData.AddOns.map((addOn) => (
                  <p key={addOn.addOnId} className="text-xs text-gray-600">
                    {addOn.name} x{addOn.quantity} — ${addOn.price}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <Button onClick={resetScanner} className="w-full">
          Scan Another Stall
        </Button>
      </CardContent>
    </Card>
  );

  // ─── MAIN RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mr-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">QR Scanner</h1>
            <p className="text-sm text-gray-600">
              {eventData?.title || "Loading event..."}
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800 mb-1">
                Security Notice
              </p>
              <p className="text-yellow-700">
                Only official EventSH QR codes can be scanned. Regular QR
                scanners will not work with our secure tickets.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {step === "otp-verification" && renderOTPVerification()}
        {step === "mode-selection" && renderModeSelection()}
        {step === "scanning" && renderScanner()}
        {step === "checkin-checkout-selection" && renderCheckInOutSelection()}
        {step === "success" &&
          scanMode === "event-ticket" &&
          renderSuccessEventTicket()}
        {step === "success" &&
          scanMode === "stall-ticket" &&
          renderSuccessStallTicket()}
        {step === "success" &&
          scanMode === "speaker-ticket" &&
          speakerData && (
            <Card className="w-full max-w-md mx-auto">
              <CardHeader className="text-center">
                <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-2" />
                <CardTitle className="text-green-700">
                  {speakerData.action === "CHECK_IN" ? "Speaker Checked In!" : "Speaker Checked Out!"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-2">
                  <p className="font-semibold text-purple-800">{speakerData.speakerName}</p>
                  {speakerData.sessions?.length > 0 && (
                    <p className="text-sm text-purple-600">Session: {speakerData.sessions[0].topic}</p>
                  )}
                  {speakerData.checkInTime && (
                    <p className="text-xs text-gray-600">Check-in: {new Date(speakerData.checkInTime).toLocaleString()}</p>
                  )}
                  {speakerData.checkOutTime && (
                    <p className="text-xs text-gray-600">Check-out: {new Date(speakerData.checkOutTime).toLocaleString()}</p>
                  )}
                  {speakerData.duration && (
                    <p className="text-xs text-gray-600">Duration: {speakerData.duration} minutes</p>
                  )}
                </div>
                <Button onClick={resetScanner} className="w-full">
                  Scan Another QR
                </Button>
              </CardContent>
            </Card>
          )}

        {/* ─── CHECK_OUT Confirmation Dialog ─────────────────────────────────── */}
        {showCheckOutConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  <CardTitle className="text-base">Confirm Check Out</CardTitle>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Are you sure you want to <strong>Check Out</strong> this
                  {scanMode === "speaker-ticket" ? " speaker" : " exhibitor"}? This action cannot be undone.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs text-orange-700 font-medium">
                    To confirm, type{" "}
                    <span className="font-bold tracking-widest">CHECK_OUT</span>{" "}
                    in the box below:
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Type CHECK_OUT to confirm"
                  value={checkOutConfirmInput}
                  onChange={(e) => {
                    setCheckOutConfirmInput(e.target.value);
                    setCheckOutConfirmError("");
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
                />

                {checkOutConfirmError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    {checkOutConfirmError}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="buttonOutline"
                    className="flex-1"
                    onClick={() => {
                      setShowCheckOutConfirmDialog(false);
                      setCheckOutConfirmInput("");
                      setCheckOutConfirmError("");
                      setStallAction(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                    onClick={handleCheckOutConfirm}
                    disabled={
                      checkOutConfirmInput.trim() !== "CHECK_OUT" ||
                      isProcessing
                    }
                  >
                    {isProcessing ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Confirm Check Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
