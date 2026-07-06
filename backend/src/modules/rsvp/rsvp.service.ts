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
        return {
          id,
          functionId: String(a?.functionId || ""),
          functionName: String(a?.functionName || ""),
          roomType: allowed.includes(a?.roomType) ? a.roomType : "dual",
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
        };
      })
      // Keep only rows the organizer actually filled in.
      .filter((a) => a.roomName || a.notes || a.occupantNames.length);

    const doc = await this.rsvpModel
      .findOneAndUpdate(
        { _id: rsvpId, eventId },
        { $set: { roomAllotments: clean } },
        { new: true },
      )
      .lean();
    if (!doc) throw new NotFoundException("Guest RSVP not found");
    return doc as Rsvp;
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
          <div style="font-size:13px;color:#78716c;margin-top:3px;">${this.esc(this.roomTypeLabelSrv(r.roomType))} · ${r.occupants} occupant${r.occupants === 1 ? "" : "s"}</div>
          ${
            r.occupantNames && r.occupantNames.length
              ? `<div style="font-size:14px;color:#44403c;margin-top:10px;">${r.occupantNames.map((n: string) => this.esc(n)).join(" · ")}</div>`
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
            `${this.roomTypeLabelSrv(room.roomType)}  -  ${room.occupants} occupant${room.occupants === 1 ? "" : "s"}`,
            left,
            y,
            { width: right - left },
          );
        y = pdf.y + 6;
        if (room.occupantNames && room.occupantNames.length) {
          pdf
            .fontSize(12)
            .fillColor("#374151")
            .text(`Guests: ${room.occupantNames.join(", ")}`, left, y, {
              width: right - left,
            });
          y = pdf.y + 4;
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
    return {
      guestName: rsvp.name,
      coupleNames,
      eventTitle: event?.title || "",
      functionName: room.functionName || "",
      roomType: room.roomType,
      roomTypeLabel: this.roomTypeLabelSrv(room.roomType),
      roomName: room.roomName,
      occupants: room.occupants,
      occupantNames: room.occupantNames || [],
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
