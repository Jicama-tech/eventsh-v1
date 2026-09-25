import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type OrganizerWhatsappDocument = OrganizerWhatsapp & Document;

/**
 * An organizer's WhatsApp switch and the number it is linked as — one row per
 * organizer.
 *
 * This holds NO credentials. The pairing itself (the linked-device keys) lives
 * on disk under WHATSAPP_ORG_AUTH_DIR, one folder per organizer, because that
 * is how Baileys persists it and because a database dump, an admin screen or
 * the unguarded `GET /organizers/:email` must never be able to leak something
 * that lets a reader send as the organizer. `number` and `linkedAt` are only
 * here so the Settings card can say "Linked as +91…" without a live socket,
 * e.g. right after a server restart.
 */
@Schema({ collection: "organizer_whatsapp", timestamps: true })
export class OrganizerWhatsapp {
  // `unique` builds the index; the id is also the auth folder's name on disk.
  @Prop({ required: true, unique: true })
  organizerId: string;

  /** The organizer's on/off switch. Off keeps the pairing on disk. */
  @Prop({ default: false })
  enabled: boolean;

  /** Digits, as WhatsApp reports them — null when not linked. */
  @Prop({ type: String, default: null })
  number?: string | null;

  @Prop({ type: Date, default: null })
  linkedAt?: Date | null;
}

export const OrganizerWhatsappSchema =
  SchemaFactory.createForClass(OrganizerWhatsapp);
