import { useCallback, useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import {
  Award,
  CheckCircle2,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  XCircle,
  CalendarCheck,
  Clock,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";

interface MembershipPlan {
  _id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  durationDays: number;
  perks: string[];
  color: string;
  published: boolean;
  archived: boolean;
}

interface ExhibitorMembership {
  _id: string;
  status:
    | "pending_payment"
    | "pending_verification"
    | "active"
    | "expired"
    | "cancelled";
  exhibitorName?: string;
  exhibitorEmail: string;
  exhibitorWhatsapp?: string;
  startDate?: string;
  endDate?: string;
  amountPaid: number;
  currency: string;
  paymentRef?: string;
  planId: { _id: string; name: string; color?: string } | string;
  createdAt: string;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  price: 0,
  durationDays: 365,
  perks: [] as string[],
  color: "#6366f1",
  published: false,
};

interface MembershipPanelProps {
  // "settings"     — plan-tier CRUD only (used inside Organizer Settings).
  // "verification" — pending verification queue + active members roster
  //                   only (used in the dedicated sidebar Membership tab).
  // "full"         — both, kept as a fallback / for any future single-page
  //                   surfaces. Default is "full" to preserve the current
  //                   behaviour of any caller that doesn't pass a view.
  view?: "settings" | "verification" | "full";
}

export function MembershipPanel({ view = "full" }: MembershipPanelProps = {}) {
  const { toast } = useToast();
  const apiURL = __API_URL__;
  const { isModuleEnabled } = useSubscription();
  const enabled = isModuleEnabled("membership");
  const showPlans = view === "settings" || view === "full";
  const showVerification = view === "verification" || view === "full";

  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [memberships, setMemberships] = useState<ExhibitorMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [perkInput, setPerkInput] = useState("");

  const authHeader = useCallback(() => {
    const token = sessionStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, membersRes] = await Promise.all([
        fetch(`${apiURL}/membership-plans`, { headers: authHeader() }),
        fetch(`${apiURL}/exhibitor-memberships`, { headers: authHeader() }),
      ]);
      if (plansRes.ok) setPlans(await plansRes.json());
      if (membersRes.ok) setMemberships(await membersRes.json());
    } catch (e: any) {
      toast({
        title: "Failed to load memberships",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [apiURL, authHeader, toast]);

  useEffect(() => {
    if (enabled) fetchAll();
  }, [enabled, fetchAll]);

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ ...EMPTY_FORM });
    setPerkInput("");
    setPlanDialogOpen(true);
  };

  const openEdit = (p: MembershipPlan) => {
    setEditingPlan(p);
    setForm({
      name: p.name,
      description: p.description || "",
      price: p.price,
      durationDays: p.durationDays,
      perks: [...(p.perks || [])],
      color: p.color || "#6366f1",
      published: p.published,
    });
    setPerkInput("");
    setPlanDialogOpen(true);
  };

  const addPerk = () => {
    const v = perkInput.trim();
    if (!v) return;
    setForm((f) => ({ ...f, perks: [...f.perks, v] }));
    setPerkInput("");
  };

  const removePerk = (idx: number) =>
    setForm((f) => ({ ...f, perks: f.perks.filter((_, i) => i !== idx) }));

  const savePlan = async () => {
    if (!form.name.trim() || form.price < 0 || form.durationDays < 1) {
      toast({
        title: "Missing fields",
        description: "Name, non-negative price, and duration ≥ 1 day required.",
        variant: "destructive",
      });
      return;
    }
    try {
      const url = editingPlan
        ? `${apiURL}/membership-plans/${editingPlan._id}`
        : `${apiURL}/membership-plans`;
      const method = editingPlan ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: editingPlan ? "Plan updated" : "Plan created" });
      setPlanDialogOpen(false);
      await fetchAll();
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const togglePublished = async (p: MembershipPlan) => {
    try {
      const res = await fetch(`${apiURL}/membership-plans/${p._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify({ published: !p.published }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchAll();
    } catch (e: any) {
      toast({
        title: "Update failed",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const archivePlan = async (p: MembershipPlan) => {
    if (!confirm(`Archive "${p.name}"? Existing members keep access.`)) return;
    try {
      const res = await fetch(`${apiURL}/membership-plans/${p._id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: "Plan archived" });
      await fetchAll();
    } catch (e: any) {
      toast({
        title: "Archive failed",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const confirmMembership = async (m: ExhibitorMembership) => {
    try {
      const res = await fetch(
        `${apiURL}/exhibitor-memberships/${m._id}/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(),
          },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({
        title: "Membership activated",
        description: "Welcome email sent to the exhibitor.",
      });
      await fetchAll();
    } catch (e: any) {
      toast({
        title: "Confirm failed",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const rejectMembership = async (m: ExhibitorMembership) => {
    const reason = prompt("Reason for rejection? (optional)") || "";
    try {
      const res = await fetch(
        `${apiURL}/exhibitor-memberships/${m._id}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(),
          },
          body: JSON.stringify({ reason }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: "Membership rejected" });
      await fetchAll();
    } catch (e: any) {
      toast({
        title: "Reject failed",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const pending = useMemo(
    () => memberships.filter((m) => m.status === "pending_verification"),
    [memberships],
  );
  const active = useMemo(
    () => memberships.filter((m) => m.status === "active"),
    [memberships],
  );

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" /> Membership Program
          </CardTitle>
          <CardDescription>
            Sell membership tiers to your exhibitors and offer them Member
            pricing on Space templates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 text-sm text-amber-800">
            Your current subscription doesn't include the Membership module.
            Upgrade your plan to enable it.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending verification inbox — render an empty state in the
          dedicated verification tab so it's clear nothing is waiting.
          In the "full" view we still only show the card when there's
          something to act on, since the plan-tier section serves as the
          primary content. */}
      {showVerification && pending.length === 0 && view === "verification" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" /> Pending verification
            </CardTitle>
            <CardDescription>
              Exhibitors who paid through the storefront land here. Verify
              the payment in your gateway dashboard, then confirm to activate
              the membership and email the welcome receipt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No memberships are waiting for verification right now.
            </div>
          </CardContent>
        </Card>
      )}
      {showVerification && pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              Pending verification
              <Badge variant="secondary" className="ml-2">
                {pending.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Exhibitors who paid through the storefront. Verify the payment in
              your gateway dashboard, then confirm here to activate the
              membership and email the welcome receipt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map((m) => (
              <div
                key={m._id}
                className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 flex flex-wrap items-center gap-3 text-sm"
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="font-semibold">
                    {m.exhibitorName || m.exhibitorEmail}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.exhibitorEmail}
                    {m.exhibitorWhatsapp ? ` · ${m.exhibitorWhatsapp}` : ""}
                  </div>
                </div>
                <Badge variant="outline" className="bg-white">
                  {typeof m.planId === "object" ? m.planId.name : "Plan"}
                </Badge>
                <div className="text-sm font-medium">
                  {m.currency} {m.amountPaid}
                </div>
                {m.paymentRef && (
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {m.paymentRef}
                  </div>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button size="sm" onClick={() => confirmMembership(m)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectMembership(m)}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Plan tiers */}
      {showPlans && (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" /> Membership tiers
            </CardTitle>
            <CardDescription>
              Configure the plans exhibitors can buy from your storefront.
              Publish a plan to make it visible.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New plan
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : plans.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No plans yet. Click "New plan" to author your first membership
              tier.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {plans.map((p) => (
                <div
                  key={p._id}
                  className="rounded-xl border p-4 bg-white shadow-sm flex flex-col gap-2"
                  style={{ borderColor: p.color + "55" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div
                        className="font-semibold text-base"
                        style={{ color: p.color }}
                      >
                        {p.name}
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground">
                          {p.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={p.published ? "default" : "outline"}
                      className="shrink-0"
                    >
                      {p.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <div className="text-lg font-bold">
                    {p.currency} {p.price.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.durationDays} days
                  </div>
                  {p.perks.length > 0 && (
                    <ul className="list-disc pl-4 text-xs text-slate-700 space-y-0.5 mt-1">
                      {p.perks.slice(0, 5).map((perk, i) => (
                        <li key={i}>{perk}</li>
                      ))}
                      {p.perks.length > 5 && (
                        <li className="text-muted-foreground">
                          + {p.perks.length - 5} more
                        </li>
                      )}
                    </ul>
                  )}
                  <div className="flex items-center gap-2 mt-auto pt-2 border-t">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => togglePublished(p)}
                      title={p.published ? "Unpublish" : "Publish"}
                    >
                      {p.published ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => archivePlan(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Active members roster */}
      {showVerification && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-emerald-600" />
            Active members
            <Badge variant="secondary" className="ml-2">
              {active.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No active members yet.
            </div>
          ) : (
            <div className="space-y-2">
              {active.map((m) => (
                <div
                  key={m._id}
                  className="rounded-lg border p-3 flex flex-wrap items-center gap-3 text-sm"
                >
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium">
                      {m.exhibitorName || m.exhibitorEmail}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.exhibitorEmail}
                    </div>
                  </div>
                  <Badge variant="outline">
                    {typeof m.planId === "object" ? m.planId.name : "Plan"}
                  </Badge>
                  {m.endDate && (
                    <div className="text-xs text-muted-foreground">
                      Expires {new Date(m.endDate).toLocaleDateString()}
                    </div>
                  )}
                  <div className="text-sm font-medium">
                    {m.currency} {m.amountPaid}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Plan editor dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Edit membership plan" : "New membership plan"}
            </DialogTitle>
            <DialogDescription>
              Configure pricing, duration, and the perks members get. Publish
              when ready to expose on your storefront.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Gold"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Short pitch shown on the storefront card"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price *</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>Duration (days) *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.durationDays}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      durationDays: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <Label>Perks</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={perkInput}
                  onChange={(e) => setPerkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPerk();
                    }
                  }}
                  placeholder="Priority stall selection"
                />
                <Button type="button" onClick={addPerk}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ul className="mt-2 space-y-1">
                {form.perks.map((perk, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm bg-muted/40 rounded px-2 py-1"
                  >
                    <span className="flex-1">{perk}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removePerk(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>Card color</Label>
                <Input
                  type="color"
                  value={form.color}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, color: e.target.value }))
                  }
                  className="h-10 w-20 p-1"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Label htmlFor="published-toggle">Publish on storefront</Label>
                <Switch
                  id="published-toggle"
                  checked={form.published}
                  onCheckedChange={(c) =>
                    setForm((f) => ({ ...f, published: c }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePlan}>
              {editingPlan ? "Save changes" : "Create plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
