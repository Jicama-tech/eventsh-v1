import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { RsvpController } from "./rsvp.controller";
import { RsvpService } from "./rsvp.service";
import { Rsvp, RsvpSchema } from "./schemas/rsvp.schema";
import { Event, EventSchema } from "../events/schemas/event.schema";
import { Organizer, OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { MailModule } from "../roles/mail.module";

@Module({
  imports: [
    MailModule,
    MongooseModule.forFeature([
      { name: Rsvp.name, schema: RsvpSchema },
      { name: Event.name, schema: EventSchema },
      { name: Organizer.name, schema: OrganizerSchema },
    ]),
  ],
  controllers: [RsvpController],
  providers: [RsvpService],
  exports: [RsvpService],
})
export class RsvpModule {}
