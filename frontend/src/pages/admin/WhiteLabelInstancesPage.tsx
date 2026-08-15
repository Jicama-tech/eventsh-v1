import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, Plus, RefreshCw, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiURL = __API_URL__;

interface WhiteLabelInstance {
  instanceId: string;
  companyName: string;
  domain: string;
  status: "active" | "inactive";
  lastSyncAt?: string;
  lastSyncStats?: Record<string, number>;
  createdAt: string;
}

export function WhiteLabelInstancesPage() {
  const [instances, setInstances] = useState<WhiteLabelInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  // Shown exactly once, right after registering — the backend never
  // returns the plaintext license key again (only its hash is stored).
  const [newCredentials, setNewCredentials] = useState<{
    instanceId: string;
    licenseKey: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();

  const token = sessionStorage.getItem("token");

  const fetchInstances = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${apiURL}/platform-registry/instances`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
      setInstances(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registerInstance = async () => {
    if (!companyName.trim() || !domain.trim()) {
      toast({
        title: "Company name and domain are required",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`${apiURL}/platform-registry/instances`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyName, domain }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
      const data = await res.json();
      setNewCredentials(data);
      setCompanyName("");
      setDomain("");
      fetchInstances();
    } catch (err: any) {
      toast({ title: "Couldn't register instance", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyValue = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">
            White-Label Instances
          </h2>
          <p className="text-sm text-muted-foreground">
            Registered single-tenant deployments — each with its own
            isolated database, reporting basic usage back here.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchInstances} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setRegisterOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Register Instance
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Instances</CardTitle>
          <CardDescription>
            {instances.length} registered
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading instances…</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-600 text-sm">{error}</div>
          ) : instances.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No white-label instances registered yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Company</TableHead>
                    <TableHead className="font-semibold">Domain</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Last Stats</TableHead>
                    <TableHead className="font-semibold">Last Sync</TableHead>
                    <TableHead className="font-semibold">Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instances.map((inst) => (
                    <TableRow key={inst.instanceId}>
                      <TableCell className="text-sm font-medium">
                        {inst.companyName}
                        <div className="text-xs text-muted-foreground font-mono">
                          {inst.instanceId}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inst.domain}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={inst.status === "active" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {inst.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inst.lastSyncStats && Object.keys(inst.lastSyncStats).length > 0
                          ? Object.entries(inst.lastSyncStats)
                              .map(([k, v]) => `${k.replace("Count", "")}: ${v}`)
                              .join(" · ")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {inst.lastSyncAt
                          ? new Date(inst.lastSyncAt).toLocaleString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(inst.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Register dialog */}
      <Dialog
        open={registerOpen}
        onOpenChange={(open) => {
          setRegisterOpen(open);
          if (!open) setNewCredentials(null);
        }}
      >
        <DialogContent className="max-w-md">
          {newCredentials ? (
            <>
              <DialogHeader>
                <DialogTitle>Instance registered</DialogTitle>
                <DialogDescription>
                  Copy these now — the license key is shown only once and
                  can't be retrieved again. Hand both to the customer's
                  deployment as env vars (see docs/WHITE_LABEL_DEPLOYMENT.md).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                {[
                  { label: "INSTANCE_ID", value: newCredentials.instanceId },
                  { label: "INSTANCE_LICENSE_KEY", value: newCredentials.licenseKey },
                ].map((f) => (
                  <div key={f.label}>
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    <div className="flex gap-2 mt-1">
                      <Input readOnly value={f.value} className="font-mono text-xs" />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyValue(f.label, f.value)}
                      >
                        {copied === f.label ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter className="mt-4">
                <Button
                  onClick={() => {
                    setRegisterOpen(false);
                    setNewCredentials(null);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Register a white-label instance</DialogTitle>
                <DialogDescription>
                  Creates a registry entry ahead of provisioning the actual
                  deployment.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <div>
                  <Label>Company name</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Events Pte Ltd"
                  />
                </div>
                <div>
                  <Label>Domain</Label>
                  <Input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="app.acmeevents.com"
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setRegisterOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={registerInstance} disabled={saving}>
                  {saving ? "Registering…" : "Register"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
