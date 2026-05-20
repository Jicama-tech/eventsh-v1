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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Star,
  Calendar,
  BarChart3,
  Settings,
  Store,
  Users,
  Zap,
  MessageSquare,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

const apiURL = __API_URL__;

type AudienceKey = "visitor" | "exhibitor" | "speaker" | "roundTable";

const FEEDBACK_AUDIENCES: { key: AudienceKey; label: string }[] = [
  { key: "visitor", label: "Visitors" },
  { key: "exhibitor", label: "Exhibitors" },
  { key: "speaker", label: "Speakers" },
  { key: "roundTable", label: "Round Tables" },
];

/**
 * Render-helper: turn a plan's feedback config into "Visitors, Speakers".
 * Returns null when feedback isn't enabled or no audiences are ticked, so
 * the card omits the line entirely instead of showing an empty label.
 */
function feedbackSummary(plan: any): string | null {
  const cfg = plan?.modules?.feedback;
  if (!cfg?.enabled) return null;
  const aud = cfg.audiences || {};
  const labels = FEEDBACK_AUDIENCES.filter((a) => !!aud[a.key]).map(
    (a) => a.label,
  );
  return labels.length > 0 ? labels.join(", ") : null;
}

const ORGANIZER_FEATURE_MODULES: {
  key: string;
  label: string;
  hasLimit?: boolean;
  hasAudiences?: boolean;
  icon: any;
}[] = [
  { key: "events", label: "Events", hasLimit: true, icon: Calendar },
  { key: "tickets", label: "Tickets", icon: DollarSign },
  { key: "stalls", label: "Stalls", hasLimit: true, icon: Store },
  { key: "speakerRequests", label: "Speaker Requests", icon: Users },
  { key: "roundTableBookings", label: "Round Table Bookings", icon: Calendar },
  { key: "feedback", label: "Feedback", hasAudiences: true, icon: MessageSquare },
  { key: "razorpay", label: "Razorpay", icon: DollarSign },
  { key: "coupons", label: "Coupons", icon: Star },
  { key: "storefront", label: "Storefront", icon: Store },
  { key: "customDomain", label: "Custom Domain", icon: Settings },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "crm", label: "CRM", icon: Users },
  { key: "whatsappQR", label: "WhatsApp QR", icon: Zap },
  { key: "instagram", label: "Instagram QR", icon: Zap },
  { key: "operators", label: "Operators", hasLimit: true, icon: Users },
];

interface ModuleConfig {
  enabled: boolean;
  limit?: number;
  // Per-audience toggles for modules that fan out (today: feedback).
  audiences?: Partial<Record<AudienceKey, boolean>>;
}

interface Plan {
  _id: string;
  planName: string;
  price: number;
  priceINR?: number;
  features: string[];
  moduleType: string;
  validityInDays: number;
  isActive: boolean;
  isDefault: boolean;
  description?: string;
  modules?: Record<string, ModuleConfig>;
  createdAt?: string;
  updatedAt?: string;
}

interface PlanFormState {
  planName: string;
  price: number;
  priceINR: number;
  validityInDays: number;
  description: string;
  features: string[];
  isActive: boolean;
  isDefault: boolean;
  modules: Record<string, ModuleConfig>;
}

function defaultConfigFor(m: {
  hasLimit?: boolean;
  hasAudiences?: boolean;
}): ModuleConfig {
  if (m.hasLimit) return { enabled: false, limit: 0 };
  if (m.hasAudiences) {
    return {
      enabled: false,
      audiences: FEEDBACK_AUDIENCES.reduce(
        (a, x) => ({ ...a, [x.key]: false }),
        {} as Record<AudienceKey, boolean>,
      ),
    };
  }
  return { enabled: false };
}

const emptyForm: PlanFormState = {
  planName: "",
  price: 0,
  priceINR: 0,
  validityInDays: 30,
  description: "",
  features: [],
  isActive: true,
  isDefault: false,
  modules: ORGANIZER_FEATURE_MODULES.reduce(
    (acc, m) => {
      acc[m.key] = defaultConfigFor(m);
      return acc;
    },
    {} as Record<string, ModuleConfig>,
  ),
};

