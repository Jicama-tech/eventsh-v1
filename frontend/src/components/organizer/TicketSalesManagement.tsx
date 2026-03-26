import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  TrendingUp,
  TrendingDown,
  Ticket,
  DollarSign,
  Users,
  Settings,
  Plus,
  Download,
  Filter,
  BarChart3,
  Eye,
  Edit,
  Copy,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TicketSalesManagementProps {
  events: any[];
  onUpdateTicket: (ticketData: any) => void;
}

export function TicketSalesManagement({
  events,
  onUpdateTicket,
}: TicketSalesManagementProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("7days");
  const [selectedEvent, setSelectedEvent] = useState("all");
  const [showCustomizeDialog, setShowCustomizeDialog] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();

  // Mock ticket sales data
  const ticketSalesData = [
    {
      id: 1,
      eventId: 4,
      eventName: "Tech Conference 2024",
      ticketType: "Early Bird",
      price: 150,
      soldToday: 12,
      soldThisWeek: 45,
      totalSold: 156,
      totalAvailable: 500,
      revenue: 23400,
      salesTrend: "+15%",
      status: "active",
    },
    {
      id: 2,
      eventId: 4,
      eventName: "Tech Conference 2024",
      ticketType: "Regular",
      price: 200,
      soldToday: 8,
      soldThisWeek: 28,
      totalSold: 89,
      totalAvailable: 300,
      revenue: 17800,
      salesTrend: "+8%",
      status: "active",
    },
    {
      id: 3,
      eventId: 5,
      eventName: "Spring Art Exhibition",
      ticketType: "General",
      price: 75,
      soldToday: 3,
      soldThisWeek: 12,
      totalSold: 34,
      totalAvailable: 200,
      revenue: 2550,
      salesTrend: "+5%",
      status: "active",
    },
    {
      id: 4,
      eventId: 3,
      eventName: "Winter Food Fair",
      ticketType: "VIP",
      price: 120,
      soldToday: 5,
      soldThisWeek: 18,
      totalSold: 75,
      totalAvailable: 100,
      revenue: 9000,
      salesTrend: "+12%",
      status: "active",
    },
  ];

  // Mock daily sales data for timeline
  const dailySalesData = [
    { date: "Mon", sales: 15, revenue: 2250 },
    { date: "Tue", sales: 22, revenue: 3300 },
    { date: "Wed", sales: 18, revenue: 2700 },
    { date: "Thu", sales: 28, revenue: 4200 },
    { date: "Fri", sales: 35, revenue: 5250 },
    { date: "Sat", sales: 42, revenue: 6300 },
    { date: "Sun", sales: 38, revenue: 5700 },
  ];

  const totalStats = {
    totalTicketsSold: ticketSalesData.reduce(
      (sum, item) => sum + item.totalSold,
      0,
    ),
    totalRevenue: ticketSalesData.reduce((sum, item) => sum + item.revenue, 0),
    totalEvents: events.length,
    averageTicketPrice:
      ticketSalesData.reduce((sum, item) => sum + item.price, 0) /
      ticketSalesData.length,
  };

  const handleCustomizeTicket = (ticketData: any) => {
    // Customize ticket functionality - would connect to backend
    onUpdateTicket(ticketData);
    setShowCustomizeDialog(false);
    setEditingTicket(null);
  };

  const filteredSalesData =
    selectedEvent === "all"
      ? ticketSalesData
      : ticketSalesData.filter(
          (item) => item.eventId.toString() === selectedEvent,
        );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Ticket Sales Analytics</h2>
          <p className="text-muted-foreground">
            Track and manage your event ticket sales
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="buttonOutline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button onClick={() => setShowCustomizeDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Ticket Type
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="event-filter">Event</Label>
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id.toString()}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="period-filter">Time Period</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedPeriod === "custom" && (
              <>
                <div>
                  <Label>From Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="buttonOutline"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>To Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="buttonOutline"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            <Button variant="buttonOutline">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Tickets Sold
            </CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStats.totalTicketsSold}
            </div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12% from last week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalStats.totalRevenue.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +18% from last week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Events</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalEvents}</div>
            <div className="flex items-center text-xs text-blue-600">
              <BarChart3 className="h-3 w-3 mr-1" />2 new this month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg. Ticket Price
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Math.round(totalStats.averageTicketPrice)}
            </div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +5% from last month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Timeline and Detailed Analytics */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">Sales</TabsTrigger>
          <TabsTrigger value="tickets">Ticket Details</TabsTrigger>
          <TabsTrigger value="events">By Event</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Sales Timeline</CardTitle>
              <CardDescription>
                Ticket sales and revenue over the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Simple timeline visualization */}
                <div className="grid grid-cols-7 gap-2">
                  {dailySalesData.map((day, index) => (
                    <div key={index} className="text-center">
                      <div className="bg-primary/10 rounded-lg p-4 mb-2">
                        <div className="text-sm font-medium text-muted-foreground">
                          {day.date}
                        </div>
                        <div className="text-lg font-bold">{day.sales}</div>
                        <div className="text-xs text-muted-foreground">
                          ${day.revenue}
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(day.sales / 45) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Performance</CardTitle>
              <CardDescription>
                Detailed breakdown of each ticket type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Today</TableHead>
                    <TableHead>This Week</TableHead>
                    <TableHead>Total Sold</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSalesData.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{ticket.ticketType}</div>
                          <div className="text-sm text-muted-foreground">
                            {ticket.eventName}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        ${ticket.price}
                      </TableCell>
                      <TableCell>{ticket.soldToday}</TableCell>
                      <TableCell>{ticket.soldThisWeek}</TableCell>
                      <TableCell>
                        <div>
                          {ticket.totalSold}/{ticket.totalAvailable}
                        </div>
                        <div className="w-full bg-muted rounded-full h-1 mt-1">
                          <div
                            className="bg-primary h-1 rounded-full"
                            style={{
                              width: `${
                                (ticket.totalSold / ticket.totalAvailable) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {ticket.totalAvailable - ticket.totalSold}
                      </TableCell>
                      <TableCell className="font-medium text-green-600">
                        ${ticket.revenue.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-green-600">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {ticket.salesTrend}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="buttonOutline">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="buttonOutline"
                            onClick={() => {
                              setEditingTicket(ticket);
                              setShowCustomizeDialog(true);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="buttonOutline">
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <div className="grid gap-4">
            {events.map((event) => {
              const eventTickets = ticketSalesData.filter(
                (ticket) => ticket.eventId === event.id,
              );
              const eventRevenue = eventTickets.reduce(
                (sum, ticket) => sum + ticket.revenue,
                0,
              );
              const eventSold = eventTickets.reduce(
                (sum, ticket) => sum + ticket.totalSold,
                0,
              );

              return (
                <Card key={event.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{event.name}</CardTitle>
                        <CardDescription>
                          {event.date} • {event.location}
                        </CardDescription>
                      </div>
                      <Badge variant="buttonOutline">{event.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{eventSold}</div>
                        <div className="text-sm text-muted-foreground">
                          Tickets Sold
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          ${eventRevenue.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Revenue
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {eventTickets.length}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Ticket Types
                        </div>
                      </div>
                    </div>

                    {eventTickets.length > 0 && (
                      <div className="space-y-2">
                        {eventTickets.map((ticket) => (
                          <div
                            key={ticket.id}
                            className="flex justify-between items-center p-2 bg-muted/50 rounded"
                          >
                            <div>
                              <span className="font-medium">
                                {ticket.ticketType}
                              </span>
                              <span className="text-sm text-muted-foreground ml-2">
                                ${ticket.price}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                {ticket.totalSold}/{ticket.totalAvailable}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ${ticket.revenue.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Customize Ticket Dialog */}
      <Dialog open={showCustomizeDialog} onOpenChange={setShowCustomizeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {editingTicket ? "Edit Ticket Type" : "Create New Ticket Type"}
            </DialogTitle>
            <DialogDescription>
              {editingTicket
                ? "Update the ticket configuration"
                : "Configure a new ticket type for your event"}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const ticketData = {
                id: editingTicket?.id || Date.now(),
                eventId: formData.get("eventId"),
                ticketType: formData.get("ticketType"),
                price: parseFloat(formData.get("price") as string),
                quantity: parseInt(formData.get("quantity") as string),
                description: formData.get("description"),
                saleStartDate: formData.get("saleStartDate"),
                saleEndDate: formData.get("saleEndDate"),
                isTransferable: formData.get("isTransferable") === "on",
                maxPerCustomer: parseInt(
                  formData.get("maxPerCustomer") as string,
                ),
                earlyBird: formData.get("earlyBird") === "on",
              };
              handleCustomizeTicket(ticketData);
            }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="eventId">Event</Label>
                <Select
                  name="eventId"
                  defaultValue={editingTicket?.eventId?.toString()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id.toString()}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ticketType">Ticket Type Name</Label>
                <Input
                  name="ticketType"
                  defaultValue={editingTicket?.ticketType}
                  placeholder="e.g., Early Bird, VIP, General"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  name="price"
                  type="number"
                  step="0.01"
                  defaultValue={editingTicket?.price}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="quantity">Available Quantity</Label>
                <Input
                  name="quantity"
                  type="number"
                  defaultValue={editingTicket?.totalAvailable}
                  placeholder="100"
                  required
                />
              </div>

              <div>
                <Label htmlFor="maxPerCustomer">Max per Customer</Label>
                <Input
                  name="maxPerCustomer"
                  type="number"
                  defaultValue="5"
                  placeholder="5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                name="description"
                placeholder="Describe what's included with this ticket type..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="saleStartDate">Sale Start Date</Label>
                <Input name="saleStartDate" type="datetime-local" />
              </div>

              <div>
                <Label htmlFor="saleEndDate">Sale End Date</Label>
                <Input name="saleEndDate" type="datetime-local" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="earlyBird">Early Bird Pricing</Label>
                  <p className="text-sm text-muted-foreground">
                    Mark this as an early bird ticket
                  </p>
                </div>
                <Switch name="earlyBird" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="isTransferable">Transferable</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow customers to transfer tickets
                  </p>
                </div>
                <Switch name="isTransferable" />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="buttonOutline"
                onClick={() => setShowCustomizeDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingTicket ? "Update Ticket" : "Create Ticket"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
