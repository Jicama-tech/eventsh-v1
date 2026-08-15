// A registered white-label deployment (Phase 2 of the white-label plan —
// each customer gets their own isolated app + database; this collection is
// the central registry tracking WHICH instances exist, meaningfully
// populated only on the canonical eventsh.com deployment).
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type WhiteLabelInstanceDocument = WhiteLabelInstance & Document;

@Schema({ timestamps: true })
export class WhiteLabelInstance {
  @Prop({ required: true, unique: true, index: true })
  instanceId: string;

  @Prop({ required: true })
  companyName: string;

  @Prop({ required: true })
  domain: string;

  // Only the hash is stored — the plaintext license key is shown exactly
  // once, at registration time (see PlatformRegistryService.registerInstance),
  // same handling as every other secret in this codebase (bcrypt).
  @Prop({ required: true })
  licenseKeyHash: string;

  @Prop({ default: "active", enum: ["active", "inactive"] })
  status: string;

  @Prop()
  lastSyncAt?: Date;

  // Aggregate counts from the instance's most recent sync — organizerCount,
  // vendorCount, attendeeCount, operatorCount, eventCount. Loosely typed
  // since it's a snapshot the remote instance reports, not schema we enforce.
  @Prop({ type: Object, default: {} })
  lastSyncStats?: Record<string, number>;
}

export const WhiteLabelInstanceSchema =
  SchemaFactory.createForClass(WhiteLabelInstance);
