import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { phoneNationalLength } from "@/data/countries";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  CalendarDays,
  Paperclip,
  Search,
  Phone,
  Mail,
  Building2,
  Truck,
  Upload,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { t } from "@/i18n/t";

const apiURL = __API_URL__;

// Same two-country convention used across the organizer CRM (see MyUsers).
const SUPPORTED_COUNTRIES = [
  { name: "India", code: "IN", dialCode: "+91" },
  { name: "Singapore", code: "SG", dialCode: "+65" },
];

interface Supplier {
  _id: string;
  name: string;
  companyName?: string;
  serviceCategory?: string;
  email?: string;
  businessEmail?: string;
  phone?: string;
  countryCode?: string;
  country?: string;
  isActive?: boolean;
}

// One quotation this supplier submitted, joined to its event.
interface SupplierHistoryRow {
  _id: string;
  status: string;
  quotationTotal: number;
  createdAt: string;
  quotationAttachment?: string;
  payment?: { amountPaid?: number; balanceDue?: number };
  eventId?: { _id: string; title?: string; startDate?: string } | string;
}
interface SupplierHistory {
  supplier: Supplier;
  requests: SupplierHistoryRow[];
  totals: { events: number; quoted: number; paid: number };
  currency: string;
}

const QUOTE_STATUS_STYLES: Record<string, string> = {
  Quoted: "bg-amber-100 text-amber-700",
  Approved: "bg-blue-100 text-blue-700",
  Negotiating: "bg-purple-100 text-purple-700",
  "Partially Paid": "bg-teal-100 text-teal-700",
  Paid: "bg-green-100 text-green-700",
  Completed: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Cancelled: "bg-stone-200 text-stone-600",
};

function currencySymbol(country?: string): string {
  return country === "SG" ? "SG$" : "₹";
}
function money(amount: number, country?: string): string {
  return `${currencySymbol(country)}${Number(amount || 0).toLocaleString()}`;
}

// Compact headline figure used in the history dialog.
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

