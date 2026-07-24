import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type SupplierDocument = Supplier & Document;

/**
 * Supplier identity — a 3rd-party service provider (catering, décor, sound,
 * etc.) that an organizer works with. Lives in its own `suppliers` collection
 * and persists across events, mirroring the Vendor↔Stall split: the Supplier
 * is the identity, a SupplierRequest is the per-event quotation.
 */
@Schema({ collection: "suppliers", timestamps: true })
export class Supplier {
  // Owning organizer — the supplier belongs to the organizer whose event link
  // they submitted through. Lets an organizer reuse a supplier across events.
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: false, index: true })
  organizerId?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  email: string;

  @Prop()
  phone: string;

  @Prop()
  countryCode: string;

  @Prop()
  whatsAppNumber: string;

  @Prop()
  companyName: string;

  // Free-text/custom service category (catering, décor, sound, lighting, …).
  @Prop()
  serviceCategory: string;

  @Prop()
  description: string;

  @Prop()
  website: string;

  @Prop()
  country: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);
