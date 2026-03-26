import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type SpeakerRequestDocument = SpeakerRequest & Document;

export enum SpeakerRequestStatus {
  Pending = "Pending",
  Confirmed = "Confirmed",
  Processing = "Processing",
  Rejected = "Rejected",
  Cancelled = "Cancelled",
  Completed = "Completed",
}

@Schema({ _id: false })
export class SessionSlot {
  @Prop({ required: true })
  topic: string;

  @Prop()
  description?: string;

  @Prop()
  preferredStartTime?: string;

  @Prop()
  preferredEndTime?: string;

  @Prop()
  confirmedStartTime?: string;

  @Prop()
  confirmedEndTime?: string;

  @Prop()
  duration?: number; // in minutes
}

@Schema({ _id: false })
export class StatusHistory {
  @Prop({ type: String, enum: SpeakerRequestStatus, required: true })
  status: SpeakerRequestStatus;

  @Prop()
  note?: string;

  @Prop({ type: Date, default: Date.now })
  changedAt: Date;

  @Prop()
  changedBy?: string;
}

@Schema({ timestamps: true })
export class SpeakerRequest {
  // References
  @Prop({ type: Types.ObjectId, ref: "Event", required: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizerId: Types.ObjectId;

  // Speaker Profile
  @Prop({ required: true })
  name: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  @Prop()
  title?: string; // e.g. "CEO", "Professor"

  @Prop()
  organization?: string;

  @Prop()
  bio?: string;

  @Prop()
  image?: string; // profile photo path

  @Prop()
  expertise?: string; // area of expertise

  @Prop({
    type: Object,
    default: { linkedin: "", twitter: "", website: "" },
  })
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };

  // Session Details
  @Prop({ type: [Object], default: [] })
  sessions: SessionSlot[];

  // Request Status
  @Prop({ enum: SpeakerRequestStatus, default: "Pending" })
  status: string;

  // Fee Management
  @Prop({ default: false })
  isCharged: boolean; // whether organizer charges the speaker

  @Prop({ default: 0 })
  fee: number; // fee amount (0 = free)

  @Prop({ enum: ["Unpaid", "Paid", "Waived"], default: "Waived" })
  paymentStatus: string;

  @Prop()
  paymentDate?: Date;

  // Source tracking
  @Prop({ enum: ["organizer", "external"], default: "external" })
  source: string; // who added: organizer manually or external application

  @Prop({ default: false })
  isKeynote: boolean;

  // Additional Info
  @Prop()
  notes?: string; // applicant notes

  @Prop()
  organizerNotes?: string; // organizer's internal notes

  @Prop()
  previousSpeakingExperience?: string;

  @Prop()
  equipmentNeeded?: string; // projector, mic, whiteboard etc.

  // Audit
  @Prop({
    type: [Object],
    default: [],
  })
  statusHistory: StatusHistory[];

  @Prop()
  confirmationDate?: Date;

  @Prop()
  rejectionDate?: Date;

  // QR Code
  @Prop({ default: null })
  qrCodePath: string;

  @Prop({ default: null })
  qrCodeData: string;

  // Attendance
  @Prop({ default: null })
  checkInTime: Date;

  @Prop({ default: null })
  checkOutTime: Date;

  @Prop({ default: false })
  hasCheckedIn: boolean;

  @Prop({ default: false })
  hasCheckedOut: boolean;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const SpeakerRequestSchema =
  SchemaFactory.createForClass(SpeakerRequest);

SpeakerRequestSchema.index({ eventId: 1, email: 1 });
SpeakerRequestSchema.index({ organizerId: 1, status: 1 });
SpeakerRequestSchema.index({ eventId: 1, status: 1 });
