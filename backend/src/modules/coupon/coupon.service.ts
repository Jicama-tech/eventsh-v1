import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Coupon, CouponDocument } from "./entities/coupon.entity";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { UpdateCouponDto } from "./dto/update-coupon.dto";

@Injectable()
export class CouponService {
  constructor(
    @InjectModel(Coupon.name)
    private readonly couponModel: Model<CouponDocument>,
  ) {}

  /* ================= CREATE COUPON ================= */
  async create(dto: CreateCouponDto): Promise<Coupon> {
    // 1️⃣ Uppercase coupon code
    dto.code = dto.code.toUpperCase();

    // 2️⃣ Expiry validation
    if (new Date(dto.expiryDate) <= new Date()) {
      throw new BadRequestException("Expiry date must be in the future");
    }

    // 3️⃣ Discount validation
    if (dto.discountType === "PERCENTAGE" && !dto.discountPercentage) {
      throw new BadRequestException(
        "discountPercentage is required for PERCENTAGE coupon",
      );
    }

    if (dto.discountType === "FLAT" && !dto.flatDiscountAmount) {
      throw new BadRequestException(
        "flatDiscountAmount is required for FLAT coupon",
      );
    }

    // 4️⃣ Scope validation
    if (dto.appliesTo === "SHOPKEEPER" && !dto.shopkeeperId) {
      throw new BadRequestException("shopkeeperId is required");
    }

    if (dto.appliesTo === "ORGANIZER" && !dto.organizerId) {
      throw new BadRequestException("organizerId is required");
    }

    // 5️⃣ Duplicate code check
    // const existing = await this.couponModel.findOne({
    //   code: dto.code,
    //   isDeleted: false,
    // });

    // if (existing) {
    //   throw new BadRequestException("Coupon code already exists");
    // }

    return await this.couponModel.create(dto);
  }

  /* ================= FIND ALL COUPONS ================= */
  async findAll(): Promise<Coupon[]> {
    return this.couponModel.find({
      isDeleted: false,
    });
  }

  /* ================= FIND BY SHOPKEEPER ================= */
  async findByShopkeeper(shopkeeperId: string): Promise<any> {
    const coupons = await this.couponModel.find({
      shopkeeperId,
      isDeleted: false,
      isActive: true,
      expiryDate: { $gt: new Date() },
    });

    if (!coupons || coupons.length === 0) {
      throw new NotFoundException("No coupons found for this shopkeeper");
    }

    return { message: "Coupons retrieved successfully", data: coupons };
  }

  async findForShopkeeper(shopkeeperId: string): Promise<any> {
    const coupons = await this.couponModel.find({
      shopkeeperId,
      isDeleted: false,
      // expiryDate: { $gt: new Date() },
    });

    if (!coupons || coupons.length === 0) {
      throw new NotFoundException("No coupons found for this shopkeeper");
    }

    return { message: "Coupons retrieved successfully", data: coupons };
  }

  /* ================= FIND BY ORGANIZER ================= */
  async findByOrganizer(organizerId: string): Promise<any> {
    const coupons = await this.couponModel.find({
      organizerId,
      isDeleted: false,
      // expiryDate: { $gt: new Date() },
    });

    if (!coupons || coupons.length === 0) {
      throw new NotFoundException("No coupons found for this Organizer");
    }

    return { message: "Coupons retrieved successfully", data: coupons };
  }

  /* ================= FIND ONE ================= */
  async findOne(id: string): Promise<CouponDocument> {
    const coupon = await this.couponModel.findById(id);

    if (!coupon || coupon.isDeleted) {
      throw new NotFoundException("Coupon not found");
    }

    return coupon;
  }

  /* ================= UPDATE COUPON ================= */
  async update(id: string, dto: UpdateCouponDto) {
    // 1️⃣ Validate expiry date
    if (dto.expiryDate && new Date(dto.expiryDate) < new Date()) {
      throw new BadRequestException("Expiry date must be in the future");
    }

    // 2️⃣ Update coupon
    const updatedCoupon = await this.couponModel.findByIdAndUpdate(id, dto, {
      new: true, // return updated doc
      lean: true, // convert to plain JSON
      runValidators: true,
    });

    // 3️⃣ If coupon not found
    if (!updatedCoupon) {
      throw new BadRequestException("Coupon not found");
    }

    // 4️⃣ Return safe JSON
    return {
      message: "Coupon updated successfully",
      data: updatedCoupon,
    };
  }

  /* ================= DELETE COUPON (SOFT DELETE) ================= */
  async remove(id: string): Promise<{ message: string }> {
    const coupon = await this.findOne(id);

    coupon.isDeleted = true;
    coupon.isActive = false;
    await coupon.save();

    return { message: "Coupon deleted successfully" };
  }

  /* ================= VALIDATE COUPON (APPLY LOGIC) ================= */
  async validateCoupon(code: string, orderAmount: number) {
    const coupon = await this.couponModel.findOne({
      _id: code,
      isDeleted: false,
      isActive: true,
    });

    if (!coupon) {
      throw new BadRequestException("Invalid coupon code");
    }

    if (coupon.expiryDate < new Date()) {
      throw new BadRequestException("Coupon expired");
    }

    if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) {
      throw new BadRequestException("Coupon usage limit exceeded");
    }

    if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount is ${coupon.minOrderAmount}`,
      );
    }

    return coupon;
  }

  async validateEventCoupon(
    code: string,
    eventId: string,
    orderAmount: number,
  ) {
    const coupon = await this.couponModel.findOne({
      code: code,
      isDeleted: false,
      isActive: true,
      eventId: eventId,
    });

    if (!coupon) {
      throw new BadRequestException("Invalid coupon code");
    }

    if (coupon.expiryDate < new Date()) {
      throw new BadRequestException("Coupon expired");
    }

    if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) {
      throw new BadRequestException("Coupon usage limit exceeded");
    }

    if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount is ${coupon.minOrderAmount}`,
      );
    }

    await this.incrementUsageCount1(code, eventId);

    return coupon;
  }

  async incrementUsageCount(code: string) {
    const coupon = await this.couponModel.findOne({
      _id: code,
      isDeleted: false,
      isActive: true,
    });
    if (coupon) {
      coupon.usedCount += 1;

      if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) {
        coupon.isActive = false;
        return {
          message: "Coupon has reached its maximum usage limit",
          data: coupon,
        };
      }

      await coupon.save();

      return { message: "Coupon usage count incremented", data: coupon };
    }
  }

  async incrementUsageCount1(code: string, eventId: string) {
    const coupon = await this.couponModel.findOne({
      code: code,
      isDeleted: false,
      isActive: true,
    });
    if (coupon) {
      coupon.usedCount += 1;

      if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) {
        coupon.isActive = false;
        return {
          message: "Coupon has reached its maximum usage limit",
          data: coupon,
        };
      }

      await coupon.save();

      return { message: "Coupon usage count incremented", data: coupon };
    }
  }
}
