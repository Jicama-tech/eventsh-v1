import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { RoundTableBookingsService } from "./round-table-bookings.service";
import { RoundTableBookingsController } from "./round-table-bookings.controller";
import {
  RoundTableBooking,
  RoundTableBookingSchema,
} from "./entities/round-table-booking.entity";
import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { OtpModule } from "../otp/otp.module";
import { FeedbackModule } from "../feedback/feedback.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { OperatorsModule } from "../operators/operators.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoundTableBooking.name, schema: RoundTableBookingSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
    ]),
    OtpModule,
    FeedbackModule,
    // Lets a round-table buyer who holds an active membership at this
    // organizer be charged member-tier seat/table prices.
    MembershipsModule,
    // Resolves an operator's shared-link referral code (?ref=) so the
    // booking can be attributed to that operator.
    OperatorsModule,
  ],
  controllers: [RoundTableBookingsController],
  providers: [RoundTableBookingsService],
  exports: [RoundTableBookingsService],
})
export class RoundTableBookingsModule {}
