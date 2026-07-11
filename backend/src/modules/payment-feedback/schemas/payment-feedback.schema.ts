import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type PaymentFeedbackDocument = PaymentFeedback & Document;

export type PaymentFeedbackType =
  | "vendor" // stall booking payment
  | "stall_edit" // stall "Edit Request" difference payment
  | "visitor" // ticket purchase
  | "speaker" // speaker fee payment
  | "round_table"; // round-table booking payment

/**
 * Star-rating + comment captured right after a payment is submitted, for ANY
 * payment flow (vendor / stall-edit / visitor / speaker / round-table). Scoped
 * to the organizer so it shows in the organizer's feedback section, and listed
 * platform-wide for the Eventsh admin.
 */
@Schema({ timestamps: true })
export class PaymentFeedback {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  // Event may not carry an id in every flow (speaker/round-table only have a
  // title in scope) — keep the id optional and always store the title.
  @Prop({ type: Types.ObjectId, ref: "Event", required: false, index: true })
  eventId?: Types.ObjectId;

  @Prop({ default: "" })
  eventTitle: string;

  @Prop({
    required: true,
    enum: ["vendor", "stall_edit", "visitor", "speaker", "round_table"],
    index: true,
  })
  paymentType: PaymentFeedbackType;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ default: "" })
  comment: string;

  @Prop({ default: "" })
  payerName: string;

  @Prop({ default: "", lowercase: true, trim: true })
  payerEmail: string;

  // The stall / ticket / speaker-request / round-table-booking id being paid.
  @Prop({ default: "" })
  bookingId: string;

  @Prop({ default: 0 })
  amount: number;

  @Prop() createdAt: Date;
  @Prop() updatedAt: Date;
}

export const PaymentFeedbackSchema =
  SchemaFactory.createForClass(PaymentFeedback);

PaymentFeedbackSchema.index({ organizerId: 1, createdAt: -1 });
