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
