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
  Ticket,
  User,
  Award,
  Mail as MailIcon,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

// Sub-toggles per module. When a section is disabled, the matching tab/page
// in the organizer dashboard stays visible but its content is blurred behind
// an "Upgrade plan" CTA via <ModuleGate moduleKey=... sectionKey=...>.
//
// Each `key` must match the `sectionKey` used in the corresponding component.
const EVENT_TAB_SECTIONS: { key: string; label: string }[] = [
  { key: "basic", label: "Basic Info" },
  { key: "media", label: "Images" },
  { key: "visitors", label: "Visitors" },
  { key: "volunteers", label: "Volunteers" },
  { key: "venue", label: "Venue Setup" },
  { key: "tables", label: "Space / AddOns" },
  { key: "speakers", label: "Speakers" },
  { key: "roundtables", label: "Round Tables" },
  { key: "layout", label: "Space Layout" },
];

const STOREFRONT_SECTIONS = [
  { key: "general", label: "General" },
  { key: "design", label: "Design" },
  { key: "features", label: "Features" },
];

const STALLS_SECTIONS = [
  { key: "exhibitors", label: "Exhibitors / Visitors" },
  { key: "vendorRequests", label: "Vendor Requests" },
  { key: "payments", label: "Stall Payments" },
  { key: "addons", label: "Add-ons" },
];

const TICKETS_SECTIONS = [
  { key: "online", label: "Online Sales" },
  { key: "walkin", label: "Walk-in / Kiosk" },
  { key: "qr", label: "QR Check-in" },
  { key: "refunds", label: "Refunds" },
];

const PARTICIPANTS_SECTIONS = [
  { key: "list", label: "Attendee List" },
  { key: "scanner", label: "Scanner" },
  { key: "exports", label: "Exports" },
];

const KIOSK_SECTIONS = [
  { key: "walkin", label: "Walk-in Booking" },
  { key: "qr", label: "QR Scan" },
  { key: "payment", label: "Payment Capture" },
];

const ANALYTICS_SECTIONS = [
  { key: "overview", label: "Overview" },
  { key: "revenue", label: "Revenue Charts" },
  { key: "attendees", label: "Attendee Charts" },
  { key: "exports", label: "Exports" },
];

const COUPONS_SECTIONS = [
  { key: "create", label: "Create Coupons" },
  { key: "redeem", label: "Redemption" },
  { key: "exhibitor", label: "Exhibitor Coupons" },
];

const SPEAKER_SECTIONS = [
  { key: "applications", label: "Applications" },
  { key: "approval", label: "Approve / Reject" },
  { key: "slots", label: "Slot Assignment" },
];

const ROUND_TABLE_SECTIONS = [
  { key: "list", label: "Bookings List" },
  { key: "byEvent", label: "View by Event" },
];

const CRM_SECTIONS = [
  { key: "customers", label: "Customer List" },
  { key: "segments", label: "Segments" },
  { key: "exports", label: "Exports" },
];

const FEEDBACK_SECTIONS = [
  { key: "list", label: "Feedback List" },
  { key: "featured", label: "Featured Reviews" },
  { key: "stats", label: "Stats" },
];

const OPERATOR_SECTIONS = [
  { key: "list", label: "Operator List" },
  { key: "create", label: "Create Operator" },
  { key: "scanner", label: "Scanner Permissions" },
];

