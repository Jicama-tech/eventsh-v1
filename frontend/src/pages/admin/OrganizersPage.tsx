import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Search,
  RefreshCw,
  Eye,
  Phone,
  Mail,
  Calendar,
  Ticket,
  DollarSign,
  Briefcase,
  Package,
  Globe,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiURL = __API_URL__;

interface Organizer {
  _id: string;
  name: string;
  organizationName: string;
  email: string;
  businessEmail?: string;
  phone?: string;
  whatsAppNumber?: string;
  country?: string;
  address?: string;
  bio?: string;
  approved: boolean;
  rejected: boolean;
  status: "active" | "pending" | "rejected";
  subscribed: boolean;
  planId: string | null;
  planName: string | null;
  planStartDate: string | null;
  planExpiryDate: string | null;
  planActive: boolean;
  pricePaid: string | null;
  commissionPercentage?: number;
  provider: string;
  providerId: string | null;
  referredByAgent: { name: string; referralCode: string } | null;
  eventsCreated: number;
  ticketsSold: number;
  revenue: number;
  bankTransferEnabled: boolean;
  razorpayStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Summary {
  total: number;
  active: number;
  pending: number;
  rejected: number;
  subscribed: number;
  referred: number;
  totalRevenue: number;
  totalEvents: number;
  totalTickets: number;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
};

export function OrganizersPage() {
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Organizer | null>(null);
  const { toast } = useToast();

  const token = sessionStorage.getItem("token");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${apiURL}/admin/organizers-overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
      const json = await res.json();
      setSummary(json.summary || null);
      setOrganizers(json.organizers || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planOptions = useMemo(() => {
    const set = new Set<string>();
    organizers.forEach((o) => o.planName && set.add(o.planName));
    return Array.from(set);
  }, [organizers]);

  const filtered = useMemo(() => {
    let list = organizers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.name?.toLowerCase().includes(q) ||
          o.organizationName?.toLowerCase().includes(q) ||
          o.email?.toLowerCase().includes(q) ||
          o.phone?.toLowerCase().includes(q) ||
          o.whatsAppNumber?.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((o) => o.status === statusFilter);
    }
    if (planFilter !== "all") {
      list = list.filter((o) =>
        planFilter === "_none" ? !o.planName : o.planName === planFilter,
      );
    }
    if (providerFilter !== "all") {
      list = list.filter((o) =>
        providerFilter === "Agent" ? o.provider === "Agent" : o.provider !== "Agent",
      );
    }
    return list;
  }, [organizers, search, statusFilter, planFilter, providerFilter]);

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`${apiURL}/admin/approve/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "Organizer" }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      toast({ title: "Approved" });
      setSelected(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`${apiURL}/admin/reject/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "Organizer" }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      toast({ title: "Rejected" });
      setSelected(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const exportCSV = () => {
    const headers = [
      "Name",
      "Organization",
      "Email",
      "Phone",
      "WhatsApp",
      "Country",
      "Status",
      "Plan",
      "Plan Active",
      "Plan Expiry",
      "Events",
      "Tickets Sold",
      "Revenue",
      "Provider",
      "Referred By",
      "Joined",
    ];
    const rows = filtered.map((o) =>
      [
        o.name,
        o.organizationName,
        o.email,
        o.phone,
        o.whatsAppNumber,
        o.country,
        o.status,
        o.planName || "—",
        o.planActive ? "Yes" : "No",
        o.planExpiryDate
          ? new Date(o.planExpiryDate).toLocaleDateString()
          : "",
        o.eventsCreated,
        o.ticketsSold,
        o.revenue,
        o.provider,
        o.referredByAgent
          ? `${o.referredByAgent.name} (${o.referredByAgent.referralCode})`
          : "",
        o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "",
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `organizers_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${filtered.length} rows` });
  };

  const STATS = summary
    ? [
        {
          title: "Total",
          value: summary.total,
          icon: Building2,
          color: "text-indigo-600",
          bg: "bg-indigo-50",
        },
        {
          title: "Active",
          value: summary.active,
          icon: CheckCircle2,
          color: "text-green-600",
          bg: "bg-green-50",
        },
        {
          title: "Pending",
          value: summary.pending,
          icon: Clock,
          color: "text-yellow-600",
          bg: "bg-yellow-50",
        },
        {
          title: "Subscribed",
          value: summary.subscribed,
          icon: Package,
          color: "text-rose-600",
          bg: "bg-rose-50",
        },
        {
          title: "Referred",
          value: summary.referred,
          icon: Briefcase,
          color: "text-cyan-600",
          bg: "bg-cyan-50",
        },
        {
          title: "Total Events",
          value: summary.totalEvents,
          icon: Calendar,
          color: "text-blue-600",
          bg: "bg-blue-50",
        },
        {
          title: "Tickets Sold",
          value: summary.totalTickets,
          icon: Ticket,
          color: "text-purple-600",
          bg: "bg-purple-50",
        },
        {
          title: "Revenue",
          value: `$${summary.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
          icon: DollarSign,
          color: "text-emerald-600",
          bg: "bg-emerald-50",
        },
      ]
    : [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">Organizers</h2>
          <p className="text-sm text-muted-foreground">
            Every organizer registered on the platform — plan, events, tickets,
            revenue and referral source.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={fetchData} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {STATS.map((s, i) => (
          <Card key={i} className="border-slate-100">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                  {s.title}
                </p>
                <div
                  className={`${s.bg} p-1.5 rounded-md flex items-center justify-center shrink-0`}
                >
                  <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                </div>
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 sm:p-4 flex flex-wrap gap-2 sm:gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, organization, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="_none">No plan</SelectItem>
              {planOptions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="Agent">Agent referrals</SelectItem>
              <SelectItem value="self">Self signup</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ml-auto text-xs">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </Badge>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">All Organizers</CardTitle>
          <CardDescription>
            Click a row to see full profile, plan and referral source
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-600 text-sm">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No organizers match this filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Organizer</TableHead>
                    <TableHead className="font-semibold">Contact</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Plan</TableHead>
                    <TableHead className="font-semibold">Activity</TableHead>
                    <TableHead className="font-semibold">Referred</TableHead>
                    <TableHead className="font-semibold">Joined</TableHead>
                    <TableHead className="text-right font-semibold">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow
                      key={o._id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelected(o)}
                    >
                      <TableCell>
                        <div className="font-medium text-sm">
                          {o.organizationName || o.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {o.name}
                          {o.country && ` • ${o.country}`}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {o.email && (
                          <div className="flex items-center gap-1 text-muted-foreground truncate max-w-[180px]">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{o.email}</span>
                          </div>
                        )}
                        {o.whatsAppNumber && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            {o.whatsAppNumber}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${STATUS_BADGE[o.status]}`}
                        >
                          {o.status === "active" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : o.status === "pending" ? (
                            <Clock className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {o.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {o.planName ? (
                          <div>
                            <div className="font-medium">{o.planName}</div>
                            <div className="text-muted-foreground">
                              {o.planActive ? (
                                <>
                                  Expires{" "}
                                  {o.planExpiryDate &&
                                    new Date(
                                      o.planExpiryDate,
                                    ).toLocaleDateString()}
                                </>
                              ) : (
                                <span className="text-red-600">Expired</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-blue-500" />
                            {o.eventsCreated} events
                          </div>
                          <div className="flex items-center gap-1">
                            <Ticket className="h-3 w-3 text-purple-500" />
                            {o.ticketsSold} tickets
                          </div>
                          {o.revenue > 0 && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-emerald-500" />
                              ${o.revenue.toFixed(0)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {o.referredByAgent ? (
                          <div>
                            <div className="font-medium flex items-center gap-1">
                              <Briefcase className="h-3 w-3 text-cyan-500" />
                              {o.referredByAgent.name}
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono mt-0.5"
                            >
                              {o.referredByAgent.referralCode}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Self</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelected(o)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected?.organizationName || selected?.name}
              {selected?.approved && (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
            </DialogTitle>
            <DialogDescription>
              {selected?.name}
              {selected?.country ? ` · ${selected.country}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              {/* Identity */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Email", value: selected.email },
                  { label: "Business Email", value: selected.businessEmail },
                  { label: "Phone", value: selected.phone },
                  { label: "WhatsApp", value: selected.whatsAppNumber },
                  { label: "Country", value: selected.country },
                  { label: "Address", value: selected.address },
                ].map((f, i) =>
                  f.value ? (
                    <div key={i}>
                      <p className="text-xs text-muted-foreground">
                        {f.label}
                      </p>
                      <p className="text-sm font-medium break-all">{f.value}</p>
                    </div>
                  ) : null,
                )}
              </div>
              {selected.bio && (
                <div>
                  <p className="text-xs text-muted-foreground">About</p>
                  <p className="text-sm">{selected.bio}</p>
                </div>
              )}

              {/* Activity */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  {
                    label: "Events",
                    value: selected.eventsCreated,
                    icon: Calendar,
                    color: "text-blue-600",
                  },
                  {
                    label: "Tickets Sold",
                    value: selected.ticketsSold,
                    icon: Ticket,
                    color: "text-purple-600",
                  },
                  {
                    label: "Revenue",
                    value: `$${selected.revenue.toFixed(2)}`,
                    icon: DollarSign,
                    color: "text-emerald-600",
                  },
                ].map((m, i) => (
                  <Card key={i}>
                    <CardContent className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <m.icon className={`h-4 w-4 ${m.color}`} />
                        <span className="text-xs text-muted-foreground">
                          {m.label}
                        </span>
                      </div>
                      <p className={`text-lg font-bold mt-1 ${m.color}`}>
                        {m.value}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Plan */}
              <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    Subscription
                  </p>
                  <Badge
                    variant={selected.planActive ? "default" : "secondary"}
                  >
                    {selected.planActive
                      ? "Active"
                      : selected.subscribed
                        ? "Expired"
                        : "Inactive"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Plan: </span>
                    {selected.planName || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Price paid: </span>
                    {selected.pricePaid || "—"}
                  </div>
                  {selected.planStartDate && (
                    <div>
                      <span className="text-muted-foreground">Started: </span>
                      {new Date(selected.planStartDate).toLocaleDateString()}
                    </div>
                  )}
                  {selected.planExpiryDate && (
                    <div>
                      <span className="text-muted-foreground">Expires: </span>
                      {new Date(selected.planExpiryDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Referral */}
              {selected.referredByAgent ? (
                <div className="border rounded-lg p-3 bg-cyan-50/40 space-y-1">
                  <p className="text-xs font-medium flex items-center gap-1">
                    <Briefcase className="h-3 w-3 text-cyan-600" />
                    Referred by Agent
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {selected.referredByAgent.name}
                    </span>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {selected.referredByAgent.referralCode}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <p className="text-xs">
                    <Globe className="h-3 w-3 inline mr-1" />
                    Self-signup (no referral)
                  </p>
                </div>
              )}

              {/* Payment setup */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Bank Transfer</p>
                  <p className="font-medium">
                    {selected.bankTransferEnabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Razorpay KYC</p>
                  <p className="font-medium">
                    {selected.razorpayStatus || "Not set up"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Commission</p>
                  <p className="font-medium">
                    {selected.commissionPercentage ?? 0}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Joined</p>
                  <p className="font-medium">
                    {selected.createdAt
                      ? new Date(selected.createdAt).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
            {selected && selected.status === "pending" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleReject(selected._id)}
                >
                  Reject
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleApprove(selected._id)}
                >
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
