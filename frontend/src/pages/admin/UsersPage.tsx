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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  Phone,
  Mail,
  Building2,
  Calendar,
  Ticket,
  Mic2,
  Briefcase,
  Store,
  UserCheck,
  Layers,
  Download,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiURL = __API_URL__;

interface UnifiedUser {
  key: string;
  name: string;
  email: string;
  phone: string;
  whatsAppNumber: string;
  country?: string;
  organizationName?: string;
  roles: string[];
  eventsCreated: number;
  ticketsPurchased: number;
  ticketRevenue: number;
  stallsRegistered: number;
  speakerRequests: number;
  operatorOf: string[];
  referralCode?: string;
  referredOrganizers: number;
  subscribed: boolean;
  planExpiryDate?: string | null;
  approvedOrganizer?: boolean | null;
  firstSeen: string;
  lastSeen: string;
  sources: { type: string; id: string }[];
}

interface Summary {
  totalUnique: number;
  organizers: number;
  visitors: number;
  exhibitors: number;
  speakers: number;
  ticketBuyers: number;
  operators: number;
  agents: number;
  multiRole: number;
}

const ROLE_STYLE: Record<
  string,
  { bg: string; text: string; icon: any }
> = {
  Organizer: { bg: "bg-indigo-100", text: "text-indigo-700", icon: Building2 },
  Visitor: { bg: "bg-amber-100", text: "text-amber-700", icon: Users },
  Exhibitor: { bg: "bg-orange-100", text: "text-orange-700", icon: Store },
  Speaker: { bg: "bg-purple-100", text: "text-purple-700", icon: Mic2 },
  "Ticket Buyer": {
    bg: "bg-pink-100",
    text: "text-pink-700",
    icon: Ticket,
  },
  Operator: {
    bg: "bg-cyan-100",
    text: "text-cyan-700",
    icon: UserCheck,
  },
  Agent: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    icon: Briefcase,
  },
  Admin: {
    bg: "bg-slate-200",
    text: "text-slate-700",
    icon: ShieldCheck,
  },
};

function RoleBadge({ role }: { role: string }) {
  const style = ROLE_STYLE[role] || {
    bg: "bg-gray-100",
    text: "text-gray-700",
    icon: Users,
  };
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      <Icon className="h-3 w-3" />
      {role}
    </span>
  );
}

