import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduledSpacesService } from "./scheduled-spaces.service";
import { ScheduledSpacesController } from "./scheduled-spaces.controller";
import {
  ScheduledSpaceRequest,
  ScheduledSpaceRequestSchema,
} from "./entities/scheduled-space-request.entity";
import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { MailModule } from "../roles/mail.module";
import { OperatorsModule } from "../operators/operators.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScheduledSpaceRequest.name, schema: ScheduledSpaceRequestSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
    ]),
    MailModule,
    OperatorsModule,
  ],
  controllers: [ScheduledSpacesController],
  providers: [ScheduledSpacesService],
  exports: [ScheduledSpacesService],
})
export class ScheduledSpacesModule {}
