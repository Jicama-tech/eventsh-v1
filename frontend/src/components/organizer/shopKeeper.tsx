// File: src/components/DashboardTabs/VendorRequests.tsx
// Complete Data-Rich Shopkeeper Dashboard with Stall Management

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  Users,
  Ticket,
  Plus,
  Settings,
  LogOut,
  MapPin,
  Clock,
  Camera,
  TrendingUp,
  Store,
  UserCheck,
  ShoppingBag,
  Phone,
  Eye,
  Edit,
  Ban,
  QrCode,
  Download,
  Globe,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  IndianRupee,
  Mail,
  Building,
  Package,
  CreditCard,
  FileText,
  Filter,
  Search,
  RefreshCw,
  MoreVertical,
  Check,
  X,
  Loader2,
  Send,
  Clock1,
  Clock12,
} from "lucide-react";
import { Separator } from "@radix-ui/react-separator";
import { useToast } from "@/hooks/use-toast";
import { jwtDecode } from "jwt-decode";
import { JSX } from "react/jsx-runtime";

// ============ INTERFACES ============

interface Shopkeeper {
  map(arg0: (shop: any) => JSX.Element): React.ReactNode;
  _id: string;
  name: string;
  email: string;
  businessEmail: string;
  phone: string;
  whatsappNumber: string;
  shopName: string;
  businessCategory: string;
  businessDescription: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  GSTNumber: string;
  UENNumber: string;
  instagramHandle: string;
  hasDocVerification: string;
  approved: boolean;
  rejected: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SelectedTable {
  tableId: string;
  positionId: string;
  tableName: string;
  tableType: string;
  price: number;
  depositAmount: number;
}

interface SelectedAddOn {
  addOnId: string;
  name: string;
  price: number;
  quantity: number;
}

interface StatusHistoryEntry {
  status: string;
  note?: string;
  changedAt: string;
  changedBy?: string;
}

export interface StallRequest {
  couponCodeAssigned: string;
  _id: string;
  shopkeeperId: Shopkeeper;
  noOfOperators: string;
  eventId: {
    _id: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    image: string;
    status: string;
    category: string;
    time: string;
    address: string;
    features: {
      wifi: JSX.Element;
      parking: boolean;
      photography: boolean;
      security: boolean;
      food: boolean;
    };
    dresscode: string;
    ageRestriction: string;
    ticketPrice: number;
    totalTickets: number;
    gallery: string[];
  };
  organizerId: {
    _id: string;
    name: string;
    email: string;
    organizationName: string;
  };
  status:
    | "Pending"
    | "Confirmed"
    | "Cancelled"
    | "Processing"
    | "Completed"
    | "Returned";
  paymentStatus: "Unpaid" | "Partial" | "Paid";
  selectedTables: SelectedTable[];
  selectedAddOns: SelectedAddOn[];
  tablesTotal: number;
  depositTotal: number;
  addOnsTotal: number;
  grandTotal: number;
  requestDate: string;
  confirmationDate?: string;
  selectionDate?: string;
  paymentDate?: string;
  completionDate?: string;
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  checkInTime: Date;
  checkOutTime: Date;
  notes?: string;
  cancellationReason?: string;
  brandName?: string;
  nameOfApplicant: string;
  businessOwnerNationality: string;
  productDescription?: string;
  instagramLink?: string;
  faceBookLink?: string;
  registrationImage: string;
  productImage?: string[];
  companyLogo?: string;
  registrationNumber?: string;
  refundPaymentDescription?: string;
  residency?: string;
  statusHistory: StatusHistoryEntry[];
  depositReturned: boolean;
}

interface StallStats {
  total: number;
  pending: number;
  confirmed: number;
  processing: number;
  completed: number;
  cancelled: number;
  paid: number;
  partial: number;
  unpaid: number;
  totalRevenue: number;
}

interface VendorRequestsProps {
  shopkeepers: Shopkeeper[];
  setShowAddShopkeeper: React.Dispatch<React.SetStateAction<boolean>>;
  handleViewShopkeeper: (shop: Shopkeeper) => void;
  handleEditShopkeeper: (shop: Shopkeeper) => void;
  handleDeleteShopkeeper: (shopId: string) => void;
  organizerId?: string;
  eventId?: string;
}

// ============ MAIN COMPONENT ============

const VendorRequests: React.FC<VendorRequestsProps> = ({
  setShowAddShopkeeper,
  handleViewShopkeeper,
  handleEditShopkeeper,
  handleDeleteShopkeeper,
  organizerId,
  eventId,
}) => {
  const { toast } = useToast();
  const apiURL = __API_URL__;

  // State Management
  const [activeTab, setActiveTab] = useState("requests");
  const [stallRequests, setStallRequests] = useState<StallRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<StallRequest[]>([]);
  const [stallStats, setStallStats] = useState<StallStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showShopkeeperForm, setShowShopkeeperForm] = useState(false);

