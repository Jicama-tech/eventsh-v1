import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Model, Types } from "mongoose";
import { ComboxKeyGuard } from "./combox-key.guard";

// Everything here is scoped to the organizer the API key belongs to
// (ApiKeyGuard resolves req.organizerId from the key, never from the caller).
@Controller("combox-integration")
@UseGuards(ComboxKeyGuard, ThrottlerGuard)
export class ComboxIntegrationController {
  constructor(
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel("Ticket") private readonly ticketModel: Model<any>,
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
      .find({ organizer })
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
            organizerId: organizer,
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
        ticketsSold: soldBy.get(String(e._id))?.tickets ?? 0,
        revenue: soldBy.get(String(e._id))?.revenue ?? 0,
      })),
    };
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
      organizerId: new Types.ObjectId(req.organizerId),
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
