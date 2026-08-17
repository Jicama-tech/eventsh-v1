// A user record reported in from a white-label instance's async sync push —
// kept as its own collection rather than merged into the live
// organizerModel/userModel/vendorModel/etc.: those back real auth/billing
// logic on the central deployment and shouldn't be commingled with
// read-only data reported in from elsewhere.
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type WhiteLabelSyncedUserDocument = WhiteLabelSyncedUser & Document;

@Schema({ timestamps: true })
export class WhiteLabelSyncedUser {
  @Prop({ required: true, index: true })
  instanceId: string;

  @Prop({
    required: true,
    enum: ["organizer", "vendor", "attendee", "operator"],
  })
  sourceType: string;

  // That record's own _id on the REMOTE instance — used (together with
  // instanceId + sourceType) to upsert on re-sync instead of duplicating.
  @Prop({ required: true })
  externalId: string;

  @Prop()
  name?: string;

  @Prop()
  email?: string;

  @Prop()
  role?: string;

  @Prop()
  sourceCreatedAt?: Date;

  @Prop({ default: Date.now })
  syncedAt: Date;
}

export const WhiteLabelSyncedUserSchema = SchemaFactory.createForClass(
  WhiteLabelSyncedUser,
);
WhiteLabelSyncedUserSchema.index(
  { instanceId: 1, sourceType: 1, externalId: 1 },
  { unique: true },
);
