import { useCallback, useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import ImageCropModal from "../ui/imageCropModal";
import {
  CalendarDays,
  Eye,
  Loader2,
  Mic,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { t } from "@/i18n/t";

/**
 * Speaker CRM — the organizer's persistent speaker roster.
 *
 * Sits alongside Visitors and Exhibitors. The `speakers` collection fills
 * itself whenever someone applies through the eventfront; this screen is for
 * working that roster directly: adding people the organizer already knows,
 * fixing details, attaching a headshot. Deliberately NO bulk import/export —
 * speakers are a curated, low-volume list, not a spreadsheet import.
 */

type SpeakerProfile = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  organization?: string;
  bio?: string;
  expertise?: string;
  image?: string;
  socialLinks?: { linkedin?: string; twitter?: string; website?: string };
  previousSpeakingExperience?: string;
  organizerNotes?: string;
  totalApplications?: number;
  confirmedSessions?: number;
  lastAppliedAt?: string;
};

const EMPTY_FORM = {
  id: "",
  name: "",
  email: "",
  phone: "",
  title: "",
  organization: "",
  bio: "",
  expertise: "",
  previousSpeakingExperience: "",
  organizerNotes: "",
  image: "",
  socialLinks: { linkedin: "", twitter: "", website: "" },
};

export default function SpeakerCRM() {
  const apiURL = __API_URL__;
  const { toast } = useToast();

  // The roster endpoints are JWT-guarded (they carry contact details and
  // organizer-private notes), so every call sends the organizer's token.
  const authHeaders = () => ({
    Authorization: `Bearer ${sessionStorage.getItem("token") || ""}`,
  });

  const organizerId = useMemo(() => {
    const token = sessionStorage.getItem("token");
    try {
      return token ? ((jwtDecode(token) as any).sub as string) : "";
    } catch {
      return "";
    }
  }, []);

  const [speakers, setSpeakers] = useState<SpeakerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Detail view: which events this speaker has appeared at, and every
  // application they've made.
  const [detail, setDetail] = useState<{
    speaker: SpeakerProfile;
    applications: any[];
    sessions: any[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (s: SpeakerProfile) => {
    setDetail({ speaker: s, applications: [], sessions: [] });
    setDetailLoading(true);
    try {
      const res = await fetch(
        `${apiURL}/speaker-requests/profiles/${s._id}/history`,
        { headers: authHeaders() },
      );
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Couldn't load their history");
      }
      setDetail({
        speaker: json.data.profile || s,
        applications: json.data.applications || [],
        sessions: json.data.sessions || [],
      });
    } catch (err: any) {
      toast({
        title: "Couldn't load speaker history",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const imageUrl = (src?: string) =>
    !src
      ? ""
      : src.startsWith("/")
        ? `${apiURL?.replace("/api", "") || ""}${src}`
        : src;

  const load = useCallback(async () => {
    if (!organizerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${apiURL}/speaker-requests/profiles/organizer/${organizerId}`,
        { headers: authHeaders() },
      );
      const json = await res.json();
      setSpeakers(Array.isArray(json?.data) ? json.data : []);
    } catch {
      toast({
        title: "Couldn't load your speakers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [apiURL, organizerId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return speakers;
    return speakers.filter((s) =>
      [s.name, s.email, s.organization, s.title, s.expertise]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [speakers, search]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setPhotoFile(null);
    setPhotoPreview("");
    setDialogOpen(true);
  };

  const openEdit = (s: SpeakerProfile) => {
    setForm({
      id: s._id,
      name: s.name || "",
      email: s.email || "",
      phone: s.phone || "",
      title: s.title || "",
      organization: s.organization || "",
      bio: s.bio || "",
      expertise: s.expertise || "",
      previousSpeakingExperience: s.previousSpeakingExperience || "",
      organizerNotes: s.organizerNotes || "",
      image: s.image || "",
      socialLinks: {
        linkedin: s.socialLinks?.linkedin || "",
        twitter: s.socialLinks?.twitter || "",
        website: s.socialLinks?.website || "",
      },
    });
    setPhotoFile(null);
    setPhotoPreview("");
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast({
        title: "Name and email are required",
        description: "The email is how a speaker's applications are matched.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      // Multipart throughout so the headshot can ride along with the fields.
      const fd = new FormData();
      fd.append("organizerId", organizerId);
      if (form.id) fd.append("id", form.id);
      fd.append("name", form.name);
      fd.append("email", form.email);
      fd.append("phone", form.phone || "");
      fd.append("title", form.title || "");
      fd.append("organization", form.organization || "");
      fd.append("bio", form.bio || "");
      fd.append("expertise", form.expertise || "");
      fd.append(
        "previousSpeakingExperience",
        form.previousSpeakingExperience || "",
      );
      fd.append("organizerNotes", form.organizerNotes || "");
      fd.append("socialLinks", JSON.stringify(form.socialLinks));
      if (photoFile) fd.append("image", photoFile);

      const res = await fetch(`${apiURL}/speaker-requests/profiles`, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Couldn't save the speaker");
      }
      toast({ title: json?.message || "Speaker saved" });
      setDialogOpen(false);
      await load();
    } catch (err: any) {
      toast({
        title: "Couldn't save",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: SpeakerProfile) => {
    if (
      !window.confirm(
        `Remove ${s.name} from your speaker roster? Their past applications and sessions stay untouched.`,
      )
    )
      return;
    setDeletingId(s._id);
    try {
      const res = await fetch(`${apiURL}/speaker-requests/profiles/${s._id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Couldn't remove the speaker");
      }
      toast({ title: "Speaker removed" });
      setSpeakers((prev) => prev.filter((x) => x._id !== s._id));
    } catch (err: any) {
      toast({
        title: "Couldn't remove",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-indigo-600" />
              Speaker Management
            </CardTitle>
            <CardDescription>
              Manage your persistent speaker roster, and see their past
              applications and sessions.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Search name, email, company...")}
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={openAdd} className="whitespace-nowrap">
              <Plus className="h-4 w-4 mr-1" /> Add Speaker
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading your speakers…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Mic className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="font-medium">
                {speakers.length === 0
                  ? "No speakers yet"
                  : "No speakers match that search"}
              </p>
              {speakers.length === 0 && (
                <p className="text-sm mt-1">
                  Add one directly — or they'll land here on their own when you
                  name a speaker in the Create Event form, or someone applies
                  through one of your event pages.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Speaker</TableHead>
                    <TableHead>Role / Company</TableHead>
                    <TableHead>Expertise</TableHead>
                    <TableHead className="text-center">Applications</TableHead>
                    <TableHead className="text-center">Confirmed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                            {s.image ? (
                              <img
                                src={imageUrl(s.image)}
                                alt={s.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-bold text-muted-foreground">
                                {s.name?.charAt(0)?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {s.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{s.title || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.organization || ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.expertise || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          {s.totalApplications || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            s.confirmedSessions ? "default" : "secondary"
                          }
                        >
                          {s.confirmedSessions || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            title="View sessions & applications"
                            onClick={() => openDetail(s)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(s)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            disabled={deletingId === s._id}
                            onClick={() => remove(s)}
                          >
                            {deletingId === s._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Speaker detail — where they've spoken, and what they've applied for */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                {detail?.speaker?.image ? (
                  <img
                    src={imageUrl(detail.speaker.image)}
                    alt={detail.speaker.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">
                    {detail?.speaker?.name?.charAt(0)?.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate">{detail?.speaker?.name}</p>
                <p className="text-xs font-normal text-muted-foreground truncate">
                  {[detail?.speaker?.title, detail?.speaker?.organization]
                    .filter(Boolean)
                    .join(" · ") || detail?.speaker?.email}
                </p>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">{t("Sessions delivered and applications made by this speaker.")}</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Loading history…
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-lg border p-2">
                  <p className="text-lg font-bold">
                    {detail?.sessions?.length || 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Events spoken at
                  </p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-lg font-bold">
                    {detail?.applications?.length || 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Applications
                  </p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-lg font-bold">
                    {detail?.speaker?.confirmedSessions || 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Confirmed</p>
                </div>
                <div className="rounded-lg border p-2 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {detail?.speaker?.expertise || "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Expertise</p>
                </div>
              </div>

              {detail?.speaker?.bio && (
                <p className="text-sm text-muted-foreground">
                  {detail.speaker.bio}
                </p>
              )}

              {/* Events where they're on the published line-up */}
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-indigo-600" />
                  Sessions
                </p>
                {!detail?.sessions?.length ? (
                  <p className="text-sm text-muted-foreground">
                    Not on any event line-up yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detail.sessions.map((s: any, i: number) => (
                      <div
                        key={`${s.eventId}-${i}`}
                        className="rounded-lg border p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {s.eventTitle}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {s.startDate
                                ? new Date(s.startDate).toLocaleDateString()
                                : ""}
                              {s.location ? ` · ${s.location}` : ""}
                            </p>
                          </div>
                        </div>
                        {(s.slots || []).map((slot: any, j: number) => (
                          <p
                            key={j}
                            className="text-xs text-muted-foreground mt-1"
                          >
                            🎤 {slot.topic}
                            {slot.startTime
                              ? ` — ${slot.startTime}${slot.endTime ? ` to ${slot.endTime}` : ""}`
                              : ""}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Applications made through event pages */}
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Mic className="h-4 w-4 text-indigo-600" />
                  Applications
                </p>
                {!detail?.applications?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No applications through your event pages.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detail.applications.map((a: any) => (
                      <div key={a._id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {a.eventTitle}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {a.sessions?.[0]?.topic || "—"}
                              {a.selectedSlotName
                                ? ` · ${a.selectedSlotName}`
                                : ""}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <Badge
                              variant={
                                a.status === "Completed"
                                  ? "default"
                                  : a.status === "Rejected" ||
                                      a.status === "Cancelled"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {a.status}
                            </Badge>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {a.isCharged && a.fee
                                ? `Fee ${a.fee} · ${a.paymentStatus}`
                                : "Free slot"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const s = detail!.speaker;
                    setDetail(null);
                    openEdit(s);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button onClick={() => setDetail(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / edit speaker */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit Speaker" : "Add Speaker"}
            </DialogTitle>
            <DialogDescription>{t("Saved to your roster and reusable on any future event.")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Headshot */}
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-20 rounded-full border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors bg-muted flex-shrink-0"
                onClick={() =>
                  document.getElementById("speaker-crm-photo")?.click()
                }
              >
                {photoPreview || form.image ? (
                  <img
                    src={photoPreview || imageUrl(form.image)}
                    alt="Speaker"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <input
                id="speaker-crm-photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Always crop first — the photo shows in circular avatars.
                  if (file) setCropUrl(URL.createObjectURL(file));
                  e.target.value = "";
                }}
              />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Speaker photo</p>
                <p>Click to upload — you'll be able to crop it.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("Full Name *")}</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder={t("Speaker's name")}
                />
              </div>
              <div>
                <Label className="text-xs">{t("Email *")}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="speaker@example.com"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Used to match their applications — keep it accurate.
                </p>
              </div>
              <div>
                <Label className="text-xs">{t("Phone")}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+91 …"
                />
              </div>
              <div>
                <Label className="text-xs">{t("Role / Title")}</Label>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. CTO, Professor"
                />
              </div>
              <div>
                <Label className="text-xs">{t("Company / Organization")}</Label>
                <Input
                  value={form.organization}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, organization: e.target.value }))
                  }
                  placeholder={t("Company / University")}
                />
              </div>
              <div>
                <Label className="text-xs">{t("Area of Expertise")}</Label>
                <Input
                  value={form.expertise}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expertise: e.target.value }))
                  }
                  placeholder="e.g. AI/ML, Marketing"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">{t("Bio")}</Label>
              <Textarea
                rows={2}
                value={form.bio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bio: e.target.value }))
                }
                placeholder={t("Short bio shown on the event page")}
              />
            </div>

            <div>
              <Label className="text-xs">{t("Previous Speaking Experience")}</Label>
              <Textarea
                rows={2}
                value={form.previousSpeakingExperience}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    previousSpeakingExperience: e.target.value,
                  }))
                }
                placeholder={t("Conferences, events or talks they've given")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                value={form.socialLinks.linkedin}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    socialLinks: { ...f.socialLinks, linkedin: e.target.value },
                  }))
                }
                placeholder={t("LinkedIn URL")}
              />
              <Input
                value={form.socialLinks.twitter}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    socialLinks: { ...f.socialLinks, twitter: e.target.value },
                  }))
                }
                placeholder={t("Twitter URL")}
              />
              <Input
                value={form.socialLinks.website}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    socialLinks: { ...f.socialLinks, website: e.target.value },
                  }))
                }
                placeholder={t("Website URL")}
              />
            </div>

            <div>
              <Label className="text-xs">{t("Private notes")}</Label>
              <Textarea
                rows={2}
                value={form.organizerNotes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, organizerNotes: e.target.value }))
                }
                placeholder={t("Only you can see this")}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving…
                  </>
                ) : form.id ? (
                  "Save changes"
                ) : (
                  "Add speaker"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Headshot cropper — square, matching the circular avatars used on the
          event page and in the table above. */}
      {cropUrl && (
        <ImageCropModal
          open
          image={cropUrl}
          defaultAspect={1}
          onClose={() => {
            if (cropUrl.startsWith("blob:")) URL.revokeObjectURL(cropUrl);
            setCropUrl(null);
          }}
          onCropComplete={(file: File) => {
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
            if (cropUrl.startsWith("blob:")) URL.revokeObjectURL(cropUrl);
            setCropUrl(null);
          }}
        />
      )}
    </>
  );
}
