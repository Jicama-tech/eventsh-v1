import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import "react-quill/dist/quill.snow.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PhoneField } from "@/components/ui/PhoneField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  GripVertical,
  Calendar,
  Palette,
  Bell,
  Loader2,
  Megaphone,
  ImagePlus,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";

// Rich-text editor for "Our Story" timeline moments — same react-quill setup
// as the commercial CreateEventForm (lazy-loaded, shared toolbar).
const ReactQuill = lazy(() => import("react-quill"));
const storyQuillModules = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "clean"],
  ],
};

// One "Our Story" timeline moment in the form's local state. `image` is a
// preview URL (existing /uploads URL or a local object URL); `file` is set only
// for a freshly-picked image awaiting upload.
type StoryMoment = {
  id: string;
  title: string;
  date: string;
  content: string;
  image: string;
  file: File | null;
};
import {
  EventBanner,
  EventGallery,
  type GalleryImage,
} from "./CreateEventForm";
import {
  MARRIAGE_PRESETS,
  HEADING_FONTS,
  HERO_HEIGHTS,
  HERO_LAYOUTS,
  HEADING_STYLES,
  BACKGROUND_PATTERNS,
  FONT_SCALES,
  GALLERY_LAYOUTS,
  STORY_LAYOUTS,
  MONOGRAM_STYLES,
  TOP_MOTIFS,
  FLORAL_ACCENTS,
  SECTION_LABELS,
  HERO_NAME_CLASS,
  MARRIAGE_FONTS_HREF,
  resolveMarriageTheme,
  buildMarriagePalette,
  type MarriageTheme,
  type MarriageHeadingFont,
  type MarriageSections,
} from "@/lib/marriageThemes";
import MarriageMonogram from "@/components/user/MarriageMonogram";
import MarriageMotif from "@/components/user/MarriageMotif";
import MarriageFloral from "@/components/user/MarriageFloral";

interface MarriageFunctionItem {
  id: string;
  name: string;
  date: string;
  time: string;
  endTime: string;
  venueName: string;
  address: string;
  dressCode: string;
  notes: string;
  // Lodging info specific to this ceremony's location (multi-city weddings).
  accommodation?: string;
  // Whether this ceremony is currently announced as "started" (drives the
  // public page's live bar). Toggled via the announce endpoint, not the form.
  isLive?: boolean;
  announcedAt?: string;
}

interface MarriageEventFormProps {
  onClose: () => void;
  // Receives the multipart FormData; parent decides POST (create) vs PUT (edit).
  onSave: (data: FormData) => Promise<void> | void;
  editMode?: boolean;
  duplicateMode?: boolean;
  initialData?: any;
}

// A labelled color control: native swatch picker + editable hex field, kept
// in sync. Used in the Design tab for the custom-color overrides.
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-0.5"
          aria-label={`${label} picker`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-32 font-mono text-sm"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// A compact placeholder rendering of the chosen gallery layout for the
// Design-tab preview — so changing "Photo gallery layout" visibly updates
// (the real photos only appear on the published Eventfront).
function MiniGalleryPreview({
  layout,
}: {
  layout: MarriageTheme["galleryLayout"];
}) {
  const tileStyle = (i: number): React.CSSProperties => ({
    background: i % 3 === 0 ? "var(--w-accent-soft)" : "var(--w-primary-soft)",
    borderRadius: "var(--w-radius)",
  });

  if (layout === "carousel") {
    return (
      <div className="flex gap-1.5 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="aspect-[4/3] w-1/2 shrink-0"
            style={tileStyle(i)}
          />
        ))}
      </div>
    );
  }
  if (layout === "grid") {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="aspect-square" style={tileStyle(i)} />
        ))}
      </div>
    );
  }
  if (layout === "collage") {
    return (
      <div className="grid auto-rows-[18px] grid-cols-3 gap-1.5">
        <div className="col-span-2 row-span-2" style={tileStyle(0)} />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={tileStyle(i)} />
        ))}
      </div>
    );
  }
  // masonry — staggered heights in columns
  const heights = [26, 38, 28, 40, 24, 34];
  return (
    <div className="columns-3 [column-gap:6px]">
      {heights.map((h, i) => (
        <div
          key={i}
          className="mb-1.5 break-inside-avoid"
          style={{ ...tileStyle(i), height: h }}
        />
      ))}
    </div>
  );
}

