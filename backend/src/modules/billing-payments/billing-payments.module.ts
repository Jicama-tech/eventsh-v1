import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { BillingPaymentsController } from "./billing-payments.controller";
import { BillingPaymentsService } from "./billing-payments.service";
import { PendingBillingPaymentSchema } from "./entities/pending-billing-payment.entity";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { EventSchema } from "../events/schemas/event.schema";
import { SpeakerRequestSchema } from "../speaker-requests/entities/speaker-request.entity";
import { OrganizerPaymentSchema } from "../admin/entities/organizer-payment.entity";
import { PlatformBillingRatesSchema } from "../admin/entities/platform-billing-rates.entity";
import { OrganizerBillingRateOverrideSchema } from "../admin/entities/organizer-billing-rate-override.entity";
import {
  ExhibitorMembership,
  ExhibitorMembershipSchema,
} from "../memberships/schemas/exhibitor-membership.schema";
import {
  MembershipPlan,
  MembershipPlanSchema,
} from "../memberships/schemas/membership-plan.schema";
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
      {
        name: "PendingBillingPayment",
        schema: PendingBillingPaymentSchema,
      },
      { name: "Organizer", schema: OrganizerSchema },
      { name: "Event", schema: EventSchema },
      { name: "SpeakerRequest", schema: SpeakerRequestSchema },
      { name: "OrganizerPayment", schema: OrganizerPaymentSchema },
      { name: "PlatformBillingRates", schema: PlatformBillingRatesSchema },
      {
        name: "OrganizerBillingRateOverride",
        schema: OrganizerBillingRateOverrideSchema,
      },
      // Memberships drive a separate platform-fee tab in the organizer
      // PlatformFeesPanel — listing each active exhibitor membership +
      // total per-membership fee owed to the platform.
      { name: ExhibitorMembership.name, schema: ExhibitorMembershipSchema },
      { name: MembershipPlan.name, schema: MembershipPlanSchema },
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
  controllers: [BillingPaymentsController],
  providers: [BillingPaymentsService],
})
export class BillingPaymentsModule {}
