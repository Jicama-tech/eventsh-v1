import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

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

  // Targeted visibility — when populated, ONLY organizers whose _id is
  // in this list see/can buy this plan. Empty / undefined means the
  // plan is shown to every organizer (existing behaviour). Useful for
  // admins running pilot tiers, partner-exclusive plans, or grandfather
  // pricing for specific organizers.
  @Prop({ type: [{ type: Types.ObjectId, ref: "Organizer" }], default: [] })
  visibleToOrganizers?: Types.ObjectId[];

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
    // Exhibitor membership programs. When enabled, the organizer can
    // create membership tiers in Settings, list them on the storefront,
    // verify purchases in the dashboard inbox, and offer Member pricing
    // on Space templates. `limit` caps how many distinct tiers
    // (e.g. Gold/Silver/Bronze) the organizer can author. Field name
    // matches the rest of the module configs so the admin pricing form
    // can render it generically.
    membership?: { enabled: boolean; limit?: number };
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
