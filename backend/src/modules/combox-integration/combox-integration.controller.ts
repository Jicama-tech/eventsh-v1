import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { InjectModel } from "@nestjs/mongoose";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Model, Types } from "mongoose";
import { ComboxKeyGuard } from "./combox-key.guard";
import { ComboxFeedService, FEED_SECTIONS, FeedSection } from "./combox-feed.service";
import { ComboxPaymentsService } from "./combox-payments.service";
import { ComboxActionsService } from "./combox-actions.service";

// A payment proof is kept with the other stall uploads, under a name of its own
const proofName = (_req: any, file: any, cb: any) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
const proofImage = (_req: any, file: any, cb: any) =>
  /\/(jpg|jpeg|png|gif|webp)$/.test(file.mimetype) ? cb(null, true) : cb(new BadRequestException("Only image files are allowed."), false);

// Everything here is scoped to the organizer the API key belongs to
// (ApiKeyGuard resolves req.organizerId from the key, never from the caller).
@Controller("combox-integration")
@UseGuards(ComboxKeyGuard, ThrottlerGuard)
export class ComboxIntegrationController {
  constructor(
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel("Ticket") private readonly ticketModel: Model<any>,
    private readonly feed: ComboxFeedService,
    private readonly payments: ComboxPaymentsService,
    private readonly actions: ComboxActionsService,
  ) {}

  /** Cheap check that the key works; returns the organizer id it is locked to. */
  @Get("ping")
  ping(@Req() req: any) {
    return { ok: true, organizerId: req.organizerId };
  }

  @Get("events")
  async events(@Req() req: any) {
    const organizer = new Types.ObjectId(req.organizerId);
    const events = await this.eventModel
      .find({ organizer: { $in: [req.organizerId, organizer] } }) // stored as text on older events, as an ObjectId on newer ones
      .select(
        "title description slug eventType startDate time endDate endTime location address ticketPrice totalTickets visibility tags status published",
      )
      .sort({ startDate: -1 })
      .limit(500)
      .lean()
      .exec();

    const sold = await this.ticketModel
      .aggregate([
        {
          $match: {
            organizerId: { $in: [req.organizerId, organizer] },
            status: { $in: ["confirmed", "used"] },
          },
        },
        { $unwind: "$ticketDetails" },
        {
          $group: {
            _id: "$eventId",
            tickets: { $sum: "$ticketDetails.quantity" },
            revenue: { $sum: "$totalAmount" },
          },
        },
      ])
      .exec();
    const soldBy = new Map(sold.map((s: any) => [String(s._id), s]));

    return {
      events: events.map((e: any) => ({
        id: String(e._id),
        title: e.title,
        description: e.description ?? null,
        slug: e.slug ?? null,
        eventType: e.eventType ?? null,
        startDate: e.startDate,
        time: e.time ?? null,
        endDate: e.endDate ?? null,
        endTime: e.endTime ?? null,
        location: e.location ?? null,
        address: e.address ?? null,
        ticketPrice: e.ticketPrice ?? null,
        totalTickets: e.totalTickets ?? null,
        visibility: e.visibility ?? null,
        tags: e.tags ?? [],
        status: e.status ?? null,
        published: e.published !== false,
        ticketsSold: soldBy.get(String(e._id))?.tickets ?? 0,
        revenue: soldBy.get(String(e._id))?.revenue ?? 0,
      })),
    };
  }

  /** Who the organizer is and the currency their figures are in. */
  @Get("organizer")
  organizer(@Req() req: any) {
    return this.feed.organizerInfo(req.organizerId);
  }

  /** Profit and loss of every event (eventsh's own calculation). */
  @Get("pnl")
  pnl(@Req() req: any) {
    return this.feed.organizerPnl(req.organizerId);
  }

  @Get("events/:id")
  eventDetail(@Req() req: any, @Param("id") id: string) {
    return this.feed.eventDetail(req.organizerId, id);
  }

  /** One part of an event as a table: tickets, exhibitors, speakers, sponsors, workshops, ... */
  @Get("events/:id/:section")
  section(@Req() req: any, @Param("id") id: string, @Param("section") section: string) {
    if (!(FEED_SECTIONS as readonly string[]).includes(section)) {
      throw new NotFoundException("Unknown section");
    }
    return this.feed.section(req.organizerId, id, section as FeedSection);
  }

