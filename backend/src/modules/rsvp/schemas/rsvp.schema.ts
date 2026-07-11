import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type RsvpDocument = Rsvp & Document;

/**
 * A guest RSVP for an event (currently used by Personal / Marriage events).
 * Identified by the Google-verified email of the guest, so re-submitting
 * updates the same record rather than creating duplicates. `guestCount` is
 * the TOTAL headcount including the guest themselves.
 */
@Schema({ timestamps: true })
export class Rsvp {
  @Prop({ required: true, index: true })
  eventId: string;

  // Denormalised so the organizer dashboard can scope/own-check quickly.
  @Prop()
  organizerId?: string;

  @Prop({ required: true })
  name: string;

  // Google-verified email — the guest identity key.
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop()
  contactNumber?: string;

  // Total people attending under this RSVP, including the guest.
  @Prop({ default: 1, min: 0 })
  guestCount: number;

  @Prop()
  message?: string;

  // true = attending, false = politely declined.
  @Prop({ default: true })
  attending: boolean;

  // Which family the guest belongs to — "groom" | "bride" | "" (optional).
  @Prop()
  side?: string;

  // Ceremonies/functions the guest indicated they'll attend. Stored as
  // {id, name} snapshots so the organizer guest list stays readable even if
  // the event's functions are later renamed or removed. Empty/absent for
  // legacy RSVPs and for guests who declined.
  @Prop({ type: [Object], default: [] })
  functions?: { id: string; name: string }[];

  // Full roster of attending guests (name, age, contact number). When present,
  // it's the source of truth — guestCount and ageGroups are derived from it.
  @Prop({ type: [Object], default: [] })
  attendees?: { name: string; age?: number; contactNumber?: string }[];

  // Age-group breakdown of this RSVP's party — lets the planner size catering,
  // seating and (especially) accommodation. Sum should equal guestCount.
  @Prop({ type: Object, default: {} })
  ageGroups?: {
    adults?: number;
    seniors?: number;
    children?: number;
    infants?: number;
  };

  // Rooms the organizer has allotted this guest, per function. Multi-day / multi-
  // city weddings (e.g. Roka elsewhere) can put the same guest in different
  // rooms per function — or the same room — so this is a per-function list.
  @Prop({ type: [Object], default: [] })
  roomAllotments?: {
    // Stable id (uuid) — also the token embedded in the room-ticket QR.
    id?: string;
    functionId: string;
    functionName: string;
    roomType: string; // single | dual | triple | group
    roomName: string;
    occupants: number;
    // Which specific people (from the attendee roster) share this room.
    occupantNames?: string[];
    notes?: string;
    // Reception check-in state, set when the room-ticket QR is scanned.
    checkedIn?: boolean;
    checkedInAt?: string;
    // ---- Shared room (one physical room split across several RSVPs) ----
    // Rows on different RSVPs that carry the SAME roomKey are the same
    // physical room; their occupants combine toward one shared capacity.
    // Absent/undefined = a normal, single-RSVP room.
    roomKey?: string;
    // Total capacity of the physical room (from roomType), so every linked
    // row agrees on the ceiling regardless of how the split is entered.
    capacity?: number;
    // Denormalised list of the OTHER RSVP ids sharing this room — kept in
    // sync on every share/unshare so the panel + tickets render fast.
    sharedRsvpIds?: string[];
  }[];

  // Google profile id, kept for de-dup/audit.
  @Prop()
  googleId?: string;
}

export const RsvpSchema = SchemaFactory.createForClass(Rsvp);

// One RSVP per guest email per event — POST upserts on this key.
RsvpSchema.index({ eventId: 1, email: 1 }, { unique: true });