const ORGANIZER_FEATURE_MODULES: {
  key: string;
  label: string;
  hasLimit?: boolean;
  hasAudiences?: boolean;
  icon: any;
  sections?: { key: string; label: string }[];
}[] = [
  {
    key: "events",
    label: "Events",
    hasLimit: true,
    icon: Calendar,
    sections: EVENT_TAB_SECTIONS,
  },
  {
    key: "tickets",
    label: "Tickets",
    icon: DollarSign,
    sections: TICKETS_SECTIONS,
  },
  {
    key: "stalls",
    label: "Stalls",
    hasLimit: true,
    icon: Store,
    sections: STALLS_SECTIONS,
  },
  {
    key: "participants",
    label: "Participants",
    icon: Users,
    sections: PARTICIPANTS_SECTIONS,
  },
  {
    key: "kiosk",
    label: "In-Person Booking",
    icon: Ticket,
    sections: KIOSK_SECTIONS,
  },
  {
    key: "speakerRequests",
    label: "Speaker Requests",
    icon: Users,
    sections: SPEAKER_SECTIONS,
  },
  {
    key: "roundTableBookings",
    label: "Round Table Bookings",
    icon: Calendar,
    sections: ROUND_TABLE_SECTIONS,
  },
  { key: "razorpay", label: "Razorpay", icon: DollarSign },
  {
    key: "coupons",
    label: "Coupons",
    icon: Star,
    sections: COUPONS_SECTIONS,
  },
  {
    key: "storefront",
    label: "Storefront",
    icon: Store,
    sections: STOREFRONT_SECTIONS,
  },
  { key: "customDomain", label: "Custom Domain", icon: Settings },
  {
    key: "analytics",
    label: "Analytics",
    icon: BarChart3,
    sections: ANALYTICS_SECTIONS,
  },
  { key: "crm", label: "CRM", icon: Users, sections: CRM_SECTIONS },
  {
    key: "feedback",
    label: "Feedback",
    hasAudiences: true,
    icon: MessageSquare,
    sections: FEEDBACK_SECTIONS,
  },
  { key: "whatsappQR", label: "WhatsApp QR", icon: Zap },
  { key: "instagram", label: "Instagram QR", icon: Zap },
  {
    // When enabled, the organizer gets the "Personal Email (custom sender)"
    // card in Settings and can send all vendor/attendee emails from their
    // own address instead of admin@eventsh.com.
    key: "customEmail",
    label: "Customize Email (own sender)",
    icon: MailIcon,
  },
  {
    key: "operators",
    label: "Operators",
    hasLimit: true,
    icon: Users,
    sections: OPERATOR_SECTIONS,
  },
  {
    // When enabled, organizers can author membership tiers in Settings,
    // list them on the storefront, and verify purchases in a dashboard
    // inbox. `limit` caps how many distinct tiers (Gold/Silver/Bronze)
    // the organizer can author — leave 0 for unlimited.
    key: "membership",
    label: "Exhibitor Membership",
    hasLimit: true,
    icon: Award,
  },
];

interface ModuleConfig {
  enabled: boolean;
  limit?: number;
  // Per-audience toggles for modules that fan out (today: feedback).
  audiences?: Partial<Record<AudienceKey, boolean>>;
  sections?: Record<string, boolean>;
}

function buildDefaultSections(
  sections?: { key: string; label: string }[],
  existing?: Record<string, boolean>,
): Record<string, boolean> | undefined {
  if (!sections || sections.length === 0) return undefined;
  return sections.reduce(
    (acc, s) => {
      // Default unset sections to true so newly-introduced sub-toggles do not
      // silently lock existing plans.
      acc[s.key] = existing?.[s.key] ?? true;
      return acc;
    },
    {} as Record<string, boolean>,
  );
}

function buildEmptyModule(m: {
  hasLimit?: boolean;
  hasAudiences?: boolean;
  sections?: { key: string; label: string }[];
}): ModuleConfig {
  const cfg: ModuleConfig = { enabled: false };
  if (m.hasLimit) cfg.limit = 0;
  if (m.hasAudiences) {
    cfg.audiences = FEEDBACK_AUDIENCES.reduce(
      (a, x) => ({ ...a, [x.key]: false }),
      {} as Record<AudienceKey, boolean>,
    );
  }
  const sections = buildDefaultSections(m.sections);
  if (sections) cfg.sections = sections;
  return cfg;
}

interface Plan {
  _id: string;
  planName: string;
  price: number;
  priceINR?: number;
  features: string[];
  moduleType: string;
  validityInDays: number;
  // "days" = rolling N-day window (default). "date" = valid up to validUntil.
  validityType?: "days" | "date";
  validUntil?: string;
  isActive: boolean;
  isDefault: boolean;
  description?: string;
  modules?: Record<string, ModuleConfig>;
  // Empty array (or undefined) = visible to every organizer (default).
  // Populated = only those organizers can see/buy this plan.
  visibleToOrganizers?: string[];
  createdAt?: string;
  updatedAt?: string;
}

type AccountType = "Individual" | "Organizer";
const ACCOUNT_TYPES: AccountType[] = ["Individual", "Organizer"];

interface PlanFormState {
  planName: string;
  price: number;
  priceINR: number;
  validityInDays: number;
  validityType: "days" | "date";
  validUntil: string; // yyyy-mm-dd for the date input (empty when day-based)
  description: string;
  features: string[];
  isActive: boolean;
  isDefault: boolean;
  moduleType: AccountType;
  modules: Record<string, ModuleConfig>;
  visibleToOrganizers: string[]; // empty = visible to all
}

