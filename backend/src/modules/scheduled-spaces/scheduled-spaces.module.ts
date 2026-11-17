import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { ScheduledSpacesService } from "./scheduled-spaces.service";
import { ScheduledSpacesController } from "./scheduled-spaces.controller";
import {
  ScheduledSpaceRequest,
  ScheduledSpaceRequestSchema,
} from "./entities/scheduled-space-request.entity";
import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { MailModule } from "../roles/mail.module";
import { OtpModule } from "../otp/otp.module";
import { OperatorsModule } from "../operators/operators.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScheduledSpaceRequest.name, schema: ScheduledSpaceRequestSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
    ]),
    MailModule,
    // WhatsApp twin of the ticket email (OtpService routes it through the
    // organizer's own linked number).
    OtpModule,
    OperatorsModule,
    // Verifies the caller's token to name who cancelled a booking. The secret
    // is passed at verify time, so this only provides the JwtService.
    JwtModule.register({
      secret: process.env.JWT_SECRET || "secretKey",
      signOptions: { expiresIn: "1d" },
    }),
  ],
  controllers: [ScheduledSpacesController],
  providers: [ScheduledSpacesService],
  exports: [ScheduledSpacesService],
})
export class ScheduledSpacesModule {}
