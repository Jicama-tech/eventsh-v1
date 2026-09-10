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
  Search,
} from "lucide-react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { jwtDecode } from "jwt-decode";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { OperatorVenueView } from "./OperatorVenueView";
import { t } from "@/i18n/t";

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
  // Assigned-seating events (features.hasSeating) don't get their own scan
  // mode — a seat is just an attribute of the regular ticket. Each line
  // item's ticketType already embeds the seat labels for a seat purchase
  // (e.g. "VIP (Seats A1, A2)"), so surfacing this list is how seating
  // shows up in the scanner: on the same Visitor Ticket success screen.
  ticketDetails?: {
    ticketType: string;
    quantity: number;
    price: number;
    seatIds?: string[];
  }[];
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

// One searchable exhibitor on the manual check-in list.
interface ManualRow {
  stallId: string;
  name: string;
  shopName: string;
  businessName: string;
  category: string;
  tables: string[];
  status: string;
  paymentStatus: string;
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  checkInTime?: string | null;
  checkOutTime?: string | null;
}

interface StallData {
  _id: string;
  action: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
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
  // Optional in practice: an event whose organizer was not populated by the
  // API arrives without it, and reading through it blank-screened the whole
  // scanner at a gate with no way back.
  organizer?: {
    whatsAppNumber?: string;
    organizationName?: string;
  };
  // Which modules this event actually has turned on — gates which scan
  // buttons show up below (no point offering to scan Speaker Passes on an
  // event with no speaker track). Seating has no scan button of its own:
  // assigned seats are just an attribute on the regular event ticket, so
  // they already surface via the Visitor Ticket scan.
  features?: {
    hasStalls?: boolean;
    hasSpeakers?: boolean;
    hasRoundTables?: boolean;
    hasWorkshops?: boolean;
    hasSeating?: boolean;
    hasScheduledSpaces?: boolean;
  };
}

type ScanMode =
  // Search-by-name check-in for a vendor who turned up without their ticket.
  // Not a camera mode — it shares this union so it slots into the same
  // mode-selection screen the volunteer already knows.
  | "manual-exhibitor"
  | "event-ticket"
  | "stall-ticket"
  | "speaker-ticket"
  | "round-table"
  | "workshop"
  | "scheduled-space"
  | null;
// What the volunteer is told while a scan is in flight. Without this the
// camera simply froze on the last frame during the round trip, which reads as
// "nothing happened" — so people re-present the badge and scan twice.
type ScanPhase = null | "reading" | "verifying" | "verified";

const SCAN_PHASE_COPY: Record<
  Exclude<ScanPhase, null>,
  { title: string; subtitle: string }
> = {
  reading: { title: "QR detected", subtitle: "Reading the code…" },
  verifying: { title: "Verifying…", subtitle: "Checking with the server" },
  verified: { title: "Verified", subtitle: "" },
};

type Step =
  | "otp-verification"
  | "mode-selection"
  | "scanning"
  | "checkin-checkout-selection"
  | "manual-search"
  | "success";

// Nest returns `message` as a plain string for thrown HttpExceptions but as an
// ARRAY of constraint strings for ValidationPipe rejections. Rendering the
// array straight into a toast produced "[object Object]"-grade noise on
// exactly the failures an operator most needs to read, so flatten both shapes.
const formatApiError = (body: unknown, fallback: string): string => {
  const b = (body ?? {}) as { message?: unknown; error?: unknown };
  const m = b.message ?? b.error;
  if (Array.isArray(m)) return m.filter(Boolean).join(", ") || fallback;
  if (typeof m === "string" && m.trim()) return m;
  return fallback;
};

