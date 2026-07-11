import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import { Rsvp, RsvpDocument } from "./schemas/rsvp.schema";
import { Event, EventDocument } from "../events/schemas/event.schema";
import { Organizer } from "../organizers/schemas/organizer.schema";
import { CreateRsvpDto } from "./dto/create-rsvp.dto";
import { MailService, OrgEmailConfig } from "../roles/mail.service";

@Injectable()
export class RsvpService {
  constructor(
    @InjectModel(Rsvp.name) private rsvpModel: Model<RsvpDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(Organizer.name) private organizerModel: Model<any>,
    private readonly mailService: MailService,
  ) {}

  // Public: create or update the guest's RSVP for an event. Keyed on
  // (eventId, email) so a guest re-submitting just updates their response.
  async submit(eventId: string, dto: CreateRsvpDto): Promise<Rsvp> {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new NotFoundException("Event not found");
    }
    // Pull the wedding details needed for the confirmation email (title,
    // ceremonies with venues, couple/contact + accommodation info).
    const event = await this.eventModel
      .findById(eventId)
      .select(
        "organizer title functions marriage startDate location address",
      )
      .lean();
    if (!event) throw new NotFoundException("Event not found");

    const organizerId = String(
      (event as any).organizer?._id || (event as any).organizer || "",
    );
    const email = dto.email.toLowerCase().trim();
    const attending = dto.attending !== false;

    // Only keep the (id, name) pair; drop anything else a client sends.
    // Guests who declined carry no function selections.
    const selectedFunctions =
      attending && Array.isArray(dto.functions)
        ? dto.functions
            .filter((f) => f && (f.id || f.name))
            .map((f) => ({ id: String(f.id || ""), name: String(f.name || "") }))
        : [];

    // Full attendee roster (name/age/contact). When present it's the source of
    // truth: headcount = number of named guests, and the age-group breakdown is
    // derived from each guest's age.
    const attendees =
      attending && Array.isArray(dto.attendees)
        ? dto.attendees
            .map((a) => ({
              name: String(a?.name || "").trim(),
              age:
                a?.age != null && Number.isFinite(Number(a.age))
                  ? Math.max(0, Math.floor(Number(a.age)))
                  : undefined,
              contactNumber: String(a?.contactNumber || "").trim(),
            }))
            .filter((a) => a.name)
        : [];

    // Age → planner bracket. Missing/0 age counts as an adult.
    const bracket = (age?: number): keyof typeof zeroGroups => {
      if (age == null || !Number.isFinite(age) || age <= 0) return "adults";
      if (age <= 2) return "infants";
      if (age <= 12) return "children";
      if (age >= 60) return "seniors";
      return "adults";
    };
    const zeroGroups = { adults: 0, seniors: 0, children: 0, infants: 0 };

    let ageGroups = { ...zeroGroups };
    let guestCount: number;
    if (attending && attendees.length > 0) {
      attendees.forEach((a) => {
        ageGroups[bracket(a.age)]++;
      });
      guestCount = attendees.length;
    } else {
      // Legacy path: explicit age-group counts, else the flat guestCount.
      const ag =
        dto.ageGroups && typeof dto.ageGroups === "object"
          ? dto.ageGroups
          : null;
      if (ag) {
        ageGroups = {
          adults: Math.max(0, Math.floor(Number(ag.adults) || 0)),
          seniors: Math.max(0, Math.floor(Number(ag.seniors) || 0)),
          children: Math.max(0, Math.floor(Number(ag.children) || 0)),
          infants: Math.max(0, Math.floor(Number(ag.infants) || 0)),
        };
      }
      const ageSum =
        ageGroups.adults +
        ageGroups.seniors +
        ageGroups.children +
        ageGroups.infants;
      guestCount = !attending
        ? 0
        : ageSum > 0
          ? ageSum
          : typeof dto.guestCount === "number" && dto.guestCount >= 0
            ? dto.guestCount
            : 1;
    }

