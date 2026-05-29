import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type VendorDocument = Vendor & Document;

/**
 * Vendor schema for stall exhibitors/vendors at events.
 * Dedicated 'vendors' collection — vendor details persist across events.
 */
@Schema({ collection: "vendors", timestamps: true })
export class Vendor {
  // Owning organizer — populated when the vendor is created via the
  // organizer's exhibitor list. Vendors created through stall registration
  // before this field existed will be null and surface only via stalls.
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: false, index: true })
  organizerId?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  email: string;

  @Prop()
  businessEmail: string;

  @Prop()
  phone: string;

  @Prop()
  country: string;

  @Prop({ default: false })
  hasDocVerification: boolean;

  @Prop({ default: false })
  rejected: boolean;

  // Denormalised "this vendor has at least one active exhibitor
  // membership" flag. Source of truth lives in ExhibitorMembership;
  // MembershipsService writes this whenever an active membership starts,
  // is rejected, or expires. The eventfront/CRM read it directly so
  // member pricing kicks in the instant the vendor logs in — no extra
  // round-trip to the memberships endpoint needed.
  @Prop({ default: false })
  isMember: boolean;

  @Prop()
  whatsAppNumber: string;

  @Prop()
  whatsappNumber: string;

  @Prop()
  countryCode: string;

  @Prop()
  phoneNumber: string;

  @Prop()
  shopName: string;

  @Prop()
  businessName: string;

  @Prop()
  businessType: string;

  @Prop()
  businessDescription: string;

  @Prop()
  businessCategory: string;

  @Prop()
  address: string;

  @Prop()
  city: string;

  @Prop()
  state: string;

  @Prop()
  pincode: string;

  @Prop()
  brandName: string;

  @Prop()
  nameOfApplicant: string;

  @Prop()
  businessOwnerNationality: string;

  @Prop()
  registrationNumber: string;

  @Prop()
  residency: string;

  @Prop()
  companyLogo: string;

  @Prop()
  faceBookLink: string;

  @Prop()
  instagramLink: string;

  @Prop()
  productDescription: string;

  @Prop([String])
  productImage: string[];

  @Prop()
  registrationImage: string;

  @Prop()
  refundPaymentDescription: string;

  @Prop()
  noOfOperators: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  approved: boolean;
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);
