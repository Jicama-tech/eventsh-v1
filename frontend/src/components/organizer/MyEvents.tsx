import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CreateEventForm } from "./CreateEventForm";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Star,
  CheckCircle,
  Clock,
  XCircle,
  Image as ImageIcon,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { jwtDecode } from "jwt-decode";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useCountry } from "@/hooks/useCountry";

export interface Event {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  startDate: string;
  time?: string;
  endDate?: string;
  endTime?: string;
  organizer: string; // can also be an object if needed: { _id: string; name: string; ... }
  location?: string;
  address?: string;
  ticketPrice?: string;
  totalTickets?: number;
  ticketsSold?: number;
  revenue?: number;
  visibility: "public" | "private" | "unlisted";
  inviteLink?: string;
  tags: string[];
  features: {
    food: boolean;
    parking: boolean;
    wifi: boolean;
    photography: boolean;
    security: boolean;
    accessibility: boolean;
  };
  ageRestriction?: string;
  dresscode?: string;
  specialInstructions?: string;
  refundPolicy?: string;
  termsAndConditions?: string;
  setupTime?: string;
  breakdownTime?: string;
  image?: string;
  gallery?: string[];
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  tableTemplates: {
    id: string;
    name: string;
    type: "Straight" | "Corner" | "Round" | "Square";
    width: number;
    height: number;
    price: number;
    depositAmount: number;
    customDimensions?: boolean;
  }[];
  venueTables: {
    id: string;
    name: string;
    type: "Straight" | "Corner" | "Round" | "Square";
    width: number;
    height: number;
    price: number;
    depositAmount: number;
    customDimensions?: boolean;
    positionId: string;
    x: number;
    y: number;
    rotation: number;
    isPlaced: boolean;
  }[];
  addOnItems: {
    id: string;
    name: string;
    price: number;
    description?: string;
  }[];
  venueConfig: {
    width: number;
    height: number;
    scale: number;
    gridSize: number;
    showGrid: boolean;
    hasMainStage: boolean;
  };
  status: "draft" | "published" | "cancelled" | "active" | "completed";
  featured: boolean;
  registrationRequired?: boolean;
  createdAt: string;
  updatedAt: string;
  termsandconditonsforstalls: {
    termsAndConditionsforStalls: string;
    isMandatory: boolean;
  };
}