export default function QRTicketScanner() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  // html5-qrcode keeps the onScanSuccess closure it was started with, so a
  // `isProcessing` state read inside it is frozen at false and never blocks
  // the next decoded frame (~10/sec). A ref is the only guard that actually
  // sees the update, so hold both: the ref gates re-entry, the state drives UI.
  const processingRef = useRef(false);
  // Guards against two concurrent startQRScanner() runs (see below).
  const startingRef = useRef(false);
  // Bumped whenever the operator abandons the current scan (Change Scan Type,
  // a new mode, Scan Another). An in-flight onScanSuccess captures the value
  // it started with and drops its result if it no longer matches, so a slow
  // request cannot land its UI updates onto a screen the operator has left.
  const scanGenerationRef = useRef(0);
  // Tracks the pending "restart the scanner" timer so a later success cannot
  // be clobbered by a timer queued by an earlier failure.
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRecoveryTimer = () => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  };

  // Every deferred recovery goes through here so only one can ever be armed.
  const scheduleRecovery = (fn: () => void, ms = 3000) => {
    clearRecoveryTimer();
    recoveryTimerRef.current = setTimeout(() => {
      recoveryTimerRef.current = null;
      fn();
    }, ms);
  };

  // States
  const [step, setStep] = useState<Step>("otp-verification");
  const [scanMode, setScanMode] = useState<ScanMode>(null);

  // Dev-only escape hatch used by the build-guide screenshot script. Lets
  // Puppeteer skip the volunteer email-OTP gate by setting
  // window.__guideBypass.skipVolunteerOtp before navigation. Gated on
  // import.meta.env.DEV so it's a no-op in any production build.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const bypass = (window as any).__guideBypass;
    if (!bypass) return;
    if (bypass.skipVolunteerOtp) setStep("mode-selection");
  }, []);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [stallData, setStallData] = useState<StallData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<"success" | "error" | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [scanPhase, setScanPhase] = useState<ScanPhase>(null);

  // Manual check-in: the exhibitor list a volunteer searches when someone
  // arrives without a ticket.
  const [manualQuery, setManualQuery] = useState("");
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualBusyId, setManualBusyId] = useState<string | null>(null);

  // Hold the "Verified" beat long enough to register before the next screen
  // replaces it. Short enough that a queue does not build behind it.
  const showVerified = async () => {
    setScanPhase("verified");
    await new Promise((r) => setTimeout(r, 700));
  };

  // Single writer for the processing flag: the ref is what the frozen
  // html5-qrcode callback can actually read, the state is what re-renders.
  const setProcessing = (v: boolean) => {
    processingRef.current = v;
    setIsProcessing(v);
  };
  const [pendingStallQR, setPendingStallQR] = useState<string | null>(null);
  const [stallAction, setStallAction] = useState<
    "CHECK_IN" | "CHECK_OUT" | null
  >(null);

  const [pendingSpeakerQR, setPendingSpeakerQR] = useState<string | null>(null);
  const [speakerData, setSpeakerData] = useState<any>(null);
  const [speakerAction, setSpeakerAction] = useState<"CHECK_IN" | "CHECK_OUT" | null>(null);

  const [pendingRoundTableQR, setPendingRoundTableQR] = useState<string | null>(null);
  const [roundTableData, setRoundTableData] = useState<any>(null);
  const [roundTableAction, setRoundTableAction] = useState<"CHECK_IN" | "CHECK_OUT" | null>(null);

  // Workshops and Scheduled Spaces are single-stage — attended once, no
  // check-in/check-out selection screen, so there's no "pending QR" +
  // separate action-confirm step like stalls/speakers/round tables above.
  const [workshopData, setWorkshopData] = useState<any>(null);
  const [scheduledSpaceData, setScheduledSpaceData] = useState<any>(null);

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

  // Volunteer sign-in is Google-only via an OAuth *redirect* flow. The backend
  // verifies the Gmail against the event's volunteer list and returns a JWT in
  // the callback URL; we persist it (localStorage) so the session survives a
  // page refresh — the volunteer lands straight back on the scanner.
  const [volunteer, setVolunteer] = useState<{
    name?: string;
    email?: string;
  } | null>(null);

  const volunteerTokenKey = `eventsh_volunteer_token_${eventId || ""}`;

  // The volunteer JWT, for requests that record WHO performed an action.
  // Read at call time rather than from state so a token restored on this same
  // render is still picked up.
  // True when a JWT is past its exp. An expired token is worse than none
  // here: the scan still succeeds, but the server cannot read a name from it,
  // so the check-in is filed under "Gate scanner" and the volunteer never
  // finds out their attribution stopped working.
  const isExpired = (tok: string): boolean => {
    try {
      const { exp } = jwtDecode<{ exp?: number }>(tok);
      return !!exp && exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  };

  const authHeaders = (): Record<string, string> => {
    try {
      // Volunteer token first (this screen's own sign-in); fall back to an
      // organizer session, matching how OperatorVenueView authenticates, so
      // the scanner works for either kind of user.
      const tok =
        localStorage.getItem(volunteerTokenKey) ||
        sessionStorage.getItem("token");
      if (!tok || isExpired(tok)) return {};
      return { Authorization: `Bearer ${tok}` };
    } catch {
      return {};
    }
  };

  // Called before any scan that records who performed it. Rather than let the
  // scan through unattributed, stop and send the volunteer back to sign-in.
  const requireLiveSession = (): boolean => {
    let tok: string | null = null;
    try {
      tok = localStorage.getItem(volunteerTokenKey);
    } catch {
      tok = null;
    }
    // No volunteer token at all is fine — an organizer may be scanning from
    // their own session, which authHeaders() falls back to.
    if (!tok) return true;
    if (!isExpired(tok)) return true;
    toast({
      duration: 6000,
      title: "Session expired",
      description:
        "Your volunteer sign-in has expired. Sign in again so check-ins are recorded under your name.",
      variant: "destructive",
    });
    signOutVolunteer();
    return false;
  };

  const startVolunteerGoogleLogin = () => {
    window.location.href = `${apiURL}/events/volunteer-google?eventId=${encodeURIComponent(
      eventId || "",
    )}`;
  };

  const signOutVolunteer = () => {
    try {
      localStorage.removeItem(volunteerTokenKey);
    } catch {
      /* ignore */
    }
    setVolunteer(null);
    setScanMode(null);
    setStep("otp-verification");
  };

  // Leaving the scanner ends the volunteer session rather than just navigating
  // away. The token is per-device and outlives the visit, so keeping it would
  // let whoever picks the phone up next scan as the previous volunteer — and
  // that name is what lands on the exhibitor's attendance timeline.
  //
  // Two steps back, not one: the Google sign-in redirects out to the provider
  // and back, so its return leaves an extra entry and a single step lands on
  // the scanner again. When the history is too shallow for that (the link was
  // opened directly), fall back to "/" — which resolves to the dashboard for a
  // signed-in user and the landing page otherwise.
  const handleExitScanner = () => {
    clearRecoveryTimer();
    setScanPhase(null);
    setProcessing(false);
    if (qrCodeRef.current) {
      const inst = qrCodeRef.current;
      qrCodeRef.current = null;
      try {
        void inst.stop()?.catch(() => {});
      } catch {
        /* never started */
      }
    }
    signOutVolunteer();

    const canGoBackTwice =
      typeof window !== "undefined" && window.history.length > 2;
    if (canGoBackTwice) {
      navigate(-2);
    } else {
      navigate("/", { replace: true });
    }
  };

  // On load: pick up the JWT the OAuth callback left in the URL (?vtoken), or
  // restore a still-valid one saved from a previous visit, so a refresh keeps
  // the volunteer signed in instead of bouncing them back to the login screen.
  useEffect(() => {
    if (!eventId) return;
    const params = new URLSearchParams(window.location.search);
    const vtoken = params.get("vtoken");
    const verror = params.get("verror");
    const clearQuery = () =>
      window.history.replaceState({}, "", `/events/${eventId}/scan-tickets`);

    if (verror) {
      toast({
        duration: 6000,
        title: "Sign-in failed",
        description: verror,
        variant: "destructive",
      });
      clearQuery();
      return;
    }

    if (vtoken) {
      try {
        localStorage.setItem(volunteerTokenKey, vtoken);
        const p: any = jwtDecode(vtoken);
        setVolunteer({ name: p?.name, email: p?.email });
      } catch {
        /* ignore decode errors */
      }
      setStep("mode-selection");
      clearQuery();
      toast({
        duration: 4000,
        title: "Welcome",
        description: "You're signed in as a volunteer.",
      });
      return;
    }

    // Restore a previous session if the saved token is still valid.
    try {
      const saved = localStorage.getItem(volunteerTokenKey);
      if (saved) {
        const p: any = jwtDecode(saved);
        const expired = p?.exp && p.exp * 1000 < Date.now();
        const wrongEvent = p?.eventId && p.eventId !== eventId;
        if (expired || wrongEvent) {
          localStorage.removeItem(volunteerTokenKey);
        } else {
          setVolunteer({ name: p?.name, email: p?.email });
          setStep("mode-selection");
        }
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Select scan mode and proceed to scanning
  const handleModeSelection = (mode: ScanMode) => {
    clearRecoveryTimer();
    scanGenerationRef.current++;
    setScanPhase(null);
    setProcessing(false);
    setScanMode(mode);
    if (mode === "manual-exhibitor") {
      setManualQuery("");
      setManualRows([]);
      setStep("manual-search");
      void loadManualRows("");
      return;
    }
    setStep("scanning");
  };

  // Initialize QR Scanner
  useEffect(() => {
    if (step === "scanning") {
      startQRScanner();
    }
    return () => {
      clearRecoveryTimer();
      // html5-qrcode throws a raw string synchronously when the scanner was
      // never started, and rejects when it is still mid-start — both escape
      // React's commit phase and blank the page. Null the ref first so a
      // concurrent start cannot adopt a dying instance.
      const inst = qrCodeRef.current;
      qrCodeRef.current = null;
      if (inst) {
        try {
          void inst.stop()?.catch(() => {});
        } catch {
          /* never started */
        }
      }
    };
  }, [step]);

  const startQRScanner = async () => {
    // Set synchronously, before any await: two callers can otherwise both pass
    // the teardown below while the first is suspended on getUserMedia, start
    // two Html5Qrcode instances on the same element, and orphan one with a
    // live camera stream the teardown can no longer see.
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      // Tear down any live instance before attaching a new one. This used to
      // overwrite qrCodeRef and orphan the previous camera: the abandoned
      // instance kept decoding into the stale callback, and a shift's worth of
      // "Cancel & Rescan" taps exhausted the device's camera resources.
      if (qrCodeRef.current) {
        try {
          await qrCodeRef.current.stop();
        } catch {
          /* already stopped */
        }
        qrCodeRef.current = null;
      }

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
    } finally {
      startingRef.current = false;
    }
  };

  const loadManualRows = async (q: string) => {
    if (!eventId) return;
    setManualLoading(true);
    try {
      const res = await fetch(
        `${apiURL}/stalls/event/${eventId}/manual-attendance${
          q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""
        }`,
        { headers: authHeaders() },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatApiError(body, "Could not load exhibitors"));
      }
      setManualRows(body.data || []);
    } catch (e: unknown) {
      toast({
        duration: 5000,
        title: "Could not load exhibitors",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
      setManualRows([]);
    } finally {
      setManualLoading(false);
    }
  };

  const manualAttendance = async (
    row: ManualRow,
    action: "CHECK_IN" | "CHECK_OUT",
  ) => {
    if (!requireLiveSession()) return;
    setManualBusyId(row.stallId);
    try {
      const res = await fetch(
        `${apiURL}/stalls/${row.stallId}/manual-attendance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ action }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatApiError(body, "Could not update attendance"));
      }
      toast({
        duration: 5000,
        title: action === "CHECK_IN" ? "Checked in" : "Checked out",
        description: `${row.shopName || row.businessName || row.name} — recorded without a QR.`,
      });
      // Re-read rather than patching locally: the server is the authority on
      // whether the transition actually applied, and another volunteer may
      // have moved this booking in the meantime.
      await loadManualRows(manualQuery);
    } catch (e: unknown) {
      toast({
        duration: 6000,
        title: "Could not update",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setManualBusyId(null);
    }
  };

  // Handle successful QR scan
  const onScanSuccess = async (decodedText: string, decodedResult: any) => {
    if (processingRef.current) return;

    const gen = scanGenerationRef.current;
    const abandoned = () => gen !== scanGenerationRef.current;

    setScanPhase("reading");
    setProcessing(true);

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
      } else if (scanMode === "round-table") {
        await handleRoundTableScan(decodedText);
      } else if (scanMode === "workshop") {
        await handleWorkshopScan(decodedText);
      } else if (scanMode === "scheduled-space") {
        await handleScheduledSpaceScan(decodedText);
      }
    } catch (error) {
      console.error("Error processing QR code:", error);
      // The operator has already moved on — do not drag them back to an error
      // screen for a scan they abandoned.
      if (abandoned()) return;
      setScanPhase(null);
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

      scheduleRecovery(() => {
        setScanResult(null);
        setProcessing(false);
        startQRScanner();
      });
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

    setScanPhase("verifying");
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
      { method: "PATCH", headers: authHeaders() },
    );

    if (!attendanceResponse.ok) {
      const errorData = await attendanceResponse.json().catch(() => ({}));
      throw new Error(formatApiError(errorData, "Failed to mark attendance"));
    }

    await showVerified();
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

    // Save the raw QR text and go to selection screen. No server round trip
    // here — the payload is checked locally — so confirm it read cleanly
    // before handing over to the action choice.
    await showVerified();
    setPendingStallQR(decodedText);
    setProcessing(false);
    setScanPhase(null);
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
    } else if (scanMode === "round-table") {
      await processRoundTableAction("CHECK_OUT");
    } else {
      await processStallAction("CHECK_OUT");
    }
  };

  // Core function that calls the API after action is decided
  const processStallAction = async (action: "CHECK_IN" | "CHECK_OUT") => {
    if (!pendingStallQR) return;
    if (!requireLiveSession()) return;
    clearRecoveryTimer();
    setScanPhase("verifying");
    setProcessing(true);
    setStallAction(action);

    try {
      const qrData = JSON.parse(pendingStallQR);

      // Reject a badge from another event BEFORE the mutating POST. This used
      // to be checked on the response, by which point the exhibitor had
      // already been checked in/out on the wrong event.
      const qrEventId = String(qrData.eventId || "");
      if (qrEventId && qrEventId !== String(eventId)) {
        throw new Error("This stall is not for this event");
      }

      // The backend owns the state check: it applies the transition as a
      // single conditional write and returns the precise reason when the
      // booking is not in the expected state. Pre-flighting it here with a
      // separate GET only added a check-then-act gap two operators could race
      // through.
      const stallResponse = await fetch(`${apiURL}/stalls/scan-qr`, {
        method: "POST",
        // The volunteer token rides along so the backend can record who ran
        // this check-in/check-out on the exhibitor's Status History timeline.
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ qrCodeData: pendingStallQR, action }),
      });

      if (!stallResponse.ok) {
        const errorData = await stallResponse.json().catch(() => ({}));
        throw new Error(
          formatApiError(errorData, "Failed to process stall QR"),
        );
      }

      const stallInfo = await stallResponse.json();

      const scannedEventId = String(
        stallInfo.data?.eventId?._id || stallInfo.data?.eventId || "",
      );
      if (scannedEventId && scannedEventId !== String(eventId)) {
        throw new Error("This stall is not for this event");
      }

      await showVerified();
      setStallData(stallInfo.data);
      setScanResult("success");
      setStep("success");

      toast({
        duration: 5000,
        title: "Success!",
        description: `${action === "CHECK_IN" ? "Checked In" : "Checked Out"} successfully for ${stallInfo.data.shopkeeper?.name}`,
      });
    } catch (error: any) {
      // Clear the phase first — otherwise the screen sits on
      // "Verifying…" forever behind the error toast.
      setScanPhase(null);
      setErrorMessage(error.message || "Failed to process stall QR");
      setScanResult("error");
      toast({
        duration: 5000,
        title: "Error",
        description: error.message,
        variant: "destructive",
      });

      // Go back to selection so user can retry
      // Routed through scheduleRecovery so a retry that succeeds inside the
      // 3s window is not dragged back to the selection screen by this timer.
      scheduleRecovery(() => {
        setScanResult(null);
        setProcessing(false);
        setStep("checkin-checkout-selection");
      });
    } finally {
      setProcessing(false);
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

    await showVerified();
    setPendingSpeakerQR(decodedText);
    setProcessing(false);
    setScanPhase(null);
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
    clearRecoveryTimer();
    setScanPhase("verifying");
    setProcessing(true);
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
        const errorData = await scanRes.json().catch(() => ({}));
        throw new Error(formatApiError(errorData, "Failed to process speaker QR"));
      }

      const scanInfo = await scanRes.json();

      await showVerified();
      setSpeakerData(scanInfo.data);
      setScanResult("success");
      setStep("success");

      toast({
        duration: 5000,
        title: "Success!",
        description: `${action === "CHECK_IN" ? "Checked In" : "Checked Out"} successfully for ${scanInfo.data.speakerName}`,
      });
    } catch (error: any) {
      // Clear the phase first — otherwise the screen sits on
      // "Verifying…" forever behind the error toast.
      setScanPhase(null);
      setErrorMessage(error.message || "Failed to process speaker QR");
      setScanResult("error");
      toast({
        duration: 5000,
        title: "Error",
        description: error.message,
        variant: "destructive",
      });

      // Routed through scheduleRecovery so a retry that succeeds inside the
      // 3s window is not dragged back to the selection screen by this timer.
      scheduleRecovery(() => {
        setScanResult(null);
        setProcessing(false);
        setStep("checkin-checkout-selection");
      });
    } finally {
      setProcessing(false);
    }
  };

  // Handle Round Table QR Scan
  const handleRoundTableScan = async (decodedText: string) => {
    const qrData = JSON.parse(decodedText);

    if (!qrData.type || qrData.type !== "eventsh-roundtable-checkin") {
      throw new Error("Invalid round table QR code. This QR is not from EventSH.");
    }

    if (!qrData.bookingId) {
      throw new Error("Invalid QR code format. Missing booking ID.");
    }

    await showVerified();
    setPendingRoundTableQR(decodedText);
    setProcessing(false);
    setScanPhase(null);
    setStep("checkin-checkout-selection");
  };

  const handleRoundTableActionConfirm = async (action: "CHECK_IN" | "CHECK_OUT") => {
    if (!pendingRoundTableQR) return;

    if (action === "CHECK_OUT") {
      setRoundTableAction("CHECK_OUT");
      setCheckOutConfirmInput("");
      setCheckOutConfirmError("");
      setShowCheckOutConfirmDialog(true);
      return;
    }

    await processRoundTableAction("CHECK_IN");
  };

  const processRoundTableAction = async (action: "CHECK_IN" | "CHECK_OUT") => {
    if (!pendingRoundTableQR) return;
    clearRecoveryTimer();
    setScanPhase("verifying");
    setProcessing(true);
    setRoundTableAction(action);

    try {
      const qrData = JSON.parse(pendingRoundTableQR);

      // Validate state
      const checkRes = await fetch(`${apiURL}/round-table-bookings/${qrData.bookingId}`);
      const checkData = await checkRes.json();
      const booking = checkData.data;

      if (action === "CHECK_IN" && booking.hasCheckedIn) {
        throw new Error("This visitor has already checked in.");
      }
      if (action === "CHECK_OUT" && !booking.hasCheckedIn) {
        throw new Error("This visitor has not checked in yet.");
      }
      if (action === "CHECK_OUT" && booking.hasCheckedOut) {
        throw new Error("This visitor has already checked out.");
      }

      const scanRes = await fetch(`${apiURL}/round-table-bookings/scan-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeData: pendingRoundTableQR }),
      });

      if (!scanRes.ok) {
        const errorData = await scanRes.json().catch(() => ({}));
        throw new Error(
          formatApiError(errorData, "Failed to process round table QR"),
        );
      }

      const scanInfo = await scanRes.json();

      await showVerified();
      setRoundTableData(scanInfo.data);
      setScanResult("success");
      setStep("success");

      toast({
        duration: 5000,
        title: "Success!",
        description: `${action === "CHECK_IN" ? "Checked In" : "Checked Out"} successfully for ${scanInfo.data.visitorName}`,
      });
    } catch (error: any) {
      // Clear the phase first — otherwise the screen sits on
      // "Verifying…" forever behind the error toast.
      setScanPhase(null);
      setErrorMessage(error.message || "Failed to process round table QR");
      setScanResult("error");
      toast({
        duration: 5000,
        title: "Error",
        description: error.message,
        variant: "destructive",
      });

      // Routed through scheduleRecovery so a retry that succeeds inside the
      // 3s window is not dragged back to the selection screen by this timer.
      scheduleRecovery(() => {
        setScanResult(null);
        setProcessing(false);
        setStep("checkin-checkout-selection");
      });
    } finally {
      setProcessing(false);
    }
  };

  // Handle Workshop QR Scan — single-stage (a workshop is attended once), so
  // this scans straight to success like the visitor ticket flow, no
  // check-in/check-out selection screen. The backend itself treats a repeat
  // scan as a graceful "already checked in" success rather than an error.
  const handleWorkshopScan = async (decodedText: string) => {
    const qrData = JSON.parse(decodedText);

    if (!qrData.type || qrData.type !== "eventsh-workshop-checkin") {
      throw new Error("Invalid workshop QR code. This QR is not from EventSH.");
    }
    if (!qrData.bookingId) {
      throw new Error("Invalid QR code format. Missing booking ID.");
    }

    setScanPhase("verifying");
    const res = await fetch(`${apiURL}/workshop-bookings/scan-qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrCodeData: decodedText }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(formatApiError(errorData, "Failed to process workshop QR"));
    }

    const info = await res.json();
    await showVerified();
    setWorkshopData(info.data);
    setScanResult("success");
    setStep("success");

    toast({
      duration: 5000,
      title:
        info.data.action === "ALREADY_CHECKED_IN"
          ? "Already checked in"
          : "Success!",
      description: `${info.data.visitorName} — ${info.data.itemName}`,
    });
  };

  // Handle Scheduled Space QR Scan — also single-stage. Unlike Workshops, a
  // repeat scan here is a hard error from the backend ("Already checked
  // in."), so it falls through to the generic error handling in
  // onScanSuccess like the visitor-ticket / round-table flows do.
  const handleScheduledSpaceScan = async (decodedText: string) => {
    const qrData = JSON.parse(decodedText);

    if (!qrData.type || qrData.type !== "eventsh-scheduled-space-checkin") {
      throw new Error(
        "Invalid scheduled space QR code. This QR is not from EventSH.",
      );
    }
    if (!qrData.requestId) {
      throw new Error("Invalid QR code format. Missing request ID.");
    }

    setScanPhase("verifying");
    const res = await fetch(`${apiURL}/scheduled-spaces/scan-qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrCodeData: decodedText }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(
        formatApiError(errorData, "Failed to process scheduled space QR"),
      );
    }

    const info = await res.json();
    await showVerified();
    setScheduledSpaceData(info.data);
    setScanResult("success");
    setStep("success");

    toast({
      duration: 5000,
      title: "Success!",
      description: `Checked in: ${info.data.name}`,
    });
  };

  const onScanFailure = (error: any) => {
    // Ignore scan failures (normal when no QR code is detected)
  };

  const resetScanner = () => {
    clearRecoveryTimer();
    scanGenerationRef.current++;
    setScanPhase(null);
    setScanResult(null);
    setTicketData(null);
    setStallData(null);
    setSpeakerData(null);
    setPendingSpeakerQR(null);
    setSpeakerAction(null);
    setRoundTableData(null);
    setPendingRoundTableQR(null);
    setRoundTableAction(null);
    setWorkshopData(null);
    setScheduledSpaceData(null);
    setErrorMessage("");
    setProcessing(false);
    setPendingStallQR(null);
    setStallAction(null);
    setShowCheckOutConfirmDialog(false);
    setCheckOutConfirmInput("");
    setCheckOutConfirmError("");
    setStep("scanning");
  };

  const handleBackToModeSelection = () => {
    clearRecoveryTimer();
    scanGenerationRef.current++;
    setProcessing(false);
    setScanMode(null);
    setStep("mode-selection");
  };

  // ─── RENDER: OTP Verification ───────────────────────────────────────────────
  const renderOTPVerification = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <Shield className="mx-auto h-12 w-12 text-blue-600 mb-4" />
        <CardTitle>{t("Volunteer Sign-In")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in with the Google account (Gmail) the organizer added to this
          event's volunteer list.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {eventData && (
          <div className="bg-muted p-4 rounded-lg">
            <p className="font-medium">{eventData.title}</p>
            <p className="text-sm text-muted-foreground">
              {eventData.organizer?.organizationName || ""}
            </p>
          </div>
        )}

        {/* Google sign-in via OAuth redirect, gated on the event's whitelisted
            Gmail volunteer list. */}
        <div className="space-y-2">
          <Button
            onClick={startVolunteerGoogleLogin}
            disabled={!eventId}
            variant="buttonOutline"
            className="w-full"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            Continue with Google
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Only Gmail IDs on this event's volunteer list can sign in.
          </p>
        </div>

      </CardContent>
    </Card>
  );

  // ─── RENDER: Mode Selection ──────────────────────────────────────────────────
  const renderModeSelection = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <Camera className="mx-auto h-12 w-12 text-blue-600 mb-4" />
        <CardTitle>{t("Select Scan Type")}</CardTitle>
        <p className="text-sm text-muted-foreground">Choose what you want to scan</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {eventData && (
          <div className="bg-muted p-4 rounded-lg">
            <p className="font-medium">{eventData.title}</p>
            <p className="text-sm text-muted-foreground">
              {eventData.organizer?.organizationName || ""}
            </p>
          </div>
        )}

        {/* Signed-in volunteer banner + sign out. */}
        {volunteer && (
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="truncate text-sm font-medium">
                {volunteer.name || volunteer.email}
              </p>
            </div>
            <Button
              onClick={signOutVolunteer}
              variant="buttonOutline"
              className="h-8 px-3 text-xs"
            >
              Sign out
            </Button>
          </div>
        )}

        {/* Only offer to scan what this event actually has turned on — a
            module's checkbox in the organizer's event setup (Stalls,
            Speakers, Round Tables, Workshops, Scheduled Spaces). Visitor
            Ticket always shows: every event sells tickets, and assigned
            seating (if enabled) is just an attribute on that same ticket,
            not a separate scan type. While the event is still loading,
            only Visitor Ticket shows — the rest populate once it's in. */}
        <div className="space-y-3">
          <Button
            onClick={() => handleModeSelection("event-ticket")}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Camera className="mr-2 h-4 w-4" />
            Visitor Ticket
          </Button>
          {eventData?.features?.hasStalls && (
            <Button
              onClick={() => handleModeSelection("stall-ticket")}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Camera className="mr-2 h-4 w-4" />
              Exhibitor Ticket
            </Button>
          )}
          {eventData?.features?.hasStalls && (
            <Button
              onClick={() => handleModeSelection("manual-exhibitor")}
              variant="buttonOutline"
              className="w-full"
            >
              <Search className="mr-2 h-4 w-4" />
              Exhibitor — No Ticket (search by name)
            </Button>
          )}
          {eventData?.features?.hasSpeakers && (
            <Button
              onClick={() => handleModeSelection("speaker-ticket")}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              <Camera className="mr-2 h-4 w-4" />
              Speaker Pass
            </Button>
          )}
          {eventData?.features?.hasRoundTables && (
            <Button
              onClick={() => handleModeSelection("round-table")}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              <Camera className="mr-2 h-4 w-4" />
              Round Table Ticket
            </Button>
          )}
          {eventData?.features?.hasWorkshops && (
            <Button
              onClick={() => handleModeSelection("workshop")}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              <Camera className="mr-2 h-4 w-4" />
              Workshop Pass
            </Button>
          )}
          {eventData?.features?.hasScheduledSpaces && (
            <Button
              onClick={() => handleModeSelection("scheduled-space")}
              className="w-full bg-rose-600 hover:bg-rose-700"
            >
              <Camera className="mr-2 h-4 w-4" />
              Scheduled Space
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // ─── RENDER: QR Scanner ──────────────────────────────────────────────────────
  const SCAN_MODE_COPY: Record<
    Exclude<ScanMode, null>,
    { title: string; subtitle: string }
  > = {
    "event-ticket": {
      title: "Scan Event Ticket",
      subtitle: "Point your camera at the attendee's ticket QR code",
    },
    "stall-ticket": {
      title: "Scan Stall Ticket",
      subtitle: "Point your camera at the shopkeeper's stall QR code",
    },
    "speaker-ticket": {
      title: "Scan Speaker Pass",
      subtitle: "Point your camera at the speaker's pass QR code",
    },
    "round-table": {
      title: "Scan Round Table Ticket",
      subtitle: "Point your camera at the round table ticket QR code",
    },
    workshop: {
      title: "Scan Workshop Pass",
      subtitle: "Point your camera at the attendee's workshop QR code",
    },
    "scheduled-space": {
      title: "Scan Scheduled Space Ticket",
      subtitle: "Point your camera at the booking's QR code",
    },
    "manual-exhibitor": {
      title: "Manual Check-In / Out",
      subtitle: "Find an exhibitor by brand, business or name",
    },
  };
  // ─── RENDER: Manual Check-In / Out ──────────────────────────────────────────
  // For the vendor who left their ticket at the hotel. Search what they can
  // actually tell you at a gate — the brand over the stand, the registered
  // business, their own name, or the table number — then act on the row.
  const renderManualSearch = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <Search className="mx-auto h-12 w-12 text-green-600 mb-4" />
        <CardTitle>{t("Manual Check-In / Out")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          No ticket? Find the exhibitor by name and check them in.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadManualRows(manualQuery);
          }}
          className="flex gap-2"
        >
          <Input
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            placeholder="Brand, business, name or table"
            autoFocus
          />
          <Button type="submit" disabled={manualLoading}>
            {manualLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </form>

        {manualLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
            Loading exhibitors…
          </div>
        ) : manualRows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {manualQuery.trim()
              ? "No exhibitor matches that."
              : "No exhibitors on this event yet."}
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {manualRows.map((r) => {
              const busy = manualBusyId === r.stallId;
              const title = r.shopName || r.businessName || r.name || "Exhibitor";
              return (
                <div
                  key={r.stallId}
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div>
                    <p className="font-medium text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[r.name, r.businessName !== title ? r.businessName : "", r.tables.join(", ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        r.hasCheckedOut
                          ? "bg-orange-100 text-orange-800"
                          : r.hasCheckedIn
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {r.hasCheckedOut
                        ? "Checked out"
                        : r.hasCheckedIn
                          ? "Checked in"
                          : "Not arrived"}
                    </span>
                    <div className="flex gap-2">
                      {!r.hasCheckedIn && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={busy}
                          onClick={() => manualAttendance(r, "CHECK_IN")}
                        >
                          {busy ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Check In"
                          )}
                        </Button>
                      )}
                      {r.hasCheckedIn && !r.hasCheckedOut && (
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600"
                          disabled={busy}
                          onClick={() => manualAttendance(r, "CHECK_OUT")}
                        >
                          {busy ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Check Out"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button
          onClick={handleBackToModeSelection}
          variant="buttonOutline"
          className="w-full"
        >
          Change Scan Type
        </Button>
      </CardContent>
    </Card>
  );

  const renderScanner = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <Camera className="mx-auto h-12 w-12 text-green-600 mb-4" />
        <CardTitle>
          {scanMode ? SCAN_MODE_COPY[scanMode].title : "Scan QR Code"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {scanMode
            ? SCAN_MODE_COPY[scanMode].subtitle
            : "Point your camera at the QR code"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div
            id="qr-reader"
            className="w-full rounded-lg overflow-hidden border-2 border-dashed border-border"
            style={{ minHeight: "300px" }}
          />

          {(isProcessing || scanPhase) && scanResult !== "error" && (
            <div
              className={`absolute inset-0 flex items-center justify-center rounded-lg ${
                scanPhase === "verified"
                  ? "bg-green-50 bg-opacity-95"
                  : "bg-background bg-opacity-90"
              }`}
            >
              <div className="text-center px-4">
                {scanPhase === "verified" ? (
                  <>
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                    <p className="text-base font-semibold text-green-800">
                      {SCAN_PHASE_COPY.verified.title}
                    </p>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                    <p className="text-sm font-medium">
                      {scanPhase
                        ? SCAN_PHASE_COPY[scanPhase].title
                        : "Processing…"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {scanPhase ? SCAN_PHASE_COPY[scanPhase].subtitle : ""}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {scanResult === "error" && (
            <div className="absolute inset-0 bg-red-50 bg-opacity-95 flex items-center justify-center rounded-lg">
              <div className="text-center p-4">
                <XCircle className="h-12 w-12 text-red-600 mx-auto mb-2" />
                <p className="font-medium text-red-800">Scan Failed</p>
                <p className="text-sm text-red-600 mb-3">{errorMessage}</p>
                <p className="text-xs text-muted-foreground">Restarting scanner...</p>
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
  // Only these three modes have a two-stage check-in/check-out flow; the
  // others are single-stage and must never reach this screen's handlers.
  const confirmActionForMode = (action: "CHECK_IN" | "CHECK_OUT") => {
    if (scanMode === "speaker-ticket") return handleSpeakerActionConfirm(action);
    if (scanMode === "round-table") return handleRoundTableActionConfirm(action);
    if (scanMode === "stall-ticket") return handleStallActionConfirm(action);
    // Nothing pending for this mode — fall back to a clean rescan rather than
    // silently doing nothing.
    return handleBackToModeSelection();
  };

  const renderCheckInOutSelection = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <Camera className="mx-auto h-12 w-12 text-green-600 mb-4" />
        <CardTitle>{t("Select Action")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          QR code scanned successfully. What would you like to do?
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {scanPhase === "verifying" || scanPhase === "verified" ? (
          <div
            className={`rounded-lg p-3 text-center border ${
              scanPhase === "verified"
                ? "bg-green-50 border-green-200"
                : "bg-blue-50 border-blue-200"
            }`}
          >
            {scanPhase === "verified" ? (
              <p className="text-sm text-green-700 font-medium flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {SCAN_PHASE_COPY.verified.title}
              </p>
            ) : (
              <>
                <p className="text-sm text-blue-700 font-medium flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {SCAN_PHASE_COPY.verifying.title}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {SCAN_PHASE_COPY.verifying.subtitle}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-sm text-green-700 font-medium">
              ✅ QR Code Verified
            </p>
            <p className="text-xs text-green-600 mt-1">
              Please select the action below
            </p>
          </div>
        )}

        {/* Error message if check-out validation fails */}
        {scanResult === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        <div className="space-y-3">
          <Button
            onClick={() => confirmActionForMode("CHECK_IN")}
            disabled={isProcessing}
            className="w-full bg-green-600 hover:bg-green-700 h-14 text-base"
          >
            {isProcessing && (stallAction === "CHECK_IN" || speakerAction === "CHECK_IN" || roundTableAction === "CHECK_IN") ? (
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-5 w-5" />
            )}
            Check In
          </Button>

          <Button
            onClick={() => confirmActionForMode("CHECK_OUT")}
            disabled={isProcessing}
            className="w-full bg-orange-500 hover:bg-orange-600 h-14 text-base"
          >
            {isProcessing && (stallAction === "CHECK_OUT" || speakerAction === "CHECK_OUT" || roundTableAction === "CHECK_OUT") ? (
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-5 w-5" />
            )}
            Check Out
          </Button>
        </div>

        <Button
          onClick={() => {
            // Clear every pending payload, not just stall/speaker — a
            // left-behind pendingRoundTableQR made the next Check-In act on
            // the previously scanned badge.
            setPendingStallQR(null);
            setPendingSpeakerQR(null);
            setPendingRoundTableQR(null);
            setStallAction(null);
            setSpeakerAction(null);
            setRoundTableAction(null);
            setErrorMessage("");
            setScanResult(null);
            // No startQRScanner() here: the [step] effect owns startup and
            // fires on the transition into "scanning". Calling it inline as
            // well started a second camera on the same element.
            setStep("scanning");
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
        <CardTitle className="text-green-800">{t("Attendance Marked!")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ticketData && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="font-semibold text-green-800 mb-2">{t("Event Ticket Details")}</h3>
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
              {/* Assigned-seating events: each line item's type already
                  reads e.g. "VIP (Seats A1, A2)" — this is how the volunteer
                  sees which seat(s) to point the visitor to. */}
              {ticketData.ticketDetails?.length ? (
                <div className="pt-2 border-t border-green-200">
                  <p className="font-semibold mb-1">Tickets:</p>
                  {ticketData.ticketDetails.map((d, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {d.ticketType} × {d.quantity}
                    </p>
                  ))}
                </div>
              ) : null}
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
  // Label the card from the action the SERVER performed, not from the button
  // the operator pressed. The two can disagree — another gate may have moved
  // the exhibitor first — and showing the intent would tell the operator the
  // opposite of what actually happened.
  const renderSuccessStallTicket = () => {
    const stallOutcome = stallData?.action || stallAction;
    return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-600 mb-4" />
        <CardTitle className="text-green-800">
          {stallOutcome === "CHECK_OUT"
            ? "Stall Checked Out!"
            : "Stall Checked In!"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stallData && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 space-y-2 text-sm">
            <p>
              <strong>Shopkeeper:</strong> {stallData.shopkeeper?.name || "—"}
            </p>
            <p>
              <strong>Business:</strong> {stallData.shopkeeper?.shopName || "—"}
            </p>
            <p>
              <strong>Category:</strong>{" "}
              {stallData.shopkeeper?.businessCategory || "—"}
            </p>
            <p>
              <strong>Event:</strong> {stallData.eventId?.title || "—"}
            </p>
            {stallOutcome === "CHECK_OUT" && stallData.checkOutTime && (
              <p>
                <strong>Checked out at:</strong>{" "}
                {new Date(stallData.checkOutTime).toLocaleString()}
              </p>
            )}
            <p>
              <strong>Action:</strong>
              <span
                className={`ml-1 px-2 py-1 rounded-full text-xs font-medium ${
                  stallOutcome === "CHECK_OUT"
                    ? "bg-orange-100 text-orange-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {stallOutcome === "CHECK_OUT" ? "Checked Out" : "Checked In"}
              </span>
            </p>

            {stallData.Tables?.length > 0 && (
              <div className="pt-2 border-t border-green-200">
                <p className="font-semibold mb-1">Tables:</p>
                {stallData.Tables.map((table) => (
                  <p key={table.tableId} className="text-xs text-muted-foreground">
                    {table.tableName} ({table.tableType}) — ${table.price}
                  </p>
                ))}
              </div>
            )}

            {stallData.AddOns?.length > 0 && (
              <div className="pt-2 border-t border-green-200">
                <p className="font-semibold mb-1">Add-Ons:</p>
                {stallData.AddOns.map((addOn) => (
                  <p key={addOn.addOnId} className="text-xs text-muted-foreground">
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
  };

  // True when one of the success branches below will actually render. Mirrors
  // their conditions exactly — keep in step if a branch changes.
  const hasSuccessView =
    scanMode === "event-ticket" ||
    scanMode === "stall-ticket" ||
    (scanMode === "speaker-ticket" && !!speakerData) ||
    (scanMode === "round-table" && !!roundTableData) ||
    (scanMode === "workshop" && !!workshopData) ||
    (scanMode === "scheduled-space" && !!scheduledSpaceData);

  // ─── MAIN RENDER ─────────────────────────────────────────────────────────────
  // theme-light-only: this screen is a light-only design — its status panels use
  // literal palette colours (bg-green-50/text-green-800, bg-red-50, bg-orange-50)
  // that do not follow the theme, so under dark mode the shadcn Cards around
  // them went dark while the panels stayed light and the text became unreadable.
  // Pinning the subtree to the light variables keeps the scanner legible at a
  // gate without overriding the operator's global theme preference.
  return (
    <div className="theme-light-only min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExitScanner}
            className="mr-3"
            title="Sign out of the scanner and go back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("QR Scanner")}</h1>
            <p className="text-sm text-muted-foreground">
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

        {/* Main Content. OTP verification happens before the tabs — once the
            operator has authenticated, we expose Scanner | Venue so they can
            either scan tickets or look at the venue layout (with vendor +
            add-on details on hover) while setting up the physical space.
            Venue only shows for events that actually have something to lay
            out on it — Workshops and Scheduled Spaces are their own booking
            systems, not part of the venue designer, so they don't affect
            this. */}
        {step === "otp-verification" && renderOTPVerification()}
        {step !== "otp-verification" && (
          <Tabs defaultValue="scanner" className="mt-2">
            <TabsList>
              <TabsTrigger value="scanner">{t("Scanner")}</TabsTrigger>
              {(eventData?.features?.hasStalls ||
                eventData?.features?.hasRoundTables ||
                eventData?.features?.hasSpeakers) && (
                <TabsTrigger value="venue">{t("Venue")}</TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="scanner" className="mt-4 space-y-4">
        {step === "mode-selection" && renderModeSelection()}
        {step === "scanning" && renderScanner()}
        {step === "manual-search" && renderManualSearch()}
        {step === "checkin-checkout-selection" && renderCheckInOutSelection()}
        {step === "success" && !hasSuccessView && (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <CheckCircle className="mx-auto h-16 w-16 text-green-600 mb-4" />
              <CardTitle className="text-green-800">Scan recorded</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                The scan went through, but its details are no longer on screen.
              </p>
            </CardHeader>
            <CardContent>
              <Button onClick={handleBackToModeSelection} className="w-full">
                Back to Scan Types
              </Button>
            </CardContent>
          </Card>
        )}
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
                    <p className="text-xs text-muted-foreground">Check-in: {new Date(speakerData.checkInTime).toLocaleString()}</p>
                  )}
                  {speakerData.checkOutTime && (
                    <p className="text-xs text-muted-foreground">Check-out: {new Date(speakerData.checkOutTime).toLocaleString()}</p>
                  )}
                  {speakerData.duration && (
                    <p className="text-xs text-muted-foreground">Duration: {speakerData.duration} minutes</p>
                  )}
                </div>
                <Button onClick={resetScanner} className="w-full">
                  Scan Another QR
                </Button>
              </CardContent>
            </Card>
          )}

        {step === "success" &&
          scanMode === "round-table" &&
          roundTableData && (
            <Card className="w-full max-w-md mx-auto">
              <CardHeader className="text-center">
                <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-2" />
                <CardTitle className="text-green-700">
                  {roundTableData.action === "CHECK_IN" ? "Visitor Checked In!" : "Visitor Checked Out!"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                  <p className="font-semibold text-amber-800">{roundTableData.visitorName}</p>
                  <p className="text-sm text-amber-600">Table: {roundTableData.tableName} ({roundTableData.tableCategory})</p>
                  <p className="text-sm text-amber-600">Seats: {roundTableData.seats}</p>
                  {roundTableData.checkInTime && (
                    <p className="text-xs text-muted-foreground">Check-in: {new Date(roundTableData.checkInTime).toLocaleTimeString()}</p>
                  )}
                  {roundTableData.checkOutTime && (
                    <p className="text-xs text-muted-foreground">Check-out: {new Date(roundTableData.checkOutTime).toLocaleTimeString()}</p>
                  )}
                  {roundTableData.durationMinutes && (
                    <p className="text-xs text-muted-foreground">Duration: {roundTableData.durationMinutes} minutes</p>
                  )}
                </div>
                <Button onClick={resetScanner} className="w-full">
                  Scan Another QR
                </Button>
              </CardContent>
            </Card>
          )}

        {step === "success" && scanMode === "workshop" && workshopData && (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-2" />
              <CardTitle className="text-teal-700">
                {workshopData.action === "ALREADY_CHECKED_IN"
                  ? "Already Checked In"
                  : "Workshop Checked In!"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-teal-800">
                  {workshopData.visitorName}
                </p>
                <p className="text-sm text-teal-600">
                  Workshop: {workshopData.itemName}
                </p>
                {workshopData.quantity != null && (
                  <p className="text-sm text-teal-600">
                    Quantity: {workshopData.quantity}
                  </p>
                )}
                {workshopData.checkInTime && (
                  <p className="text-xs text-muted-foreground">
                    Check-in:{" "}
                    {new Date(workshopData.checkInTime).toLocaleTimeString()}
                  </p>
                )}
              </div>
              <Button onClick={resetScanner} className="w-full">
                Scan Another QR
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "success" &&
          scanMode === "scheduled-space" &&
          scheduledSpaceData && (
            <Card className="w-full max-w-md mx-auto">
              <CardHeader className="text-center">
                <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-2" />
                <CardTitle className="text-rose-700">{t("Checked In!")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 space-y-2">
                  <p className="font-semibold text-rose-800">
                    {scheduledSpaceData.name}
                  </p>
                  {scheduledSpaceData.selectedSlots?.length > 0 && (
                    <div className="space-y-1">
                      {scheduledSpaceData.selectedSlots.map(
                        (s: any, i: number) => (
                          <p key={i} className="text-sm text-rose-600">
                            {s.spaceName} —{" "}
                            {s.slotLabel || `${s.startTime}–${s.endTime}`}
                            {s.date ? ` (${s.date})` : ""}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                  {scheduledSpaceData.checkInTime && (
                    <p className="text-xs text-muted-foreground">
                      Check-in:{" "}
                      {new Date(
                        scheduledSpaceData.checkInTime,
                      ).toLocaleTimeString()}
                    </p>
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
                  <CardTitle className="text-base">{t("Confirm Check Out")}</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Are you sure you want to <strong>Check Out</strong> this
                  {scanMode === "speaker-ticket" ? " speaker" : scanMode === "round-table" ? " visitor" : " exhibitor"}? This action cannot be undone.
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
                  placeholder={t("Type CHECK_OUT to confirm")}
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
            </TabsContent>
            {(eventData?.features?.hasStalls ||
              eventData?.features?.hasRoundTables ||
              eventData?.features?.hasSpeakers) && (
            <TabsContent value="venue" className="mt-4">
              {eventId ? (
                <OperatorVenueView eventId={eventId} />
              ) : (
                <div className="text-sm text-muted-foreground italic text-center py-8">
                  No event id in URL.
                </div>
              )}
            </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </div>
  );
}
