import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { jwtDecode } from "jwt-decode";
import {
  downloadImageWithFallback,
  type ImageFormat,
} from "@/lib/imageDownload";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Search,
  Phone,
  Mail,
  Globe,
  Building2,
  Handshake,
  Eye,
  CalendarDays,
  Paperclip,
  Download,
} from "lucide-react";

const apiURL = __API_URL__;

// Same two-country convention used across the organizer CRM (see MyUsers).
const SUPPORTED_COUNTRIES = [
  { name: "India", code: "IN", dialCode: "+91" },
  { name: "Singapore", code: "SG", dialCode: "+65" },
];

interface Sponsor {
  _id: string;
  companyName: string;
  contactName?: string;
  email?: string;
  businessEmail?: string;
  phone?: string;
  countryCode?: string;
  website?: string;
  logo?: string;
  notes?: string;
  showOnBar?: boolean;
  isActive?: boolean;
  createdAt?: string;
}

function getOrganizerId(): string | null {
  const token = sessionStorage.getItem("token");
  if (!token) return null;
  try {
    return (jwtDecode(token) as any).sub || null;
  } catch {
    return null;
  }
}

// One application this sponsor made, joined to its event.
interface SponsorHistoryRow {
  _id: string;
  status: string;
  sponsorTypeName: string;
  amount: number;
  createdAt: string;
  transactionScreenshot?: string;
  eventId?: { _id: string; title?: string; startDate?: string } | string;
}
interface SponsorHistory {
  sponsor: Sponsor;
  requests: SponsorHistoryRow[];
  totals: { events: number; applications: number; confirmedValue: number };
  currency: string;
}

const STATUS_STYLES: Record<string, string> = {
  Applied: "bg-amber-100 text-amber-700",
  Approved: "bg-blue-100 text-blue-700",
  "Payment Submitted": "bg-purple-100 text-purple-700",
  Confirmed: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Cancelled: "bg-stone-200 text-stone-600",
};

function currencySymbol(country?: string): string {
  return country === "SG" ? "SG$" : "₹";
}
function money(amount: number, country?: string): string {
  return `${currencySymbol(country)}${Number(amount || 0).toLocaleString()}`;
}

// Compact headline figure used across the history dialog.
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

// Split a stored phone like "+9198…" into its dial code + national part so the
// edit dialog can re-populate both the country picker and the number field.
function splitPhone(phone?: string): { dialCode: string; number: string } {
  const p = (phone || "").trim();
  const match = SUPPORTED_COUNTRIES.find((c) => p.startsWith(c.dialCode));
  if (match) {
    return { dialCode: match.dialCode, number: p.slice(match.dialCode.length) };
  }
  return { dialCode: SUPPORTED_COUNTRIES[0].dialCode, number: p };
}

const EMPTY = {
  companyName: "",
  contactName: "",
  email: "",
  businessEmail: "",
  countryCode: SUPPORTED_COUNTRIES[0].dialCode,
  phone: "",
  website: "",
  notes: "",
};

/**
 * The organizer's own sponsor directory — businesses they work with, added by
 * hand and reusable across events. Mirrors SuppliersDirectory.
 *
 * Distinct from the per-event Sponsors tab, which lists applications submitted
 * through an event's public page.
 */
