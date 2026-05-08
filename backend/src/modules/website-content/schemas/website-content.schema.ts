import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type WebsiteContentDocument = HydratedDocument<WebsiteContent>;

/**
 * CMS-style content rows for the public website (FAQ entries, About Us,
 * Contact Us, Terms, Privacy, Blog posts). One row per item; the admin UI
 * filters by content_type.
 *
 * Field names are snake_case to match the existing frontend shape (originally
 * a Supabase table) so SettingsPage didn't have to be rewritten field-by-field.
 */
@Schema({
  collection: "website_content",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
})
export class WebsiteContent {
  @Prop({
    type: String,
    required: true,
    enum: ["faq", "about_us", "contact_us", "terms", "privacy", "blog"],
    index: true,
  })
  content_type: string;

  @Prop({ type: String, required: true, default: "" })
  title: string;

  @Prop({ type: String, required: true, default: "" })
  content: string;

  @Prop({ type: String, default: "" })
  meta_description?: string;

  @Prop({ type: Boolean, default: false })
  is_published: boolean;

  @Prop({ type: Number, default: 0 })
  order_index: number;

  @Prop({ type: String, default: "" })
  author?: string;

  @Prop({ type: String, default: "" })
  slug?: string;
}

export const WebsiteContentSchema = SchemaFactory.createForClass(WebsiteContent);