export function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<PlanFormState>(emptyForm);
  const { toast } = useToast();

  const token = sessionStorage.getItem("token");

  useEffect(() => {
    fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPlans() {
    try {
      setLoading(true);
      const res = await fetch(`${apiURL}/plans/get-plans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load plans");
      const data = await res.json();
      setPlans(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: err.message || "Failed to fetch plans",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      ...emptyForm,
      modules: ORGANIZER_FEATURE_MODULES.reduce(
        (acc, m) => {
          acc[m.key] = defaultConfigFor(m);
          return acc;
        },
        {} as Record<string, ModuleConfig>,
      ),
    });
    setEditingPlan(null);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan);
    setForm({
      planName: plan.planName,
      price: plan.price,
      priceINR: plan.priceINR || 0,
      validityInDays: plan.validityInDays,
      description: plan.description || "",
      features: Array.isArray(plan.features) ? [...plan.features] : [],
      isActive: plan.isActive,
      isDefault: plan.isDefault,
      modules: ORGANIZER_FEATURE_MODULES.reduce(
        (acc, m) => {
          const existing = plan.modules?.[m.key];
          if (m.hasLimit) {
            acc[m.key] = {
              enabled: existing?.enabled ?? false,
              limit: existing?.limit ?? 0,
            };
          } else if (m.hasAudiences) {
            acc[m.key] = {
              enabled: existing?.enabled ?? false,
              audiences: FEEDBACK_AUDIENCES.reduce(
                (a, x) => ({
                  ...a,
                  [x.key]: !!existing?.audiences?.[x.key],
                }),
                {} as Record<AudienceKey, boolean>,
              ),
            };
          } else {
            acc[m.key] = { enabled: existing?.enabled ?? false };
          }
          return acc;
        },
        {} as Record<string, ModuleConfig>,
      ),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.planName) {
      toast({
        title: "Plan name required",
        variant: "destructive",
      });
      return;
    }

    const body = {
      planName: form.planName,
      price: form.price,
      priceINR: form.priceINR,
      validityInDays: form.validityInDays,
      description: form.description || undefined,
      features: form.features.filter((f) => f.trim()),
      isActive: form.isActive,
      isDefault: form.isDefault,
      modules: form.modules,
    };

    try {
      const url = editingPlan
        ? `${apiURL}/plans/${editingPlan._id}`
        : `${apiURL}/plans/create-plan`;
      const method = editingPlan ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save plan");
      }

      // If user toggled isDefault on, ensure it's exclusive via the dedicated endpoint.
      if (form.isDefault) {
        const saved = await res.clone().json();
        const planId = saved?._id || editingPlan?._id;
        if (planId) {
          await fetch(`${apiURL}/plans/${planId}/set-default`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }

      toast({
        title: editingPlan ? "Plan updated" : "Plan created",
      });
      setDialogOpen(false);
      resetForm();
      fetchPlans();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this plan? This cannot be undone.")) return;
    try {
      const res = await fetch(`${apiURL}/plans/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete plan");
      toast({ title: "Plan deleted" });
      fetchPlans();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  async function handleToggleActive(id: string) {
    try {
      const res = await fetch(`${apiURL}/plans/${id}/toggle-active`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to toggle plan");
      fetchPlans();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const res = await fetch(`${apiURL}/plans/${id}/set-default`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to set default plan");
      toast({
        title: "Default plan updated",
        description: "New organizers will be auto-assigned this plan.",
      });
      fetchPlans();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  function setFeature(index: number, value: string) {
    const next = [...form.features];
    next[index] = value;
    setForm({ ...form, features: next });
  }

  function addFeature() {
    setForm({ ...form, features: [...form.features, ""] });
  }

  function removeFeature(index: number) {
    setForm({
      ...form,
      features: form.features.filter((_, i) => i !== index),
    });
  }

  function toggleModule(key: string, enabled: boolean) {
    setForm({
      ...form,
      modules: {
        ...form.modules,
        [key]: { ...form.modules[key], enabled },
      },
    });
  }

  function setModuleLimit(key: string, limit: number) {
    setForm({
      ...form,
      modules: {
        ...form.modules,
        [key]: { ...form.modules[key], limit },
      },
    });
  }

  function toggleAudience(key: string, audience: AudienceKey, value: boolean) {
    setForm({
      ...form,
      modules: {
        ...form.modules,
        [key]: {
          ...form.modules[key],
          audiences: {
            ...(form.modules[key]?.audiences || {}),
            [audience]: value,
          },
        },
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Organizer Plans</h1>
          <p className="text-muted-foreground">
            Manage subscription plans for organizers. The default plan is
            auto-assigned when an organizer registers.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Plans
              </p>
              <p className="text-2xl font-bold">{plans.length}</p>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Active
              </p>
              <p className="text-2xl font-bold text-green-600">
                {plans.filter((p) => p.isActive).length}
              </p>
            </div>
            <Check className="h-8 w-8 text-green-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Default Plan
              </p>
              <p className="text-base font-semibold truncate">
                {plans.find((p) => p.isDefault)?.planName || "Not set"}
              </p>
            </div>
            <Star className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
      </div>

      {/* Plans grid */}
      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
          <CardDescription>
            Toggle active/default and edit features per plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading plans...
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No plans yet. Create your first organizer plan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <Card
                  key={plan._id}
                  className={`relative ${plan.isDefault ? "ring-2 ring-amber-400" : ""}`}
                >
                  {plan.isDefault && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <Badge className="bg-amber-500 text-white">
                        <Star className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{plan.planName}</CardTitle>
                      <Badge variant={plan.isActive ? "default" : "secondary"}>
                        {plan.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {plan.description && (
                      <CardDescription>{plan.description}</CardDescription>
                    )}
                    <div className="text-2xl font-bold pt-2">
                      ${plan.price}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {plan.validityInDays}d
                      </span>
                    </div>
                    {plan.priceINR ? (
                      <div className="text-sm text-muted-foreground">
                        ₹{plan.priceINR} for Indian organizers
                      </div>
                    ) : null}
                    {feedbackSummary(plan) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">Feedback:</span>{" "}
                        {feedbackSummary(plan)}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {plan.features?.length > 0 && (
                      <ul className="text-sm space-y-1">
                        {plan.features.slice(0, 5).map((f, i) => (
                          <li key={i} className="flex items-start">
                            <Check className="h-3 w-3 text-green-600 mr-1 mt-1 shrink-0" />
                            <span className="truncate">{f}</span>
                          </li>
                        ))}
                        {plan.features.length > 5 && (
                          <li className="text-xs text-muted-foreground">
                            +{plan.features.length - 5} more
                          </li>
                        )}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(plan)}
                      >
                        <Edit className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(plan._id)}
                      >
                        {plan.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      {!plan.isDefault && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetDefault(plan._id)}
                        >
                          <Star className="h-3 w-3 mr-1" /> Set Default
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(plan._id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Edit Plan" : "Create Organizer Plan"}
            </DialogTitle>
            <DialogDescription>
              Configure features and module access for this plan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Plan Name *</Label>
                <Input
                  value={form.planName}
                  onChange={(e) =>
                    setForm({ ...form, planName: e.target.value })
                  }
                  placeholder="e.g., Starter, Pro"
                />
              </div>
              <div>
                <Label>Validity (days)</Label>
                <Input
                  type="number"
                  value={form.validityInDays}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      validityInDays: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Brief plan description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Shown to organizers in SG and other regions.
                </p>
              </div>
              <div>
                <Label>Price (INR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.priceINR}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priceINR: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Shown to Indian organizers (₹). Leave 0 to disable INR.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isDefault}
                  onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
                />
                <Label>Default plan (auto-assigned on registration)</Label>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Features</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addFeature}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {form.features.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={f}
                      onChange={(e) => setFeature(i, e.target.value)}
                      placeholder="Feature description"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeFeature(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold mb-3 block">
                Module Access
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ORGANIZER_FEATURE_MODULES.map((m) => {
                  const cfg = form.modules[m.key];
                  const Icon = m.icon;
                  return (
                    <div
                      key={m.key}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {m.label}
                          </span>
                        </div>
                        <Switch
                          checked={cfg?.enabled || false}
                          onCheckedChange={(v) => toggleModule(m.key, v)}
                        />
                      </div>
                      {m.hasLimit && cfg?.enabled && (
                        <div>
                          <Label className="text-xs">Limit (0 = unlimited)</Label>
                          <Input
                            type="number"
                            value={cfg.limit ?? 0}
                            onChange={(e) =>
                              setModuleLimit(
                                m.key,
                                parseInt(e.target.value) || 0,
                              )
                            }
                          />
                        </div>
                      )}
                      {m.hasAudiences && cfg?.enabled && (
                        <div className="pt-1 border-t">
                          <Label className="text-xs text-muted-foreground">
                            Audiences this plan can collect feedback from:
                          </Label>
                          <div className="grid grid-cols-2 gap-1.5 mt-2">
                            {FEEDBACK_AUDIENCES.map((a) => (
                              <label
                                key={a.key}
                                className="flex items-center gap-2 text-xs cursor-pointer select-none"
                              >
                                <Checkbox
                                  checked={!!cfg.audiences?.[a.key]}
                                  onCheckedChange={(v) =>
                                    toggleAudience(m.key, a.key, !!v)
                                  }
                                />
                                {a.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingPlan ? "Update Plan" : "Create Plan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
