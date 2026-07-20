import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { StallsService } from "./stalls.service";
import { StallsController } from "./stalls.controller";
import { Stall, StallSchema } from "./entities/stall.entity";
import { Vendor, VendorSchema } from "./schemas/vendor.schema";
import {
  StallFormDraft,
  StallFormDraftSchema,
} from "./schemas/stall-form-draft.schema";
import { OtpModule } from "../otp/otp.module";
import { CouponModule } from "../coupon/coupon.module";
import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { StallPaymentSchedulerService } from "./stall-payment-scheduler.service";
import { FeedbackModule } from "../feedback/feedback.module";
import { MailModule } from "../roles/mail.module";
import { Operator, OperatorSchema } from "../operators/entities/operator.entity";
import {
  OrganizerStore,
  OrganizerStoreSchema,
} from "../organizer-stores/entities/organizer-store.entity";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Stall.name, schema: StallSchema },
      { name: Vendor.name, schema: VendorSchema },
      // In-progress registration forms — powers cross-device resume.
      { name: StallFormDraft.name, schema: StallFormDraftSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
      // Operators of the organizer — emailed when a new stall request lands
      // so any of them can approve/reject quickly.
      { name: Operator.name, schema: OperatorSchema },
      // Store lookup for the organizer's public storefront slug, used to
      // build the event-front link in vendor status emails.
      { name: OrganizerStore.name, schema: OrganizerStoreSchema },
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
