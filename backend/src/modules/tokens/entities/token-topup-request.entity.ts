import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type TokenTopUpRequestDocument = HydratedDocument<TokenTopUpRequest>;

export type TokenTopUpRequestStatus =
  | "awaiting_payment"
  | "submitted"
  | "confirmed"
  | "rejected";

/**
 * One row per token top-up an organizer initiates — the functional
 * replacement for PendingBillingPayment. Unlike that per-event claim, this
 * is purely organization-scoped (no eventId): the organizer asks to buy N
 * tokens, pays via the same PayNow/UPI QR flow, admin confirms, and
 * tokens.service.ts::confirmTopUp credits TokenWallet.balance by
 * tokensRequested (1 token = 1 unit of `currency`, so amount ===
 * tokensRequested by construction).
 */
@Schema({ collection: "token_topup_requests", timestamps: true })
export class TokenTopUpRequest {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizerId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  tokensRequested: number;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  @Prop({ type: String, required: true })
  currency: string;

  @Prop({ type: String, required: true, enum: ["UPI", "PAYNOW"] })
  scheme: string;

  @Prop({
    type: String,
    required: true,
    enum: ["awaiting_payment", "submitted", "confirmed", "rejected"],
    default: "awaiting_payment",
  })
  status: TokenTopUpRequestStatus;

  @Prop({ type: String, required: true })
  ref: string;

  @Prop({ type: Date }) submittedAt?: Date;
  @Prop({ type: Date }) confirmedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: "Admin" }) confirmedBy?: Types.ObjectId;
  @Prop({ type: String }) rejectionReason?: string;
}

export const TokenTopUpRequestSchema =
  SchemaFactory.createForClass(TokenTopUpRequest);
