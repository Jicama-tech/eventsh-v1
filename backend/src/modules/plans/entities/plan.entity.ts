import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type PlanDocument = Plan & Document;

// Plans target one of two account types. Individual plans are designed for
// single-event organizers (weddings, birthdays, one-off conferences) and
// surface a constrained feature set. Organizer plans are the full multi-event
// product. New organizers are auto-assigned the default plan matching their
// chosen accountType at registration.
export enum ModuleType {
  ORGANIZER = "Organizer",
  INDIVIDUAL = "Individual",
}

// Use a dedicated collection so eventsh plans stay isolated from kioscart's
// shared `plans` collection on the live MongoDB.
@Schema({ timestamps: true, collection: "eventsh_plans" })
export class Plan {
  @Prop({ required: true, unique: true })
  planName: string;

  @Prop({ required: true })
  price: number;

  @Prop({ type: Number, default: 0 })
  priceINR: number;

  @Prop({ required: true, type: [String] })
  features: string[];

  @Prop({
    required: true,
    enum: ModuleType,
    default: ModuleType.ORGANIZER,
  })
  moduleType: ModuleType;

  @Prop({ required: true })
  validityInDays: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop()
  description?: string;

  @Prop({ type: Object, default: {} })
  modules: {
    // Events
    events?: { enabled: boolean; limit: number };
    // Tickets / payments
    tickets?: { enabled: boolean };
    razorpay?: { enabled: boolean };
    coupons?: { enabled: boolean };
    // Stalls / vendors
    stalls?: { enabled: boolean; limit: number };
    speakerRequests?: { enabled: boolean };
    roundTableBookings?: { enabled: boolean };
    // Storefront
    storefront?: { enabled: boolean };
    customDomain?: { enabled: boolean };
    // Analytics & CRM
    analytics?: { enabled: boolean };
    crm?: { enabled: boolean };
    // Communication
    whatsappQR?: { enabled: boolean };
    instagram?: { enabled: boolean };
    // Operators
    operators?: { enabled: boolean; limit: number };
    /**
     * Per-audience feedback collection. `enabled` is the master toggle;
     * `audiences` controls which audience types this plan can collect
     * feedback from. Backed by the existing FeedbackAudience enum in
     * feedback.schema.ts ("visitor" | "exhibitor" | "speaker" | "round_table").
     */
    feedback?: {
      enabled: boolean;
      audiences?: {
        visitor?: boolean;
        exhibitor?: boolean;
        speaker?: boolean;
        roundTable?: boolean;
      };
    };
  };

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
