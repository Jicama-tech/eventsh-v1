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
import { TicketSchema } from "../tickets/entities/ticket.entity";
import { OtpModule } from "../otp/otp.module";
import { OperatorsModule } from "../operators/operators.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkshopBooking.name, schema: WorkshopBookingSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
      { name: "Ticket", schema: TicketSchema },
    ]),
    OtpModule,
    // OperatorsService.resolveReferral — attributes bookings made through an
    // operator's shared event link (?ref=).
    OperatorsModule,
  ],
  controllers: [WorkshopBookingsController],
  providers: [WorkshopBookingsService],
  exports: [WorkshopBookingsService],
})
export class WorkshopBookingsModule {}
