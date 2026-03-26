import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  MapPin,
  QrCode,
  Edit,
  Users,
  Ticket,
  TrendingUp,
  LineChart,
  Clock,
  Building,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EnhancedEventsDetailDialog } from "./EventsDetailDialog";
import { format, isToday, isPast } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { jwtDecode } from "jwt-decode";
import { EventQRCode } from "./EventQRCode";
import { EventAnalyticsDialog } from "./EventAnalyticsDialog";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useCountry } from "@/hooks/useCountry";

// Updated STAT_ICONS to include new metrics
const STAT_ICONS = {
  "Total Events": CalendarDays,
  "Total Attendees": Users,
  "Total Tickets Sold": Ticket,
  "Total Stalls Booked": Building,
  "Tickets Sold Today": Clock,
  "Total Revenue": TrendingUp,
};

/**
 * Calculates metrics (tickets sold, revenue, etc.) for a single event based on ticket and stall data.
 * @param {object} event - The event object.
 * @param {Array} tickets - Array of ticket objects belonging to the organizer.
 * @param {Array} stalls - Array of stall booking objects belonging to the organizer.
 * @returns {object} - The event object with merged and calculated metrics.
 */

/**
 * Processes all events and tickets to calculate overall dashboard stats.
 * @param {Array} allEventsWithMetrics - Array of events with calculated metrics.
 * @param {Array} stallsData - Array of stall bookings data.
 * @returns {Array} - Array of stat objects for the dashboard grid.
 */

// =========================================================================================
// DashboardOverview Component
// =========================================================================================

