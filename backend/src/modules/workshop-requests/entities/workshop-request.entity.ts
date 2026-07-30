import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type WorkshopRequestDocument = WorkshopRequest & Document;

export enum WorkshopRequestStatus {
  Pending = "Pending",
  Confirmed = "Confirmed",
  Rejected = "Rejected",
  Cancelled = "Cancelled",
  Completed = "Completed",
}

@Schema({ _id: false })
class StatusHistoryEntry {
  @Prop({ type: String, enum: WorkshopRequestStatus, required: true })
  status: WorkshopRequestStatus;

  @Prop()
  note?: string;

  @Prop({ type: Date, default: Date.now })
  changedAt: Date;

  @Prop()
  changedBy?: string;
}

@Schema({ timestamps: true })
export class WorkshopRequest {
  @Prop({ type: Types.ObjectId, ref: "Event", required: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizerId: Types.ObjectId;

  // Host identity — Google-verified email, same as the vendor/speaker
  // self-service flows.
  @Prop({ required: true })
  hostName: string;

  @Prop()
  hostEmail?: string;

  @Prop()
  hostPhone?: string;

  @Prop()
  hostBio?: string;

  @Prop()
  hostImage?: string;

  // The proposed workshop itself.
  @Prop({ required: true })
  workshopName: string;

  @Prop()
  workshopDescription?: string;

  // What the host suggests visitors should pay, and what the organizer has
  // settled on (defaults to the proposal, editable before it goes live).
  @Prop({ default: 0 })
  proposedPrice: number;

  @Prop({ default: 0 })
  finalPrice: number;

  @Prop()
  proposedStartTime?: string;

  @Prop()
  proposedEndTime?: string;

  @Prop({ default: 0 })
  maxSeats: number;

  @Prop({ enum: WorkshopRequestStatus, default: WorkshopRequestStatus.Pending })
  status: WorkshopRequestStatus;

  // Hosting fee — what the HOST pays the organizer for the slot. Optional,
  // organizer-set, same shape as Speaker Requests' per-application fee.
  @Prop({ default: false })
  isCharged: boolean;

  @Prop({ default: 0 })
  hostingFee: number;

  @Prop({ enum: ["Unpaid", "Paid", "Waived"], default: "Waived" })
  paymentStatus: string;

  @Prop()
  paymentDate?: Date;

  @Prop()
  organizerNotes?: string;

  @Prop({ type: [Object], default: [] })
  statusHistory: StatusHistoryEntry[];

  @Prop()
  confirmationDate?: Date;

  @Prop()
  rejectionDate?: Date;

  // Set once finalized — the id of the WorkshopSession pushed into
  // event.workshopSessions[] (join key, mirrors Speaker's "req-<id>").
  @Prop()
  workshopSessionId?: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const WorkshopRequestSchema =
  SchemaFactory.createForClass(WorkshopRequest);

WorkshopRequestSchema.index({ eventId: 1, hostEmail: 1 });
WorkshopRequestSchema.index({ organizerId: 1, status: 1 });
WorkshopRequestSchema.index({ eventId: 1, status: 1 });
