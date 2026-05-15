// File: src/components/DashboardTabs/EventAttendees.tsx

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  Eye,
  Users,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Ticket,
  Mail,
  Phone,
  User,
  LayoutGrid,
  Store,
  EyeIcon,
  ShoppingCartIcon,
  Clock12,
  Clock1,
  CheckCircle2,
  CreditCard,
  Package,
  FileText,
  AlertCircle,
  X,
  Check,
  Loader2,
  ShieldCheck,
  Camera,
  ParkingCircle,
  Wifi,
} from "lucide-react";
import {
  FaFacebook,
  FaInstagram,
  FaShopify,
  FaShopware,
  FaUtensilSpoon,
  FaWhatsapp,
} from "react-icons/fa";
import { jwtDecode } from "jwt-decode";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "../ui/input";
import { toast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrencyhook";
import RoundTableBookings from "@/components/organizer/RoundTableBookings";
import { useCountry } from "@/hooks/useCountry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { StallRequest } from "./shopKeeper";
import { Separator } from "@radix-ui/react-separator";
import { Textarea } from "../ui/textarea";
import { ExhibitorDetailDialog } from "./ExhibitorDetailDialog";
// jsPDF and html2canvas are dynamically imported when needed

export interface StatusHistoryEntry {
  status: string;
  note?: string;
  changedAt: string;
  changedBy?: string;
}

const apiURL = __API_URL__;

interface TicketDetail {
  ticketType: string;
  quantity: number;
  price: number;
  _id: string;
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

interface EventInfo {
  _id: string;
  title: string;
  location: string;
  startDate: string;
  time: string;
  image?: string;
  description?: string;
  venue: string;
}

interface TicketCustomer {
  coupon: string;
  _id: string;
  ticketId: string;
  eventId: EventInfo;
  organizerId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  customerEmergencyContact?: string;
  ticketDetails: TicketDetail[];
  totalAmount: number;
  paymentConfirmed: boolean;
  status: string;
  purchaseDate: string;
  isUsed: boolean;
  attendance?: boolean;
  attendanceTime?: string;
  notes?: string;
  qrCode?: string;
  pdfPath?: string;
  updatedAt: string;
  createdAt: string;
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

interface Event {
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
  isLive: boolean;
  ticketPrice: number;
  totalTickets: number;
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
  status: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

interface DashboardStats {
  totalEvents: number;
  liveEvents: number;
  totalAttendees: number;
  todaysAttendees: number;
}

interface EventAttendeesProps {
  setShowAddEvent?: React.Dispatch<React.SetStateAction<boolean>>;
}

const EventAttendees: React.FC<EventAttendeesProps> = ({ setShowAddEvent }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ticketFilter, setTicketFilter] = useState("");
  const [attendeesFilter, setAttendeesFilter] = useState("");
  const [dateSort, setDateSort] = useState("");
  const [stats, setStats] = useState<DashboardStats>({
    totalEvents: 0,
    liveEvents: 0,
    totalAttendees: 0,
    todaysAttendees: 0,
  });
  const [loading, setLoading] = useState(true);
  // Add this state to manage which tab is currently active
  const [activeTab, setActiveTab] = useState("user");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventTickets, setEventTickets] = useState<TicketCustomer[]>([]);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showStallDetailDialog, setShowStallDetailDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<StallRequest | null>(
    null,
  );
  const [showStallDetailsDialog, setShowStallDetailsDialog] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [eventTicketsMap, setEventTicketsMap] = useState<
    Record<string, TicketCustomer[]>
  >({});
  const { country } = useCountry();
  const { formatPrice, getSymbol } = useCurrency(country);

  const [purchaseDateSort, setPurchaseDateSort] = useState<
    "none" | "latest" | "oldest"
  >("latest");
  const [attendanceTimeSort, setAttendanceTimeSort] = useState<
    "none" | "latest" | "oldest"
  >("latest");
  const [stalls, setStalls] = useState<any[]>([]);
  // New: speakers loaded for the currently-viewed event (one-shot fetch per dialog open)
  const [eventSpeakers, setEventSpeakers] = useState<any[]>([]);
  const [loadingSpeakers, setLoadingSpeakers] = useState(false);
  // Round-table bookings for the open event — pulled here too so the
  // combined revenue tile in the Event Information card can include it.
  const [eventRoundBookings, setEventRoundBookings] = useState<any[]>([]);
  // New: single-speaker detail view
  const [selectedSpeaker, setSelectedSpeaker] = useState<any | null>(null);
  // Inner-tab state for the unified View dialog
  const [detailTab, setDetailTab] = useState<
    "visitors" | "exhibitors" | "speakers" | "roundtables" | "layout"
  >("visitors");
  const [stallRequest, setStallRequest] = useState<StallRequest | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [actionNotes, setActionNotes] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [paymentStatusUpdate, setPaymentStatusUpdate] = useState<
    "Partial" | "Paid"
  >("Paid");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReturnDepositDialog, setShowReturnDepositDialog] = useState(false);
  const [returnDepositNotes, setReturnDepositNotes] = useState("");
  const [returnDepositStallId, setReturnDepositStallId] = useState<
    string | null
  >(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const stallDetailRef = React.useRef<HTMLDivElement>(null);

  // Function to get organizerId from token

  const fetchTicketsForEvents = async (events: Event[]) => {
    let totalTicketsSum = 0;
    let totalStallsSum = 0;
    let totalSpeakersSum = 0;
    let totalRoundTableSum = 0;
    let todaysAttendeesSum = 0;
    const map: Record<string, TicketCustomer[]> = {};

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    await Promise.all(
      events.map(async (event) => {
        // Tickets (visitors)
        try {
          const response = await fetch(
            `${apiURL}/tickets/event/${event._id}`,
            { method: "GET" },
          );
          if (response.ok) {
            const data = await response.json();
            const tickets: TicketCustomer[] = data.tickets || [];
            map[event._id] = tickets;

            const eventTicketsSold = tickets.reduce(
              (sum, ticket) =>
                sum +
                (ticket.ticketDetails?.reduce(
                  (acc, t) => acc + t.quantity,
                  0,
                ) || 0),
              0,
            );
            totalTicketsSum += eventTicketsSold;

            const eventStartDate = new Date(event.startDate);
            if (
              eventStartDate >= startOfToday &&
              eventStartDate <= endOfToday
            ) {
              const attendedCount = tickets.filter(
                (t) => t.attendance === true,
              ).length;
              todaysAttendeesSum += attendedCount;
            }
          } else {
            map[event._id] = [];
          }
        } catch {
          map[event._id] = [];
        }

        // Stalls (exhibitors)
        try {
          const r = await fetch(`${apiURL}/stalls/event/${event._id}`);
          if (r.ok) {
            const d = await r.json();
            const arr = Array.isArray(d) ? d : d?.data || [];
            totalStallsSum += arr.length;
          }
        } catch {
          /* ignore */
        }

        // Speaker requests
        try {
          const r = await fetch(
            `${apiURL}/speaker-requests/event/${event._id}`,
          );
          if (r.ok) {
            const d = await r.json();
            const arr = Array.isArray(d) ? d : d?.data || d?.requests || [];
            totalSpeakersSum += arr.length;
          }
        } catch {
          /* ignore */
        }

        // Round table bookings (count seats booked, not bookings)
        try {
          const r = await fetch(
            `${apiURL}/round-table-bookings/event/${event._id}`,
          );
          if (r.ok) {
            const d = await r.json();
            const arr = d?.data || d || [];
            const seats = Array.isArray(arr)
              ? arr.reduce(
                  (s: number, b: any) => s + (b.numberOfSeats || 0),
                  0,
                )
              : 0;
            totalRoundTableSum += seats;
          }
        } catch {
          /* ignore */
        }
      }),
    );

    setEventTicketsMap(map);
    setStats((prev) => ({
      ...prev,
      // "Total Participants" — every person who has booked anything: ticket
      // visitors + exhibitors with stalls + speakers + round-table seats.
      totalAttendees:
        totalTicketsSum +
        totalStallsSum +
        totalSpeakersSum +
        totalRoundTableSum,
      todaysAttendees: todaysAttendeesSum,
    }));
  };

  async function fetchStall(id: string) {
    try {
      const URL = `${apiURL}/stalls/${id}`;
      const response = await fetch(`${apiURL}/stalls/${id}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Stall Not Found");
      }

      if (response.ok) {
        const data = await response.json();
        setStallRequest(data.data);
      }
    } catch (error) {
      throw error;
    }
  }

  async function openStallDialog(stall: StallRequest) {
    setSelectedRequest(stall);
    setShowStallDetailDialog(true);
    await fetchStall(stall._id);
  }

  async function closeStallDialog() {
    setSelectedRequest(null);
    setShowStallDetailDialog(false);
  }

  async function fetchOrganizerData() {
    let organizerIdFromToken = "";
    const token = sessionStorage.getItem("token");

    if (token) {
      try {
        const decoded = jwtDecode(token);
        organizerIdFromToken = decoded.sub;
      } catch (e) {
        toast({
          duration: 5000,
          title: "Authentication Error",
          description: "Invalid authentication token.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    } else {
      toast({
        duration: 5000,
        title: "Authentication Error",
        description: "Authentication token is missing.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const organizer = await fetch(
        `${apiURL}/organizers/profile-get/${organizerIdFromToken}`,
        {
          method: "GET",
        },
      );

      if (organizer.ok) {
        const data = await organizer.json();
      }
    } catch (error) {
      throw error;
    }
  }

  // Fetch events data
  const fetchEventsData = async () => {
    try {
      setLoading(true);
      const token = await sessionStorage.getItem("token");
      const decoded: any = jwtDecode(token);
      const organizerId = decoded.sub;
      if (!organizerId) {
        console.error("No organizer ID found");
        return;
      }

      const response = await fetch(
        `${apiURL}/events/organizer/${organizerId}`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch events data");
      }

      const data = await response.json();
      const events: Event[] = data.data || [];

      const now = new Date();
      const liveEventsCount = events.filter((event) => {
        const today = new Date();
        const todayDateOnly = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
        );

        const start = new Date(event.startDate);
        const startDateOnly = new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate(),
        );

        const end = event.endDate
          ? new Date(event.endDate)
          : new Date(event.startDate);
        const endDateOnly = new Date(
          end.getFullYear(),
          end.getMonth(),
          end.getDate(),
        );

        // ✅ Count event if today's date is within range (inclusive)
        return todayDateOnly >= startDateOnly && todayDateOnly <= endDateOnly;
      }).length;

      setEvents(events);
      setStats((prev) => ({
        ...prev,
        totalEvents: events.length,
        liveEvents: liveEventsCount,
      }));

      await fetchTicketsForEvents(events);
    } catch (error) {
      console.error("Error fetching events data:", error);
    } finally {
      setLoading(false);
    }
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

  const handleReturnDeposit = async () => {
    if (!returnDepositStallId) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${apiURL}/stalls/${returnDepositStallId}/return-deposit`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: returnDepositNotes }),
        },
      );

      const result = await response.json();

      if (result.success) {
        toast({
          duration: 5000,
          title: "Success",
          description: "Deposit returned successfully",
        });
        setShowReturnDepositDialog(false);
        setReturnDepositNotes("");
        setReturnDepositStallId(null);
        await fetchStall(returnDepositStallId);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSharePDF = async () => {
    if (!stallRequest) return;
    setIsGeneratingPDF(true);

    try {
      const { default: jsPDF } = await import("jspdf");
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
      const sc = statusColors[stallRequest.status] || [100, 100, 100];
      const pc = paymentColors[stallRequest.paymentStatus] || [100, 100, 100];

      pdf.setFillColor(...sc);
      pdf.roundedRect(margin, y, 40, 7, 2, 2, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text(stallRequest.status, margin + 20, y + 4.8, { align: "center" });

      pdf.setFillColor(...pc);
      pdf.roundedRect(margin + contentWidth / 2, y, 40, 7, 2, 2, "F");
      pdf.text(
        stallRequest.paymentStatus,
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
        stallRequest.shopkeeperId?.name,
        "Business Name",
        stallRequest.shopkeeperId?.shopName,
      );
      labelValuePair(
        "Business Email",
        stallRequest.shopkeeperId?.businessEmail,
        "WhatsApp",
        stallRequest.shopkeeperId?.whatsappNumber,
      );
      labelValuePair(
        "Country",
        stallRequest.shopkeeperId?.country === "IN" ? "India" : "Singapore",
        "Category",
        stallRequest.shopkeeperId?.businessCategory,
      );
      labelValuePair(
        "Applicant Name",
        stallRequest.nameOfApplicant,
        "Owner Nationality",
        stallRequest.businessOwnerNationality,
      );
      labelValuePair(
        "Residency",
        stallRequest.residency || "Not Provided",
        "No. Of Operators",
        String(stallRequest.noOfOperators || "Not Provided"),
      );
      labelValuePair(
        stallRequest.shopkeeperId?.country === "IN"
          ? "GST Number"
          : "UEN Number",
        stallRequest.shopkeeperId?.country === "IN"
          ? stallRequest.shopkeeperId?.GSTNumber || "Not Provided"
          : stallRequest.shopkeeperId?.UENNumber || "Not Provided",
        "Coupon Assigned",
        stallRequest.couponCodeAssigned || "None Assigned",
      );
      if (stallRequest.registrationNumber) {
        labelValue("Registration Number", stallRequest.registrationNumber);
      }
      labelValue("Business Address", stallRequest.shopkeeperId?.address);
      if (stallRequest.refundPaymentDescription) {
        labelValue(
          "Refund Payment Details",
          stallRequest.refundPaymentDescription,
        );
      }
      if (stallRequest.productDescription) {
        labelValue("Product Description", stallRequest.productDescription);
      }
      y += 3;

      // ── Event Info ───────────────────────────────────────────
      sectionTitle("Event Information");
      labelValuePair(
        "Event Title",
        stallRequest.eventId?.title,
        "Category",
        stallRequest.eventId?.category,
      );
      labelValuePair(
        "Duration",
        `${new Date(stallRequest.eventId?.startDate).toLocaleDateString()} - ${new Date(stallRequest.eventId?.endDate).toLocaleDateString()}`,
        "Venue",
        stallRequest.eventId?.location,
      );
      labelValuePair(
        "Dress Code",
        stallRequest.eventId?.dresscode || "Casual",
        "Age Limit",
        stallRequest.eventId?.ageRestriction || "No Limit",
      );
      y += 3;

      // ── Selected Tables ──────────────────────────────────────
      if (stallRequest.selectedTables?.length > 0) {
        sectionTitle("Selected Tables");
        stallRequest.selectedTables.forEach((table: any) => {
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
      if (stallRequest.selectedAddOns?.length > 0) {
        sectionTitle("Selected Add-ons");
        stallRequest.selectedAddOns.forEach((addon: any) => {
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
        ["Tables Rental", safePrice(stallRequest.tablesTotal)],
        ["Deposit", safePrice(stallRequest.depositTotal)],
        ...(stallRequest.addOnsTotal > 0
          ? [["Add-ons", safePrice(stallRequest.addOnsTotal)]]
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
      pdf.text(safePrice(stallRequest.grandTotal), pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // ── Timeline ─────────────────────────────────────────────
      sectionTitle("Timeline");
      const timelineItems = [
        { label: "Request Submitted", date: stallRequest.requestDate },
        { label: "Request Confirmed", date: stallRequest.confirmationDate },
        { label: "Tables Selected", date: stallRequest.selectionDate },
        { label: "Payment Received", date: stallRequest.paymentDate },
        { label: "Booking Completed", date: stallRequest.completionDate },
        { label: "Checked In", date: stallRequest.checkInTime },
        { label: "Checked Out", date: stallRequest.checkOutTime },
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
      if (stallRequest.statusHistory?.length > 0) {
        sectionTitle("Status History & Notes");
        stallRequest.statusHistory.forEach((entry: any, index: number) => {
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
          pdf.text(String(index + 1), margin + 3, y + 3.5, { align: "center" });

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
        });
      }

      // ── Cancellation Reason ──────────────────────────────────
      if (stallRequest.cancellationReason) {
        sectionTitle("Cancellation Reason");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(239, 68, 68);
        const cancelLines = pdf.splitTextToSize(
          stripEmoji(stallRequest.cancellationReason),
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
      const fileName = `stall_${stallRequest?.shopkeeperId?.name?.replace(/\s+/g, "_") || "details"}_${stallRequest?.eventId?.title?.replace(/\s+/g, "_") || "event"}.pdf`;

      const pdfBlob = pdf.output("blob");
      const pdfFile = new File([pdfBlob], fileName, {
        type: "application/pdf",
      });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: `Stall Details - ${stallRequest?.shopkeeperId?.name}`,
          text: `Stall booking details for ${stallRequest?.eventId?.title}`,
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

  const getPaymentBadge = (paymentStatus: string) => {
    const variants: Record<string, { variant: any; color: string }> = {
      Unpaid: { variant: "destructive", color: "text-red-600" },
      Partial: { variant: "secondary", color: "text-yellow-600" },
      Paid: { variant: "default", color: "text-green-600" },
    };

    const config = variants[paymentStatus] || variants.Unpaid;

    return <Badge variant={config.variant}>{paymentStatus}</Badge>;
  };

  // Fetch tickets for a specific event
  const fetchEventTickets = async (eventId: string) => {
    try {
      setLoadingTickets(true);
      const response = await fetch(`${apiURL}/tickets/event/${eventId}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch event tickets");
      }

      const data = await response.json();


      setEventTickets(data.tickets);
    } catch (error) {
      console.error("Error fetching event tickets:", error);
      setEventTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Quick approve/reject for a speaker request from the Participants > Speakers
  // tab. Calls PATCH /speaker-requests/:id/status, refreshes the list, toasts.
  const updateSpeakerStatus = async (
    speakerId: string,
    status: "Confirmed" | "Rejected",
  ) => {
    try {
      const res = await fetch(
        `${apiURL}/speaker-requests/${speakerId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({
        duration: 3000,
        title: status === "Confirmed" ? "Speaker approved" : "Speaker rejected",
      });
      if (selectedEvent) await fetchEventSpeakers(selectedEvent._id);
    } catch (e: any) {
      toast({
        duration: 4000,
        title: "Failed to update speaker",
        description: e?.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  // Fetch round-table bookings for the open event so we can roll them into
  // the combined Total Revenue (the RoundTableBookings child component
  // fetches its own copy too — fine, two GETs is cheap and they don't share
  // state).
  const fetchEventRoundBookings = async (eventId: string) => {
    try {
      const res = await fetch(
        `${apiURL}/round-table-bookings/event/${eventId}`,
      );
      if (!res.ok) {
        setEventRoundBookings([]);
        return;
      }
      const data = await res.json();
      setEventRoundBookings(
        Array.isArray(data) ? data : data?.data || [],
      );
    } catch {
      setEventRoundBookings([]);
    }
  };

  const fetchEventSpeakers = async (eventId: string) => {
    try {
      setLoadingSpeakers(true);
      const res = await fetch(
        `${apiURL}/speaker-requests/event/${eventId}`,
      );
      if (res.ok) {
        const data = await res.json();
        // Endpoint may return either an array or { data: [...] } — handle both.
        setEventSpeakers(
          Array.isArray(data) ? data : data?.data ?? data?.requests ?? [],
        );
      } else {
        setEventSpeakers([]);
      }
    } catch (e) {
      console.error("Error fetching speakers:", e);
      setEventSpeakers([]);
    } finally {
      setLoadingSpeakers(false);
    }
  };

  const fetchStallTickets = async (eventId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${apiURL}/stalls/event/${eventId}`, {
        method: "GET",
      });

      if (response.ok) {
        const data = await response.json();
        setStalls(data.data || []);
      } else {
        setStalls([]);
      }
    } catch (error) {
      console.error("Error fetching stalls:", error);
      setStalls([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Add these handler functions ---
  const handleConfirmRequest = async () => {
    if (!selectedRequest || !selectedEvent) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${apiURL}/stalls/${selectedRequest._id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Confirmed",
            notes: actionNotes,
          }),
        },
      );
      const result = await response.json();
      if (result.success) {
        toast({
          duration: 5000,
          title: "Success",
          description: result.message,
        });
        setShowConfirmDialog(false);
        setActionNotes("");
        await fetchStallTickets(selectedEvent._id); // Refresh current table
      } else throw new Error(result.message);
    } catch (error: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!selectedRequest || !selectedEvent || !cancellationReason.trim()) {
      toast({
        duration: 5000,
        title: "Error",
        description: "Please provide a cancellation reason",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${apiURL}/stalls/${selectedRequest._id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Cancelled",
            cancellationReason: cancellationReason,
            notes: actionNotes,
          }),
        },
      );
      const result = await response.json();
      if (result.success) {
        toast({
          duration: 5000,
          title: "Success",
          description: "Stall request cancelled",
        });
        setShowCancelDialog(false);
        setCancellationReason("");
        setActionNotes("");
        await fetchStallTickets(selectedEvent._id);
      } else throw new Error(result.message);
    } catch (error: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePaymentStatus = async () => {
    if (!selectedRequest || !selectedEvent) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${apiURL}/stalls/${selectedRequest._id}/payment-status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentStatus: paymentStatusUpdate,
            notes: actionNotes,
          }),
        },
      );
      const result = await response.json();
      if (result.success) {
        toast({
          duration: 5000,
          title: "Success",
          description: "Payment status updated successfully",
        });
        setShowPaymentDialog(false);
        setActionNotes("");
        await fetchStallTickets(selectedEvent._id);
      } else throw new Error(result.message);
    } catch (error: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const exhibitorsCount = stalls?.length || 0;
  const confirmedExhibitors =
    stalls?.filter((s) => s.status === "Completed").length || 0;
  const totalStallRevenue =
    stalls?.reduce((acc, curr) => acc + (curr.grandTotal || 0), 0) || 0;

  const filteredEvents = events.filter((event) => {
    return (
      (eventFilter === "" ||
        event.title.toLowerCase().includes(eventFilter.toLowerCase())) &&
      (statusFilter === "" ||
        (statusFilter === "live" ? event.isLive : !event.isLive))
    );
  });

  let displayedEvents = [...filteredEvents];
  if (dateSort === "latest") {
    displayedEvents.sort(
      (a, b) =>
        new Date(b.startDate).getDate() - new Date(a.startDate).getDate(),
    );
  } else if (dateSort === "oldest") {
    displayedEvents.sort(
      (a, b) =>
        new Date(a.startDate).getDate() - new Date(b.startDate).getDate(),
    );
  }

  const filteredEventTickets = eventTickets.filter((ticket) => {
    return (
      (ticketFilter === "" ||
        ticket.customerName
          .toLowerCase()
          .includes(ticketFilter.toLowerCase()) ||
        ticket.customerEmail
          .toLowerCase()
          .includes(ticketFilter.toLowerCase())) &&
      (attendeesFilter === "" ||
        (attendeesFilter === "present"
          ? ticket.attendance
          : !ticket.attendance))
    );
  });

  let sortedTickets = [...filteredEventTickets];

  if (purchaseDateSort !== "none") {
    sortedTickets.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime(); // or purchaseDate field
      const bTime = new Date(b.createdAt).getTime();
      return purchaseDateSort === "latest" ? bTime - aTime : aTime - bTime;
    });
  }

  if (attendanceTimeSort !== "none") {
    sortedTickets.sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return attendanceTimeSort === "latest" ? bTime - aTime : aTime - bTime;
    });
  }

  const EventFilters = () => (
    <div className="flex gap-4 mb-4 flex-wrap">
      <div className="flex items-center space-x-2">
        <Label htmlFor="event-filter">Search Events:</Label>
        <Input
          id="event-filter"
          placeholder="Filter by event name..."
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="w-64"
        />
      </div>
      <div className="flex items-center space-x-2">
        <Label htmlFor="status-filter">Status:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="not-live">Not Live</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center space-x-2">
        <Label htmlFor="date-sort">Sort by Date:</Label>
        <Select value={dateSort} onValueChange={setDateSort}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Sort by Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const TicketFilters = () => (
    <div className="flex gap-4 mb-4 flex-wrap">
      <div className="flex items-center space-x-2">
        <Label htmlFor="ticket-filter">Search Customers:</Label>
        <Input
          id="ticket-filter"
          placeholder="Filter by name or email..."
          value={ticketFilter}
          onChange={(e) => setTicketFilter(e.target.value)}
          className="w-64"
        />
      </div>
      <div className="flex items-center space-x-2">
        <Label htmlFor="attendance-filter">Attendance:</Label>
        <Select value={attendeesFilter} onValueChange={setAttendeesFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const totalTicketsSold = eventTickets.reduce((sum, ticket) => {
    const ticketCount =
      ticket.ticketDetails?.reduce((acc, t) => acc + t.quantity, 0) || 0;
    return sum + ticketCount;
  }, 0);

  const totalAttended = eventTickets.filter(
    (ticket) => ticket.attendance,
  ).length;

  // Combined revenue across all participant types for the open event.
  //   tickets   — sum of paid ticket totalAmount
  //   stalls    — sum of paidAmount on stalls
  //   speakers  — sum of fees collected from speakers (Paid only)
  //   round     — sum of paid round-table booking amounts (eventRoundBookings
  //               state — populated alongside other fetches in handleViewAttendance)
  const ticketsRevenue = eventTickets.reduce(
    (sum, ticket) => sum + (ticket.totalAmount || 0),
    0,
  );
  const stallsRevenue = stalls.reduce(
    (sum: number, s: any) => sum + (s.paidAmount || 0),
    0,
  );
  const speakersRevenue = eventSpeakers.reduce(
    (sum: number, sp: any) =>
      sum + (sp.paymentStatus === "Paid" ? sp.fee || 0 : 0),
    0,
  );
  const roundTablesRevenue = eventRoundBookings.reduce(
    (sum: number, b: any) =>
      sum + (b.paymentStatus === "Paid" ? b.amount || 0 : 0),
    0,
  );
  const totalRevenue =
    ticketsRevenue + stallsRevenue + speakersRevenue + roundTablesRevenue;

  useEffect(() => {
    fetchEventsData();
  }, []);

  // Decide which inner-dialog tabs to expose based on what the event was
  // configured with. An event without any speakers shouldn't surface a
  // "Speakers" tab, etc.
  const eventHasSection = (event: Event | null) => {
    if (!event) {
      return {
        visitors: false,
        exhibitors: false,
        speakers: false,
        roundtables: false,
      };
    }
    const e: any = event;
    const visitors =
      (Array.isArray(e.visitorTypes) && e.visitorTypes.length > 0) ||
      (typeof e.totalTickets === "number" && e.totalTickets > 0) ||
      (typeof e.ticketPrice === "number" && e.ticketPrice > 0);
    const exhibitors =
      !!e.venueTables &&
      (Array.isArray(e.venueTables)
        ? e.venueTables.length > 0
        : Object.keys(e.venueTables).length > 0);
    const speakers =
      Array.isArray(e.speakerSlotTemplates) && e.speakerSlotTemplates.length > 0;
    const roundtables =
      Array.isArray(e.venueRoundTables) && e.venueRoundTables.length > 0;
    // Layout tab is useful whenever there's any placed table, round table, or
    // venue config — that's where the organizer sees the booked-vs-available view.
    const layout =
      exhibitors ||
      roundtables ||
      (Array.isArray(e.venueConfig) && e.venueConfig.length > 0);
    return { visitors, exhibitors, speakers, roundtables, layout };
  };

  const handleViewAttendance = async (event: Event) => {
    // Open immediately with the trimmed list event; we'll swap in the full
    // event (with venueTables / venueRoundTables / venueConfig) once it loads.
    setSelectedEvent(event);
    setShowDetailsDialog(true);
    // Provisional landing tab from the trimmed shape; we'll re-pick after the
    // full event loads in case Layout / Speakers / etc. become available.
    const provisional = eventHasSection(event);
    const provisionalFirst = (
      ["visitors", "exhibitors", "speakers", "roundtables", "layout"] as const
    ).find((k) => provisional[k]);
    setDetailTab(provisionalFirst ?? "visitors");

    // 1) Fetch the FULL event so the Venue Layout / per-section tabs see
    //    venueTables, venueRoundTables, venueConfig, speakerSlotTemplates, etc.
    let fullEvent: Event = event;
    try {
      const res = await fetch(`${apiURL}/events/${event._id}`);
      if (res.ok) {
        const data = await res.json();
        fullEvent = (data?.data || data) as Event;
        setSelectedEvent(fullEvent);
      }
    } catch (e) {
      console.error("Failed to load full event details:", e);
    }

    // 2) Re-pick landing tab now that we know what the event actually has.
    const sections = eventHasSection(fullEvent);
    const firstAvailable = (
      ["visitors", "exhibitors", "speakers", "roundtables", "layout"] as const
    ).find((k) => sections[k]);
    if (firstAvailable && !sections[provisionalFirst as keyof typeof sections]) {
      setDetailTab(firstAvailable);
    }

    // 3) Fetch only what's relevant in parallel. Round Tables loads itself via
    //    its own component once mounted.
    const tasks: Promise<any>[] = [];
    if (sections.visitors) tasks.push(fetchEventTickets(event._id));
    if (sections.exhibitors || sections.layout)
      tasks.push(fetchStallTickets(event._id));
    if (sections.speakers) tasks.push(fetchEventSpeakers(event._id));
    if (sections.roundtables || sections.layout)
      tasks.push(fetchEventRoundBookings(event._id));
    await Promise.all(tasks);
  };

  const handleViewStallAttendance = async (event: Event) => {
    setSelectedEvent(event);
    setShowStallDetailsDialog(true);
    await fetchStallTickets(event._id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    return timeString || "N/A";
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          Loading events data...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Participants</h2>
          <p className="text-muted-foreground">
            Manage attendance for your events and track customer participation
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">
              All your organized events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Live Events</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.liveEvents}</div>
            <p className="text-xs text-muted-foreground">
              Currently active events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Participants
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAttendees}</div>
            <p className="text-xs text-muted-foreground">
              Visitors + exhibitors + speakers + round-table seats
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Attendees
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todaysAttendees}</div>
            <p className="text-xs text-muted-foreground">
              People attended today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Single unified events list — click "View" to open the details dialog
          which contains tabs for Visitors / Exhibitors / Speakers / Round Tables. */}
      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
          <CardDescription>
            View attendance for visitors, exhibitors, speakers and round
            tables across all your events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventFilters />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedEvents.map((event) => (
                <TableRow key={event._id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{event.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {event.description?.slice(0, 50)}...
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(event.startDate)}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTime(event.time)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="buttonOutline"
                      size="sm"
                      onClick={() => handleViewAttendance(event)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {events.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              No events found. Create your first event to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Old Visitors / Participants top-level tabs collapsed into the unified
          dialog above. Kept the inner shopkeeper tab block hidden so the rest of
          the file's stall handlers (confirm/cancel/payment dialogs) keep working
          via state references that still exist below. */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden">
        <TabsList>
          <TabsTrigger value="user">user</TabsTrigger>
          <TabsTrigger value="shopkeeper">shopkeeper</TabsTrigger>
        </TabsList>
        <TabsContent value="user" />

        <TabsContent value="shopkeeper" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Exhibitor Management</CardTitle>
              <CardDescription>
                View and manage attendance for Exhibitors of all your events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventFilters />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Status</TableHead>
                    {/* <TableHead>Tickets Sold</TableHead>
                <TableHead>Attended</TableHead> */}
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedEvents.map((event) => (
                    <TableRow key={event._id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{event.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {event.description?.slice(0, 50)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(event.startDate)}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTime(event.time)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </div>
                      </TableCell>
                      <TableCell>
                        {event.isLive ? (
                          <Badge className="bg-green-100 text-green-800">
                            Live
                          </Badge>
                        ) : (
                          <Badge variant="buttonOutline">Not Live</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="buttonOutline"
                          size="sm"
                          onClick={() => handleViewStallAttendance(event)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Exhibitors
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {events.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  No events found. Create your first event to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* Events Table */}

      {/* Event Attendance Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Event Attendance - {selectedEvent?.title}</DialogTitle>
            <DialogDescription>
              Detailed attendance information and customer ticket details
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-6">
              {/* Event Info — full event details + per-section counts */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Event Information</span>
                    <div className="flex items-center gap-2">
                      {(selectedEvent as any).category && (
                        <Badge variant="secondary">
                          {(selectedEvent as any).category}
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Dates</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(selectedEvent.startDate)}
                          {selectedEvent.endDate &&
                          selectedEvent.endDate !== selectedEvent.startDate
                            ? ` → ${formatDate(selectedEvent.endDate)}`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Time</div>
                        <div className="text-sm text-muted-foreground">
                          {formatTime(selectedEvent.time)}
                          {selectedEvent.endTime
                            ? ` – ${formatTime(selectedEvent.endTime)}`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Venue</div>
                        <div className="text-sm text-muted-foreground">
                          {selectedEvent.location || "—"}
                        </div>
                        {selectedEvent.address && (
                          <div className="text-xs text-muted-foreground">
                            {selectedEvent.address}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Per-section summary counts */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-5 pt-4 border-t">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Tickets Sold
                      </div>
                      <div className="text-2xl font-bold text-blue-600">
                        {totalTicketsSold}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Attended
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {totalAttended}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Revenue
                      </div>
                      <div className="text-2xl font-bold text-purple-600">
                        {formatPrice(totalRevenue)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Exhibitors
                      </div>
                      <div className="text-2xl font-bold text-orange-600">
                        {stalls.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Speakers
                      </div>
                      <div className="text-2xl font-bold text-indigo-600">
                        {eventSpeakers.length}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Inner tabs: Visitors / Exhibitors / Speakers / Round Tables —
                  each only shown if the event was configured with that section. */}
              {(() => {
                const sections = eventHasSection(selectedEvent);
                const visibleCount =
                  (sections.visitors ? 1 : 0) +
                  (sections.exhibitors ? 1 : 0) +
                  (sections.speakers ? 1 : 0) +
                  (sections.roundtables ? 1 : 0) +
                  (sections.layout ? 1 : 0);
                if (visibleCount === 0) {
                  return (
                    <Card>
                      <CardContent className="py-12 text-center text-muted-foreground">
                        This event has no visitor, exhibitor, speaker or round
                        table sections enabled. Add at least one in the event
                        editor to see attendance data here.
                      </CardContent>
                    </Card>
                  );
                }
                const colsClass =
                  ({
                    1: "grid-cols-1",
                    2: "grid-cols-2",
                    3: "grid-cols-3",
                    4: "grid-cols-4",
                    5: "grid-cols-5",
                  } as Record<number, string>)[visibleCount] || "grid-cols-5";
                return (
              <Tabs
                value={detailTab}
                onValueChange={(v) => setDetailTab(v as any)}
              >
                <TabsList className={`grid w-full ${colsClass}`}>
                  {sections.visitors && (
                    <TabsTrigger value="visitors">Visitors</TabsTrigger>
                  )}
                  {sections.exhibitors && (
                    <TabsTrigger value="exhibitors">Exhibitors</TabsTrigger>
                  )}
                  {sections.speakers && (
                    <TabsTrigger value="speakers">Speakers</TabsTrigger>
                  )}
                  {sections.roundtables && (
                    <TabsTrigger value="roundtables">Round Tables</TabsTrigger>
                  )}
                  {sections.layout && (
                    <TabsTrigger value="layout">Venue Layout</TabsTrigger>
                  )}
                </TabsList>

                {sections.visitors && (
                <TabsContent value="visitors" className="pt-4">
              {/* Tickets Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Attendance Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <TicketFilters />
                  {loadingTickets ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2"></div>
                      Loading attendance data...
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Visitor</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Tickets</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Coupon</TableHead>
                          <TableHead>Purchase Date</TableHead>
                          <TableHead>Attendance</TableHead>
                          <TableHead>
                            Attendance Time
                            <Select
                              value={attendanceTimeSort}
                              onValueChange={(value) =>
                                setAttendanceTimeSort(
                                  value as "none" | "latest" | "oldest",
                                )
                              }
                            >
                              <SelectTrigger className="w-6 h-6 ml-2">
                                <span>&#8645;</span>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Default</SelectItem>
                                <SelectItem value="latest">
                                  Latest First
                                </SelectItem>
                                <SelectItem value="oldest">
                                  Oldest First
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedTickets.map((ticket) => (
                          <TableRow key={ticket._id}>
                            <TableCell>
                              <div>
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {ticket.customerName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  ID: {ticket.ticketId}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-sm">
                                  <Mail className="h-3 w-3" />
                                  {ticket.customerEmail}
                                </div>
                                <div className="flex items-center gap-1 text-sm">
                                  <FaWhatsapp className="h-3 w-3" />
                                  {ticket.customerWhatsapp}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {ticket.ticketDetails.map((detail, index) => (
                                <div key={index} className="text-sm">
                                  {detail.quantity} x{" "}
                                  {formatPrice(detail.price)}
                                </div>
                              ))}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {formatPrice(ticket.totalAmount)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {ticket.coupon ? ticket.coupon : "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              {formatDate(ticket.updatedAt)}
                            </TableCell>
                            <TableCell>
                              {ticket.attendance ? (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Present
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Absent
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {ticket.attendance && (
                                <div className="text-sm">
                                  {formatDateTime(ticket.updatedAt)}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {eventTickets.length === 0 && !loadingTickets && (
                    <div className="text-center py-8 text-muted-foreground">
                      No tickets found for this event.
                    </div>
                  )}
                </CardContent>
              </Card>
                </TabsContent>
                )}

                {/* EXHIBITORS TAB */}
                {sections.exhibitors && (
                <TabsContent value="exhibitors" className="pt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Exhibitor Bookings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2"></div>
                          Loading exhibitor bookings...
                        </div>
                      ) : stalls.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No exhibitor bookings for this event yet.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Exhibitor</TableHead>
                              <TableHead>Business</TableHead>
                              <TableHead>Contact</TableHead>
                              <TableHead>Tables</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Payment</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stalls.map((s: any) => (
                              <TableRow key={s._id}>
                                <TableCell className="font-medium">
                                  {s.shopkeeperId?.name ||
                                    s.nameOfApplicant ||
                                    s.brandName ||
                                    "—"}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium">
                                    {s.shopkeeperId?.shopName ||
                                      s.businessName ||
                                      s.brandName ||
                                      "—"}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    // Vendor schema has multiple phone fields with
                                    // different casing — check all of them.
                                    const v = s.shopkeeperId || {};
                                    const phone =
                                      v.whatsAppNumber ||
                                      v.whatsappNumber ||
                                      v.phoneNumber ||
                                      s.whatsAppNumber ||
                                      s.whatsappNumber ||
                                      s.phoneNumber ||
                                      s.phone ||
                                      "";
                                    const email = v.email || s.email || "";
                                    return (
                                      <>
                                        <div className="text-sm flex items-center gap-1">
                                          <FaWhatsapp className="h-3 w-3 text-green-600" />
                                          {phone || "—"}
                                        </div>
                                        {email && (
                                          <div className="text-xs text-muted-foreground flex items-center gap-1 break-all">
                                            <Mail className="h-3 w-3" />
                                            {email}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell>
                                  {Array.isArray(s.selectedTables) &&
                                  s.selectedTables.length > 0
                                    ? s.selectedTables
                                        .map((t: any) => t.tableName)
                                        .join(", ")
                                    : "—"}
                                </TableCell>
                                <TableCell>
                                  {formatPrice(s.grandTotal || 0)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      s.paymentStatus === "Paid"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-yellow-100 text-yellow-800"
                                    }
                                  >
                                    {s.paymentStatus || "Unpaid"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">
                                    {s.status || "Pending"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {/* Approve / Reject only show while still
                                        actionable (Pending / Approved). Once
                                        Confirmed/Cancelled/etc. they hide. */}
                                    {(!s.status ||
                                      s.status === "Pending" ||
                                      s.status === "Approved") && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-7 w-7 text-green-700 border-green-300 hover:bg-green-50"
                                          onClick={() => {
                                            setSelectedRequest(s);
                                            setActionNotes("");
                                            setShowConfirmDialog(true);
                                          }}
                                          title="Approve / confirm this exhibitor"
                                        >
                                          <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-7 w-7 text-red-700 border-red-300 hover:bg-red-50"
                                          onClick={() => {
                                            setSelectedRequest(s);
                                            setCancellationReason("");
                                            setActionNotes("");
                                            setShowCancelDialog(true);
                                          }}
                                          title="Reject / cancel this exhibitor"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openStallDialog(s)}
                                      title="View exhibitor details"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                )}

                {/* SPEAKERS TAB */}
                {sections.speakers && (
                <TabsContent value="speakers" className="pt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Speakers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingSpeakers ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2"></div>
                          Loading speakers...
                        </div>
                      ) : eventSpeakers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No speakers for this event yet.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Speaker</TableHead>
                              <TableHead>Organization</TableHead>
                              <TableHead>Contact</TableHead>
                              <TableHead>Topic</TableHead>
                              <TableHead>Fee</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Payment</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {eventSpeakers.map((req: any) => (
                              <TableRow key={req._id}>
                                <TableCell>
                                  <div className="font-medium flex items-center gap-2">
                                    {req.name}
                                    {req.isKeynote && (
                                      <Badge className="bg-purple-100 text-purple-700 text-[10px]">
                                        Keynote
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {req.title || "—"}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium text-sm">
                                    {req.organization || "—"}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const phone =
                                      req.phone ||
                                      req.whatsAppNumber ||
                                      req.whatsappNumber ||
                                      req.phoneNumber ||
                                      "";
                                    return (
                                      <>
                                        <div className="text-sm flex items-center gap-1 break-all">
                                          <Mail className="h-3 w-3" />
                                          {req.email || "—"}
                                        </div>
                                        {phone && (
                                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <FaWhatsapp className="h-3 w-3 text-green-600" />
                                            {phone}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {req.sessions?.[0]?.topic || "—"}
                                </TableCell>
                                <TableCell>
                                  {req.isCharged
                                    ? formatPrice(req.fee || 0)
                                    : "Free"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">
                                    {req.status || "Pending"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      req.paymentStatus === "Paid"
                                        ? "bg-green-100 text-green-800"
                                        : ""
                                    }
                                    variant={
                                      req.paymentStatus === "Paid"
                                        ? undefined
                                        : "secondary"
                                    }
                                  >
                                    {req.paymentStatus || "Unpaid"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {(!req.status ||
                                      req.status === "Pending") && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-7 w-7 text-green-700 border-green-300 hover:bg-green-50"
                                          onClick={() =>
                                            updateSpeakerStatus(
                                              req._id,
                                              "Confirmed",
                                            )
                                          }
                                          title="Approve speaker request"
                                        >
                                          <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-7 w-7 text-red-700 border-red-300 hover:bg-red-50"
                                          onClick={() =>
                                            updateSpeakerStatus(
                                              req._id,
                                              "Rejected",
                                            )
                                          }
                                          title="Reject speaker request"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setSelectedSpeaker(req)}
                                      title="View speaker details"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                )}

                {/* ROUND TABLES TAB — reuses the dedicated component */}
                {sections.roundtables && (
                <TabsContent value="roundtables" className="pt-4">
                  <RoundTableBookings eventId={selectedEvent._id} />
                </TabsContent>
                )}

                {/* VENUE LAYOUT TAB — visual + sold/available summary */}
                {sections.layout && (
                <TabsContent value="layout" className="pt-4 space-y-4">
                  {(() => {
                    const e: any = selectedEvent;
                    const configs: any[] = Array.isArray(e.venueConfig)
                      ? e.venueConfig
                      : [];
                    // Tables/round tables can be a flat array (with venueConfigId
                    // on each item) or a Record. Normalize to a flat array.
                    const flatTables: any[] = Array.isArray(e.venueTables)
                      ? e.venueTables
                      : Object.values(e.venueTables || {}).flat();
                    const flatRounds: any[] = Array.isArray(e.venueRoundTables)
                      ? e.venueRoundTables
                      : Object.values(e.venueRoundTables || {}).flat();

                    if (configs.length === 0) {
                      return (
                        <Card>
                          <CardContent className="py-8 text-center text-muted-foreground">
                            No venue configuration found for this event.
                          </CardContent>
                        </Card>
                      );
                    }

                    return configs.map((cfg: any) => {
                      const cfgId =
                        cfg.venueConfigId || cfg.id || "default";
                      const tables = flatTables.filter(
                        (t) => (t.venueConfigId || "default") === cfgId,
                      );
                      const rounds = flatRounds.filter(
                        (r) => (r.venueConfigId || "default") === cfgId,
                      );
                      const tablesBooked = tables.filter(
                        (t) => t.isBooked,
                      ).length;
                      const totalChairs = rounds.reduce(
                        (sum, r) => sum + (r.numberOfChairs || 0),
                        0,
                      );
                      const bookedChairs = rounds.reduce(
                        (sum, r) =>
                          sum +
                          (Array.isArray(r.bookedChairs)
                            ? r.bookedChairs.length
                            : 0),
                        0,
                      );

                      // Mini-canvas at fixed width (max 760px), aspect-correct
                      const canvasMaxW = 760;
                      const previewScale = Math.min(
                        canvasMaxW / (cfg.width || 800),
                        1,
                      );
                      const cw = (cfg.width || 800) * previewScale;
                      const ch = (cfg.height || 500) * previewScale;

                      return (
                        <Card key={cfgId}>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center justify-between">
                              <span>{cfg.name || "Venue"}</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                {(cfg.width || 0) / 10}m ×{" "}
                                {(cfg.height || 0) / 10}m
                              </span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Visual mini canvas */}
                            <div className="flex justify-center">
                              <div
                                className="relative bg-slate-50 border-2 border-dashed border-slate-300 rounded-md overflow-hidden"
                                style={{
                                  width: cw,
                                  height: ch,
                                  backgroundImage: cfg.showGrid
                                    ? `linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)`
                                    : "none",
                                  backgroundSize: `${(cfg.gridSize || 20) * previewScale}px ${(cfg.gridSize || 20) * previewScale}px`,
                                }}
                              >
                                {cfg.hasMainStage && (
                                  <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-purple-100 border border-purple-300 px-3 py-0.5 rounded text-[8px] font-bold text-purple-700">
                                    MAIN STAGE
                                  </div>
                                )}
                                {/* Tables (rectangles) — color reflects stall state:
                                    White  = available (no stall selected this table)
                                    Yellow = exhibitor paid, awaiting organizer approval
                                    Green  = approved / confirmed by organizer */}
                                {tables.map((t: any) => {
                                  // Find any stall that has selected this table
                                  const stall = stalls.find((s: any) =>
                                    Array.isArray(s.selectedTables)
                                      ? s.selectedTables.some(
                                          (st: any) =>
                                            st.tableId === t.id ||
                                            st.positionId === t.positionId,
                                        )
                                      : false,
                                  );
                                  const paid =
                                    stall?.paymentStatus === "Paid";
                                  const approved =
                                    stall?.status === "Confirmed" ||
                                    stall?.status === "Completed" ||
                                    stall?.status === "Approved";
                                  let bg = "bg-white border-slate-400 text-slate-700";
                                  let label = "Available";
                                  if (stall && paid && approved) {
                                    bg =
                                      "bg-green-500/80 border-green-700 text-white";
                                    label = `Approved · ${stall.shopkeeperId?.name || stall.nameOfApplicant || "Booked"}`;
                                  } else if (stall && paid && !approved) {
                                    bg =
                                      "bg-yellow-300/80 border-yellow-600 text-yellow-900";
                                    label = `Paid · awaiting approval (${stall.shopkeeperId?.name || stall.nameOfApplicant || "exhibitor"})`;
                                  } else if (stall) {
                                    bg =
                                      "bg-blue-200 border-blue-500 text-blue-900";
                                    label = `Selected · unpaid (${stall.shopkeeperId?.name || stall.nameOfApplicant || "exhibitor"})`;
                                  }
                                  return (
                                    <div
                                      key={t.positionId}
                                      title={`${t.name} — ${label}`}
                                      className={`absolute flex items-center justify-center text-[7px] font-semibold border ${bg}`}
                                      style={{
                                        left: (t.x || 0) * previewScale,
                                        top: (t.y || 0) * previewScale,
                                        width: (t.width || 60) * previewScale,
                                        height: (t.height || 30) * previewScale,
                                        transform: `rotate(${t.rotation || 0}deg)`,
                                        transformOrigin: "center center",
                                      }}
                                    >
                                      <span className="truncate px-0.5">
                                        {t.name}
                                      </span>
                                    </div>
                                  );
                                })}
                                {/* Round tables (circles) — booked vs not.
                                    No "partial" yellow here: any chair booked
                                    counts as Booked. */}
                                {rounds.map((r: any) => {
                                  const d = (r.tableDiameter || 120) *
                                    previewScale;
                                  const seatsBooked =
                                    r.bookedChairs?.length || 0;
                                  const hasBooking = seatsBooked > 0;
                                  const bg = hasBooking
                                    ? "bg-green-500/80"
                                    : "bg-white";
                                  return (
                                    <div
                                      key={r.positionId}
                                      title={`${r.name} — ${seatsBooked}/${r.numberOfChairs} chairs booked`}
                                      className={`absolute rounded-full border flex items-center justify-center text-[7px] font-semibold ${bg}`}
                                      style={{
                                        left: (r.x || 0) * previewScale,
                                        top: (r.y || 0) * previewScale,
                                        width: d,
                                        height: d,
                                        borderColor: r.color || "#8B5CF6",
                                      }}
                                    >
                                      <span className="truncate px-1 text-center leading-tight">
                                        {r.name}
                                        <br />
                                        {seatsBooked}/{r.numberOfChairs}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Legend */}
                            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 inline-block bg-white border border-slate-400" />
                                Available
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 inline-block bg-blue-200 border border-blue-500" />
                                Selected · unpaid
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 inline-block bg-yellow-300/80 border border-yellow-600" />
                                Paid · awaiting your approval
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 inline-block bg-green-500/80 border" />
                                Approved / Booked
                              </span>
                            </div>

                            {/* Summary tiles */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
                              <div>
                                <div className="text-xs uppercase text-muted-foreground">
                                  Tables Booked
                                </div>
                                <div className="text-xl font-bold">
                                  {tablesBooked} / {tables.length}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs uppercase text-muted-foreground">
                                  Round Tables
                                </div>
                                <div className="text-xl font-bold">
                                  {rounds.length}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs uppercase text-muted-foreground">
                                  Chairs Booked
                                </div>
                                <div className="text-xl font-bold">
                                  {bookedChairs} / {totalChairs}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs uppercase text-muted-foreground">
                                  Occupancy
                                </div>
                                <div className="text-xl font-bold">
                                  {totalChairs
                                    ? Math.round(
                                        (bookedChairs / totalChairs) * 100,
                                      )
                                    : 0}
                                  %
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    });
                  })()}
                </TabsContent>
                )}
              </Tabs>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showStallDetailsDialog}
        onOpenChange={setShowStallDetailsDialog}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Event Dashboard: {selectedEvent?.title}
            </DialogTitle>
            <DialogDescription>
              Overview of exhibitor participation, stall allocations, and event
              revenue.
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-6">
              {/* 1. Event Info & High-Level Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase">
                      Event Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Start Date
                        </p>
                        <p className="font-semibold text-sm">
                          {new Date(
                            selectedEvent.startDate,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-50 rounded-lg">
                        <MapPin className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Location
                        </p>
                        <p className="font-semibold text-sm truncate w-32">
                          {selectedEvent.location}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-50 rounded-lg">
                        <LayoutGrid className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total Layouts
                        </p>
                        <p className="font-semibold text-sm">
                          {selectedEvent.venueConfig?.length || 0} Configs
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 text-white border-none">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-400 uppercase">
                      Stall Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-400">
                      {formatPrice(totalStallRevenue)}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Total revenue from all stalls
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* 2. Participation Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                  title="Total Registrations"
                  value={exhibitorsCount}
                  icon={<Users />}
                  color="text-blue-600"
                />
                <StatCard
                  title="Confirmed Exhibitors"
                  value={confirmedExhibitors}
                  icon={<CheckCircle />}
                  color="text-green-600"
                />
                <StatCard
                  title="Pending Approvals"
                  value={exhibitorsCount - confirmedExhibitors}
                  icon={<Clock />}
                  color="text-yellow-600"
                />
                <StatCard
                  title="Total Add-ons Sold"
                  value={stalls?.reduce(
                    (acc, s) => acc + s.selectedAddOns.length,
                    0,
                  )}
                  icon={<Store />}
                  color="text-purple-600"
                />
              </div>

              {/* 3. Exhibitors Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Participating Exhibitors</CardTitle>
                  <Badge variant="outline">{exhibitorsCount} Total</Badge>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Exhibitor/Shop</TableHead>
                        <TableHead>Stalls / Tables</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Grand Total</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stalls.map((stall) => (
                        <TableRow key={stall._id}>
                          <TableCell>
                            <div className="font-bold text-sm">
                              {stall.shopkeeperId?.name || stall.nameOfApplicant || "—"}
                            </div>
                            {(stall.shopkeeperId?.shopName || stall.shopkeeperId?.businessName || stall.brandName) && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <ShoppingCartIcon className="h-3 w-3" />{" "}
                                {stall.shopkeeperId?.shopName || stall.shopkeeperId?.businessName || stall.brandName}
                              </div>
                            )}
                            {stall.shopkeeperId?.whatsappNumber && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3" />{" "}
                                {stall.shopkeeperId.whatsappNumber}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {stall.selectedTables.length > 0 ? (
                              stall.selectedTables.map((t, i) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="mr-1"
                                >
                                  {t.tableName} ({t.tableType})
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No tables selected
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                stall.paymentStatus === "Paid"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }
                            >
                              {stall.paymentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {stall.status === "Completed" ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <Clock className="h-4 w-4 text-yellow-500" />
                              )}
                              <span className="text-sm font-medium">
                                {stall.status}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-bold">
                            {formatPrice(stall.grandTotal)}
                          </TableCell>
                          <TableCell className="center">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="buttonOutline"
                                onClick={() => {
                                  openStallDialog(stall);
                                }}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>

                              {stall.status === "Pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => {
                                      setSelectedRequest(stall);
                                      setShowConfirmDialog(true);
                                    }}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setSelectedRequest(stall);
                                      setShowCancelDialog(true);
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              )}

                              {stall.status !== "Pending" &&
                                stall.status !== "Cancelled" &&
                                stall.status !== "Forfeited" &&
                                stall.paymentStatus !== "Paid" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={() => {
                                      setSelectedRequest(stall);
                                      setShowPaymentDialog(true);
                                    }}
                                    title="Confirm Payment"
                                  >
                                    <CreditCard className="h-3 w-3 mr-1" />
                                    <span className="text-xs">Payment</span>
                                  </Button>
                                )}

                              {(stall.transactionId || stall.transactionScreenshot) && stall.paymentStatus !== "Paid" && (
                                <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                                  TX Proof
                                </Badge>
                              )}

                              {stall.paymentStatus === "Paid" &&
                                stall.status === "Completed" &&
                                !stall.hasCheckedIn && (
                                  <Badge className="bg-green-100 text-green-700 text-[10px]">
                                    QR Sent
                                  </Badge>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Speaker detail dialog — opened from the Eye button on the Speakers tab */}
      <Dialog
        open={!!selectedSpeaker}
        onOpenChange={(open) => !open && setSelectedSpeaker(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedSpeaker?.name || "Speaker"}
              {selectedSpeaker?.isKeynote && (
                <Badge className="bg-purple-100 text-purple-700">Keynote</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Full speaker request details
            </DialogDescription>
          </DialogHeader>

          {selectedSpeaker && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Profile</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="font-medium">Name</div>
                    <div className="text-muted-foreground">
                      {selectedSpeaker.name || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Title</div>
                    <div className="text-muted-foreground">
                      {selectedSpeaker.title || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Organization</div>
                    <div className="text-muted-foreground">
                      {selectedSpeaker.organization || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Email</div>
                    <div className="text-muted-foreground break-all">
                      {selectedSpeaker.email || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Phone</div>
                    <div className="text-muted-foreground">
                      {selectedSpeaker.phone ||
                        selectedSpeaker.whatsAppNumber ||
                        selectedSpeaker.whatsappNumber ||
                        selectedSpeaker.phoneNumber ||
                        "—"}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Source</div>
                    <div className="text-muted-foreground">
                      {selectedSpeaker.source || "—"}
                    </div>
                  </div>
                  {selectedSpeaker.bio && (
                    <div className="md:col-span-2">
                      <div className="font-medium">Bio</div>
                      <div className="text-muted-foreground whitespace-pre-line">
                        {selectedSpeaker.bio}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {Array.isArray(selectedSpeaker.sessions) &&
                selectedSpeaker.sessions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sessions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedSpeaker.sessions.map((s: any, i: number) => (
                        <div
                          key={i}
                          className="border rounded-md p-3 text-sm space-y-1"
                        >
                          <div className="font-medium">
                            {s.topic || `Session ${i + 1}`}
                          </div>
                          {s.description && (
                            <div className="text-muted-foreground">
                              {s.description}
                            </div>
                          )}
                          {(s.confirmedStartTime ||
                            s.preferredStartTime) && (
                            <div className="text-xs text-muted-foreground">
                              {s.confirmedStartTime || s.preferredStartTime} —{" "}
                              {s.confirmedEndTime || s.preferredEndTime || ""}
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status & Payment</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="font-medium">Status</div>
                    <Badge variant="secondary">
                      {selectedSpeaker.status || "Pending"}
                    </Badge>
                  </div>
                  <div>
                    <div className="font-medium">Payment</div>
                    <Badge
                      className={
                        selectedSpeaker.paymentStatus === "Paid"
                          ? "bg-green-100 text-green-800"
                          : ""
                      }
                      variant={
                        selectedSpeaker.paymentStatus === "Paid"
                          ? undefined
                          : "secondary"
                      }
                    >
                      {selectedSpeaker.paymentStatus || "Unpaid"}
                    </Badge>
                  </div>
                  <div>
                    <div className="font-medium">Charged</div>
                    <div className="text-muted-foreground">
                      {selectedSpeaker.isCharged ? "Yes" : "No"}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Fee</div>
                    <div className="text-muted-foreground">
                      {selectedSpeaker.isCharged
                        ? formatPrice(selectedSpeaker.fee || 0)
                        : "Free"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ExhibitorDetailDialog
        open={showStallDetailDialog}
        onOpenChange={(open) => (open ? setShowStallDetailDialog(true) : closeStallDialog())}
        stallRequest={stallRequest}
        detailRef={stallDetailRef}
        isGeneratingPDF={isGeneratingPDF}
        onSharePDF={handleSharePDF}
        onConfirmPayment={(stall) => {
          setSelectedRequest(stall);
          setShowPaymentDialog(true);
        }}
        onReturnDeposit={(stall) => {
          setReturnDepositStallId(stall._id);
          setShowReturnDepositDialog(true);
        }}
        onNoteAdded={async () => {
          if (stallRequest?._id) await fetchStall(stallRequest._id);
        }}
      />

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Stall Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to confirm this stall request? The
              shopkeeper will be notified and can proceed to select tables.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="confirm-notes">Notes (Optional)</Label>
              <Textarea
                id="confirm-notes"
                placeholder="Add any notes for the shopkeeper..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="buttonOutline"
              onClick={() => {
                setShowConfirmDialog(false);
                setActionNotes("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmRequest} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Confirm Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Stall Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this stall request. The
              shopkeeper will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="cancel-reason">
                Cancellation Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="cancel-reason"
                placeholder="Enter the reason for cancellation..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={3}
                required
              />
            </div>
            <div>
              <Label htmlFor="cancel-notes">Additional Notes (Optional)</Label>
              <Textarea
                id="cancel-notes"
                placeholder="Add any additional notes..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="buttonOutline"
              onClick={() => {
                setShowCancelDialog(false);
                setCancellationReason("");
                setActionNotes("");
              }}
            >
              Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelRequest}
              disabled={isSubmitting || !cancellationReason.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Cancel Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
            <DialogDescription>
              Update the payment status for this stall booking
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="payment-status">Payment Status</Label>
              <Select
                value={paymentStatusUpdate}
                onValueChange={(value: "Partial" | "Paid") =>
                  setPaymentStatusUpdate(value)
                }
              >
                <SelectTrigger id="payment-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Partial">Partial Payment</SelectItem>
                  <SelectItem value="Paid">Fully Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payment-notes">Notes (Optional)</Label>
              <Textarea
                id="payment-notes"
                placeholder="Add payment details or notes..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="buttonOutline"
              onClick={() => {
                setShowPaymentDialog(false);
                setActionNotes("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdatePaymentStatus} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Update Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Deposit Dialog */}
      <Dialog
        open={showReturnDepositDialog}
        onOpenChange={setShowReturnDepositDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Deposit</DialogTitle>
            <DialogDescription>
              Confirm that the deposit has been returned to the shopkeeper. Add
              a note for the record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="return-deposit-notes">Notes (Optional)</Label>
              <Textarea
                id="return-deposit-notes"
                placeholder="e.g. Deposit returned via bank transfer on 12 Jan..."
                value={returnDepositNotes}
                onChange={(e) => setReturnDepositNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="buttonOutline"
              onClick={() => {
                setShowReturnDepositDialog(false);
                setReturnDepositNotes("");
                setReturnDepositStallId(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleReturnDeposit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Confirm Return
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function StatCard({ title, value, icon, color }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">
              {title}
            </p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
          <div className={`${color} opacity-20`}>
            {React.cloneElement(icon, { size: 32 })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default EventAttendees;
