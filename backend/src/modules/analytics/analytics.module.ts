import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";

import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { TicketSchema } from "../tickets/entities/ticket.entity";
import { StallSchema } from "../stalls/entities/stall.entity";
import { RoundTableBookingSchema } from "../round-table-bookings/entities/round-table-booking.entity";
import { SpeakerRequestSchema } from "../speaker-requests/entities/speaker-request.entity";
import { SponsorRequestSchema } from "../sponsors/entities/sponsor-request.entity";
import { SupplierRequestSchema } from "../suppliers/entities/supplier-request.entity";
import { PlatformBillingRatesSchema } from "../admin/entities/platform-billing-rates.entity";
import { EventExpenseSchema } from "../expenses/entities/event-expense.entity";

/**
 * Read-only reporting over every other module's money. Registers each schema
 * under a plain string name so nothing here owns or mutates that data.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
      { name: "Ticket", schema: TicketSchema },
      { name: "Stall", schema: StallSchema },
      { name: "RoundTableBooking", schema: RoundTableBookingSchema },
      { name: "SpeakerRequest", schema: SpeakerRequestSchema },
      { name: "SponsorRequest", schema: SponsorRequestSchema },
      { name: "SupplierRequest", schema: SupplierRequestSchema },
      { name: "PlatformBillingRates", schema: PlatformBillingRatesSchema },
      { name: "EventExpense", schema: EventExpenseSchema },
    ]),
    // JwtAuthGuard injects JwtService — it verifies with JWT_ACCESS_SECRET
    // itself, so these register options only need to provide the instance.
    JwtModule.register({
      secret: process.env.JWT_SECRET || "secretKey",
      signOptions: { expiresIn: "1d" },
    }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