export default function DashboardOverview({
  setShowCreateEvent,
  setShowShopkeeperForm,
  onViewEvent,
  handleEditEvent,
}) {
  const apiURL = __API_URL__;
  const [stats, setStats] = useState([]);
  const [currentEvents, setCurrentEvents] = useState([]);
  const [stallsData, setStallsData] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [organizerId, setOrganizerId] = useState("");
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedQrCodeEvent, setSelectedQrCodeEvent] = useState(null);
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
  const [selectedAnalyticsEvent, setSelectedAnalyticsEvent] = useState(null);
  const { country } = useCountry();
  const { formatPrice, getSymbol } = useCurrency(country);

  const calculateEventMetrics = (event, tickets, stalls = []) => {
    const eventTickets = tickets.filter(
      (ticket) =>
        ticket.eventId._id === event._id && ticket.status === "confirmed",
    );

    const ticketsSold = eventTickets.reduce(
      (total, ticket) =>
        total +
        ticket.ticketDetails.reduce(
          (subTotal, detail) => subTotal + detail.quantity,
          0,
        ),
      0,
    );

    const ticketsRevenue = eventTickets.reduce(
      (total, ticket) => total + ticket.totalAmount,
      0,
    );

    const ticketsSoldToday = eventTickets.filter((ticket) =>
      isToday(new Date(ticket.purchaseDate)),
    ).length;

    // Calculate stall metrics for this event
    const eventStalls = stalls.filter(
      (stall) =>
        stall.eventId &&
        (stall.eventId._id === event._id || stall.eventId === event._id),
    );

    const stallsBooked = eventStalls.filter((stall) =>
      ["Confirmed", "Processing", "Completed"].includes(stall.status),
    ).length;

    const stallsPending = eventStalls.filter(
      (stall) => stall.status === "Pending",
    ).length;

    const stallsRevenue = eventStalls
      .filter((stall) => stall.paymentStatus === "Paid")
      .reduce((sum, stall) => sum + (stall.grandTotal || 0), 0);

    // Combined revenue from tickets and stalls
    const totalRevenue = ticketsRevenue + stallsRevenue;

    const totalCapacity = event.visitorTypes?.length > 0
      ? event.visitorTypes.reduce((sum: number, v: any) => sum + (v.maxCount || 0), 0)
      : (Number(event.totalTickets) || 0);
    const salesPercent =
      totalCapacity > 0
        ? Math.round((ticketsSold / totalCapacity) * 100)
        : ticketsSold > 0
          ? 100
          : 0;

    return {
      ...event,
      ticketsSold,
      revenue: totalRevenue,
      rawRevenue: totalRevenue,
      ticketsRevenue,
      stallsRevenue,
      ticketsSoldToday,
      totalTickets: totalCapacity,
      salesPercent,
      // Stall metrics
      stallsBooked,
      stallsPending,
      stallsTotal: eventStalls.length,
    };
  };

  const calculateDashboardStats = (allEventsWithMetrics, stallsData = []) => {
    const totalEvents = allEventsWithMetrics.length;
    const totalTicketsSold = allEventsWithMetrics.reduce(
      (sum, event) => sum + (event.ticketsSold || 0),
      0,
    );
    const ticketsRevenue = allEventsWithMetrics.reduce(
      (sum, event) => sum + (event.rawRevenue || 0),
      0,
    );
    const ticketsSoldToday = allEventsWithMetrics.reduce(
      (sum, event) => sum + (event.ticketsSoldToday || 0),
      0,
    );

    // Calculate stalls statistics
    const totalStallsBooked = stallsData.filter((stall) =>
      ["Confirmed", "Processing", "Completed"].includes(stall.status),
    ).length;

    const stallsRevenue = stallsData
      .filter((stall) => stall.paymentStatus === "Paid")
      .reduce((sum, stall) => sum + (stall.grandTotal || 0), 0);

    // Combined revenue from tickets and stalls
    const totalRevenue = ticketsRevenue + stallsRevenue;

    // NOTE: For 'Total Attendees', we use 'Total Tickets Sold' as a proxy,
    // since the API data doesn't provide a unique attendee count.

    return [
      { title: "Total Events", value: totalEvents },
      { title: "Total Tickets Sold", value: totalTicketsSold },
      { title: "Total Revenue", value: totalRevenue },
      { title: "Total Stalls Booked", value: totalStallsBooked },
    ];
  };

  const fetchDashboardData = useCallback(async () => {
    let organizerIdFromToken = "";
    const token = sessionStorage.getItem("token");

    if (token) {
      try {
        const decoded = jwtDecode(token);
        organizerIdFromToken = decoded.sub;
        setOrganizerId(organizerIdFromToken);
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
      setLoading(true);

      // 1. Fetch Events
      const eventsResponse = await fetch(
        `${apiURL}/organizers/dashboard-data`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!eventsResponse.ok) {
        throw new Error("Failed to fetch event data");
      }
      const eventData = await eventsResponse.json();
      const allEvents = [
        ...(eventData.currentEvents || []),
        ...(eventData.upcomingEvents || []),
        ...(eventData.pastEvents || []),
      ];

      // 2. Fetch Tickets
      const ticketsResponse = await fetch(
        `${apiURL}/tickets/organizer/${organizerIdFromToken}`,
        {
          method: "GET",
        },
      );

      // Proceed with empty ticket data if fetch fails
      const ticketData = ticketsResponse.ok ? await ticketsResponse.json() : [];

      // 3. Fetch Stalls Data
      const stallsResponse = await fetch(
        `${apiURL}/stalls/organizer/${organizerIdFromToken}`,
        { method: "GET" },
      );

      let stallsData = [];
      if (stallsResponse.ok) {
        const stallsResult = await stallsResponse.json();
        stallsData = stallsResult.data || [];
        setStallsData(stallsData);
      }

      // 4. Process and Merge Data (with stalls)
      const processedEvents = allEvents.map((event) =>
        calculateEventMetrics(event, ticketData, stallsData),
      );

      // 4. Update State with Merged Data
      const now = new Date();
      const current = processedEvents.filter(
        (event) =>
          !isPast(new Date(event.startDate)) &&
          !isPast(new Date(event.endDate)), // Simplified logic for current/upcoming
      );
      const past = processedEvents.filter((event) =>
        isPast(new Date(event.endDate || event.startDate)),
      );

      // Note: Re-split logic here is crucial as the initial API splits might be based on less detail than we need after processing.
      // For simplicity, we are classifying based on 'endDate' now: if it's in the past, it's 'Past'. Otherwise, it's 'Current/Upcoming'.
      // You'll need more complex logic to accurately distinguish 'Current' from 'Upcoming' based on current time vs. event start/end times.
      // For now, I'll use the original separation for 'currentEvents' and 'upcomingEvents' but ensure they have metrics.

      // Map metrics back to the original structure for correct tab sorting, if necessary
      const mapMetrics = (events) =>
        events.map(
          (event) =>
            processedEvents.find((pE) => pE._id === event._id) || event,
        );

      setCurrentEvents(mapMetrics(eventData.currentEvents || []));
      setUpcomingEvents(mapMetrics(eventData.upcomingEvents || []));
      setPastEvents(mapMetrics(eventData.pastEvents || []));

      // 5. Calculate Overall Stats (with stalls data already fetched)
      setStats(calculateDashboardStats(processedEvents, stallsData));
    } catch (error) {
      toast({
        duration: 5000,
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [apiURL]);



  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const openEventDetails = (event) => {
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  const closeEventDetails = () => {
    setSelectedEvent(null);
    setShowEventDialog(false);
  };

  // We no longer need calcSalesPercent here, as it's calculated in the processing step,
  // but we'll keep a fallback for safety in the EventCard component.

  if (loading)
    return <div className="p-6 text-center">Loading dashboard...</div>;

  // --- Event Card Renderer Component ---
  const EventCard = ({ event, type }) => {
    // Safely pull processed metrics
    const ticketsSold = event.ticketsSold || 0;
    const totalCapacity = event.visitorTypes?.length > 0
      ? event.visitorTypes.reduce((sum: number, v: any) => sum + (v.maxCount || 0), 0)
      : (Number(event.totalTickets) || 0);
    const salesPercent = event.salesPercent || 0;
    const revenue = event.revenue || 0;
    const ticketsSoldToday = event.ticketsSoldToday || 0;

    // Stall metrics
    const stallsBooked = event.stallsBooked || 0;
    const stallsPending = event.stallsPending || 0;
    const stallsTotal = event.stallsTotal || 0;
    const ticketsRevenue = event.ticketsRevenue || 0;
    const stallsRevenue = event.stallsRevenue || 0;

    const badgeColor =
      type === "current"
        ? "bg-green-500"
        : type === "upcoming"
          ? event.status === "Selling"
            ? "bg-blue-500"
            : event.status === "Early Bird"
              ? "bg-orange-500"
              : "bg-gray-500"
          : "bg-gray-500";

    const badgeText =
      type === "current"
        ? "LIVE"
        : type === "upcoming"
          ? event.status || "PENDING"
          : "COMPLETED";

    const mainDate = event.startDate || event.date;

    return (
      <Card
        key={event._id}
        className="overflow-hidden shadow-md transition-shadow hover:shadow-lg"
      >
        <div className="flex flex-col md:flex-row">
          {/* Image Section */}
          <div className="md:w-48 w-full h-40 md:h-auto bg-muted flex items-center justify-center relative overflow-hidden">
            {event.image ? (
              <img
                src={event.image.startsWith("/") ? `${apiURL?.replace("/api", "")}${event.image}` : event.image}
                alt={event.title || event.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-3xl">🎪</div>
            )}
            <Badge className={`absolute top-2 right-2 ${badgeColor}`}>
              {badgeText}
            </Badge>
          </div>

          {/* Content Section */}
          <div className="flex-1 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
              <div>
                <h3 className="text-xl font-semibold mb-1 truncate max-w-xs sm:max-w-none">
                  {event.title || event.name}
                </h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" />
                    {mainDate ? format(new Date(mainDate), "PPP") : "TBD"}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {event.location}
                  </div>
                </div>
              </div>
              <Badge variant="buttonOutline" className="mt-2 sm:mt-0">
                {event.category}
              </Badge>
            </div>

            {/* Data-Rich Metrics Grid - Enhanced with Stall Data */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4 border-t pt-4">
              {/* Metric 1: Tickets Sold */}
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600">
                  {ticketsSold}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tickets Sold
                </div>
              </div>

              {/* Metric 2: Stalls Booked */}
              <div className="text-center">
                <div className="text-xl font-bold text-purple-600">
                  {stallsBooked}
                </div>
                <div className="text-xs text-muted-foreground">
                  Stalls Booked
                </div>
              </div>

              {/* Metric 3: Total Revenue */}
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">
                  {formatPrice(revenue)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Revenue
                </div>
              </div>

              {/* Metric 4: Tickets Revenue */}
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-500">
                  {formatPrice(ticketsRevenue)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tickets Revenue
                </div>
              </div>

              {/* Metric 5: Stalls Revenue */}
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-500">
                  {formatPrice(stallsRevenue)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Stalls Revenue
                </div>
              </div>

              {/* Metric 6: Pending Stalls */}
              <div className="text-center">
                <div className="text-lg font-semibold text-orange-500">
                  {stallsPending}
                </div>
                <div className="text-xs text-muted-foreground">
                  Pending Stalls
                </div>
              </div>
            </div>

            {/* Sales Progress Bar */}
            {totalCapacity > 0 && (
              <div className="mb-4 pb-4 border-b">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">
                    Ticket Sales Progress
                  </span>
                  <span className="font-semibold">{salesPercent}%</span>
                </div>
                <Progress value={salesPercent} className="h-2" />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              {/* <Button onClick={() => openEventDetails(event)} size="sm">
                {type === "past" ? "View Report" : "View Details"}
              </Button> */}
              {/* {type === "current" && (
                // <Button variant="buttonOutline" size="sm">
                //   <LineChart className="h-4 w-4 mr-1" />
                //   Live Analytics
                // </Button>
              )} */}
              {(type === "current" || type === "upcoming") && (
                <>
                  <Button
                    variant="buttonOutline"
                    size="sm"
                    onClick={() => handleShowQRCode(event)}
                  >
                    <QrCode className="h-4 w-4 mr-1" />
                    QR Code
                  </Button>
                  {/* <Button
                    variant="buttonOutline"
                    size="sm"
                    onClick={() => handleEditEvent(event)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button> */}
                </>
              )}
              {type === "past" && (
                <>
                  <Button
                    variant="buttonOutline"
                    size="sm"
                    onClick={() => handleShowAnalytics(event)}
                  >
                    Analytics
                  </Button>
                  <Button
                    variant="buttonOutline"
                    size="sm"
                    onClick={() => handleExportData(event)}
                  >
                    Export Data
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };
  // --- End Event Card Renderer Component ---

  const handleShowQRCode = (event) => {
    setSelectedQrCodeEvent(event);
    setShowQRDialog(true);
  };

  const handleShowAnalytics = (event) => {
    setSelectedAnalyticsEvent(event);
    setShowAnalyticsDialog(true);
  };

  const handleExportData = (event) => {
    // Import the export function at the top of the file
    // import { exportEventToExcel } from './exportToExcel';
    // For now, we'll use a simple CSV export
    exportEventToExcel(event);
  };

  const exportEventToExcel = (event) => {
    const csvContent = [
      ["Event Information", ""],
      ["Event Title", event.title || ""],
      ["Category", event.category || ""],
      ["Location", event.location || ""],
      [
        "Start Date",
        event.startDate ? new Date(event.startDate).toLocaleDateString() : "",
      ],
      [
        "End Date",
        event.endDate ? new Date(event.endDate).toLocaleDateString() : "",
      ],
      ["", ""],
      ["Ticket Metrics", ""],
      ["Tickets Sold", event.ticketsSold || 0],
      ["Total Tickets", event.totalTickets || "Unlimited"],
      ["Sales Progress", `${event.salesPercent || 0}%`],
      ["Tickets Revenue", `${formatPrice(event.ticketsRevenue || 0)}`],
      ["", ""],
      ["Stall Metrics", ""],
      ["Stalls Booked", event.stallsBooked || 0],
      ["Pending Stalls", event.stallsPending || 0],
      ["Stalls Revenue", `${formatPrice(event.stallsRevenue || 0)}`],
      ["", ""],
      ["Revenue Summary", ""],
      ["Total Revenue", formatPrice(event.revenue) || "0"],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const fileName = `${event.title.replace(/[^a-z0-9]/gi, "_")}_Report_${
      new Date().toISOString().split("T")[0]
    }.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h2 className="text-2xl sm:text-3xl font-bold">Dashboard</h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, index) => {
          const Icon = STAT_ICONS[stat.title] || CalendarDays;
          return (
            <Card
              key={index}
              className="transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stat.title === "Total Revenue"
                    ? formatPrice(stat.value)
                    : stat.value}
                </div>
                {stat.change && (
                  <p className="text-xs text-muted-foreground">{stat.change}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <hr />

      {/* Events Tabs */}
      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="current">
            Current Events ({currentEvents.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Past Events ({pastEvents.length})
          </TabsTrigger>
        </TabsList>

        {/* Current Events Content */}
        <TabsContent value="current" className="space-y-4 pt-4">
          {currentEvents.length > 0 ? (
            currentEvents.map((event) => (
              <EventCard key={event._id} event={event} type="current" />
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  No current events running.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Upcoming Events Content */}
        <TabsContent value="upcoming" className="space-y-4 pt-4">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event) => (
              <EventCard key={event._id} event={event} type="upcoming" />
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  No upcoming events scheduled.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Past Events Content */}
        <TabsContent value="past" className="space-y-4 pt-4">
          {pastEvents.length > 0 ? (
            pastEvents.map((event) => (
              <EventCard key={event._id} event={event} type="past" />
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No past events found.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {showQRDialog && selectedQrCodeEvent && (
        <EventQRCode
          event={{
            id: selectedQrCodeEvent._id,
            name: selectedQrCodeEvent.title || selectedQrCodeEvent.name,
            date: selectedQrCodeEvent.startDate
              ? format(new Date(selectedQrCodeEvent.startDate), "PPP")
              : "TBD",
            time: selectedQrCodeEvent.startTime || undefined,
            location: selectedQrCodeEvent.location,
            category: selectedQrCodeEvent.category,
            ticketPrice: selectedQrCodeEvent.price
              ? String(selectedQrCodeEvent.price)
              : undefined,
            organizationName: selectedQrCodeEvent.organizer || "unknown-org", // Adjust based on your data structure
          }}
          apiURL={apiURL}
          onClose={() => setShowQRDialog(false)}
        />
      )}

      <EnhancedEventsDetailDialog
        event={selectedEvent}
        isOpen={showEventDialog}
        onClose={closeEventDetails}
      />

      {/* Analytics Dialog - Import EventAnalyticsDialog component */}
      {/* import { EventAnalyticsDialog } from './EventAnalyticsDialog'; */}
      {showAnalyticsDialog && selectedAnalyticsEvent && (
        <EventAnalyticsDialog
          event={selectedAnalyticsEvent}
          isOpen={showAnalyticsDialog}
          onClose={() => setShowAnalyticsDialog(false)}
        />
      )}
    </div>
  );
}
