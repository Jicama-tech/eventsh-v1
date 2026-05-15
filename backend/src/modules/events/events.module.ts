import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EventsService } from "./events.service";
import { EventsController } from "./events.controller";
import { EventImportService } from "./event-import.service";
import { Event, EventSchema } from "./schemas/event.schema";
import { TemplatesModule } from "../templates/templates.module";
import { OtpModule } from "../otp/otp.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
    TemplatesModule,
    OtpModule,
  ],
  providers: [EventsService, EventImportService],
  controllers: [EventsController],
})
export class EventsModule {}
