import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BedDouble,
  Check,
  Loader2,
  Mail,
  Plus,
  Send,
  Users,
  X,
} from "lucide-react";

const apiURL = __API_URL__;

// Room sharing types + their default occupancy. "group" is open-ended.
export const ROOM_TYPES: { value: string; label: string; occ: number }[] = [
  { value: "single", label: "Single sharing", occ: 1 },
  { value: "dual", label: "Dual sharing", occ: 2 },
  { value: "triple", label: "Triple sharing", occ: 3 },
  { value: "group", label: "Group room", occ: 4 },
];

export function roomTypeLabel(v?: string): string {
  return ROOM_TYPES.find((t) => t.value === v)?.label || "—";
}

interface Allot {
  id?: string;
  functionId: string;
  functionName: string;
  roomType: string;
  roomName: string;
  occupants: number;
  occupantNames: string[];
  notes: string;
  checkedIn?: boolean;
  // Shared room: rows on different RSVPs with the same roomKey are one
  // physical room; sharedRsvpIds are the OTHER parties in it.
  roomKey?: string;
  capacity?: number;
  sharedRsvpIds?: string[];
}

interface GuestLike {
  _id: string;
  name: string;
  email: string;
  guestCount: number;
  functions?: { id: string; name: string }[];
  roomAllotments?: Allot[];
  attendees?: { name: string; age?: number; contactNumber?: string }[];
  ageGroups?: {
    adults?: number;
    seniors?: number;
    children?: number;
    infants?: number;
  };
}

