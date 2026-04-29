import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit2,
  Trash2,
  Users,
  Target,
  Briefcase,
  Copy,
  Eye,
} from "lucide-react";

const apiURL = __API_URL__;

interface Agent {
  _id: string;
  name: string;
  whatsAppNumber: string;
  email: string;
  secondaryContact?: string;
  salesTarget: number;
  referralCode: string;
  isActive: boolean;
  createdAt: string;
}

export function AgentsPage() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [performanceAgent, setPerformanceAgent] = useState<any>(null);
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    whatsAppNumber: "",
    email: "",
    secondaryContact: "",
    salesTarget: 0,
    isActive: true,
  });

  const token = sessionStorage.getItem("token");

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    try {
      const res = await fetch(`${apiURL}/agents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingAgent(null);
    setForm({
      name: "",
      whatsAppNumber: "",
      email: "",
      secondaryContact: "",
      salesTarget: 0,
      isActive: true,
    });
    setDialogOpen(true);
  }

  function openEdit(agent: Agent) {
    setEditingAgent(agent);
    setForm({
      name: agent.name,
      whatsAppNumber: agent.whatsAppNumber,
      email: agent.email,
      secondaryContact: agent.secondaryContact || "",
      salesTarget: agent.salesTarget,
      isActive: agent.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.name || !form.whatsAppNumber || !form.email) {
      toast({
        title: "Error",
        description: "Name, WhatsApp, and Email are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const url = editingAgent
        ? `${apiURL}/agents/${editingAgent._id}`
        : `${apiURL}/agents`;
      const method = editingAgent ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save agent");
      }

      toast({ title: editingAgent ? "Agent updated" : "Agent created" });
      setDialogOpen(false);
      fetchAgents();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to deactivate this agent?")) return;
    try {
      const res = await fetch(`${apiURL}/agents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast({ title: "Agent deactivated" });
        fetchAgents();
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  async function viewPerformance(agentId: string) {
    try {
      const res = await fetch(`${apiURL}/agents/${agentId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPerformanceAgent(data);
        setPerformanceOpen(true);
      }
    } catch (err) {
      console.error("Failed to fetch performance:", err);
    }
  }

  function copyReferralLink(code: string) {
    navigator.clipboard.writeText(
      `${window.location.origin}/register?ref=${code}`,
    );
    toast({ title: "Copied!", description: "Referral link copied" });
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p>Loading agents...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sales Agents</h2>
          <p className="text-sm text-muted-foreground">
            Manage your sales team and track performance
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Agent
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Briefcase className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {agents.filter((a) => a.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Targets</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {agents.filter((a) => a.salesTarget > 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agents Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">WhatsApp</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Referral Code</TableHead>
                  <TableHead className="font-semibold">Sales Target</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Joined</TableHead>
                  <TableHead className="font-semibold text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No agents yet. Click "Add Agent" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map((agent) => (
                    <TableRow key={agent._id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {agent.name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {agent.whatsAppNumber}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {agent.email}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className="text-xs font-mono"
                          >
                            {agent.referralCode}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyReferralLink(agent.referralCode)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {agent.salesTarget > 0
                          ? agent.salesTarget.toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={agent.isActive ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {agent.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(agent.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => viewPerformance(agent._id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openEdit(agent)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500"
                            onClick={() => handleDelete(agent._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAgent ? "Edit Agent" : "Add New Agent"}
            </DialogTitle>
            <DialogDescription>
              {editingAgent
                ? "Update agent details"
                : "Add a new sales agent to your team"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Agent name"
              />
            </div>
            <div className="space-y-1">
              <Label>WhatsApp Number *</Label>
              <Input
                value={form.whatsAppNumber}
                onChange={(e) =>
                  setForm({ ...form, whatsAppNumber: e.target.value })
                }
                placeholder="+91XXXXXXXXXX"
              />
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="agent@email.com"
              />
            </div>
            <div className="space-y-1">
              <Label>Secondary Contact (Optional)</Label>
              <Input
                value={form.secondaryContact}
                onChange={(e) =>
                  setForm({ ...form, secondaryContact: e.target.value })
                }
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-1">
              <Label>Sales Target</Label>
              <Input
                type="number"
                value={form.salesTarget}
                onChange={(e) =>
                  setForm({
                    ...form,
                    salesTarget: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="Referral target"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
            </div>
          </div>
          <Button
            className="w-full mt-4"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : editingAgent
                ? "Update Agent"
                : "Create Agent"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Performance Dialog */}
      <Dialog open={performanceOpen} onOpenChange={setPerformanceOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Agent Performance — {performanceAgent?.agent?.name}
            </DialogTitle>
            <DialogDescription>
              Referral code: {performanceAgent?.agent?.referralCode}
            </DialogDescription>
          </DialogHeader>
          {performanceAgent && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="py-3 text-center">
                    <div className="text-2xl font-bold">
                      {performanceAgent.referredCount}
                    </div>
                    <p className="text-xs text-muted-foreground">Referrals</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {performanceAgent.activeCount}
                    </div>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 text-center">
                    <div className="text-2xl font-bold">
                      {performanceAgent.totalEvents}
                    </div>
                    <p className="text-xs text-muted-foreground">Events</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-3 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {performanceAgent.salesTargetProgress}%
                    </div>
                    <p className="text-xs text-muted-foreground">Target</p>
                  </CardContent>
                </Card>
              </div>

              {performanceAgent.agent?.salesTarget > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Sales Target Progress</span>
                    <span className="font-bold">
                      {performanceAgent.salesTargetProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-indigo-600 h-3 rounded-full transition-all"
                      style={{
                        width: `${Math.min(performanceAgent.salesTargetProgress, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Target:{" "}
                    {performanceAgent.agent.salesTarget.toLocaleString()}{" "}
                    referrals
                  </p>
                </div>
              )}

              {performanceAgent.organizers?.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Events</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceAgent.organizers.map((o: any) => (
                      <TableRow key={o._id}>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell>{o.organizationName}</TableCell>
                        <TableCell>
                          <Badge
                            variant={o.approved ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {o.approved ? "Active" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>{o.eventsCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
