import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Link as LinkIcon, Sparkles, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface ImportedEventFields {
  title?: string;
  category?: string;
  description?: string;
  startDate?: string;
  time?: string;
  endDate?: string;
  endTime?: string;
  location?: string;
  address?: string;
  visibility?: "public" | "private";
  tags?: string[];
  ageRestriction?: string;
  dresscode?: string;
  specialInstructions?: string;
  refundPolicy?: string;
  termsAndConditions?: string;
  // Venue Setup tab
  venue?: {
    width?: number;
    height?: number;
    hasMainStage?: boolean;
  };
  // Spaces / Round Tables / Speakers tabs
  stalls?: Array<{
    name: string;
    count?: number;
    width?: number;
    height?: number;
    tablePrice?: number;
    bookingPrice?: number;
    depositPrice?: number;
  }>;
  roundTables?: Array<{
    name: string;
    count?: number;
    numberOfChairs?: number;
    sellingMode?: "table" | "chair";
    tablePrice?: number;
    chairPrice?: number;
    tableDiameter?: number;
  }>;
  speakerZones?: Array<{
    name: string;
    isMainStage?: boolean;
    width?: number;
    height?: number;
    slotPrice?: number;
    maxSpeakers?: number;
    maxVisitors?: number;
  }>;
}

const FILLABLE_KEYS: (keyof ImportedEventFields)[] = [
  "title",
  "category",
  "description",
  "startDate",
  "time",
  "endDate",
  "endTime",
  "location",
  "address",
  "visibility",
  "tags",
  "ageRestriction",
  "dresscode",
  "specialInstructions",
  "refundPolicy",
  "termsAndConditions",
  "venue",
  "stalls",
  "roundTables",
  "speakerZones",
];

export function EventUrlImporter({
  currentValues,
  onApply,
}: {
  currentValues: Record<string, any>;
  onApply: (
    payload: {
      fields: ImportedEventFields;
      imageUrl?: string;
      sourceUrl: string;
    },
    options: { overwriteExisting: boolean },
  ) => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [lastFilled, setLastFilled] = useState<string[]>([]);

  const isEmpty = (key: keyof ImportedEventFields) => {
    const v = currentValues[key];
    if (Array.isArray(v)) return v.length === 0;
    return v === undefined || v === null || v === "";
  };

  const runImport = async (overwriteExisting: boolean) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setNotes([]);
    setLastFilled([]);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${__API_URL__}/events/import-from-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Import failed (${res.status})`);
      }
      const fields: ImportedEventFields = data.fields || {};
      const imageUrl: string | undefined = data.imageUrl;
      // Compute which keys we'll actually fill (respect overwrite flag).
      const targetKeys = FILLABLE_KEYS.filter((k) => {
        if (fields[k] === undefined) return false;
        return overwriteExisting || isEmpty(k);
      });
      await onApply(
        { fields, imageUrl, sourceUrl: data.sourceUrl || trimmed },
        { overwriteExisting },
      );
      const filledLabels = targetKeys.map(String);
      if (imageUrl) filledLabels.push("banner");
      setLastFilled(filledLabels);
      setNotes(data.notes || []);
      if (filledLabels.length === 0) {
        toast({
          title: "Nothing to fill",
          description: overwriteExisting
            ? "The URL didn't contain any matching event details."
            : "Your form is already filled — use Overwrite to replace fields.",
        });
      } else {
        toast({
          title: "Imported",
          description: `Filled ${filledLabels.length} field${
            filledLabels.length === 1 ? "" : "s"
          } from the URL.`,
        });
      }
    } catch (e: any) {
      toast({
        title: "Import failed",
        description: e?.message || "Couldn't import that URL.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">
            Import event details from a URL
          </span>
        </div>
        <p className="text-xs text-slate-600">
          Paste a JotForm, Eventbrite, Luma, Meetup, or any event landing-page
          link. AI reads the page and pre-fills the empty fields below — you
          can edit anything before saving.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.eventbrite.com/e/..."
              disabled={loading}
              className="pl-9 h-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && url.trim()) {
                  e.preventDefault();
                  runImport(false);
                }
              }}
            />
          </div>
          <Button
            type="button"
            onClick={() => runImport(false)}
            disabled={!url.trim() || loading}
            className="h-10"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing…
              </>
            ) : (
              "Import"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => runImport(true)}
            disabled={!url.trim() || loading}
            className="h-10"
            title="Overwrite fields that already have values"
          >
            Overwrite
          </Button>
        </div>
        {lastFilled.length > 0 && (
          <div className="text-xs text-emerald-700">
            Filled: {lastFilled.join(", ")}
          </div>
        )}
        {notes.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 flex gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <ul className="space-y-0.5">
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
