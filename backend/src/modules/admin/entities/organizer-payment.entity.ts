import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type OrganizerPaymentDocument = HydratedDocument<OrganizerPayment>;

/**
 * A single payment received from an organizer toward their platform fees
 * (Super-admin charges $20 per booked stall / table / speaker + $5 per
 * booked round-table chair). The dashboard's "Total Owed" is computed as
 * "live total billable" minus the sum of these payment records.
 */
@Schema({ collection: "organizer_payments", timestamps: true })
export class OrganizerPayment {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  /** Amount in USD. We bill in USD platform-wide. */
  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  /** When the platform actually received the payment. Defaults to now. */
  @Prop({ type: Date, default: () => new Date() })
  paidOn: Date;

  /** Free-text note (cheque #, transfer ref, conversation, etc.). */
  @Prop({ type: String, default: "" })
  note: string;

  /** Admin who logged the payment. */
  @Prop({ type: Types.ObjectId, ref: "Admin" })
  recordedBy?: Types.ObjectId;
}

export const OrganizerPaymentSchema =
  SchemaFactory.createForClass(OrganizerPayment);
