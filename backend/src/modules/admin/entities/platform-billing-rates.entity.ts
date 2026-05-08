import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type PlatformBillingRatesDocument =
  HydratedDocument<PlatformBillingRates>;

/**
 * Single-document collection holding the platform fees super-admin charges
 * organizers per booking. Read at request time by the billing endpoint so
 * changes apply immediately to "Total Owed" computations.
 */
@Schema({ collection: "platform_billing_rates", timestamps: true })
export class PlatformBillingRates {
  @Prop({ type: Number, required: true, min: 0, default: 20 })
  stallRate: number;

  @Prop({ type: Number, required: true, min: 0, default: 20 })
  roundTableRate: number;

  @Prop({ type: Number, required: true, min: 0, default: 5 })
  chairRate: number;

  @Prop({ type: Number, required: true, min: 0, default: 20 })
  speakerRate: number;

  @Prop({ type: String, required: true, default: "USD" })
  currency: string;

  @Prop({ type: Types.ObjectId, ref: "Admin" })
  updatedBy?: Types.ObjectId;
}

export const PlatformBillingRatesSchema = SchemaFactory.createForClass(
  PlatformBillingRates,
);