export function UsersPage() {
  const [data, setData] = useState<UnifiedUser[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selected, setSelected] = useState<UnifiedUser | null>(null);
  const { toast } = useToast();

  const token = sessionStorage.getItem("token");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${apiURL}/admin/users-overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
      const json = await res.json();
      setSummary(json.summary || null);
      setData(json.users || []);
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

  const filtered = useMemo(() => {
    let list = data;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q) ||
          u.whatsAppNumber?.toLowerCase().includes(q) ||
          u.organizationName?.toLowerCase().includes(q),
      );
    }
    if (roleFilter !== "all") {
      list = list.filter((u) => u.roles.includes(roleFilter));
    }
    return list;
  }, [data, search, roleFilter]);

  const exportCSV = () => {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "WhatsApp",
      "Organization",
      "Country",
      "Roles",
      "Events Created",
      "Tickets Purchased",
      "Ticket Revenue",
      "Stalls",
      "Speaker Requests",
      "Referrals",
      "First Seen",
      "Last Active",
    ];
    const rows = filtered.map((u) =>
      [
        u.name,
        u.email,
        u.phone,
        u.whatsAppNumber,
        u.organizationName || "",
        u.country || "",
        u.roles.join("|"),
        u.eventsCreated,
        u.ticketsPurchased,
        u.ticketRevenue,
        u.stallsRegistered,
        u.speakerRequests,
        u.referredOrganizers,
        u.firstSeen ? new Date(u.firstSeen).toLocaleDateString() : "",
        u.lastSeen ? new Date(u.lastSeen).toLocaleDateString() : "",
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${filtered.length} rows` });
  };

  const STAT_CARDS = summary
    ? [
        {
          title: "Total Unique",
          value: summary.totalUnique,
          icon: Users,
          bg: "bg-slate-50",
          color: "text-slate-700",
        },
        {
          title: "Organizers",
          value: summary.organizers,
          icon: Building2,
          bg: "bg-indigo-50",
          color: "text-indigo-600",
        },
        {
          title: "Visitors",
          value: summary.visitors,
          icon: Users,
          bg: "bg-amber-50",
          color: "text-amber-600",
        },
        {
          title: "Exhibitors",
          value: summary.exhibitors,
          icon: Store,
          bg: "bg-orange-50",
          color: "text-orange-600",
        },
        {
          title: "Speakers",
          value: summary.speakers,
          icon: Mic2,
          bg: "bg-purple-50",
          color: "text-purple-600",
        },
        {
          title: "Ticket Buyers",
          value: summary.ticketBuyers,
          icon: Ticket,
          bg: "bg-pink-50",
          color: "text-pink-600",
        },
        {
          title: "Operators",
          value: summary.operators,
          icon: UserCheck,
          bg: "bg-cyan-50",
          color: "text-cyan-600",
        },
        {
          title: "Multi-role",
          value: summary.multiRole,
          icon: Layers,
          bg: "bg-emerald-50",
          color: "text-emerald-600",
        },
      ]
    : [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">Users</h2>
          <p className="text-sm text-muted-foreground">
            Every unique person on the platform — organizers, visitors,
            exhibitors, speakers, ticket buyers, operators and agents — merged
            by email/WhatsApp.
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
        {STAT_CARDS.map((s, i) => (
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
              placeholder="Search by name, email, phone, organization…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="Organizer">Organizers</SelectItem>
              <SelectItem value="Visitor">Visitors</SelectItem>
              <SelectItem value="Exhibitor">Exhibitors</SelectItem>
              <SelectItem value="Speaker">Speakers</SelectItem>
              <SelectItem value="Ticket Buyer">Ticket Buyers</SelectItem>
              <SelectItem value="Operator">Operators</SelectItem>
              <SelectItem value="Agent">Agents</SelectItem>
              <SelectItem value="Admin">Admins</SelectItem>
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
          <CardTitle className="text-base sm:text-lg">
            All Users
          </CardTitle>
          <CardDescription>
            Unified by email/WhatsApp — same person across roles is one row
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading users…</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-600 text-sm">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No users match this filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Person</TableHead>
                    <TableHead className="font-semibold">Contact</TableHead>
                    <TableHead className="font-semibold">Roles</TableHead>
                    <TableHead className="font-semibold">Activity</TableHead>
                    <TableHead className="font-semibold">First Seen</TableHead>
                    <TableHead className="font-semibold">Last Active</TableHead>
                    <TableHead className="text-right font-semibold">
                      Details
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow
                      key={u.key}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelected(u)}
                    >
                      <TableCell>
                        <div className="font-medium text-sm">
                          {u.name || "—"}
                        </div>
                        {u.organizationName && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {u.organizationName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {u.email && (
                          <div className="flex items-center gap-1 text-muted-foreground truncate max-w-[200px]">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{u.email}</span>
                          </div>
                        )}
                        {u.whatsAppNumber && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            {u.whatsAppNumber}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[280px]">
                          {u.roles.map((r) => (
                            <RoleBadge key={r} role={r} />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="space-y-0.5">
                          {u.eventsCreated > 0 && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-blue-500" />
                              {u.eventsCreated} events
                            </div>
                          )}
                          {u.ticketsPurchased > 0 && (
                            <div className="flex items-center gap-1">
                              <Ticket className="h-3 w-3 text-pink-500" />
                              {u.ticketsPurchased} tickets
                              {u.ticketRevenue > 0 && (
                                <span className="text-muted-foreground">
                                  (${u.ticketRevenue.toFixed(0)})
                                </span>
                              )}
                            </div>
                          )}
                          {u.stallsRegistered > 0 && (
                            <div className="flex items-center gap-1">
                              <Store className="h-3 w-3 text-orange-500" />
                              {u.stallsRegistered} stalls
                            </div>
                          )}
                          {u.speakerRequests > 0 && (
                            <div className="flex items-center gap-1">
                              <Mic2 className="h-3 w-3 text-purple-500" />
                              {u.speakerRequests} speaker
                            </div>
                          )}
                          {u.referredOrganizers > 0 && (
                            <div className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3 text-emerald-500" />
                              {u.referredOrganizers} referrals
                            </div>
                          )}
                          {!u.eventsCreated &&
                            !u.ticketsPurchased &&
                            !u.stallsRegistered &&
                            !u.speakerRequests &&
                            !u.referredOrganizers && (
                              <span className="text-muted-foreground">—</span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {u.firstSeen
                          ? new Date(u.firstSeen).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {u.lastSeen
                          ? new Date(u.lastSeen).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelected(u)}
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
              {selected?.name || "User"}
              {selected?.approvedOrganizer && (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
            </DialogTitle>
            <DialogDescription>
              Full activity across the platform
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              {/* Identity */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Email", value: selected.email },
                  { label: "Phone", value: selected.phone },
                  { label: "WhatsApp", value: selected.whatsAppNumber },
                  { label: "Country", value: selected.country },
                  {
                    label: "Organization",
                    value: selected.organizationName,
                  },
                  {
                    label: "Referral Code",
                    value: selected.referralCode,
                  },
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

              {/* Roles */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Roles</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.roles.map((r) => (
                    <RoleBadge key={r} role={r} />
                  ))}
                </div>
              </div>

              {/* Activity grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  {
                    label: "Events Created",
                    value: selected.eventsCreated,
                    icon: Calendar,
                    color: "text-blue-600",
                  },
                  {
                    label: "Tickets Bought",
                    value: selected.ticketsPurchased,
                    icon: Ticket,
                    color: "text-pink-600",
                  },
                  {
                    label: "Spent on Tickets",
                    value: `$${selected.ticketRevenue.toFixed(2)}`,
                    icon: Ticket,
                    color: "text-emerald-600",
                  },
                  {
                    label: "Stalls Registered",
                    value: selected.stallsRegistered,
                    icon: Store,
                    color: "text-orange-600",
                  },
                  {
                    label: "Speaker Requests",
                    value: selected.speakerRequests,
                    icon: Mic2,
                    color: "text-purple-600",
                  },
                  {
                    label: "Organizers Referred",
                    value: selected.referredOrganizers,
                    icon: Briefcase,
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

              {/* Subscription */}
              {selected.roles.includes("Organizer") && (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <p className="text-xs font-medium mb-1">
                    Organizer Subscription
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {selected.subscribed ? "Active" : "Inactive"}
                      {selected.planExpiryDate &&
                        ` · expires ${new Date(selected.planExpiryDate).toLocaleDateString()}`}
                    </span>
                    <Badge
                      variant={
                        selected.approvedOrganizer ? "default" : "secondary"
                      }
                    >
                      {selected.approvedOrganizer ? "Approved" : "Pending"}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Sources */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Source records ({selected.sources.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.sources.map((s, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[11px] font-mono"
                    >
                      {s.type}:{s.id.slice(-6)}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground border-t pt-3">
                <div>
                  First seen:{" "}
                  {selected.firstSeen
                    ? new Date(selected.firstSeen).toLocaleString()
                    : "—"}
                </div>
                <div>
                  Last active:{" "}
                  {selected.lastSeen
                    ? new Date(selected.lastSeen).toLocaleString()
                    : "—"}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
