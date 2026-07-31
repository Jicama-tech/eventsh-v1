import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WorkshopRequestsController } from "./workshop-requests.controller";
import { WorkshopRequestsService } from "./workshop-requests.service";
import {
  WorkshopRequest,
  WorkshopRequestSchema,
} from "./entities/workshop-request.entity";
import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import {
  WorkshopBooking,
  WorkshopBookingSchema,
} from "../workshop-bookings/entities/workshop-booking.entity";
import { OtpModule } from "../otp/otp.module";
import { MailModule } from "../roles/mail.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkshopRequest.name, schema: WorkshopRequestSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
      // Read-only here — used to total up ticket sales owed to the host.
      { name: WorkshopBooking.name, schema: WorkshopBookingSchema },
    ]),
    OtpModule,
    MailModule,
  ],
  controllers: [WorkshopRequestsController],
  providers: [WorkshopRequestsService],
  exports: [WorkshopRequestsService],
})
export class WorkshopRequestsModule {}
