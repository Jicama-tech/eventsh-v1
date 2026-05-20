import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { PendingSubscriptionPaymentSchema } from "./entities/pending-subscription-payment.entity";
import { PlanSchema } from "../plans/entities/plan.entity";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { OtpModule } from "../otp/otp.module";
import { MailModule } from "../roles/mail.module";

@Module({
  imports: [
    OtpModule,
    MailModule,
    MongooseModule.forFeature([
      {
        name: "PendingSubscriptionPayment",
        schema: PendingSubscriptionPaymentSchema,
      },
      { name: "Plan", schema: PlanSchema },
      { name: "Organizer", schema: OrganizerSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || "secretKey",
      signOptions: { expiresIn: "1d" },
    }),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
