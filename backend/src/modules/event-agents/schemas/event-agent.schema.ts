import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type EventAgentDocument = EventAgent & Document;

/**
 * An agent an organizer enlists to promote ONE event: a promoter, a partner,
 * a friend with a big contact list. Each agent gets a referral code; the
 * organizer shares the event link carrying it (`?ref=CODE`) with the agent,
 * and every booking made through that link — tickets, stalls, speakers,
 * round tables, workshops, scheduled spaces — is attributed to the agent in
 * Participants, the same way operator referral codes are.
 *
 * `maxUses` caps how many bookings a code may be credited for (0 = no cap).
 * The cap is enforced atomically where the code is resolved at booking time
 * (OperatorsService.resolveReferral): a code past its cap simply stops being
 * credited; the booking itself always goes through.
 *
 * Distinct from the platform-level `agents` module (agents who refer
 * ORGANIZERS to the platform): those codes live in a different collection
 * with their own login, and nothing here touches them.
 */
@Schema({ collection: "event_agents", timestamps: true })
export class EventAgent {
  @Prop({ type: Types.ObjectId, ref: "Event", required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  /** As typed, with its country code ("+91 98765 43210"). */
  @Prop({ default: "", trim: true })
  whatsAppNumber: string;

  @Prop({ default: "", trim: true, lowercase: true })
  email: string;

  /**
   * 7 uppercase letters/digits without the ambiguous ones, unique across
   * every event agent AND kept distinct from operator codes (the generator
   * checks both), since `?ref=` carries one or the other.
   */
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  referralCode: string;

  /** How many bookings this code may be credited for. 0 = unlimited. */
  @Prop({ type: Number, default: 0, min: 0 })
  maxUses: number;

  /** Bookings credited so far (incremented atomically at booking time). */
  @Prop({ type: Number, default: 0 })
  usedCount: number;

  /** Off: the link keeps working but bookings are no longer credited. */
  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  lastUsedAt: Date | null;

  /** When the organizer last sent the link to the agent, and how often. */
  @Prop({ type: Date, default: null })
  lastSharedAt: Date | null;

  @Prop({ type: Number, default: 0 })
  shareCount: number;

  /** The organizer or operator user who added the agent. */
  @Prop({ default: "" })
  createdBy: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const EventAgentSchema = SchemaFactory.createForClass(EventAgent);

// The event's agent list, newest first.
EventAgentSchema.index({ eventId: 1, createdAt: -1 });