function getOrganizerId(): string | null {
  const token = sessionStorage.getItem("token");
  if (!token) return null;
  try {
    return (jwtDecode(token) as any).sub || null;
  } catch {
    return null;
  }
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

const EMPTY_FORM = {
  name: "",
  companyName: "",
  serviceCategory: "",
  email: "",
  businessEmail: "",
  dialCode: SUPPORTED_COUNTRIES[0].dialCode,
  phone: "",
};

export default function SuppliersDirectory() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Supplier awaiting delete confirmation, plus the server's refusal (e.g. the
  // supplier still has quotations) shown inline rather than as a toast.
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Eye icon → which events this supplier has been engaged for.
  const [history, setHistory] = useState<SupplierHistory | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Bulk import / export (Excel) — mirrors the Visitors/Exhibitors flow.
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    totalRows: number;
    created: number;
    updated?: number;
    skipped: number;
    errors: number;
    skippedRows?: { row: number; reason: string }[];
    errorRows?: { row: number; reason: string }[];
  } | null>(null);

  const load = useCallback(async () => {
    const organizerId = getOrganizerId();
    if (!organizerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(
        `${apiURL}/suppliers/list-by-organizer/${organizerId}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      );
      const json = await res.json();
      setSuppliers(Array.isArray(json?.data) ? json.data : []);
    } catch {
      toast({ variant: "destructive", title: "Couldn't load suppliers" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [
        s.name,
        s.companyName,
        s.serviceCategory,
        s.email,
        s.businessEmail,
        s.phone,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [suppliers, search]);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  // Runs only after the organizer confirms in the dialog. A refusal from the
  // server (supplier still has quotations) stays on screen inside the dialog
  // so it can actually be read.
  const confirmRemove = async () => {
    const s = confirmDelete;
    const organizerId = getOrganizerId();
    if (!s || !organizerId) return;
    const token = sessionStorage.getItem("token");
    setDeletingId(s._id);
    setDeleteError(null);
    try {
      const res = await fetch(
        `${apiURL}/suppliers/delete-by-organizer/${organizerId}/${s._id}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(j?.message || "Could not remove the supplier");
      setSuppliers((list) => list.filter((x) => x._id !== s._id));
      setConfirmDelete(null);
      toast({ title: "Supplier removed" });
    } catch (e: any) {
      setDeleteError(e?.message || "Could not remove the supplier");
    } finally {
      setDeletingId(null);
    }
  };

  const openHistory = async (s: Supplier) => {
    const organizerId = getOrganizerId();
    if (!organizerId) return;
    const token = sessionStorage.getItem("token");
    setHistory(null);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `${apiURL}/suppliers/history/${organizerId}/${s._id}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "");
      setHistory(j.data);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't load this supplier's events",
        description: e?.message || undefined,
      });
      setHistoryOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setDialogOpen(true);
  };

  const downloadBlob = async (url: string, filename: string) => {
    const token = sessionStorage.getItem("token");
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: err?.message,
      });
    }
  };

  const handleImport = async (file: File) => {
    const organizerId = getOrganizerId();
    if (!organizerId) {
      toast({ variant: "destructive", title: "Please sign in again" });
      return;
    }
    setBulkBusy(true);
    try {
      const token = sessionStorage.getItem("token");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `${apiURL}/bulk-import/suppliers/${organizerId}`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: fd,
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Import failed");
      setBulkResult(json);
      toast({
        title: "Suppliers imported",
        description: `${json.created} created · ${json.updated || 0} updated · ${json.skipped} skipped · ${json.errors} errors`,
      });
      load();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: err?.message || "Could not parse the file",
      });
    } finally {
      setBulkBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleExport = () => {
    const organizerId = getOrganizerId();
    if (!organizerId) return;
    downloadBlob(
      `${apiURL}/bulk-import/suppliers/export/${organizerId}`,
      `suppliers-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const handleTemplate = () =>
    downloadBlob(
      `${apiURL}/bulk-import/suppliers/template`,
      "suppliers-template.xlsx",
    );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> Supplier Management
          </CardTitle>
          <CardDescription>
            Your directory of service providers (catering, décor, sound, …),
            reused across events.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleTemplate}
            title="Download a blank Excel template"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={bulkBusy}
            title="Bulk import from Excel/CSV (AI auto-maps columns)"
          >
            {bulkBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            title="Download all suppliers as Excel"
          >
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button onClick={openAdd} variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Supplier
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search suppliers\u2026")}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No suppliers yet. Click “Add Supplier” to create one.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s._id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{s.name || "—"}</span>
                        {s.companyName && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {s.companyName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.serviceCategory ? (
                        <Badge variant="outline" className="text-[10px]">
                          {s.serviceCategory}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        {s.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {s.email}
                          </span>
                        )}
                        {s.businessEmail && s.businessEmail !== s.email && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Building2 className="h-3 w-3" /> {s.businessEmail}
                          </span>
                        )}
                        {s.phone && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" /> {s.phone}
                          </span>
                        )}
                        {!s.email && !s.businessEmail && !s.phone && "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="buttonOutline"
                          size="sm"
                          onClick={() => openHistory(s)}
                          title="View events"
                        >
                          <Eye className="mr-1 h-4 w-4" />
                        </Button>
                        <Button
                          variant="buttonOutline"
                          size="sm"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="mr-1 h-4 w-4" />
                        </Button>
                        <Button
                          variant="buttonOutline"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => {
                            setDeleteError(null);
                            setConfirmDelete(s);
                          }}
                          title="Remove supplier"
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <SupplierFormDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        supplierToEdit={editing}
        onSaved={() => {
          setDialogOpen(false);
          load();
        }}
      />

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
            <AlertDialogTitle>Remove this supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>
                {confirmDelete?.name || confirmDelete?.companyName}
              </strong>{" "}
              will be removed from your supplier directory. This can't be
              undone.
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

      {/* ── Which events this supplier has been engaged for ────── */}
      <Dialog
        open={historyOpen}
        onOpenChange={(o) => !o && setHistoryOpen(false)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              {history?.supplier?.name || "Supplier"}
            </DialogTitle>
            <DialogDescription>
              {history?.supplier?.companyName
                ? `${history.supplier.companyName} · `
                : ""}
              {history?.supplier?.serviceCategory || "No service category"}
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <Stat
                  label="Events"
                  value={String(history?.totals.events ?? 0)}
                />
                <Stat
                  label="Quoted"
                  value={money(history?.totals.quoted ?? 0, history?.currency)}
                />
                <Stat
                  label="Paid out"
                  value={money(history?.totals.paid ?? 0, history?.currency)}
                />
              </div>

              <section className="rounded-xl border p-3">
                <h4 className="mb-2 flex items-center gap-1.5 font-semibold">
                  <CalendarDays className="h-4 w-4 text-primary" /> Events hired
                  for
                </h4>
                {!history?.requests?.length ? (
                  <p className="text-xs text-muted-foreground">
                    This supplier hasn't quoted for any event yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {history.requests.map((r) => {
                      const ev =
                        r.eventId && typeof r.eventId === "object"
                          ? r.eventId
                          : null;
                      const balance = r.payment?.balanceDue ?? 0;
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
                              {ev?.startDate
                                ? new Date(ev.startDate).toLocaleDateString()
                                : ""}
                              {r.createdAt
                                ? `${ev?.startDate ? " · " : ""}quoted ${new Date(r.createdAt).toLocaleDateString()}`
                                : ""}
                              {balance > 0
                                ? ` · ${money(balance, history.currency)} due`
                                : ""}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {r.quotationAttachment && (
                              <a
                                href={`${apiURL}${r.quotationAttachment}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                                title="Quotation attachment"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <span className="font-medium">
                              {money(r.quotationTotal, history.currency)}
                            </span>
                            <Badge
                              className={`${QUOTE_STATUS_STYLES[r.status] || "bg-stone-100 text-stone-600"} hover:bg-transparent`}
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
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
            {history?.supplier && (
              <Button
                onClick={() => {
                  setHistoryOpen(false);
                  openEdit(history.supplier);
                }}
              >
                <Pencil className="mr-1.5 h-4 w-4" /> Edit supplier
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import result summary */}
      <Dialog
        open={!!bulkResult}
        onOpenChange={(o) => !o && setBulkResult(null)}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Import complete")}</DialogTitle>
            <DialogDescription>
              {bulkResult?.totalRows ?? 0} rows processed.
            </DialogDescription>
          </DialogHeader>
          {bulkResult && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-green-100 text-green-700 hover:bg-transparent">
                  {bulkResult.created} created
                </Badge>
                <Badge className="bg-blue-100 text-blue-700 hover:bg-transparent">
                  {bulkResult.updated || 0} updated
                </Badge>
                <Badge className="bg-amber-100 text-amber-700 hover:bg-transparent">
                  {bulkResult.skipped} skipped
                </Badge>
                <Badge className="bg-red-100 text-red-700 hover:bg-transparent">
                  {bulkResult.errors} errors
                </Badge>
              </div>
              {!!bulkResult.skippedRows?.length && (
                <div>
                  <p className="font-medium">Skipped rows</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {bulkResult.skippedRows.slice(0, 20).map((r, i) => (
                      <li key={i}>
                        Row {r.row}: {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!!bulkResult.errorRows?.length && (
                <div>
                  <p className="font-medium text-red-600">Errors</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {bulkResult.errorRows.slice(0, 20).map((r, i) => (
                      <li key={i}>
                        Row {r.row}: {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setBulkResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Add / Edit dialog ────────────────────────────────────────────────
function SupplierFormDialog({
  isOpen,
  onClose,
  supplierToEdit,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  supplierToEdit: Supplier | null;
  onSaved: () => void;
}) {
  const mode: "add" | "edit" = supplierToEdit ? "edit" : "add";
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (supplierToEdit) {
      const { dialCode, number } = splitPhone(supplierToEdit.phone);
      setForm({
        name: supplierToEdit.name || "",
        companyName: supplierToEdit.companyName || "",
        serviceCategory: supplierToEdit.serviceCategory || "",
        email: supplierToEdit.email || "",
        businessEmail: supplierToEdit.businessEmail || "",
        dialCode,
        phone: number,
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
    setErrors({});
  }, [isOpen, supplierToEdit]);

  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));

  const validate = () => {
    const e: Record<string, string> = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.name.trim()) e.name = "Name is required";
    if (form.email.trim() && !emailRe.test(form.email.trim()))
      e.email = "Enter a valid email";
    if (form.businessEmail.trim() && !emailRe.test(form.businessEmail.trim()))
      e.businessEmail = "Enter a valid email";
    const ph = form.phone.trim();
    if (ph) {
      if (!/^\d+$/.test(ph)) {
        e.phone = "Digits only — no letters or symbols";
      } else {
        const iso = SUPPORTED_COUNTRIES.find(
          (c) => c.dialCode === form.dialCode,
        )?.code;
        const [min, max] = phoneNationalLength(iso);
        if (ph.length < min || ph.length > max) {
          e.phone =
            min === max ? `Enter ${min} digits` : `Enter ${min}–${max} digits`;
        }
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const organizerId = getOrganizerId();
    if (!organizerId) {
      toast({ variant: "destructive", title: "Please sign in again" });
      return;
    }
    setSubmitting(true);
    try {
      const token = sessionStorage.getItem("token");
      const country = SUPPORTED_COUNTRIES.find(
        (c) => c.dialCode === form.dialCode,
      );
      const payload = {
        name: form.name.trim(),
        companyName: form.companyName.trim(),
        serviceCategory: form.serviceCategory.trim(),
        email: form.email.trim(),
        businessEmail: form.businessEmail.trim(),
        phone: form.phone.trim() ? `${form.dialCode}${form.phone.trim()}` : "",
        countryCode: form.dialCode,
        country: country?.code || "IN",
      };
      const url =
        mode === "edit"
          ? `${apiURL}/suppliers/update-by-organizer/${organizerId}/${supplierToEdit!._id}`
          : `${apiURL}/suppliers/create-by-organizer/${organizerId}`;
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Operation failed");
      toast({
        title: "Success",
        description: `Supplier ${mode === "edit" ? "updated" : "added"}`,
      });
      onSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Couldn't save supplier",
        description: err?.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Supplier" : "Add Supplier"}
          </DialogTitle>
          <DialogDescription>{t("Service providers you work with \u2014 reused across all your events.")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>{t("Name *")}</Label>
            <Input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={t("Contact person's name")}
            />
            {errors.name && (
              <span className="text-xs text-red-600">{errors.name}</span>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Company Name")}</Label>
            <Input
              value={form.companyName}
              onChange={(e) => set({ companyName: e.target.value })}
              placeholder="e.g. Tasty Caterers Pvt Ltd"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Service Provided")}</Label>
            <Input
              value={form.serviceCategory}
              onChange={(e) => set({ serviceCategory: e.target.value })}
              placeholder="e.g. Catering, Décor, Sound"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Gmail (login email)")}</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="supplier@gmail.com"
            />
            {errors.email && (
              <span className="text-xs text-red-600">{errors.email}</span>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Business Email")}</Label>
            <Input
              type="email"
              value={form.businessEmail}
              onChange={(e) => set({ businessEmail: e.target.value })}
              placeholder="contact@company.com"
            />
            {errors.businessEmail && (
              <span className="text-xs text-red-600">
                {errors.businessEmail}
              </span>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Contact Number")}</Label>
            <div className="flex gap-2">
              <Select
                value={form.dialCode}
                onValueChange={(v) => set({ dialCode: v })}
              >
                <SelectTrigger className="w-28">
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
                onChange={(e) => set({ phone: e.target.value })}
                placeholder={t("Phone number")}
                className="flex-1"
              />
            </div>
            {errors.phone && (
              <span className="text-xs text-red-600">{errors.phone}</span>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "edit" ? "Save changes" : "Add supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
