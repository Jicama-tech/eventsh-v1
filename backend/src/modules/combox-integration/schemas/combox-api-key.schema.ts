import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/**
 * The key an organizer generates for themselves to connect ComBox. Only the
 * SHA-256 of the key is stored; the plaintext is shown once, when it is made.
 */
@Schema({ timestamps: true, collection: "combox_api_keys" })
export class ComboxApiKey extends Document {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  keyHash: string;

  // First characters, so the dashboard can tell keys apart.
  @Prop({ required: true })
  prefix: string;

  // Last 2 characters, only to show a masked key (esk_****…ab).
  @Prop({ type: String, default: null })
  lastChars: string | null;

  @Prop({ type: Date, default: null })
  lastUsedAt: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;
}

export const ComboxApiKeySchema = SchemaFactory.createForClass(ComboxApiKey);
