import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { jwtDecode } from "jwt-decode";
import {
  Users,
  Target,
  Calendar,
  Copy,
  CheckCircle,
  LogOut,
  Briefcase,
} from "lucide-react";

const apiURL = __API_URL__;

interface AgentDashboardProps {
  onLogout: () => void;
}

export function AgentDashboard({ onLogout }: AgentDashboardProps) {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const { agentId, agentName, referralCode } = useMemo(() => {
    try {
      const token = sessionStorage.getItem("token");
      if (token) {
        const decoded: any = jwtDecode(token);
        return {
          agentId: decoded.sub,
          agentName: decoded.name,
          referralCode: decoded.referralCode,
        };
      }
    } catch {}
    return { agentId: "", agentName: "", referralCode: "" };
  }, []);

  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAnalytics() {
    try {
      const token = sessionStorage.getItem("token");
      if (!token || !agentId) return;
      const res = await fetch(`${apiURL}/agents/${agentId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Referral link copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-lg font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 w-10 h-10 rounded-full flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Agent Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {agentName}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Referral Link */}
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-indigo-900 mb-1">
                  Your Referral Link
                </p>
                <p className="text-xs font-mono text-indigo-700 bg-white rounded-lg px-3 py-2 border border-indigo-200 break-all">
                  {referralLink}
                </p>
              </div>
              <Button
                onClick={handleCopyLink}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
            </div>
            <p className="text-xs text-indigo-600 mt-2">
              Referral Code:{" "}
              <span className="font-bold">{referralCode}</span>
            </p>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Referrals
              </CardTitle>
              <Users className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics?.referredCount || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics?.activeCount || 0} active,{" "}
                {analytics?.pendingCount || 0} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Events
              </CardTitle>
              <Calendar className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics?.totalEvents || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                From referred organizers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Organizers
              </CardTitle>
              <Briefcase className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {analytics?.activeCount || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Approved organizers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Sales Target
              </CardTitle>
              <Target className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {analytics?.salesTargetProgress || 0}%
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(analytics?.salesTargetProgress || 0, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics?.agent?.salesTarget
                  ? `Target: ${analytics.agent.salesTarget.toLocaleString()} referrals`
                  : "No target set"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Referred Organizers Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Referred Organizers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!analytics?.organizers?.length ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No referrals yet</p>
                <p className="text-sm mt-1">
                  Share your referral link to start getting referrals.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">
                        Organization
                      </TableHead>
                      <TableHead className="font-semibold">Email</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Events</TableHead>
                      <TableHead className="font-semibold">
                        Registered
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.organizers.map((o: any) => (
                      <TableRow key={o._id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell>{o.organizationName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {o.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={o.approved ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {o.approved ? "Active" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {o.eventsCount}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(o.registeredAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
