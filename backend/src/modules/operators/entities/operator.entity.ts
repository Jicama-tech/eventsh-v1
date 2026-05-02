import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

import { Document } from "mongoose";

export type OperatorDocument = Operator & Document;

// All possible tabs an organizer-side operator can be granted access to.
// Used to restrict an operator to a subset of the organizer dashboard.
export const OPERATOR_TABS = [
  "dashboard",
  "events",
  "eventAttendees",
  "speakerRequests",
  "users",
  "roundTableBookings",
  "storefront",
  "settings",
] as const;
export type OperatorTab = (typeof OPERATOR_TABS)[number];

@Schema({ timestamps: true })
export class Operator {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  whatsAppNumber: string;

  @Prop()
  email: string;

  @Prop()
  shopkeeperId?: string;

  @Prop()
  organizerId?: string;

  // Tabs this operator can see in the organizer dashboard. Empty array → no
  // restriction (full access). Non-empty array → restricted to listed tabs.
  @Prop({ type: [String], default: [] })
  accessTabs: string[];
}

export const OperatorSchema = SchemaFactory.createForClass(Operator);
