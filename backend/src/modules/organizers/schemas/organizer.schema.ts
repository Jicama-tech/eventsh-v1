import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

// ✅ NEW: Added ReceiptType Enum (From Shopkeeper)
export enum ReceiptType {
  MM_58 = "58MM",
  A4 = "A4",
}

export type OrganizerDocument = Organizer & Document;

// ✅ NEW: Razorpay linked account sub-schema (From Shopkeeper)
@Schema()
export class RazorpayLinkedAccount {
  @Prop()
  accountId: string; // acc_xxxxx from Razorpay

  @Prop({
    type: String,
    enum: ["pending_kyc", "active", "rejected", "suspended"],
    default: "pending_kyc",
  })
  status: string;

  @Prop()
  kycStatus?: string;

  @Prop()
  businessName: string;

  @Prop()
  panNumber: string;

  @Prop()
  gstNumber?: string;

  @Prop()
  uenNumber?: string;

  @Prop()
  bankAccountNumber: string;

  @Prop()
  bankIfscCode: string;

  @Prop()
  bankName: string;

  @Prop()
  accountHolderName: string;

  @Prop()
  businessEmail: string;

  @Prop()
  businessPhone: string;

  @Prop()
  verifiedAt?: Date;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

// Create Schema for RazorpayLinkedAccount to be used inside Organizer
export const RazorpayLinkedAccountSchema = SchemaFactory.createForClass(
  RazorpayLinkedAccount,
);

@Schema({ timestamps: true })
export class Organizer {
  // --- Core Identity ---
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  organizationName: string; // Kept specific to Organizer (equivalent to ShopName)

  @Prop({ required: false })
  phone: string;

  @Prop({ required: true, unique: true })
  businessEmail: string;

  @Prop({ required: true, unique: true })
  whatsAppNumber: string;

  @Prop()
  address: string;

  @Prop()
  bio: string;

  @Prop()
  description: string; // Added to match Shopkeeper

  // --- Business Details (New from Shopkeeper) ---
  // @Prop({ required: true, default: "General" }) // Added default to avoid breaking existing docs
  // businessCategory: string;

  @Prop()
  GSTNumber?: string;

  @Prop()
  UENNumber?: string;

  @Prop()
  country: string;

  @Prop({ type: Object })
  businessHours: Record<
    string,
    { open: string; close: string; closed: boolean }
  >;

  @Prop()
  termsAndConditions: string;

  // --- Status & Verification ---
  @Prop({ default: false })
  approved: boolean;

  @Prop({ default: false })
  rejected: boolean;

  // @Prop({ default: false })
  // hasDocVerification: boolean;

  // --- Financials & Commission ---
  @Prop()
  paymentURL: string;

  @Prop({ default: 0 })
  taxPercentage: number;

  @Prop({ default: 0 })
  discountPercentage: number;

  // ✅ NEW: Commission percentage (EventSH takes this %)
  @Prop({ default: 2 })
  commissionPercentage: number;

  // ✅ NEW: Razorpay linked account integration
  @Prop({ type: RazorpayLinkedAccountSchema, default: null })
  razorpay?: RazorpayLinkedAccount;

  // --- Social & QR Features ---
  @Prop({ default: 0 })
  followers: number;

  @Prop({ default: false })
  whatsAppQR: boolean;

  @Prop({ default: false })
  instagramQR: boolean;

  @Prop()
  whatsAppQRNumber: string;

  @Prop()
  instagramHandle: string;

  @Prop({ default: false })
  dynamicQR: boolean;

  // --- Bank Transfer Details ---
  @Prop({ default: false })
  bankTransferEnabled: boolean;

  @Prop()
  bankAccountNumber: string;

  @Prop()
  bankIfscCode: string;

  @Prop()
  bankName: string;

  @Prop()
  accountHolderName: string;

  @Prop()
  bankSwiftCode: string;

  @Prop()
  bankBranchCode: string;

  @Prop()
  bankBranch: string;

  @Prop()
  bankAccountType: string;

  @Prop()
  payNowId: string;

  // --- Settings ---
  @Prop({
    type: String,
    enum: ReceiptType,
    default: ReceiptType.MM_58,
  })
  receiptType: ReceiptType;

  // --- Referral / Provider tracking (Agent referral system) ---
  @Prop({ default: "self" })
  provider?: string; // "self" | "Agent" | future providers

  @Prop({ default: null })
  providerId?: string; // Agent._id when provider === "Agent"

  // --- Subscription / Plan Logic (Specific to Organizer - Kept Intact) ---
  @Prop({ default: false })
  subscribed?: boolean;

  @Prop()
  planStartDate?: Date;

  @Prop()
  planExpiryDate?: Date;

  @Prop()
  pricePaid?: string;

  @Prop({ type: Types.ObjectId, ref: "Plan", required: false })
  planId?: Types.ObjectId | null;

  // --- Availability (renamed from shopClosed... to match context if needed, or kept same) ---
  @Prop()
  operationsPausedFromDate?: Date; // Renamed from shopClosedFromDate for context

  @Prop()
  operationsPausedToDate?: Date; // Renamed from shopClosedToDate for context

  // --- Timestamps ---
  @Prop()
  updatedAt?: Date;

  @Prop()
  createdAt: Date;
}

export const OrganizerSchema = SchemaFactory.createForClass(Organizer);
