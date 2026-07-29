import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type SpeakerDocument = Speaker & Document;

/**
 * Persistent speaker profile — the speaker equivalent of the `vendors`
 * collection behind stall bookings.
 *
 * A SpeakerRequest is one application to one event; THIS is the person, kept
 * across events so a returning speaker never retypes their bio, and so the
 * organizer accumulates a reusable roster. Identity is the Google-verified
 * email (the eventfront's only speaker sign-in), scoped per organizer the way
 * vendors are — the same person applying to two organizers gets a profile
 * under each, and neither sees the other's notes.
 */
@Schema({ collection: "speakers", timestamps: true })
export class Speaker {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  // Lower-cased on write — the join key with SpeakerRequest.email.
  // Optional, because speakers the organizer types into the Create Event form
  // often have no email; those are de-duplicated on `nameKey` instead.
  @Prop({ index: true, default: "" })
  email: string;

  @Prop({ required: true })
  name: string;

  // Lower-cased, whitespace-collapsed name. The fallback identity when there
  // is no email, so re-saving an event doesn't clone its speakers each time.
  @Prop({ index: true, default: "" })
  nameKey: string;

  @Prop()
  phone?: string;

  @Prop()
  title?: string; // "CTO", "Professor", …

  @Prop()
  organization?: string;

  @Prop()
  bio?: string;

  @Prop()
  expertise?: string;

  @Prop()
  image?: string; // /uploads/speakers/<file>

  @Prop({
    type: Object,
    default: { linkedin: "", twitter: "", website: "" },
  })
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };

  @Prop()
  previousSpeakingExperience?: string;

  @Prop()
  equipmentNeeded?: string;

  // Roster stats, denormalised so the organizer's speaker list can rank and
  // filter without aggregating over every request.
  @Prop({ default: 0 })
  totalApplications: number;

  @Prop({ default: 0 })
  confirmedSessions: number;

  @Prop()
  lastAppliedAt?: Date;

  // Organizer-private notes about this speaker, carried across events.
  @Prop()
  organizerNotes?: string;

  // Where this profile first came from: an eventfront application, the
  // organizer's Create Event form, or typed straight into the CRM.
  @Prop({ enum: ["application", "event-form", "crm"], default: "application" })
  origin: string;
}

export const SpeakerSchema = SchemaFactory.createForClass(Speaker);

// One profile per email per organizer. PARTIAL, so the many speakers with no
// email (typed into the Create Event form) don't all collide on "" — those are
// de-duplicated on nameKey by the upsert instead.
SpeakerSchema.index(
  { organizerId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $gt: "" } } },
);
SpeakerSchema.index({ organizerId: 1, nameKey: 1 });
