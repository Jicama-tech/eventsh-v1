// File: src/components/DashboardTabs/MyEventUsers.tsx

import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Eye,
  Ticket,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Clock,
  QrCode,
  User,
  ShoppingBag,
  Filter,
  Ban,
  Edit,
  CheckCircle2,
  Store,
  Plus,
  Loader2,
  Send,
  Search,
  XCircle,
  MoreVertical,
  Edit2,
  AlertCircle,
  FileText,
  Package,
  CreditCard,
  Clock1,
  Clock12,
  ParkingCircle,
  Camera,
  ShieldCheck,
} from "lucide-react";
import {
  FaWhatsapp,
  FaRupeeSign,
  FaDollarSign,
  FaUtensilSpoon,
} from "react-icons/fa";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useToast } from "@/hooks/use-toast";
import { jwtDecode } from "jwt-decode";
import { ShopkeeperDetailView } from "./ShopkeeperDetailView"; // Assuming this exists in your project
import { AddShopkeeperForm } from "./AddShopkeeperForm"; // Assuming this exists in your project
import { StallRequest } from "./shopKeeper";

const apiURL = __API_URL__;

// --- Interfaces based on data.txt and existing API ---

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

const SUPPORTED_COUNTRIES = [
  { name: "India", code: "IN", dialCode: "+91" },
  { name: "Singapore", code: "SG", dialCode: "+65" },
];

interface AddExhibitorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerAdded?: (customer: any) => void;
  exhibitorToEdit?: any;
  mode?: "add" | "edit";
}

interface EventInfo {
  _id: string;
  title: string;
  location: string;
  startDate: string;
  endDate?: string;
  time: string;
  image?: string;
}

interface TicketDetail {
  ticketType: string;
  quantity: number;
  price: number;
  _id: string;
}

// Data.txt [Source 1-47]
interface TicketData {
  _id: string;
  ticketId: string;
  eventId: EventInfo;
  organizerId: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  ticketDetails: TicketDetail[];
  totalAmount: number;
  paymentConfirmed: boolean;
  status: string;
  purchaseDate: string;
  qrCode?: string;
  attendance: boolean;
}

// Derived interface for UI
interface ProcessedVisitor {
  id: string; // WhatsApp or Email or Database ID
  name: string;
  email: string;
  whatsapp: string;
  source: "ticket" | "created" | "both"; // Where did this user come from?
  totalSpent: number;
  ticketsPurchased: number;
  eventsAttended: number; // Count of unique events
  lastActiveDate: string;
  tickets: TicketData[]; // Full history
}

interface ProcessedExhibitor {
  _id: string;
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  whatsapp: string;
  category: string;
  status: string; // From shopkeeper profile (approved/rejected)
  totalSpent: number;
  stallsBooked: number;
  requests: StallRequest[];
}

interface Country {
  name: string;
  dialCode: string;
  code: string;
  flag: string;
}

interface MyEventUsersProps {
  setShowAddUser: React.Dispatch<React.SetStateAction<boolean>>;
}

