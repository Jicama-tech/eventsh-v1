// A registered white-label deployment (Phase 2 of the white-label plan —
// each customer gets their own isolated app + database; this collection is
// the central registry tracking WHICH instances exist, meaningfully
// populated only on the canonical eventsh.com deployment).
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

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
  // same handling as every other secret in this codebase (bcrypt). NOT
  // required: an "api-client" row (see integrationType below) has no
  // separate deployment to run platform-sync.service.ts's periodic job
  // from — the data already lives centrally — so this credential is simply
  // inert for that type, not something it needs.
  @Prop({ required: false })
  licenseKeyHash?: string;

  // "full-instance" (default, every row registered before this field
  // existed): a fully separate Docker deployment with its own database
  // (Phases 1-3) — licenseKeyHash is real and used by its
  // platform-sync.service.ts to report home.
  // "api-client" (Phase 4.5): a client with its own frontend + database
  // that consumes eventsh purely as a backend API, as one Organizer on
  // this (or another) eventsh backend — see organizerId below. No separate
  // deployment, so no sync job, so licenseKeyHash is unused for this type.
  @Prop({ default: "full-instance", enum: ["full-instance", "api-client"] })
  integrationType: "full-instance" | "api-client";

  // Only meaningful for integrationType "api-client" — the real
  // Organizer._id this integration is scoped to (on whichever eventsh
  // backend it points at). A "full-instance" row has its own separate
  // database with its own Organizer collection, so this is always unset
  // for that type.
  @Prop({ type: Types.ObjectId, ref: "Organizer", default: null })
  organizerId?: Types.ObjectId | null;

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
