import React, { useEffect, useState } from "react";
import { useCountry } from "@/hooks/useCountry";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  TrendingUp,
  Users,
  Ticket,
  Building,
  Calendar,
  Download,
  Search,
  ArrowUpRight,
  Info,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCurrency } from "@/hooks/useCurrencyhook";

// --- Types ---
interface TicketData {
  _id: string;
  ticketId: string;
  customerName: string;
  customerEmail?: string;
  customerWhatsapp?: string;
  totalAmount: number;
  status: string;
  purchaseDate: string;
}

interface StallData {
  _id: string;
  shopkeeperId: {
    name: string;
    shopName: string;
    email?: string;
    phone?: string;
  };
  status: string;
  paymentStatus: string;
  selectedTables: { tableName: string; price: number }[];
  grandTotal: number;
  requestDate: string;
}

export function EventAnalyticsDialog({ event, isOpen, onClose }: any) {
  if (!event) return null;

  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [stalls, setStalls] = useState<StallData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const { country } = useCountry();
    const { formatPrice } = useCurrency(country);

  // --- Derived Metrics ---
  const totalTicketRevenue = tickets.reduce(
    (sum, t) => sum + (t.status === "confirmed" ? t.totalAmount : 0),
    0,
  );
  const totalStallRevenue = stalls.reduce(
    (sum, s) =>
      sum + (["Confirmed", "Completed"].includes(s.status) ? s.grandTotal : 0),
    0,
  );
  const grandTotalRevenue = totalTicketRevenue + totalStallRevenue;
  const stallsBooked = stalls.filter((s) =>
    ["Confirmed", "Completed"].includes(s.status),
  ).length;

  useEffect(() => {
    if (!isOpen) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [tRes, sRes] = await Promise.all([
          fetch(`${__API_URL__}/tickets/event/${event._id}`),
          fetch(`${__API_URL__}/stalls/event/${event._id}`),
        ]);
        const tData = await tRes.json();
        const sData = await sRes.json();
        setTickets(tData.tickets || tData.data || []);
        setStalls(sData.data || []);
      } catch (e) {
        // silently handle fetch errors
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isOpen, event._id]);

  // --- Excel Export Function ---
  const exportToCSV = (type: "tickets" | "stalls") => {
    const data = type === "tickets" ? tickets : stalls;
    if (data.length === 0) return;

    const headers =
      type === "tickets"
        ? ["Date", "Ticket ID", "Customer", "Contact", "Amount", "Status"]
        : [
            "Date",
            "Shop Name",
            "Owner",
            "Tables",
            "Amount",
            "Status",
            "Payment",
          ];

    const rows =
      type === "tickets"
        ? (data as TicketData[]).map((t) => [
            new Date(t.purchaseDate).toLocaleDateString(),
            t.ticketId,
            t.customerName,
            t.customerWhatsapp || "",
            t.totalAmount,
            t.status,
          ])
        : (data as StallData[]).map((s) => [
            new Date(s.requestDate).toLocaleDateString(),
            s.shopkeeperId?.shopName || "",
            s.shopkeeperId?.name || "",
            (s.selectedTables || []).map((t) => t.tableName).join("/"),
            s.grandTotal || 0,
            s.status,
            s.paymentStatus,
          ]);

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${event.title}_${type}_report.csv`;
    link.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 border-b bg-slate-50/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="text-blue-600" /> Event Intelligence
                Dashboard
              </DialogTitle>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />{" "}
                  {new Date(event.startDate).toDateString()}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-medium text-foreground">
                  {event.title}
                </span>
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border shadow-sm flex items-center gap-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none">
                  Gross Revenue
                </p>
                <p className="text-2xl font-black text-green-600">
                  {formatPrice(grandTotalRevenue)}
                </p>
              </div>
              <div className="h-8 w-[1px] bg-slate-200"></div>
              <TrendingUp className="text-green-500 w-8 h-8" />
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* LEFT SIDEBAR: QUICK STATS */}
          <div className="w-full md:w-80 border-r bg-slate-50/30 p-4 space-y-4 overflow-y-auto">
            <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">
              Performance Summary
            </h3>

            <Card className="border-none shadow-none bg-blue-600 text-white">
              <CardContent className="p-4">
                <Ticket className="w-5 h-5 mb-2 opacity-80" />
                <p className="text-xs opacity-80">Ticket Revenue</p>
                <p className="text-xl font-bold">
                  {formatPrice(totalTicketRevenue)}
                </p>
                <p className="text-[10px] mt-1 bg-white/20 inline-block px-1 rounded">
                  {tickets.length} Sales
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-none bg-purple-600 text-white">
              <CardContent className="p-4">
                <Building className="w-5 h-5 mb-2 opacity-80" />
                <p className="text-xs opacity-80">Stall Revenue</p>
                <p className="text-xl font-bold">
                  {formatPrice(totalStallRevenue)}
                </p>
                <p className="text-[10px] mt-1 bg-white/20 inline-block px-1 rounded">
                  {stallsBooked} Stalls
                </p>
              </CardContent>
            </Card>

            <div className="p-4 rounded-lg border bg-white space-y-3">
              <h4 className="text-xs font-bold flex items-center gap-1">
                <Info className="w-3 h-3" /> Event Health
              </h4>
              <div className="space-y-2">
                {/* Stall Fill Rate - dynamic */}
                <div className="flex justify-between text-xs">
                  <span>Stall Fill Rate</span>
                  <span className="font-bold text-purple-600">
                    {stalls.length > 0 ? Math.round((stallsBooked / stalls.length) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full transition-all"
                    style={{ width: `${stalls.length > 0 ? Math.round((stallsBooked / stalls.length) * 100) : 0}%` }}
                  ></div>
                </div>

                {/* Ticket Sales Rate - dynamic */}
                {(() => {
                  const totalCapacity = Number(event.totalTickets) || 0;
                  const confirmedTickets = tickets.filter(t => t.status === "confirmed").length;
                  const ticketPercent = totalCapacity > 0 ? Math.round((confirmedTickets / totalCapacity) * 100) : (confirmedTickets > 0 ? 100 : 0);
                  return (
                    <>
                      <div className="flex justify-between text-xs mt-2">
                        <span>Ticket Sales</span>
                        <span className="font-bold text-blue-600">
                          {confirmedTickets}{totalCapacity > 0 ? `/${totalCapacity}` : ""} ({ticketPercent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-full transition-all"
                          style={{ width: `${Math.min(ticketPercent, 100)}%` }}
                        ></div>
                      </div>
                    </>
                  );
                })()}

                {/* Payment Collection Rate */}
                {(() => {
                  const paidStalls = stalls.filter(s => s.paymentStatus === "Paid").length;
                  const paymentPercent = stallsBooked > 0 ? Math.round((paidStalls / stallsBooked) * 100) : 0;
                  return (
                    <>
                      <div className="flex justify-between text-xs mt-2">
                        <span>Payment Collected</span>
                        <span className="font-bold text-green-600">
                          {paidStalls}/{stallsBooked} ({paymentPercent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="bg-green-500 h-full transition-all"
                          style={{ width: `${paymentPercent}%` }}
                        ></div>
                      </div>
                    </>
                  );
                })()}

                {/* Overall Score */}
                {(() => {
                  const totalCapacity = Number(event.totalTickets) || 0;
                  const confirmedTickets = tickets.filter(t => t.status === "confirmed").length;
                  const ticketScore = totalCapacity > 0 ? (confirmedTickets / totalCapacity) * 100 : (confirmedTickets > 0 ? 100 : 0);
                  const stallScore = stalls.length > 0 ? (stallsBooked / stalls.length) * 100 : 0;
                  const overallHealth = Math.round((ticketScore + stallScore) / 2);
                  const healthColor = overallHealth >= 70 ? "text-green-600" : overallHealth >= 40 ? "text-yellow-600" : "text-red-600";
                  const healthLabel = overallHealth >= 70 ? "Excellent" : overallHealth >= 40 ? "Good" : "Needs Attention";
                  return (
                    <div className="flex justify-between items-center text-xs mt-3 pt-3 border-t">
                      <span className="font-bold">Overall Health</span>
                      <span className={`font-bold ${healthColor}`}>{healthLabel} ({overallHealth}%)</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* MAIN CONTENT: TABS WITH LISTS */}
          {/* MAIN CONTENT: TABS WITH LISTS */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <Tabs
              defaultValue="tickets"
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="px-6 pt-4 flex justify-between items-center border-b">
                <TabsList className="bg-transparent gap-6 h-12">
                  <TabsTrigger
                    value="tickets"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none bg-transparent px-0 font-bold"
                  >
                    Ticket Holders
                  </TabsTrigger>
                  <TabsTrigger
                    value="stalls"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 rounded-none bg-transparent px-0 font-bold"
                  >
                    Exhibitors/Stalls
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search records..."
                      className="h-8 w-48 pl-8 text-xs"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-2"
                    onClick={() => exportToCSV("tickets")}
                  >
                    <Download className="w-3 h-3" /> Export
                  </Button>
                </div>
              </div>

              {/* TICKETS TAB WITH SCROLLER */}
              <TabsContent
                value="tickets"
                className="flex-1 m-0 overflow-hidden"
              >
                <ScrollArea className="h-[calc(90vh-200px)] w-full">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="text-[11px] uppercase font-bold bg-slate-50">
                          Order Date
                        </TableHead>
                        <TableHead className="text-[11px] uppercase font-bold bg-slate-50">
                          Customer
                        </TableHead>
                        <TableHead className="text-[11px] uppercase font-bold bg-slate-50">
                          Contact
                        </TableHead>
                        <TableHead className="text-[11px] uppercase font-bold text-right bg-slate-50">
                          Amount
                        </TableHead>
                        <TableHead className="text-[11px] uppercase font-bold text-center bg-slate-50">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets
                        .filter((t) =>
                          t.customerName
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()),
                        )
                        .map((ticket) => (
                          <TableRow
                            key={ticket._id}
                            className="hover:bg-blue-50/30"
                          >
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(
                                ticket.purchaseDate,
                              ).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="font-bold text-sm">
                                {ticket.customerName}
                              </div>
                              <div className="text-[10px] text-muted-foreground uppercase">
                                {ticket.ticketId}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs italic">
                              {ticket.customerWhatsapp || ticket.customerEmail}
                            </TableCell>
                            <TableCell className="text-right font-bold text-blue-600">
                              {formatPrice(ticket.totalAmount)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  ticket.status === "confirmed"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-[9px]"
                              >
                                {ticket.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>

              {/* STALLS TAB WITH SCROLLER */}
              <TabsContent
                value="stalls"
                className="flex-1 m-0 overflow-hidden"
              >
                <ScrollArea className="h-[calc(90vh-200px)] w-full">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="text-[11px] uppercase font-bold bg-slate-50">
                          Shop Name
                        </TableHead>
                        <TableHead className="text-[11px] uppercase font-bold bg-slate-50">
                          Exhibitor
                        </TableHead>
                        <TableHead className="text-[11px] uppercase font-bold bg-slate-50">
                          Tables
                        </TableHead>
                        <TableHead className="text-[11px] uppercase font-bold text-right bg-slate-50">
                          Grand Total
                        </TableHead>
                        <TableHead className="text-[11px] uppercase font-bold text-center bg-slate-50">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stalls
                        .filter((s) =>
                          (s.shopkeeperId?.shopName || s.shopkeeperId?.name || "")
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()),
                        )
                        .map((stall) => (
                          <TableRow
                            key={stall._id}
                            className="hover:bg-purple-50/30"
                          >
                            <TableCell className="font-bold">
                              {stall.shopkeeperId?.shopName || stall.brandName || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {stall.shopkeeperId?.name || stall.nameOfApplicant || "—"}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {stall.shopkeeperId?.phone || ""}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(stall.selectedTables || []).map((t, i) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-[9px] bg-white"
                                  >
                                    {t.tableName}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-purple-600">
                              {formatPrice(stall.grandTotal)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                className={`text-[9px] ${stall.paymentStatus === "Paid" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-orange-100 text-orange-700 hover:bg-orange-100"}`}
                              >
                                {stall.paymentStatus}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