const emptyForm: PlanFormState = {
  planName: "",
  price: 0,
  priceINR: 0,
  validityInDays: 30,
  validityType: "days",
  validUntil: "",
  description: "",
  features: [],
  isActive: true,
  isDefault: false,
  moduleType: "Organizer",
  modules: ORGANIZER_FEATURE_MODULES.reduce(
    (acc, m) => {
      acc[m.key] = buildEmptyModule(m);
      return acc;
    },
    {} as Record<string, ModuleConfig>,
  ),
  visibleToOrganizers: [],
};

// Modules enabled on the starter "Individual" plan — suitable for users
// running a single event (wedding, birthday, one-off conference, etc.).
// Advanced modules (CRM, custom domain, analytics depth) stay off so the
// upgrade-plan CTA surfaces inside locked tabs.
const INDIVIDUAL_PLAN_MODULES: Record<string, ModuleConfig> = (() => {
  const enabledKeys = new Set([
    "events",
    "tickets",
    "participants",
    "kiosk",
    "feedback",
  ]);
  return ORGANIZER_FEATURE_MODULES.reduce(
    (acc, m) => {
      const cfg = buildEmptyModule(m);
      if (enabledKeys.has(m.key)) {
        cfg.enabled = true;
        if (m.key === "events") cfg.limit = 1;
        // Sections default to all-on inside buildEmptyModule, which matches
        // what we want for a single-event Individual plan.
      }
      acc[m.key] = cfg;
      return acc;
    },
    {} as Record<string, ModuleConfig>,
  );
})();

const INDIVIDUAL_PLAN_TEMPLATE: PlanFormState = {
  planName: "Individual",
  price: 0,
  priceINR: 0,
  validityInDays: 365,
  validityType: "days",
  validUntil: "",
  description:
    "For one-off organizers (weddings, birthdays, single conferences). One event with the essentials. Upgrade to unlock more.",
  features: [
    "1 event",
    "Walk-in & online tickets",
    "Participant management",
    "Feedback collection",
  ],
  isActive: true,
  isDefault: true,
  moduleType: "Individual",
  modules: INDIVIDUAL_PLAN_MODULES,
  visibleToOrganizers: [],
};

