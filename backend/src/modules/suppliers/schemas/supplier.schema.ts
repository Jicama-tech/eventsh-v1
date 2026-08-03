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

  // Personal / login email — the Gmail a supplier signs in with on the
  // quotation form (mirrors Vendor.email). Kept lowercase for lookups.
  @Prop()
  email: string;

  // Separate business/company email (mirrors Vendor.businessEmail). The
  // Gmail login also matches against this so either address lets them in.
  @Prop()
  businessEmail: string;

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

  /**
   * Where the organizer pays this supplier. Captured the first time they fill
   * a quotation and reused on every later one, so they never retype it.
   * Refreshed whenever a newer quotation supplies different details.
   */
  @Prop({ type: Object, default: {} })
  accountDetails?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscSwiftUen?: string;
    upiPaynowId?: string;
    country?: string;
  };

  @Prop({ default: true })
  isActive: boolean;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);
