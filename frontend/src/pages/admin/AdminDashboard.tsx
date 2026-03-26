import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { useFetchWithLoading } from "@/hooks/useFetchWithLoading";

export function AdminDashboard() {
  const apiURL = __API_URL__;
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEvents: 0,
    activeOrganizers: 0,
    pendingApprovals: 0,
    thisMonthEvents: 0,
  });
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
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

  const { fetchWithLoading } = useFetchWithLoading();

  // Fetch dashboard data from API
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem("token");
      if (!token) throw new Error("Auth token not found");

      const response = await fetchWithLoading(
        `${apiURL}/admin/dashboard-stats`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok)
        throw new Error(`Failed to fetch: ${response.statusText}`);

      const resData = await response.json();

      if (resData.stats) setStats(resData.stats);

      if (resData.pendingApprovals) {
        const { organizers = [] } = resData.pendingApprovals;
        const combinedRequests = [
          ...organizers.map((o: any) => ({
            ...o,
            id: o._id,
            name: o.name,
            type: "Organizer",
            email: o.email,
            appliedDate: o.createdAt
              ? new Date(o.createdAt).toLocaleDateString()
              : "N/A",
          })),
        ];
        setPendingApprovals(combinedRequests);
      }

      if (resData.recentActivity) {
        setRecentActivity(
          resData.recentActivity.map((act: any) => ({
            ...act,
            time:
              typeof act.time === "string"
                ? new Date(act.time).toLocaleString()
                : act.time,
          }))
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
  }, []);

  // Review dialog open
  const handleReviewClick = (applicant: any) => {
    setSelectedApplicant(applicant);
    setReviewDialogOpen(true);
  };

  // Approve
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
        }
      );
      if (!response.ok)
        throw new Error(`Failed to approve: ${response.statusText}`);

      setReviewDialogOpen(false);
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // Reject
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
        }
      );
      if (!response.ok)
        throw new Error(`Failed to reject: ${response.statusText}`);

      setReviewDialogOpen(false);
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // Create new admin
  const handleCreateAdmin = async () => {
    if (
      !newAdmin.name ||
      !newAdmin.email ||
      !newAdmin.password ||
      !newAdmin.confirmPassword
    ) {
      alert("All fields are required");
      return;
    }
    if (newAdmin.password !== newAdmin.confirmPassword) {
      alert("Passwords do not match");
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
      if (!res.ok) throw new Error(`Failed to create admin: ${res.statusText}`);

      alert("Admin created successfully");
      setCreateDialogOpen(false);
      setNewAdmin({ name: "", email: "", password: "", confirmPassword: "" });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-4">Loading admin data...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-6">
      {/* Header & Create Admin Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage your event platform</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          Create New Admin
        </Button>
      </div>

      {/* Dashboard Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Cards */}
            {[
              {
                title: "Total Users",
                value: stats.totalUsers,
                icon: <Users className="h-4 w-4 text-muted-foreground" />,
                note: "+12% from last month",
              },
              {
                title: "Total Events",
                value: stats.totalEvents,
                icon: <Calendar className="h-4 w-4 text-muted-foreground" />,
                note: `+${stats.thisMonthEvents} this month`,
              },
              {
                title: "Active Organizers",
                value: stats.activeOrganizers,
                icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
                note: "+5 this week",
              },
            ].map((stat, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  {stat.icon}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.note}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pending Approvals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Pending Approvals
                  <Badge variant="destructive">{stats.pendingApprovals}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingApprovals.length === 0 && (
                  <p className="text-muted-foreground">No Pending Approvals</p>
                )}
                <div className="space-y-4">
                  {pendingApprovals.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.type} • {item.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Applied: {item.appliedDate}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="buttonOutline"
                        onClick={() => handleReviewClick(item)}
                      >
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" /> Recent Activity
                </CardTitle>
                <CardDescription>Latest actions and updates</CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 && (
                  <p className="text-muted-foreground">No recent activity</p>
                )}
                <div className="space-y-4">
                  {recentActivity.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-center gap-3 p-3 border rounded-lg"
                    >
                      <div
                        className={`p-2 rounded-full ${
                          act.status === "pending"
                            ? "bg-yellow-100 text-yellow-600"
                            : act.status === "approved"
                            ? "bg-green-100 text-green-600"
                            : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        {act.status === "pending" ? (
                          <Clock className="h-4 w-4" />
                        ) : act.status === "approved" ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Users className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{act.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {act.action}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {act.time}
                        </p>
                      </div>
                      <Badge
                        variant={
                          act.status === "pending"
                            ? "secondary"
                            : act.status === "approved"
                            ? "default"
                            : "outline"
                        }
                      >
                        {act.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Admin Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-lg shadow-lg">
          <DialogHeader>
            <DialogTitle>Create New Admin</DialogTitle>
            <DialogDescription>
              Fill details to create a new admin account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label className="mb-3 block">Name</Label>
              <Input
                placeholder="Enter name"
                value={newAdmin.name}
                onChange={(e) =>
                  setNewAdmin({ ...newAdmin, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="mb-3 block">Email</Label>
              <Input
                type="email"
                placeholder="Enter email"
                value={newAdmin.email}
                onChange={(e) =>
                  setNewAdmin({ ...newAdmin, email: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="mb-3 block">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={newAdmin.password}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <Label className="mb-3 block">Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={newAdmin.confirmPassword}
                  onChange={(e) =>
                    setNewAdmin({
                      ...newAdmin,
                      confirmPassword: e.target.value,
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="buttonOutline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateAdmin}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-lg shadow-lg">
          <DialogHeader>
            <DialogTitle>
              Review {selectedApplicant?.name}
            </DialogTitle>
            <DialogDescription>
              Review details before taking action.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Name</p>
              <p className="font-semibold">{selectedApplicant?.name || "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Email</p>
              <p>{selectedApplicant?.email || "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Phone</p>
              <p>{selectedApplicant?.phone || "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Address
              </p>
              <p>{selectedApplicant?.address || "-"}</p>
            </div>
            {selectedApplicant?.description && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Description
                </p>
                <p>{selectedApplicant.description}</p>
              </div>
            )}
            {/* {selectedApplicant?.businessHours && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Business Hours
                </p>
                <div className="text-xs">
                  {Object.entries(selectedApplicant.businessHours).map(
                    ([day, hours]) => (
                      <div key={day} className="flex justify-between">
                        <span className="capitalize">{day}</span>
                        {hours.closed ? (
                          <span>Closed</span>
                        ) : (
                          <span>
                            {hours.open} - {hours.close}
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            )} */}
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Applied Date
              </p>
              <p>
                {selectedApplicant?.createdAt
                  ? new Date(selectedApplicant.createdAt).toLocaleDateString()
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Status
              </p>
              <p>
                {selectedApplicant?.approved
                  ? "Approved"
                  : selectedApplicant?.rejected
                  ? "Rejected"
                  : "Pending"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="buttonOutline"
              onClick={() => setReviewDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Reject
            </Button>
            <Button onClick={handleApprove}>Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
