import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Star,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  ArrowUpDown,
  LifeBuoy,
  Bug,
  Lightbulb,
  HelpCircle,
  Receipt,
  HelpingHand,
  CheckCircle2,
  Clock,
  CircleDot,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const apiURL = __API_URL__;

type Filter = "pending" | "featured" | "hidden" | "all" | "support";
type SupportCategory =
  | "bug"
  | "feature_request"
  | "general"
  | "billing"
  | "other";
type SupportStatus = "open" | "in_progress" | "resolved";

interface Row {
  _id: string;
  kind?: "testimonial" | "support";
  name: string;
  role: string;
  email?: string;
  rating: number;
  comment: string;
  originalComment?: string;
  city?: string;
  featured: boolean;
  featuredOrder?: number;
  hidden: boolean;
  // Support-ticket fields (only when kind === "support")
  subject?: string;
  category?: SupportCategory;
  status?: SupportStatus;
  attachments?: string[];
  createdAt: string;
  updatedAt?: string;
}

const CATEGORY_META: Record<
  SupportCategory,
  { label: string; icon: any }
> = {
  bug: { label: "Bug", icon: Bug },
  feature_request: { label: "Feature request", icon: Lightbulb },
  general: { label: "General", icon: HelpCircle },
  billing: { label: "Billing", icon: Receipt },
  other: { label: "Other", icon: HelpingHand },
};

const STATUS_META: Record<
  SupportStatus,
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

function absUrl(p: string) {
  if (!p) return p;
  if (/^https?:\/\//i.test(p)) return p;
  return `${apiURL}${p}`;
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={
            value >= n
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          }
        />
      ))}
    </div>
  );
}

export function AppFeedbackCuration() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [editName, setEditName] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editOrder, setEditOrder] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(
        `${apiURL}/app-feedback?filter=${filter}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Load failed");
      setRows(json.items || []);
    } catch (err: any) {
      toast({
        title: "Could not load feedback",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.total += 1;
        if (r.featured && !r.hidden) acc.featured += 1;
        else if (!r.hidden) acc.pending += 1;
        else acc.hidden += 1;
        return acc;
      },
      { total: 0, pending: 0, featured: 0, hidden: 0 },
    );
  }, [rows]);

  const patch = async (id: string, body: any) => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${apiURL}/app-feedback/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Update failed");
      await load();
      return true;
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const toggleFeature = (row: Row) =>
    patch(row._id, { featured: !row.featured });

  const toggleHide = (row: Row) =>
    patch(row._id, { hidden: !row.hidden });

  const openEdit = (row: Row) => {
    setEditing(row);
    setEditName(row.name);
    setEditComment(row.comment);
    setEditOrder(row.featuredOrder?.toString() || "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const ok = await patch(editing._id, {
      name: editName.trim(),
      comment: editComment.trim(),
      featuredOrder:
        editOrder.trim() === "" ? undefined : Number(editOrder.trim()),
    });
    if (ok) setEditing(null);
  };

  const remove = async (row: Row) => {
    if (!confirm(`Permanently delete feedback from ${row.name}?`)) return;
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${apiURL}/app-feedback/${row._id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.message || "Delete failed");
      }
      await load();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">App Feedback</h2>
          <p className="text-muted-foreground text-sm">
            {filter === "support"
              ? "Organizer support tickets — bug reports, feature requests, and help asks from the dashboard."
              : "Curate which user testimonials appear in the landing page carousel."}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["pending", "featured", "hidden", "all", "support"] as Filter[]).map(
            (f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                className="capitalize flex items-center gap-1"
              >
                {f === "support" && <LifeBuoy className="h-3.5 w-3.5" />}
                {f}
              </Button>
            ),
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No feedback in this view.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => {
            // Support ticket layout: subject, category, status dropdown,
            // attachments. The action row drops Feature/Hide (they don't
            // apply to tickets) and adds a status selector.
            if (r.kind === "support") {
              const cat = r.category
                ? CATEGORY_META[r.category]
                : CATEGORY_META.other;
              const st = r.status
                ? STATUS_META[r.status]
                : STATUS_META.open;
              const CatIcon = cat.icon;
              const StIcon = st.icon;
              return (
                <Card key={r._id}>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CatIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">
                            {r.subject || "(no subject)"}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal"
                          >
                            {cat.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs flex items-center gap-1 ${st.cls}`}
                          >
                            <StIcon className="h-3 w-3" />
                            {st.label}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {r.name}
                          {r.email ? ` · ${r.email}` : ""} ·{" "}
                          {new Date(r.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{r.comment}</p>
                    {r.attachments && r.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {r.attachments.map((a, i) => (
                          <a
                            key={i}
                            href={absUrl(a)}
                            target="_blank"
                            rel="noreferrer"
                            className="h-20 w-20 rounded border overflow-hidden bg-muted flex items-center justify-center"
                            title="Open attachment"
                          >
                            <img
                              src={absUrl(a)}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (
                                  e.target as HTMLImageElement
                                ).style.display = "none";
                              }}
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Status:
                        </span>
                        <Select
                          value={r.status || "open"}
                          onValueChange={(v) =>
                            patch(r._id, { status: v })
                          }
                        >
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">
                              In progress
                            </SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => remove(r)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            // Testimonial layout (unchanged).
            return (
            <Card key={r._id}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{r.name}</span>
                      <Badge variant="outline" className="capitalize">
                        {r.role}
                      </Badge>
                      {r.featured && (
                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                          ⭐ Featured{" "}
                          {r.featuredOrder != null
                            ? `· #${r.featuredOrder}`
                            : ""}
                        </Badge>
                      )}
                      {r.hidden && (
                        <Badge variant="destructive">Hidden</Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {r.email} ·{" "}
                      {new Date(r.createdAt).toLocaleDateString()}
                      {r.city ? ` · ${r.city}` : ""}
                    </div>
                  </div>
                  <Stars value={r.rating} />
                </div>
                <p className="text-sm">"{r.comment}"</p>
                {r.originalComment && r.originalComment !== r.comment && (
                  <p className="text-xs text-muted-foreground italic">
                    Original: "{r.originalComment}"
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
                  <Button
                    size="sm"
                    variant={r.featured ? "outline" : "default"}
                    onClick={() => toggleFeature(r)}
                    disabled={r.hidden}
                    title={
                      r.hidden
                        ? "Unhide first"
                        : r.featured
                          ? "Remove from carousel"
                          : "Show in carousel"
                    }
                  >
                    <Star className="h-3.5 w-3.5 mr-1" />
                    {r.featured ? "Unfeature" : "Feature"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleHide(r)}
                  >
                    {r.hidden ? (
                      <>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Unhide
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5 mr-1" /> Hide
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remove(r)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit feedback</DialogTitle>
            <DialogDescription>
              Polish the display name + comment for the carousel. The original
              text stays on record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Display name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Comment</Label>
              <Textarea
                rows={4}
                maxLength={500}
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" /> Carousel order (optional,
                lower = first)
              </Label>
              <Input
                type="number"
                value={editOrder}
                onChange={(e) => setEditOrder(e.target.value)}
                placeholder="e.g. 1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AppFeedbackCuration;
