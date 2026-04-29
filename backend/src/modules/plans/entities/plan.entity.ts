import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type PlanDocument = Plan & Document;

// Eventsh is organizer-only — plans cannot belong to any other module type.
export enum ModuleType {
  ORGANIZER = "Organizer",
}

// Use a dedicated collection so eventsh plans stay isolated from kioscart's
// shared `plans` collection on the live MongoDB.
@Schema({ timestamps: true, collection: "eventsh_plans" })
export class Plan {
  @Prop({ required: true, unique: true })
  planName: string;

  @Prop({ required: true })
  price: number;

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
  };

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
