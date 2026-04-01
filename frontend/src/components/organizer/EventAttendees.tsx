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
import { useCountry } from "@/hooks/useCountry";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { StallRequest } from "./shopKeeper";
import { Separator } from "@radix-ui/react-separator";
import { Textarea } from "../ui/textarea";
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
        const response = await fetch(`${apiURL}/tickets/event/${event._id}`, {
          method: "GET",
        });
        if (!response.ok) {
          map[event._id] = [];
          return;
        }
        const data = await response.json();
        const tickets: TicketCustomer[] = data.tickets || [];
        map[event._id] = tickets;

        const eventTicketsSold = tickets.reduce(
          (sum, ticket) =>
            sum +
            (ticket.ticketDetails?.reduce((acc, t) => acc + t.quantity, 0) ||
              0),
          0,
        );
        totalTicketsSum += eventTicketsSold;

        const eventStartDate = new Date(event.startDate);

        if (eventStartDate >= startOfToday && eventStartDate <= endOfToday) {
          const attendedCount = tickets.filter(
            (t) => t.attendance === true,
          ).length;
          todaysAttendeesSum += attendedCount;
        }
      }),
    );

    setEventTicketsMap(map);
    setStats((prev) => ({
      ...prev,
      totalAttendees: totalTicketsSum,
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

  const totalRevenue = eventTickets.reduce((sum, ticket) => {
    return sum + (ticket.totalAmount || 0);
  }, 0);

  useEffect(() => {
    fetchEventsData();
  }, []);

  const handleViewAttendance = async (event: Event) => {
    setSelectedEvent(event);
    setShowDetailsDialog(true);
    await fetchEventTickets(event._id);
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
          <h2 className="text-3xl font-bold tracking-tight">Attendees</h2>
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
              Total Attendees
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAttendees}</div>
            <p className="text-xs text-muted-foreground">
              Total people who attended
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-half">
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="user">User Attendance</TabsTrigger>
          <TabsTrigger value="shopkeeper">Exhibitor Attendance</TabsTrigger>
        </TabsList>

        {/* Current Events Content */}
        <TabsContent value="user" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                View and manage attendance for Users of all your events
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
                          onClick={() => handleViewAttendance(event)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Attendance
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

          {selectedEvent && sortedTickets && (
            <div className="space-y-6">
              {/* Event Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Event Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <div>
                        <div className="font-medium">Date</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(selectedEvent.startDate)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <div>
                        <div className="font-medium">Time</div>
                        <div className="text-sm text-muted-foreground">
                          {formatTime(selectedEvent.time)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <div>
                        <div className="font-medium">Venue</div>
                        <div className="text-sm text-muted-foreground">
                          {selectedEvent.location}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                    <div>
                      <div className="font-medium">Tickets Sold:</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {totalTicketsSold}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Total Attended:</div>
                      <div className="text-2xl font-bold text-green-600">
                        {totalAttended}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Revenue:</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {formatPrice(totalRevenue)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

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

      <Dialog
        open={showStallDetailDialog}
        onOpenChange={setShowStallDetailDialog}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stall Request Details</DialogTitle>
            <DialogDescription>
              Complete information about the stall booking request
            </DialogDescription>
          </DialogHeader>

          {stallRequest && (
            <div className="space-y-6" ref={stallDetailRef}>
              {/* Status and Payment */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Request Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {getStatusBadge(stallRequest.status)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Payment Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {getPaymentBadge(stallRequest.paymentStatus)}
                  </CardContent>
                </Card>
              </div>

              {/* Payment Action Bar */}
              {stallRequest.status !== "Pending" &&
                stallRequest.status !== "Cancelled" &&
                stallRequest.status !== "Forfeited" &&
                stallRequest.paymentStatus !== "Paid" && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-blue-900">Payment Confirmation Required</p>
                        <p className="text-xs text-blue-700 mt-0.5">
                          Grand Total: <span className="font-bold">{formatPrice(stallRequest.grandTotal)}</span>
                          {stallRequest.paidAmount > 0 && (
                            <> &middot; Paid: <span className="font-bold">{formatPrice(stallRequest.paidAmount)}</span> &middot; Remaining: <span className="font-bold">{formatPrice(stallRequest.remainingAmount)}</span></>
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => {
                          setSelectedRequest(stallRequest);
                          setShowPaymentDialog(true);
                        }}
                      >
                        <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                        Confirm Payment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Transaction Verification Details */}
              {(stallRequest.transactionId || stallRequest.transactionScreenshot) && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="p-4 space-y-3">
                    <p className="font-semibold text-sm text-amber-900 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Transaction Details from Vendor
                    </p>
                    {stallRequest.transactionId && (
                      <div>
                        <p className="text-xs text-amber-700">Transaction ID / Reference</p>
                        <p className="font-mono font-bold text-sm text-gray-800 bg-white rounded px-3 py-1.5 border border-amber-200 mt-1">
                          {stallRequest.transactionId}
                        </p>
                      </div>
                    )}
                    {stallRequest.transactionScreenshot && (
                      <div>
                        <p className="text-xs text-amber-700 mb-1">Payment Screenshot</p>
                        <a
                          href={`${__API_URL__}${stallRequest.transactionScreenshot}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={`${__API_URL__}${stallRequest.transactionScreenshot}`}
                            alt="Transaction Screenshot"
                            className="max-w-xs max-h-60 rounded-lg border border-amber-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          />
                          <p className="text-[10px] text-amber-600 mt-1">Click to view full size</p>
                        </a>
                      </div>
                    )}
                    {stallRequest.paymentMethod && (
                      <p className="text-xs text-amber-700">
                        Payment Method: <span className="font-semibold capitalize">{stallRequest.paymentMethod === "bank" ? "Bank Transfer" : "QR / UPI Payment"}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {stallRequest.paymentStatus === "Paid" && (
                <Card className="border-green-200 bg-green-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <p className="font-semibold text-sm text-green-800">Payment Confirmed — QR ticket generated and sent to vendor</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Shopkeeper Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Shopkeeper Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  {/* Basic Info */}

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
                        {/* <p className="text-sm text-muted-foreground">
                          {stallRequest.shopkeeperId?.businessCategory}
                        </p> */}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-muted-foreground">Owner Name</Label>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {stallRequest.shopkeeperId?.name || stallRequest.nameOfApplicant || "—"}
                      </p>
                      {stallRequest.shopkeeperId?.hasDocVerification && (
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
                      {stallRequest.shopkeeperId?.shopName || stallRequest.brandName || "—"}
                    </p>
                  </div>
                  {/* Contact Info */}
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
                  {stallRequest.shopkeeperId?.whatsappNumber && (
                  <div>
                    <Label className="text-muted-foreground">WhatsApp</Label>
                    <p className="font-medium">
                      <a
                        href={`https://wa.me/${(stallRequest.shopkeeperId?.whatsappNumber || "").replace(/\+/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline"
                      >
                        {stallRequest.shopkeeperId?.whatsappNumber}
                      </a>
                    </p>
                  </div>
                  )}
                  {/* Location & Social */}
                  <div>
                    <Label className="text-muted-foreground">Country / Nationality</Label>
                    <p className="font-medium">
                      {(() => {
                        const code = stallRequest.shopkeeperId?.countryCode || stallRequest.shopkeeperId?.country || "";
                        const nationality = stallRequest.businessOwnerNationality || stallRequest.shopkeeperId?.businessOwnerNationality || "";
                        if (code === "+91" || code === "IN") return "🇮🇳 India";
                        if (code === "+65" || code === "SG") return "🇸🇬 Singapore";
                        if (code === "+1" || code === "US") return "🇺🇸 USA";
                        if (code === "+44" || code === "GB") return "🇬🇧 UK";
                        if (code === "+971" || code === "AE") return "🇦🇪 UAE";
                        if (nationality) return nationality;
                        if (code) return code;
                        return "—";
                      })()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Instagram</Label>
                    <p className="font-medium">
                      {stallRequest.shopkeeperId?.instagramHandle ? (
                        <a
                          href={stallRequest.shopkeeperId?.instagramHandle}
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
                  {/* Tax & Registration */}
                  <div>
                    {(() => {
                      const code = stallRequest.shopkeeperId?.countryCode || stallRequest.shopkeeperId?.country || "";
                      const isIN = code === "+91" || code === "IN";
                      if (isIN) {
                        return (<>
                          <Label className="text-muted-foreground">GST Number</Label>
                          <p className="font-medium uppercase">{stallRequest.shopkeeperId?.GSTNumber || "Not Provided"}</p>
                        </>);
                      }
                      if (stallRequest.shopkeeperId?.UENNumber) {
                        return (<>
                          <Label className="text-muted-foreground">UEN Number</Label>
                          <p className="font-medium uppercase">{stallRequest.shopkeeperId.UENNumber}</p>
                        </>);
                      }
                      if (stallRequest.shopkeeperId?.GSTNumber) {
                        return (<>
                          <Label className="text-muted-foreground">GST Number</Label>
                          <p className="font-medium uppercase">{stallRequest.shopkeeperId.GSTNumber}</p>
                        </>);
                      }
                      if (stallRequest.registrationNumber) {
                        return (<>
                          <Label className="text-muted-foreground">Registration No.</Label>
                          <p className="font-medium uppercase">{stallRequest.registrationNumber}</p>
                        </>);
                      }
                      return (<>
                        <Label className="text-muted-foreground">Registration</Label>
                        <p className="font-medium text-muted-foreground italic text-sm">Not Provided</p>
                      </>);
                    })()}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="font-medium">
                      {stallRequest.shopkeeperId?.businessCategory || "—"}
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
                      {stallRequest.businessOwnerNationality || "—"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Residency</Label>
                    <p className="font-medium">
                      {stallRequest.residency || "—"}
                    </p>
                  </div>
                  {/* Financial/System Details (New) */}
                  {/* <div className="pt-2 border-t col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Member Since
                      </Label>
                      <p className="text-sm">
                        {new Date(
                          stallRequest.shopkeeperId?.createdAt,
                        ).toLocaleDateString("en-IN", {
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div> */}
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
                      {stallRequest.couponCodeAssigned || "None Assigned"}
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
                  {/* Full Address */}
                  <div className="pt-2 border-t col-span-2">
                    <Label className="text-muted-foreground text-xs">
                      Business Address
                    </Label>
                    <p className="text-sm leading-tight mt-1 italic">
                      {stallRequest.shopkeeperId?.address || "Not provided"}
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

                  {/* Registration Document */}

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

                  {/* <div className="pt-2 border-t col-span-2">
                    <Label className="text-muted-foreground text-xs">
                      Business Address
                    </Label>
                    <p className="text-sm leading-tight mt-1 italic">
                      {stallRequest.shopkeeperId?.address || "Not provided"}
                    </p>
                  </div> */}
                </CardContent>
              </Card>

              {/* Event Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Event Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Header Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">
                        Event Title
                      </Label>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-lg">
                          {stallRequest.eventId?.title || "—"}
                        </p>
                        {/* <Badge
                          variant={
                            stallRequest.eventId.status === "draft"
                              ? "secondary"
                              : "default"
                          }
                        >
                          {stallRequest.eventId.status}
                        </Badge> */}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Category</Label>
                      <p className="font-medium">
                        {stallRequest.eventId?.category || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Timing & Location Section */}
                  <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg">
                    <div>
                      <Label className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Duration
                      </Label>
                      <p className="text-sm font-medium">
                        {formatDate(stallRequest.eventId?.startDate)} -{" "}
                        {formatDate(stallRequest.eventId?.endDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Starts at: {stallRequest.eventId?.time || "TBA"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Venue
                      </Label>
                      <p className="text-sm font-medium">
                        {stallRequest.eventId?.location || "TBA"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {stallRequest.eventId?.address}
                      </p>
                    </div>
                  </div>

                  {/* Event Features — only show if at least one is active */}
                  {stallRequest.eventId?.features && Object.values(stallRequest.eventId.features).some(Boolean) && (
                  <div>
                    <Label className="text-muted-foreground mb-2 block text-xs uppercase tracking-wider">
                      Included Features
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {stallRequest.eventId?.features?.parking && (
                        <Badge
                          variant="outline"
                          className="flex gap-1 items-center bg-green-50"
                        >
                          <ParkingCircle className="w-3 h-3" /> Parking
                        </Badge>
                      )}
                      {stallRequest.eventId?.features?.wifi && (
                        <Badge
                          variant="outline"
                          className="flex gap-1 items-center bg-yellow-50"
                        >
                          <Wifi className="w-3 h-3" /> WiFi
                        </Badge>
                      )}
                      {stallRequest.eventId?.features?.photography && (
                        <Badge
                          variant="outline"
                          className="flex gap-1 items-center bg-blue-50"
                        >
                          <Camera className="w-3 h-3" /> Photography
                        </Badge>
                      )}
                      {stallRequest.eventId?.features?.security && (
                        <Badge
                          variant="outline"
                          className="flex gap-1 items-center bg-red-50"
                        >
                          <ShieldCheck className="w-3 h-3" /> Security
                        </Badge>
                      )}
                      {stallRequest.eventId?.features?.food && (
                        <Badge
                          variant="outline"
                          className="flex gap-1 items-center bg-pink-50"
                        >
                          <FaUtensilSpoon className="w-3 h-3" /> Food Available
                        </Badge>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Management Details */}
                  <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div>
                      <Label className="text-muted-foreground">
                        Dress Code
                      </Label>
                      <p className="text-sm font-medium">
                        {stallRequest.eventId?.dresscode || "Casual"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Age Limit</Label>
                      <p className="text-sm font-medium">
                        {stallRequest.eventId?.ageRestriction || "No Limit"}
                      </p>
                    </div>
                  </div>

                  {/* Stall Booking Stats — only if event has tickets */}
                  {(stallRequest.eventId?.ticketPrice || stallRequest.eventId?.visitorTypes?.length > 0) && (
                    <div className="border-t pt-4">
                      <Label className="text-muted-foreground block mb-2">
                        Ticketing
                      </Label>
                      <div className="flex gap-4 text-sm">
                        <div className="text-center p-2 border rounded-md flex-1">
                          <span className="block text-xs text-muted-foreground">
                            Ticket Price
                          </span>
                          <span className="font-bold">
                            {stallRequest.eventId?.ticketPrice ? formatPrice(stallRequest.eventId.ticketPrice) : "Free"}
                          </span>
                        </div>
                        <div className="text-center p-2 border rounded-md flex-1">
                          <span className="block text-xs text-muted-foreground">
                            Available Slots
                          </span>
                          <span className="font-bold">
                            {stallRequest.eventId?.totalTickets || "Unlimited"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Gallery Preview */}
                  {stallRequest.eventId?.gallery?.length > 0 && (
                    <div className="border-t pt-4">
                      <Label className="text-muted-foreground block mb-2">
                        Event Gallery
                      </Label>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {stallRequest.eventId?.gallery.map((img, idx) => (
                          <img
                            key={idx}
                            src={`${__API_URL__}${img}`}
                            className="w-16 h-16 rounded-md object-cover border shadow-sm"
                            alt="Event"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Selected Tables */}
              {stallRequest.selectedTables.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Selected Tables</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stallRequest.selectedTables.map((table, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded"
                        >
                          <div>
                            <p className="font-medium">{table.tableName}</p>
                            <p className="text-sm text-muted-foreground">
                              {table.tableType}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {formatPrice(table.price)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              +{formatPrice(table.depositAmount)} deposit
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Selected Add-ons */}
              {stallRequest.selectedAddOns.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Selected Add-ons</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stallRequest.selectedAddOns.map((addon, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded"
                        >
                          <div>
                            <p className="font-medium">{addon.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Quantity: {addon.quantity}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {formatPrice(addon.price * addon.quantity)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatPrice(addon.price)} each
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Price Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Price Summary</CardTitle>
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
                  <CardTitle className="text-lg">Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 rounded-full p-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Request Submitted</p>
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
                        <p className="font-medium">Request Confirmed</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(stallRequest.confirmationDate)}
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
                        <p className="font-medium">Tables Selected</p>
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
                        <p className="font-medium">Payment Received</p>
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
                        <p className="font-medium">Booking Completed</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(stallRequest.completionDate)}
                        </p>
                      </div>
                    </div>
                  )}
                  {stallRequest.hasCheckedIn && stallRequest.checkInTime && (
                    <div className="flex items-start gap-3">
                      <div className="bg-green-100 rounded-full p-2">
                        <Clock1 className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">Checked In Time</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(stallRequest.checkInTime)}
                        </p>
                      </div>
                    </div>
                  )}
                  {stallRequest.hasCheckedOut && stallRequest.checkOutTime && (
                    <div className="flex items-start gap-3 justify-between">
                      <div className="flex items-start gap-3">
                        <div className="bg-green-100 rounded-full p-2">
                          <Clock12 className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Checked Out Time</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(stallRequest.checkOutTime)}
                          </p>
                        </div>
                      </div>
                      {!stallRequest.depositReturned && (
                        <div className="flex justify-between gap-3">
                          <div>
                            <button
                              className="bg-primary px-4 py-2 rounded text-white"
                              onClick={() => {
                                setReturnDepositStallId(stallRequest._id);
                                setShowReturnDepositDialog(true);
                              }}
                            >
                              Deposit Returned
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              {/* Status History Timeline with Notes */}
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
                        {/* Vertical line */}
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                        {stallRequest.statusHistory.map(
                          (entry: StatusHistoryEntry, index: number) => {
                            const statusConfig: Record<
                              string,
                              { bg: string; text: string; border: string }
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
                              Processing: {
                                bg: "bg-blue-100",
                                text: "text-blue-700",
                                border: "border-blue-300",
                              },
                              Partial: {
                                bg: "bg-orange-100",
                                text: "text-orange-700",
                                border: "border-orange-300",
                              },
                              Paid: {
                                bg: "bg-green-100",
                                text: "text-green-700",
                                border: "border-green-300",
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
                            const config = statusConfig[entry.status] || {
                              bg: "bg-gray-100",
                              text: "text-gray-700",
                              border: "border-gray-300",
                            };

                            return (
                              <div
                                key={index}
                                className="relative flex gap-4 pb-6 last:pb-0"
                              >
                                {/* Dot on the timeline */}
                                <div
                                  className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.bg} border-2 ${config.border}`}
                                >
                                  <span className="text-xs font-bold">
                                    {index + 1}
                                  </span>
                                </div>

                                {/* Content */}
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
                                      {formatDateTime(entry.changedAt)}
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
                    <p className="text-sm">{stallRequest.cancellationReason}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button variant="buttonOutline" onClick={() => closeStallDialog()}>
              Close
            </Button>
            <Button
              onClick={handleSharePDF}
              disabled={isGeneratingPDF}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Share as PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
