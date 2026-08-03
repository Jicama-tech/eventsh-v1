import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type SponsorDocument = Sponsor & Document;

/**
 * Sponsor identity — a business an organizer works with, kept in their own
 * directory and reusable across events. Mirrors the Supplier/Vendor split:
 * the Sponsor is the identity, a SponsorRequest is the per-event application.
 *
 * Organizers add these by hand (an offline sponsor they signed elsewhere);
 * applications submitted through the public form stay in `sponsorrequests`.
 */
@Schema({ collection: "sponsors", timestamps: true })
export class Sponsor {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  @Prop({ required: true })
  companyName: string;

  @Prop({ default: "" })
  contactName: string;

  // Personal / primary contact email.
  @Prop({ lowercase: true, trim: true, default: "" })
  email: string;

  // Separate company address (accounts@, info@, …). Mirrors the supplier CRM.
  @Prop({ lowercase: true, trim: true, default: "" })
  businessEmail: string;

  @Prop({ default: "" })
  phone: string;

  @Prop({ default: "" })
  countryCode: string;

  @Prop({ default: "" })
  website: string;

  // Uploaded business logo path under /uploads/sponsors.
  @Prop({ default: "" })
  logo: string;

  @Prop({ default: "" })
  notes: string;

  /**
   * Whether this sponsor's logo appears in the eventfront sponsor bar.
   * On by default — the organizer deselects the ones they'd rather not show.
   * Applies wherever this sponsor is confirmed.
   */
  @Prop({ default: true })
  showOnBar: boolean;

  @Prop({ default: true })
  isActive: boolean;
}

export const SponsorSchema = SchemaFactory.createForClass(Sponsor);
