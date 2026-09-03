import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "@/hooks/use-toast";
import { jwtDecode } from "jwt-decode";
import {
  downloadImageWithFallback,
  type ImageFormat,
} from "@/lib/imageDownload";
import {
  Loader2,
  RefreshCw,
  Search,
  Handshake,
  Building2,
  Mail,
  Phone,
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
  Paperclip,
  Wallet,
  Eye,
  Download,
} from "lucide-react";
import { t } from "@/i18n/t";

const apiURL = __API_URL__;

function getOrganizerId(): string | null {
  const token = sessionStorage.getItem("token");
  if (!token) return null;
  try {
    return (jwtDecode(token) as any).sub || null;
  } catch {
    return null;
  }
}

interface StatusHistoryEntry {
  status: string;
  note?: string;
  changedAt: string;
  changedBy?: string;
}

interface SponsorApplication {
  _id: string;
  status: string;
  sponsorTypeName: string;
  amount: number;
  collectPayment?: boolean;
  selectedOptions?: string[];
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  countryCode?: string;
  website?: string;
  logo?: string;
  message?: string;
  transactionId?: string;
  transactionScreenshot?: string;
  paymentMethod?: string;
  paymentVerified?: boolean;
  rejectionReason?: string;
  statusHistory?: StatusHistoryEntry[];
  createdAt: string;
  eventId?: { _id: string; title?: string } | string;
}

// SG$ for Singapore, ₹ (INR) for everything else — matches the app convention.
function currencySymbol(country?: string): string {
  return country === "SG" ? "SG$" : "₹";
}
function money(amount: number, country?: string): string {
  return `${currencySymbol(country)}${Number(amount || 0).toLocaleString()}`;
}

const STATUS_STYLES: Record<string, string> = {
  Applied: "bg-amber-100 text-amber-700",
  Approved: "bg-blue-100 text-blue-700",
  "Payment Submitted": "bg-purple-100 text-purple-700",
  Confirmed: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Cancelled: "bg-stone-200 text-stone-600",
};

function eventTitle(app: SponsorApplication): string {
  const e = app.eventId;
  if (e && typeof e === "object") return e.title || "—";
  return "—";
}

/**
 * Sponsorship applications with approve / reject and payment verification.
 *
 * Pass `eventId` to scope it to a single event (the per-event Participants
 * drill-down); omit it for the organizer-wide inbox. Self-contained (own
 * fetch + search) either way.
 */
