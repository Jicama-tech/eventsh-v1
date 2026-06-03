import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Vendor,
  VendorDocument,
} from "../stalls/schemas/vendor.schema";
import { CreateShopkeeperDto } from "./dto/create-shopkeeper.dto";
import { UpdateShopkeeperDto } from "./dto/update-shopkeeper.dto";

@Injectable()
export class ShopkeepersService {
  private readonly logger = new Logger(ShopkeepersService.name);

  constructor(
    @InjectModel(Vendor.name) private vendorModel: Model<VendorDocument>,
  ) {}

  // Mirror whatsappNumber across both casings so existing reads (which use
  // either) keep working regardless of where the doc came from.
  private normalizeWhatsApp(dto: CreateShopkeeperDto | UpdateShopkeeperDto) {
    const wa = (dto.whatsappNumber || dto.whatsAppNumber || "").trim();
    if (!wa) return {};
    return { whatsappNumber: wa, whatsAppNumber: wa };
  }

  // Store membershipEndDate as UTC midnight of the intended calendar day, so
  // it never drifts a day when later serialized with toISOString() (the
  // classic +offset timezone off-by-one). Accepts "YYYY-MM-DD", "DD/MM/YYYY",
  // or a Date.
  private toUtcMidnight(v: any): Date | undefined {
    if (v == null || v === "") return undefined;
    if (v instanceof Date && !isNaN(v.getTime())) {
      return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (m) {
      const a = +m[1];
      const b = +m[2];
      let y = +m[3];
      if (y < 100) y += 2000;
      let day: number;
      let mon: number;
      if (a > 12) {
        day = a;
        mon = b;
      } else if (b > 12) {
        mon = a;
        day = b;
      } else {
        day = a;
        mon = b; // ambiguous -> day-first (DD/MM), the SG/IN convention
      }
      if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
        return new Date(Date.UTC(y, mon - 1, day));
      }
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    return undefined;
  }

  async createForOrganizer(organizerId: string, dto: CreateShopkeeperDto) {
    if (!Types.ObjectId.isValid(organizerId)) {
      throw new BadRequestException("Invalid organizer id");
    }
    const orgObjId = new Types.ObjectId(organizerId);
    const wa = this.normalizeWhatsApp(dto);

    // Reject duplicate exhibitor per organizer (by WhatsApp).
    if (wa.whatsappNumber) {
      const existing = await this.vendorModel.findOne({
        organizerId: orgObjId,
        $or: [
          { whatsappNumber: wa.whatsappNumber },
          { whatsAppNumber: wa.whatsappNumber },
        ],
      });
      if (existing) {
        throw new ConflictException(
          "An exhibitor with this WhatsApp number already exists.",
        );
      }
    }

    try {
      const created = await this.vendorModel.create({
        ...dto,
        ...wa,
        ...(dto.membershipEndDate !== undefined
          ? { membershipEndDate: this.toUtcMidnight(dto.membershipEndDate) }
          : {}),
        organizerId: orgObjId,
        approved: dto.approved ?? true,
      });
      return { message: "Shopkeeper created", data: created };
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException("Duplicate exhibitor record.");
      }
      this.logger.error(
        `createForOrganizer failed: ${err?.message || err}`,
        err?.stack,
      );
      throw new BadRequestException(err?.message || "Could not create exhibitor");
    }
  }

  async updateForOrganizer(
    organizerId: string,
    vendorId: string,
    dto: UpdateShopkeeperDto,
  ) {
    if (!Types.ObjectId.isValid(organizerId) || !Types.ObjectId.isValid(vendorId)) {
      throw new BadRequestException("Invalid id");
    }
    const orgObjId = new Types.ObjectId(organizerId);
    const wa = this.normalizeWhatsApp(dto);

    const update: Record<string, any> = { ...dto, ...wa };
    if (dto.membershipEndDate !== undefined) {
      update.membershipEndDate = this.toUtcMidnight(dto.membershipEndDate);
    }

    const updated = await this.vendorModel.findOneAndUpdate(
      // Allow updating vendors that have no organizerId yet (legacy stall-only
      // records) so editing from the organizer's exhibitors page also claims
      // them under that organizer.
      {
        _id: new Types.ObjectId(vendorId),
        $or: [{ organizerId: orgObjId }, { organizerId: { $exists: false } }, { organizerId: null }],
      },
      { $set: update, $setOnInsert: { organizerId: orgObjId } },
      { new: true, runValidators: true },
    );

    if (!updated) throw new NotFoundException("Exhibitor not found");
    return { message: "Shopkeeper updated", data: updated };
  }

  async fetchForOrganizer(organizerId: string) {
    if (!Types.ObjectId.isValid(organizerId)) {
      throw new BadRequestException("Invalid organizer id");
    }
    const orgObjId = new Types.ObjectId(organizerId);
    const list = await this.vendorModel
      .find({ organizerId: orgObjId })
      .sort({ createdAt: -1 })
      .lean();
    return { message: "Shopkeepers fetched", data: list };
  }
}
