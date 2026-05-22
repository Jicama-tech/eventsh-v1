import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type AppFeedbackDocument = AppFeedback & Document;

export type AppFeedbackRole =
  | "organizer"
  | "vendor"
  | "visitor"
  | "speaker"
  | "general";

export type AppFeedbackKind = "testimonial" | "support";

export type SupportCategory =
  | "bug"
  | "feature_request"
  | "general"
  | "billing"
  | "other";

export type SupportStatus = "open" | "in_progress" | "resolved";

@Schema({ timestamps: true })
export class AppFeedback {
  // Distinguishes landing-page testimonials (default) from organizer dashboard
  // support tickets. Public/curation queries filter on this so support tickets
  // never appear in the marketing carousel.
  @Prop({
    enum: ["testimonial", "support"],
    default: "testimonial",
    index: true,
  })
  kind: AppFeedbackKind;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    enum: ["organizer", "vendor", "visitor", "speaker", "general"],
    default: "general",
  })
  role: AppFeedbackRole;

  @Prop({ trim: true, lowercase: true, index: true })
  email?: string;

  // Rating is required for testimonials; support tickets set it to 0 since
  // there's nothing to rate. Min: 0 to accommodate that.
  @Prop({ required: true, min: 0, max: 5 })
  rating: number;

  // The (possibly super-admin-edited) text shown to the public. Edits never
  // touch `originalComment`, so we can always show the unmodified version
  // in the curation tab.
  @Prop({ required: true, trim: true })
  comment: string;

  @Prop({ trim: true })
  originalComment?: string;

  @Prop({ trim: true })
  city?: string;

  @Prop({ type: Types.ObjectId, ref: "User" })
  submittedByUserId?: Types.ObjectId;

  // ── Support-ticket fields (only populated when kind === "support") ──

  @Prop({ trim: true })
  subject?: string;

  @Prop({
    enum: ["bug", "feature_request", "general", "billing", "other"],
  })
  category?: SupportCategory;

  @Prop({
    enum: ["open", "in_progress", "resolved"],
    default: "open",
    index: true,
  })
  status?: SupportStatus;

  // Public URLs (e.g. "/uploads/support/<uuid>.png") for attached screenshots.
  @Prop({ type: [String], default: [] })
  attachments: string[];

  // Curation flags. featured + !hidden ⇒ shown in the public carousel.
  @Prop({ default: false, index: true })
  featured: boolean;

  @Prop()
  featuredOrder?: number;

  @Prop({ default: false, index: true })
  hidden: boolean;

  @Prop({ type: Types.ObjectId })
  approvedBy?: Types.ObjectId;

  @Prop()
  approvedAt?: Date;

  @Prop() createdAt: Date;
  @Prop() updatedAt: Date;
}

export const AppFeedbackSchema = SchemaFactory.createForClass(AppFeedback);
