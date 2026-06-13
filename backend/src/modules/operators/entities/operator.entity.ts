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

  // Optional company / private email. Progress notifications are sent here in
  // addition to the operator's (Google) login email.
  @Prop()
  companyEmail?: string;

  @Prop()
  shopkeeperId?: string;

  @Prop()
  organizerId?: string;

  // Tabs this operator can see in the organizer dashboard. Empty array → no
  // restriction (full access). Non-empty array → restricted to listed tabs.
  @Prop({ type: [String], default: [] })
  accessTabs: string[];

  // Whether this operator receives notification emails (new vendor requests,
  // payment-awaiting-approval alerts, etc.). Opt-in: the organizer must switch
  // it ON per operator; only those operators get emailed. Defaults false.
  @Prop({ default: false })
  allowEmails: boolean;
}

export const OperatorSchema = SchemaFactory.createForClass(Operator);
