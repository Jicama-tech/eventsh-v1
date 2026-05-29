import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type MembershipPlanDocument = MembershipPlan & Document;

// Per-organizer membership tier (e.g. "Gold", "Silver"). Sold to exhibitors
// from the storefront. Soft-archived rather than hard-deleted once any
// ExhibitorMembership references it, so renewal history stays intact.
@Schema({ collection: "membership_plans", timestamps: true })
export class MembershipPlan {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true, min: 0 })
  price: number;

  // Three-letter currency code (INR, USD, ...). Derived from the organizer's
  // country at create time; the storefront and receipts use it directly.
  @Prop({ required: true, uppercase: true, maxlength: 3 })
  currency: string;

  // Duration in days. 365 = annual, 30 = monthly, etc. Computed at confirm
  // time as `endDate = startDate + durationDays * 1 day`.
  @Prop({ required: true, min: 1 })
  durationDays: number;

  // Free-form perks shown on the storefront card and in the welcome email.
  @Prop({ type: [String], default: [] })
  perks: string[];

  // Hex color used for the storefront card border / badge.
  @Prop({ default: "#6366f1" })
  color: string;

  // Whether the organizer has finished configuring the plan and wants it
  // listed on the public storefront. Plans can exist as drafts (isActive
  // true, published false) so the organizer can polish them.
  @Prop({ default: false })
  published: boolean;

  // Soft archive flag — kept around so existing memberships remain valid.
  // Once true, the storefront hides the plan even if `published` is still
  // true.
  @Prop({ default: false })
  archived: boolean;
}

export const MembershipPlanSchema = SchemaFactory.createForClass(MembershipPlan);

MembershipPlanSchema.index({ organizerId: 1, archived: 1, published: 1 });
