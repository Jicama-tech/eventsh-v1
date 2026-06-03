import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

import { Document } from "mongoose";

export type OperatorDocument = Operator & Document;

// All possible tabs an organizer-side operator can be granted access to.
// Mirrors the dashboard sidebar (OrganizerDashboard.navigationItems);
// keep these in sync when adding or removing a sidebar entry.
export const OPERATOR_TABS = [
  "chatbot",
  "dashboard",
  "kiosk",
  "eventAttendees",
  "users",
  "events",
  "storefront",
  "settings",
] as const;
export type OperatorTab = (typeof OPERATOR_TABS)[number];

@Schema({ timestamps: true })
export class Operator {
  @Prop({ required: true })
  name: string;

  // Optional — login is handled via Google Auth (email is the identity).
  @Prop()
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
