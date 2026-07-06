import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { EventsService } from "./events.service";
import { EventsController } from "./events.controller";
import { EventImportService } from "./event-import.service";
import { Event, EventSchema } from "./schemas/event.schema";
import { TemplatesModule } from "../templates/templates.module";
import { OtpModule } from "../otp/otp.module";
import { OrganizersModule } from "../organizers/organizers.module";
import {
  OrganizerStore,
  OrganizerStoreSchema,
} from "../organizer-stores/entities/organizer-store.entity";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      // Lazy-create a storefront row alongside the Organizer record when
      // an Individual publishes their first event, so they get a complete
      // shareable URL (/{slug}/events/{id}) instead of just the bare
      // /events/{id} link.
      { name: OrganizerStore.name, schema: OrganizerStoreSchema },
    ]),
    // Volunteer Google sign-in mints a short-lived volunteer JWT so the
    // scanner session survives a page refresh.
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || "secret",
      signOptions: { expiresIn: "12h" },
    }),
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
