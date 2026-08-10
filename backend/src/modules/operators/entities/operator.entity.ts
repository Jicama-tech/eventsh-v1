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

  // Whether this operator may approve or reject event expenses logged by the
  // team. Off by default — approving spend is a deliberate grant.
  @Prop({ default: false })
  canApproveExpenses: boolean;

  // Short alphanumeric code visitors can enter on a Scheduled Space
  // registration form to unlock the spaces assigned to this operator.
  // Auto-generated on create (and lazily backfilled for pre-existing
  // operators) — sparse+unique since it's assigned after the fact for old
  // docs one at a time, not in a single migration. Generated regardless of
  // referralEnabled below — it just isn't shown or matched against until
  // switched on, so turning it on later doesn't change the code itself.
  @Prop({ unique: true, sparse: true })
  referralCode?: string;

  // Opt-in gate for referralCode: most operators (chatbot/kiosk/dashboard
  // staff) have nothing to do with Scheduled Spaces, so the code stays
  // hidden in the organizer's operator list and non-functional for
  // visitors until explicitly switched on for the operators actually
  // handing one out. Off by default.
  @Prop({ default: false })
  referralEnabled: boolean;
}

export const OperatorSchema = SchemaFactory.createForClass(Operator);
