import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ClipboardList, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  REGISTRATION_FORM_FIELDS,
  CATEGORY_LABELS,
  CATEGORY_FEATURE_FLAG,
  isFieldEnabled,
  type RegistrationFormCategory,
  type RegistrationFormFieldsConfig,
} from "@/lib/registrationFormFields";

const apiURL = __API_URL__;

interface EventLike {
  _id: string;
  title?: string;
  features?: {
    hasStalls?: boolean;
    hasSpeakers?: boolean;
    hasRoundTables?: boolean;
    hasWorkshops?: boolean;
  };
  registrationFormFields?: RegistrationFormFieldsConfig;
}

const ALL_CATEGORIES: RegistrationFormCategory[] = [
  "stall",
  "speaker",
  "roundTable",
  "workshop",
];

export function RegistrationFormsDialog({
  event,
  open,
  onOpenChange,
  onSaved,
}: {
  event: EventLike | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (updated: EventLike) => void;
}) {
  const { toast } = useToast();
  const [config, setConfig] = useState<RegistrationFormFieldsConfig>({});
  const [tab, setTab] = useState<RegistrationFormCategory | "">("");
  const [saving, setSaving] = useState(false);

  const activeCategories = ALL_CATEGORIES.filter(
    (c) => !!event?.features?.[CATEGORY_FEATURE_FLAG[c] as keyof NonNullable<EventLike["features"]>],
  );

  useEffect(() => {
    if (!open || !event) return;
    setConfig(event.registrationFormFields || {});
    setTab((activeCategories[0] as RegistrationFormCategory) || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?._id]);

  const toggleField = (category: RegistrationFormCategory, key: string, value: boolean) => {
    setConfig((prev) => ({
      ...prev,
      [category]: { ...(prev[category] || {}), [key]: value },
    }));
  };

  const save = async () => {
    if (!event) return;
    setSaving(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(
        `${apiURL}/events/${event._id}/registration-form-fields`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ registrationFormFields: config }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || "Failed to save");
      toast({ title: "Registration forms updated" });
      onSaved({ ...event, registrationFormFields: config });
    } catch (err: any) {
      toast({
        title: "Couldn't save",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Registration Forms
          </DialogTitle>
          <DialogDescription>
            {event?.title ? `${event.title} · ` : ""}Choose which fields
            appear on this event's public application forms. Fields you
            turn off are also hidden from the matching Participants detail
            view.
          </DialogDescription>
        </DialogHeader>

        {activeCategories.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            No Stall, Speaker, Round Table, or Workshop modules are enabled
            for this event yet — turn one on in Venue Setup → Event
            Sections first.
          </div>
        ) : (
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as RegistrationFormCategory)}
          >
            <TabsList
              className="grid w-full"
              style={{
                gridTemplateColumns: `repeat(${activeCategories.length}, minmax(0, 1fr))`,
              }}
            >
              {activeCategories.map((c) => (
                <TabsTrigger key={c} value={c} className="text-xs">
                  {CATEGORY_LABELS[c]}
                </TabsTrigger>
              ))}
            </TabsList>

            {activeCategories.map((c) => {
              const toggleable = REGISTRATION_FORM_FIELDS[c].filter(
                (f) => !f.alwaysOn,
              );
              const alwaysOn = REGISTRATION_FORM_FIELDS[c].filter(
                (f) => f.alwaysOn,
              );
              return (
                <TabsContent key={c} value={c} className="space-y-4 mt-4">
                  {alwaysOn.length > 0 && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                      <p className="text-xs font-medium text-emerald-800 mb-1 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Always included
                      </p>
                      <p className="text-xs text-emerald-700">
                        {alwaysOn.map((f) => f.label).join(" · ")}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    {toggleable.map((f) => (
                      <div
                        key={f.key}
                        className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                      >
                        <Label
                          htmlFor={`${c}-${f.key}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {f.label}
                        </Label>
                        <Switch
                          id={`${c}-${f.key}`}
                          checked={isFieldEnabled(config, c, f.key)}
                          onCheckedChange={(v) => toggleField(c, f.key, v)}
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {activeCategories.length > 0 && (
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
