import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Ticket, TicketSchema } from "../tickets/entities/ticket.entity";
import { Stall, StallSchema } from "../stalls/entities/stall.entity";
import { Vendor, VendorSchema } from "../stalls/schemas/vendor.schema";
import {
  RoundTableBooking,
  RoundTableBookingSchema,
} from "../round-table-bookings/entities/round-table-booking.entity";
import {
  WorkshopBooking,
  WorkshopBookingSchema,
} from "../workshop-bookings/entities/workshop-booking.entity";
import {
  SpeakerRequest,
  SpeakerRequestSchema,
} from "../speaker-requests/entities/speaker-request.entity";
import {
  ScheduledSpaceRequest,
  ScheduledSpaceRequestSchema,
} from "../scheduled-spaces/entities/scheduled-space-request.entity";
import {
  ExhibitorMembership,
  ExhibitorMembershipSchema,
} from "../memberships/schemas/exhibitor-membership.schema";
import { Rsvp, RsvpSchema } from "../rsvp/schemas/rsvp.schema";
import { Supplier, SupplierSchema } from "../suppliers/schemas/supplier.schema";
import {
  SponsorRequest,
  SponsorRequestSchema,
} from "../sponsors/entities/sponsor-request.entity";
import { User, UserSchema } from "../users/schemas/user.schema";
import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import {
  OrganizerStore,
  OrganizerStoreSchema,
} from "../organizer-stores/entities/organizer-store.entity";
import { WhatsappModule } from "../whatsapp/whatsapp.module";
import {
  WhatsappCampaign,
  WhatsappCampaignSchema,
} from "./entities/whatsapp-campaign.entity";
import {
  MarketingOptOut,
  MarketingOptOutSchema,
} from "./entities/marketing-opt-out.entity";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";
import { CampaignAudienceService } from "./campaign-audience";

/**
 * WhatsApp campaigns from the dashboard (see CampaignsService).
 *
 * Imports only models and the leaf WhatsappModule — never Tickets, Stalls or
 * Events as modules — so nothing here can close an import cycle; the
 * audience is read straight from the collections. PlanAccessService and
 * TabsGuard come exported from WhatsappModule.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsappCampaign.name, schema: WhatsappCampaignSchema },
      { name: MarketingOptOut.name, schema: MarketingOptOutSchema },
      { name: "Organizer", schema: OrganizerSchema },
      { name: "Event", schema: EventSchema },
      { name: OrganizerStore.name, schema: OrganizerStoreSchema },
      { name: Ticket.name, schema: TicketSchema },
      { name: Stall.name, schema: StallSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: RoundTableBooking.name, schema: RoundTableBookingSchema },
      { name: WorkshopBooking.name, schema: WorkshopBookingSchema },
      { name: SpeakerRequest.name, schema: SpeakerRequestSchema },
      { name: ScheduledSpaceRequest.name, schema: ScheduledSpaceRequestSchema },
      { name: ExhibitorMembership.name, schema: ExhibitorMembershipSchema },
      { name: Rsvp.name, schema: RsvpSchema },
      { name: Supplier.name, schema: SupplierSchema },
      { name: SponsorRequest.name, schema: SponsorRequestSchema },
      { name: User.name, schema: UserSchema },
    ]),
    WhatsappModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignAudienceService],
})
export class CampaignsModule {}
