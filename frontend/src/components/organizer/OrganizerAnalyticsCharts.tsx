import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TrendingUp, Calendar, Ticket, DollarSign } from "lucide-react";

const apiURL = __API_URL__;

interface AnalyticsData {
  window: { from: string; to: string; days: number };
  totals: { events: number; tickets: number; revenue: number };
  revenueTrend: { date: string; tickets: number; revenue: number }[];
  topEvents: {
    eventId: string;
    eventTitle: string;
    tickets: number;
    revenue: number;
  }[];
  statusBreakdown: { status: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#10b981",
  CANCELLED: "#ef4444",
  cancelled: "#ef4444",
  completed: "#6366f1",
  PENDING: "#f59e0b",
  CONFIRMED: "#10b981",
  COMPLETED: "#6366f1",
  unknown: "#94a3b8",
};

function formatDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function OrganizerAnalyticsCharts() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = sessionStorage.getItem("token");
        if (!token) return;
        const decoded: any = jwtDecode(token);
        const id = decoded.sub;
        const res = await fetch(`${apiURL}/organizers/analytics/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
          Loading analytics…
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hasData = data.totals.tickets > 0 || data.revenueTrend.some((d) => d.revenue > 0);

  const trendData = data.revenueTrend.map((d) => ({
    ...d,
    label: formatDate(d.date),
  }));

  return (
    <div className="space-y-4">
      {/* Mini summary header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Events",
            value: data.totals.events,
            icon: Calendar,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Tickets Sold",
            value: data.totals.tickets,
            icon: Ticket,
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            label: "Revenue",
            value: `$${data.totals.revenue.toLocaleString()}`,
            icon: DollarSign,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "Last 30 days",
            value: data.revenueTrend.reduce((s, d) => s + d.tickets, 0),
            icon: TrendingUp,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
            note: "tickets",
          },
        ].map((s, i) => (
          <Card key={i} className="border-slate-100">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground truncate">
                  {s.label}
                </p>
                <div className={`${s.bg} p-1.5 rounded-md shrink-0`}>
                  <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                </div>
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              {s.note && (
                <p className="text-[10px] text-muted-foreground">{s.note}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <TrendingUp className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No tickets sold yet — charts will appear once you start receiving orders.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue trend (area chart) */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Revenue & Tickets — Last 30 days
              </CardTitle>
              <CardDescription>
                Daily ticket revenue (confirmed payments only) and tickets sold
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient
                      id="revenueGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#10b981"
                        stopOpacity={0.45}
                      />
                      <stop
                        offset="100%"
                        stopColor="#10b981"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="ticketsGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#6366f1"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="#6366f1"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: any, name: string) =>
                      name === "Revenue" ? `$${v}` : v
                    }
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    fill="url(#revenueGrad)"
                    name="Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="tickets"
                    stroke="#6366f1"
                    fill="url(#ticketsGrad)"
                    name="Tickets"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Top Events by Revenue
              </CardTitle>
              <CardDescription>Top 5 events all-time</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No events with sales yet
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data.topEvents.map((e) => ({
                      name:
                        e.eventTitle.length > 16
                          ? e.eventTitle.slice(0, 14) + "…"
                          : e.eventTitle,
                      revenue: e.revenue,
                      tickets: e.tickets,
                    }))}
                    layout="vertical"
                    margin={{ left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={110}
                    />
                    <Tooltip formatter={(v: any) => `$${v}`} />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Status breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="h-4 w-4 text-purple-500" />
                Tickets by Status
              </CardTitle>
              <CardDescription>Distribution across all events</CardDescription>
            </CardHeader>
            <CardContent>
              {data.statusBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No ticket data
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.statusBreakdown}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label
                    >
                      {data.statusBreakdown.map((s, i) => (
                        <Cell
                          key={i}
                          fill={STATUS_COLORS[s.status] || "#94a3b8"}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
