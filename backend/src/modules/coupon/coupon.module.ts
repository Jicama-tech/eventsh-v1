import { forwardRef, Module } from "@nestjs/common";
import { CouponService } from "./coupon.service";
import { CouponController } from "./coupon.controller";
import { Coupon, CouponSchema } from "./entities/coupon.entity";
import { MongooseModule } from "@nestjs/mongoose/dist";
import { OrganizersModule } from "../organizers/organizers.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Coupon.name, schema: CouponSchema }]),
    // Exports OrganizerOrApiKeyGuard + the Organizer model it needs — used on
    // the write routes below (mirrors the Tickets/Sponsors guard closures).
    forwardRef(() => OrganizersModule),
  ],
  controllers: [CouponController],
  providers: [CouponService],
  exports: [CouponService, MongooseModule],
})
export class CouponModule {}