function ageLineOf(a?: GuestLike["ageGroups"]): string {
  if (!a) return "";
  return [
    a.adults ? `${a.adults} adult${a.adults === 1 ? "" : "s"}` : "",
    a.seniors ? `${a.seniors} senior${a.seniors === 1 ? "" : "s"}` : "",
    a.children ? `${a.children} child${a.children === 1 ? "" : "ren"}` : "",
    a.infants ? `${a.infants} infant${a.infants === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Per-guest room allotment. One assignment row per function the guest is
 * attending (multi-city weddings can put them in a different room per
 * function — or the same). Saves the whole set to the RSVP.
 */
export default function GuestRoomDialog({
  eventId,
  guest,
  allGuests = [],
  open,
  onOpenChange,
  onSaved,
}: {
  eventId: string;
  guest: GuestLike | null;
  /** Every RSVP in the event — used to pick a party to share a room with. */
  allGuests?: GuestLike[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (allotments: Allot[]) => void;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Allot[]>([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  // Per-room share editor: which row is being shared, the target RSVP, and the
  // people from that party going into the room.
  const [shareFor, setShareFor] = useState<number | null>(null);
  const [shareTarget, setShareTarget] = useState<string>("");
  const [shareNames, setShareNames] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  // Other parties this room can be shared with (never the guest themselves).
  const otherGuests = (allGuests || []).filter((g) => g._id !== guest?._id);
  const guestById = new Map(otherGuests.map((g) => [g._id, g]));

  // The functions this guest is attending — each room is assigned to one of
  // them (or a single "General stay" option when none were picked).
  const fnOptions =
    guest?.functions && guest.functions.length > 0
      ? guest.functions
      : [{ id: "", name: "General stay" }];

  // The people in this party — used to pick who shares each room.
  const attendeeNames = (guest?.attendees || [])
    .map((a) => a.name)
    .filter(Boolean);

  // No room can hold more people than are actually coming under this RSVP.
  const maxOcc = Math.max(1, guest?.guestCount || 1);
  const totalOcc = rows.reduce((s, r) => s + (r.occupants || 0), 0);

  useEffect(() => {
    if (!open || !guest) return;
    const max = Math.max(1, guest.guestCount || 1);
    const opts =
      guest.functions && guest.functions.length > 0
        ? guest.functions
        : [{ id: "", name: "General stay" }];
    const existing = guest.roomAllotments || [];
    if (existing.length > 0) {
      // Re-open with the rooms already saved (each entry is its own room).
      setRows(
        existing.map((a) => ({
          id: a.id,
          functionId: a.functionId || "",
          functionName:
            a.functionName ||
            opts.find((f) => f.id === a.functionId)?.name ||
            "General stay",
          roomType: ROOM_TYPES.some((t) => t.value === a.roomType)
            ? a.roomType
            : "dual",
          roomName: a.roomName || "",
          occupants: Math.min(max, Math.max(1, a.occupants || 1)),
          occupantNames: Array.isArray(a.occupantNames)
            ? a.occupantNames
            : [],
          notes: a.notes || "",
          checkedIn: a.checkedIn,
          roomKey: a.roomKey,
          capacity: a.capacity,
          sharedRsvpIds: a.sharedRsvpIds,
        })),
      );
    } else {
      // Seed one room per function as a starting point.
      setRows(
        opts.map((f) => ({
          functionId: f.id,
          functionName: f.name,
          roomType: "dual",
          roomName: "",
          occupants: Math.min(max, 2),
          occupantNames: [],
          notes: "",
        })),
      );
    }
  }, [open, guest]);

  const patch = (i: number, p: Partial<Allot>) =>
    setRows((old) => old.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  // Changing the room type snaps occupants to that type's default (capped at
  // the RSVP's guest count).
  const changeType = (i: number, type: string) => {
    const occ = Math.min(
      maxOcc,
      ROOM_TYPES.find((t) => t.value === type)?.occ || 1,
    );
    patch(i, { roomType: type, occupants: occ });
  };

  const changeFunction = (i: number, id: string) => {
    const f = fnOptions.find((x) => x.id === id);
    patch(i, { functionId: id, functionName: f?.name || "" });
  };

  // Toggle a person into/out of a room; occupants follows the count selected.
  const toggleName = (i: number, name: string) =>
    setRows((old) =>
      old.map((r, idx) => {
        if (idx !== i) return r;
        const has = r.occupantNames.includes(name);
        const names = has
          ? r.occupantNames.filter((n) => n !== name)
          : [...r.occupantNames, name];
        return {
          ...r,
          occupantNames: names,
          occupants:
            names.length > 0 ? Math.min(maxOcc, names.length) : r.occupants,
        };
      }),
    );

  const addRoom = () => {
    const f = fnOptions[0];
    setRows((old) => [
      ...old,
      {
        functionId: f.id,
        functionName: f.name,
        roomType: "dual",
        roomName: "",
        occupants: Math.min(maxOcc, 2),
        occupantNames: [],
        notes: "",
      },
    ]);
  };

  const removeRoom = (i: number) =>
    setRows((old) => old.filter((_, idx) => idx !== i));

  // PATCH the allotments; returns the saved rows (with server-assigned ids).
  const persist = async (): Promise<Allot[]> => {
    if (!guest) return [];
    const token = sessionStorage.getItem("token");
    const res = await fetch(
      `${apiURL}/events/${eventId}/rsvps/${guest._id}/allotments`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ allotments: rows }),
      },
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j?.message || "Could not save");
    const saved = (j?.data?.roomAllotments || rows) as Allot[];
    onSaved(saved);
    return saved;
  };

  const save = async () => {
    if (!guest) return;
    setSaving(true);
    try {
      await persist();
      toast({ title: "Rooms saved", description: `Updated ${guest.name}.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Couldn't save rooms",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Save first (so rooms have ids), then email the guest their QR room pass.
  const sendTicket = async () => {
    if (!guest) return;
    setSending(true);
    try {
      await persist();
      const token = sessionStorage.getItem("token");
      const res = await fetch(
        `${apiURL}/events/${eventId}/rsvps/${guest._id}/room-ticket`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "Couldn't send the pass");
      toast({
        title: "Room pass emailed 🎫",
        description: `Sent ${guest.name} ${j.rooms} room pass${
          j.rooms === 1 ? "" : "es"
        } with QR codes.`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Couldn't send the pass",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // Share a room with another party. Saves first (so the room has an id), then
  // links the target RSVP + its chosen occupants. Closes so the parent refetches
  // and the updated shared state shows on reopen.
  const doShare = async (roomIndex: number) => {
    if (!guest) return;
    const row = rows[roomIndex];
    if (!row?.roomName?.trim()) {
      toast({
        title: "Name the room first",
        description: "Give the room a name/number before sharing it.",
        variant: "destructive",
      });
      return;
    }
    if (!shareTarget) {
      toast({
        title: "Pick a party",
        description: "Choose which RSVP to share this room with.",
        variant: "destructive",
      });
      return;
    }
    if (shareNames.length === 0) {
      toast({
        title: "Pick guests",
        description: "Choose who from that party is in the room.",
        variant: "destructive",
      });
      return;
    }
    setSharing(true);
    try {
      const saved = await persist();
      const savedRow =
        saved.find(
          (s) =>
            s.roomName === row.roomName && s.functionId === row.functionId,
        ) || saved[roomIndex];
      const allotmentId = savedRow?.id || row.id;
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${apiURL}/events/${eventId}/rooms/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sourceRsvpId: guest._id,
          allotmentId,
          targetRsvpId: shareTarget,
          occupantNames: shareNames,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "Couldn't share the room");
      toast({
        title: "Room shared 🛏️",
        description: `Added ${
          guestById.get(shareTarget)?.name || "the other party"
        } to this room.`,
      });
      setShareFor(null);
      setShareTarget("");
      setShareNames([]);
      onSaved(saved);
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Couldn't share the room",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  // Remove one shared party from a room.
  const doUnshare = async (roomKey: string, rsvpId: string) => {
    setSharing(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(
        `${apiURL}/events/${eventId}/rooms/${roomKey}/rsvps/${rsvpId}`,
        {
          method: "DELETE",
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "Couldn't update sharing");
      toast({ title: "Removed from room" });
      onSaved(rows);
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Couldn't update sharing",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BedDouble className="h-5 w-5 text-rose-500" />
            Allot rooms
          </DialogTitle>
        </DialogHeader>

        {guest && (
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50/60 p-3">
              <div className="font-medium text-stone-800">{guest.name}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" /> {guest.email} · {guest.guestCount}{" "}
                guest{guest.guestCount === 1 ? "" : "s"}
              </div>
              {ageLineOf(guest.ageGroups) && (
                <div className="mt-1 text-xs text-stone-500">
                  {ageLineOf(guest.ageGroups)}
                </div>
              )}
              {guest.attendees && guest.attendees.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                    Guests
                  </div>
                  {guest.attendees.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1 text-xs text-stone-700"
                    >
                      <span className="font-medium">{a.name}</span>
                      <span className="text-stone-500">
                        {[a.age ? `${a.age} yrs` : "", a.contactNumber]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {rows.map((r, i) => (
              <div
                key={i}
                className="space-y-3 rounded-xl border border-stone-200 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-rose-700">
                    Room {i + 1}
                    {r.checkedIn && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700">
                        <Check className="h-3 w-3" /> Checked in
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRoom(i)}
                    className="text-stone-400 hover:text-red-600"
                    title="Remove this room"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {fnOptions.length > 1 && (
                    <div className="col-span-2">
                      <Label className="text-xs">For function</Label>
                      <Select
                        value={r.functionId}
                        onValueChange={(v) => changeFunction(i, v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fnOptions.map((f) => (
                            <SelectItem key={f.id || "general"} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Room type</Label>
                    <Select
                      value={r.roomType}
                      onValueChange={(v) => changeType(i, v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROOM_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Occupants (max {maxOcc})</Label>
                    <Input
                      type="number"
                      min={1}
                      max={maxOcc}
                      value={r.occupants}
                      onChange={(e) =>
                        patch(i, {
                          occupants: Math.min(
                            maxOcc,
                            Math.max(1, Number(e.target.value) || 1),
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Room name / number</Label>
                    <Input
                      value={r.roomName}
                      onChange={(e) => patch(i, { roomName: e.target.value })}
                      placeholder="e.g. Taj Palace — Room 204"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Notes (optional)</Label>
                    <Input
                      value={r.notes}
                      onChange={(e) => patch(i, { notes: e.target.value })}
                      placeholder="e.g. Ground floor, near lift"
                    />
                  </div>
                  {attendeeNames.length > 0 && (
                    <div className="col-span-2">
                      <Label className="text-xs">Who's in this room?</Label>
                      {(() => {
                        // Hide people already placed in another room — only show
                        // those free, plus whoever is already in this room.
                        const avail = attendeeNames.filter(
                          (n) =>
                            r.occupantNames.includes(n) ||
                            !rows.some(
                              (rr, idx) =>
                                idx !== i && rr.occupantNames.includes(n),
                            ),
                        );
                        return avail.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {avail.map((n) => {
                              const on = r.occupantNames.includes(n);
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => toggleName(i, n)}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                                    on
                                      ? "border-rose-400 bg-rose-500 text-white"
                                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                                  }`}
                                >
                                  {on && <Check className="h-3 w-3" />}
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Everyone else is already assigned to another room.
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
                {/* Shared room — split this physical room across another party */}
                <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-2.5">
                  {r.roomKey &&
                    r.sharedRsvpIds &&
                    r.sharedRsvpIds.length > 0 && (
                      <div className="mb-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                          Shared with
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {r.sharedRsvpIds.map((rid) => (
                            <span
                              key={rid}
                              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-0.5 text-xs text-stone-700"
                            >
                              {guestById.get(rid)?.name || "Another party"}
                              <button
                                type="button"
                                onClick={() =>
                                  r.roomKey && doUnshare(r.roomKey, rid)
                                }
                                className="text-stone-400 hover:text-red-600"
                                title="Remove from this room"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  {shareFor === i ? (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Share with RSVP</Label>
                        <Select
                          value={shareTarget}
                          onValueChange={(v) => {
                            setShareTarget(v);
                            setShareNames([]);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pick a party…" />
                          </SelectTrigger>
                          <SelectContent>
                            {otherGuests.map((g) => (
                              <SelectItem key={g._id} value={g._id}>
                                {g.name} · {g.guestCount} guest
                                {g.guestCount === 1 ? "" : "s"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {shareTarget && (
                        <div>
                          <Label className="text-xs">Who from that party?</Label>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {(guestById.get(shareTarget)?.attendees || [])
                              .map((a) => a.name)
                              .filter(Boolean)
                              .map((n) => {
                                const on = shareNames.includes(n);
                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() =>
                                      setShareNames((old) =>
                                        on
                                          ? old.filter((x) => x !== n)
                                          : [...old, n],
                                      )
                                    }
                                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                                      on
                                        ? "border-amber-400 bg-amber-500 text-white"
                                        : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                                    }`}
                                  >
                                    {on && <Check className="h-3 w-3" />}
                                    {n}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShareFor(null);
                            setShareTarget("");
                            setShareNames([]);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => doShare(i)}
                          disabled={sharing}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          {sharing ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Users className="mr-1 h-4 w-4" />
                          )}
                          Add to room
                        </Button>
                      </div>
                    </div>
                  ) : (
                    otherGuests.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setShareFor(i);
                          setShareTarget("");
                          setShareNames([]);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900"
                      >
                        <Users className="h-3.5 w-3.5" /> Share this room with
                        another RSVP
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}

            {/* Add another room for this guest + running occupant total. */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRoom}
              >
                <Plus className="mr-1 h-4 w-4" /> Add room
              </Button>
              <span
                className={`text-xs ${
                  totalOcc > maxOcc
                    ? "font-semibold text-red-600"
                    : "text-muted-foreground"
                }`}
              >
                Allotted {totalOcc} / {maxOcc} guest{maxOcc === 1 ? "" : "s"}
                {totalOcc > maxOcc ? " — exceeds party size" : ""}
              </span>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={save}
                disabled={saving || sending}
              >
                {saving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                Save rooms
              </Button>
              <Button
                onClick={sendTicket}
                disabled={saving || sending}
                className="bg-rose-600 hover:bg-rose-700"
                title="Save and email the guest their room pass with QR codes"
              >
                {sending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                Email room pass
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
