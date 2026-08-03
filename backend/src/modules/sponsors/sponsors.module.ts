import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { SponsorsService } from "./sponsors.service";
import { SponsorsController } from "./sponsors.controller";
import {
  SponsorRequest,
  SponsorRequestSchema,
} from "./entities/sponsor-request.entity";
import { Sponsor, SponsorSchema } from "./schemas/sponsor.schema";
import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { MailModule } from "../roles/mail.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SponsorRequest.name, schema: SponsorRequestSchema },
      { name: Sponsor.name, schema: SponsorSchema },
      // Tiers live on the event; currency comes from the organizer's country.
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
    ]),
    // Invoice emails go out from the organizer's SMTP when configured.
    MailModule,
    // JwtAuthGuard injects JwtService — it verifies with JWT_ACCESS_SECRET
    // itself, so these register options only need to provide the instance.
    JwtModule.register({
      secret: process.env.JWT_SECRET || "secretKey",
      signOptions: { expiresIn: "1d" },
    }),
  ],
  controllers: [SponsorsController],
  providers: [SponsorsService],
  exports: [SponsorsService],
})
export class SponsorsModule {}
