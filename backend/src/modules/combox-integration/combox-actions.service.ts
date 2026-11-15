import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { StallsService } from "../stalls/stalls.service";
import { SpeakerRequestsService } from "../speaker-requests/speaker-requests.service";
import { TicketsService } from "../tickets/tickets.service";

/** What ComBox may do to a row of each part of an event (the rest of the part stays read-only there). */
export const ACTIONS: Record<string, string[]> = {
  exhibitors: ["confirm", "cancel", "delete", "restore", "payment-status", "confirm-amendment", "cancellation", "return-deposit", "resend-ticket"],
  speakers: ["status"],
  tickets: ["resend-email", "mark-attendance"],
};

const BY = "ComBox";

/**
 * The organizer actions of eventsh's Participants tab, run from ComBox. Each one calls the same service method the
 * eventsh dashboard calls, after proving the row belongs to an event of the organizer the API key is locked to.
 */
@Injectable()
export class ComboxActionsService {
  constructor(
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel("Stall") private readonly stallModel: Model<any>,
    @InjectModel("SpeakerRequest") private readonly speakerModel: Model<any>,
    @InjectModel("Ticket") private readonly ticketModel: Model<any>,
    private readonly stalls: StallsService,
    private readonly speakers: SpeakerRequestsService,
    private readonly tickets: TicketsService,
  ) {}

  private async ownsEvent(organizerId: string, eventId: any) {
    const ok = await this.eventModel.exists({ _id: eventId?._id ?? eventId, organizer: { $in: [organizerId, new Types.ObjectId(organizerId)] } });
    if (!ok) throw new NotFoundException("Not found");
  }

  async run(organizerId: string, section: string, id: string, action: string, body: any = {}) {
    if (!(ACTIONS[section] ?? []).includes(action)) throw new NotFoundException("Unknown action");
    if (section === "tickets") {
      const t: any = await this.ticketModel.findOne(Types.ObjectId.isValid(id) ? { _id: id } : { ticketId: id }).select("eventId ticketId").lean();
      if (!t) throw new NotFoundException("Not found");
      await this.ownsEvent(organizerId, t.eventId);
      if (action === "resend-email") return this.tickets.resendTicketEmail(id, body?.email);
      return this.tickets.markAttendance(t.ticketId);
    }
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException("Not found");
    const model = section === "exhibitors" ? this.stallModel : this.speakerModel;
    const doc: any = await model.findById(id).select("eventId").lean();
    if (!doc) throw new NotFoundException("Not found");
    await this.ownsEvent(organizerId, doc.eventId);
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 500) : undefined;

    if (section === "speakers") {
      if (!["Approved", "Rejected"].includes(body?.status)) throw new BadRequestException("Choose Approved or Rejected.");
      return this.speakers.updateStatus(id, { status: body.status, notes: notes || undefined, changedBy: BY } as any);
    }
    switch (action) {
      case "confirm":
        return this.stalls.updateStatus(id, { status: "Confirmed", changedBy: BY } as any);
      case "cancel":
        return this.stalls.updateStatus(id, { status: "Cancelled", cancellationReason: notes || "Cancelled by the organizer", changedBy: BY } as any);
      case "delete":
        return this.stalls.remove(id, BY);
      case "restore":
        return this.stalls.restoreStall(id, BY);
      case "payment-status":
        if (!["Unpaid", "Partial", "Paid"].includes(body?.paymentStatus)) throw new BadRequestException("Choose Unpaid, Partial or Paid.");
        return this.stalls.updatePaymentStatus(id, { paymentStatus: body.paymentStatus, notes, generateQr: body.paymentStatus === "Paid", changedBy: BY } as any);
      case "confirm-amendment":
        return this.stalls.confirmAmendment(id, { note: notes, changedBy: BY } as any);
      case "cancellation":
        return this.stalls.decideCancellation(id, { approve: !!body?.approve, organizerNote: notes, changedBy: BY } as any);
      case "return-deposit":
        return this.stalls.returnedDeposit(id, notes || "", BY);
      case "resend-ticket":
        return this.stalls.resendStallTicket(id);
    }
  }

  /** Send the ticket again to every confirmed exhibitor of an event, with the organizer's note. */
  async bulkSend(organizerId: string, eventId: string, message?: string, channels: { email?: boolean; whatsapp?: boolean } = { email: true }, attachTicket = true) {
    if (!Types.ObjectId.isValid(eventId)) throw new NotFoundException("Not found");
    await this.ownsEvent(organizerId, eventId);
    if (!channels.email && !channels.whatsapp) throw new BadRequestException("Pick at least one channel");
    return this.stalls.bulkSendStallTickets(eventId, message?.slice(0, 1000), channels, attachTicket);
  }
}
