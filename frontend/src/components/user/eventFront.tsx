// File: EventDetailPage.tsx

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  CSSProperties,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VenueAnnotationLayer from "../organizer/VenueAnnotationLayer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  CalendarDays,
  MapPin,
  Clock,
  Users,
  Ticket,
  ArrowLeft,
  Share2,
  Heart,
  Phone,
  Mail,
  Globe,
  Facebook,
  Instagram,
  Twitter,
  Star,
  DollarSign,
  TrendingUp,
  Camera,
  Wifi,
  QrCodeIcon,
  Car,
  Utensils,
  Shield,
  Accessibility,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  MapIcon,
  User,
  CheckCircle,
  MessageCircle,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Minus,
  Plus,
  Store,
  Calendar,
  ParkingCircle,
  ShieldCheck,
  FileText,
  Package,
  CreditCard,
  Clock1,
  Clock12,
  Upload,
  Loader2,
  Pencil,
  Trash2,
  GraduationCap,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { FaUtensilSpoon, FaWhatsapp } from "react-icons/fa";
import { useToast } from "@/hooks/use-toast";

import { useCountryCodes } from "@/hooks/useCountryCodes";
import { phoneNationalLength } from "@/data/countries";
import { EventSponsorMarquee } from "@/components/user/EventSponsorSection";
import EventfrontSponsorDialog from "@/components/user/EventfrontSponsorDialog";

interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
}
import { Input } from "../ui/input";
import {
  EventFeedbackTokenHandler,
  VisitorFeedbackCard,
} from "./EventFeedback";
import { EventStatistics } from "./EventStatistics";
import { EventfrontMemberDialog } from "./EventfrontMemberDialog";
import { ExhibitorCategoryPicker } from "@/components/ui/ExhibitorCategoryPicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AnnouncementBar from "@/components/ui/AnnouncementBar";
import { Checkbox } from "@radix-ui/react-checkbox";
import { OrganizerStore } from "./organizerStoreFront";
import MarriageEventFront from "./MarriageEventFront";
import { StallStepper, ScheduledSpaceStepper } from "./StallStepper";
import StatusTimeline from "@/components/StatusTimeline";
import { FacilityCourtMarkings } from "@/lib/facilityCourtLines";
import DemoPrompt from "./DemoPrompt";
import { startDemoDashboard } from "@/lib/demoDashboard";
import { isFieldEnabled as isRegFieldEnabled } from "@/lib/registrationFormFields";
import StallPaymentPanel from "./StallPaymentPanel";
import PaymentFeedbackDialog from "./PaymentFeedbackDialog";
import { EventChatbot } from "./EventChatbot";
import { useCurrency } from "@/hooks/useCurrencyhook";
import ImageCropModal from "../ui/imageCropModal";
import { StatusHistoryEntry } from "../organizer/EventAttendees";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Client-side image compressor for stall uploads: downscales + re-encodes to
// WebP, shrinking dimension/quality until the result is under `maxBytes`
// (1 MB). Keeps server load + storage tiny. Returns a new .webp File; on any
// failure returns the original file untouched.
async function compressStallImage(
  file: File,
  maxBytes = 1024 * 1024,
): Promise<File> {
  try {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });

    const encode = (maxDim: number, quality: number): Promise<Blob | null> => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return Promise.resolve(null);
      ctx.fillStyle = "#ffffff"; // flatten transparency for webp
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return new Promise((res) => canvas.toBlob(res, "image/webp", quality));
    };

    const toFile = (blob: Blob) =>
      new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
        type: "image/webp",
      });

    // Progressively shrink dimension + quality until under the cap.
    let last: Blob | null = null;
    for (const maxDim of [1280, 1024, 800, 640, 480]) {
      for (const q of [0.8, 0.65, 0.5, 0.4]) {
        const blob = await encode(maxDim, q);
        if (!blob) continue;
        last = blob;
        if (blob.size <= maxBytes) return toFile(blob);
      }
    }
    return last ? toFile(last) : file;
  } catch {
    return file;
  }
}

interface Organizer {
  _id: string;
  name: string;
  email: string;
  organizationName: string;
  phoneNumber: string;
  businessEmail: string;
  whatsAppNumber: string;
  address: string;
  bio: string;
  // "Description" the organizer enters in Settings → shown in the About
  // Organizer section on the public event page.
  description?: string;
  approved: boolean;
  rejected: boolean;
  createdAt: string;
  updatedAt: string;
  slug: string;
  paymentURL: string;
  __v: number;
}

interface TableTemplate {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  rowNumber: number;
  tablePrice: number;
  bookingPrice: number;
  depositPrice: number;
  // Master switch for offering the minimum/partial payment plan on this space.
  // When false, exhibitors can only pay in full. Defaults to true when absent.
  minimumPaymentEnabled?: boolean;
  // When true, the deposit is part of Option 1 (minimum payment); otherwise
  // Option 1 is the booking amount only. Defaults to false when absent.
  depositInOption1?: boolean;
  // Exhibitor business category this space is reserved for. "Other"/empty =
  // open to all categories. Set by the organizer in the venue designer.
  exhibitorCategory?: string;
  customDimensions: boolean;
  isBooked?: boolean;
  bookedBy?: string;
  positionId?: string;
  x?: number;
  y?: number;
  rotation?: number;
  isPlaced?: boolean;
}

interface AddOnItem {
  id: string;
  name: string;
  price: number;
  description: string;
}

interface VenueConfig {
  id: string; // ✅ Add this
  name: string; // ✅ Add this
  width: number;
  height: number;
  scale: number;
  gridSize: number;
  showGrid: boolean;
  hasMainStage: boolean;
  mainStageLabel?: string;
  mainStageShape?: "rectangle" | "circle" | "semicircle";
  mainStageWidth?: number;
  mainStageHeight?: number;
  mainStageX?: number;
  mainStageY?: number;
  totalRows: number;
}

interface FetchedEvent {
  _id: string;
  title: string;
  description: string;
  category: string;
  startDate: string;
  time: string;
  endDate: string;
  endTime: string;
  organizer: Organizer;
  location: string;
  address: string;
  ticketPrice?: number;
  totalTickets?: number;
  originalTotalTickets?: number;
  visitorTypes?: any[];
  seatRowTemplates?: any[];
  venueSeats?: any[];
  seatMapBookedSeats?: string[];
  visibility: string;
  inviteLink: string;
  tags: string[];
  features: {
    food: boolean;
    parking: boolean;
    wifi: boolean;
    photography: boolean;
    security: boolean;
    accessibility: boolean;
  };
  registrationFormFields?: {
    stall?: Record<string, boolean>;
    speaker?: Record<string, boolean>;
    roundTable?: Record<string, boolean>;
    workshop?: Record<string, boolean>;
    scheduledSpace?: Record<string, boolean>;
  };
  ageRestriction: string;
  dresscode: string;
  specialInstructions: string;
  image: string;
  gallery: string[];
  // Instagram reel URLs — rendered as a click-to-play carousel below
  // the Event Gallery. Optional so legacy events without this field
  // don't fail the type check.
  reelLinks?: string[];
  socialMedia: {
    facebook: string;
    instagram: string;
    twitter: string;
    linkedin: string;
  };
  refundPolicy: string;
  termsAndConditions: string;
  tableTemplates?: TableTemplate[];
  venueTables?: { [key: string]: TableTemplate[] };
  addOnItems?: AddOnItem[];
  venueConfig?: VenueConfig[];
  speakers?: any[];
  speakerSlotTemplates?: any[];
  venueSpeakerZones?: any[];
  roundTableTemplates?: any[];
  venueRoundTables?: any[];
  // Placed entrance / exit door markers; rendered on the venue map
  // alongside the stalls and round tables.
  venueDoors?: any[];
  status: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  __v: number;
  termsAndConditionsforStalls?: {
    termsAndConditionsforStalls: string;
    isMandatory: boolean;
  }[];
  // Public eventfront AI assistant — organizer toggles it on, names it and
  // picks its theme colour in the Create/Edit Event form. Absent/disabled = no
  // widget.
  chatbot?: {
    enabled?: boolean;
    name?: string;
    accentColor?: string;
  };
}

interface EventDetailPageProps {
  eventId: string;
  onBack: () => void;
}

/**
 * Collapsible info card — same open/close disclosure the Venue Layout
 * uses (clickable header row + chevron that flips). Used to wrap the
 * event's info sections (Terms, Refund Policy, etc.) and the Add-On
 * Items list so each can be expanded/collapsed independently. Defaults
 * closed, matching the Venue Layout.
 */
function CollapsibleCard({
  title,
  headingColor,
  defaultOpen = false,
  children,
}: {
  title: string;
  headingColor?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full px-5 sm:px-6 py-4 flex items-center gap-2 hover:bg-gray-50 transition-colors"
      >
        <p
          className="text-sm sm:text-lg font-bold tracking-widest uppercase text-left"
          style={{ color: headingColor }}
        >
          {title}
        </p>
        <span className="ml-auto">
          {open ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </span>
      </button>
      {open && <div className="px-5 sm:px-6 pb-5 sm:pb-6">{children}</div>}
    </div>
  );
}

/**
 * True once the event's end (its end date, or start date when no end date is
 * set, taken to the END of that calendar day) is in the past. Mirrors the
 * backend `eventHasEnded` guard so the UI and the server agree on when
 * bookings/purchases close.
 */
function isEventOver(
  ev?: { startDate?: string; endDate?: string } | null,
): boolean {
  const end = ev?.endDate || ev?.startDate;
  if (!end) return false;
  const d = new Date(end);
  if (isNaN(d.getTime())) return false;
  d.setHours(23, 59, 59, 999);
  return d.getTime() < Date.now();
}

/**
 * Build the Event Assistant's opening quick-reply pills purely from the
 * event's own data — mirrors the backend's eventQuickActions so the greeting
 * never offers something the event doesn't have (e.g. no "Ticket prices" pill
 * when there are no visitor tickets). Past events drop all "book / buy /
 * apply" prompts.
 */
type ChatbotIntent =
  | "book_stall"
  | "buy_ticket"
  | "apply_speaker"
  | "book_round_table";
type ChatbotPill = { label: string; action: string; intent?: ChatbotIntent };

function buildEventChatbotGreeting(ev: FetchedEvent): ChatbotPill[] {
  const isPast = isEventOver(ev);
  // Only show ticket pills when the event actually has visitor types — that's
  // the same gate the page uses to render its ticket-buying UI. A stray
  // ticketPrice must not surface a phantom "Buy tickets" pill.
  const hasTickets = (ev.visitorTypes?.length || 0) > 0;
  // A booking pill only shows when at least one space of that type is actually
  // FOR SALE. "Not for sale" spaces are layout-only references (decoration), so
  // a type made up entirely of them gets no "Book …" pill — e.g. round tables
  // placed purely as references show no "Book a round table" pill.
  const flat = (v: any): any[] =>
    Array.isArray(v)
      ? v
      : v && typeof v === "object"
        ? Object.values(v).flat()
        : [];
  const anyForSale = (arr: any): boolean =>
    Array.isArray(arr) && arr.some((t: any) => t?.forSale !== false);
  const hasStalls =
    anyForSale(ev.tableTemplates) || anyForSale(flat(ev.venueTables));
  const hasSpeakers =
    (ev.speakers?.length || 0) > 0 ||
    (ev.speakerSlotTemplates?.length || 0) > 0;
  const hasRoundTables = anyForSale(flat(ev.venueRoundTables));

  const pills: ChatbotPill[] = [
    { label: "When & where?", action: "When and where is this event?" },
  ];
  if (isPast) {
    // Past event — informational only, no booking intents.
    if (hasTickets)
      pills.push({
        label: "Ticket info",
        action: "What were the tickets for this event?",
      });
    if (hasSpeakers)
      pills.push({ label: "Speakers", action: "Who spoke at this event?" });
  } else {
    if (hasTickets)
      pills.push({
        label: "Buy tickets",
        action: "I want to buy tickets",
        intent: "buy_ticket",
      });
    if (hasStalls)
      pills.push({
        label: "Book a stall",
        action: "How do I book a stall as a vendor?",
        intent: "book_stall",
      });
    if (hasStalls)
      // Reuses the stall sign-in flow → lands on the vendor's existing-booking
      // dialog, where they can edit OR cancel/delete their request.
      pills.push({
        label: "Cancel my stall",
        action: "I want to cancel or delete my stall booking",
        intent: "book_stall",
      });
    if (hasSpeakers)
      pills.push({
        label: "Apply as speaker",
        action: "How can I apply to speak at this event?",
        intent: "apply_speaker",
      });
    if (hasRoundTables)
      pills.push({
        label: "Book a round table",
        action: "How do I book a round-table seat?",
        intent: "book_round_table",
      });
  }
  pills.push({
    label: "About the organizer",
    action: "Tell me about the organizer.",
  });
  return pills.slice(0, 6);
}

export function EventFront({ eventId, onBack }: EventDetailPageProps) {
  const [eventData, setEventData] = useState<FetchedEvent | null>(null);
  // Whether a toggleable Stall application field is enabled for this event
  // (organizer-configured via Registration Forms). Component-scoped so both
  // the form JSX and handleRentFormSubmit's validation share one source of
  // truth. See frontend/src/lib/registrationFormFields.ts.
  const stallOn = (key: string) =>
    isRegFieldEnabled(eventData?.registrationFormFields, "stall", key);
  const speakerOn = (key: string) =>
    isRegFieldEnabled(eventData?.registrationFormFields, "speaker", key);
  const roundTableOn = (key: string) =>
    isRegFieldEnabled(eventData?.registrationFormFields, "roundTable", key);
  const workshopOn = (key: string) =>
    isRegFieldEnabled(eventData?.registrationFormFields, "workshop", key);
  const scheduledSpaceOn = (key: string) =>
    isRegFieldEnabled(eventData?.registrationFormFields, "scheduledSpace", key);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // organizationName is only present on routes shaped
  // "/:organizationName/events/:id" — undefined on the embed-only
  // "/events/:id" variants. Passed through to the event-fetch call below so
  // the backend can disambiguate a custom slug that collides across two
  // different organizers (slugs are unique per organizer, not globally).
  const { id, organizationName } = useParams();
  const [isFavorited, setIsFavorited] = useState(false);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [selectedVisitorType, setSelectedVisitorType] = useState<number>(0);
  // Cinema/concert seat map — selected seats as PositionedSeat.id values.
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  // Measures the full-width seat-map section's actual rendered width so
  // seats scale to fill whatever room the main content column has, instead
  // of a guessed/fixed pixel budget. The callback ref re-fires (and this
  // effect re-attaches its observer) whenever the section mounts/unmounts —
  // notably the first time `showSeatPicker` flips true, well after this
  // hook itself is declared.
  const [seatMapEl, setSeatMapEl] = useState<HTMLDivElement | null>(null);
  const [seatMapWidth, setSeatMapWidth] = useState(600);
  useEffect(() => {
    if (!seatMapEl) return;
    const update = () => setSeatMapWidth(seatMapEl.clientWidth || 600);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(seatMapEl);
    return () => ro.disconnect();
  }, [seatMapEl]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  // Collapsible "Additional Information" inside the Organizer tab.
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  // Reel marquee ref — kept for future scroll/focus needs but the
  // IntersectionObserver lazy-mount was removed because the History
  // tab content mounts inside Radix Tabs and the observer's effect
  // races with the ref attaching, leaving `inView` stuck on false
  // and the placeholder showing forever. Rendering iframes
  // immediately matches what kioscart-v1's storefront does once its
  // observer fires anyway.
  const reelMarqueeRef = useRef<HTMLDivElement | null>(null);
  // Speakers/Workshops horizontal card rows — native touch-swipe works on
  // a real phone, but there was no visible affordance hinting more cards
  // exist, and no way at all to advance on a mouse-driven "mobile view"
  // (desktop responsive mode, no touch emulation). These refs back the
  // explicit Prev/Next buttons added alongside each row, mirroring the
  // Gallery's existing chevron pattern.
  const speakersScrollRef = useRef<HTMLDivElement | null>(null);
  const workshopsScrollRef = useRef<HTMLDivElement | null>(null);
  // Collapsible Venue Layout — defaults to closed so the heavy canvas
  // (and the multi-layout selector / stats grid) only render after the
  // user explicitly opts in by clicking the chevron header.
  const [showVenueLayout, setShowVenueLayout] = useState(false);
  const [venueMaximized, setVenueMaximized] = useState(false);
  // Controlled active tab so the info cards can jump to a section, and a ref
  // to the tabs block so we can scroll it into view on card click.
  const [activeTab, setActiveTab] = useState("organizer");
  const tabsSectionRef = useRef<HTMLDivElement>(null);
  // Live fit-to-screen scale for the maximized venue dialog. Recomputed
  // by a ResizeObserver on the scrollable container so the entire
  // layout fits the dialog viewport instead of forcing the user to
  // scroll a canvas that may be several thousand pixels wide.
  const [maximizedScale, setMaximizedScale] = useState(1);
  const maximizedContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Auto-advance the Event Gallery on a timer. The interval restarts
  // whenever the active image changes (including manual nav), so a manual
  // click always gets a full interval before the next auto-slide. Only
  // runs when there's more than one image; cleaned up on unmount.
  useEffect(() => {
    const total = eventData?.gallery?.length ?? 0;
    if (total <= 1) return;
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev === total - 1 ? 0 : prev + 1));
    }, 4000);
    return () => clearInterval(timer);
  }, [eventData?.gallery?.length, currentImageIndex]);

  // WhatsApp Verification Dialog States
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappOtp, setWhatsappOtp] = useState("");
  const [whatsappOtpSent, setWhatsappOtpSent] = useState(false);
  const [whatsappVerified, setWhatsappVerified] = useState(false);
  const [sendingWhatsappOtp, setSendingWhatsappOtp] = useState(false);
  const [verifyingWhatsappOtp, setVerifyingWhatsappOtp] = useState(false);
  // Google sign-in (vendor lookup by email) inside the Rent a Stall dialog.
  const [stallGoogleLoading, setStallGoogleLoading] = useState(false);
  // When a Google-authenticated vendor is an active member, we pause on a
  // membership card before continuing to the rent form. `pendingVendorData`
  // holds the looked-up vendor so the Continue button can resume the flow.
  const [stallMembership, setStallMembership] = useState<{
    planName: string;
    endDate?: string;
    color?: string;
  } | null>(null);

  // Rent Form States
  const [showRentForm, setShowRentForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [shopkeeperExists, setShopkeeperExists] = useState(false);

  // Round Table Booking States
  const [roundTableData, setRoundTableData] = useState<any[]>([]);
  const [roundTableSelections, setRoundTableSelections] = useState<
    {
      tablePositionId: string;
      tableName: string;
      tableCategory: string;
      sellingMode: string;
      selectedChairIndices: number[];
      amount: number;
      color: string;
    }[]
  >([]);
  const [rtVisitorInfo, setRtVisitorInfo] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [rtBookingLoading, setRtBookingLoading] = useState(false);
  const [rtSeatGuests, setRtSeatGuests] = useState<
    Record<
      string,
      Record<number, { name: string; whatsApp: string; email: string }>
    >
  >({});
  const [showGuestForm, setShowGuestForm] = useState(false);

  // Workshop Booking — picking a session or a combo navigates to a
  // dedicated checkout page (same one-item-at-a-time flow as Visitor
  // Tickets), so the only local state needed here is the "Buy Combo" dialog.
  const [showWorkshopCombos, setShowWorkshopCombos] = useState(false);

  // Workshop Host Application States — same Google-auth-first, self-service
  // pattern as Apply-as-Speaker / Rent-a-Stall, minus any physical
  // placement: apply -> organizer reviews -> (optional hosting fee) -> live.
  const [showWorkshopHostDialog, setShowWorkshopHostDialog] = useState(false);
  const [workshopHostStep, setWorkshopHostStep] = useState<
    "auth" | "details" | "status"
  >("auth");
  const [workshopHostGoogleLoading, setWorkshopHostGoogleLoading] =
    useState(false);
  const [workshopHostAuthedEmail, setWorkshopHostAuthedEmail] = useState("");
  const [workshopHostFormData, setWorkshopHostFormData] = useState({
    hostName: "",
    hostEmail: "",
    hostPhone: "",
    hostBio: "",
    workshopName: "",
    workshopDescription: "",
    proposedPrice: "0",
    proposedStartTime: "",
    proposedEndTime: "",
    maxSeats: "",
    // Only collected/required when proposedPrice > 0 — where the organizer
    // should send the host's payout.
    hostAccountName: "",
    hostAccountDetails: "",
    photoFile: null as File | null,
    photoPreview: "",
  });
  const [workshopHostSubmitting, setWorkshopHostSubmitting] = useState(false);
  const [existingWorkshopHostRequest, setExistingWorkshopHostRequest] =
    useState<any>(null);
  const workshopHostPopupRef = useRef<Window | null>(null);
  const [workshopHostCrop, setWorkshopHostCrop] = useState<{
    url: string;
  } | null>(null);

  // Speaker Application States (Google-auth-first flow, like Rent a Stall).
  // The WhatsApp number is NEVER used to sign in any more — identity comes
  // from the Google-verified email; the phone is only an optional contact
  // detail captured on the application form.
  const [showSpeakerDialog, setShowSpeakerDialog] = useState(false);
  const [speakerGoogleLoading, setSpeakerGoogleLoading] = useState(false);
  const [speakerAuthedEmail, setSpeakerAuthedEmail] = useState("");
  const [speakerVerified, setSpeakerVerified] = useState(false);
  const [existingSpeakerRequest, setExistingSpeakerRequest] =
    useState<any>(null);
  // auth → details → topic → slot → (submit) → status → done.
  // "timeslot" is the legacy post-approval time picker, kept for requests
  // created before slot selection moved into the application itself.
  const [speakerStep, setSpeakerStep] = useState<
    "auth" | "status" | "details" | "topic" | "slot" | "timeslot" | "done"
  >("auth");
  // True when the signed-in email already had a saved speaker profile, so the
  // wizard can say "welcome back" instead of silently pre-filling.
  const [speakerProfileFound, setSpeakerProfileFound] = useState(false);
  // Speaker headshot cropping. Its own state rather than the stall flow's
  // crop queue above, which carries stall-specific completion logic.
  const [speakerPhotoCrop, setSpeakerPhotoCrop] = useState<string | null>(null);
  const [speakerFormData, setSpeakerFormData] = useState<any>({
    name: "",
    email: "",
    phone: "",
    title: "",
    organization: "",
    bio: "",
    expertise: "",
    previousSpeakingExperience: "",
    equipmentNeeded: "",
    notes: "",
    sessionTopic: "",
    sessionDescription: "",
    preferredStartTime: "",
    preferredEndTime: "",
    selectedSlotId: "",
    selectedSlotName: "",
    // Mirrors the chosen slot's price so the wizard can explain what happens
    // after approval. The server re-resolves it from the event on submit —
    // this copy is for display only and is never trusted for billing.
    selectedSlotPrice: 0,
    socialLinks: { linkedin: "", twitter: "", website: "" },
  });
  const [speakerSubmitting, setSpeakerSubmitting] = useState(false);
  const [speakerTimeSlot, setSpeakerTimeSlot] = useState({
    topic: "",
    startTime: "",
    endTime: "",
    description: "",
  });
  const [bookedSpeakerSlots, setBookedSpeakerSlots] = useState<any[]>([]);

  // NEW: Stall Booking Workflow States
  const [existingStallRequest, setExistingStallRequest] = useState<any>(null);
  const [showTableSelection, setShowTableSelection] = useState(false);
  const [shopkeeperId, setShopkeeperId] = useState<string | null>(null);
  // Linked-accounts (multi-vendor) state for the Google "Rent a Stall" flow.
  // One authenticated email can own several vendor profiles; the booker picks
  // which one to register with, or registers a brand-new one.
  const [linkedVendors, setLinkedVendors] = useState<any[]>([]);
  const [authedEmail, setAuthedEmail] = useState("");
  const [showAccountChooser, setShowAccountChooser] = useState(false);
  // Shown when the chosen vendor holds MORE THAN ONE request for this event
  // (e.g. a Completed booking + a new Pending one). Lists every request with
  // its status + date so the vendor can pick which to manage, register another,
  // or act on any of them — instead of only ever seeing the newest.
  const [showRequestListChoice, setShowRequestListChoice] = useState(false);
  const [requestList, setRequestList] = useState<any[]>([]);
  // Second step inside the request-list dialog: the "register a new request"
  // who-for choice (same two paths as the completed-choice dialog).
  const [listRegisterStep, setListRegisterStep] = useState(false);
  // Shown when the chosen vendor has already COMPLETED (paid) a stall for this
  // event: preview the existing booking, or register a new request.
  const [showCompletedChoice, setShowCompletedChoice] = useState(false);
  // Second step inside the completed-choice dialog: after the booker clicks
  // "Register a new request" we reveal two paths — register again under THIS
  // same vendor profile (for yourself), or spin up a brand-new linked vendor.
  const [showRegisterTargetChoice, setShowRegisterTargetChoice] =
    useState(false);
  // When true the rent form is blank (except the locked authenticated email)
  // and submit force-creates a new vendor profile.
  const [registerNewMode, setRegisterNewMode] = useState(false);
  // Controls the new Google-verified Member dialog mounted under the
  // Rent-a-Stall card. Replaces the old storefront-only entry point.
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  // "Become a Sponsor" popup — lists the event's sponsorship tiers.
  const [showSponsorDialog, setShowSponsorDialog] = useState(false);
  // Demo mode: this is an admin-curated showcase event. Any real action
  // (buy ticket, book stall, become member) instead invites the visitor to
  // register / contact us.
  const [showDemoPrompt, setShowDemoPrompt] = useState(false);
  // Membership status for the logged-in exhibitor, scoped to this
  // event's organizer. Populated after OTP verify when shopkeeper email
  // is known. When set + the space template has a memberPrice, the
  // selection cards and totals quote the member-tier price.
  const [activeMembership, setActiveMembership] = useState<{
    planName?: string;
    endDate?: string;
  } | null>(null);
  const isMember = !!activeMembership;

  // Scheduled Spaces booking workflow state. Simpler than the Stalls flow
  // above — no vendor-account system, no amend/multi-request chooser: a
  // registrant is just identified by the (Google-verified) email, and at
  // most one active request per event is expected. Every entry into the
  // flow goes through Google sign-in first — no session-remembered
  // shortcut — resolveScheduledSpaceAfterGoogle then looks up any existing
  // request by that verified email and routes straight to its status.
  const [existingScheduledSpaceRequest, setExistingScheduledSpaceRequest] =
    useState<any>(null);
  const [showScheduledSpaceForm, setShowScheduledSpaceForm] = useState(false);
  const [showScheduledSpaceStatus, setShowScheduledSpaceStatus] =
    useState(false);
  const [showScheduledSpacePicker, setShowScheduledSpacePicker] =
    useState(false);
  // A visitor can have more than one Scheduled Space request for the same
  // event over time (mirrors the Rent-a-Stall multi-request chooser) — this
  // holds every request found for their verified email so they can pick
  // which one to view, or start a fresh one, instead of always being
  // dropped straight into their single most-recent request.
  const [scheduledSpaceRequestList, setScheduledSpaceRequestList] = useState<
    any[]
  >([]);
  const [
    showScheduledSpaceRequestListChoice,
    setShowScheduledSpaceRequestListChoice,
  ] = useState(false);
  // "auth" (Google sign-in gate) → "form" (details). Mirrors the Rent-a-
  // Stall / Become-a-Sponsor flows' Google-first pattern.
  const [scheduledSpaceStep, setScheduledSpaceStep] = useState<
    "auth" | "form"
  >("auth");
  const [scheduledSpaceGoogleLoading, setScheduledSpaceGoogleLoading] =
    useState(false);
  const [downloadingScheduledSpaceTicket, setDownloadingScheduledSpaceTicket] =
    useState(false);
  const scheduledSpacePopupRef = useRef<Window | null>(null);
  const [scheduledSpaceForm, setScheduledSpaceForm] = useState({
    name: "",
    email: "",
    phone: "",
    whatsappNumber: "",
    facilityType: "",
    purpose: "",
    organization: "",
    companions: [] as string[],
    referralCode: "",
  });
  // Whether the referral code the visitor typed on the registration form
  // matched an operator — surfaced in the slot picker so they know why
  // certain spaces are (or aren't) showing.
  const [scheduledSpaceMatchedOperator, setScheduledSpaceMatchedOperator] =
    useState<{ id: string; name: string } | null>(null);
  const [scheduledSpaceReferralInvalid, setScheduledSpaceReferralInvalid] =
    useState(false);
  // Gates the rest of the registration form: the registrant must either
  // apply a referral code or explicitly say they don't have one before the
  // remaining fields (and the space list they drive) unblur. Reset to
  // false every time a fresh form is reached (see resolveScheduledSpaceAfterGoogle).
  const [scheduledSpaceReferralResolved, setScheduledSpaceReferralResolved] =
    useState(false);
  const [scheduledSpaceCheckingReferral, setScheduledSpaceCheckingReferral] =
    useState(false);
  // Selected-country objects for the WhatsApp/Phone PhoneInput fields — drive
  // the "Enter N digits for Country" hint, same as the Stall form's fields.
  const [scheduledSpaceWhatsappCountry, setScheduledSpaceWhatsappCountry] =
    useState<any>(null);
  const [scheduledSpacePhoneCountry, setScheduledSpacePhoneCountry] =
    useState<any>(null);
  const [scheduledSpaceLoading, setScheduledSpaceLoading] = useState(false);
  // Free/charity spaces have no payment page to route to — slot selection
  // submits and completes the booking directly, so this tracks that
  // in-flight request instead of the instant navigate() the paid path uses.
  const [
    scheduledSpaceSlotsSubmitting,
    setScheduledSpaceSlotsSubmitting,
  ] = useState(false);
  const [scheduledSpacesAvailable, setScheduledSpacesAvailable] = useState<
    any[]
  >([]);
  const [selectedScheduledSlots, setSelectedScheduledSlots] = useState<any[]>(
    [],
  );
  // Distinct facility types actually placed with at least one slot — drives
  // the "Type of Space Required" picker so a venue with e.g. both Tennis
  // Courts and Chess Tables lets the registrant pick which one up-front.
  // Sourced from scheduledSpacesAvailable (the referral-code-filtered
  // fetch), NOT the raw event doc — otherwise operator-gated facility
  // types would leak into the dropdown before/without the right code.
  const scheduledSpaceFacilityTypes = useMemo(() => {
    const types = (scheduledSpacesAvailable || [])
      .filter((s: any) => (s.slots || []).length > 0)
      .map((s: any) => s.facilityType)
      .filter(Boolean);
    return Array.from(new Set(types)) as string[];
  }, [scheduledSpacesAvailable]);
  // Same set, but sourced synchronously from the raw event doc rather than
  // the availability fetch — scheduledSpacesAvailable starts out empty
  // ([]) until fetchAvailableScheduledSpaces() resolves, so it can't be
  // used for the single-facility-type auto-select below (handleScheduled-
  // SpaceClick runs before that fetch has had a chance to land). Only used
  // for that one-off convenience default, never for what's actually shown
  // as bookable — the gated dropdown/picker still key off the fetch above.
  const allScheduledSpaceFacilityTypes = useMemo(() => {
    const types = ((eventData as any)?.venueScheduledSpaces || [])
      .filter((s: any) => (s.slots || []).length > 0)
      .map((s: any) => s.facilityType)
      .filter(Boolean);
    return Array.from(new Set(types)) as string[];
  }, [eventData]);
  // Per-facility-type slot counts (from the same availability fetch the slot
  // picker uses) so the "Type of Space Required" dropdown can tell the
  // registrant up-front whether a type still has open slots, instead of them
  // finding out only after registering and reaching the picker.
  const scheduledSpaceFacilityAvailability = useMemo(() => {
    const map: Record<string, { total: number; available: number }> = {};
    for (const space of scheduledSpacesAvailable as any[]) {
      const ft = space?.facilityType;
      if (!ft) continue;
      if (!map[ft]) map[ft] = { total: 0, available: 0 };
      for (const slot of space.slots || []) {
        map[ft].total += 1;
        if (!slot.isBooked) map[ft].available += 1;
      }
    }
    return map;
  }, [scheduledSpacesAvailable]);
  // Slot picker narrows to the facility type the registrant asked for (when
  // that field was collected) — otherwise every placed space is shown.
  const filteredScheduledSpaces = useMemo(() => {
    const want = existingScheduledSpaceRequest?.facilityTypeRequested;
    if (!want) return scheduledSpacesAvailable;
    return scheduledSpacesAvailable.filter(
      (s: any) => s.facilityType === want,
    );
  }, [scheduledSpacesAvailable, existingScheduledSpaceRequest]);

  // Effective round-table prices — honour the member tier when the viewer
  // holds an active membership (matches the backend booking calculation).
  const rtChairPrice = (rt: any) =>
    (isMember && rt?.memberChairPrice != null
      ? rt.memberChairPrice
      : rt?.chairPrice) || 0;
  const rtTablePrice = (rt: any) =>
    (isMember && rt?.memberTablePrice != null
      ? rt.memberTablePrice
      : rt?.tablePrice) || 0;

  // NEW: Table Selection States
  const [selectedTables, setSelectedTables] = useState<any[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<any[]>([]);

  // ── Edit Request (amendment) states ──
  // amendMode locks the Selection tab to add-ons-only editing of an existing
  // completed booking (spaces stay blue + locked). amendFloor holds the
  // original add-on quantities so the vendor can only add / increase.
  const [amendMode, setAmendMode] = useState(false);
  const [showAmendOperators, setShowAmendOperators] = useState(false);
  const [amendOperators, setAmendOperators] = useState(1);
  const [amendFloor, setAmendFloor] = useState<Record<string, number>>({});
  const [amendAmountDue, setAmendAmountDue] = useState(0);
  const [showAmendPayment, setShowAmendPayment] = useState(false);
  const [amendTxnId, setAmendTxnId] = useState("");
  const [amendScreenshot, setAmendScreenshot] = useState<File | null>(null);
  const [amendSubmitting, setAmendSubmitting] = useState(false);
  // Post-payment feedback (shown after the stall-edit difference is paid).
  const [showPaymentFeedback, setShowPaymentFeedback] = useState(false);
  const [feedbackAmount, setFeedbackAmount] = useState(0);
  // Cancellation/delete request (vendor asks, organizer approves).
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  // positionIds of THIS vendor's own booked spaces — rendered blue + locked.
  const ownBookedPositionIds = useMemo(
    () =>
      new Set<string>(
        (existingStallRequest?.selectedTables || []).map(
          (t: any) => t.positionId,
        ),
      ),
    [existingStallRequest],
  );
  // Extra owed for the edit = new add-on total − original add-on total (>= 0).
  // Declared with the other hooks (above the component's early returns) so the
  // hook order stays stable across renders.
  const amendExtra = useMemo(() => {
    if (!amendMode) return 0;
    const newTotal = selectedAddOns.reduce(
      (s, a) => s + (Number(a.price) || 0) * (Number(a.quantity) || 0),
      0,
    );
    const oldTotal = Number(existingStallRequest?.addOnsTotal) || 0;
    return Math.max(0, newTotal - oldTotal);
  }, [amendMode, selectedAddOns, existingStallRequest]);
  // T&C for stalls
  const [stallTermsChecked, setStallTermsChecked] = useState<
    Record<number, boolean>
  >({});
  const [showTermsStep, setShowTermsStep] = useState(false);
  // Upfront Rules & Regulations gate — shown AFTER Google auth and BEFORE the
  // stall-request form opens (for a NEW request). The vendor must scroll to the
  // bottom of the terms + custom sections before the single Accept enables.
  const [showStallTermsGate, setShowStallTermsGate] = useState(false);
  const [stallGateScrolledEnd, setStallGateScrolledEnd] = useState(false);
  // True once the vendor has accepted the rules for the current form open.
  const [stallGateAcknowledged, setStallGateAcknowledged] = useState(false);
  const stallGateScrollRef = useRef<HTMLDivElement | null>(null);
  // When the gate opens, if its content is short enough to need no scrolling,
  // enable Accept right away (otherwise the vendor could never satisfy the
  // scroll-to-bottom requirement).
  useEffect(() => {
    if (!showStallTermsGate) return;
    const id = window.setTimeout(() => {
      const el = stallGateScrollRef.current;
      if (el && el.scrollHeight <= el.clientHeight + 4)
        setStallGateScrolledEnd(true);
    }, 60);
    return () => window.clearTimeout(id);
  }, [showStallTermsGate]);
  // GATE THE STALL FORM: whenever the form is requested open (via ANY path —
  // new vendor, register-another, cancelled-then-new, no-existing-request …)
  // and there are rules the vendor hasn't acknowledged yet, show the Rules &
  // Regulations dialog FIRST. The form only renders once acknowledged. Closing
  // the form clears the acknowledgement so the next request re-gates.
  useEffect(() => {
    if (!showRentForm) {
      if (stallGateAcknowledged) setStallGateAcknowledged(false);
      return;
    }
    if (stallGateAcknowledged || showStallTermsGate) return;
    if (getStallGateContent().hasAny) {
      setStallGateScrolledEnd(false);
      setShowStallTermsGate(true);
    }
  }, [showRentForm, stallGateAcknowledged, showStallTermsGate, eventData]);
  const [availableTables, setAvailableTables] = useState<{
    [key: string]: any[];
  }>({});
  const [loadingTables, setLoadingTables] = useState(false);
  const [currentLayoutIndex, setCurrentLayoutIndex] = useState(0);

  // Keep the viewed venue on a PUBLISHED one. If the current index lands on an
  // unpublished venue (e.g. default index 0 is hidden), jump to the first
  // published venue so visitors never see a hidden hall.
  useEffect(() => {
    const vc = (eventData as any)?.venueConfig;
    if (!Array.isArray(vc) || vc.length === 0) return;
    const cur = vc[currentLayoutIndex];
    if (cur && cur.published === false) {
      const firstPub = vc.findIndex((v: any) => v?.published !== false);
      if (firstPub >= 0 && firstPub !== currentLayoutIndex) {
        setCurrentLayoutIndex(firstPub);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventData, currentLayoutIndex]);

  // A seat selection is scoped to whichever venue is currently being
  // viewed — switching layouts (multi-venue events) must drop any prior
  // picks, since they belong to a different layout's seat list. Left
  // uncleared, a stale seat id renders as a blank chip in the sidebar
  // summary (looked up against the wrong layout's seats and finding none).
  useEffect(() => {
    setSelectedSeats([]);
  }, [currentLayoutIndex]);

  const venueContainerRef = useRef<HTMLDivElement>(null);
  const [dynamicScale, setDynamicScale] = useState(1);
  const venueDisplayContainerRef = useRef<HTMLDivElement>(null);
  const [venueDisplayScale, setVenueDisplayScale] = useState(1);

  // Dev-only escape hatch used by the build-guide screenshot script. Lets
  // Puppeteer skip the WhatsApp OTP gate by setting window.__guideBypass
  // before navigation; gated on import.meta.env.DEV so it's a no-op in any
  // built artifact. Safe to leave in tree.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const bypass = (window as any).__guideBypass;
    if (!bypass) return;
    if (bypass.whatsapp) {
      setWhatsappNumber(bypass.whatsapp);
      setWhatsappVerified(true);
    }
    if (bypass.openForm) setShowRentForm(true);
    if (bypass.openTableSelection) setShowTableSelection(true);
  }, []);
  const [country, setCountry] = useState("");
  const { formatPrice, getSymbol } = useCurrency(country);

  const BUSINESS_CATEGORIES = [
    "Technology",
    "Music",
    "Food",
    "Sports",
    "Arts",
    "Fashion",
    "Electronics",
    "Other",
  ];

  const initialForm = {
    shopName: "",
    name: "",
    email: "",
    businessEmail: "",
    phone: "",
    address: "",
    description: "",
    whatsappNumber: "",
    taxPercentage: 0,
    businessCategory: "",
    noOfOperators: 1,
    brandName: "",
    displayName: "",
    nameOfApplicant: "",
    businessOwnerNationality: "",
    registrationNumber: "",
    residency: "",
    refundPaymentDescription: "",
    productDescription: "",
    instagramLink: "",
    faceBookLink: "",
    preferredTemplateId: "",
    preferredTemplateName: "",
    preferredTemplateIds: [] as string[],
    preferredTemplateNames: [] as string[],
    // Requested quantity per preferred template, parallel to
    // preferredTemplateIds. Sum is capped by event.maxSpacesPerVendor.
    preferredTemplateQuantities: [] as number[],
  };

  const [regImageFile, setRegImageFile] = useState<File | null>(null);
  const [regImagePreview, setRegImagePreview] = useState<string>("");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");

  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [productPreviews, setProductPreviews] = useState<string[]>([]);
  // Product images already stored on a returning vendor's profile. Kept apart
  // from productFiles/productPreviews (which stay parallel for new uploads) so
  // removeProductImage indices don't desync. Counts toward the requirement.
  const [existingProductImages, setExistingProductImages] = useState<string[]>(
    [],
  );

  const [cropOpen, setCropOpen] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropType, setCropType] = useState<"reg" | "logo" | "product">("reg");
  const [cropQueue, setCropQueue] = useState<File[]>([]);

  const [shopkeeperDetails, setShopkeeperDetails] = useState(initialForm);
  // The country picked in each phone field's flag dropdown (from
  // react-phone-input-2's onChange). Drives the per-country digit-length
  // check on submit (India 10, Singapore 8, …).
  const [whatsappCountry, setWhatsappCountry] = useState<any>(null);
  const [phoneCountry, setPhoneCountry] = useState<any>(null);
  // Once the vendor's stall request is Approved, their identity fields
  // (WhatsApp, Phone, Registration Number) are locked — they can't be changed.
  const isStallApproved = existingStallRequest?.status === "Approved";
  // Short "N digits" hint for the country picked in a phone field.
  const phoneHint = (country: any) => {
    if (!country) return null;
    const [min, max] = phoneNationalLength(country.countryCode);
    return min === max ? `${min} digits` : `${min}–${max} digits`;
  };
  // Registration-number rules driven by the selected Residency. Singapore UENs
  // are 9 OR 10 characters (older ACRA business numbers are 9 chars, e.g.
  // 53464793J; companies and other entities are 10, e.g. 201812345A). India
  // GST is always 15. Both alphanumeric. Other residencies have no fixed length.
  const regConfig = (() => {
    const res = String(shopkeeperDetails.residency || "").toLowerCase();
    if (res === "singapore")
      return {
        label: "UEN",
        minLength: 9,
        maxLength: 10,
        example: "UEN — 9 or 10 characters, e.g. 53464793J or 201812345A",
      };
    if (res === "india")
      return {
        label: "GST",
        minLength: 15,
        maxLength: 15,
        example: "GST — 15 characters, e.g. 27AAPFU0939F1ZV",
      };
    return { label: "UEN/GST", minLength: 0, maxLength: 0, example: "" };
  })();

  // A recognizable placeholder for vendors who don't have a GST/UEN. It passes
  // the field's format/length check so they can still submit, but it is NOT a
  // real registration — it deliberately fails the verification APIs. The
  // organizer sees it, reaches out to the vendor, and decides whether to
  // approve. Lengths match each type's requirement (GST 15, UEN 10).
  const dummyRegNumber =
    regConfig.label === "GST"
      ? "NOGSTPROVIDED00"
      : regConfig.label === "UEN"
        ? "NOUENGIVEN"
        : "NOTPROVIDED";
  const isDummyReg = shopkeeperDetails.registrationNumber === dummyRegNumber;

  const { toast } = useToast();

  // --- GST verification (India stalls) via AppyFlow, ported from KiosCart ---
  const APPYFLOW_KEY = import.meta.env.VITE_APPYFLOW_KEY_SECRET;
  const [gstVerifying, setGstVerifying] = useState(false);
  const [gstVerified, setGstVerified] = useState(false);
  const [gstError, setGstError] = useState("");
  // Trimmed, display-ready GST registry details — saved to the vendor and
  // shown to the organizer. Kept so a returning vendor isn't re-verified.
  const [gstDetails, setGstDetails] = useState<any>(null);
  // UEN verification (Singapore) via ACRA's FREE open-data registry
  // (data.gov.sg) — no API key or per-call cost, unlike the GST provider.
  const [uenVerifying, setUenVerifying] = useState(false);
  const [uenVerified, setUenVerified] = useState(false);
  const [uenError, setUenError] = useState("");
  const [uenDetails, setUenDetails] = useState<any>(null);

  const handleVerifyGST = async (raw: string) => {
    const gstin = (raw || "").trim().toUpperCase();
    setGstError("");
    if (!gstin) {
      setGstError("Enter the GST number first.");
      return;
    }
    if (!APPYFLOW_KEY) {
      setGstError("GST verification isn't configured. Contact support.");
      return;
    }
    setGstVerifying(true);
    try {
      const url = `https://appyflow.in/api/verifyGST?gstNo=${encodeURIComponent(
        gstin,
      )}&key_secret=${encodeURIComponent(APPYFLOW_KEY)}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      const valid =
        data?.taxpayerInfo?.sts === "Active" || data?.is_gst_valid === true;
      if (!res.ok || !valid) {
        setGstVerified(false);
        setGstError(
          data?.message ||
            data?.error ||
            "This GST number couldn't be verified. Please check and try again.",
        );
        return;
      }
      setGstVerified(true);
      // Build a clean, display-ready subset (the raw AppyFlow payload is large
      // and noisy). This is what we save on the vendor + show the organizer.
      const addr = data?.taxpayerInfo?.pradr?.addr || data?.pradr?.addr || {};
      const details = {
        gstin,
        legalName: data?.taxpayerInfo?.lgnm || data?.taxablePersonName || "",
        tradeName: data?.taxpayerInfo?.tradeNam || "",
        status: data?.taxpayerInfo?.sts || "Active",
        registrationDate: data?.taxpayerInfo?.rgdt || "",
        constitution: data?.taxpayerInfo?.ctb || "",
        address: [
          addr?.bnm,
          addr?.flno,
          addr?.st,
          addr?.loc,
          addr?.dst,
          addr?.stcd,
          addr?.pncd,
        ]
          .filter(Boolean)
          .join(", "),
        state: addr?.stcd || "",
        verifiedAt: new Date().toISOString(),
      };
      setGstDetails(details);
      const name = details.legalName || details.tradeName || gstin;
      toast({
        duration: 5000,
        title: "GST verified ✓",
        description: `Registered: ${name}`,
      });
    } catch {
      setGstVerified(false);
      setGstError("Couldn't reach the verification service. Try again.");
    } finally {
      setGstVerifying(false);
    }
  };

  // --- UEN verification (Singapore) via ACRA open data (data.gov.sg) ---
  // Free government registry — no key, no cost. Returns entity name, status,
  // type and address for a given UEN.
  const UEN_ACRA_RESOURCE = "d_3f960c10fed6145404ca7b821f263b87";
  const handleVerifyUEN = async (raw: string) => {
    const uen = (raw || "").trim().toUpperCase();
    setUenError("");
    if (!uen) {
      setUenError("Enter the UEN first.");
      return;
    }
    setUenVerifying(true);
    try {
      const filters = encodeURIComponent(JSON.stringify({ uen }));
      const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${UEN_ACRA_RESOURCE}&filters=${filters}&limit=1`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      const rec = data?.result?.records?.[0];
      if (!res.ok || !rec) {
        setUenVerified(false);
        setUenError(
          "This UEN isn't in the ACRA registry. If it's a newly registered entity it may not appear yet — the organizer can double-check it on the official registry.",
        );
        return;
      }
      setUenVerified(true);
      const details = {
        uen: rec.uen || uen,
        entityName: rec.entity_name || "",
        status: rec.uen_status_desc || "",
        entityType: rec.entity_type_desc || "",
        issueDate: rec.uen_issue_date || "",
        agency: rec.issuance_agency_desc || "ACRA",
        address: [rec.reg_street_name, rec.reg_postal_code]
          .filter(Boolean)
          .join(", "),
        verifiedAt: new Date().toISOString(),
      };
      setUenDetails(details);
      toast({
        duration: 5000,
        title: "UEN verified ✓",
        description: `Registered: ${details.entityName || uen}`,
      });
    } catch {
      setUenVerified(false);
      setUenError("Couldn't reach the verification service. Try again.");
    } finally {
      setUenVerifying(false);
    }
  };

  // Country dial codes come from a single shared hook (local data, no network).
  const { countries, loading: loadingCountries } = useCountryCodes();
  const [settings, setSettings] = useState<OrganizerStore | null>(null);
  const [requiresSelection, setRequiresSelection] = useState(false);
  const [shops, setShops] = useState<
    { id: string; shopName: string; approved: boolean }[]
  >([]);
  const [selectedDialogShopId, setSelectedDialogShopId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const stallDetailRef = React.useRef<HTMLDivElement>(null);

  const apiURL = __API_URL__;

  // Resolve the exhibitor's active membership once their email is known
  // (after WhatsApp OTP + vendor lookup or after the rent form is
  // filled). Scoped to this event's organizer so being a member of one
  // organizer doesn't carry over to another. Placed below all state
  // declarations it touches so the deps array can't TDZ at render time.
  useEffect(() => {
    // Match by email OR WhatsApp — the vendor record's email may not
    // exactly equal the exhibitorEmail captured at membership purchase
    // (vendors created via stall flow vs membership flow can drift).
    // Sending both axes lets the backend find the right row either
    // way; an empty email is still a valid request as long as we
    // have a phone number.
    const email = (
      shopkeeperDetails?.email ||
      shopkeeperDetails?.businessEmail ||
      ""
    )
      .toLowerCase()
      .trim();
    const whatsapp = String(shopkeeperDetails?.whatsappNumber || "").trim();
    // `eventData.organizer` is sometimes a populated object and sometimes
    // a raw id string depending on which endpoint loaded the event. Accept
    // either shape so the membership lookup actually fires.
    const organizerIdForLookup =
      (eventData as any)?.organizer?._id ||
      (typeof (eventData as any)?.organizer === "string"
        ? (eventData as any).organizer
        : undefined);
    if ((!email && !whatsapp) || !organizerIdForLookup) {
      // Don't wipe an isMember signal that came from the Vendor row.
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Email goes in the path (the endpoint expects something there
        // for legacy compat); when only WhatsApp is known we send a
        // single space as a placeholder so the query string fires.
        const emailSegment = encodeURIComponent(email || " ");
        const qs = new URLSearchParams({
          organizerId: String(organizerIdForLookup),
        });
        if (whatsapp) qs.set("whatsapp", whatsapp);
        const res = await fetch(
          `${apiURL}/exhibitor-memberships/by-email/${emailSegment}?${qs.toString()}`,
        );
        if (!res.ok) {
          // Don't downgrade an optimistic isMember set from the Vendor
          // row when the lookup endpoint errors. The vendor flag is an
          // independent source of truth.
          return;
        }
        const raw = await res.text();
        const data = raw ? JSON.parse(raw) : null;
        if (cancelled) return;
        if (data) {
          setActiveMembership({
            planName:
              typeof data.planId === "object" ? data.planId?.name : undefined,
            endDate: data.endDate,
          });
        }
        // If data is null, leave activeMembership alone — vendor.isMember
        // may have set it optimistically.
      } catch {
        // network error — keep whatever's already in state
      }
    })();
    return () => {
      cancelled = true;
    };
    // `apiURL` is a Vite compile-time constant — intentionally omitted
    // from deps so the array never references a hoisted local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shopkeeperDetails?.email,
    shopkeeperDetails?.businessEmail,
    shopkeeperDetails?.whatsappNumber,
    (eventData as any)?.organizer?._id,
    (eventData as any)?.organizer,
  ]);

  // Resolve the per-tier pricing for a placed space at the current
  // viewer's membership status. Empty member fields fall through to the
  // regular price so legacy templates keep working.
  //
  // Fallback chain for member fields:
  //   1. value on the placed venueTables row (canonical when present)
  //   2. value on the corresponding tableTemplates entry — covers
  //      legacy events where the placed tables were saved before
  //      member pricing existed, or where the organizer added member
  //      pricing on the template but never re-placed the spaces.
  // The lookup key is the template `id` carried on every placed row.
  const resolveTablePricing = (table: any) => {
    const useMember = isMember;
    const templates: any[] = Array.isArray((eventData as any)?.tableTemplates)
      ? (eventData as any).tableTemplates
      : [];
    const tpl =
      table?.id != null ? templates.find((t: any) => t?.id === table.id) : null;

    const pickMember = (placed: any, fromTpl: any) =>
      placed != null ? placed : fromTpl != null ? fromTpl : null;

    const memberPrice = pickMember(table?.memberPrice, tpl?.memberPrice);
    const memberBookingPrice = pickMember(
      table?.memberBookingPrice,
      tpl?.memberBookingPrice,
    );
    const memberDepositPrice = pickMember(
      table?.memberDepositPrice,
      tpl?.memberDepositPrice,
    );

    const tablePrice =
      useMember && memberPrice != null ? memberPrice : (table?.tablePrice ?? 0);
    const bookingPrice =
      useMember && memberBookingPrice != null
        ? memberBookingPrice
        : (table?.bookingPrice ?? 0);
    const depositPrice =
      useMember && memberDepositPrice != null
        ? memberDepositPrice
        : (table?.depositPrice ?? 0);
    const regularPrice = table?.tablePrice ?? 0;
    const memberSaved =
      useMember && memberPrice != null && regularPrice > memberPrice
        ? regularPrice - memberPrice
        : 0;
    return { tablePrice, bookingPrice, depositPrice, memberSaved };
  };

  // When membership status changes after spaces are already selected,
  // re-resolve the prices on the existing selection. Without this an
  // exhibitor who clicked a space BEFORE the membership lookup finished
  // would keep paying the regular price even after they're recognised.
  // Works in both directions — if a membership lookup invalidates the
  // status mid-session, regular prices come back too.
  useEffect(() => {
    if (selectedTables.length === 0) return;
    setSelectedTables((prev) => {
      let changed = false;
      const next = prev.map((sel: any) => {
        // Find the live template on the canvas so we have its full
        // tier-pricing fields. Fall back to the selection's own
        // snapshot when we can't find it (shouldn't happen, but
        // defensive — a deleted template would still render).
        const tpl: any =
          (availableTables[currentLayoutId] || []).find(
            (t: any) => t.positionId === sel.positionId,
          ) || sel;
        const p = resolveTablePricing(tpl);
        if (
          p.tablePrice === sel.tablePrice &&
          p.bookingPrice === sel.bookingPrice &&
          p.depositPrice === sel.depositPrice
        ) {
          return sel;
        }
        changed = true;
        return {
          ...sel,
          price: p.tablePrice,
          depositAmount: p.depositPrice,
          tablePrice: p.tablePrice,
          bookingPrice: p.bookingPrice,
          depositPrice: p.depositPrice,
          appliedTier: isMember && p.memberSaved > 0 ? "member" : "regular",
          memberSaved: p.memberSaved,
        };
      });
      return changed ? next : prev;
    });
    // Re-run whenever isMember flips. `availableTables`, `selectedTables`,
    // and `currentLayoutId` are read inside but intentionally not in
    // deps — they update orthogonally and we don't want a refresh loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMember]);

  // Fetch event data
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setIsLoading(true);
        // organizationName disambiguates a custom event slug when two
        // different organizers happen to have picked the same one — the
        // backend ignores it entirely when the id segment is a real
        // Mongo ObjectId (the common case), so this is always safe to send.
        const orgQuery = organizationName
          ? `?organizer=${encodeURIComponent(organizationName)}`
          : "";
        const response = await fetch(
          `${apiURL}/events/${eventId || id}${orgQuery}`,
        );
        if (!response.ok) {
          throw new Error("Failed to fetch event");
        }
        const result = await response.json();
        setEventData(result.data);

        // Demo/showcase events can reference a missing organizer (populate
        // returns null), so guard the org lookups — a null organizer must
        // never crash the public event page.
        const organizerId = result.data.organizer?._id;

        if (organizerId) {
          // Fetch organizer store and organizer profile in parallel
          const [organizerStore, organizerProfile] = await Promise.all([
            fetch(
              `${apiURL}/organizer-stores/organizer-store-detail/${organizerId}`,
              {
                method: "GET",
              },
            ),
            fetch(`${apiURL}/organizers/profile-get/${organizerId}`, {
              method: "GET",
            }),
          ]);

          const storeResult = await organizerStore.json();
          const profileResult = await organizerProfile.json();

          if (storeResult.data) {
            setSettings(storeResult.data);
          }

          if (profileResult.data?.country) {
            setCountry(profileResult.data.country);
          }
        }
      } catch (err: any) {
        setError(err.message);
        toast({
          duration: 5000,
          title: "Error",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (eventId || id) {
      fetchEvent();
    }
  }, [eventId, id, organizationName]);

  // Fetch round table availability — only when event has round tables
  const hasRoundTables = (eventData?.venueRoundTables?.length || 0) > 0;
  useEffect(() => {
    if (!hasRoundTables) return;
    const eid = eventId || id;
    if (!eid) return;
    const fetchRoundTables = async () => {
      try {
        const res = await fetch(
          `${apiURL}/round-table-bookings/available/${eid}`,
        );
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data?.roundTables) {
            setRoundTableData(result.data.roundTables);
            // Keep the layout COLLAPSED by default — the visitor clicks the
            // venue name header to reveal the map (incl. round-table chairs).
          }
        }
      } catch {
        // Non-critical
      }
    };
    fetchRoundTables();
  }, [hasRoundTables, eventId, id]);

  // Compute the rendered canvas extents from currently-placed items.
  // Inlined here (and inside the ResizeObservers) instead of using a
  // shared variable because `eventData` may be null until the fetch
  // resolves and the component-body version of this calc lives after
  // the null-guard. Falls back to 800×500 so the fit-to-container math
  // never divides by zero.
  const computeCanvasExtents = () => {
    const PADDING = 80;
    const cfg = eventData?.venueConfig?.[currentLayoutIndex] as any;
    const vw = cfg?.width || 800;
    const vh = cfg?.height || 500;
    // If the organizer cropped the venue, the visitor view shows EXACTLY the
    // separate crop dimensions (the real width/height stay as the reference
    // venue size and are never overwritten). Items outside are filtered out.
    if (cfg?.cropped) {
      return {
        width: Number(cfg.cropWidth) || vw,
        height: Number(cfg.cropHeight) || vh,
      };
    }
    const layoutIds = eventData?.venueConfig?.map((c: any) => c.id) || [];
    const layoutId = layoutIds[currentLayoutIndex] || "default";
    // Only items belonging to the hall being sized count toward its extent.
    // Untagged/legacy ("" / "default") items belong to the first hall only,
    // so another hall's items can't inflate this one into empty space.
    const inLayout = (cfgId?: string) =>
      cfgId && cfgId !== "default"
        ? cfgId === layoutId
        : currentLayoutIndex === 0;
    const tables =
      (eventData?.venueTables?.[layoutId] as any[] | undefined) || [];
    const round = (
      Array.isArray((eventData as any)?.venueRoundTables)
        ? ((eventData as any).venueRoundTables as any[])
        : []
    ).filter((r) => inLayout(r?.venueConfigId));
    const zones = (
      Array.isArray((eventData as any)?.venueSpeakerZones)
        ? ((eventData as any).venueSpeakerZones as any[])
        : []
    ).filter((z) => inLayout(z?.venueConfigId));
    // The venue dimensions (the organizer's crop) are the baseline. Items
    // only extend the canvas if they fall within a sane range — a single
    // stray item dragged thousands of px away (a known data glitch) must NOT
    // blow the canvas up into endless empty space.
    const limitX = Math.max(vw * 5, 6000);
    const limitY = Math.max(vh * 5, 6000);
    let maxX = vw;
    let maxY = vh;
    const addX = (v: number) => {
      if (v <= limitX) maxX = Math.max(maxX, v);
    };
    const addY = (v: number) => {
      if (v <= limitY) maxY = Math.max(maxY, v);
    };
    for (const t of tables) {
      // Match the canvas render: the visible footprint is the resize
      // override when present, else the template size.
      const w = t?.displayWidth ?? t?.width ?? 0;
      const h = t?.displayHeight ?? t?.height ?? 0;
      addX((t?.x || 0) + w);
      addY((t?.y || 0) + h);
    }
    for (const r of round) {
      const d = r?.tableDiameter || 120;
      addX((r?.x || 0) + d);
      addY((r?.y || 0) + d);
    }
    for (const z of zones) {
      addX((z?.x || 0) + (z?.width || 0));
      addY((z?.y || 0) + (z?.height || 0));
    }
    // Doors can be circles (legacy 50×50) or organizer-resized squares.
    const doors = (
      Array.isArray((eventData as any)?.venueDoors)
        ? ((eventData as any).venueDoors as any[])
        : []
    ).filter((d) => inLayout(d?.venueConfigId));
    for (const d of doors) {
      const dw = Number(d?.width) > 0 ? Number(d.width) : 50;
      const dh = Number(d?.height) > 0 ? Number(d.height) : 50;
      addX((d?.x || 0) + dw);
      addY((d?.y || 0) + dh);
    }
    return { width: maxX + PADDING, height: maxY + PADDING };
  };

  useEffect(() => {
    if (showTableSelection && venueContainerRef.current) {
      const container = venueContainerRef.current;
      const resizeObserver = new ResizeObserver(() => {
        if (!container) return;
        const containerWidth = container.offsetWidth;
        const { width: canvasWidth } = computeCanvasExtents();

        if (canvasWidth > 0 && containerWidth > 0) {
          // Fit to WIDTH (same as the public venue map). Width-only keeps a
          // tall venue readable instead of shrinking it to a tiny dot; the
          // box scrolls vertically if it's unusually tall. Capped at 1 so a
          // small venue isn't upscaled and pixelated.
          const newScale = Math.max(
            0.05,
            Math.min((containerWidth / canvasWidth) * 0.98, 1),
          );
          setDynamicScale(newScale);
        }
      });
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }
    // `loadingTables` is included so the observer attaches once the canvas
    // actually mounts (it's hidden behind a spinner while tables load) —
    // otherwise the fit scale stays stale at 1 and the map gets clipped.
  }, [
    showTableSelection,
    currentLayoutIndex,
    eventData?.venueConfig,
    loadingTables,
  ]);

  useEffect(() => {
    const container = venueDisplayContainerRef.current;
    if (container) {
      const resizeObserver = new ResizeObserver(() => {
        if (!container) return;
        const containerWidth = container.offsetWidth;
        const { width: canvasWidth } = computeCanvasExtents();

        if (canvasWidth > 0) {
          // Scale based on width only so the box never exceeds the container width
          const newScale = Math.min((containerWidth / canvasWidth) * 0.98, 1);
          setVenueDisplayScale(newScale);
        }
      });
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }
    // `showVenueLayout` is included so the observer re-attaches when the
    // (collapsible) venue map becomes visible — otherwise the fit-to-width
    // scale stays stale at 1 and the map overflows.
  }, [currentLayoutIndex, eventData?.venueConfig, showVenueLayout]);

  // Fit the canvas inside the maximized dialog by scaling its width/height
  // to whichever axis is the tighter fit. Caps at 1 so we never enlarge
  // beyond the canvas's natural pixel size — the goal is "see everything"
  // not "fill the dialog at any cost".
  useEffect(() => {
    if (!venueMaximized) return;
    const container = maximizedContainerRef.current;
    if (!container) return;
    const fit = () => {
      const { width: cw, height: ch } = computeCanvasExtents();
      if (cw <= 0 || ch <= 0) return;
      const availW = container.clientWidth - 32; // padding allowance
      const availH = container.clientHeight - 32;
      const s = Math.min(availW / cw, availH / ch, 1);
      setMaximizedScale(s > 0 ? s : 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [venueMaximized, currentLayoutIndex, eventData?.venueConfig]);

  // Handle Rent a Stall Click - Show WhatsApp Dialog
  const handleRentStallClick = () => {
    if ((eventData as any)?.isDemo) {
      setShowDemoPrompt(true);
      return;
    }
    setShowWhatsAppDialog(true);
    setWhatsappNumber("");
    setWhatsappOtp("");
    setWhatsappOtpSent(false);
    setWhatsappVerified(false);
    setShopkeeperExists(false);
    setShopkeeperDetails(initialForm);
    setRequiresSelection(false); // <--- ADD THIS
    setSelectedDialogShopId("");
    setStallGoogleLoading(false);
    setStallMembership(null);
  };

  // --- Scheduled Spaces booking workflow ---

  const routeScheduledSpaceRequest = (request: any) => {
    setExistingScheduledSpaceRequest(request);
    if (request.status === "Confirmed") {
      // Re-apply the referral code the visitor registered with (if any) so
      // any operator-assigned spaces they unlocked reappear automatically —
      // they never have to retype the code at this step.
      fetchAvailableScheduledSpaces(request.referralCode);
      setShowScheduledSpacePicker(true);
    } else {
      setShowScheduledSpaceStatus(true);
    }
  };

  // Always opens on the Google sign-in step — no session-remembered
  // shortcut. Even a visitor who registered minutes ago sees "Continue with
  // Google" again; resolveScheduledSpaceAfterGoogle is what actually looks
  // up their existing request (by their verified email) and routes them
  // straight to their status/ticket once signed in.
  const handleScheduledSpaceClick = () => {
    if ((eventData as any)?.isDemo) {
      setShowDemoPrompt(true);
      return;
    }
    setScheduledSpaceForm({
      name: "",
      email: "",
      phone: "",
      whatsappNumber: "",
      facilityType:
        allScheduledSpaceFacilityTypes.length === 1
          ? allScheduledSpaceFacilityTypes[0]
          : "",
      purpose: "",
      organization: "",
      companions: [],
      referralCode: "",
    });
    setScheduledSpaceStep("auth");
    setShowScheduledSpaceForm(true);
    // Fetch slot availability now (not just after registration) so the
    // "Type of Space Required" dropdown can show which facility types still
    // have open slots while the registrant is filling in the form.
    fetchAvailableScheduledSpaces();
  };

  // Same fetch-blob-and-trigger-download shape as the Stall ticket's
  // handleDownload, pointed at the Scheduled Space download endpoint.
  const handleDownloadScheduledSpaceTicket = async () => {
    const request = existingScheduledSpaceRequest;
    if (!request?._id) return;
    setDownloadingScheduledSpaceTicket(true);
    try {
      const response = await fetch(
        `${apiURL}/scheduled-spaces/${request._id}/download-ticket`,
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to download ticket");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `scheduled_space_ticket_${(eventData as any)?.title || request._id}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Couldn't download ticket",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingScheduledSpaceTicket(false);
    }
  };

  // Google sign-in gate for the booking form — same popup + postMessage /
  // localStorage handshake as Rent-a-Stall and Become-a-Sponsor use. On
  // success we silently check for an existing request under that email
  // (routing straight to status/slot-picker if found) before falling back
  // to a blank form with the verified email pre-filled.
  const handleScheduledSpaceGoogleLogin = () => {
    const url = `${apiURL}/auth/google-member`;
    const w = 480;
    const h = 600;
    const left =
      typeof window !== "undefined"
        ? window.screenX + (window.outerWidth - w) / 2
        : 0;
    const top =
      typeof window !== "undefined"
        ? window.screenY + (window.outerHeight - h) / 2
        : 0;
    const popup = window.open(
      url,
      "eventsh-google-member",
      `width=${w},height=${h},left=${left},top=${top}`,
    );
    if (!popup) {
      toast({
        duration: 5000,
        title: "Popup blocked",
        description: "Allow pop-ups for this site and try again.",
        variant: "destructive",
      });
      return;
    }
    scheduledSpacePopupRef.current = popup;
    setScheduledSpaceGoogleLoading(true);
  };

  const resolveScheduledSpaceAfterGoogle = async (
    email: string,
    name?: string,
  ) => {
    try {
      const res = await fetch(
        `${apiURL}/scheduled-spaces/check-request/${(eventData as any)?._id}/${encodeURIComponent(email)}`,
      );
      const result = await res.json().catch(() => null);
      if (res.ok && Array.isArray(result?.requests) && result.requests.length > 1) {
        // More than one request on record for this email — let them pick
        // which to view, or start a new one, rather than guessing.
        setScheduledSpaceRequestList(result.requests);
        setShowScheduledSpaceForm(false);
        setShowScheduledSpaceRequestListChoice(true);
        return;
      }
      if (res.ok && result?.data) {
        setShowScheduledSpaceForm(false);
        routeScheduledSpaceRequest(result.data);
        return;
      }
    } catch {
      // No existing request (or a transient error) — fall through to the
      // blank form. Not finding one is the normal, expected case here.
    }
    setScheduledSpaceForm((p) => ({ ...p, email, name: p.name || name || "" }));
    setScheduledSpaceReferralResolved(false);
    setScheduledSpaceMatchedOperator(null);
    setScheduledSpaceReferralInvalid(false);
    setScheduledSpaceStep("form");
  };

  // Resets to a blank registration form and, since the visitor is already
  // Google-verified in this session, skips straight to the "form" step —
  // used both from the multi-request list chooser and from a terminal
  // (Completed/Cancelled/Rejected) request's status view, the two places a
  // visitor can choose to start another request. Same POST /register
  // endpoint as a first-time registration; the backend only blocks a
  // second *active* request, not a second request outright.
  const startNewScheduledSpaceRequest = () => {
    const email =
      existingScheduledSpaceRequest?.email || scheduledSpaceForm.email;
    const name = existingScheduledSpaceRequest?.name || "";
    setShowScheduledSpaceStatus(false);
    setShowScheduledSpaceRequestListChoice(false);
    setScheduledSpaceForm({
      name,
      email,
      phone: "",
      whatsappNumber: "",
      facilityType:
        allScheduledSpaceFacilityTypes.length === 1
          ? allScheduledSpaceFacilityTypes[0]
          : "",
      purpose: "",
      organization: "",
      companions: [],
      referralCode: "",
    });
    setScheduledSpaceReferralResolved(false);
    setScheduledSpaceMatchedOperator(null);
    setScheduledSpaceReferralInvalid(false);
    setScheduledSpaceStep("form");
    setShowScheduledSpaceForm(true);
    fetchAvailableScheduledSpaces();
  };

  useEffect(() => {
    if (!scheduledSpaceGoogleLoading) return;
    const KEY = "eventsh:google-member";
    const prev = (() => {
      try {
        return localStorage.getItem(KEY) || "";
      } catch {
        return "";
      }
    })();
    let handled = false;
    let sawPopupClosed = false;

    const accept = (rawEmail: string, name?: string) => {
      const clean = String(rawEmail || "").trim().toLowerCase();
      setScheduledSpaceGoogleLoading(false);
      if (!clean) {
        toast({
          duration: 5000,
          title: "Sign-in failed",
          description: "Couldn't read your Google email.",
          variant: "destructive",
        });
        return;
      }
      resolveScheduledSpaceAfterGoogle(clean, name);
    };

    const onMessage = (ev: MessageEvent) => {
      const d = ev?.data;
      if (!d || d.kind !== "eventsh:google-member" || handled) return;
      handled = true;
      accept(d.email || "", d.name);
    };
    window.addEventListener("message", onMessage);

    const t = window.setInterval(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw && raw !== prev && !handled) {
          handled = true;
          window.clearInterval(t);
          localStorage.removeItem(KEY);
          const parsed = JSON.parse(raw);
          accept(parsed?.email || "", parsed?.name);
          return;
        }
      } catch {
        // ignore
      }
      if (
        scheduledSpacePopupRef.current &&
        scheduledSpacePopupRef.current.closed &&
        !handled
      ) {
        if (sawPopupClosed) {
          window.clearInterval(t);
          setScheduledSpaceGoogleLoading(false);
        } else {
          sawPopupClosed = true;
        }
      }
    }, 500);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledSpaceGoogleLoading]);

  const handleScheduledSpaceFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!scheduledSpaceForm.name.trim()) missing.push("Full Name");
    if (!scheduledSpaceForm.email.trim()) missing.push("Email");
    if (
      scheduledSpaceOn("whatsappNumber") &&
      !scheduledSpaceForm.whatsappNumber?.trim()
    )
      missing.push("WhatsApp Number");
    if (scheduledSpaceOn("phone") && !scheduledSpaceForm.phone?.trim())
      missing.push("Phone Number");
    if (
      scheduledSpaceOn("facilityType") &&
      scheduledSpaceFacilityTypes.length > 0 &&
      !scheduledSpaceForm.facilityType
    )
      missing.push("Type of Space Required");
    if (missing.length > 0) {
      toast({
        duration: 5000,
        title: "Please fill in all required fields",
        description: missing.join(", "),
        variant: "destructive",
      });
      return;
    }
    setScheduledSpaceLoading(true);
    try {
      const res = await fetch(`${apiURL}/scheduled-spaces/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: (eventData as any)?._id,
          organizerId: (eventData as any)?.organizer?._id,
          name: scheduledSpaceForm.name,
          email: scheduledSpaceForm.email,
          phone: scheduledSpaceForm.phone || undefined,
          whatsappNumber: scheduledSpaceForm.whatsappNumber || undefined,
          facilityTypeRequested: scheduledSpaceForm.facilityType || undefined,
          purpose: scheduledSpaceForm.purpose || undefined,
          organization: scheduledSpaceForm.organization || undefined,
          referralCode: scheduledSpaceForm.referralCode?.trim() || undefined,
          companions: scheduledSpaceForm.companions
            .map((c) => c.trim())
            .filter(Boolean),
        }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.message || "Failed to submit registration");
      }
      setShowScheduledSpaceForm(false);
      // No approval gate — registration is confirmed immediately, so this
      // routes straight into the slot picker (routeScheduledSpaceRequest
      // treats "Confirmed" as "go pick a space & time slot now").
      routeScheduledSpaceRequest(result.data);
      toast({
        duration: 5000,
        title: "Registration confirmed",
        description: "Pick your space and time slot to continue.",
      });
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Couldn't submit registration",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setScheduledSpaceLoading(false);
    }
  };

  const fetchAvailableScheduledSpaces = async (referralCode?: string) => {
    try {
      const code = referralCode?.trim();
      const url = `${apiURL}/scheduled-spaces/available/${(eventData as any)?._id}${
        code ? `?referralCode=${encodeURIComponent(code)}` : ""
      }`;
      const res = await fetch(url);
      const result = await res.json();
      setScheduledSpacesAvailable(result?.data?.spaces || []);
      setScheduledSpaceMatchedOperator(result?.data?.matchedOperator || null);
      setScheduledSpaceReferralInvalid(!!result?.data?.referralCodeInvalid);
    } catch {
      setScheduledSpacesAvailable([]);
      setScheduledSpaceMatchedOperator(null);
      setScheduledSpaceReferralInvalid(false);
    }
  };

  // Validates whatever the registrant typed and unlocks the rest of the
  // form — the space list underneath (facility-type dropdown, and later
  // the slot picker) only ever reflects this resolved code.
  const applyScheduledSpaceReferralCode = async () => {
    setScheduledSpaceCheckingReferral(true);
    await fetchAvailableScheduledSpaces(scheduledSpaceForm.referralCode);
    setScheduledSpaceCheckingReferral(false);
    setScheduledSpaceReferralResolved(true);
  };

  // "No Coupon" — proceeds with the public space list only, same as never
  // having entered a code.
  const skipScheduledSpaceReferralCode = async () => {
    setScheduledSpaceForm((p) => ({ ...p, referralCode: "" }));
    setScheduledSpaceCheckingReferral(true);
    await fetchAvailableScheduledSpaces();
    setScheduledSpaceCheckingReferral(false);
    setScheduledSpaceReferralResolved(true);
  };

  const toggleScheduledSlotSelection = (space: any, slot: any) => {
    const key = `${space.positionId}:${slot.id}`;
    setSelectedScheduledSlots((prev) => {
      const exists = prev.some((s) => `${s.positionId}:${s.slotId}` === key);
      if (exists) {
        return prev.filter((s) => `${s.positionId}:${s.slotId}` !== key);
      }
      return [
        ...prev,
        {
          positionId: space.positionId,
          templateId: space.templateId,
          slotId: slot.id,
          spaceName: space.name,
          facilityType: space.facilityType,
          slotLabel: slot.label,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          price: space.price || 0,
        },
      ];
    });
  };

  const handleScheduledSpaceSlotsSubmit = async () => {
    if (selectedScheduledSlots.length === 0) {
      toast({
        duration: 5000,
        title: "Pick at least one slot",
        variant: "destructive",
      });
      return;
    }
    const total = selectedScheduledSlots.reduce(
      (sum, s) => sum + (s.price || 0),
      0,
    );

    // Free/charity space (organizer never set a price) — there's nothing to
    // pay, so the payment page (QR/transaction proof) doesn't apply. Submit
    // the slot selection directly instead, same as the paid path minus the
    // proof-of-payment fields — the organizer still approves it manually
    // before the ticket is issued.
    if (total === 0) {
      setScheduledSpaceSlotsSubmitting(true);
      try {
        const res = await fetch(
          `${apiURL}/scheduled-spaces/${existingScheduledSpaceRequest?._id}/select-slots`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              // Only identity fields are accepted by the DTO — price/name/
              // date/time are re-resolved server-side. Same shape the paid
              // flow (scheduledSpacePaymentPage.tsx) sends.
              selectedSlots: selectedScheduledSlots.map((s) => ({
                positionId: s.positionId,
                templateId: s.templateId,
                slotId: s.slotId,
              })),
            }),
          },
        );
        const result = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(result?.message || "Failed to submit your booking");
        }
        setExistingScheduledSpaceRequest(result.data);
        setSelectedScheduledSlots([]);
        setShowScheduledSpacePicker(false);
        setShowScheduledSpaceStatus(true);
        toast({
          duration: 5000,
          title: "Booking submitted",
          description:
            "This space is free — no payment needed. The organizer will confirm your slot shortly.",
        });
      } catch (err: any) {
        toast({
          duration: 5000,
          title: "Couldn't submit your booking",
          description: err?.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setScheduledSpaceSlotsSubmitting(false);
      }
      return;
    }

    navigate("/scheduled-space-payment", {
      state: {
        requestId: existingScheduledSpaceRequest?._id,
        eventId: (eventData as any)?._id,
        eventInfo: {
          title: (eventData as any)?.title,
          date: (eventData as any)?.startDate,
          venue: (eventData as any)?.location,
        },
        registrant: {
          name: existingScheduledSpaceRequest?.name,
          email: existingScheduledSpaceRequest?.email,
        },
        selectedSlots: selectedScheduledSlots,
        total,
      },
    });
  };

  // Send WhatsApp OTP
  const handleSendWhatsAppOtp = async () => {
    if (!whatsappNumber || whatsappNumber.length < 10) {
      toast({
        duration: 5000,
        title: "Invalid Number",
        description: "Please enter a valid WhatsApp number",
        variant: "destructive",
      });
      return;
    }

    setSendingWhatsappOtp(true);
    try {
      const res = await fetch(`${apiURL}/otp/send-whatsapp-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: whatsappNumber,
          role: "shopkeeper",
        }),
      });

      if (!res.ok) throw new Error("Failed to send WhatsApp OTP");
      const data = await res.json();

      if (data.message === "OTP sent to WhatsApp") {
        setWhatsappOtpSent(true);
        toast({
          duration: 5000,
          title: "OTP Sent",
          description: "Please check WhatsApp for OTP",
        });
      } else {
        throw new Error(data.message || "Failed to send OTP");
      }
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSendingWhatsappOtp(false);
    }
  };

  // Verify WhatsApp OTP
  // Verify WhatsApp OTP
  const handleVerifyWhatsAppOtp = async () => {
    if (!whatsappOtp || whatsappOtp.length < 4) {
      toast({
        duration: 5000,
        title: "Invalid OTP",
        description: "Please enter a valid OTP",
        variant: "destructive",
      });
      return;
    }

    setVerifyingWhatsappOtp(true);
    try {
      const payload: any = {
        // Adding the '+' prefix here
        whatsappNumber: whatsappNumber.startsWith("+")
          ? whatsappNumber
          : `+${whatsappNumber}`,
        otp: whatsappOtp,
        role: "shopkeeper",
      };

      // If user has selected a shop from the dropdown, include it
      if (selectedDialogShopId) {
        payload.shopId = selectedDialogShopId;
      }

      const res = await fetch(`${apiURL}/otp/verify-chat-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Invalid OTP");

      // CASE A: Multiple Shops Found -> Show Selection UI
      if (data.requiresSelection && data.shops) {
        setShops(data.shops);
        setRequiresSelection(true);
        return;
      }

      // CASE B: Success (Single Shop or Shop Selected)
      if (data.message === "OTP verified" || data.data) {
        sessionStorage.removeItem("token");
        setWhatsappVerified(true);
        toast({
          duration: 5000,
          title: "Verified",
          description: "WhatsApp number verified successfully",
        });

        // Fetch the shopkeeper data (pass specific shop ID if selected)
        await checkShopkeeperExists(
          whatsappNumber,
          selectedDialogShopId || data.data?.shopId,
        );
      }
    } catch (err: any) {
      // FIXED: We no longer call checkShopkeeperExists on error!
      toast({
        duration: 5000,
        title: "Verification Failed",
        description: err.message || "Invalid OTP",
        variant: "destructive",
      });
    } finally {
      setVerifyingWhatsappOtp(false);
    }
  };

  // Prefill the rent form from a vendor record (shared by the WhatsApp and
  // Google sign-in lookups) and route the user to the right next screen.
  // `fallbackWhatsApp` keeps the verified WhatsApp number when the vendor
  // doc itself doesn't carry one (e.g. matched only by email).
  const applyVendorRecord = async (
    shopData: any,
    fallbackWhatsApp?: string,
  ) => {
    // Applying an existing profile is never a "register new" flow.
    setRegisterNewMode(false);
    setShopkeeperExists(true);
    setShopkeeperId(shopData._id);
    // Denormalised member flag — set by the memberships pipeline
    // whenever an active enrollment exists for this vendor. Drives
    // the eventfront's Member-price tier the instant the vendor
    // logs in, before the per-organizer email lookup completes.
    if (shopData.isMember) {
      setActiveMembership((prev) => prev || { planName: undefined });
    }
    setShopkeeperDetails({
      shopName: shopData.businessName || shopData.shopName || "",
      name: shopData.name || "",
      email: shopData.email || shopData.businessEmail || "",
      businessEmail: shopData.businessEmail || shopData.email || "",
      phone: shopData.phoneNumber || shopData.phone || "",
      address: shopData.address || "",
      description:
        shopData.productDescription || shopData.businessDescription || "",
      whatsappNumber:
        shopData.whatsAppNumber ||
        shopData.whatsappNumber ||
        fallbackWhatsApp ||
        "",
      taxPercentage: shopData.taxPercentage || 0,
      businessCategory:
        shopData.businessCategory || shopData.businessType || "",
      noOfOperators: shopData.noOfOperators || 0,
      brandName: shopData.brandName || "",
      displayName: shopData.displayName || "",
      nameOfApplicant: shopData.nameOfApplicant || "",
      businessOwnerNationality: shopData.businessOwnerNationality || "",
      productDescription: shopData.productDescription || "",
      instagramLink: shopData.instagramLink || "",
      faceBookLink: shopData.faceBookLink || "",
      registrationNumber: shopData.registrationNumber || "",
      residency: shopData.residency || "",
      refundPaymentDescription: shopData.refundPaymentDescription || "",
      preferredTemplateId: "",
      preferredTemplateName: "",
      preferredTemplateIds: [] as string[],
      preferredTemplateNames: [] as string[],
      preferredTemplateQuantities: [] as number[],
    });
    setEmailVerified(true); // Assume verified if exists

    // Returning vendor whose GST was already verified — restore that state so
    // we don't spend another external GST-API call re-verifying the same
    // number. The cached registry details also stay visible to the organizer.
    if (shopData.isGSTVerified) {
      setGstVerified(true);
      setGstDetails(shopData.gstDetails || null);
      setGstError("");
    } else {
      setGstVerified(false);
      setGstDetails(null);
    }
    if (shopData.isUENVerified) {
      setUenVerified(true);
      setUenDetails(shopData.uenDetails || null);
      setUenError("");
    } else {
      setUenVerified(false);
      setUenDetails(null);
    }

    // Load any stored brand assets as previews so the (now mandatory) image
    // fields are satisfied without forcing a returning vendor to re-upload.
    // No new File is set, so the server keeps the existing image on submit.
    const toAbs = (p: string) =>
      p && /^https?:\/\//.test(p) ? p : p ? `${__API_URL__}${p}` : "";
    setRegImageFile(null);
    setRegImagePreview(toAbs(shopData.registrationImage || ""));
    setLogoFile(null);
    setLogoPreview(toAbs(shopData.companyLogo || ""));
    setProductFiles([]);
    setProductPreviews([]);
    setExistingProductImages(
      Array.isArray(shopData.productImage)
        ? shopData.productImage.map(toAbs).filter(Boolean)
        : [],
    );

    toast({
      duration: 5000,
      title: "Shopkeeper Found",
      description: "Your details have been loaded",
    });

    // Fetch existing request. fetchExistingRequest will handle opening the right dialog.
    await fetchExistingRequest(shopData._id, eventData?._id);
  };

  // Check if shopkeeper exists
  // Check if shopkeeper exists
  const checkShopkeeperExists = async (
    whatsAppNum: string,
    specificShopId?: string,
  ) => {
    try {
      // If a specific shop was selected from multiple, try fetching it directly. Otherwise use phone number.
      const fetchUrl = specificShopId
        ? `${apiURL}/stalls/vendor/detail/${specificShopId}`
        : `${apiURL}/stalls/vendor/profile/+${whatsAppNum}`;

      const res = await fetch(fetchUrl);

      if (res.ok) {
        const data = await res.json();
        // Depending on your backend, data might be nested in data.data or just data
        const shopData = data.data || data;

        if (shopData && (shopData.name || shopData.businessName)) {
          // Vendor exists - prefill form with saved details
          await applyVendorRecord(shopData, whatsAppNum);
          return; // <--- CRITICAL FIX: Stop execution here so the rent form doesn't blindly open
        }
      }

      // If not found or API failed, show empty form
      setShopkeeperExists(false);
      setShopkeeperDetails({ ...initialForm, whatsappNumber: whatsAppNum });
      setShowWhatsAppDialog(false);
      setShowRentForm(true);
    } catch (error) {
      console.error("Error checking shopkeeper:", error);
      setShopkeeperExists(false);
      setShopkeeperDetails({ ...initialForm, whatsappNumber: whatsAppNum });
      setShowWhatsAppDialog(false);
      setShowRentForm(true);
    }
  };

  // --- Google sign-in path for Rent a Stall ---
  // Mirrors the "Become a member" popup flow: open the backend-mediated
  // Google OAuth endpoint in a popup, receive the verified email via
  // postMessage / localStorage handshake, then look the email up in the
  // vendors collection (by email OR businessEmail). If a vendor is found
  // we prefill exactly like the WhatsApp path; otherwise we open a blank
  // rent form with the email pre-filled so they can register.
  const popupRef = useRef<Window | null>(null);

  const handleGoogleStallLogin = () => {
    const url = `${apiURL}/auth/google-member`;
    const w = 480;
    const h = 600;
    const left =
      typeof window !== "undefined"
        ? window.screenX + (window.outerWidth - w) / 2
        : 0;
    const top =
      typeof window !== "undefined"
        ? window.screenY + (window.outerHeight - h) / 2
        : 0;
    const popup = window.open(
      url,
      "eventsh-google-member",
      `width=${w},height=${h},left=${left},top=${top}`,
    );
    if (!popup) {
      toast({
        duration: 5000,
        title: "Popup blocked",
        description: "Allow pop-ups for this site and try again.",
        variant: "destructive",
      });
      return;
    }
    popupRef.current = popup;
    setStallGoogleLoading(true);
  };

  // Load the membership card for a vendor (after a profile is chosen).
  const resolveStallMembership = async (vendor: any, email: string) => {
    if (!vendor?.isMember) {
      setStallMembership(null);
      return;
    }
    let planName = "Member";
    let endDate: string | undefined = vendor.membershipEndDate;
    let color: string | undefined;
    try {
      const orgId = eventData?.organizer?._id;
      if (orgId) {
        const mRes = await fetch(
          `${apiURL}/exhibitor-memberships/by-email/${encodeURIComponent(
            email,
          )}?organizerId=${orgId}`,
        );
        const txt = await mRes.text();
        const m = txt ? JSON.parse(txt) : null;
        if (m) {
          planName = m.planId?.name || planName;
          endDate = m.endDate || endDate;
          color = m.planId?.color;
        }
      }
    } catch {
      // non-fatal — fall back to the vendor's denormalised fields
    }
    setStallMembership({ planName, endDate, color });
  };

  // Rules & Regulations gate content: Special Instructions, Refund Policy,
  // Terms & Conditions, every visible Custom Section, and the stall terms
  // checklist. Age Restriction & Dress Code are intentionally excluded. Each
  // HTML block respects the organizer's per-section visibility toggle.
  const getStallGateContent = () => {
    const ev: any = eventData || {};
    const secVis =
      (ev?.sectionVisibility as Record<string, boolean> | undefined) || {};
    const shown = (k: string) => secVis[k] !== false;

    // Rich-text (HTML) sections, in reading order.
    const htmlSections: { key: string; title: string; html: string }[] = [];
    if (shown("specialInstructions") && (ev.specialInstructions || "").trim())
      htmlSections.push({
        key: "specialInstructions",
        title: "Special Instructions",
        html: ev.specialInstructions,
      });
    if (shown("refundPolicy") && (ev.refundPolicy || "").trim())
      htmlSections.push({
        key: "refundPolicy",
        title: "Refund Policy",
        html: ev.refundPolicy,
      });
    if (shown("termsAndConditions") && (ev.termsAndConditions || "").trim())
      htmlSections.push({
        key: "termsAndConditions",
        title: "Terms & Conditions",
        html: ev.termsAndConditions,
      });
    // Custom sections the organizer added.
    (Array.isArray(ev.customSections) ? ev.customSections : [])
      .filter(
        (s: any) =>
          ((s?.heading || "").trim() || (s?.content || "").trim()) &&
          secVis[s?.id] !== false,
      )
      .forEach((s: any) =>
        htmlSections.push({
          key: s.id || s.heading,
          title: (s.heading || "").trim() || "More Information",
          html: s.content || "",
        }),
      );

    // Stall-specific terms checklist.
    const terms = (ev.termsAndConditionsforStalls || []).filter((t: any) =>
      (t?.termsAndConditionsforStalls || "").trim(),
    );

    return {
      htmlSections,
      terms,
      hasAny: htmlSections.length > 0 || terms.length > 0,
    };
  };

  // Vendor accepted the rules → dismiss the gate; the stall form (already
  // requested open) then renders because it's now acknowledged. Record the
  // acceptance against every term so the later payment-step terms card is
  // already satisfied (no double-accepting the same fine print).
  const acceptStallGate = () => {
    const terms = eventData?.termsAndConditionsforStalls || [];
    const allChecked: Record<number, boolean> = {};
    terms.forEach((_: any, i: number) => {
      allChecked[i] = true;
    });
    setStallTermsChecked(allChecked);
    setStallGateAcknowledged(true);
    setStallGateScrolledEnd(false);
    setShowStallTermsGate(false);
  };

  // Vendor dismissed the rules without accepting → cancel the whole form open.
  const cancelStallGate = () => {
    setShowStallTermsGate(false);
    setStallGateScrolledEnd(false);
    setShowRentForm(false);
  };

  // Open a BLANK rent form for a NEW vendor profile under the authenticated
  // email. The email stays locked (emailVerified); submit force-creates a new
  // vendor so this email can own multiple linked profiles.
  const startRegisterNew = (email: string) => {
    setRegisterNewMode(true);
    setShopkeeperExists(false);
    setShopkeeperId(null);
    setStallMembership(null);
    setShopkeeperDetails({
      ...initialForm,
      email,
      businessEmail: email,
    });
    setEmailVerified(true); // Google-verified — keep the primary email locked
    setRegImageFile(null);
    setRegImagePreview("");
    setLogoFile(null);
    setLogoPreview("");
    setProductFiles([]);
    setProductPreviews([]);
    setExistingProductImages([]);
    setShowAccountChooser(false);
    setShowCompletedChoice(false);
    setShowRegisterTargetChoice(false);
    setShowWhatsAppDialog(false);
    setShowRentForm(true);
  };

  // Open the rent form to register ANOTHER request under the SAME vendor
  // profile the booker just previewed. The profile is already prefilled (we got
  // here via continueWithVendor → applyVendorRecord), so we keep shopkeeperId /
  // shopkeeperExists intact and ensure registerNewMode is off — submit then
  // passes the existing shopkeeperId (no forceNewVendor), and the backend's
  // existing-request guard ignores Completed bookings, so a fresh Pending stall
  // is created under this same vendor.
  const startRegisterForSelf = () => {
    setRegisterNewMode(false);
    setShowRegisterTargetChoice(false);
    setShowCompletedChoice(false);
    setShowAccountChooser(false);
    setShowWhatsAppDialog(false);
    setShowRentForm(true);
  };

  // Continue with a specific existing vendor profile: prefill, then route by
  // that vendor's request status for this event (applyVendorRecord →
  // fetchExistingRequest). A completed cycle opens the preview/register choice.
  const continueWithVendor = async (vendor: any, email: string) => {
    setRegisterNewMode(false);
    setShowAccountChooser(false);
    await resolveStallMembership(vendor, email);
    await applyVendorRecord(vendor);
  };

  // Google sign-in result handler. Looks up ALL vendor profiles for the email
  // (linked accounts) and branches: 0 → fresh registration, 1 → continue,
  // 2+ → account chooser.
  const lookupVendorByEmail = async (email: string) => {
    const clean = String(email || "")
      .trim()
      .toLowerCase();
    if (!clean) {
      setStallGoogleLoading(false);
      toast({
        duration: 5000,
        title: "Sign-in failed",
        description: "Couldn't read your Google email.",
        variant: "destructive",
      });
      return;
    }
    setAuthedEmail(clean);
    try {
      const res = await fetch(
        `${apiURL}/stalls/vendors/by-email/${encodeURIComponent(clean)}`,
      );
      const json = res.ok ? await res.json() : { data: [] };
      const list: any[] = Array.isArray(json?.data) ? json.data : [];
      setLinkedVendors(list);
      setStallGoogleLoading(false);
      if (list.length === 0) {
        startRegisterNew(clean);
        toast({
          duration: 5000,
          title: "Let's get you set up",
          description: "No saved profile found — please fill in your details.",
        });
      } else if (list.length === 1) {
        await continueWithVendor(list[0], clean);
      } else {
        // Multiple linked profiles on this email → let the booker pick one.
        setShowWhatsAppDialog(false);
        setShowAccountChooser(true);
      }
    } catch (error) {
      console.error("Vendor email lookup failed:", error);
      setStallGoogleLoading(false);
      startRegisterNew(clean);
    }
  };

  // Listen for the Google profile while the stall dialog is open and a
  // sign-in is in flight. Two delivery channels (postMessage + polled
  // localStorage handshake) mirror EventfrontMemberDialog so the result
  // lands even on browsers that sever window.opener on cross-origin
  // popup navigations.
  useEffect(() => {
    if (!showWhatsAppDialog || !stallGoogleLoading) return;
    const KEY = "eventsh:google-member";
    const prev = (() => {
      try {
        return localStorage.getItem(KEY) || "";
      } catch {
        return "";
      }
    })();
    let handled = false;
    let sawPopupClosed = false;

    const onMessage = (ev: MessageEvent) => {
      const data = ev?.data;
      if (!data || data.kind !== "eventsh:google-member" || handled) return;
      handled = true;
      lookupVendorByEmail(data.email || "");
    };
    window.addEventListener("message", onMessage);

    const t = window.setInterval(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw && raw !== prev && !handled) {
          handled = true;
          window.clearInterval(t);
          localStorage.removeItem(KEY);
          const parsed = JSON.parse(raw);
          lookupVendorByEmail(parsed?.email || "");
          return;
        }
      } catch {
        // ignore — private mode, quota, etc.
      }
      // Abandon only after the popup has been closed for more than one
      // tick, so a fast close() doesn't race the handshake.
      if (popupRef.current && popupRef.current.closed && !handled) {
        if (sawPopupClosed) {
          window.clearInterval(t);
          setStallGoogleLoading(false);
        } else {
          sawPopupClosed = true;
        }
      }
    }, 500);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWhatsAppDialog, stallGoogleLoading]);

  // --- Google sign-in path for "Apply as Speaker" ---
  // Speaker applications used to open with a WhatsApp OTP gate. They are now
  // Google-only, mirroring Rent a Stall: the verified Google email IS the
  // identity, and every existing-application lookup keys off that email
  // instead of a phone number.
  const speakerPopupRef = useRef<Window | null>(null);

  const handleGoogleSpeakerLogin = () => {
    const url = `${apiURL}/auth/google-member`;
    const w = 480;
    const h = 600;
    const left =
      typeof window !== "undefined"
        ? window.screenX + (window.outerWidth - w) / 2
        : 0;
    const top =
      typeof window !== "undefined"
        ? window.screenY + (window.outerHeight - h) / 2
        : 0;
    const popup = window.open(
      url,
      "eventsh-google-speaker",
      `width=${w},height=${h},left=${left},top=${top}`,
    );
    if (!popup) {
      toast({
        duration: 5000,
        title: "Popup blocked",
        description: "Allow pop-ups for this site and try again.",
        variant: "destructive",
      });
      return;
    }
    speakerPopupRef.current = popup;
    setSpeakerGoogleLoading(true);
  };

  // Speaker spaces the organizer opened to outside applicants, with their
  // prices — the menu for step 3 of the wizard.
  const openSpeakerSlots = useMemo(
    () =>
      ((eventData as any)?.speakerSlotTemplates || []).filter(
        (s: any) => s?.openForApplications,
      ),
    [eventData],
  );

  // PhoneInput hands back bare digits with the dial code prepended; the
  // notification senders expect an E.164 string. Empty stays empty — the
  // phone is optional now that Google carries the identity.
  const speakerPhoneE164 = () => {
    const raw = String(speakerFormData.phone || "").trim();
    if (!raw) return "";
    return raw.startsWith("+") ? raw : `+${raw}`;
  };

  /**
   * Submit the speaker application (end of step 3).
   *
   * Sends the chosen speaker space so the SERVER can price it — the fee is
   * resolved from the event's slot templates and frozen on the request, so a
   * later price change can't re-bill an application already in flight. What
   * happens after approval follows from that fee: free slots issue the pass
   * automatically, paid slots wait for payment.
   */
  const submitSpeakerApplication = async () => {
    if (isEventOver(eventData)) {
      toast({
        title: "This event has ended",
        description: "Speaker applications are closed for this event.",
        variant: "destructive",
      });
      return;
    }
    setSpeakerSubmitting(true);
    try {
      const sessions = [
        {
          topic: speakerFormData.sessionTopic,
          description: speakerFormData.sessionDescription,
          preferredStartTime: speakerFormData.preferredStartTime || "",
          preferredEndTime: speakerFormData.preferredEndTime || "",
        },
      ];
      const email = speakerFormData.email || speakerAuthedEmail;
      const organizerId = String(
        (eventData as any)?.organizer?._id || (eventData as any)?.organizer || "",
      );

      let res: Response;
      if (speakerFormData.photoFile) {
        const fd = new FormData();
        fd.append("image", speakerFormData.photoFile);
        fd.append("eventId", eventData?._id || "");
        fd.append("organizerId", organizerId);
        fd.append("name", speakerFormData.name);
        fd.append("email", email);
        fd.append("phone", speakerPhoneE164());
        fd.append("title", speakerFormData.title || "");
        fd.append("organization", speakerFormData.organization || "");
        fd.append("bio", speakerFormData.bio || "");
        fd.append("expertise", speakerFormData.expertise || "");
        fd.append(
          "previousSpeakingExperience",
          speakerFormData.previousSpeakingExperience || "",
        );
        fd.append("equipmentNeeded", speakerFormData.equipmentNeeded || "");
        fd.append("notes", speakerFormData.notes || "");
        fd.append("selectedSlotId", speakerFormData.selectedSlotId || "");
        fd.append("selectedSlotName", speakerFormData.selectedSlotName || "");
        fd.append("socialLinks", JSON.stringify(speakerFormData.socialLinks));
        fd.append("source", "external");
        fd.append("sessions", JSON.stringify(sessions));
        res = await fetch(`${apiURL}/speaker-requests/apply-with-image`, {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch(`${apiURL}/speaker-requests/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: eventData?._id,
            organizerId,
            name: speakerFormData.name,
            email,
            phone: speakerPhoneE164(),
            title: speakerFormData.title,
            organization: speakerFormData.organization,
            bio: speakerFormData.bio,
            expertise: speakerFormData.expertise,
            previousSpeakingExperience:
              speakerFormData.previousSpeakingExperience,
            equipmentNeeded: speakerFormData.equipmentNeeded,
            notes: speakerFormData.notes,
            selectedSlotId: speakerFormData.selectedSlotId,
            selectedSlotName: speakerFormData.selectedSlotName,
            socialLinks: speakerFormData.socialLinks,
            source: "external",
            sessions,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || "Failed to submit");
      }

      // Land on the status screen rather than closing: the applicant sees
      // "pending approval" and what comes next, matching the email they're
      // about to receive.
      setExistingSpeakerRequest(data.data || null);
      setSpeakerStep("status");
      toast({
        title: "Application submitted!",
        description:
          "You'll get an email confirming it's pending the organizer's approval.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSpeakerSubmitting(false);
    }
  };

  /** Send an approved speaker to the payment page for their slot fee. */
  const goToSpeakerPayment = (request: any) => {
    const ev: any = eventData || {};
    navigate("/speaker-payment", {
      state: {
        speakerRequestId: request._id,
        organizerId: String(ev?.organizer?._id || ev?.organizer || ""),
        speakerName: request.name,
        eventTitle: ev?.title,
        eventDate: ev?.startDate
          ? new Date(ev.startDate).toLocaleDateString()
          : "",
        eventLocation: ev?.location,
        sessionTopic: request.sessions?.[0]?.topic,
        sessionTime: request.sessions?.[0]?.preferredStartTime
          ? `${request.sessions[0].preferredStartTime} - ${request.sessions[0].preferredEndTime || ""}`
          : "",
        isCharged: request.isCharged,
        fee: request.fee,
      },
    });
  };

  // ══════════════ WORKSHOP HOST APPLICATION ══════════════
  const openWorkshopHostApply = () => {
    setWorkshopHostStep("auth");
    setWorkshopHostAuthedEmail("");
    setExistingWorkshopHostRequest(null);
    setWorkshopHostFormData({
      hostName: "",
      hostEmail: "",
      hostPhone: "",
      hostBio: "",
      workshopName: "",
      workshopDescription: "",
      proposedPrice: "0",
      proposedStartTime: "",
      proposedEndTime: "",
      maxSeats: "",
      photoFile: null,
      photoPreview: "",
    });
    setShowWorkshopHostDialog(true);
  };

  const handleGoogleWorkshopHostLogin = () => {
    const url = `${apiURL}/auth/google-member`;
    const w = 480;
    const h = 600;
    const left =
      typeof window !== "undefined"
        ? window.screenX + (window.outerWidth - w) / 2
        : 0;
    const top =
      typeof window !== "undefined"
        ? window.screenY + (window.outerHeight - h) / 2
        : 0;
    const popup = window.open(
      url,
      "eventsh-google-workshop-host",
      `width=${w},height=${h},left=${left},top=${top}`,
    );
    if (!popup) {
      toast({
        duration: 5000,
        title: "Popup blocked",
        description: "Allow pop-ups for this site and try again.",
        variant: "destructive",
      });
      return;
    }
    workshopHostPopupRef.current = popup;
    setWorkshopHostGoogleLoading(true);
  };

  // Finds any live application this email already owns for the event and
  // routes to the status screen; otherwise opens a blank form with the
  // verified email locked in.
  const lookupWorkshopHostByEmail = async (email: string, name?: string) => {
    const clean = String(email || "").trim().toLowerCase();
    if (!clean) {
      setWorkshopHostGoogleLoading(false);
      toast({
        duration: 5000,
        title: "Sign-in failed",
        description: "Couldn't read your Google email. Please try again.",
        variant: "destructive",
      });
      return;
    }
    setWorkshopHostAuthedEmail(clean);
    setWorkshopHostFormData((p) => ({
      ...p,
      hostEmail: clean,
      hostName: p.hostName || name || "",
    }));
    try {
      const eid = eventId || id;
      const res = await fetch(`${apiURL}/workshop-requests/event/${eid}`);
      const data = await res.json();
      const mine = (data?.data || []).find(
        (r: any) =>
          String(r.hostEmail || "").toLowerCase() === clean &&
          r.status !== "Rejected" &&
          r.status !== "Cancelled",
      );
      if (mine) {
        setExistingWorkshopHostRequest(mine);
        setWorkshopHostStep("status");
      } else {
        setWorkshopHostStep("details");
      }
    } catch (err) {
      console.error("Workshop host application lookup failed:", err);
      setWorkshopHostStep("details");
    } finally {
      setWorkshopHostGoogleLoading(false);
    }
  };

  // Same dual-channel handshake (postMessage + polled localStorage) as the
  // speaker/stall Google flows, so the result lands even when the browser
  // severs window.opener on the cross-origin popup navigation.
  useEffect(() => {
    if (!showWorkshopHostDialog || !workshopHostGoogleLoading) return;
    const KEY = "eventsh:google-member";
    const prev = (() => {
      try {
        return localStorage.getItem(KEY) || "";
      } catch {
        return "";
      }
    })();
    let handled = false;
    let sawPopupClosed = false;

    const onMessage = (ev: MessageEvent) => {
      const data = ev?.data;
      if (!data || data.kind !== "eventsh:google-member" || handled) return;
      handled = true;
      lookupWorkshopHostByEmail(data.email || "", data.name || "");
    };
    window.addEventListener("message", onMessage);

    const t = window.setInterval(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw && raw !== prev && !handled) {
          handled = true;
          window.clearInterval(t);
          localStorage.removeItem(KEY);
          const parsed = JSON.parse(raw);
          lookupWorkshopHostByEmail(parsed?.email || "", parsed?.name || "");
          return;
        }
      } catch {
        // ignore — private mode, quota, etc.
      }
      if (
        workshopHostPopupRef.current &&
        workshopHostPopupRef.current.closed &&
        !handled
      ) {
        if (sawPopupClosed) {
          window.clearInterval(t);
          setWorkshopHostGoogleLoading(false);
        } else {
          sawPopupClosed = true;
        }
      }
    }, 500);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWorkshopHostDialog, workshopHostGoogleLoading]);

  const closeWorkshopHostCropper = () => {
    setWorkshopHostCrop((cur) => {
      if (cur?.url?.startsWith("blob:")) URL.revokeObjectURL(cur.url);
      return null;
    });
  };

  const applyWorkshopHostCrop = (croppedFile: File) => {
    setWorkshopHostFormData((p) => ({
      ...p,
      photoFile: croppedFile,
      photoPreview: URL.createObjectURL(croppedFile),
    }));
    closeWorkshopHostCropper();
  };

  const submitWorkshopHostApplication = async () => {
    if (isEventOver(eventData)) {
      toast({
        title: "This event has ended",
        description: "Workshop host applications are closed for this event.",
        variant: "destructive",
      });
      return;
    }
    if (!workshopHostFormData.hostName || !workshopHostFormData.workshopName) {
      toast({
        title: "Missing details",
        description: "Your name and a workshop title are required.",
        variant: "destructive",
      });
      return;
    }
    // If "Suggested Visitor Price" is toggled off, the input never rendered
    // so nothing collects a nonzero value — force this to false regardless
    // of whatever stale value workshopHostFormData.proposedPrice might
    // still hold (e.g. from a returning host's previous session), so the
    // payout-account-required branch below can never spuriously fire.
    const isPaidWorkshop =
      workshopOn("proposedPrice") &&
      (Number(workshopHostFormData.proposedPrice) || 0) > 0;
    if (
      isPaidWorkshop &&
      (!workshopHostFormData.hostAccountName ||
        !workshopHostFormData.hostAccountDetails)
    ) {
      toast({
        title: "Payout account required",
        description:
          "Since visitors will pay for this workshop, add an account name and payment details so the organizer knows where to pay you.",
        variant: "destructive",
      });
      return;
    }
    setWorkshopHostSubmitting(true);
    try {
      const organizerId = String(
        (eventData as any)?.organizer?._id || (eventData as any)?.organizer || "",
      );
      const eid = eventId || id;
      const email = workshopHostFormData.hostEmail || workshopHostAuthedEmail;

      let res: Response;
      if (workshopHostFormData.photoFile) {
        const fd = new FormData();
        fd.append("image", workshopHostFormData.photoFile);
        fd.append("eventId", eid || "");
        fd.append("organizerId", organizerId);
        fd.append("hostName", workshopHostFormData.hostName);
        fd.append("hostEmail", email);
        fd.append("hostPhone", workshopHostFormData.hostPhone || "");
        fd.append("hostBio", workshopHostFormData.hostBio || "");
        fd.append("workshopName", workshopHostFormData.workshopName);
        fd.append(
          "workshopDescription",
          workshopHostFormData.workshopDescription || "",
        );
        fd.append(
          "proposedPrice",
          String(
            workshopOn("proposedPrice")
              ? Number(workshopHostFormData.proposedPrice) || 0
              : 0,
          ),
        );
        fd.append(
          "proposedStartTime",
          workshopHostFormData.proposedStartTime || "",
        );
        fd.append(
          "proposedEndTime",
          workshopHostFormData.proposedEndTime || "",
        );
        fd.append(
          "maxSeats",
          String(Number(workshopHostFormData.maxSeats) || 0),
        );
        fd.append(
          "hostAccountName",
          isPaidWorkshop ? workshopHostFormData.hostAccountName : "",
        );
        fd.append(
          "hostAccountDetails",
          isPaidWorkshop ? workshopHostFormData.hostAccountDetails : "",
        );
        res = await fetch(`${apiURL}/workshop-requests/apply-with-image`, {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch(`${apiURL}/workshop-requests/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: eid,
            organizerId,
            hostName: workshopHostFormData.hostName,
            hostEmail: email,
            hostPhone: workshopHostFormData.hostPhone,
            hostBio: workshopHostFormData.hostBio,
            workshopName: workshopHostFormData.workshopName,
            workshopDescription: workshopHostFormData.workshopDescription,
            proposedPrice: workshopOn("proposedPrice")
              ? Number(workshopHostFormData.proposedPrice) || 0
              : 0,
            proposedStartTime: workshopHostFormData.proposedStartTime,
            proposedEndTime: workshopHostFormData.proposedEndTime,
            maxSeats: Number(workshopHostFormData.maxSeats) || 0,
            hostAccountName: isPaidWorkshop
              ? workshopHostFormData.hostAccountName
              : "",
            hostAccountDetails: isPaidWorkshop
              ? workshopHostFormData.hostAccountDetails
              : "",
          }),
        });
      }

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || "Failed to submit");
      }

      setExistingWorkshopHostRequest(data.data || null);
      setWorkshopHostStep("status");
      toast({
        title: "Application submitted!",
        description:
          "You'll get an email confirming it's pending the organizer's approval.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setWorkshopHostSubmitting(false);
    }
  };

  const goToWorkshopHostPayment = (request: any) => {
    const ev: any = eventData || {};
    navigate("/workshop-request-payment", {
      state: {
        workshopRequestId: request._id,
        organizerId: String(ev?.organizer?._id || ev?.organizer || ""),
        hostName: request.hostName,
        workshopName: request.workshopName,
        eventTitle: ev?.title,
        eventDate: ev?.startDate
          ? new Date(ev.startDate).toLocaleDateString()
          : "",
        eventLocation: ev?.location,
        isCharged: request.isCharged,
        fee: request.hostingFee,
      },
    });
  };

  // Google sign-in result handler for the speaker flow. Finds any live
  // application this email already owns for the event and routes the
  // applicant to the matching step (status / time slot / pass), otherwise
  // opens a blank form with the verified email locked in.
  const lookupSpeakerByEmail = async (email: string, name?: string) => {
    const clean = String(email || "")
      .trim()
      .toLowerCase();
    if (!clean) {
      setSpeakerGoogleLoading(false);
      toast({
        duration: 5000,
        title: "Sign-in failed",
        description: "Couldn't read your Google email.",
        variant: "destructive",
      });
      return;
    }
    setSpeakerAuthedEmail(clean);
    setSpeakerVerified(true);
    setSpeakerFormData((p: any) => ({
      ...p,
      email: clean,
      name: p.name || name || "",
    }));

    // Pull the saved speaker profile so a returning speaker doesn't retype
    // their role, company and bio. Best-effort — a miss just means an empty
    // step 1.
    try {
      const orgId = String(
        (eventData as any)?.organizer?._id ||
          (eventData as any)?.organizer ||
          "",
      );
      const pRes = await fetch(
        `${apiURL}/speaker-requests/profiles/by-email/${encodeURIComponent(
          clean,
        )}${orgId ? `?organizerId=${orgId}` : ""}`,
      );
      const pJson = pRes.ok ? await pRes.json() : null;
      const profile = pJson?.data;
      if (profile) {
        setSpeakerProfileFound(true);
        setSpeakerFormData((p: any) => ({
          ...p,
          name: profile.name || p.name || name || "",
          phone: p.phone || profile.phone || "",
          title: p.title || profile.title || "",
          organization: p.organization || profile.organization || "",
          bio: p.bio || profile.bio || "",
          expertise: p.expertise || profile.expertise || "",
          image: profile.image || "",
          previousSpeakingExperience:
            p.previousSpeakingExperience ||
            profile.previousSpeakingExperience ||
            "",
          equipmentNeeded:
            p.equipmentNeeded || profile.equipmentNeeded || "",
          socialLinks: {
            linkedin:
              p.socialLinks?.linkedin || profile.socialLinks?.linkedin || "",
            twitter:
              p.socialLinks?.twitter || profile.socialLinks?.twitter || "",
            website:
              p.socialLinks?.website || profile.socialLinks?.website || "",
          },
        }));
      } else {
        setSpeakerProfileFound(false);
      }
    } catch {
      setSpeakerProfileFound(false);
    }

    // Sessions already locked in by OTHER applicants — used to warn about
    // clashes on the time-slot step.
    const liveSlots = (requests: any[], excludeId?: string) =>
      requests
        .filter(
          (r: any) =>
            !["Cancelled", "Rejected"].includes(r.status) &&
            (!excludeId || r._id !== excludeId),
        )
        .flatMap((r: any) =>
          (r.sessions || []).filter((s: any) => s.confirmedStartTime),
        );

    try {
      if (!eventData?._id) {
        setSpeakerStep("details");
        return;
      }
      const checkRes = await fetch(
        `${apiURL}/speaker-requests/event/${eventData._id}`,
      );
      const checkData = await checkRes.json();
      const allRequests: any[] = checkData.data || [];
      const existing = allRequests.find(
        (r: any) =>
          String(r.email || "")
            .trim()
            .toLowerCase() === clean &&
          !["Cancelled", "Rejected"].includes(r.status),
      );

      if (existing) {
        setExistingSpeakerRequest(existing);
        setBookedSpeakerSlots(liveSlots(allRequests, existing._id));
        // Carry the phone we already hold so the applicant doesn't retype it.
        if (existing.phone)
          setSpeakerFormData((p: any) => ({ ...p, phone: existing.phone }));

        // Completed → the pass is ready. Everything else lands on the status
        // screen, which itself decides whether to show "awaiting approval" or
        // a Pay button (approved + a slot fee still outstanding).
        if (existing.status === "Completed") setSpeakerStep("done");
        else if (
          existing.status === "Confirmed" &&
          !existing.isCharged &&
          !existing.selectedSlotId
        )
          // Legacy request from before slot selection moved into the
          // application — send them to the old post-approval time picker.
          setSpeakerStep("timeslot");
        else setSpeakerStep("status");
      } else {
        setBookedSpeakerSlots(liveSlots(allRequests));
        setSpeakerStep("details");
      }
    } catch (err) {
      console.error("Speaker application lookup failed:", err);
      setSpeakerStep("details");
    } finally {
      setSpeakerGoogleLoading(false);
    }
  };

  // Listen for the Google profile while the speaker dialog is open and a
  // sign-in is in flight. Same dual-channel handshake as the stall flow
  // (postMessage + polled localStorage) so the result lands even when the
  // browser severs window.opener on the cross-origin popup navigation.
  useEffect(() => {
    if (!showSpeakerDialog || !speakerGoogleLoading) return;
    const KEY = "eventsh:google-member";
    const prev = (() => {
      try {
        return localStorage.getItem(KEY) || "";
      } catch {
        return "";
      }
    })();
    let handled = false;
    let sawPopupClosed = false;

    const onMessage = (ev: MessageEvent) => {
      const data = ev?.data;
      if (!data || data.kind !== "eventsh:google-member" || handled) return;
      handled = true;
      lookupSpeakerByEmail(data.email || "", data.name || "");
    };
    window.addEventListener("message", onMessage);

    const t = window.setInterval(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw && raw !== prev && !handled) {
          handled = true;
          window.clearInterval(t);
          localStorage.removeItem(KEY);
          const parsed = JSON.parse(raw);
          lookupSpeakerByEmail(parsed?.email || "", parsed?.name || "");
          return;
        }
      } catch {
        // ignore — private mode, quota, etc.
      }
      if (
        speakerPopupRef.current &&
        speakerPopupRef.current.closed &&
        !handled
      ) {
        if (sawPopupClosed) {
          window.clearInterval(t);
          setSpeakerGoogleLoading(false);
        } else {
          sawPopupClosed = true;
        }
      }
    }, 500);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSpeakerDialog, speakerGoogleLoading]);

  const allMandatoryTermsAccepted = () => {
    const terms = eventData?.termsAndConditionsforStalls || [];
    return terms.every(
      (term, idx) => !term.isMandatory || stallTermsChecked[idx] === true,
    );
  };

  // NEW: Handle different scenarios based on existing request status
  const handleExistingRequestFlow = (request: any) => {
    setShowWhatsAppDialog(false);

    switch (request.status) {
      case "Pending":
        toast({
          duration: 5000,
          title: "Request Pending",
          description: "Your stall request is pending organizer approval",
        });
        break;

      case "Confirmed":
        setShowTableSelection(true);
        fetchAvailableTables();
        break;

      case "Processing":
        toast({
          duration: 5000,
          title: "Proceed to Payment",
          description: "Your tables are selected. Please complete payment.",
        });
        break;

      case "Completed":
        toast({
          duration: 5000,
          title: "Booking Completed",
          description: "Your stall booking is confirmed and paid",
        });
        break;

      case "Cancelled":
        toast({
          duration: 5000,
          title: "Previous Request Cancelled",
          description: "You can submit a new stall request",
        });
        setShowRentForm(true);
        break;
    }
  };

  const handleSharePDF = async () => {
    if (!existingStallRequest) return;
    setIsGeneratingPDF(true);

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let y = 20;

      // ── Currency helper ──────────────────────────────────────
      // jsPDF helvetica cannot render ₹ — replace with Rs. or $
      const cleanPrice = (price: string): string => {
        if (!price) return "N/A";
        // Replace ₹ with Rs. and $ stays as is
        return price.replace(/₹/g, "Rs.").replace(/\u20B9/g, "Rs.");
      };

      const safePrice = (val: any) => cleanPrice(formatPrice(val));

      // ── Strip emojis from text ───────────────────────────────
      const stripEmoji = (text: string): string => {
        if (!text) return "";
        return text
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // misc symbols & pictographs
          .replace(/[\u{2600}-\u{26FF}]/gu, "") // misc symbols
          .replace(/[\u{2700}-\u{27BF}]/gu, "") // dingbats
          .replace(/[\u{FE00}-\u{FE0F}]/gu, "") // variation selectors
          .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "") // flags
          .replace(/📝/g, "[Note]")
          .replace(/🇮🇳/g, "")
          .replace(/🇸🇬/g, "")
          .trim();
      };

      const checkNewPage = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - 15) {
          pdf.addPage();
          y = 20;
        }
      };

      // ── Helpers ──────────────────────────────────────────────
      const sectionTitle = (title: string) => {
        checkNewPage(12);
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, y, contentWidth, 8, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(30, 30, 30);
        pdf.text(title, margin + 3, y + 5.5);
        y += 12;
      };

      const labelValue = (label: string, value: string) => {
        const safeValue = stripEmoji(value || "N/A");
        checkNewPage(10);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text(label.toUpperCase(), margin, y);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(30, 30, 30);
        const lines = pdf.splitTextToSize(safeValue, contentWidth - 5);
        pdf.text(lines, margin, y + 4);
        y += 4 + lines.length * 5;
      };

      const labelValuePair = (
        label1: string,
        value1: string,
        label2: string,
        value2: string,
      ) => {
        const halfW = contentWidth / 2;
        const safeVal1 = stripEmoji(value1 || "N/A");
        const safeVal2 = stripEmoji(value2 || "N/A");
        checkNewPage(12);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text(label1.toUpperCase(), margin, y);
        pdf.text(label2.toUpperCase(), margin + halfW, y);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(30, 30, 30);
        const lines1 = pdf.splitTextToSize(safeVal1, halfW - 5);
        const lines2 = pdf.splitTextToSize(safeVal2, halfW - 5);
        pdf.text(lines1, margin, y + 4);
        pdf.text(lines2, margin + halfW, y + 4);
        const maxLines = Math.max(lines1.length, lines2.length);
        y += 4 + maxLines * 5 + 3;
      };

      const divider = () => {
        checkNewPage(5);
        pdf.setDrawColor(220, 220, 220);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 5;
      };

      // ── Header ───────────────────────────────────────────────
      // Organizer's organization name brands the top of the receipt (falls
      // back to the organizer's name, then "EventSH").
      const orgName =
        (eventData as any)?.organizer?.organizationName ||
        (eventData as any)?.organizer?.name ||
        "EventSH";
      pdf.setFillColor(30, 64, 175);
      pdf.rect(0, 0, pageWidth, 18, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(255, 255, 255);
      pdf.text(orgName, margin, 8);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("Stall Booking Details", margin, 14);
      pdf.text(
        `Generated: ${new Date().toLocaleString()}`,
        pageWidth - margin,
        8,
        { align: "right" },
      );
      y = 26;

      // ── Status Row ───────────────────────────────────────────
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(80, 80, 80);
      pdf.text("REQUEST STATUS", margin, y);
      pdf.text("PAYMENT STATUS", margin + contentWidth / 2, y);
      y += 4;

      const statusColors: Record<string, [number, number, number]> = {
        Pending: [234, 179, 8],
        Confirmed: [22, 163, 74],
        Processing: [59, 130, 246],
        Completed: [16, 185, 129],
        Cancelled: [239, 68, 68],
        Returned: [139, 92, 246],
      };
      const paymentColors: Record<string, [number, number, number]> = {
        Unpaid: [239, 68, 68],
        Partial: [234, 179, 8],
        Paid: [22, 163, 74],
      };
      const sc = statusColors[existingStallRequest.status] || [100, 100, 100];
      const pc = paymentColors[existingStallRequest.paymentStatus] || [
        100, 100, 100,
      ];

      pdf.setFillColor(...sc);
      pdf.roundedRect(margin, y, 40, 7, 2, 2, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text(existingStallRequest.status, margin + 20, y + 4.8, {
        align: "center",
      });

      pdf.setFillColor(...pc);
      pdf.roundedRect(margin + contentWidth / 2, y, 40, 7, 2, 2, "F");
      pdf.text(
        existingStallRequest.paymentStatus,
        margin + contentWidth / 2 + 20,
        y + 4.8,
        { align: "center" },
      );

      y += 13;
      divider();

      // ── Shopkeeper Info ──────────────────────────────────────
      sectionTitle("Shopkeeper Information");
      labelValuePair(
        "Owner Name",
        existingStallRequest.shopkeeperId?.name,
        "Business Name",
        existingStallRequest.shopkeeperId?.shopName,
      );
      labelValuePair(
        "Business Email",
        existingStallRequest.shopkeeperId?.businessEmail,
        "WhatsApp",
        existingStallRequest.shopkeeperId?.whatsappNumber,
      );
      labelValuePair(
        "Country",
        existingStallRequest.shopkeeperId?.country === "IN"
          ? "India"
          : "Singapore",
        "Category",
        existingStallRequest.shopkeeperId?.businessCategory,
      );
      labelValuePair(
        "Applicant Name",
        existingStallRequest.nameOfApplicant,
        "Owner Nationality",
        existingStallRequest.businessOwnerNationality,
      );
      labelValuePair(
        "Residency",
        existingStallRequest.residency || "Not Provided",
        "No. Of Operators",
        String(existingStallRequest.noOfOperators || "Not Provided"),
      );
      labelValuePair(
        existingStallRequest.shopkeeperId?.country === "IN"
          ? "GST Number"
          : "UEN Number",
        existingStallRequest.shopkeeperId?.country === "IN"
          ? existingStallRequest.shopkeeperId?.GSTNumber || "Not Provided"
          : existingStallRequest.shopkeeperId?.UENNumber || "Not Provided",
        "Coupon Assigned",
        existingStallRequest.couponCodeAssigned || "None Assigned",
      );
      if (existingStallRequest.registrationNumber) {
        labelValue(
          "Registration Number",
          existingStallRequest.registrationNumber,
        );
      }
      labelValue(
        "Business Address",
        existingStallRequest.shopkeeperId?.address,
      );
      if (existingStallRequest.refundPaymentDescription) {
        labelValue(
          "Refund Payment Details",
          existingStallRequest.refundPaymentDescription,
        );
      }
      if (existingStallRequest.productDescription) {
        labelValue(
          "Product Description",
          existingStallRequest.productDescription,
        );
      }
      y += 3;

      // ── Event Info ───────────────────────────────────────────
      sectionTitle("Event Information");
      labelValuePair(
        "Event Title",
        existingStallRequest.eventId?.title,
        "Category",
        existingStallRequest.eventId?.category,
      );
      labelValuePair(
        "Duration",
        `${new Date(existingStallRequest.eventId?.startDate).toLocaleDateString()} - ${new Date(existingStallRequest.eventId?.endDate).toLocaleDateString()}`,
        "Venue",
        existingStallRequest.eventId?.location,
      );
      labelValuePair(
        "Dress Code",
        existingStallRequest.eventId?.dresscode || "Casual",
        "Age Limit",
        existingStallRequest.eventId?.ageRestriction || "No Limit",
      );
      y += 3;

      // ── Selected Tables ──────────────────────────────────────
      if (existingStallRequest.selectedTables?.length > 0) {
        sectionTitle("Selected Tables");
        existingStallRequest.selectedTables.forEach((table: any) => {
          checkNewPage(12);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.setTextColor(30, 30, 30);
          pdf.text(table.tableName, margin, y);
          pdf.text(safePrice(table.price), pageWidth - margin, y, {
            align: "right",
          });
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(
            `${table.tableType}  •  +${safePrice(table.depositAmount)} deposit`,
            margin,
            y + 5,
          );
          y += 12;
          divider();
        });
      }

      // ── Selected Add-ons ─────────────────────────────────────
      if (existingStallRequest.selectedAddOns?.length > 0) {
        sectionTitle("Selected Add-ons");
        existingStallRequest.selectedAddOns.forEach((addon: any) => {
          checkNewPage(12);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.setTextColor(30, 30, 30);
          pdf.text(addon.name, margin, y);
          pdf.text(
            safePrice(addon.price * addon.quantity),
            pageWidth - margin,
            y,
            { align: "right" },
          );
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(
            `Qty: ${addon.quantity}  •  ${safePrice(addon.price)} each`,
            margin,
            y + 5,
          );
          y += 12;
          divider();
        });
      }

      // ── Price Summary ────────────────────────────────────────
      sectionTitle("Price Summary");
      const priceRows = [
        ["Tables Rental", safePrice(existingStallRequest.tablesTotal)],
        ["Deposit", safePrice(existingStallRequest.depositTotal)],
        ...(existingStallRequest.addOnsTotal > 0
          ? [["Add-ons", safePrice(existingStallRequest.addOnsTotal)]]
          : []),
      ];
      priceRows.forEach(([label, value]) => {
        checkNewPage(8);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        pdf.text(label, margin, y);
        pdf.text(value, pageWidth - margin, y, { align: "right" });
        y += 7;
      });
      checkNewPage(10);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 5;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(22, 163, 74);
      pdf.text("Grand Total", margin, y);
      pdf.text(
        safePrice(existingStallRequest.grandTotal),
        pageWidth - margin,
        y,
        {
          align: "right",
        },
      );
      y += 10;

      // ── Timeline ─────────────────────────────────────────────
      sectionTitle("Timeline");
      const timelineItems = [
        { label: "Request Submitted", date: existingStallRequest.requestDate },
        {
          label: "Request Confirmed",
          date: existingStallRequest.confirmationDate,
        },
        { label: "Tables Selected", date: existingStallRequest.selectionDate },
        { label: "Payment Received", date: existingStallRequest.paymentDate },
        {
          label: "Booking Completed",
          date: existingStallRequest.completionDate,
        },
        { label: "Checked In", date: existingStallRequest.checkInTime },
        { label: "Checked Out", date: existingStallRequest.checkOutTime },
      ].filter((item) => item.date);

      timelineItems.forEach((item) => {
        checkNewPage(9);
        pdf.setFillColor(59, 130, 246);
        pdf.circle(margin + 2, y - 1, 1.5, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(30, 30, 30);
        pdf.text(item.label, margin + 7, y);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        pdf.text(new Date(item.date).toLocaleString(), margin + 7, y + 4.5);
        y += 11;
      });

      // ── Status History ───────────────────────────────────────
      if (existingStallRequest.statusHistory?.length > 0) {
        sectionTitle("Status History & Notes");
        existingStallRequest.statusHistory.forEach(
          (entry: any, index: number) => {
            checkNewPage(20);
            const entryColors: Record<string, [number, number, number]> = {
              Pending: [234, 179, 8],
              Confirmed: [22, 163, 74],
              Processing: [59, 130, 246],
              Partial: [249, 115, 22],
              Paid: [22, 163, 74],
              Completed: [16, 185, 129],
              Cancelled: [239, 68, 68],
              Returned: [139, 92, 246],
            };
            const ec = entryColors[entry.status] || [100, 100, 100];

            // Index circle
            pdf.setFillColor(...ec);
            pdf.circle(margin + 3, y + 2, 3.5, "F");
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(8);
            pdf.setFont("helvetica", "bold");
            pdf.text(String(index + 1), margin + 3, y + 3.5, {
              align: "center",
            });

            // Status badge
            pdf.setFillColor(...ec);
            pdf.roundedRect(margin + 10, y - 2, 28, 7, 2, 2, "F");
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(8);
            pdf.text(entry.status, margin + 24, y + 2.8, { align: "center" });

            // Date
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.setTextColor(120, 120, 120);
            pdf.text(
              new Date(entry.changedAt).toLocaleString(),
              pageWidth - margin,
              y + 2.5,
              { align: "right" },
            );

            y += 8;

            // Note — strip emoji, prefix with [Note] text instead
            if (entry.note) {
              checkNewPage(8);
              pdf.setFont("helvetica", "normal");
              pdf.setFontSize(9);
              pdf.setTextColor(60, 60, 60);
              const cleanNote = stripEmoji(entry.note);
              const noteLines = pdf.splitTextToSize(
                `[Note] ${cleanNote}`,
                contentWidth - 15,
              );
              pdf.text(noteLines, margin + 10, y);
              y += noteLines.length * 5;
            }

            // Changed by
            if (entry.changedBy) {
              checkNewPage(6);
              pdf.setFontSize(8);
              pdf.setTextColor(150, 150, 150);
              const cleanBy = stripEmoji(entry.changedBy);
              pdf.text(`By: ${cleanBy}`, margin + 10, y);
              y += 5;
            }

            y += 4;
          },
        );
      }

      // ── Cancellation Reason ──────────────────────────────────
      if (existingStallRequest.cancellationReason) {
        sectionTitle("Cancellation Reason");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(239, 68, 68);
        const cancelLines = pdf.splitTextToSize(
          stripEmoji(existingStallRequest.cancellationReason),
          contentWidth,
        );
        pdf.text(cancelLines, margin, y);
        y += cancelLines.length * 6;
      }

      // ── Footer on every page ─────────────────────────────────
      const totalPages = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFillColor(240, 240, 240);
        pdf.rect(0, pageHeight - 10, pageWidth, 10, "F");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text("Powered by EventSH", margin, pageHeight - 3.5);
        pdf.text(
          `Page ${i} of ${totalPages}`,
          pageWidth - margin,
          pageHeight - 3.5,
          { align: "right" },
        );
      }

      // ── Save / Share ─────────────────────────────────────────
      const fileName = `stall_${existingStallRequest?.shopkeeperId?.name?.replace(/\s+/g, "_") || "details"}_${existingStallRequest?.eventId?.title?.replace(/\s+/g, "_") || "event"}.pdf`;

      const pdfBlob = pdf.output("blob");
      const pdfFile = new File([pdfBlob], fileName, {
        type: "application/pdf",
      });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: `Stall Details - ${existingStallRequest?.shopkeeperId?.name}`,
          text: `Stall booking details for ${existingStallRequest?.eventId?.title}`,
          files: [pdfFile],
        });
        toast({
          duration: 3000,
          title: "Shared Successfully",
          description: "Stall details shared successfully.",
        });
      } else {
        pdf.save(fileName);
        toast({
          duration: 3000,
          title: "PDF Downloaded",
          description:
            "Sharing not supported on this device. PDF downloaded instead.",
        });
      }
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSingleImageSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "reg" | "logo",
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropType(type);
      setCropImage(URL.createObjectURL(file));
      setCropOpen(true);
    }
    // Reset input
    e.target.value = "";
  };

  const handleMultipleImageSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    if (productFiles.length + files.length > 5) {
      toast({
        title: "Limit reached",
        description: "Maximum 5 product images allowed",
        variant: "destructive",
      });
      return;
    }
    if (files.length > 0) {
      setCropType("product");
      setCropQueue(files);
      setCropImage(URL.createObjectURL(files[0]));
      setCropOpen(true);
    }
    e.target.value = "";
  };

  // ====== Handle Result from Cropper ======
  const handleCroppedImage = async (croppedFile: File) => {
    // Compress to WebP under 1 MB before storing for upload.
    const compressed = await compressStallImage(croppedFile, 1024 * 1024);
    if (compressed.size > 1024 * 1024) {
      toast({
        duration: 5000,
        title: "Image too large",
        description:
          "This image couldn't be reduced under 1 MB. Please pick a smaller / simpler image.",
        variant: "destructive",
      });
      return;
    }
    const finalFile = compressed;
    const previewUrl = URL.createObjectURL(finalFile);

    if (cropType === "reg") {
      setRegImageFile(finalFile);
      setRegImagePreview(previewUrl);
      setCropOpen(false);
    } else if (cropType === "logo") {
      setLogoFile(finalFile);
      setLogoPreview(previewUrl);
      setCropOpen(false);
    } else if (cropType === "product") {
      setProductFiles((prev) => [...prev, finalFile]);
      setProductPreviews((prev) => [...prev, previewUrl]);

      const remaining = cropQueue.slice(1);
      setCropQueue(remaining);

      if (remaining.length > 0) {
        setCropImage(URL.createObjectURL(remaining[0]));
      } else {
        setCropOpen(false);
        setCropImage(null);
      }
    }

    if (cropImage?.startsWith("blob:")) URL.revokeObjectURL(cropImage);
  };

  const removeProductImage = (index: number) => {
    const newFiles = [...productFiles];
    const newPreviews = [...productPreviews];
    newFiles.splice(index, 1);
    const removedPreview = newPreviews.splice(index, 1)[0];

    setProductFiles(newFiles);
    setProductPreviews(newPreviews);
    if (removedPreview.startsWith("blob:")) URL.revokeObjectURL(removedPreview);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateTimeString?: string | Date) => {
    if (!dateTimeString) return "N/A";
    return new Date(dateTimeString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fetchAvailableTables = async () => {
    if (!eventData?._id) return;

    setLoadingTables(true);

    try {
      const response = await fetch(
        `${apiURL}/stalls/available-tables/${eventData._id}`,
      );

      const result = await response.json();

      if (result.success) {
        setAvailableTables(result.data.allTables || {});
      } else {
        // Fallback: Use venueTables from event data

        if (
          eventData.venueTables &&
          Object.keys(eventData.venueTables).length > 0
        ) {
          setAvailableTables(eventData.venueTables);

          toast({
            duration: 5000,
            title: "Using Event Tables",

            description: "Loaded tables from event configuration",
          });
        }
      }
    } catch (error) {
      console.error("❌ Error fetching tables:", error);

      // Fallback: Use venueTables from event data

      if (
        eventData.venueTables &&
        Object.keys(eventData.venueTables).length > 0
      ) {
        setAvailableTables(eventData.venueTables);

        toast({
          duration: 5000,
          title: "Using Event Tables",

          description: "Loaded tables from event configuration",
        });
      } else {
        toast({
          duration: 5000,
          title: "Error",

          description: "Failed to fetch available tables",

          variant: "destructive",
        });
      }
    } finally {
      setLoadingTables(false);
    }
  };

  // The exhibitor's business category (from their approved stall request, or
  // the value they picked on the rent form). Empty when unknown.
  const getMyExhibitorCategory = (): string =>
    existingStallRequest?.shopkeeperId?.businessCategory ||
    shopkeeperDetails?.businessCategory ||
    "";

  // A space is selectable by this vendor when it's open to all ("Other" or
  // no category set), when we don't know the vendor's category, or when the
  // space's category matches the vendor's. Non-matching spaces stay visible
  // but cannot be chosen.
  const isCategoryAllowed = (table: any): boolean => {
    // Prefer the multi-category array; fall back to the legacy single
    // value when older placed tables don't carry the new field.
    const cats: string[] = Array.isArray(table?.exhibitorCategories)
      ? table.exhibitorCategories
      : table?.exhibitorCategory && table.exhibitorCategory !== "Other"
        ? [table.exhibitorCategory]
        : [];
    if (cats.length === 0) return true; // open to all
    const myCat = getMyExhibitorCategory();
    if (!myCat) return true;
    // Case-insensitive match because new categories added via the
    // shared pool may differ in casing across sources.
    const myLower = String(myCat).toLowerCase();
    return cats.some((c) => String(c).toLowerCase() === myLower);
  };

  // NEW: Handle table click for selection
  const handleTableClick = (table: any) => {
    if (table.isBooked) {
      toast({
        duration: 5000,
        title: "Table Unavailable",
        description: "This table is already booked",
        variant: "destructive",
      });
      return;
    }

    // Block spaces reserved for a different exhibitor category.
    if (!isCategoryAllowed(table)) {
      toast({
        duration: 5000,
        title: "Not Available for Your Category",
        description: (() => {
          const cats: string[] = Array.isArray(table?.exhibitorCategories)
            ? table.exhibitorCategories
            : table?.exhibitorCategory && table.exhibitorCategory !== "Other"
              ? [table.exhibitorCategory]
              : [];
          const list =
            cats.length > 1
              ? `"${cats.slice(0, -1).join('", "')}" or "${cats.slice(-1)}"`
              : `"${cats[0] || "specific"}"`;
          return `This space is reserved for ${list} exhibitors. You can book spaces in your category or ones marked "Open to all".`;
        })(),
        variant: "destructive",
      });
      return;
    }

    // Check if vendor has preferred template(s) and this table doesn't match
    // any of them (combination preferences allow several types).
    const preferredIds: string[] =
      Array.isArray(existingStallRequest?.preferredTemplateIds) &&
      existingStallRequest.preferredTemplateIds.length
        ? existingStallRequest.preferredTemplateIds
        : existingStallRequest?.preferredTemplateId
          ? [existingStallRequest.preferredTemplateId]
          : [];
    if (preferredIds.length > 0 && !preferredIds.includes(table.id)) {
      const label =
        (Array.isArray(existingStallRequest?.preferredTemplateNames) &&
          existingStallRequest.preferredTemplateNames.join(", ")) ||
        existingStallRequest?.preferredTemplateName ||
        "your selected";
      toast({
        duration: 5000,
        title: "Not Available for Your Category",
        description: `You registered for "${label}" spaces only. This space belongs to a different category.`,
        variant: "destructive",
      });
      return;
    }

    // Not for sale spaces can't be selected
    if (table.forSale === false) return;

    const isSelected = selectedTables.some(
      (t) => t.positionId === table.positionId,
    );

    if (isSelected) {
      setSelectedTables(
        selectedTables.filter((t) => t.positionId !== table.positionId),
      );
    } else {
      const layoutName = venueConfig?.[currentLayoutIndex]?.name || "Default";
      // Resolve member-vs-regular pricing once at selection time so the
      // running totals, summary, and downstream payment payload all
      // agree on what the exhibitor was quoted.
      const pricing = resolveTablePricing(table);
      // Resolve the minimum-payment flag from the placed space AND its source
      // template (matched by id). Either being explicitly disabled wins, so a
      // space placed before the organizer turned the toggle off still respects
      // it. Defaults to enabled when neither says otherwise (legacy spaces).
      const sourceTemplate = (eventData?.tableTemplates || []).find(
        (tpl: any) => tpl?.id === table.id,
      );

      // How many of THIS type the vendor may select: the smaller of the
      // organizer's per-type cap (maxPerBooking) and the quantity the vendor
      // registered for this preferred type on the stall form. Block once that
      // many of the type are already selected.
      const prefQtys: number[] = Array.isArray(
        existingStallRequest?.preferredTemplateQuantities,
      )
        ? existingStallRequest.preferredTemplateQuantities
        : [];
      const prefIdx = preferredIds.indexOf(table.id);
      const registeredForType =
        prefIdx >= 0 ? Math.max(1, Number(prefQtys[prefIdx]) || 1) : Infinity;
      const orgMax = Number(sourceTemplate?.maxPerBooking);
      const orgMaxCap =
        Number.isFinite(orgMax) && orgMax > 0 ? orgMax : Infinity;
      const typeCap = Math.min(registeredForType, orgMaxCap);
      const alreadyOfType = selectedTables.filter(
        (t) => t.tableId === table.id,
      ).length;
      if (Number.isFinite(typeCap) && alreadyOfType >= typeCap) {
        toast({
          duration: 5000,
          title: "Limit reached",
          description: `You can select at most ${typeCap} "${table.name}" space${typeCap === 1 ? "" : "s"}.`,
          variant: "destructive",
        });
        return;
      }

      // Total cap across all types: the vendor's registered total preferred
      // quantity (already capped at the event's maxSpacesPerVendor), falling
      // back to the event cap when no explicit quantities were registered.
      const eventCap = Math.max(
        1,
        Number((eventData as any)?.maxSpacesPerVendor) || 1,
      );
      const registeredTotal =
        preferredIds.length > 0
          ? preferredIds.reduce(
              (s, _id, i) => s + (Number(prefQtys[i]) || 1),
              0,
            )
          : eventCap;
      const totalCap = Math.min(registeredTotal, eventCap);
      if (selectedTables.length >= totalCap) {
        toast({
          duration: 5000,
          title: "Space limit reached",
          description: `You can select at most ${totalCap} space${totalCap === 1 ? "" : "s"} in total.`,
          variant: "destructive",
        });
        return;
      }

      const spaceAllowsMinimum =
        table.minimumPaymentEnabled !== false &&
        sourceTemplate?.minimumPaymentEnabled !== false;
      const newTable = {
        tableId: table.id,
        positionId: table.positionId,
        tableName: table.name,
        name: table.name,
        tableType: table.type,
        price: pricing.tablePrice,
        depositAmount: pricing.depositPrice,
        layoutName,
        // Keep these for display purposes
        width: table.width,
        height: table.height,
        rowNumber: table.rowNumber,
        tablePrice: pricing.tablePrice,
        bookingPrice: pricing.bookingPrice,
        depositPrice: pricing.depositPrice,
        // Remember which tier was applied — drives the "Member price"
        // badge in the selected-spaces summary.
        appliedTier: isMember && pricing.memberSaved > 0 ? "member" : "regular",
        regularPrice: table.tablePrice,
        memberSaved: pricing.memberSaved,
        minimumPaymentEnabled: spaceAllowsMinimum,
        depositInOption1: table.depositInOption1 === true,
        x: table.x,
        y: table.y,
        rotation: table.rotation,
      };

      setSelectedTables([...selectedTables, newTable]);
    }
  };

  // NEW: Handle add-on toggle
  const handleAddOnToggle = (addOn: any, checked: boolean) => {
    if (checked) {
      const newAddOn = {
        addOnId: addOn.id,
        name: addOn.name,
        price: addOn.price,
        quantity: 1,
      };
      setSelectedAddOns([...selectedAddOns, newAddOn]);
    } else {
      setSelectedAddOns(selectedAddOns.filter((a) => a.addOnId !== addOn.id));
    }
  };

  // NEW: Handle add-on quantity change. Respects the organizer's per-space cap
  // (maxPerSpace on the add-on): the vendor may pick up to maxPerSpace of this
  // add-on for EACH booked space, so the total cap scales with the number of
  // selected spaces. 0 / unset = unlimited.
  const handleAddOnQuantityChange = (addOnId: string, quantity: number) => {
    const item = (eventData?.addOnItems || []).find(
      (x: any) => x.id === addOnId,
    );
    const perTemplate: Record<string, any> = item?.maxPerTemplate || {};
    const general = Number(item?.maxPerSpace);
    const generalCap =
      Number.isFinite(general) && general > 0 ? general : Infinity;

    // Sum the per-space cap across every selected space. Each space uses its
    // template's override when set, otherwise the general cap. Any space with
    // no cap makes the whole add-on unlimited. No spaces picked yet → treat as
    // a single space so the limit still guides the vendor.
    const spaces = selectedTables.length ? selectedTables : [null];
    let cap = 0;
    for (const t of spaces) {
      // Selected spaces store the source template id as `tableId` (not `id`),
      // so the per-template add-on override is keyed by that. Without this the
      // override never matched and the general cap was always used.
      const tId = (t as any)?.tableId ?? (t as any)?.id;
      const tplRaw = tId != null ? Number(perTemplate[tId]) : NaN;
      const perCap =
        Number.isFinite(tplRaw) && tplRaw > 0 ? tplRaw : generalCap;
      cap += perCap;
      if (!Number.isFinite(cap)) break;
    }

    let q = Math.max(1, quantity);
    if (Number.isFinite(cap) && q > cap) {
      q = cap;
      toast({
        duration: 3500,
        title: "Add-on limit reached",
        description: `You can add at most ${cap} "${item?.name}" for your selected space${selectedTables.length === 1 ? "" : "s"}.`,
        variant: "destructive",
      });
    }
    setSelectedAddOns(
      selectedAddOns.map((a) =>
        a.addOnId === addOnId ? { ...a, quantity: q } : a,
      ),
    );
  };

  // NEW: Calculate totals for table selection
  const calculateTotals = () => {
    const tablesTotal = selectedTables.reduce(
      (acc, t) => ({
        tablePrice: acc.tablePrice + (t.tablePrice || 0),
        bookingPrice: acc.bookingPrice + (t.bookingPrice || 0),
        depositPrice: acc.depositPrice + (t.depositPrice || 0),
      }),
      { tablePrice: 0, bookingPrice: 0, depositPrice: 0 },
    );

    const addOnsTotal = selectedAddOns.reduce(
      (sum, a) => sum + a.price * a.quantity,
      0,
    );

    // Deposit is only part of the minimum payment for tables the organizer
    // flagged with depositInOption1; otherwise Option 1 is booking only.
    const depositInOption1Total = selectedTables.reduce(
      (sum, t) => sum + (t.depositInOption1 ? t.depositPrice || 0 : 0),
      0,
    );

    const minimumPayment = tablesTotal.bookingPrice + depositInOption1Total;
    const fullPayment =
      tablesTotal.depositPrice + tablesTotal.tablePrice + addOnsTotal;
    const remainingAfterBooking = fullPayment - minimumPayment;

    return {
      tablesTotal,
      addOnsTotal,
      minimumPayment,
      depositInOption1Total,
      fullPayment,
      remainingAfterBooking,
    };
  };

  const getDaysUntilEvent = () => {
    if (!eventData?.startDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(eventData.startDate);
    start.setHours(0, 0, 0, 0);
    const diff = Math.ceil(
      (start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diff;
  };

  const daysUntilEvent = getDaysUntilEvent();
  // Minimum payment is only offered when every currently-selected space allows
  // it (organizer toggle) — a single full-payment-only space disables the
  // partial option for the whole selection.
  const selectedSpacesAllowMinimum = selectedTables.every(
    (t: any) => t.minimumPaymentEnabled !== false,
  );
  // The minimum-payment option also stays hidden when the event is under 60
  // days away (existing date rule).
  const showMinimumPayment =
    selectedSpacesAllowMinimum &&
    (daysUntilEvent === null || daysUntilEvent > 60);

  // NEW: Submit table and add-on selection
  const handleTableSelectionSubmit = async () => {
    if (selectedTables.length === 0) {
      toast({
        duration: 5000,
        title: "No Tables Selected",
        description: "Please select at least one table",
        variant: "destructive",
      });
      return;
    }

    if (!existingStallRequest) return;

    setLoading(true);

    try {
      // Calculate totals
      const tablesTotal = selectedTables.reduce(
        (sum, table) => sum + (table.price || 0),
        0,
      );

      const bookingPrice = selectedTables.reduce(
        (sum, table) => sum + (table.bookingPrice || 0),
        0,
      );

      const depositTotal = selectedTables.reduce(
        (sum, table) => sum + (table.depositAmount || 0),
        0,
      );
      // Portion of the deposit that belongs to the minimum payment (Option 1)
      // — only for tables the organizer flagged with depositInOption1.
      const depositInOption1Total = selectedTables.reduce(
        (sum, table) =>
          sum + (table.depositInOption1 ? table.depositAmount || 0 : 0),
        0,
      );
      const addOnsTotal = selectedAddOns.reduce(
        (sum, addon: any) =>
          sum + (Number(addon.price) || 0) * (Number(addon.quantity) || 1),
        0,
      );
      const grandTotal = tablesTotal + depositTotal + addOnsTotal;
      const paymentURL = organizer.paymentURL
        ? apiURL + organizer.paymentURL
        : "";

      // Prepare order data to pass to payment page
      const orderData = {
        stallRequestId: existingStallRequest._id,
        eventId: eventData?._id,
        paymentURL,
        eventInfo: {
          id: eventData?._id,
          title: eventData?.title,
          location: eventData?.location,
          startDate: eventData?.startDate,
          endDate: eventData?.endDate,
          image: eventData?.image,
          organizerId: eventData?.organizer?._id,
        },
        shopkeeperDetails: {
          id: shopkeeperId,
          name: shopkeeperDetails?.name || "",
          email: shopkeeperDetails?.email || "",
          whatsAppNumber: shopkeeperDetails?.whatsappNumber || "",
          businessName: shopkeeperDetails?.shopName || "",
        },
        selectedTables: selectedTables.map((table) => ({
          positionId: table.positionId,
          name: table.name,
          type: table.tableType,
          price: table.price,
          bookingPrice: table.bookingPrice,
          depositAmount: table.depositAmount,
          layoutName: table.layoutName,
          x: table.x,
          y: table.y,
          width: table.width,
          height: table.height,
          rotation: table.rotation,
        })),
        selectedAddOns: selectedAddOns.map((addon: any) => ({
          id: addon.addOnId || addon.id,
          addOnId: addon.addOnId || addon.id,
          name: addon.name,
          description: addon.description,
          price: addon.price,
          quantity: Number(addon.quantity) || 1,
        })),
        minimumPayment: bookingPrice + depositInOption1Total,
        // Offer the minimum-payment plan only when every selected space allows
        // it; if any space is full-payment-only, the whole order must be paid
        // in full. Consumed by the payment page to show/hide the option.
        minimumPaymentAllowed: selectedTables.every(
          (t) => t.minimumPaymentEnabled !== false,
        ),
        priceSummary: {
          tablesTotal,
          depositTotal,
          addOnsTotal,
          grandTotal,
          bookingPrice,
        },
      };

      // Generate a temporary order ID for reference
      const tempOrderId = `STALL-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Navigate to payment page with order data
      navigate("/table-payment", {
        state: {
          orderId: tempOrderId,
          ...orderData,
        },
      });

      toast({
        duration: 5000,
        title: "Proceeding to payment",
        description: "Redirecting to payment page...",
      });
    } catch (error: any) {
      console.error("Selection error:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: error.message || "Failed to proceed to payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const design = settings?.settings?.design;

  const getThemeColors = () => {
    const isDark = design?.theme === "dark";
    return {
      "--background": isDark ? "#0f0f0f" : "#ffffff",
      "--foreground": isDark ? "#f1f5f9" : "#0f172a",
      "--card": isDark ? "#1e1e1e" : "#ffffff",
      "--card-foreground": isDark ? "#f1f5f9" : "#0f172a",
      "--muted": isDark ? "#2a2a2a" : "#f8fafc",
      "--muted-foreground": isDark ? "#94a3b8" : "#64748b",
      "--border": isDark ? "#374151" : "#e2e8f0",
      "--primary": design?.primaryColor,
      "--secondary": design?.secondaryColor,
    };
  };

  const themeStyles: CSSProperties = {
    ...getThemeColors(),
    fontFamily: design?.fontFamily,
  } as CSSProperties;

  // Route the UI for a single stall request by its status. Extracted so both
  // the single-request path and the multi-request list chooser reuse it.
  const routeExistingRequest = async (data: any) => {
    setExistingStallRequest(data);
    if (data.status === "Confirmed") {
      setShowWhatsAppDialog(false);
      setShowRentForm(false);
      setShowTableSelection(true);
      await fetchAvailableTables();
      toast({
        duration: 5000,
        title: "Request Confirmed",
        description: "Please select your tables and add-ons",
      });
    } else if (data.status === "Pending") {
      // Request is pending
      setShowWhatsAppDialog(false);
      setShowRentForm(false);
      toast({
        duration: 5000,
        title: "Request Pending",
        description: "Your stall request is awaiting organizer approval",
      });
    } else if (data.status === "Processing") {
      // Tables selected. If the vendor already submitted payment proof it's
      // awaiting the organizer's verification; otherwise payment is pending.
      setShowWhatsAppDialog(false);
      setShowRentForm(false);
      const paid = data.transactionId || data.transactionScreenshot;
      toast({
        duration: 5000,
        title: paid ? "Awaiting Approval" : "Complete Payment",
        description: paid
          ? "Payment submitted. Waiting for the organizer to approve."
          : "Your tables are selected. Please complete payment.",
      });
    } else if (data.status === "Completed") {
      // Booking completed (paid). Offer: preview the existing booking, or
      // register a NEW request (a different vendor under the same email).
      setShowWhatsAppDialog(false);
      setShowRentForm(false);
      setShowAccountChooser(false);
      setShowRegisterTargetChoice(false);
      setShowCompletedChoice(true);
    } else if (data.status === "Approved") {
      // Request approved - go directly to space/table selection
      setShowWhatsAppDialog(false);
      setShowRentForm(false);
      setShowTableSelection(true);
      await fetchAvailableTables();
      toast({
        duration: 5000,
        title: "Request Approved",
        description: "Please select your tables and add-ons",
      });
    } else if (data.status === "Cancelled") {
      // Request cancelled - allow new request
      setShowWhatsAppDialog(false);
      setShowRentForm(true);
      toast({
        duration: 5000,
        title: "Previous Request Cancelled",
        description: "You can submit a new stall request",
        variant: "destructive",
      });
    }
  };

  // Pick one request from the multi-request list chooser and route to it.
  const selectRequestFromList = async (req: any) => {
    setShowRequestListChoice(false);
    setListRegisterStep(false);
    await routeExistingRequest(req);
  };

  // Badge colour per request status, matching the organizer-side pill palette.
  const requestStatusBadgeClass = (status: string): string => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-700";
      case "Confirmed":
      case "Approved":
        return "bg-blue-100 text-blue-700";
      case "Processing":
        return "bg-amber-100 text-amber-700";
      case "Pending":
        return "bg-yellow-100 text-yellow-700";
      case "Cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // NEW: Fetch existing request
  const fetchExistingRequest = async (
    shopkeeperId: string,
    eventId: string,
  ) => {
    try {
      const response = await fetch(
        `${apiURL}/stalls/check-request/${eventId}/${shopkeeperId}`,
      );
      const result = await response.json();

      if (result.success && result.data) {
        // More than one request for this vendor+event → let them pick which to
        // manage (or register another) instead of auto-routing to the newest.
        if (Array.isArray(result.requests) && result.requests.length > 1) {
          setRequestList(result.requests);
          setListRegisterStep(false);
          setShowWhatsAppDialog(false);
          setShowRentForm(false);
          setShowAccountChooser(false);
          setShowRequestListChoice(true);
          return;
        }
        await routeExistingRequest(result.data);
      } else {
        // No existing request - show rent form
        setShowWhatsAppDialog(false);
        setShowRentForm(true);
      }
    } catch (error) {
      console.error("Failed to fetch existing request", error);
      // On error, show rent form
      setShowWhatsAppDialog(false);
      setShowRentForm(true);
    }
  };

  // Send Business Email OTP
  const sendOtpToBusinessEmail = async () => {
    if (!shopkeeperDetails.email) {
      toast({
        duration: 5000,
        title: "Email Required",
        description: "Please enter your email",
        variant: "destructive",
      });
      return;
    }

    setSendingOtp(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch(`${apiURL}/otp/send-business-email-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          businessEmail: shopkeeperDetails.email,
          // Lets the backend send the OTP from the organizer's custom
          // sender (Personal Email) when their toggle is on.
          organizerId:
            (eventData as any)?.organizer?._id ||
            (typeof (eventData as any)?.organizer === "string"
              ? (eventData as any).organizer
              : undefined),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send OTP");
      }

      setOtpSent(true);
      toast({
        duration: 5000,
        title: "OTP Sent",
        description: "OTP sent to your email",
      });
    } catch (error: any) {
      toast({
        duration: 5000,
        title: "Failed to send OTP",
        description: error.message || "Failed to send OTP",
        variant: "destructive",
      });
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify Business Email OTP
  const verifyOtpForBusinessEmail = async () => {
    if (!otp || otp.length < 4) {
      setOtpError("Please enter a valid OTP");
      return;
    }
    try {
      setVerifyingOtp(true);
      const token = sessionStorage.getItem("token");
      const response = await fetch(`${apiURL}/otp/verify-business-email-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          businessEmail: shopkeeperDetails.email,
          otp,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Invalid OTP");
      }
      setEmailVerified(true);
      setOtpError("");
      toast({
        duration: 5000,
        title: "Verified",
        description: "Email verified",
      });
    } catch (error: any) {
      setOtpError(error.message);
      toast({
        duration: 5000,
        title: "Error",
        description: error.message || "Invalid OTP",
        variant: "destructive",
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Handle form input changes
  const handleRentFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setShopkeeperDetails((prev) => ({ ...prev, [name]: value }));
  };

  // ── Preferred space types WITH quantity ──────────────────────────────
  // Max total spaces the organizer allows this vendor (default 1).
  const maxSpacesPerVendor = Math.max(
    1,
    Number((eventData as any)?.maxSpacesPerVendor) || 1,
  );
  // Total quantity currently requested across all selected preferred types.
  const totalPreferredSpaces = (
    shopkeeperDetails.preferredTemplateIds || []
  ).reduce(
    (sum, _id, i) =>
      sum + (Number(shopkeeperDetails.preferredTemplateQuantities?.[i]) || 1),
    0,
  );
  // Per-type ceiling: the template's own maxPerBooking if set, else the cap.
  const perTypeMax = (template: any) => {
    const m = Number(template?.maxPerBooking);
    return Number.isFinite(m) && m > 0 ? m : maxSpacesPerVendor;
  };

  // How many spaces are still available for each template type?
  // Used to disable fully-booked templates in the preference picker.
  // We exclude the vendor's own booked positions so they can still
  // re-select or adjust a type they already hold.
  const myBookedPositionIds = new Set(
    (existingStallRequest?.selectedTables || []).map((t: any) => t.positionId),
  );
  const spaceAvailabilityByTemplate = (() => {
    // Flatten venueTables (Record<string, Table[]>) into a single array.
    const vt = (eventData as any)?.venueTables || {};
    const allTables: any[] = Array.isArray(vt)
      ? vt
      : vt && typeof vt === "object"
        ? Object.values(vt).flat()
        : [];
    const counts: Record<string, { total: number; booked: number }> = {};
    for (const t of allTables) {
      if (t.forSale === false) continue;
      const tid = t.id;
      if (!tid) continue;
      if (!counts[tid]) counts[tid] = { total: 0, booked: 0 };
      counts[tid].total++;
      // A space counts as "booked" only when held by someone else.
      // Spaces the vendor already holds should not block them from
      // picking the same template type again.
      if (t.isBooked && !myBookedPositionIds.has(t.positionId)) {
        counts[tid].booked++;
      }
    }
    return counts;
  })();
  const isTemplateFullyBooked = (template: any): boolean => {
    const info = spaceAvailabilityByTemplate[template.id];
    if (!info || info.total === 0) return false; // no spaces placed yet → not "full"
    return info.total - info.booked <= 0;
  };

  // Add / remove a preferred type. Adds with quantity 1 (blocked at the cap).
  const togglePreferredType = (template: any) => {
    const ids = shopkeeperDetails.preferredTemplateIds || [];
    const names = shopkeeperDetails.preferredTemplateNames || [];
    const qtys = shopkeeperDetails.preferredTemplateQuantities || [];
    const idx = ids.indexOf(template.id);
    // When all spaces of this type are booked the vendor can still
    // pick it — they just go on a waiting queue and we let them know.
    if (idx < 0 && isTemplateFullyBooked(template)) {
      toast({
        duration: 6000,
        title: "Sold out — joining waitlist",
        description: `All "${template.name}" spaces are booked. You'll be placed in a waiting queue and notified when one opens up.`,
        variant: "default",
      });
    }
    if (idx >= 0) {
      const keep = (_: any, i: number) => i !== idx;
      const nIds = ids.filter(keep);
      const nNames = names.filter(keep);
      const nQtys = qtys.filter(keep);
      setShopkeeperDetails((prev) => ({
        ...prev,
        preferredTemplateIds: nIds,
        preferredTemplateNames: nNames,
        preferredTemplateQuantities: nQtys,
        preferredTemplateId: nIds[0] || "",
        preferredTemplateName: nNames.join(", "),
      }));
      return;
    }
    if (totalPreferredSpaces >= maxSpacesPerVendor) {
      // Single-space events behave like a radio group: clicking a different
      // type SWITCHES the preference (the vendor hasn't submitted yet), instead
      // of being blocked and forced to deselect the current one first.
      if (maxSpacesPerVendor === 1) {
        setShopkeeperDetails((prev) => ({
          ...prev,
          preferredTemplateIds: [template.id],
          preferredTemplateNames: [template.name],
          preferredTemplateQuantities: [1],
          preferredTemplateId: template.id,
          preferredTemplateName: template.name,
        }));
        return;
      }
      toast({
        duration: 3000,
        title: "Space limit reached",
        description: `You can request at most ${maxSpacesPerVendor} space${maxSpacesPerVendor === 1 ? "" : "s"} in total.`,
        variant: "destructive",
      });
      return;
    }
    setShopkeeperDetails((prev) => ({
      ...prev,
      preferredTemplateIds: [...ids, template.id],
      preferredTemplateNames: [...names, template.name],
      preferredTemplateQuantities: [...qtys, 1],
      preferredTemplateId: ids[0] || template.id,
      preferredTemplateName: [...names, template.name].join(", "),
    }));
  };
  // Bump a selected type's quantity, respecting its per-type ceiling and the
  // overall cap.
  const changePreferredQty = (template: any, delta: number) => {
    const ids = shopkeeperDetails.preferredTemplateIds || [];
    const idx = ids.indexOf(template.id);
    if (idx < 0) return;
    const qtys = [...(shopkeeperDetails.preferredTemplateQuantities || [])];
    const cur = Number(qtys[idx]) || 1;
    if (delta > 0) {
      if (totalPreferredSpaces + 1 > maxSpacesPerVendor) {
        toast({
          duration: 3000,
          title: "Space limit reached",
          description: `Total is capped at ${maxSpacesPerVendor}.`,
          variant: "destructive",
        });
        return;
      }
      if (cur + 1 > perTypeMax(template)) {
        toast({
          duration: 3000,
          title: "Type limit reached",
          description: `At most ${perTypeMax(template)} of "${template.name}".`,
          variant: "destructive",
        });
        return;
      }
    }
    qtys[idx] = Math.max(1, cur + delta);
    setShopkeeperDetails((prev) => ({
      ...prev,
      preferredTemplateQuantities: qtys,
    }));
  };

  // Handle form submission - UPDATED FOR NEW WORKFLOW
  const handleRentFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEventOver(eventData)) {
      toast({
        title: "This event has ended",
        description: "Stall bookings are closed for this event.",
        variant: "destructive",
      });
      return;
    }

    if (!emailVerified && !shopkeeperExists) {
      toast({
        duration: 5000,
        title: "Email Not Verified",
        description: "Please verify your business email",
        variant: "destructive",
      });
      return;
    }

    // ---- Mandatory-field validation ----
    // Selects, file uploads, the phone input and textareas can't rely on the
    // native `required` attribute inside this dialog, so we validate every
    // required field explicitly and surface the complete list of what's
    // missing in one message.
    const d = shopkeeperDetails;
    const missing: string[] = [];
    const blank = (v: any) => !String(v ?? "").trim();
    const req = (isMissing: boolean, label: string) => {
      if (isMissing) missing.push(label);
    };
    // Only enforce a field the organizer has actually kept on the form —
    // otherwise disabling a field here would make the form permanently
    // unsubmittable (nothing collects a value for it, so it's always
    // "missing"). `stallOn` is the component-scoped helper declared near
    // eventData, shared with the form JSX. See
    // frontend/src/lib/registrationFormFields.ts.

    req(blank(d.nameOfApplicant), "Name of Applicant");
    req(blank(d.name), "Owner Name");
    if (stallOn("businessOwnerNationality"))
      req(blank(d.businessOwnerNationality), "Owner Nationality");
    if (stallOn("residency")) req(blank(d.residency), "Residency");
    if (stallOn("brandName")) req(blank(d.brandName), "Brand Name");
    req(blank(d.shopName), "Registered Business Name");
    if (!shopkeeperExists) req(blank(d.email), "Primary Email");
    if (stallOn("businessEmail"))
      req(blank(d.businessEmail), "Business Email");
    if (stallOn("whatsappNumber"))
      req(blank(d.whatsappNumber), "WhatsApp Number");
    if (stallOn("phone")) req(blank(d.phone), "Phone Number");
    if (stallOn("businessCategory"))
      req(blank(d.businessCategory), "Business Category");
    if (stallOn("noOfOperators"))
      req(!d.noOfOperators || Number(d.noOfOperators) < 1, "No. of Operators");
    if (stallOn("registrationNumber"))
      req(blank(d.registrationNumber), "Registration Number");
    if (stallOn("faceBookLink"))
      req(blank(d.faceBookLink), "Facebook Link");
    if (stallOn("instagramLink"))
      req(blank(d.instagramLink), "Instagram Link");
    if (stallOn("description"))
      req(blank(d.description), "Business, Products & Brand Description");
    if (stallOn("refundPaymentDescription"))
      req(blank(d.refundPaymentDescription), "Refund Payment Description");
    if (stallOn("address")) req(blank(d.address), "Full Address");

    // Document uploads + at least one product image are mandatory. A returning
    // vendor's stored images are loaded as previews, so an existing preview
    // satisfies the requirement (no forced re-upload); a new file overrides it.
    if (stallOn("registrationImage"))
      req(!regImageFile && !regImagePreview, "Business Registration Document");
    if (stallOn("companyLogo"))
      req(!logoFile && !logoPreview, "Company Logo");
    if (stallOn("productImage"))
      req(
        productFiles.length < 1 && existingProductImages.length < 1,
        "at least 1 Product Image",
      );

    // Preferred space type — only required when the event exposes sellable
    // space templates (same condition that renders the picker).
    const sellableTemplates =
      eventData?.tableTemplates?.filter((t: any) => t.forSale !== false) || [];
    if (sellableTemplates.length > 0) {
      req(
        !(d.preferredTemplateIds && d.preferredTemplateIds.length > 0),
        "Preferred Space Type",
      );
    }

    if (missing.length) {
      toast({
        duration: 6000,
        title: "Missing required fields",
        description: `Please complete: ${missing.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }

    // Format checks — run only once all required fields are present.
    const invalid: string[] = [];
    const checkPhoneLen = (value: string, country: any, label: string) => {
      const digits = String(value || "").replace(/\D/g, "");
      if (!digits) return;
      const dial = String(country?.dialCode || "").replace(/\D/g, "");
      const national =
        dial && digits.startsWith(dial) ? digits.slice(dial.length) : digits;
      const [min, max] = phoneNationalLength(country?.countryCode);
      if (national.length < min || national.length > max) {
        const need = min === max ? `${min} digits` : `${min}–${max} digits`;
        invalid.push(
          `${label} must be ${need} for ${country?.name || "the selected country"}`,
        );
      }
    };
    checkPhoneLen(d.whatsappNumber, whatsappCountry, "WhatsApp Number");
    checkPhoneLen(d.phone, phoneCountry, "Phone Number");
    const regNo = String(d.registrationNumber || "").trim();
    if (regNo && !/^[A-Za-z0-9]+$/.test(regNo)) {
      invalid.push("Registration Number must be letters and numbers only");
    } else if (
      regNo &&
      regConfig.maxLength > 0 &&
      (regNo.length < regConfig.minLength || regNo.length > regConfig.maxLength)
    ) {
      invalid.push(
        regConfig.minLength === regConfig.maxLength
          ? `${regConfig.label} must be exactly ${regConfig.maxLength} alphanumeric characters`
          : `${regConfig.label} must be ${regConfig.minLength}–${regConfig.maxLength} alphanumeric characters`,
      );
    }
    if (invalid.length) {
      toast({
        duration: 6000,
        title: "Please check these fields",
        description: invalid.join(". ") + ".",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("eventId", eventData?._id || "");
      formData.append("organizerId", eventData?.organizer?._id || "");

      // Append standard info
      // For an existing vendor we pass the id (update path); for a new one the
      // backend creates the record. Either way we send the full profile so any
      // edits made on the form persist back to the vendors collection.
      if (shopkeeperExists && shopkeeperId) {
        formData.append("shopkeeperId", shopkeeperId);
      }
      // "Register a new request": force a brand-new vendor profile even though
      // the authenticated email already belongs to one or more vendors.
      if (registerNewMode) {
        formData.append("forceNewVendor", "true");
      }
      formData.append("shopkeeperName", shopkeeperDetails.name);
      formData.append("shopkeeperEmail", shopkeeperDetails.email);
      // Both exhibitor emails are persisted so stall updates go to each.
      if (shopkeeperDetails.businessEmail)
        formData.append(
          "shopkeeperBusinessEmail",
          shopkeeperDetails.businessEmail,
        );
      formData.append(
        "shopkeeperWhatsAppNumber",
        shopkeeperDetails.whatsappNumber.startsWith("+")
          ? shopkeeperDetails.whatsappNumber
          : `+${shopkeeperDetails.whatsappNumber}`,
      );
      formData.append("shopkeeperPhoneNumber", shopkeeperDetails.phone);
      formData.append("businessName", shopkeeperDetails.shopName);
      formData.append("businessType", shopkeeperDetails.businessCategory);
      formData.append("businessAddress", shopkeeperDetails.address);

      // Append new schema fields
      formData.append("brandName", shopkeeperDetails.brandName);
      formData.append("displayName", shopkeeperDetails.displayName);
      formData.append("nameOfApplicant", shopkeeperDetails.nameOfApplicant);
      formData.append(
        "businessOwnerNationality",
        shopkeeperDetails.businessOwnerNationality,
      );

      formData.append(
        "registrationNumber",
        shopkeeperDetails.registrationNumber,
      );
      formData.append("residency", shopkeeperDetails.residency);
      // GST verification result — cached on the vendor so returning exhibitors
      // aren't re-verified (saves the external API call) and shown to the
      // organizer in the stall details dialog for easy approval.
      formData.append("isGSTVerified", gstVerified ? "true" : "false");
      if (gstDetails) formData.append("gstDetails", JSON.stringify(gstDetails));
      formData.append("isUENVerified", uenVerified ? "true" : "false");
      if (uenDetails) formData.append("uenDetails", JSON.stringify(uenDetails));
      formData.append(
        "refundPaymentDescription",
        shopkeeperDetails.refundPaymentDescription,
      );

      formData.append(
        "noOfOperators",
        shopkeeperDetails.noOfOperators.toString(),
      );
      formData.append("productDescription", shopkeeperDetails.description);

      if (shopkeeperDetails.faceBookLink)
        formData.append("faceBookLink", shopkeeperDetails.faceBookLink);
      if (shopkeeperDetails.instagramLink)
        formData.append("instagramLink", shopkeeperDetails.instagramLink);
      // Multiple preferred space types (combination). Sent as JSON; the legacy
      // singular fields are kept in sync (first selection) for older paths.
      const prefIds: string[] = shopkeeperDetails.preferredTemplateIds || [];
      const prefNames: string[] =
        shopkeeperDetails.preferredTemplateNames || [];
      if (prefIds.length > 0) {
        // Quantities parallel to prefIds — default 1 for any missing entry.
        const prefQtys = prefIds.map((_id, i) =>
          Math.max(
            1,
            Number(shopkeeperDetails.preferredTemplateQuantities?.[i]) || 1,
          ),
        );
        formData.append("preferredTemplateIds", JSON.stringify(prefIds));
        formData.append("preferredTemplateNames", JSON.stringify(prefNames));
        formData.append(
          "preferredTemplateQuantities",
          JSON.stringify(prefQtys),
        );
        formData.append("preferredTemplateId", prefIds[0]);
        formData.append("preferredTemplateName", prefNames.join(", "));
      } else if (shopkeeperDetails.preferredTemplateId) {
        formData.append(
          "preferredTemplateId",
          shopkeeperDetails.preferredTemplateId,
        );
        if (shopkeeperDetails.preferredTemplateName)
          formData.append(
            "preferredTemplateName",
            shopkeeperDetails.preferredTemplateName,
          );
      }

      // Append Files
      if (regImageFile) formData.append("registrationImage", regImageFile);
      if (logoFile) formData.append("companyLogo", logoFile);
      productFiles.forEach((file) => formData.append("productImage", file));

      // Submit stall request
      const response = await fetch(`${apiURL}/stalls/register-for-stall`, {
        method: "POST",
        body: formData, // Notice: No Content-Type header needed for FormData!
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to submit rental request");
      }

      toast({
        duration: 5000,
        title: "Success",
        description:
          "Stall request submitted successfully. Waiting for organizer approval.",
      });

      setShopkeeperDetails(initialForm);
      setRegImageFile(null);
      setRegImagePreview("");
      setLogoFile(null);
      setLogoPreview("");
      setProductFiles([]);
      setProductPreviews([]);
      setExistingProductImages([]);
      setStallMembership(null);
      // Close the form AND the status/detail dialog → land on the eventfront.
      returnToEventfront();
    } catch (error: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRentFormCancel = () => {
    setShowRentForm(false);
    setShopkeeperDetails(initialForm);
    setEmailVerified(false);
    setOtpSent(false);
    setOtp("");
    setStallMembership(null);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: eventData?.title,
          text: eventData?.description,
          url: window.location.href,
        });
      } catch (error) {}
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        duration: 5000,
        title: "Link Copied",
        description: "Event link copied to clipboard",
      });
    }
  };

  const handleGetTickets = async (typeIndexOverride?: number) => {
    if (!eventData || !eventData.organizer) return;
    if ((eventData as any)?.isDemo) {
      setShowDemoPrompt(true);
      return;
    }
    if (isEventOver(eventData)) {
      toast({
        title: "This event has ended",
        description: "Ticket sales are closed for this event.",
        variant: "destructive",
      });
      return;
    }

    const { visitorTypes } = eventData;
    // Allow a caller (e.g. the chatbot ticket picker) to choose the visitor
    // type directly; otherwise use the sidebar's selected type.
    const chosenTypeIndex =
      typeof typeIndexOverride === "number"
        ? typeIndexOverride
        : selectedVisitorType;
    let cartItems: any[] = [];

    if (visitorTypes && visitorTypes.length > 0) {
      // Single selected visitor type
      const vt = visitorTypes[chosenTypeIndex];
      if (!vt) return;

      cartItems = [
        {
          eventId: eventData._id,
          eventTitle: eventData.title,
          ticketType: vt.name,
          tierId: vt.id,
          price: Number(vt.price) || 0,
          quantity: 1,
          maxQuantity: Number(vt.maxCount) || 100,
          organizerId: eventData?.organizer?._id,
          organizerName: eventData.organizer.name,
          organizationName: eventData.organizer.organizationName,
          eventDate: eventData.startDate,
          eventTime: eventData.time,
          venue: eventData.location || eventData.address,
          category: eventData.category,
          ageRestriction: eventData.ageRestriction,
          dressCode: eventData.dresscode,
          validUntil: eventData.endDate,
          image: eventData.image,
          description: eventData.description,
        },
      ];
    } else {
      // Single ticket type (legacy)
      cartItems = [
        {
          eventId: eventData._id,
          eventTitle: eventData.title,
          ticketType: "General",
          price: Number(eventData.ticketPrice) || 0,
          quantity: ticketQuantity,
          maxQuantity: Number(eventData.totalTickets) || 1,
          organizerId: eventData?.organizer?._id,
          organizerName: eventData.organizer.name,
          organizationName: eventData.organizer.organizationName,
          eventDate: eventData.startDate,
          eventTime: eventData.time,
          venue: eventData.location || eventData.address,
          category: eventData.category,
          ageRestriction: eventData.ageRestriction,
          dressCode: eventData.dresscode,
          validUntil: eventData.endDate,
          image: eventData.image,
          description: eventData.description,
        },
      ];
    }

    // The cart holds ONE event at a time — a checkout is per-event, so mixing
    // two would be unbuyable. Picking tickets for a different event now
    // REPLACES what was there (it used to refuse with an alert and strand the
    // visitor, who had no way to clear the old cart from this page).
    const existingCart = JSON.parse(localStorage.getItem("ticketCart") || "{}");
    const existingItems = existingCart.items || [];
    const existingEventId =
      existingItems.length > 0 ? existingItems[0].eventId : null;
    const replacedEventTitle =
      existingEventId && existingEventId !== eventData._id
        ? existingCart?.eventInfo?.title || "another event"
        : null;

    const newCartData = {
      items: cartItems,
      eventInfo: {
        id: eventData._id,
        title: eventData.title,
        organizerId: eventData?.organizer?._id,
        organizerName: eventData.organizer.name,
        organizationName: eventData.organizer.organizationName,
        date: eventData.startDate,
        time: eventData.time,
        venue: eventData.location || eventData.address,
        description: eventData.description,
        category: eventData.category,
        ageRestriction: eventData.ageRestriction,
        dressCode: eventData.dresscode,
        image: eventData.image,
        tags: eventData.tags,
        refundPolicy: eventData.refundPolicy,
        features: eventData.features,
      },
      timestamp: Date.now(),
    };

    // Overwrites wholesale, so nothing from the previous event survives.
    localStorage.setItem("ticketCart", JSON.stringify(newCartData));
    if (replacedEventTitle) {
      // Say it plainly — a silently emptied cart is worse than a refusal.
      toast({
        duration: 6000,
        title: "Cart updated",
        description: `Your tickets for "${replacedEventTitle}" were removed — a cart can only hold one event at a time.`,
      });
    }
    navigate(`/ticket-cart/${newCartData.eventInfo.organizerId}`);
  };

  // Cinema/concert seat map: build one cart line item per tier touched by
  // the current seat selection (a buyer can mix VIP + standard seats in one
  // purchase), each carrying its own seatIds — mirrors handleGetTickets but
  // quantity is derived from the seats picked, not typed in.
  const handleGetSeatTickets = () => {
    if (!eventData || !eventData.organizer) return;
    if ((eventData as any)?.isDemo) {
      setShowDemoPrompt(true);
      return;
    }
    if (isEventOver(eventData)) {
      toast({
        title: "This event has ended",
        description: "Ticket sales are closed for this event.",
        variant: "destructive",
      });
      return;
    }
    if (selectedSeats.length === 0) return;

    // Individual seats placed on the currently-viewed venue layout — same
    // venueConfigId matching the eventfront's spatial venue map uses
    // (untagged/legacy seats belong only to the first layout).
    const currentCfgId =
      (eventData as any)?.venueConfig?.map((c: any) => c.id)?.[
        currentLayoutIndex
      ] || "default";
    const layoutSeats: any[] = (
      (eventData as any)?.venueSeats || []
    ).filter((s: any) =>
      s?.venueConfigId && s.venueConfigId !== "default"
        ? s.venueConfigId === currentCfgId
        : currentLayoutIndex === 0,
    );
    const rowDefs: any[] = (eventData as any)?.seatRowTemplates || [];
    // Seats are self-priced via their own row template — no VisitorType
    // lookup involved.
    const seatsByRow = new Map<string, { seatIds: string[] }>();
    for (const seatId of selectedSeats) {
      const seat = layoutSeats.find((s) => s.id === seatId);
      if (!seat) continue;
      const entry = seatsByRow.get(seat.rowId) || { seatIds: [] };
      entry.seatIds.push(seatId);
      seatsByRow.set(seat.rowId, entry);
    }

    const cartItems: any[] = [];
    for (const [rowId, { seatIds }] of seatsByRow) {
      const row = rowDefs.find((r) => r.id === rowId);
      if (!row) continue;
      const seatLabels = seatIds
        .map((id) => {
          const seat = layoutSeats.find((s) => s.id === id);
          if (seat?.name) return seat.name;
          return `${row.name}${seat?.seatNumber ?? ""}`;
        })
        .sort();
      cartItems.push({
        eventId: eventData._id,
        eventTitle: eventData.title,
        ticketType: `${row.name} (Seats ${seatLabels.join(", ")})`,
        tierId: row.id,
        price: Number(row.price) || 0,
        quantity: seatIds.length,
        maxQuantity: seatIds.length,
        seatIds,
        organizerId: eventData?.organizer?._id,
        organizerName: eventData.organizer.name,
        organizationName: eventData.organizer.organizationName,
        eventDate: eventData.startDate,
        eventTime: eventData.time,
        venue: eventData.location || eventData.address,
        category: eventData.category,
        ageRestriction: eventData.ageRestriction,
        dressCode: eventData.dresscode,
        validUntil: eventData.endDate,
        image: eventData.image,
        description: eventData.description,
      });
    }
    if (cartItems.length === 0) return;

    const existingCart = JSON.parse(localStorage.getItem("ticketCart") || "{}");
    const existingItems = existingCart.items || [];
    const existingEventId =
      existingItems.length > 0 ? existingItems[0].eventId : null;
    const replacedEventTitle =
      existingEventId && existingEventId !== eventData._id
        ? existingCart?.eventInfo?.title || "another event"
        : null;

    const newCartData = {
      items: cartItems,
      eventInfo: {
        id: eventData._id,
        title: eventData.title,
        organizerId: eventData?.organizer?._id,
        organizerName: eventData.organizer.name,
        organizationName: eventData.organizer.organizationName,
        date: eventData.startDate,
        time: eventData.time,
        venue: eventData.location || eventData.address,
        description: eventData.description,
        category: eventData.category,
        ageRestriction: eventData.ageRestriction,
        dressCode: eventData.dresscode,
        image: eventData.image,
        tags: eventData.tags,
        refundPolicy: eventData.refundPolicy,
        features: eventData.features,
      },
      timestamp: Date.now(),
    };

    localStorage.setItem("ticketCart", JSON.stringify(newCartData));
    if (replacedEventTitle) {
      toast({
        duration: 6000,
        title: "Cart updated",
        description: `Your tickets for "${replacedEventTitle}" were removed — a cart can only hold one event at a time.`,
      });
    }
    navigate(`/ticket-cart/${newCartData.eventInfo.organizerId}`);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; color: string }> =
      {
        Pending: {
          variant: "secondary",
          icon: Clock,
          color: "text-yellow-600",
        },
        Confirmed: {
          variant: "default",
          icon: CheckCircle2,
          color: "text-green-600",
        },
        Cancelled: {
          variant: "destructive",
          icon: XCircle,
          color: "text-red-600",
        },
        Processing: {
          variant: "default",
          icon: AlertCircle,
          color: "text-blue-600",
        },
        Completed: {
          variant: "default",
          icon: CheckCircle2,
          color: "text-green-700",
        },
        Approved: {
          variant: "default",
          icon: CheckCircle2,
          color: "text-green-600",
        },
      };

    const config = variants[status] || variants.Pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getPaymentBadge = (paymentStatus: string) => {
    const variants: Record<string, { variant: any; color: string }> = {
      Unpaid: { variant: "destructive", color: "text-red-600" },
      Partial: { variant: "secondary", color: "text-yellow-600" },
      Paid: { variant: "default", color: "text-green-600" },
    };

    const config = variants[paymentStatus] || variants.Unpaid;

    return <Badge variant={config.variant}>{paymentStatus}</Badge>;
  };

  const handleBack = () => {
    // Always defer to browser history. No invented fallback destinations
    // — if there's no previous page, the browser handles it (typically
    // no-op or close-tab depending on context).
    navigate(-1);
  };

  const nextImage = () => {
    if (eventData?.gallery && eventData.gallery.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === eventData.gallery.length - 1 ? 0 : prev + 1,
      );
    }
  };

  const prevImage = () => {
    if (eventData?.gallery && eventData.gallery.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? eventData.gallery.length - 1 : prev - 1,
      );
    }
  };

  // Scrolls a horizontal card row by roughly one card-width (w-64 = 256px
  // + gap-4 = 16px). Used by the Speakers/Workshops Prev/Next buttons.
  const scrollRowByCard = (
    ref: React.RefObject<HTMLDivElement>,
    direction: 1 | -1,
  ) => {
    ref.current?.scrollBy({ left: direction * 272, behavior: "smooth" });
  };

  async function handleDownload(stall: any) {
    // 1. Safety check before calling API
    if (stall.paymentStatus !== "Paid") {
      alert("Stall ticket is only available after payment is confirmed.");
      return;
    }

    try {
      const response = await fetch(
        `${__API_URL__}/stalls/download-stall-ticket/${stall._id}`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to download ticket");
      }

      // 2. Convert response to Blob
      const blob = await response.blob();

      // 3. Create a temporary link element to trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Set file name: e.g., stall_ticket_EventName.pdf
      const fileName = `stall_ticket_${stall.eventId?.title || stall._id}.pdf`;
      link.setAttribute("download", fileName);

      // 4. Append to body, click, and cleanup
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download Error:", error);
      alert(
        error instanceof Error ? error.message : "Error downloading ticket",
      );
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-base sm:text-lg font-light text-gray-500">
            Loading event details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 max-w-md w-full shadow-sm">
          <p className="text-red-500 mb-4 text-base sm:text-lg">
            {error || "Event not found"}
          </p>
          <Button
            onClick={handleBack}
            className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Publish gate: when the organizer has unpublished the event, the public
  // link must not render it — even for someone who already has the URL.
  // Only block on an explicit `false` so legacy events (no field) stay visible.
  if ((eventData as any).published === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 max-w-md w-full shadow-sm">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
            Event not available
          </h2>
          <p className="text-sm sm:text-base text-gray-500">
            This event is not currently published by the organizer. Please check
            back later.
          </p>
        </div>
      </div>
    );
  }

  // Personal/Marriage events get a dedicated, wedding-themed public page
  // instead of the commercial ticketing layout. Branch after the loading/
  // error/publish gates so it reuses the same fetch + access rules.
  const _isMarriageFront =
    (eventData as any).eventType === "personal" &&
    ((eventData as any).category === "Marriage Function" ||
      (Array.isArray((eventData as any).categories) &&
        (eventData as any).categories.includes("Marriage Function")));
  if (_isMarriageFront) {
    return <MarriageEventFront eventData={eventData} />;
  }

  const {
    title,
    description,
    category,
    startDate,
    time,
    endDate,
    endTime,
    organizer,
    location,
    address,
    ticketPrice: rawTicketPrice,
    totalTickets: rawTotalTickets,
    originalTotalTickets: rawOriginalTotal,
    visitorTypes,
    seatRowTemplates,
    venueSeats: rawVenueSeats,
    seatMapBookedSeats: rawSeatMapBookedSeats,
    tags,
    features,
    ageRestriction,
    dresscode,
    specialInstructions,
    image,
    gallery,
    reelLinks,
    socialMedia,
    refundPolicy,
    termsAndConditions,
    tableTemplates,
    venueTables,
    addOnItems,
    venueConfig,
  } = eventData;

  // Pre-compute the cleaned reel list ONCE so the History tab's
  // visibility, default-tab selection, and content body all read the
  // same source of truth. Trims whitespace, drops empty rows, and
  // tolerates a missing `reelLinks` field on legacy events. When
  // empty, the History tab + its content are skipped entirely and
  // the default tab falls back to Organizer.
  const cleanedReelLinks: string[] = Array.isArray(reelLinks)
    ? reelLinks.map((u) => String(u || "").trim()).filter(Boolean)
    : [];
  const allVenueSeats: any[] = Array.isArray(rawVenueSeats)
    ? rawVenueSeats
    : [];
  const seatMapBookedSeats: string[] = Array.isArray(rawSeatMapBookedSeats)
    ? rawSeatMapBookedSeats
    : [];
  const hasReels = cleanedReelLinks.length > 0;

  // Sponsorship entry points only appear once the organizer publishes tiers.
  const sponsorTiersAvailable =
    Array.isArray((eventData as any)?.sponsorTypes) &&
    (eventData as any).sponsorTypes.length > 0;
  // The link lives next to "Become a member" inside the stall card. When the
  // event has no stalls that card never renders, so fall back to a card of
  // its own rather than leaving sponsors with no way in.
  const showStallCard = !!venueTables && Object.keys(venueTables).length > 0;

  // Jump to a bottom tab section from an info card. Optionally expands the
  // venue map. Scroll is deferred so the (lazily-mounted) tab content exists.
  const goToTab = (tab: string, openVenue = false) => {
    setActiveTab(tab);
    if (openVenue) setShowVenueLayout(true);
    setTimeout(() => {
      tabsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  };

  // Guard shared by the chatbot booking shortcuts — a past event accepts no
  // new bookings (the backend also refuses).
  const guardEventOpen = (what: string): boolean => {
    if (isEventOver(eventData)) {
      toast({
        title: "This event has ended",
        description: `${what} are closed for this event.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Open the "Apply to Speak" dialog (same as the on-page "Apply to Speak"
  // button). Reused by the chatbot "Apply as speaker" pill.
  const openSpeakerApply = () => {
    if (!guardEventOpen("Speaker applications")) return;
    setShowSpeakerDialog(true);
    setSpeakerStep("auth");
    setSpeakerGoogleLoading(false);
    setSpeakerAuthedEmail("");
    setSpeakerVerified(false);
    setExistingSpeakerRequest(null);
    setSpeakerProfileFound(false);
    setSpeakerFormData((p: any) => ({ ...p, email: "" }));
  };

  // Open the round-table booking flow: jump to the Venue tab and reveal the
  // layout so the visitor can pick seats. Reused by the chatbot pill.
  const openRoundTableBooking = () => {
    if (!guardEventOpen("Round-table bookings")) return;
    goToTab("venue", true);
  };

  // ── "Add to Google Calendar" + "View on Google Maps" links for the
  // top info cards. Built from the event's date/time/venue. ──
  const toCalDate = (d: string, t?: string) => {
    const base = new Date(d);
    if (t) {
      const m = String(t).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (m) {
        let h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const ap = m[3]?.toUpperCase();
        if (ap === "PM" && h < 12) h += 12;
        if (ap === "AM" && h === 12) h = 0;
        base.setHours(h, min, 0, 0);
      }
    }
    // Compact UTC format expected by Google Calendar: YYYYMMDDTHHmmssZ
    return base
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  };
  const googleCalendarUrl = (() => {
    try {
      if (!startDate) return "";
      const start = toCalDate(startDate, time);
      const end = toCalDate(endDate || startDate, endTime || time);
      const params = new URLSearchParams({
        action: "TEMPLATE",
        text: title || "Event",
        dates: `${start}/${end}`,
        location: [location, address].filter(Boolean).join(", "),
        details:
          typeof description === "string"
            ? description.replace(/<[^>]+>/g, "").slice(0, 500)
            : "",
      });
      return `https://calendar.google.com/calendar/render?${params.toString()}`;
    } catch {
      return "";
    }
  })();
  const googleMapsUrl = [location, address].filter(Boolean).length
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [location, address].filter(Boolean).join(", "),
      )}`
    : "";

  // Compute ticket price and total from visitorTypes when available
  const ticketPrice =
    visitorTypes?.length > 0
      ? Math.min(...visitorTypes.map((v: any) => v.price || 0))
      : Number(rawTicketPrice) || 0;
  const availableTickets =
    visitorTypes?.length > 0
      ? visitorTypes.reduce(
          // Only positive caps count toward availability; unlimited types
          // (no/zero/negative maxCount) contribute nothing rather than
          // dragging the total negative.
          (sum: number, v: any) => sum + (v.maxCount > 0 ? v.maxCount : 0),
          0,
        )
      : Number(rawTotalTickets) || 0;
  // Denominator = original capacity. Never let it fall below what's currently
  // available, so a missing/stale original can't show e.g. "97 / 97" — once
  // tickets sell, available drops but the total stays the original (e.g. 100).
  const totalTickets = Math.max(
    Number(rawOriginalTotal) || 0,
    availableTickets,
  );

  // Extract layout IDs from venueConfig
  const layoutIds = venueConfig?.map((config) => config.id) || [];
  const currentLayoutId = layoutIds[currentLayoutIndex] || "default";

  // Template id → colour, from the event's stall templates. Used as a fallback
  // when a placed space's own `color` is missing (e.g. the available-tables
  // API response or a re-fetch drops it) so both the inline AND maximized
  // venue maps always paint each space its template colour — never all-green.
  const templateColorById: Record<string, string> = {};
  (eventData?.tableTemplates || []).forEach((t: any) => {
    if (t?.id && t?.color) templateColorById[t.id] = t.color;
  });

  // Legend entries — one swatch per FOR-SALE stall template (its colour → the
  // type it represents). Not-for-sale / reference templates are excluded, so
  // the legend only ever explains the spaces a vendor can actually buy.
  const forSaleTemplateLegend: { name: string; color: string }[] = [];
  (eventData?.tableTemplates || []).forEach((t: any) => {
    if (!t || t.forSale === false) return;
    const color = t.color || "#22c55e";
    const name = t.name || "Space";
    if (
      !forSaleTemplateLegend.some((e) => e.name === name && e.color === color)
    )
      forSaleTemplateLegend.push({ name, color });
  });

  // How many venues the organizer marked published — drives whether the
  // public venue switcher is shown (a lone published venue needs no switcher)
  // and lets us hide unpublished halls from the switcher options below.
  const publishedVenueCount = (venueConfig || []).filter(
    (v: any) => v?.published !== false,
  ).length;

  // Decide whether an item (round table / door / annotation) tagged with a
  // venueConfigId belongs to the hall currently being viewed. A real tag must
  // match the active layout exactly. Legacy/untagged items ("" or "default")
  // belong ONLY to the first hall — otherwise they'd leak onto every hall in
  // a multi-venue event.
  const belongsToLayout = (cfgId?: string) => {
    if (cfgId && cfgId !== "default") return cfgId === currentLayoutId;
    return currentLayoutIndex === 0;
  };

  // CAD annotations (lines / text / boxes / dimensions) for the current
  // layout — rendered read-only over the venue map and the exhibitor
  // stall-selection map. Visitor maps use raw px (scale = 1).
  // When the organizer has cropped the venue, anything whose top-left falls
  // outside the cropped area is hidden on the visitor views. We filter the
  // items out (rather than clipping with overflow:hidden) so hover tooltips
  // — which extend above/below a space — are never cut off.
  const cropCfg = eventData?.venueConfig?.[currentLayoutIndex] as any;
  const cropActive = !!cropCfg?.cropped;
  const cropW = Number(cropCfg?.cropWidth) || Number(cropCfg?.width) || 0;
  const cropH = Number(cropCfg?.cropHeight) || Number(cropCfg?.height) || 0;
  const inCrop = (x?: number, y?: number) =>
    !cropActive || ((Number(x) || 0) < cropW && (Number(y) || 0) < cropH);

  // Individual seats placed on the currently-viewed venue layout — the same
  // dots the organizer clicks onto the Space Layout canvas one at a time.
  // Cropped-out seats are hidden here exactly like tables/round tables/doors.
  const seats = allVenueSeats
    .filter((s: any) => belongsToLayout(s?.venueConfigId))
    .filter((s: any) => inCrop(s?.x, s?.y));
  // Whether this event uses seating AT ALL (any screen/venue, not just the
  // one currently being viewed). Deliberately NOT `seats.length > 0` — that
  // would make the whole seat-buying UI (this section, the sidebar card,
  // the screen switcher itself) disappear the moment someone switches to a
  // screen that happens to have zero seats placed on it, with no way back.
  const showSeatPicker = allVenueSeats.length > 0;
  // Front-of-house label for the seat picker's header bar — reuses the same
  // free-text "Main Stage" label the organizer sets on the venue canvas
  // (which can read "Screen", "Stage", or anything else), independent of
  // whether they've also switched the Main Stage banner itself on.
  const seatPickerStageLabel =
    (eventData as any)?.venueConfig?.[currentLayoutIndex]?.mainStageLabel ||
    "Screen";

  const layoutAnnotations: any[] = (
    Array.isArray((eventData as any)?.venueAnnotations)
      ? ((eventData as any).venueAnnotations as any[])
      : []
  )
    .filter((a) => belongsToLayout(a?.venueConfigId))
    .filter((a) =>
      inCrop(
        a?.x ?? (Array.isArray(a?.points) ? a.points[0] : 0),
        a?.y ?? (Array.isArray(a?.points) ? a.points[1] : 0),
      ),
    );
  const whatsAppNumber = organizer?.whatsAppNumber || "";

  // Canvas size for the rendered venue map. Delegates to the helper
  // defined above the ResizeObservers so the two callers stay in sync —
  // the designer lets spaces be placed anywhere on a much larger grid,
  // so the public/selection canvas grows to cover them.
  const venueDisplayCanvas = computeCanvasExtents();

  // Placed entrance / exit doors for the current layout. Saved on the
  // event under `venueDoors` (each entry tagged with its venueConfigId
  // so multi-layout events render only the doors that belong to the
  // currently-shown layout).
  const currentLayoutDoors: any[] = (() => {
    const raw: any[] = Array.isArray((eventData as any)?.venueDoors)
      ? ((eventData as any).venueDoors as any[])
      : [];
    if (raw.length === 0) return [];
    return raw.filter((d) => belongsToLayout(d?.venueConfigId));
  })();

  // Placed Scheduled Space facilities (courts/grounds/tables bookable by
  // time slot) for the currently-viewed layout — same belongsToLayout/
  // inCrop filtering as every other venue item, so a Tennis Court placed on
  // Screen-2 doesn't show up while viewing Screen-1. This map is shown to
  // every visitor unconditionally (no referral-code gate applies here, only
  // in the booking dialog's fetch), so operator-assigned spaces are always
  // excluded — showing one here would leak its name/facility type to
  // visitors who never entered that operator's code.
  const currentLayoutScheduledSpaces: any[] = (() => {
    const raw: any[] = Array.isArray((eventData as any)?.venueScheduledSpaces)
      ? ((eventData as any).venueScheduledSpaces as any[])
      : [];
    if (raw.length === 0) return [];
    return raw
      .filter((s) => !s?.operatorId)
      .filter((s) => belongsToLayout(s?.venueConfigId))
      .filter((s) => inCrop(s?.x, s?.y));
  })();

  // The Venue Layout tab is for sellable/bookable venue items — gated by
  // whichever of those sections the organizer actually turned on for this
  // event (Spaces/AddOns, Round Tables, Speakers — which covers both
  // Speaker Slots and the physical Speaker Space zone, Workshops, and
  // Scheduled Spaces), plus doors (entrances/exits/a custom "Pathway" type,
  // etc.) since those aren't behind their own feature toggle. Cinema/concert
  // seats are deliberately EXCLUDED: they already get their own dedicated
  // "Select Your Seats" section (gated by showSeatPicker), so an event with
  // nothing but seats doesn't also need the general Venue Layout tab — it
  // would just be a redundant, seat-only copy of that section.
  const eventFeatures = (eventData as any)?.features || {};
  const hasVenueLayout =
    !!eventFeatures.hasStalls ||
    !!eventFeatures.hasRoundTables ||
    !!eventFeatures.hasSpeakers ||
    !!eventFeatures.hasWorkshops ||
    !!eventFeatures.hasScheduledSpaces ||
    currentLayoutDoors.length > 0;

  // Reusable door renderer — mirrors the designer so the storefront,
  // exhibitor stall picker, and maximised dialog all show doors at the
  // exact shape and footprint the organizer placed:
  //  - shape === "square" → rounded-md rectangle at door.width × door.height
  //  - shape === "circle" (or missing, for legacy data) → 50×50 round chip
  const renderDoors = () =>
    currentLayoutDoors
      .filter((door: any) => inCrop(door?.x, door?.y))
      .map((door: any) => {
        const type = (door?.type || "").toLowerCase();
        const isEntrance = type === "entrance";
        const isExit = type === "exit";
        const isSquare = door?.shape === "square";
        const w = Number(door?.width) > 0 ? Number(door.width) : 50;
        const h = Number(door?.height) > 0 ? Number(door.height) : 50;
        // Entrance green, exit red, custom door uses its stored colour.
        const doorColor = isEntrance
          ? "#16a34a"
          : isExit
            ? "#dc2626"
            : door?.color || "#f97316";
        const fallback = isEntrance ? "IN" : isExit ? "OUT" : "DOOR";
        return (
          <div
            key={`door-${door.id || `${door.x}-${door.y}`}`}
            className={`absolute flex items-center justify-center text-[10px] font-bold text-white shadow-md select-none pointer-events-none border-2 ${
              isSquare ? "rounded-md" : "rounded-full"
            }`}
            style={{
              left: `${door.x}px`,
              top: `${door.y}px`,
              width: `${w}px`,
              height: `${h}px`,
              backgroundColor: doorColor,
              borderColor: "rgba(0,0,0,0.25)",
              transform: `rotate(${door.rotation || 0}deg)`,
              transformOrigin: "center center",
              zIndex: 4,
            }}
            title={(door.label as string) || fallback}
          >
            <span className="px-0.5 truncate">{door.label || fallback}</span>
          </div>
        );
      });

  // Reusable seat renderer — same square-badge design language as
  // renderDoors above (colored fill, dark border, white bold label), shown
  // alongside doors/tables/round-tables/stage in the general Venue Layout
  // map (not just the dedicated ticket-buying seat picker section).
  const renderSeats = () =>
    seats.map((seat: any) => {
      const row = (seatRowTemplates || []).find(
        (r: any) => r.id === seat.rowId,
      );
      const isBooked = seatMapBookedSeats.includes(seat.id);
      return (
        <div
          key={`vseat-${seat.id}`}
          className="absolute flex items-center justify-center text-[7px] font-bold text-white shadow-md select-none pointer-events-none border-2 overflow-hidden px-0.5"
          style={{
            left: `${seat.x}px`,
            top: `${seat.y}px`,
            width: "30px",
            height: "30px",
            borderRadius: 5,
            backgroundColor: isBooked ? "#94a3b8" : seat.color || "#8B5CF6",
            borderColor: "rgba(0,0,0,0.25)",
            opacity: isBooked ? 0.6 : 1,
            zIndex: 5,
            transform: seat.rotation
              ? `rotate(${seat.rotation}deg)`
              : undefined,
          }}
          title={
            seat.name || `${row?.name || "Seat"}${seat.seatNumber}`
          }
        >
          <span className="px-0.5 truncate">
            {seat.name || seat.seatNumber}
          </span>
        </div>
      );
    });

  // Reusable Scheduled Space renderer — colored box/circle with the same
  // court/field markings (FacilityCourtMarkings) the organizer sees on
  // their own Space Layout canvas, so a Tennis Court reads as a tennis
  // court right on the public Venue Layout map too, not just a plain box.
  const renderScheduledSpaces = () =>
    currentLayoutScheduledSpaces.map((space: any) => {
      const isCircle = space.shape === "Circle";
      const w = (isCircle ? space.diameter : space.width) || 100;
      const h = (isCircle ? space.diameter : space.height) || 100;
      return (
        <div
          key={`vss-${space.positionId}`}
          className="absolute flex items-center justify-center text-white shadow-md select-none pointer-events-none overflow-hidden"
          style={{
            left: `${space.x}px`,
            top: `${space.y}px`,
            width: `${w}px`,
            height: `${h}px`,
            borderRadius: isCircle ? "50%" : "6px",
            backgroundColor: space.color || "#3b82f6",
            border: `2px solid ${space.color ? space.color + "88" : "#1d4ed8"}`,
            transform: space.rotation
              ? `rotate(${space.rotation}deg)`
              : undefined,
            zIndex: 5,
          }}
          title={`${space.name} — ${space.facilityType}`}
        >
          <FacilityCourtMarkings
            facilityType={space.facilityType}
            isCircle={isCircle}
            idSeed={`vf-${space.positionId}`}
          />
          <div className="relative z-10 text-center px-1 overflow-hidden">
            <div className="text-[9px] font-bold truncate">{space.name}</div>
            <div className="text-[7px] opacity-90 truncate">
              {space.facilityType}
            </div>
          </div>
        </div>
      );
    });

  const handleAddOnSelect = (addon: any) => {
    // In Edit-Request (amend) mode add-ons are add-only: an originally-booked
    // add-on can't be toggled off.
    if (amendMode && (amendFloor[addon.id] || 0) > 0) {
      toast({
        duration: 3000,
        title: "Can't remove this add-on",
        description: "In an edit you can only add or increase add-ons.",
        variant: "destructive",
      });
      return;
    }
    setSelectedAddOns((prev) => {
      const exists = prev.find((a) => a.id === addon.id);
      if (exists) {
        // Toggle off
        return prev.filter((a) => a.id !== addon.id);
      }
      return [
        ...prev,
        { id: addon.id, name: addon.name, price: addon.price, quantity: 1 },
      ];
    });
  };

  // Increase quantity — respects the organizer's per-space add-on cap: the
  // vendor may pick up to the per-template limit (maxPerTemplate) for EACH
  // booked space of that template, otherwise the general maxPerSpace. The total
  // cap is the sum across all selected spaces. 0 / unset = unlimited.
  const handleIncreaseQuantity = (addonId: string) => {
    const item = (eventData?.addOnItems || []).find(
      (x: any) => x.id === addonId,
    );
    const perTemplate: Record<string, any> = item?.maxPerTemplate || {};
    const general = Number(item?.maxPerSpace);
    const generalCap =
      Number.isFinite(general) && general > 0 ? general : Infinity;
    const spaces = selectedTables.length ? selectedTables : [null];
    let cap = 0;
    for (const t of spaces) {
      const tId = (t as any)?.tableId ?? (t as any)?.id;
      const tplRaw = tId != null ? Number(perTemplate[tId]) : NaN;
      const perCap =
        Number.isFinite(tplRaw) && tplRaw > 0 ? tplRaw : generalCap;
      cap += perCap;
      if (!Number.isFinite(cap)) break;
    }
    const current = selectedAddOns.find((a) => a.id === addonId)?.quantity || 0;
    if (Number.isFinite(cap) && current + 1 > cap) {
      toast({
        duration: 3500,
        title: "Add-on limit reached",
        description: `You can add at most ${cap} "${item?.name}" for your selected space${selectedTables.length === 1 ? "" : "s"}.`,
        variant: "destructive",
      });
      return;
    }
    setSelectedAddOns((prev) =>
      prev.map((a) =>
        a.id === addonId ? { ...a, quantity: a.quantity + 1 } : a,
      ),
    );
  };

  // Decrease/Remove quantity. In amend mode the quantity can't drop below the
  // originally-booked floor (add-only edits).
  const handleRemoveAddOn = (addonId: string) => {
    const floor = amendMode ? amendFloor[addonId] || 0 : 0;
    setSelectedAddOns((prev) => {
      return prev
        .map((a) =>
          a.id === addonId
            ? { ...a, quantity: Math.max(floor, a.quantity - 1) }
            : a,
        )
        .filter((a) => a.quantity > 0);
    });
  };

  // ── Edit Request (amendment) handlers ──
  // Seed the Selection tab from the existing completed booking, then open the
  // operator-edit step. Spaces are seeded so they render blue + locked.
  const startEditRequest = () => {
    const req = existingStallRequest;
    if (!req) return;
    // Past events accept no edits/transactions.
    if (isEventOver(eventData)) {
      toast({
        duration: 4000,
        title: "This event has ended",
        description: "Bookings and edits are closed for this event.",
        variant: "destructive",
      });
      return;
    }
    setAmendOperators(
      Math.min(10, Math.max(1, Number(req.noOfOperators) || 1)),
    );
    setSelectedTables(
      (req.selectedTables || []).map((t: any) => ({
        tableId: t.tableId,
        positionId: t.positionId,
        name: t.name,
        tableType: t.tableType,
        layoutName: t.layoutName,
        rowNumber: t.rowNumber,
        width: t.width,
        height: t.height,
        price: Number(t.price) || 0,
        depositAmount: Number(t.depositAmount) || 0,
        // Fields the "Selected Tables" summary reads for the read-only price
        // display (these aren't stored on the booking, so derive from price).
        tablePrice: Number(t.price) || 0,
        regularPrice: Number(t.price) || 0,
        bookingPrice: Number(t.price) || 0,
        depositPrice: Number(t.depositAmount) || 0,
        appliedTier: "regular",
        memberSaved: 0,
      })),
    );
    const seeded = (req.selectedAddOns || []).map((a: any) => ({
      id: a.addOnId,
      name: a.name,
      price: Number(a.price) || 0,
      quantity: Number(a.quantity) || 1,
    }));
    setSelectedAddOns(seeded);
    const floor: Record<string, number> = {};
    seeded.forEach((a: any) => {
      floor[a.id] = a.quantity;
    });
    setAmendFloor(floor);
    setAmendMode(true);
    setShowCompletedChoice(false);
    setShowAmendOperators(true);
  };

  const proceedAmendToSelection = () => {
    setShowAmendOperators(false);
    fetchAvailableTables();
    setShowTableSelection(true);
  };

  // Vendor submits a cancellation/delete request (goes to the organizer).
  const handleRequestCancellation = async () => {
    if (!existingStallRequest?._id) return;
    if (!cancelReason.trim()) {
      toast({
        variant: "destructive",
        title: "Add a reason",
        description: "Tell the organizer why you're cancelling.",
      });
      return;
    }
    setCancelSubmitting(true);
    try {
      const res = await fetch(
        `${apiURL}/stalls/${existingStallRequest._id}/request-cancellation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: cancelReason.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok || data?.success === false)
        throw new Error(data?.message || "Couldn't send the request.");
      toast({
        title: "Cancellation requested",
        description:
          "Your request was sent to the organizer. They'll review it and email you (with any refund details).",
      });
      setCancelReason("");
      // Close the cancel dialog AND the status/detail dialog → eventfront.
      returnToEventfront();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't send request",
        description: e?.message || "Please try again.",
      });
    } finally {
      setCancelSubmitting(false);
    }
  };

  const resetAmend = () => {
    setAmendMode(false);
    setShowAmendOperators(false);
    setShowAmendPayment(false);
    setShowTableSelection(false);
    setAmendFloor({});
    setAmendAmountDue(0);
    setAmendTxnId("");
    setAmendScreenshot(null);
    setSelectedTables([]);
    setSelectedAddOns([]);
  };

  // After a request is submitted / updated / cancelled, drop the vendor back to
  // the plain eventfront: close every stall-flow surface (form, space
  // selection, the "Stall Request Status" detail dialog, choosers and the rules
  // gate) so nothing re-opens over the page. The post-payment feedback prompt is
  // intentionally left untouched.
  const returnToEventfront = () => {
    setShowRentForm(false);
    setShowTableSelection(false);
    setExistingStallRequest(null);
    setShowStallTermsGate(false);
    setStallGateAcknowledged(false);
    setShowWhatsAppDialog(false);
    setShowAccountChooser(false);
    setShowRequestListChoice(false);
    setShowCompletedChoice(false);
    setShowRegisterTargetChoice(false);
    setShowCancelDialog(false);
  };

  const handleAmendmentSubmit = async () => {
    if (!existingStallRequest?._id) return;
    setAmendSubmitting(true);
    try {
      const res = await fetch(
        `${apiURL}/stalls/${existingStallRequest._id}/amend`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noOfOperators: String(amendOperators),
            selectedAddOns: selectedAddOns.map((a) => ({
              addOnId: a.id,
              name: a.name,
              price: a.price,
              quantity: a.quantity,
            })),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Couldn't save the edit.");
      const due = Number(data?.data?.amountDue) || 0;
      setShowTableSelection(false);
      if (due > 0) {
        setAmendAmountDue(due);
        setShowAmendPayment(true);
      } else {
        toast({
          title: "Edit submitted",
          description:
            "Awaiting organizer confirmation — your updated QR will follow once approved.",
        });
        resetAmend();
        returnToEventfront();
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't save edit",
        description: e?.message || "Please try again.",
      });
    } finally {
      setAmendSubmitting(false);
    }
  };

  const submitAmendPayment = async () => {
    if (!existingStallRequest?._id) return;
    setAmendSubmitting(true);
    try {
      const fd = new FormData();
      if (amendTxnId) fd.append("transactionId", amendTxnId);
      fd.append("paymentMethod", "qr");
      if (amendScreenshot) fd.append("screenshot", amendScreenshot);
      const res = await fetch(
        `${apiURL}/stalls/${existingStallRequest._id}/amend-payment`,
        { method: "POST", body: fd },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.message || "Couldn't record the payment.");
      toast({
        title: "Payment recorded",
        description:
          "Awaiting organizer confirmation — your updated QR will follow once approved.",
      });
      // Capture the paid difference before resetAmend() clears it, then prompt
      // for feedback on the edit-payment experience.
      setFeedbackAmount(amendAmountDue);
      resetAmend();
      returnToEventfront();
      setShowPaymentFeedback(true);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Payment failed",
        description: e?.message || "Please try again.",
      });
    } finally {
      setAmendSubmitting(false);
    }
  };

  const infoBadgeStyle = {
    backgroundColor: settings.settings.design.secondaryColor,
    color: "#fff",
    fontFamily: settings.settings.design.fontFamily,
  };

  const gradientHeadingStyle: React.CSSProperties = {
    color: design?.secondaryColor || "#0ea5e9",
    fontFamily: design?.fontFamily,
    fontWeight: 600,
  };

  return (
    // `overflow-x-clip` (not `overflow-x-hidden`) — both prevent
    // horizontal scrollbars but `clip` does NOT establish a new
    // scroll container, so `position: sticky` on descendants
    // (the Ad bar) actually works. Using `overflow-x-hidden`
    // here is what made the bar stop sticking on scroll.
    <div className="min-h-screen bg-[#f5f5f5] overflow-x-clip">
      {/* Demo-mode: showcase event. Actions invite register/contact. */}
      <DemoPrompt
        open={showDemoPrompt}
        onClose={() => setShowDemoPrompt(false)}
      />
      {(eventData as any)?.isDemo && (
        <div className="sticky top-0 z-[80] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-indigo-600 px-4 py-1.5 text-center text-xs font-semibold text-white">
          Live demo — this is an example event page.
          {((eventData as any)?.showcaseMode === "dashboard" ||
            (eventData as any)?.showcaseMode === "both") && (
            <button
              onClick={() => startDemoDashboard((eventData as any)?._id)}
              className="rounded-full bg-white/20 px-2.5 py-0.5 hover:bg-white/30"
            >
              See the organizer dashboard →
            </button>
          )}
          <button
            onClick={() => setShowDemoPrompt(true)}
            className="underline underline-offset-2 hover:opacity-90"
          >
            Create your own
          </button>
        </div>
      )}
      {/* Past-event notice — once the event is over, all purchases and
          bookings (tickets, stalls, speakers, round tables) are closed.
          The submit handlers and the backend enforce this too; this bar
          just makes it visible up front. */}
      {isEventOver(eventData) && (
        <div className="w-full bg-gray-800 px-4 py-2.5 text-center text-sm font-medium text-white">
          This event has ended — ticket sales, stall bookings, speaker
          applications and round-table reservations are now closed.
        </div>
      )}
      {/* (Ad bar moved into the sticky top-strip wrapper just above
          the header so it stays pinned at the top of the viewport
          while the page scrolls.) */}
      {/* ── Animations ── */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-fade-up { animation: fadeSlideUp 0.55s ease-out both; }
        /* Transform-only — deliberately does NOT animate opacity. The
           image is remounted (key={currentImageIndex}) on every slide
           change; an opacity:0 -> 1 keyframe left the image stuck
           invisible on some mobile browsers when the animation didn't
           resolve cleanly after a remount (seen on real devices as a
           permanently blank gallery frame). Sliding the position in is
           purely cosmetic and safe even if the animation never plays. */
        @keyframes gallerySlideIn {
          from { transform: translateX(40px); }
          to   { transform: translateX(0); }
        }
        .anim-gallery-slide { animation: gallerySlideIn 0.5s ease-out both; }
        /* Continuous right-to-left scroll for the reel carousel inside
           the History tab. The reel list is duplicated in the markup
           so translating by -50% lands the second copy seamlessly
           where the first started, giving an infinite-loop feel. */
        @keyframes reelMarquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .anim-reel-marquee { animation: reelMarquee 40s linear infinite; }
        .anim-reel-marquee:hover { animation-play-state: paused; }
        .ticket-btn-gradient {
          background: linear-gradient(135deg, var(--primary-color, #f97316) 0%, var(--secondary-color, #ef4444) 100%);
        }
        .sticky-sidebar {
          position: sticky;
          top: 80px;
          align-self: flex-start;
        }
        @media (max-width: 1023px) {
          .sticky-sidebar { position: static; }
        }
      `}</style>

      {/* ── Sticky top strip: Ad Bar only ──
          The previous back/title/share header was removed; the Ad
          bar (announcement marquee) is now the only sticky strip
          at the top of the eventfront. Sticky here works because
          the parent uses `overflow-x-clip` (not `-hidden`), which
          doesn't establish a scroll container. */}
      <div className="sticky top-0 z-50">
        {(eventData as any)?.adBar?.visible &&
          (eventData as any)?.adBar?.message && (
            <AnnouncementBar
              message={(eventData as any).adBar.message}
              backgroundColor={(eventData as any).adBar.bgColor || "#000000"}
              textColor={(eventData as any).adBar.textColor || "#ffffff"}
            />
          )}
      </div>

      {/* ── Hero Banner ── */}
      {/* Full width, natural height: the image fills the entire width
          (width is never affected) and its height follows the image's own
          aspect ratio, so the whole image is shown — nothing cropped on
          any side. */}
      <div className="relative w-full overflow-hidden">
        {image ? (
          <img
            src={
              image.startsWith("/")
                ? `${apiURL?.replace("/api", "")}${image}`
                : image
            }
            alt={title}
            className="block w-full h-auto"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div
            className="w-full bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 flex items-center justify-center"
            style={{ height: "clamp(220px, 34vw, 440px)" }}
          >
            <div className="text-center text-white/90">
              <div className="text-5xl mb-3">🎪</div>
              <p className="text-xl font-bold">{title}</p>
              <p className="text-sm opacity-70 mt-1">{category}</p>
            </div>
          </div>
        )}
        {/* Subtle dark scrim for text legibility — only where the overlay text
            shows (sm+). On mobile the text is hidden, so no scrim keeps the
            image clear. */}
        <div className="absolute inset-0 hidden bg-gradient-to-b from-black/20 via-transparent to-black/40 sm:block" />

        {/* Floating Share button — the old sticky header (which had
            the share action) was removed, so this overlay button is
            now the most discoverable place to share the event. It
            sits top-right on the hero so visitors see it instantly.
            handleShare uses the Web Share API on mobile and falls
            back to copying the URL on desktop. */}
        <button
          onClick={handleShare}
          aria-label="Share this event"
          title="Share this event"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-white/90 hover:bg-white text-gray-800 text-xs sm:text-sm font-semibold shadow-lg backdrop-blur-sm transition-all hover:scale-[1.03]"
        >
          <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* "Back to Events" link removed at user request — the small
            arrow button in the sticky top nav (handleBack → navigate(-1))
            still lets visitors return to whatever page they came from. */}

        {/* Hero bottom content — hidden on mobile so the banner image shows
            clearly (the title/date still appear in the info section below).
            Shown as an overlay on sm+ as before. */}
        <div className="absolute bottom-0 left-0 right-0 hidden p-4 sm:block sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: design?.primaryColor || "#f97316" }}
              >
                {category}
              </span>
              <span className="text-white text-xs sm:text-sm font-medium">
                {new Date(startDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <h1
              className="text-white font-black text-xl sm:text-4xl lg:text-5xl xl:text-6xl leading-tight drop-shadow-sm"
              style={{ fontFamily: design?.fontFamily }}
            >
              {title}
            </h1>
          </div>
        </div>
      </div>

      {/* ── Sponsors marquee — below the banner, left-to-right. Combines the
             organizer's own logo uploads with confirmed, paid sponsors. ── */}
      {/* Only an explicit `false` hides it — legacy events with no stored
          value keep showing their logos. */}
      {(eventData as any)?.showSponsorBar !== false && (
        <EventSponsorMarquee
          eventId={(eventData as any)?._id}
          staticLogos={
            Array.isArray((eventData as any)?.sponsors)
              ? (eventData as any).sponsors
              : []
          }
        />
      )}

      {/* ── Info Cards Row ── */}
      <div className="bg-[#f5f5f5] border-b border-gray-200 mt-6 sm:mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 sm:-mt-1">
            {/* 1. Date & Time */}
            <div className="group relative rounded-2xl bg-white border border-gray-200 p-4 sm:p-5 lg:p-6 flex flex-col gap-1 shadow-sm">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-1"
                style={{ backgroundColor: `${design?.primaryColor}18` }}
              >
                <Clock
                  className="h-4 w-4"
                  style={{ color: design?.primaryColor || "#f97316" }}
                />
              </div>
              <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">
                Date &amp; Time
              </p>
              {startDate && (
                <p className="text-gray-900 font-bold text-xs sm:text-base">
                  {new Date(startDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
              <p className="text-gray-900 font-bold text-xs sm:text-base">
                {time}
                {endTime ? ` - ${endTime}` : ""}
              </p>
              {googleCalendarUrl && (
                <a
                  href={googleCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: design?.primaryColor || "#f97316" }}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Add to Google Calendar
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {/* 2. Location */}
            <div className="group relative rounded-2xl bg-white border border-gray-200 p-4 sm:p-5 lg:p-6 flex flex-col gap-1 shadow-sm">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-1"
                style={{ backgroundColor: `${design?.primaryColor}18` }}
              >
                <MapPin
                  className="h-4 w-4"
                  style={{ color: design?.primaryColor || "#f97316" }}
                />
              </div>
              <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">
                Location
              </p>
              <p className="text-gray-900 font-bold text-xs sm:text-base leading-snug">
                {location}
              </p>
              {address && <p className="text-gray-400 text-xs">{address}</p>}
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: design?.primaryColor || "#f97316" }}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  View on Google Maps
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {/* 3. Organized By — jumps to the Organizer section below */}
            <button
              type="button"
              onClick={() => goToTab("organizer")}
              className="text-left rounded-2xl bg-white border border-gray-200 p-4 sm:p-5 lg:p-6 flex flex-col gap-1 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-1"
                style={{ backgroundColor: `${design?.primaryColor}18` }}
              >
                <User
                  className="h-4 w-4"
                  style={{ color: design?.primaryColor || "#f97316" }}
                />
              </div>
              <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">
                Organized by
              </p>
              <p className="text-gray-900 font-bold text-xs sm:text-base">
                {organizer.organizationName}
              </p>
              <span
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium"
                style={{ color: design?.primaryColor || "#f97316" }}
              >
                View details <ExternalLink className="h-3 w-3" />
              </span>
            </button>

            {/* 4. Venue Layout (jumps to + opens the layout) — falls back to
                  the Ticket Price / Date card when there's no venue layout. */}
            {hasVenueLayout ? (
              <button
                type="button"
                // Land on the venue section COLLAPSED — the visitor sees the
                // venue name header and clicks it to reveal the layout.
                onClick={() => goToTab("venue")}
                className="text-left rounded-2xl bg-white border border-gray-200 p-4 sm:p-5 lg:p-6 flex flex-col gap-1 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-1"
                  style={{ backgroundColor: `${design?.primaryColor}18` }}
                >
                  <MapIcon
                    className="h-4 w-4"
                    style={{ color: design?.primaryColor || "#f97316" }}
                  />
                </div>
                <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">
                  Venue Layout
                </p>
                <p className="text-gray-900 font-bold text-xs sm:text-base">
                  View floor plan
                </p>
                <span
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: design?.primaryColor || "#f97316" }}
                >
                  Open layout <ExternalLink className="h-3 w-3" />
                </span>
              </button>
            ) : (
              <div className="rounded-2xl bg-white border border-gray-200 p-4 sm:p-5 lg:p-6 flex flex-col gap-1 shadow-sm">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-1"
                  style={{ backgroundColor: `${design?.primaryColor}18` }}
                >
                  {visitorTypes && visitorTypes.length > 0 ? (
                    <DollarSign
                      className="h-4 w-4"
                      style={{ color: design?.primaryColor || "#f97316" }}
                    />
                  ) : (
                    <CalendarDays
                      className="h-4 w-4"
                      style={{ color: design?.primaryColor || "#f97316" }}
                    />
                  )}
                </div>
                {visitorTypes && visitorTypes.length > 0 ? (
                  <>
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">
                      Ticket Price
                    </p>
                    <p className="text-gray-900 font-bold text-xl sm:text-2xl">
                      {ticketPrice === 0 ? "Free" : formatPrice(ticketPrice)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">
                      Event Date
                    </p>
                    <p className="text-gray-900 font-bold text-xs sm:text-base">
                      {new Date(startDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Content + Sidebar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
          {/* ── LEFT: Main Content ── */}
          {/* w-full is load-bearing: the row uses items-start (not
              items-stretch) so on mobile (flex-col) this column would
              otherwise size to its widest child's natural content width
              instead of the viewport — and the horizontally-scrollable
              Workshops/Speakers rows want to be wider than the screen,
              ballooning the whole column (Gallery included, since it's
              w-full *relative to this column*) past the right edge. */}
          <div className="w-full flex-1 min-w-0 space-y-8 anim-fade-up order-2 lg:order-1">
            {/* Cinema/concert seat map — a dedicated, full-width section
                (not squeezed into the sidebar) since seat selection is the
                primary action for these events. Uses the SAME coordinate
                space as the Space Layout canvas (venue width/height, cropped
                if the organizer cropped it) rather than a box fit just to
                the seats' own bounding area — so a seat placed near the
                stage or off to one side shows up in that same relative spot
                here, not re-centered into a generic grid. */}
            {showSeatPicker && (
              <section
                id="seat-picker-map"
                className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Premium top accent — a thin brand-gradient strip, the same
                    small touch that separates a "functional" panel from a
                    designed one. */}
                <div
                  className="h-1.5 w-full"
                  style={{
                    background: `linear-gradient(90deg, ${design?.primaryColor || "#f97316"}, ${design?.secondaryColor || "#ef4444"})`,
                  }}
                />
                <div className="p-4 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 sm:gap-2.5 text-base sm:text-2xl font-bold text-gray-900 mb-1">
                        <span
                          className="flex h-7 w-7 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                          style={{
                            background: `linear-gradient(135deg, ${design?.primaryColor || "#f97316"}, ${design?.secondaryColor || "#ef4444"})`,
                          }}
                        >
                          <Ticket className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                        </span>
                        Select Your Seats
                      </h2>
                      <p className="text-xs sm:text-sm text-gray-500">
                        Tap a seat to select it. Tap again to remove it.
                      </p>
                    </div>
                    {selectedSeats.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-gray-900 text-white text-xs font-bold px-3 py-1.5 shadow-sm">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {selectedSeats.length} seat
                        {selectedSeats.length === 1 ? "" : "s"} selected
                      </span>
                    )}
                  </div>
                  {/* Screen/venue switcher — lets a multi-venue event (e.g.
                      two cinema screens) jump straight to picking seats on
                      the other one, right here in the seat card itself.
                      Previously the only way to switch venues was the
                      separate "Venue Layout" tab, which doesn't even exist
                      for a seating-only event (no stalls/round-tables) — so
                      there was no way at all to reach the second screen's
                      seats. Switching clears any in-progress selection
                      (existing effect keyed on currentLayoutIndex), since a
                      picked seat belongs to whichever screen was active when
                      it was tapped. */}
                  {venueConfig && publishedVenueCount > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-5 -mt-1">
                      <span className="flex-shrink-0 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Screen
                      </span>
                      {venueConfig.map((layout: any, index: number) =>
                        layout?.published === false ? null : (
                          <button
                            key={layout.id}
                            type="button"
                            onClick={() => setCurrentLayoutIndex(index)}
                            className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                              currentLayoutIndex === index
                                ? "text-white shadow-sm"
                                : "border border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100"
                            }`}
                            style={
                              currentLayoutIndex === index
                                ? {
                                    backgroundColor:
                                      design?.primaryColor || "#f97316",
                                  }
                                : undefined
                            }
                          >
                            {layout.name}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                  <div
                    className="rounded-2xl border border-gray-200 p-3 sm:p-5 shadow-inner"
                    style={{
                      background:
                        "radial-gradient(ellipse at top, #eef1f6 0%, #f8fafc 55%, #ffffff 100%)",
                    }}
                  >
                    {seats.length === 0 ? (
                      // This screen/venue has no seats placed on it — the
                      // switcher above stays visible so there's always a
                      // way back to whichever one does, instead of the
                      // whole seat-buying UI just going blank.
                      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                        <Ticket className="h-8 w-8 text-gray-300" />
                        <p className="text-sm font-semibold text-gray-500">
                          No seats on this screen
                        </p>
                        <p className="text-xs text-gray-400">
                          Try picking a different screen above.
                        </p>
                      </div>
                    ) : (
                      <>
                    {!cropCfg?.hasMainStage && (
                      <div className="relative mx-auto max-w-md mb-1">
                        <div
                          className="absolute inset-x-6 -bottom-5 h-10 blur-xl opacity-60 pointer-events-none"
                          style={{
                            background: `radial-gradient(ellipse at center, ${design?.primaryColor || "#f97316"}55, transparent 75%)`,
                          }}
                        />
                        <div className="relative rounded-t-[100px] bg-gradient-to-b from-gray-700 via-gray-800 to-gray-900 text-white text-center text-xs sm:text-sm font-semibold tracking-[0.3em] py-2.5 sm:py-3 uppercase shadow-[0_10px_24px_-8px_rgba(0,0,0,0.45)] border-b-2 border-white/10">
                          {seatPickerStageLabel}
                        </div>
                      </div>
                    )}
                    {(() => {
                      // As big as this layout's own seat spacing safely
                      // allows (up to 32, bumped up from a flat 28) —
                      // computed per-layout rather than a fixed constant,
                      // because a curved/tightly-packed row (e.g. one drawn
                      // with the curve tool) can have much closer
                      // seat-to-seat spacing than a straight row, and a
                      // flat "bigger" constant made those seats visibly
                      // overlap. Falls back to 28 with no seats placed yet.
                      let nearestSeatGap = Infinity;
                      for (let i = 0; i < seats.length; i++) {
                        for (let j = i + 1; j < seats.length; j++) {
                          const d = Math.hypot(
                            (seats[i].x ?? 0) - (seats[j].x ?? 0),
                            (seats[i].y ?? 0) - (seats[j].y ?? 0),
                          );
                          if (d > 0 && d < nearestSeatGap) nearestSeatGap = d;
                        }
                      }
                      const SEAT_NATURAL =
                        nearestSeatGap === Infinity
                          ? 28
                          : Math.min(32, Math.max(18, nearestSeatGap - 6));
                      // Zoom into just the area that actually has content
                      // instead of rendering the organizer's FULL declared
                      // venue canvas (often much bigger than the seating
                      // block itself, which used to leave a sea of white
                      // space around a small cluster of seats). Bounding
                      // box across every item this map actually draws
                      // (seats, doors, main stage, non-sellable spaces for
                      // this layout), padded a bit, becomes the reference
                      // frame instead of the raw venue width/height — same
                      // fit-to-width scale technique, just a tighter canvas
                      // to fit, which reads as "zoomed in".
                      const CONTENT_PADDING = 26;
                      const boundsDoors = currentLayoutDoors.filter(
                        (door: any) => inCrop(door?.x, door?.y),
                      );
                      const boundsSpaces = (
                        venueTables?.[currentLayoutId] || []
                      ).filter(
                        (table: any) =>
                          table.forSale === false &&
                          inCrop(table.x, table.y),
                      );
                      let minX = Infinity;
                      let minY = Infinity;
                      let maxX = -Infinity;
                      let maxY = -Infinity;
                      const extend = (
                        x: number,
                        y: number,
                        w: number,
                        h: number,
                      ) => {
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x + w);
                        maxY = Math.max(maxY, y + h);
                      };
                      seats.forEach((s: any) =>
                        extend(s.x || 0, s.y || 0, SEAT_NATURAL, SEAT_NATURAL),
                      );
                      boundsDoors.forEach((d: any) =>
                        extend(
                          d.x || 0,
                          d.y || 0,
                          Number(d.width) > 0 ? Number(d.width) : 50,
                          Number(d.height) > 0 ? Number(d.height) : 50,
                        ),
                      );
                      boundsSpaces.forEach((t: any) =>
                        extend(
                          t.x || 0,
                          t.y || 0,
                          t.displayWidth ?? t.width ?? 50,
                          t.displayHeight ?? t.height ?? 50,
                        ),
                      );
                      // Computed once here (not re-derived inside the render
                      // block below with a different width reference) so the
                      // stage's bounding-box contribution and its actual
                      // rendered position never disagree.
                      const stageGeom = cropCfg?.hasMainStage
                        ? {
                            w: cropCfg?.mainStageWidth ?? 200,
                            h: cropCfg?.mainStageHeight ?? 60,
                            x:
                              cropCfg?.mainStageX ??
                              ((cropW || 800) -
                                (cropCfg?.mainStageWidth ?? 200)) /
                                2,
                            y: cropCfg?.mainStageY ?? 10,
                          }
                        : null;
                      if (stageGeom) {
                        extend(
                          stageGeom.x,
                          stageGeom.y,
                          stageGeom.w,
                          stageGeom.h,
                        );
                      }
                      const hasBounds = minX !== Infinity;
                      // Offsets shift every item's raw venue-absolute
                      // coordinate so the tight content box starts right at
                      // CONTENT_PADDING from the canvas's top-left — same
                      // small margin on every side now that the row-label
                      // gutter (a separate reserved strip on the left) has
                      // been removed entirely, which was the real source of
                      // the leftover white space on the left.
                      const offsetX = hasBounds
                        ? CONTENT_PADDING - minX
                        : 0;
                      const offsetY = hasBounds
                        ? CONTENT_PADDING - minY
                        : 0;
                      const venueW = hasBounds
                        ? maxX - minX + CONTENT_PADDING * 2
                        : cropW || 800;
                      const venueH = hasBounds
                        ? maxY - minY + CONTENT_PADDING * 2
                        : cropH || 500;
                      const naturalW = venueW;
                      const naturalH = venueH;
                      // Fit-to-width, capped at 1 — the EXACT same technique
                      // the general Venue Layout map uses (venueDisplayScale
                      // above): the whole canvas (stage, doors, spaces,
                      // every seat) renders at its natural size and is
                      // scaled down as a single CSS transform, so nothing
                      // can ever overlap — everything shrinks together, in
                      // lockstep — and the box never needs a horizontal
                      // scrollbar to show the rest of the seats, matching
                      // how the Venue Layout tab behaves.
                      const trueScale =
                        naturalW > 0
                          ? Math.min((seatMapWidth / naturalW) * 0.98, 1)
                          : 1;
                      const seatSize = SEAT_NATURAL;
                      return (
                        <div
                          ref={setSeatMapEl}
                          className="overflow-auto rounded-xl mt-3"
                          style={{ width: "100%" }}
                        >
                          <div
                            className="mx-auto"
                            style={{
                              width: naturalW * trueScale,
                              height: naturalH * trueScale,
                            }}
                          >
                            <div
                              className="relative"
                              style={{
                                width: naturalW,
                                height: naturalH,
                                transform: `scale(${trueScale})`,
                                transformOrigin: "top left",
                              }}
                            >
                          {/* Main Stage — rendered at its true position/size
                              only when the organizer actually turned it on,
                              exactly matching the Space Layout canvas
                              (dragged position included, not just centered). */}
                          {stageGeom &&
                            (() => {
                              return (
                                <div
                                  className="absolute flex items-center justify-center font-bold uppercase text-purple-800 bg-purple-200/90 border-2 border-purple-400"
                                  style={{
                                    left: offsetX + stageGeom.x,
                                    top: offsetY + stageGeom.y,
                                    width: stageGeom.w,
                                    height: stageGeom.h,
                                    borderRadius:
                                      cropCfg?.mainStageShape === "semicircle"
                                        ? "0 0 50% 50% / 0 0 100% 100%"
                                        : cropCfg?.mainStageShape === "circle"
                                          ? "50%"
                                          : 8,
                                    fontSize: 14,
                                    zIndex: 8,
                                  }}
                                >
                                  {cropCfg?.mainStageLabel || "Main Stage"}
                                </div>
                              );
                            })()}
                          {/* Entrance / Exit / custom doors — shown for
                              context (e.g. "which entrance is closest to my
                              seat"), same square/circle badge design and
                              true position as the general Venue Layout map. */}
                          {boundsDoors
                            .map((door: any) => {
                              const type = (door?.type || "").toLowerCase();
                              const isEntrance = type === "entrance";
                              const isExit = type === "exit";
                              const isSquare = door?.shape === "square";
                              const dw =
                                Number(door?.width) > 0
                                  ? Number(door.width)
                                  : 50;
                              const dh =
                                Number(door?.height) > 0
                                  ? Number(door.height)
                                  : 50;
                              const doorColor = isEntrance
                                ? "#16a34a"
                                : isExit
                                  ? "#dc2626"
                                  : door?.color || "#f97316";
                              const fallback = isEntrance
                                ? "IN"
                                : isExit
                                  ? "OUT"
                                  : "DOOR";
                              return (
                                <div
                                  key={`seatmap-door-${door.id || `${door.x}-${door.y}`}`}
                                  className="absolute flex items-center justify-center text-[12px] font-bold text-white shadow-md select-none pointer-events-none border-2 overflow-hidden"
                                  style={{
                                    left: offsetX + (door.x || 0),
                                    top: offsetY + (door.y || 0),
                                    width: dw,
                                    height: dh,
                                    borderRadius: isSquare
                                      ? Math.max(2, dw * 0.16)
                                      : "50%",
                                    backgroundColor: doorColor,
                                    borderColor: "rgba(0,0,0,0.25)",
                                    transform: `rotate(${door.rotation || 0}deg)`,
                                    transformOrigin: "center center",
                                    zIndex: 7,
                                  }}
                                  title={(door.label as string) || fallback}
                                >
                                  <span className="px-0.5 truncate">
                                    {door.label || fallback}
                                  </span>
                                </div>
                              );
                            })}
                          {/* Non-sellable Spaces (decoration / standing
                              tables marked forSale: false) — layout-only
                              landmarks shown for context, same as the Venue
                              Layout tab: hatched fill, no click handler, no
                              "Book a stall" prompt, since there's nothing to
                              sell here. Sellable stalls are deliberately
                              left out of this section — booking those still
                              happens from the Venue Layout tab. */}
                          {boundsSpaces
                            .map((table: any) => (
                              <div
                                key={`seatmap-space-${table.positionId}`}
                                className={`absolute border flex items-center justify-center pointer-events-none ${
                                  table.type === "Round"
                                    ? "rounded-full"
                                    : table.type === "Corner"
                                      ? "rounded-lg"
                                      : "rounded-sm"
                                }`}
                                style={{
                                  left: offsetX + (table.x || 0),
                                  top: offsetY + (table.y || 0),
                                  width:
                                    table.displayWidth ?? table.width ?? 50,
                                  height:
                                    table.displayHeight ?? table.height ?? 50,
                                  transform: `rotate(${table.rotation || 0}deg)`,
                                  transformOrigin: "center center",
                                  backgroundColor:
                                    (table.color || "#f59e0b") + "59",
                                  borderColor: table.color || "#f59e0b",
                                  backgroundImage:
                                    "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 6px)",
                                  zIndex: 6,
                                }}
                                title={table.name}
                              >
                                <span className="font-extrabold text-[11px] leading-none truncate w-full text-center text-gray-900 px-0.5">
                                  {table.name}
                                </span>
                              </div>
                            ))}
                          {seats.map((seat: any) => {
                            const row = (seatRowTemplates || []).find(
                              (r: any) => r.id === seat.rowId,
                            );
                            const isBooked = seatMapBookedSeats.includes(
                              seat.id,
                            );
                            const isSelected = selectedSeats.includes(
                              seat.id,
                            );
                            const color = seat.color || "#8B5CF6";
                            return (
                              <button
                                key={seat.id}
                                type="button"
                                disabled={isBooked}
                                title={
                                  seat.name ||
                                  `${row?.name || "Seat"}${seat.seatNumber}`
                                }
                                onClick={() =>
                                  setSelectedSeats((prev) =>
                                    prev.includes(seat.id)
                                      ? prev.filter((s) => s !== seat.id)
                                      : [...prev, seat.id],
                                  )
                                }
                                className="absolute transition-all duration-150 hover:scale-110 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center leading-none overflow-hidden px-0.5"
                                style={{
                                  left: offsetX + seat.x,
                                  top: offsetY + seat.y,
                                  width: seatSize,
                                  height: seatSize,
                                  // Proportional to the seat's own size, not
                                  // a fixed px value — a fixed radius (e.g.
                                  // Tailwind's rounded-md, 6px) swallows a
                                  // small seat whole and reads as a circle.
                                  borderRadius: Math.max(1, seatSize * 0.16),
                                  // Bumped up from the original 0.26/6 floor
                                  // — legible at a glance was the goal, and
                                  // the button already truncates long custom
                                  // names rather than overflowing.
                                  fontSize: Math.max(11, seatSize * 0.45),
                                  fontWeight: 700,
                                  color: isBooked ? "#94a3b8" : "#ffffff",
                                  backgroundColor: isBooked
                                    ? "#e2e8f0"
                                    : color,
                                  backgroundImage: isBooked
                                    ? "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 6px)"
                                    : "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 45%)",
                                  opacity: isBooked ? 0.7 : 1,
                                  // A subtle chair-like bevel on every seat
                                  // (soft top highlight, darker underside) so
                                  // they read as seats rather than flat
                                  // color swatches; selected ones add a
                                  // bright ring + a glow in the seat's own
                                  // color for a premium "picked" feel.
                                  boxShadow: isBooked
                                    ? "inset 0 -2px 2px rgba(0,0,0,0.12)"
                                    : isSelected
                                      ? `0 0 0 2px #ffffff, 0 0 0 4px ${design?.primaryColor || "#111827"}, 0 6px 14px -2px ${color}88, inset 0 -2px 2px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.4)`
                                      : "inset 0 -2px 2px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.4)",
                                  transform: seat.rotation
                                    ? `rotate(${seat.rotation}deg)`
                                    : undefined,
                                }}
                              >
                                <span className="truncate drop-shadow-sm">
                                  {seat.name || seat.seatNumber}
                                </span>
                              </button>
                            );
                          })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                      </>
                    )}
                  </div>

                  {/* Legend of seating rows — deliberately its own block
                      below the grid, not layered on top of it, so it's
                      always readable regardless of how packed the map is.
                      Pill-chip styling matches the seat buttons themselves
                      (rounded swatch + border in the row's own color) so the
                      legend reads as part of the same designed system.
                      Skipped entirely when this screen has no seats — see
                      the empty state above. */}
                  {seats.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-gray-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2.5">
                      Seat Types
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(
                        new Map(
                          seats.map((s: any) => [s.rowId, true]),
                        ).keys(),
                      )
                        .map((rowId) =>
                          (seatRowTemplates || []).find(
                            (r: any) => r.id === rowId,
                          ),
                        )
                        .filter(Boolean)
                        .map((row: any) => (
                          <div
                            key={row.id}
                            className="flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 shadow-sm"
                            style={{ borderColor: row.color + "55" }}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: row.color }}
                            />
                            {row.name}
                            <span className="text-gray-300">·</span>
                            <span
                              className="font-semibold"
                              style={{ color: row.color }}
                            >
                              {row.price === 0
                                ? "Free"
                                : formatPrice(row.price)}
                            </span>
                          </div>
                        ))}
                      <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 shadow-sm">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-gray-900 ring-2 ring-white ring-offset-1 ring-offset-gray-300" />
                        Selected
                      </div>
                      <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-400 shadow-sm">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0 bg-gray-300" />
                        Booked
                      </div>
                      {/* Doors are NOT sellable — they don't get a legend
                          entry (their IN/OUT/label text is already shown
                          directly on the badge on the map). Only the seating
                          rows above (which have a price) belong in this
                          legend. */}
                    </div>
                  </div>
                  )}
                </div>
              </section>
            )}

            {/* Mobile-only: "Your Seats" purchase card + "Contact
                Organizer" duplicated here (hidden on desktop, where the
                sidebar already shows them) so the mobile stacking order
                matches what was asked for: info cards -> seat map ->
                your seats -> contact organizer -> gallery -> rest. The
                originals stay in the sidebar for desktop, wrapped in
                "hidden lg:block" below so they do not also render here. */}
            <div className="lg:hidden space-y-4 mb-6">
              {/* ── Ticket Purchase Card — only if tickets or seats exist ── */}
              {(visitorTypes && visitorTypes.length > 0) || showSeatPicker ? (
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="p-5 sm:p-6">
                    {/* Cinema/concert seating: the actual seat map now lives
                        in its own full-width section above (near the top of
                        the main content column) where there's real room for
                        it. This card just shows a compact running summary —
                        which seats are picked and the total — plus the Buy
                        CTA below. */}
                    {showSeatPicker ? (
                      <>
                        <p className="text-gray-900 font-bold text-lg mb-1">
                          Your Seats
                        </p>
                        {selectedSeats.length === 0 ? (
                          // On mobile this card sits ABOVE the actual seat
                          // map in page order (the sidebar comes first in
                          // the stacked layout), so "the map above" would be
                          // backwards — a real jump link instead of static
                          // text works regardless of layout.
                          <button
                            type="button"
                            onClick={() =>
                              document
                                .getElementById("seat-picker-map")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                })
                            }
                            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
                          >
                            Pick your seats from the seat map
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {selectedSeats.map((seatId) => {
                              const seat = seats.find(
                                (s: any) => s.id === seatId,
                              );
                              const row = (seatRowTemplates || []).find(
                                (r: any) => r.id === seat?.rowId,
                              );
                              const label =
                                seat?.name ||
                                `${row?.name || ""}${seat?.seatNumber ?? ""}`;
                              return (
                                <span
                                  key={seatId}
                                  className="inline-flex items-center gap-1 rounded-md bg-gray-900 text-white text-xs font-semibold px-2 py-1"
                                >
                                  {label}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedSeats((prev) =>
                                        prev.filter((s) => s !== seatId),
                                      )
                                    }
                                    className="text-gray-400 hover:text-white"
                                    title="Remove"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <div className="border-t border-gray-100 pt-4 mb-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-gray-600 text-sm font-medium">
                                Total
                              </span>
                              <p className="text-xs text-gray-400">
                                {selectedSeats.length} seat
                                {selectedSeats.length === 1 ? "" : "s"}{" "}
                                selected
                              </p>
                            </div>
                            <span className="text-2xl font-black text-gray-900">
                              {formatPrice(
                                selectedSeats.reduce((sum, seatId) => {
                                  const seat = seats.find(
                                    (s: any) => s.id === seatId,
                                  );
                                  const row = (seatRowTemplates || []).find(
                                    (r: any) => r.id === seat?.rowId,
                                  );
                                  return sum + (Number(row?.price) || 0);
                                }, 0),
                              )}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : visitorTypes && visitorTypes.length > 0 ? (
                      <>
                        <p className="text-gray-900 font-bold text-lg mb-3">
                          Select Ticket Type
                        </p>
                        <div className="space-y-2 mb-4">
                          {visitorTypes.map((vt: any, idx: number) => {
                            const isSelected = selectedVisitorType === idx;
                            return (
                              <button
                                key={vt.id || idx}
                                type="button"
                                onClick={() => setSelectedVisitorType(idx)}
                                className={`w-full text-left rounded-xl border p-4 transition-all cursor-pointer ${isSelected ? "border-2 bg-gray-50/80 shadow-sm" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                                style={
                                  isSelected
                                    ? {
                                        borderColor:
                                          design?.primaryColor || "#6366f1",
                                      }
                                    : {}
                                }
                              >
                                <div className="flex items-center gap-3">
                                  {/* Radio indicator */}
                                  <div
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? "border-transparent" : "border-gray-300"}`}
                                    style={
                                      isSelected
                                        ? {
                                            backgroundColor:
                                              design?.primaryColor || "#6366f1",
                                          }
                                        : {}
                                    }
                                  >
                                    {isSelected && (
                                      <div className="w-2 h-2 rounded-full bg-white" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <h4 className="font-semibold text-gray-900 text-sm">
                                        {vt.name}
                                      </h4>
                                      <span
                                        className="font-bold text-base flex-shrink-0 ml-2"
                                        style={{
                                          color:
                                            design?.secondaryColor || "#ef4444",
                                        }}
                                      >
                                        {vt.price === 0
                                          ? "Free"
                                          : formatPrice(vt.price)}
                                      </span>
                                    </div>
                                    {vt.description && (
                                      <p className="text-xs text-gray-500 mb-1">
                                        {vt.description}
                                      </p>
                                    )}
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-gray-400">
                                        {vt.maxCount > 0
                                          ? `${vt.maxCount} spots`
                                          : "Unlimited"}
                                      </span>
                                      {vt.featureAccess && (
                                        <div className="flex gap-1 flex-wrap justify-end">
                                          {Object.entries(vt.featureAccess)
                                            .filter(([, v]) => v)
                                            .map(([k]) => (
                                              <span
                                                key={k}
                                                className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] capitalize text-gray-500"
                                              >
                                                {k}
                                              </span>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Total for selected type */}
                        <div className="border-t border-gray-100 pt-4 mb-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-gray-600 text-sm font-medium">
                                Total
                              </span>
                              <p className="text-xs text-gray-400">
                                {visitorTypes[selectedVisitorType]?.name} x1
                              </p>
                            </div>
                            <span className="text-2xl font-black text-gray-900">
                              {visitorTypes[selectedVisitorType]?.price === 0
                                ? "Free"
                                : formatPrice(
                                    visitorTypes[selectedVisitorType]?.price ||
                                      0,
                                  )}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Single ticket type (legacy) */}
                        <p className="text-gray-500 text-sm mb-1">
                          Price per ticket
                        </p>
                        <p
                          className="text-4xl sm:text-5xl font-black mb-4 leading-none"
                          style={{ color: design?.secondaryColor || "#ef4444" }}
                        >
                          {ticketPrice === 0
                            ? "Free"
                            : formatPrice(ticketPrice)}
                        </p>

                        {/* Availability bar */}
                        <div className="mb-5">
                          {totalTickets > 0 ? (
                            <>
                              <div className="flex items-center justify-between text-sm mb-1.5">
                                <span className="text-gray-600 font-medium">
                                  {availableTickets} tickets left
                                </span>
                                <span
                                  className="font-semibold"
                                  style={{
                                    color: design?.secondaryColor || "#ef4444",
                                  }}
                                >
                                  {Math.round(
                                    ((totalTickets - availableTickets) /
                                      totalTickets) *
                                      100,
                                  )}
                                  % sold
                                </span>
                              </div>
                              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(((totalTickets - availableTickets) / totalTickets) * 100, 100)}%`,
                                    background: `linear-gradient(to right, ${design?.primaryColor || "#f97316"}, ${design?.secondaryColor || "#ef4444"})`,
                                  }}
                                />
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-gray-500 font-medium">
                              Unlimited tickets available
                            </p>
                          )}
                        </div>

                        {/* Divider + Total */}
                        <div className="border-t border-gray-100 pt-4 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 text-sm font-medium">
                              Total
                            </span>
                            <span className="text-2xl font-black text-gray-900">
                              {ticketPrice === 0
                                ? "Free"
                                : formatPrice(ticketPrice * ticketQuantity)}
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Buy Tickets CTA — only if visitorTypes exist. Once the
                        event is over, sales close: the button is replaced with
                        an "ended" notice (the handler + backend also refuse). */}
                    {showSeatPicker ? (
                      isEventOver(eventData) ? (
                        <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-3 text-center text-sm font-medium text-gray-500">
                          This event has ended — ticket sales are closed.
                        </div>
                      ) : (
                        <button
                          onClick={handleGetSeatTickets}
                          disabled={selectedSeats.length === 0}
                          className="w-full h-12 sm:h-14 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-md hover:shadow-lg mb-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40"
                          style={{
                            background: `linear-gradient(135deg, ${design?.primaryColor || "#f97316"}, ${design?.secondaryColor || "#ef4444"})`,
                          }}
                        >
                          <Ticket className="h-5 w-5" />
                          {selectedSeats.length === 0
                            ? "Select Seats"
                            : `Buy ${selectedSeats.length} Seat${selectedSeats.length === 1 ? "" : "s"}`}
                        </button>
                      )
                    ) : (
                      visitorTypes &&
                      visitorTypes.length > 0 &&
                      (isEventOver(eventData) ? (
                        <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-3 text-center text-sm font-medium text-gray-500">
                          This event has ended — ticket sales are closed.
                        </div>
                      ) : (
                        <button
                          onClick={() => handleGetTickets()}
                          className="w-full h-12 sm:h-14 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-md hover:shadow-lg mb-3"
                          style={{
                            background: `linear-gradient(135deg, ${design?.primaryColor || "#f97316"}, ${design?.secondaryColor || "#ef4444"})`,
                          }}
                        >
                          <Ticket className="h-5 w-5" />
                          Buy Tickets
                        </button>
                      ))
                    )}

                    {/* Share */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleShare}
                        className="flex-1 h-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 transition-all"
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </button>
                    </div>
                  </div>

                  {/* Organized by footer — tap to jump to the Organizer tab */}
                  <button
                    type="button"
                    onClick={() => goToTab("organizer")}
                    className="w-full text-left border-t border-gray-100 px-5 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-gray-400 text-xs font-medium mb-3">
                      Organized by
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${design?.primaryColor || "#f97316"}, ${design?.secondaryColor || "#ef4444"})`,
                        }}
                      >
                        {organizer.organizationName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {organizer.organizationName}
                        </p>
                        <p className="text-gray-400 text-xs">Event Organizer</p>
                      </div>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="p-5 sm:p-6">
                    <p className="text-gray-900 font-bold text-lg mb-2">
                      {title}
                    </p>
                    <p className="text-gray-500 text-sm mb-4">
                      {new Date(startDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {time ? ` · ${time}` : ""}
                    </p>
                    {location && (
                      <p className="text-gray-600 text-sm mb-1">{location}</p>
                    )}
                    {address && (
                      <p className="text-gray-400 text-xs mb-4">{address}</p>
                    )}

                    {/* Share */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleShare}
                        className="flex-1 h-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 transition-all"
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </button>
                    </div>
                  </div>

                  {/* Organized by footer — tap to jump to the Organizer tab */}
                  <button
                    type="button"
                    onClick={() => goToTab("organizer")}
                    className="w-full text-left border-t border-gray-100 px-5 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-gray-400 text-xs font-medium mb-3">
                      Organized by
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${design?.primaryColor || "#f97316"}, ${design?.secondaryColor || "#ef4444"})`,
                        }}
                      >
                        {organizer.organizationName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {organizer.organizationName}
                        </p>
                        <p className="text-gray-400 text-xs">Event Organizer</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}
              {/* ── Contact Organizer ── */}
              {(() => {
                // Resolve the list of phones to render. Prefer the new
                // contactPhones array; fall back to the legacy single
                // phoneNumber/phone fields so older organizer records
                // keep showing something. Dedupe so a legacy primary
                // copied into the array doesn't render twice.
                const rawPhones: string[] = Array.isArray(
                  (organizer as any).contactPhones,
                )
                  ? (organizer as any).contactPhones
                  : [];
                const rawNames: string[] = Array.isArray(
                  (organizer as any).contactPhoneNames,
                )
                  ? (organizer as any).contactPhoneNames
                  : [];
                const legacy =
                  (organizer as any).phoneNumber ||
                  (organizer as any).phone ||
                  "";
                const seen = new Set<string>();
                // Pair each number with its label (aligned by index); append
                // the legacy single number (no label); dedupe by number.
                const phoneEntries = [
                  ...rawPhones.map((p, i) => ({
                    phone: String(p || "").trim(),
                    name: String(rawNames[i] || "").trim(),
                  })),
                  { phone: String(legacy || "").trim(), name: "" },
                ].filter((e) => {
                  if (!e.phone) return false;
                  const k = e.phone.replace(/\s+/g, "");
                  if (seen.has(k)) return false;
                  seen.add(k);
                  return true;
                });
                const showCard =
                  phoneEntries.length > 0 ||
                  organizer.email ||
                  organizer.whatsAppNumber;
                if (!showCard) return null;
                return (
                  <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-5 pt-5 pb-4">
                      <p
                        className="text-sm sm:text-lg font-bold tracking-widest uppercase mb-4"
                        style={{ color: design?.primaryColor }}
                      >
                        Contact Organizer
                      </p>
                      <div className="space-y-3">
                        {phoneEntries.length > 0 && (
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <Phone className="h-3.5 w-3.5 text-gray-400" />
                            </div>
                            <div className="text-sm font-medium flex flex-col gap-1">
                              {phoneEntries.map((e, idx) => (
                                <a
                                  key={`p-${idx}`}
                                  href={`tel:${e.phone.replace(/\s+/g, "")}`}
                                  className="hover:underline"
                                  style={{
                                    color: design?.secondaryColor || "#ef4444",
                                  }}
                                >
                                  {e.name && (
                                    <span className="text-gray-700 font-semibold mr-1.5">
                                      {e.name}:
                                    </span>
                                  )}
                                  {e.phone}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {organizer.email && (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <Mail className="h-3.5 w-3.5 text-gray-400" />
                            </div>
                            <a
                              href={`mailto:${organizer.email}`}
                              className="text-sm font-medium hover:underline break-all"
                              style={{
                                color: design?.secondaryColor || "#ef4444",
                              }}
                            >
                              {organizer.email}
                            </a>
                          </div>
                        )}
                        {organizer.whatsAppNumber && (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <FaWhatsapp className="h-3.5 w-3.5 text-green-500" />
                            </div>
                            <a
                              href={`https://wa.me/${organizer.whatsAppNumber.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-gray-700 hover:text-green-600 transition-colors"
                            >
                              {organizer.whatsAppNumber}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Gallery — moved up to right after the seat map/venue info
                (was previously below About/Tags) so mobile sees visuals
                before a wall of text, per the requested mobile order:
                cards → selection/seat map → your seats + contact organizer
                (sidebar, injected below via the lg:hidden block) →
                gallery → everything else. */}
            {gallery && gallery.length > 0 && (
              <section>
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4">
                  Event Gallery
                </h2>
                {/* The frame has a definite, screen-relative height so it
                    never collapses (even while the image loads); the image
                    fills it with object-contain, so the WHOLE image is always
                    visible — no crop — and sized to the device. */}
                <div
                  className="relative rounded-2xl overflow-hidden bg-gray-100 shadow-sm flex items-center justify-center"
                  style={{ height: "clamp(220px, 68vw, 460px)" }}
                >
                  <img
                    key={currentImageIndex}
                    src={apiURL + gallery[currentImageIndex]}
                    alt={`Gallery image ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain anim-gallery-slide"
                  />
                  {gallery.length > 1 && (
                    <>
                      <button
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-all shadow-md"
                        onClick={prevImage}
                      >
                        <ChevronLeft className="h-4 w-4 text-gray-700" />
                      </button>
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-all shadow-md"
                        onClick={nextImage}
                      >
                        <ChevronRight className="h-4 w-4 text-gray-700" />
                      </button>
                    </>
                  )}
                </div>
                {/* Thumbnails */}
                {gallery.length > 1 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                    {gallery.map((img, idx) => (
                      <img
                        key={idx}
                        src={apiURL + img}
                        alt={`Thumb ${idx + 1}`}
                        onClick={() => setCurrentImageIndex(idx)}
                        className="flex-shrink-0 w-20 h-16 sm:w-24 sm:h-20 object-cover rounded-xl cursor-pointer border-2 transition-all"
                        style={{
                          borderColor:
                            currentImageIndex === idx
                              ? design?.secondaryColor || "#ef4444"
                              : "transparent",
                          opacity: currentImageIndex === idx ? 1 : 0.55,
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* About Section */}
            <section>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-3">
                About This Event
              </h2>
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                {description}
              </p>
            </section>

            {/* Tags — hidden on mobile (shown sm+ only) at user request */}
            {tags && tags.length > 0 && (
              <div className="hidden sm:flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border"
                    style={{
                      color: design?.primaryColor || "#f97316",
                      borderColor: `${design?.primaryColor}40` || "#fca96840",
                      backgroundColor: `${design?.primaryColor}10` || "#fff7ed",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* History (Instagram reels) moved out of this column — it now
                renders as a full-width section below the main content +
                sidebar row. See the "History — full-width reel marquee"
                block further down. */}

            {/* Speaker Carousel */}
            {eventData?.speakers && eventData.speakers.length > 0 && (
              <section>
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4">
                  Speakers
                </h2>
                <div className="relative">
                  <div
                    ref={speakersScrollRef}
                    className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    {eventData.speakers.map((speaker: any, idx: number) => (
                    <div
                      key={speaker.id || idx}
                      className="flex-shrink-0 w-64 snap-center rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {/* Speaker Photo */}
                      <div className="h-44 bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center overflow-hidden">
                        {speaker.image ? (
                          <img
                            src={
                              speaker.image.startsWith("/")
                                ? `${apiURL?.replace("/api", "")}${speaker.image}`
                                : speaker.image
                            }
                            alt={speaker.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-full bg-white/80 flex items-center justify-center text-4xl font-bold text-purple-400 shadow-inner">
                            {speaker.name?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 text-sm truncate">
                            {speaker.name}
                          </h3>
                          {/* {speaker.isKeynote && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                              KEYNOTE
                            </span>
                          )} */}
                        </div>
                        {(speaker.title || speaker.organization) && (
                          <p className="text-xs text-gray-500 truncate">
                            {speaker.title}
                            {speaker.organization
                              ? ` · ${speaker.organization}`
                              : ""}
                          </p>
                        )}
                        {speaker.slots?.[0] && (
                          <div className="mt-2 bg-purple-50 rounded-lg px-3 py-2">
                            <p className="text-xs font-medium text-purple-800 truncate">
                              {speaker.slots[0].topic}
                            </p>
                            {speaker.slots[0].startTime && (
                              <p className="text-[10px] text-purple-600 mt-0.5">
                                {speaker.slots[0].startTime} -{" "}
                                {speaker.slots[0].endTime}
                              </p>
                            )}
                          </div>
                        )}
                        {speaker.socialLinks && (
                          <div className="flex gap-2 mt-2">
                            {speaker.socialLinks.linkedin && (
                              <a
                                href={speaker.socialLinks.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-blue-600 hover:underline"
                              >
                                LinkedIn
                              </a>
                            )}
                            {speaker.socialLinks.twitter && (
                              <a
                                href={speaker.socialLinks.twitter}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-gray-500 hover:underline"
                              >
                                Twitter
                              </a>
                            )}
                            {speaker.socialLinks.instagram && (
                              <a
                                href={speaker.socialLinks.instagram}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-pink-500 hover:underline"
                              >
                                Instagram
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  </div>
                  {eventData.speakers.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => scrollRowByCard(speakersScrollRef, -1)}
                        aria-label="Scroll speakers left"
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/3 z-10 w-8 h-8 rounded-full bg-white/95 hover:bg-white flex items-center justify-center transition-all shadow-md border border-gray-200"
                      >
                        <ChevronLeft className="h-4 w-4 text-gray-700" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollRowByCard(speakersScrollRef, 1)}
                        aria-label="Scroll speakers right"
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3 z-10 w-8 h-8 rounded-full bg-white/95 hover:bg-white flex items-center justify-center transition-all shadow-md border border-gray-200"
                      >
                        <ChevronRight className="h-4 w-4 text-gray-700" />
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}

            {/* Workshops */}
            {eventData?.workshopSessions &&
              eventData.workshopSessions.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg sm:text-2xl font-bold text-gray-900">
                      Workshops
                    </h2>
                    {eventData?.workshopPackages &&
                      eventData.workshopPackages.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowWorkshopCombos(true)}
                          className="text-sm font-semibold hover:underline flex items-center gap-1"
                          style={{ color: design?.primaryColor || "#3b82f6" }}
                        >
                          <Package size={14} /> Buy Combo
                        </button>
                      )}
                  </div>

                  <div className="relative">
                  <div
                    ref={workshopsScrollRef}
                    className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    {eventData.workshopSessions.map((session: any) => {
                      const seatsLeft =
                        session.maxSeats > 0
                          ? Math.max(
                              session.maxSeats - (session.bookedSeats || 0),
                              0,
                            )
                          : null;
                      const soldOut = seatsLeft === 0;
                      return (
                        <div
                          key={session.id}
                          className="flex-shrink-0 w-64 snap-center rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                        >
                          <div className="h-36 bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center overflow-hidden">
                            {session.image ? (
                              <img
                                src={
                                  session.image.startsWith("/")
                                    ? `${apiURL?.replace("/api", "")}${session.image}`
                                    : session.image
                                }
                                alt={session.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <GraduationCap className="h-10 w-10 text-blue-300" />
                            )}
                          </div>
                          <div className="p-4 space-y-2">
                            <h3 className="font-bold text-gray-900 text-sm truncate">
                              {session.name}
                            </h3>
                            {session.description && (
                              <p className="text-xs text-gray-500 line-clamp-2">
                                {session.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-gray-800">
                                {session.price === 0
                                  ? "Free"
                                  : formatPrice(session.price)}
                              </span>
                              {seatsLeft !== null && (
                                <span
                                  className={`text-[10px] font-medium ${soldOut ? "text-red-500" : "text-gray-400"}`}
                                >
                                  {soldOut
                                    ? "Sold out"
                                    : `${seatsLeft} seat(s) left`}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={soldOut || isEventOver(eventData)}
                              onClick={() =>
                                navigate("/workshop-checkout", {
                                  state: {
                                    eventId: eventId || id,
                                    organizerId: eventData?.organizer?._id,
                                    eventTitle: eventData?.title,
                                    bookingType: "session",
                                    sessionId: session.id,
                                    name: session.name,
                                    description: session.description,
                                    unitPrice: session.price || 0,
                                    seatsRemaining: seatsLeft,
                                  },
                                })
                              }
                              className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40"
                              style={{
                                background: `linear-gradient(135deg, ${design?.primaryColor || "#3b82f6"}, ${design?.secondaryColor || "#6366f1"})`,
                              }}
                            >
                              {soldOut ? "Sold Out" : "Book Now"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {eventData.workshopSessions.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => scrollRowByCard(workshopsScrollRef, -1)}
                        aria-label="Scroll workshops left"
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/3 z-10 w-8 h-8 rounded-full bg-white/95 hover:bg-white flex items-center justify-center transition-all shadow-md border border-gray-200"
                      >
                        <ChevronLeft className="h-4 w-4 text-gray-700" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollRowByCard(workshopsScrollRef, 1)}
                        aria-label="Scroll workshops right"
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3 z-10 w-8 h-8 rounded-full bg-white/95 hover:bg-white flex items-center justify-center transition-all shadow-md border border-gray-200"
                      >
                        <ChevronRight className="h-4 w-4 text-gray-700" />
                      </button>
                    </>
                  )}
                  </div>
                </section>
              )}

            {/* Buy Combo dialog — packages only, same checkout flow as a
                single workshop once one is picked. */}
            <Dialog
              open={showWorkshopCombos}
              onOpenChange={setShowWorkshopCombos}
            >
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Workshop Combos</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {(eventData?.workshopPackages || []).map((pkg: any) => {
                    const included = (
                      eventData.workshopSessions || []
                    ).filter((s: any) => (pkg.sessionIds || []).includes(s.id));
                    const individualTotal = included.reduce(
                      (sum: number, s: any) => sum + (s.price || 0),
                      0,
                    );
                    return (
                      <div
                        key={pkg.id}
                        className="rounded-2xl border border-gray-200 p-4 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-indigo-500" />
                          <h3 className="font-bold text-gray-900 text-sm">
                            {pkg.name}
                          </h3>
                        </div>
                        {pkg.description && (
                          <p className="text-xs text-gray-500">
                            {pkg.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {included.map((s: any) => (
                            <Badge
                              key={s.id}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {s.name}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="font-bold text-sm text-gray-800">
                            {formatPrice(pkg.price)}
                          </span>
                          {individualTotal > pkg.price && (
                            <span className="text-[10px] text-green-600 font-medium">
                              Save {formatPrice(individualTotal - pkg.price)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={isEventOver(eventData)}
                          onClick={() => {
                            setShowWorkshopCombos(false);
                            navigate("/workshop-checkout", {
                              state: {
                                eventId: eventId || id,
                                organizerId: eventData?.organizer?._id,
                                eventTitle: eventData?.title,
                                bookingType: "package",
                                packageId: pkg.id,
                                name: pkg.name,
                                description: pkg.description,
                                unitPrice: pkg.price || 0,
                                seatsRemaining: null,
                                included: included.map((s: any) => s.name),
                              },
                            });
                          }}
                          className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40"
                          style={{
                            background: `linear-gradient(135deg, ${design?.primaryColor || "#3b82f6"}, ${design?.secondaryColor || "#6366f1"})`,
                          }}
                        >
                          Select Combo
                        </button>
                      </div>
                    );
                  })}
                  {(!eventData?.workshopPackages ||
                    eventData.workshopPackages.length === 0) && (
                    <p className="text-sm text-gray-400 text-center py-6">
                      No combos available for this event.
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Visitor Types */}
            {visitorTypes && visitorTypes.length > 0 && (
              <section>
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4">
                  Ticket Types
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visitorTypes.map((vt: any, idx: number) => (
                    <div
                      key={vt.id || idx}
                      className="rounded-2xl border-2 border-gray-200 bg-gray-50/70 p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-gray-900">{vt.name}</h3>
                        <span
                          className="text-lg font-bold"
                          style={{ color: design?.primaryColor || "#6366f1" }}
                        >
                          {vt.price === 0 ? "Free" : formatPrice(vt.price)}
                        </span>
                      </div>
                      {vt.description && (
                        <p className="text-xs text-gray-500 mb-3">
                          {vt.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>
                          {vt.maxCount > 0
                            ? `${vt.maxCount} spots`
                            : "Unlimited"}
                        </span>
                        {vt.featureAccess && (
                          <div className="flex gap-1 flex-wrap justify-end">
                            {Object.entries(vt.featureAccess)
                              .filter(([, v]) => v)
                              .map(([k]) => (
                                <span
                                  key={k}
                                  className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] capitalize"
                                >
                                  {k}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Event Details block removed — date/time/location/attendees
                already shown in the top Info Cards row (was duplicate data). */}
          </div>

          {/* ── RIGHT: Sticky Sidebar ── */}
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 order-1 lg:order-2">
            <div className="sticky-sidebar space-y-4">
              <div className="hidden lg:block">
              {/* ── Ticket Purchase Card — only if tickets or seats exist ── */}
              {(visitorTypes && visitorTypes.length > 0) || showSeatPicker ? (
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="p-5 sm:p-6">
                    {/* Cinema/concert seating: the actual seat map now lives
                        in its own full-width section above (near the top of
                        the main content column) where there's real room for
                        it. This card just shows a compact running summary —
                        which seats are picked and the total — plus the Buy
                        CTA below. */}
                    {showSeatPicker ? (
                      <>
                        <p className="text-gray-900 font-bold text-lg mb-1">
                          Your Seats
                        </p>
                        {selectedSeats.length === 0 ? (
                          // On mobile this card sits ABOVE the actual seat
                          // map in page order (the sidebar comes first in
                          // the stacked layout), so "the map above" would be
                          // backwards — a real jump link instead of static
                          // text works regardless of layout.
                          <button
                            type="button"
                            onClick={() =>
                              document
                                .getElementById("seat-picker-map")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                })
                            }
                            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
                          >
                            Pick your seats from the seat map
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {selectedSeats.map((seatId) => {
                              const seat = seats.find(
                                (s: any) => s.id === seatId,
                              );
                              const row = (seatRowTemplates || []).find(
                                (r: any) => r.id === seat?.rowId,
                              );
                              const label =
                                seat?.name ||
                                `${row?.name || ""}${seat?.seatNumber ?? ""}`;
                              return (
                                <span
                                  key={seatId}
                                  className="inline-flex items-center gap-1 rounded-md bg-gray-900 text-white text-xs font-semibold px-2 py-1"
                                >
                                  {label}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedSeats((prev) =>
                                        prev.filter((s) => s !== seatId),
                                      )
                                    }
                                    className="text-gray-400 hover:text-white"
                                    title="Remove"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <div className="border-t border-gray-100 pt-4 mb-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-gray-600 text-sm font-medium">
                                Total
                              </span>
                              <p className="text-xs text-gray-400">
                                {selectedSeats.length} seat
                                {selectedSeats.length === 1 ? "" : "s"}{" "}
                                selected
                              </p>
                            </div>
                            <span className="text-2xl font-black text-gray-900">
                              {formatPrice(
                                selectedSeats.reduce((sum, seatId) => {
                                  const seat = seats.find(
                                    (s: any) => s.id === seatId,
                                  );
                                  const row = (seatRowTemplates || []).find(
                                    (r: any) => r.id === seat?.rowId,
                                  );
                                  return sum + (Number(row?.price) || 0);
                                }, 0),
                              )}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : visitorTypes && visitorTypes.length > 0 ? (
                      <>
                        <p className="text-gray-900 font-bold text-lg mb-3">
                          Select Ticket Type
                        </p>
                        <div className="space-y-2 mb-4">
                          {visitorTypes.map((vt: any, idx: number) => {
                            const isSelected = selectedVisitorType === idx;
                            return (
                              <button
                                key={vt.id || idx}
                                type="button"
                                onClick={() => setSelectedVisitorType(idx)}
                                className={`w-full text-left rounded-xl border p-4 transition-all cursor-pointer ${isSelected ? "border-2 bg-gray-50/80 shadow-sm" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                                style={
                                  isSelected
                                    ? {
                                        borderColor:
                                          design?.primaryColor || "#6366f1",
                                      }
                                    : {}
                                }
                              >
                                <div className="flex items-center gap-3">
                                  {/* Radio indicator */}
                                  <div
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? "border-transparent" : "border-gray-300"}`}
                                    style={
                                      isSelected
                                        ? {
                                            backgroundColor:
                                              design?.primaryColor || "#6366f1",
                                          }
                                        : {}
                                    }
                                  >
                                    {isSelected && (
                                      <div className="w-2 h-2 rounded-full bg-white" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <h4 className="font-semibold text-gray-900 text-sm">
                                        {vt.name}
                                      </h4>
                                      <span
                                        className="font-bold text-base flex-shrink-0 ml-2"
                                        style={{
                                          color:
                                            design?.secondaryColor || "#ef4444",
                                        }}
                                      >
                                        {vt.price === 0
                                          ? "Free"
                                          : formatPrice(vt.price)}
                                      </span>
                                    </div>
                                    {vt.description && (
                                      <p className="text-xs text-gray-500 mb-1">
                                        {vt.description}
                                      </p>
                                    )}
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-gray-400">
                                        {vt.maxCount > 0
                                          ? `${vt.maxCount} spots`
                                          : "Unlimited"}
                                      </span>
                                      {vt.featureAccess && (
                                        <div className="flex gap-1 flex-wrap justify-end">
                                          {Object.entries(vt.featureAccess)
                                            .filter(([, v]) => v)
                                            .map(([k]) => (
                                              <span
                                                key={k}
                                                className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] capitalize text-gray-500"
                                              >
                                                {k}
                                              </span>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Total for selected type */}
                        <div className="border-t border-gray-100 pt-4 mb-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-gray-600 text-sm font-medium">
                                Total
                              </span>
                              <p className="text-xs text-gray-400">
                                {visitorTypes[selectedVisitorType]?.name} x1
                              </p>
                            </div>
                            <span className="text-2xl font-black text-gray-900">
                              {visitorTypes[selectedVisitorType]?.price === 0
                                ? "Free"
                                : formatPrice(
                                    visitorTypes[selectedVisitorType]?.price ||
                                      0,
                                  )}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Single ticket type (legacy) */}
                        <p className="text-gray-500 text-sm mb-1">
                          Price per ticket
                        </p>
                        <p
                          className="text-4xl sm:text-5xl font-black mb-4 leading-none"
                          style={{ color: design?.secondaryColor || "#ef4444" }}
                        >
                          {ticketPrice === 0
                            ? "Free"
                            : formatPrice(ticketPrice)}
                        </p>

                        {/* Availability bar */}
                        <div className="mb-5">
                          {totalTickets > 0 ? (
                            <>
                              <div className="flex items-center justify-between text-sm mb-1.5">
                                <span className="text-gray-600 font-medium">
                                  {availableTickets} tickets left
                                </span>
                                <span
                                  className="font-semibold"
                                  style={{
                                    color: design?.secondaryColor || "#ef4444",
                                  }}
                                >
                                  {Math.round(
                                    ((totalTickets - availableTickets) /
                                      totalTickets) *
                                      100,
                                  )}
                                  % sold
                                </span>
                              </div>
                              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(((totalTickets - availableTickets) / totalTickets) * 100, 100)}%`,
                                    background: `linear-gradient(to right, ${design?.primaryColor || "#f97316"}, ${design?.secondaryColor || "#ef4444"})`,
                                  }}
                                />
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-gray-500 font-medium">
                              Unlimited tickets available
                            </p>
                          )}
                        </div>

                        {/* Divider + Total */}
                        <div className="border-t border-gray-100 pt-4 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 text-sm font-medium">
                              Total
                            </span>
                            <span className="text-2xl font-black text-gray-900">
                              {ticketPrice === 0
                                ? "Free"
                                : formatPrice(ticketPrice * ticketQuantity)}
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Buy Tickets CTA — only if visitorTypes exist. Once the
                        event is over, sales close: the button is replaced with
                        an "ended" notice (the handler + backend also refuse). */}
                    {showSeatPicker ? (
                      isEventOver(eventData) ? (
                        <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-3 text-center text-sm font-medium text-gray-500">
                          This event has ended — ticket sales are closed.
                        </div>
                      ) : (
                        <button
                          onClick={handleGetSeatTickets}
                          disabled={selectedSeats.length === 0}
                          className="w-full h-12 sm:h-14 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-md hover:shadow-lg mb-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40"
                          style={{
                            background: `linear-gradient(135deg, ${design?.primaryColor || "#f97316"}, ${design?.secondaryColor || "#ef4444"})`,
                          }}
                        >
                          <Ticket className="h-5 w-5" />
                          {selectedSeats.length === 0
                            ? "Select Seats"
                            : `Buy ${selectedSeats.length} Seat${selectedSeats.length === 1 ? "" : "s"}`}
                        </button>
                      )
                    ) : (
                      visitorTypes &&
                      visitorTypes.length > 0 &&
                      (isEventOver(eventData) ? (
                        <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-3 text-center text-sm font-medium text-gray-500">
                          This event has ended — ticket sales are closed.
                        </div>
                      ) : (
                        <button
                          onClick={() => handleGetTickets()}
                          className="w-full h-12 sm:h-14 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-md hover:shadow-lg mb-3"
                          style={{
                            background: `linear-gradient(135deg, ${design?.primaryColor || "#f97316"}, ${design?.secondaryColor || "#ef4444"})`,
                          }}
                        >
                          <Ticket className="h-5 w-5" />
                          Buy Tickets
                        </button>
                      ))
                    )}

                    {/* Share */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleShare}
                        className="flex-1 h-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 transition-all"
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </button>
                    </div>
                  </div>

                  {/* Organized by footer — tap to jump to the Organizer tab */}
                  <button
                    type="button"
                    onClick={() => goToTab("organizer")}
                    className="w-full text-left border-t border-gray-100 px-5 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-gray-400 text-xs font-medium mb-3">
                      Organized by
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${design?.primaryColor || "#f97316"}, ${design?.secondaryColor || "#ef4444"})`,
                        }}
                      >
                        {organizer.organizationName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {organizer.organizationName}
                        </p>
                        <p className="text-gray-400 text-xs">Event Organizer</p>
                      </div>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="p-5 sm:p-6">
                    <p className="text-gray-900 font-bold text-lg mb-2">
                      {title}
                    </p>
                    <p className="text-gray-500 text-sm mb-4">
                      {new Date(startDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {time ? ` · ${time}` : ""}
                    </p>
                    {location && (
                      <p className="text-gray-600 text-sm mb-1">{location}</p>
                    )}
                    {address && (
                      <p className="text-gray-400 text-xs mb-4">{address}</p>
                    )}

                    {/* Share */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleShare}
                        className="flex-1 h-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 transition-all"
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </button>
                    </div>
                  </div>

                  {/* Organized by footer — tap to jump to the Organizer tab */}
                  <button
                    type="button"
                    onClick={() => goToTab("organizer")}
                    className="w-full text-left border-t border-gray-100 px-5 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-gray-400 text-xs font-medium mb-3">
                      Organized by
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${design?.primaryColor || "#f97316"}, ${design?.secondaryColor || "#ef4444"})`,
                        }}
                      >
                        {organizer.organizationName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {organizer.organizationName}
                        </p>
                        <p className="text-gray-400 text-xs">Event Organizer</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}
              </div>

              {/* ── Exhibitor Card — only if event has stall spaces ── */}
              {venueTables && Object.keys(venueTables).length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-gray-700 font-semibold text-sm mb-1">
                    Book a Stall
                  </p>
                  <p className="text-gray-400 text-xs mb-4">
                    Showcase your business at this event as an exhibitor.
                  </p>
                  <button
                    onClick={handleRentStallClick}
                    className="w-full h-14 rounded-xl border-2 font-bold text-lg text-white shadow-md transition-all hover:opacity-90"
                    style={{
                      backgroundColor: design?.primaryColor || "#f97316",
                      borderColor: design?.primaryColor || "#f97316",
                    }}
                  >
                    Book stall
                  </button>
                  {/* Member entry point — small link under the main CTA.
                      Clicking opens the Google-verified Member dialog
                      which either shows the existing membership card or
                      lets the exhibitor purchase a plan. */}
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        (eventData as any)?.isDemo
                          ? setShowDemoPrompt(true)
                          : setShowMemberDialog(true)
                      }
                      className="text-xs font-medium hover:underline inline-flex items-center gap-1"
                      style={{
                        color: design?.primaryColor || "#f97316",
                      }}
                    >
                      ⭐ Become a member
                    </button>
                    {/* Sponsor entry point sits alongside the member link when
                        the organizer has published sponsorship tiers. */}
                    {sponsorTiersAvailable && (
                      <>
                        <span className="text-xs text-gray-300">/</span>
                        <button
                          type="button"
                          onClick={() =>
                            (eventData as any)?.isDemo
                              ? setShowDemoPrompt(true)
                              : setShowSponsorDialog(true)
                          }
                          className="text-xs font-medium hover:underline inline-flex items-center gap-1"
                          style={{
                            color: design?.primaryColor || "#f97316",
                          }}
                        >
                          🤝 Become a Sponsor
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Scheduled Spaces — only if the organizer has placed at
                  least one facility with a defined slot ── */}
              {((eventData as any)?.venueScheduledSpaces || []).some(
                (s: any) => (s.slots || []).length > 0,
              ) && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-gray-700 font-semibold text-sm mb-1">
                    Book a Scheduled Space
                  </p>
                  <p className="text-gray-400 text-xs mb-4">
                    Reserve a court, ground or table for a specific time slot.
                  </p>
                  <button
                    onClick={handleScheduledSpaceClick}
                    className="w-full h-14 rounded-xl border-2 font-bold text-lg text-white shadow-md transition-all hover:opacity-90"
                    style={{
                      backgroundColor: design?.primaryColor || "#f97316",
                      borderColor: design?.primaryColor || "#f97316",
                    }}
                  >
                    Book a slot
                  </button>
                </div>
              )}

              {/* ── Apply as Speaker — only if event has speaker slots ── */}
              {eventData?.speakerSlotTemplates &&
                eventData.speakerSlotTemplates.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-gray-700 font-semibold text-sm mb-1">
                      Apply as Speaker
                    </p>
                    <p className="text-gray-400 text-xs mb-4">
                      Have expertise to share? Apply to deliver a session at
                      this event.
                    </p>
                    <button
                      onClick={openSpeakerApply}
                      className="w-full h-11 rounded-xl border-2 font-semibold text-sm transition-all hover:opacity-90"
                      style={{
                        borderColor: design?.primaryColor || "#6366f1",
                        color: design?.primaryColor || "#6366f1",
                      }}
                    >
                      Apply to Speak
                    </button>
                  </div>
                )}

              {/* ── Host a Workshop — only if the organizer opted in ── */}
              {(eventData as any)?.workshopHostingOpen && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-gray-700 font-semibold text-sm mb-1">
                    Host a Workshop
                  </p>
                  <p className="text-gray-400 text-xs mb-4">
                    Got a workshop to run? Apply to host one at this event.
                  </p>
                  <button
                    onClick={openWorkshopHostApply}
                    className="w-full h-11 rounded-xl border-2 font-semibold text-sm transition-all hover:opacity-90"
                    style={{
                      borderColor: design?.primaryColor || "#6366f1",
                      color: design?.primaryColor || "#6366f1",
                    }}
                  >
                    Host a Workshop
                  </button>
                </div>
              )}

              {/* ── Become a Sponsor — fallback card for events with no stall
                     section, where the link next to "Become a member" has
                     nowhere to live. ── */}
              {sponsorTiersAvailable && !showStallCard && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-gray-700 font-semibold text-sm mb-1">
                      Become a Sponsor
                    </p>
                    <p className="text-gray-400 text-xs mb-4">
                      Put your brand in front of everyone at this event.
                    </p>
                    <button
                      onClick={() =>
                        (eventData as any)?.isDemo
                          ? setShowDemoPrompt(true)
                          : setShowSponsorDialog(true)
                      }
                      className="w-full h-11 rounded-xl border-2 font-semibold text-sm transition-all hover:opacity-90"
                      style={{
                        borderColor: design?.primaryColor || "#f97316",
                        color: design?.primaryColor || "#f97316",
                      }}
                    >
                      🤝 Become a Sponsor
                    </button>
                  </div>
                )}

              <div className="hidden lg:block">
              {/* ── Contact Organizer ── */}
              {(() => {
                // Resolve the list of phones to render. Prefer the new
                // contactPhones array; fall back to the legacy single
                // phoneNumber/phone fields so older organizer records
                // keep showing something. Dedupe so a legacy primary
                // copied into the array doesn't render twice.
                const rawPhones: string[] = Array.isArray(
                  (organizer as any).contactPhones,
                )
                  ? (organizer as any).contactPhones
                  : [];
                const rawNames: string[] = Array.isArray(
                  (organizer as any).contactPhoneNames,
                )
                  ? (organizer as any).contactPhoneNames
                  : [];
                const legacy =
                  (organizer as any).phoneNumber ||
                  (organizer as any).phone ||
                  "";
                const seen = new Set<string>();
                // Pair each number with its label (aligned by index); append
                // the legacy single number (no label); dedupe by number.
                const phoneEntries = [
                  ...rawPhones.map((p, i) => ({
                    phone: String(p || "").trim(),
                    name: String(rawNames[i] || "").trim(),
                  })),
                  { phone: String(legacy || "").trim(), name: "" },
                ].filter((e) => {
                  if (!e.phone) return false;
                  const k = e.phone.replace(/\s+/g, "");
                  if (seen.has(k)) return false;
                  seen.add(k);
                  return true;
                });
                const showCard =
                  phoneEntries.length > 0 ||
                  organizer.email ||
                  organizer.whatsAppNumber;
                if (!showCard) return null;
                return (
                  <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-5 pt-5 pb-4">
                      <p
                        className="text-sm sm:text-lg font-bold tracking-widest uppercase mb-4"
                        style={{ color: design?.primaryColor }}
                      >
                        Contact Organizer
                      </p>
                      <div className="space-y-3">
                        {phoneEntries.length > 0 && (
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <Phone className="h-3.5 w-3.5 text-gray-400" />
                            </div>
                            <div className="text-sm font-medium flex flex-col gap-1">
                              {phoneEntries.map((e, idx) => (
                                <a
                                  key={`p-${idx}`}
                                  href={`tel:${e.phone.replace(/\s+/g, "")}`}
                                  className="hover:underline"
                                  style={{
                                    color: design?.secondaryColor || "#ef4444",
                                  }}
                                >
                                  {e.name && (
                                    <span className="text-gray-700 font-semibold mr-1.5">
                                      {e.name}:
                                    </span>
                                  )}
                                  {e.phone}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {organizer.email && (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <Mail className="h-3.5 w-3.5 text-gray-400" />
                            </div>
                            <a
                              href={`mailto:${organizer.email}`}
                              className="text-sm font-medium hover:underline break-all"
                              style={{
                                color: design?.secondaryColor || "#ef4444",
                              }}
                            >
                              {organizer.email}
                            </a>
                          </div>
                        )}
                        {organizer.whatsAppNumber && (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <FaWhatsapp className="h-3.5 w-3.5 text-green-500" />
                            </div>
                            <a
                              href={`https://wa.me/${organizer.whatsAppNumber.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-gray-700 hover:text-green-600 transition-colors"
                            >
                              {organizer.whatsAppNumber}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
              </div>

              {/* Follow Us — separate card below Contact Organizer so
                  the social links read as their own block. Renders the
                  social handle only (e.g. "@eventsh"), not the raw URL,
                  while keeping the full URL as the href + title. */}
              {socialMedia &&
                (socialMedia.facebook ||
                  socialMedia.instagram ||
                  socialMedia.twitter) &&
                (() => {
                  // Builds the display label for a social URL.
                  //
                  // Account links → "@handle" (first path segment).
                  // Post / reel / event / status links → a friendly
                  // platform-aware label like "View Event", "View Post"
                  // or "@handle's Tweet" so the row doesn't read like a
                  // raw ID such as "123456789" or "ABC_xyz".
                  //
                  // Returns the full display string (already prefixed
                  // with @ where appropriate) so the JSX doesn't
                  // double-prefix labels like "View Event".
                  const socialLabel = (raw: string): string => {
                    const v = (raw || "").trim();
                    if (!v) return "";
                    try {
                      const u = new URL(
                        /^https?:\/\//i.test(v) ? v : `https://${v}`,
                      );
                      const segs = u.pathname.split("/").filter(Boolean);
                      const first = (segs[0] || "").toLowerCase();
                      // Instagram /p/<id>/ + /reel/<id>/; Facebook
                      // /events/<id>/ + /posts/<id>/.
                      if (
                        first === "p" ||
                        first === "post" ||
                        first === "posts"
                      )
                        return "View Post";
                      if (first === "reel" || first === "reels")
                        return "View Reel";
                      if (first === "event" || first === "events")
                        return "View Event";
                      if (first === "share") return "View Post";
                      // Twitter / X: /<handle>/status/<id> → show the
                      // handle, not the status ID.
                      if (
                        segs.length >= 2 &&
                        segs[1].toLowerCase() === "status"
                      )
                        return "@" + segs[0].replace(/^@/, "");
                      // Default: first segment is the account handle.
                      const handle = (segs[0] || u.hostname).replace(/^@/, "");
                      return handle ? "@" + handle : v;
                    } catch {
                      // Raw handle entry (e.g. "@eventsh") — make sure
                      // it always reads with a single leading "@".
                      return v.startsWith("@") ? v : `@${v.replace(/^@/, "")}`;
                    }
                  };
                  return (
                    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm mt-4">
                      <div className="px-5 pt-5 pb-4">
                        <p
                          className="text-sm sm:text-lg font-bold tracking-widest uppercase mb-4"
                          style={{ color: design?.primaryColor }}
                        >
                          Follow Us
                        </p>
                        <div className="space-y-3">
                          {socialMedia.facebook && (
                            <a
                              href={socialMedia.facebook}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 group"
                              title={socialMedia.facebook}
                            >
                              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                                <Facebook className="h-3.5 w-3.5 text-blue-600" />
                              </div>
                              <span
                                className="text-sm font-medium hover:underline break-all"
                                style={{
                                  color: design?.secondaryColor || "#ef4444",
                                }}
                              >
                                {socialLabel(socialMedia.facebook)}
                              </span>
                            </a>
                          )}
                          {socialMedia.instagram && (
                            <a
                              href={socialMedia.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 group"
                              title={socialMedia.instagram}
                            >
                              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                                <Instagram className="h-3.5 w-3.5 text-pink-500" />
                              </div>
                              <span
                                className="text-sm font-medium hover:underline break-all"
                                style={{
                                  color: design?.secondaryColor || "#ef4444",
                                }}
                              >
                                {socialLabel(socialMedia.instagram)}
                              </span>
                            </a>
                          )}
                          {socialMedia.twitter && (
                            <a
                              href={socialMedia.twitter}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 group"
                              title={socialMedia.twitter}
                            >
                              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                                <Twitter className="h-3.5 w-3.5 text-sky-500" />
                              </div>
                              <span
                                className="text-sm font-medium hover:underline break-all"
                                style={{
                                  color: design?.secondaryColor || "#ef4444",
                                }}
                              >
                                {socialLabel(socialMedia.twitter)}
                              </span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
        </div>

        {/* History — full-width reel marquee. Sits below the main content +
            sidebar row (so it's a little lower on the page) and spans the
            ENTIRE content width instead of being squeezed into the left
            column. Only rendered when at least one valid reel is set. */}
        {hasReels &&
          (() => {
            const extractReelId = (url: string): string | null => {
              const reel = url.match(/\/reel(?:s)?\/([A-Za-z0-9_-]+)/);
              if (reel) return reel[1];
              const post = url.match(/\/p\/([A-Za-z0-9_-]+)/);
              if (post) return post[1];
              const tv = url.match(/\/tv\/([A-Za-z0-9_-]+)/);
              if (tv) return tv[1];
              return null;
            };
            const toEmbedSrc = (url: string): string | null => {
              const id = extractReelId(url);
              if (!id) return null;
              return `https://www.instagram.com/p/${id}/embed/?cr=1&v=14&rd=https%3A%2F%2Fwww.instagram.com`;
            };
            const validEmbeds = cleanedReelLinks
              .map((u) => ({ url: u, src: toEmbedSrc(u) }))
              .filter((e): e is { url: string; src: string } => !!e.src);
            if (validEmbeds.length === 0) return null;
            const repeatCount = Math.max(2, Math.ceil(12 / validEmbeds.length));
            const marqueeItems = Array.from(
              { length: repeatCount },
              () => validEmbeds,
            ).flat();
            return (
              <section className="mt-10">
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4">
                  History
                </h2>
                <div className="w-full rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                  <div ref={reelMarqueeRef} className="overflow-hidden">
                    <div className="flex gap-4 w-max anim-reel-marquee">
                      {marqueeItems.map((item, i) => (
                        <div
                          key={`reel-${i}`}
                          className="flex-shrink-0 rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm"
                          style={{ width: "240px" }}
                        >
                          <div
                            className="overflow-hidden relative"
                            style={{ height: "300px" }}
                          >
                            <iframe
                              src={item.src}
                              title={`Instagram reel ${i}`}
                              loading="lazy"
                              allow="encrypted-media"
                              allowFullScreen
                              scrolling="no"
                              style={{
                                width: "100%",
                                height: "880px",
                                border: 0,
                                display: "block",
                                marginTop: "-64px",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-3 text-center">
                    Hover to pause
                  </p>
                </div>
              </section>
            );
          })()}

        <Separator className="mt-5 mb-5" />
        {/* Tabs */}
        <EventStatistics
          eventId={id || eventData?._id || ""}
          eventEndDate={eventData?.endDate}
        />

        {/* Bottom section tabs. Controlled so the info cards above can jump
            to a section (Organizer / Venue Layout). The History tab was
            removed — reels now live below the Event Gallery. */}
        <div ref={tabsSectionRef} className="scroll-mt-24">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="bg-gray-100 border border-gray-200 rounded-2xl p-1 h-auto flex flex-wrap w-full mt-5 gap-1">
              <TabsTrigger
                value="organizer"
                className="flex-1 rounded-xl text-gray-500 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm font-medium text-sm py-2.5"
              >
                Organizer
              </TabsTrigger>
              {hasVenueLayout && (
                <TabsTrigger
                  value="venue"
                  className="flex-1 rounded-xl text-gray-500 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm font-medium text-sm py-2.5"
                >
                  Venue Layout
                </TabsTrigger>
              )}
              {eventData?.speakers && eventData.speakers.length > 0 && (
                <TabsTrigger
                  value="speakers"
                  className="flex-1 rounded-xl text-gray-500 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm font-medium text-sm py-2.5"
                >
                  Speakers
                </TabsTrigger>
              )}
              {/* Round tables are shown inside the Venue Layout tab now —
                no separate "Round Tables" tab. */}
              {eventData?.endDate &&
                new Date(eventData.endDate) <= new Date() &&
                !!eventData?.totalTickets &&
                eventData.totalTickets > 0 && (
                  <TabsTrigger
                    value="feedback"
                    className="flex-1 rounded-xl text-gray-500 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm font-medium text-sm py-2.5"
                  >
                    Feedback
                  </TabsTrigger>
                )}
            </TabsList>

            {/* History tab — Instagram reel carousel, ported verbatim
              from kioscart-v1's <InstagramCarousel/> pattern
              (frontend/src/components/ui/InstagramCarousel.tsx).
              The key differences from our earlier attempt:
                1. Each card embeds the Instagram iframe INLINE —
                   no Dialog. Instagram's embed endpoint serves a
                   placeholder when invoked from a dynamically-
                   mounted modal; rendering the iframe directly in
                   the marquee card avoids that.
                2. Each card is 220 × 280 with overflow:hidden, and
                   the iframe inside is 820px tall with marginTop
                   −60px. That crops Instagram's header chrome and
                   shows just the reel itself.
                3. IntersectionObserver lazy-mounts the iframes when
                   the carousel scrolls into view, so we don't hit
                   instagram.com on first page load.
                4. URL extractor accepts /reel/, /reels/, /p/, /tv/.
                   We DO NOT truncate ids — kioscart's regex grabs
                   the full path segment, and Instagram's embed
                   endpoint handles both canonical and share-token
                   ids transparently. */}
            {/* Disabled — reels were moved to a "History" section below the
              Event Gallery; this old in-tab carousel no longer renders. */}
            {false &&
              (() => {
                const extractReelId = (url: string): string | null => {
                  const reel = url.match(/\/reel(?:s)?\/([A-Za-z0-9_-]+)/);
                  if (reel) return reel[1];
                  const post = url.match(/\/p\/([A-Za-z0-9_-]+)/);
                  if (post) return post[1];
                  const tv = url.match(/\/tv\/([A-Za-z0-9_-]+)/);
                  if (tv) return tv[1];
                  return null;
                };
                const toEmbedSrc = (url: string): string | null => {
                  const id = extractReelId(url);
                  if (!id) return null;
                  return `https://www.instagram.com/p/${id}/embed/?cr=1&v=14&rd=https%3A%2F%2Fwww.instagram.com`;
                };
                const validEmbeds = cleanedReelLinks
                  .map((u) => ({ url: u, src: toEmbedSrc(u) }))
                  .filter((e): e is { url: string; src: string } => !!e.src);
                if (validEmbeds.length === 0) return null;
                // Repeat the list enough times to make the marquee feel
                // continuous regardless of how many reels are supplied.
                const repeatCount = Math.max(
                  2,
                  Math.ceil(12 / validEmbeds.length),
                );
                const marqueeItems = Array.from(
                  { length: repeatCount },
                  () => validEmbeds,
                ).flat();
                return (
                  <TabsContent value="history" className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <p
                          className="text-sm sm:text-lg font-bold tracking-widest uppercase"
                          style={{ color: design?.primaryColor }}
                        >
                          Reels Carousel
                        </p>
                        <span className="text-xs text-gray-400 font-medium">
                          {cleanedReelLinks.length}{" "}
                          {cleanedReelLinks.length === 1 ? "reel" : "reels"}
                        </span>
                      </div>
                      <div ref={reelMarqueeRef} className="overflow-hidden">
                        <div className="flex gap-4 w-max anim-reel-marquee">
                          {marqueeItems.map((item, i) => (
                            <div
                              key={`reel-${i}`}
                              className="flex-shrink-0 rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm"
                              style={{ width: "220px" }}
                            >
                              <div
                                className="overflow-hidden relative"
                                style={{ height: "280px" }}
                              >
                                <iframe
                                  src={item.src}
                                  title={`Instagram reel ${i}`}
                                  loading="lazy"
                                  allow="encrypted-media"
                                  allowFullScreen
                                  scrolling="no"
                                  style={{
                                    width: "100%",
                                    height: "820px",
                                    border: 0,
                                    display: "block",
                                    marginTop: "-60px",
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-3 text-center">
                        Hover to pause
                      </p>
                    </div>
                  </TabsContent>
                );
              })()}

            <TabsContent value="organizer" className="mt-4 space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                <p
                  className="text-sm sm:text-lg font-bold tracking-widest uppercase mb-5"
                  style={{ color: design?.primaryColor }}
                >
                  About Organizer
                </p>
                <div className="flex items-start space-x-4 mb-5">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
                    style={{
                      backgroundColor: design?.primaryColor || "#f97316",
                    }}
                  >
                    {organizer.organizationName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">
                      {organizer.organizationName}
                    </h3>
                    <p className="text-gray-500 text-sm">{organizer.name}</p>
                    {(organizer.description || organizer.bio) && (
                      <p className="text-gray-400 text-sm mt-2 leading-relaxed whitespace-pre-line">
                        {organizer.description || organizer.bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* QR scanner / operator entry moved to a small link near the
                  page bottom — keeps this Organizer tab focused on the
                  organizer's profile, not on operator-only actions. */}

                {socialMedia &&
                  (socialMedia.facebook ||
                    socialMedia.instagram ||
                    socialMedia.twitter) && (
                    <div className="flex gap-3 mt-4">
                      {socialMedia.facebook && (
                        <a
                          href={socialMedia.facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all"
                        >
                          <Facebook className="h-4 w-4 text-gray-500" />
                        </a>
                      )}
                      {socialMedia.instagram && (
                        <a
                          href={socialMedia.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all"
                        >
                          <Instagram className="h-4 w-4 text-gray-500" />
                        </a>
                      )}
                      {socialMedia.twitter && (
                        <a
                          href={socialMedia.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all"
                        >
                          <Twitter className="h-4 w-4 text-gray-500" />
                        </a>
                      )}
                    </div>
                  )}
              </div>

              {/* Info sections — each rendered in its OWN card, and shown only
                when the organizer's per-section toggle is on. Age Restriction
                + Dress Code share a single card. A missing visibility key
                means "shown" (so older events keep displaying everything). */}
              {(() => {
                const secVis =
                  ((eventData as any)?.sectionVisibility as
                    | Record<string, boolean>
                    | undefined) || {};
                const shown = (k: string) => secVis[k] !== false;
                const htmlCls =
                  "text-gray-600 prose prose-sm max-w-none [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4";
                const customs = Array.isArray(
                  (eventData as any)?.customSections,
                )
                  ? ((eventData as any).customSections as any[])
                  : [];
                // Custom, per-purpose age restrictions (heading + age).
                const customAges = (
                  Array.isArray((eventData as any)?.ageRestrictions)
                    ? ((eventData as any).ageRestrictions as any[])
                    : []
                ).filter((a: any) => a && (a.heading || a.age));
                const dressCodeTheme = String(
                  (eventData as any)?.dressCodeTheme || "",
                ).trim();
                return (
                  <>
                    {shown("ageDress") &&
                      (dresscode ||
                        dressCodeTheme ||
                        customAges.length > 0) && (
                        <CollapsibleCard
                          title="Age Restriction & Dress Code"
                          headingColor={design?.primaryColor}
                        >
                          {(dresscode || dressCodeTheme) && (
                            <div className="mb-1">
                              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                                Dress Code
                              </p>
                              {dresscode && (
                                <p className="text-gray-700 text-sm">
                                  {dresscode}
                                </p>
                              )}
                              {dressCodeTheme && (
                                <p className="text-gray-700 text-sm">
                                  <span className="font-medium">Theme:</span>{" "}
                                  {dressCodeTheme}
                                </p>
                              )}
                            </div>
                          )}
                          {customAges.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                                Age limits by purpose
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                {customAges.map((a: any, i: number) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-1.5"
                                  >
                                    <span className="text-sm font-medium text-gray-700">
                                      {a.heading || "—"}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      {a.age || "—"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CollapsibleCard>
                      )}
                    {shown("specialInstructions") && specialInstructions && (
                      <CollapsibleCard
                        title="Special Instructions"
                        headingColor={design?.primaryColor}
                      >
                        <div
                          className={htmlCls}
                          dangerouslySetInnerHTML={{
                            __html: specialInstructions,
                          }}
                        />
                      </CollapsibleCard>
                    )}
                    {shown("refundPolicy") && refundPolicy && (
                      <CollapsibleCard
                        title="Refund Policy"
                        headingColor={design?.primaryColor}
                      >
                        <div
                          className={htmlCls}
                          dangerouslySetInnerHTML={{ __html: refundPolicy }}
                        />
                      </CollapsibleCard>
                    )}
                    {shown("termsAndConditions") && termsAndConditions && (
                      <CollapsibleCard
                        title="Terms & Conditions"
                        headingColor={design?.primaryColor}
                      >
                        <div
                          className={htmlCls}
                          dangerouslySetInnerHTML={{
                            __html: termsAndConditions,
                          }}
                        />
                      </CollapsibleCard>
                    )}
                    {customs
                      .filter(
                        (s: any) =>
                          ((s?.heading || "").trim() ||
                            (s?.content || "").trim()) &&
                          shown(s?.id),
                      )
                      .map((s: any) => (
                        <CollapsibleCard
                          key={s.id || s.heading}
                          title={(s.heading || "").trim() || "More Information"}
                          headingColor={design?.primaryColor}
                        >
                          {(s.content || "").trim() && (
                            <div
                              className={htmlCls}
                              dangerouslySetInnerHTML={{ __html: s.content }}
                            />
                          )}
                        </CollapsibleCard>
                      ))}
                  </>
                );
              })()}
            </TabsContent>

            {/* Speaker Zone */}
            <TabsContent value="speakers" className="mt-4 space-y-4">
              {eventData?.speakers && eventData.speakers.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                  <p
                    className="text-sm sm:text-lg font-bold tracking-widest uppercase mb-6"
                    style={{ color: design?.primaryColor }}
                  >
                    Speaker Lineup
                  </p>

                  {/* Gate on the whole line-up, not on keynotes. The list
                      below renders EVERY speaker, so keying the section off
                      `isKeynote` hid the entire tab whenever nobody was
                      flagged as a keynote — which is the normal case for
                      speakers added through the Create Event form (they only
                      get isKeynote when their space is the main stage). */}
                  {eventData.speakers.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                        Speakers
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {eventData.speakers.map((speaker: any) => (
                          <div
                            key={speaker.id}
                            className="flex gap-4 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 shadow-sm"
                          >
                            <div className="flex-shrink-0">
                              {speaker.image ? (
                                <img
                                  src={
                                    speaker.image.startsWith("/")
                                      ? `${apiURL?.replace("/api", "") || ""}${speaker.image}`
                                      : speaker.image
                                  }
                                  alt={speaker.name}
                                  className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md"
                                />
                              ) : (
                                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-2xl font-bold border-2 border-white shadow-md">
                                  {speaker.name?.charAt(0)?.toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-gray-900 truncate">
                                  {speaker.name}
                                </h4>
                              </div>
                              {speaker.title && (
                                <p className="text-sm text-gray-600">
                                  {speaker.title}
                                  {speaker.organization
                                    ? ` at ${speaker.organization}`
                                    : ""}
                                </p>
                              )}
                              {speaker.bio && (
                                <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                  {speaker.bio}
                                </p>
                              )}
                              {speaker.socialLinks && (
                                <div className="flex gap-3 mt-2">
                                  {speaker.socialLinks.linkedin && (
                                    <a
                                      href={speaker.socialLinks.linkedin}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                    >
                                      LinkedIn
                                    </a>
                                  )}
                                  {speaker.socialLinks.twitter && (
                                    <a
                                      href={speaker.socialLinks.twitter}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-gray-600 hover:text-gray-800 text-xs font-medium"
                                    >
                                      X / Twitter
                                    </a>
                                  )}
                                  {speaker.socialLinks.website && (
                                    <a
                                      href={speaker.socialLinks.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                                    >
                                      Website
                                    </a>
                                  )}
                                </div>
                              )}
                              {speaker.slots && speaker.slots.length > 0 && (
                                <div className="mt-3 space-y-1">
                                  {speaker.slots.map(
                                    (slot: any, si: number) => (
                                      <div
                                        key={si}
                                        className="flex items-center gap-2 text-xs bg-white rounded-lg px-2 py-1 border"
                                      >
                                        {slot.startTime && (
                                          <span className="font-mono text-gray-500">
                                            {slot.startTime}
                                            {slot.endTime
                                              ? ` - ${slot.endTime}`
                                              : ""}
                                          </span>
                                        )}
                                        <span className="font-medium text-gray-800">
                                          {slot.topic}
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Other Speakers */}
                  {/* {eventData.speakers.filter((s: any) => !s.isKeynote).length >
                    0 && (
                    <div>
                      {eventData.speakers.filter((s: any) => s.isKeynote)
                        .length > 0 && (
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                          Speakers & Panelists
                        </h3>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {eventData.speakers
                          .filter((s: any) => !s.isKeynote)
                          .map((speaker: any) => (
                            <div
                              key={speaker.id}
                              className="text-center p-4 rounded-xl bg-gray-50/50 border border-gray-100 hover:shadow-sm transition-shadow"
                            >
                              {speaker.image ? (
                                <img
                                  src={
                                    speaker.image.startsWith("/")
                                      ? `${apiURL?.replace("/api", "") || ""}${speaker.image}`
                                      : speaker.image
                                  }
                                  alt={speaker.name}
                                  className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-white shadow"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xl font-bold mx-auto border-2 border-white shadow">
                                  {speaker.name?.charAt(0)?.toUpperCase()}
                                </div>
                              )}
                              <h4 className="font-semibold text-gray-900 mt-3 text-sm">
                                {speaker.name}
                              </h4>
                              {speaker.title && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {speaker.title}
                                </p>
                              )}
                              {speaker.organization && (
                                <p className="text-xs text-gray-400">
                                  {speaker.organization}
                                </p>
                              )}
                              {speaker.slots && speaker.slots.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {speaker.slots.map(
                                    (slot: any, si: number) => (
                                      <div
                                        key={si}
                                        className="text-[11px] text-gray-600 bg-white rounded px-2 py-0.5 border"
                                      >
                                        {slot.startTime && (
                                          <span className="font-mono mr-1">
                                            {slot.startTime}
                                          </span>
                                        )}
                                        {slot.topic}
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )} */}
                </div>
              )}
            </TabsContent>

            <TabsContent value="venue" className="mt-4 space-y-6">
              {(venueTables && Object.keys(venueTables).length > 0) ||
              roundTableData.length > 0 ||
              currentLayoutScheduledSpaces.length > 0 ? (
                <div className="space-y-5">
                  {/* Layout Selector — only published venues are offered */}
                  {venueConfig && publishedVenueCount > 1 && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <MapIcon className="h-4 w-4 text-gray-400" />
                          <p
                            className="text-sm sm:text-lg font-bold tracking-widest uppercase"
                            style={{ color: design?.primaryColor }}
                          >
                            Venue Layouts
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {venueConfig.map((layout, index) =>
                          layout?.published === false ? null : (
                            <button
                              key={layout.id}
                              onClick={() => setCurrentLayoutIndex(index)}
                              className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                                currentLayoutIndex === index
                                  ? "text-white"
                                  : "border border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100"
                              }`}
                              style={
                                currentLayoutIndex === index
                                  ? { backgroundColor: design?.primaryColor }
                                  : {}
                              }
                            >
                              <MapIcon className="h-3.5 w-3.5" />
                              {layout.name}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                  {/* Current Layout Display — the header row doubles as
                    a toggle so the heavy canvas only renders when the
                    user expands it. Chevron sits on the right of the
                    "Space Arrangement" title so the whole strip reads
                    as one clickable disclosure. */}
                  {venueConfig && venueConfig[currentLayoutIndex] && (
                    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                      <button
                        type="button"
                        onClick={() => setShowVenueLayout((v) => !v)}
                        aria-expanded={showVenueLayout}
                        className="w-full px-5 pt-5 pb-3 flex items-center gap-2 hover:bg-gray-50 transition-colors"
                      >
                        <TableIcon className="h-4 w-4 text-gray-400" />
                        <p
                          className="text-sm sm:text-lg font-bold tracking-widest uppercase text-left"
                          style={{ color: design?.primaryColor }}
                        >
                          {venueConfig[currentLayoutIndex].name} — Space
                          Arrangement
                        </p>
                        <span className="ml-auto">
                          {showVenueLayout ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </span>
                      </button>
                      {showVenueLayout && (
                        <div className="px-5 pb-5 space-y-5">
                          {/* Venue map */}
                          <div
                            ref={venueDisplayContainerRef}
                            className="overflow-auto rounded-xl border border-gray-200"
                            style={{ background: "#f9fafb" }}
                          >
                            {/* Scale the layout to fit the container width. If a
                            wide venue still overflows, the box scrolls
                            (horizontal + vertical) so every space — including
                            the right-most ones — stays reachable. */}
                            <div
                              className="mx-auto"
                              style={{
                                width: `${venueDisplayCanvas.width * venueDisplayScale}px`,
                                height: `${venueDisplayCanvas.height * venueDisplayScale}px`,
                              }}
                            >
                              <div
                                className="relative shadow-sm border border-gray-300 origin-top-left"
                                style={{
                                  width: `${venueDisplayCanvas.width}px`,
                                  height: `${venueDisplayCanvas.height}px`,
                                  transform: `scale(${venueDisplayScale})`,
                                  transformOrigin: "top left",
                                  backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)`,
                                  backgroundSize: `${venueConfig[currentLayoutIndex]?.gridSize || 40}px ${venueConfig[currentLayoutIndex]?.gridSize || 40}px`,
                                  backgroundColor: "#ffffff",
                                }}
                              >
                                {venueConfig[currentLayoutIndex]
                                  ?.hasMainStage &&
                                  (() => {
                                    const vc = venueConfig[currentLayoutIndex];
                                    const stageW = vc?.mainStageWidth ?? 200;
                                    const stageH = vc?.mainStageHeight ?? 60;
                                    const stageX =
                                      vc?.mainStageX ??
                                      (venueDisplayCanvas.width - stageW) / 2;
                                    const stageY = vc?.mainStageY ?? 0;
                                    return (
                                      <div
                                        className="absolute bg-purple-200 border-2 border-purple-500 flex items-center justify-center font-bold text-purple-700 shadow-md uppercase"
                                        style={{
                                          left: stageX,
                                          top: stageY,
                                          width: stageW,
                                          height: stageH,
                                          borderRadius:
                                            vc?.mainStageShape ===
                                            "semicircle"
                                              ? "0 0 50% 50% / 0 0 100% 100%"
                                              : vc?.mainStageShape === "circle"
                                                ? "50%"
                                                : undefined,
                                          zIndex: 10,
                                        }}
                                      >
                                        {vc?.mainStageLabel || "Main Stage"}
                                      </div>
                                    );
                                  })()}
                                {venueTables?.[currentLayoutId]
                                  ?.filter((table) => inCrop(table.x, table.y))
                                  .map((table) => {
                                    const isBooked = table.isBooked;
                                    const notForSale =
                                      (table as any).forSale === false;
                                    return (
                                      <div
                                        key={table.positionId}
                                        onClick={() => {
                                          // Click/tap a bookable space → start the
                                          // stall process (Google/WhatsApp auth gate).
                                          if (!notForSale)
                                            handleRentStallClick();
                                        }}
                                        className={`absolute border flex items-center justify-center transition-all group z-[5] hover:z-[100] ${
                                          table.type === "Round"
                                            ? "rounded-full"
                                            : table.type === "Corner"
                                              ? "rounded-lg"
                                              : "rounded-sm"
                                        } ${
                                          notForSale
                                            ? "cursor-default"
                                            : "cursor-pointer hover:shadow-xl hover:ring-2 hover:ring-offset-1 hover:ring-blue-400 shadow-sm"
                                        }`}
                                        style={{
                                          left: `${table.x}px`,
                                          top: `${table.y}px`,
                                          width: `${(table as any).displayWidth ?? table.width}px`,
                                          height: `${(table as any).displayHeight ?? table.height}px`,
                                          transform: `rotate(${table.rotation || 0}deg)`,
                                          transformOrigin: "center center",
                                          // z-index is driven by the class above so
                                          // `hover:z-[100]` can lift the hovered space
                                          // (and its tooltip) above its neighbours —
                                          // an inline zIndex would override the class
                                          // and the tooltip would render under the
                                          // adjacent spaces.
                                          // Darker tint of the template colour with a
                                          // solid coloured border; bold dark label so
                                          // it stays clearly readable. Booked stays
                                          // uniform (we don't reveal availability).
                                          ...(notForSale
                                            ? {
                                                backgroundColor:
                                                  ((table as any).color ||
                                                    "#f59e0b") + "59",
                                                borderColor:
                                                  (table as any).color ||
                                                  "#f59e0b",
                                                backgroundImage:
                                                  "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 6px)",
                                              }
                                            : {
                                                backgroundColor:
                                                  ((table as any).color ||
                                                    "#22c55e") + "80",
                                                borderColor:
                                                  (table as any).color ||
                                                  "#22c55e",
                                              }),
                                        }}
                                      >
                                        <div className="relative group hover:z-50">
                                          <div
                                            className="text-center w-full h-full flex flex-col items-center justify-center p-0.5"
                                            style={{
                                              transform: `rotate(-${table.rotation || 0}deg)`,
                                            }}
                                          >
                                            <span className="font-extrabold text-[8px] leading-none truncate w-full text-gray-900">
                                              {table.name}
                                            </span>
                                          </div>
                                          {/* Not-for-sale spaces are layout-only
                                        references (decoration / standing
                                        tables) — no price, not bookable — so
                                        they get NO hover tooltip. */}
                                          {!notForSale && (
                                            <div
                                              className="pointer-events-none absolute bottom-full left-1/2 z-[100] mb-3 w-max opacity-0 transition-opacity [@media(hover:hover)]:group-hover:opacity-100"
                                              style={{
                                                transform: `translateX(-50%) rotate(-${table.rotation || 0}deg)`,
                                                transformOrigin:
                                                  "bottom center",
                                              }}
                                            >
                                              <div className="relative">
                                                <div className="rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-2xl border border-gray-700 flex flex-col gap-0.5">
                                                  <div className="font-bold text-sm whitespace-nowrap">
                                                    {table.name}
                                                  </div>
                                                  <div className="text-gray-300 whitespace-nowrap">
                                                    {table.type} · Row{" "}
                                                    {table.rowNumber}
                                                  </div>
                                                  <div className="text-gray-300 whitespace-nowrap">
                                                    {table.width * 10}×
                                                    {table.height * 10}cm
                                                  </div>
                                                  {(() => {
                                                    // Organizer opt-out — hide prices
                                                    // entirely from the public tooltip.
                                                    if (
                                                      (eventData as any)
                                                        ?.showSpacePricesOnEventfront ===
                                                      false
                                                    )
                                                      return null;
                                                    // Show BOTH the member price and the
                                                    // regular price whenever the space
                                                    // has a member price (resolved from
                                                    // the placed space or its template),
                                                    // so any visitor sees both tiers.
                                                    const tpls = Array.isArray(
                                                      (eventData as any)
                                                        ?.tableTemplates,
                                                    )
                                                      ? (eventData as any)
                                                          .tableTemplates
                                                      : [];
                                                    const tpl =
                                                      (table as any).id != null
                                                        ? tpls.find(
                                                            (t: any) =>
                                                              t?.id ===
                                                              (table as any).id,
                                                          )
                                                        : null;
                                                    const member =
                                                      (table as any)
                                                        .memberPrice != null
                                                        ? (table as any)
                                                            .memberPrice
                                                        : (tpl?.memberPrice ??
                                                          null);
                                                    const regular =
                                                      table.tablePrice ?? 0;
                                                    const hasMember =
                                                      member != null &&
                                                      Number(member) !==
                                                        Number(regular);
                                                    return hasMember ? (
                                                      <>
                                                        <div className="text-emerald-400 font-semibold whitespace-nowrap">
                                                          Member{" "}
                                                          {formatPrice(member)}
                                                        </div>
                                                        <div className="text-gray-400 whitespace-nowrap text-[11px]">
                                                          Regular{" "}
                                                          {formatPrice(regular)}
                                                        </div>
                                                      </>
                                                    ) : (
                                                      <div className="text-green-400 font-semibold whitespace-nowrap">
                                                        {formatPrice(regular)}
                                                      </div>
                                                    );
                                                  })()}
                                                </div>

                                                {/* Arrow tail */}
                                                <div className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-900 border-b border-r border-gray-700"></div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                {/* Round tables — rendered on the same venue map
                                as the Spaces. Interactive seat selection;
                                "not for sale" tables show as non-bookable
                                references. */}
                                {roundTableData
                                  .filter(
                                    (rt: any) =>
                                      belongsToLayout(rt?.venueConfigId) &&
                                      inCrop(rt?.x, rt?.y),
                                  )
                                  .map((rt: any) => {
                                    const bookedChairs: number[] =
                                      rt.bookedChairs || [];
                                    const isReference = rt.forSale === false;
                                    const mySelection =
                                      roundTableSelections.find(
                                        (sel) =>
                                          sel.tablePositionId === rt.positionId,
                                      );
                                    const mySelectedChairs =
                                      mySelection?.selectedChairIndices || [];
                                    const isFullyBooked =
                                      rt.isFullyBooked ||
                                      bookedChairs.length >= rt.numberOfChairs;
                                    const diameter = rt.tableDiameter || 120;
                                    const chairSz = Math.max(
                                      12,
                                      diameter * 0.14,
                                    );
                                    const chairR =
                                      diameter / 2 + chairSz / 2 + 4;
                                    const cx = (rt.x || 0) + diameter / 2;
                                    const cy = (rt.y || 0) + diameter / 2;
                                    const col = rt.color || "#8B5CF6";
                                    const hasSel = mySelectedChairs.length > 0;

                                    const handleChairClick = (ci: number) => {
                                      if (isReference) return;
                                      if (bookedChairs.includes(ci)) return;
                                      if (rt.sellingMode === "table") {
                                        if (mySelection) {
                                          setRoundTableSelections(
                                            roundTableSelections.filter(
                                              (x) =>
                                                x.tablePositionId !==
                                                rt.positionId,
                                            ),
                                          );
                                        } else if (!isFullyBooked) {
                                          setRoundTableSelections([
                                            ...roundTableSelections,
                                            {
                                              tablePositionId: rt.positionId,
                                              tableName: rt.name,
                                              tableCategory:
                                                rt.category || "Standard",
                                              sellingMode: rt.sellingMode,
                                              selectedChairIndices: Array.from(
                                                { length: rt.numberOfChairs },
                                                (_, i) => i,
                                              ),
                                              amount: rtTablePrice(rt),
                                              color: col,
                                            },
                                          ]);
                                        }
                                      } else {
                                        const sel = mySelectedChairs.includes(
                                          ci,
                                        )
                                          ? mySelectedChairs.filter(
                                              (c) => c !== ci,
                                            )
                                          : [...mySelectedChairs, ci];
                                        const amt =
                                          rtChairPrice(rt) * sel.length;
                                        const rest =
                                          roundTableSelections.filter(
                                            (x) =>
                                              x.tablePositionId !==
                                              rt.positionId,
                                          );
                                        if (sel.length === 0)
                                          setRoundTableSelections(rest);
                                        else
                                          setRoundTableSelections([
                                            ...rest,
                                            {
                                              tablePositionId: rt.positionId,
                                              tableName: rt.name,
                                              tableCategory:
                                                rt.category || "Standard",
                                              sellingMode: rt.sellingMode,
                                              selectedChairIndices: sel,
                                              amount: amt,
                                              color: col,
                                            },
                                          ]);
                                      }
                                    };

                                    return (
                                      <div
                                        key={`rt-${rt.positionId}`}
                                        style={{
                                          position: "absolute",
                                          left: 0,
                                          top: 0,
                                          zIndex: 6,
                                        }}
                                      >
                                        {/* Table circle */}
                                        <div
                                          onClick={() => {
                                            if (
                                              !isReference &&
                                              rt.sellingMode === "table"
                                            )
                                              handleChairClick(0);
                                          }}
                                          title={
                                            isReference ? undefined : rt.name
                                          }
                                          className="rounded-full flex flex-col items-center justify-center"
                                          style={{
                                            position: "absolute",
                                            left: cx - diameter / 2,
                                            top: cy - diameter / 2,
                                            width: diameter,
                                            height: diameter,
                                            background: hasSel
                                              ? `radial-gradient(circle at 40% 35%, ${col}30, ${col}15)`
                                              : `radial-gradient(circle at 40% 35%, ${col}18, ${col}08)`,
                                            border: hasSel
                                              ? `2.5px solid ${col}`
                                              : `1.5px solid ${col}55`,
                                            opacity: isReference ? 0.7 : 1,
                                            backgroundImage: isReference
                                              ? "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 6px)"
                                              : undefined,
                                            cursor: isReference
                                              ? "not-allowed"
                                              : rt.sellingMode === "table"
                                                ? "pointer"
                                                : "default",
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontSize: 9,
                                              fontWeight: 800,
                                              color: col,
                                              textAlign: "center",
                                              lineHeight: 1.1,
                                              padding: "0 2px",
                                            }}
                                          >
                                            {rt.name}
                                          </span>
                                        </div>

                                        {/* Chairs */}
                                        {Array.from({
                                          length: rt.numberOfChairs,
                                        }).map((_, i) => {
                                          const a =
                                            (2 * Math.PI * i) /
                                              rt.numberOfChairs -
                                            Math.PI / 2;
                                          const px =
                                            cx +
                                            chairR * Math.cos(a) -
                                            chairSz / 2;
                                          const py =
                                            cy +
                                            chairR * Math.sin(a) -
                                            chairSz / 2;
                                          const bk = bookedChairs.includes(i);
                                          const sl =
                                            mySelectedChairs.includes(i);
                                          return (
                                            <button
                                              key={i}
                                              type="button"
                                              onClick={() =>
                                                handleChairClick(i)
                                              }
                                              disabled={bk || isReference}
                                              className="rounded-full flex items-center justify-center font-bold"
                                              style={{
                                                position: "absolute",
                                                left: px,
                                                top: py,
                                                width: chairSz,
                                                height: chairSz,
                                                fontSize: Math.max(
                                                  6,
                                                  chairSz * 0.45,
                                                ),
                                                color: bk ? "#9ca3af" : "white",
                                                backgroundColor: bk
                                                  ? "#f3f4f6"
                                                  : sl
                                                    ? "#2563eb"
                                                    : col,
                                                border: bk
                                                  ? "1.5px solid #d1d5db"
                                                  : sl
                                                    ? "2px solid #1d4ed8"
                                                    : "1.5px solid rgba(255,255,255,0.8)",
                                                cursor:
                                                  bk || isReference
                                                    ? "not-allowed"
                                                    : "pointer",
                                                opacity: bk ? 0.6 : 1,
                                                transform: sl
                                                  ? "scale(1.15)"
                                                  : "scale(1)",
                                                zIndex: sl ? 12 : 7,
                                              }}
                                              title={
                                                isReference
                                                  ? undefined
                                                  : `Seat ${i + 1} — ${bk ? "Taken" : sl ? "Selected" : "Available"}${rt.sellingMode === "chair" ? ` · ${formatPrice(rtChairPrice(rt))}` : ""}`
                                              }
                                            >
                                              {i + 1}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    );
                                  })}
                                {/* Entrance / exit door markers */}
                                {renderDoors()}
                                {/* Cinema/concert seats */}
                                {renderSeats()}
                                {/* Scheduled Space facilities (courts/grounds/tables) */}
                                {renderScheduledSpaces()}
                                {layoutAnnotations.length > 0 && (
                                  <VenueAnnotationLayer
                                    readOnly
                                    width={venueDisplayCanvas.width}
                                    height={venueDisplayCanvas.height}
                                    scale={1}
                                    zIndex={4}
                                    annotations={layoutAnnotations}
                                  />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Available-tables list intentionally removed — space
                          availability is hidden on the public venue preview. */}

                          {/* Space-template color legend — organizer opt-in via
                              showSpacePricesOnEventfront. Dedupes by template
                              name so many spaces of the same type collapse to
                              one swatch, and only lists templates actually
                              placed (and for sale) on the CURRENTLY selected
                              layout — not-for-sale reference spaces/tables
                              have no price, so they're excluded entirely.
                              Each entry also shows the price (member tier
                              too, if it differs) so the price is visible
                              without hovering every individual space. */}
                          {(eventData as any)?.showSpacePricesOnEventfront !==
                            false &&
                            (() => {
                              const tpls = Array.isArray(
                                (eventData as any)?.tableTemplates,
                              )
                                ? (eventData as any).tableTemplates
                                : [];
                              const entries = new Map<
                                string,
                                {
                                  name: string;
                                  color: string;
                                  regular: number;
                                  member: number | null;
                                  suffix?: string;
                                }
                              >();
                              (venueTables?.[currentLayoutId] || [])
                                .filter(
                                  (t) =>
                                    inCrop(t.x, t.y) &&
                                    (t as any).forSale !== false,
                                )
                                .forEach((t) => {
                                  const tpl = tpls.find(
                                    (x: any) => x?.id === (t as any).id,
                                  );
                                  const name =
                                    tpl?.name || t.type || "Space";
                                  const color =
                                    (t as any).color ||
                                    tpl?.color ||
                                    "#22c55e";
                                  const regular = t.tablePrice ?? 0;
                                  const member =
                                    (t as any).memberPrice != null
                                      ? (t as any).memberPrice
                                      : (tpl?.memberPrice ?? null);
                                  if (!entries.has(name))
                                    entries.set(name, {
                                      name,
                                      color,
                                      regular,
                                      member,
                                    });
                                });
                              roundTableData
                                .filter(
                                  (rt: any) =>
                                    belongsToLayout(rt?.venueConfigId) &&
                                    rt?.forSale !== false,
                                )
                                .forEach((rt: any) => {
                                  const name = rt.category || "Round Table";
                                  const color = rt.color || "#8B5CF6";
                                  const isChairMode =
                                    rt.sellingMode === "chair";
                                  const regular = isChairMode
                                    ? rtChairPrice(rt)
                                    : rtTablePrice(rt);
                                  const member = isChairMode
                                    ? (rt?.memberChairPrice ?? null)
                                    : (rt?.memberTablePrice ?? null);
                                  if (!entries.has(name))
                                    entries.set(name, {
                                      name,
                                      color,
                                      regular,
                                      member,
                                      suffix: isChairMode
                                        ? " / seat"
                                        : undefined,
                                    });
                                });
                              const list = Array.from(entries.values());
                              if (list.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-2 px-1 pt-1">
                                  {list.map((e) => {
                                    const hasMember =
                                      e.member != null &&
                                      Number(e.member) !== Number(e.regular);
                                    return (
                                      <div
                                        key={e.name}
                                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5"
                                      >
                                        <span
                                          className="inline-block h-3 w-3 flex-shrink-0 rounded-sm border"
                                          style={{
                                            backgroundColor: e.color + "80",
                                            borderColor: e.color,
                                          }}
                                        />
                                        <div className="leading-tight">
                                          <div className="text-xs font-semibold text-gray-700">
                                            {e.name}
                                          </div>
                                          {hasMember ? (
                                            <div className="text-[10px] whitespace-nowrap">
                                              <span className="font-medium text-emerald-600">
                                                Member{" "}
                                                {formatPrice(e.member!)}
                                              </span>
                                              <span className="text-gray-400">
                                                {" "}
                                                · {formatPrice(e.regular)}
                                                {e.suffix}
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="text-[10px] text-gray-500 whitespace-nowrap">
                                              {formatPrice(e.regular)}
                                              {e.suffix}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add-On Items — collapsible, same disclosure as the
                    info sections and the Venue Layout. */}
                  {addOnItems && addOnItems.length > 0 && (
                    <CollapsibleCard
                      title="Add-On Items"
                      headingColor={design?.primaryColor}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {addOnItems.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <h5 className="font-semibold text-gray-800">
                                  {item.name}
                                </h5>
                                <p className="text-xs text-gray-400 mt-1">
                                  {item.description}
                                </p>
                              </div>
                              <p
                                className="font-bold text-base"
                                style={{ color: design?.secondaryColor }}
                              >
                                {formatPrice(item.price || 0)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleCard>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                  <p className="text-gray-400">
                    No venue layouts available for this event
                  </p>
                </div>
              )}
              {/* Round-table seat booking — lives inside the Venue tab,
                below the layout map (the map above now shows the round
                tables alongside the Spaces). Only shown when at least one
                round table is actually sellable; "not for sale" round tables
                are layout references only, so the box is hidden for them. */}
              {roundTableData.some((rt: any) => rt.forSale !== false) && (
                <div className="space-y-5">
                  {/* Header */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          Reserve Your Seats
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Click on available chairs to select your preferred
                          seating
                        </p>
                      </div>
                      {roundTableSelections.length > 0 && (
                        <div
                          className="flex items-center gap-2 px-4 py-2 rounded-xl"
                          style={{
                            backgroundColor: `${design?.primaryColor}10`,
                          }}
                        >
                          <span className="text-sm font-medium text-gray-600">
                            {roundTableSelections.reduce(
                              (sum, s) => sum + s.selectedChairIndices.length,
                              0,
                            )}{" "}
                            seat(s)
                          </span>
                          <span className="text-sm text-gray-400">
                            &middot;
                          </span>
                          <span
                            className="text-sm font-bold"
                            style={{ color: design?.primaryColor }}
                          >
                            {formatPrice(
                              roundTableSelections.reduce(
                                (sum, s) => sum + s.amount,
                                0,
                              ),
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Table category cards (bookable tables only — "not for
                      sale" tables are layout references and are excluded). */}
                    {(() => {
                      const bookable = roundTableData.filter(
                        (rt: any) => rt.forSale !== false,
                      );
                      const categories = [
                        ...new Set(
                          bookable.map((rt: any) => rt.category || "Standard"),
                        ),
                      ];
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {categories.map((cat) => {
                            const tablesInCat = bookable.filter(
                              (rt: any) => (rt.category || "Standard") === cat,
                            );
                            const sample = tablesInCat[0];
                            const totalSeats = tablesInCat.reduce(
                              (s: number, rt: any) => s + rt.numberOfChairs,
                              0,
                            );
                            const bookedSeats = tablesInCat.reduce(
                              (s: number, rt: any) =>
                                s + (rt.bookedChairs?.length || 0),
                              0,
                            );
                            return (
                              <div
                                key={cat}
                                className="rounded-xl border p-3 sm:p-4"
                                style={{
                                  borderColor: `${sample.color || "#8B5CF6"}33`,
                                  backgroundColor: `${sample.color || "#8B5CF6"}06`,
                                }}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{
                                      backgroundColor:
                                        sample.color || "#8B5CF6",
                                    }}
                                  />
                                  <span className="font-bold text-sm text-gray-800">
                                    {cat}
                                  </span>
                                </div>
                                <div className="space-y-1 text-xs text-gray-500">
                                  <p>
                                    {tablesInCat.length} table
                                    {tablesInCat.length > 1 ? "s" : ""}
                                  </p>
                                  <p
                                    className="font-medium"
                                    style={{ color: sample.color || "#8B5CF6" }}
                                  >
                                    {sample.sellingMode === "table"
                                      ? formatPrice(rtTablePrice(sample)) +
                                        " / table"
                                      : formatPrice(rtChairPrice(sample)) +
                                        " / seat"}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${totalSeats > 0 ? (bookedSeats / totalSeats) * 100 : 0}%`,
                                          backgroundColor:
                                            sample.color || "#8B5CF6",
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-gray-400">
                                      {totalSeats - bookedSeats} left
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Round Tables now render on the main venue map above
                    (alongside the Spaces), so this standalone round-tables
                    map is intentionally disabled. */}
                  {false &&
                    venueConfig &&
                    venueConfig[currentLayoutIndex] &&
                    (() => {
                      const vc = venueConfig[currentLayoutIndex];
                      const canvasW = vc.width || 800;
                      const canvasH = vc.height || 500;
                      const pad = 25;
                      const totalW = canvasW + pad * 2;
                      const totalH = canvasH + pad * 2;
                      const s = venueDisplayScale;

                      return (
                        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                          <div className="px-5 pt-5 pb-3">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                                  style={{
                                    backgroundColor: `${design?.primaryColor}15`,
                                  }}
                                >
                                  <MapPin
                                    className="h-4 w-4"
                                    style={{ color: design?.primaryColor }}
                                  />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-800">
                                    {vc.name}
                                  </p>
                                  <p className="text-[10px] text-gray-400">
                                    Tap chairs to select seats
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm" />
                                  <span className="text-[10px] font-medium text-gray-600">
                                    Open
                                  </span>
                                </div>
                                <div className="w-px h-3 bg-gray-200" />
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
                                  <span className="text-[10px] font-medium text-gray-600">
                                    Selected
                                  </span>
                                </div>
                                <div className="w-px h-3 bg-gray-200" />
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                                  <span className="text-[10px] font-medium text-gray-600">
                                    Taken
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="px-3 pb-5">
                            <div
                              className="overflow-x-auto rounded-xl border border-gray-200"
                              style={{ background: "#fafbfc" }}
                            >
                              <div
                                className="relative mx-auto"
                                style={{
                                  width: `${totalW}px`,
                                  height: `${totalH}px`,
                                  minWidth: `${totalW}px`,
                                }}
                              >
                                {/* Grid background — offset by padding */}
                                <div
                                  className="absolute rounded-lg"
                                  style={{
                                    left: pad,
                                    top: pad,
                                    width: canvasW,
                                    height: canvasH,
                                    backgroundImage: `
                                  linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
                                  linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)
                                `,
                                    backgroundSize: `${vc.gridSize || 20}px ${vc.gridSize || 20}px`,
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #e5e7eb",
                                  }}
                                >
                                  {/* Main Stage */}
                                  {vc.hasMainStage && (
                                    <div
                                      className="absolute flex items-center justify-center font-bold rounded-b-lg uppercase"
                                      style={{
                                        top: vc.mainStageY ?? 0,
                                        left:
                                          vc.mainStageX ??
                                          (canvasW - (vc.mainStageWidth ?? 200)) /
                                            2,
                                        width: vc.mainStageWidth ?? 200,
                                        height: vc.mainStageHeight ?? 50,
                                        borderRadius:
                                          vc.mainStageShape === "semicircle"
                                            ? "0 0 50% 50% / 0 0 100% 100%"
                                            : vc.mainStageShape === "circle"
                                              ? "50%"
                                              : undefined,
                                        zIndex: 10,
                                        fontSize: 11,
                                        letterSpacing: 3,
                                        background:
                                          "linear-gradient(180deg, #ddd6fe, #c4b5fd)",
                                        color: "#6d28d9",
                                        borderBottom: "2px solid #8b5cf6",
                                      }}
                                    >
                                      {vc.mainStageLabel || "Main Stage"}
                                    </div>
                                  )}
                                </div>

                                {/* Round Tables — positioned relative to pad offset */}
                                {roundTableData.map((rt: any) => {
                                  const bookedChairs: number[] =
                                    rt.bookedChairs || [];
                                  const mySelection = roundTableSelections.find(
                                    (sel) =>
                                      sel.tablePositionId === rt.positionId,
                                  );
                                  const mySelectedChairs =
                                    mySelection?.selectedChairIndices || [];
                                  const isFullyBooked =
                                    rt.isFullyBooked ||
                                    bookedChairs.length >= rt.numberOfChairs;
                                  const d = Math.round(
                                    (rt.tableDiameter || 120) * 0.55,
                                  );
                                  const chairSz = 14;
                                  const chairR = d / 2 + chairSz / 2 + 3;
                                  // Center in the padded canvas
                                  const cx = pad + (rt.x || 0) + d / 2;
                                  const cy = pad + (rt.y || 0) + d / 2;

                                  // A "not for sale" table is a layout
                                  // reference only and cannot be booked.
                                  const isReference = rt.forSale === false;
                                  const handleChairClick = (ci: number) => {
                                    if (isReference) return;
                                    if (bookedChairs.includes(ci)) return;
                                    if (rt.sellingMode === "table") {
                                      if (mySelection) {
                                        setRoundTableSelections(
                                          roundTableSelections.filter(
                                            (x) =>
                                              x.tablePositionId !==
                                              rt.positionId,
                                          ),
                                        );
                                      } else if (!isFullyBooked) {
                                        setRoundTableSelections([
                                          ...roundTableSelections,
                                          {
                                            tablePositionId: rt.positionId,
                                            tableName: rt.name,
                                            tableCategory:
                                              rt.category || "Standard",
                                            sellingMode: rt.sellingMode,
                                            selectedChairIndices: Array.from(
                                              { length: rt.numberOfChairs },
                                              (_, i) => i,
                                            ),
                                            amount: rtTablePrice(rt),
                                            color: rt.color || "#8B5CF6",
                                          },
                                        ]);
                                      }
                                    } else {
                                      const sel = mySelectedChairs.includes(ci)
                                        ? mySelectedChairs.filter(
                                            (c) => c !== ci,
                                          )
                                        : [...mySelectedChairs, ci];
                                      const amt = rtChairPrice(rt) * sel.length;
                                      const rest = roundTableSelections.filter(
                                        (x) =>
                                          x.tablePositionId !== rt.positionId,
                                      );
                                      if (sel.length === 0) {
                                        setRoundTableSelections(rest);
                                      } else {
                                        setRoundTableSelections([
                                          ...rest,
                                          {
                                            tablePositionId: rt.positionId,
                                            tableName: rt.name,
                                            tableCategory:
                                              rt.category || "Standard",
                                            sellingMode: rt.sellingMode,
                                            selectedChairIndices: sel,
                                            amount: amt,
                                            color: rt.color || "#8B5CF6",
                                          },
                                        ]);
                                      }
                                    }
                                  };

                                  const hasSel = mySelectedChairs.length > 0;

                                  const col = rt.color || "#8B5CF6";

                                  return (
                                    <div
                                      key={rt.positionId}
                                      className="group"
                                      style={{
                                        position: "absolute",
                                        left: 0,
                                        top: 0,
                                        pointerEvents: "none",
                                      }}
                                    >
                                      {/* Table circle */}
                                      <div
                                        className="rounded-full flex flex-col items-center justify-center transition-shadow"
                                        style={{
                                          position: "absolute",
                                          left: cx - d / 2,
                                          top: cy - d / 2,
                                          width: d,
                                          height: d,
                                          background: hasSel
                                            ? `radial-gradient(circle at 40% 35%, ${col}30, ${col}15)`
                                            : `radial-gradient(circle at 40% 35%, ${col}18, ${col}08)`,
                                          border: hasSel
                                            ? `2.5px solid ${col}`
                                            : `1.5px solid ${col}55`,
                                          boxShadow: hasSel
                                            ? `0 0 0 3px ${col}15, 0 4px 12px ${col}20`
                                            : `0 1px 4px rgba(0,0,0,0.06)`,
                                          zIndex: 6,
                                          cursor: isReference
                                            ? "not-allowed"
                                            : rt.sellingMode === "table"
                                              ? "pointer"
                                              : "default",
                                          opacity: isReference ? 0.7 : 1,
                                          pointerEvents: "auto",
                                        }}
                                        onClick={() => {
                                          if (
                                            !isReference &&
                                            rt.sellingMode === "table"
                                          )
                                            handleChairClick(0);
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: 7,
                                            fontWeight: 800,
                                            color: col,
                                            textAlign: "center",
                                            lineHeight: 1.1,
                                            letterSpacing: 0.2,
                                          }}
                                        >
                                          {rt.name}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 5,
                                            color: "white",
                                            backgroundColor: col,
                                            borderRadius: 4,
                                            padding: "0.5px 3px",
                                            marginTop: 1,
                                            fontWeight: 600,
                                          }}
                                        >
                                          {isReference
                                            ? "Reference"
                                            : rt.category}
                                        </span>
                                      </div>

                                      {/* Chairs */}
                                      {Array.from({
                                        length: rt.numberOfChairs,
                                      }).map((_, i) => {
                                        const a =
                                          (2 * Math.PI * i) /
                                            rt.numberOfChairs -
                                          Math.PI / 2;
                                        const px =
                                          cx +
                                          chairR * Math.cos(a) -
                                          chairSz / 2;
                                        const py =
                                          cy +
                                          chairR * Math.sin(a) -
                                          chairSz / 2;
                                        const bk = bookedChairs.includes(i);
                                        const sl = mySelectedChairs.includes(i);
                                        return (
                                          <button
                                            key={i}
                                            type="button"
                                            onClick={() => handleChairClick(i)}
                                            disabled={bk || isReference}
                                            className="rounded-full flex items-center justify-center font-bold transition-all"
                                            style={{
                                              position: "absolute",
                                              left: px,
                                              top: py,
                                              width: chairSz,
                                              height: chairSz,
                                              fontSize: 6,
                                              pointerEvents: "auto",
                                              color: bk ? "#9ca3af" : "white",
                                              backgroundColor: bk
                                                ? "#f3f4f6"
                                                : sl
                                                  ? "#2563eb"
                                                  : col,
                                              border: bk
                                                ? "1.5px solid #d1d5db"
                                                : sl
                                                  ? "2px solid #1d4ed8"
                                                  : "1.5px solid rgba(255,255,255,0.8)",
                                              cursor: bk
                                                ? "not-allowed"
                                                : "pointer",
                                              opacity: bk ? 0.6 : 1,
                                              transform: sl
                                                ? "scale(1.2)"
                                                : "scale(1)",
                                              zIndex: sl ? 12 : 7,
                                              boxShadow: sl
                                                ? "0 0 0 2px rgba(37,99,235,0.25), 0 2px 8px rgba(37,99,235,0.3)"
                                                : bk
                                                  ? "none"
                                                  : "0 1px 3px rgba(0,0,0,0.12)",
                                            }}
                                            title={`Seat ${i + 1} — ${bk ? "Taken" : sl ? "Selected" : "Available"}${rt.sellingMode === "chair" ? ` · ${formatPrice(rtChairPrice(rt))}` : ""}`}
                                          >
                                            {i + 1}
                                          </button>
                                        );
                                      })}

                                      {/* Tooltip on hover */}
                                      <div
                                        className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                                        style={{
                                          position: "absolute",
                                          left: cx - 60,
                                          top: cy - d / 2 - 40,
                                          width: 120,
                                          zIndex: 50,
                                        }}
                                      >
                                        <div className="bg-gray-900/95 backdrop-blur-sm text-white text-[9px] px-3 py-2 rounded-lg shadow-xl text-center">
                                          <p className="font-bold text-[10px]">
                                            {rt.name}
                                          </p>
                                          <p className="text-gray-300 mt-0.5">
                                            {isReference
                                              ? "Not for sale"
                                              : rt.sellingMode === "table"
                                                ? formatPrice(rtTablePrice(rt))
                                                : `${formatPrice(rtChairPrice(rt))} / seat`}
                                          </p>
                                          <div className="w-2 h-2 bg-gray-900/95 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                  {/* Booking Summary & Checkout */}
                  {roundTableSelections.length > 0 && (
                    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                      {/* Header bar */}
                      <div
                        className="px-5 py-4 border-b"
                        style={{
                          background: `linear-gradient(135deg, ${design?.primaryColor}08, ${design?.secondaryColor}08)`,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center"
                              style={{
                                backgroundColor: design?.primaryColor,
                                color: "white",
                              }}
                            >
                              <Ticket className="h-3.5 w-3.5" />
                            </div>
                            <span className="font-bold text-sm text-gray-800">
                              Your Selection
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {roundTableSelections.reduce(
                              (sum, s) => sum + s.selectedChairIndices.length,
                              0,
                            )}{" "}
                            seat(s)
                          </span>
                        </div>
                      </div>

                      <div className="p-5 space-y-5">
                        {/* Selected items */}
                        <div className="space-y-2">
                          {roundTableSelections.map((sel) => (
                            <div
                              key={sel.tablePositionId}
                              className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                  style={{ backgroundColor: sel.color }}
                                >
                                  {sel.selectedChairIndices.length}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm text-gray-800">
                                    {sel.tableName}
                                  </p>
                                  <p className="text-[11px] text-gray-400">
                                    {sel.sellingMode === "table"
                                      ? `Whole table · ${sel.selectedChairIndices.length} seats`
                                      : `Seat ${sel.selectedChairIndices.map((c) => c + 1).join(", ")}`}
                                    <span
                                      className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium"
                                      style={{
                                        backgroundColor: `${sel.color}15`,
                                        color: sel.color,
                                      }}
                                    >
                                      {sel.tableCategory}
                                    </span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-sm text-gray-800">
                                  {formatPrice(sel.amount)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRoundTableSelections(
                                      roundTableSelections.filter(
                                        (s) =>
                                          s.tablePositionId !==
                                          sel.tablePositionId,
                                      ),
                                    )
                                  }
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all text-sm"
                                >
                                  &times;
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Total */}
                        <div className="flex justify-between items-center py-3 border-y border-gray-100">
                          <span className="font-bold text-gray-800">
                            Total Amount
                          </span>
                          <span
                            className="text-xl font-black"
                            style={{ color: design?.primaryColor }}
                          >
                            {formatPrice(
                              roundTableSelections.reduce(
                                (sum, s) => sum + s.amount,
                                0,
                              ),
                            )}
                          </span>
                        </div>

                        {/* Visitor info */}
                        <div className="space-y-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Contact Details
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="text-[11px] font-medium text-gray-500 mb-1 block">
                                Full Name *
                              </label>
                              <input
                                type="text"
                                placeholder="John Doe"
                                value={rtVisitorInfo.name}
                                onChange={(e) =>
                                  setRtVisitorInfo({
                                    ...rtVisitorInfo,
                                    name: e.target.value,
                                  })
                                }
                                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                                style={
                                  {
                                    focusRingColor: design?.primaryColor,
                                  } as any
                                }
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-gray-500 mb-1 block">
                                Email *
                              </label>
                              <input
                                type="email"
                                placeholder="john@email.com"
                                value={rtVisitorInfo.email}
                                onChange={(e) =>
                                  setRtVisitorInfo({
                                    ...rtVisitorInfo,
                                    email: e.target.value,
                                  })
                                }
                                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-gray-500 mb-1 block">
                                Phone *
                              </label>
                              <PhoneInput
                                value={rtVisitorInfo.phone}
                                onChange={(value) =>
                                  setRtVisitorInfo({
                                    ...rtVisitorInfo,
                                    phone: value,
                                  })
                                }
                                enableSearch={true}
                                countryCodeEditable={false}
                                preferredCountries={[
                                  "in",
                                  "sg",
                                  "us",
                                  "gb",
                                  "ae",
                                ]}
                                inputProps={{ name: "rtPhone", required: true }}
                                inputStyle={{
                                  width: "100%",
                                  height: "42px",
                                  borderRadius: "12px",
                                  fontSize: "14px",
                                  border: "1px solid #e5e7eb",
                                }}
                                containerStyle={{ width: "100%" }}
                                buttonStyle={{
                                  borderRadius: "12px 0 0 12px",
                                  border: "1px solid #e5e7eb",
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Per-seat guest details — collapsible, optional */}
                        {roundTableOn("seatGuests") && (() => {
                          const totalSeats = roundTableSelections.reduce(
                            (s, sel) => s + sel.selectedChairIndices.length,
                            0,
                          );
                          const filledGuests = Object.values(rtSeatGuests)
                            .flatMap((chairs) => Object.values(chairs))
                            .filter((g) => g.name.trim()).length;
                          return (
                            <div className="rounded-xl border border-gray-100 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setShowGuestForm(!showGuestForm)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/80 hover:bg-gray-100/80 transition-colors text-left"
                              >
                                <div>
                                  <p className="text-xs font-semibold text-gray-700">
                                    Add Guest Details
                                  </p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    {filledGuests > 0
                                      ? `${filledGuests} of ${totalSeats} guests added — each gets their own QR via WhatsApp`
                                      : `Optional — add guest names & WhatsApp to send individual QR tickets`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {filledGuests > 0 && (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                      {filledGuests}/{totalSeats}
                                    </span>
                                  )}
                                  <span
                                    className={`text-gray-400 text-sm transition-transform ${showGuestForm ? "rotate-180" : ""}`}
                                  >
                                    &#9662;
                                  </span>
                                </div>
                              </button>
                              {showGuestForm && (
                                <div className="p-3 space-y-3 border-t border-gray-100">
                                  {roundTableSelections.map((sel) => (
                                    <div
                                      key={sel.tablePositionId}
                                      className="space-y-2"
                                    >
                                      <p className="text-xs font-semibold text-gray-600 flex items-center gap-2">
                                        <span
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: sel.color }}
                                        />
                                        {sel.tableName} — {sel.tableCategory}
                                      </p>
                                      {sel.selectedChairIndices.map(
                                        (chairIdx) => {
                                          const guest = rtSeatGuests[
                                            sel.tablePositionId
                                          ]?.[chairIdx] || {
                                            name: "",
                                            whatsApp: "",
                                            email: "",
                                          };
                                          const updateGuest = (
                                            field: string,
                                            value: string,
                                          ) => {
                                            setRtSeatGuests((prev) => ({
                                              ...prev,
                                              [sel.tablePositionId]: {
                                                ...prev[sel.tablePositionId],
                                                [chairIdx]: {
                                                  ...guest,
                                                  [field]: value,
                                                },
                                              },
                                            }));
                                          };
                                          const isFilled =
                                            guest.name.trim().length > 0;
                                          return (
                                            <div
                                              key={`${sel.tablePositionId}-${chairIdx}`}
                                              className={`rounded-lg border p-3 transition-colors ${isFilled ? "border-green-200 bg-green-50/30" : "border-gray-200 bg-white"}`}
                                            >
                                              <p className="text-[10px] font-bold text-gray-400 mb-2 flex items-center gap-1.5">
                                                <span
                                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px]"
                                                  style={{
                                                    backgroundColor: isFilled
                                                      ? "#22c55e"
                                                      : sel.color,
                                                  }}
                                                >
                                                  {chairIdx + 1}
                                                </span>
                                                Seat {chairIdx + 1}
                                                {isFilled && (
                                                  <span className="text-green-600 text-[9px] ml-auto">
                                                    &#10003;
                                                  </span>
                                                )}
                                              </p>
                                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                <input
                                                  type="text"
                                                  placeholder="Guest Name"
                                                  value={guest.name}
                                                  onChange={(e) =>
                                                    updateGuest(
                                                      "name",
                                                      e.target.value,
                                                    )
                                                  }
                                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                />
                                                <PhoneInput
                                                  value={guest.whatsApp}
                                                  onChange={(value) =>
                                                    updateGuest(
                                                      "whatsApp",
                                                      value,
                                                    )
                                                  }
                                                  enableSearch={true}
                                                  countryCodeEditable={false}
                                                  preferredCountries={[
                                                    "in",
                                                    "sg",
                                                    "us",
                                                    "gb",
                                                    "ae",
                                                  ]}
                                                  inputProps={{
                                                    name: `seat-phone-${chairIdx}`,
                                                  }}
                                                  inputStyle={{
                                                    width: "100%",
                                                    height: "34px",
                                                    borderRadius: "8px",
                                                    fontSize: "12px",
                                                    border: "1px solid #e5e7eb",
                                                  }}
                                                  containerStyle={{
                                                    width: "100%",
                                                  }}
                                                  buttonStyle={{
                                                    borderRadius: "8px 0 0 8px",
                                                    border: "1px solid #e5e7eb",
                                                    height: "34px",
                                                  }}
                                                />
                                                <input
                                                  type="email"
                                                  placeholder="Email"
                                                  value={guest.email}
                                                  onChange={(e) =>
                                                    updateGuest(
                                                      "email",
                                                      e.target.value,
                                                    )
                                                  }
                                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                />
                                              </div>
                                            </div>
                                          );
                                        },
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Book button */}
                        <button
                          type="button"
                          disabled={
                            rtBookingLoading ||
                            !rtVisitorInfo.name ||
                            !rtVisitorInfo.email ||
                            !rtVisitorInfo.phone
                          }
                          onClick={async () => {
                            if (isEventOver(eventData)) {
                              toast({
                                title: "This event has ended",
                                description:
                                  "Round-table bookings are closed for this event.",
                                variant: "destructive",
                              });
                              return;
                            }
                            setRtBookingLoading(true);
                            try {
                              const organizerId = eventData?.organizer?._id;
                              const eid = eventId || id;
                              const bookingPromises = roundTableSelections.map(
                                (sel) => {
                                  const seatGuestsForTable =
                                    sel.selectedChairIndices
                                      .map((chairIdx) => {
                                        const g =
                                          rtSeatGuests[sel.tablePositionId]?.[
                                            chairIdx
                                          ];
                                        return {
                                          chairIndex: chairIdx,
                                          name: g?.name || "",
                                          whatsApp: g?.whatsApp || "",
                                          email: g?.email || "",
                                        };
                                      })
                                      .filter((g) => g.name.trim() !== "");

                                  return fetch(
                                    `${apiURL}/round-table-bookings/create`,
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({
                                        eventId: eid,
                                        organizerId,
                                        tablePositionId: sel.tablePositionId,
                                        selectedChairIndices:
                                          sel.selectedChairIndices,
                                        visitorName: rtVisitorInfo.name,
                                        visitorEmail: rtVisitorInfo.email,
                                        visitorPhone: rtVisitorInfo.phone,
                                        seatGuests: seatGuestsForTable,
                                      }),
                                    },
                                  ).then((r) => r.json());
                                },
                              );
                              const results =
                                await Promise.all(bookingPromises);
                              const failed = results.filter((r) => !r.success);
                              if (failed.length > 0) {
                                toast({
                                  title: "Some bookings failed",
                                  description: failed
                                    .map((f) => f.message)
                                    .join(", "),
                                  variant: "destructive",
                                  duration: 5000,
                                });
                              }
                              const successful = results.filter(
                                (r) => r.success,
                              );
                              if (successful.length > 0) {
                                // Navigate to payment page with booking IDs
                                navigate("/round-table-payment", {
                                  state: {
                                    bookings: successful.map((r) => r.data),
                                    eventTitle: eventData?.title,
                                    totalAmount: successful.reduce(
                                      (sum, r) => sum + r.data.amount,
                                      0,
                                    ),
                                    organizerId: eventData?.organizer?._id,
                                  },
                                });
                              }
                            } catch (err: any) {
                              toast({
                                title: "Booking failed",
                                description: err.message,
                                variant: "destructive",
                                duration: 5000,
                              });
                            } finally {
                              setRtBookingLoading(false);
                            }
                          }}
                          className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50 shadow-lg hover:shadow-xl hover:opacity-95"
                          style={{
                            background: `linear-gradient(135deg, ${design?.primaryColor || "#3b82f6"}, ${design?.secondaryColor || "#6366f1"})`,
                          }}
                        >
                          {rtBookingLoading
                            ? "Processing..."
                            : "Proceed to Payment"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="feedback" className="mt-4">
              <VisitorFeedbackCard eventId={id || eventData?._id || ""} />
            </TabsContent>
          </Tabs>
        </div>

        {/* (Reel player Dialog removed — each reel card now embeds
            the Instagram iframe inline in the History tab's marquee,
            matching kioscart-v1's working pattern. The Dialog approach
            consistently rendered Instagram's logged-out placeholder
            instead of the actual reel.) */}

        <EventFeedbackTokenHandler eventId={id || eventData?._id || ""} />
      </div>

      {/* WhatsApp Verification Dialog */}
      {/* Speaker headshot cropper. Top level, NOT inside the stall form —
          the speaker dialog opens independently of it. Square by default to
          match the circular avatars the eventfront renders speakers in. */}
      {speakerPhotoCrop && (
        <ImageCropModal
          open
          image={speakerPhotoCrop}
          defaultAspect={1}
          onClose={() => {
            if (speakerPhotoCrop.startsWith("blob:"))
              URL.revokeObjectURL(speakerPhotoCrop);
            setSpeakerPhotoCrop(null);
          }}
          onCropComplete={(croppedFile: File) => {
            setSpeakerFormData((p: any) => ({
              ...p,
              photoFile: croppedFile,
              photoPreview: URL.createObjectURL(croppedFile),
            }));
            if (speakerPhotoCrop.startsWith("blob:"))
              URL.revokeObjectURL(speakerPhotoCrop);
            setSpeakerPhotoCrop(null);
          }}
        />
      )}

      {/* Speaker Application Dialog — Google-auth gated */}
      {showSpeakerDialog && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setShowSpeakerDialog(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Apply as Speaker</h3>
                <p className="text-xs text-muted-foreground">
                  {speakerStep === "auth"
                    ? "Sign in with Google to continue"
                    : speakerStep === "status"
                      ? "Your application status"
                      : speakerStep === "timeslot"
                        ? "Select your session time slot"
                        : speakerStep === "done"
                          ? "Your speaker pass is ready"
                          : speakerStep === "details"
                            ? "Step 1 of 3 — about you"
                            : speakerStep === "topic"
                              ? "Step 2 of 3 — your session"
                              : "Step 3 of 3 — pick your slot"}
                </p>
              </div>
              <button
                onClick={() => setShowSpeakerDialog(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* STEP 1: Google sign-in — replaces the old WhatsApp OTP gate.
                  A phone number is no longer an identity here; it is collected
                  further down the form as an optional contact detail only. */}
              {speakerStep === "auth" && (
                <div className="space-y-4">
                  {speakerGoogleLoading ? (
                    <div className="py-8 text-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                      <p className="text-sm text-muted-foreground">
                        Looking you up…
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">
                        Sign in with your Google account to apply as a speaker.
                      </p>
                      <button
                        onClick={handleGoogleSpeakerLogin}
                        className="w-full h-11 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 flex items-center justify-center gap-2"
                        style={{
                          backgroundColor: design?.primaryColor || "#6366f1",
                        }}
                      >
                        <Mail className="h-4 w-4" />
                        Continue with Google
                      </button>
                      <p className="text-[11px] text-gray-400 text-center">
                        Your email is only used to identify your application.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* STEP: STATUS — pending review, or approved and awaiting the
                  slot fee. Which one shows is decided by the frozen fee on the
                  request, the same rule the backend used when it emailed. */}
              {speakerStep === "status" &&
                existingSpeakerRequest &&
                (() => {
                  const req = existingSpeakerRequest;
                  const fee = Number(req.fee) || 0;
                  const awaitingPayment =
                    req.status === "Confirmed" &&
                    !!req.isCharged &&
                    fee > 0 &&
                    req.paymentStatus !== "Paid";
                  const paymentSubmitted =
                    req.status === "Processing" ||
                    (req.isCharged && req.paymentStatus === "Partial");
                  return (
                    <div className="text-center py-4 space-y-4">
                      <div
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                          awaitingPayment
                            ? "bg-blue-100 text-blue-800"
                            : req.status === "Pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {awaitingPayment
                          ? "💳 Approved — payment due"
                          : req.status === "Pending"
                            ? "⏳ Pending approval"
                            : `⚙️ ${req.status}`}
                      </div>

                      <h3 className="text-lg font-bold">
                        {awaitingPayment
                          ? "You're approved! One step left"
                          : paymentSubmitted
                            ? "Payment submitted"
                            : "Your application is under review"}
                      </h3>

                      <p className="text-sm text-gray-500">
                        {awaitingPayment
                          ? `Pay the ${formatPrice(fee)} slot fee to confirm your session. Your speaker pass with QR code is issued once the organizer confirms the payment.`
                          : paymentSubmitted
                            ? "The organizer is verifying your payment. Your speaker pass will be emailed as soon as it's confirmed."
                            : "The organizer will review your application and notify you by email."}
                      </p>

                      <div className="bg-gray-50 rounded-lg p-3 text-left text-sm space-y-1">
                        {req.selectedSlotName && (
                          <p>
                            <span className="text-gray-500">
                              Speaker space:
                            </span>{" "}
                            <span className="font-medium">
                              {req.selectedSlotName}
                            </span>
                          </p>
                        )}
                        {req.sessions?.[0]?.topic && (
                          <p>
                            <span className="text-gray-500">Session:</span>{" "}
                            <span className="font-medium">
                              {req.sessions[0].topic}
                            </span>
                          </p>
                        )}
                        {(req.sessions?.[0]?.confirmedStartTime ||
                          req.sessions?.[0]?.preferredStartTime) && (
                          <p>
                            <span className="text-gray-500">Time:</span>{" "}
                            {req.sessions[0].confirmedStartTime ||
                              req.sessions[0].preferredStartTime}{" "}
                            -{" "}
                            {req.sessions[0].confirmedEndTime ||
                              req.sessions[0].preferredEndTime}
                          </p>
                        )}
                        <p>
                          <span className="text-gray-500">Slot fee:</span>{" "}
                          <span className="font-medium">
                            {fee > 0 ? formatPrice(fee) : "Free"}
                          </span>
                        </p>
                      </div>

                      {awaitingPayment ? (
                        <button
                          onClick={() => goToSpeakerPayment(req)}
                          className="w-full h-11 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
                          style={{
                            backgroundColor: design?.primaryColor || "#6366f1",
                          }}
                        >
                          Pay {formatPrice(fee)} now
                        </button>
                      ) : null}

                      <button
                        onClick={() => setShowSpeakerDialog(false)}
                        className="w-full h-11 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm"
                      >
                        Close
                      </button>
                    </div>
                  );
                })()}

              {/* STEP: TIME SLOT SELECTION (After Approval) */}
              {speakerStep === "timeslot" && existingSpeakerRequest && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <p className="text-green-800 font-semibold">
                      ✅ Your application has been approved!
                    </p>
                    <p className="text-green-600 text-sm mt-1">
                      Select your session time slot below
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Session Topic *
                    </label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Your session topic"
                      value={speakerTimeSlot.topic}
                      onChange={(e) =>
                        setSpeakerTimeSlot({
                          ...speakerTimeSlot,
                          topic: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-primary"
                      placeholder="Brief description..."
                      value={speakerTimeSlot.description}
                      onChange={(e) =>
                        setSpeakerTimeSlot({
                          ...speakerTimeSlot,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Start Time *
                      </label>
                      <input
                        type="time"
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                        value={speakerTimeSlot.startTime}
                        min={eventData?.time || undefined}
                        max={eventData?.endTime || undefined}
                        onChange={(e) =>
                          setSpeakerTimeSlot({
                            ...speakerTimeSlot,
                            startTime: e.target.value,
                          })
                        }
                      />
                      {eventData?.time && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Event: {eventData.time} - {eventData.endTime}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        End Time *
                      </label>
                      <input
                        type="time"
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                        value={speakerTimeSlot.endTime}
                        min={
                          speakerTimeSlot.startTime ||
                          eventData?.time ||
                          undefined
                        }
                        max={eventData?.endTime || undefined}
                        onChange={(e) =>
                          setSpeakerTimeSlot({
                            ...speakerTimeSlot,
                            endTime: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Show booked slots */}
                  {bookedSpeakerSlots.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-orange-800 mb-2">
                        Already Booked Slots (not available):
                      </p>
                      {bookedSpeakerSlots.map((s: any, i: number) => (
                        <p key={i} className="text-xs text-orange-700">
                          {s.confirmedStartTime} - {s.confirmedEndTime}:{" "}
                          {s.topic}
                        </p>
                      ))}
                    </div>
                  )}

                  <button
                    disabled={
                      speakerSubmitting ||
                      !speakerTimeSlot.topic ||
                      !speakerTimeSlot.startTime ||
                      !speakerTimeSlot.endTime
                    }
                    onClick={async () => {
                      // Validate time range
                      if (
                        eventData?.time &&
                        speakerTimeSlot.startTime < eventData.time
                      ) {
                        toast({
                          title: "Invalid",
                          description: `Start time must be after event start (${eventData.time})`,
                          variant: "destructive",
                        });
                        return;
                      }
                      if (
                        eventData?.endTime &&
                        speakerTimeSlot.endTime > eventData.endTime
                      ) {
                        toast({
                          title: "Invalid",
                          description: `End time must be before event end (${eventData.endTime})`,
                          variant: "destructive",
                        });
                        return;
                      }
                      if (
                        speakerTimeSlot.endTime <= speakerTimeSlot.startTime
                      ) {
                        toast({
                          title: "Invalid",
                          description: "End time must be after start time",
                          variant: "destructive",
                        });
                        return;
                      }
                      // Check overlap with booked slots
                      const overlap = bookedSpeakerSlots.some((s: any) => {
                        return (
                          speakerTimeSlot.startTime < s.confirmedEndTime &&
                          speakerTimeSlot.endTime > s.confirmedStartTime
                        );
                      });
                      if (overlap) {
                        toast({
                          title: "Time Conflict",
                          description:
                            "This time overlaps with another speaker's session",
                          variant: "destructive",
                        });
                        return;
                      }

                      setSpeakerSubmitting(true);
                      try {
                        const res = await fetch(
                          `${apiURL}/speaker-requests/${existingSpeakerRequest._id}/select-time-slot`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              sessions: [
                                {
                                  topic: speakerTimeSlot.topic,
                                  description: speakerTimeSlot.description,
                                  confirmedStartTime: speakerTimeSlot.startTime,
                                  confirmedEndTime: speakerTimeSlot.endTime,
                                },
                              ],
                            }),
                          },
                        );
                        const data = await res.json();
                        if (data.success) {
                          const req = data.data;
                          toast({
                            title: "Time slot selected!",
                            description:
                              req.isCharged && req.fee > 0
                                ? "Redirecting to payment..."
                                : "Your slot is confirmed!",
                          });
                          setShowSpeakerDialog(false);
                          navigate("/speaker-payment", {
                            state: {
                              speakerRequestId: req._id,
                              organizerId:
                                eventData?.organizer?._id ||
                                eventData?.organizer,
                              fee: req.fee || 0,
                              isCharged: req.isCharged || false,
                              speakerName: req.name,
                              sessionTopic: speakerTimeSlot.topic,
                              sessionTime: `${speakerTimeSlot.startTime} - ${speakerTimeSlot.endTime}`,
                              eventTitle: eventData?.title,
                              eventDate: eventData?.startDate
                                ? new Date(
                                    eventData.startDate,
                                  ).toLocaleDateString()
                                : "",
                              eventLocation: eventData?.location,
                            },
                          });
                        } else {
                          toast({
                            title: "Error",
                            description: data.message,
                            variant: "destructive",
                          });
                        }
                      } catch (err: any) {
                        toast({
                          title: "Error",
                          description: err.message,
                          variant: "destructive",
                        });
                      } finally {
                        setSpeakerSubmitting(false);
                      }
                    }}
                    className="w-full h-11 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
                    style={{
                      backgroundColor: design?.primaryColor || "#6366f1",
                    }}
                  >
                    {speakerSubmitting ? "Submitting..." : "Confirm Time Slot"}
                  </button>
                </div>
              )}

              {/* STEP: DONE (Completed - Pass ready) */}
              {speakerStep === "done" && existingSpeakerRequest && (
                <div className="text-center py-6 space-y-4">
                  <div className="text-4xl">🎤</div>
                  <h3 className="text-lg font-bold text-green-700">
                    Your Speaker Pass is Ready!
                  </h3>
                  <p className="text-sm text-gray-500">
                    Your QR code has been emailed to{" "}
                    {speakerAuthedEmail || existingSpeakerRequest.email}. You
                    can also download it below.
                  </p>
                  <button
                    onClick={() =>
                      window.open(
                        `${apiURL}/speaker-requests/download-speaker-pass/${existingSpeakerRequest._id}`,
                        "_blank",
                      )
                    }
                    className="w-full h-11 rounded-xl font-semibold text-sm text-white"
                    style={{
                      backgroundColor: design?.primaryColor || "#6366f1",
                    }}
                  >
                    Download Speaker Pass
                  </button>
                  <button
                    onClick={() => setShowSpeakerDialog(false)}
                    className="w-full h-11 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* STEP: APPLICATION FORM (New applicant) */}
              {/* ══ APPLICATION WIZARD — 3 steps, mirroring the stall flow ══
                  1. details : who you are (role, company, bio, contact)
                  2. topic   : what you'll talk about
                  3. slot    : which speaker space + when → Submit
                  Details are prefilled from the saved speaker profile, so a
                  returning speaker only really fills steps 2 and 3. */}
              {(speakerStep === "details" ||
                speakerStep === "topic" ||
                speakerStep === "slot") && (
                <div className="space-y-4">
                  {/* Stepper */}
                  <div className="flex items-center gap-2">
                    {[
                      { key: "details", n: 1, label: "Your details" },
                      { key: "topic", n: 2, label: "Your session" },
                      { key: "slot", n: 3, label: "Slot & timing" },
                    ].map((s, i) => {
                      const order = ["details", "topic", "slot"];
                      const current = order.indexOf(speakerStep);
                      const done = i < current;
                      const active = i === current;
                      return (
                        <div
                          key={s.key}
                          className="flex items-center gap-2 flex-1"
                        >
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              done || active ? "text-white" : "text-gray-400"
                            }`}
                            style={{
                              backgroundColor:
                                done || active
                                  ? design?.primaryColor || "#6366f1"
                                  : "#e5e7eb",
                            }}
                          >
                            {done ? "✓" : s.n}
                          </div>
                          <span
                            className={`text-[11px] font-medium hidden sm:block ${
                              active ? "text-gray-900" : "text-gray-400"
                            }`}
                          >
                            {s.label}
                          </span>
                          {i < 2 && (
                            <div className="h-px flex-1 bg-gray-200 min-w-[8px]" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ─────────────── STEP 1: PERSONAL DETAILS ─────────────── */}
                  {speakerStep === "details" && (
                    <div className="space-y-4">
                      {speakerProfileFound && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
                          Welcome back — we've filled in your saved details.
                          Update anything that's changed.
                        </div>
                      )}

                      {/* Photo */}
                      {speakerOn("image") && (
                      <div className="flex items-center gap-4">
                        <div
                          className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors bg-gray-50 flex-shrink-0"
                          onClick={() =>
                            document
                              .getElementById("speaker-apply-photo")
                              ?.click()
                          }
                        >
                          {speakerFormData.photoPreview ||
                          speakerFormData.image ? (
                            <img
                              src={
                                speakerFormData.photoPreview ||
                                (speakerFormData.image?.startsWith("/")
                                  ? `${apiURL?.replace("/api", "")}${speakerFormData.image}`
                                  : speakerFormData.image)
                              }
                              alt="Your photo"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center">
                              <svg
                                className="mx-auto h-6 w-6 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                />
                              </svg>
                              <span className="text-[9px] text-gray-400">
                                Photo
                              </span>
                            </div>
                          )}
                        </div>
                        <input
                          id="speaker-apply-photo"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            // Crop before keeping it — the photo ends up in a
                            // circular avatar on the event page.
                            if (file)
                              setSpeakerPhotoCrop(URL.createObjectURL(file));
                            // Let the same file be re-picked after a cancel.
                            e.target.value = "";
                          }}
                        />
                        <div className="text-xs text-gray-500">
                          <p className="font-medium text-gray-700">
                            Upload your photo
                          </p>
                          <p>This will be displayed on the event page</p>
                        </div>
                      </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">
                            Full Name *
                          </label>
                          <input
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="Your name"
                            value={speakerFormData.name}
                            onChange={(e) =>
                              setSpeakerFormData((p: any) => ({
                                ...p,
                                name: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">
                            Email *
                          </label>
                          {/* Google-verified — locked so the application is
                              always filed under the identity we authenticated,
                              and so the speaker can sign back in to pay. */}
                          <input
                            type="email"
                            readOnly
                            className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 outline-none cursor-not-allowed"
                            value={speakerFormData.email || speakerAuthedEmail}
                          />
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Verified with Google
                          </p>
                        </div>
                      </div>

                      {speakerOn("phone") && (
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Phone / WhatsApp (optional)
                        </label>
                        {/* Contact detail only — never used to sign in. */}
                        <PhoneInput
                          value={speakerFormData.phone}
                          onChange={(v: string) =>
                            setSpeakerFormData((p: any) => ({ ...p, phone: v }))
                          }
                          enableSearch={true}
                          countryCodeEditable={false}
                          preferredCountries={["in", "sg", "us", "gb"]}
                          inputProps={{ name: "speakerPhone" }}
                          inputStyle={{
                            width: "100%",
                            height: "40px",
                            fontSize: "14px",
                            paddingLeft: "48px",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                          }}
                          containerStyle={{ width: "100%" }}
                          buttonStyle={{
                            borderRadius: "8px 0 0 8px",
                            border: "1px solid #e2e8f0",
                            borderRight: "none",
                          }}
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          So the organizer can reach you about your session.
                        </p>
                      </div>
                      )}

                      {(speakerOn("title") || speakerOn("organization")) && (
                      <div className="grid grid-cols-2 gap-3">
                        {speakerOn("title") && (
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">
                            Role / Title
                          </label>
                          <input
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="e.g. CTO, Professor"
                            value={speakerFormData.title}
                            onChange={(e) =>
                              setSpeakerFormData((p: any) => ({
                                ...p,
                                title: e.target.value,
                              }))
                            }
                          />
                        </div>
                        )}
                        {speakerOn("organization") && (
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">
                            Company / Organization
                          </label>
                          <input
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="Company / University"
                            value={speakerFormData.organization}
                            onChange={(e) =>
                              setSpeakerFormData((p: any) => ({
                                ...p,
                                organization: e.target.value,
                              }))
                            }
                          />
                        </div>
                        )}
                      </div>
                      )}

                      {speakerOn("bio") && (
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Bio
                        </label>
                        <textarea
                          rows={2}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                          placeholder="Brief bio about yourself..."
                          value={speakerFormData.bio}
                          onChange={(e) =>
                            setSpeakerFormData((p: any) => ({
                              ...p,
                              bio: e.target.value,
                            }))
                          }
                        />
                      </div>
                      )}

                      {speakerOn("expertise") && (
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Area of Expertise
                        </label>
                        <input
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          placeholder="e.g. AI/ML, Marketing, Finance"
                          value={speakerFormData.expertise}
                          onChange={(e) =>
                            setSpeakerFormData((p: any) => ({
                              ...p,
                              expertise: e.target.value,
                            }))
                          }
                        />
                      </div>
                      )}

                      {(speakerOn("linkedin") ||
                        speakerOn("twitter") ||
                        speakerOn("website")) && (
                      <div className="grid grid-cols-3 gap-2">
                        {speakerOn("linkedin") && (
                        <input
                          className="border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                          placeholder="LinkedIn URL"
                          value={speakerFormData.socialLinks.linkedin}
                          onChange={(e) =>
                            setSpeakerFormData((p: any) => ({
                              ...p,
                              socialLinks: {
                                ...p.socialLinks,
                                linkedin: e.target.value,
                              },
                            }))
                          }
                        />
                        )}
                        {speakerOn("twitter") && (
                        <input
                          className="border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Twitter URL"
                          value={speakerFormData.socialLinks.twitter}
                          onChange={(e) =>
                            setSpeakerFormData((p: any) => ({
                              ...p,
                              socialLinks: {
                                ...p.socialLinks,
                                twitter: e.target.value,
                              },
                            }))
                          }
                        />
                        )}
                        {speakerOn("website") && (
                        <input
                          className="border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Website URL"
                          value={speakerFormData.socialLinks.website}
                          onChange={(e) =>
                            setSpeakerFormData((p: any) => ({
                              ...p,
                              socialLinks: {
                                ...p.socialLinks,
                                website: e.target.value,
                              },
                            }))
                          }
                        />
                        )}
                      </div>
                      )}
                    </div>
                  )}

                  {/* ───────────────── STEP 2: YOUR SESSION ───────────────── */}
                  {speakerStep === "topic" && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Session Topic *
                        </label>
                        <input
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          placeholder="What will you speak about?"
                          value={speakerFormData.sessionTopic}
                          onChange={(e) =>
                            setSpeakerFormData((p: any) => ({
                              ...p,
                              sessionTopic: e.target.value,
                            }))
                          }
                        />
                      </div>
                      {speakerOn("sessionDescription") && (
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Session Description
                        </label>
                        <textarea
                          rows={3}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                          placeholder="What will the audience take away?"
                          value={speakerFormData.sessionDescription}
                          onChange={(e) =>
                            setSpeakerFormData((p: any) => ({
                              ...p,
                              sessionDescription: e.target.value,
                            }))
                          }
                        />
                      </div>
                      )}
                      {speakerOn("previousSpeakingExperience") && (
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Previous Speaking Experience
                        </label>
                        <textarea
                          rows={2}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                          placeholder="List conferences, events, or talks you've given..."
                          value={speakerFormData.previousSpeakingExperience}
                          onChange={(e) =>
                            setSpeakerFormData((p: any) => ({
                              ...p,
                              previousSpeakingExperience: e.target.value,
                            }))
                          }
                        />
                      </div>
                      )}
                      {speakerOn("equipmentNeeded") && (
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Equipment Needed
                        </label>
                        <input
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          placeholder="e.g. Projector, Whiteboard, Microphone"
                          value={speakerFormData.equipmentNeeded}
                          onChange={(e) =>
                            setSpeakerFormData((p: any) => ({
                              ...p,
                              equipmentNeeded: e.target.value,
                            }))
                          }
                        />
                      </div>
                      )}
                    </div>
                  )}

                  {/* ─────────────── STEP 3: SLOT & TIMING ─────────────── */}
                  {speakerStep === "slot" && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Speaker Space *
                        </label>
                        <div className="space-y-2">
                          {openSpeakerSlots.map((slot: any) => {
                            const price = Number(slot.slotPrice) || 0;
                            const selected =
                              speakerFormData.selectedSlotId === slot.id;
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() =>
                                  setSpeakerFormData((p: any) => ({
                                    ...p,
                                    selectedSlotId: slot.id,
                                    selectedSlotName: slot.name || "",
                                    selectedSlotPrice: price,
                                  }))
                                }
                                className={`w-full text-left border-2 rounded-xl p-3 transition-all ${
                                  selected
                                    ? "bg-primary/5"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                                style={
                                  selected
                                    ? {
                                        borderColor:
                                          design?.primaryColor || "#6366f1",
                                      }
                                    : undefined
                                }
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {slot.name}
                                      {slot.isMainStage && (
                                        <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                          Main Stage
                                        </span>
                                      )}
                                    </p>
                                    {(slot.startTime || slot.description) && (
                                      <p className="text-[11px] text-gray-500 mt-0.5">
                                        {slot.startTime
                                          ? `${slot.startTime} - ${slot.endTime || ""}`
                                          : ""}
                                        {slot.startTime && slot.description
                                          ? " · "
                                          : ""}
                                        {slot.description || ""}
                                      </p>
                                    )}
                                  </div>
                                  <span
                                    className={`text-sm font-bold flex-shrink-0 ${
                                      price > 0
                                        ? "text-gray-900"
                                        : "text-green-600"
                                    }`}
                                  >
                                    {price > 0
                                      ? formatPrice(price)
                                      : "Free"}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                          {openSpeakerSlots.length === 0 && (
                            <p className="text-xs text-gray-500">
                              The organizer hasn't opened any speaker space for
                              applications yet.
                            </p>
                          )}
                        </div>
                      </div>

                      {(speakerOn("preferredStartTime") ||
                        speakerOn("preferredEndTime")) && (
                      <div className="grid grid-cols-2 gap-3">
                        {speakerOn("preferredStartTime") && (
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">
                            Preferred Start Time
                          </label>
                          <input
                            type="time"
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                            value={speakerFormData.preferredStartTime}
                            min={eventData?.time || undefined}
                            max={eventData?.endTime || undefined}
                            onChange={(e) =>
                              setSpeakerFormData((p: any) => ({
                                ...p,
                                preferredStartTime: e.target.value,
                              }))
                            }
                          />
                          {eventData?.time && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Event runs {eventData.time} - {eventData.endTime}
                            </p>
                          )}
                        </div>
                        )}
                        {speakerOn("preferredEndTime") && (
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">
                            Preferred End Time
                          </label>
                          <input
                            type="time"
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                            value={speakerFormData.preferredEndTime}
                            min={
                              speakerFormData.preferredStartTime ||
                              eventData?.time ||
                              undefined
                            }
                            max={eventData?.endTime || undefined}
                            onChange={(e) =>
                              setSpeakerFormData((p: any) => ({
                                ...p,
                                preferredEndTime: e.target.value,
                              }))
                            }
                          />
                        </div>
                        )}
                      </div>
                      )}

                      {bookedSpeakerSlots.length > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-orange-800 mb-2">
                            Already taken by other speakers:
                          </p>
                          {bookedSpeakerSlots.map((s: any, i: number) => (
                            <p key={i} className="text-xs text-orange-700">
                              {s.confirmedStartTime} - {s.confirmedEndTime}:{" "}
                              {s.topic}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* What happens next depends on the slot's price —
                          exactly the stall rule, spelled out before they
                          commit so approval isn't a surprise. */}
                      <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-600">
                        {Number(speakerFormData.selectedSlotPrice) > 0 ? (
                          <>
                            <strong className="text-gray-900">
                              This is a paid slot (
                              {formatPrice(
                                Number(speakerFormData.selectedSlotPrice),
                              )}
                              ).
                            </strong>{" "}
                            After the organizer approves you, sign back in here
                            with the same email to pay. Your speaker pass with
                            QR code arrives once the organizer confirms the
                            payment.
                          </>
                        ) : (
                          <>
                            <strong className="text-gray-900">
                              This slot is free.
                            </strong>{" "}
                            Once the organizer approves your application, your
                            speaker pass with QR code is emailed to you
                            automatically.
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ─────────── WIZARD NAVIGATION ─────────── */}
                  <div className="flex gap-3 pt-2 border-t">
                    <button
                      onClick={() => {
                        if (speakerStep === "details") {
                          setShowSpeakerDialog(false);
                        } else {
                          setSpeakerStep(
                            speakerStep === "slot" ? "topic" : "details",
                          );
                        }
                      }}
                      className="flex-1 h-11 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                    >
                      {speakerStep === "details" ? "Cancel" : "Back"}
                    </button>
                    {speakerStep !== "slot" ? (
                      <button
                        onClick={() => {
                          if (speakerStep === "details") {
                            if (!speakerFormData.name?.trim()) {
                              toast({
                                title: "Your name is required",
                                variant: "destructive",
                              });
                              return;
                            }
                            setSpeakerStep("topic");
                          } else {
                            if (!speakerFormData.sessionTopic?.trim()) {
                              toast({
                                title: "A session topic is required",
                                variant: "destructive",
                              });
                              return;
                            }
                            setSpeakerStep("slot");
                          }
                        }}
                        className="flex-1 h-11 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
                        style={{
                          backgroundColor: design?.primaryColor || "#6366f1",
                        }}
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        disabled={
                          speakerSubmitting ||
                          (openSpeakerSlots.length > 0 &&
                            !speakerFormData.selectedSlotId)
                        }
                        onClick={submitSpeakerApplication}
                        className="flex-1 h-11 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{
                          backgroundColor: design?.primaryColor || "#6366f1",
                        }}
                      >
                        {speakerSubmitting
                          ? "Submitting..."
                          : "Submit Application"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Host a Workshop — self-service application dialog, same
          Google-auth-first / status-screen pattern as Apply as Speaker. */}
      {showWorkshopHostDialog && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setShowWorkshopHostDialog(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Host a Workshop</h3>
                <p className="text-xs text-muted-foreground">
                  {workshopHostStep === "auth"
                    ? "Sign in with Google to continue"
                    : workshopHostStep === "status"
                      ? "Your application status"
                      : "Tell us about your workshop"}
                </p>
              </div>
              <button
                onClick={() => setShowWorkshopHostDialog(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* STEP: Google sign-in */}
              {workshopHostStep === "auth" && (
                <div className="space-y-4">
                  {workshopHostGoogleLoading ? (
                    <div className="py-8 text-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                      <p className="text-sm text-muted-foreground">
                        Looking you up…
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">
                        Sign in with your Google account to apply to host a
                        workshop.
                      </p>
                      <button
                        onClick={handleGoogleWorkshopHostLogin}
                        className="w-full h-11 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 flex items-center justify-center gap-2"
                        style={{
                          backgroundColor: design?.primaryColor || "#6366f1",
                        }}
                      >
                        <Mail className="h-4 w-4" />
                        Continue with Google
                      </button>
                      <p className="text-[11px] text-gray-400 text-center">
                        Your email is only used to identify your application.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* STEP: STATUS — pending review, approved+free (going live
                  automatically), or approved+fee (payment due). */}
              {workshopHostStep === "status" &&
                existingWorkshopHostRequest &&
                (() => {
                  const req = existingWorkshopHostRequest;
                  const fee = Number(req.hostingFee) || 0;
                  const awaitingPayment =
                    req.status === "Confirmed" &&
                    !!req.isCharged &&
                    fee > 0 &&
                    req.paymentStatus !== "Paid";
                  const paymentSubmitted =
                    req.isCharged && req.paymentStatus === "Paid";
                  return (
                    <div className="text-center py-4 space-y-4">
                      <div
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                          req.status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : awaitingPayment
                              ? "bg-blue-100 text-blue-800"
                              : req.status === "Pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {req.status === "Completed"
                          ? "🎉 Live on the event page"
                          : awaitingPayment
                            ? "💳 Approved — hosting fee due"
                            : req.status === "Pending"
                              ? "⏳ Pending approval"
                              : `⚙️ ${req.status}`}
                      </div>

                      <h3 className="text-lg font-bold">
                        {req.status === "Completed"
                          ? "Your workshop is live!"
                          : awaitingPayment
                            ? "You're approved! One step left"
                            : paymentSubmitted
                              ? "Payment submitted"
                              : "Your application is under review"}
                      </h3>

                      <p className="text-sm text-gray-500">
                        {req.status === "Completed"
                          ? `"${req.workshopName}" is published and visitors can book it.`
                          : awaitingPayment
                            ? `Pay the ${formatPrice(fee)} hosting fee to confirm your slot. Your workshop goes live once the organizer confirms the payment.`
                            : paymentSubmitted
                              ? "The organizer is verifying your payment. Your workshop goes live as soon as it's confirmed."
                              : "The organizer will review your application and notify you by email."}
                      </p>

                      <div className="bg-gray-50 rounded-lg p-3 text-left text-sm space-y-1">
                        <p>
                          <span className="text-gray-500">Workshop:</span>{" "}
                          <span className="font-medium">
                            {req.workshopName}
                          </span>
                        </p>
                        {(req.proposedStartTime || req.proposedEndTime) && (
                          <p>
                            <span className="text-gray-500">Time:</span>{" "}
                            {req.proposedStartTime} - {req.proposedEndTime}
                          </p>
                        )}
                        <p>
                          <span className="text-gray-500">
                            Visitor price:
                          </span>{" "}
                          <span className="font-medium">
                            {req.finalPrice > 0
                              ? formatPrice(req.finalPrice)
                              : "Free"}
                          </span>
                        </p>
                        <p>
                          <span className="text-gray-500">Hosting fee:</span>{" "}
                          <span className="font-medium">
                            {fee > 0 ? formatPrice(fee) : "Free"}
                          </span>
                        </p>
                      </div>

                      {req.status === "Completed" && req.finalPrice > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left">
                          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
                            Ticket Sales
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                              {req.ticketsSold || 0} ticket
                              {req.ticketsSold === 1 ? "" : "s"} sold so far
                            </p>
                            <p className="text-lg font-bold text-amber-700">
                              {formatPrice(req.amountOwed || 0)}
                            </p>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">
                            This is what the organizer owes you so far —
                            they'll pay it to the account you provided.
                          </p>
                        </div>
                      )}

                      {awaitingPayment ? (
                        <button
                          onClick={() => goToWorkshopHostPayment(req)}
                          className="w-full h-11 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
                          style={{
                            backgroundColor: design?.primaryColor || "#6366f1",
                          }}
                        >
                          Pay {formatPrice(fee)} now
                        </button>
                      ) : null}

                      <button
                        onClick={() => setShowWorkshopHostDialog(false)}
                        className="w-full h-11 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm"
                      >
                        Close
                      </button>
                    </div>
                  );
                })()}

              {/* STEP: APPLICATION FORM */}
              {workshopHostStep === "details" && (
                <div className="space-y-4">
                  {/* Photo */}
                  {workshopOn("photoFile") && (
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors bg-gray-50"
                      onClick={() =>
                        document
                          .getElementById("workshop-host-photo")
                          ?.click()
                      }
                    >
                      {workshopHostFormData.photoPreview ? (
                        <img
                          src={workshopHostFormData.photoPreview}
                          alt="Host"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <input
                      id="workshop-host-photo"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setWorkshopHostCrop({
                            url: URL.createObjectURL(file),
                          });
                        }
                        e.target.value = "";
                      }}
                    />
                    <span className="text-[9px] text-muted-foreground">
                      Your photo (optional)
                    </span>
                  </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Your Name *
                    </label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                      value={workshopHostFormData.hostName}
                      onChange={(e) =>
                        setWorkshopHostFormData((p) => ({
                          ...p,
                          hostName: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Email
                    </label>
                    <input
                      readOnly
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 outline-none cursor-not-allowed"
                      value={
                        workshopHostFormData.hostEmail ||
                        workshopHostAuthedEmail
                      }
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Verified with Google
                    </p>
                  </div>

                  {workshopOn("hostPhone") && (
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Phone / WhatsApp (optional)
                    </label>
                    <PhoneInput
                      value={workshopHostFormData.hostPhone}
                      onChange={(v: string) =>
                        setWorkshopHostFormData((p) => ({
                          ...p,
                          hostPhone: v,
                        }))
                      }
                      enableSearch={true}
                      countryCodeEditable={false}
                      preferredCountries={["in", "sg", "us", "gb"]}
                      inputProps={{ name: "workshopHostPhone" }}
                      inputStyle={{
                        width: "100%",
                        height: "40px",
                        fontSize: "14px",
                        paddingLeft: "48px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}
                      containerStyle={{ width: "100%" }}
                      buttonStyle={{
                        borderRadius: "8px 0 0 8px",
                      }}
                    />
                  </div>
                  )}

                  {workshopOn("hostBio") && (
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Your Bio
                    </label>
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                      rows={2}
                      value={workshopHostFormData.hostBio}
                      onChange={(e) =>
                        setWorkshopHostFormData((p) => ({
                          ...p,
                          hostBio: e.target.value,
                        }))
                      }
                      placeholder="Who you are and why you're a good fit to run this workshop"
                    />
                  </div>
                  )}

                  <div className="border-t pt-4">
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Workshop Title *
                    </label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                      value={workshopHostFormData.workshopName}
                      onChange={(e) =>
                        setWorkshopHostFormData((p) => ({
                          ...p,
                          workshopName: e.target.value,
                        }))
                      }
                    />
                  </div>

                  {workshopOn("workshopDescription") && (
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Workshop Description
                    </label>
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                      rows={3}
                      value={workshopHostFormData.workshopDescription}
                      onChange={(e) =>
                        setWorkshopHostFormData((p) => ({
                          ...p,
                          workshopDescription: e.target.value,
                        }))
                      }
                      placeholder="What visitors will learn, bring, or need to know"
                    />
                  </div>
                  )}

                  {(workshopOn("proposedPrice") || workshopOn("maxSeats")) && (
                  <div className="grid grid-cols-2 gap-3">
                    {workshopOn("proposedPrice") && (
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Suggested Visitor Price
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                        value={workshopHostFormData.proposedPrice}
                        onChange={(e) =>
                          setWorkshopHostFormData((p) => ({
                            ...p,
                            proposedPrice: e.target.value,
                          }))
                        }
                        placeholder="0 = Free"
                      />
                    </div>
                    )}
                    {workshopOn("maxSeats") && (
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Max Seats
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                        value={workshopHostFormData.maxSeats}
                        onChange={(e) =>
                          setWorkshopHostFormData((p) => ({
                            ...p,
                            maxSeats: e.target.value,
                          }))
                        }
                        placeholder="Blank = unlimited"
                      />
                    </div>
                    )}
                  </div>
                  )}

                  {/* Only relevant once the host has priced the workshop —
                      that's when the organizer needs somewhere to pay them. */}
                  {workshopOn("proposedPrice") &&
                    (Number(workshopHostFormData.proposedPrice) || 0) > 0 && (
                    <div className="border-t pt-4 space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Payout Account (this is a paid workshop)
                      </p>
                      {workshopOn("hostAccountName") && (
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Account Holder Name *
                        </label>
                        <input
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                          value={workshopHostFormData.hostAccountName}
                          onChange={(e) =>
                            setWorkshopHostFormData((p) => ({
                              ...p,
                              hostAccountName: e.target.value,
                            }))
                          }
                          placeholder="Name on the account"
                        />
                      </div>
                      )}
                      {workshopOn("hostAccountDetails") && (
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Account Details *
                        </label>
                        <input
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                          value={workshopHostFormData.hostAccountDetails}
                          onChange={(e) =>
                            setWorkshopHostFormData((p) => ({
                              ...p,
                              hostAccountDetails: e.target.value,
                            }))
                          }
                          placeholder="Bank account, UPI ID, or PayNow number"
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          The organizer will use this to pay you for the
                          workshop.
                        </p>
                      </div>
                      )}
                    </div>
                  )}

                  {(workshopOn("proposedStartTime") ||
                    workshopOn("proposedEndTime")) && (
                  <div className="grid grid-cols-2 gap-3">
                    {workshopOn("proposedStartTime") && (
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                        value={workshopHostFormData.proposedStartTime}
                        onChange={(e) =>
                          setWorkshopHostFormData((p) => ({
                            ...p,
                            proposedStartTime: e.target.value,
                          }))
                        }
                      />
                    </div>
                    )}
                    {workshopOn("proposedEndTime") && (
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                        value={workshopHostFormData.proposedEndTime}
                        onChange={(e) =>
                          setWorkshopHostFormData((p) => ({
                            ...p,
                            proposedEndTime: e.target.value,
                          }))
                        }
                      />
                    </div>
                    )}
                  </div>
                  )}

                  <button
                    disabled={workshopHostSubmitting}
                    onClick={submitWorkshopHostApplication}
                    className="w-full h-11 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-50"
                    style={{
                      backgroundColor: design?.primaryColor || "#6366f1",
                    }}
                  >
                    {workshopHostSubmitting
                      ? "Submitting..."
                      : "Submit Application"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workshop host photo cropper. */}
      {workshopHostCrop && (
        <ImageCropModal
          open
          image={workshopHostCrop.url}
          defaultAspect={1}
          onClose={closeWorkshopHostCropper}
          onCropComplete={applyWorkshopHostCrop}
        />
      )}

      {/* Google-verified Member dialog — entry point lives on the
          Rent-a-Stall card. Only mounted when an organizer id is
          available so the lookup endpoints have something to scope to. */}
      {(() => {
        const orgId =
          (eventData as any)?.organizer?._id ||
          (typeof (eventData as any)?.organizer === "string"
            ? (eventData as any).organizer
            : "");
        if (!orgId) return null;
        return (
          <EventfrontMemberDialog
            open={showMemberDialog}
            onClose={() => setShowMemberDialog(false)}
            organizerId={String(orgId)}
          />
        );
      })()}

      {/* "Become a Sponsor" popup — the tier list. Picking one hands off to
          the sponsor application page one path segment deeper. */}
      <EventfrontSponsorDialog
        open={showSponsorDialog}
        onClose={() => setShowSponsorDialog(false)}
        eventId={(eventData as any)?._id}
        organizerId={
          (eventData as any)?.organizer?._id ||
          (typeof (eventData as any)?.organizer === "string"
            ? (eventData as any).organizer
            : undefined)
        }
        primaryColor={design?.primaryColor || "#f97316"}
      />

      {/* Scheduled Spaces — Google sign-in gate, then registration form. */}
      <Dialog
        open={showScheduledSpaceForm}
        onOpenChange={setShowScheduledSpaceForm}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6">
            <DialogHeader>
              <DialogTitle>Book a Scheduled Space</DialogTitle>
              {scheduledSpaceStep === "auth" && (
                <DialogDescription>
                  Sign in with Google to continue.
                </DialogDescription>
              )}
            </DialogHeader>
            <ScheduledSpaceStepper
              current={scheduledSpaceStep === "auth" ? 1 : 2}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {scheduledSpaceStep === "auth" ? (
            <div className="space-y-4 py-2">
              {scheduledSpaceGoogleLoading ? (
                <div className="py-6 text-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                  <p className="text-sm text-muted-foreground">
                    Looking you up…
                  </p>
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={handleScheduledSpaceGoogleLogin}
                    className="w-full"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Continue with Google
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    We use your email to verify your booking and find any
                    existing request — already registered? Signing in again
                    takes you straight to your status.
                  </p>
                </>
              )}
            </div>
          ) : (
            <form
              onSubmit={handleScheduledSpaceFormSubmit}
              className="space-y-4"
            >
              <div className="rounded-lg border p-3 bg-slate-50">
                <Label>Referral Code</Label>
                {scheduledSpaceReferralResolved ? (
                  <div className="mt-1 flex items-center justify-between gap-2">
                    {scheduledSpaceMatchedOperator ? (
                      <p className="text-xs text-green-700">
                        Code <span className="font-mono">{scheduledSpaceForm.referralCode}</span> accepted
                        — narrowed to {scheduledSpaceMatchedOperator.name}'s spaces (plus public ones).
                      </p>
                    ) : scheduledSpaceReferralInvalid ? (
                      <p className="text-xs text-amber-700">
                        Code not recognized — showing all spaces.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No referral code — showing all spaces.
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs shrink-0"
                      onClick={() => setScheduledSpaceReferralResolved(false)}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      value={scheduledSpaceForm.referralCode}
                      placeholder="Have a code from an organizer/operator?"
                      onChange={(e) =>
                        setScheduledSpaceForm((p) => ({
                          ...p,
                          referralCode: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      Have a code from a specific operator? Enter it to
                      narrow the list below to just their spaces. Don't have
                      one? No problem — continue to see every space.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          !scheduledSpaceForm.referralCode.trim() ||
                          scheduledSpaceCheckingReferral
                        }
                        onClick={applyScheduledSpaceReferralCode}
                      >
                        {scheduledSpaceCheckingReferral
                          ? "Checking…"
                          : "Apply Code"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={scheduledSpaceCheckingReferral}
                        onClick={skipScheduledSpaceReferralCode}
                      >
                        No Coupon — Continue
                      </Button>
                    </div>
                  </>
                )}
              </div>
              <fieldset
                disabled={!scheduledSpaceReferralResolved}
                className={`space-y-4 transition-all ${
                  scheduledSpaceReferralResolved
                    ? ""
                    : "opacity-40 blur-[1.5px] pointer-events-none select-none"
                }`}
              >
              <div>
                <Label>Full Name *</Label>
                <Input
                  value={scheduledSpaceForm.name}
                  onChange={(e) =>
                    setScheduledSpaceForm((p) => ({
                      ...p,
                      name: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <Label>Email (verified with Google)</Label>
                <Input
                  type="email"
                  value={scheduledSpaceForm.email}
                  disabled
                  className="bg-muted/50"
                  title="Verified via Google sign-in — can't be changed"
                />
              </div>
              {scheduledSpaceOn("whatsappNumber") && (
                <div className="space-y-2">
                  <Label>WhatsApp Number *</Label>
                  <PhoneInput
                    value={scheduledSpaceForm.whatsappNumber}
                    onChange={(whatsappNumber: string, country: any) => {
                      setScheduledSpaceWhatsappCountry(country);
                      setScheduledSpaceForm((p) => ({
                        ...p,
                        whatsappNumber,
                      }));
                    }}
                    enableSearch
                    countryCodeEditable={false}
                    preferredCountries={["in", "sg", "us", "gb"]}
                    inputStyle={{
                      width: "100%",
                      height: "36px",
                      borderRadius: "6px",
                    }}
                  />
                  {scheduledSpaceWhatsappCountry && (
                    <p className="text-[11px] text-gray-400">
                      Enter {phoneHint(scheduledSpaceWhatsappCountry)} for{" "}
                      {scheduledSpaceWhatsappCountry.name}
                    </p>
                  )}
                </div>
              )}
              {scheduledSpaceOn("phone") && (
                <div className="space-y-2">
                  <Label>Phone Number *</Label>
                  <PhoneInput
                    value={scheduledSpaceForm.phone}
                    onChange={(phone: string, country: any) => {
                      setScheduledSpacePhoneCountry(country);
                      setScheduledSpaceForm((p) => ({ ...p, phone }));
                    }}
                    enableSearch
                    countryCodeEditable={false}
                    preferredCountries={["in", "sg", "us", "gb"]}
                    inputStyle={{
                      width: "100%",
                      height: "36px",
                      borderRadius: "6px",
                    }}
                  />
                  {scheduledSpacePhoneCountry && (
                    <p className="text-[11px] text-gray-400">
                      Enter {phoneHint(scheduledSpacePhoneCountry)} for{" "}
                      {scheduledSpacePhoneCountry.name}
                    </p>
                  )}
                </div>
              )}
              {scheduledSpaceOn("facilityType") &&
                scheduledSpaceFacilityTypes.length > 0 && (
                  <div>
                    <Label>Type of Space Required *</Label>
                    <Select
                      value={scheduledSpaceForm.facilityType}
                      onValueChange={(v) =>
                        setScheduledSpaceForm((p) => ({
                          ...p,
                          facilityType: v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a space type" />
                      </SelectTrigger>
                      <SelectContent>
                        {scheduledSpaceFacilityTypes.map((ft) => {
                          const avail = scheduledSpaceFacilityAvailability[ft];
                          const hint =
                            avail && avail.total > 0
                              ? avail.available > 0
                                ? `${avail.available} slot${avail.available === 1 ? "" : "s"} available`
                                : "Fully booked"
                              : null;
                          return (
                            <SelectItem key={ft} value={ft}>
                              <span className="flex items-center gap-2">
                                <span>{ft}</span>
                                {hint && (
                                  <span
                                    className={`text-xs ${avail.available > 0 ? "text-green-600" : "text-red-500"}`}
                                  >
                                    ({hint})
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              {scheduledSpaceOn("purpose") && (
                <div>
                  <Label>Purpose of Booking</Label>
                  <Input
                    value={scheduledSpaceForm.purpose}
                    onChange={(e) =>
                      setScheduledSpaceForm((p) => ({
                        ...p,
                        purpose: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
              {scheduledSpaceOn("organization") && (
                <div>
                  <Label>Organization / Department</Label>
                  <Input
                    value={scheduledSpaceForm.organization}
                    onChange={(e) =>
                      setScheduledSpaceForm((p) => ({
                        ...p,
                        organization: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
              {scheduledSpaceOn("companions") && (
                <div>
                  <Label>Persons Coming With You</Label>
                  <div className="space-y-2 mt-1">
                    {scheduledSpaceForm.companions.map((c, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={c}
                          placeholder={`Person ${i + 1} name`}
                          onChange={(e) =>
                            setScheduledSpaceForm((p) => {
                              const next = [...p.companions];
                              next[i] = e.target.value;
                              return { ...p, companions: next };
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setScheduledSpaceForm((p) => ({
                              ...p,
                              companions: p.companions.filter(
                                (_, idx) => idx !== i,
                              ),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setScheduledSpaceForm((p) => ({
                          ...p,
                          companions: [...p.companions, ""],
                        }))
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Person
                    </Button>
                  </div>
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={scheduledSpaceLoading}
              >
                {scheduledSpaceLoading ? "Submitting…" : "Submit Registration"}
              </Button>
              </fieldset>
            </form>
          )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Scheduled Spaces — status view (Pending / Rejected / Processing /
          Completed). Confirmed skips straight to the slot picker instead. */}
      <Dialog
        open={showScheduledSpaceStatus}
        onOpenChange={setShowScheduledSpaceStatus}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Your Scheduled Space Request</DialogTitle>
          </DialogHeader>
          <ScheduledSpaceStepper
            current={
              existingScheduledSpaceRequest?.status === "Completed"
                ? 4
                : existingScheduledSpaceRequest?.status === "Processing"
                  ? 3
                  : 2
            }
            pending={["Pending", "Rejected"].includes(
              existingScheduledSpaceRequest?.status,
            )}
            note={
              existingScheduledSpaceRequest?.status === "Rejected"
                ? "This request was not approved"
                : undefined
            }
          />
          <div className="space-y-3 text-sm">
            <p>
              <strong>Status:</strong> {existingScheduledSpaceRequest?.status}
            </p>
            {existingScheduledSpaceRequest?.status === "Pending" && (
              <p className="text-amber-600">
                Waiting for the organizer to approve your registration.
              </p>
            )}
            {existingScheduledSpaceRequest?.status === "Rejected" && (
              <p className="text-red-600">
                Your registration wasn't approved.
                {existingScheduledSpaceRequest?.cancellationReason
                  ? ` Reason: ${existingScheduledSpaceRequest.cancellationReason}`
                  : ""}
              </p>
            )}
            {existingScheduledSpaceRequest?.status === "Cancelled" && (
              <p className="text-red-600">
                This request was cancelled.
                {existingScheduledSpaceRequest?.cancellationReason
                  ? ` Reason: ${existingScheduledSpaceRequest.cancellationReason}`
                  : ""}
              </p>
            )}
            {existingScheduledSpaceRequest?.status === "Processing" && (
              <>
                <p className="text-amber-600">
                  {existingScheduledSpaceRequest?.slotsTotal === 0
                    ? "Slot selected — this space is free, waiting for the organizer to approve your booking."
                    : "Payment submitted — waiting for the organizer to confirm."}
                </p>
                <div className="rounded-lg border p-3 space-y-1">
                  {(existingScheduledSpaceRequest?.selectedSlots || []).map(
                    (s: any, i: number) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs"
                      >
                        <span>
                          {s.spaceName} — {s.date} {s.startTime}-{s.endTime}
                        </span>
                        <span>{formatPrice(s.price)}</span>
                      </div>
                    ),
                  )}
                </div>
              </>
            )}
            {existingScheduledSpaceRequest?.status === "Completed" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <CheckCircle2 className="h-9 w-9 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-emerald-800">
                      Booking Confirmed
                    </p>
                    <p className="text-xs text-emerald-700">
                      Your check-in QR ticket is ready — show this at the
                      venue.
                    </p>
                  </div>
                </div>

                <div className="flex justify-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-300">
                    {existingScheduledSpaceRequest.status}
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-700 border border-blue-300">
                    {existingScheduledSpaceRequest.paymentStatus}
                  </Badge>
                </div>

                {existingScheduledSpaceRequest?.qrCodeImage && (
                  <div className="flex justify-center">
                    <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-4">
                      <img
                        src={existingScheduledSpaceRequest.qrCodeImage}
                        alt="Check-in QR code"
                        className="w-40 h-40"
                      />
                    </div>
                  </div>
                )}

                <div className="rounded-lg border p-3 space-y-1">
                  {(existingScheduledSpaceRequest?.selectedSlots || []).map(
                    (s: any, i: number) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs"
                      >
                        <span>
                          {s.spaceName} — {s.date} {s.startTime}-{s.endTime}
                        </span>
                        <span>{formatPrice(s.price)}</span>
                      </div>
                    ),
                  )}
                  <div className="flex justify-between text-sm font-semibold border-t pt-1 mt-1">
                    <span>Total Paid</span>
                    <span>
                      {formatPrice(
                        existingScheduledSpaceRequest?.paidAmount ||
                          existingScheduledSpaceRequest?.slotsTotal ||
                          0,
                      )}
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  disabled={downloadingScheduledSpaceTicket}
                  onClick={handleDownloadScheduledSpaceTicket}
                >
                  {downloadingScheduledSpaceTicket ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Downloading…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download Ticket
                    </>
                  )}
                </Button>
              </div>
            )}
            <div className="rounded-lg border p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Status History
              </p>
              <StatusTimeline
                history={existingScheduledSpaceRequest?.statusHistory}
              />
            </div>
            {["Completed", "Cancelled", "Rejected"].includes(
              existingScheduledSpaceRequest?.status,
            ) && (
              <Button
                className="w-full"
                onClick={startNewScheduledSpaceRequest}
              >
                <Plus className="h-4 w-4 mr-2" />
                Register a New Request
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowScheduledSpaceStatus(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scheduled Spaces — more than one request on record for this email:
          let the visitor pick which to view, or start a new one. Mirrors
          the Rent-a-Stall multi-request chooser. */}
      <Dialog
        open={showScheduledSpaceRequestListChoice}
        onOpenChange={setShowScheduledSpaceRequestListChoice}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Your Scheduled Space Requests</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {scheduledSpaceRequestList.map((req: any) => (
              <button
                key={req._id}
                type="button"
                className="w-full text-left rounded-lg border p-3 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                onClick={() => {
                  setShowScheduledSpaceRequestListChoice(false);
                  routeScheduledSpaceRequest(req);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {(req.selectedSlots || [])[0]?.spaceName ||
                      req.facilityTypeRequested ||
                      "Scheduled Space request"}
                  </span>
                  <Badge
                    className={`text-xs ${
                      {
                        Completed: "bg-emerald-100 text-emerald-700 border border-emerald-300",
                        Confirmed: "bg-blue-100 text-blue-700 border border-blue-300",
                        Processing: "bg-amber-100 text-amber-700 border border-amber-300",
                        Pending: "bg-amber-100 text-amber-700 border border-amber-300",
                        Rejected: "bg-red-100 text-red-700 border border-red-300",
                        Cancelled: "bg-red-100 text-red-700 border border-red-300",
                      }[req.status as string] ||
                      "bg-gray-100 text-gray-700 border border-gray-300"
                    }`}
                  >
                    {req.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Submitted{" "}
                  {req.createdAt
                    ? new Date(req.createdAt).toLocaleDateString()
                    : "—"}
                  {req.slotsTotal > 0 ? ` · ${formatPrice(req.slotsTotal)}` : ""}
                </p>
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={startNewScheduledSpaceRequest}
          >
            <Plus className="h-4 w-4 mr-2" />
            Register a New Request
          </Button>
        </DialogContent>
      </Dialog>

      {/* Scheduled Spaces — pick a space + time slot (only reachable once
          the registration is Confirmed). Card-list picker rather than a
          pixel-positioned canvas — a deliberate simplification since every
          space/slot is already listed with its name, price and availability;
          spatial layout isn't essential to make a booking decision here. */}
      <Dialog
        open={showScheduledSpacePicker}
        onOpenChange={setShowScheduledSpacePicker}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pick a Space & Time Slot</DialogTitle>
          </DialogHeader>
          <ScheduledSpaceStepper current={3} />
          {scheduledSpaceMatchedOperator && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              Referral code accepted — narrowed to{" "}
              {scheduledSpaceMatchedOperator.name}'s spaces (plus public ones).
            </p>
          )}
          {scheduledSpaceReferralInvalid && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              That referral code wasn't recognized — showing all spaces.
            </p>
          )}
          <div className="space-y-3">
            {filteredScheduledSpaces.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No spaces are available yet — check back later.
              </p>
            )}
            {filteredScheduledSpaces.map((space: any) => (
                <div key={space.positionId} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: space.color || "#3b82f6" }}
                    />
                    <div>
                      <span className="font-semibold text-sm block">
                        {space.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {space.facilityType}
                      </span>
                    </div>
                    <span className="ml-auto text-sm font-semibold">
                      {formatPrice(space.price || 0)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(space.slots || []).map((slot: any) => {
                      const isSelected = selectedScheduledSlots.some(
                        (s) =>
                          s.positionId === space.positionId &&
                          s.slotId === slot.id,
                      );
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={slot.isBooked}
                          onClick={() =>
                            toggleScheduledSlotSelection(space, slot)
                          }
                          className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                            slot.isBooked
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : isSelected
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white hover:border-blue-400"
                          }`}
                        >
                          {slot.date} · {slot.startTime}-{slot.endTime}
                          {slot.label ? ` (${slot.label})` : ""}
                          {slot.isBooked ? " — Booked" : ""}
                        </button>
                      );
                    })}
                    {(space.slots || []).length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No slots defined for this space yet.
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
          {selectedScheduledSlots.length > 0 && (
            <div className="border-t pt-3 mt-3 space-y-2">
              <p className="text-sm font-semibold">
                Selected ({selectedScheduledSlots.length})
              </p>
              {selectedScheduledSlots.map((s, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>
                    {s.spaceName} — {s.date} {s.startTime}-{s.endTime}
                  </span>
                  <span>{formatPrice(s.price)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold text-sm border-t pt-2">
                <span>Total</span>
                <span>
                  {formatPrice(
                    selectedScheduledSlots.reduce(
                      (sum, s) => sum + (s.price || 0),
                      0,
                    ),
                  )}
                </span>
              </div>
            </div>
          )}
          <Button
            className="w-full mt-3"
            onClick={handleScheduledSpaceSlotsSubmit}
            disabled={
              selectedScheduledSlots.length === 0 ||
              scheduledSpaceSlotsSubmitting
            }
          >
            {scheduledSpaceSlotsSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Confirming…
              </>
            ) : selectedScheduledSlots.length > 0 &&
              selectedScheduledSlots.reduce(
                (sum, s) => sum + (s.price || 0),
                0,
              ) === 0 ? (
              "Submit Booking (Free)"
            ) : (
              "Proceed to Payment"
            )}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Store className="h-6 w-6 text-blue-600" />
              <span>Sign in to Rent a Stall</span>
            </DialogTitle>
            <DialogDescription>
              Sign in with Google to continue with stall rental
            </DialogDescription>
          </DialogHeader>

          <StallStepper current={1} />

          <div className="space-y-4 py-4">
            {stallGoogleLoading ? (
              // GOOGLE SIGN-IN IN PROGRESS
              <div className="py-6 text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                <p className="text-sm text-muted-foreground">Looking you up…</p>
              </div>
            ) : (
              // GOOGLE SIGN-IN
              <>
                <Button
                  variant="outline"
                  onClick={handleGoogleStallLogin}
                  className="w-full"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Continue with Google
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  We use your email to find your saved vendor profile.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Linked-accounts picker: this email owns multiple vendor profiles. */}
      <Dialog open={showAccountChooser} onOpenChange={setShowAccountChooser}>
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-blue-600" />
              Choose a vendor profile
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium">{authedEmail}</span> has{" "}
              {linkedVendors.length} linked profiles. Pick the one you want to
              register with, or add a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
            {linkedVendors.map((v) => (
              <button
                key={v._id}
                type="button"
                onClick={() => continueWithVendor(v, authedEmail)}
                className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <p className="font-semibold text-sm text-gray-900">
                  {v.businessName || v.shopName || v.name || "Vendor"}
                </p>
                <p className="text-xs text-gray-500">
                  {v.name}
                  {v.whatsAppNumber ? ` · ${v.whatsAppNumber}` : ""}
                </p>
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => startRegisterNew(authedEmail)}
          >
            + Register a new profile
          </Button>
        </DialogContent>
      </Dialog>

      {/* Multiple requests for the same vendor + event: list them all (status +
          date) so the vendor can pick which to manage, or register another. */}
      <Dialog
        open={showRequestListChoice}
        onOpenChange={(open) => {
          setShowRequestListChoice(open);
          if (!open) setListRegisterStep(false);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-blue-600" />
              You have {requestList.length} requests for this event
            </DialogTitle>
            <DialogDescription>
              This vendor has more than one stall request for{" "}
              <span className="font-medium">{eventData?.title}</span>. Pick one
              to view or manage it, or register a new request.
            </DialogDescription>
          </DialogHeader>

          {!listRegisterStep ? (
            <div className="space-y-2 pt-1 max-h-[55vh] overflow-y-auto">
              {requestList.map((req: any) => (
                <button
                  key={req._id}
                  type="button"
                  onClick={() => selectRequestFromList(req)}
                  className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${requestStatusBadgeClass(
                        req.status,
                      )}`}
                    >
                      {req.status || "Pending"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {req.createdAt
                        ? new Date(req.createdAt).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {req.shopkeeperId?.businessName ||
                        req.businessName ||
                        req.shopkeeperId?.shopName ||
                        req.shopkeeperId?.name ||
                        "Stall request"}
                    </span>
                    {typeof req.grandTotal === "number" && (
                      <span className="text-sm font-semibold shrink-0">
                        {formatPrice(req.grandTotal)}
                      </span>
                    )}
                  </div>
                  {Array.isArray(req.selectedTables) &&
                    req.selectedTables.length > 0 && (
                      <div className="mt-0.5 text-xs text-gray-500">
                        {req.selectedTables.length}{" "}
                        {req.selectedTables.length === 1 ? "space" : "spaces"} ·{" "}
                        {req.selectedTables
                          .map((t: any) => t.tableName)
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    )}
                </button>
              ))}
              <Button
                variant="outline"
                className="w-full mt-1"
                onClick={() => setListRegisterStep(true)}
              >
                + Register a new request
              </Button>
            </div>
          ) : (
            // Register-new who-for step (same paths as the completed-choice one).
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium text-gray-700">
                Who is this new request for?
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowRequestListChoice(false);
                  startRegisterForSelf();
                }}
                className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <p className="font-semibold text-sm text-gray-900">
                  Register for yourself
                </p>
                <p className="text-xs text-gray-500">
                  Book again using this same vendor profile.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRequestListChoice(false);
                  startRegisterNew(authedEmail || shopkeeperDetails.email);
                }}
                className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <p className="font-semibold text-sm text-gray-900">
                  Register for a new vendor
                </p>
                <p className="text-xs text-gray-500">
                  Create a separate vendor account under{" "}
                  {authedEmail || shopkeeperDetails.email}.
                </p>
              </button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setListRegisterStep(false)}
              >
                Back
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Completed cycle: preview the existing booking, or register a new one. */}
      <Dialog
        open={showCompletedChoice}
        onOpenChange={(open) => {
          setShowCompletedChoice(open);
          if (!open) setShowRegisterTargetChoice(false);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-green-600" />
              You've already booked this event
            </DialogTitle>
            <DialogDescription>
              This profile has a completed, paid stall for{" "}
              <span className="font-medium">{eventData?.title}</span>. Preview
              it below, or register a new request for a different vendor.
            </DialogDescription>
          </DialogHeader>
          {existingStallRequest && (
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 text-sm space-y-1">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Vendor</span>
                <span className="font-medium text-right">
                  {existingStallRequest.shopkeeperId?.businessName ||
                    existingStallRequest.businessName ||
                    existingStallRequest.shopkeeperId?.name ||
                    "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Status</span>
                <span className="font-medium text-green-700">
                  Paid · Completed
                </span>
              </div>
              {typeof existingStallRequest.grandTotal === "number" && (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Total</span>
                  <span className="font-medium">
                    {formatPrice(existingStallRequest.grandTotal)}
                  </span>
                </div>
              )}
            </div>
          )}
          {!showRegisterTargetChoice ? (
            // Step 1 — edit this booking, or start a fresh request.
            <div className="space-y-2 pt-2">
              {/* Edit the existing booking: operators + add-ons only. Hidden
                  once the event has ended — no more edits/transactions. */}
              {!isEventOver(eventData) && (
                <Button
                  className="w-full"
                  style={{
                    backgroundColor: design?.primaryColor || "#2563eb",
                  }}
                  onClick={startEditRequest}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit request (operators &amp; add-ons)
                </Button>
              )}
              {/* Register a new request — under this or a different vendor. */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowRegisterTargetChoice(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Register a new request
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCompletedChoice(false)}
                >
                  Review Booking
                </Button>
                {/* Ask the organizer to cancel/delete this booking (frees the
                    space + refund handled by the organizer). Hidden if a
                    request is already pending. */}
                {existingStallRequest?.pendingCancellation?.status ===
                "requested" ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center text-xs text-amber-700 flex items-center justify-center">
                    Cancellation pending review
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => {
                      setCancelReason("");
                      setShowCancelDialog(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Booking
                  </Button>
                )}
              </div>
            </div>
          ) : (
            // Step 2 — who is this new request for? Reuse THIS profile, or
            // create a brand-new linked vendor account under the same email.
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium text-gray-700">
                Who is this new request for?
              </p>
              <button
                type="button"
                onClick={startRegisterForSelf}
                className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <p className="font-semibold text-sm text-gray-900">
                  Register for yourself
                </p>
                <p className="text-xs text-gray-500">
                  Book again using this same vendor profile.
                </p>
              </button>
              <button
                type="button"
                onClick={() =>
                  startRegisterNew(authedEmail || shopkeeperDetails.email)
                }
                className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <p className="font-semibold text-sm text-gray-900">
                  Register for a new vendor
                </p>
                <p className="text-xs text-gray-500">
                  Create a separate vendor account under{" "}
                  {authedEmail || shopkeeperDetails.email}. You'll be able to
                  pick between your accounts next time.
                </p>
              </button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowRegisterTargetChoice(false)}
              >
                Back
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* CANCEL / DELETE REQUEST — vendor gives a reason               */}
      {/* ============================================================ */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Cancel this stall booking
            </DialogTitle>
            <DialogDescription>
              Tell the organizer why you'd like to cancel. They'll review it,
              free up your space, and email you with any refund details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label className="text-sm">Reason for cancellation</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Can no longer attend, double-booked, change of plans…"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={cancelSubmitting}
            >
              Back
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRequestCancellation}
              disabled={cancelSubmitting || !cancelReason.trim()}
            >
              {cancelSubmitting ? "Sending…" : "Send cancellation request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* EDIT REQUEST — Step 1: adjust operator count                  */}
      {/* ============================================================ */}
      <Dialog
        open={showAmendOperators}
        onOpenChange={(o) => {
          setShowAmendOperators(o);
          if (!o) setAmendMode(false);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" />
              Edit your booking
            </DialogTitle>
            <DialogDescription>
              Update the number of operators, then continue to adjust your
              add-ons. Your booked spaces stay the same.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Number of operators</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setAmendOperators((n) => Math.max(1, n - 1))}
                disabled={amendOperators <= 1}
              >
                −
              </Button>
              <Input
                type="number"
                min={1}
                max={10}
                value={amendOperators}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setAmendOperators(
                    !Number.isFinite(n) ? 1 : Math.min(10, Math.max(1, n)),
                  );
                }}
                className="w-24 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setAmendOperators((n) => Math.min(10, n + 1))}
                disabled={amendOperators >= 10}
              >
                +
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Each operator gets one free entry. Changing this is free — it just
              re-issues your QR and updates your entry pass.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={resetAmend}>
              Cancel
            </Button>
            <Button
              onClick={proceedAmendToSelection}
              style={{ backgroundColor: design?.primaryColor || "#2563eb" }}
            >
              Continue to add-ons
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* EDIT REQUEST — pay the add-on difference                      */}
      {/* ============================================================ */}
      <Dialog
        open={showAmendPayment}
        onOpenChange={(o) => {
          if (!o) resetAmend();
          setShowAmendPayment(o);
        }}
      >
        <DialogContent
          className="max-w-lg w-full max-h-[92vh] overflow-hidden p-0 flex flex-col"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="shrink-0 border-b px-5 py-4">
            <DialogTitle>Pay the difference</DialogTitle>
            <DialogDescription>
              Your edited add-ons cost more than before. Pay the difference
              below, then submit your payment proof — the organizer will confirm
              and re-issue your QR with the updated add-ons.
            </DialogDescription>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            {showAmendPayment && (
              <StallPaymentPanel
                organizerId={
                  (eventData as any)?.organizer?._id ||
                  existingStallRequest?.organizerId?._id ||
                  existingStallRequest?.organizerId
                }
                amount={amendAmountDue}
                reference={existingStallRequest?._id}
                whatsAppNumber={
                  existingStallRequest?.shopkeeperId?.whatsappNumber ||
                  shopkeeperDetails?.whatsappNumber
                }
                transactionId={amendTxnId}
                onTransactionIdChange={setAmendTxnId}
                screenshot={amendScreenshot}
                onScreenshotChange={setAmendScreenshot}
              />
            )}
          </div>
          <div className="shrink-0 grid grid-cols-2 gap-2 border-t px-5 py-4">
            <Button
              variant="outline"
              onClick={resetAmend}
              disabled={amendSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitAmendPayment}
              disabled={amendSubmitting}
              style={{ backgroundColor: design?.primaryColor || "#2563eb" }}
            >
              {amendSubmitting
                ? "Submitting…"
                : "I've paid — Submit for verification"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post-payment feedback for the stall-edit difference payment. */}
      <PaymentFeedbackDialog
        open={showPaymentFeedback}
        onOpenChange={setShowPaymentFeedback}
        paymentType="stall_edit"
        organizerId={
          (eventData as any)?.organizer?._id ||
          existingStallRequest?.organizerId?._id ||
          existingStallRequest?.organizerId
        }
        eventId={
          existingStallRequest?.eventId?._id || existingStallRequest?.eventId
        }
        eventTitle={existingStallRequest?.eventId?.title || eventData?.title}
        payerName={
          existingStallRequest?.shopkeeperId?.name ||
          existingStallRequest?.nameOfApplicant
        }
        payerEmail={existingStallRequest?.shopkeeperId?.businessEmail}
        bookingId={existingStallRequest?._id}
        amount={feedbackAmount}
      />

      {/* ============================================================ */}
      {/* RULES & REGULATIONS GATE — shown after Google auth, before the  */}
      {/* stall-request form. Vendor must scroll to the bottom, then       */}
      {/* Accept, before the form opens. Age Restriction & Dress Code are  */}
      {/* intentionally excluded.                                          */}
      {/* ============================================================ */}
      <Dialog
        open={showStallTermsGate}
        onOpenChange={(o) => {
          if (!o) cancelStallGate();
        }}
      >
        <DialogContent
          className="max-w-2xl w-full max-h-[90vh] overflow-hidden p-0 flex flex-col"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="shrink-0 border-b px-5 sm:px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <FileText className="h-5 w-5 text-amber-600" />
              Rules &amp; Regulations
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Please read everything below. Scroll to the end to accept and
              continue to your stall request.
            </DialogDescription>
          </div>

          <div className="shrink-0 px-5 sm:px-6 pt-4">
            <StallStepper current={2} />
          </div>

          {(() => {
            const { terms, htmlSections } = getStallGateContent();
            const htmlCls =
              "text-gray-600 text-sm prose prose-sm max-w-none [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4";
            return (
              <div
                ref={stallGateScrollRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24)
                    setStallGateScrolledEnd(true);
                }}
                className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 space-y-5"
              >
                {/* Special Instructions, Refund Policy, Terms & Conditions and
                    every visible custom section — each rendered as heading +
                    rich text, in reading order. */}
                {htmlSections.map((s) => (
                  <div key={s.key} className="space-y-1.5">
                    <h3 className="text-sm font-bold text-gray-900">
                      {s.title}
                    </h3>
                    {(s.html || "").trim() && (
                      <div
                        className={htmlCls}
                        dangerouslySetInnerHTML={{ __html: s.html }}
                      />
                    )}
                  </div>
                ))}

                {/* Terms & Conditions for exhibitors */}
                {terms.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-gray-900">
                      Terms &amp; Conditions for Exhibitors
                    </h3>
                    <ol className="list-decimal ml-5 space-y-2">
                      {terms.map((term: any, idx: number) => (
                        <li
                          key={idx}
                          className="text-sm text-gray-700 leading-relaxed"
                        >
                          {term.termsAndConditionsforStalls}
                          {term.isMandatory && (
                            <span className="ml-2 inline-block text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded align-middle">
                              ✱ Mandatory
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="pt-2 text-center text-xs text-gray-400">
                  — End of rules &amp; regulations —
                </div>
              </div>
            );
          })()}

          <div className="shrink-0 border-t bg-gray-50 px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              {stallGateScrolledEnd ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  You&apos;ve read to the end.
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  Scroll to the bottom to enable Accept.
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={cancelStallGate}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!stallGateScrolledEnd}
                onClick={acceptStallGate}
                style={{
                  backgroundColor: stallGateScrolledEnd
                    ? design?.primaryColor || "#f97316"
                    : undefined,
                }}
                className="text-white"
              >
                Accept &amp; Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table Selection Dialog - NEW */}
      {/* ============================================================ */}
      {/* TABLE SELECTION DIALOG                                        */}
      {/* ============================================================ */}
      <Dialog open={showTableSelection} onOpenChange={setShowTableSelection}>
        <DialogContent
          className="max-w-7xl w-full max-h-[95vh] overflow-hidden p-0 flex flex-col"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {/* Fixed header — stays put; only the body below scrolls. */}
          <div className="shrink-0 z-10 bg-white border-b px-4 sm:px-6 py-3 sm:py-4">
            <DialogTitle className="text-lg sm:text-xl font-bold">
              Select Your Stall
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Choose your tables, add-ons, and accept the terms to proceed to
              payment.
            </DialogDescription>
            <p className="mt-1.5 text-xs sm:text-sm font-bold text-amber-700">
              ⚠️ Select Spaces & Add-Ons, Pay, upload proof &amp; tap &quot;I
              have Paid&quot; — else your space isn&apos;t reserved.
            </p>
          </div>

          {/* Scrollable body — the dialog frame + header stay fixed. */}
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0">
            {/* ── MAIN CONTENT AREA ── */}
            <div className="px-4 sm:px-6 py-4 space-y-6">
              <StallStepper current={4} />
              {/* Legend — each for-sale space type shows its own colour, then
                  the interaction states (Selected = blue, Booked / Reserved /
                  Not allowed = grey). */}
              <div className="flex flex-col gap-2 text-sm">
                {forSaleTemplateLegend.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Space types
                    </span>
                    {forSaleTemplateLegend.map((entry) => (
                      <div
                        key={`${entry.name}-${entry.color}`}
                        className="flex items-center gap-2"
                      >
                        <div
                          className="w-5 h-5 rounded border-2"
                          style={{
                            backgroundColor: entry.color + "80",
                            borderColor: entry.color,
                          }}
                        />
                        <span>{entry.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Status
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-blue-300 border-2 border-blue-600 rounded" />
                    <span>Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-gray-300 border-2 border-gray-500 rounded" />
                    <span>Booked / Reserved / Not allowed</span>
                  </div>
                </div>
              </div>

              {/* Layout Selector — only if multiple halls */}
              {venueConfig && publishedVenueCount > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {venueConfig.map((layout, index) =>
                    layout?.published === false ? null : (
                      <Button
                        key={layout.id}
                        size="sm"
                        onClick={() => setCurrentLayoutIndex(index)}
                        variant={
                          currentLayoutIndex === index ? "default" : "outline"
                        }
                        className={`shrink-0 whitespace-nowrap ${
                          currentLayoutIndex === index
                            ? "bg-blue-600 text-white"
                            : "border-gray-300"
                        }`}
                      >
                        <MapIcon className="h-4 w-4 mr-1" />
                        {layout.name}
                      </Button>
                    ),
                  )}
                </div>
              )}

              {/* ── VENUE LAYOUT — full width ── */}
              <Card>
                <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <TableIcon className="h-4 w-4 shrink-0 text-blue-600" />
                    <span>
                      Venue Layout{" "}
                      <span className="hidden sm:inline">
                        — Click a table to select it
                      </span>
                    </span>
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setVenueMaximized(true)}
                    className="w-full shrink-0 text-xs sm:w-auto"
                  >
                    ⛶ Maximize
                  </Button>
                </CardHeader>
                <CardContent className="p-2">
                  {loadingTables ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                    </div>
                  ) : (
                    <div
                      ref={venueContainerRef}
                      className="bg-[#f8fafc] rounded-lg border-2 border-gray-200 w-full overflow-auto"
                      style={{ height: "55vh" }}
                    >
                      {/* The venue map renders at natural size inside this
                          bounded box, so the LAYOUT itself gets the scrollbars
                          (horizontal + vertical) — the dialog stays fixed. */}
                      <div
                        className="relative mx-auto"
                        style={{
                          width: `${venueDisplayCanvas.width * dynamicScale}px`,
                          height: `${venueDisplayCanvas.height * dynamicScale}px`,
                        }}
                      >
                        <div
                          className="relative shadow-sm border border-gray-300 origin-top-left"
                          style={{
                            width: `${venueDisplayCanvas.width}px`,
                            height: `${venueDisplayCanvas.height}px`,
                            transform: `scale(${dynamicScale})`,
                            transformOrigin: "top left",
                            backgroundImage:
                              "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)",
                            backgroundSize: `${eventData?.venueConfig?.[currentLayoutIndex]?.gridSize || 40}px ${eventData?.venueConfig?.[currentLayoutIndex]?.gridSize || 40}px`,
                            backgroundColor: "#ffffff",
                          }}
                        >
                          {/* Main Stage */}
                          {eventData?.venueConfig?.[currentLayoutIndex]
                            ?.hasMainStage &&
                            (() => {
                              const vc: any =
                                eventData?.venueConfig?.[currentLayoutIndex];
                              const stageW = vc?.mainStageWidth ?? 200;
                              const stageH = vc?.mainStageHeight ?? 60;
                              const stageX =
                                vc?.mainStageX ??
                                (venueDisplayCanvas.width - stageW) / 2;
                              const stageY = vc?.mainStageY ?? 0;
                              return (
                                <div
                                  className="absolute bg-purple-200 border-2 border-purple-500 flex items-center justify-center font-bold text-purple-700 shadow-md uppercase"
                                  style={{
                                    left: stageX,
                                    top: stageY,
                                    width: stageW,
                                    height: stageH,
                                    borderRadius:
                                      vc?.mainStageShape === "semicircle"
                                        ? "0 0 50% 50% / 0 0 100% 100%"
                                        : vc?.mainStageShape === "circle"
                                          ? "50%"
                                          : undefined,
                                    zIndex: 10,
                                  }}
                                >
                                  {vc?.mainStageLabel || "Main Stage"}
                                </div>
                              );
                            })()}

                          {/* Tables */}
                          {(availableTables[currentLayoutId] || [])
                            .filter((table) => inCrop(table.x, table.y))
                            .map((table) => {
                              const isSelected = selectedTables.some(
                                (t) => t.positionId === table.positionId,
                              );
                              const isBooked = table.isBooked;
                              const preferredIds: string[] =
                                Array.isArray(
                                  existingStallRequest?.preferredTemplateIds,
                                ) &&
                                existingStallRequest.preferredTemplateIds.length
                                  ? existingStallRequest.preferredTemplateIds
                                  : existingStallRequest?.preferredTemplateId
                                    ? [existingStallRequest.preferredTemplateId]
                                    : [];
                              const isWrongTemplate =
                                preferredIds.length > 0 &&
                                !preferredIds.includes(table.id);
                              const isWrongCategory = !isCategoryAllowed(table);
                              const isNotForSale = table.forSale === false;
                              // In Edit-Request mode the vendor's OWN booked
                              // spaces stay blue but locked (can't be changed).
                              const isOwnBooked =
                                amendMode &&
                                ownBookedPositionIds.has(table.positionId);

                              // EventFront colour rule: available spaces show
                              // their own template colour; booked/disabled grey
                              // out; not-for-sale shows an amber hatch; the
                              // selected space keeps its colour + a blue ring.
                              // Falls back to the template palette colour when
                              // the placed space's own colour is missing.
                              const tpl =
                                (table as any).color ||
                                templateColorById[table.id] ||
                                templateColorById[(table as any).tableId] ||
                                (isNotForSale ? "#f59e0b" : "#22c55e");
                              let fillStyle: any = {
                                backgroundColor: tpl + "80",
                                borderColor: tpl,
                              };
                              let cursor =
                                "cursor-pointer hover:shadow-xl hover:ring-2 hover:ring-blue-400";

                              if (isOwnBooked) {
                                // Your booked space — solid blue, locked.
                                fillStyle = {
                                  backgroundColor: "#93c5fd",
                                  borderColor: "#2563eb",
                                };
                                cursor =
                                  "cursor-not-allowed ring-2 ring-blue-500";
                              } else if (isNotForSale) {
                                fillStyle = {
                                  backgroundColor: tpl + "59",
                                  borderColor: tpl,
                                  backgroundImage:
                                    "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 6px)",
                                };
                                cursor = "cursor-default opacity-80";
                              } else if (isBooked) {
                                // Sold — grey, not selectable.
                                fillStyle = {
                                  backgroundColor: "#9ca3af80",
                                  borderColor: "#6b7280",
                                };
                                cursor = "cursor-not-allowed";
                              } else if (isWrongTemplate || isWrongCategory) {
                                // Not allowed for this exhibitor — grey.
                                fillStyle = {
                                  backgroundColor: "#9ca3af66",
                                  borderColor: "#9ca3af",
                                };
                                cursor = "cursor-not-allowed opacity-90";
                              } else if (isSelected) {
                                // Selected — solid blue background (regardless
                                // of the space's own template colour).
                                fillStyle = {
                                  backgroundColor: "#93c5fd", // blue-300
                                  borderColor: "#2563eb", // blue-600
                                };
                                cursor =
                                  "cursor-pointer shadow-lg ring-2 ring-blue-500";
                              }

                              return (
                                <div
                                  key={table.positionId}
                                  className={`absolute border flex items-center justify-center transition-all group hover:!z-[999] ${cursor} ${
                                    table.type === "Round"
                                      ? "rounded-full"
                                      : table.type === "Corner"
                                        ? "rounded-lg"
                                        : "rounded-sm"
                                  }`}
                                  style={{
                                    left: `${table.x}px`,
                                    top: `${table.y}px`,
                                    width: `${(table as any).displayWidth ?? table.width}px`,
                                    height: `${(table as any).displayHeight ?? table.height}px`,
                                    transform: `rotate(${table.rotation || 0}deg)`,
                                    transformOrigin: "center center",
                                    zIndex: isSelected ? 10 : 5,
                                    ...fillStyle,
                                  }}
                                  onClick={() => {
                                    // Editing an existing request → spaces are
                                    // locked; only add-ons can change.
                                    if (amendMode) return;
                                    // Sold / not-allowed / not-for-sale stalls
                                    // are visible but not selectable.
                                    if (
                                      isBooked ||
                                      isWrongTemplate ||
                                      isWrongCategory ||
                                      isNotForSale
                                    )
                                      return;
                                    handleTableClick(table);
                                  }}
                                >
                                  {/* Label */}
                                  <div
                                    className="text-center w-full h-full flex flex-col items-center justify-center overflow-hidden p-0.5"
                                    style={{
                                      transform: `rotate(-${table.rotation || 0}deg)`,
                                    }}
                                  >
                                    <span
                                      className={`font-bold text-[8px] leading-none truncate w-full text-center ${
                                        isSelected
                                          ? "text-blue-900"
                                          : "text-gray-900"
                                      }`}
                                    >
                                      {table.name}
                                    </span>
                                  </div>

                                  {/* Tooltip — each row is its own horizontal line above the space */}
                                  <div
                                    className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                                    style={{
                                      transform: `rotate(-${table.rotation || 0}deg) translateX(-50%)`,
                                      left: "50%",
                                    }}
                                  >
                                    <div className="rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-xl border border-gray-700 flex flex-col gap-0.5">
                                      {isBooked ? (
                                        // Sold — status only, no name / price / size.
                                        <div className="text-red-400 font-bold whitespace-nowrap">
                                          Sold
                                        </div>
                                      ) : isWrongTemplate ||
                                        isWrongCategory ||
                                        isNotForSale ? (
                                        // Reserved / not available to this
                                        // exhibitor — status only, no details.
                                        <div className="text-amber-300 font-bold whitespace-nowrap">
                                          Reserved
                                        </div>
                                      ) : (
                                        <>
                                          <div className="font-bold text-sm whitespace-nowrap">
                                            {table.name}
                                          </div>
                                          <div className="text-gray-300 whitespace-nowrap">
                                            {table.type} · Row {table.rowNumber}
                                          </div>
                                          <div className="text-gray-300 whitespace-nowrap">
                                            {table.width * 10}×
                                            {table.height * 10}
                                            cm
                                          </div>
                                          {isSelected ? (
                                            <div className="text-blue-400 font-bold whitespace-nowrap">
                                              ✓ Selected
                                            </div>
                                          ) : (
                                            (() => {
                                              const p =
                                                resolveTablePricing(table);
                                              return p.memberSaved > 0 ? (
                                                <>
                                                  <div className="text-emerald-400 font-semibold whitespace-nowrap">
                                                    Member{" "}
                                                    {formatPrice(p.tablePrice)}
                                                  </div>
                                                  <div className="text-gray-500 line-through whitespace-nowrap text-[10px]">
                                                    {formatPrice(
                                                      table.tablePrice,
                                                    )}
                                                  </div>
                                                </>
                                              ) : (
                                                <div className="text-green-400 font-semibold whitespace-nowrap">
                                                  {formatPrice(p.tablePrice)}
                                                </div>
                                              );
                                            })()
                                          )}
                                        </>
                                      )}
                                    </div>
                                    <div className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-900 border-b border-r border-gray-700" />
                                  </div>
                                </div>
                              );
                            })}
                          {/* Entrance / exit door markers */}
                          {renderDoors()}
                          {/* Cinema/concert seats */}
                          {renderSeats()}
                          {/* Scheduled Space facilities (courts/grounds/tables) */}
                          {renderScheduledSpaces()}
                          {layoutAnnotations.length > 0 && (
                            <VenueAnnotationLayer
                              readOnly
                              width={venueDisplayCanvas.width}
                              height={venueDisplayCanvas.height}
                              scale={1}
                              zIndex={4}
                              annotations={layoutAnnotations}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── ADD-ONS — full width below venue ── */}
              {eventData?.addOnItems && eventData.addOnItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Package className="h-4 w-4 text-blue-600" />
                      Add-Ons
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      Add any extras for your stall — pick several and set the
                      quantity of each in the summary.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {eventData.addOnItems.map((addon: any) => {
                        const isAddonSelected = selectedAddOns.some(
                          (a) => a.id === addon.id,
                        );
                        return (
                          <div
                            key={addon.id}
                            onClick={() => handleAddOnSelect(addon)}
                            className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              isAddonSelected
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                            }`}
                          >
                            {addon.image ? (
                              <img
                                src={`${apiURL}${addon.image}`}
                                alt={addon.name}
                                className="h-14 w-14 flex-shrink-0 rounded-md object-cover border"
                              />
                            ) : (
                              <div className="h-14 w-14 flex-shrink-0 rounded-md bg-gray-100 border flex items-center justify-center">
                                <Package className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-900 truncate">
                                {addon.name}
                              </p>
                              {addon.description && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                  {addon.description}
                                </p>
                              )}
                              <p className="text-sm font-bold text-blue-600 mt-1">
                                {formatPrice(addon.price)}
                              </p>
                            </div>
                            <div
                              className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                                isAddonSelected
                                  ? "bg-blue-600 border-blue-600"
                                  : "border-gray-300"
                              }`}
                            >
                              {isAddonSelected && (
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── RULES & REGULATIONS — shown below the Add-Ons selection so
                  vendors read and accept the fine print after choosing their
                  stall and extras, right before proceeding to payment. ── */}
              {eventData?.termsAndConditionsforStalls &&
                eventData.termsAndConditionsforStalls.length > 0 && (
                  <Card className="border-amber-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4 text-amber-600" />
                        Rules & Regulations for Exhibitors
                      </CardTitle>
                      <p className="text-sm text-gray-500">
                        Please read and accept all terms before proceeding to
                        payment.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {eventData.termsAndConditionsforStalls.map(
                        (term: any, idx: number) => (
                          <div
                            key={idx}
                            className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                              stallTermsChecked[idx]
                                ? "border-green-400 bg-green-50"
                                : term.isMandatory
                                  ? "border-red-200 bg-red-50"
                                  : "border-gray-200 bg-gray-50"
                            }`}
                            onClick={() =>
                              setStallTermsChecked((prev) => ({
                                ...prev,
                                [idx]: !prev[idx],
                              }))
                            }
                          >
                            <div
                              className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                                stallTermsChecked[idx]
                                  ? "bg-green-600 border-green-600"
                                  : "border-gray-400 bg-white"
                              }`}
                            >
                              {stallTermsChecked[idx] && (
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-800 leading-relaxed">
                                {term.termsAndConditionsforStalls}
                              </p>
                              {term.isMandatory && (
                                <span className="mt-1 inline-block text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                  ✱ Mandatory
                                </span>
                              )}
                            </div>
                          </div>
                        ),
                      )}
                      {!allMandatoryTermsAccepted() && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Accept all mandatory terms to enable payment.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
            </div>

            {/* ── BOTTOM SUMMARY ROW ── */}
            <div className="w-full border-t bg-gray-50 px-6 py-5">
              {/* Member banner — surfaces the active membership and how
                  much the exhibitor's saved across selected spaces. */}
              {isMember && (
                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2 text-sm">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    <span>
                      <strong>{activeMembership?.planName || "Member"}</strong>{" "}
                      pricing applied
                    </span>
                    {activeMembership?.endDate && (
                      <span className="text-xs text-emerald-700/80">
                        · valid till{" "}
                        {new Date(
                          activeMembership.endDate,
                        ).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const saved = selectedTables.reduce(
                      (acc, t: any) => acc + (t.memberSaved || 0),
                      0,
                    );
                    return saved > 0 ? (
                      <div className="text-xs font-semibold text-emerald-700">
                        You're saving {formatPrice(saved)}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {/* Selected Tables */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">
                      Selected Tables ({selectedTables.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedTables.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">
                        Click a table on the layout to select it
                      </p>
                    ) : (
                      selectedTables.map((table) => (
                        <div
                          key={table.positionId}
                          className="flex justify-between items-start p-2 bg-white rounded border text-xs"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">
                              {table.name}
                            </p>
                            <p className="text-gray-500">
                              {table.rowNumber
                                ? `Row ${table.rowNumber} • `
                                : ""}
                              {table.tableType}
                            </p>
                            {Number.isFinite(table.width) &&
                              Number.isFinite(table.height) && (
                                <p className="text-gray-400">
                                  {table.width * 10}cm × {table.height * 10}cm
                                </p>
                              )}
                          </div>
                          <div className="text-right">
                            {table.appliedTier === "member" &&
                            table.memberSaved > 0 ? (
                              <>
                                <p className="font-bold text-emerald-700">
                                  {formatPrice(table.tablePrice)}
                                </p>
                                <p className="text-[10px] text-gray-400 line-through leading-none">
                                  {formatPrice(table.regularPrice)}
                                </p>
                                <span className="inline-block mt-0.5 rounded bg-emerald-100 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                                  Member
                                </span>
                              </>
                            ) : (
                              <p className="font-bold text-gray-900">
                                {formatPrice(table.tablePrice)}
                              </p>
                            )}
                            <p className="text-gray-500 mt-0.5">
                              Dep: {formatPrice(table.depositPrice)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Selected Add-ons */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">
                      Selected Add-ons ({selectedAddOns.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 max-h-48 overflow-y-auto">
                    {selectedAddOns.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">
                        No add-ons selected
                      </p>
                    ) : (
                      selectedAddOns.map((addon) => (
                        <div
                          key={addon.id}
                          className="flex items-center gap-2 text-xs py-1.5 border-b last:border-0"
                        >
                          <span className="text-gray-700 truncate flex-1">
                            {addon.name}
                          </span>
                          {/* Quantity stepper — pick more than one of each */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRemoveAddOn(addon.id)}
                              aria-label={`Decrease ${addon.name}`}
                              className="h-6 w-6 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                            >
                              −
                            </button>
                            <span className="w-5 text-center font-semibold text-gray-800">
                              {addon.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleIncreaseQuantity(addon.id)}
                              aria-label={`Increase ${addon.name}`}
                              className="h-6 w-6 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                            >
                              +
                            </button>
                          </div>
                          <span className="font-semibold text-blue-600 flex-shrink-0 w-16 text-right">
                            {formatPrice(addon.price * addon.quantity)}
                          </span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Price Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">
                      Price Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Table Price</span>
                      <span className="font-semibold">
                        {formatPrice(calculateTotals().tablesTotal.tablePrice)}
                      </span>
                    </div>
                    {showMinimumPayment && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Booking Amount</span>
                        <span className="font-semibold">
                          {formatPrice(
                            calculateTotals().tablesTotal.bookingPrice,
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Deposit</span>
                      <span className="font-semibold">
                        {formatPrice(
                          calculateTotals().tablesTotal.depositPrice,
                        )}
                      </span>
                    </div>
                    {calculateTotals().addOnsTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Add-ons</span>
                        <span className="font-semibold">
                          {formatPrice(calculateTotals().addOnsTotal)}
                        </span>
                      </div>
                    )}
                    <Separator />

                    {/* Event Countdown */}
                    {daysUntilEvent !== null && (
                      <div
                        className={`flex items-center gap-2 p-2 rounded border text-xs font-medium ${
                          daysUntilEvent <= 60
                            ? "bg-orange-50 border-orange-300 text-orange-800"
                            : "bg-blue-50 border-blue-200 text-blue-800"
                        }`}
                      >
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                        {daysUntilEvent <= 0
                          ? "Event has started!"
                          : `Event starts in ${daysUntilEvent} day${daysUntilEvent === 1 ? "" : "s"}`}
                      </div>
                    )}

                    {/* Minimum Payment — only shown when available. When it is
                        not (space disabled it or the event is <60 days away)
                        nothing is shown here; only Full Payment remains. */}
                    {showMinimumPayment && (
                      <div className="bg-green-50 p-2 rounded border border-green-200">
                        <p className="text-[10px] font-semibold text-green-800">
                          Option 1: Minimum Payment
                        </p>
                        <p className="text-base font-bold text-green-900">
                          {formatPrice(calculateTotals().minimumPayment)}
                        </p>
                        <p className="text-[10px] text-green-600">
                          {calculateTotals().depositInOption1Total > 0
                            ? "Booking + Deposit"
                            : "Booking only"}
                        </p>
                        <p className="text-[10px] text-green-500 mt-0.5">
                          Remaining:{" "}
                          {formatPrice(calculateTotals().remainingAfterBooking)}
                        </p>
                      </div>
                    )}

                    {/* Full Payment — always visible */}
                    <div className="bg-purple-50 p-2 rounded border border-purple-200">
                      <p className="text-[10px] font-semibold text-purple-800">
                        {showMinimumPayment
                          ? "Option 2: Full Payment"
                          : "Full Payment"}
                      </p>
                      <p className="text-base font-bold text-purple-900">
                        {formatPrice(calculateTotals().fullPayment)}
                      </p>
                      <p className="text-[10px] text-purple-600">
                        Deposit + Full Table Price + Add-ons
                      </p>

                      {/* <p className="text-[10px] text-green-500 mt-0.5">
                        Remaining:{" "}
                        {formatPrice(calculateTotals().remainingAfterBooking)}
                      </p> */}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* In an edit, show the extra owed for the changed add-ons. */}
              {amendMode && (
                <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                  <span className="text-sm text-gray-600">
                    Additional to pay for edited add-ons:{" "}
                  </span>
                  <span className="text-lg font-bold text-blue-700">
                    {formatPrice(amendExtra)}
                  </span>
                  {amendExtra === 0 && (
                    <p className="text-xs text-gray-500">
                      No extra charge — awaits organizer confirmation.
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                {amendMode ? (
                  <Button
                    onClick={handleAmendmentSubmit}
                    disabled={amendSubmitting}
                    className="w-full sm:w-auto sm:px-10"
                    size="lg"
                    style={{
                      backgroundColor: design?.primaryColor || "#2563eb",
                    }}
                  >
                    {amendSubmitting
                      ? "Submitting…"
                      : amendExtra > 0
                        ? "Submit & pay difference"
                        : "Submit changes"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleTableSelectionSubmit}
                    disabled={
                      loading ||
                      selectedTables.length === 0 ||
                      !allMandatoryTermsAccepted()
                    }
                    className="w-full sm:w-auto sm:px-10"
                    size="lg"
                  >
                    {loading ? "Processing..." : "Proceed to Payment"}
                  </Button>
                )}
                <Button
                  onClick={() =>
                    amendMode ? resetAmend() : setShowTableSelection(false)
                  }
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={loading || amendSubmitting}
                >
                  Cancel
                </Button>
                {!amendMode && !allMandatoryTermsAccepted() && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Accept all mandatory terms first
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* MAXIMIZED VENUE DIALOG                                        */}
      {/* ============================================================ */}
      <Dialog open={venueMaximized} onOpenChange={setVenueMaximized}>
        <DialogContent className="max-w-[98vw] w-full max-h-[98vh] p-0 overflow-hidden">
          {/* Header — sticky so the "back" button is always reachable,
              including on mobile where the layout scrolls. */}
          <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-4 py-3 border-b bg-white">
            <DialogTitle className="text-sm sm:text-base font-bold truncate">
              Venue Layout — {venueConfig?.[currentLayoutIndex]?.name}
            </DialogTitle>
            <Button
              size="sm"
              onClick={() => setVenueMaximized(false)}
              className="shrink-0 gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Back to normal view
            </Button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 px-4 pt-3 pb-1">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded" />
              Available
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 bg-blue-300 border-2 border-blue-600 rounded" />
              Selected
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 bg-gray-300 border-2 border-gray-500 rounded" />
              Booked
            </div>
          </div>

          {/* Scrollable canvas — wraps a scaled inner box so the whole
              layout fits the dialog viewport regardless of how far the
              spaces stretch beyond the venue rectangle. */}
          <div
            ref={maximizedContainerRef}
            className="overflow-auto w-full p-4 flex items-start justify-center"
            style={{ height: "calc(98vh - 110px)" }}
          >
            <div
              style={{
                width: venueDisplayCanvas.width * maximizedScale,
                height: venueDisplayCanvas.height * maximizedScale,
              }}
            >
              <div
                className="relative shadow border border-gray-300 origin-top-left"
                style={{
                  // Use the expanded canvas dims so spaces placed past the
                  // venue rectangle stay visible in the maximized view.
                  width: `${venueDisplayCanvas.width}px`,
                  height: `${venueDisplayCanvas.height}px`,
                  transform: `scale(${maximizedScale})`,
                  transformOrigin: "top left",
                  backgroundImage:
                    "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)",
                  backgroundSize: `${eventData?.venueConfig?.[currentLayoutIndex]?.gridSize || 40}px ${eventData?.venueConfig?.[currentLayoutIndex]?.gridSize || 40}px`,
                  backgroundColor: "#ffffff",
                }}
              >
                {/* Main Stage */}
                {eventData?.venueConfig?.[currentLayoutIndex]?.hasMainStage &&
                  (() => {
                    const vc: any =
                      eventData?.venueConfig?.[currentLayoutIndex];
                    const stageW = vc?.mainStageWidth ?? 200;
                    const stageH = vc?.mainStageHeight ?? 60;
                    const stageX =
                      vc?.mainStageX ??
                      (venueDisplayCanvas.width - stageW) / 2;
                    const stageY = vc?.mainStageY ?? 0;
                    return (
                      <div
                        className="absolute bg-purple-200 border-2 border-purple-500 flex items-center justify-center font-bold text-purple-700 uppercase"
                        style={{
                          left: stageX,
                          top: stageY,
                          width: stageW,
                          height: stageH,
                          borderRadius:
                            vc?.mainStageShape === "semicircle"
                              ? "0 0 50% 50% / 0 0 100% 100%"
                              : vc?.mainStageShape === "circle"
                                ? "50%"
                                : undefined,
                          zIndex: 10,
                        }}
                      >
                        {vc?.mainStageLabel || "Main Stage"}
                      </div>
                    );
                  })()}

                {/* Tables */}
                {(availableTables[currentLayoutId] || [])
                  .filter((table) => inCrop(table.x, table.y))
                  .map((table) => {
                    const isSelected = selectedTables.some(
                      (t) => t.positionId === table.positionId,
                    );
                    const isBooked = table.isBooked;
                    const preferredIds: string[] =
                      Array.isArray(
                        existingStallRequest?.preferredTemplateIds,
                      ) && existingStallRequest.preferredTemplateIds.length
                        ? existingStallRequest.preferredTemplateIds
                        : existingStallRequest?.preferredTemplateId
                          ? [existingStallRequest.preferredTemplateId]
                          : [];
                    const isWrongTemplate =
                      preferredIds.length > 0 &&
                      !preferredIds.includes(table.id);
                    const isWrongCategory = !isCategoryAllowed(table);
                    const isNotForSale = table.forSale === false;

                    // Identical colour rule to the inline view so the layout looks
                    // the same maximised: available spaces use their template
                    // colour; booked/disabled grey out; not-for-sale hatches;
                    // selected turns solid blue. Same template-palette fallback as
                    // the inline view so a missing space colour never reads green.
                    const tpl =
                      (table as any).color ||
                      templateColorById[table.id] ||
                      templateColorById[(table as any).tableId] ||
                      (isNotForSale ? "#f59e0b" : "#22c55e");
                    let fillStyle: any = {
                      backgroundColor: tpl + "80",
                      borderColor: tpl,
                    };
                    let cursor =
                      "cursor-pointer hover:shadow-xl hover:ring-2 hover:ring-blue-400";

                    if (isNotForSale) {
                      fillStyle = {
                        backgroundColor: tpl + "59",
                        borderColor: tpl,
                        backgroundImage:
                          "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 6px)",
                      };
                      cursor = "cursor-default opacity-80";
                    } else if (isBooked) {
                      fillStyle = {
                        backgroundColor: "#9ca3af80",
                        borderColor: "#6b7280",
                      };
                      cursor = "cursor-not-allowed";
                    } else if (isWrongTemplate || isWrongCategory) {
                      fillStyle = {
                        backgroundColor: "#9ca3af66",
                        borderColor: "#9ca3af",
                      };
                      cursor = "cursor-not-allowed opacity-90";
                    } else if (isSelected) {
                      fillStyle = {
                        backgroundColor: "#93c5fd",
                        borderColor: "#2563eb",
                      };
                      cursor = "cursor-pointer shadow-lg ring-2 ring-blue-500";
                    }

                    return (
                      <div
                        key={table.positionId}
                        className={`absolute border flex items-center justify-center transition-all group hover:!z-[999] ${cursor} ${
                          table.type === "Round"
                            ? "rounded-full"
                            : table.type === "Corner"
                              ? "rounded-lg"
                              : "rounded-sm"
                        }`}
                        style={{
                          left: table.x,
                          top: table.y,
                          width: (table as any).displayWidth ?? table.width,
                          height: (table as any).displayHeight ?? table.height,
                          transform: `rotate(${table.rotation || 0}deg)`,
                          zIndex: isSelected ? 10 : 5,
                          ...fillStyle,
                        }}
                        onClick={() => {
                          if (
                            isBooked ||
                            isWrongTemplate ||
                            isWrongCategory ||
                            isNotForSale
                          )
                            return;
                          handleTableClick(table);
                        }}
                      >
                        <span className="text-[9px] font-bold text-center leading-none px-1 truncate">
                          {table.name}
                        </span>

                        {/* Tooltip — each row is its own horizontal line above the space */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="relative">
                            <div className="rounded bg-gray-900 px-3 py-2 text-[10px] text-white shadow border border-gray-700 flex flex-col gap-0.5">
                              {isBooked ? (
                                <div className="text-red-400 font-bold whitespace-nowrap">
                                  Sold
                                </div>
                              ) : isWrongTemplate ||
                                isWrongCategory ||
                                isNotForSale ? (
                                <div className="text-amber-300 font-bold whitespace-nowrap">
                                  Reserved
                                </div>
                              ) : (
                                <>
                                  <div className="font-bold whitespace-nowrap">
                                    {table.name}
                                  </div>
                                  <div className="text-gray-300 whitespace-nowrap">
                                    Row {table.rowNumber}
                                  </div>
                                  <div className="text-gray-300 whitespace-nowrap">
                                    {table.width * 10}×{table.height * 10}cm
                                  </div>
                                  <div
                                    className={`whitespace-nowrap ${
                                      isSelected
                                        ? "text-blue-400"
                                        : "text-green-400"
                                    }`}
                                  >
                                    {isSelected
                                      ? "✓ Selected"
                                      : (() => {
                                          const p = resolveTablePricing(table);
                                          return p.memberSaved > 0
                                            ? `Member ${formatPrice(p.tablePrice)}`
                                            : formatPrice(p.tablePrice);
                                        })()}
                                  </div>
                                </>
                              )}
                            </div>
                            {/* Arrow tail — points down at the hovered space */}
                            <div className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-900 border-b border-r border-gray-700" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {/* Entrance / exit door markers */}
                {renderDoors()}
                {/* Cinema/concert seats */}
                {renderSeats()}
                {/* Scheduled Space facilities (courts/grounds/tables) */}
                {renderScheduledSpaces()}
                {layoutAnnotations.length > 0 && (
                  <VenueAnnotationLayer
                    readOnly
                    width={venueDisplayCanvas.width}
                    height={venueDisplayCanvas.height}
                    scale={1}
                    zIndex={4}
                    annotations={layoutAnnotations}
                  />
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stall Request Status Display - NEW */}
      {existingStallRequest && !showRentForm && !showTableSelection && (
        <Dialog
          open={!!existingStallRequest}
          onOpenChange={(open) => {
            if (!open) {
              // This allows the user to click the "X" or outside the modal to close it
              setExistingStallRequest(null);
              // OR if you have a toggle:
              // setShowStatusModal(false);
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                Stall Request Status
              </DialogTitle>
              <DialogDescription>
                Complete information about your stall booking request
              </DialogDescription>
            </DialogHeader>

            {existingStallRequest &&
              existingStallRequest.status !== "Cancelled" &&
              (() => {
                const s = existingStallRequest.status;
                const paid = !!(
                  existingStallRequest.transactionId ||
                  existingStallRequest.transactionScreenshot
                );
                // Request submitted, awaiting the organizer's approval.
                if (s === "Pending")
                  return (
                    <StallStepper
                      current={4}
                      pending
                      note="Waiting for organizer approval"
                    />
                  );
                // Transaction cycle complete — booking confirmed & paid.
                if (s === "Completed" || s === "Returned")
                  return <StallStepper current={6} />;
                // Paid, awaiting the organizer's payment verification.
                if (s === "Processing" && paid)
                  return (
                    <StallStepper
                      current={5}
                      pending
                      note="Waiting for payment approval"
                    />
                  );
                // Confirmed / Approved / Processing (payment still pending).
                return <StallStepper current={4} />;
              })()}

            {existingStallRequest && (
              <div className="space-y-6">
                {/* Status Header Section */}
                <div className="flex items-center space-x-4 p-2">
                  {existingStallRequest.status === "Pending" && (
                    <Clock className="h-10 w-10 text-yellow-500" />
                  )}
                  {existingStallRequest.status === "Confirmed" && (
                    <CheckCircle className="h-10 w-10 text-green-500" />
                  )}
                  {existingStallRequest.status === "Approved" && (
                    <CheckCircle className="h-10 w-10 text-green-500" />
                  )}
                  {existingStallRequest.status === "Cancelled" && (
                    <XCircle className="h-10 w-10 text-red-500" />
                  )}
                  {existingStallRequest.status === "Processing" && (
                    <AlertCircle className="h-10 w-10 text-blue-500" />
                  )}
                  {existingStallRequest.status === "Completed" && (
                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                  )}

                  <div>
                    <p className="font-bold text-xl leading-tight">
                      {existingStallRequest.status}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {existingStallRequest.status === "Pending" &&
                        "Your stall request is pending organizer approval"}
                      {existingStallRequest.status === "Confirmed" &&
                        "Your request is confirmed! Please select your tables."}
                      {existingStallRequest.status === "Approved" &&
                        "Your request is approved! Please select your tables."}
                      {existingStallRequest.status === "Cancelled" &&
                        "Your request was cancelled"}
                      {existingStallRequest.status === "Processing" &&
                        (existingStallRequest.transactionId ||
                        existingStallRequest.transactionScreenshot
                          ? "Payment submitted. Waiting for the organizer to verify it."
                          : "Your tables are selected. Please complete payment.")}
                      {existingStallRequest.status === "Completed" &&
                        "Your stall booking is complete!"}
                    </p>
                  </div>
                </div>

                {/* Dynamic Content Based on Status */}
                <div className="space-y-4">
                  {(existingStallRequest.status === "Confirmed" ||
                    existingStallRequest.status === "Approved") && (
                    <Button
                      onClick={() => {
                        setShowTableSelection(true);
                        fetchAvailableTables();
                      }}
                      className="w-full py-6 text-lg font-semibold"
                    >
                      Select Tables & Add-ons
                    </Button>
                  )}

                  {existingStallRequest.status === "Processing" && (
                    <div className="space-y-4">
                      <div className="bg-slate-50 border rounded-xl p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Selected Tables:
                          </span>
                          <span className="font-bold">
                            {existingStallRequest.selectedTables.length}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-gray-600">Grand Total:</span>
                          <span className="text-xl font-bold text-green-600">
                            {formatPrice(existingStallRequest.grandTotal)}
                          </span>
                        </div>
                      </div>

                      {/* Once the vendor has submitted payment (transaction id
                          or screenshot), it's awaiting the organizer's
                          verification — hide "Proceed to Payment" and show a
                          waiting notice. Only when payment is genuinely still
                          pending do we offer to pay. */}
                      {existingStallRequest.transactionId ||
                      existingStallRequest.transactionScreenshot ? (
                        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                          <Clock className="h-4 w-4 flex-shrink-0" />
                          Payment submitted — waiting for organizer approval.
                        </div>
                      ) : (
                        <Button
                          onClick={() => {
                            setShowTableSelection(true);
                            fetchAvailableTables();
                          }}
                          className="w-full py-4 bg-blue-600 hover:bg-blue-700"
                        >
                          Proceed to Payment
                        </Button>
                      )}
                    </div>
                  )}

                  {(existingStallRequest.status === "Completed" ||
                    existingStallRequest.status === "Returned") &&
                    (() => {
                      const stallRequest = existingStallRequest;
                      return (
                        <div className="space-y-6">
                          {/* Status and Payment */}
                          <div className="grid grid-cols-2 gap-4">
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm">
                                  Request Status
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                {getStatusBadge(stallRequest.status)}
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm">
                                  Payment Status
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                {getPaymentBadge(stallRequest.paymentStatus)}
                              </CardContent>
                            </Card>
                          </div>

                          {/* Shopkeeper Info */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">
                                Shopkeeper Information
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                              {stallRequest.companyLogo && (
                                <div className="col-span-2 mb-2 flex items-center gap-4">
                                  <img
                                    src={`${__API_URL__}${stallRequest.companyLogo}`}
                                    alt="Company Logo"
                                    className="w-16 h-16 rounded-md object-contain border bg-gray-50"
                                  />
                                  <div>
                                    <p className="font-bold text-lg">
                                      {stallRequest.brandName}
                                    </p>
                                  </div>
                                </div>
                              )}
                              <div>
                                <Label className="text-muted-foreground">
                                  Owner Name
                                </Label>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">
                                    {stallRequest.shopkeeperId?.name ||
                                      stallRequest.nameOfApplicant ||
                                      "—"}
                                  </p>
                                  {stallRequest.shopkeeperId
                                    ?.hasDocVerification && (
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] h-5"
                                    >
                                      Verified
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">
                                  Business Name
                                </Label>
                                <p className="font-medium">
                                  {stallRequest.shopkeeperId?.shopName ||
                                    stallRequest.brandName ||
                                    "—"}
                                </p>
                              </div>
                              {stallRequest.shopkeeperId?.email && (
                                <div>
                                  <Label className="text-muted-foreground">
                                    Primary Email
                                  </Label>
                                  <p className="font-medium">
                                    <a
                                      href={`mailto:${stallRequest.shopkeeperId?.email}`}
                                      className="text-blue-600 hover:underline block truncate"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {stallRequest.shopkeeperId?.email}
                                    </a>
                                  </p>
                                </div>
                              )}
                              {stallRequest.shopkeeperId?.businessEmail && (
                                <div>
                                  <Label className="text-muted-foreground">
                                    Business Email
                                  </Label>
                                  <p className="font-medium">
                                    <a
                                      href={`mailto:${stallRequest.shopkeeperId?.businessEmail}`}
                                      className="text-blue-600 hover:underline block truncate"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {stallRequest.shopkeeperId?.businessEmail}
                                    </a>
                                  </p>
                                </div>
                              )}
                              {(stallRequest.shopkeeperId?.whatsappNumber ||
                                stallRequest.shopkeeperId?.whatsAppNumber) && (
                                <div>
                                  <Label className="text-muted-foreground">
                                    WhatsApp
                                  </Label>
                                  <p className="font-medium">
                                    <a
                                      href={`https://wa.me/${(stallRequest.shopkeeperId?.whatsappNumber || stallRequest.shopkeeperId?.whatsAppNumber || "").replace(/\+/g, "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-green-600 hover:underline"
                                    >
                                      {stallRequest.shopkeeperId
                                        ?.whatsappNumber ||
                                        stallRequest.shopkeeperId
                                          ?.whatsAppNumber}
                                    </a>
                                  </p>
                                </div>
                              )}
                              <div>
                                <Label className="text-muted-foreground">
                                  Country
                                </Label>
                                <p className="font-medium">
                                  {stallRequest.shopkeeperId?.country === "IN"
                                    ? "India"
                                    : stallRequest.shopkeeperId?.country ===
                                        "SG"
                                      ? "Singapore"
                                      : stallRequest.shopkeeperId?.country ||
                                        "—"}
                                </p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">
                                  Instagram
                                </Label>
                                <p className="font-medium">
                                  {stallRequest.shopkeeperId
                                    ?.instagramHandle ? (
                                    <a
                                      href={
                                        stallRequest.shopkeeperId
                                          ?.instagramHandle
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-pink-600 hover:underline truncate block"
                                    >
                                      @
                                      {stallRequest.shopkeeperId?.instagramHandle
                                        .split("/")
                                        .pop()}
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground italic text-sm">
                                      Not linked
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">
                                  Category
                                </Label>
                                <p className="font-medium">
                                  {stallRequest.shopkeeperId
                                    ?.businessCategory || "—"}
                                </p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">
                                  Applicant Name
                                </Label>
                                <p className="font-medium">
                                  {stallRequest.nameOfApplicant}
                                </p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">
                                  Owner Nationality
                                </Label>
                                <p className="font-medium">
                                  {stallRequest.businessOwnerNationality}
                                </p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">
                                  Residency
                                </Label>
                                <p className="font-medium">
                                  {stallRequest.residency || "Not Provided"}
                                </p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">
                                  No. Of Operators
                                </Label>
                                <p className="font-medium">
                                  {stallRequest.noOfOperators || "Not Provided"}
                                </p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">
                                  Coupon Assigned
                                </Label>
                                <p className="text-sm">
                                  {stallRequest.couponCodeAssigned ||
                                    "None Assigned"}
                                </p>
                              </div>
                              {stallRequest.registrationNumber && (
                                <div className="pt-2 border-t">
                                  <Label className="text-muted-foreground">
                                    Registration Number
                                  </Label>
                                  <p className="font-medium">
                                    {stallRequest.registrationNumber}
                                  </p>
                                </div>
                              )}
                              {stallRequest.registrationImage && (
                                <div className="col-span-2 pt-2 border-t">
                                  <Label className="text-muted-foreground block mb-2">
                                    Registration Document
                                  </Label>
                                  <img
                                    src={`${__API_URL__}${stallRequest.registrationImage}`}
                                    alt="Registration"
                                    className="max-w-xs rounded-md border"
                                  />
                                </div>
                              )}
                              <div className="pt-2 border-t col-span-2">
                                <Label className="text-muted-foreground text-xs">
                                  Business Address
                                </Label>
                                <p className="text-sm leading-tight mt-1 italic">
                                  {stallRequest.shopkeeperId?.address}
                                </p>
                              </div>
                              {stallRequest.refundPaymentDescription && (
                                <div className="pt-2 border-t col-span-2">
                                  <Label className="text-muted-foreground text-xs">
                                    Refund Payment Details
                                  </Label>
                                  <p className="text-sm leading-tight mt-1 italic">
                                    {stallRequest.refundPaymentDescription}
                                  </p>
                                </div>
                              )}
                              {stallRequest.productDescription && (
                                <div className="col-span-2 pt-2 border-t">
                                  <Label className="text-muted-foreground">
                                    Product Description
                                  </Label>
                                  <p className="text-sm mt-1 text-gray-700">
                                    {stallRequest.productDescription}
                                  </p>
                                </div>
                              )}
                              {stallRequest.productImage &&
                                stallRequest.productImage.length > 0 && (
                                  <div className="col-span-2 pt-2 border-t">
                                    <Label className="text-muted-foreground mb-2 block">
                                      Product Images
                                    </Label>
                                    <div className="flex gap-2 overflow-x-auto">
                                      {stallRequest.productImage.map(
                                        (img: string, idx: number) => (
                                          <img
                                            key={idx}
                                            src={`${__API_URL__}${img}`}
                                            alt="Product"
                                            className="w-20 h-20 object-cover rounded-md border"
                                          />
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                            </CardContent>
                          </Card>

                          {/* Event Info */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">
                                Event Information
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-muted-foreground">
                                    Event Title
                                  </Label>
                                  <p className="font-bold text-lg">
                                    {stallRequest.eventId?.title}
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">
                                    Category
                                  </Label>
                                  <p className="font-medium">
                                    {stallRequest.eventId?.category}
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg">
                                <div>
                                  <Label className="text-muted-foreground flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Duration
                                  </Label>
                                  <p className="text-sm font-medium">
                                    {stallRequest.eventId?.startDate &&
                                      formatDate(
                                        stallRequest.eventId.startDate,
                                      )}{" "}
                                    -{" "}
                                    {stallRequest.eventId?.endDate &&
                                      formatDate(stallRequest.eventId.endDate)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Starts at: {stallRequest.eventId?.time}
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> Venue
                                  </Label>
                                  <p className="text-sm font-medium">
                                    {stallRequest.eventId?.location}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {stallRequest.eventId?.address}
                                  </p>
                                </div>
                              </div>
                              {stallRequest.eventId?.features && (
                                <div>
                                  <Label className="text-muted-foreground mb-2 block text-xs uppercase tracking-wider">
                                    Included Features
                                  </Label>
                                  <div className="flex flex-wrap gap-2">
                                    {stallRequest.eventId.features.parking && (
                                      <Badge
                                        variant="outline"
                                        className="flex gap-1 items-center bg-green-50"
                                      >
                                        <ParkingCircle className="w-3 h-3" />{" "}
                                        Parking
                                      </Badge>
                                    )}
                                    {stallRequest.eventId.features.wifi && (
                                      <Badge
                                        variant="outline"
                                        className="flex gap-1 items-center bg-yellow-50"
                                      >
                                        <Wifi className="w-3 h-3" /> WiFi
                                      </Badge>
                                    )}
                                    {stallRequest.eventId.features
                                      .photography && (
                                      <Badge
                                        variant="outline"
                                        className="flex gap-1 items-center bg-blue-50"
                                      >
                                        <Camera className="w-3 h-3" />{" "}
                                        Photography
                                      </Badge>
                                    )}
                                    {stallRequest.eventId.features.security && (
                                      <Badge
                                        variant="outline"
                                        className="flex gap-1 items-center bg-red-50"
                                      >
                                        <ShieldCheck className="w-3 h-3" />{" "}
                                        Security
                                      </Badge>
                                    )}
                                    {stallRequest.eventId.features.food && (
                                      <Badge
                                        variant="outline"
                                        className="flex gap-1 items-center bg-pink-50"
                                      >
                                        <FaUtensilSpoon className="w-3 h-3" />{" "}
                                        Food Available
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                <div>
                                  <Label className="text-muted-foreground">
                                    Dress Code
                                  </Label>
                                  <p className="text-sm font-medium">
                                    {stallRequest.eventId?.dresscode ||
                                      "Casual"}
                                  </p>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">
                                    Age Limit
                                  </Label>
                                  <p className="text-sm font-medium">
                                    {stallRequest.eventId?.ageRestriction ||
                                      "No Limit"}
                                  </p>
                                </div>
                              </div>
                              <div className="border-t pt-4">
                                <Label className="text-muted-foreground block mb-2">
                                  Venue Configuration
                                </Label>
                                <div className="flex gap-4 text-sm">
                                  <div className="text-center p-2 border rounded-md flex-1">
                                    <span className="block text-xs text-muted-foreground">
                                      Ticket Price
                                    </span>
                                    <span className="font-bold">
                                      {formatPrice(
                                        stallRequest.eventId?.ticketPrice || 0,
                                      )}
                                    </span>
                                  </div>
                                  <div className="text-center p-2 border rounded-md flex-1">
                                    <span className="block text-xs text-muted-foreground">
                                      Available Slots
                                    </span>
                                    <span className="font-bold">
                                      {stallRequest.eventId?.totalTickets}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {stallRequest.eventId?.gallery?.length > 0 && (
                                <div className="border-t pt-4">
                                  <Label className="text-muted-foreground block mb-2">
                                    Event Gallery
                                  </Label>
                                  <div className="flex gap-2 overflow-x-auto pb-2">
                                    {stallRequest.eventId.gallery.map(
                                      (img: string, idx: number) => (
                                        <img
                                          key={idx}
                                          src={`${__API_URL__}${img}`}
                                          className="w-16 h-16 rounded-md object-cover border shadow-sm"
                                          alt="Event"
                                        />
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* Selected Tables */}
                          {stallRequest.selectedTables?.length > 0 && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-lg">
                                  Selected Tables
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {stallRequest.selectedTables.map(
                                    (table: any, index: number) => (
                                      <div
                                        key={index}
                                        className="flex justify-between items-center p-3 bg-gray-50 rounded"
                                      >
                                        <div>
                                          <p className="font-medium">
                                            {table.tableName}
                                          </p>
                                          <p className="text-sm text-muted-foreground">
                                            {table.tableType}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-semibold">
                                            {formatPrice(table.price)}
                                          </p>
                                          <p className="text-sm text-muted-foreground">
                                            +{formatPrice(table.depositAmount)}{" "}
                                            deposit
                                          </p>
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Selected Add-ons */}
                          {stallRequest.selectedAddOns?.length > 0 && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-lg">
                                  Selected Add-ons
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {stallRequest.selectedAddOns.map(
                                    (addon: any, index: number) => (
                                      <div
                                        key={index}
                                        className="flex justify-between items-center p-3 bg-gray-50 rounded"
                                      >
                                        <div>
                                          <p className="font-medium">
                                            {addon.name}
                                          </p>
                                          <p className="text-sm text-muted-foreground">
                                            Quantity: {addon.quantity}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-semibold">
                                            {formatPrice(
                                              addon.price * addon.quantity,
                                            )}
                                          </p>
                                          <p className="text-sm text-muted-foreground">
                                            {formatPrice(addon.price)} each
                                          </p>
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Price Summary */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">
                                Price Summary
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <div className="flex justify-between">
                                <span>Tables Rental</span>
                                <span className="font-semibold">
                                  {formatPrice(stallRequest.tablesTotal)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Deposit</span>
                                <span className="font-semibold">
                                  {formatPrice(stallRequest.depositTotal)}
                                </span>
                              </div>
                              {stallRequest.addOnsTotal > 0 && (
                                <div className="flex justify-between">
                                  <span>Add-ons</span>
                                  <span className="font-semibold">
                                    {formatPrice(stallRequest.addOnsTotal)}
                                  </span>
                                </div>
                              )}
                              <Separator className="my-2" />
                              <div className="flex justify-between text-lg font-bold">
                                <span>Grand Total</span>
                                <span className="text-green-600">
                                  {formatPrice(stallRequest.grandTotal)}
                                </span>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Timeline */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">
                                Timeline
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex items-start gap-3">
                                <div className="bg-blue-100 rounded-full p-2">
                                  <FileText className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-medium">
                                    Request Submitted
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {formatDate(stallRequest.requestDate)}
                                  </p>
                                </div>
                              </div>
                              {stallRequest.confirmationDate && (
                                <div className="flex items-start gap-3">
                                  <div className="bg-green-100 rounded-full p-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      Request Confirmed
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {formatDate(
                                        stallRequest.confirmationDate,
                                      )}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {stallRequest.selectionDate && (
                                <div className="flex items-start gap-3">
                                  <div className="bg-purple-100 rounded-full p-2">
                                    <Package className="h-4 w-4 text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      Tables Selected
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {formatDate(stallRequest.selectionDate)}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {stallRequest.paymentDate && (
                                <div className="flex items-start gap-3">
                                  <div className="bg-yellow-100 rounded-full p-2">
                                    <CreditCard className="h-4 w-4 text-yellow-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      Payment Received
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {formatDate(stallRequest.paymentDate)}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {stallRequest.completionDate && (
                                <div className="flex items-start gap-3">
                                  <div className="bg-green-100 rounded-full p-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      Booking Completed
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {formatDate(stallRequest.completionDate)}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {stallRequest.hasCheckedIn &&
                                stallRequest.checkInTime && (
                                  <div className="flex items-start gap-3">
                                    <div className="bg-green-100 rounded-full p-2">
                                      <Clock1 className="h-4 w-4 text-green-600" />
                                    </div>
                                    <div>
                                      <p className="font-medium">
                                        Checked In Time
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {formatDateTime(
                                          stallRequest.checkInTime,
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              {stallRequest.hasCheckedOut &&
                                stallRequest.checkOutTime && (
                                  <div className="flex items-start gap-3">
                                    <div className="bg-green-100 rounded-full p-2">
                                      <Clock12 className="h-4 w-4 text-green-600" />
                                    </div>
                                    <div>
                                      <p className="font-medium">
                                        Checked Out Time
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {formatDateTime(
                                          stallRequest.checkOutTime,
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                )}
                            </CardContent>
                          </Card>

                          {/* Status History */}
                          {stallRequest.statusHistory &&
                            stallRequest.statusHistory.length > 0 && (
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-lg flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Status History & Notes
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="relative space-y-0">
                                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                                    {stallRequest.statusHistory.map(
                                      (entry: any, index: number) => {
                                        const statusConfig: Record<
                                          string,
                                          {
                                            bg: string;
                                            text: string;
                                            border: string;
                                          }
                                        > = {
                                          Pending: {
                                            bg: "bg-yellow-100",
                                            text: "text-yellow-700",
                                            border: "border-yellow-300",
                                          },
                                          Confirmed: {
                                            bg: "bg-green-100",
                                            text: "text-green-700",
                                            border: "border-green-300",
                                          },
                                          Approved: {
                                            bg: "bg-green-100",
                                            text: "text-green-700",
                                            border: "border-green-300",
                                          },
                                          Processing: {
                                            bg: "bg-blue-100",
                                            text: "text-blue-700",
                                            border: "border-blue-300",
                                          },
                                          Completed: {
                                            bg: "bg-emerald-100",
                                            text: "text-emerald-700",
                                            border: "border-emerald-300",
                                          },
                                          Cancelled: {
                                            bg: "bg-red-100",
                                            text: "text-red-700",
                                            border: "border-red-300",
                                          },
                                          Returned: {
                                            bg: "bg-purple-100",
                                            text: "text-purple-700",
                                            border: "border-purple-300",
                                          },
                                        };
                                        const config = statusConfig[
                                          entry.status
                                        ] || {
                                          bg: "bg-gray-100",
                                          text: "text-gray-700",
                                          border: "border-gray-300",
                                        };
                                        return (
                                          <div
                                            key={index}
                                            className="relative flex gap-4 pb-6 last:pb-0"
                                          >
                                            <div
                                              className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.bg} border-2 ${config.border}`}
                                            >
                                              <span className="text-xs font-bold">
                                                {index + 1}
                                              </span>
                                            </div>
                                            <div
                                              className={`flex-1 rounded-lg border ${config.border} ${config.bg} p-3`}
                                            >
                                              <div className="flex items-center justify-between flex-wrap gap-2">
                                                <Badge
                                                  className={`${config.bg} ${config.text} border ${config.border} font-semibold`}
                                                >
                                                  {entry.status}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                  {formatDateTime(
                                                    entry.changedAt,
                                                  )}
                                                </span>
                                              </div>
                                              {entry.note && (
                                                <p
                                                  className={`text-sm mt-2 ${config.text}`}
                                                >
                                                  📝 {entry.note}
                                                </p>
                                              )}
                                              {entry.changedBy && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                  By:{" "}
                                                  <span className="font-medium capitalize">
                                                    {entry.changedBy}
                                                  </span>
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      },
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                          {/* Cancellation Reason */}
                          {stallRequest.cancellationReason && (
                            <Card className="border-red-200">
                              <CardHeader>
                                <CardTitle className="text-lg text-red-600">
                                  Cancellation Reason
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm">
                                  {stallRequest.cancellationReason}
                                </p>
                              </CardContent>
                            </Card>
                          )}

                          {/* Footer: Download + Close */}
                          <div className="flex gap-2 sm:justify-between sticky bottom-0 bg-background pt-4 pb-2 border-t">
                            <Button
                              variant="buttonOutline"
                              onClick={() => setExistingStallRequest(null)}
                            >
                              Close
                            </Button>
                            <Button
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() =>
                                handleDownload(existingStallRequest)
                              }
                              disabled={
                                existingStallRequest.paymentStatus !== "Paid"
                              }
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download Stall Ticket
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Rent Form Dialog */}
      {/* Rent Form Dialog */}
      {showRentForm &&
        !showTableSelection &&
        !showStallTermsGate &&
        (stallGateAcknowledged || !getStallGateContent().hasAny) && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl max-w-xl w-full p-6 relative overflow-y-auto max-h-[90vh]">
              <button
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 transition-all"
                onClick={handleRentFormCancel}
              >
                ✖
              </button>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {shopkeeperExists
                  ? "Confirm Your Details"
                  : "Register for Stall Rental"}
              </h2>
              <p className="text-xs text-gray-400 mb-6">
                {shopkeeperExists
                  ? "Your details have been loaded. Please review and submit."
                  : "Fill in your details to rent a stall at this event"}
              </p>

              <StallStepper current={3} />

              {/* Active membership card — shown when the signed-in vendor is a
                member, so they see their plan + validity right on the form. */}
              {stallMembership && (
                <div
                  className="rounded-xl border-2 p-3 mb-4 flex items-center gap-3"
                  style={{
                    borderColor: (stallMembership.color || "#10b981") + "55",
                    background: (stallMembership.color || "#10b981") + "08",
                  }}
                >
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: (stallMembership.color || "#10b981") + "1a",
                    }}
                  >
                    <Star
                      className="h-5 w-5"
                      style={{ color: stallMembership.color || "#10b981" }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-bold text-sm truncate"
                        style={{ color: stallMembership.color || "#10b981" }}
                      >
                        {stallMembership.planName}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Valid till{" "}
                      {stallMembership.endDate
                        ? new Date(stallMembership.endDate).toLocaleDateString()
                        : "—"}
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleRentFormSubmit} className="space-y-4">
                {/* --- SECTION: PERSONAL & BUSINESS DETAILS --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      Name of Applicant <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      name="nameOfApplicant"
                      value={shopkeeperDetails.nameOfApplicant}
                      onChange={handleRentFormChange}
                      placeholder="Full Name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Owner Name (Legal) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      name="name"
                      value={shopkeeperDetails.name}
                      onChange={handleRentFormChange}
                      required
                    />
                  </div>
                </div>

                {(stallOn("businessOwnerNationality") || stallOn("residency")) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stallOn("businessOwnerNationality") && (
                      <div className="space-y-2">
                        <Label>
                          Owner Nationality{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={shopkeeperDetails.businessOwnerNationality}
                          onValueChange={(val) =>
                            setShopkeeperDetails({
                              ...shopkeeperDetails,
                              businessOwnerNationality: val,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Country" />
                          </SelectTrigger>
                          <SelectContent>
                            {countries.map((c) => (
                              <SelectItem key={c.code} value={c.name}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {stallOn("residency") && (
                      <div className="space-y-2">
                        <Label>
                          Residency <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={shopkeeperDetails.residency}
                          onValueChange={(val) =>
                            setShopkeeperDetails({
                              ...shopkeeperDetails,
                              residency: val,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Country" />
                          </SelectTrigger>
                          <SelectContent>
                            {countries.map((c) => (
                              <SelectItem key={c.code} value={c.name}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stallOn("brandName") && (
                    <div className="space-y-2">
                      <Label>
                        Brand Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        name="brandName"
                        value={shopkeeperDetails.brandName}
                        onChange={handleRentFormChange}
                        placeholder="Brand Name"
                        required
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>
                      Registered Business Name{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      name="shopName"
                      value={shopkeeperDetails.shopName}
                      onChange={handleRentFormChange}
                      placeholder="Business Name"
                      required
                    />
                  </div>
                  {stallOn("displayName") && (
                    <div className="space-y-2">
                      <Label>Display Name (optional)</Label>
                      <Input
                        name="displayName"
                        value={shopkeeperDetails.displayName}
                        onChange={handleRentFormChange}
                        placeholder="How this exhibitor's name should be shown"
                      />
                    </div>
                  )}
                </div>

                {/* Only show these if creating a NEW shopkeeper */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!shopkeeperExists ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>
                          Primary Email <span className="text-red-500">*</span>
                        </Label>
                        {emailVerified && (
                          <Badge className="bg-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" /> Verified
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          name="email"
                          value={shopkeeperDetails.email}
                          onChange={handleRentFormChange}
                          disabled={emailVerified}
                        />
                        <Button
                          type="button"
                          onClick={sendOtpToBusinessEmail}
                          disabled={
                            sendingOtp ||
                            !shopkeeperDetails.email ||
                            emailVerified
                          }
                        >
                          {sendingOtp
                            ? "Sending..."
                            : emailVerified
                              ? "Verified"
                              : "Send OTP"}
                        </Button>
                      </div>
                      {otpSent && !emailVerified && (
                        <div className="flex gap-2 mt-2">
                          <Input
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="Enter OTP"
                          />
                          <Button
                            type="button"
                            onClick={verifyOtpForBusinessEmail}
                            disabled={verifyingOtp}
                          >
                            Verify
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>
                        Primary Email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={shopkeeperDetails.email}
                        disabled
                        className="bg-gray-100"
                      />
                    </div>
                  )}

                  {stallOn("businessEmail") && (
                    <div className="space-y-2">
                      <Label>
                        Business Email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="email"
                        name="businessEmail"
                        value={shopkeeperDetails.businessEmail}
                        onChange={handleRentFormChange}
                        required
                      />
                    </div>
                  )}
                </div>

                {/* --- SECTION: CONTACT & VERIFICATION --- */}
                {(stallOn("whatsappNumber") || stallOn("phone")) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stallOn("whatsappNumber") && (
                      <div className="space-y-2">
                        <Label>
                          WhatsApp Number{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <PhoneInput
                          value={shopkeeperDetails.whatsappNumber}
                          onChange={(whatsappNumber, country) => {
                            setWhatsappCountry(country);
                            setShopkeeperDetails((prev) => ({
                              ...prev,
                              whatsappNumber,
                            }));
                          }}
                          countryCodeEditable={false}
                          disabled={isStallApproved}
                          inputStyle={{
                            width: "100%",
                            height: "36px",
                            borderRadius: "6px",
                          }}
                        />
                        {whatsappCountry && !isStallApproved && (
                          <p className="text-[11px] text-gray-400">
                            Enter {phoneHint(whatsappCountry)} for{" "}
                            {whatsappCountry.name}
                          </p>
                        )}
                      </div>
                    )}

                    {stallOn("phone") && (
                      <div className="space-y-2">
                        <Label>
                          Phone Number <span className="text-red-500">*</span>
                        </Label>
                        <PhoneInput
                          value={shopkeeperDetails.phone}
                          onChange={(phone, country) => {
                            setPhoneCountry(country);
                            setShopkeeperDetails((prev) => ({ ...prev, phone }));
                          }}
                          countryCodeEditable={false}
                          disabled={isStallApproved}
                          inputStyle={{
                            width: "100%",
                            height: "36px",
                            borderRadius: "6px",
                          }}
                        />
                        {phoneCountry && !isStallApproved && (
                          <p className="text-[11px] text-gray-400">
                            Enter {phoneHint(phoneCountry)} for{" "}
                            {phoneCountry.name}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* --- SECTION: STALL CONFIGURATION --- */}
                {(stallOn("businessCategory") ||
                  stallOn("noOfOperators") ||
                  stallOn("registrationNumber")) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {stallOn("businessCategory") && (
                    <div className="space-y-2">
                      <Label>
                        Business Category{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      {/* Shared dynamic picker — categories an exhibitor
                      types here persist to /categories and surface next
                      time in the organizer's Space Layout and Add
                      Exhibitor form. Single-select shape preserves the
                      old required-field semantics. */}
                      <ExhibitorCategoryPicker
                        value={shopkeeperDetails.businessCategory}
                        onChange={(val) =>
                          setShopkeeperDetails({
                            ...shopkeeperDetails,
                            businessCategory: val,
                          })
                        }
                        baseline={BUSINESS_CATEGORIES}
                        placeholder="Select"
                      />
                    </div>
                  )}
                  {stallOn("noOfOperators") && (
                  <div className="space-y-2">
                    <Label>
                      No. of Operators <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      step={1}
                      name="noOfOperators"
                      value={shopkeeperDetails.noOfOperators}
                      onChange={(e) => {
                        // Clamp to 1–10 — blank/invalid or below snaps to 1,
                        // anything above 10 caps at 10.
                        const n = parseInt(e.target.value, 10);
                        const clamped = !Number.isFinite(n)
                          ? 1
                          : Math.min(10, Math.max(1, n));
                        setShopkeeperDetails((prev) => ({
                          ...prev,
                          noOfOperators: clamped,
                        }));
                      }}
                      required
                    />
                  </div>
                  )}
                  {stallOn("registrationNumber") && (
                  <div className="space-y-2 md:col-span-3">
                    <Label>
                      Registration Number ({regConfig.label}){" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        name="registrationNumber"
                        value={shopkeeperDetails.registrationNumber}
                        onChange={(e) => {
                          // Alphanumeric only, uppercased, and capped to the length
                          // required by the residency (UEN 10 / GST 15).
                          let v = e.target.value
                            .replace(/[^a-zA-Z0-9]/g, "")
                            .toUpperCase();
                          if (regConfig.maxLength > 0)
                            v = v.slice(0, regConfig.maxLength);
                          setShopkeeperDetails((prev) => ({
                            ...prev,
                            registrationNumber: v,
                          }));
                          // Editing the number invalidates any prior verification.
                          setGstVerified(false);
                          setGstError("");
                          setUenVerified(false);
                          setUenError("");
                        }}
                        maxLength={regConfig.maxLength || undefined}
                        placeholder={
                          regConfig.label === "UEN"
                            ? "e.g. 201812345A"
                            : regConfig.label === "GST"
                              ? "e.g. 27AAPFU0939F1ZV"
                              : "e.g. UEN / GST No."
                        }
                        disabled={isStallApproved || gstVerified || uenVerified}
                        required
                        className="flex-1"
                      />
                      {/* India GST is verified against the government registry
                        (AppyFlow) as soon as it's filled in. */}
                      {regConfig.label === "GST" &&
                        !isStallApproved &&
                        !isDummyReg && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              handleVerifyGST(
                                shopkeeperDetails.registrationNumber,
                              )
                            }
                            disabled={
                              !shopkeeperDetails.registrationNumber ||
                              gstVerifying ||
                              gstVerified
                            }
                            className="whitespace-nowrap"
                          >
                            {gstVerifying
                              ? "Verifying…"
                              : gstVerified
                                ? "Verified ✓"
                                : "Verify"}
                          </Button>
                        )}
                      {/* Singapore UEN is verified against ACRA's free open-data
                        registry (data.gov.sg) — no cost per check. */}
                      {regConfig.label === "UEN" &&
                        !isStallApproved &&
                        !isDummyReg && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              handleVerifyUEN(
                                shopkeeperDetails.registrationNumber,
                              )
                            }
                            disabled={
                              !shopkeeperDetails.registrationNumber ||
                              uenVerifying ||
                              uenVerified
                            }
                            className="whitespace-nowrap"
                          >
                            {uenVerifying
                              ? "Verifying…"
                              : uenVerified
                                ? "Verified ✓"
                                : "Verify"}
                          </Button>
                        )}
                    </div>
                    {regConfig.label === "GST" && gstError && (
                      <p className="text-[11px] text-red-600">{gstError}</p>
                    )}
                    {regConfig.label === "GST" && gstVerified && gstDetails && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                        <p className="mb-2 text-sm font-semibold text-green-700">
                          ✓ GST Verified — details from the government registry
                        </p>
                        <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                          {(
                            [
                              ["GSTIN", gstDetails.gstin],
                              ["Legal name", gstDetails.legalName],
                              ["Trade name", gstDetails.tradeName],
                              ["Status", gstDetails.status],
                              ["Registered", gstDetails.registrationDate],
                              ["Type", gstDetails.constitution],
                              ["State", gstDetails.state],
                              ["Address", gstDetails.address],
                            ] as [string, string][]
                          )
                            .filter(([, v]) => !!v)
                            .map(([label, value]) => (
                              <div
                                key={label}
                                className={
                                  label === "Address" ? "sm:col-span-2" : ""
                                }
                              >
                                <span className="text-[11px] uppercase tracking-wide text-green-700/70">
                                  {label}
                                </span>
                                <div className="font-medium text-green-900">
                                  {value}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    {regConfig.label === "UEN" && uenError && (
                      <p className="text-[11px] text-red-600">{uenError}</p>
                    )}
                    {regConfig.label === "UEN" && uenVerified && uenDetails && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                        <p className="mb-2 text-sm font-semibold text-green-700">
                          ✓ UEN Verified — details from ACRA registry
                        </p>
                        <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                          {(
                            [
                              ["UEN", uenDetails.uen],
                              ["Entity name", uenDetails.entityName],
                              ["Status", uenDetails.status],
                              ["Entity type", uenDetails.entityType],
                              ["Issued", uenDetails.issueDate],
                              ["Agency", uenDetails.agency],
                              ["Address", uenDetails.address],
                            ] as [string, string][]
                          )
                            .filter(([, v]) => !!v)
                            .map(([label, value]) => (
                              <div
                                key={label}
                                className={
                                  label === "Address" ? "sm:col-span-2" : ""
                                }
                              >
                                <span className="text-[11px] uppercase tracking-wide text-green-700/70">
                                  {label}
                                </span>
                                <div className="font-medium text-green-900">
                                  {value}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    {regConfig.example && (
                      <p className="text-[11px] text-muted-foreground">
                        {regConfig.example}
                      </p>
                    )}
                    {/* Vendors without a GST/UEN can drop in a placeholder so the
                      required field is satisfied and they can still submit. It
                      won't verify (it isn't a real registration), so the
                      organizer knows to contact them and confirm before
                      approving. */}
                    {!isStallApproved && !isDummyReg && (
                      <p className="text-[11px] text-muted-foreground">
                        Don't have a{" "}
                        {regConfig.label === "UEN/GST"
                          ? "GST/UEN"
                          : regConfig.label}
                        ?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setShopkeeperDetails((prev) => ({
                              ...prev,
                              registrationNumber: dummyRegNumber,
                            }));
                            setGstVerified(false);
                            setGstError("");
                            setUenVerified(false);
                            setUenError("");
                          }}
                          className="font-medium text-blue-600 underline hover:text-blue-700"
                        >
                          Use a placeholder &amp; submit
                        </button>{" "}
                        — the organizer will contact you to confirm.
                      </p>
                    )}
                    {isDummyReg && !isStallApproved && (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
                        Placeholder entered — this isn't a real{" "}
                        {regConfig.label}. The organizer will reach out to
                        verify your details before approving.
                      </p>
                    )}
                  </div>
                  )}
                </div>
                )}

                {/* --- SECTION: SOCIAL & IMAGES --- */}
                {(stallOn("faceBookLink") || stallOn("instagramLink")) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stallOn("faceBookLink") && (
                    <div className="space-y-2">
                      <Label>
                        Facebook Link <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        name="faceBookLink"
                        value={shopkeeperDetails.faceBookLink}
                        onChange={handleRentFormChange}
                        placeholder="https://facebook.com/yourbrand"
                      />
                    </div>
                  )}
                  {stallOn("instagramLink") && (
                    <div className="space-y-2">
                      <Label>
                        Instagram Link <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        name="instagramLink"
                        value={shopkeeperDetails.instagramLink}
                        onChange={handleRentFormChange}
                        placeholder="@yourbrand"
                      />
                    </div>
                  )}
                </div>
                )}

                {/* Image Uploads */}
                {(stallOn("registrationImage") ||
                  stallOn("companyLogo") ||
                  stallOn("productImage")) && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
                  <h3 className="font-semibold text-gray-800">
                    Brand Assets & Documents
                  </h3>

                  {(stallOn("registrationImage") || stallOn("companyLogo")) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Reg Image */}
                    {stallOn("registrationImage") && (
                    <div className="space-y-2">
                      <Label>
                        Business Registration Document{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex items-center gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            document.getElementById("regUpload")?.click()
                          }
                        >
                          <Upload className="w-4 h-4 mr-2" /> Upload
                        </Button>
                        <input
                          id="regUpload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleSingleImageSelect(e, "reg")}
                        />
                        {regImagePreview && (
                          <img
                            src={regImagePreview}
                            className="h-12 w-12 object-cover rounded border border-gray-300"
                            alt="Reg"
                          />
                        )}
                      </div>
                    </div>
                    )}

                    {/* Logo */}
                    {stallOn("companyLogo") && (
                    <div className="space-y-2">
                      <Label>
                        Company Logo <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex items-center gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            document.getElementById("logoUpload")?.click()
                          }
                        >
                          <Upload className="w-4 h-4 mr-2" /> Upload
                        </Button>
                        <input
                          id="logoUpload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleSingleImageSelect(e, "logo")}
                        />
                        {logoPreview && (
                          <img
                            src={logoPreview}
                            className="h-12 w-12 object-cover rounded border border-gray-300"
                            alt="Logo"
                          />
                        )}
                      </div>
                    </div>
                    )}
                  </div>
                  )}

                  {/* Product Images */}
                  {stallOn("productImage") && (
                  <div className="space-y-2 pt-4 border-t border-gray-200">
                    <Label>
                      Product Images (
                      {productFiles.length + existingProductImages.length}/5){" "}
                      <span className="text-red-500">*</span>
                      <span className="ml-1 text-[11px] font-normal text-gray-400">
                        (at least 1 required)
                      </span>
                    </Label>
                    <div className="flex items-center gap-4 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          productFiles.length + existingProductImages.length >=
                          5
                        }
                        onClick={() =>
                          document.getElementById("productUpload")?.click()
                        }
                      >
                        <Upload className="w-4 h-4 mr-2" /> Add Products
                      </Button>
                      <input
                        id="productUpload"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleMultipleImageSelect}
                      />

                      {/* Stored images from a returning vendor's profile */}
                      {existingProductImages.map((preview, idx) => (
                        <div key={`existing-${idx}`} className="relative group">
                          <img
                            src={preview}
                            className="h-14 w-14 object-cover rounded border border-gray-300"
                            alt={`Saved product ${idx}`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setExistingProductImages((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      {productPreviews.map((preview, idx) => (
                        <div key={idx} className="relative group">
                          <img
                            src={preview}
                            className="h-14 w-14 object-cover rounded border border-gray-300"
                            alt={`Product ${idx}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeProductImage(idx)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}
                </div>
                )}

                {/* Description */}
                {stallOn("description") && (
                <div className="space-y-2">
                  <Label>
                    Business, Products & Brand Description{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    name="description"
                    value={shopkeeperDetails.description}
                    onChange={handleRentFormChange}
                    placeholder="Tell us about what you sell..."
                    rows={3}
                  />
                </div>
                )}

                {stallOn("refundPaymentDescription") && (
                <div className="space-y-2">
                  <Label>
                    Refund Payment Description{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    name="refundPaymentDescription"
                    value={shopkeeperDetails.refundPaymentDescription}
                    onChange={handleRentFormChange}
                    placeholder="Tell us about what you sell..."
                    rows={3}
                  />
                </div>
                )}

                {stallOn("address") && (
                <div className="space-y-2">
                  <Label>
                    Full Address <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    name="address"
                    value={shopkeeperDetails.address}
                    onChange={handleRentFormChange}
                    placeholder="Your business address"
                    rows={2}
                  />
                </div>
                )}

                {/* Preferred Space Types — with quantity, total capped at the
                  organizer's maxSpacesPerVendor. */}
                {eventData?.tableTemplates &&
                  eventData.tableTemplates.filter(
                    (t: any) => t.forSale !== false,
                  ).length > 0 && (
                    <div className="space-y-2 border-t pt-4">
                      {/* Form-level waitlist banner: shows above the heading
                        when any picked space type is sold out, nudging the
                        vendor to switch to a type that still has spaces. */}
                      {(() => {
                        const soldOutNames = (eventData?.tableTemplates || [])
                          .filter(
                            (t: any) =>
                              (
                                shopkeeperDetails.preferredTemplateIds || []
                              ).includes(t.id) && isTemplateFullyBooked(t),
                          )
                          .map((t: any) => t.name);
                        if (soldOutNames.length === 0) return null;
                        const label =
                          soldOutNames.length === 1
                            ? `“${soldOutNames[0]}” is`
                            : `${soldOutNames
                                .map((n: string) => `“${n}”`)
                                .join(", ")} are`;
                        return (
                          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-snug text-amber-800">
                            <span aria-hidden className="mt-px">
                              ⚠️
                            </span>
                            <span>
                              <span className="font-semibold">Sold out —</span>{" "}
                              {label} fully booked. Keep your selection to join
                              the waiting queue, or change to another space type
                              below that still has spaces available.
                            </span>
                          </div>
                        );
                      })()}
                      <div className="flex items-center justify-between">
                        <Label>
                          Preferred Space Type(s){" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <span className="text-xs font-medium text-gray-500">
                          {totalPreferredSpaces} of {maxSpacesPerVendor} space
                          {maxSpacesPerVendor === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="mb-2 text-[11px] text-gray-400">
                        Pick the space types you want and set how many of each —
                        up to {maxSpacesPerVendor} total. You'll only be able to
                        book spaces of the selected type(s).
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {eventData.tableTemplates
                          .filter((t: any) => t.forSale !== false)
                          .map((template: any) => {
                            const ids: string[] =
                              shopkeeperDetails.preferredTemplateIds || [];
                            const qtys: number[] =
                              shopkeeperDetails.preferredTemplateQuantities ||
                              [];
                            const idx = ids.indexOf(template.id);
                            const isSelected = idx >= 0;
                            const qty = isSelected ? Number(qtys[idx]) || 1 : 0;
                            const atCap =
                              totalPreferredSpaces >= maxSpacesPerVendor;
                            // Sold-out is a property of the space type itself,
                            // NOT of whether the vendor has picked it — keep it
                            // true after selection so the form still shows the
                            // waitlist warning before they submit.
                            const soldOut = isTemplateFullyBooked(template);
                            const priceEl = (() => {
                              const hasMember =
                                isMember &&
                                template.memberPrice != null &&
                                Number(template.memberPrice) !==
                                  Number(template.tablePrice);
                              if (hasMember) {
                                return (
                                  <>
                                    <span className="font-semibold text-emerald-600">
                                      {formatPrice(template.memberPrice)}
                                    </span>{" "}
                                    <span className="text-gray-400 line-through">
                                      {formatPrice(template.tablePrice)}
                                    </span>
                                  </>
                                );
                              }
                              return formatPrice(
                                isMember && template.memberPrice != null
                                  ? template.memberPrice
                                  : template.tablePrice,
                              );
                            })();
                            return (
                              <div
                                key={template.id}
                                className={`rounded-xl border-2 p-3 transition-all ${
                                  isSelected ? "shadow-md" : "border-gray-200"
                                }`}
                                style={
                                  isSelected
                                    ? {
                                        borderColor:
                                          template.color || "#3b82f6",
                                        backgroundColor:
                                          (template.color || "#3b82f6") + "08",
                                      }
                                    : {}
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => togglePreferredType(template)}
                                  disabled={
                                    !isSelected &&
                                    atCap &&
                                    maxSpacesPerVendor > 1
                                  }
                                  className="w-full text-left disabled:opacity-50"
                                >
                                  <div className="mb-1 flex items-center gap-2">
                                    <div
                                      className="h-3 w-3 rounded-sm"
                                      style={{
                                        backgroundColor:
                                          template.color || "#6b7280",
                                      }}
                                    />
                                    <span className="text-sm font-semibold text-gray-800">
                                      {template.name}
                                    </span>
                                    {soldOut && (
                                      <span className="ml-auto text-xs font-medium text-amber-600">
                                        Sold out &mdash; waitlist
                                      </span>
                                    )}
                                    {!soldOut && isSelected && (
                                      <span
                                        className="ml-auto text-xs font-medium"
                                        style={{
                                          color: template.color || "#3b82f6",
                                        }}
                                      >
                                        Selected
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-gray-500">
                                    {template.width}x{template.height}cm
                                    &middot; {priceEl}
                                  </div>
                                </button>
                                {isSelected && (
                                  <div className="mt-2 flex items-center gap-2 border-t pt-2">
                                    <span className="text-[11px] text-gray-500">
                                      Quantity
                                    </span>
                                    <div className="ml-auto flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          changePreferredQty(template, -1)
                                        }
                                        disabled={qty <= 1}
                                        className="h-6 w-6 rounded border text-sm font-bold text-gray-600 disabled:opacity-40"
                                      >
                                        −
                                      </button>
                                      <span className="w-6 text-center text-sm font-semibold">
                                        {qty}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          changePreferredQty(template, +1)
                                        }
                                        disabled={
                                          atCap || qty >= perTypeMax(template)
                                        }
                                        className="h-6 w-6 rounded border text-sm font-bold text-gray-600 disabled:opacity-40"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                <CardFooter className="flex justify-end gap-3 p-0 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRentFormCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      loading ||
                      (!shopkeeperExists && !emailVerified) ||
                      (!shopkeeperExists &&
                        stallOn("businessEmail") &&
                        !shopkeeperDetails.businessEmail) ||
                      (stallOn("businessCategory") &&
                        !shopkeeperDetails.businessCategory)
                    }
                  >
                    {loading ? "Submitting..." : "Submit Registration"}
                  </Button>
                </CardFooter>
              </form>
            </div>

            {/* Render Crop Modal Outside the form */}
            {cropImage && (
              <ImageCropModal
                open={cropOpen}
                image={cropImage}
                onClose={() => {
                  setCropOpen(false);
                  setCropImage(null);
                  setCropQueue([]);
                }}
                onCropComplete={handleCroppedImage}
              />
            )}
          </div>
        )}

      {/* ── Footer: organizer credit + EventSH branding ── */}
      <footer className="border-t border-gray-200 bg-white py-6 text-center">
        <p className="text-sm text-gray-600">
          Organized by{" "}
          <span className="font-semibold text-gray-800">
            {organizer?.organizationName || "the organizer"}
          </span>
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Powered by{" "}
          <a
            href="https://eventsh.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-600 hover:underline"
          >
            EventSH.com
          </a>
        </p>
      </footer>

      {/* Public AI assistant — only when the organizer enabled it for this
          event. Answers questions grounded in this event's own data. */}
      {eventData?.chatbot?.enabled && (
        <EventChatbot
          eventId={eventData._id}
          chatbotName={eventData.chatbot.name}
          accentColor={
            eventData.chatbot.accentColor || design?.primaryColor || "#2563eb"
          }
          greetingActions={buildEventChatbotGreeting(eventData)}
          ticketTypes={(eventData.visitorTypes || [])
            .filter((vt: any) => vt && vt.isActive !== false)
            .map((vt: any) => ({
              name: vt.name,
              priceLabel:
                Number(vt.price) === 0 ? "Free" : formatPrice(vt.price),
            }))}
          onBookStall={() => {
            // "Book a stall" pill → same as clicking the on-page
            // "Rent a Stall / Preview Request" button (opens the WhatsApp /
            // Google verification dialog, then the normal flow follows).
            if (!guardEventOpen("Stall bookings")) return;
            handleRentStallClick();
          }}
          onSelectTicket={(index) => {
            // Ticket picker → straight to the ticket cart with the chosen type.
            if (!guardEventOpen("Ticket sales")) return;
            handleGetTickets(index);
          }}
          onApplySpeaker={openSpeakerApply}
          onBookRoundTable={openRoundTableBooking}
        />
      )}
    </div>
  );
}
