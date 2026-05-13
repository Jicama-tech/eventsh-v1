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
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Share,
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

    // Only count CONFIRMED ticket revenue — matches the chatbot's
    // /organizers/analytics endpoint and avoids inflating totals with
    // pending payments.
    const ticketsRevenue = eventTickets
      .filter((ticket) => ticket.paymentConfirmed)
      .reduce((total, ticket) => total + ticket.totalAmount, 0);

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

    // Calculate stalls statistics
    const totalStallsBooked = stallsData.filter((stall) =>
      ["Confirmed", "Processing", "Completed"].includes(stall.status),
    ).length;

    const stallsRevenue = stallsData
      .filter((stall) => stall.paymentStatus === "Paid")
      .reduce((sum, stall) => sum + (stall.grandTotal || 0), 0);

    // Prefer the unified analytics endpoint total (tickets + round-tables +
    // stalls) so this matches the chatbot's Total Revenue card exactly.
    // Fall back to local calc if the endpoint isn't reachable.
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
      try {
        const analyticsResponse = await fetch(
          `${apiURL}/organizers/analytics/${organizerIdFromToken}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (analyticsResponse.ok) {
          const a = await analyticsResponse.json();
          analyticsTotals = a.totals || null;
        }
      } catch {
        /* fall back to local calc */
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
                    <Share className="h-4 w-4 mr-1" />
                    Share
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

  const exportEventToPDF = async (event: any) => {
    try {
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

      // Concentric rings → donut effect (overlay smaller filled circle in center)
      const drawDonutHole = (
        cx: number,
        cy: number,
        innerR: number,
        color: [number, number, number],
      ) => {
        doc.setFillColor(color[0], color[1], color[2]);
        doc.circle(cx, cy, innerR, "F");
      };

      // Color palette (mirrors the dashboard tones)
      const C = {
        primary: [99, 102, 241] as [number, number, number], // indigo-500
        primaryDark: [79, 70, 229] as [number, number, number], // indigo-600
        blue: [59, 130, 246] as [number, number, number],
        green: [34, 197, 94] as [number, number, number],
        purple: [139, 92, 246] as [number, number, number],
        orange: [249, 115, 22] as [number, number, number],
        gray: [107, 114, 128] as [number, number, number],
        light: [243, 244, 246] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
      };
      const setFill = (c: [number, number, number]) =>
        doc.setFillColor(c[0], c[1], c[2]);
      const setText = (c: [number, number, number]) =>
        doc.setTextColor(c[0], c[1], c[2]);

      // ===== HEADER BANNER =====
      const headerH = 90;
      setFill(C.primaryDark);
      doc.rect(0, 0, pageW, headerH, "F");
      // Decorative circle accents
      setFill(C.primary);
      doc.circle(pageW - 30, 18, 60, "F");
      doc.circle(pageW - 90, headerH - 5, 35, "F");

      setText(C.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      const title = doc.splitTextToSize(
        event.title || "Event Report",
        innerW - 200,
      );
      doc.text(title, margin, 38);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      let metaY = 38 + 18 * title.length;
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

      let y = headerH + 28;

      // ===== KPI CARDS — single row of 4, with colored icon-badge =====
      const kpis = [
        {
          label: "Tickets Sold",
          value: String(event.ticketsSold ?? 0),
          sub: `of ${event.totalTickets ?? "∞"}`,
          color: C.blue,
          glyph: "T",
        },
        {
          label: "Total Revenue",
          value: formatPrice(event.revenue ?? 0),
          sub: "all sources",
          color: C.green,
          glyph: "$",
        },
        {
          label: "Stalls Booked",
          value: String(event.stallsBooked ?? 0),
          sub: `${event.stallsPending ?? 0} pending`,
          color: C.orange,
          glyph: "B",
        },
        {
          label: "Sales %",
          value: `${event.salesPercent ?? 0}%`,
          sub: "of capacity",
          color: C.purple,
          glyph: "%",
        },
      ];
      const cardGap = 10;
      const cardW = (innerW - cardGap * 3) / 4;
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
        // big value
        setText([20, 20, 20]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text(kpi.value, cx + 42, cy + 38);
        // label
        setText(C.gray);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(kpi.label.toUpperCase(), cx + 12, cy + 60);
        // sub
        setText(C.gray);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(kpi.sub, cx + 12, cy + 76);
      });
      y += cardH + 28;

      // ===== TWO-PANEL VIZ ROW: Donut (revenue) + Gauge (sales %) =====
      const panelGap = 16;
      const panelW = (innerW - panelGap) / 2;
      const panelH = 200;
      const ticketsRev = Number(event.ticketsRevenue ?? 0);
      const stallsRev = Number(event.stallsRevenue ?? 0);
      const totalRev = ticketsRev + stallsRev;

      // -- Panel A: Revenue Donut --
      const aX = margin;
      setFill([250, 251, 254]);
      doc.setDrawColor(230, 232, 240);
      doc.roundedRect(aX, y, panelW, panelH, 8, 8, "FD");
      setText([20, 20, 20]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Revenue Breakdown", aX + 14, y + 20);
      // Donut on left half of panel
      const donutCx = aX + panelW / 3;
      const donutCy = y + panelH / 2 + 6;
      const donutR = 52;
      if (totalRev > 0) {
        const ticketShare = ticketsRev / totalRev;
        const stallShare = stallsRev / totalRev;
        const TWO_PI = Math.PI * 2;
        // start from -90° (top)
        const start = -Math.PI / 2;
        drawPieSlice(
          donutCx,
          donutCy,
          donutR,
          start,
          ticketShare * TWO_PI,
          C.blue,
        );
        drawPieSlice(
          donutCx,
          donutCy,
          donutR,
          start + ticketShare * TWO_PI,
          stallShare * TWO_PI,
          C.orange,
        );
      } else {
        setFill([220, 223, 230]);
        doc.circle(donutCx, donutCy, donutR, "F");
      }
      // donut hole
      drawDonutHole(donutCx, donutCy, donutR * 0.55, [250, 251, 254]);
      // total in middle
      setText([20, 20, 20]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const totalLabel = formatPrice(totalRev);
      const tw = doc.getTextWidth(totalLabel);
      doc.text(totalLabel, donutCx - tw / 2, donutCy);
      setText(C.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const totW = doc.getTextWidth("TOTAL");
      doc.text("TOTAL", donutCx - totW / 2, donutCy + 10);
      // Legend on right half
      const legendX = aX + panelW / 2 + 14;
      let legY = y + 56;
      const legendItem = (
        color: [number, number, number],
        name: string,
        value: number,
      ) => {
        setFill(color);
        doc.roundedRect(legendX, legY - 8, 10, 10, 2, 2, "F");
        setText([20, 20, 20]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(name, legendX + 16, legY);
        setText(C.gray);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const pct = totalRev > 0 ? Math.round((value / totalRev) * 100) : 0;
        doc.text(`${formatPrice(value)}  ·  ${pct}%`, legendX + 16, legY + 12);
        legY += 36;
      };
      legendItem(C.blue, "Tickets", ticketsRev);
      legendItem(C.orange, "Stalls", stallsRev);

      // -- Panel B: Sales Gauge (semicircle arc) --
      const bX = margin + panelW + panelGap;
      setFill([250, 251, 254]);
      doc.setDrawColor(230, 232, 240);
      doc.roundedRect(bX, y, panelW, panelH, 8, 8, "FD");
      setText([20, 20, 20]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Capacity Utilisation", bX + 14, y + 20);
      const pct = Math.max(0, Math.min(100, event.salesPercent ?? 0));
      const gaugeCx = bX + panelW / 2;
      const gaugeCy = y + panelH / 2 + 28;
      const gaugeR = 64;
      // Background arc (full half circle)
      drawPieSlice(gaugeCx, gaugeCy, gaugeR, Math.PI, Math.PI, [230, 232, 240]);
      // Filled arc up to pct
      drawPieSlice(
        gaugeCx,
        gaugeCy,
        gaugeR,
        Math.PI,
        (Math.PI * pct) / 100,
        C.primary,
      );
      // Inner cutout for "ring" look
      drawDonutHole(gaugeCx, gaugeCy, gaugeR * 0.6, [250, 251, 254]);
      // Hide bottom half of donut hole (since gauge is only top semicircle)
      setFill([250, 251, 254]);
      doc.rect(gaugeCx - gaugeR - 4, gaugeCy, gaugeR * 2 + 8, gaugeR + 6, "F");
      // Re-draw the baseline of the arc
      doc.setDrawColor(230, 232, 240);
      doc.line(gaugeCx - gaugeR, gaugeCy, gaugeCx + gaugeR, gaugeCy);
      // Big % in center
      setText(C.primary);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      const pctLabel = `${pct}%`;
      const pw = doc.getTextWidth(pctLabel);
      doc.text(pctLabel, gaugeCx - pw / 2, gaugeCy - 8);
      setText(C.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const subLabel = `${event.ticketsSold ?? 0} / ${
        event.totalTickets ?? "Unlimited"
      } sold`;
      const sw = doc.getTextWidth(subLabel);
      doc.text(subLabel, gaugeCx - sw / 2, gaugeCy + 16);

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
      if (totalRev > 0) {
        const tW = (innerW * ticketsRev) / totalRev;
        const sW = innerW - tW;
        setFill(C.blue);
        doc.roundedRect(margin, y, tW, stackH, 4, 4, "F");
        // Right segment (clip-feel by overlaying rect on the shared seam)
        setFill(C.orange);
        doc.roundedRect(margin + tW, y, sW, stackH, 4, 4, "F");
        // Inline labels
        setText(C.white);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        const tPct = Math.round((ticketsRev / totalRev) * 100);
        const sPct = 100 - tPct;
        if (tW > 50) doc.text(`Tickets ${tPct}%`, margin + 8, y + 14);
        if (sW > 50) doc.text(`Stalls ${sPct}%`, margin + tW + 8, y + 14);
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
      ]);

      dataTable("Ticket Metrics", C.blue, [
        ["Tickets Sold", String(event.ticketsSold ?? 0)],
        ["Total Tickets", String(event.totalTickets ?? "Unlimited")],
        ["Sales Progress", `${event.salesPercent ?? 0}%`],
        ["Tickets Revenue", formatPrice(event.ticketsRevenue ?? 0)],
      ]);

      dataTable("Stall Metrics", C.orange, [
        ["Stalls Booked", String(event.stallsBooked ?? 0)],
        ["Pending Stalls", String(event.stallsPending ?? 0)],
        ["Stalls Revenue", formatPrice(event.stallsRevenue ?? 0)],
      ]);

      dataTable("Revenue Summary", C.green, [
        ["Tickets Revenue", formatPrice(event.ticketsRevenue ?? 0)],
        ["Stalls Revenue", formatPrice(event.stallsRevenue ?? 0)],
        ["Total Revenue", formatPrice(event.revenue ?? 0)],
      ]);

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