export default function SponsorsDirectory() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  // Company logo: a freshly picked file, plus the preview shown in the dialog
  // (an object URL for a new pick, or the stored path when editing).
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Sponsor awaiting delete confirmation, plus the server's refusal (e.g. the
  // sponsor still has applications) shown inline rather than as a toast.
  const [confirmDelete, setConfirmDelete] = useState<Sponsor | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Eye icon → which events this sponsor has backed.
  const [history, setHistory] = useState<SponsorHistory | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  // Which logo format is currently being prepared, if any.
  const [logoBusy, setLogoBusy] = useState<ImageFormat | null>(null);
  // Which row's bar-visibility is mid-save.
  const [barBusy, setBarBusy] = useState<string | null>(null);

  /**
   * Choose whether this sponsor's logo appears in the eventfront sponsor bar.
   * Optimistic — the row flips immediately and reverts if the save fails.
   */
  const toggleOnBar = async (sp: Sponsor, next: boolean) => {
    const organizerId = getOrganizerId();
    if (!organizerId) return;
    setBarBusy(sp._id);
    setSponsors((list) =>
      list.map((x) => (x._id === sp._id ? { ...x, showOnBar: next } : x)),
    );
    try {
      const fd = new FormData();
      fd.append("showOnBar", String(next));
      const res = await fetch(
        `${apiURL}/sponsors/update-by-organizer/${organizerId}/${sp._id}`,
        { method: "PATCH", headers: authHeaders, body: fd },
      );
      if (!res.ok) throw new Error();
      toast({
        title: next ? "Shown on the sponsor bar" : "Hidden from the sponsor bar",
      });
    } catch {
      setSponsors((list) =>
        list.map((x) => (x._id === sp._id ? { ...x, showOnBar: !next } : x)),
      );
      toast({ variant: "destructive", title: "Couldn't update the sponsor bar" });
    } finally {
      setBarBusy(null);
    }
  };

  const saveLogo = async (s: Sponsor, format: ImageFormat) => {
    if (!s?.logo) return;
    setLogoBusy(format);
    try {
      const how = await downloadImageWithFallback(
        `${apiURL}${s.logo}`,
        `${s.companyName}-logo`,
        format,
      );
      if (how === "original") {
        toast({
          title: "Downloaded the original file",
          description:
            "The image couldn't be re-encoded in the browser, so we saved it as uploaded.",
        });
      }
    } catch {
      toast({ variant: "destructive", title: "Couldn't download the logo" });
    } finally {
      setLogoBusy(null);
    }
  };

  const token = sessionStorage.getItem("token");
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const load = useCallback(async () => {
    const organizerId = getOrganizerId();
    if (!organizerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${apiURL}/sponsors/list-by-organizer/${organizerId}`,
        { headers: authHeaders },
      );
      const j = await res.json();
      setSponsors(Array.isArray(j?.data) ? j.data : []);
    } catch {
      toast({ variant: "destructive", title: "Couldn't load sponsors" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sponsors;
    return sponsors.filter((s) =>
      [s.companyName, s.contactName, s.email, s.businessEmail]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [sponsors, search]);

  // Swap the preview to a freshly picked file, releasing the previous blob.
  const pickLogo = (f: File | null) => {
    setLogoFile(f);
    setLogoPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : "";
    });
  };

  const openAdd = () => {
    setForm({ ...EMPTY });
    pickLogo(null);
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (s: Sponsor) => {
    // Stored phones carry their dial code — peel it back off so the picker
    // and the number field each show the right half.
    const { dialCode, number } = splitPhone(s.phone);
    setForm({
      companyName: s.companyName || "",
      contactName: s.contactName || "",
      email: s.email || "",
      businessEmail: s.businessEmail || "",
      countryCode: s.countryCode || dialCode,
      phone: number,
      website: s.website || "",
      notes: s.notes || "",
    });
    // Show the stored logo until they pick a replacement.
    setLogoFile(null);
    setLogoPreview(s.logo ? `${apiURL}${s.logo}` : "");
    setEditingId(s._id);
    setFormOpen(true);
  };

  const openHistory = async (s: Sponsor) => {
    const organizerId = getOrganizerId();
    if (!organizerId) return;
    setHistory(null);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `${apiURL}/sponsors/history/${organizerId}/${s._id}`,
        { headers: authHeaders },
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "");
      setHistory(j.data);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't load this sponsor's events",
        description: e?.message || undefined,
      });
      setHistoryOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  const save = async () => {
    if (!form.companyName.trim()) {
      toast({ variant: "destructive", title: "Company name is required" });
      return;
    }
    const organizerId = getOrganizerId();
    if (!organizerId) return;
    setSaving(true);
    try {
      // Multipart so the logo can ride along. Only fields the DTO accepts —
      // the API rejects unknown properties.
      const fd = new FormData();
      fd.append("companyName", form.companyName.trim());
      fd.append("contactName", form.contactName.trim());
      fd.append("countryCode", form.countryCode);
      // Store the dial code inline, as the supplier CRM and the Excel
      // importer both do — the table renders `phone` on its own.
      fd.append(
        "phone",
        form.phone.trim() ? `${form.countryCode}${form.phone.trim()}` : "",
      );
      fd.append("website", form.website.trim());
      fd.append("notes", form.notes.trim());
      // An empty string fails @IsEmail, so omit the field entirely when blank.
      if (form.email.trim())
        fd.append("email", form.email.trim().toLowerCase());
      if (form.businessEmail.trim())
        fd.append("businessEmail", form.businessEmail.trim().toLowerCase());
      if (logoFile) fd.append("logo", logoFile);

      const url = editingId
        ? `${apiURL}/sponsors/update-by-organizer/${organizerId}/${editingId}`
        : `${apiURL}/sponsors/create-by-organizer/${organizerId}`;
      const res = await fetch(url, {
        // No Content-Type header — the browser sets the multipart boundary.
        method: editingId ? "PATCH" : "POST",
        headers: authHeaders,
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "");
      toast({ title: editingId ? "Sponsor updated" : "Sponsor added" });
      setFormOpen(false);
      load();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: editingId ? "Couldn't update sponsor" : "Couldn't add sponsor",
        description: e?.message || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  // Runs only after the organizer confirms in the dialog. A refusal from the
  // server (sponsor still has applications) stays on screen inside the dialog
  // so it can actually be read.
  const confirmRemove = async () => {
    const s = confirmDelete;
    const organizerId = getOrganizerId();
    if (!s || !organizerId) return;
    setDeletingId(s._id);
    setDeleteError(null);
    try {
      const res = await fetch(
        `${apiURL}/sponsors/delete-by-organizer/${organizerId}/${s._id}`,
        { method: "DELETE", headers: authHeaders },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "Could not remove the sponsor");
      setSponsors((list) => list.filter((x) => x._id !== s._id));
      setConfirmDelete(null);
      toast({ title: "Sponsor removed" });
    } catch (e: any) {
      setDeleteError(e?.message || "Could not remove the sponsor");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-primary" /> Sponsor Management
            </CardTitle>
            <CardDescription>
              Your directory of sponsoring businesses, reused across events.
              Applications from an event's public page land here automatically.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={openAdd} variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" /> Add Sponsor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sponsors…"
              className="pl-9"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {sponsors.length === 0
                ? "No sponsors yet. Click “Add Sponsor” to create one."
                : "No sponsors match your search."}
            </p>
          ) : (
            <div className="app-scroll overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-center">On bar</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {s.logo ? (
                            <img
                              src={`${apiURL}${s.logo}`}
                              alt=""
                              className="h-8 w-8 rounded bg-muted/40 object-contain"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-muted/40">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium">{s.companyName}</div>
                            {s.website && (
                              <a
                                href={s.website}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Globe className="h-3 w-3" /> Website
                              </a>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.contactName || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          {s.email && (
                            <span className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                              {s.email}
                            </span>
                          )}
                          {s.businessEmail && s.businessEmail !== s.email && (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              {s.businessEmail}
                            </span>
                          )}
                          {!s.email && !s.businessEmail && "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {/* `phone` is stored with its dial code already
                            included (matches the supplier convention). */}
                        {s.phone ? (
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            {s.phone}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      {/* Only logos of selected sponsors reach the bar. */}
                      <TableCell className="text-center">
                        {s.logo ? (
                          <Switch
                            checked={s.showOnBar !== false}
                            disabled={barBusy === s._id}
                            onCheckedChange={(v) => toggleOnBar(s, v)}
                            aria-label="Show this sponsor on the event bar"
                          />
                        ) : (
                          <span
                            className="text-[11px] text-muted-foreground"
                            title="Add a logo to show this sponsor on the bar"
                          >
                            no logo
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openHistory(s)}
                            title="View events"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEdit(s)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => {
                              setDeleteError(null);
                              setConfirmDelete(s);
                            }}
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* ── Confirm removal ────────────────────────────────────── */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this sponsor?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmDelete?.companyName}</strong> will be removed from
              your sponsor directory. This can't be undone. Their applications
              on individual events aren't affected.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {deleteError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog open so a refusal stays visible.
                e.preventDefault();
                confirmRemove();
              }}
              disabled={!!deletingId}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Which events this sponsor has backed ───────────────── */}
      <Dialog
        open={historyOpen}
        onOpenChange={(o) => !o && setHistoryOpen(false)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {history?.sponsor?.companyName || "Sponsor"}
            </DialogTitle>
            <DialogDescription>
              {history?.sponsor?.contactName
                ? `${history.sponsor.contactName} · `
                : ""}
              {history?.sponsor?.email || "No email on file"}
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              {/* Logo, with a re-encoded download in either format */}
              {history?.sponsor?.logo && (
                <section className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                  <img
                    src={`${apiURL}${history.sponsor.logo}`}
                    alt={history.sponsor.companyName}
                    className="max-h-24 rounded bg-muted/30 object-contain p-2"
                  />
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => saveLogo(history.sponsor, "png")}
                      disabled={logoBusy !== null}
                    >
                      {logoBusy === "png" ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-1.5 h-4 w-4" />
                      )}
                      PNG
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => saveLogo(history.sponsor, "jpeg")}
                      disabled={logoBusy !== null}
                    >
                      {logoBusy === "jpeg" ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-1.5 h-4 w-4" />
                      )}
                      JPG
                    </Button>
                  </div>
                </section>
              )}

              {/* Headline numbers */}
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Events" value={String(history?.totals.events ?? 0)} />
                <Stat
                  label="Applications"
                  value={String(history?.totals.applications ?? 0)}
                />
                <Stat
                  label="Confirmed value"
                  value={money(
                    history?.totals.confirmedValue ?? 0,
                    history?.currency,
                  )}
                />
              </div>

              <section className="rounded-xl border p-3">
                <h4 className="mb-2 flex items-center gap-1.5 font-semibold">
                  <CalendarDays className="h-4 w-4 text-primary" /> Events
                  sponsored
                </h4>
                {!history?.requests?.length ? (
                  <p className="text-xs text-muted-foreground">
                    No applications from this sponsor yet. Directory entries and
                    public applications are matched on email — make sure the
                    email here matches the one they apply with.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {history.requests.map((r) => {
                      const ev =
                        r.eventId && typeof r.eventId === "object"
                          ? r.eventId
                          : null;
                      return (
                        <li
                          key={r._id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="font-medium">
                              {ev?.title || "Event"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {r.sponsorTypeName}
                              {ev?.startDate
                                ? ` · ${new Date(ev.startDate).toLocaleDateString()}`
                                : ""}
                              {r.createdAt
                                ? ` · applied ${new Date(r.createdAt).toLocaleDateString()}`
                                : ""}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {r.transactionScreenshot && (
                              <a
                                href={`${apiURL}${r.transactionScreenshot}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                                title="Payment proof"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <span className="font-medium">
                              {money(r.amount, history.currency)}
                            </span>
                            <Badge
                              className={`${STATUS_STYLES[r.status] || "bg-stone-100 text-stone-600"} hover:bg-transparent`}
                            >
                              {r.status}
                            </Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {history?.sponsor?.notes && (
                <section className="rounded-xl border p-3">
                  <h4 className="mb-1 font-semibold">Notes</h4>
                  <p className="text-xs text-muted-foreground">
                    {history.sponsor.notes}
                  </p>
                </section>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
            {history?.sponsor && (
              <Button
                onClick={() => {
                  setHistoryOpen(false);
                  openEdit(history.sponsor);
                }}
              >
                <Pencil className="mr-1.5 h-4 w-4" /> Edit sponsor
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add / edit sponsor ─────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        {/* Capped height with the fields scrolling on their own, so the title
            and the Save/Cancel buttons stay put on short screens. */}
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {editingId ? "Edit sponsor" : "Add sponsor"}
            </DialogTitle>
            <DialogDescription>
              Keep your own record of the businesses sponsoring your events.
            </DialogDescription>
          </DialogHeader>
          <div className="-mr-2 grid flex-1 gap-3 overflow-y-auto pr-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Company name *</Label>
              <Input
                value={form.companyName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, companyName: e.target.value }))
                }
              />
            </div>

            {/* Company logo — shown on the event page once a sponsorship
                for this business is confirmed. */}
            <div className="sm:col-span-2">
              <Label className="text-xs">Company logo</Label>
              <div className="mt-1 flex items-center gap-3">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-16 w-16 rounded border bg-white object-contain p-1"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded border bg-muted/30">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => pickLogo(e.target.files?.[0] || null)}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    PNG or SVG with a transparent background works best.
                    {editingId && " Leave empty to keep the current logo."}
                  </p>
                </div>
                {logoPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-red-600"
                    onClick={() => pickLogo(null)}
                    title="Clear selection"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs">Contact person</Label>
              <Input
                value={form.contactName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactName: e.target.value }))
                }
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="priya@company.com"
              />
            </div>
            <div>
              <Label className="text-xs">Business email</Label>
              <Input
                type="email"
                value={form.businessEmail}
                onChange={(e) =>
                  setForm((f) => ({ ...f, businessEmail: e.target.value }))
                }
                placeholder="accounts@company.com"
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <div className="flex gap-2">
                <Select
                  value={form.countryCode}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, countryCode: v }))
                  }
                >
                  <SelectTrigger className="w-24 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.dialCode}>
                        {c.dialCode} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="flex-1"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Website</Label>
              <Input
                value={form.website}
                onChange={(e) =>
                  setForm((f) => ({ ...f, website: e.target.value }))
                }
                placeholder="https://"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Anything worth remembering about this sponsor."
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t pt-3">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save changes" : "Add sponsor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
