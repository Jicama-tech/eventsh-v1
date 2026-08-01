import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type TokenWalletDocument = HydratedDocument<TokenWallet>;

/**
 * One row per organizer — the organization-level prepaid token balance.
 * 1 token = 1 unit of the organizer's local currency (INR/SGD). Balance can
 * go negative (fees accrue even if the organizer hasn't topped up yet — the
 * publish-time prompt and per-row estimate are skippable nudges, not a hard
 * gate). Mutated only via atomic $inc (see tokens.service.ts) to avoid a
 * lost-update race when two reconciliation reads land concurrently.
 */
@Schema({ collection: "token_wallets", timestamps: true })
export class TokenWallet {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, unique: true })
  organizerId: Types.ObjectId;

  @Prop({ type: Number, required: true, default: 0 })
  balance: number;
}

export const TokenWalletSchema = SchemaFactory.createForClass(TokenWallet);
