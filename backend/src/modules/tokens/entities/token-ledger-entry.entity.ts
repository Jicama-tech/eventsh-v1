import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type TokenLedgerEntryDocument = HydratedDocument<TokenLedgerEntry>;

export type TokenLedgerEntryType =
  | "topup"
  | "debit"
  | "credit"
  | "admin_adjust"
  | "baseline";

/**
 * Append-only audit trail for every wallet balance change. `amount` is
 * always positive — the `type` implies the sign applied to `balance`.
 * `eventId` is the event this reconciliation relates to (or the literal
 * string "memberships" for the organizer-scoped memberships sweep, or
 * omitted entirely for topups/admin adjustments not tied to one event).
 * reconcileEvent()/reconcileMemberships() sum these by (organizerId,
 * eventId, category starting "reconcile") to compute "already debited"
 * before applying the next delta — this is what makes reconciliation
 * idempotent.
 *
 * `type: "baseline"` is a special zero-effect entry: written once, the
 * first time an event/organizer is ever reconciled, to record its
 * pre-existing total owed WITHOUT touching wallet.balance — this grand-
 * fathers in any activity that predates the Tokens feature (which may
 * already have been billed/settled under the old Platform Fees system, or
 * was explicitly never carried forward per the cutover decision). Only
 * activity accrued AFTER the baseline is established results in a real
 * debit/credit.
 */
@Schema({ collection: "token_ledger_entries", timestamps: { createdAt: true, updatedAt: false } })
export class TokenLedgerEntry {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizerId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: ["topup", "debit", "credit", "admin_adjust", "baseline"],
  })
  type: TokenLedgerEntryType;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  @Prop({ type: Number, required: true })
  balanceAfter: number;

  // Mongoose lets a Mixed-typed path hold either an ObjectId or the
  // "memberships" sentinel string — mirrors the same overload already used
  // on PendingBillingPayment.eventId's string form.
  @Prop({ type: Object })
  eventId?: Types.ObjectId | "memberships" | null;

  @Prop({ type: String })
  category?:
    | "reconcile"
    | "reconcile-credit"
    | "topup"
    | "admin_adjust"
    | "baseline";

  @Prop({ type: String })
  description?: string;
}

export const TokenLedgerEntrySchema =
  SchemaFactory.createForClass(TokenLedgerEntry);
