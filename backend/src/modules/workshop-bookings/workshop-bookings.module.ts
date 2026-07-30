import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WorkshopBookingsService } from "./workshop-bookings.service";
import { WorkshopBookingsController } from "./workshop-bookings.controller";
import {
  WorkshopBooking,
  WorkshopBookingSchema,
} from "./entities/workshop-booking.entity";
import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { OtpModule } from "../otp/otp.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkshopBooking.name, schema: WorkshopBookingSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
    ]),
    OtpModule,
  ],
  controllers: [WorkshopBookingsController],
  providers: [WorkshopBookingsService],
  exports: [WorkshopBookingsService],
})
export class WorkshopBookingsModule {}