const MyEvents: React.FC = () => {
  const apiURL = __API_URL__;
  const { toast } = useToast();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizerId, setOrganizerId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [shouldRefresh, setShouldRefresh] = useState(0);
  const [ticketsInfoMap, setTicketsInfoMap] = useState<
    Record<string, { ticketsSold: number; revenue: number }>
  >({});
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  const categories = [
    "Music",
    "Technology",
    "Food & Beverage",
    "Art & Culture",
    "Sports",
    "Business",
    "Education",
    "Health & Wellness",
    "Entertainment",
    "Networking",
    "Workshop",
    "Conference",
  ];

  // Get organizer ID from token
  const token = useMemo(() => sessionStorage.getItem("token"), []);

  const fetchOrganizer = async () => {
    try {
      if (!organizerId) return;
      const response = await fetch(
        `${apiURL}/organizers/profile-get/${organizerId}`,
      );

      const data = await response.json();
      // country is managed by useCountry context
    } catch (error) {
      console.error("Error fetching organizer profile", error);
    }
  };

  // Decode token one time only
  useEffect(() => {
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        setOrganizerId(decoded.sub);
      } catch (error) {
        console.error("Failed to decode token", error);
        setError("Authentication failed. Please login again.");
      }
    } else {
      setError("No authentication token found. Please login.");
    }

    fetchOrganizer();
  }, [token]); // ✅ only runs once

  // ✅ Memoized fetchTicketsInfo (does not reinitialize)
  const fetchTicketsInfo = useCallback(
    async (eventId: string) => {
      if (!token) return { ticketsSold: 0, revenue: 0 };
      try {
        const response = await fetch(`${apiURL}/tickets/event/${eventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return { ticketsSold: 0, revenue: 0 };
        const data = await response.json();
        const tickets = data.tickets || [];

        let ticketsSold = 0;
        let revenue = 0;
        tickets.forEach((ticket: any) => {
          ticketsSold +=
            ticket.ticketDetails?.reduce(
              (acc: number, td: any) => acc + td.quantity,
              0,
            ) || 0;
          revenue += ticket.totalAmount || 0;
        });

        return { ticketsSold, revenue };
      } catch (error) {
        console.error("Failed to fetch tickets info for event", eventId, error);
        return { ticketsSold: 0, revenue: 0 };
      }
    },
    [apiURL, token],
  );

  // ✅ Memoized fetchEvents
  const fetchEvents = useCallback(async () => {
    if (!organizerId || !token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${apiURL}/events/organizer/${organizerId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        if (response.status === 401)
          throw new Error("Authentication failed. Please login again.");
        if (response.status === 404) {
          setEvents([]);
          setTicketsInfoMap({});
          return;
        }
        throw new Error(`Failed to fetch events (${response.status})`);
      }

      const data = await response.json();
      const eventsData: Event[] = Array.isArray(data)
        ? data
        : data?.data || data?.events || [data];

      setEvents(eventsData || []);

      // Fetch ticket info for each event only once
      const ticketsInfoObj: Record<
        string,
        { ticketsSold: number; revenue: number }
      > = {};
      await Promise.all(
        eventsData.map(async (event) => {
          const info = await fetchTicketsInfo(event._id);
          ticketsInfoObj[event._id] = info;
        }),
      );

      setTicketsInfoMap(ticketsInfoObj);
    } catch (err: any) {
      console.error("Error fetching events:", err);
      setError(err.message);
      setEvents([]);
      setTicketsInfoMap({});
    } finally {
      setLoading(false);
    }
  }, [organizerId, token, apiURL, fetchTicketsInfo]);

  // ✅ UseEffect now executes cleanly only when organizerId or shouldRefresh changes
  useEffect(() => {
    if (organizerId) fetchEvents();
  }, [organizerId, shouldRefresh, fetchEvents]);
  // Retry function
  const handleRetry = () => {
    setShouldRefresh((prev) => prev + 1);
  };

  // Filtered events with proper safety checks
  const filteredEvents = useMemo(() => {
    if (!Array.isArray(events)) {
      console.warn("Events is not an array, returning empty array:", events);
      return [];
    }

    return events.filter((event) => {
      if (!event || typeof event !== "object") {
        return false;
      }

      const matchesSearch =
        !searchQuery ||
        (event.title?.toLowerCase() || "").includes(
          searchQuery.toLowerCase(),
        ) ||
        (event.description?.toLowerCase() || "").includes(
          searchQuery.toLowerCase(),
        ) ||
        (event.location?.toLowerCase() || "").includes(
          searchQuery.toLowerCase(),
        );

      const matchesCategory =
        categoryFilter === "all" || event.category === categoryFilter;

      const matchesStatus =
        statusFilter === "all" || event.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [events, searchQuery, categoryFilter, statusFilter]);

  // Statistics with proper safety checks
  const stats = useMemo(() => {
    const safeEvents = Array.isArray(events) ? events : [];
    const safeTicketsInfo = ticketsInfoMap || {};

    if (safeEvents.length === 0) {
      return {
        totalEvents: 0,
        activeEvents: 0,
        draftEvents: 0,
        completedEvents: 0,
        upcomingEvents: 0,
        totalRevenue: 0,
        totalTicketsSold: 0,
      };
    }

    const isDateBefore = (dateStr: string, compareDate: Date) => {
      const date = new Date(dateStr);
      // Create new Date objects keeping only year/month/day for accurate date comparison
      const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const d2 = new Date(
        compareDate.getFullYear(),
        compareDate.getMonth(),
        compareDate.getDate(),
      );
      return d1 < d2;
    };

    const now = new Date();
    const totalEvents = safeEvents.length;
    const activeEvents = safeEvents.filter(
      (e) => e?.status === "active",
    ).length;
    const draftEvents = safeEvents.filter((e) => e?.status === "draft").length;
    const completedEvents = safeEvents.filter((e) => {
      try {
        return e?.endDate && isDateBefore(e.endDate, new Date());
      } catch {
        return false;
      }
    }).length;
    const upcomingEvents = safeEvents.filter((e) => {
      try {
        return e?.startDate && new Date(e.startDate) > now;
      } catch {
        return false;
      }
    }).length;

    // Sum total revenue from ticketsInfoMap, fallback 0
    const totalRevenue = safeEvents.reduce((sum, event) => {
      const revenue = safeTicketsInfo[event._id]?.revenue || 0;
      return sum + revenue;
    }, 0);

    // Sum total tickets sold from ticketsInfoMap, fallback 0
    const totalTicketsSold = safeEvents.reduce((sum, event) => {
      const sold = safeTicketsInfo[event._id]?.ticketsSold || 0;
      return sum + sold;
    }, 0);

    return {
      totalEvents,
      activeEvents,
      draftEvents,
      completedEvents,
      upcomingEvents,
      totalRevenue,
      totalTicketsSold,
    };
  }, [events, ticketsInfoMap]);

  // Helper functions
  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return "";
    // if (imagePath.startsWith("http")) return imagePath;
    return `${apiURL}${imagePath}`;
  };

  // Event handlers
  const handleCreateEvent = () => {
    setEditingEvent(null);
    setShowDialog(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingEvent(null);
  };

  const handleSaveEvent = async (eventData: FormData) => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) throw new Error("No authentication token");

      const url = editingEvent
        ? `${apiURL}/events/${editingEvent._id}`
        : `${apiURL}/events/create-event`;
      const method = editingEvent ? "PUT" : "POST";


      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: eventData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          errorData || `Failed to ${editingEvent ? "update" : "create"} event`,
        );
      }

      toast({
        duration: 5000,
        title: editingEvent ? "Event updated!" : "Event created!",
        description: `Your event has been ${
          editingEvent ? "updated" : "created"
        } successfully.`,
      });

      setShouldRefresh((prev) => prev + 1);
    } catch (err: any) {
      console.error("Error saving event:", err);
      throw new Error(err.message || "Failed to save event");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;

    try {
      const token = sessionStorage.getItem("token");
      if (!token) throw new Error("No authentication token");

      const response = await fetch(`${apiURL}/events/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to delete event");
      }

      toast({
        duration: 5000,
        title: "Event deleted",
        description: "Event has been successfully deleted",
      });

      setShouldRefresh((prev) => prev + 1);
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Error deleting event",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-300";
      case "draft":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-300";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error && events.length === 0 && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4 max-w-md">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <div>
            <h3 className="text-lg font-medium mb-2">Unable to load events</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleRetry} className="flex items-center gap-2">
              <RefreshCw size={16} />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">Events</h2>
          <p className="text-muted-foreground">
            Manage your event portfolio and track performance
          </p>
        </div>
        <Button
          onClick={handleCreateEvent}
          size="lg"
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Event
        </Button>
      </div>

      {/* Statistics Cards - Always visible with zero values when no events */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeEvents} active, {stats.draftEvents} drafts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Upcoming Events
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingEvents}</div>
            <p className="text-xs text-muted-foreground">
              Scheduled for future
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(stats.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {stats.totalTicketsSold} tickets sold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedEvents}</div>
            <p className="text-xs text-muted-foreground">
              Successfully finished
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>Event Management</CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredEvents.length === 0 ? (
            /* Empty State - Always renders properly */
            <div className="text-center py-12">
              <div className="mb-6">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-medium mb-2">
                  {events.length === 0
                    ? "No events yet"
                    : "No events match your filters"}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {events.length === 0
                    ? "Create your first event to get started with event management and start selling tickets."
                    : "Try adjusting your search criteria or filters to find the events you're looking for."}
                </p>
              </div>
              {events.length === 0 && (
                <Button onClick={handleCreateEvent} size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Event
                </Button>
              )}
              {events.length > 0 && filteredEvents.length === 0 && (
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    setCategoryFilter("all");
                    setStatusFilter("all");
                  }}
                  variant="buttonOutline"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            /* Events List */
            <div className="space-y-4">
              {filteredEvents.map((event) => (
                <Card
                  key={event._id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-4">
                          {/* Event Image */}
                          {event.image && event.image.length > 0 ? (
                            <Avatar className="h-16 w-16 rounded-lg">
                              <AvatarImage
                                src={getImageUrl(event.image)}
                                alt={event.title}
                                className="object-cover"
                              />
                              <AvatarFallback className="rounded-lg">
                                <ImageIcon className="h-6 w-6" />
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}

                          {/* Event Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold truncate">
                                {event.title}
                              </h3>
                              <Badge
                                className={`text-xs ${getStatusColor(
                                  event.status,
                                )}`}
                              >
                                {event.category}
                              </Badge>
                              {event.featured && (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  Featured
                                </Badge>
                              )}
                            </div>

                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p>
                                {format(new Date(event.startDate), "PPP")} at{" "}
                                {event.time} • {event.location}
                              </p>
                              <p className="line-clamp-2">
                                {event.description}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge
                                variant="buttonOutline"
                                className="text-xs"
                              >
                                {event.category}
                              </Badge>
                              {event.tags?.slice(0, 2).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="buttonOutline"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users size={14} />
                                {ticketsInfoMap[event._id]?.ticketsSold || 0}
                                {(() => {
                                  const total = event.visitorTypes?.length > 0
                                    ? event.visitorTypes.reduce((sum: number, v: any) => sum + (v.maxCount || 0), 0)
                                    : (event.totalTickets || 0);
                                  return total > 0 ? `/${total}` : "";
                                })()}
                              </span>
                              <span className="flex items-center gap-1">
                                {(() => {
                                  if (event.visitorTypes?.length > 0) {
                                    const prices = event.visitorTypes.map((v: any) => v.price || 0);
                                    const min = Math.min(...prices);
                                    const max = Math.max(...prices);
                                    return min === max ? formatPrice(min) : `${formatPrice(min)} - ${formatPrice(max)}`;
                                  }
                                  const price = parseFloat(event.ticketPrice);
                                  return isNaN(price) ? "Free" : formatPrice(price);
                                })()}
                              </span>
                              {/* <span className="flex items-center gap-1">
                                <TrendingUp size={14} />$
                                {(event.revenue || 0).toFixed(2)}
                              </span> */}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 w-full lg:w-auto">
                        <Button
                          variant="buttonOutline"
                          size="sm"
                          onClick={() => handleEditEvent(event)}
                          className="flex-1 lg:flex-none"
                        >
                          <Edit size={16} className="mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="buttonOutline"
                          size="sm"
                          onClick={() => handleDeleteEvent(event._id)}
                          className="text-red-600 hover:text-red-700 hover:border-red-300 flex-1 lg:flex-none"
                        >
                          <Trash2 size={16} className="mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="p-6 pb-0">
            {/* <DialogTitle>
              <h1 className="text-xl font-bold">
                {editingEvent ? "Edit Event" : "Create New Event"}
              </h1>
            </DialogTitle> */}
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
            <CreateEventForm
              onClose={handleCloseDialog}
              onSave={handleSaveEvent}
              editMode={!!editingEvent}
              initialData={editingEvent}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyEvents;
