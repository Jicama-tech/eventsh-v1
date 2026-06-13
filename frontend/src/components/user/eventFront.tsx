// File: EventDetailPage.tsx

import React, { useState, useEffect, useRef, CSSProperties } from "react";
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
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { FaUtensilSpoon, FaWhatsapp } from "react-icons/fa";
import { useToast } from "@/hooks/use-toast";

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
}

interface EventDetailPageProps {
  eventId: string;
  onBack: () => void;
}

export function EventFront({ eventId, onBack }: EventDetailPageProps) {
  const [eventData, setEventData] = useState<FetchedEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { id } = useParams();
  const [isFavorited, setIsFavorited] = useState(false);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [selectedVisitorType, setSelectedVisitorType] = useState<number>(0);
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

  // Speaker Application States (WhatsApp-first flow like stalls)
  const [showSpeakerDialog, setShowSpeakerDialog] = useState(false);
  const [speakerWhatsApp, setSpeakerWhatsApp] = useState("");
  const [speakerOtp, setSpeakerOtp] = useState("");
  const [speakerOtpSent, setSpeakerOtpSent] = useState(false);
  const [speakerVerified, setSpeakerVerified] = useState(false);
  const [sendingSpeakerOtp, setSendingSpeakerOtp] = useState(false);
  const [verifyingSpeakerOtp, setVerifyingSpeakerOtp] = useState(false);
  const [existingSpeakerRequest, setExistingSpeakerRequest] =
    useState<any>(null);
  const [speakerStep, setSpeakerStep] = useState<
    "whatsapp" | "status" | "form" | "timeslot" | "done"
  >("whatsapp");
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
  // Controls the new Google-verified Member dialog mounted under the
  // Rent-a-Stall card. Replaces the old storefront-only entry point.
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  // Membership status for the logged-in exhibitor, scoped to this
  // event's organizer. Populated after OTP verify when shopkeeper email
  // is known. When set + the space template has a memberPrice, the
  // selection cards and totals quote the member-tier price.
  const [activeMembership, setActiveMembership] = useState<{
    planName?: string;
    endDate?: string;
  } | null>(null);
  const isMember = !!activeMembership;

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
  // T&C for stalls
  const [stallTermsChecked, setStallTermsChecked] = useState<
    Record<number, boolean>
  >({});
  const [showTermsStep, setShowTermsStep] = useState(false);
  const [availableTables, setAvailableTables] = useState<{
    [key: string]: any[];
  }>({});
  const [loadingTables, setLoadingTables] = useState(false);
  const [currentLayoutIndex, setCurrentLayoutIndex] = useState(0);

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
    noOfOperators: 0,
    brandName: "",
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
  const { toast } = useToast();
  const [countries, setCountries] = useState<Country[]>([]);
  const [settings, setSettings] = useState<OrganizerStore | null>(null);
  const [loadingCountries, setLoadingCountries] = useState(true);
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
              typeof data.planId === "object"
                ? data.planId?.name
                : undefined,
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
    const templates: any[] = Array.isArray(
      (eventData as any)?.tableTemplates,
    )
      ? (eventData as any).tableTemplates
      : [];
    const tpl =
      table?.id != null
        ? templates.find((t: any) => t?.id === table.id)
        : null;

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
      useMember && memberPrice != null
        ? memberPrice
        : table?.tablePrice ?? 0;
    const bookingPrice =
      useMember && memberBookingPrice != null
        ? memberBookingPrice
        : table?.bookingPrice ?? 0;
    const depositPrice =
      useMember && memberDepositPrice != null
        ? memberDepositPrice
        : table?.depositPrice ?? 0;
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
          appliedTier:
            isMember && p.memberSaved > 0 ? "member" : "regular",
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

  // Fetch countries for phone input
  useEffect(() => {
    async function fetchCountries() {
      try {
        setLoadingCountries(true);
        const response = await fetch(
          "https://restcountries.com/v3.1/all?fields=name,cca2,idd",
        );
        const data = await response.json();

        const fetchedCountries: Country[] = data
          .map((country: any) => {
            const root = country.idd?.root ?? "";
            const suffixes = country.idd?.suffixes ?? [];
            let dial = "";
            if (root && suffixes.length === 1) dial = root + suffixes[0];
            else if (root) dial = root;
            return {
              name: country.name?.common || "",
              code: country.cca2 || "",
              dialCode: dial,
            };
          })
          .filter((c) => c.dialCode)
          .sort((a, b) => a.name.localeCompare(b.name));
        setCountries(fetchedCountries);
      } catch (e) {
        toast({
          duration: 5000,
          title: "Error loading countries",
          description: "Failed to fetch country codes",
          variant: "destructive",
        });
      } finally {
        setLoadingCountries(false);
      }
    }
    fetchCountries();
  }, []);

  // Fetch event data
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${apiURL}/events/${eventId || id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch event");
        }
        const result = await response.json();
        setEventData(result.data);

        const organizerId = result.data.organizer._id;

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

        if (!storeResult.data) {
          throw new Error("Failed to fetch organizer store details");
        }

        if (storeResult.data) {
          setSettings(storeResult.data);
        }

        if (profileResult.data?.country) {
          setCountry(profileResult.data.country);
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
  }, [eventId, id]);

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
  const applyVendorRecord = async (shopData: any, fallbackWhatsApp?: string) => {
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
    });
    setEmailVerified(true); // Assume verified if exists

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

  // Look up a returning vendor by the Google email and continue the flow.
  const lookupVendorByEmail = async (email: string) => {
    const clean = String(email || "").trim().toLowerCase();
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
    try {
      const res = await fetch(
        `${apiURL}/stalls/vendor/by-email/${encodeURIComponent(clean)}`,
      );
      if (res.ok) {
        const data = await res.json();
        const shopData = data.data || data;
        if (shopData && (shopData.name || shopData.businessName)) {
          // Active member → load the membership details so the rent form can
          // show a small card. We don't pause here; the registration form
          // opens with the card on top.
          if (shopData.isMember) {
            let planName = "Member";
            let endDate: string | undefined = shopData.membershipEndDate;
            let color: string | undefined;
            try {
              const orgId = eventData?.organizer?._id;
              if (orgId) {
                const mRes = await fetch(
                  `${apiURL}/exhibitor-memberships/by-email/${encodeURIComponent(
                    clean,
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
              // non-fatal — fall back to vendor's denormalised fields
            }
            setStallMembership({ planName, endDate, color });
          } else {
            setStallMembership(null);
          }
          setStallGoogleLoading(false);
          await applyVendorRecord(shopData);
          return;
        }
      }
      // No vendor on this email — open a fresh form pre-filled with it.
      setStallGoogleLoading(false);
      setShopkeeperExists(false);
      setShopkeeperDetails({
        ...initialForm,
        email: clean,
        businessEmail: clean,
      });
      setShowWhatsAppDialog(false);
      setShowRentForm(true);
      toast({
        duration: 5000,
        title: "Let's get you set up",
        description: "No saved profile found — please fill in your details.",
      });
    } catch (error) {
      console.error("Vendor email lookup failed:", error);
      setStallGoogleLoading(false);
      setShopkeeperExists(false);
      setShopkeeperDetails({
        ...initialForm,
        email: clean,
        businessEmail: clean,
      });
      setShowWhatsAppDialog(false);
      setShowRentForm(true);
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
      pdf.setFillColor(30, 64, 175);
      pdf.rect(0, 0, pageWidth, 16, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text("Stall Booking Details", margin, 11);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `Generated: ${new Date().toLocaleString()}`,
        pageWidth - margin,
        11,
        { align: "right" },
      );
      y = 24;

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
        pdf.text("EventSH — Stall Booking Report", margin, pageHeight - 3.5);
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

    // Check if vendor has a preferred template and this table doesn't match
    const preferredId = existingStallRequest?.preferredTemplateId;
    if (preferredId && table.id !== preferredId) {
      toast({
        duration: 5000,
        title: "Not Available for Your Category",
        description: `You registered for "${existingStallRequest?.preferredTemplateName}" spaces only. This space belongs to a different category.`,
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

  // NEW: Handle add-on quantity change
  const handleAddOnQuantityChange = (addOnId: string, quantity: number) => {
    setSelectedAddOns(
      selectedAddOns.map((a) =>
        a.addOnId === addOnId ? { ...a, quantity: Math.max(1, quantity) } : a,
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
        (sum, addon) => sum + (addon.price || 0),
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
          organizerId: eventData?.organizer._id,
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
        selectedAddOns: selectedAddOns.map((addon) => ({
          id: addon.id,
          name: addon.name,
          description: addon.description,
          price: addon.price,
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
        setExistingStallRequest(result.data);

        // Handle different request statuses
        if (result.data.status === "Confirmed") {
          setShowWhatsAppDialog(false);
          setShowRentForm(false);
          setShowTableSelection(true);
          await fetchAvailableTables();
          toast({
            duration: 5000,
            title: "Request Confirmed",
            description: "Please select your tables and add-ons",
          });
        } else if (result.data.status === "Pending") {
          // Request is pending
          setShowWhatsAppDialog(false);
          setShowRentForm(false);
          toast({
            duration: 5000,
            title: "Request Pending",
            description: "Your stall request is awaiting organizer approval",
          });
        } else if (result.data.status === "Processing") {
          // Tables already selected, awaiting payment
          setShowWhatsAppDialog(false);
          setShowRentForm(false);
          toast({
            duration: 5000,
            title: "Proceed to Payment",
            description: "Your tables are selected. Please complete payment.",
          });
        } else if (result.data.status === "Completed") {
          // Booking completed
          setShowWhatsAppDialog(false);
          setShowRentForm(false);
          toast({
            duration: 5000,
            title: "Booking Completed",
            description: "Your stall booking is confirmed and paid",
          });
        } else if (result.data.status === "Approved") {
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
        } else if (result.data.status === "Cancelled") {
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

  // Handle form submission - UPDATED FOR NEW WORKFLOW
  const handleRentFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    req(blank(d.nameOfApplicant), "Name of Applicant");
    req(blank(d.name), "Owner Name");
    req(blank(d.businessOwnerNationality), "Owner Nationality");
    req(blank(d.residency), "Residency");
    req(blank(d.brandName), "Brand Name");
    req(blank(d.shopName), "Registered Business Name");
    if (!shopkeeperExists) req(blank(d.email), "Primary Email");
    req(blank(d.businessEmail), "Business Email");
    req(blank(d.whatsappNumber), "WhatsApp Number");
    req(blank(d.phone), "Phone Number");
    req(blank(d.businessCategory), "Business Category");
    req(!d.noOfOperators || Number(d.noOfOperators) < 1, "No. of Operators");
    req(blank(d.registrationNumber), "Registration Number");
    req(blank(d.faceBookLink), "Facebook Link");
    req(blank(d.instagramLink), "Instagram Link");
    req(blank(d.description), "Business, Products & Brand Description");
    req(blank(d.refundPaymentDescription), "Refund Payment Description");
    req(blank(d.address), "Full Address");

    // Document uploads + at least one product image are mandatory. A returning
    // vendor's stored images are loaded as previews, so an existing preview
    // satisfies the requirement (no forced re-upload); a new file overrides it.
    req(!regImageFile && !regImagePreview, "Business Registration Document");
    req(!logoFile && !logoPreview, "Company Logo");
    req(
      productFiles.length < 1 && existingProductImages.length < 1,
      "at least 1 Product Image",
    );

    // Preferred space type — only required when the event exposes sellable
    // space templates (same condition that renders the picker).
    const sellableTemplates =
      eventData?.tableTemplates?.filter((t: any) => t.forSale !== false) || [];
    if (sellableTemplates.length > 0) {
      req(blank(d.preferredTemplateId), "Preferred Space Type");
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

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("eventId", eventData?._id || "");
      formData.append("organizerId", eventData?.organizer._id || "");

      // Append standard info
      // For an existing vendor we pass the id (update path); for a new one the
      // backend creates the record. Either way we send the full profile so any
      // edits made on the form persist back to the vendors collection.
      if (shopkeeperExists && shopkeeperId) {
        formData.append("shopkeeperId", shopkeeperId);
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
      if (shopkeeperDetails.preferredTemplateId)
        formData.append("preferredTemplateId", shopkeeperDetails.preferredTemplateId);
      if (shopkeeperDetails.preferredTemplateName)
        formData.append("preferredTemplateName", shopkeeperDetails.preferredTemplateName);

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

      setShowRentForm(false);
      setShopkeeperDetails(initialForm);
      setRegImageFile(null);
      setRegImagePreview("");
      setLogoFile(null);
      setLogoPreview("");
      setProductFiles([]);
      setProductPreviews([]);
      setExistingProductImages([]);
      setStallMembership(null);
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

  const handleGetTickets = async () => {
    if (!eventData || !eventData.organizer) return;

    const { visitorTypes } = eventData;
    let cartItems: any[] = [];

    if (visitorTypes && visitorTypes.length > 0) {
      // Single selected visitor type
      const vt = visitorTypes[selectedVisitorType];
      if (!vt) return;

      cartItems = [
        {
          eventId: eventData._id,
          eventTitle: eventData.title,
          ticketType: vt.name,
          price: Number(vt.price) || 0,
          quantity: 1,
          maxQuantity: Number(vt.maxCount) || 100,
          organizerId: eventData.organizer._id,
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
          organizerId: eventData.organizer._id,
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

    const existingCart = JSON.parse(localStorage.getItem("ticketCart") || "{}");
    const existingItems = existingCart.items || [];
    const existingEventId =
      existingItems.length > 0 ? existingItems[0].eventId : null;

    if (existingEventId && existingEventId !== eventData._id) {
      alert(
        "Please complete your ticket purchase for the current event before purchasing tickets for another event.",
      );
      return;
    }

    const newCartData = {
      items: cartItems,
      eventInfo: {
        id: eventData._id,
        title: eventData.title,
        organizerId: eventData.organizer._id,
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
  const hasReels = cleanedReelLinks.length > 0;
  const hasVenueLayout =
    (venueTables && Object.keys(venueTables).length > 0) ||
    roundTableData.length > 0;

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
    return base.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
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
  const totalTickets = Math.max(Number(rawOriginalTotal) || 0, availableTickets);

  // Extract layout IDs from venueConfig
  const layoutIds = venueConfig?.map((config) => config.id) || [];
  const currentLayoutId = layoutIds[currentLayoutIndex] || "default";

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

  const handleAddOnSelect = (addon: any) => {
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

  // Increase quantity
  const handleIncreaseQuantity = (addonId: string) => {
    setSelectedAddOns((prev) =>
      prev.map((a) =>
        a.id === addonId ? { ...a, quantity: a.quantity + 1 } : a,
      ),
    );
  };

  // Decrease/Remove quantity
  const handleRemoveAddOn = (addonId: string) => {
    setSelectedAddOns((prev) => {
      return prev
        .map((a) =>
          a.id === addonId
            ? { ...a, quantity: Math.max(0, a.quantity - 1) }
            : a,
        )
        .filter((a) => a.quantity > 0);
    });
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
        @keyframes gallerySlideIn {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
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
              backgroundColor={
                (eventData as any).adBar.bgColor || "#000000"
              }
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
        {/* Subtle dark scrim for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />

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

        {/* Hero bottom content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-8">
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
              className="text-white font-black text-2xl sm:text-4xl lg:text-5xl xl:text-6xl leading-tight drop-shadow-sm"
              style={{ fontFamily: design?.fontFamily }}
            >
              {title}
            </h1>
          </div>
        </div>
      </div>

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
                <p className="text-gray-900 font-bold text-sm sm:text-base">
                  {new Date(startDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
              <p className="text-gray-900 font-bold text-sm sm:text-base">
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
              <p className="text-gray-900 font-bold text-sm sm:text-base leading-snug">
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
              <p className="text-gray-900 font-bold text-sm sm:text-base">
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
                <p className="text-gray-900 font-bold text-sm sm:text-base">
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
                    <p className="text-gray-900 font-bold text-sm sm:text-base">
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
          <div className="flex-1 min-w-0 space-y-8 anim-fade-up order-2 lg:order-1">
            {/* About Section */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
                About This Event
              </h2>
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                {description}
              </p>
            </section>

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
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

            {/* Gallery */}
            {gallery && gallery.length > 0 && (
              <section>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
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

            {/* History (Instagram reels) moved out of this column — it now
                renders as a full-width section below the main content +
                sidebar row. See the "History — full-width reel marquee"
                block further down. */}

            {/* Speaker Carousel */}
            {eventData?.speakers && eventData.speakers.length > 0 && (
              <section>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                  Speakers
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
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
                          {speaker.isKeynote && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                              KEYNOTE
                            </span>
                          )}
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
              </section>
            )}

            {/* Visitor Types */}
            {visitorTypes && visitorTypes.length > 0 && (
              <section>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                  Ticket Types
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visitorTypes.map((vt: any, idx: number) => (
                    <div
                      key={vt.id || idx}
                      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
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
              {/* ── Ticket Purchase Card — only if tickets exist ── */}
              {visitorTypes && visitorTypes.length > 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="p-5 sm:p-6">
                    {/* Multiple Visitor Types — select one */}
                    {visitorTypes && visitorTypes.length > 0 ? (
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

                    {/* Buy Tickets CTA — only if visitorTypes exist */}
                    {visitorTypes && visitorTypes.length > 0 && (
                      <button
                        onClick={handleGetTickets}
                        className="w-full h-12 sm:h-14 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-md hover:shadow-lg mb-3"
                        style={{
                          background: `linear-gradient(135deg, ${design?.primaryColor || "#f97316"}, ${design?.secondaryColor || "#ef4444"})`,
                        }}
                      >
                        <Ticket className="h-5 w-5" />
                        Buy Tickets
                      </button>
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
                    className="w-full h-11 rounded-xl border-2 font-semibold text-sm transition-all hover:opacity-90"
                    style={{
                      borderColor: design?.primaryColor || "#f97316",
                      color: design?.primaryColor || "#f97316",
                    }}
                  >
                    Rent a Stall / Preview Request
                  </button>
                  {/* Member entry point — small link under the main CTA.
                      Clicking opens the Google-verified Member dialog
                      which either shows the existing membership card or
                      lets the exhibitor purchase a plan. */}
                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={() => setShowMemberDialog(true)}
                      className="text-xs font-medium hover:underline inline-flex items-center gap-1"
                      style={{
                        color: design?.primaryColor || "#f97316",
                      }}
                    >
                      ⭐ Become a member
                    </button>
                  </div>
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
                      onClick={() => {
                        setShowSpeakerDialog(true);
                        setSpeakerStep("whatsapp");
                        setSpeakerWhatsApp("");
                        setSpeakerOtp("");
                        setSpeakerOtpSent(false);
                        setSpeakerVerified(false);
                        setExistingSpeakerRequest(null);
                      }}
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
                      className="text-lg font-bold tracking-widest uppercase mb-4"
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
                      if (first === "p" || first === "post" || first === "posts")
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
                          className="text-lg font-bold tracking-widest uppercase mb-4"
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
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
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
            {((venueTables && Object.keys(venueTables).length > 0) ||
              roundTableData.length > 0) && (
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
          {false && (() => {
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
                      className="text-lg font-bold tracking-widest uppercase"
                      style={{ color: design?.primaryColor }}
                    >
                      Reels Carousel
                    </p>
                    <span className="text-xs text-gray-400 font-medium">
                      {cleanedReelLinks.length}{" "}
                      {cleanedReelLinks.length === 1 ? "reel" : "reels"}
                    </span>
                  </div>
                  <div
                    ref={reelMarqueeRef}
                    className="overflow-hidden"
                  >
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
                className="text-lg font-bold tracking-widest uppercase mb-5"
                style={{ color: design?.primaryColor }}
              >
                About Organizer
              </p>
              <div className="flex items-start space-x-4 mb-5">
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
                  style={{ backgroundColor: design?.primaryColor || "#f97316" }}
                >
                  {organizer.organizationName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">
                    {organizer.organizationName}
                  </h3>
                  <p className="text-gray-500 text-sm">{organizer.name}</p>
                  <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                    {organizer.bio}
                  </p>
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
              const headingStyle = { color: design?.primaryColor };
              const cardCls =
                "rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm";
              const titleCls =
                "text-lg font-bold tracking-widest uppercase mb-3";
              const htmlCls =
                "text-gray-600 prose prose-sm max-w-none [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4";
              const customs = Array.isArray((eventData as any)?.customSections)
                ? ((eventData as any).customSections as any[])
                : [];
              return (
                <>
                  {shown("ageDress") && (ageRestriction || dresscode) && (
                    <div className={cardCls}>
                      <p className={titleCls} style={headingStyle}>
                        Age Restriction &amp; Dress Code
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {ageRestriction && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                              Age Restriction
                            </p>
                            <p className="text-gray-700 text-sm">
                              {ageRestriction}
                            </p>
                          </div>
                        )}
                        {dresscode && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                              Dress Code
                            </p>
                            <p className="text-gray-700 text-sm">
                              {dresscode}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {shown("specialInstructions") && specialInstructions && (
                    <div className={cardCls}>
                      <p className={titleCls} style={headingStyle}>
                        Special Instructions
                      </p>
                      <div
                        className={htmlCls}
                        dangerouslySetInnerHTML={{
                          __html: specialInstructions,
                        }}
                      />
                    </div>
                  )}
                  {shown("refundPolicy") && refundPolicy && (
                    <div className={cardCls}>
                      <p className={titleCls} style={headingStyle}>
                        Refund Policy
                      </p>
                      <div
                        className={htmlCls}
                        dangerouslySetInnerHTML={{ __html: refundPolicy }}
                      />
                    </div>
                  )}
                  {shown("termsAndConditions") && termsAndConditions && (
                    <div className={cardCls}>
                      <p className={titleCls} style={headingStyle}>
                        Terms &amp; Conditions
                      </p>
                      <div
                        className={htmlCls}
                        dangerouslySetInnerHTML={{
                          __html: termsAndConditions,
                        }}
                      />
                    </div>
                  )}
                  {customs
                    .filter(
                      (s: any) =>
                        ((s?.heading || "").trim() ||
                          (s?.content || "").trim()) &&
                        shown(s?.id),
                    )
                    .map((s: any) => (
                      <div key={s.id || s.heading} className={cardCls}>
                        {(s.heading || "").trim() && (
                          <p className={titleCls} style={headingStyle}>
                            {s.heading}
                          </p>
                        )}
                        {(s.content || "").trim() && (
                          <div
                            className={htmlCls}
                            dangerouslySetInnerHTML={{ __html: s.content }}
                          />
                        )}
                      </div>
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
                  className="text-lg font-bold tracking-widest uppercase mb-6"
                  style={{ color: design?.primaryColor }}
                >
                  Speaker Lineup
                </p>

                {/* Keynote Speakers */}
                {eventData.speakers.filter((s: any) => s.isKeynote).length >
                  0 && (
                  <div className="mb-8">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                      Keynote Speakers
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {eventData.speakers
                        .filter((s: any) => s.isKeynote)
                        .map((speaker: any) => (
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
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                                  KEYNOTE
                                </span>
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
                {eventData.speakers.filter((s: any) => !s.isKeynote).length >
                  0 && (
                  <div>
                    {eventData.speakers.filter((s: any) => s.isKeynote).length >
                      0 && (
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
                                {speaker.slots.map((slot: any, si: number) => (
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
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="venue" className="mt-4 space-y-6">
            {(venueTables && Object.keys(venueTables).length > 0) ||
            roundTableData.length > 0 ? (
              <div className="space-y-5">
                {/* Layout Selector */}
                {venueConfig && venueConfig.length > 1 && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <MapIcon className="h-4 w-4 text-gray-400" />
                        <p
                          className="text-lg font-bold tracking-widest uppercase"
                          style={{ color: design?.primaryColor }}
                        >
                          Venue Layouts
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 font-medium">
                        {currentLayoutIndex + 1} of {venueConfig.length}
                      </span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {venueConfig.map((layout, index) => (
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
                      ))}
                    </div>
                  </div>
                )}
                {/* Current Layout Display — the header row doubles as
                    a toggle so the heavy canvas only renders when the
                    user expands it. Chevron sits on the right of the
                    "Table Arrangement" title so the whole strip reads
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
                        className="text-lg font-bold tracking-widest uppercase text-left"
                        style={{ color: design?.primaryColor }}
                      >
                        {venueConfig[currentLayoutIndex].name} — Table
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
                            {venueConfig[currentLayoutIndex]?.hasMainStage && (
                              <div
                                className="absolute bg-purple-200 border-2 border-purple-500 flex items-center justify-center font-bold text-purple-700 shadow-md"
                                style={{
                                  top: "0px",
                                  left: "50%",
                                  transform: "translateX(-50%)",
                                  width: "200px",
                                  height: "60px",
                                  zIndex: 10,
                                }}
                              >
                                MAIN STAGE
                              </div>
                            )}
                            {venueTables[currentLayoutId]
                              ?.filter((table) => inCrop(table.x, table.y))
                              .map((table) => {
                              const isBooked = table.isBooked;
                              const notForSale = (table as any).forSale === false;
                              return (
                                <div
                                  key={table.positionId}
                                  className={`absolute border flex items-center justify-center transition-all group hover:z-50 ${
                                    table.type === "Round"
                                      ? "rounded-full"
                                      : table.type === "Corner"
                                        ? "rounded-lg"
                                        : "rounded-sm"
                                  } ${notForSale
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
                                    zIndex: 5,
                                    // Darker tint of the template colour with a
                                    // solid coloured border; bold dark label so
                                    // it stays clearly readable. Booked stays
                                    // uniform (we don't reveal availability).
                                    ...(notForSale
                                      ? {
                                          backgroundColor:
                                            ((table as any).color || "#f59e0b") +
                                            "59",
                                          borderColor:
                                            (table as any).color || "#f59e0b",
                                          backgroundImage:
                                            "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 6px)",
                                        }
                                      : {
                                          backgroundColor:
                                            ((table as any).color || "#22c55e") +
                                            "80",
                                          borderColor:
                                            (table as any).color || "#22c55e",
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
                                    <div
                                      className="pointer-events-none absolute bottom-full left-1/2 z-[100] mb-3 w-max opacity-0 transition-opacity group-hover:opacity-100"
                                      style={{
                                        transform: `translateX(-50%) rotate(-${table.rotation || 0}deg)`,
                                        transformOrigin: "bottom center",
                                      }}
                                    >
                                      <div className="relative">
                                        <div className="rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-2xl border border-gray-700 flex flex-col gap-0.5">
                                          <div className="font-bold text-sm whitespace-nowrap">
                                            {table.name}
                                          </div>
                                          <div className="text-gray-300 whitespace-nowrap">
                                            {table.type} · Row {table.rowNumber}
                                          </div>
                                          <div className="text-gray-300 whitespace-nowrap">
                                            {table.width * 10}×{table.height * 10}cm
                                          </div>
                                          <div className="text-green-400 font-semibold whitespace-nowrap">
                                            {formatPrice(table.tablePrice)}
                                          </div>
                                        </div>

                                        {/* Arrow tail */}
                                        <div className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-900 border-b border-r border-gray-700"></div>
                                      </div>
                                    </div>
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
                                const mySelection = roundTableSelections.find(
                                  (sel) =>
                                    sel.tablePositionId === rt.positionId,
                                );
                                const mySelectedChairs =
                                  mySelection?.selectedChairIndices || [];
                                const isFullyBooked =
                                  rt.isFullyBooked ||
                                  bookedChairs.length >= rt.numberOfChairs;
                                const diameter = rt.tableDiameter || 120;
                                const chairSz = Math.max(12, diameter * 0.14);
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
                                        isReference
                                          ? `${rt.name} — Not for sale`
                                          : rt.name
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
                                        cx + chairR * Math.cos(a) - chairSz / 2;
                                      const py =
                                        cy + chairR * Math.sin(a) - chairSz / 2;
                                      const bk = bookedChairs.includes(i);
                                      const sl = mySelectedChairs.includes(i);
                                      return (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => handleChairClick(i)}
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
                                          title={`Seat ${i + 1} — ${bk ? "Taken" : sl ? "Selected" : "Available"}${rt.sellingMode === "chair" && !isReference ? ` · ${formatPrice(rtChairPrice(rt))}` : ""}`}
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
                    </div>
                    )}
                  </div>
                )}

                {/* Add-On Items */}
                {addOnItems && addOnItems.length > 0 && (
                  <div className="space-y-3">
                    <p
                      className="text-lg font-bold tracking-widest uppercase"
                      style={{ color: design?.primaryColor }}
                    >
                      Add-On Items
                    </p>
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
                              {item.price}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
                tables alongside the Spaces). */}
            {roundTableData.length > 0 && (
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
                        style={{ backgroundColor: `${design?.primaryColor}10` }}
                      >
                        <span className="text-sm font-medium text-gray-600">
                          {roundTableSelections.reduce(
                            (sum, s) => sum + s.selectedChairIndices.length,
                            0,
                          )}{" "}
                          seat(s)
                        </span>
                        <span className="text-sm text-gray-400">&middot;</span>
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
                                    backgroundColor: sample.color || "#8B5CF6",
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
                                    className="absolute flex items-center justify-center font-bold rounded-b-lg"
                                    style={{
                                      top: 0,
                                      left: "50%",
                                      transform: "translateX(-50%)",
                                      width: 200,
                                      height: 50,
                                      zIndex: 10,
                                      fontSize: 11,
                                      letterSpacing: 3,
                                      background:
                                        "linear-gradient(180deg, #ddd6fe, #c4b5fd)",
                                      color: "#6d28d9",
                                      borderBottom: "2px solid #8b5cf6",
                                    }}
                                  >
                                    MAIN STAGE
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
                                            x.tablePositionId !== rt.positionId,
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
                                      ? mySelectedChairs.filter((c) => c !== ci)
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
                                        {isReference ? "Reference" : rt.category}
                                      </span>
                                    </div>

                                    {/* Chairs */}
                                    {Array.from({
                                      length: rt.numberOfChairs,
                                    }).map((_, i) => {
                                      const a =
                                        (2 * Math.PI * i) / rt.numberOfChairs -
                                        Math.PI / 2;
                                      const px =
                                        cx + chairR * Math.cos(a) - chairSz / 2;
                                      const py =
                                        cy + chairR * Math.sin(a) - chairSz / 2;
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
                                { focusRingColor: design?.primaryColor } as any
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
                      {(() => {
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
                                                  updateGuest("whatsApp", value)
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
                            const results = await Promise.all(bookingPromises);
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
                            const successful = results.filter((r) => r.success);
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

        <EventFeedbackTokenHandler
          eventId={id || eventData?._id || ""}
        />
      </div>

      {/* WhatsApp Verification Dialog */}
      {/* Speaker WhatsApp Flow Dialog */}
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
                  {speakerStep === "whatsapp"
                    ? "Verify your WhatsApp number to continue"
                    : speakerStep === "status"
                      ? "Your application status"
                      : speakerStep === "timeslot"
                        ? "Select your session time slot"
                        : speakerStep === "done"
                          ? "Your speaker pass is ready"
                          : "Submit your application"}
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
              {/* STEP 1: WhatsApp Verification */}
              {speakerStep === "whatsapp" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      WhatsApp Number *
                    </label>
                    <PhoneInput
                      value={speakerWhatsApp}
                      onChange={setSpeakerWhatsApp}
                      disabled={speakerOtpSent}
                      enableSearch={true}
                      countryCodeEditable={false}
                      preferredCountries={["in", "sg", "us", "gb"]}
                      inputProps={{
                        name: "speakerWhatsApp",
                        required: true,
                      }}
                      inputStyle={{
                        width: "100%",
                        height: "44px",
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
                  </div>

                  {!speakerOtpSent ? (
                    <button
                      disabled={
                        sendingSpeakerOtp ||
                        !speakerWhatsApp ||
                        speakerWhatsApp.length < 10
                      }
                      onClick={async () => {
                        setSendingSpeakerOtp(true);
                        try {
                          const res = await fetch(
                            `${apiURL}/otp/send-whatsapp-otp`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                whatsappNumber: speakerWhatsApp,
                                role: "speaker",
                              }),
                            },
                          );
                          if (!res.ok) throw new Error("Failed to send OTP");
                          const data = await res.json();
                          if (data.message === "OTP sent to WhatsApp") {
                            setSpeakerOtpSent(true);
                            toast({
                              title: "OTP Sent",
                              description: "Check your WhatsApp",
                            });
                          }
                        } catch (err: any) {
                          toast({
                            title: "Error",
                            description: err.message,
                            variant: "destructive",
                          });
                        } finally {
                          setSendingSpeakerOtp(false);
                        }
                      }}
                      className="w-full h-11 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
                      style={{
                        backgroundColor: design?.primaryColor || "#6366f1",
                      }}
                    >
                      {sendingSpeakerOtp
                        ? "Sending..."
                        : "Send OTP via WhatsApp"}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Enter OTP
                        </label>
                        <input
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-center tracking-[0.5em] font-mono text-lg"
                          placeholder="------"
                          maxLength={6}
                          value={speakerOtp}
                          onChange={(e) => setSpeakerOtp(e.target.value)}
                        />
                      </div>
                      <button
                        disabled={verifyingSpeakerOtp || speakerOtp.length < 4}
                        onClick={async () => {
                          setVerifyingSpeakerOtp(true);
                          try {
                            const res = await fetch(
                              `${apiURL}/otp/verify-chat-otp`,
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  whatsappNumber: speakerWhatsApp.startsWith(
                                    "+",
                                  )
                                    ? speakerWhatsApp
                                    : `+${speakerWhatsApp}`,
                                  otp: speakerOtp,
                                  role: "speaker",
                                }),
                              },
                            );
                            const data = await res.json();
                            if (!res.ok)
                              throw new Error(data.message || "Invalid OTP");

                            setSpeakerVerified(true);
                            setSpeakerFormData((p: any) => ({
                              ...p,
                              phone: speakerWhatsApp,
                            }));

                            // Check for existing speaker request
                            if (eventData?._id) {
                              const checkRes = await fetch(
                                `${apiURL}/speaker-requests/event/${eventData._id}`,
                              );
                              const checkData = await checkRes.json();
                              const existing = (checkData.data || []).find(
                                (r: any) =>
                                  r.phone === speakerWhatsApp &&
                                  !["Cancelled", "Rejected"].includes(r.status),
                              );

                              if (existing) {
                                setExistingSpeakerRequest(existing);
                                // Fetch booked slots for time validation
                                const allRequests = checkData.data || [];
                                setBookedSpeakerSlots(
                                  allRequests
                                    .filter(
                                      (r: any) =>
                                        r.status !== "Cancelled" &&
                                        r.status !== "Rejected" &&
                                        r._id !== existing._id,
                                    )
                                    .flatMap((r: any) =>
                                      (r.sessions || []).filter(
                                        (s: any) => s.confirmedStartTime,
                                      ),
                                    ),
                                );

                                if (existing.status === "Pending")
                                  setSpeakerStep("status");
                                else if (existing.status === "Confirmed")
                                  setSpeakerStep("timeslot");
                                else if (existing.status === "Processing")
                                  setSpeakerStep("status");
                                else if (existing.status === "Completed")
                                  setSpeakerStep("done");
                                else setSpeakerStep("form");
                              } else {
                                // Fetch booked slots
                                setBookedSpeakerSlots(
                                  (checkData.data || [])
                                    .filter(
                                      (r: any) =>
                                        !["Cancelled", "Rejected"].includes(
                                          r.status,
                                        ),
                                    )
                                    .flatMap((r: any) =>
                                      (r.sessions || []).filter(
                                        (s: any) => s.confirmedStartTime,
                                      ),
                                    ),
                                );
                                setSpeakerStep("form");
                              }
                            } else {
                              setSpeakerStep("form");
                            }

                            toast({
                              title: "Verified!",
                              description: "WhatsApp number verified",
                            });
                          } catch (err: any) {
                            toast({
                              title: "Error",
                              description: err.message,
                              variant: "destructive",
                            });
                          } finally {
                            setVerifyingSpeakerOtp(false);
                          }
                        }}
                        className="w-full h-11 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
                        style={{
                          backgroundColor: design?.primaryColor || "#6366f1",
                        }}
                      >
                        {verifyingSpeakerOtp ? "Verifying..." : "Verify OTP"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP: STATUS (Pending/Processing) */}
              {speakerStep === "status" && existingSpeakerRequest && (
                <div className="text-center py-6 space-y-4">
                  <div
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                      existingSpeakerRequest.status === "Pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {existingSpeakerRequest.status === "Pending" ? "⏳" : "⚙️"}{" "}
                    {existingSpeakerRequest.status}
                  </div>
                  <h3 className="text-lg font-bold">
                    {existingSpeakerRequest.status === "Pending"
                      ? "Your Application is Under Review"
                      : "Your Session is Being Processed"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {existingSpeakerRequest.status === "Pending"
                      ? "The organizer will review your application and notify you via WhatsApp."
                      : "Your time slot has been selected. Waiting for payment confirmation."}
                  </p>
                  {existingSpeakerRequest.sessions?.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 text-left text-sm">
                      <p className="font-medium mb-1">
                        Session: {existingSpeakerRequest.sessions[0].topic}
                      </p>
                      {existingSpeakerRequest.sessions[0]
                        .confirmedStartTime && (
                        <p className="text-gray-500">
                          Time:{" "}
                          {
                            existingSpeakerRequest.sessions[0]
                              .confirmedStartTime
                          }{" "}
                          -{" "}
                          {existingSpeakerRequest.sessions[0].confirmedEndTime}
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => setShowSpeakerDialog(false)}
                    className="w-full h-11 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm"
                  >
                    Close
                  </button>
                </div>
              )}

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
                    Your QR code has been sent to your WhatsApp. You can also
                    download it below.
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
              {speakerStep === "form" && (
                <div className="space-y-4">
                  {/* Photo Upload */}
                  <div className="flex items-center gap-4">
                    <div
                      className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors bg-gray-50 flex-shrink-0"
                      onClick={() =>
                        document.getElementById("speaker-apply-photo")?.click()
                      }
                    >
                      {speakerFormData.photoPreview ? (
                        <img
                          src={speakerFormData.photoPreview}
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
                        if (file)
                          setSpeakerFormData({
                            ...speakerFormData,
                            photoFile: file,
                            photoPreview: URL.createObjectURL(file),
                          });
                      }}
                    />
                    <div className="text-xs text-gray-500">
                      <p className="font-medium text-gray-700">
                        Upload your photo
                      </p>
                      <p>This will be displayed on the event page</p>
                    </div>
                  </div>

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
                          setSpeakerFormData({
                            ...speakerFormData,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        placeholder="you@example.com"
                        value={speakerFormData.email}
                        onChange={(e) =>
                          setSpeakerFormData({
                            ...speakerFormData,
                            email: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Title / Role
                      </label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        placeholder="e.g. CTO, Professor"
                        value={speakerFormData.title}
                        onChange={(e) =>
                          setSpeakerFormData({
                            ...speakerFormData,
                            title: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Organization
                      </label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        placeholder="Company / University"
                        value={speakerFormData.organization}
                        onChange={(e) =>
                          setSpeakerFormData({
                            ...speakerFormData,
                            organization: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
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
                        setSpeakerFormData({
                          ...speakerFormData,
                          bio: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Area of Expertise
                    </label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      placeholder="e.g. AI/ML, Marketing, Finance"
                      value={speakerFormData.expertise}
                      onChange={(e) =>
                        setSpeakerFormData({
                          ...speakerFormData,
                          expertise: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      Proposed Session
                    </p>

                    {/* Show available speaker slots from event */}
                    {eventData?.speakerSlotTemplates?.filter(
                      (s: any) => s.openForApplications,
                    ).length > 0 && (
                      <div className="mb-3">
                        <label className="text-xs font-medium text-gray-700 block mb-1">
                          Apply for Speaker Space
                        </label>
                        <select
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                          value={speakerFormData.selectedSlotId || ""}
                          onChange={(e) => {
                            const slotId = e.target.value;
                            const slot = eventData?.speakerSlotTemplates?.find(
                              (s: any) => s.id === slotId,
                            );
                            setSpeakerFormData({
                              ...speakerFormData,
                              selectedSlotId: slotId,
                              selectedSlotName: slot?.name || "",
                            });
                          }}
                        >
                          <option value="">
                            Select a speaker space (optional)
                          </option>
                          {eventData.speakerSlotTemplates
                            .filter((s: any) => s.openForApplications)
                            .map((slot: any) => (
                              <option key={slot.id} value={slot.id}>
                                {slot.name}{" "}
                                {slot.isMainStage ? "(Main Stage)" : ""}{" "}
                                {slot.slotPrice > 0
                                  ? `- Fee applies`
                                  : "- Free"}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Session Topic *
                      </label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        placeholder="What will you speak about?"
                        value={speakerFormData.sessionTopic}
                        onChange={(e) =>
                          setSpeakerFormData({
                            ...speakerFormData,
                            sessionTopic: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="mt-3">
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Session Description
                      </label>
                      <textarea
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                        placeholder="Brief description of your session..."
                        value={speakerFormData.sessionDescription}
                        onChange={(e) =>
                          setSpeakerFormData({
                            ...speakerFormData,
                            sessionDescription: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      Additional Info
                    </p>
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
                          setSpeakerFormData({
                            ...speakerFormData,
                            previousSpeakingExperience: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="mt-3">
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Equipment Needed
                      </label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        placeholder="e.g. Projector, Whiteboard, Microphone"
                        value={speakerFormData.equipmentNeeded}
                        onChange={(e) =>
                          setSpeakerFormData({
                            ...speakerFormData,
                            equipmentNeeded: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <input
                        className="border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                        placeholder="LinkedIn URL"
                        value={speakerFormData.socialLinks.linkedin}
                        onChange={(e) =>
                          setSpeakerFormData({
                            ...speakerFormData,
                            socialLinks: {
                              ...speakerFormData.socialLinks,
                              linkedin: e.target.value,
                            },
                          })
                        }
                      />
                      <input
                        className="border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Twitter URL"
                        value={speakerFormData.socialLinks.twitter}
                        onChange={(e) =>
                          setSpeakerFormData({
                            ...speakerFormData,
                            socialLinks: {
                              ...speakerFormData.socialLinks,
                              twitter: e.target.value,
                            },
                          })
                        }
                      />
                      <input
                        className="border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Website URL"
                        value={speakerFormData.socialLinks.website}
                        onChange={(e) =>
                          setSpeakerFormData({
                            ...speakerFormData,
                            socialLinks: {
                              ...speakerFormData.socialLinks,
                              website: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowSpeakerDialog(false)}
                      className="flex-1 h-11 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={
                        speakerSubmitting ||
                        !speakerFormData.name ||
                        !speakerFormData.email ||
                        !speakerFormData.sessionTopic
                      }
                      onClick={async () => {
                        setSpeakerSubmitting(true);
                        try {
                          let res;
                          if (speakerFormData.photoFile) {
                            // Use FormData with image upload
                            const fd = new FormData();
                            fd.append("image", speakerFormData.photoFile);
                            fd.append("eventId", eventData?._id || "");
                            fd.append(
                              "organizerId",
                              String(
                                eventData?.organizer?._id ||
                                  eventData?.organizer ||
                                  "",
                              ),
                            );
                            fd.append("name", speakerFormData.name);
                            fd.append("email", speakerFormData.email);
                            fd.append("phone", speakerFormData.phone || "");
                            fd.append("title", speakerFormData.title || "");
                            fd.append(
                              "organization",
                              speakerFormData.organization || "",
                            );
                            fd.append("bio", speakerFormData.bio || "");
                            fd.append(
                              "expertise",
                              speakerFormData.expertise || "",
                            );
                            fd.append(
                              "previousSpeakingExperience",
                              speakerFormData.previousSpeakingExperience || "",
                            );
                            fd.append(
                              "equipmentNeeded",
                              speakerFormData.equipmentNeeded || "",
                            );
                            fd.append("notes", speakerFormData.notes || "");
                            fd.append(
                              "socialLinks",
                              JSON.stringify(speakerFormData.socialLinks),
                            );
                            fd.append("source", "external");
                            fd.append(
                              "sessions",
                              JSON.stringify([
                                {
                                  topic: speakerFormData.sessionTopic,
                                  description:
                                    speakerFormData.sessionDescription,
                                },
                              ]),
                            );
                            res = await fetch(
                              `${apiURL}/speaker-requests/apply-with-image`,
                              { method: "POST", body: fd },
                            );
                          } else {
                            // JSON without image
                            res = await fetch(
                              `${apiURL}/speaker-requests/apply`,
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  eventId: eventData?._id,
                                  organizerId:
                                    eventData?.organizer?._id ||
                                    eventData?.organizer,
                                  name: speakerFormData.name,
                                  email: speakerFormData.email,
                                  phone: speakerFormData.phone,
                                  title: speakerFormData.title,
                                  organization: speakerFormData.organization,
                                  bio: speakerFormData.bio,
                                  expertise: speakerFormData.expertise,
                                  previousSpeakingExperience:
                                    speakerFormData.previousSpeakingExperience,
                                  equipmentNeeded:
                                    speakerFormData.equipmentNeeded,
                                  notes: speakerFormData.notes,
                                  socialLinks: speakerFormData.socialLinks,
                                  source: "external",
                                  sessions: [
                                    {
                                      topic: speakerFormData.sessionTopic,
                                      description:
                                        speakerFormData.sessionDescription,
                                    },
                                  ],
                                }),
                              },
                            );
                          }
                          const data = await res.json();
                          if (data.success) {
                            toast({
                              title: "Application submitted!",
                              description:
                                "The organizer will review your application.",
                            });
                            setShowSpeakerDialog(false);
                            setSpeakerFormData({
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
                              socialLinks: {
                                linkedin: "",
                                twitter: "",
                                website: "",
                              },
                            });
                          } else {
                            toast({
                              title: "Error",
                              description: data.message || "Failed to submit",
                              variant: "destructive",
                            });
                          }
                        } catch (err: any) {
                          toast({
                            title: "Error",
                            description: err.message || "Something went wrong",
                            variant: "destructive",
                          });
                        } finally {
                          setSpeakerSubmitting(false);
                        }
                      }}
                      className="flex-1 h-11 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-50"
                      style={{
                        backgroundColor: design?.primaryColor || "#6366f1",
                      }}
                    >
                      {speakerSubmitting
                        ? "Submitting..."
                        : "Submit Application"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
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

      <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Store className="h-6 w-6 text-blue-600" />
              <span>Sign in to Rent a Stall</span>
            </DialogTitle>
            <DialogDescription>
              Sign in with Google to continue with stall rental
            </DialogDescription>
          </DialogHeader>

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

      {/* Table Selection Dialog - NEW */}
      {/* ============================================================ */}
      {/* TABLE SELECTION DIALOG                                        */}
      {/* ============================================================ */}
      <Dialog open={showTableSelection} onOpenChange={setShowTableSelection}>
        <DialogContent className="max-w-7xl w-full max-h-[95vh] overflow-hidden p-0 flex flex-col">
          {/* Fixed header — stays put; only the body below scrolls. */}
          <div className="shrink-0 z-10 bg-white border-b px-6 py-4">
            <DialogTitle className="text-xl font-bold">
              Select Your Stall
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Choose your tables, add-ons, and accept the terms to proceed to
              payment.
            </DialogDescription>
          </div>

          {/* Scrollable body — the dialog frame + header stay fixed. */}
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0">
            {/* ── MAIN CONTENT AREA ── */}
            <div className="px-6 py-4 space-y-6">
              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-green-100 border-2 border-green-500 rounded" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-300 border-2 border-blue-600 rounded" />
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-gray-300 border-2 border-gray-500 rounded" />
                  <span>Booked</span>
                </div>
              </div>

              {/* Layout Selector — only if multiple halls */}
              {venueConfig && venueConfig.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {venueConfig.map((layout, index) => (
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
                  ))}
                </div>
              )}

              {/* ── VENUE LAYOUT — full width ── */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TableIcon className="h-4 w-4 text-blue-600" />
                    Venue Layout — Click a table to select it
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setVenueMaximized(true)}
                    className="text-xs"
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
                          width: `${venueDisplayCanvas.width}px`,
                          height: `${venueDisplayCanvas.height}px`,
                          minWidth: `${venueDisplayCanvas.width}px`,
                        }}
                      >
                        <div
                          className="relative shadow-sm border border-gray-300"
                          style={{
                            width: "100%",
                            height: "100%",
                            backgroundImage:
                              "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)",
                            backgroundSize: `${eventData?.venueConfig?.[currentLayoutIndex]?.gridSize || 40}px ${eventData?.venueConfig?.[currentLayoutIndex]?.gridSize || 40}px`,
                            backgroundColor: "#ffffff",
                          }}
                        >
                          {/* Main Stage */}
                          {eventData?.venueConfig?.[currentLayoutIndex]
                            ?.hasMainStage && (
                            <div
                              className="absolute bg-purple-200 border-2 border-purple-500 flex items-center justify-center font-bold text-purple-700 shadow-md"
                              style={{
                                top: 0,
                                left: "50%",
                                transform: "translateX(-50%)",
                                width: 200,
                                height: 60,
                                zIndex: 10,
                              }}
                            >
                              MAIN STAGE
                            </div>
                          )}

                          {/* Tables */}
                          {(availableTables[currentLayoutId] || [])
                            .filter((table) => inCrop(table.x, table.y))
                            .map((table) => {
                              const isSelected = selectedTables.some(
                                (t) => t.positionId === table.positionId,
                              );
                              const isBooked = table.isBooked;
                              const preferredId = existingStallRequest?.preferredTemplateId;
                              const isWrongTemplate = preferredId && table.id !== preferredId;
                              const isWrongCategory = !isCategoryAllowed(table);
                              const isNotForSale = table.forSale === false;

                              let bgColor = "bg-green-200/80";
                              let borderColor = "border-green-600";
                              let cursor =
                                "cursor-pointer hover:shadow-xl hover:ring-2 hover:ring-blue-400";

                              if (isNotForSale) {
                                bgColor = "bg-amber-100/50";
                                borderColor = "border-amber-300";
                                cursor = "cursor-default opacity-60";
                              } else if (isBooked) {
                                // Sold — clearly visible dark grey, not selectable.
                                bgColor = "bg-gray-500/90";
                                borderColor = "border-gray-700";
                                cursor = "cursor-not-allowed";
                              } else if (isWrongTemplate || isWrongCategory) {
                                // Not allowed for this exhibitor — darker grey
                                // so it's visible but obviously disabled.
                                bgColor = "bg-gray-400/80";
                                borderColor = "border-gray-500";
                                cursor = "cursor-not-allowed opacity-90";
                              } else if (isSelected) {
                                bgColor = "bg-blue-300";
                                borderColor = "border-blue-600";
                                cursor =
                                  "cursor-pointer shadow-lg ring-2 ring-blue-500";
                              }

                              return (
                                <div
                                  key={table.positionId}
                                  className={`absolute border flex items-center justify-center transition-all group hover:z-50 ${bgColor} ${borderColor} ${cursor} ${
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
                                  }}
                                  onClick={() => {
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
                                            {table.width * 10}×{table.height * 10}
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
                            },
                          )}
                          {/* Entrance / exit door markers */}
                          {renderDoors()}
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
                      Select any extras for your stall (single selection per
                      item)
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

              {/* ── TERMS & CONDITIONS — inline ── */}
              {eventData?.termsAndConditionsforStalls &&
                eventData.termsAndConditionsforStalls.length > 0 && (
                  <Card className="border-amber-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4 text-amber-600" />
                        Terms & Conditions for Exhibitors
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
                          Accept all mandatory terms to enable the Proceed to
                          Payment button.
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
                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    <span>
                      <strong>
                        {activeMembership?.planName || "Member"}
                      </strong>{" "}
                      pricing applied
                    </span>
                    {activeMembership?.endDate && (
                      <span className="text-xs text-emerald-700/80">
                        · valid till{" "}
                        {new Date(activeMembership.endDate).toLocaleDateString()}
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
                              Row {table.rowNumber} • {table.tableType}
                            </p>
                            <p className="text-gray-400">
                              {table.width * 10}cm × {table.height * 10}cm
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">
                              {formatPrice(table.tablePrice)}
                            </p>
                            <p className="text-gray-500">
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
                          className="flex justify-between text-xs py-1 border-b last:border-0"
                        >
                          <span className="text-gray-700 truncate flex-1 mr-2">
                            {addon.name}
                          </span>
                          <span className="font-semibold text-blue-600 flex-shrink-0">
                            {formatPrice(addon.price)}
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

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 items-center">
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
                <Button
                  onClick={() => setShowTableSelection(false)}
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={loading}
                >
                  Cancel
                </Button>
                {!allMandatoryTermsAccepted() && (
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
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
            <DialogTitle className="text-base font-bold">
              Venue Layout — {venueConfig?.[currentLayoutIndex]?.name}
            </DialogTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVenueMaximized(false)}
            >
              ✕ Close
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
                  "linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)",
                backgroundSize: `${eventData?.venueConfig?.[currentLayoutIndex]?.gridSize || 40}px ${eventData?.venueConfig?.[currentLayoutIndex]?.gridSize || 40}px`,
                backgroundColor: "#f1f5f9",
              }}
            >
              {/* Main Stage */}
              {eventData?.venueConfig?.[currentLayoutIndex]?.hasMainStage && (
                <div
                  className="absolute bg-purple-200 border-2 border-purple-500 flex items-center justify-center font-bold text-purple-700"
                  style={{
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 200,
                    height: 60,
                    zIndex: 10,
                  }}
                >
                  MAIN STAGE
                </div>
              )}

              {/* Tables */}
              {(availableTables[currentLayoutId] || [])
                .filter((table) => inCrop(table.x, table.y))
                .map((table) => {
                const isSelected = selectedTables.some(
                  (t) => t.positionId === table.positionId,
                );
                const isBooked = table.isBooked;
                const isWrongCategory = !isCategoryAllowed(table);

                let bg = "bg-green-200/80";
                let border = "border-green-600";
                let cur = "cursor-pointer hover:ring-2 hover:ring-blue-400";

                if (isBooked) {
                  bg = "bg-gray-500/90";
                  border = "border-gray-700";
                  cur = "cursor-not-allowed";
                } else if (isWrongCategory) {
                  bg = "bg-gray-400/80";
                  border = "border-gray-500";
                  cur = "cursor-not-allowed opacity-90";
                } else if (isSelected) {
                  bg = "bg-blue-300";
                  border = "border-blue-600";
                }

                return (
                  <div
                    key={table.positionId}
                    className={`absolute border-2 flex items-center justify-center transition-all group ${bg} ${border} ${cur} ${
                      table.type === "Round" ? "rounded-full" : "rounded-sm"
                    }`}
                    style={{
                      left: table.x,
                      top: table.y,
                      width:
                        (table as any).displayWidth ?? table.width,
                      height:
                        (table as any).displayHeight ?? table.height,
                      transform: `rotate(${table.rotation || 0}deg)`,
                      zIndex: isSelected ? 10 : 5,
                    }}
                    onClick={() => {
                      if (isBooked || isWrongCategory) return;
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
                          ) : isWrongCategory ? (
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
                        "Your tables are selected. Please complete payment."}
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

                      {/* Action Buttons for Processing State */}
                      <div className="space-y-3">
                        <Button className="w-full py-4 bg-blue-600 hover:bg-blue-700">
                          Proceed to Payment
                        </Button>

                        {/* The Payment Completed Button you requested */}
                      </div>
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
      {showRentForm && !showTableSelection && (
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Owner Nationality <span className="text-red-500">*</span>
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              {/* --- SECTION: CONTACT & VERIFICATION --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    WhatsApp Number <span className="text-red-500">*</span>
                  </Label>
                  <PhoneInput
                    value={shopkeeperDetails.whatsappNumber}
                    onChange={(whatsappNumber) =>
                      setShopkeeperDetails((prev) => ({
                        ...prev,
                        whatsappNumber,
                      }))
                    }
                    countryCodeEditable={false}
                    inputStyle={{
                      width: "100%",
                      height: "36px",
                      borderRadius: "6px",
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <PhoneInput
                    value={shopkeeperDetails.phone}
                    onChange={(phone) =>
                      setShopkeeperDetails((prev) => ({ ...prev, phone }))
                    }
                    countryCodeEditable={false}
                    inputStyle={{
                      width: "100%",
                      height: "36px",
                      borderRadius: "6px",
                    }}
                  />
                </div>
              </div>

              {/* --- SECTION: STALL CONFIGURATION --- */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>
                    Business Category <span className="text-red-500">*</span>
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
                <div className="space-y-2">
                  <Label>
                    No. of Operators <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    name="noOfOperators"
                    value={shopkeeperDetails.noOfOperators}
                    onChange={handleRentFormChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Registration Number{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    name="registrationNumber"
                    value={shopkeeperDetails.registrationNumber}
                    onChange={handleRentFormChange}
                    placeholder="Registration Number"
                    required
                  />
                </div>
              </div>

              {/* --- SECTION: SOCIAL & IMAGES --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              {/* Image Uploads */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
                <h3 className="font-semibold text-gray-800">
                  Brand Assets & Documents
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Reg Image */}
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

                  {/* Logo */}
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
                </div>

                {/* Product Images */}
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
                        productFiles.length + existingProductImages.length >= 5
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
              </div>

              {/* Description */}
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

              {/* Preferred Space Template */}
              {eventData?.tableTemplates && eventData.tableTemplates.filter((t: any) => t.forSale !== false).length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <Label>Preferred Space Type <span className="text-red-500">*</span></Label>
                  <p className="text-[11px] text-gray-400 mb-2">Select the type of space you're interested in. You'll only be able to book spaces of this type.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {eventData.tableTemplates.filter((t: any) => t.forSale !== false).map((template: any) => {
                      const isSelected = shopkeeperDetails.preferredTemplateId === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setShopkeeperDetails({
                            ...shopkeeperDetails,
                            preferredTemplateId: template.id,
                            preferredTemplateName: template.name,
                          })}
                          className={`text-left p-3 rounded-xl border-2 transition-all ${isSelected ? "shadow-md" : "border-gray-200 hover:border-gray-300"}`}
                          style={isSelected ? { borderColor: template.color || "#3b82f6", backgroundColor: (template.color || "#3b82f6") + "08" } : {}}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: template.color || "#6b7280" }} />
                            <span className="font-semibold text-sm text-gray-800">{template.name}</span>
                            {isSelected && <span className="ml-auto text-xs font-medium" style={{ color: template.color || "#3b82f6" }}>Selected</span>}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {template.width}x{template.height}cm &middot; {formatPrice(template.tablePrice)}
                          </div>
                        </button>
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
                    (!shopkeeperExists &&
                      (!shopkeeperDetails.businessEmail || !emailVerified)) ||
                    !shopkeeperDetails.businessCategory
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
    </div>
  );
}
