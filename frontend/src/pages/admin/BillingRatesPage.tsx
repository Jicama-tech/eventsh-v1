import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Receipt,
  Save,
  RotateCcw,
  Users,
  Search,
  Plus,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminFetch";
import { COUNTRIES } from "@/data/countries";

const apiURL = __API_URL__;

type RateMode = "flat" | "percent";
type DirectionKey = "moneyIn" | "moneyOut";

// Just 2 shared rates: Money In applies uniformly to every category where
// money flows into the organizer; Money Out applies to categories where
// the organizer pays money out. No more per-category rates.
const DIRECTIONS: {
  key: DirectionKey;
  label: string;
  accent: string;
  includes: string;
}[] = [
  {
    key: "moneyIn",
    label: "Money In",
    accent: "text-emerald-600",
    includes:
      "Visitor tickets, exhibitor stalls, speakers, sponsors, round tables, chairs, workshops, memberships",
  },
  {
    key: "moneyOut",
    label: "Money Out",
    accent: "text-rose-600",
    includes: "Suppliers the organizer pays",
  },
];

const rateKey = (k: DirectionKey) => `${k}Rate` as const;
const modeKey = (k: DirectionKey) => `${k}RateMode` as const;

const COUNTRY_BY_CODE: Record<string, (typeof COUNTRIES)[number]> =
  Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

interface Plan {
  countryCode: string | null;
  moneyInRate: number;
  moneyInRateMode: RateMode;
  moneyOutRate: number;
  moneyOutRateMode: RateMode;
  currency: string;
  updatedAt?: string;
  updatedBy?: string | null;
}

const planKey = (p: Pick<Plan, "countryCode">) => p.countryCode ?? "DEFAULT";

const planLabel = (countryCode: string | null) => {
  if (!countryCode) return "Default (all other countries)";
  const c = COUNTRY_BY_CODE[countryCode];
  return c ? `${c.flag} ${c.name}` : countryCode;
};

const isDirty = (a: Plan, b: Plan) =>
  DIRECTIONS.some(
    (d) =>
      a[rateKey(d.key)] !== b[rateKey(d.key)] ||
      a[modeKey(d.key)] !== b[modeKey(d.key)],
  ) || (a.countryCode === null && a.currency !== b.currency);

interface OrganizerRow {
  _id: string;
  name: string;
  organizationName?: string;
  email?: string;
  country?: string;
  hasOverride: boolean;
}

// Per-direction editor state for the organizer-override dialog. `enabled`
// false means "inherit the platform default" (mirrors the backend's
// null-rate-means-inherit convention).
type OverrideForm = Record<
  DirectionKey,
  { enabled: boolean; rate: number; mode: RateMode }
>;

const emptyOverrideForm = (): OverrideForm => ({
  moneyIn: { enabled: false, rate: 0, mode: "flat" },
  moneyOut: { enabled: false, rate: 0, mode: "flat" },
});

