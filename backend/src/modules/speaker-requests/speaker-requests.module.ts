import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SpeakerRequestsController } from "./speaker-requests.controller";
import { SpeakerRequestsService } from "./speaker-requests.service";
import {
  SpeakerRequest,
  SpeakerRequestSchema,
} from "./entities/speaker-request.entity";
import { Speaker, SpeakerSchema } from "./schemas/speaker.schema";
import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { OtpModule } from "../otp/otp.module";
import { FeedbackModule } from "../feedback/feedback.module";
import { MailModule } from "../roles/mail.module";
import { OperatorsModule } from "../operators/operators.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SpeakerRequest.name, schema: SpeakerRequestSchema },
      // Persistent speaker profiles, reused across events.
      { name: Speaker.name, schema: SpeakerSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
    ]),
    OtpModule,
    FeedbackModule,
    MailModule,
    // Resolves a shared event link's ?ref= code to the referring operator.
    OperatorsModule,
  ],
  controllers: [SpeakerRequestsController],
  providers: [SpeakerRequestsService],
  exports: [SpeakerRequestsService],
})
export class SpeakerRequestsModule {}
