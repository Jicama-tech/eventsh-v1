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
import { Loader2, ClipboardList, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  REGISTRATION_FORM_FIELDS,
  CATEGORY_LABELS,
  CATEGORY_FEATURE_FLAG,
  isFieldEnabled,
  getCustomFields,
  type CustomFormField,
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
    hasScheduledSpaces?: boolean;
  };
  registrationFormFields?: RegistrationFormFieldsConfig;
}

const ALL_CATEGORIES: RegistrationFormCategory[] = [
  "stall",
  "speaker",
  "roundTable",
  "workshop",
  "scheduledSpace",
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

  // Organizer-defined extra questions are built but hidden for now — add
  // "scheduledSpace" here to show the "Your own questions" editor again.
  const CUSTOM_FIELD_CATEGORIES: RegistrationFormCategory[] = [];

  const setCustomFields = (
    category: RegistrationFormCategory,
    next: CustomFormField[],
  ) => {
    setConfig((prev) => ({
      ...prev,
      customFields: { ...(prev.customFields || {}), [category]: next },
    }));
  };

  const addCustomField = (category: RegistrationFormCategory) => {
    setCustomFields(category, [
      ...getCustomFields(config, category),
      {
        id: `cf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        label: "",
        type: "text",
        required: false,
      },
    ]);
  };

  const updateCustomField = (
    category: RegistrationFormCategory,
    id: string,
    patch: Partial<CustomFormField>,
  ) => {
    setCustomFields(
      category,
      getCustomFields(config, category).map((f) =>
        f.id === id ? { ...f, ...patch } : f,
      ),
    );
  };

  const save = async () => {
    if (!event) return;
    // A custom question needs a label (and a dropdown needs choices);
    // half-filled rows are dropped rather than saved.
    const cleaned: RegistrationFormFieldsConfig = {
      ...config,
      customFields: Object.fromEntries(
        Object.entries(config.customFields || {}).map(([cat, list]) => [
          cat,
          (list || [])
            .map((f) => ({
              ...f,
              label: f.label.trim(),
              options:
                f.type === "select"
                  ? (f.options || []).map((o) => o.trim()).filter(Boolean)
                  : undefined,
            }))
            .filter((f) => f.label && (f.type !== "select" || f.options?.length)),
        ]),
      ),
    };
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
          body: JSON.stringify({ registrationFormFields: cleaned }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || "Failed to save");
      toast({ title: "Registration forms updated" });
      onSaved({ ...event, registrationFormFields: cleaned });
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
            No Stall, Speaker, Round Table, Workshop, or Scheduled Space
            modules are enabled for this event yet — turn one on in Venue
            Setup → Event Sections first.
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
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
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
                  {CUSTOM_FIELD_CATEGORIES.includes(c) && (
                    <div className="space-y-2 pt-2">
                      <div>
                        <p className="text-sm font-medium">Your own questions</p>
                        <p className="text-xs text-muted-foreground">
                          Add extra fields to this form. Answers show up with
                          each request.
                        </p>
                      </div>
                      {getCustomFields(config, c).map((f) => (
                        <div
                          key={f.id}
                          className="rounded-lg border border-border p-3 space-y-2"
                        >
                          <div className="flex gap-2">
                            <Input
                              value={f.label}
                              placeholder="Question, e.g. Number of players"
                              maxLength={120}
                              onChange={(e) =>
                                updateCustomField(c, f.id, { label: e.target.value })
                              }
                            />
                            <Select
                              value={f.type}
                              onValueChange={(v) =>
                                updateCustomField(c, f.id, {
                                  type: v as CustomFormField["type"],
                                })
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Short text</SelectItem>
                                <SelectItem value="textarea">Long text</SelectItem>
                                <SelectItem value="select">Dropdown</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Remove question"
                              onClick={() =>
                                setCustomFields(
                                  c,
                                  getCustomFields(config, c).filter(
                                    (x) => x.id !== f.id,
                                  ),
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {f.type === "select" && (
                            <Input
                              value={(f.options || []).join(", ")}
                              placeholder="Choices, separated by commas"
                              onChange={(e) =>
                                updateCustomField(c, f.id, {
                                  options: e.target.value.split(","),
                                })
                              }
                            />
                          )}
                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor={`req-${f.id}`}
                              className="text-xs font-normal cursor-pointer"
                            >
                              Required
                            </Label>
                            <Switch
                              id={`req-${f.id}`}
                              checked={f.required}
                              onCheckedChange={(v) =>
                                updateCustomField(c, f.id, { required: v })
                              }
                            />
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addCustomField(c)}
                        disabled={getCustomFields(config, c).length >= 20}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add question
                      </Button>
                    </div>
                  )}
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