    const doc = await this.rsvpModel.findOneAndUpdate(
      { eventId, email },
      {
        eventId,
        organizerId,
        email,
        name: dto.name?.trim(),
        contactNumber: dto.contactNumber?.trim(),
        guestCount,
        ageGroups,
        attendees,
        message: dto.message?.trim(),
        attending,
        side: dto.side?.trim() || "",
        functions: selectedFunctions,
        googleId: dto.googleId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Guest RSVP is attendee-facing, so it goes from the organizer's own email
    // when they've configured a custom sender (Individuals included). When not
    // configured, MailService falls back to the global EventSH sender.
    let senderConfig: OrgEmailConfig | undefined;
    if (organizerId && Types.ObjectId.isValid(organizerId)) {
      const org = await this.organizerModel
        .findById(organizerId)
        .select("emailConfig")
        .lean();
      senderConfig = (org as any)?.emailConfig || undefined;
    }

    // Send the guest their RSVP confirmation. Fire-and-forget — a mail
    // failure must never fail the RSVP itself.
    void this.sendRsvpConfirmation(
      event as any,
      {
        name: dto.name?.trim() || "",
        email,
        attending,
        guestCount: doc.guestCount,
        side: dto.side?.trim() || "",
        selectedFunctions,
      },
      senderConfig,
    ).catch((e) =>
      // eslint-disable-next-line no-console
      console.error("RSVP confirmation email failed:", e?.message || e),
    );

    return doc;
  }

  // Public: the calling guest's own RSVP (for prefilling the form on return).
  async findMine(eventId: string, email: string): Promise<Rsvp | null> {
    if (!email) return null;
    return this.rsvpModel
      .findOne({ eventId, email: email.toLowerCase().trim() })
      .lean();
  }

  // Organizer: every RSVP for an event, newest first.
  async listForEvent(eventId: string): Promise<Rsvp[]> {
    return this.rsvpModel.find({ eventId }).sort({ createdAt: -1 }).lean();
  }

  // Organizer: allot rooms to a guest (per function). Replaces the guest's
  // whole allotment list with the sanitized payload.
  async setRoomAllotments(
    eventId: string,
    rsvpId: string,
    allotments: any[],
  ): Promise<Rsvp> {
    if (!Types.ObjectId.isValid(eventId) || !Types.ObjectId.isValid(rsvpId)) {
      throw new NotFoundException("Guest RSVP not found");
    }
    // Load current allotments so we can preserve each room's stable id and its
    // server-owned check-in state across edits.
    const existing: any = await this.rsvpModel
      .findOne({ _id: rsvpId, eventId })
      .lean();
    if (!existing) throw new NotFoundException("Guest RSVP not found");
    const prevById = new Map<string, any>(
      (existing.roomAllotments || [])
        .filter((a: any) => a?.id)
        .map((a: any) => [a.id, a]),
    );

    const allowed = ["single", "dual", "triple", "group"];
    const clean = (Array.isArray(allotments) ? allotments : [])
      .map((a) => {
        const id = a?.id && prevById.has(a.id) ? a.id : uuidv4();
        const prev = prevById.get(id);
        const rt = allowed.includes(a?.roomType) ? a.roomType : "dual";
        return {
          id,
          functionId: String(a?.functionId || ""),
          functionName: String(a?.functionName || ""),
          roomType: rt,
          roomName: String(a?.roomName || "").trim(),
          occupants:
            Number(a?.occupants) > 0 ? Math.floor(Number(a.occupants)) : 1,
          occupantNames: Array.isArray(a?.occupantNames)
            ? a.occupantNames.map((n: any) => String(n).trim()).filter(Boolean)
            : [],
          notes: String(a?.notes || "").trim(),
          // Check-in is set only by a QR scan — never trust the client for it.
          checkedIn: prev?.checkedIn || false,
          checkedInAt: prev?.checkedInAt,
          // Shared-room linkage is owned by shareRoom / reconcileSharedRooms —
          // preserve it across a normal edit; derive capacity from the type.
          ...(prev?.roomKey ? { roomKey: prev.roomKey } : {}),
          capacity: prev?.capacity || this.roomCapacity(rt),
          ...(prev?.sharedRsvpIds ? { sharedRsvpIds: prev.sharedRsvpIds } : {}),
        } as any;
      })
      // Keep only rows the organizer actually filled in.
      .filter((a) => a.roomName || a.notes || a.occupantNames.length);

    // Combined-capacity guard: for any shared room, this RSVP's new occupants
    // plus everyone already in the room (other parties) must fit the capacity.
    for (const row of clean) {
      if (!row.roomKey) continue;
      const occ = await this.getRoomOccupancy(eventId, row.roomKey);
      const others = occ.rsvps
        .filter((x) => x.rsvpId !== String(rsvpId))
        .reduce((s, x) => s + x.occupants, 0);
      const projected = others + (row.occupants || row.occupantNames.length);
      const cap = row.capacity || this.roomCapacity(row.roomType);
      if (projected > cap) {
        throw new BadRequestException(
          `Room "${row.roomName}" holds ${cap}, but that would make ${projected} occupants across the shared parties.`,
        );
      }
    }

    const doc = await this.rsvpModel
      .findOneAndUpdate(
        { _id: rsvpId, eventId },
        { $set: { roomAllotments: clean } },
        { new: true },
      )
      .lean();
    if (!doc) throw new NotFoundException("Guest RSVP not found");

    // Reconcile shared linkage for every room this save touched — a shared row
    // removed here must be dropped from the other parties' share lists (and a
    // room left with a single party reverts to a normal, unshared room).
    const touchedKeys = [
      ...Array.from(prevById.values()).map((a: any) => a?.roomKey),
      ...clean.map((a: any) => a.roomKey),
    ].filter(Boolean) as string[];
    if (touchedKeys.length) await this.reconcileSharedRooms(eventId, touchedKeys);

    return doc as Rsvp;
  }

  // Physical capacity of a room by type. Group rooms are flexible, so they
  // carry a generous ceiling rather than a hard 1/2/3.
  private roomCapacity(roomType?: string): number {
    const m: Record<string, number> = {
      single: 1,
      dual: 2,
      triple: 3,
      group: 99,
    };
    return m[roomType || ""] || 2;
  }

  // Combined occupancy of one physical (shared) room — every RSVP in this event
  // whose allotment carries the same roomKey. Used for capacity guards and the
  // combined occupant list on the panel / room ticket.
  async getRoomOccupancy(
    eventId: string,
    roomKey: string,
  ): Promise<{
    roomKey: string;
    capacity: number;
    totalOccupants: number;
    occupantNames: string[];
    rsvps: {
      rsvpId: string;
      name: string;
      occupantNames: string[];
      occupants: number;
    }[];
  }> {
    const rsvps: any[] = await this.rsvpModel
      .find({ eventId, "roomAllotments.roomKey": roomKey })
      .lean();
    let capacity = 0;
    const rows: {
      rsvpId: string;
      name: string;
      occupantNames: string[];
      occupants: number;
    }[] = [];
    const names: string[] = [];
    for (const r of rsvps) {
      const a = (r.roomAllotments || []).find(
        (x: any) => x?.roomKey === roomKey,
      );
      if (!a) continue;
      capacity = Math.max(
        capacity,
        Number(a.capacity) || this.roomCapacity(a.roomType),
      );
      const occNames = Array.isArray(a.occupantNames) ? a.occupantNames : [];
      rows.push({
        rsvpId: String(r._id),
        name: String(r.name || ""),
        occupantNames: occNames,
        occupants: Number(a.occupants) || occNames.length,
      });
      names.push(...occNames);
    }
    return {
      roomKey,
      capacity: capacity || this.roomCapacity(),
      totalOccupants: rows.reduce((s, x) => s + (x.occupants || 0), 0),
      occupantNames: names,
      rsvps: rows,
    };
  }

  // Recompute sharedRsvpIds for a set of roomKeys — the single source of truth
  // for shared state. A key held by ≤1 RSVP reverts to a normal room (its
  // roomKey / sharedRsvpIds are stripped).
  private async reconcileSharedRooms(
    eventId: string,
    roomKeys: string[],
  ): Promise<void> {
    const keys = Array.from(new Set((roomKeys || []).filter(Boolean)));
    for (const key of keys) {
      const rsvps: any[] = await this.rsvpModel
        .find({ eventId, "roomAllotments.roomKey": key })
        .lean();
      const ids = rsvps.map((r) => String(r._id));
      for (const r of rsvps) {
        const allots = (r.roomAllotments || []).map((a: any) => {
          if (a?.roomKey !== key) return a;
          if (ids.length <= 1) {
            // No longer shared — strip the linkage back to a normal room.
            const { roomKey, sharedRsvpIds, ...rest } = a;
            return rest;
          }
          return { ...a, sharedRsvpIds: ids.filter((x) => x !== String(r._id)) };
        });
        await this.rsvpModel.updateOne(
          { _id: r._id, eventId },
          { $set: { roomAllotments: allots } },
        );
      }
    }
  }

  // Organizer: share a source RSVP's room with another RSVP — the same physical
  // room, split across both parties (combined occupants under one capacity).
  async shareRoom(
    eventId: string,
    sourceRsvpId: string,
    allotmentId: string,
    targetRsvpId: string,
    occupantNames: string[],
  ): Promise<{ roomKey: string; occupancy: any }> {
    if (
      ![eventId, sourceRsvpId, targetRsvpId].every((x) =>
        Types.ObjectId.isValid(x),
      )
    ) {
      throw new NotFoundException("RSVP not found");
    }
    if (String(sourceRsvpId) === String(targetRsvpId)) {
      throw new BadRequestException("Pick a different RSVP to share with.");
    }
    const [src, tgt]: any[] = await Promise.all([
      this.rsvpModel.findOne({ _id: sourceRsvpId, eventId }).lean(),
      this.rsvpModel.findOne({ _id: targetRsvpId, eventId }).lean(),
    ]);
    if (!src) throw new NotFoundException("Source RSVP not found");
    if (!tgt) throw new NotFoundException("Guest to share with not found");

    const srcAllot = (src.roomAllotments || []).find(
      (a: any) => a?.id === allotmentId,
    );
    if (!srcAllot || !srcAllot.roomName) {
      throw new BadRequestException("Room to share not found.");
    }
    const names = (Array.isArray(occupantNames) ? occupantNames : [])
      .map((n) => String(n).trim())
      .filter(Boolean);
    if (names.length === 0) {
      throw new BadRequestException(
        "Pick at least one guest from the other party to add to the room.",
      );
    }

    const roomKey = srcAllot.roomKey || srcAllot.id;
    const capacity =
      Number(srcAllot.capacity) || this.roomCapacity(srcAllot.roomType);

    // Combined-capacity check: source + any existing sharers (excluding the
    // target, whose share we're replacing) + the target's new occupants.
    const occ = await this.getRoomOccupancy(eventId, roomKey);
    const othersTotal = occ.rsvps
      .filter(
        (x) =>
          x.rsvpId !== String(sourceRsvpId) && x.rsvpId !== String(targetRsvpId),
      )
      .reduce((s, x) => s + x.occupants, 0);
    const sourceOcc =
      Number(srcAllot.occupants) || (srcAllot.occupantNames?.length ?? 0);
    const projected = othersTotal + sourceOcc + names.length;
    if (projected > capacity) {
      throw new BadRequestException(
        `This room holds ${capacity}. Sharing these ${names.length} would make ${projected} occupants.`,
      );
    }

    // Stamp the shared key/capacity on the source row.
    const srcAllots = (src.roomAllotments || []).map((a: any) =>
      a?.id === allotmentId ? { ...a, roomKey, capacity } : a,
    );
    // Upsert the linked row on the target RSVP.
    const tgtAllots = [...(tgt.roomAllotments || [])];
    const idx = tgtAllots.findIndex((a: any) => a?.roomKey === roomKey);
    const linked = {
      functionId: srcAllot.functionId,
      functionName: srcAllot.functionName,
      roomType: srcAllot.roomType,
      roomName: srcAllot.roomName,
      occupants: names.length,
      occupantNames: names,
      roomKey,
      capacity,
    };
    if (idx >= 0) {
      tgtAllots[idx] = { ...tgtAllots[idx], ...linked };
    } else {
      tgtAllots.push({
        id: uuidv4(),
        notes: "",
        checkedIn: false,
        ...linked,
      });
    }

    await Promise.all([
      this.rsvpModel.updateOne(
        { _id: sourceRsvpId, eventId },
        { $set: { roomAllotments: srcAllots } },
      ),
      this.rsvpModel.updateOne(
        { _id: targetRsvpId, eventId },
        { $set: { roomAllotments: tgtAllots } },
      ),
    ]);
    await this.reconcileSharedRooms(eventId, [roomKey]);
    return { roomKey, occupancy: await this.getRoomOccupancy(eventId, roomKey) };
  }

  // Organizer: remove one RSVP from a shared room. If only one party is left,
  // reconcile reverts it to a normal room.
  async unshareRoom(
    eventId: string,
    roomKey: string,
    rsvpId: string,
  ): Promise<{ roomKey: string; occupancy: any }> {
    if (!Types.ObjectId.isValid(eventId) || !Types.ObjectId.isValid(rsvpId)) {
      throw new NotFoundException("RSVP not found");
    }
    const rsvp: any = await this.rsvpModel
      .findOne({ _id: rsvpId, eventId })
      .lean();
    if (!rsvp) throw new NotFoundException("RSVP not found");
    const allots = (rsvp.roomAllotments || []).filter(
      (a: any) => a?.roomKey !== roomKey,
    );
    await this.rsvpModel.updateOne(
      { _id: rsvpId, eventId },
      { $set: { roomAllotments: allots } },
    );
    await this.reconcileSharedRooms(eventId, [roomKey]);
    return { roomKey, occupancy: await this.getRoomOccupancy(eventId, roomKey) };
  }

  private roomTypeLabelSrv(v?: string): string {
    const m: Record<string, string> = {
      single: "Single sharing",
      dual: "Dual sharing",
      triple: "Triple sharing",
      group: "Group room",
    };
    return m[v || ""] || "Room";
  }

  // Organizer: email the guest a wedding room pass — one QR-coded card per
  // room. The QR encodes a check-in URL the hotel reception opens to confirm.
  async sendRoomTickets(
    eventId: string,
    rsvpId: string,
  ): Promise<{ sent: boolean; rooms: number }> {
    if (!Types.ObjectId.isValid(eventId) || !Types.ObjectId.isValid(rsvpId)) {
      throw new NotFoundException("Guest RSVP not found");
    }
    const rsvp: any = await this.rsvpModel
      .findOne({ _id: rsvpId, eventId })
      .lean();
    if (!rsvp) throw new NotFoundException("Guest RSVP not found");
    const rooms = (rsvp.roomAllotments || []).filter(
      (a: any) => a?.id && a.roomName,
    );
    if (rooms.length === 0) {
      throw new BadRequestException(
        "Assign a room (with a room name) before sending the pass.",
      );
    }
    // Shared rooms: surface the COMBINED occupant list (everyone from every
    // party in the room), not just this RSVP's slice, on the pass.
    for (const r of rooms as any[]) {
      if (!r.roomKey) continue;
      const occ = await this.getRoomOccupancy(eventId, r.roomKey);
      if (occ.rsvps.length > 1) {
        r._shared = true;
        r._combinedNames = occ.occupantNames;
        r._combinedCount = occ.totalOccupants;
      }
    }
    const event: any = await this.eventModel
      .findById(eventId)
      .select("organizer title marriage")
      .lean();

    const base = (process.env.FRONTEND_BASE_URL || "http://localhost:8080")
      .trim()
      .replace(/\/$/, "");
    const safeName =
      String(rsvp.name || "guest")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "guest";
    const attachments: { filename: string; content: Buffer; cid?: string }[] =
      [];
    let n = 0;
    for (const r of rooms) {
      n += 1;
      const url = `${base}/wedding-room/${r.id}`;
      const qr = await QRCode.toBuffer(url, { width: 260, margin: 2 });
      // Inline QR (rendered in the email body card).
      attachments.push({
        filename: `room-${r.id}.png`,
        content: qr,
        cid: `qr-${r.id}`,
      });
      // A separate printable PDF for THIS room — download & forward to whoever
      // is checking in for it.
      const pdfBuf = await this.buildRoomPassPdf(event, rsvp, r, qr);
      const roomSafe =
        String(r.roomName || r.functionName || `room-${n}`)
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase() || `room-${n}`;
      attachments.push({
        filename: `room-pass-${safeName}-${roomSafe}.pdf`,
        content: pdfBuf,
      });
    }

    let senderConfig: OrgEmailConfig | undefined;
    const organizerId = String(
      event?.organizer?._id || event?.organizer || "",
    );
    if (organizerId && Types.ObjectId.isValid(organizerId)) {
      const org: any = await this.organizerModel
        .findById(organizerId)
        .select("emailConfig")
        .lean();
      senderConfig = org?.emailConfig || undefined;
    }

    const { subject, html } = this.buildRoomTicketEmail(event, rsvp, rooms);
    await this.mailService.sendEmail({
      to: rsvp.email,
      subject,
      html,
      attachments,
      senderConfig,
    });
    return { sent: true, rooms: rooms.length };
  }

  private buildRoomTicketEmail(
    event: any,
    rsvp: any,
    rooms: any[],
  ): { subject: string; html: string } {
    const marriage = event?.marriage || {};
    const coupleNames =
      [marriage.partner1Name, marriage.partner2Name]
        .filter(Boolean)
        .join(" & ") ||
      event?.title ||
      "The Wedding";
    const cards = rooms
      .map(
        (r) => `
      <div style="border:1px solid #f1e4e0;border-radius:16px;overflow:hidden;margin:0 0 18px;">
        <div style="background:linear-gradient(135deg,#e11d48,#be123c);padding:12px 18px;color:#fff;">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.9;">Room Pass · ${this.esc(r.functionName || "Stay")}</div>
        </div>
        <div style="padding:18px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#9f1239;">${this.esc(r.roomName)}</div>
          ${
            r._shared
              ? `<div style="display:inline-block;margin-top:6px;padding:2px 10px;border-radius:999px;background:#fde68a;color:#92400e;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Shared room</div>`
              : ""
          }
          <div style="font-size:13px;color:#78716c;margin-top:3px;">${this.esc(this.roomTypeLabelSrv(r.roomType))} · ${r._shared ? r._combinedCount : r.occupants} occupant${(r._shared ? r._combinedCount : r.occupants) === 1 ? "" : "s"}</div>
          ${
            (r._shared ? r._combinedNames : r.occupantNames)?.length
              ? `<div style="font-size:14px;color:#44403c;margin-top:10px;">${(r._shared ? r._combinedNames : r.occupantNames).map((n: string) => this.esc(n)).join(" · ")}</div>`
              : ""
          }
          ${r.notes ? `<div style="font-size:12px;color:#78716c;margin-top:6px;font-style:italic;">${this.esc(r.notes)}</div>` : ""}
          <img src="cid:qr-${r.id}" alt="Room QR" style="width:200px;height:200px;margin-top:14px;border:1px solid #f1e4e0;border-radius:10px;" />
          <div style="font-size:12px;color:#a8a29e;margin-top:8px;">Show this QR at the hotel reception to check in.</div>
        </div>
      </div>`,
      )
      .join("");
    const subject = `🏨 Your room pass — ${coupleNames}`;
    const html = `
      <div style="margin:0;padding:24px 12px;background:#fdf6f3;">
        <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #f1e4e0;font-family:Georgia,'Times New Roman',serif;">
          <div style="padding:24px;text-align:center;border-bottom:1px solid #f1e4e0;">
            <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#be123c;">Accommodation Pass</div>
            <div style="font-size:24px;color:#9f1239;font-weight:700;margin-top:6px;">${this.esc(coupleNames)}</div>
          </div>
          <div style="padding:22px;">
            <p style="font-size:15px;color:#44403c;margin:0 0 16px;">Dear ${this.esc(rsvp.name) || "guest"}, here ${rooms.length === 1 ? "is your room" : "are your rooms"} for the celebration:</p>
            ${cards}
            <p style="font-size:13px;color:#78716c;margin:4px 0 0;text-align:center;">A separate printable <strong>PDF pass for each room</strong> is attached — download and forward whichever is needed to whoever is checking in.</p>
          </div>
          <div style="padding:14px;text-align:center;background:#fffaf8;border-top:1px solid #f1e4e0;">
            <p style="font-size:11px;color:#a8a29e;margin:0;">Sent via EventSH</p>
          </div>
        </div>
      </div>`;
    return { subject, html };
  }

  // Render ONE room's pass to its own downloadable PDF. Text stays
  // ASCII-friendly (pdfkit's Helvetica has no emoji/₹ glyphs).
  private buildRoomPassPdf(
    event: any,
    rsvp: any,
    room: any,
    qr: Buffer,
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require("pdfkit");
    const marriage = event?.marriage || {};
    const coupleNames =
      [marriage.partner1Name, marriage.partner2Name]
        .filter(Boolean)
        .join(" & ") ||
      event?.title ||
      "The Wedding";

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const pdf = new PDFDocument({ size: "A4", margin: 40 });
        const chunks: Buffer[] = [];
        pdf.on("data", (c: Buffer) => chunks.push(c));
        pdf.on("end", () => resolve(Buffer.concat(chunks)));

        const pageW = pdf.page.width;
        const left = 40;
        const right = pageW - 40;

        // Header band
        pdf.rect(0, 0, pageW, 92).fill("#e11d48");
        pdf
          .fillColor("#ffffff")
          .font("Helvetica")
          .fontSize(11)
          .text("ACCOMMODATION PASS", left, 30, { characterSpacing: 2 });
        pdf.font("Helvetica-Bold").fontSize(22).text(coupleNames, left, 48);
        pdf.fillColor("#111827");

        // Guest identity
        pdf.font("Helvetica").fontSize(12).fillColor("#374151");
        pdf.text(`Guest: ${rsvp.name || ""}`, left, 120);
        pdf.text(`Email: ${rsvp.email || ""}`, left, pdf.y + 2);

        let y = pdf.y + 24;
        pdf
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor("#9f1239")
          .text(String(room.functionName || "Stay").toUpperCase(), left, y, {
            width: right - left,
            characterSpacing: 1,
          });
        y = pdf.y + 6;
        pdf
          .font("Helvetica-Bold")
          .fontSize(26)
          .fillColor("#111827")
          .text(room.roomName || "-", left, y, { width: right - left });
        y = pdf.y + 4;
        pdf
          .font("Helvetica")
          .fontSize(12)
          .fillColor("#6b7280")
          .text(
            `${this.roomTypeLabelSrv(room.roomType)}${room._shared ? " (shared)" : ""}  -  ${room._shared ? room._combinedCount : room.occupants} occupant${(room._shared ? room._combinedCount : room.occupants) === 1 ? "" : "s"}`,
            left,
            y,
            { width: right - left },
          );
        y = pdf.y + 6;
        {
          const guestNames = room._shared
            ? room._combinedNames
            : room.occupantNames;
          if (guestNames && guestNames.length) {
            pdf
              .fontSize(12)
              .fillColor("#374151")
              .text(`Guests: ${guestNames.join(", ")}`, left, y, {
                width: right - left,
              });
            y = pdf.y + 4;
          }
        }
        if (room.notes) {
          pdf
            .fillColor("#6b7280")
            .text(`Note: ${room.notes}`, left, y, { width: right - left });
          y = pdf.y + 4;
        }

        // QR, centred below the details.
        const qrSize = 210;
        pdf.image(qr, (pageW - qrSize) / 2, y + 24, {
          width: qrSize,
          height: qrSize,
        });
        pdf
          .font("Helvetica")
          .fontSize(11)
          .fillColor("#6b7280")
          .text(
            "Show this QR at the hotel reception to check in.",
            left,
            y + 24 + qrSize + 12,
            { width: right - left, align: "center" },
          );

        pdf
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#9ca3af")
          .text("Sent via EventSH", left, pdf.page.height - 50, {
            width: right - left,
            align: "center",
          });

        pdf.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  // Public: room-pass details for the reception check-in page (by QR token).
  async getRoomTicket(token: string): Promise<any> {
    const rsvp: any = await this.rsvpModel
      .findOne({ "roomAllotments.id": token })
      .lean();
    if (!rsvp) throw new NotFoundException("Room pass not found");
    const room = (rsvp.roomAllotments || []).find((a: any) => a.id === token);
    if (!room) throw new NotFoundException("Room pass not found");
    const event: any = await this.eventModel
      .findById(rsvp.eventId)
      .select("title marriage")
      .lean();
    const marriage = event?.marriage || {};
    const coupleNames =
      [marriage.partner1Name, marriage.partner2Name]
        .filter(Boolean)
        .join(" & ") ||
      event?.title ||
      "The Wedding";
    // Shared room → show the reception the COMBINED occupant list across every
    // party in the room, not just this pass's slice.
    let shared = false;
    let occupants = room.occupants;
    let occupantNames: string[] = room.occupantNames || [];
    if (room.roomKey) {
      const occ = await this.getRoomOccupancy(
        String(rsvp.eventId),
        room.roomKey,
      );
      if (occ.rsvps.length > 1) {
        shared = true;
        occupants = occ.totalOccupants;
        occupantNames = occ.occupantNames;
      }
    }
    return {
      guestName: rsvp.name,
      coupleNames,
      eventTitle: event?.title || "",
      functionName: room.functionName || "",
      roomType: room.roomType,
      roomTypeLabel: this.roomTypeLabelSrv(room.roomType),
      roomName: room.roomName,
      shared,
      occupants,
      occupantNames,
      notes: room.notes || "",
      checkedIn: !!room.checkedIn,
      checkedInAt: room.checkedInAt || null,
    };
  }

  // Public: mark a room pass as checked in (reception scanned + confirmed).
  async checkInRoom(token: string): Promise<any> {
    const now = new Date().toISOString();
    const res = await this.rsvpModel
      .findOneAndUpdate(
        { "roomAllotments.id": token },
        {
          $set: {
            "roomAllotments.$.checkedIn": true,
            "roomAllotments.$.checkedInAt": now,
          },
        },
        { new: true },
      )
      .lean();
    if (!res) throw new NotFoundException("Room pass not found");
    return this.getRoomTicket(token);
  }

  // Organizer: mark a ceremony live (drives the public "has started" bar) and,
  // when turning it on for the first time, email every attending guest.
  async announceFunction(
    eventId: string,
    functionId: string,
    opts: { isLive?: boolean; notify?: boolean },
  ): Promise<{ success: boolean; isLive: boolean; notified: number }> {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new NotFoundException("Event not found");
    }
    const event = await this.eventModel
      .findById(eventId)
      .select("organizer title functions marriage")
      .lean();
    if (!event) throw new NotFoundException("Event not found");

    const fns: any[] = Array.isArray((event as any).functions)
      ? (event as any).functions
      : [];
    const fn = fns.find((f) => String(f?.id) === String(functionId));
    if (!fn) {
      throw new NotFoundException(
        "Ceremony not found — save the event first, then announce it.",
      );
    }

    const isLive = opts?.isLive !== false; // default: turn ON
    const wasLive = fn.isLive === true;
    const now = new Date().toISOString();

    await this.eventModel.updateOne(
      { _id: eventId, "functions.id": functionId },
      {
        $set: {
          "functions.$.isLive": isLive,
          ...(isLive ? { "functions.$.announcedAt": now } : {}),
        },
      },
    );

    let notified = 0;
    // Only blast when turning live, notify not disabled, and it wasn't already
    // live — so a repeated toggle can't spam guests twice.
    if (isLive && opts?.notify !== false && !wasLive) {
      const rsvps = await this.rsvpModel
        .find({ eventId, attending: { $ne: false } })
        .select("email")
        .lean();
      const recipients = Array.from(
        new Set(
          rsvps
            .map((r: any) => String(r.email || "").toLowerCase().trim())
            .filter(Boolean),
        ),
      );
      notified = recipients.length;

      if (recipients.length) {
        let senderConfig: OrgEmailConfig | undefined;
        const organizerId = String(
          (event as any).organizer?._id || (event as any).organizer || "",
        );
        if (organizerId && Types.ObjectId.isValid(organizerId)) {
          const org = await this.organizerModel
            .findById(organizerId)
            .select("emailConfig")
            .lean();
          senderConfig = (org as any)?.emailConfig || undefined;
        }
        const { subject, html } = this.buildFunctionStartedEmail(event, fn);
        // Fire-and-forget blast so the request returns immediately.
        void Promise.allSettled(
          recipients.map((to) =>
            this.mailService.sendEmail({ to, subject, html, senderConfig }),
          ),
        ).then((results) => {
          const failed = results.filter((r) => r.status === "rejected").length;
          if (failed)
            // eslint-disable-next-line no-console
            console.error(
              `Function-start email: ${failed}/${recipients.length} failed`,
            );
        });
      }
    }

    return { success: true, isLive, notified };
  }

  // Fill {function}/{venue}/{time} placeholders in a custom announcement text.
  private applyTemplate(t: string, fn: any): string {
    return String(t || "")
      .replace(/\{function\}/gi, fn?.name || "")
      .replace(/\{venue\}/gi, fn?.venueName || "")
      .replace(/\{time\}/gi, this.prettyTime(fn?.time) || "");
  }

  // "The <ceremony> has begun" email sent to every attending guest.
  private buildFunctionStartedEmail(
    event: any,
    fn: any,
  ): { subject: string; html: string } {
    const marriage = event?.marriage || {};
    const coupleNames =
      [marriage.partner1Name, marriage.partner2Name].filter(Boolean).join(" & ") ||
      event?.title ||
      "The Wedding";
    const when = [
      this.prettyDate(fn?.date),
      [this.prettyTime(fn?.time), this.prettyTime(fn?.endTime)]
        .filter(Boolean)
        .join(" – "),
    ]
      .filter(Boolean)
      .join("  ·  ");
    const maps = this.mapsLink(fn?.venueName, fn?.address);
    const custom = (marriage.adBarMessage || "").trim();
    const headline = custom
      ? this.applyTemplate(custom, fn)
      : `${fn?.name || "The ceremony"} has begun!`;

    const subject = `🎉 ${fn?.name || "A ceremony"} has started — ${coupleNames}`;
    const html = `
      <div style="margin:0;padding:24px 12px;background:#fdf6f3;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #f1e4e0;font-family:Georgia,'Times New Roman',serif;">
          <div style="background:linear-gradient(135deg,#e11d48,#be123c);padding:30px 24px;text-align:center;">
            <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#ffe4e6;">${this.esc(coupleNames)}</div>
            <div style="font-size:26px;color:#ffffff;font-weight:700;margin-top:8px;">${this.esc(headline)}</div>
          </div>
          <div style="padding:26px;text-align:center;">
            <p style="font-size:16px;color:#44403c;margin:0 0 14px;">The celebration is starting — we'd love for you to join us! 💛</p>
            <div style="display:inline-block;text-align:left;border:1px solid #f1e4e0;background:#fffaf8;border-radius:14px;padding:16px 20px;">
              <div style="font-size:18px;font-weight:700;color:#9f1239;">${this.esc(fn?.name)}</div>
              ${when ? `<div style="font-size:13px;color:#78716c;margin-top:4px;">${this.esc(when)}</div>` : ""}
              ${fn?.venueName ? `<div style="font-size:15px;color:#44403c;margin-top:8px;font-weight:600;">${this.esc(fn.venueName)}</div>` : ""}
              ${fn?.address ? `<div style="font-size:13px;color:#78716c;">${this.esc(fn.address)}</div>` : ""}
              ${fn?.dressCode ? `<div style="font-size:12px;color:#b45309;margin-top:6px;font-style:italic;">Dress code — ${this.esc(fn.dressCode)}</div>` : ""}
            </div>
            ${
              maps
                ? `<div style="margin-top:18px;"><a href="${maps}" target="_blank" style="display:inline-block;background:#e11d48;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:999px;">📍 Get Directions</a></div>`
                : ""
            }
          </div>
          <div style="padding:14px;text-align:center;background:#fffaf8;border-top:1px solid #f1e4e0;">
            <p style="font-size:11px;color:#a8a29e;margin:0;">Sent via EventSH</p>
          </div>
        </div>
      </div>`;
    return { subject, html };
  }

  // ---- email helpers -----------------------------------------------------

  private esc(s?: string): string {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Escape + turn newlines into <br/> for free-text blocks in the email.
  private escMultiline(s?: string): string {
    return this.esc(s).replace(/\r?\n/g, "<br/>");
  }

  private sideLabel(side?: string): string {
    if (side === "groom") return "Groom's side";
    if (side === "bride") return "Bride's side";
    return "";
  }

  // Google Maps search link for a venue (name + address). "" when neither set.
  private mapsLink(venueName?: string, address?: string): string {
    const q = [venueName, address].filter(Boolean).join(" ").trim();
    if (!q) return "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  private prettyDate(date?: string): string {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  // "18:00" -> "6:00 PM"; anything unexpected is returned unchanged.
  private prettyTime(time?: string): string {
    if (!time) return "";
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!m) return time;
    let h = Number(m[1]);
    const min = m[2];
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${min} ${ampm}`;
  }

  // Build the HTML for one ceremony card, including its Google Maps button.
  private functionCard(fn: any): string {
    const when = [
      this.prettyDate(fn?.date),
      [this.prettyTime(fn?.time), this.prettyTime(fn?.endTime)]
        .filter(Boolean)
        .join(" – "),
    ]
      .filter(Boolean)
      .join("  ·  ");
    const maps = this.mapsLink(fn?.venueName, fn?.address);
    return `
      <tr><td style="padding:14px 16px;border:1px solid #f1e4e0;border-radius:12px;background:#fffaf8;">
        <div style="font-size:16px;font-weight:700;color:#9f1239;">${this.esc(fn?.name)}</div>
        ${when ? `<div style="font-size:13px;color:#78716c;margin-top:3px;">${this.esc(when)}</div>` : ""}
        ${fn?.venueName ? `<div style="font-size:14px;color:#44403c;margin-top:6px;font-weight:600;">${this.esc(fn.venueName)}</div>` : ""}
        ${fn?.address ? `<div style="font-size:13px;color:#78716c;margin-top:1px;">${this.esc(fn.address)}</div>` : ""}
        ${fn?.dressCode ? `<div style="font-size:12px;color:#b45309;margin-top:6px;font-style:italic;">Dress code — ${this.esc(fn.dressCode)}</div>` : ""}
        ${fn?.accommodation ? `<div style="font-size:12px;color:#2f6f5e;margin-top:6px;">🏨 Stay: ${this.escMultiline(fn.accommodation)}</div>` : ""}
        ${
          maps
            ? `<a href="${maps}" target="_blank" style="display:inline-block;margin-top:10px;background:#e11d48;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 16px;border-radius:999px;">📍 View on Google Maps</a>`
            : ""
        }
      </td></tr>
      <tr><td style="height:10px;line-height:10px;">&nbsp;</td></tr>`;
  }

  private async sendRsvpConfirmation(
    event: any,
    rsvp: {
      name: string;
      email: string;
      attending: boolean;
      guestCount: number;
      side: string;
      selectedFunctions: { id: string; name: string }[];
    },
    senderConfig?: OrgEmailConfig,
  ): Promise<void> {
    if (!rsvp.email) return;
    const marriage = event?.marriage || {};
    const coupleNames =
      [marriage.partner1Name, marriage.partner2Name].filter(Boolean).join(" & ") ||
      event?.title ||
      "The Wedding";

    const allFns: any[] = Array.isArray(event?.functions) ? event.functions : [];
    // Detail the ceremonies the guest chose (match by id, then name). If they
    // are attending but picked none, fall back to listing every ceremony.
    const selIds = new Set(rsvp.selectedFunctions.map((f) => f.id).filter(Boolean));
    const selNames = new Set(
      rsvp.selectedFunctions.map((f) => f.name).filter(Boolean),
    );
    let detailFns = allFns.filter(
      (f) => selIds.has(f?.id) || selNames.has(f?.name),
    );
    if (rsvp.attending && detailFns.length === 0) detailFns = allFns;
    if (!rsvp.attending) detailFns = [];

    const sideText = this.sideLabel(rsvp.side);
    const guestName = this.esc(rsvp.name) || "there";

    const statusBlock = rsvp.attending
      ? `<p style="margin:0 0 6px;font-size:16px;color:#166534;font-weight:600;">🎉 You're on the guest list!</p>
         <p style="margin:0 0 4px;font-size:14px;color:#44403c;">Number of guests (incl. you): <strong>${rsvp.guestCount}</strong></p>
         ${sideText ? `<p style="margin:0;font-size:14px;color:#44403c;">Attending from: <strong>${this.esc(sideText)}</strong></p>` : ""}`
      : `<p style="margin:0 0 6px;font-size:16px;color:#78716c;font-weight:600;">Your response has been noted.</p>
         <p style="margin:0;font-size:14px;color:#44403c;">We're sorry you can't make it — thank you for letting us know. 💛</p>`;

    const ceremoniesBlock =
      detailFns.length > 0
        ? `<h2 style="font-size:15px;text-transform:uppercase;letter-spacing:2px;color:#9f1239;margin:28px 0 14px;">Ceremony Details</h2>
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
             ${detailFns.map((f) => this.functionCard(f)).join("")}
           </table>`
        : "";

    const infoSection = (title: string, body?: string): string =>
      body && body.trim()
        ? `<h2 style="font-size:15px;text-transform:uppercase;letter-spacing:2px;color:#9f1239;margin:28px 0 10px;">${this.esc(title)}</h2>
           <div style="font-size:14px;color:#44403c;line-height:1.7;background:#fffaf8;border:1px solid #f1e4e0;border-radius:12px;padding:14px 16px;">${this.escMultiline(body)}</div>`
        : "";

    const accommodationsBlock = infoSection(
      "Accommodations",
      marriage.accommodations,
    );
    const additionalBlock = infoSection(
      "Good to Know",
      marriage.additionalInfo,
    );

    const contactBits = [
      marriage.contactName
        ? `<strong>${this.esc(marriage.contactName)}</strong>`
        : "",
      marriage.contactPhone ? this.esc(marriage.contactPhone) : "",
      marriage.contactEmail ? this.esc(marriage.contactEmail) : "",
    ].filter(Boolean);
    const contactBlock = contactBits.length
      ? `<h2 style="font-size:15px;text-transform:uppercase;letter-spacing:2px;color:#9f1239;margin:28px 0 10px;">Questions?</h2>
         <p style="font-size:14px;color:#44403c;margin:0;">Reach out to ${contactBits.join(" · ")}</p>`
      : "";

    const subject = rsvp.attending
      ? `💛 Your RSVP is confirmed — ${coupleNames}`
      : `RSVP received — ${coupleNames}`;

    const html = `
      <div style="margin:0;padding:24px 12px;background:#fdf6f3;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #f1e4e0;font-family:Georgia,'Times New Roman',serif;">
          <div style="background:linear-gradient(135deg,#e11d48,#be123c);padding:34px 24px;text-align:center;">
            <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#ffe4e6;">The Wedding of</div>
            <div style="font-size:30px;color:#ffffff;font-weight:700;margin-top:6px;">${this.esc(coupleNames)}</div>
          </div>
          <div style="padding:28px 26px;">
            <p style="font-size:16px;color:#44403c;margin:0 0 16px;">Dear ${guestName},</p>
            ${statusBlock}
            ${ceremoniesBlock}
            ${accommodationsBlock}
            ${additionalBlock}
            ${contactBlock}
            <p style="font-size:14px;color:#78716c;margin:28px 0 0;">With love,<br/>${this.esc(coupleNames)}</p>
          </div>
          <div style="padding:16px;text-align:center;background:#fffaf8;border-top:1px solid #f1e4e0;">
            <p style="font-size:11px;color:#a8a29e;margin:0;">You can update your RSVP anytime from the wedding page. · Sent via EventSH</p>
          </div>
        </div>
      </div>`;

    await this.mailService.sendEmail({
      to: rsvp.email,
      subject,
      html,
      senderConfig,
    });
  }
}
