import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ScheduledSpaceRequestDocument = ScheduledSpaceRequest & Document;

export enum ScheduledSpaceStatusEnum {
  Pending = "Pending",
  Confirmed = "Confirmed",
  Rejected = "Rejected",
  Processing = "Processing",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

// One (space, slot) pair the registrant picked. Price is always resolved
// server-side from the event's placed instance/template at selection time —
// never trusted from the client.
class SelectedSlot {
  @Prop({ required: true })
  positionId: string;

  @Prop({ required: true })
  templateId: string;

  @Prop({ required: true })
  slotId: string;

  @Prop({ required: true })
  spaceName: string;

  @Prop()
  facilityType?: string;

  @Prop()
  slotLabel?: string;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  endTime: string;

  @Prop({ required: true })
  price: number;
}

@Schema({ _id: false })
export class ScheduledSpaceStatusHistory {
  @Prop({ type: String, enum: ScheduledSpaceStatusEnum, required: true })
  status: ScheduledSpaceStatusEnum;

  @Prop({ type: String })
  note?: string;

  @Prop({ type: Date, default: Date.now })
  changedAt: Date;

  @Prop({ type: String })
  changedBy?: string;
}

@Schema({ timestamps: true })
export class ScheduledSpaceRequest {
  @Prop({ type: Types.ObjectId, ref: "Event", required: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizerId: Types.ObjectId;

  // Registrant identity — deliberately generic (no vendor/business fields).
  // Driven by the "scheduledSpace" registration-form category, not the
  // Stalls vendor-registration catalogue.
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  phone?: string;

  @Prop()
  whatsappNumber?: string;

  // Which facility type (Tennis Court, Chess Court, …) the registrant is
  // after, picked up-front so the post-approval slot picker can filter
  // straight to that type on venues that place more than one kind of
  // Scheduled Space.
  @Prop()
  facilityTypeRequested?: string;

  @Prop()
  purpose?: string;

  @Prop()
  organization?: string;

  // Operator referral code the visitor entered at registration (uppercased),
  // if any. Stored so the slot picker can re-apply it automatically on
  // every later fetch without asking the visitor to retype it — see
  // ScheduledSpacesService.getAvailableSpaces.
  @Prop()
  referralCode?: string;

  // Names of people attending alongside the registrant — free-text, no
  // separate identity/contact info (mirrors how Round Table's per-seat
  // guest names work: display-only, not booking records of their own).
  @Prop({ type: [String], default: [] })
  companions: string[];

  @Prop({
    enum: ScheduledSpaceStatusEnum,
    default: ScheduledSpaceStatusEnum.Pending,
  })
  status: string;

  @Prop({ enum: ["Unpaid", "Partial", "Paid"], default: "Unpaid" })
  paymentStatus: string;

  @Prop({ type: [SelectedSlot], default: [] })
  selectedSlots: SelectedSlot[];

  @Prop({ default: 0 })
  slotsTotal: number;

  @Prop({ default: 0 })
  paidAmount: number;

  @Prop({ default: 0 })
  remainingAmount: number;

  @Prop({ default: null })
  transactionId: string;

  @Prop({ default: null })
  transactionScreenshot: string;

  @Prop({ default: null })
  paymentMethod: string;

  // Same three-field split as the Stalls QR ticket: qrCodeData is the
  // source of truth for scanning, qrCodeImage is the renderable base64 PNG.
  @Prop({ default: null })
  qrCodeData: string;

  @Prop({ default: null })
  qrCodeImage: string;

  @Prop({ default: null })
  checkInTime: Date;

  @Prop({ default: false })
  hasCheckedIn: boolean;

  @Prop()
  notes?: string;

  @Prop()
  cancellationReason?: string;

  @Prop({ type: [ScheduledSpaceStatusHistory], default: [] })
  statusHistory: ScheduledSpaceStatusHistory[];
}

export const ScheduledSpaceRequestSchema = SchemaFactory.createForClass(
  ScheduledSpaceRequest,
);

ScheduledSpaceRequestSchema.index({ eventId: 1, email: 1 });
ScheduledSpaceRequestSchema.index({ organizerId: 1, eventId: 1 });
ScheduledSpaceRequestSchema.index({ status: 1 });
ScheduledSpaceRequestSchema.index({ qrCodeData: 1 });
