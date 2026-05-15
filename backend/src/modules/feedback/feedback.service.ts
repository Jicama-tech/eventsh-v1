import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import { Feedback, FeedbackDocument, FeedbackAudience } from "./schemas/feedback.schema";
import {
  SubmitTokenFeedbackDto,
  SubmitVisitorFeedbackDto,
} from "./dto/submit-feedback.dto";
import { OtpService } from "../otp/otp.service";

const FEEDBACK_TOKEN_TTL = "30d";

interface FeedbackTokenPayload {
  typ: "feedback";
  audience: FeedbackAudience;
  subjectId: string;
  eventId: string;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectModel(Feedback.name)
    private readonly feedbackModel: Model<FeedbackDocument>,
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel("Ticket") private readonly ticketModel: Model<any>,
    @InjectModel("Stall") private readonly stallModel: Model<any>,
    @InjectModel("SpeakerRequest")
    private readonly speakerRequestModel: Model<any>,
    @InjectModel("RoundTableBooking")
    private readonly roundTableBookingModel: Model<any>,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // Token helpers — short-lived JWT used in the WhatsApp deep link so the
  // submission endpoint can trust the subjectId without re-fetching auth.
  // ─────────────────────────────────────────────────────────────────────
  mintToken(
    audience: FeedbackAudience,
    subjectId: string,
    eventId: string,
  ): string {
    const payload: FeedbackTokenPayload = {
      typ: "feedback",
      audience,
      subjectId,
      eventId,
    };
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: FEEDBACK_TOKEN_TTL,
    } as any);
  }

  private verifyToken(token: string): FeedbackTokenPayload {
    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new ForbiddenException("Feedback link expired or invalid");
    }
    if (payload?.typ !== "feedback") {
      throw new ForbiddenException("Wrong token type");
    }
    return payload as FeedbackTokenPayload;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Checkout-triggered WhatsApp notification. Called by stall / speaker /
  // round-table services after a successful CHECK_OUT. Fail-soft — if the
  // baileys socket is down we log and return without crashing the scan.
  // ─────────────────────────────────────────────────────────────────────
  async notifyAfterCheckout(args: {
    audience: FeedbackAudience;
    subjectId: string;
    eventId: string;
    whatsAppNumber?: string;
    hasDeposit?: boolean;
  }) {
    if (!args.whatsAppNumber) {
      this.logger.warn(
        `Skipping ${args.audience} feedback notification — no WhatsApp number for subject ${args.subjectId}`,
      );
      return;
    }
    const event: any = await this.eventModel
      .findById(args.eventId)
      .select("title")
      .lean();
    const eventTitle = event?.title || "the event";
    const token = this.mintToken(args.audience, args.subjectId, args.eventId);
    const base = process.env.FRONTEND_BASE_URL || "https://eventsh.com";
    const link = `${base}/events/${args.eventId}?feedback=${args.audience}&token=${encodeURIComponent(token)}`;
    const reason = args.hasDeposit
      ? "Submit your feedback to release the security deposit refund"
      : "Share your experience";
    const text =
      `You've checked out from "${eventTitle}". ${reason}: ${link}`;
    try {
      await this.otpService.sendWhatsAppMessage(args.whatsAppNumber, text);
    } catch (err: any) {
      this.logger.warn(
        `WhatsApp feedback notification failed (${args.audience}/${args.subjectId}): ${err?.message}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Eligibility: resolves a feedback token to the data needed to render the
  // submission form on EventFront. Also reports if feedback has already been
  // submitted, so the form can show "thanks" instead of double-submitting.
  // ─────────────────────────────────────────────────────────────────────
  async getEligibility(token: string) {
    const payload = this.verifyToken(token);
    const event: any = await this.eventModel
      .findById(payload.eventId)
      .select("title endDate")
      .lean();
    if (!event) throw new NotFoundException("Event not found");

    let display: Record<string, any> = {};
    if (payload.audience === "exhibitor") {
      const stall: any = await this.stallModel
        .findById(payload.subjectId)
        .populate("shopkeeperId", "name email shopName businessName")
        .lean();
      if (!stall) throw new NotFoundException("Stall booking not found");
      if (!stall.hasCheckedOut) {
        throw new BadRequestException(
          "This stall hasn't been checked out yet",
        );
      }
      const sk = stall.shopkeeperId || {};
      display = {
        stallName: stall.stallName || stall.tableName,
        vendorName: sk.name,
        businessName: sk.shopName || sk.businessName,
        vendorEmail: sk.email,
      };
    } else if (payload.audience === "speaker") {
      const sr: any = await this.speakerRequestModel
        .findById(payload.subjectId)
        .lean();
      if (!sr) throw new NotFoundException("Speaker booking not found");
      if (!sr.hasCheckedOut) {
        throw new BadRequestException("Speaker hasn't been checked out yet");
      }
      display = {
        speakerName: sr.name || sr.speakerName,
        topic: sr.topic,
        speakerEmail: sr.email,
      };
    } else if (payload.audience === "round_table") {
      const rt: any = await this.roundTableBookingModel
        .findById(payload.subjectId)
        .lean();
      if (!rt) throw new NotFoundException("Round table booking not found");
      if (!rt.hasCheckedOut) {
        throw new BadRequestException(
          "Round table hasn't been checked out yet",
        );
      }
      display = {
        tableName: rt.tableName,
        guestName: rt.visitorName,
        guestEmail: rt.visitorEmail,
      };
    }

    const existing = await this.feedbackModel
      .findOne({
        eventId: payload.eventId,
        audience: payload.audience,
        subjectId: payload.subjectId,
      })
      .lean();

    return {
      audience: payload.audience,
      eventId: payload.eventId,
      eventTitle: event.title,
      subjectId: payload.subjectId,
      display,
      alreadySubmitted: !!existing,
      existing: existing
        ? { rating: existing.rating, comment: existing.comment }
        : null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Token-gated submissions. For each audience the email written into the
  // feedback row is sourced from the booking record (not the submitter) —
  // the WhatsApp link itself proves who they are.
  // ─────────────────────────────────────────────────────────────────────
  async submitTokenFeedback(
    expectedAudience: FeedbackAudience,
    eventIdInPath: string,
    dto: SubmitTokenFeedbackDto,
  ) {
    const payload = this.verifyToken(dto.token);
    if (payload.audience !== expectedAudience) {
      throw new ForbiddenException("Wrong feedback channel for this token");
    }
    if (payload.eventId !== eventIdInPath) {
      throw new ForbiddenException("Event ID does not match token");
    }

    let email = "";
    if (expectedAudience === "exhibitor") {
      const stall: any = await this.stallModel
        .findById(payload.subjectId)
        .populate("shopkeeperId", "email")
        .lean();
      if (!stall?.hasCheckedOut) {
        throw new BadRequestException("Stall hasn't been checked out");
      }
      email = (stall?.shopkeeperId?.email || "").toLowerCase();
    } else if (expectedAudience === "speaker") {
      const sr: any = await this.speakerRequestModel
        .findById(payload.subjectId)
        .lean();
      if (!sr?.hasCheckedOut) {
        throw new BadRequestException("Speaker hasn't been checked out");
      }
      email = (sr?.email || "").toLowerCase();
    } else if (expectedAudience === "round_table") {
      const rt: any = await this.roundTableBookingModel
        .findById(payload.subjectId)
        .lean();
      if (!rt?.hasCheckedOut) {
        throw new BadRequestException("Round table hasn't been checked out");
      }
      email = (rt?.visitorEmail || "").toLowerCase();
    }

    try {
      const doc = await this.feedbackModel.create({
        eventId: new Types.ObjectId(payload.eventId),
        audience: expectedAudience,
        subjectId: payload.subjectId,
        email,
        rating: dto.rating,
        comment: dto.comment || "",
      });
      return { ok: true, id: doc._id };
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException(
          "Feedback already submitted for this booking",
        );
      }
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Visitor submission: no token. We verify the event has ended and that
  // the submitter's email matches a sold ticket for the event. Feedback is
  // keyed by ticketId so one email with two tickets can submit twice.
  // ─────────────────────────────────────────────────────────────────────
  async submitVisitorFeedback(
    eventId: string,
    dto: SubmitVisitorFeedbackDto,
  ) {
    const event: any = await this.eventModel
      .findById(eventId)
      .select("endDate title")
      .lean();
    if (!event) throw new NotFoundException("Event not found");
    if (event.endDate && new Date(event.endDate) > new Date()) {
      throw new BadRequestException("Event hasn't ended yet");
    }

    const email = (dto.email || "").trim().toLowerCase();
    const tickets = await this.ticketModel
      .find({
        eventId: new Types.ObjectId(eventId),
        customerEmail: new RegExp(`^${this.escapeRegex(email)}$`, "i"),
      })
      .select("_id ticketId")
      .lean();

    if (!tickets.length) {
      throw new ForbiddenException(
        "This email isn't on the ticket list for this event",
      );
    }

    // Pick the first ticket without existing feedback — same email can hold
    // multiple tickets (group buys) and each entitles to one submission.
    const existing = await this.feedbackModel
      .find({
        eventId: new Types.ObjectId(eventId),
        audience: "visitor",
        subjectId: { $in: tickets.map((t) => String(t._id)) },
      })
      .select("subjectId")
      .lean();
    const usedIds = new Set(existing.map((f) => f.subjectId));
    const target = tickets.find((t) => !usedIds.has(String(t._id)));
    if (!target) {
      throw new ConflictException(
        "All tickets for this email already have feedback submitted",
      );
    }

    const doc = await this.feedbackModel.create({
      eventId: new Types.ObjectId(eventId),
      audience: "visitor",
      subjectId: String(target._id),
      email,
      rating: dto.rating,
      comment: dto.comment || "",
      refundStatus: "not_applicable",
    });
    return { ok: true, id: doc._id };
  }

  private escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // ─────────────────────────────────────────────────────────────────────
  // Organizer view: list every feedback for the event with per-audience
  // aggregates. Visitor section is hidden if no tickets were sold; speaker
  // and round-table sections hide if their corresponding bookings are zero.
  // ─────────────────────────────────────────────────────────────────────
  async listForEvent(eventId: string) {
    const eventObjId = new Types.ObjectId(eventId);
    const [
      feedback,
      ticketCount,
      stallCount,
      speakerCount,
      roundTableCount,
    ] = await Promise.all([
      this.feedbackModel.find({ eventId: eventObjId }).sort("-createdAt").lean(),
      this.ticketModel.countDocuments({ eventId: eventObjId }),
      this.stallModel.countDocuments({ eventId: eventObjId }),
      this.speakerRequestModel.countDocuments({ eventId: eventObjId }),
      this.roundTableBookingModel.countDocuments({ eventId: eventObjId }),
    ]);

    const byAudience: Record<
      FeedbackAudience,
      { items: any[]; avg: number; count: number; available: number }
    > = {
      visitor: { items: [], avg: 0, count: 0, available: ticketCount },
      exhibitor: { items: [], avg: 0, count: 0, available: stallCount },
      speaker: { items: [], avg: 0, count: 0, available: speakerCount },
      round_table: {
        items: [],
        avg: 0,
        count: 0,
        available: roundTableCount,
      },
    };

    for (const f of feedback) {
      const bucket = byAudience[f.audience as FeedbackAudience];
      if (!bucket) continue;
      bucket.items.push(f);
      bucket.count += 1;
      bucket.avg += f.rating;
    }
    for (const key of Object.keys(byAudience) as FeedbackAudience[]) {
      const b = byAudience[key];
      b.avg = b.count > 0 ? Number((b.avg / b.count).toFixed(2)) : 0;
    }

    return { eventId, byAudience };
  }

  // Public per-event stats: counts of each audience + average rating, no
  // individual feedback rows. Powers the "By the numbers" section on
  // EventFront for past events.
  async statsForEvent(eventId: string) {
    const eventObjId = new Types.ObjectId(eventId);
    const [
      eventDoc,
      feedback,
      ticketCount,
      stallCount,
      speakerCount,
      roundTableCount,
    ] = await Promise.all([
      this.eventModel
        .findById(eventObjId)
        .select("endDate startDate")
        .lean<any>(),
      this.feedbackModel
        .find({ eventId: eventObjId })
        .select("audience rating")
        .lean(),
      this.ticketModel.countDocuments({ eventId: eventObjId }),
      this.stallModel.countDocuments({ eventId: eventObjId }),
      this.speakerRequestModel.countDocuments({ eventId: eventObjId }),
      this.roundTableBookingModel.countDocuments({ eventId: eventObjId }),
    ]);

    if (!eventDoc) throw new NotFoundException("Event not found");
    const event: any = eventDoc;

    const audiences: FeedbackAudience[] = [
      "visitor",
      "exhibitor",
      "speaker",
      "round_table",
    ];
    const totals: Record<
      FeedbackAudience,
      { available: number; ratingCount: number; ratingAvg: number }
    > = {
      visitor: { available: ticketCount, ratingCount: 0, ratingAvg: 0 },
      exhibitor: { available: stallCount, ratingCount: 0, ratingAvg: 0 },
      speaker: { available: speakerCount, ratingCount: 0, ratingAvg: 0 },
      round_table: {
        available: roundTableCount,
        ratingCount: 0,
        ratingAvg: 0,
      },
    };
    for (const f of feedback) {
      const a = f.audience as FeedbackAudience;
      const t = totals[a];
      if (!t) continue;
      t.ratingCount += 1;
      t.ratingAvg += f.rating;
    }
    for (const a of audiences) {
      const t = totals[a];
      t.ratingAvg =
        t.ratingCount > 0 ? Number((t.ratingAvg / t.ratingCount).toFixed(2)) : 0;
    }

    const eventEnded = event.endDate
      ? new Date(event.endDate) <= new Date()
      : false;

    return { eventId, eventEnded, audiences: totals };
  }

  async setRefundStatus(
    feedbackId: string,
    status: "pending" | "refunded" | "not_applicable",
  ) {
    const doc = await this.feedbackModel.findByIdAndUpdate(
      feedbackId,
      { refundStatus: status },
      { new: true },
    );
    if (!doc) throw new NotFoundException("Feedback not found");
    return doc;
  }
}