  const [shopkeeperList, setShopkeeperList] = useState([]);
  const [selectedShopkeepers, setSelectedShopkeepers] = useState<string[]>([]);
  const [invitationMessage, setInvitationMessage] = useState("");
  const [loadingShopkeepers, setLoadingShopkeepers] = useState(false);
  const [sendingInvitations, setSendingInvitations] = useState(false);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog States
  const [selectedRequest, setSelectedRequest] = useState<StallRequest | null>(
    null,
  );
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // Form States
  const [cancellationReason, setCancellationReason] = useState("");
  const [paymentStatusUpdate, setPaymentStatusUpdate] = useState<
    "Partial" | "Paid"
  >("Paid");
  const [actionNotes, setActionNotes] = useState("");
  const [OrganizerId, setOrganizerId] = useState("");
  const [shopkeeper, setShopkeepers] = useState<Shopkeeper | null>(null);

  // ============ EFFECTS ============

  useEffect(() => {
    async function fetchOrganizerId() {
      const token = await sessionStorage.getItem("token");
      const decoded = jwtDecode(token);
      setOrganizerId(decoded.sub);

      if (OrganizerId) {
        fetchStallRequestsByOrganizer();
      }
    }
    fetchOrganizerId();
    fetchShopkeepers();
  }, [OrganizerId]);

