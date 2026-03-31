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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Stall.name, schema: StallSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
    ]),
    OtpModule,
    CouponModule,
  ],
  controllers: [StallsController],
  providers: [StallsService, StallPaymentSchedulerService],
  exports: [StallsService],
})
export class StallsModule {}
