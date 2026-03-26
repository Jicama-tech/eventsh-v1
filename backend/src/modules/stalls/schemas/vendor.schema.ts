import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type VendorDocument = Vendor & Document;

/**
 * Vendor schema for stall exhibitors/vendors at events.
 * Dedicated 'vendors' collection — vendor details persist across events.
 */
@Schema({ collection: "vendors", timestamps: true })
export class Vendor {
  @Prop({ required: true })
  name: string;

  @Prop()
  email: string;

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
