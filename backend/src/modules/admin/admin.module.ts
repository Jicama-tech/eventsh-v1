import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { AdminSchema } from "./entities/admin.entity";
import { MongooseModule } from "@nestjs/mongoose/dist";
import { JwtModule } from "@nestjs/jwt";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { EventSchema } from "../events/schemas/event.schema";
import { UserSchema } from "../users/schemas/user.schema";
import { TicketSchema } from "../tickets/entities/ticket.entity";
import { PlanSchema } from "../plans/entities/plan.entity";
import { AgentSchema } from "../agents/schemas/agent.schema";
import { OperatorSchema } from "../operators/entities/operator.entity";
import { VendorSchema } from "../stalls/schemas/vendor.schema";
import { SpeakerRequestSchema } from "../speaker-requests/entities/speaker-request.entity";
import { OrganizerPaymentSchema } from "./entities/organizer-payment.entity";
import { PlatformBillingRatesSchema } from "./entities/platform-billing-rates.entity";
import { PaymentConfigSchema } from "./entities/payment-config.entity";
import { MailModule } from "../roles/mail.module";
import { MailService } from "../roles/mail.service";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [
    PaymentsModule,
    MongooseModule.forFeature([
      { name: "Admin", schema: AdminSchema },
      { name: "Organizer", schema: OrganizerSchema },
      { name: "Event", schema: EventSchema },
      { name: "User", schema: UserSchema },
      { name: "Ticket", schema: TicketSchema },
      { name: "Plan", schema: PlanSchema },
      { name: "Agent", schema: AgentSchema },
      { name: "Operator", schema: OperatorSchema },
      { name: "Vendor", schema: VendorSchema },
      { name: "SpeakerRequest", schema: SpeakerRequestSchema },
      { name: "OrganizerPayment", schema: OrganizerPaymentSchema },
      { name: "PlatformBillingRates", schema: PlatformBillingRatesSchema },
      { name: "PaymentConfig", schema: PaymentConfigSchema },
    ]),
    MailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "secretKey",
      signOptions: { expiresIn: "1d" },
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService, MailService],
})
export class AdminModule {}