  /**
   * Approve a payment that is waiting for the organizer (exhibitor, speaker, sponsor, workshop or round-table
   * booking). Runs the same confirmation eventsh runs from its own dashboard.
   */
  @Post("payments/:section/:id/approve")
  @HttpCode(200)
  approvePayment(
    @Req() req: any,
    @Param("section") section: string,
    @Param("id") id: string,
    @Body() body: { notes?: string },
  ) {
    return this.payments.approve(req.organizerId, section, id, body?.notes);
  }

  /** The proof of an exhibitor's payment (a transaction ID and/or a screenshot), saved on the booking as Eventsh does. */
  @Post("exhibitors/:rowId/payment-proof")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("screenshot", { storage: diskStorage({ destination: "./uploads/stalls", filename: proofName }), fileFilter: proofImage, limits: { fileSize: 5 * 1024 * 1024 } }))
  paymentProof(@Req() req: any, @Param("rowId") rowId: string, @UploadedFile() file: any, @Body() body: any) {
    return this.actions.paymentProof(req.organizerId, rowId, typeof body?.transactionId === "string" ? body.transactionId : undefined, file);
  }

  /** An exhibitor's ticket as a PDF. */
  @Get("exhibitors/:rowId/ticket")
  async exhibitorTicket(@Req() req: any, @Param("rowId") rowId: string, @Res() res: any) {
    const { buffer, filename } = await this.actions.exhibitorTicket(req.organizerId, rowId);
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Content-Length": buffer.length.toString() });
    res.end(buffer);
  }

  /** One exhibitor, speaker or visitor in full: every field and the timeline (the View dialog). */
  @Get("events/:id/:section/:rowId")
  rowDetail(@Req() req: any, @Param("id") id: string, @Param("section") section: string, @Param("rowId") rowId: string) {
    return this.feed.rowDetail(req.organizerId, id, section, rowId);
  }

  /** Send the ticket again to every confirmed exhibitor of an event. */
  @Post("events/:id/bulk-send-tickets")
  @HttpCode(200)
  bulkSend(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    return this.actions.bulkSend(req.organizerId, id, body?.message, body?.channels, body?.attachTicket !== false);
  }

  /** An organizer action on one row (confirm, cancel, delete, restore, payment status, speaker decision, resend ticket, ...). */
  @Post("actions/:section/:id/:action")
  @HttpCode(200)
  act(@Req() req: any, @Param("section") section: string, @Param("id") id: string, @Param("action") action: string, @Body() body: any) {
    return this.actions.run(req.organizerId, section, id, action, body);
  }

  /**
   * Confirmed ticket buyers, oldest change first so ComBox can page through
   * with `since` (an ISO date) = the last updatedAt it has seen.
   */
  @Get("attendees")
  async attendees(
    @Req() req: any,
    @Query("since") since?: string,
    @Query("eventId") eventId?: string,
    @Query("limit") limit?: string,
  ) {
    const filter: any = {
      organizerId: { $in: [req.organizerId, new Types.ObjectId(req.organizerId)] },
      status: { $in: ["confirmed", "used"] },
    };
    if (since && !isNaN(Date.parse(since))) {
      filter.updatedAt = { $gt: new Date(since) };
    }
    if (eventId && Types.ObjectId.isValid(eventId)) {
      filter.eventId = new Types.ObjectId(eventId);
    }
    const take = Math.min(Math.max(parseInt(limit || "200", 10) || 200, 1), 500);

    const tickets = await this.ticketModel
      .find(filter)
      .select(
        "ticketId eventId eventTitle eventDate customerName customerEmail customerWhatsapp ticketDetails totalAmount status isUsed attendance purchaseDate updatedAt",
      )
      .sort({ updatedAt: 1 })
      .limit(take)
      .lean()
      .exec();

    return {
      attendees: tickets.map((t: any) => ({
        ticketId: t.ticketId,
        eventId: String(t.eventId),
        eventTitle: t.eventTitle,
        eventDate: t.eventDate,
        name: t.customerName ?? null,
        email: t.customerEmail ?? null,
        whatsapp: t.customerWhatsapp ?? null,
        tickets: (t.ticketDetails || []).map((d: any) => ({
          type: d.ticketType,
          quantity: d.quantity,
          price: d.price,
        })),
        totalAmount: t.totalAmount,
        status: t.status,
        checkedIn: !!(t.isUsed || t.attendance),
        purchasedAt: t.purchaseDate,
        updatedAt: t.updatedAt,
      })),
      hasMore: tickets.length === take,
    };
  }
}