  async function fetchShopkeepers() {
    try {
      const response = await fetch(`${apiURL}/shopkeepers/get-all-shopkeepers`);
      const result = await response.json();

      if (result) {
        setShopkeepers(result.data);
        setShopkeeperList(result.data);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error(error);
    }
  }

  const handleShopkeeperToggle = (shopkeeperId: string) => {
    setSelectedShopkeepers((prev) =>
      prev.includes(shopkeeperId)
        ? prev.filter((id) => id !== shopkeeperId)
        : [...prev, shopkeeperId],
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

  // Handle select all
  const handleSelectAll = () => {
    if (selectedShopkeepers.length === shopkeeperList.length) {
      setSelectedShopkeepers([]);
    } else {
      setSelectedShopkeepers(shopkeeperList.map((shop) => shop._id));
    }
  };

  // Send invitations to selected shopkeepers
  const handleSendInvitations = async () => {
    if (selectedShopkeepers.length === 0) {
      toast({
        duration: 5000,
        title: "warning",
        description: "Please select at least one shopkeeper",
      });
      return;
    }

    try {
      setSendingInvitations(true);

      // Send invitation to each shopkeeper
      const invitationPromises = selectedShopkeepers.map((shopkeeperId) =>
        fetch(
          `${process.env.REACT_APP_API_URL}/invitations/send-stall-invitation`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
              eventId: eventId,
              shopkeeperId: shopkeeperId,
              organizerId: organizerId,
            }),
          },
        ),
      );

      const results = await Promise.all(invitationPromises);
      const allSuccess = results.every((res) => res.ok);

      if (allSuccess) {
        toast({
          duration: 5000,
          title: "Success",
          description: `Invitation sent to ${selectedShopkeepers.length} shopkeeper(s)`,
        });
        setShowShopkeeperForm(false);
        setSelectedShopkeepers([]);
        setInvitationMessage("");
        // Refresh data if needed
        fetchShopkeepers();
      } else {
        toast({
          duration: 5000,
          title: "Error",
          description: "Failed to send some invitations",
        });
      }
    } catch (error) {
      console.error("Error sending invitations:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to send invitations",
        variant: "destructive",
      });
    } finally {
      setSendingInvitations(false);
    }
  };

  useEffect(() => {
    applyFilters();
  }, [stallRequests, statusFilter, paymentFilter, searchQuery]);

  // ============ API FUNCTIONS ============

  const fetchStallRequestsByOrganizer = async () => {
    if (!OrganizerId) return;

    setLoading(true);
    try {
      const response = await fetch(`${apiURL}/stalls/organizer/${OrganizerId}`);
      const result = await response.json();

      if (result) {
        setStallRequests(result.data || []);

        // Calculate stats from the data
        calculateStatsFromRequests(result.data || []);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: error.message || "Failed to fetch stall requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStatsFromRequests = (requests: StallRequest[]) => {
    const stats = {
      total: requests.length,
      pending: requests.filter((r) => r.status === "Pending").length,
      confirmed: requests.filter((r) => r.status === "Confirmed").length,
      processing: requests.filter((r) => r.status === "Processing").length,
      completed: requests.filter((r) => r.status === "Completed").length,
      cancelled: requests.filter((r) => r.status === "Cancelled").length,
      paid: requests.filter((r) => r.paymentStatus === "Paid").length,
      partial: requests.filter((r) => r.paymentStatus === "Partial").length,
      unpaid: requests.filter((r) => r.paymentStatus === "Unpaid").length,
      totalRevenue: requests
        .filter((r) => r.paymentStatus === "Paid")
        .reduce((sum, r) => sum + r.grandTotal, 0),
    };
    setStallStats(stats);
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchStallRequestsByOrganizer();
    setRefreshing(false);
    toast({
      duration: 5000,
      title: "Refreshed",
      description: "Data updated successfully",
    });
  };

  // ============ ACTION HANDLERS ============

  const handleConfirmRequest = async () => {
    if (!selectedRequest) return;

    setLoading(true);
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
        await refreshData();
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
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!selectedRequest || !cancellationReason.trim()) {
      toast({
        duration: 5000,
        title: "Error",
        description: "Please provide a cancellation reason",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
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
        await refreshData();
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
      setLoading(false);
    }
  };

  const handleUpdatePaymentStatus = async () => {
    if (!selectedRequest) return;

    setLoading(true);
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
        await refreshData();
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
      setLoading(false);
    }
  };

  // ============ FILTER FUNCTIONS ============

  const applyFilters = () => {
    let filtered = [...stallRequests];

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }

    // Payment filter
    if (paymentFilter !== "all") {
      filtered = filtered.filter((req) => req.paymentStatus === paymentFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.shopkeeperId?.name.toLowerCase().includes(query) ||
          req.shopkeeperId?.shopName.toLowerCase().includes(query) ||
          req.shopkeeperId?.email.toLowerCase().includes(query) ||
          req.eventId.title.toLowerCase().includes(query),
      );
    }

    setFilteredRequests(filtered);
  };

  // ============ UTILITY FUNCTIONS ============

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

  const getPaymentBadge = (paymentStatus: string) => {
    const variants: Record<string, { variant: any; color: string }> = {
      Unpaid: { variant: "destructive", color: "text-red-600" },
      Partial: { variant: "secondary", color: "text-yellow-600" },
      Paid: { variant: "default", color: "text-green-600" },
    };

    const config = variants[paymentStatus] || variants.Unpaid;


    return <Badge variant={config.variant}>{paymentStatus}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  function formatDateTime(inputDate: Date | string) {
    const date = new Date(inputDate);

    const day = date.getDate(); // 1-31
    const month = date.getMonth() + 1; // 0-based, so add 1
    const year = date.getFullYear();

    const hours = date.getHours();
    const minutes = date.getMinutes();

    // Format as: d/m/yyyy
    const formattedDate = `${day}/${month}/${year}`;

    // Format time as HH:MM (24-hour)
    const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;

    return `${formattedDate} ${formattedTime}`;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // ============ RENDER ============

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      {stallStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stallStats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stallStats.pending} pending approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Confirmed Stalls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {stallStats.confirmed +
                  stallStats.processing +
                  stallStats.completed}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stallStats.completed} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {formatCurrency(stallStats.totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stallStats.paid} fully paid
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Payment Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Paid:</span>
                  <span className="font-semibold text-green-600">
                    {stallStats.paid}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Partial:</span>
                  <span className="font-semibold text-yellow-600">
                    {stallStats.partial}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Unpaid:</span>
                  <span className="font-semibold text-red-600">
                    {stallStats.unpaid}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requests">Stall Requests</TabsTrigger>
          <TabsTrigger value="shopkeepers">Shopkeepers</TabsTrigger>
        </TabsList>

        {/* Stall Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Stall Requests Management</CardTitle>
                  <CardDescription>
                    View and manage all stall booking requests for your events
                  </CardDescription>
                </div>
                <Button
                  onClick={refreshData}
                  disabled={refreshing}
                  variant="buttonOutline"
                  size="sm"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${
                      refreshing ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by shopkeeper, business, or event..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="Processing">Processing</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Requests Table */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No stall requests found</p>
                  <p className="text-sm">
                    {searchQuery ||
                    statusFilter !== "all" ||
                    paymentFilter !== "all"
                      ? "Try adjusting your filters"
                      : "Requests will appear here when shopkeepers apply"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shopkeeper</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Request Date</TableHead>
                        <TableHead>Tables</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => (
                        <TableRow key={request._id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {request.shopkeeperId?.name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {request.shopkeeperId?.shopName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {request.shopkeeperId?.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">
                                {request.eventId.title}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {request.eventId.location}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(request.requestDate)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {request.selectedTables.length > 0 ? (
                                <div>
                                  <div className="font-medium">
                                    {request.selectedTables.length} tables
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {request.selectedTables
                                      .map((t) => t.tableName)
                                      .join(", ")}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">
                                  Not selected
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-green-600">
                              {formatCurrency(request.grandTotal)}
                            </div>
                            {request.selectedAddOns.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                +{request.selectedAddOns.length} add-ons
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(request.status)}
                          </TableCell>
                          <TableCell>
                            {getPaymentBadge(request.paymentStatus)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="buttonOutline"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setShowDetailsDialog(true);
                                }}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              {request.status === "Pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => {
                                      setSelectedRequest(request);
                                      setShowConfirmDialog(true);
                                    }}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setSelectedRequest(request);
                                      setShowCancelDialog(true);
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              {(request.status === "Processing" ||
                                request.status === "Completed") &&
                                request.paymentStatus !== "Paid" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => {
                                      setSelectedRequest(request);
                                      setShowPaymentDialog(true);
                                    }}
                                  >
                                    <CreditCard className="h-3 w-3" />
                                  </Button>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shopkeepers Tab */}
        <TabsContent value="shopkeepers" className="space-y-4">
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Shopkeeper Management</h2>
              <div className="flex items-center space-x-4">
                <Button onClick={() => setShowShopkeeperForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Send Invitation
                </Button>
                {/* <Button onClick={() => setShowAddShopkeeper(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Shopkeeper
                </Button> */}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Registered Shopkeepers
                </CardTitle>
                <CardDescription>
                  Manage shopkeepers participating in your events
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!shopkeeper ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No shopkeepers registered yet</p>
                    <p className="text-sm">
                      Add shopkeepers or send invitations to get started
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shopkeeper</TableHead>
                        <TableHead>Business</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shopkeeper &&
                        shopkeeper.map((shop) => (
                          <TableRow key={shop._id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{shop.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {shop.email}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {shop.shopName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {shop.businessDescription?.substring(0, 50)}
                                  {shop.businessDescription?.length > 50
                                    ? "..."
                                    : ""}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {shop.phone}
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  {shop.businessEmail}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="buttonOutline">
                                {shop.businessCategory}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {shop.approved ? (
                                <Badge variant="default">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Approved
                                </Badge>
                              ) : shop.rejected ? (
                                <Badge variant="destructive">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Rejected
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="buttonOutline"
                                  onClick={() => handleViewShopkeeper(shop)}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="buttonOutline"
                                  onClick={() => handleEditShopkeeper(shop)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="buttonOutline"
                                  onClick={() =>
                                    handleDeleteShopkeeper(shop._id)
                                  }
                                >
                                  <Ban className="h-3 w-3" />
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
          </section>
        </TabsContent>
      </Tabs>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stall Request Details</DialogTitle>
            <DialogDescription>
              Complete information about the stall booking request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Status and Payment */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Request Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {getStatusBadge(selectedRequest.status)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Payment Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {getPaymentBadge(selectedRequest.paymentStatus)}
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
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">
                      {selectedRequest.shopkeeperId?.name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Business Name
                    </Label>
                    <p className="font-medium">
                      {selectedRequest.shopkeeperId?.shopName}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Business Email
                    </Label>
                    <p className="font-medium">
                      <a
                        href={`mailto:${selectedRequest.shopkeeperId?.businessEmail}`}
                        className="text-blue-600 underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {selectedRequest.shopkeeperId?.businessEmail}
                      </a>
                    </p>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">
                      {selectedRequest.shopkeeperId?.phone}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Business Type
                    </Label>
                    <p className="font-medium">
                      {selectedRequest.shopkeeperId?.businessCategory}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">WhatsApp</Label>
                    <p className="font-medium">
                      <a
                        href={`https://wa.me/${selectedRequest.shopkeeperId?.whatsappNumber.replace(
                          /\\D/g,
                          "",
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 underline"
                      >
                        {selectedRequest.shopkeeperId?.whatsappNumber}
                      </a>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Event Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Event Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Event Title</Label>
                    <p className="font-medium">
                      {selectedRequest.eventId.title}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Location</Label>
                    <p className="font-medium">
                      {selectedRequest.eventId.location}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Start Date</Label>
                    <p className="font-medium">
                      {formatDate(selectedRequest.eventId.startDate)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">End Date</Label>
                    <p className="font-medium">
                      {formatDate(selectedRequest.eventId.endDate)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Selected Tables */}
              {selectedRequest.selectedTables.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Selected Tables</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedRequest.selectedTables.map((table, index) => (
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
                              {formatCurrency(table.price)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              +{formatCurrency(table.depositAmount)} deposit
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Selected Add-ons */}
              {selectedRequest.selectedAddOns.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Selected Add-ons</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedRequest.selectedAddOns.map((addon, index) => (
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
                              {formatCurrency(addon.price * addon.quantity)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(addon.price)} each
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
                      {formatCurrency(selectedRequest.tablesTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deposit</span>
                    <span className="font-semibold">
                      {formatCurrency(selectedRequest.depositTotal)}
                    </span>
                  </div>
                  {selectedRequest.addOnsTotal > 0 && (
                    <div className="flex justify-between">
                      <span>Add-ons</span>
                      <span className="font-semibold">
                        {formatCurrency(selectedRequest.addOnsTotal)}
                      </span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Grand Total</span>
                    <span className="text-green-600">
                      {formatCurrency(selectedRequest.grandTotal)}
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
                        {formatDate(selectedRequest.requestDate)}
                      </p>
                    </div>
                  </div>
                  {selectedRequest.confirmationDate && (
                    <div className="flex items-start gap-3">
                      <div className="bg-green-100 rounded-full p-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">Request Confirmed</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(selectedRequest.confirmationDate)}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedRequest.selectionDate && (
                    <div className="flex items-start gap-3">
                      <div className="bg-purple-100 rounded-full p-2">
                        <Package className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium">Tables Selected</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(selectedRequest.selectionDate)}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedRequest.paymentDate && (
                    <div className="flex items-start gap-3">
                      <div className="bg-yellow-100 rounded-full p-2">
                        <CreditCard className="h-4 w-4 text-yellow-600" />
                      </div>
                      <div>
                        <p className="font-medium">Payment Received</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(selectedRequest.paymentDate)}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedRequest.completionDate && (
                    <div className="flex items-start gap-3">
                      <div className="bg-green-100 rounded-full p-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">Booking Completed</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(selectedRequest.completionDate)}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedRequest.hasCheckedIn &&
                    selectedRequest.checkInTime && (
                      <div className="flex items-start gap-3">
                        <div className="bg-green-100 rounded-full p-2">
                          <Clock1 className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Checked In Time</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(selectedRequest.checkInTime)}
                          </p>
                        </div>
                      </div>
                    )}
                  {selectedRequest.hasCheckedOut &&
                    selectedRequest.checkOutTime && (
                      <div className="flex items-start gap-3 justify-between">
                        <div className="flex items-start gap-3">
                          <div className="bg-green-100 rounded-full p-2">
                            <Clock12 className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">Checked Out Time</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(selectedRequest.checkOutTime)}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-between gap-3">
                          <div>
                            <button
                              className="bg-primary px-4 py-2 rounded text-white"
                              onClick={() =>
                                handleReturnDeposit(selectedRequest._id)
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
              {selectedRequest.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedRequest.notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Cancellation Reason */}
              {selectedRequest.cancellationReason && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-lg text-red-600">
                      Cancellation Reason
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      {selectedRequest.cancellationReason}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="buttonOutline"
              onClick={() => setShowDetailsDialog(false)}
            >
              Close
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
            <Button onClick={handleConfirmRequest} disabled={loading}>
              {loading ? (
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
              disabled={loading || !cancellationReason.trim()}
            >
              {loading ? (
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
            <Button onClick={handleUpdatePaymentStatus} disabled={loading}>
              {loading ? (
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

      <Dialog open={showShopkeeperForm} onOpenChange={setShowShopkeeperForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Stall Invitations
            </DialogTitle>
            <DialogDescription>
              Select shopkeepers to invite them to participate in your event
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search and Filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search shopkeepers by name or business..."
                  className="flex-1"
                  onChange={(e) => {
                    // You can add search filtering here
                  }}
                />
                <Button
                  variant="buttonOutline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="whitespace-nowrap"
                >
                  {selectedShopkeepers.length === shopkeeperList.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>

              {/* Selected count */}
              <p className="text-sm text-muted-foreground">
                {selectedShopkeepers.length} of {shopkeeperList.length} selected
              </p>
            </div>

            {/* Shopkeeper List */}
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              {loadingShopkeepers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : shopkeeperList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No shopkeepers found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {shopkeeperList.map((shopkeeper) => (
                    <div
                      key={shopkeeper._id}
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleShopkeeperToggle(shopkeeper._id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedShopkeepers.includes(shopkeeper._id)}
                          onChange={() =>
                            handleShopkeeperToggle(shopkeeper._id)
                          }
                          className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                        />

                        {/* Shopkeeper Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 justify-between">
                            <div>
                              <p className="font-semibold text-sm">
                                {shopkeeper.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {shopkeeper.shopName}
                              </p>
                            </div>

                            {/* Status Badge */}
                            {shopkeeper.approved ? (
                              <Badge variant="default" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Approved
                              </Badge>
                            ) : shopkeeper.rejected ? (
                              <Badge variant="destructive" className="text-xs">
                                <XCircle className="h-3 w-3 mr-1" />
                                Rejected
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </div>

                          {/* Contact Info */}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <a
                                href={`mailto:${shopkeeper.email}`}
                                className="text-blue-600 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {shopkeeper.email}
                              </a>
                            </div>

                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <p className="font-medium">
                                <a
                                  href={`https://wa.me/${shopkeeper.whatsappNumber.replace(
                                    /\\D/g,
                                    "",
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-600"
                                >
                                  {shopkeeper.whatsappNumber}
                                </a>
                              </p>
                            </div>

                            {shopkeeper.businessCategory && (
                              <Badge
                                variant="buttonOutline"
                                className="text-xs"
                              >
                                {shopkeeper.businessCategory}
                              </Badge>
                            )}
                          </div>

                          {/* Business Description */}
                          {shopkeeper.businessDescription && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {shopkeeper.businessDescription}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invitation Message */}
            <div className="space-y-2">
              <Label htmlFor="invitation-message">
                Invitation Message (Optional)
              </Label>
              <Textarea
                id="invitation-message"
                placeholder="Add a personal message for the shopkeepers... (e.g., 'We're excited to have you at our event! Please select your preferred stall.')"
                value={invitationMessage}
                onChange={(e) => setInvitationMessage(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This message will be sent to all selected shopkeepers
              </p>
            </div>

            {/* Summary */}
            {selectedShopkeepers.length > 0 && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <p className="text-sm">
                    <span className="font-semibold">
                      {selectedShopkeepers.length} shopkeeper(s)
                    </span>{" "}
                    will receive an invitation to participate in your event
                  </p>

                  {selectedShopkeepers.length > 0 && (
                    <div className="mt-3 max-h-24 overflow-y-auto">
                      <p className="text-xs font-medium mb-2 text-muted-foreground">
                        Selected Shopkeepers:
                      </p>
                      <ul className="text-xs space-y-1">
                        {selectedShopkeepers.map((shopkeeperId) => {
                          const shop = shopkeeperList.find(
                            (s) => s._id === shopkeeperId,
                          );
                          return (
                            <li
                              key={shopkeeperId}
                              className="flex items-center gap-2"
                            >
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                              {shop?.name} - {shop?.shopName}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="buttonOutline"
              onClick={() => {
                setShowShopkeeperForm(false);
                setSelectedShopkeepers([]);
                setInvitationMessage("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendInvitations}
              disabled={
                sendingInvitations ||
                selectedShopkeepers.length === 0 ||
                loadingShopkeepers
              }
            >
              {sendingInvitations ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Invitations...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Invitations ({selectedShopkeepers.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorRequests;
