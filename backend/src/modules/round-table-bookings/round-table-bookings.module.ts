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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RoundTableBooking.name, schema: RoundTableBookingSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
    ]),
    OtpModule,
  ],
  controllers: [RoundTableBookingsController],
  providers: [RoundTableBookingsService],
  exports: [RoundTableBookingsService],
})
export class RoundTableBookingsModule {}
