import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { CouponService } from "./coupon.service";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { UpdateCouponDto } from "./dto/update-coupon.dto";
import { OrganizerOrApiKeyGuard } from "../organizers/guards/organizer-or-api-key.guard";

@Controller("coupons")
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  // Same shape of gap as Tickets/Sponsors, closed the same way: writes were
  // previously reachable by anyone with no auth at all, `organizerId` taken
  // straight from the body/URL with zero ownership check. Reads stay public
  // (matches Events' own "public read, guarded write" split) — findAll,
  // findByOrganizer, findOne, and the buyer-facing validate/Validate-Event-
  // Coupon routes are unauthenticated by design, not by oversight.
  private assertOwnsCoupon(req: any, organizerId: unknown) {
    if (!organizerId || String(organizerId) !== req.user?.userId) {
      throw new ForbiddenException("Not authorized to manage this coupon");
    }
  }

  /* ================= CREATE COUPON ================= */
  @Post("create-coupon")
  @UseGuards(OrganizerOrApiKeyGuard)
  create(@Body() createCouponDto: CreateCouponDto, @Req() req: any) {
    this.assertOwnsCoupon(req, createCouponDto.organizerId);
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
  @UseGuards(OrganizerOrApiKeyGuard)
  async update(
    @Param("id") id: string,
    @Body() updateCouponDto: UpdateCouponDto,
    @Req() req: any,
  ) {
    const existing = await this.couponService.findOne(id);
    this.assertOwnsCoupon(req, existing.organizerId);
    return this.couponService.update(id, updateCouponDto);
  }

  /* ================= DELETE COUPON (SOFT DELETE) ================= */
  @Delete("delete-coupon/:id")
  @UseGuards(OrganizerOrApiKeyGuard)
  async remove(@Param("id") id: string, @Req() req: any) {
    const existing = await this.couponService.findOne(id);
    this.assertOwnsCoupon(req, existing.organizerId);
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
