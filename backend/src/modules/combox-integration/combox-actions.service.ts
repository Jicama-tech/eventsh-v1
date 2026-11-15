import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { StallsService } from "../stalls/stalls.service";
import { SpeakerRequestsService } from "../speaker-requests/speaker-requests.service";
import { TicketsService } from "../tickets/tickets.service";
import { SponsorsService } from "../sponsors/sponsors.service";
import { WorkshopRequestsService } from "../workshop-requests/workshop-requests.service";
import { ScheduledSpacesService } from "../scheduled-spaces/scheduled-spaces.service";

/** What ComBox may do to a row of each part of an event (the rest of the part stays read-only there). */
export const ACTIONS: Record<string, string[]> = {
  exhibitors: ["confirm", "cancel", "delete", "restore", "payment-status", "confirm-amendment", "cancellation", "return-deposit", "resend-ticket"],
  speakers: ["status"],
  tickets: ["resend-email", "mark-attendance"],
  sponsors: ["status"],
  "workshop-hosts": ["status", "fee", "confirm-payment"],
  "scheduled-spaces": ["confirm-payment", "status", "resend-ticket", "delete"],
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
    @InjectModel("SponsorRequest") private readonly sponsorModel: Model<any>,
    @InjectModel("WorkshopRequest") private readonly workshopHostModel: Model<any>,
    @InjectModel("ScheduledSpaceRequest") private readonly scheduledModel: Model<any>,
    private readonly stalls: StallsService,
    private readonly speakers: SpeakerRequestsService,
    private readonly tickets: TicketsService,
    private readonly sponsors: SponsorsService,
    private readonly workshopHosts: WorkshopRequestsService,
    private readonly scheduled: ScheduledSpacesService,
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
    const model: Model<any> = {
      exhibitors: this.stallModel,
      speakers: this.speakerModel,
      sponsors: this.sponsorModel,
      "workshop-hosts": this.workshopHostModel,
      "scheduled-spaces": this.scheduledModel,
    }[section]!;
    const doc: any = await model.findById(id).select("eventId").lean();
    if (!doc) throw new NotFoundException("Not found");
    await this.ownsEvent(organizerId, doc.eventId);
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 500) : undefined;

    if (section === "speakers") {
      if (!["Approved", "Rejected"].includes(body?.status)) throw new BadRequestException("Choose Approved or Rejected.");
      return this.speakers.updateStatus(id, { status: body.status, notes: notes || undefined, changedBy: BY } as any);
    }
    if (section === "sponsors") {
      if (!["Approved", "Rejected", "Cancelled"].includes(body?.status)) throw new BadRequestException("Choose Approved, Rejected or Cancelled.");
      return this.sponsors.updateStatus(id, { status: body.status, notes: notes || undefined, rejectionReason: body.status === "Rejected" ? notes : undefined, changedBy: BY } as any);
    }
    if (section === "workshop-hosts") {
      if (action === "confirm-payment") return this.workshopHosts.confirmPayment(id, notes || "Payment approved from ComBox.", BY);
      if (action === "fee") {
        const fee = Number(body?.fee);
        if (typeof body?.isCharged !== "boolean" || (body.isCharged && !(fee >= 0))) throw new BadRequestException("Say whether the host is charged and the fee.");
        return this.workshopHosts.updateFee(id, { isCharged: body.isCharged, fee: body.isCharged ? fee : 0, notes: notes || undefined } as any);
      }
      if (!["Confirmed", "Rejected", "Cancelled"].includes(body?.status)) throw new BadRequestException("Choose Confirmed, Rejected or Cancelled.");
      return this.workshopHosts.updateStatus(id, { status: body.status, notes: notes || undefined, rejectionReason: body.status === "Rejected" ? notes : undefined, changedBy: BY } as any);
    }
    if (section === "scheduled-spaces") {
      switch (action) {
        case "confirm-payment":
          return this.scheduled.confirmPayment({ requestId: id, notes: notes || "Payment approved from ComBox.", changedBy: BY } as any);
        case "status":
          if (!["Confirmed", "Rejected", "Cancelled", "Completed"].includes(body?.status)) throw new BadRequestException("Choose Confirmed, Rejected, Cancelled or Completed.");
          return this.scheduled.updateStatus(id, { status: body.status, cancellationReason: notes || undefined, changedBy: BY } as any);
        case "resend-ticket":
          return this.scheduled.resendTicket(id, BY);
        case "delete":
          return this.scheduled.remove(id);
      }
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
