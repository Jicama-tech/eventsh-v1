import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SpeakerRequestsController } from "./speaker-requests.controller";
import { SpeakerRequestsService } from "./speaker-requests.service";
import {
  SpeakerRequest,
  SpeakerRequestSchema,
} from "./entities/speaker-request.entity";
import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { OtpModule } from "../otp/otp.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SpeakerRequest.name, schema: SpeakerRequestSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
    ]),
    OtpModule,
  ],
  controllers: [SpeakerRequestsController],
  providers: [SpeakerRequestsService],
  exports: [SpeakerRequestsService],
})
export class SpeakerRequestsModule {}
