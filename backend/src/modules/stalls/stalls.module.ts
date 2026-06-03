import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { StallsService } from "./stalls.service";
import { StallsController } from "./stalls.controller";
import { Stall, StallSchema } from "./entities/stall.entity";
import { Vendor, VendorSchema } from "./schemas/vendor.schema";
import { OtpModule } from "../otp/otp.module";
import { CouponModule } from "../coupon/coupon.module";
import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { StallPaymentSchedulerService } from "./stall-payment-scheduler.service";
import { FeedbackModule } from "../feedback/feedback.module";
import { MailModule } from "../roles/mail.module";
import { Operator, OperatorSchema } from "../operators/entities/operator.entity";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Stall.name, schema: StallSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
      // Operators of the organizer — emailed when a new stall request lands
      // so any of them can approve/reject quickly.
      { name: Operator.name, schema: OperatorSchema },
    ]),
    OtpModule,
    CouponModule,
    FeedbackModule,
    MailModule,
  ],
  controllers: [StallsController],
  providers: [StallsService, StallPaymentSchedulerService],
  exports: [StallsService],
})
export class StallsModule {}
