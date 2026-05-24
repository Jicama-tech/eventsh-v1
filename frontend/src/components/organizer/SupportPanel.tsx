import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Upload,
  X,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  CircleDot,
  LifeBuoy,
  Bug,
  Lightbulb,
  HelpCircle,
  Receipt,
  HelpingHand,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiURL = __API_URL__;

type Category = "bug" | "feature_request" | "general" | "billing" | "other";
type Status = "open" | "in_progress" | "resolved";

interface Ticket {
  _id: string;
  subject: string;
  category: Category;
  status: Status;
  comment: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const CATEGORY_OPTIONS: { value: Category; label: string; icon: any }[] = [
  { value: "bug", label: "Bug report", icon: Bug },
  { value: "feature_request", label: "Feature request", icon: Lightbulb },
  { value: "general", label: "General help", icon: HelpCircle },
  { value: "billing", label: "Billing", icon: Receipt },
  { value: "other", label: "Other", icon: HelpingHand },
];

const categoryMeta = (c: Category) =>
  CATEGORY_OPTIONS.find((o) => o.value === c) ?? CATEGORY_OPTIONS[4];

const statusMeta: Record<
  Status,
  { label: string; cls: string; icon: any }
> = {
  open: {
    label: "Open",
    cls: "bg-amber-100 text-amber-800 border-amber-200",
    icon: CircleDot,
  },
  in_progress: {
    label: "In progress",
    cls: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Clock,
  },
  resolved: {
    label: "Resolved",
    cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
  },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function absUrl(p: string) {
  if (!p) return p;
  if (/^https?:\/\//i.test(p)) return p;
  return `${apiURL}${p}`;
}

export default function SupportPanel() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<Category>("bug");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  const loadTickets = async () => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${apiURL}/app-feedback/support/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load tickets");
      const data = await res.json();
      setTickets(data.items || []);
    } catch (err: any) {
      // Silent — the page is still usable for submitting new tickets even
      // if the history list fails to load (e.g. just-expired token).
      console.warn("Could not load support tickets:", err?.message);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    Array.from(incoming).forEach((f) => {
      if (!f.type.startsWith("image/")) {
        rejected.push(`${f.name}: not an image`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        rejected.push(`${f.name}: over 5MB`);
        return;
      }
      accepted.push(f);
    });
    setFiles((prev) => {
      const next = [...prev, ...accepted].slice(0, MAX_FILES);
      if (prev.length + accepted.length > MAX_FILES) {
        rejected.push(`Only ${MAX_FILES} images allowed.`);
      }
      return next;
    });
    if (rejected.length) {
      toast({
        title: "Some files were skipped",
        description: rejected.join(" • "),
        variant: "destructive",
      });
    }
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const reset = () => {
    setSubject("");
    setCategory("bug");
    setDescription("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || subject.trim().length < 3) {
      toast({
        title: "Subject is too short",
        description: "Give your ticket a short summary so we can find it.",
        variant: "destructive",
      });
      return;
    }
    if (!description.trim() || description.trim().length < 5) {
      toast({
        title: "Description is too short",
        description: "Tell us what happened so we can help.",
        variant: "destructive",
      });
      return;
    }
    const token = sessionStorage.getItem("token");
    if (!token) {
      toast({
        title: "You're not signed in",
        description: "Please log in again to submit a support ticket.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("subject", subject.trim());
      fd.append("category", category);
      fd.append("description", description.trim());
      files.forEach((f) => fd.append("attachments", f, f.name));

      const res = await fetch(`${apiURL}/app-feedback/support`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Could not submit your ticket");
      }
      toast({
        title: "Ticket submitted",
        description: "Our team will look into it. Thanks for letting us know!",
      });
      reset();
      loadTickets();
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LifeBuoy className="h-7 w-7 text-primary" />
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">Support</h2>
          <p className="text-sm text-muted-foreground">
            Report a bug, request a feature, or ask for help. Attach
            screenshots so we can see what you see.
          </p>
        </div>
      </div>

      {/* ── Submit form ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submit a support request</CardTitle>
          <CardDescription>
            We usually respond within 1 business day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label htmlFor="support-subject">Subject</Label>
                <Input
                  id="support-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Cart total is wrong after applying coupon"
                  disabled={submitting}
                />
              </div>
              <div>
                <Label htmlFor="support-category">Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as Category)}
                  disabled={submitting}
                >
                  <SelectTrigger id="support-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {opt.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="support-description">Description</Label>
              <Textarea
                id="support-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder={
                  category === "bug"
                    ? "What were you doing? What happened? What did you expect?"
                    : "Tell us a bit more so we can help."
                }
                disabled={submitting}
              />
              <p className="text-[11px] text-muted-foreground text-right mt-1">
                {description.length}/2000
              </p>
            </div>

            {/* Image attachments */}
            <div>
              <Label>
                Screenshots{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional — up to {MAX_FILES}, max 5MB each)
                </span>
              </Label>
              <div className="mt-1 flex flex-wrap gap-3">
                {files.map((f, i) => {
                  const url = URL.createObjectURL(f);
                  return (
                    <div
                      key={`${f.name}-${i}`}
                      className="relative group h-24 w-24 rounded-md border overflow-hidden bg-muted"
                    >
                      <img
                        src={url}
                        alt={f.name}
                        className="h-full w-full object-cover"
                        onLoad={() => URL.revokeObjectURL(url)}
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute top-1 right-1 rounded-full bg-black/70 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {files.length < MAX_FILES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting}
                    className="h-24 w-24 rounded-md border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:text-primary text-muted-foreground flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-[10px]">Add image</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit ticket"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── History ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">My tickets</CardTitle>
          <CardDescription>
            Past requests you've submitted, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTickets ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              You haven't submitted any tickets yet.
            </div>
          ) : (
            <ul className="divide-y">
              {tickets.map((t) => {
                const cat = categoryMeta(t.category);
                const st = statusMeta[t.status] ?? statusMeta.open;
                const CatIcon = cat.icon;
                const StIcon = st.icon;
                return (
                  <li key={t._id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CatIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <h3 className="font-medium truncate">{t.subject}</h3>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal"
                          >
                            {cat.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                          {t.comment}
                        </p>
                        {t.attachments && t.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {t.attachments.map((a, i) => (
                              <a
                                key={i}
                                href={absUrl(a)}
                                target="_blank"
                                rel="noreferrer"
                                className="h-14 w-14 rounded border overflow-hidden bg-muted flex items-center justify-center"
                                title="Open attachment"
                              >
                                <img
                                  src={absUrl(a)}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display =
                                      "none";
                                  }}
                                />
                              </a>
                            ))}
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-2">
                          Submitted {formatDate(t.createdAt)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs flex items-center gap-1 ${st.cls}`}
                      >
                        <StIcon className="h-3 w-3" />
                        {st.label}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