export function BillingRatesPage() {
  const { toast } = useToast();

  // Country-scoped default rate plans (fallback + Singapore/India +
  // whatever else an admin has added).
  const [plans, setPlans] = useState<Plan[]>([]);
  const [originalPlans, setOriginalPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [newCountryCode, setNewCountryCode] = useState("");
  const [addingCountry, setAddingCountry] = useState(false);

  // Per-organizer overrides
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeOrg, setActiveOrg] = useState<OrganizerRow | null>(null);
  const [overrideForm, setOverrideForm] = useState<OverrideForm>(
    emptyOverrideForm(),
  );
  const [overrideDefaults, setOverrideDefaults] = useState<Plan | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideSaving, setOverrideSaving] = useState(false);

  const fetchPlans = async () => {
    setPlansLoading(true);
    try {
      const res = await adminFetch(`${apiURL}/admin/billing-rates/plans`);
      if (res.status === 401) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Plan[];
      setPlans(json);
      setOriginalPlans(json);
    } catch (e: any) {
      toast({
        title: "Failed to load billing-rate plans",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setPlansLoading(false);
    }
  };

  const fetchOrganizers = async () => {
    setOrgsLoading(true);
    try {
      const res = await adminFetch(`${apiURL}/admin/billing-rates/organizers`);
      if (res.status === 401) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as OrganizerRow[];
      setOrganizers(json || []);
    } catch (e: any) {
      toast({
        title: "Failed to load organizers",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setOrgsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchOrganizers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePlanField = (
    key: string,
    field: keyof Plan,
    value: number | string,
  ) => {
    setPlans((prev) =>
      prev.map((p) => (planKey(p) === key ? { ...p, [field]: value } : p)),
    );
  };

  const onSavePlan = async (key: string) => {
    const plan = plans.find((p) => planKey(p) === key);
    if (!plan) return;
    setSavingKey(key);
    try {
      const body: Record<string, number | string> = {};
      for (const d of DIRECTIONS) {
        body[rateKey(d.key)] = Number(plan[rateKey(d.key)]);
        body[modeKey(d.key)] = plan[modeKey(d.key)];
      }
      if (plan.countryCode === null) body.currency = plan.currency;
      const res = await adminFetch(
        `${apiURL}/admin/billing-rates/plans/${key}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.status === 401) return;
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const updated = (await res.json()) as Plan[];
      setPlans(updated);
      setOriginalPlans(updated);
      toast({
        title: "Rates updated",
        description: `${planLabel(plan.countryCode)} rates apply immediately to every organizer on this plan (custom per-organizer overrides are unaffected).`,
      });
    } catch (e: any) {
      toast({
        title: "Couldn't save rates",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const onResetPlan = (key: string) => {
    const original = originalPlans.find((p) => planKey(p) === key);
    if (!original) return;
    setPlans((prev) => prev.map((p) => (planKey(p) === key ? original : p)));
  };

  const onRemovePlan = async (key: string) => {
    setSavingKey(key);
    try {
      const res = await adminFetch(
        `${apiURL}/admin/billing-rates/plans/${key}`,
        { method: "DELETE" },
      );
      if (res.status === 401) return;
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const updated = (await res.json()) as Plan[];
      setPlans(updated);
      setOriginalPlans(updated);
      toast({
        title: "Plan removed",
        description:
          "Organizers in that country now follow the default plan.",
      });
    } catch (e: any) {
      toast({
        title: "Couldn't remove plan",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const availableCountries = useMemo(() => {
    const used = new Set(plans.map((p) => p.countryCode).filter(Boolean));
    return COUNTRIES.filter((c) => !used.has(c.code)).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [plans]);

  const onAddCountry = async () => {
    if (!newCountryCode) return;
    setAddingCountry(true);
    try {
      const res = await adminFetch(`${apiURL}/admin/billing-rates/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode: newCountryCode }),
      });
      if (res.status === 401) return;
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const updated = (await res.json()) as Plan[];
      setPlans(updated);
      setOriginalPlans(updated);
      setNewCountryCode("");
      toast({
        title: "Plan added",
        description: `Created a default-rate plan for ${planLabel(newCountryCode)}.`,
      });
    } catch (e: any) {
      toast({
        title: "Couldn't add country",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setAddingCountry(false);
    }
  };

  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => {
      if (a.countryCode === b.countryCode) return 0;
      if (a.countryCode === null) return -1;
      if (b.countryCode === null) return 1;
      return planLabel(a.countryCode).localeCompare(planLabel(b.countryCode));
    });
  }, [plans]);

  const filteredOrganizers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return organizers;
    return organizers.filter((o) =>
      [o.name, o.organizationName, o.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [organizers, search]);

  const openOrganizer = async (org: OrganizerRow) => {
    setActiveOrg(org);
    setOverrideLoading(true);
    try {
      const res = await adminFetch(
        `${apiURL}/admin/billing-rates/organizer/${org._id}`,
      );
      if (res.status === 401) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const def: Plan = json.default;
      setOverrideDefaults(def);
      const form = emptyOverrideForm();
      for (const d of DIRECTIONS) {
        const rawRate = json.override?.[rateKey(d.key)];
        const rawMode = json.override?.[modeKey(d.key)];
        form[d.key] = {
          enabled: rawRate != null,
          rate: rawRate != null ? Number(rawRate) : def[rateKey(d.key)],
          mode: (rawMode === "percent"
            ? "percent"
            : rawMode === "flat"
              ? "flat"
              : def[modeKey(d.key)]) as RateMode,
        };
      }
      setOverrideForm(form);
    } catch (e: any) {
      toast({
        title: "Failed to load organizer rates",
        description: e?.message,
        variant: "destructive",
      });
      setActiveOrg(null);
    } finally {
      setOverrideLoading(false);
    }
  };

  const closeOrganizer = () => {
    setActiveOrg(null);
    setOverrideForm(emptyOverrideForm());
    setOverrideDefaults(null);
  };

  const saveOverride = async () => {
    if (!activeOrg) return;
    setOverrideSaving(true);
    try {
      const body: Record<string, number | string | null> = {};
      for (const d of DIRECTIONS) {
        const entry = overrideForm[d.key];
        if (entry.enabled) {
          body[rateKey(d.key)] = Number(entry.rate) || 0;
          body[modeKey(d.key)] = entry.mode;
        } else {
          body[rateKey(d.key)] = null;
          body[modeKey(d.key)] = null;
        }
      }
      const res = await adminFetch(
        `${apiURL}/admin/billing-rates/organizer/${activeOrg._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.status === 401) return;
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      toast({
        title: "Organizer rates updated",
        description: `Custom rates saved for ${activeOrg.name}.`,
      });
      closeOrganizer();
      fetchOrganizers();
    } catch (e: any) {
      toast({
        title: "Couldn't save organizer rates",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setOverrideSaving(false);
    }
  };

  const resetOverride = async () => {
    if (!activeOrg) return;
    setOverrideSaving(true);
    try {
      const res = await adminFetch(
        `${apiURL}/admin/billing-rates/organizer/${activeOrg._id}`,
        { method: "DELETE" },
      );
      if (res.status === 401) return;
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      toast({
        title: "Reset to platform default",
        description: `${activeOrg.name} now uses their country's default plan for every category.`,
      });
      closeOrganizer();
      fetchOrganizers();
    } catch (e: any) {
      toast({
        title: "Couldn't reset organizer rates",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setOverrideSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-amber-600" />
            Platform billing rates
          </CardTitle>
          <CardDescription>
            Just 2 rates per plan — Money In applies to every category
            where money flows into the organizer, Money Out applies to
            money the organizer pays out. Each can be a flat amount or a
            percentage of that item's own price. Default rates are
            managed per country — Singapore and India ship built in, and
            you can add any other country below. A country plan's
            currency always follows that country; organizers in a country
            with no explicit plan fall back to the Default plan. Custom
            per-organizer overrides (further down) always follow that
            organizer's own country currency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plansLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end p-3 rounded-lg border bg-slate-50">
                <div className="flex-1">
                  <Label className="text-xs">Add a country plan</Label>
                  <select
                    className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={newCountryCode}
                    onChange={(e) => setNewCountryCode(e.target.value)}
                  >
                    <option value="">Select a country…</option>
                    {availableCountries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={onAddCountry}
                  disabled={!newCountryCode || addingCountry}
                >
                  {addingCountry ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add plan
                </Button>
              </div>

              {sortedPlans.map((plan) => {
                const key = planKey(plan);
                const original = originalPlans.find(
                  (p) => planKey(p) === key,
                );
                const dirty = original ? isDirty(plan, original) : false;
                const saving = savingKey === key;
                return (
                  <div key={key} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">
                          {planLabel(plan.countryCode)}
                        </h3>
                        <Badge variant="secondary">{plan.currency}</Badge>
                      </div>
                      {plan.countryCode !== null && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => onRemovePlan(key)}
                          disabled={saving}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Remove plan
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {DIRECTIONS.map((d) => (
                        <div key={d.key} className="space-y-1">
                          <h4
                            className={`text-xs font-semibold uppercase tracking-wide ${d.accent}`}
                          >
                            {d.label}
                          </h4>
                          <RateField
                            label=""
                            hint={d.includes}
                            currency={plan.currency}
                            value={plan[rateKey(d.key)]}
                            onChange={(e) =>
                              updatePlanField(
                                key,
                                rateKey(d.key),
                                e.target.value === ""
                                  ? 0
                                  : Math.max(0, Number(e.target.value)),
                              )
                            }
                            mode={plan[modeKey(d.key)]}
                            onModeChange={(mode) =>
                              updatePlanField(key, modeKey(d.key), mode)
                            }
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 sm:items-end pt-2 border-t">
                      {plan.countryCode === null ? (
                        <div className="w-full sm:w-32">
                          <Label className="text-xs">Currency</Label>
                          <Input
                            value={plan.currency}
                            onChange={(e) =>
                              updatePlanField(
                                key,
                                "currency",
                                e.target.value.toUpperCase().slice(0, 6),
                              )
                            }
                            placeholder="USD"
                            maxLength={6}
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 flex-1">
                          Currency follows {planLabel(plan.countryCode)} and
                          can't be changed here.
                        </p>
                      )}
                      <div className="text-xs text-slate-500 flex-1 sm:pb-2">
                        {plan.updatedAt && (
                          <span>
                            Last updated{" "}
                            {new Date(plan.updatedAt).toLocaleString()}.
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => onResetPlan(key)}
                          disabled={saving || !dirty}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reset
                        </Button>
                        <Button
                          onClick={() => onSavePlan(key)}
                          disabled={saving || !dirty}
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Saving…
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save rates
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600 leading-relaxed">
                <strong>How charging works:</strong> In flat mode, Money In
                bills that amount per confirmed unit (ticket, stall,
                speaker, sponsor, round table, chair, workshop,
                membership) and Money Out bills that amount per paid
                supplier. In percent mode, the rate applies to that unit's
                own price instead. Set a rate to{" "}
                <code className="font-mono">0</code> to stop billing that
                direction.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-600" />
            Per-organizer overrides
          </CardTitle>
          <CardDescription>
            Give a specific organizer their own Money In and/or Money Out
            rate, in their own country's currency. Left on "platform
            default" keeps following that organizer's country plan above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizers…"
              className="pl-9"
            />
          </div>
          {orgsLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organizer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Rates</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrganizers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No organizers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrganizers.map((o) => (
                    <TableRow key={o._id}>
                      <TableCell>
                        <div className="font-medium">{o.name}</div>
                        {o.organizationName && (
                          <div className="text-xs text-muted-foreground">
                            {o.organizationName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{o.email || "—"}</TableCell>
                      <TableCell className="text-sm">{o.country || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={o.hasOverride ? "default" : "secondary"}>
                          {o.hasOverride ? "Custom rates" : "Platform default"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openOrganizer(o)}
                        >
                          Configure
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!activeOrg} onOpenChange={(o) => !o && closeOrganizer()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Configure rates{activeOrg ? ` — ${activeOrg.name}` : ""}
            </DialogTitle>
            <DialogDescription>
              Turn on "Custom rate" for Money In and/or Money Out if this
              organizer should be billed differently. Left off keeps
              following their country's default plan above
              {overrideDefaults ? ` (${overrideDefaults.currency})` : ""}.
            </DialogDescription>
          </DialogHeader>

          {overrideLoading || !overrideDefaults ? (
            <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-3">
              {DIRECTIONS.map((d) => {
                const entry = overrideForm[d.key];
                return (
                  <div key={d.key} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${d.accent}`}>
                          {d.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.includes}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">
                          Custom rate
                        </Label>
                        <Switch
                          checked={entry.enabled}
                          onCheckedChange={(checked) =>
                            setOverrideForm((f) => ({
                              ...f,
                              [d.key]: { ...f[d.key], enabled: checked },
                            }))
                          }
                        />
                      </div>
                    </div>
                    {entry.enabled ? (
                      <RateField
                        label=""
                        hint=""
                        currency={overrideDefaults.currency}
                        value={entry.rate}
                        onChange={(e) =>
                          setOverrideForm((f) => ({
                            ...f,
                            [d.key]: {
                              ...f[d.key],
                              rate:
                                e.target.value === ""
                                  ? 0
                                  : Math.max(0, Number(e.target.value)),
                            },
                          }))
                        }
                        mode={entry.mode}
                        onModeChange={(mode) =>
                          setOverrideForm((f) => ({
                            ...f,
                            [d.key]: { ...f[d.key], mode },
                          }))
                        }
                      />
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Inherits platform default:{" "}
                        {overrideDefaults[modeKey(d.key)] === "percent"
                          ? `${overrideDefaults[rateKey(d.key)]}%`
                          : `${overrideDefaults.currency} ${overrideDefaults[rateKey(d.key)]}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={resetOverride}
              disabled={overrideSaving || overrideLoading}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset all to default
            </Button>
            <Button
              onClick={saveOverride}
              disabled={overrideSaving || overrideLoading}
            >
              {overrideSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RateField({
  label,
  hint,
  currency,
  value,
  onChange,
  mode,
  onModeChange,
}: {
  label: string;
  hint: string;
  currency: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  mode: RateMode;
  onModeChange: (mode: RateMode) => void;
}) {
  return (
    <div className="space-y-1">
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <div className="flex gap-1">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
            {mode === "percent" ? "%" : currency}
          </span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={onChange}
            className="pl-12"
          />
        </div>
        <div className="flex rounded-md border overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => onModeChange("flat")}
            className={`px-2 text-xs font-medium ${
              mode === "flat"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            Flat
          </button>
          <button
            type="button"
            onClick={() => onModeChange("percent")}
            className={`px-2 text-xs font-medium ${
              mode === "percent"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            %
          </button>
        </div>
      </div>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
