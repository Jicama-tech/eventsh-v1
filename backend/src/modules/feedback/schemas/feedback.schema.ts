import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type FeedbackDocument = Feedback & Document;

export type FeedbackAudience =
  | "visitor"
  | "exhibitor"
  | "speaker"
  | "round_table"
  // Open feedback from a link the organizer shares publicly. Unlike
  // "visitor" — which is gated on owning a ticket — anyone with the link can
  // submit, so it is deliberately kept as its own audience rather than mixed
  // in with verified attendees.
  | "public";

@Schema({ timestamps: true })
export class Feedback {
  @Prop({ type: Types.ObjectId, ref: "Event", required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ["visitor", "exhibitor", "speaker", "round_table", "public"],
    index: true,
  })
  audience: FeedbackAudience;

  // ticketId for visitor; stall/speakerRequest/roundTableBooking _id otherwise.
  // Unique with eventId+audience to enforce one feedback per booked thing.
  // Public submissions have no booking to key on, so they get a generated id
  // per submission — the uniqueness constraint then never blocks them.
  @Prop({ required: true, index: true })
  subjectId: string;

  // Required for every booking-backed audience, which is how the submitter is
  // identified. Public submissions have no account behind them, so they carry
  // a self-declared `name` instead and leave this empty.
  @Prop({ required: false, lowercase: true, trim: true, default: "" })
  email: string;

  // Self-declared display name. Only used by the "public" audience — the
  // others are resolved from the booking they are attached to.
  @Prop({ default: "", trim: true })
  name: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ default: "" })
  comment: string;

  // For exhibitor/speaker/round_table only: flag the organizer flips to track
  // whether the security deposit has been returned to the vendor after they
  // submitted feedback. Visitor feedback ignores this.
  @Prop({ default: "pending", enum: ["pending", "refunded", "not_applicable"] })
  refundStatus: "pending" | "refunded" | "not_applicable";

  @Prop() createdAt: Date;
  @Prop() updatedAt: Date;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);

// One feedback per (event, audience, subject) — blocks double-submits even if
// the WhatsApp link is clicked twice or the visitor refreshes the form.
FeedbackSchema.index(
  { eventId: 1, audience: 1, subjectId: 1 },
  { unique: true },
);
