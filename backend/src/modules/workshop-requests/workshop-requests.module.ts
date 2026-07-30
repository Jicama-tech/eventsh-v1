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
import { OtpModule } from "../otp/otp.module";
import { MailModule } from "../roles/mail.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkshopRequest.name, schema: WorkshopRequestSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
    ]),
    OtpModule,
    MailModule,
  ],
  controllers: [WorkshopRequestsController],
  providers: [WorkshopRequestsService],
  exports: [WorkshopRequestsService],
})
export class WorkshopRequestsModule {}
