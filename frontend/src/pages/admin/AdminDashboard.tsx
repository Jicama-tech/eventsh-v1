import { useState, useEffect, lazy, Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Briefcase,
  Building2,
  Ticket,
  DollarSign,
  Package,
  ShieldCheck,
  ArrowRight,
  Plus,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Settings as SettingsIcon,
} from "lucide-react";
import { useFetchWithLoading } from "@/hooks/useFetchWithLoading";
import { useToast } from "@/hooks/use-toast";

// Lazy-load tab pages — same pattern as OrganizerDashboard
const OrganizersPage = lazy(() =>
  import("./OrganizersPage").then((m) => ({ default: m.OrganizersPage })),
);
const AgentsPage = lazy(() =>
  import("./AgentsPage").then((m) => ({ default: m.AgentsPage })),
);
const UsersPage = lazy(() =>
  import("./UsersPage").then((m) => ({ default: m.UsersPage })),
);
const PricingPage = lazy(() =>
  import("./PricingPage").then((m) => ({ default: m.PricingPage })),
);
const SettingsPage = lazy(() =>
  import("./SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

interface Stats {
  totalUsers: number;
  totalEvents: number;
  thisMonthEvents: number;
  totalOrganizers: number;
  activeOrganizers: number;
  thisMonthOrganizers: number;
  pendingApprovals: number;
  totalAgents: number;
  activeAgents: number;
  totalPlans: number;
  activePlans: number;
  totalTickets: number;
  totalRevenue: number;
  activeSubscriptions: number;
}

const initialStats: Stats = {
  totalUsers: 0,
  totalEvents: 0,
  thisMonthEvents: 0,
  totalOrganizers: 0,
  activeOrganizers: 0,
  thisMonthOrganizers: 0,
  pendingApprovals: 0,
  totalAgents: 0,
  activeAgents: 0,
  totalPlans: 0,
  activePlans: 0,
  totalTickets: 0,
  totalRevenue: 0,
  activeSubscriptions: 0,
};

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

interface AdminDashboardProps {
  onLogout?: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const apiURL = __API_URL__;
  const { toast } = useToast();
  const { fetchWithLoading } = useFetchWithLoading();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [stats, setStats] = useState<Stats>(initialStats);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<any | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem("token");
      if (!token) throw new Error("Auth token not found");

      const response = await fetchWithLoading(
        `${apiURL}/admin/dashboard-stats`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok)
        throw new Error(`Failed to fetch: ${response.statusText}`);

      const resData = await response.json();
      if (resData.stats) setStats({ ...initialStats, ...resData.stats });

      if (resData.pendingApprovals) {
        const { organizers = [] } = resData.pendingApprovals;
        setPendingApprovals(
          organizers.map((o: any) => ({
            ...o,
            id: o._id,
            type: "Organizer",
            appliedDate: o.createdAt
              ? new Date(o.createdAt).toLocaleDateString()
              : "N/A",
          })),
        );
      }

      if (resData.recentActivity) {
        setRecentActivity(
          resData.recentActivity.map((act: any) => ({
            ...act,
            timeFormatted: act.time
              ? new Date(act.time).toLocaleString()
              : "—",
          })),
        );
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const handleReviewClick = (applicant: any) => {
    setSelectedApplicant(applicant);
    setReviewDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedApplicant) return;
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetchWithLoading(
        `${apiURL}/admin/approve/${selectedApplicant.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: selectedApplicant.type }),
        },
      );
      if (!response.ok) throw new Error("Failed to approve");
      toast({ title: "Approved" });
      setReviewDialogOpen(false);
      await fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!selectedApplicant) return;
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetchWithLoading(
        `${apiURL}/admin/reject/${selectedApplicant.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: selectedApplicant.type }),
        },
      );
      if (!response.ok) throw new Error("Failed to reject");
      toast({ title: "Rejected" });
      setReviewDialogOpen(false);
      await fetchDashboardData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateAdmin = async () => {
    if (
      !newAdmin.name ||
      !newAdmin.email ||
      !newAdmin.password ||
      !newAdmin.confirmPassword
    ) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    if (newAdmin.password !== newAdmin.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetchWithLoading(`${apiURL}/admin/create-admin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newAdmin.name,
          email: newAdmin.email,
          password: newAdmin.password,
        }),
      });
      if (!res.ok) throw new Error("Failed to create admin");
      toast({ title: "Admin created", description: newAdmin.email });
      setCreateDialogOpen(false);
      setNewAdmin({ name: "", email: "", password: "", confirmPassword: "" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const logout =
    onLogout ||
    (() => {
      sessionStorage.removeItem("token");
      window.location.href = "/admin-login";
    });

  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "organizers", label: "Organizers", icon: Building2 },
    { id: "agents", label: "Agents", icon: Briefcase },
    { id: "users", label: "Users", icon: Users },
    { id: "pricing", label: "Plans & Pricing", icon: Package },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  const STAT_CARDS = [
    {
      title: "Total Organizers",
      value: stats.totalOrganizers,
      icon: Building2,
      color: "text-indigo-600",
      iconColor: "text-indigo-500",
      bg: "bg-indigo-50",
      note: `${stats.thisMonthOrganizers} this month`,
    },
    {
      title: "Active Organizers",
      value: stats.activeOrganizers,
      icon: TrendingUp,
      color: "text-green-600",
      iconColor: "text-green-500",
      bg: "bg-green-50",
      note: "Approved & live",
    },
    {
      title: "Total Events",
      value: stats.totalEvents,
      icon: Calendar,
      color: "text-blue-600",
      iconColor: "text-blue-500",
      bg: "bg-blue-50",
      note: `${stats.thisMonthEvents} this month`,
    },
    {
      title: "Total Tickets",
      value: stats.totalTickets,
      icon: Ticket,
      color: "text-purple-600",
      iconColor: "text-purple-500",
      bg: "bg-purple-50",
      note: "Tickets sold",
    },
    {
      title: "Total Revenue",
      value: `$${stats.totalRevenue?.toLocaleString?.(undefined, { maximumFractionDigits: 2 }) ?? stats.totalRevenue}`,
      icon: DollarSign,
      color: "text-emerald-600",
      iconColor: "text-emerald-500",
      bg: "bg-emerald-50",
      note: "Confirmed payments",
    },
    {
      title: "Active Subscriptions",
      value: stats.activeSubscriptions,
      icon: Package,
      color: "text-rose-600",
      iconColor: "text-rose-500",
      bg: "bg-rose-50",
      note: `${stats.activePlans} active plans`,
    },
    {
      title: "Sales Agents",
      value: stats.totalAgents,
      icon: Briefcase,
      color: "text-cyan-600",
      iconColor: "text-cyan-500",
      bg: "bg-cyan-50",
      note: `${stats.activeAgents} active`,
    },
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-amber-600",
      iconColor: "text-amber-500",
      bg: "bg-amber-50",
      note: "Registered customers",
    },
  ];

  const QUICK_ACTIONS = [
    {
      title: "View Organizers",
      description: "All organizers, plans, events and revenue",
      icon: Building2,
      onClick: () => handleTabChange("organizers"),
      color: "bg-indigo-500",
    },
    {
      title: "Manage Plans",
      description: "Create plans, set default for new organizers",
      icon: Package,
      onClick: () => handleTabChange("pricing"),
      color: "bg-rose-500",
    },
    {
      title: "Manage Agents",
      description: "Add sales agents and view referral analytics",
      icon: Briefcase,
      onClick: () => handleTabChange("agents"),
      color: "bg-cyan-500",
    },
    {
      title: "All Users",
      description: "Unified view across roles",
      icon: Users,
      onClick: () => handleTabChange("users"),
      color: "bg-amber-500",
    },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header — same shape as OrganizerDashboard */}
      <header className="border-b bg-card sticky top-0 z-50 flex-shrink-0">
        <div className="flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center space-x-2">
            {/* Mobile menu button */}
            <Button
              variant="buttonOutline"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>

            <ShieldCheck className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-lg sm:text-xl font-bold hidden sm:block">
              EventSh Admin
            </h1>
            <h1 className="text-base font-bold sm:hidden truncate max-w-[150px]">
              EventSh Admin
            </h1>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm hidden sm:flex items-center gap-1"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create Admin
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="sm:hidden"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="buttonOutline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main container with fixed sidebar + scrollable content */}
      <div className="flex flex-1 overflow-hidden z-40">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static lg:translate-x-0
            w-64 border-r bg-card/95 backdrop-blur-sm lg:bg-muted/30
            h-full z-50 transition-all duration-300 ease-in-out
            flex-shrink-0
            ${
              sidebarOpen
                ? "translate-x-0"
                : "-translate-x-full lg:translate-x-0"
            }
          `}
        >
          <div className="h-full flex flex-col">
            <nav className="p-3 sm:p-4 space-y-1 sm:space-y-2 flex-1 overflow-y-auto">
              {navigationItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "buttonOutline"}
                  className="w-full justify-start text-sm"
                  onClick={() => handleTabChange(item.id)}
                >
                  <item.icon className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-4 lg:p-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              {/* Dashboard Tab */}
              <TabsContent value="dashboard" className="mt-0">
                {loading ? (
                  <TabLoader />
                ) : error ? (
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="py-6 text-red-700">
                      <p className="font-semibold">Failed to load dashboard</p>
                      <p className="text-sm mt-1">{error}</p>
                      <Button
                        size="sm"
                        className="mt-4"
                        onClick={fetchDashboardData}
                      >
                        Retry
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold">
                        Dashboard
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Platform overview at a glance
                      </p>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                      {STAT_CARDS.map((stat, i) => (
                        <Card
                          key={i}
                          className="hover:shadow-md transition-shadow border-slate-100"
                        >
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs sm:text-sm font-medium text-slate-700 truncate">
                              {stat.title}
                            </CardTitle>
                            <div
                              className={`${stat.bg} p-2 rounded-lg flex items-center justify-center shrink-0`}
                            >
                              <stat.icon
                                className={`h-4 w-4 ${stat.iconColor}`}
                              />
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div
                              className={`text-xl sm:text-2xl font-bold ${stat.color}`}
                            >
                              {stat.value}
                            </div>
                            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                              {stat.note}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Quick Actions */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base sm:text-lg">
                          Quick Actions
                        </CardTitle>
                        <CardDescription>
                          Jump straight into the most common admin tasks
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {QUICK_ACTIONS.map((action, i) => (
                          <button
                            key={i}
                            onClick={action.onClick}
                            className="text-left p-4 border rounded-xl hover:border-primary hover:shadow-sm transition-all group bg-white"
                          >
                            <div className="flex items-start justify-between">
                              <div
                                className={`${action.color} w-10 h-10 rounded-lg flex items-center justify-center text-white`}
                              >
                                <action.icon className="h-5 w-5" />
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <p className="font-semibold text-sm mt-3">
                              {action.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {action.description}
                            </p>
                          </button>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Pending + Activity */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      {/* Pending Approvals */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <AlertCircle className="h-5 w-5 text-orange-500" />
                            Pending Approvals
                            {stats.pendingApprovals > 0 && (
                              <Badge
                                variant="destructive"
                                className="text-xs ml-1"
                              >
                                {stats.pendingApprovals}
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            Organizers awaiting manual review
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {pendingApprovals.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-400" />
                              <p className="text-sm font-medium">
                                All caught up!
                              </p>
                              <p className="text-xs mt-1">
                                Auto-approval is on — registrations now skip
                                this queue.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                              {pendingApprovals.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/40 transition-colors"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm truncate">
                                      {item.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {item.organizationName || item.type} •{" "}
                                      {item.email}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      Applied: {item.appliedDate}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="ml-2 text-xs shrink-0"
                                    onClick={() => handleReviewClick(item)}
                                  >
                                    Review
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Recent Activity */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Clock className="h-5 w-5 text-blue-500" />
                            Recent Activity
                          </CardTitle>
                          <CardDescription>
                            Last 7 days across the platform
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {recentActivity.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <Clock className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                              <p className="text-sm">No recent activity</p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                              {recentActivity.map((act, i) => {
                                const statusStyle =
                                  act.status === "pending"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : act.status === "approved" ||
                                        act.status === "active" ||
                                        act.status === "live"
                                      ? "bg-green-100 text-green-700"
                                      : act.status === "rejected"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-blue-100 text-blue-700";

                                const Icon =
                                  act.type === "organizer"
                                    ? Building2
                                    : act.type === "event"
                                      ? Calendar
                                      : act.type === "ticket"
                                        ? Ticket
                                        : act.type === "agent"
                                          ? Briefcase
                                          : act.type === "admin"
                                            ? ShieldCheck
                                            : Users;

                                return (
                                  <div
                                    key={`${act.id}-${i}`}
                                    className="flex items-center gap-3 p-2.5 border rounded-lg hover:bg-muted/40 transition-colors"
                                  >
                                    <div
                                      className={`p-2 rounded-lg shrink-0 ${statusStyle}`}
                                    >
                                      <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {act.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {act.action}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {act.timeFormatted}
                                      </p>
                                    </div>
                                    <Badge
                                      variant={
                                        act.status === "pending"
                                          ? "secondary"
                                          : act.status === "rejected"
                                            ? "destructive"
                                            : "default"
                                      }
                                      className="text-xs shrink-0 capitalize"
                                    >
                                      {act.status}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="organizers" className="mt-0">
                <Suspense fallback={<TabLoader />}>
                  <OrganizersPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="agents" className="mt-0">
                <Suspense fallback={<TabLoader />}>
                  <AgentsPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="users" className="mt-0">
                <Suspense fallback={<TabLoader />}>
                  <UsersPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="pricing" className="mt-0">
                <Suspense fallback={<TabLoader />}>
                  <PricingPage />
                </Suspense>
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <Suspense fallback={<TabLoader />}>
                  <SettingsPage />
                </Suspense>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Applicant</DialogTitle>
            <DialogDescription>
              Approve or reject this organizer application.
            </DialogDescription>
          </DialogHeader>
          {selectedApplicant && (
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Name", value: selectedApplicant.name },
                  {
                    label: "Organization",
                    value: selectedApplicant.organizationName,
                  },
                  { label: "Email", value: selectedApplicant.email },
                  {
                    label: "Business Email",
                    value: selectedApplicant.businessEmail,
                  },
                  { label: "Phone", value: selectedApplicant.phone },
                  {
                    label: "WhatsApp",
                    value: selectedApplicant.whatsAppNumber,
                  },
                  { label: "Country", value: selectedApplicant.country },
                  { label: "Address", value: selectedApplicant.address },
                  { label: "Applied", value: selectedApplicant.appliedDate },
                  {
                    label: "Provider",
                    value:
                      selectedApplicant.provider === "Agent"
                        ? `Agent referral`
                        : selectedApplicant.provider,
                  },
                ].map((field, i) =>
                  field.value ? (
                    <div key={i} className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        {field.label}
                      </p>
                      <p className="text-sm font-medium">{field.value}</p>
                    </div>
                  ) : null,
                )}
              </div>
              {selectedApplicant.bio && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">About</p>
                  <p className="text-sm">{selectedApplicant.bio}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Admin Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Admin</DialogTitle>
            <DialogDescription>
              Add a new administrator account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={newAdmin.name}
                onChange={(e) =>
                  setNewAdmin({ ...newAdmin, name: e.target.value })
                }
                placeholder="Admin name"
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={newAdmin.email}
                onChange={(e) =>
                  setNewAdmin({ ...newAdmin, email: e.target.value })
                }
                placeholder="admin@email.com"
              />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newAdmin.password}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, password: e.target.value })
                  }
                  placeholder="Password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={newAdmin.confirmPassword}
                  onChange={(e) =>
                    setNewAdmin({
                      ...newAdmin,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="Confirm password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateAdmin}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
