import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { TokensController } from "./tokens.controller";
import { TokensService } from "./tokens.service";
import { TokensCron } from "./tokens.cron";
import { TokenWalletSchema } from "./entities/token-wallet.entity";
import { TokenLedgerEntrySchema } from "./entities/token-ledger-entry.entity";
import { TokenTopUpRequestSchema } from "./entities/token-topup-request.entity";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { EventSchema } from "../events/schemas/event.schema";
import { SpeakerRequestSchema } from "../speaker-requests/entities/speaker-request.entity";
import { PlatformBillingRatesSchema } from "../admin/entities/platform-billing-rates.entity";
import { OrganizerBillingRateOverrideSchema } from "../admin/entities/organizer-billing-rate-override.entity";
import {
  ExhibitorMembership,
  ExhibitorMembershipSchema,
} from "../memberships/schemas/exhibitor-membership.schema";
import { WorkshopBookingSchema } from "../workshop-bookings/entities/workshop-booking.entity";
import { SponsorRequestSchema } from "../sponsors/entities/sponsor-request.entity";
import { SupplierRequestSchema } from "../suppliers/entities/supplier-request.entity";
import { Ticket, TicketSchema } from "../tickets/entities/ticket.entity";
import { OtpModule } from "../otp/otp.module";
import { MailModule } from "../roles/mail.module";

@Module({
  imports: [
    OtpModule,
    MailModule,
    MongooseModule.forFeature([
      { name: "TokenWallet", schema: TokenWalletSchema },
      { name: "TokenLedgerEntry", schema: TokenLedgerEntrySchema },
      { name: "TokenTopUpRequest", schema: TokenTopUpRequestSchema },
      { name: "Organizer", schema: OrganizerSchema },
      { name: "Event", schema: EventSchema },
      { name: "SpeakerRequest", schema: SpeakerRequestSchema },
      { name: "PlatformBillingRates", schema: PlatformBillingRatesSchema },
      {
        name: "OrganizerBillingRateOverride",
        schema: OrganizerBillingRateOverrideSchema,
      },
      { name: ExhibitorMembership.name, schema: ExhibitorMembershipSchema },
      { name: "WorkshopBooking", schema: WorkshopBookingSchema },
      { name: "SponsorRequest", schema: SponsorRequestSchema },
      { name: "SupplierRequest", schema: SupplierRequestSchema },
      { name: Ticket.name, schema: TicketSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || "secretKey",
      signOptions: { expiresIn: "1d" },
    }),
  ],
  controllers: [TokensController],
  providers: [TokensService, TokensCron],
  exports: [TokensService],
})
export class TokensModule {}
