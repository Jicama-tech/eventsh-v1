import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { StallsService } from "../stalls/stalls.service";
import { SpeakerRequestsService } from "../speaker-requests/speaker-requests.service";
import { SponsorsService } from "../sponsors/sponsors.service";
import { RoundTableBookingsService } from "../round-table-bookings/round-table-bookings.service";
import { WorkshopBookingsService } from "../workshop-bookings/workshop-bookings.service";

/** Feed sections whose payments the organizer approves by hand (bank transfer / proof). */
export const APPROVABLE_SECTIONS = ["exhibitors", "speakers", "sponsors", "workshops", "roundtables"] as const;
export type ApprovableSection = (typeof APPROVABLE_SECTIONS)[number];

/**
 * Whether a row of a feed section is waiting for the organizer to approve its payment. The same rules the
 * existing screens use, so ComBox offers Approve exactly where eventsh does.
 */
export function awaitingApproval(section: string, row: any): boolean {
  switch (section) {
    case "exhibitors":
      return row.paymentStatus !== "Paid" && ["Pending", "Approved", "Confirmed", "Processing", "Unpaid"].includes(row.status);
    case "speakers":
      return !!row.isCharged && row.paymentStatus === "Unpaid" && !["Rejected", "Cancelled"].includes(row.status);
    case "sponsors":
      return row.status === "Payment Submitted";
    case "workshops":
    case "roundtables":
      return row.paymentStatus === "Submitted";
    default:
      return false;
  }
}

/**
 * Approves a payment on behalf of the organizer the API key belongs to. It calls the same service methods the
 * eventsh dashboard calls (QR, pass, e-mail and WhatsApp included), after proving the item is the organizer's.
 */
@Injectable()
export class ComboxPaymentsService {
  constructor(
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel("Stall") private readonly stallModel: Model<any>,
    @InjectModel("SpeakerRequest") private readonly speakerModel: Model<any>,
    @InjectModel("SponsorRequest") private readonly sponsorModel: Model<any>,
    @InjectModel("WorkshopBooking") private readonly workshopModel: Model<any>,
    @InjectModel("RoundTableBooking") private readonly roundTableModel: Model<any>,
    private readonly stalls: StallsService,
    private readonly speakers: SpeakerRequestsService,
    private readonly sponsors: SponsorsService,
    private readonly roundTables: RoundTableBookingsService,
    private readonly workshops: WorkshopBookingsService,
  ) {}

  private model(section: ApprovableSection): Model<any> {
    return {
      exhibitors: this.stallModel,
      speakers: this.speakerModel,
      sponsors: this.sponsorModel,
      workshops: this.workshopModel,
      roundtables: this.roundTableModel,
    }[section];
  }

  async approve(organizerId: string, section: string, id: string, notes?: string) {
    if (!(APPROVABLE_SECTIONS as readonly string[]).includes(section)) {
      throw new NotFoundException("Unknown payment type");
    }
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException("Not found");
    const kind = section as ApprovableSection;

    const doc: any = await this.model(kind).findById(id).select("eventId status paymentStatus isCharged").lean();
    if (!doc) throw new NotFoundException("Not found");
    const event = await this.eventModel.exists({ _id: doc.eventId?._id ?? doc.eventId, organizer: { $in: [organizerId, new Types.ObjectId(organizerId)] } });
    if (!event) throw new NotFoundException("Not found");

    if (!awaitingApproval(kind, doc)) {
      throw new BadRequestException("There is no payment waiting for approval here.");
    }

    const note = notes?.trim() || "Payment approved from ComBox.";
    const by = "ComBox";
    switch (kind) {
      case "exhibitors":
        await this.stalls.confirmPayment(id, note, by);
        break;
      case "speakers":
        await this.speakers.confirmPayment(id, note, by);
        break;
      case "sponsors":
        await this.sponsors.verifyPayment(id, { notes: note, changedBy: by } as any);
        break;
      case "roundtables":
        await this.roundTables.confirmPayment(id);
        break;
      case "workshops":
        await this.workshops.confirmPayment(id);
        break;
    }

    return { ok: true, section: kind, id };
  }
}
