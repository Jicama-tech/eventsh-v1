import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  PaymentFeedback,
  PaymentFeedbackDocument,
} from "./schemas/payment-feedback.schema";
import { CreatePaymentFeedbackDto } from "./dto/payment-feedback.dto";

@Injectable()
export class PaymentFeedbackService {
  constructor(
    @InjectModel(PaymentFeedback.name)
    private readonly model: Model<PaymentFeedbackDocument>,
  ) {}

  async create(dto: CreatePaymentFeedbackDto) {
    if (!Types.ObjectId.isValid(dto.organizerId)) {
      throw new BadRequestException("Invalid organizerId");
    }
    const doc = await this.model.create({
      organizerId: new Types.ObjectId(dto.organizerId),
      eventId:
        dto.eventId && Types.ObjectId.isValid(dto.eventId)
          ? new Types.ObjectId(dto.eventId)
          : undefined,
      eventTitle: dto.eventTitle || "",
      paymentType: dto.paymentType,
      rating: dto.rating,
      comment: dto.comment || "",
      payerName: dto.payerName || "",
      payerEmail: dto.payerEmail || "",
      bookingId: dto.bookingId || "",
      amount: typeof dto.amount === "number" ? dto.amount : 0,
    });
    return { success: true, data: doc };
  }

  private summarize(items: PaymentFeedbackDocument[]) {
    const count = items.length;
    const avg = count
      ? Math.round(
          (items.reduce((s, i) => s + (i.rating || 0), 0) / count) * 10,
        ) / 10
      : 0;
    return { count, avg };
  }

  // Organizer's own feedback across all their events.
  async listForOrganizer(organizerId: string) {
    if (!Types.ObjectId.isValid(organizerId)) {
      throw new BadRequestException("Invalid organizerId");
    }
    const items = await this.model
      .find({ organizerId: new Types.ObjectId(organizerId) })
      .sort({ createdAt: -1 })
      .lean();
    return { success: true, ...this.summarize(items as any), items };
  }

  // Platform-wide list for the Eventsh admin, newest first, optional filter.
  async listAll(paymentType?: string, minRating?: number) {
    const query: any = {};
    if (paymentType && paymentType !== "all") query.paymentType = paymentType;
    if (minRating) query.rating = { $gte: Number(minRating) };
    const items = await this.model
      .find(query)
      .populate("organizerId", "organizationName email name")
      .sort({ createdAt: -1 })
      .lean();
    return { success: true, ...this.summarize(items as any), items };
  }
}
