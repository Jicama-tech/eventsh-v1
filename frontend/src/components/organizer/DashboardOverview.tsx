import React, { useEffect, useState, useCallback } from "react";
import { statAccent, STATUS_ACCENTS } from "@/lib/accents";
import { useSubscription } from "@/hooks/useSubscription";
import { ModuleGate } from "@/components/ui/ModuleGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EventPnlDialog from "@/components/organizer/EventPnlDialog";
import { EventFeedbackDialog } from "@/components/organizer/EventFeedbackDialog";
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
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Share,
  Map,
  Wallet,
  MessageSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { EnhancedEventsDetailDialog } from "./EventsDetailDialog";
import { format, isToday, isPast } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { jwtDecode } from "jwt-decode";
import { EventQRCode } from "./EventQRCode";
import { EventAnalyticsDialog } from "./EventAnalyticsDialog";
import { EventSpaceAnalyticsDialog } from "./EventSpaceAnalyticsDialog";
import { OperatorVenueView } from "./OperatorVenueView";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useCountry } from "@/hooks/useCountry";
import {
  computeMemberSplit,
  drawMemberSplitPdf,
  MEMBER_SPLIT_PDF_HEIGHT,
  type MemberSplit,
} from "@/lib/memberSplit";
import {
  drawSectionTable,
  fallbackReport,
  fetchEventReport,
  SECTION_STYLE,
  type EventReport,
} from "@/lib/eventReportPdf";
import { t } from "@/i18n/t";

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
 * Tile accents come from lib/accents (shared with kioscart-v1). Assigned by
 * the tile's own index, never by rank, so a card keeps its colour when a
 * sibling is added or hidden.
 */

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
  // Plan sub-toggles for the analytics module:
  //   overview  — the headline stat tiles
  //   revenue   — money figures inside each event card
  //   attendees — the attendee/participant counts
  //   exports   — the CSV / PDF download menu
  const { isModuleSectionEnabled } = useSubscription();
  const canOverview = isModuleSectionEnabled("analytics", "overview");
  const canRevenue = isModuleSectionEnabled("analytics", "revenue");
  const canAttendees = isModuleSectionEnabled("analytics", "attendees");
  const canExports = isModuleSectionEnabled("analytics", "exports");
  const [organizerId, setOrganizerId] = useState("");
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedQrCodeEvent, setSelectedQrCodeEvent] = useState(null);
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
  const [selectedAnalyticsEvent, setSelectedAnalyticsEvent] = useState(null);
  // Space-template analytics drill-down (Upcoming/Current events).
  const [showSpaceAnalytics, setShowSpaceAnalytics] = useState(false);
  const [spaceAnalyticsEvent, setSpaceAnalyticsEvent] = useState<any>(null);
  // Live venue-layout view (which spaces are booked + add-ons purchased).
  const [showVenueLayout, setShowVenueLayout] = useState(false);
  // P&L report dialog (money in / money out / net profit for one event).
  const [pnlEvent, setPnlEvent] = useState<any>(null);
  const [showPnl, setShowPnl] = useState(false);
  // Feedback (ratings/comments + payment feedback) for one event.
  const [feedbackEvent, setFeedbackEvent] = useState<any>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [venueLayoutEvent, setVenueLayoutEvent] = useState<any>(null);
  const { country } = useCountry();
  const { formatPrice, getSymbol } = useCurrency(country);

  const calculateEventMetrics = (event, tickets, stalls = [], revenueByEvent = {}) => {
    // eventId can arrive populated (object), a plain id, or null (the ticket's
    // event was since deleted — populate() resolves a dangling ref to null).
    // Normalize + guard the same way the stall filter below already does, so
    // one orphaned ticket doesn't crash the whole dashboard for this organizer.
    const evIdForTickets = String(event._id);
    const eventTickets = tickets.filter((ticket) => {
      const raw = ticket.eventId;
      if (!raw) return false;
      const tid = typeof raw === "object" ? raw._id : raw;
      return String(tid) === evIdForTickets && ticket.status === "confirmed";
    });

    const ticketsSold = eventTickets.reduce(
      (total, ticket) =>
        total +
        ticket.ticketDetails.reduce(
          (subTotal, detail) => subTotal + detail.quantity,
          0,
        ),
      0,
    );

    // Only count CONFIRMED ticket revenue — matches the chatbot's
    // /organizers/analytics endpoint and avoids inflating totals with
    // pending payments.
    const ticketsRevenue = eventTickets
      .filter((ticket) => ticket.paymentConfirmed)
      .reduce((total, ticket) => total + ticket.totalAmount, 0);

    const ticketsSoldToday = eventTickets.filter((ticket) =>
      isToday(new Date(ticket.purchaseDate)),
    ).length;

    // Calculate stall metrics for this event ONLY — eventId can arrive
    // populated (object) or as a plain id; normalize both sides to strings
    // so a type mismatch never leaks other events' stalls into this card.
    const evId = String(event._id);
    const eventStalls = stalls.filter((stall) => {
      const raw = stall.eventId;
      if (!raw) return false;
      const sid = typeof raw === "object" ? raw._id : raw;
      return String(sid) === evId;
    });

    // Booked = SPACES sold on this event's stalls (one vendor buying 3
    // spaces counts 3), for stalls that are Processing (paid, pending
    // approval) / Confirmed / Completed — same rule as the analytics
    // dialogs and the chatbot. Keeps the numerator in the same unit as the
    // "/ sellableSpaces" denominator below.
    const stallsBooked = eventStalls
      .filter((stall) =>
        ["Confirmed", "Processing", "Completed"].includes(stall.status),
      )
      .reduce(
        (sum, stall) =>
          sum +
          (Array.isArray(stall.selectedTables)
            ? stall.selectedTables.length
            : 0),
        0,
      );

    const stallsPending = eventStalls.filter(
      (stall) => stall.status === "Pending",
    ).length;

    // Total SELLABLE spaces placed in the venue — the reference/denominator for
    // "Stalls Booked". venueTables can be a flat array or an object keyed by
    // venueConfig; a space is sellable unless explicitly forSale:false.
    const placedSpaces: any[] = Array.isArray(event.venueTables)
      ? event.venueTables
      : event.venueTables && typeof event.venueTables === "object"
        ? Object.values(event.venueTables).flatMap((v: any) =>
            Array.isArray(v) ? v : [],
          )
        : [];
    const sellableSpaces = placedSpaces.filter(
      (p: any) => p?.forSale !== false,
    ).length;

    const stallsRevenue = eventStalls
      .filter(
        (stall) =>
          stall.paymentStatus === "Paid" && stall.status !== "Cancelled",
      )
      .reduce((sum, stall) => sum + (stall.grandTotal || 0), 0);

    // Canonical per-event revenue (tickets + stalls + round-tables + confirmed
    // sponsors) comes from the analytics endpoint so it reconciles exactly
    // with the Total Revenue card. Fall back to the local tickets+stalls sum
    // if it isn't available.
    const canonical = revenueByEvent?.[String(event._id)];
    const totalRevenue =
      typeof canonical === "number" ? canonical : ticketsRevenue + stallsRevenue;

    const totalCapacity =
      event.visitorTypes?.length > 0
        ? event.visitorTypes.reduce(
            (sum: number, v: any) => sum + (v.maxCount || 0),
            0,
          )
        : Number(event.totalTickets) || 0;
    // Only compute a percentage when we actually have a capacity to compare
    // against. Faking 100% for unlimited-capacity events was misleading — it's
    // not "100% sold", it's "capacity unknown / unlimited".
    const salesPercent =
      totalCapacity > 0
        ? Math.min(100, Math.round((ticketsSold / totalCapacity) * 100))
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
      sellableSpaces,
    };
  };

  const calculateDashboardStats = (
    allEventsWithMetrics,
    stallsData = [],
    analyticsTotals = null,
  ) => {
    const totalEvents = allEventsWithMetrics.length;
    const totalTicketsSold = allEventsWithMetrics.reduce(
      (sum, event) => sum + (event.ticketsSold || 0),
      0,
    );
    // Use the per-event ticketsRevenue (paid tickets only) — NOT rawRevenue,
    // which already mixes in stalls and would double-count below.
    const ticketsRevenue = allEventsWithMetrics.reduce(
      (sum, event) => sum + (event.ticketsRevenue || 0),
      0,
    );
    const ticketsSoldToday = allEventsWithMetrics.reduce(
      (sum, event) => sum + (event.ticketsSoldToday || 0),
      0,
    );

    // Calculate stalls statistics — same unit as the per-event cards:
    // SPACES sold across all events (a vendor's multi-space booking counts
    // each space), Processing/Confirmed/Completed only.
    const totalStallsBooked = stallsData
      .filter((stall) =>
        ["Confirmed", "Processing", "Completed"].includes(stall.status),
      )
      .reduce(
        (sum, stall) =>
          sum +
          (Array.isArray(stall.selectedTables)
            ? stall.selectedTables.length
            : 0),
        0,
      );

    const stallsRevenue = stallsData
      .filter(
        (stall) =>
          stall.paymentStatus === "Paid" && stall.status !== "Cancelled",
      )
      .reduce((sum, stall) => sum + (stall.grandTotal || 0), 0);

    // Prefer the unified analytics endpoint total (tickets + round-tables +
    // stalls + confirmed sponsors) so this matches the chatbot's Total
    // Revenue card exactly. Fall back to local calc if the endpoint isn't
    // reachable.
    const totalRevenue =
      typeof analyticsTotals?.revenue === "number"
        ? analyticsTotals.revenue
        : ticketsRevenue + stallsRevenue;

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

      // 3b. Unified analytics totals — the same source the chatbot reads.
      // Includes ticket + round-table + stall revenue.
      let analyticsTotals = null;
      let revenueByEvent = {};
      try {
        const analyticsResponse = await fetch(
          `${apiURL}/organizers/analytics/${organizerIdFromToken}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (analyticsResponse.ok) {
          const a = await analyticsResponse.json();
          analyticsTotals = a.totals || null;
          revenueByEvent = a.revenueByEvent || {};
        }
      } catch {
        /* fall back to local calc */
      }

      // 4. Process and Merge Data (with stalls)
      const processedEvents = allEvents.map((event) =>
        calculateEventMetrics(event, ticketData, stallsData, revenueByEvent),
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
      setStats(
        calculateDashboardStats(processedEvents, stallsData, analyticsTotals),
      );
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
    const totalCapacity =
      event.visitorTypes?.length > 0
        ? event.visitorTypes.reduce(
            (sum: number, v: any) => sum + (v.maxCount || 0),
            0,
          )
        : Number(event.totalTickets) || 0;
    const salesPercent = event.salesPercent || 0;
    const revenue = event.revenue || 0;
    const ticketsSoldToday = event.ticketsSoldToday || 0;

    // Stall metrics
    const stallsBooked = event.stallsBooked || 0;
    const stallsPending = event.stallsPending || 0;
    const stallsTotal = event.stallsTotal || 0;
    const sellableSpaces = event.sellableSpaces || 0;
    const ticketsRevenue = event.ticketsRevenue || 0;
    const stallsRevenue = event.stallsRevenue || 0;

    // Single-list phase tag: Live / Upcoming / Past.
    const badgeColor =
      type === "current"
        ? "bg-green-500"
        : type === "upcoming"
          ? "bg-blue-500"
          : "bg-gray-500";

    const badgeText =
      type === "current"
        ? "LIVE"
        : type === "upcoming"
          ? "UPCOMING"
          : "PAST";

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
                src={
                  event.image.startsWith("/")
                    ? `${apiURL?.replace("/api", "")}${event.image}`
                    : event.image
                }
                alt={event.title || event.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-3xl">
                🎪
              </div>
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
              {/* Metric 1: Tickets Sold — the attendee-count metric. */}
              {canAttendees && (
              <div className="text-center">
                <div className={`text-xl font-bold ${statAccent(0).icon}`}>
                  {ticketsSold}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tickets Sold
                </div>
              </div>
              )}

              {/* Metric 2: Stalls Booked — shown against the total sellable
                  spaces in the venue so it reads as "booked of available". */}
              <div className="text-center">
                <div className={`text-xl font-bold ${statAccent(4).icon}`}>
                  {stallsBooked}
                  {sellableSpaces > 0 && (
                    <span className="text-sm font-semibold text-muted-foreground">
                      {" "}
                      / {sellableSpaces}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Stalls Booked
                </div>
              </div>

              {/* Metric 3: Total Revenue */}
              {canRevenue && (
              <div className="text-center">
                <div className={`text-xl font-bold ${statAccent(1).icon}`}>
                  {formatPrice(revenue)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Revenue
                </div>
              </div>
              )}

              {/* Metric 4: Tickets Revenue */}
              {canRevenue && (
              <div className="text-center">
                <div className={`text-lg font-semibold ${statAccent(5).icon}`}>
                  {formatPrice(ticketsRevenue)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tickets Revenue
                </div>
              </div>
              )}

              {/* Metric 5: Stalls Revenue */}
              {canRevenue && (
              <div className="text-center">
                <div className={`text-lg font-semibold ${statAccent(2).icon}`}>
                  {formatPrice(stallsRevenue)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Stalls Revenue
                </div>
              </div>
              )}

              {/* Metric 6: Pending Stalls */}
              <div className="text-center">
                <div className={`text-lg font-semibold ${STATUS_ACCENTS.warning.icon}`}>
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
                    <Share className="h-4 w-4 mr-1" />
                    Share
                  </Button>
                  {/* Space-template analytics — booked vs available spaces and
                      the brands behind each booking. Hidden for personal /
                      marriage events, which have no sellable spaces. */}
                  {event.eventType !== "personal" && (
                    <Button
                      variant="buttonOutline"
                      size="sm"
                      onClick={() => {
                        setSpaceAnalyticsEvent(event);
                        setShowSpaceAnalytics(true);
                      }}
                    >
                      <LineChart className="h-4 w-4 mr-1" />
                      Analytics
                    </Button>
                  )}
                  {/* Live venue layout — booked spaces + purchased add-ons,
                      same view volunteers/operators see. Spaces free up when a
                      booking is cancelled or deleted. Not for personal events. */}
                  {event.eventType !== "personal" && (
                    <Button
                      variant="buttonOutline"
                      size="sm"
                      onClick={() => {
                        setVenueLayoutEvent(event);
                        setShowVenueLayout(true);
                      }}
                    >
                      <Map className="h-4 w-4 mr-1" />
                      Venue Layout
                    </Button>
                  )}
                  {/* Profit & loss for this event — money in from visitors,
                      exhibitors, round tables, speakers and sponsors, less
                      supplier payouts and the platform fee. */}
                  <Button
                    variant="buttonOutline"
                    size="sm"
                    onClick={() => {
                      setPnlEvent(event);
                      setShowPnl(true);
                    }}
                  >
                    <Wallet className="h-4 w-4 mr-1" />
                    P&L Report
                  </Button>
                  {/* Ratings, comments and payment feedback for this event. */}
                  <Button
                    variant="buttonOutline"
                    size="sm"
                    onClick={() => {
                      setFeedbackEvent(event);
                      setShowFeedback(true);
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Feedback
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
                  {/* Profit & loss for this event — money in from visitors,
                      exhibitors, round tables, speakers and sponsors, less
                      supplier payouts and the platform fee. */}
                  <Button
                    variant="buttonOutline"
                    size="sm"
                    onClick={() => {
                      setPnlEvent(event);
                      setShowPnl(true);
                    }}
                  >
                    <Wallet className="h-4 w-4 mr-1" />
                    P&L Report
                  </Button>
                  {/* Ratings, comments and payment feedback for this event. */}
                  <Button
                    variant="buttonOutline"
                    size="sm"
                    onClick={() => {
                      setFeedbackEvent(event);
                      setShowFeedback(true);
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Feedback
                  </Button>
                  {canExports && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Export Data
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => exportEventToCSV(event)}
                        className="focus:bg-blue-600 focus:text-white cursor-pointer"
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Export as CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => exportEventToPDF(event)}
                        className="focus:bg-blue-600 focus:text-white cursor-pointer"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Export as PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  )}
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

  // Build the row data once — both CSV and PDF render the same content.
  const buildEventReportRows = (event: any): [string, string][] => [
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
    ["Tickets Sold", String(event.ticketsSold ?? 0)],
    ["Total Tickets", String(event.totalTickets ?? "Unlimited")],
    ["Sales Progress", `${event.salesPercent ?? 0}%`],
    ["Tickets Revenue", `${formatPrice(event.ticketsRevenue ?? 0)}`],
    ["", ""],
    ["Stall Metrics", ""],
    ["Stalls Booked", String(event.stallsBooked ?? 0)],
    ["Pending Stalls", String(event.stallsPending ?? 0)],
    ["Stalls Revenue", `${formatPrice(event.stallsRevenue ?? 0)}`],
    ["", ""],
    ["Revenue Summary", ""],
    ["Total Revenue", `${formatPrice(event.revenue ?? 0)}`],
  ];

  const exportEventToCSV = (event: any) => {
    const csvContent = buildEventReportRows(event)
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? "");
            // Escape any commas / quotes / newlines in the cell
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      )
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
    URL.revokeObjectURL(url);
  };

  // Event report PDF, built around the sections this event actually uses:
  // one table per section (visitors, exhibitors, round tables, workshops,
  // scheduled spaces, speakers, sponsors) listing everything it sells. A
  // section the event doesn't use — e.g. no visitor ticketing — is left out,
  // and the page says so.
  const exportEventToPDF = async (event: any) => {
    try {
      const token = sessionStorage.getItem("token");
      const auth: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // Members vs non-members needs the event's space pricing and its
      // bookings with each vendor's membership. Paid bookings only, so it
      // adds up with the Exhibitors table. A failed fetch leaves it out.
      const loadMemberSplit = async (): Promise<MemberSplit | null> => {
        try {
          const [evRes, stallRes] = await Promise.all([
            fetch(`${apiURL}/events/${event._id}`),
            fetch(`${apiURL}/stalls/event/${event._id}`, { headers: auth }),
          ]);
          const evJson = await evRes.json();
          const stallJson = await stallRes.json();
          return computeMemberSplit(
            evJson?.data || evJson,
            Array.isArray(stallJson?.data)
              ? stallJson.data
              : Array.isArray(stallJson)
                ? stallJson
                : [],
            (s) => s?.paymentStatus === "Paid" && s?.status !== "Cancelled",
          );
        } catch {
          return null;
        }
      };
      const [fetched, memberSplit] = await Promise.all([
        fetchEventReport(apiURL, event._id, auth),
        loadMemberSplit(),
      ]);
      const report: EventReport = fetched || fallbackReport(event);
      const sections = report.sections;

      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 36;
      const innerW = pageW - margin * 2;

      // --- Pie / arc helper (jsPDF has no native arc fill) ---
      const drawPieSlice = (
        cx: number,
        cy: number,
        r: number,
        startA: number,
        sweepA: number,
        color: [number, number, number],
      ) => {
        if (sweepA <= 0) return;
        const steps = Math.max(16, Math.ceil(Math.abs(sweepA) * 32));
        const pts: [number, number][] = [[cx, cy]];
        for (let i = 0; i <= steps; i++) {
          const a = startA + sweepA * (i / steps);
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
        const deltas: [number, number][] = [];
        for (let i = 1; i < pts.length; i++) {
          deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
        }
        doc.setFillColor(color[0], color[1], color[2]);
        (doc as any).lines(deltas, pts[0][0], pts[0][1], [1, 1], "F", true);
      };

      // Color palette (mirrors the dashboard tones)
      const C = {
        primary: [99, 102, 241] as [number, number, number], // indigo-500
        primaryDark: [79, 70, 229] as [number, number, number], // indigo-600
        green: [34, 197, 94] as [number, number, number],
        purple: [139, 92, 246] as [number, number, number],
        gray: [107, 114, 128] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
      };
      const setFill = (c: [number, number, number]) =>
        doc.setFillColor(c[0], c[1], c[2]);
      const setText = (c: [number, number, number]) =>
        doc.setTextColor(c[0], c[1], c[2]);
      // Set the largest font size (up to `max`) at which `txt` fits in
      // `maxW`, in the current font. Money like "SG$12,345.00" runs far wider
      // than a bare count, so fixed sizes spill out of their boxes.
      const fitFont = (txt: string, maxW: number, max: number, min = 6) => {
        let fs = max;
        doc.setFontSize(fs);
        while (fs > min && doc.getTextWidth(txt) > maxW) {
          fs -= 0.5;
          doc.setFontSize(fs);
        }
        return fs;
      };
      // Whole amounts print without the ".00" (SG$200, not SG$200.00);
      // real cents stay.
      const pdfPrice = (v: number) => formatPrice(v).replace(/[.,]00$/, "");
      const colorOf = (key: string): [number, number, number] =>
        SECTION_STYLE[key as keyof typeof SECTION_STYLE]?.color || C.gray;
      const pct = (a: number, b: number) =>
        b > 0 ? Math.round((a / b) * 100) : 0;

      // ===== HEADER BANNER =====
      // Grows with a title that wraps, so the lines under it never overlap.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      const title = doc.splitTextToSize(
        event.title || "Event Report",
        innerW - 200,
      );
      const metaY = 38 + 25.3 * (title.length - 1) + 20;
      const headerH = Math.max(90, metaY + 32);
      setFill(C.primaryDark);
      doc.rect(0, 0, pageW, headerH, "F");
      // Decorative circle accents
      setFill(C.primary);
      doc.circle(pageW - 30, 18, 60, "F");
      doc.circle(pageW - 90, headerH - 5, 35, "F");

      setText(C.white);
      doc.text(title, margin, 38);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const metaParts: string[] = [];
      if (event.category) metaParts.push(event.category);
      if (event.location) metaParts.push(event.location);
      if (event.startDate)
        metaParts.push(new Date(event.startDate).toLocaleDateString());
      doc.text(metaParts.join("  •  "), margin, metaY);

      doc.setFontSize(9);
      doc.setTextColor(220, 225, 255);
      doc.text(
        `Report generated ${new Date().toLocaleString()}`,
        margin,
        headerH - 12,
      );

      let y = headerH + 22;
      const pageBreak = (at: number, need: number) => {
        if (at + need > pageH - margin - 30) {
          doc.addPage();
          return margin;
        }
        return at;
      };

      // ===== WHICH SECTIONS THIS EVENT USES =====
      setText(C.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const secLine = doc.splitTextToSize(
        `Sections: ${sections.map((s) => s.label).join("  ·  ") || "none set up yet"}${
          report.hasVisitorTicketing ? "" : "      No visitor ticketing for this event"
        }`,
        innerW,
      );
      doc.text(secLine, margin, y);
      y += secLine.length * 12 + 10;

      // ===== KPI CARDS — Total Revenue + the first sections' headline =====
      const kpis = [
        {
          label: "Total Revenue",
          value: pdfPrice(report.totalRevenue),
          sub: "all sections",
          color: C.green,
          glyph: "$",
        },
        ...sections.slice(0, 3).map((s) => ({
          label: s.soldLabel,
          value: String(s.sold),
          sub: `${s.label} · ${pdfPrice(s.revenue)}`,
          color: colorOf(s.key),
          glyph: SECTION_STYLE[s.key]?.glyph || "•",
        })),
      ];
      const cardGap = 10;
      const cardW = (innerW - cardGap * (kpis.length - 1)) / kpis.length;
      const cardH = 92;
      kpis.forEach((kpi, i) => {
        const cx = margin + i * (cardW + cardGap);
        const cy = y;
        // shadow-ish backdrop
        setFill([240, 241, 245]);
        doc.roundedRect(cx + 1, cy + 2, cardW, cardH, 8, 8, "F");
        // card
        setFill(C.white);
        doc.setDrawColor(230, 232, 240);
        doc.roundedRect(cx, cy, cardW, cardH, 8, 8, "FD");
        // colored top accent
        setFill(kpi.color);
        doc.roundedRect(cx, cy, cardW, 4, 8, 8, "F");
        doc.rect(cx, cy + 2, cardW, 2, "F");
        // icon circle
        setFill(kpi.color);
        doc.circle(cx + 22, cy + 32, 12, "F");
        setText(C.white);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        const gw = doc.getTextWidth(kpi.glyph);
        doc.text(kpi.glyph, cx + 22 - gw / 2, cy + 36);
        // big value — shrunk to fit between the icon and the card edge,
        // centred on the icon
        setText([20, 20, 20]);
        doc.setFont("helvetica", "bold");
        const vfs = fitFont(kpi.value, cardW - 42 - 10, 18);
        doc.text(kpi.value, cx + 42, cy + 32 + vfs * 0.35);
        // label
        setText(C.gray);
        doc.setFont("helvetica", "bold");
        const label = kpi.label.toUpperCase();
        fitFont(label, cardW - 24, 8);
        doc.text(label, cx + 12, cy + 60);
        // sub
        doc.setFont("helvetica", "normal");
        fitFont(kpi.sub, cardW - 24, 9);
        doc.text(kpi.sub, cx + 12, cy + 76);
      });
      y += cardH + 28;

      // ===== TWO-PANEL VIZ ROW: revenue by section + how full each is =====
      const panelGap = 16;
      const panelW = (innerW - panelGap) / 2;
      const panelH = 200;
      const earning = sections.filter((s) => s.revenue > 0);
      const totalRev = earning.reduce((a, s) => a + s.revenue, 0);

      // -- Panel A: Revenue by section donut --
      const aX = margin;
      setFill([250, 251, 254]);
      doc.setDrawColor(230, 232, 240);
      doc.roundedRect(aX, y, panelW, panelH, 8, 8, "FD");
      setText([20, 20, 20]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Revenue by Section", aX + 14, y + 20);
      const donutCx = aX + panelW / 4 + 8;
      const donutCy = y + panelH / 2 + 8;
      const donutR = 48;
      if (totalRev > 0) {
        let start = -Math.PI / 2;
        for (const s of earning) {
          const sweep = (s.revenue / totalRev) * Math.PI * 2;
          drawPieSlice(donutCx, donutCy, donutR, start, sweep, colorOf(s.key));
          start += sweep;
        }
      } else {
        setFill([220, 223, 230]);
        doc.circle(donutCx, donutCy, donutR, "F");
      }
      // donut hole + total in the middle
      setFill([250, 251, 254]);
      doc.circle(donutCx, donutCy, donutR * 0.55, "F");
      setText([20, 20, 20]);
      doc.setFont("helvetica", "bold");
      const totalLabel = pdfPrice(totalRev);
      fitFont(totalLabel, donutR * 0.55 * 2 - 8, 11);
      doc.text(totalLabel, donutCx, donutCy, { align: "center" });
      setText(C.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("TOTAL", donutCx, donutCy + 10, { align: "center" });
      // Legend — every section, two lines each when they fit, else one
      const legendX = aX + panelW / 2 - 2;
      const legendW = aX + panelW - 8 - (legendX + 14);
      const roomy = sections.length <= 4;
      const legStep = roomy
        ? 34
        : Math.min(22, (panelH - 44) / Math.max(1, sections.length));
      let legY = y + (roomy ? 52 : 42);
      if (sections.length === 0) {
        setText(C.gray);
        doc.setFontSize(8);
        doc.text("No sections set up yet.", legendX, legY);
      }
      for (const s of sections) {
        setFill(colorOf(s.key));
        doc.roundedRect(legendX, legY - 8, 9, 9, 2, 2, "F");
        const share = `${pdfPrice(s.revenue)}  ·  ${pct(s.revenue, totalRev)}%`;
        if (roomy) {
          setText([20, 20, 20]);
          doc.setFont("helvetica", "bold");
          fitFont(s.label, legendW, 9);
          doc.text(s.label, legendX + 14, legY);
          setText(C.gray);
          doc.setFont("helvetica", "normal");
          fitFont(share, legendW, 8);
          doc.text(share, legendX + 14, legY + 12);
        } else {
          setText([20, 20, 20]);
          doc.setFont("helvetica", "normal");
          const one = `${s.label}  ${share}`;
          fitFont(one, legendW, 8);
          doc.text(one, legendX + 14, legY);
        }
        legY += legStep;
      }

      // -- Panel B: how full each section is --
      const bX = margin + panelW + panelGap;
      setFill([250, 251, 254]);
      doc.setDrawColor(230, 232, 240);
      doc.roundedRect(bX, y, panelW, panelH, 8, 8, "FD");
      setText([20, 20, 20]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("How Full Each Section Is", bX + 14, y + 20);
      const filled = sections.filter((s) => s.fill && s.fill.total > 0);
      if (filled.length === 0) {
        setText(C.gray);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(
          "No section has a set capacity.",
          bX + panelW / 2,
          y + panelH / 2,
          { align: "center" },
        );
      } else {
        const step = Math.min(36, (panelH - 44) / filled.length);
        let by = y + 44;
        for (const s of filled) {
          const f = s.fill!;
          setText([20, 20, 20]);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.text(s.label, bX + 14, by);
          setText(C.gray);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text(
            `${f.used}/${f.total} ${f.unit}  ·  ${pct(f.used, f.total)}%`,
            bX + panelW - 14,
            by,
            { align: "right" },
          );
          setFill([230, 232, 240]);
          doc.roundedRect(bX + 14, by + 4, panelW - 28, 7, 3.5, 3.5, "F");
          const w = ((panelW - 28) * Math.min(f.used, f.total)) / f.total;
          if (w > 0) {
            setFill(colorOf(s.key));
            doc.roundedRect(bX + 14, by + 4, Math.max(7, w), 7, 3.5, 3.5, "F");
          }
          by += step;
        }
      }
      y += panelH + 24;

      // ===== HORIZONTAL STACKED REVENUE BAR =====
      setText([20, 20, 20]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Revenue Split", margin, y);
      y += 12;
      const stackH = 22;
      setFill([235, 237, 244]);
      doc.roundedRect(margin, y, innerW, stackH, 4, 4, "F");
      let sx = margin;
      for (const s of earning) {
        const w = (innerW * s.revenue) / totalRev;
        setFill(colorOf(s.key));
        doc.roundedRect(sx, y, w, stackH, 4, 4, "F");
        setText(C.white);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        const lbl = `${s.label} ${pct(s.revenue, totalRev)}%`;
        if (doc.getTextWidth(lbl) + 12 < w) doc.text(lbl, sx + 8, y + 14);
        sx += w;
      }
      y += stackH + 24;

      // ===== STRUCTURED DATA TABLES =====
      // A clean, bordered table per section. Header row is filled with the
      // section color and white bold text. Body rows alternate background for
      // readability. Values are right-aligned. Auto page-break between rows.
      const tableRowH = 22;
      const headerRowH = 26;
      const labelColX = margin + 14;
      const valueColRight = pageW - margin - 14;

      const dataTable = (
        sectionName: string,
        headerColor: [number, number, number],
        rows: [string, string][],
      ) => {
        const tableTopGap = 8;
        const tableHeight = headerRowH + rows.length * tableRowH;
        // page-break if entire section won't fit; otherwise just header + 1 row
        if (y + tableHeight > pageH - margin - 30) {
          doc.addPage();
          y = margin;
        }
        y += tableTopGap;

        // Header row
        setFill(headerColor);
        doc.roundedRect(margin, y, innerW, headerRowH, 4, 4, "F");
        // Square off bottom corners by overlaying a rect (so table feels joined)
        doc.rect(margin, y + headerRowH - 4, innerW, 4, "F");
        setText(C.white);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(sectionName.toUpperCase(), labelColX, y + 17);
        // small "Section" tag on the right of the header
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const tagText = `${rows.length} item${rows.length === 1 ? "" : "s"}`;
        doc.text(tagText, valueColRight - doc.getTextWidth(tagText), y + 17);
        y += headerRowH;

        // Body rows
        rows.forEach(([label, value], idx) => {
          if (y + tableRowH > pageH - margin - 30) {
            doc.addPage();
            y = margin;
            // Re-draw a slim header on continuation pages
            setFill(headerColor);
            doc.rect(margin, y, innerW, 4, "F");
            y += 8;
          }
          // Alt row background
          if (idx % 2 === 0) {
            setFill([249, 250, 252]);
            doc.rect(margin, y, innerW, tableRowH, "F");
          }
          // Label
          setText([60, 65, 78]);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.text(label, labelColX, y + 15);
          // Value (right-aligned, bold)
          setText([20, 20, 20]);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          const wrapped = doc.splitTextToSize(String(value), innerW / 2);
          const valueText = wrapped[0]; // single line in body rows
          doc.text(
            valueText,
            valueColRight - doc.getTextWidth(valueText),
            y + 15,
          );
          // bottom border
          doc.setDrawColor(232, 234, 240);
          doc.line(margin, y + tableRowH, margin + innerW, y + tableRowH);
          y += tableRowH;
        });
        // Outer border
        doc.setDrawColor(220, 224, 232);
        doc.setLineWidth(0.7);
        doc.roundedRect(
          margin,
          y - (headerRowH + rows.length * tableRowH),
          innerW,
          headerRowH + rows.length * tableRowH,
          4,
          4,
          "S",
        );
        doc.setLineWidth(0.2);
        y += 4;
      };

      dataTable("Event Details", C.purple, [
        ["Title", event.title || "—"],
        ["Category", event.category || "—"],
        ["Location", event.location || "—"],
        [
          "Start Date",
          event.startDate
            ? new Date(event.startDate).toLocaleDateString()
            : "—",
        ],
        [
          "End Date",
          event.endDate ? new Date(event.endDate).toLocaleDateString() : "—",
        ],
        [
          "Visitor ticketing",
          report.hasVisitorTicketing ? "Yes" : "Not used for this event",
        ],
      ]);

      // One table per section with everything it sells. The partial
      // fallback has no per-item detail, so it relies on the summary below.
      if (!report.partial) {
        for (const s of sections) {
          y = drawSectionTable(doc, s, {
            x: margin,
            y: y + 10,
            width: innerW,
            money: pdfPrice,
            pageBreak,
          });
          // Only for events with a member rate on some sellable space.
          if (s.key === "exhibitors" && memberSplit) {
            y = pageBreak(y + 22, MEMBER_SPLIT_PDF_HEIGHT);
            y = drawMemberSplitPdf(doc, memberSplit, {
              x: margin,
              y: y === margin ? y + 12 : y,
              width: innerW,
              money: pdfPrice,
            });
          }
        }
      }

      dataTable("Revenue Summary", C.green, [
        ...sections.map((s): [string, string] => [s.label, pdfPrice(s.revenue)]),
        ["Total Revenue", pdfPrice(report.totalRevenue)],
      ]);
      y = pageBreak(y + 8, 30);
      setText(C.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        doc.splitTextToSize(
          "Counts money received: tickets with payment confirmed, exhibitor and round-table bookings marked paid, confirmed sponsors, and paid workshops, scheduled slots and speaker fees. Exhibitor revenue includes refundable security deposits.",
          innerW,
        ),
        margin,
        y + 6,
      );

      // ===== FOOTER on every page =====
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        setText(C.gray);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`EventSH • ${event.title || "Report"}`, margin, pageH - 16);
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageW - margin - doc.getTextWidth(`Page ${i} of ${pageCount}`),
          pageH - 16,
        );
      }

      const fileName = `${event.title.replace(/[^a-z0-9]/gi, "_")}_Report_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      doc.save(fileName);
    } catch (e) {
      console.error("PDF export failed:", e);
      toast({
        title: "PDF export failed",
        description: "Please try again or use CSV export.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h2 className="text-2xl sm:text-3xl font-bold">{t("Dashboard")}</h2>
      </div>

      {/* Stats Grid */}
      <ModuleGate moduleKey="analytics" sectionKey="overview" hideWhenLocked>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, index) => {
          const Icon = STAT_ICONS[stat.title] || CalendarDays;
          const accent = statAccent(index);
          return (
            <Card
              key={index}
              className={`border-l-4 ${accent.ring} transition-all hover:bg-muted dark:hover:bg-gray-800`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                {/* stat.title stays English in the array: it doubles as the
                    STAT_ICONS key and as the "Total Revenue" comparison
                    below. Translate at the point of render instead. */}
                <CardTitle className="text-sm font-medium">
                  {t(stat.title)}
                </CardTitle>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent.chip}`}
                >
                  <Icon className={`h-4 w-4 ${accent.icon}`} />
                </span>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${accent.icon}`}>
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
      </ModuleGate>

      <hr />

      {/* Events — a single list. Each card carries a Live / Upcoming / Past
          tag instead of splitting them across three tabs. Ordered Live first,
          then Upcoming, then Past. */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("Events")}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 font-medium text-green-700">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {currentEvents.length} Live
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {upcomingEvents.length} Upcoming
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-gray-400" />
              {pastEvents.length} Past
            </span>
          </div>
        </div>

        {(() => {
          const all = [
            ...currentEvents.map((event) => ({ event, type: "current" })),
            ...upcomingEvents.map((event) => ({ event, type: "upcoming" })),
            ...pastEvents.map((event) => ({ event, type: "past" })),
          ];
          if (all.length === 0) {
            return (
              <Card>
                <CardContent className="text-center py-8">
                  <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No events yet.</p>
                </CardContent>
              </Card>
            );
          }
          return all.map(({ event, type }) => (
            <EventCard key={event._id} event={event} type={type} />
          ));
        })()}
      </div>

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

      {/* Space-template analytics drill-down for Upcoming/Current events. */}
      <EventSpaceAnalyticsDialog
        open={showSpaceAnalytics}
        onOpenChange={(o) => {
          setShowSpaceAnalytics(o);
          if (!o) setSpaceAnalyticsEvent(null);
        }}
        event={spaceAnalyticsEvent}
      />

      {/* Ratings + comments, with the payment-feedback panel inside. */}
      <EventFeedbackDialog
        eventId={feedbackEvent?._id ?? feedbackEvent?.id ?? null}
        eventTitle={feedbackEvent?.title || feedbackEvent?.name}
        open={showFeedback}
        onOpenChange={(o) => {
          setShowFeedback(o);
          if (!o) setFeedbackEvent(null);
        }}
      />

      {/* Per-event profit & loss, downloadable as a PDF. */}
      <EventPnlDialog
        open={showPnl}
        onClose={() => setShowPnl(false)}
        eventId={pnlEvent?._id || pnlEvent?.id}
      />

      {/* Live venue layout — which spaces are booked and which add-ons were
          purchased, using the same view volunteers/operators get. */}
      <Dialog
        open={showVenueLayout}
        onOpenChange={(o) => {
          setShowVenueLayout(o);
          if (!o) setVenueLayoutEvent(null);
        }}
      >
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Venue Layout — {venueLayoutEvent?.title || venueLayoutEvent?.name}
            </DialogTitle>
          </DialogHeader>
          {venueLayoutEvent && (
            <OperatorVenueView eventId={venueLayoutEvent._id} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