const MyEventUsers: React.FC<MyEventUsersProps> = ({ setShowAddUser }) => {
  const { toast } = useToast();

  // -- Data State --
  const [visitors, setVisitors] = useState<ProcessedVisitor[]>([]);
  const [exhibitors, setExhibitors] = useState<ProcessedExhibitor[]>([]);
  const [events, setEvents] = useState<EventInfo[]>([]);

  // -- UI State --
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("visitors");
  const [country, setCountry] = useState("IN");
  const { formatPrice } = useCurrency(country);

  // -- Filter State --
  const [searchQuery, setSearchQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("All");

  // -- Dialog State --
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddExhibitor, setShowAddExhibitor] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<any>(null);
  const [exhibitorToEdit, setExhibitorToEdit] = useState<any>(null);

  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedQRCode, setSelectedQRCode] = useState<string>("");

  // Details Dialogs
  const [selectedVisitor, setSelectedVisitor] =
    useState<ProcessedVisitor | null>(null);
  const [selectedExhibitor, setSelectedExhibitor] =
    useState<ProcessedExhibitor | null>(null);
  const [showVisitorDetails, setShowVisitorDetails] = useState(false);
  const [showExhibitorDetails, setShowExhibitorDetails] = useState(false);

  // Invitation State
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteType, setInviteType] = useState<"visitor" | "exhibitor">(
    "visitor",
  );
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);
  const [selectedInviteEvents, setSelectedInviteEvents] = useState<string[]>(
    [],
  );
  const [invitationMessage, setInvitationMessage] = useState("");
  const [sendingInvitations, setSendingInvitations] = useState(false);
  const [showStallDetailDialog, setShowStallDetailDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<StallRequest | null>(
    null,
  );
  const [showStallDetailsDialog, setShowStallDetailsDialog] = useState(false);

  const [stallRequest, setStallRequest] = useState<StallRequest | null>(null);

  // -- Helpers --
  const getOrganizerIdFromToken = () => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.sub;
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
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

  // -- Fetching Data --

  const fetchOrganizer = async () => {
    try {
      const organizerId = getOrganizerIdFromToken();
      if (!organizerId) return;
      const response = await fetch(
        `${apiURL}/organizers/profile-get/${organizerId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setCountry(data.data.country || "IN");
      }
    } catch (error) {
      console.error("Error fetching organizer profile", error);
    }
  };

  const fetchEvents = async () => {
    try {
      const organizerId = getOrganizerIdFromToken();
      if (!organizerId) return;
      const response = await fetch(
        `${apiURL}/events/organizer/${organizerId}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      if (response.ok) {
        const result = await response.json();
        setEvents(result.data || result);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  };

  const showEditCustomer = async (customer: any) => {
    setShowAddCustomer(true);
    setCustomerToEdit(customer);
  };

  const showEditExhibitor = async (exhibitor: any) => {
    setShowAddExhibitor(true);
    setExhibitorToEdit(exhibitor);
  };

  const fetchAllData = async () => {
    setLoading(true);
    const organizerId = getOrganizerIdFromToken();
    if (!organizerId) return;

    try {
      const token = sessionStorage.getItem("token");

      // --- A. Fetch Visitors (Merge Tickets + Manual Users) ---
      const [ticketsRes, usersRes] = await Promise.all([
        fetch(`${apiURL}/tickets/organizer/${organizerId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        // Fetch users manually created by this organizer
        fetch(`${apiURL}/users/fetch-users-by-organizer/${organizerId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      let ticketData: TicketData[] = [];
      let manualUsersData: any[] = [];

      if (ticketsRes.ok) ticketData = await ticketsRes.json();
      if (usersRes.ok) {
        const uRes = await usersRes.json();
        manualUsersData = uRes.data || [];
      }

      // Merge Logic
      const visitorMap = new Map<string, ProcessedVisitor>();

      // 1. Process Tickets
      ticketData.forEach((t) => {
        const key = t.customerWhatsapp || t.customerEmail || t._id;
        if (!visitorMap.has(key)) {
          visitorMap.set(key, {
            id: key,
            name: t.customerName,
            email: t.customerEmail || "",
            whatsapp: t.customerWhatsapp || "",
            source: "ticket",
            totalSpent: 0,
            ticketsPurchased: 0,
            eventsAttended: 0,
            lastActiveDate: t.purchaseDate,
            tickets: [],
          });
        }
        const v = visitorMap.get(key)!;
        v.totalSpent += t.totalAmount;
        v.ticketsPurchased += t.ticketDetails.reduce(
          (sum, d) => sum + d.quantity,
          0,
        );
        v.tickets.push(t);
        // Determine unique events
        const unique = new Set(v.tickets.map((tk) => tk.eventId?._id));
        v.eventsAttended = unique.size;
        // Update date
        if (new Date(t.purchaseDate) > new Date(v.lastActiveDate))
          v.lastActiveDate = t.purchaseDate;
      });

      // 2. Process Manual Users (Merge or Add)
      manualUsersData.forEach((u) => {
        const key = u.whatsAppNumber || u.email || u._id; // Normalized key
        if (visitorMap.has(key)) {
          // Exists from tickets - update source to 'both'
          const existing = visitorMap.get(key)!;
          existing.source = "both";
          // If manual user has better name/email details, could update here
        } else {
          // New manual user
          visitorMap.set(key, {
            id: u._id || u.id,
            name: u.name || `${u.firstName} ${u.lastName}`,
            email: u.email || "",
            whatsapp: u.whatsAppNumber || "",
            source: "created",
            totalSpent: 0,
            ticketsPurchased: 0,
            eventsAttended: 0,
            lastActiveDate: u.createdAt || new Date().toISOString(),
            tickets: [],
          });
        }
      });

      setVisitors(Array.from(visitorMap.values()));

      // --- B. Fetch Exhibitors (Stalls) ---
      const [stallsRes, shopkeepersRes] = await Promise.all([
        fetch(`${apiURL}/stalls/organizer/${organizerId}`),
        fetch(
          `${apiURL}/shopkeepers/fetch-shopkeepers-by-organizer/${organizerId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
      ]);

      let stallsList: StallRequest[] = [];
      let manualShopkeepers: any[] = [];

      if (stallsRes.ok) {
        const sRes = await stallsRes.json();
        stallsList = sRes.data || [];
      }
      if (shopkeepersRes.ok) {
        const shRes = await shopkeepersRes.json();
        manualShopkeepers = shRes.data || [];
      }

      // --- Merge Logic for Exhibitors ---
      const exhibitorMap = new Map<string, ProcessedExhibitor>();

      // 1. Process Stalls (Exhibitors with bookings)
      stallsList.forEach((stall) => {
        if (!stall.shopkeeperId) return;
        const key = stall.shopkeeperId?._id;

        if (!exhibitorMap.has(key)) {
          exhibitorMap.set(key, {
            _id: key,
            shopName: stall.shopkeeperId?.shopName || stall.shopkeeperId?.businessName || stall.brandName || "",
            ownerName: stall.shopkeeperId?.name || stall.nameOfApplicant || "",
            email: stall.shopkeeperId?.businessEmail || stall.shopkeeperId?.email || "",
            phone: stall.shopkeeperId?.phone || "",
            whatsapp:
              stall.shopkeeperId?.whatsappNumber || stall.shopkeeperId?.whatsAppNumber || stall.shopkeeperId?.phone || "",
            category: stall.shopkeeperId?.businessCategory || "Uncategorized",
            status: stall.shopkeeperId?.approved
              ? "Verified"
              : stall.shopkeeperId?.rejected
                ? "Rejected"
                : "Pending",
            totalSpent: 0,
            stallsBooked: 0,
            requests: [],
          });
        }
        const ex = exhibitorMap.get(key)!;
        if (stall.status === "Confirmed" || stall.status === "Completed") {
          ex.totalSpent += stall.grandTotal;
          ex.stallsBooked += 1;
        }
        ex.requests.push(stall);
      });

      // 2. Process Manual Shopkeepers (Exhibitors created but maybe no bookings yet)
      manualShopkeepers.forEach((shop) => {
        const key = shop._id;

        if (exhibitorMap.has(key)) {
          // Already exists from stalls list, we skip or could update details if needed
          // const existing = exhibitorMap.get(key)!;
          // existing.status = shop.approved ? "Verified" : ...
        } else {
          // New manual shopkeeper without stalls
          exhibitorMap.set(key, {
            _id: key,
            shopName: shop.shopName || "Unknown Shop",
            ownerName: shop.name,
            email: shop.businessEmail || shop.email,
            phone: shop.phone,
            whatsapp: shop.whatsappNumber,
            category: shop.businessCategory || "Uncategorized",
            status: shop.approved
              ? "Verified"
              : shop.rejected
                ? "Rejected"
                : "Pending",
            totalSpent: 0,
            stallsBooked: 0,
            requests: [], // No stall requests yet
          });
        }
      });

      setExhibitors(Array.from(exhibitorMap.values()));
    } catch (error) {
      console.error("Fetch Error:", error);
      toast({
        title: "Error",
        description: "Could not load user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizer();
    fetchEvents();
    fetchAllData();
  }, []);

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

  const handleReturnDeposit = (stallId: string) => {
    try {
      if (!stallId) {
        toast({
          duration: 5000,
          title: "Error",
          description: "Stall ID is required",
          variant: "destructive",
        });
      }

      const result = fetch(`${apiURL}/stalls/${stallId}/return-deposit`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (result) {
        toast({
          duration: 5000,
          title: "Success",
          description: "Deposit returned successfully",
        });
      }
    } catch (error) {
      console.error(error);
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

  // -- Calculated Stats --
  const stats = useMemo(() => {
    const totalVisitors = visitors.length;
    const totalExhibitors = exhibitors.length;
    const totalRevenue =
      visitors.reduce((sum, v) => sum + v.totalSpent, 0) +
      exhibitors.reduce((sum, e) => sum + e.totalSpent, 0);
    const totalTickets = visitors.reduce(
      (sum, v) => sum + v.ticketsPurchased,
      0,
    );

    return { totalVisitors, totalExhibitors, totalRevenue, totalTickets };
  }, [visitors, exhibitors]);

  // -- Filtering Logic --
  const filteredVisitors = visitors.filter((v) => {
    const matchSearch =
      (v.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (v.email?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (v.whatsapp || "").includes(searchQuery);
    const matchEvent =
      eventFilter === "All" ||
      v.tickets.some((t) => t.eventId?.title === eventFilter);
    return matchSearch && matchEvent;
  });

  const filteredExhibitors = exhibitors.filter((e) => {
    const matchSearch =
      (e.shopName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (e.ownerName?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    // Event filter for exhibitors checks if they have a request for that event
    const matchEvent =
      eventFilter === "All" ||
      e.requests.some((r) => r.eventId?.title === eventFilter);
    return matchSearch && matchEvent;
  });

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

  async function closeStallDialog() {
    setSelectedRequest(null);
    setShowStallDetailDialog(false);
  }

  async function openStallDialog(stall: StallRequest) {
    setSelectedRequest(stall);
    setShowStallDetailDialog(true);
    await fetchStall(stall._id);
  }

  // -- Handlers --

  const handleOpenInvite = (type: "visitor" | "exhibitor") => {
    setInviteType(type);
    setSelectedInvitees([]);
    setSelectedInviteEvents([]);
    setInvitationMessage("");
    setShowInviteDialog(true);
  };

  const handleShowQRCode = (qrCode: string) => {
    setSelectedQRCode(qrCode);
    setShowQRDialog(true);
  };

  const handleSendInvitations = async () => {
    if (selectedInvitees.length === 0 || selectedInviteEvents.length === 0) {
      toast({
        title: "Warning",
        description: "Select at least one recipient and one event.",
        variant: "destructive",
      });
      return;
    }

    setSendingInvitations(true);
    const organizerId = getOrganizerIdFromToken();

    try {
      const promises = [];

      // We loop through selected events and selected users
      for (const eventId of selectedInviteEvents) {
        for (const recipientId of selectedInvitees) {
          let endpoint = "";
          let body = {};

          if (inviteType === "exhibitor") {
            endpoint = `${apiURL}/invitations/send-stall-invitation`;
            body = {
              eventId,
              shopkeeperId: recipientId,
              organizerId,
              message: invitationMessage,
            };
          } else {
            // NOTE: Assuming an endpoint for User/Visitor invitations exists or using a generic one
            // If strictly using provided APIs, one might need to adapt this.
            // For now, mapping to a hypothetical endpoint based on the requirement.
            endpoint = `${apiURL}/invitations/send-user-invitation`;
            // Fallback for simulation if endpoint doesn't exist in backend yet:
            body = {
              eventId,
              userId: recipientId, // Or visitor ID/Email depending on backend
              organizerId,
              message: invitationMessage,
            };
          }

          // Use fetch for the actual call
          const req = fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify(body),
          });
          promises.push(req);
        }
      }

      await Promise.allSettled(promises);

      toast({
        title: "Success",
        description: `Sent invitations to ${selectedInvitees.length} ${inviteType}s.`,
      });
      setShowInviteDialog(false);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to send invitations",
        variant: "destructive",
      });
    } finally {
      setSendingInvitations(false);
    }
  };

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Relationship Management
          </h2>
          <p className="text-muted-foreground">
            Manage Visitors and Exhibitors across your events.
          </p>
        </div>
        <div className="flex gap-2">
          {/* <Button onClick={() => setShowAddCustomer(true)} variant="outline">
            <Plus className="mr-2 h-4 w-4" /> Add Visitor
          </Button> */}
          {/* Keeping this if you have the component */}
          {/* <Button onClick={() => setShowAddShopkeeper(true)}>
                <Store className="mr-2 h-4 w-4" /> Add Exhibitor
            </Button> */}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Visitors
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVisitors}</div>
            <p className="text-xs text-muted-foreground">
              Unique ticket buyers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Exhibitors
            </CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalExhibitors}</div>
            <p className="text-xs text-muted-foreground">
              Registered stall owners
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            {country === "IN" ? (
              <FaRupeeSign className="h-4 w-4 text-muted-foreground" />
            ) : (
              <FaDollarSign className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(stats.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Combined ticket & stall sales
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Sold</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTickets}</div>
            <p className="text-xs text-muted-foreground">Across all events</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs
        defaultValue="visitors"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
            <TabsTrigger value="visitors">Visitors</TabsTrigger>
            <TabsTrigger value="exhibitors">Exhibitors</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter Event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Events</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e._id} value={e.title}>
                    {e.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Visitors Tab Content */}
        <TabsContent value="visitors">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Visitor Management</CardTitle>
                <CardDescription>
                  View and manage users who purchased tickets.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleOpenInvite("visitor")}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="mr-2 h-4 w-4" /> Invite Visitors
                </Button>
                <Button
                  onClick={() => setShowAddCustomer(true)}
                  variant="outline"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Visitor
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin h-8 w-8" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVisitors.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No visitors found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredVisitors.map((visitor) => (
                        <TableRow key={visitor.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {visitor.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {visitor.tickets.length} Tickets
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 text-sm">
                              {visitor.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3 text-muted-foreground" />{" "}
                                  {visitor.email}
                                </div>
                              )}
                              {visitor.whatsapp && (
                                <div className="flex items-center gap-1">
                                  <FaWhatsapp className="h-3 w-3 text-green-600" />{" "}
                                  {visitor.whatsapp}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {formatPrice(visitor.totalSpent)}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {visitor.ticketsPurchased} Tix
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(visitor.lastActiveDate)}
                          </TableCell>
                          <TableCell className="text-center gap-2">
                            <div className="flex space-x-2">
                              <Button
                                variant="buttonOutline"
                                size="icon"
                                onClick={() => {
                                  setSelectedVisitor(visitor);
                                  setShowVisitorDetails(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {visitor.source === "created" && (
                                <Button
                                  variant="buttonOutline"
                                  size="sm"
                                  onClick={() => showEditCustomer(visitor)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exhibitors Tab Content */}
        <TabsContent value="exhibitors">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Exhibitor Management</CardTitle>
                <CardDescription>
                  View and manage shopkeepers participating in stalls.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleOpenInvite("exhibitor")}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Send className="mr-2 h-4 w-4" /> Invite Exhibitors
                </Button>
                <Button
                  onClick={() => setShowAddExhibitor(true)}
                  variant="outline"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Exhibitor
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin h-8 w-8" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exhibitor</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExhibitors.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No exhibitors found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredExhibitors.map((exhibitor) => (
                        <TableRow key={exhibitor._id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {exhibitor.ownerName || "—"}
                              </span>
                              {exhibitor.shopName && (
                                <span className="text-xs text-muted-foreground">
                                  {exhibitor.shopName}
                                </span>
                              )}
                              <Badge
                                variant="outline"
                                className="w-fit text-[10px] mt-1"
                              >
                                {exhibitor.category || "Uncategorized"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {exhibitor.email || "—"}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {exhibitor.whatsapp || exhibitor.phone || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {exhibitor.status === "Verified" ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                <CheckCircle2 className="h-3 w-3 mr-1" />{" "}
                                Verified
                              </Badge>
                            ) : exhibitor.status === "Rejected" ? (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" /> Rejected
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" /> Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-sm">
                              <span className="font-semibold">
                                {formatPrice(exhibitor.totalSpent)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {exhibitor.stallsBooked} Stalls
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="buttonOutline"
                                size="icon"
                                onClick={() => {
                                  setSelectedExhibitor(exhibitor);
                                  setShowExhibitorDetails(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- Dialogs --- */}

      {/* 1. Add Visitor Dialog */}
      {showAddCustomer && (
        <AddCustomerDialog
          isOpen={showAddCustomer}
          onClose={() => {
            setShowAddCustomer(false);
            fetchAllData(); // Refresh data after add
          }}
          customerToEdit={customerToEdit}
          mode={customerToEdit ? "edit" : "add"}
        />
      )}

      {showAddExhibitor && (
        <AddExhibitorDialog
          isOpen={showAddExhibitor}
          onClose={() => {
            setShowAddExhibitor(false);
            fetchAllData(); // Refresh data after add
          }}
          exhibitorToEdit={exhibitorToEdit}
          mode={exhibitorToEdit ? "edit" : "add"}
        />
      )}

      {/* 2. Visitor Details Dialog */}
      <Dialog open={showVisitorDetails} onOpenChange={setShowVisitorDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visitor Details</DialogTitle>
            <DialogDescription>
              Full history for {selectedVisitor?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedVisitor && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Sidebar Info */}
              <div className="md:col-span-1 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Contact Info</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />{" "}
                      {selectedVisitor.name}
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />{" "}
                      {selectedVisitor.email || "N/A"}
                    </div>
                    <div className="flex items-center gap-2">
                      <FaWhatsapp className="h-4 w-4 text-green-600" />{" "}
                      {selectedVisitor.whatsapp || "N/A"}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span>Total Spent:</span>{" "}
                      <span className="font-bold">
                        {formatPrice(selectedVisitor.totalSpent)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Events:</span>{" "}
                      <span className="font-bold">
                        {selectedVisitor.eventsAttended}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tickets:</span>{" "}
                      <span className="font-bold">
                        {selectedVisitor.ticketsPurchased}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
              {/* Main History */}
              <div className="md:col-span-2">
                <h3 className="font-semibold mb-2">Ticket History</h3>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {selectedVisitor.tickets.map((t, idx) => (
                      <Card key={idx}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold">
                                {t.eventId?.title || "Unknown Event"}
                              </h4>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />{" "}
                                {formatDate(t.eventId?.startDate)}
                                <MapPin className="h-3 w-3 ml-2" />{" "}
                                {t.eventId?.location}
                              </p>
                            </div>
                            <Badge>{t.status}</Badge>
                          </div>
                          <Separator className="my-3" />
                          <div className="text-sm">
                            {t.ticketDetails.map((td, i) => (
                              <div key={i} className="flex justify-between">
                                <span>
                                  {td.quantity}x {td.ticketType}
                                </span>
                                <span>
                                  {formatPrice(td.price * td.quantity)}
                                </span>
                              </div>
                            ))}
                            <div className="flex justify-between mt-2 font-bold border-t pt-1">
                              <span>Total</span>
                              <span>{formatPrice(t.totalAmount)}</span>
                            </div>
                          </div>
                          {t.qrCode && (
                            <div className="mt-2 pt-2 border-t flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleShowQRCode(t.qrCode!)}
                              >
                                <QrCode className="h-3 w-3 mr-2" /> View QR
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
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
            <div className="space-y-6">
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

              {/* Shopkeeper Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Shopkeeper Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  {/* Basic Info */}
                  <div>
                    <Label className="text-muted-foreground">Owner Name</Label>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {stallRequest.shopkeeperId?.name}
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
                      {stallRequest.shopkeeperId?.shopName || stallRequest.shopkeeperId?.businessName || "Not provided"}
                    </p>
                  </div>

                  {/* Contact Info */}
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

                  <div>
                    <Label className="text-muted-foreground">WhatsApp</Label>
                    <p className="font-medium">
                      {stallRequest.shopkeeperId?.whatsappNumber ? (
                        <a
                          href={`https://wa.me/${stallRequest.shopkeeperId.whatsappNumber.replace(/\+/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline"
                        >
                          {stallRequest.shopkeeperId.whatsappNumber}
                        </a>
                      ) : (
                        <span className="text-muted-foreground italic text-sm">Not provided</span>
                      )}
                    </p>
                  </div>

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
                      if (isIN && stallRequest.shopkeeperId?.GSTNumber) {
                        return (<><Label className="text-muted-foreground">GST Number</Label><p className="font-medium uppercase">{stallRequest.shopkeeperId.GSTNumber}</p></>);
                      }
                      if (stallRequest.shopkeeperId?.UENNumber) {
                        return (<><Label className="text-muted-foreground">UEN Number</Label><p className="font-medium uppercase">{stallRequest.shopkeeperId.UENNumber}</p></>);
                      }
                      if (stallRequest.registrationNumber) {
                        return (<><Label className="text-muted-foreground">Registration No.</Label><p className="font-medium uppercase">{stallRequest.registrationNumber}</p></>);
                      }
                      return (<><Label className="text-muted-foreground">Registration</Label><p className="font-medium text-muted-foreground italic text-sm">Not Provided</p></>);
                    })()}
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="font-medium">
                      {stallRequest.shopkeeperId?.businessCategory}
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

                  {/* Full Address */}
                  <div className="pt-2 border-t col-span-2">
                    <Label className="text-muted-foreground text-xs">
                      Business Address
                    </Label>
                    <p className="text-sm leading-tight mt-1 italic">
                      {stallRequest.shopkeeperId?.address}
                    </p>
                  </div>
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
                          {stallRequest.eventId?.title || "Unknown Event"}
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
                          <FaUtensilSpoon className="w-3 h-3" /> Food Avaliable
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
                        {stallRequest.eventId?.gallery?.map((img: string, idx: number) => (
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
                      <div className="flex justify-between gap-3">
                        <div>
                          <button
                            className="bg-primary px-4 py-2 rounded text-white"
                            onClick={() =>
                              handleReturnDeposit(stallRequest._id)
                            }
                          >
                            Deposit Returned
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              {stallRequest.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{stallRequest.notes}</p>
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

          <DialogFooter>
            <Button variant="buttonOutline" onClick={() => closeStallDialog()}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Exhibitor Details Dialog */}
      <Dialog
        open={showExhibitorDetails}
        onOpenChange={setShowExhibitorDetails}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Exhibitor Details</DialogTitle>
          </DialogHeader>
          {selectedExhibitor && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Business Info</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="font-bold text-lg">
                      {selectedExhibitor.shopName || selectedExhibitor.ownerName || "Unknown"}
                    </div>
                    <Badge variant="outline">
                      {selectedExhibitor.category || "Uncategorized"}
                    </Badge>
                    <Separator className="my-2" />
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" /> {selectedExhibitor.ownerName}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> {selectedExhibitor.phone}
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> {selectedExhibitor.email}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="md:col-span-2">
                <h3 className="font-semibold mb-2">Stall Requests</h3>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {selectedExhibitor.requests.map((req, idx) => (
                      <Card key={idx}>
                        <CardContent className="p-4">
                          <div
                            className="cursor-pointer"
                            onClick={() => {
                              openStallDialog(req);
                            }}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold">
                                  {req.eventId?.title}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  {formatDateTime(req.requestDate)}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge
                                  className={
                                    req.status === "Confirmed"
                                      ? "bg-green-600"
                                      : "bg-gray-500"
                                  }
                                >
                                  {req.status}
                                </Badge>
                                <span className="text-xs font-mono">
                                  {req.paymentStatus}
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 text-sm">
                              <div className="flex justify-between">
                                <span>Grand Total</span>
                                <span className="font-bold">
                                  {formatPrice(req.grandTotal)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 4. Universal Invitation Dialog (The requested Feature) */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Send Invitations to{" "}
              {inviteType === "visitor" ? "Visitors" : "Exhibitors"}
            </DialogTitle>
            <DialogDescription>
              Select events and recipients to broadcast a message.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[400px]">
            {/* Left Col: Events */}
            <div className="border rounded-md p-3 flex flex-col">
              <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Select Events
              </h4>
              <ScrollArea className="flex-1">
                {events.map((event) => (
                  <div
                    key={event._id}
                    className="flex items-center space-x-2 mb-2 p-2 hover:bg-slate-50 rounded"
                  >
                    <Checkbox
                      id={`evt-${event._id}`}
                      checked={selectedInviteEvents.includes(event._id)}
                      onCheckedChange={(checked) => {
                        if (checked)
                          setSelectedInviteEvents([
                            ...selectedInviteEvents,
                            event._id,
                          ]);
                        else
                          setSelectedInviteEvents(
                            selectedInviteEvents.filter(
                              (id) => id !== event._id,
                            ),
                          );
                      }}
                    />
                    <label
                      htmlFor={`evt-${event._id}`}
                      className="text-sm cursor-pointer w-full"
                    >
                      <div className="font-medium">{event.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(event.startDate)}
                      </div>
                    </label>
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* Right Col: Recipients */}
            <div className="border rounded-md p-3 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" /> Select Recipients
                </h4>
                <Button
                  variant="buttonOutline"
                  className="h-6 text-xs"
                  onClick={() => {
                    const allIds =
                      inviteType === "visitor"
                        ? visitors.map((v) => v.id)
                        : exhibitors.map((e) => e._id);
                    if (selectedInvitees.length === allIds.length)
                      setSelectedInvitees([]);
                    else setSelectedInvitees(allIds);
                  }}
                >
                  {selectedInvitees.length > 0 ? "Clear" : "Select All"}
                </Button>
              </div>

              {/* Mini search inside dialog */}
              <Input
                placeholder="Search list..."
                className="h-8 mb-2 text-xs"
                // Note: You might want a local state for this dialog search
              />

              <ScrollArea className="flex-1">
                {(inviteType === "visitor" ? visitors : exhibitors).map(
                  (item: any) => {
                    const id = inviteType === "visitor" ? item.id : item._id;
                    const labelName =
                      inviteType === "visitor" ? item.name : item.shopName;
                    const subText =
                      inviteType === "visitor" ? item.whatsapp : item.ownerName;

                    return (
                      <div
                        key={id}
                        className="flex items-center space-x-2 mb-2 p-2 hover:bg-slate-50 rounded"
                      >
                        <Checkbox
                          id={`rec-${id}`}
                          checked={selectedInvitees.includes(id)}
                          onCheckedChange={(checked) => {
                            if (checked)
                              setSelectedInvitees([...selectedInvitees, id]);
                            else
                              setSelectedInvitees(
                                selectedInvitees.filter((x) => x !== id),
                              );
                          }}
                        />
                        <label
                          htmlFor={`rec-${id}`}
                          className="text-sm cursor-pointer w-full"
                        >
                          <div className="font-medium">{labelName}</div>
                          <div className="text-xs text-muted-foreground">
                            {subText}
                          </div>
                        </label>
                      </div>
                    );
                  },
                )}
              </ScrollArea>
            </div>
          </div>

          <div className="mt-2">
            <Label>Invitation Message (Optional)</Label>
            <Textarea
              placeholder="We'd love to see you at our upcoming event!"
              value={invitationMessage}
              onChange={(e) => setInvitationMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Sending to{" "}
              <span className="font-bold">{selectedInvitees.length}</span>{" "}
              recipients for{" "}
              <span className="font-bold">{selectedInviteEvents.length}</span>{" "}
              events.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendInvitations}
              disabled={sendingInvitations}
            >
              {sendingInvitations && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Send Invitations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Ticket QR Code
            </DialogTitle>
            <DialogDescription>
              Scan this QR code to verify the ticket
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center p-4">
            {selectedQRCode && (
              <img
                src={selectedQRCode}
                alt="Ticket QR Code"
                className="max-w-full h-auto border rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// --- Reusable Add Customer Dialog (Copied & Adapted) ---

export function AddCustomerDialog({
  isOpen,
  onClose,
  onCustomerAdded,
  customerToEdit,
  mode = "add",
}: {
  isOpen: boolean;
  onClose: () => void;
  onCustomerAdded?: (customer: any) => void;
  customerToEdit?: any;
  mode?: "add" | "edit";
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    whatsAppNumber: "",
    email: "",
  });
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchCountries() {
      try {
        const response = await fetch(
          "https://restcountries.com/v3.1/all?fields=name,cca2,idd",
        );
        const data = await response.json();
        const fetched: Country[] = data
          .map((c: any) => {
            const root = c.idd?.root || "";
            const suffix = c.idd?.suffixes?.[0] || "";
            return {
              name: c.name?.common,
              code: c.cca2,
              dialCode: root + suffix,
              flag: "",
            }; // Simplified flag handling
          })
          .filter((c: any) => c.dialCode)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setCountries(fetched);

        // Default to India or inferred
        if (!selectedCountry) {
          const def = fetched.find((c) => c.code === "IN");
          if (def) setSelectedCountry(def);
        }
      } catch (e) {
        console.error(e);
      }
    }
    fetchCountries();
  }, []);

  useEffect(() => {
    if (isOpen && customerToEdit && mode === "edit" && countries.length > 0) {
      const [first, ...rest] = customerToEdit.name.split(" ");

      const rawWhatsapp = customerToEdit.whatsapp || "";


      // Extract country code (e.g. +91)
      const match = rawWhatsapp.match(/^(\+\d{1,2})(.*)$/);


      let country = null;
      let localNumber = rawWhatsapp;

      if (match) {
        const dialCode = match[1]; // +91
        localNumber = match[2].replace(/\s/g, ""); // remaining number

        country = countries.find((c) => c.dialCode === dialCode) || null;
      }

      // 1️⃣ Set selected country first
      setSelectedCountry(country);

      // 2️⃣ Set form data with CLEAN number
      setFormData({
        firstName: first || "",
        lastName: rest.join(" ") || "",
        whatsAppNumber: localNumber,
        email: customerToEdit.email || "",
      });

      setErrors({});
    } else if (isOpen && mode === "add") {
      resetForm();
    }
  }, [isOpen, customerToEdit, mode, countries]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate firstName
    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = "First name must be at least 2 characters";
    } else if (!/^[a-zA-Z\s'-]+$/.test(formData.firstName.trim())) {
      newErrors.firstName = "First name contains invalid characters";
    }

    // Validate lastName
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = "Last name must be at least 2 characters";
    } else if (!/^[a-zA-Z\s'-]+$/.test(formData.lastName.trim())) {
      newErrors.lastName = "Last name contains invalid characters";
    }

    // Validate whatsAppNumber
    if (!formData.whatsAppNumber.trim()) {
      newErrors.whatsAppNumber = "WhatsApp number is required";
    } else if (!/^\d{6,15}$/.test(formData.whatsAppNumber.trim())) {
      newErrors.whatsAppNumber =
        "Please enter a valid phone number (6-15 digits)";
    }

    // Validate email if provided
    if (
      formData.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())
    ) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const token = sessionStorage.getItem("token");
    if (!token) {
      toast({
        title: "Error",
        description: "No authentication token found",
        variant: "destructive",
      });
      return;
    }
    const decoded: any = jwtDecode(token);
    const currentShopkeeperId = decoded.sub;

    if (!validateForm()) {
      toast({
        duration: 5000,
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const fullWhatsAppNumber = `${selectedCountry?.dialCode}${formData.whatsAppNumber.trim()}`;

      const payload = {
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        whatsAppNumber: fullWhatsAppNumber,
        ...(formData.email.trim() && { email: formData.email.trim() }),
      };

      let url: string;
      let method: string = "POST";

      // EDIT MODE → UPDATE USER
      if (mode === "edit" && customerToEdit?.id) {
        url = `${__API_URL__}/users/update-user-by-shopkeeper/${currentShopkeeperId}/${customerToEdit.id}`;
        method = "PATCH";
      }
      // ADD MODE → CREATE USER
      else {
        url = `${__API_URL__}/users/create-user-by-organizer/${currentShopkeeperId}`;
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.message ||
            `Failed to ${mode === "edit" ? "update" : "add"} customer`,
        );
      }

      const data = await res.json();

      toast({
        duration: 5000,
        title: "Success",
        description: `Customer ${mode === "edit" ? "updated" : "added"} successfully`,
      });

      resetForm();
      onClose();

      if (onCustomerAdded) {
        onCustomerAdded(data.data);
      }
    } catch (error: any) {
      toast({
        duration: 5000,
        title: "Error",
        description:
          error.message ||
          `Failed to ${mode === "edit" ? "update" : "add"} customer`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      whatsAppNumber: "",
      email: "",
    });
    setSelectedCountry(null);
    setErrors({});
    setSearchQuery("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const filteredCountries = countries.filter(
    (country) =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      country.dialCode.includes(searchQuery),
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl md:text-2xl font-semibold">
            {mode === "edit" ? "Edit Customer" : "Add New Customer"}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base text-muted-foreground">
            {mode === "edit"
              ? "Update customer details."
              : "Enter customer details to add them to your customer list."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* First Name */}
          <div>
            <Label htmlFor="firstName" className="font-medium mb-2 block">
              First Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              placeholder="Enter first name"
              className={errors.firstName ? "border-red-500" : ""}
              disabled={submitting}
            />
            {errors.firstName && (
              <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <Label htmlFor="lastName" className="font-medium mb-2 block">
              Last Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              placeholder="Enter last name"
              className={errors.lastName ? "border-red-500" : ""}
              disabled={submitting}
            />
            {errors.lastName && (
              <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
            )}
          </div>

          {/* WhatsApp Number with Country Code - UNCHANGED */}
          <div>
            <Label htmlFor="whatsAppNumber" className="font-medium mb-2 block">
              WhatsApp Number <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Select
                value={selectedCountry?.code}
                onValueChange={(code) => {
                  const country = countries.find((c) => c.code === code);
                  setSelectedCountry(country || null);
                  if (errors.countryCode) {
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.countryCode;
                      return newErrors;
                    });
                  }
                }}
                disabled={submitting}
              >
                <SelectTrigger
                  className={`w-[140px] ${
                    errors.countryCode ? "border-red-500" : ""
                  }`}
                >
                  <SelectValue>
                    {selectedCountry ? (
                      <div className="flex items-center gap-2">
                        {selectedCountry.flag && (
                          <img
                            src={selectedCountry.flag}
                            alt={selectedCountry.name}
                            className="w-5 h-3 object-cover"
                          />
                        )}
                        <span>{selectedCountry.dialCode}</span>
                      </div>
                    ) : (
                      "Select"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Search country..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="mb-2"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <ScrollArea className="h-[200px]">
                    {filteredCountries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        <div className="flex items-center gap-2">
                          {country.flag && (
                            <img
                              src={country.flag}
                              alt={country.name}
                              className="w-5 h-3 object-cover"
                            />
                          )}
                          <span className="font-medium">
                            {country.dialCode}
                          </span>
                          <span className="text-gray-500 text-sm">
                            {country.name}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>

              <Input
                id="whatsAppNumber"
                type="tel"
                value={formData.whatsAppNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  handleChange("whatsAppNumber", value);
                }}
                maxLength={10}
                placeholder="1234567890"
                className={`flex-1 ${
                  errors.whatsAppNumber ? "border-red-500" : ""
                }`}
                disabled={submitting}
              />
            </div>
            {(errors.whatsAppNumber || errors.countryCode) && (
              <p className="text-red-500 text-sm mt-1">
                {errors.whatsAppNumber || errors.countryCode}
              </p>
            )}
            {selectedCountry && formData.whatsAppNumber && (
              <p className="text-gray-500 text-xs mt-1">
                Full number: {selectedCountry.dialCode}
                {formData.whatsAppNumber}
              </p>
            )}
          </div>

          {/* Email (Optional) */}
          <div>
            <Label htmlFor="email" className="font-medium mb-2 block">
              Email{" "}
              <span className="text-gray-400 text-xs font-normal">
                (Optional)
              </span>
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="customer@example.com"
              className={errors.email ? "border-red-500" : ""}
              disabled={submitting}
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Action Buttons - Dynamic text */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
              className="w-full sm:w-1/2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-1/2"
            >
              {submitting
                ? mode === "edit"
                  ? "Updating..."
                  : "Adding..."
                : mode === "edit"
                  ? "Update Customer"
                  : "Add Customer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddExhibitorDialog({
  isOpen,
  onClose,
  onCustomerAdded,
  exhibitorToEdit,
  mode = "add",
}: {
  isOpen: boolean;
  onClose: () => void;
  onCustomerAdded?: (customer: any) => void;
  exhibitorToEdit?: any;
  mode?: "add" | "edit";
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    shopName: "",
    country: "India",
    dialCode: "+91",
    whatsappNumber: "",
    phone: "",
    address: "",
    businessCategory: "",
    businessEmail: "",
  });

  // Sync Dial Code when Country changes
  const handleCountryChange = (countryName: string) => {
    const country = SUPPORTED_COUNTRIES.find((c) => c.name === countryName);
    if (country) {
      setFormData((prev) => ({
        ...prev,
        country: country.name,
        dialCode: country.dialCode,
      }));
    }
  };

  useEffect(() => {
    if (isOpen && exhibitorToEdit && mode === "edit") {
      const [first, ...rest] = (exhibitorToEdit.name || "").split(" ");

      // Determine dial code from existing number if possible
      const existingCountry =
        SUPPORTED_COUNTRIES.find((c) =>
          exhibitorToEdit.whatsappNumber?.startsWith(c.dialCode),
        ) || SUPPORTED_COUNTRIES[0];

      setFormData({
        firstName: first || "",
        lastName: rest.join(" ") || "",
        email: exhibitorToEdit.email || "",
        country: existingCountry.name,
        dialCode: existingCountry.dialCode,
        whatsappNumber: (exhibitorToEdit.whatsappNumber || "").replace(
          existingCountry.dialCode,
          "",
        ),
        shopName: exhibitorToEdit.shopName,
        phone: (exhibitorToEdit.phone || "").replace(
          existingCountry.dialCode,
          "",
        ),
        address: exhibitorToEdit.address || "",
        businessCategory: exhibitorToEdit.businessCategory || "",
        businessEmail: exhibitorToEdit.businessEmail || "",
      });
    } else if (isOpen && mode === "add") {
      resetForm();
    }
  }, [isOpen, exhibitorToEdit, mode]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim())
      newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.whatsappNumber.trim())
      newErrors.whatsappNumber = "WhatsApp required";
    if (!formData.shopName.trim())
      newErrors.firstName = "Shop name is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone required";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (!formData.businessCategory)
      newErrors.businessCategory = "Category required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const token = sessionStorage.getItem("token");
    const organizerId = token ? (jwtDecode(token) as any).sub : null;

    setSubmitting(true);
    try {
      const payload = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        country: formData.country,
        whatsappNumber: `${formData.dialCode}${formData.whatsappNumber}`,
        phone: `${formData.dialCode}${formData.phone}`,
        address: formData.address,
        shopName: formData.shopName,
        businessCategory: formData.businessCategory,
        businessEmail: formData.businessEmail || formData.email,
        approved: true,
        hasDocVerification: false,
      };

      const url =
        mode === "edit"
          ? `${__API_URL__}/shopkeepers/update-shopkeeper-by-organizer/${organizerId}/${exhibitorToEdit.id}`
          : `${__API_URL__}/shopkeepers/create-shopkeeper-by-organizer/${organizerId}`;

      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Operation failed");

      toast({
        title: "Success",
        description: `Exhibitor ${mode === "edit" ? "updated" : "added"}`,
      });
      onClose();
      if (onCustomerAdded) onCustomerAdded(result.data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      country: "India",
      dialCode: "+91",
      whatsappNumber: "",
      phone: "",
      address: "",
      shopName: "",
      businessCategory: "",
      businessEmail: "",
    });
    setErrors({});
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Exhibitor" : "Add New Exhibitor"}
          </DialogTitle>
          <DialogDescription>
            Fill in the details for the shopkeeper.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name*</Label>
              <Input
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
              />
              {errors.firstName && (
                <p className="text-red-500 text-xs">{errors.firstName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Last Name*</Label>
              <Input
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Shop Name*</Label>
            <Input
              value={formData.shopName}
              onChange={(e) =>
                setFormData({ ...formData, shopName: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Country*</Label>
              <Select
                value={formData.country}
                onValueChange={handleCountryChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Business Category*</Label>
              <Select
                value={formData.businessCategory}
                onValueChange={(val) =>
                  setFormData({ ...formData, businessCategory: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>WhatsApp Number*</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 bg-muted text-muted-foreground text-sm">
                  {formData.dialCode}
                </span>
                <Input
                  className="rounded-l-none"
                  value={formData.whatsappNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      whatsappNumber: e.target.value.replace(/\D/g, ""),
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone Number*</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 bg-muted text-muted-foreground text-sm">
                  {formData.dialCode}
                </span>
                <Input
                  className="rounded-l-none"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phone: e.target.value.replace(/\D/g, ""),
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Personal Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Business Email</Label>
              <Input
                type="email"
                value={formData.businessEmail}
                onChange={(e) =>
                  setFormData({ ...formData, businessEmail: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address*</Label>
            <Input
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
            />
            {errors.address && (
              <p className="text-red-500 text-xs">{errors.address}</p>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "edit" ? "Update" : "Create"} Exhibitor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default MyEventUsers;
