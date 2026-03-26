import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from "@nestjs/common";
import { CouponService } from "./coupon.service";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { UpdateCouponDto } from "./dto/update-coupon.dto";

@Controller("coupons")
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  /* ================= CREATE COUPON ================= */
  @Post("create-coupon")
  create(@Body() createCouponDto: CreateCouponDto) {
    return this.couponService.create(createCouponDto);
  }

  /* ================= GET ALL COUPONS ================= */
  @Get("get-all-coupons")
  findAll() {
    return this.couponService.findAll();
  }

  /* ================= GET COUPONS BY ORGANIZER ================= */
  @Get("organizer/:organizerId")
  findByOrganizer(@Param("organizerId") organizerId: string) {
    return this.couponService.findByOrganizer(organizerId);
  }

  /* ================= GET SINGLE COUPON ================= */
  @Get("get-coupon/:id")
  findOne(@Param("id") id: string) {
    return this.couponService.findOne(id);
  }

  /* ================= UPDATE COUPON ================= */
  @Patch("update-coupon/:id")
  update(@Param("id") id: string, @Body() updateCouponDto: UpdateCouponDto) {
    return this.couponService.update(id, updateCouponDto);
  }

  /* ================= DELETE COUPON (SOFT DELETE) ================= */
  @Delete("delete-coupon/:id")
  remove(@Param("id") id: string) {
    return this.couponService.remove(id);
  }

  /* ================= VALIDATE / APPLY COUPON ================= */
  @Post("validate")
  validateCoupon(
    @Body("code") code: string,
    @Body("orderAmount") orderAmount: number,
  ) {
    return this.couponService.validateCoupon(code, orderAmount);
  }

  @Post("Validate-Event-Coupon")
  validateEventCoupon(
    @Body("code") code: string,
    @Body("orderAmount") orderAmount: number,
    @Body("eventId") eventId: string,
  ) {
    return this.couponService.validateEventCoupon(code, eventId, orderAmount);
  }
}
