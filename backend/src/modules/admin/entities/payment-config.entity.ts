import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type PaymentConfigDocument = HydratedDocument<PaymentConfig>;

/**
 * Single-document collection holding platform-wide payment settings the
 * super-admin sets. Today it stores the company UEN (Singapore corporate
 * PayNow proxy) and the merchant name baked into the EMVCo QR payload.
 * Mirrors the upsert pattern used by PlatformBillingRates.
 */
@Schema({ collection: "payment_config", timestamps: true })
export class PaymentConfig {
  @Prop({ type: String, default: "" })
  companyName: string;

  @Prop({ type: String, default: "" })
  companyUEN: string;

  /**
   * Platform-level UPI VPA used to render the Indian QR for Indian organizers
   * paying the platform. Populated by decoding the uploaded UPI QR image —
   * admins never type this directly. Stored as a single handle (e.g.
   * eventsh@upi) and fed into the UPI EMVCo payload in payments.service.ts.
   */
  @Prop({ type: String, default: "" })
  platformUPIId: string;

  /**
   * Public-relative path of the static UPI QR image the admin uploaded
   * (served via /uploads/paymentConfig/<file>). Kept only for visual
   * confirmation in the Settings UI — checkout still renders the dynamic QR
   * generated from `platformUPIId`.
   */
  @Prop({ type: String, default: "" })
  upiQrImagePath: string;

  @Prop({ type: Types.ObjectId, ref: "Admin" })
  updatedBy?: Types.ObjectId;
}

export const PaymentConfigSchema = SchemaFactory.createForClass(PaymentConfig);
