import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type TicketDocument = Ticket & Document;

export enum TicketStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  USED = "used",
}

@Schema({ timestamps: true })
export class Ticket {
  @Prop({ required: true, unique: true })
  ticketId: string;

  @Prop({ type: Types.ObjectId, ref: "Event", required: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizerId: Types.ObjectId;

  @Prop({ required: true })
  eventTitle: string;

  @Prop({ required: true })
  eventDate: Date;

  @Prop({ required: true })
  eventTime: string;

  @Prop({ required: true })
  eventVenue: string;

  @Prop()
  customerName: string;

  @Prop()
  customerEmail: string;

  @Prop()
  customerWhatsapp: string;

  @Prop()
  customerEmergencyContact?: string;

  @Prop({
    type: [
      {
        ticketType: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        // Assigned-seating events only: the reserved seat map cells
        // (`${rowId}:${seatNumber}`) this line item covers.
        seatIds: { type: [String], default: undefined },
        // VisitorType.id at time of purchase — used to reliably decrement
        // that tier's maxCount even when `ticketType` is a decorated
        // display string (e.g. seat purchases: "VIP (Seats A1, A2)" is
        // never an exact match for the tier's stored name "VIP").
        tierId: { type: String },
      },
    ],
    required: true,
  })
  ticketDetails: Array<{
    ticketType: string;
    quantity: number;
    price: number;
    seatIds?: string[];
    tierId?: string;
  }>;

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ required: true })
  paymentConfirmed: boolean;

  @Prop({ enum: TicketStatus, default: TicketStatus.PENDING })
  status: TicketStatus;

  @Prop({ type: Date, required: true })
  purchaseDate: Date;

  @Prop()
  coupon?: string;

  @Prop({ default: false })
  isUsed: boolean;

  @Prop()
  usedAt?: Date;

  @Prop()
  notes?: string;

  @Prop({ default: false })
  attendance?: boolean;

  @Prop({ default: false })
  hasMarked?: boolean;

  @Prop()
  qrCode?: string;

  @Prop()
  pdfPath?: string;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