// A compact placeholder of the chosen "Our Story" layout for the Design-tab
// preview — so switching templates visibly updates before publishing.
function MiniStoryPreview({
  layout,
}: {
  layout: MarriageTheme["storyLayout"];
}) {
  const img: React.CSSProperties = {
    background: "var(--w-primary-soft)",
    borderRadius: "var(--w-radius)",
  };
  const line: React.CSSProperties = {
    background: "var(--w-accent-soft)",
    borderRadius: "var(--w-radius)",
    height: 6,
  };

  if (layout === "cards") {
    // Centered stack of image cards.
    return (
      <div className="mx-auto flex max-w-[72%] flex-col gap-1.5">
        {[0, 1].map((i) => (
          <div key={i} className="overflow-hidden" style={img}>
            <div style={{ height: 20 }} />
            <div className="space-y-1 p-1.5">
              <div style={{ ...line, width: "60%", margin: "0 auto" }} />
              <div style={{ ...line, width: "85%", margin: "0 auto" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (layout === "feature") {
    // Large alternating image beside text.
    return (
      <div className="flex flex-col gap-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className={`flex items-center gap-2 ${
              i % 2 ? "flex-row-reverse" : ""
            }`}
          >
            <div className="h-7 w-3/5" style={img} />
            <div className="flex-1 space-y-1">
              <div style={{ ...line, width: "90%" }} />
              <div style={{ ...line, width: "60%" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  // spine — image on one side of a centre line, text on the other, alternating.
  return (
    <div className="relative py-0.5">
      <div
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
        style={{ background: "var(--w-accent-soft)" }}
      />
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className={`flex items-center gap-2 ${
              i % 2 ? "flex-row-reverse" : ""
            }`}
          >
            <div className="h-7 w-[45%]" style={img} />
            <div className="w-[45%] space-y-1">
              <div style={{ ...line, width: "85%" }} />
              <div style={{ ...line, width: "55%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const newFunctionId = () => `fn-${Math.random().toString(36).slice(2, 9)}`;

const emptyFunction = (name = ""): MarriageFunctionItem => ({
  id: newFunctionId(),
  name,
  date: "",
  time: "",
  endTime: "",
  venueName: "",
  address: "",
  dressCode: "",
  notes: "",
  accommodation: "",
  isLive: false,
  announcedAt: "",
});

/**
 * Dedicated creation/edit form for Personal → "Marriage Function" events.
 * Wedding-shaped (couple, multiple ceremonies, story) rather than the
 * ticket/stall commercial form, but it reuses the commercial form's shell
 * (sticky header + tabs, Card sections) and its banner/gallery components
 * (with cropping) so the two feel identical. Saves into the same events
 * collection via the shared onSave(FormData) contract — top-level
 * startDate/endDate/time/location are derived from the ceremony list so the
 * event renders in My Events and gets a public eventfront link like any event.
 */
export function MarriageEventForm({
  onClose,
  onSave,
  editMode = false,
  duplicateMode = false,
  initialData,
}: MarriageEventFormProps) {
  const { toast } = useToast();
  const [currentTab, setCurrentTab] = useState("couple");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(() => ({
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    partner1Name: initialData?.marriage?.partner1Name ?? "",
    partner2Name: initialData?.marriage?.partner2Name ?? "",
    hostNames: initialData?.marriage?.hostNames ?? "",
    contactName: initialData?.marriage?.contactName ?? "",
    contactPhone: initialData?.marriage?.contactPhone ?? "",
    contactEmail: initialData?.marriage?.contactEmail ?? "",
    ourStory: initialData?.marriage?.ourStory ?? "",
    howWeMet: initialData?.marriage?.howWeMet ?? "",
    accommodations: initialData?.marriage?.accommodations ?? "",
    additionalInfo: initialData?.marriage?.additionalInfo ?? "",
    adBarBgColor: initialData?.marriage?.adBarBgColor ?? "#e11d48",
    adBarTextColor: initialData?.marriage?.adBarTextColor ?? "#ffffff",
    adBarMessage: initialData?.marriage?.adBarMessage ?? "",
    visibility: initialData?.visibility ?? "public",
    inviteLink: initialData?.inviteLink ?? "",
    published: initialData?.published ?? true,
  }));

  const [functions, setFunctions] = useState<MarriageFunctionItem[]>(() => {
    const fromData = Array.isArray(initialData?.functions)
      ? initialData.functions
      : [];
    if (fromData.length > 0) {
      return fromData.map((f: any) => ({
        id: f.id || newFunctionId(),
        name: f.name ?? "",
        date: f.date ?? "",
        time: f.time ?? "",
        endTime: f.endTime ?? "",
        venueName: f.venueName ?? "",
        address: f.address ?? "",
        dressCode: f.dressCode ?? "",
        notes: f.notes ?? "",
        accommodation: f.accommodation ?? "",
        isLive: f.isLive ?? false,
        announcedAt: f.announcedAt ?? "",
      }));
    }
    // Brand-new marriage event: start with one blank Wedding ceremony.
    return [emptyFunction("Wedding")];
  });

  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [gallery, setGallery] = useState<GalleryImage[]>([]);

  // "Our Story" image timeline — unlimited moments, hydrated from an existing
  // event. Each stored image URL is prefixed with the API host for preview.
  const [storyTimeline, setStoryTimeline] = useState<StoryMoment[]>(() =>
    Array.isArray(initialData?.marriage?.storyTimeline)
      ? initialData.marriage.storyTimeline.map((m: any) => ({
          id: m.id || `sm-${Math.random().toString(36).slice(2, 9)}`,
          title: m.title || "",
          date: m.date || "",
          content: m.content || "",
          image: m.image
            ? m.image.startsWith("http")
              ? m.image
              : `${__API_URL__}${m.image}`
            : "",
          file: null,
        }))
      : [],
  );
  const addStoryMoment = () =>
    setStoryTimeline((prev) => [
      ...prev,
      {
        id: `sm-${Math.random().toString(36).slice(2, 9)}`,
        title: "",
        date: "",
        content: "",
        image: "",
        file: null,
      },
    ]);
  const updateStoryMoment = (
    id: string,
    patch: Partial<StoryMoment>,
  ) =>
    setStoryTimeline((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  const removeStoryMoment = (id: string) =>
    setStoryTimeline((prev) => prev.filter((m) => m.id !== id));
  const moveStoryMoment = (id: string, dir: -1 | 1) =>
    setStoryTimeline((prev) => {
      const i = prev.findIndex((m) => m.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const pickStoryImage = (id: string, file: File | null) => {
    if (!file) return;
    updateStoryMoment(id, { file, image: URL.createObjectURL(file) });
  };

  // Eventfront "Site Settings" — colors/font/hero for the public wedding page.
  // Hydrated from the stored theme (or Classic Rose defaults for new events).
  const [theme, setTheme] = useState<MarriageTheme>(() =>
    resolveMarriageTheme(initialData?.marriage?.theme),
  );

  // Load the wedding display fonts so the Design-tab live preview renders the
  // real faces (Great Vibes, Dancing Script, Playfair, …) instead of falling
  // back — matching what the published Eventfront shows.
  useEffect(() => {
    const id = "marriage-form-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = MARRIAGE_FONTS_HREF;
    document.head.appendChild(link);
  }, []);

  // Patch one or more theme fields. Editing any color flips the preset label
  // to "custom" so the UI stops highlighting a preset the colors no longer
  // match (passing an explicit preset, e.g. when applying one, overrides this).
  const patchTheme = (patch: Partial<MarriageTheme>) =>
    setTheme((old) => ({
      ...old,
      preset: patch.preset ?? "custom",
      ...patch,
    }));

  // Toggle a single page section on/off. Keeps the active preset (section
  // visibility is independent of the color palette).
  const patchSections = (patch: Partial<MarriageSections>) =>
    setTheme((old) => ({
      ...old,
      preset: old.preset,
      sections: { ...old.sections, ...patch },
    }));

  // Apply a whole preset — colors + font in one click.
  const applyPreset = (key: string) => {
    const p = MARRIAGE_PRESETS.find((x) => x.key === key);
    if (!p) return;
    setTheme((old) => ({
      ...old,
      preset: p.key,
      primaryColor: p.primaryColor,
      accentColor: p.accentColor,
      bgColor: p.bgColor,
      textColor: p.textColor,
      headingFont: p.headingFont,
    }));
  };

  // Hydrate banner + gallery from an existing/duplicated event. Mirrors the
  // commercial form: edit keeps the original banner server-side (no re-upload
  // needed); duplicate fetches the image back into a File for the POST.
  useEffect(() => {
    if (!(editMode || duplicateMode) || !initialData) return;

    if (initialData.image) {
      setBannerPreview(initialData.image);
      if (duplicateMode) {
        (async () => {
          try {
            const url = initialData.image.startsWith("http")
              ? initialData.image
              : `${__API_URL__}${
                  initialData.image.startsWith("/") ? "" : "/"
                }${initialData.image}`;
            const res = await fetch(url);
            if (!res.ok) return;
            const blob = await res.blob();
            const ext = (initialData.image.split(".").pop() || "jpg").split(
              "?",
            )[0];
            setBannerFile(
              new File([blob], `duplicated-banner.${ext}`, {
                type: blob.type || "image/jpeg",
              }),
            );
          } catch {
            // Non-fatal — organizer can re-upload from the Media tab.
          }
        })();
      }
    }

    if (Array.isArray(initialData.gallery)) {
      setGallery(
        initialData.gallery.map((url: string, i: number) => ({
          id: `existing-${i}`,
          file: null as unknown as File,
          preview: url,
          description: "",
        })),
      );
    }
    // initialData identity is stable per dialog open; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, duplicateMode, initialData?._id]);

  const setField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => setForm((old) => ({ ...old, [key]: value }));

  // ---- Functions (ceremonies) helpers -------------------------------------
  const updateFunction = (id: string, patch: Partial<MarriageFunctionItem>) =>
    setFunctions((old) =>
      old.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );

  const addFunction = (name = "") =>
    setFunctions((old) => [...old, emptyFunction(name)]);

  const removeFunction = (id: string) =>
    setFunctions((old) => old.filter((f) => f.id !== id));

  // Announce a ceremony as "started": flips its live flag (drives the public
  // page's bar) and, when turning on, emails every attending guest. Hits the
  // backend immediately — independent of saving the form — so it needs the
  // event to already exist (edit mode).
  const [announcingId, setAnnouncingId] = useState<string | null>(null);
  const announceFunction = async (
    fn: MarriageFunctionItem,
    isLive: boolean,
  ) => {
    const eventId = initialData?._id;
    if (!eventId) {
      toast({
        title: "Save your wedding first",
        description: "Publish the event, then you can notify guests.",
        variant: "destructive",
      });
      return;
    }
    setAnnouncingId(fn.id);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(
        `${__API_URL__}/events/${eventId}/functions/${fn.id}/announce`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ isLive, notify: isLive }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "Couldn't update");
      // Reflect the new state locally so a later Save doesn't undo it.
      updateFunction(fn.id, {
        isLive,
        announcedAt: isLive ? new Date().toISOString() : fn.announcedAt,
      });
      toast({
        title: isLive ? "Guests notified 🎉" : "Announcement bar turned off",
        description: isLive
          ? `Emailed ${j?.notified ?? 0} guest${
              j?.notified === 1 ? "" : "s"
            }. The “has started” bar is now live on your wedding page.`
          : "The bar no longer shows on your wedding page.",
      });
    } catch (e: any) {
      toast({
        title: "Couldn't notify guests",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAnnouncingId(null);
    }
  };

  // Earliest function date drives the event's startDate (and so the My Events
  // card). Computed live for the summary shown in the Functions tab.
  const derivedDates = useMemo(() => {
    const dated = functions
      .filter((f) => f.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      startDate: dated[0]?.date || "",
      endDate: dated[dated.length - 1]?.date || "",
      firstTime: dated[0]?.time || functions[0]?.time || "",
      firstVenue: functions[0]?.venueName || "",
      firstAddress: functions[0]?.address || "",
    };
  }, [functions]);

  const defaultTitle = useMemo(() => {
    const a = form.partner1Name.trim();
    const b = form.partner2Name.trim();
    if (a && b) return `${a} & ${b}'s Wedding`;
    if (a || b) return `${a || b}'s Wedding`;
    return "";
  }, [form.partner1Name, form.partner2Name]);

  const namedFunctionCount = functions.filter((f) => f.name.trim()).length;

  // CSS variables for the Design-tab live preview (same builder the public
  // Eventfront uses, so the preview matches the published page).
  const themePalette = useMemo(() => buildMarriagePalette(theme), [theme]);

  const handleSubmit = async () => {
    if (saving) return;

    const title = form.title.trim() || defaultTitle;
    if (!title) {
      toast({
        variant: "destructive",
        title: "Add the couple's names",
        description: "Enter both names (or a title) before saving.",
      });
      setCurrentTab("couple");
      return;
    }

    const namedFunctions = functions.filter((f) => f.name.trim());
    if (namedFunctions.length === 0) {
      toast({
        variant: "destructive",
        title: "Add at least one function",
        description: "A marriage event needs at least one ceremony.",
      });
      setCurrentTab("functions");
      return;
    }

    // Derive the required top-level event fields from the ceremony list so the
    // event behaves like any other event in lists/filters. Fall back to today
    // when no ceremony has a date yet.
    const today = new Date().toISOString().slice(0, 10);
    const startDate = derivedDates.startDate || today;
    const endDate = derivedDates.endDate || startDate;

    try {
      setSaving(true);
      const data = new FormData();

      data.append("title", title);
      data.append("description", form.description ?? "");
      data.append("eventType", "personal");
      data.append("category", "Marriage Function");
      data.append("categories", JSON.stringify(["Marriage Function"]));
      data.append("startDate", startDate);
      data.append("endDate", endDate);
      data.append("time", derivedDates.firstTime || "");
      data.append("location", derivedDates.firstVenue || "");
      data.append("address", derivedDates.firstAddress || "");
      data.append("visibility", form.visibility);
      data.append("inviteLink", form.inviteLink ?? "");
      data.append("status", form.published ? "published" : "draft");

      data.append("functions", JSON.stringify(namedFunctions));
      data.append(
        "marriage",
        JSON.stringify({
          partner1Name: form.partner1Name.trim(),
          partner2Name: form.partner2Name.trim(),
          hostNames: form.hostNames.trim(),
          contactName: form.contactName.trim(),
          contactPhone: form.contactPhone.trim(),
          contactEmail: form.contactEmail.trim(),
          ourStory: form.ourStory.trim(),
          howWeMet: form.howWeMet.trim(),
          // Our Story timeline — new files carry hasNewImage (the backend
          // stitches the uploaded storyImages in order); existing moments keep
          // their stored /uploads URL (strip the API host we added for preview).
          storyTimeline: storyTimeline
            .map((m) => ({
              id: m.id,
              title: (m.title || "").trim(),
              date: (m.date || "").trim(),
              content: (m.content || "").trim(),
              image: m.file
                ? undefined
                : (m.image || "").replace(__API_URL__, ""),
              hasNewImage: !!m.file,
            }))
            .filter((m) => m.title || m.content || m.image || m.hasNewImage),
          accommodations: form.accommodations.trim(),
          additionalInfo: form.additionalInfo.trim(),
          adBarBgColor: form.adBarBgColor.trim(),
          adBarTextColor: form.adBarTextColor.trim(),
          adBarMessage: form.adBarMessage.trim(),
          theme,
        }),
      );

      if (bannerFile) data.append("banner", bannerFile);

      // Same gallery contract as the commercial form: a manifest describing
      // each slot (new vs existing) plus the new files under "gallery".
      const galleryManifest = gallery.map((img) =>
        img.file
          ? { filename: img.file.name, description: img.description, type: "new" }
          : { url: img.preview, description: img.description, type: "existing" },
      );
      data.append("galleryManifest", JSON.stringify(galleryManifest));
      gallery.forEach((img) => {
        if (img.file) data.append("gallery", img.file);
      });

      // Our Story timeline images — appended in the same order as the moments
      // flagged hasNewImage above, so the backend can stitch them back in.
      storyTimeline.forEach((m) => {
        if (m.file) data.append("storyImages", m.file);
      });

      await onSave(data);
      // Create mode lands back on the events list; edit keeps the dialog open
      // (parent refreshes the row), matching the commercial form's behaviour.
      if (!editMode) onClose();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Couldn't save",
        description: err?.message || "Something went wrong. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header — mirrors the commercial CreateEventForm */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="ml-2 flex items-center gap-3">
            <h1 className="text-xl font-bold">
              {editMode ? "Edit Wedding" : "Create Wedding"}
            </h1>
            <Badge variant="secondary" className="font-normal">
              Marriage Function
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="buttonOutline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="min-w-32"
            >
              {saving
                ? editMode
                  ? "Updating..."
                  : "Creating..."
                : editMode
                  ? "Update Wedding"
                  : "Create Wedding"}
            </Button>
          </div>
        </div>
      </div>

      {/* Sticky Tabs */}
      <div className="sticky top-[73px] z-40 bg-white border-b">
        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid w-full grid-cols-6 h-12">
            <TabsTrigger value="couple" className="text-sm">
              Couple &amp; Hosts
            </TabsTrigger>
            <TabsTrigger value="functions" className="text-sm">
              Functions
            </TabsTrigger>
            <TabsTrigger value="media" className="text-sm">
              Media
            </TabsTrigger>
            <TabsTrigger value="story" className="text-sm">
              Story
            </TabsTrigger>
            <TabsTrigger value="design" className="text-sm">
              Design
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-sm">
              Settings
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="p-6 max-w-7xl mx-auto">
        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          {/* COUPLE & HOSTS */}
          <TabsContent value="couple" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" /> Couple &amp; Hosts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Partner 1 name *</Label>
                    <Input
                      value={form.partner1Name}
                      onChange={(e) =>
                        setField("partner1Name", e.target.value)
                      }
                      placeholder="e.g., Aarav"
                    />
                  </div>
                  <div>
                    <Label>Partner 2 name *</Label>
                    <Input
                      value={form.partner2Name}
                      onChange={(e) =>
                        setField("partner2Name", e.target.value)
                      }
                      placeholder="e.g., Diya"
                    />
                  </div>
                </div>

                <div>
                  <Label>Event title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    placeholder={
                      defaultTitle || "e.g., Aarav & Diya's Wedding"
                    }
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leave blank to use “
                    {defaultTitle || "Partner 1 & Partner 2's Wedding"}”.
                  </p>
                </div>

                <div>
                  <Label>Hosted by</Label>
                  <Input
                    value={form.hostNames}
                    onChange={(e) => setField("hostNames", e.target.value)}
                    placeholder="e.g., The Sharma & Patel families"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label>Contact name</Label>
                    <Input
                      value={form.contactName}
                      onChange={(e) =>
                        setField("contactName", e.target.value)
                      }
                      placeholder="Point of contact"
                    />
                  </div>
                  <div>
                    <Label>Contact phone</Label>
                    <PhoneField
                      value={form.contactPhone}
                      onChange={(v) => setField("contactPhone", v)}
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <Label>Contact email</Label>
                    <Input
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) =>
                        setField("contactEmail", e.target.value)
                      }
                      placeholder="Email"
                    />
                  </div>
                </div>

                <div>
                  <Label>Welcome note</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    placeholder="A short welcome message for your guests…"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FUNCTIONS */}
          <TabsContent value="functions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Functions</span>
                  {derivedDates.startDate && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {derivedDates.startDate}
                      {derivedDates.endDate &&
                      derivedDates.endDate !== derivedDates.startDate
                        ? ` → ${derivedDates.endDate}`
                        : ""}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {functions.map((fn, idx) => (
                  <div
                    key={fn.id}
                    className="rounded-xl border bg-card p-4 shadow-sm"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        Function {idx + 1}
                      </div>
                      {functions.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFunction(fn.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* "Function has started" notifier — emails every attending
                        guest and shows a live bar on the public page. Only in
                        edit mode (needs a saved event to notify against). */}
                    {editMode && (
                      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-rose-100 bg-rose-50/50 p-2.5">
                        {fn.isLive ? (
                          <>
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                              Live now
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={announcingId === fn.id}
                              onClick={() => announceFunction(fn, false)}
                            >
                              {announcingId === fn.id ? (
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              ) : null}
                              Turn off bar
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={announcingId === fn.id}
                            onClick={() => announceFunction(fn, true)}
                            className="bg-rose-600 hover:bg-rose-700"
                          >
                            {announcingId === fn.id ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <Bell className="mr-1 h-4 w-4" />
                            )}
                            Notify guests it&apos;s started
                          </Button>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Emails all attending guests + shows a “started” bar on
                          your wedding page.
                        </span>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label>Function name *</Label>
                        <Input
                          value={fn.name}
                          onChange={(e) =>
                            updateFunction(fn.id, { name: e.target.value })
                          }
                          placeholder="e.g., Ceremony, Reception, Dinner"
                        />
                      </div>
                      <div>
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={fn.date}
                          onChange={(e) =>
                            updateFunction(fn.id, { date: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Start time</Label>
                          <Input
                            type="time"
                            value={fn.time}
                            onChange={(e) =>
                              updateFunction(fn.id, { time: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>End time</Label>
                          <Input
                            type="time"
                            value={fn.endTime}
                            onChange={(e) =>
                              updateFunction(fn.id, {
                                endTime: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Venue name</Label>
                        <Input
                          value={fn.venueName}
                          onChange={(e) =>
                            updateFunction(fn.id, {
                              venueName: e.target.value,
                            })
                          }
                          placeholder="e.g., Grand Palace Banquet"
                        />
                      </div>
                      <div>
                        <Label>Dress code</Label>
                        <Input
                          value={fn.dressCode}
                          onChange={(e) =>
                            updateFunction(fn.id, {
                              dressCode: e.target.value,
                            })
                          }
                          placeholder="e.g., Traditional / Floral"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Address</Label>
                        <Input
                          value={fn.address}
                          onChange={(e) =>
                            updateFunction(fn.id, { address: e.target.value })
                          }
                          placeholder="Full venue address"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={fn.notes}
                          onChange={(e) =>
                            updateFunction(fn.id, { notes: e.target.value })
                          }
                          placeholder="Anything guests should know for this function…"
                          rows={2}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Accommodation for this function (optional)</Label>
                        <Textarea
                          value={fn.accommodation ?? ""}
                          onChange={(e) =>
                            updateFunction(fn.id, {
                              accommodation: e.target.value,
                            })
                          }
                          placeholder="Where guests stay for this function — hotel, room block, booking code. Handy when functions are on different dates or cities."
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addFunction()}
                  className="w-full"
                >
                  <Plus className="mr-1 h-4 w-4" /> Add function
                </Button>
              </CardContent>
            </Card>

            {/* Announcement bar styling — controls the "<function> has started"
                bar that appears on the public page when you notify guests. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" /> Announcement bar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  When you tap “Notify guests it&apos;s started” on a function, a
                  banner appears at the top of your wedding page. Customize how it
                  looks here.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Bar color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.adBarBgColor || "#e11d48"}
                        onChange={(e) =>
                          setField("adBarBgColor", e.target.value)
                        }
                        className="h-10 w-14 cursor-pointer rounded border"
                      />
                      <Input
                        value={form.adBarBgColor}
                        onChange={(e) =>
                          setField("adBarBgColor", e.target.value)
                        }
                        placeholder="#e11d48"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Text color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.adBarTextColor || "#ffffff"}
                        onChange={(e) =>
                          setField("adBarTextColor", e.target.value)
                        }
                        className="h-10 w-14 cursor-pointer rounded border"
                      />
                      <Input
                        value={form.adBarTextColor}
                        onChange={(e) =>
                          setField("adBarTextColor", e.target.value)
                        }
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Custom message (optional)</Label>
                  <Input
                    value={form.adBarMessage}
                    onChange={(e) => setField("adBarMessage", e.target.value)}
                    placeholder="e.g. The {function} has begun at {venue}! Join us 💛"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leave blank for the default. Use{" "}
                    <code>{"{function}"}</code>, <code>{"{venue}"}</code> and{" "}
                    <code>{"{time}"}</code> as placeholders.
                  </p>
                </div>
                {/* Live preview of the bar — scrolls exactly like the real one
                    on the wedding page. */}
                {(() => {
                  const previewText = (form.adBarMessage || "").trim()
                    ? form.adBarMessage
                        .replace(/\{function\}/gi, "Reception")
                        .replace(/\{venue\}/gi, "Grand Palace")
                        .replace(/\{time\}/gi, "6:00 PM")
                    : "Reception has started!";
                  const line = `🎉 ${previewText}     ·     6:00 PM  ·  Grand Palace`;
                  return (
                    <div
                      className="overflow-hidden rounded-lg py-2.5"
                      style={{
                        background: form.adBarBgColor || "#e11d48",
                        color: form.adBarTextColor || "#ffffff",
                      }}
                    >
                      <div className="flex w-max animate-marquee whitespace-nowrap text-sm font-medium">
                        <span className="px-10">{line}</span>
                        <span className="px-10" aria-hidden="true">
                          {line}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MEDIA — reuses the commercial banner (with crop) + gallery */}
          <TabsContent value="media" className="space-y-6">
            <Card>
              <CardContent className="space-y-8 pt-6">
                <EventBanner
                  bannerFile={bannerFile}
                  setBannerFile={setBannerFile}
                  bannerPreview={bannerPreview}
                  setBannerPreview={setBannerPreview}
                />
                <EventGallery
                  galleryImages={gallery}
                  setGalleryImages={setGallery}
                  maxImages={10}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* STORY */}
          <TabsContent value="story" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Story</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label>How we met</Label>
                  <Textarea
                    value={form.howWeMet}
                    onChange={(e) => setField("howWeMet", e.target.value)}
                    placeholder="The short version of where it all began…"
                    rows={3}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    A short intro shown above your story timeline.
                  </p>
                </div>

                {/* ── Our Story timeline builder ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Our Story timeline</Label>
                      <p className="text-xs text-muted-foreground">
                        Add as many moments as you like — each with a title,
                        date, rich text and an optional photo. They render as a
                        beautiful timeline on your wedding page.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="buttonOutline"
                      size="sm"
                      onClick={addStoryMoment}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Add moment
                    </Button>
                  </div>

                  {storyTimeline.length === 0 && (
                    <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-center text-sm text-muted-foreground">
                      No moments yet. Click <strong>Add moment</strong> to start
                      your story timeline.
                    </div>
                  )}

                  {storyTimeline.map((m, idx) => (
                    <div
                      key={m.id}
                      className="rounded-lg border bg-white p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold text-rose-600">
                          {idx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={idx === 0}
                            onClick={() => moveStoryMoment(m.id, -1)}
                            title="Move up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={idx === storyTimeline.length - 1}
                            onClick={() => moveStoryMoment(m.id, 1)}
                            title="Move down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => removeStoryMoment(m.id)}
                            title="Remove moment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Title</Label>
                          <Input
                            value={m.title}
                            onChange={(e) =>
                              updateStoryMoment(m.id, { title: e.target.value })
                            }
                            placeholder="e.g. The day we met"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Date / label</Label>
                          <Input
                            value={m.date}
                            onChange={(e) =>
                              updateStoryMoment(m.id, { date: e.target.value })
                            }
                            placeholder="e.g. June 2019"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Story</Label>
                        <div className="rounded-md bg-white">
                          <Suspense
                            fallback={
                              <div className="h-[150px] animate-pulse rounded-md border bg-muted" />
                            }
                          >
                            <ReactQuill
                              theme="snow"
                              value={m.content}
                              modules={storyQuillModules}
                              onChange={(content) =>
                                updateStoryMoment(m.id, { content })
                              }
                              placeholder="Tell this part of your journey…"
                              className="[&_.ql-editor]:min-h-[130px]"
                            />
                          </Suspense>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Photo (optional)</Label>
                        {m.image ? (
                          <div className="relative mt-1 w-full max-w-xs overflow-hidden rounded-md border">
                            <img
                              src={m.image}
                              alt={m.title || "Story moment"}
                              className="h-40 w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateStoryMoment(m.id, {
                                  image: "",
                                  file: null,
                                })
                              }
                              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                              title="Remove photo"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="mt-1 flex h-24 w-full max-w-xs cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-slate-50 text-sm text-muted-foreground hover:bg-slate-100">
                            <ImagePlus className="h-5 w-5" />
                            Add a photo
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) =>
                                pickStoryImage(
                                  m.id,
                                  e.target.files?.[0] || null,
                                )
                              }
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Guest logistics — shown on the wedding page and included in the
                RSVP confirmation email every guest receives. */}
            <Card>
              <CardHeader>
                <CardTitle>Guest Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label>Accommodations</Label>
                  <Textarea
                    value={form.accommodations}
                    onChange={(e) =>
                      setField("accommodations", e.target.value)
                    }
                    placeholder="Suggested hotels, room blocks, booking codes, nearby stays…"
                    rows={4}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Included in the RSVP confirmation email guests receive.
                  </p>
                </div>
                <div>
                  <Label>Additional information</Label>
                  <Textarea
                    value={form.additionalInfo}
                    onChange={(e) =>
                      setField("additionalInfo", e.target.value)
                    }
                    placeholder="Travel & parking, gifts/registry, dress code notes, anything else guests should know…"
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DESIGN — Eventfront "Site Settings": skin the public wedding page */}
          <TabsContent value="design" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              {/* ---- Controls ---- */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" /> Theme
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Pick a ready-made palette, then fine-tune the colors below.
                      This styles the public wedding page guests see.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Presets */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {MARRIAGE_PRESETS.map((p) => {
                        const active = theme.preset === p.key;
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => applyPreset(p.key)}
                            className={`flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition ${
                              active
                                ? "border-primary ring-2 ring-primary/20"
                                : "border-muted hover:border-primary/50"
                            }`}
                          >
                            <span
                              className="h-10 w-full rounded-md"
                              style={{
                                background: `linear-gradient(120deg, ${p.bgColor} 0%, ${p.primaryColor} 60%, ${p.accentColor} 100%)`,
                              }}
                            />
                            <span className="text-xs font-medium">{p.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom colors */}
                    <div>
                      <Label className="text-sm font-semibold">
                        Custom colors
                      </Label>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <ColorField
                          label="Accent (primary)"
                          value={theme.primaryColor}
                          onChange={(v) => patchTheme({ primaryColor: v })}
                        />
                        <ColorField
                          label="Secondary accent"
                          value={theme.accentColor}
                          onChange={(v) => patchTheme({ accentColor: v })}
                        />
                        <ColorField
                          label="Page background"
                          value={theme.bgColor}
                          onChange={(v) => patchTheme({ bgColor: v })}
                        />
                        <ColorField
                          label="Text color"
                          value={theme.textColor}
                          onChange={(v) => patchTheme({ textColor: v })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Typography &amp; layout</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <Label className="text-sm">Heading font</Label>
                      <Select
                        value={theme.headingFont}
                        onValueChange={(v) =>
                          patchTheme({
                            headingFont: v as MarriageHeadingFont,
                            // font change keeps the preset (it's still that
                            // palette) unless colors were already customized.
                            preset: theme.preset,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.keys(HEADING_FONTS) as MarriageHeadingFont[]
                          ).map((k) => (
                            <SelectItem key={k} value={k}>
                              {HEADING_FONTS[k].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-sm">Display size</Label>
                        <Select
                          value={theme.fontScale}
                          onValueChange={(v) =>
                            patchTheme({
                              fontScale: v as MarriageTheme["fontScale"],
                              preset: theme.preset,
                            })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FONT_SCALES.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Hero height</Label>
                        <Select
                          value={theme.heroHeight}
                          onValueChange={(v) =>
                            patchTheme({
                              heroHeight: v as MarriageTheme["heroHeight"],
                              preset: theme.preset,
                            })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {HERO_HEIGHTS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Name layout</Label>
                      <Select
                        value={theme.heroLayout}
                        onValueChange={(v) =>
                          patchTheme({
                            heroLayout: v as MarriageTheme["heroLayout"],
                            preset: theme.preset,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HERO_LAYOUTS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">
                        Hero overlay — {theme.heroOverlay}%
                      </Label>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Darkens the banner photo so the couple's names stay
                        readable. Higher = darker.
                      </p>
                      <input
                        type="range"
                        min={0}
                        max={80}
                        step={5}
                        value={theme.heroOverlay}
                        onChange={(e) =>
                          patchTheme({
                            heroOverlay: Number(e.target.value),
                            preset: theme.preset,
                          })
                        }
                        className="w-full accent-primary"
                        aria-label="Hero overlay darkness"
                      />
                    </div>

                    <div>
                      <Label className="text-sm">Corner style</Label>
                      <div className="mt-2 flex gap-2">
                        {(["rounded", "minimal"] as const).map((c) => (
                          <Button
                            key={c}
                            type="button"
                            variant={
                              theme.cornerStyle === c
                                ? "default"
                                : "buttonOutline"
                            }
                            size="sm"
                            onClick={() =>
                              patchTheme({
                                cornerStyle: c,
                                preset: theme.preset,
                              })
                            }
                            className="capitalize"
                          >
                            {c}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Hero</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <Label className="text-sm">Top emblem</Label>
                      <Select
                        value={theme.topMotif}
                        onValueChange={(v) =>
                          patchTheme({
                            topMotif: v as MarriageTheme["topMotif"],
                            preset: theme.preset,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TOP_MOTIFS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        A devotional or floral emblem crowning the invitation
                        (Ganesha, Om, lotus, kalash…).
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm">Floral framing</Label>
                      <Select
                        value={theme.floralAccents}
                        onValueChange={(v) =>
                          patchTheme({
                            floralAccents:
                              v as MarriageTheme["floralAccents"],
                            preset: theme.preset,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FLORAL_ACCENTS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Botanical leaves &amp; blossoms framing the hero corners.
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm">Hero tagline</Label>
                      <Input
                        value={theme.heroTagline}
                        onChange={(e) =>
                          patchTheme({
                            heroTagline: e.target.value,
                            preset: theme.preset,
                          })
                        }
                        placeholder="are getting married"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        The line under the couple's names. Leave blank to hide
                        it.
                      </p>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label className="text-sm">Show monogram</Label>
                        <p className="text-xs text-muted-foreground">
                          A circular badge with the couple's initials.
                        </p>
                      </div>
                      <Switch
                        checked={theme.showMonogram}
                        onCheckedChange={(c) =>
                          patchTheme({ showMonogram: c, preset: theme.preset })
                        }
                      />
                    </div>
                    {theme.showMonogram && (
                      <div>
                        <Label className="text-sm">Monogram style</Label>
                        <Select
                          value={theme.monogramStyle}
                          onValueChange={(v) =>
                            patchTheme({
                              monogramStyle:
                                v as MarriageTheme["monogramStyle"],
                              preset: theme.preset,
                            })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MONOGRAM_STYLES.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Sections</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Show or hide each part of the wedding page.
                    </p>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    {SECTION_LABELS.map((s) => (
                      <div
                        key={s.key}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <Label className="text-sm">{s.label}</Label>
                        <Switch
                          checked={theme.sections[s.key]}
                          onCheckedChange={(c) =>
                            patchSections({
                              [s.key]: c,
                            } as Partial<MarriageSections>)
                          }
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Style details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <Label className="text-sm">Section heading style</Label>
                      <Select
                        value={theme.headingStyle}
                        onValueChange={(v) =>
                          patchTheme({
                            headingStyle: v as MarriageTheme["headingStyle"],
                            preset: theme.preset,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HEADING_STYLES.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Background pattern</Label>
                      <Select
                        value={theme.backgroundPattern}
                        onValueChange={(v) =>
                          patchTheme({
                            backgroundPattern:
                              v as MarriageTheme["backgroundPattern"],
                            preset: theme.preset,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BACKGROUND_PATTERNS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Photo gallery layout</Label>
                      <Select
                        value={theme.galleryLayout}
                        onValueChange={(v) =>
                          patchTheme({
                            galleryLayout:
                              v as MarriageTheme["galleryLayout"],
                            preset: theme.preset,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GALLERY_LAYOUTS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        How the photos in the Media tab are displayed on the
                        wedding page.
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm">Our Story layout</Label>
                      <Select
                        value={theme.storyLayout}
                        onValueChange={(v) =>
                          patchTheme({
                            storyLayout: v as MarriageTheme["storyLayout"],
                            preset: theme.preset,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STORY_LAYOUTS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        How your "Our Story" moments are arranged on the
                        wedding page.
                      </p>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label className="text-sm">Animations</Label>
                        <p className="text-xs text-muted-foreground">
                          Subtle motion like the scroll cue.
                        </p>
                      </div>
                      <Switch
                        checked={theme.animations}
                        onCheckedChange={(c) =>
                          patchTheme({ animations: c, preset: theme.preset })
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ---- Live preview ---- */}
              <div className="lg:sticky lg:top-[150px] lg:self-start">
                <Label className="text-sm font-semibold">Live preview</Label>
                <div
                  style={{
                    ...themePalette.vars,
                    background: "var(--w-pattern-image), var(--w-bg)",
                    backgroundSize: "var(--w-pattern-size), auto",
                    backgroundRepeat: "repeat, no-repeat",
                    color: "var(--w-text)",
                    fontFamily: "var(--w-body-font)",
                    borderRadius: "var(--w-radius)",
                  }}
                  className="relative mt-2 overflow-hidden border shadow-sm"
                >
                  {theme.floralAccents !== "none" && (
                    <div
                      className="absolute inset-0"
                      style={{ color: "var(--w-primary)" }}
                    >
                      <MarriageFloral position="tl" size={84} className="opacity-80" />
                      <MarriageFloral position="br" size={84} className="opacity-80" />
                      {theme.floralAccents === "frame" && (
                        <>
                          <MarriageFloral position="tr" size={84} className="opacity-80" />
                          <MarriageFloral position="bl" size={84} className="opacity-80" />
                        </>
                      )}
                    </div>
                  )}
                  <div className="relative px-6 py-9 text-center">
                    {theme.topMotif !== "none" && (
                      <MarriageMotif
                        variant={theme.topMotif}
                        size={72}
                        className="mb-2"
                      />
                    )}
                    {theme.showMonogram && (
                      <MarriageMonogram
                        left={form.partner1Name || "Aarav"}
                        right={form.partner2Name || "Diya"}
                        variant={theme.monogramStyle}
                        size={92}
                        className="mb-3"
                      />
                    )}
                    <p className="text-[10px] uppercase tracking-[0.3em] opacity-70">
                      Together with their families
                    </p>
                    <h3
                      style={{
                        fontFamily: "var(--w-heading-font)",
                        lineHeight: 1.1,
                      }}
                      className="mt-3 text-3xl font-light"
                    >
                      {form.partner1Name.trim() || "Aarav"}
                      <span style={{ color: "var(--w-primary)" }}> &amp; </span>
                      {form.partner2Name.trim() || "Diya"}
                    </h3>
                    {theme.heroTagline.trim() && (
                      <p className="mt-2 text-[11px] uppercase tracking-[0.25em] opacity-70">
                        {theme.heroTagline}
                      </p>
                    )}
                    <span
                      style={{
                        borderColor: "var(--w-primary-border)",
                        color: "var(--w-primary)",
                        borderRadius: "var(--w-radius)",
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 border px-4 py-1 text-xs"
                    >
                      ♥ Wedding Day
                    </span>
                    <div className="mt-5 flex items-center justify-center gap-2">
                      {[
                        theme.primaryColor,
                        theme.accentColor,
                        theme.bgColor,
                        theme.textColor,
                      ].map((c, i) => (
                        <span
                          key={i}
                          className="h-5 w-5 rounded-full border border-black/10"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled
                      style={{
                        background: "var(--w-primary)",
                        color: "#fff",
                        borderRadius: "var(--w-radius)",
                      }}
                      className="mt-5 px-6 py-2 text-sm font-medium shadow-sm"
                    >
                      RSVP
                    </button>

                    {/* Gallery layout preview */}
                    <div className="mt-6 text-left">
                      <p className="mb-1.5 text-[10px] uppercase tracking-[0.25em] opacity-60">
                        Photos · {theme.galleryLayout}
                      </p>
                      <MiniGalleryPreview layout={theme.galleryLayout} />
                    </div>

                    {/* Our Story layout preview */}
                    <div className="mt-6 text-left">
                      <p className="mb-1.5 text-[10px] uppercase tracking-[0.25em] opacity-60">
                        Our Story · {theme.storyLayout}
                      </p>
                      <MiniStoryPreview layout={theme.storyLayout} />
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  The published Eventfront uses these exact colors and fonts.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label>Visibility</Label>
                  <Select
                    value={form.visibility}
                    onValueChange={(v) => setField("visibility", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="unlisted">
                        Unlisted (only with link)
                      </SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Unlisted is ideal for weddings — only invited guests with
                    the link can view.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="text-base">Publish now</Label>
                    <p className="text-sm text-muted-foreground">
                      Off saves it as a draft you can publish later. Publishing
                      makes the public event link live.
                    </p>
                  </div>
                  <Switch
                    checked={form.published}
                    onCheckedChange={(c) => setField("published", c)}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  {namedFunctionCount} function
                  {namedFunctionCount === 1 ? "" : "s"} added.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default MarriageEventForm;
