import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type PlatformBillingRatesDocument =
  HydratedDocument<PlatformBillingRates>;

/**
 * One document per rate PLAN: either a country-specific plan (`countryCode`
 * = ISO-2, e.g. "SG"/"IN") or the single fallback plan used by any country
 * without its own plan (`countryCode: null`). A standard (non-sparse)
 * unique index allows at most one null document, so the fallback is
 * naturally singular. Read at request time by the billing endpoints so
 * changes apply immediately to "Total Owed" computations.
 */
@Schema({ collection: "platform_billing_rates", timestamps: true })
export class PlatformBillingRates {
  // ISO-2 country code this plan applies to, or null for the fallback
  // plan applied to every country without its own explicit plan.
  @Prop({ type: String, default: null, unique: true })
  countryCode: string | null;

  // Money In — applies uniformly to every "money coming into the
  // organizer" category: confirmed tickets, booked stalls, confirmed
  // speakers, confirmed sponsors, booked round tables, booked chairs,
  // paid workshop bookings, and active memberships. "flat" = a $ amount
  // charged per unit; "percent" = a percentage of that unit's own price.
  @Prop({ type: Number, required: true, min: 0, default: 20 })
  moneyInRate: number;

  @Prop({ type: String, enum: ["flat", "percent"], default: "flat" })
  moneyInRateMode: string;

  // Money Out — applies to money the organizer pays out: paid supplier
  // requests.
  @Prop({ type: Number, required: true, min: 0, default: 20 })
  moneyOutRate: number;

  @Prop({ type: String, enum: ["flat", "percent"], default: "flat" })
  moneyOutRateMode: string;

  @Prop({ type: String, required: true, default: "USD" })
  currency: string;

  @Prop({ type: Types.ObjectId, ref: "Admin" })
  updatedBy?: Types.ObjectId;
}

export const PlatformBillingRatesSchema = SchemaFactory.createForClass(
  PlatformBillingRates,
);
