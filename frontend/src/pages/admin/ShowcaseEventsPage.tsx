// Admin → Showcase Events. Create demo Professional / Personal events (saved
// under the demo organization) that appear on the public landing page's "See
// it in action" grid. Clicking a card there opens the real eventfront in demo
// mode; any action on it invites the visitor to register / contact us.

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ExternalLink, Sparkles, Pencil } from "lucide-react";
import { CreateEventForm } from "@/components/organizer/CreateEventForm";
import { MarriageEventForm } from "@/components/organizer/MarriageEventForm";

// The demo organization every showcase event is created under. Configurable
// per environment via VITE_DEMO_ORG_ID (set this in production); falls back to
// the local/dev demo organizer. If existing showcase events are found, their
// organizer is used instead so the id is always correct after the first demo.
const ENV_DEMO_ORG_ID =
  (import.meta as any).env?.VITE_DEMO_ORG_ID || "6994181635af75137d4bb459";

const apiURL = __API_URL__;

export function ShowcaseEventsPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<null | "professional" | "personal">(
    null,
  );
  // Editing an existing demo event with the real form (pre-filled).
  const [editing, setEditing] = useState<null | {
    kind: "professional" | "personal";
    data: any;
  }>(null);

  const token = () => sessionStorage.getItem("token") || "";
  // Assign each demo to the organizer of an existing demo of the SAME kind, so
  // "Try the dashboard" for a kind lists every demo of that kind (personal
  // demos under the personal demo org, professional under theirs). Editing an
  // existing demo re-points it to the correct kind's org too, which fixes any
  // demo that was previously created under the wrong organizer. Falls back to
  // any demo's org, then the env-configured id for the very first demo.
  const demoOrgIdFor = (kind: "professional" | "personal") =>
    (events.find((e) => e.organizer && e.showcaseKind === kind)
      ?.organizer as string) ||
    (events.find((e) => e.organizer)?.organizer as string) ||
    ENV_DEMO_ORG_ID;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiURL}/events/showcase`);
      const j = await r.json();
      setEvents(Array.isArray(j?.data) ? j.data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // onSave handler for the reused event forms. Appends the showcase/demo flags
  // then POSTs create-event under the demo organizer (admin token).
  const handleCreate =
    (kind: "professional" | "personal") => async (formData: FormData) => {
      formData.append("isShowcase", "true");
      formData.append("isDemo", "true");
      formData.append("showcaseKind", kind);
      const res = await fetch(`${apiURL}/events/create-event`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
        body: formData,
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to create");
      toast({ title: "Showcase event created" });
      setCreating(null);
      load();
    };

  // Open the full form pre-filled with the event's data so the admin can edit
  // everything (title, banner, theme, ceremonies, tickets…).
  const openEdit = async (e: any) => {
    try {
      const r = await fetch(`${apiURL}/events/${e._id}`);
      const j = await r.json();
      const data = j?.data || j;
      const kind =
        e.showcaseKind === "personal" ||
        data?.eventType === "personal" ||
        data?.category === "Marriage Function"
          ? "personal"
          : "professional";
      setEditing({ kind, data });
    } catch {
      toast({ title: "Couldn't load event", variant: "destructive" });
    }
  };

  // onSave for edit mode — preserve the showcase/demo flags, then PUT.
  const handleUpdate =
    (id: string, kind: "professional" | "personal") =>
    async (formData: FormData) => {
      formData.append("isShowcase", "true");
      formData.append("isDemo", "true");
      formData.append("showcaseKind", kind);
      const res = await fetch(`${apiURL}/events/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token()}` },
        body: formData,
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to update");
      toast({ title: "Demo event updated" });
      setEditing(null);
      load();
    };

  const patchShowcase = async (id: string, body: any) => {
    try {
      const res = await fetch(`${apiURL}/events/${id}/showcase`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      load();
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const removeFromShowcase = (id: string) =>
    patchShowcase(id, { isShowcase: false });

  const deleteEvent = async (id: string) => {
    if (!window.confirm("Delete this demo event permanently?")) return;
    try {
      const res = await fetch(`${apiURL}/events/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      toast({ title: "Deleted" });
      load();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  // ---- Create mode: render the real event forms full-width ----
  if (creating === "professional") {
    return (
      <CreateEventForm
        organizerIdOverride={demoOrgIdFor("professional")}
        onSave={handleCreate("professional")}
        onClose={() => setCreating(null)}
      />
    );
  }
  if (creating === "personal") {
    return (
      <MarriageEventForm
        organizerIdOverride={demoOrgIdFor("personal")}
        onSave={handleCreate("personal")}
        onClose={() => setCreating(null)}
      />
    );
  }

  // ---- Edit mode: same forms, pre-filled, saving via PUT ----
  if (editing?.kind === "professional") {
    return (
      <CreateEventForm
        editMode
        initialData={editing.data}
        organizerIdOverride={demoOrgIdFor("professional")}
        onSave={handleUpdate(editing.data._id, "professional")}
        onClose={() => setEditing(null)}
      />
    );
  }
  if (editing?.kind === "personal") {
    return (
      <MarriageEventForm
        editMode
        initialData={editing.data}
        organizerIdOverride={demoOrgIdFor("personal")}
        onSave={handleUpdate(editing.data._id, "personal")}
        onClose={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6 text-indigo-500" /> Showcase Events
          </h2>
          <p className="text-sm text-muted-foreground">
            Demo events shown on the landing page. Visitors can open them but
            any action invites them to register / contact.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreating("professional")}>
            <Plus className="mr-1 h-4 w-4" /> Professional
          </Button>
          <Button variant="buttonOutline" onClick={() => setCreating("personal")}>
            <Plus className="mr-1 h-4 w-4" /> Personal
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No showcase events yet. Create a Professional or Personal demo to
            feature it on the landing page.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((e) => (
            <Card key={e._id} className="overflow-hidden">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                          e.showcaseKind === "personal"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-indigo-100 text-indigo-700"
                        }`}
                      >
                        {e.showcaseKind === "personal"
                          ? "Personal"
                          : "Professional"}
                      </span>
                      {e.isDemo && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Demo mode
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 text-lg font-semibold">{e.title}</h3>
                  </div>
                  <a
                    href={`/demo/events/${e._id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
                  >
                    Open <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <Input
                  defaultValue={e.showcaseBlurb || ""}
                  placeholder="Short blurb shown on the landing card"
                  onBlur={(ev) => {
                    if (ev.target.value !== (e.showcaseBlurb || ""))
                      patchShowcase(e._id, { showcaseBlurb: ev.target.value });
                  }}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    defaultValue={e.showcaseKind || "professional"}
                    onValueChange={(v) =>
                      patchShowcase(e._id, { showcaseKind: v })
                    }
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* What the landing exposes for this demo. */}
                  <Select
                    defaultValue={e.showcaseMode || "eventfront"}
                    onValueChange={(v) =>
                      patchShowcase(e._id, { showcaseMode: v })
                    }
                  >
                    <SelectTrigger className="w-40" title="Showcase as">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eventfront">Event page only</SelectItem>
                      <SelectItem value="dashboard">Dashboard only</SelectItem>
                      <SelectItem value="both">Event page + Dashboard</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Landing-page position for this demo. Lower numbers show
                      first (within each kind). Always available so any number
                      of demos can be ordered. */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Order</span>
                    <Input
                      type="number"
                      defaultValue={e.showcaseOrder ?? 0}
                      className="w-16"
                      title="Order on the landing page (lower shows first)"
                      onBlur={(ev) =>
                        patchShowcase(e._id, {
                          showcaseOrder: Number(ev.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    variant={e.isDemo ? "buttonOutline" : "default"}
                    onClick={() =>
                      patchShowcase(e._id, { isDemo: !e.isDemo })
                    }
                  >
                    {e.isDemo ? "Demo: On" : "Demo: Off"}
                  </Button>
                  <Button size="sm" onClick={() => openEdit(e)}>
                    <Pencil className="mr-1 h-4 w-4" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="buttonOutline"
                    onClick={() => removeFromShowcase(e._id)}
                  >
                    Unfeature
                  </Button>
                  <Button
                    size="sm"
                    variant="buttonOutline"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => deleteEvent(e._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default ShowcaseEventsPage;
