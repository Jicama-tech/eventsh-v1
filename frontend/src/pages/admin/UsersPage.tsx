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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  UserCheck,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit,
  Ban,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Calendar as CalendarIcon,
  Heart,
  Activity,
  Settings,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Download,
  UserPlus,
  Clock,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  created_at: string;
  last_login?: string;
  profile_image_url?: string;
  gender?: string;
  address?: string;
  date_of_birth?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  blood_type?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  current_medications?: string[];
}

interface Organizer {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  qualification: string;
  bio?: string;
  status: string;
  created_at: string;
  total_events?: number;
  profile_image_url?: string;
}

interface Analytics {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  totalOrganizers: number;
  userGrowthRate: number;
  roleDistribution: { role: string; count: number; percentage: number }[];
  statusDistribution: { status: string; count: number; percentage: number }[];
  monthlyGrowth: {
    month: string;
    users: number;
    organizers: number;
  }[];
  topLocations: { location: string; count: number }[];
  ageDistribution: { ageGroup: string; count: number }[];
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [filteredOrganizers, setFilteredOrganizers] = useState<Organizer[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  useEffect(() => {
    fetchAllUsers();
  }, []);

  useEffect(() => {
    filterUsers();
    calculateAnalytics();
  }, [users, organizers, searchTerm, statusFilter, roleFilter]);

  const fetchAllUsers = async () => {
    try {
      setLoading(true);

      // Fetch regular users from profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch organizers
      const { data: organizersData, error: organizersError } = await supabase
        .from("doctors")
        .select("*")
        .order("created_at", { ascending: false });

      if (organizersError) throw organizersError;

      setUsers(profilesData || []);
      setOrganizers(organizersData || []);

      toast({
        duration: 5000,
        title: "Success",
        description: "User data synced successfully",
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to sync user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = () => {
    const allUsers = [...users, ...organizers];
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter((u) => u.status === "active").length;

    // Calculate monthly growth
    const currentMonth = new Date().getMonth();
    const newUsersThisMonth = allUsers.filter(
      (u) => new Date(u.created_at).getMonth() === currentMonth
    ).length;

    const lastMonthUsers = allUsers.filter(
      (u) => new Date(u.created_at).getMonth() === currentMonth - 1
    ).length;

    const userGrowthRate =
      lastMonthUsers > 0
        ? ((newUsersThisMonth - lastMonthUsers) / lastMonthUsers) * 100
        : 0;

    // Role distribution
    const roleCounts = allUsers.reduce((acc, user) => {
      const role = "role" in user ? user.role : "organizer";
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const roleDistribution = Object.entries(roleCounts).map(
      ([role, count]) => ({
        role,
        count,
        percentage: (count / totalUsers) * 100,
      })
    );

    // Status distribution
    const statusCounts = allUsers.reduce((acc, user) => {
      acc[user.status] = (acc[user.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusDistribution = Object.entries(statusCounts).map(
      ([status, count]) => ({
        status,
        count,
        percentage: (count / totalUsers) * 100,
      })
    );

    // Top locations (from user addresses)
    const locationCounts = users
      .filter((user) => user.address)
      .reduce((acc, user) => {
        const location = user.address?.split(",").pop()?.trim() || "Unknown";
        acc[location] = (acc[location] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const topLocations = Object.entries(locationCounts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Age distribution
    const currentYear = new Date().getFullYear();
    const ageGroups = users
      .filter((user) => user.date_of_birth)
      .map((user) => {
        const age = currentYear - new Date(user.date_of_birth!).getFullYear();
        if (age < 18) return "< 18";
        if (age < 30) return "18-29";
        if (age < 50) return "30-49";
        if (age < 65) return "50-64";
        return "65+";
      })
      .reduce((acc, ageGroup) => {
        acc[ageGroup] = (acc[ageGroup] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const ageDistribution = Object.entries(ageGroups).map(
      ([ageGroup, count]) => ({
        ageGroup,
        count,
      })
    );

    // Monthly growth data (last 6 months)
    const monthlyGrowth = Array.from({ length: 6 }, (_, i) => {
      const month = new Date();
      month.setMonth(month.getMonth() - i);
      const monthName = month.toLocaleDateString("en-US", { month: "short" });

      const monthUsers = users.filter(
        (u) =>
          new Date(u.created_at).getMonth() === month.getMonth() &&
          new Date(u.created_at).getFullYear() === month.getFullYear()
      ).length;

      const monthOrganizers = organizers.filter(
        (u) =>
          new Date(u.created_at).getMonth() === month.getMonth() &&
          new Date(u.created_at).getFullYear() === month.getFullYear()
      ).length;

      return {
        month: monthName,
        users: monthUsers,
        organizers: monthOrganizers,
      };
    }).reverse();

    setAnalytics({
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      totalOrganizers: organizers.length,
      userGrowthRate,
      roleDistribution,
      statusDistribution,
      monthlyGrowth,
      topLocations,
      ageDistribution,
    });
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((user) => user.status === statusFilter);
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(filtered);

    // Filter organizers
    let filteredOrgs = organizers;
    if (searchTerm) {
      filteredOrgs = filteredOrgs.filter(
        (org) =>
          org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          org.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      filteredOrgs = filteredOrgs.filter((org) => org.status === statusFilter);
    }
    setFilteredOrganizers(filteredOrgs);

  };

  const updateUserStatus = async (
    userId: string,
    newStatus: string,
    userType: "user" | "organizer"
  ) => {
    try {
      const table = userType === "organizer" ? "doctors" : "profiles";

      const { error } = await supabase
        .from(table)
        .update({ status: newStatus })
        .eq("id", userId);

      if (error) throw error;

      toast({
        duration: 5000,
        title: "Success",
        description: `User status updated to ${newStatus}`,
      });

      fetchAllUsers();
    } catch (error) {
      console.error("Error updating user status:", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  const exportUserData = () => {
    const allUserData = [
      ...users.map((u) => ({ ...u, type: "user" })),
      ...organizers.map((u) => ({ ...u, type: "organizer" })),
    ];

    const csvContent = [
      ["Name", "Email", "Phone", "Type", "Status", "Joined Date"].join(","),
      ...allUserData.map((user) =>
        [
          ("full_name" in user ? user.full_name : user.name) || "",
          user.email,
          user.phone || "",
          user.type,
          user.status,
          new Date(user.created_at).toLocaleDateString(),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      duration: 5000,
      title: "Success",
      description: "User data exported successfully",
    });
  };

  const UserDetailDialog = ({ user }: { user: User }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="buttonOutline">
          <Eye className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            Complete information for {user.full_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Basic Information</h4>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Name:</strong> {user.full_name}
                </p>
                <p>
                  <strong>Email:</strong> {user.email}
                </p>
                <p>
                  <strong>Phone:</strong> {user.phone || "Not provided"}
                </p>
                <p>
                  <strong>Role:</strong> <Badge>{user.role}</Badge>
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  <Badge
                    variant={user.status === "active" ? "default" : "secondary"}
                  >
                    {user.status}
                  </Badge>
                </p>
                <p>
                  <strong>Gender:</strong> {user.gender || "Not specified"}
                </p>
                <p>
                  <strong>Date of Birth:</strong>{" "}
                  {user.date_of_birth || "Not provided"}
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Contact & Address</h4>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Address:</strong> {user.address || "Not provided"}
                </p>
                <p>
                  <strong>Emergency Contact:</strong>{" "}
                  {user.emergency_contact_name || "Not provided"}
                </p>
                <p>
                  <strong>Emergency Phone:</strong>{" "}
                  {user.emergency_contact_phone || "Not provided"}
                </p>
                <p>
                  <strong>Joined:</strong>{" "}
                  {new Date(user.created_at).toLocaleDateString()}
                </p>
                <p>
                  <strong>Last Login:</strong>{" "}
                  {user.last_login
                    ? new Date(user.last_login).toLocaleDateString()
                    : "Never"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Medical Information</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p>
                  <strong>Blood Type:</strong>{" "}
                  {user.blood_type || "Not provided"}
                </p>
              </div>
              <div>
                <p>
                  <strong>Allergies:</strong>
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {user.allergies?.map((allergy, index) => (
                    <Badge
                      key={index}
                      variant="buttonOutline"
                      className="text-xs"
                    >
                      {allergy}
                    </Badge>
                  )) || (
                    <span className="text-muted-foreground">None listed</span>
                  )}
                </div>
              </div>
              <div>
                <p>
                  <strong>Chronic Conditions:</strong>
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {user.chronic_conditions?.map((condition, index) => (
                    <Badge
                      key={index}
                      variant="buttonOutline"
                      className="text-xs"
                    >
                      {condition}
                    </Badge>
                  )) || (
                    <span className="text-muted-foreground">None listed</span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-2">
              <p>
                <strong>Current Medications:</strong>
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {user.current_medications?.map((medication, index) => (
                  <Badge
                    key={index}
                    variant="buttonOutline"
                    className="text-xs"
                  >
                    {medication}
                  </Badge>
                )) || (
                  <span className="text-muted-foreground">None listed</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Users Management</h1>
          <p className="text-muted-foreground">
            Comprehensive user analytics and management
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportUserData} variant="buttonOutline">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button onClick={fetchAllUsers} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Sync Users
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview & Analytics</TabsTrigger>
          <TabsTrigger value="users">
            Users ({filteredUsers.length})
          </TabsTrigger>
          <TabsTrigger value="organizers">
            Organizers ({filteredOrganizers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {analytics && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Total Users
                        </p>
                        <p className="text-2xl font-bold">
                          {analytics.totalUsers}
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Active Users
                        </p>
                        <p className="text-2xl font-bold">
                          {analytics.activeUsers}
                        </p>
                      </div>
                      <Activity className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Organizers
                        </p>
                        <p className="text-2xl font-bold">
                          {analytics.totalOrganizers}
                        </p>
                      </div>
                      <UserCheck className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Growth Rate
                        </p>
                        <p className="text-2xl font-bold flex items-center">
                          {analytics.userGrowthRate.toFixed(1)}%
                          {analytics.userGrowthRate > 0 ? (
                            <TrendingUp className="h-4 w-4 ml-1 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 ml-1 text-red-600" />
                          )}
                        </p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Analytics Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Role Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      User Role Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.roleDistribution.map((item) => (
                        <div
                          key={item.role}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-primary"></div>
                            <span className="capitalize">{item.role}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{item.count}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.percentage.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Status Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      User Status Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.statusDistribution.map((item) => (
                        <div
                          key={item.status}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                item.status === "active"
                                  ? "bg-green-500"
                                  : item.status === "pending"
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                            ></div>
                            <span className="capitalize">{item.status}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{item.count}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.percentage.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Locations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Top User Locations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.topLocations.map((item, index) => (
                        <div
                          key={item.location}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              #{index + 1}
                            </span>
                            <span>{item.location}</span>
                          </div>
                          <div className="font-medium">{item.count} users</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Age Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Age Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.ageDistribution.map((item) => (
                        <div
                          key={item.ageGroup}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span>{item.ageGroup} years</span>
                          </div>
                          <div className="font-medium">{item.count} users</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Growth Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Monthly User Growth (Last 6 Months)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end space-x-4 h-64">
                    {analytics.monthlyGrowth.map((month, index) => (
                      <div
                        key={index}
                        className="flex-1 flex flex-col items-center"
                      >
                        <div className="flex space-x-1 mb-2">
                          <div
                            className="w-4 bg-blue-500 rounded-t"
                            style={{ height: `${(month.users / 20) * 100}px` }}
                          ></div>
                          <div
                            className="w-4 bg-green-500 rounded-t"
                            style={{
                              height: `${(month.organizers / 5) * 100}px`,
                            }}
                          ></div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {month.month}
                        </div>
                        <div className="text-xs font-medium">
                          {month.users + month.organizers}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-center space-x-4 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                      <span className="text-sm">Users</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded"></div>
                      <span className="text-sm">Organizers</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Filters (shared across user tabs) */}
        {(activeTab === "users" ||
          activeTab === "organizers") && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="patient">Patient</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Regular Users</CardTitle>
              <CardDescription>
                Direct registrations and patient accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {user.phone}
                            </div>
                          )}
                          {user.address && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {user.address}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="buttonOutline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.status === "active"
                              ? "default"
                              : user.status === "pending"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <UserDetailDialog user={user} />
                          <Button size="sm" variant="buttonOutline">
                            <Edit className="h-3 w-3" />
                          </Button>
                          {user.status === "pending" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() =>
                                updateUserStatus(user.id, "active", "user")
                              }
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          )}
                          {user.status === "active" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                updateUserStatus(user.id, "suspended", "user")
                              }
                            >
                              <Ban className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organizers">
          <Card>
            <CardHeader>
              <CardTitle>Organizers</CardTitle>
              <CardDescription>Event organizers and doctors</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organizer</TableHead>
                    <TableHead>Qualification</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrganizers.map((organizer) => (
                    <TableRow key={organizer.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{organizer.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {organizer.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="buttonOutline">
                          {organizer.qualification}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {organizer.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {organizer.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            organizer.status === "active"
                              ? "default"
                              : organizer.status === "pending"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {organizer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(organizer.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="buttonOutline">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="buttonOutline">
                            <Edit className="h-3 w-3" />
                          </Button>
                          {organizer.status === "pending" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() =>
                                updateUserStatus(
                                  organizer.id,
                                  "active",
                                  "organizer"
                                )
                              }
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