export default function SponsorRequests({ eventId }: { eventId?: string } = {}) {
  const [apps, setApps] = useState<SponsorApplication[]>([]);
  // Organizer's country code ("SG" / "IN") — drives the currency symbol so the
  // inbox matches what the public sponsor page quoted.
  const [currency, setCurrency] = useState<string>("IN");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selected, setSelected] = useState<SponsorApplication | null>(null);
  const [action, setAction] = useState<
    null | "Approved" | "Rejected" | "Cancelled"
  >(null);
  const [actionNote, setActionNote] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  // Which logo format is currently being prepared, if any.
  const [logoBusy, setLogoBusy] = useState<ImageFormat | null>(null);

  const saveLogo = async (app: SponsorApplication, format: ImageFormat) => {
    if (!app.logo) return;
    setLogoBusy(format);
    try {
      const how = await downloadImageWithFallback(
        `${apiURL}${app.logo}`,
        `${app.companyName}-logo`,
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
    // Event-scoped when mounted under a specific event; otherwise the
    // organizer's whole inbox.
    let url: string;
    if (eventId) {
      url = `${apiURL}/sponsors/event/${eventId}`;
    } else {
      const organizerId = getOrganizerId();
      if (!organizerId) {
        setLoading(false);
        return;
      }
      url = `${apiURL}/sponsors/organizer/${organizerId}`;
    }
    setLoading(true);
    try {
      const res = await fetch(url, { headers: authHeaders });
      const j = await res.json();
      setApps(Array.isArray(j?.data) ? j.data : []);
      if (j?.currency) setCurrency(j.currency);
    } catch {
      toast({ variant: "destructive", title: "Couldn't load sponsors" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return [
        a.companyName,
        a.contactName,
        a.email,
        a.sponsorTypeName,
        eventTitle(a),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [apps, search, statusFilter]);

  // Reflect a server response into both the table and the open dialog.
  const applyUpdate = (updated: SponsorApplication) => {
    setSelected((s) => (s ? { ...s, ...updated } : s));
    setApps((list) =>
      list.map((a) =>
        a._id === updated._id
          ? // Keep the populated eventId we already hold — the mutation
            // responses return it as a bare id.
            { ...a, ...updated, eventId: a.eventId }
          : a,
      ),
    );
  };

  // Approve / reject an application.
  const submitAction = async () => {
    if (!selected || !action) return;
    if (action === "Rejected" && !actionNote.trim()) {
      toast({ variant: "destructive", title: "Please add a reason" });
      return;
    }
    setActionBusy(true);
    try {
      const body: Record<string, string> = { status: action };
      if (action === "Rejected") body.rejectionReason = actionNote.trim();
      else if (actionNote.trim()) body.notes = actionNote.trim();
      const res = await fetch(
        `${apiURL}/sponsors/request/${selected._id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(body),
        },
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "");
      applyUpdate(j.data);
      toast({
        title:
          action === "Approved"
            ? "Sponsor approved — they can now pay"
            : action === "Rejected"
              ? "Application rejected"
              : "Sponsorship cancelled",
      });
      setAction(null);
      setActionNote("");
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't update the application",
        description: e?.message || undefined,
      });
    } finally {
      setActionBusy(false);
    }
  };

  // Confirm the sponsor's transfer actually landed.
  const verifyPayment = async () => {
    if (!selected) return;
    setVerifyBusy(true);
    try {
      const res = await fetch(
        `${apiURL}/sponsors/request/${selected._id}/verify-payment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({}),
        },
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "");
      applyUpdate(j.data);
      toast({ title: "Payment verified — sponsorship confirmed" });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't verify the payment",
        description: e?.message || undefined,
      });
    } finally {
      setVerifyBusy(false);
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
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-primary" />
              Sponsor applications
            </span>
            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("Search company, email\u2026")}
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Applied">Applied</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Payment Submitted">
                    Payment Submitted
                  </SelectItem>
                  <SelectItem value="Confirmed">Confirmed</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={load}
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {apps.length === 0
                ? eventId
                  ? "No sponsor applications for this event yet. Share its public page to start receiving them."
                  : "No sponsor applications yet. Add sponsorship tiers to an event and share its public page."
                : "No applications match your search."}
            </p>
          ) : (
            <div className="app-scroll overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sponsor</TableHead>
                    {/* Redundant when the list is already one event's */}
                    {!eventId && <TableHead>Event</TableHead>}
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead className="text-center">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {a.logo ? (
                            <img
                              src={`${apiURL}${a.logo}`}
                              alt=""
                              className="h-8 w-8 rounded object-contain bg-muted/40"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-muted/40">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium">{a.companyName}</div>
                            <div className="text-xs text-muted-foreground">
                              {a.contactName}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      {!eventId && (
                        <TableCell className="text-sm">
                          {eventTitle(a)}
                        </TableCell>
                      )}
                      <TableCell className="text-sm">
                        {a.sponsorTypeName}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {a.collectPayment === false
                          ? "Non-cash"
                          : money(a.amount, currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={`${STATUS_STYLES[a.status] || "bg-stone-100 text-stone-600"} hover:bg-transparent`}
                        >
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.createdAt
                          ? new Date(a.createdAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelected(a);
                            setAction(null);
                            setActionNote("");
                          }}
                          title="View application"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Application detail dialog ───────────────────────────── */}
      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setAction(null);
            setActionNote("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {selected.companyName}
                  <Badge
                    className={`${STATUS_STYLES[selected.status] || "bg-stone-100 text-stone-600"} hover:bg-transparent`}
                  >
                    {selected.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {selected.sponsorTypeName} ·{" "}
                  {selected.collectPayment === false
                    ? "Non-cash"
                    : money(selected.amount, currency)}{" "}
                  · applied{" "}
                  {selected.createdAt
                    ? new Date(selected.createdAt).toLocaleString()
                    : "—"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                {/* Business logo — downloadable in either format so the
                    organizer can drop it straight into print or a deck. */}
                {selected.logo && (
                  <section className="rounded-xl border p-3">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Business logo")}</h4>
                    <div className="flex flex-wrap items-center gap-3">
                      <img
                        src={`${apiURL}${selected.logo}`}
                        alt={selected.companyName}
                        className="max-h-28 rounded bg-muted/30 object-contain p-2"
                      />
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => saveLogo(selected, "png")}
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
                          onClick={() => saveLogo(selected, "jpeg")}
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
                    </div>
                  </section>
                )}

                {/* Contact */}
                <section className="rounded-xl border p-3">
                  <h4 className="mb-2 flex items-center gap-1.5 font-semibold">
                    <Building2 className="h-4 w-4 text-primary" /> Business
                    details
                  </h4>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <Detail label="Company" value={selected.companyName} />
                    <Detail label="Contact" value={selected.contactName} />
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {selected.email}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {selected.phone
                        ? `${selected.countryCode || ""}${selected.phone}`
                        : "—"}
                    </div>
                    {selected.website && (
                      <a
                        href={selected.website}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {selected.website}
                      </a>
                    )}
                  </div>
                  {selected.message && (
                    <p className="mt-2 rounded-lg bg-muted/40 p-2 text-xs">
                      {selected.message}
                    </p>
                  )}
                </section>

                {/* Non-cash tier — what the sponsor chose instead of paying */}
                {selected.collectPayment === false && (
                  <section className="rounded-xl border p-3">
                    <h4 className="mb-2 font-semibold">{t("Chosen rewards")}</h4>
                    {selected.selectedOptions &&
                    selected.selectedOptions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selected.selectedOptions.map((opt) => (
                          <Badge key={opt} variant="outline">
                            {opt}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No options selected.
                      </p>
                    )}
                  </section>
                )}

                {/* Payment */}
                {(selected.transactionId ||
                  selected.transactionScreenshot ||
                  selected.paymentVerified) && (
                  <section className="rounded-xl border p-3">
                    <h4 className="mb-2 flex items-center gap-1.5 font-semibold">
                      <Wallet className="h-4 w-4 text-primary" /> Payment
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount due</span>
                        <span className="font-medium">
                          {money(selected.amount, currency)}
                        </span>
                      </div>
                      {selected.transactionId && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Transaction ref
                          </span>
                          <span>{selected.transactionId}</span>
                        </div>
                      )}
                      {selected.paymentMethod && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Method</span>
                          <span className="capitalize">
                            {selected.paymentMethod.replace("_", " ")}
                          </span>
                        </div>
                      )}
                      {selected.transactionScreenshot && (
                        <a
                          href={`${apiURL}${selected.transactionScreenshot}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 pt-1 font-medium text-primary hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5" /> Payment proof
                        </a>
                      )}
                      {selected.paymentVerified && (
                        <p className="flex items-center gap-1 pt-1 text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Payment
                          verified
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {/* Timeline */}
                <section className="rounded-xl border p-3">
                  <h4 className="mb-2 flex items-center gap-1.5 font-semibold">
                    <Clock className="h-4 w-4 text-primary" /> Timeline
                  </h4>
                  {selected.statusHistory &&
                  selected.statusHistory.length > 0 ? (
                    <ol className="space-y-2">
                      {selected.statusHistory.map((h, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium">{h.status}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {h.changedAt
                                  ? new Date(h.changedAt).toLocaleString()
                                  : ""}
                                {h.changedBy ? ` · ${h.changedBy}` : ""}
                              </span>
                            </div>
                            {h.note && (
                              <p className="text-xs text-muted-foreground">
                                {h.note}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No history yet.
                    </p>
                  )}
                </section>
              </div>

              {/* Approve / reject while the application is still open */}
              {selected.status === "Applied" && (
                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="flex-1 border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => {
                      setActionNote("");
                      setAction("Approved");
                    }}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setActionNote("");
                      setAction("Rejected");
                    }}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Reject
                  </Button>
                </DialogFooter>
              )}

              {/* Verify the transfer once the sponsor has submitted it */}
              {selected.status === "Payment Submitted" && (
                <DialogFooter>
                  <Button
                    className="w-full"
                    onClick={verifyPayment}
                    disabled={verifyBusy}
                  >
                    {verifyBusy ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Wallet className="mr-1.5 h-4 w-4" />
                    )}
                    Verify payment & confirm sponsorship
                  </Button>
                </DialogFooter>
              )}

              {/* Cancel — available any time short of already Rejected/
                  Cancelled, e.g. a sponsor backs out after paying or the
                  organizer needs to void an approved sponsorship. */}
              {!["Rejected", "Cancelled"].includes(selected.status) && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    className="w-full border-stone-300 text-stone-600 hover:bg-stone-50"
                    onClick={() => {
                      setActionNote("");
                      setAction("Cancelled");
                    }}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Cancel sponsorship
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Approve / reject note sub-dialog ────────────────────── */}
      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action === "Approved"
                ? "Approve sponsor"
                : action === "Rejected"
                  ? "Reject application"
                  : "Cancel sponsorship"}
            </DialogTitle>
            <DialogDescription>
              {action === "Approved"
                ? selected?.collectPayment === false
                  ? "This is a non-cash tier — approving confirms the sponsorship directly, no payment step. Add a message if you like."
                  : "They'll be asked to pay and upload proof. Add a message if you like."
                : action === "Rejected"
                  ? "Let the business know why."
                  : "This voids the sponsorship — the business will be emailed that it's been cancelled. Add a note if you like."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">
              {action === "Rejected" ? "Reason" : "Message (optional)"}
            </Label>
            <Textarea
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder={
                action === "Approved"
                  ? "e.g. Delighted to have you on board."
                  : action === "Rejected"
                    ? "Reason for rejection"
                    : "e.g. Event postponed, sponsorship no longer needed."
              }
              className="mt-1 min-h-[90px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Go back
            </Button>
            <Button
              onClick={submitAction}
              disabled={actionBusy}
              variant={action === "Approved" ? "default" : "destructive"}
            >
              {actionBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action === "Approved"
                ? "Approve"
                : action === "Rejected"
                  ? "Reject"
                  : "Cancel sponsorship"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small labelled value used across the application detail dialog.
function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="truncate">{value || "—"}</div>
    </div>
  );
}