export function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<PlanFormState>(emptyForm);
  // Top-of-page segment filter: "all" shows both tiers; otherwise scope to one
  // accountType. Lets admins manage Individual and Organizer plans separately.
  const [planTypeFilter, setPlanTypeFilter] = useState<"all" | AccountType>(
    "all",
  );
  // Organizer roster used by the "Visible to organizers" multi-select on
  // the plan editor. Loaded once when the page mounts.
  const [organizers, setOrganizers] = useState<
    { _id: string; name?: string; organizationName?: string; email?: string }[]
  >([]);
  const [orgFilter, setOrgFilter] = useState("");
  const { toast } = useToast();

  const token = sessionStorage.getItem("token");

  useEffect(() => {
    fetchPlans();
    fetchOrganizers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchOrganizers() {
    try {
      const res = await fetch(`${apiURL}/admin/organizers-overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const list = Array.isArray(json.organizers) ? json.organizers : [];
      setOrganizers(
        list.map((o: any) => ({
          _id: String(o._id),
          name: o.name,
          organizationName: o.organizationName,
          email: o.email,
        })),
      );
    } catch {
      // non-fatal — the visibility picker just shows "no organizers"
    }
  }

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
          acc[m.key] = buildEmptyModule(m);
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
      validityInDays: plan.validityInDays || 30,
      validityType: plan.validityType === "date" ? "date" : "days",
      // Backend stores an ISO datetime; the date input needs yyyy-mm-dd.
      validUntil: plan.validUntil ? plan.validUntil.slice(0, 10) : "",
      description: plan.description || "",
      features: Array.isArray(plan.features) ? [...plan.features] : [],
      isActive: plan.isActive,
      isDefault: plan.isDefault,
      moduleType:
        plan.moduleType === "Individual" ? "Individual" : "Organizer",
      modules: ORGANIZER_FEATURE_MODULES.reduce(
        (acc, m) => {
          const existing = plan.modules?.[m.key];
          const cfg: ModuleConfig = { enabled: existing?.enabled ?? false };
          if (m.hasLimit) cfg.limit = existing?.limit ?? 0;
          if (m.hasAudiences) {
            cfg.audiences = FEEDBACK_AUDIENCES.reduce(
              (a, x) => ({
                ...a,
                [x.key]: !!existing?.audiences?.[x.key],
              }),
              {} as Record<AudienceKey, boolean>,
            );
          }
          const sections = buildDefaultSections(m.sections, existing?.sections);
          if (sections) cfg.sections = sections;
          acc[m.key] = cfg;
          return acc;
        },
        {} as Record<string, ModuleConfig>,
      ),
      visibleToOrganizers: Array.isArray(plan.visibleToOrganizers)
        ? plan.visibleToOrganizers.map(String)
        : [],
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

    // Validate the chosen validity mode.
    if (form.validityType === "date") {
      if (!form.validUntil) {
        toast({
          title: "Pick a valid-until date",
          variant: "destructive",
        });
        return;
      }
    } else if (!form.validityInDays || form.validityInDays < 1) {
      toast({
        title: "Enter a valid number of days",
        variant: "destructive",
      });
      return;
    }

    const body = {
      planName: form.planName,
      price: form.price,
      priceINR: form.priceINR,
      validityType: form.validityType,
      // Send only the field relevant to the chosen mode.
      ...(form.validityType === "date"
        ? { validUntil: form.validUntil, validityInDays: undefined }
        : { validityInDays: form.validityInDays, validUntil: undefined }),
      description: form.description || undefined,
      features: form.features.filter((f) => f.trim()),
      isActive: form.isActive,
      isDefault: form.isDefault,
      moduleType: form.moduleType,
      modules: form.modules,
      // Empty list = visible to everyone (backend default). Populated
      // list = restrict to those organizer ids.
      visibleToOrganizers: form.visibleToOrganizers,
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
        description:
          "New signups with this account type will be auto-assigned this plan.",
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

  function toggleSection(moduleKey: string, sectionKey: string, value: boolean) {
    setForm({
      ...form,
      modules: {
        ...form.modules,
        [moduleKey]: {
          ...form.modules[moduleKey],
          sections: {
            ...(form.modules[moduleKey]?.sections || {}),
            [sectionKey]: value,
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
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Default Plans
              </p>
              <div className="space-y-0.5 text-sm">
                <p className="truncate">
                  <span className="text-muted-foreground">Individual: </span>
                  <span className="font-semibold">
                    {plans.find(
                      (p) => p.isDefault && p.moduleType === "Individual",
                    )?.planName || "Not set"}
                  </span>
                </p>
                <p className="truncate">
                  <span className="text-muted-foreground">Organizer: </span>
                  <span className="font-semibold">
                    {plans.find(
                      (p) => p.isDefault && p.moduleType === "Organizer",
                    )?.planName || "Not set"}
                  </span>
                </p>
              </div>
            </div>
            <Star className="h-8 w-8 text-amber-500 flex-shrink-0" />
          </CardContent>
        </Card>
      </div>

      {/* Plans grid */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>Plans</CardTitle>
              <CardDescription>
                Toggle active/default and edit features per plan. Filter by
                account type to manage Individual and Organizer tiers
                separately.
              </CardDescription>
            </div>
            <div className="inline-flex rounded-md border bg-muted/30 p-1 self-start md:self-center">
              {(["all", "Individual", "Organizer"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPlanTypeFilter(opt)}
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition ${
                    planTypeFilter === opt
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt === "all" ? "All" : opt}
                </button>
              ))}
            </div>
          </div>
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
              {plans
                .filter(
                  (plan) =>
                    planTypeFilter === "all" ||
                    plan.moduleType === planTypeFilter,
                )
                .map((plan) => (
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
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">
                          {plan.planName}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="mt-1 text-[10px] font-normal"
                        >
                          {plan.moduleType === "Individual"
                            ? "Individual"
                            : "Organizer"}
                        </Badge>
                      </div>
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
                        /{" "}
                        {plan.validityType === "date" && plan.validUntil
                          ? `until ${new Date(plan.validUntil).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}`
                          : `${plan.validityInDays}d`}
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
            {!editingPlan && (
              <div className="pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setForm(INDIVIDUAL_PLAN_TEMPLATE)}
                >
                  <User className="h-4 w-4 mr-1" />
                  Use Individual Template
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Pre-fills a starter plan (1 event, essentials only) for
                  single-event organizers like weddings.
                </p>
              </div>
            )}
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
                <Label>Validity</Label>
                <div className="flex gap-2">
                  {/* Dropdown: choose how validity is expressed */}
                  <select
                    value={form.validityType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        validityType: e.target.value as "days" | "date",
                      })
                    }
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm shrink-0"
                  >
                    <option value="days">Number of days</option>
                    <option value="date">Valid up to date</option>
                  </select>

                  {form.validityType === "date" ? (
                    <Input
                      type="date"
                      value={form.validUntil}
                      onChange={(e) =>
                        setForm({ ...form, validUntil: e.target.value })
                      }
                    />
                  ) : (
                    <Input
                      type="number"
                      min={1}
                      placeholder="e.g., 30"
                      value={form.validityInDays}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          validityInDays: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {form.validityType === "date"
                    ? "Plan stays valid up to this fixed date, regardless of purchase day."
                    : "Plan is valid for this many days from the day it's activated."}
                </p>
              </div>
            </div>

            <div>
              <Label>Account Type *</Label>
              <div className="inline-flex rounded-md border bg-muted/30 p-1 mt-1">
                {ACCOUNT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, moduleType: t })}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition ${
                      form.moduleType === t
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Plans show only to accounts of this type. Individual = one-off
                organizers; Organizer = full multi-event accounts.
              </p>
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
                      {m.sections && cfg?.enabled && (
                        <div className="pt-2 border-t space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Sections (unlock specific tabs)
                          </Label>
                          <div className="grid grid-cols-1 gap-1.5">
                            {m.sections.map((s) => (
                              <div
                                key={s.key}
                                className="flex items-center justify-between text-xs pl-1"
                              >
                                <span>{s.label}</span>
                                <Switch
                                  checked={cfg.sections?.[s.key] ?? true}
                                  onCheckedChange={(v) =>
                                    toggleSection(m.key, s.key, v)
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Visible-to-organizers picker — empty selection = visible
                to every organizer (default). Pick one or more to scope
                the plan to specific organizers (e.g. partner pilots,
                grandfathered pricing). */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-sm font-semibold">
                Visible to organizers
              </Label>
              <p className="text-xs text-muted-foreground">
                Leave empty to expose this plan to <strong>every</strong>{" "}
                organizer. Tick one or more boxes to restrict it.
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate text-left">
                      {form.visibleToOrganizers.length === 0
                        ? "Visible to all organizers"
                        : form.visibleToOrganizers.length === 1
                          ? (() => {
                              const o = organizers.find(
                                (x) => x._id === form.visibleToOrganizers[0],
                              );
                              return (
                                o?.organizationName ||
                                o?.name ||
                                o?.email ||
                                "1 organizer"
                              );
                            })()
                          : `${form.visibleToOrganizers.length} organizers selected`}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ⌄
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <div className="border-b p-2">
                    <Input
                      placeholder="Search organizers…"
                      value={orgFilter}
                      onChange={(e) => setOrgFilter(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {organizers.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        Loading organizers…
                      </p>
                    ) : (
                      organizers
                        .filter((o) => {
                          if (!orgFilter.trim()) return true;
                          const q = orgFilter.toLowerCase();
                          return (
                            (o.organizationName || "")
                              .toLowerCase()
                              .includes(q) ||
                            (o.name || "").toLowerCase().includes(q) ||
                            (o.email || "").toLowerCase().includes(q)
                          );
                        })
                        .map((o) => {
                          const checked = form.visibleToOrganizers.includes(
                            o._id,
                          );
                          return (
                            <label
                              key={o._id}
                              className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent cursor-pointer text-sm"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => {
                                  setForm((f) => {
                                    const set = new Set(f.visibleToOrganizers);
                                    if (c) set.add(o._id);
                                    else set.delete(o._id);
                                    return {
                                      ...f,
                                      visibleToOrganizers: Array.from(set),
                                    };
                                  });
                                }}
                              />
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="font-medium truncate">
                                  {o.organizationName || o.name || "—"}
                                </span>
                                {o.email && (
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {o.email}
                                  </span>
                                )}
                              </div>
                            </label>
                          );
                        })
                    )}
                  </div>
                  {form.visibleToOrganizers.length > 0 && (
                    <div className="border-t p-2 flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">
                        {form.visibleToOrganizers.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, visibleToOrganizers: [] }))
                        }
                        className="text-blue-600 hover:underline"
                      >
                        Clear (visible to all)
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
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
