import { useEffect, useState } from "react";
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
import { Loader2, Receipt, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminFetch";

const apiURL = __API_URL__;

interface Rates {
  stallRate: number;
  roundTableRate: number;
  chairRate: number;
  speakerRate: number;
  currency: string;
  persisted?: boolean;
  updatedAt?: string;
}

const DEFAULTS: Rates = {
  stallRate: 20,
  roundTableRate: 20,
  chairRate: 5,
  speakerRate: 20,
  currency: "USD",
};

export function BillingRatesPage() {
  const { toast } = useToast();
  const [rates, setRates] = useState<Rates>(DEFAULTS);
  const [original, setOriginal] = useState<Rates>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`${apiURL}/admin/billing-rates`);
      // 401 already triggers the global session-expired redirect; bail quietly.
      if (res.status === 401) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Rates;
      setRates(json);
      setOriginal(json);
    } catch (e: any) {
      toast({
        title: "Failed to load rates",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty =
    rates.stallRate !== original.stallRate ||
    rates.roundTableRate !== original.roundTableRate ||
    rates.chairRate !== original.chairRate ||
    rates.speakerRate !== original.speakerRate ||
    rates.currency !== original.currency;

  const update = (k: keyof Rates) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (k === "currency") {
      setRates((r) => ({ ...r, currency: v.toUpperCase().slice(0, 6) }));
    } else {
      setRates((r) => ({
        ...r,
        [k]: v === "" ? 0 : Math.max(0, Number(v)),
      }));
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await adminFetch(`${apiURL}/admin/billing-rates`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stallRate: Number(rates.stallRate),
          roundTableRate: Number(rates.roundTableRate),
          chairRate: Number(rates.chairRate),
          speakerRate: Number(rates.speakerRate),
          currency: rates.currency,
        }),
      });
      if (res.status === 401) return;
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const updated = (await res.json()) as Rates;
      setRates(updated);
      setOriginal(updated);
      toast({
        title: "Rates updated",
        description:
          "New rates apply immediately to every organizer's outstanding total.",
      });
    } catch (e: any) {
      toast({
        title: "Couldn't save rates",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => setRates(original);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-amber-600" />
            Platform billing rates
          </CardTitle>
          <CardDescription>
            What we charge organizers per booking. Changes take effect
            immediately for "Total Owed" calculations across all organizers.
            Existing recorded payments are not affected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <RateField
                  label="Per booked stall"
                  hint="Each exhibitor booth that gets booked"
                  currency={rates.currency}
                  value={rates.stallRate}
                  onChange={update("stallRate")}
                />
                <RateField
                  label="Per booked round table"
                  hint="Per table that has any chair booked or is fully booked"
                  currency={rates.currency}
                  value={rates.roundTableRate}
                  onChange={update("roundTableRate")}
                />
                <RateField
                  label="Per booked chair"
                  hint="Charged on TOP of round-table rate, per occupied chair"
                  currency={rates.currency}
                  value={rates.chairRate}
                  onChange={update("chairRate")}
                />
                <RateField
                  label="Per confirmed speaker"
                  hint="Each SpeakerRequest in 'Confirmed' status"
                  currency={rates.currency}
                  value={rates.speakerRate}
                  onChange={update("speakerRate")}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:items-end pt-2 border-t">
                <div className="w-full sm:w-32">
                  <Label className="text-xs">Currency</Label>
                  <Input
                    value={rates.currency}
                    onChange={update("currency")}
                    placeholder="USD"
                    maxLength={6}
                  />
                </div>
                <div className="text-xs text-slate-500 flex-1 sm:pb-2">
                  {rates.persisted === false && (
                    <span className="italic">
                      Showing platform defaults. Save once to start tracking
                      changes.
                    </span>
                  )}
                  {rates.updatedAt && (
                    <span>
                      Last updated{" "}
                      {new Date(rates.updatedAt).toLocaleString()}.
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={onReset}
                    disabled={saving || !dirty}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button onClick={onSave} disabled={saving || !dirty}>
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

              <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600 leading-relaxed">
                <strong>How charging works:</strong>{" "}
                Round-table rate and chair rate are{" "}
                <em>additive</em> — a fully booked 8-chair table costs{" "}
                <code className="font-mono">
                  {rates.currency} {rates.roundTableRate} +{" "}
                  {8 * (rates.chairRate || 0)}
                </code>
                . Stalls and speakers are flat per booking. Set any rate to
                <code className="font-mono"> 0</code> to stop billing it.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RateField({
  label,
  hint,
  currency,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  currency: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
          {currency}
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
      <p className="text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}
