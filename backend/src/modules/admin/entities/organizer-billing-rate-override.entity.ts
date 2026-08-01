import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type OrganizerBillingRateOverrideDocument =
  HydratedDocument<OrganizerBillingRateOverride>;

/**
 * Per-organizer overrides of the platform billing rates. Both fields are
 * optional — left unset means "inherit the platform default" (see
 * billing-rate-calc.util.ts resolveEffectiveRates). One document per
 * organizer (unique index on organizerId).
 */
@Schema({ collection: "organizer_billing_rate_overrides", timestamps: true })
export class OrganizerBillingRateOverride {
  @Prop({
    type: Types.ObjectId,
    ref: "Organizer",
    required: true,
    unique: true,
    index: true,
  })
  organizerId: Types.ObjectId;

  @Prop({ type: Number })
  moneyInRate?: number;

  @Prop({ type: String, enum: ["flat", "percent"] })
  moneyInRateMode?: string;

  @Prop({ type: Number })
  moneyOutRate?: number;

  @Prop({ type: String, enum: ["flat", "percent"] })
  moneyOutRateMode?: string;

  @Prop({ type: Types.ObjectId, ref: "Admin" })
  updatedBy?: Types.ObjectId;
}

export const OrganizerBillingRateOverrideSchema = SchemaFactory.createForClass(
  OrganizerBillingRateOverride,
);
