import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type AppFeedbackDocument = AppFeedback & Document;

export type AppFeedbackRole =
  | "organizer"
  | "vendor"
  | "visitor"
  | "speaker"
  | "general";

@Schema({ timestamps: true })
export class AppFeedback {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    enum: ["organizer", "vendor", "visitor", "speaker", "general"],
    default: "general",
  })
  role: AppFeedbackRole;

  @Prop({ trim: true, lowercase: true, index: true })
  email?: string;

  @Prop({ required: true, min: 1, max: 5 })
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
