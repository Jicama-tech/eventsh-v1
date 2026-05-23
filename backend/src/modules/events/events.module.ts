import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EventsService } from "./events.service";
import { EventsController } from "./events.controller";
import { EventImportService } from "./event-import.service";
import { Event, EventSchema } from "./schemas/event.schema";
import { TemplatesModule } from "../templates/templates.module";
import { OtpModule } from "../otp/otp.module";
import { OrganizersModule } from "../organizers/organizers.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
    TemplatesModule,
    OtpModule,
    // OrganizersModule exports the Organizer + Plan models so the events
    // controller can lazy-create an Organizer record on first publish for
    // an Individual user (Google sign-in only, no manual registration yet).
    forwardRef(() => OrganizersModule),
  ],
  providers: [EventsService, EventImportService],
  controllers: [EventsController],
})
export class EventsModule {}
