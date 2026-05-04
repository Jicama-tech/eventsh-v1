import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type CategoryDocument = Category & Document;

// Dedicated collection so eventsh categories stay isolated from any shared
// `categories` collection on the live MongoDB (kioscart pattern).
@Schema({ timestamps: true, collection: "eventsh_categories" })
export class Category {
  @Prop({ required: true, unique: true, trim: true })
  name: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// Case-insensitive uniqueness on name
CategorySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);
