import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { OrganizersModule } from "../organizers/organizers.module";
import { EventSchema } from "../events/schemas/event.schema";
import { TicketSchema } from "../tickets/entities/ticket.entity";
import { ComboxIntegrationController } from "./combox-integration.controller";
import { ComboxKeyController } from "./combox-key.controller";
import { AnalyticsModule } from "../analytics/analytics.module";
import { ComboxFeedService } from "./combox-feed.service";
import { ComboxPaymentsService } from "./combox-payments.service";
import { StallsModule } from "../stalls/stalls.module";
import { SpeakerRequestsModule } from "../speaker-requests/speaker-requests.module";
import { SponsorsModule } from "../sponsors/sponsors.module";
import { RoundTableBookingsModule } from "../round-table-bookings/round-table-bookings.module";
import { WorkshopBookingsModule } from "../workshop-bookings/workshop-bookings.module";
import { StallSchema } from "../stalls/entities/stall.entity";
import { VendorSchema } from "../stalls/schemas/vendor.schema";
import { SpeakerRequestSchema } from "../speaker-requests/entities/speaker-request.entity";
import { SponsorRequestSchema } from "../sponsors/entities/sponsor-request.entity";
import { WorkshopRequestSchema } from "../workshop-requests/entities/workshop-request.entity";
import { WorkshopBookingSchema } from "../workshop-bookings/entities/workshop-booking.entity";
import { RoundTableBookingSchema } from "../round-table-bookings/entities/round-table-booking.entity";
import { RsvpSchema } from "../rsvp/schemas/rsvp.schema";
import { FeedbackSchema } from "../feedback/schemas/feedback.schema";
import { EventExpenseSchema } from "../expenses/entities/event-expense.entity";
import { ComboxKeyService } from "./combox-key.service";
import { ComboxKeyGuard } from "./combox-key.guard";
import { ComboxApiKeySchema } from "./schemas/combox-api-key.schema";

// Feed for ComBox (read-only, plus approving payments) (the Events Module there). Additive: it adds
// routes under /combox-integration and touches nothing else.
@Module({
  imports: [
    forwardRef(() => OrganizersModule),
    // eventsh's own profit and loss calculation, reused so ComBox shows the same figures
    AnalyticsModule,
    // the confirmations eventsh runs from its own dashboard, reused to approve payments from ComBox
    forwardRef(() => StallsModule),
    forwardRef(() => SpeakerRequestsModule),
    forwardRef(() => SponsorsModule),
    forwardRef(() => RoundTableBookingsModule),
    forwardRef(() => WorkshopBookingsModule),
    MongooseModule.forFeature([
      { name: "Event", schema: EventSchema },
      { name: "Ticket", schema: TicketSchema },
      { name: "ComboxApiKey", schema: ComboxApiKeySchema },
      { name: "Stall", schema: StallSchema },
      { name: "Vendor", schema: VendorSchema },
      { name: "SpeakerRequest", schema: SpeakerRequestSchema },
      { name: "SponsorRequest", schema: SponsorRequestSchema },
      { name: "WorkshopRequest", schema: WorkshopRequestSchema },
      { name: "WorkshopBooking", schema: WorkshopBookingSchema },
      { name: "RoundTableBooking", schema: RoundTableBookingSchema },
      { name: "Rsvp", schema: RsvpSchema },
      { name: "Feedback", schema: FeedbackSchema },
      { name: "EventExpense", schema: EventExpenseSchema },
    ]),
  ],
  controllers: [ComboxIntegrationController, ComboxKeyController],
  // JwtAuthGuard (the key controller) injects JwtService, as in otp.module
  providers: [ComboxKeyService, ComboxKeyGuard, JwtService, ComboxFeedService, ComboxPaymentsService],
})
export class ComboxIntegrationModule {}
