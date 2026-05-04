import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type CouponDocument = Coupon & Document;

@Schema({ timestamps: true })
export class Coupon {
  @Prop()
  shopkeeperId?: string;

  @Prop()
  organizerId?: string;

  @Prop({ required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ enum: ["PERCENTAGE", "FLAT"], default: "PERCENTAGE" })
  discountType: "PERCENTAGE" | "FLAT";

  @Prop()
  discountPercentage?: number;

  @Prop()
  flatDiscountAmount?: number;

  @Prop()
  minOrderAmount?: number;

  @Prop({ default: 0 })
  usedCount: number;

  @Prop()
  maxUsage?: number;

  @Prop()
  expiryDate?: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ enum: ["SHOPKEEPER", "ORGANIZER", "GLOBAL"], default: "GLOBAL" })
  appliesTo: "SHOPKEEPER" | "ORGANIZER" | "GLOBAL";

  @Prop({ default: false })
  isDeleted: boolean;

  // Legacy single-event field (kept for backward compatibility with old coupons)
  @Prop()
  eventId?: string;

  // New multi-event field — coupon applies to any event whose id is in this list.
  // Empty/missing means the coupon is global (organizer-wide).
  @Prop({ type: [String], default: [] })
  eventIds?: string[];
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

// CouponSchema.index({ code: 1 });
CouponSchema.index({ expiryDate: 1 });
CouponSchema.index({ shopkeeperId: 1 });
CouponSchema.index({ organizerId: 1 });
