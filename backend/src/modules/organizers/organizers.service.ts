import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Organizer,
  OrganizerDocument,
  ReceiptType,
} from "./schemas/organizer.schema";
import { LocalDto } from "../auth/dto/local.dto";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { LoginDto } from "../admin/dto/login.dto";
import { EventDocument } from "../events/schemas/event.schema";
import { User } from "../users/schemas/user.schema";
import { MailService } from "../roles/mail.service";
import { CreateOrganizerDto } from "./dto/createOrganizer.dto";
import { Otp } from "../otp/entities/otp.entity";
import { UpdateOrganizerDto } from "./dto/updateOrganizer.dto";
import * as path from "path";
import * as fs from "fs";
import { Plan } from "../plans/entities/plan.entity";
import { OtpService } from "../otp/otp.service";
import {
  Operator,
  OperatorDocument,
} from "../operators/entities/operator.entity";

@Injectable()
export class OrganizersService {
  constructor(
    @InjectModel(Organizer.name)
    private organizerModel: Model<OrganizerDocument>,
    @InjectModel(Otp.name) private otpModel: Model<Otp>, // Inject the OTP model
    @InjectModel(Event.name)
    private eventModel: Model<EventDocument>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Plan.name) private planModel: Model<Plan>,
    @InjectModel(Operator.name) private operatorModel: Model<OperatorDocument>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    // private readonly otpService: OtpService
  ) {}

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  async create(data: Partial<Organizer>) {
    const created = new this.organizerModel(data);
    return created.save();
  }

  async findByEmail(email: string) {
    try {
      const organizer = await this.organizerModel.findOne({
        email: email,
        approved: true,
      });

      if (organizer) return { message: "Organizer found", data: organizer };
    } catch (error) {
      throw error;
    }
  }

  async list(organizerId: string) {
    try {
      const organizer = new Types.ObjectId(organizerId);
      const events = await this.eventModel.find({
        organizer: organizer,
      });
      if (!events) {
        throw new NotFoundException("No events found");
      }
      return { message: "Events found", data: events };
    } catch (error) {
      throw error;
    }
  }

  async getDashboardDataForOrganizer(organizerId: string): Promise<any> {
    const now = new Date();

    // Calculate start of today (midnight)
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );

    // Calculate end of today (just before midnight next day)
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    // Convert organizerId to ObjectId if needed (depends on your schema and ORM)
    // const organizer = new Types.ObjectId(organizerId);

    const currentEvents = await this.eventModel
      .find({
        organizer: organizerId,
        // Events that start before end of today
        startDate: { $lte: endOfToday },
        // and endDate is either null or after start of today
        $or: [{ endDate: { $gte: startOfToday } }, { endDate: null }],
      })
      .lean();

    const upcomingEvents = await this.eventModel
      .find({
        organizer: organizerId,
        startDate: { $gt: endOfToday }, // strictly after today
      })
      .lean();

    const pastEvents = await this.eventModel
      .find({
        organizer: organizerId,
        endDate: { $lt: startOfToday }, // strictly before today
      })
      .lean();

    const totalEvents = await this.eventModel.countDocuments({
      organizer: organizerId,
    });

    const totalAttendees = await this.eventModel.aggregate([
      { $match: { organizer: organizerId } },
      { $group: { _id: null, total: { $sum: "$attendees" } } },
    ]);

    return {
      stats: [
        { title: "Total Events", value: totalEvents.toString() },
        {
          title: "Total Attendees",
          value: totalAttendees[0]?.total?.toLocaleString() || "0",
        },
      ],
      currentEvents,
      upcomingEvents,
      pastEvents,
    };
  }

  async registerOrganizer(dto: CreateOrganizerDto) {
    const existing = await this.organizerModel.findOne({ email: dto.email });
    if (existing)
      throw new ConflictException("Organizer with this email already exists");

    const organizer = await new this.organizerModel({
      ...dto,
      status: "pending",
      approved: false,
      rejected: false,
    }).save();

    await this.mailService.sendApprovalRequestToAdmin({
      name: dto.name,
      email: dto.email,
      role: "organizer",
    });
    await this.mailService.sendConfirmationToUser({
      name: dto.name,
      email: dto.email,
      role: "organizer",
    });

    return organizer;
  }

  async requestOTP(email: string) {
    try {
      const normalizedEmail = this.normalizeEmail(email);

      const organizer = await this.organizerModel.findOne({
        businessEmail: normalizedEmail,
        approved: true,
      });

      if (!organizer) {
        throw new NotFoundException("Organizer not found or not approved");
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const channel = "business_email";
      const role = "organizer";
      const identifier = normalizedEmail;

      await this.otpModel.findOneAndUpdate(
        { channel, role, identifier },
        {
          email: normalizedEmail,
          otp,
          expiresAt,
          attempts: 0,
          verified: false,
          lastSentAt: new Date(),
          channel,
          identifier,
          role,
        },
        { upsert: true, new: true },
      );


      const businessEmail = organizer.businessEmail || organizer.email;

      await this.mailService.sendOTPEmail({
        name: organizer.name,
        email: businessEmail,
        otp,
        businessName: organizer.organizationName || organizer.name,
      });

      return {
        message: "OTP sent successfully to your registered business email",
        data: {
          email: normalizedEmail,
          businessEmail,
          expiresIn: 10,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async verifyOTP(email: string, otp: string) {
    try {
      const normalizedEmail = this.normalizeEmail(email);

      const channel = "business_email";
      const role = "organizer";
      const identifier = normalizedEmail;

      const otpDoc = await this.otpModel.findOne({
        channel,
        role,
        identifier,
        verified: false,
      });

      if (!otpDoc) {
        throw new BadRequestException(
          "OTP not found or expired. Please request a new one.",
        );
      }

      if (new Date() > otpDoc.expiresAt) {
        await this.otpModel.deleteOne({ _id: otpDoc._id });
        throw new BadRequestException(
          "OTP has expired. Please request a new one.",
        );
      }

      if (otpDoc.attempts >= 3) {
        await this.otpModel.deleteOne({ _id: otpDoc._id });
        throw new BadRequestException(
          "Too many invalid attempts. Please request a new OTP.",
        );
      }

      if (otpDoc.otp !== otp) {
        await this.otpModel.updateOne(
          { _id: otpDoc._id },
          { $inc: { attempts: 1 } },
        );
        throw new BadRequestException(
          `Invalid OTP. ${3 - otpDoc.attempts - 1} attempts remaining.`,
        );
      }


      const organizer = await this.organizerModel.findOne({
        businessEmail: normalizedEmail,
        approved: true,
      });

      if (!organizer) {
        throw new NotFoundException("Organizer not found or not approved");
      }

      const payload = {
        name: organizer.name,
        email: organizer.email,
        sub: organizer._id,
        roles: ["organizer"],
      };

      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "24h",
      });

      await this.otpModel.deleteOne({ _id: otpDoc._id });

      return {
        message: "Login successful",
        data: {
          token,
          organizer: {
            id: organizer._id,
            name: organizer.name,
            email: organizer.email,
            businessName: organizer.organizationName,
          },
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async resendOTP(email: string) {
    try {
      const normalizedEmail = this.normalizeEmail(email);

      const organizer = await this.organizerModel.findOne({
        businessEmail: normalizedEmail,
        approved: true,
      });

      if (!organizer) {
        throw new NotFoundException("Organizer not found or not approved");
      }

      const channel = "business_email";
      const role = "organizer";
      const identifier = normalizedEmail;

      const existing = await this.otpModel.findOne({
        channel,
        role,
        identifier,
      });
      if (
        existing?.lastSentAt &&
        Date.now() - new Date(existing.lastSentAt).getTime() < 60 * 1000
      ) {
        throw new BadRequestException(
          "Please wait 60 seconds before requesting a new OTP",
        );
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await this.otpModel.findOneAndUpdate(
        { channel, role, identifier },
        {
          email: normalizedEmail,
          otp,
          expiresAt,
          attempts: 0,
          verified: false,
          lastSentAt: new Date(),
          channel,
          identifier,
          role,
        },
        { upsert: true, new: true },
      );


      const businessEmail = organizer.businessEmail || organizer.email;

      await this.mailService.sendOTPEmail({
        name: organizer.name,
        email: businessEmail,
        otp,
        businessName: organizer.organizationName || organizer.name,
      });

      return {
        message: "New OTP sent successfully",
        data: {
          email: businessEmail,
          expiresIn: 10,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async findByWhatsAppNumber(
    whatsAppNumber: string,
    targetId?: string,
    emailId?: string,
  ) {
    try {
      // 1️⃣ Organizer Query
      const organizerQuery: any = {
        $or: [
          { whatsappNumber: whatsAppNumber },
          { whatsAppNumber: whatsAppNumber },
        ],
      };

      if (emailId) organizerQuery.email = emailId;


      // 2️⃣ Operator Query (WhatsApp only)
      // 2️⃣ Operator Query (WhatsApp only - only records with organizerId)
      const operatorQuery = {
        $or: [
          { whatsappNumber: whatsAppNumber },
          { whatsAppNumber: whatsAppNumber },
        ],
        organizerId: { $exists: true, $ne: null }, // ✅ Only fetch operator records tied to an organizer
      };


      const [organizers, operators] = await Promise.all([
        this.organizerModel.find(organizerQuery),
        this.operatorModel.find(operatorQuery),
      ]);


      // 3️⃣ Fetch parent organizations for operators
      const operatorOrgIds = [...new Set(operators.map((o) => o.organizerId))];


      const operatorOrgs = await this.organizerModel.find({
        _id: { $in: operatorOrgIds },
      });


      const orgLookup = operatorOrgs.reduce((acc, org) => {
        acc[org._id.toString()] = org.organizationName;
        return acc;
      }, {});


      // 4️⃣ Map to unified options
      const organizerOptions = organizers.map((o) => ({
        id: o._id.toString(),
        name: o.organizationName,
        type: "organizer",
        approved: o.approved,
      }));

      const operatorOptions = operators.map((o) => ({
        id: o.organizerId.toString(),
        name: `${
          orgLookup[o.organizerId.toString()] || "Unknown Organization"
        } (Operator: ${o.name})`,
        type: "operator",
        approved: true,
      }));

      const allOptions = [...organizerOptions, ...operatorOptions];

      // 5️⃣ Selection Logic
      if (allOptions.length === 0) {
        return null;
      }

      let selectedOption;

      if (allOptions.length === 1) {
        selectedOption = allOptions[0];
      } else if (targetId) {
        selectedOption = allOptions.find((opt) => opt.id === targetId);

        if (!selectedOption) {
          throw new NotFoundException("Selected account not found.");
        }
      } else {
        return {
          requiresSelection: true,
          organizations: allOptions.map((opt) => ({
            id: opt.id,
            organizationName: opt.name,
            type: opt.type,
            approved: opt.approved,
          })),
        };
      }

      // 6️⃣ Generate JWT Payload
      let payload: any;

      if (selectedOption.type === "organizer") {
        const organizer = organizers.find(
          (o) => o._id.toString() === selectedOption.id,
        );

        payload = {
          name: organizer.name,
          email: organizer.email,
          sub: organizer._id.toString(),
          country: organizer.country,
          roles: ["organizer"],
        };
      } else {
        const op = operators.find(
          (o) => o.organizerId.toString() === selectedOption.id,
        );

        const parentOrg = operatorOrgs.find(
          (o) => o._id.toString() === op.organizerId.toString(),
        );

        if (!parentOrg) {
          throw new NotFoundException("Parent organization not found.");
        }

        payload = {
          name: op.name,
          email: op.email ?? "",
          sub: parentOrg._id.toString(),
          operatorId: op._id.toString(),
          country: parentOrg.country,
          roles: ["organizer"],
        };
      }

      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "24h",
      });

      return { message: "Token found", token };
    } catch (error) {
      throw error;
    }
  }

  async approve(id: string) {
    return this.organizerModel
      .findByIdAndUpdate(id, { approved: true }, { new: true })
      .exec();
  }

  async getprofile(id: string) {
    try {
      const organizer = await this.organizerModel.findOne({ _id: id });
      if (!organizer) {
        throw new NotFoundException("Organizer Not Found");
      }
      return { message: "Organizer Found", data: organizer };
    } catch (error) {
      throw error;
    }
  }

  async getOrganizer(id: string) {
    try {
      const organizer = await this.organizerModel.find({ _id: id });
      if (!organizer) {
        throw new NotFoundException("Organizer Not Found");
      }
      return { message: "Organizer Found", data: organizer };
    } catch (error) {
      throw error;
    }
  }

  async getProfile(id: string) {
    try {
      const _id = new Types.ObjectId(id);
      const organizer = await this.organizerModel.findOne({ _id });
      if (!organizer) {
        throw new NotFoundException("Not Found");
      }

      return { message: "Organizer Found", data: organizer };
    } catch (error) {
      throw error;
    }
  }

  // async updateProfile(
  //   id: string,
  //   body: {
  //     name?: string;
  //     email?: string;
  //     organizationName?: string;
  //     businessEmail?: string;
  //     whatsAppNumber?: string;
  //     address?: string;
  //     slug?: string;
  //     paymentURL?: string;
  //     phoneNumber?: string;
  //     bio?: string;
  //   },
  //   paymentQrPublicUrl?: string | null
  // ) {
  //   if (!Types.ObjectId.isValid(id)) {
  //     throw new BadRequestException("Invalid organizer id");
  //   }

  //   const update: Record<string, any> = {};

  //   if (body.name !== undefined) update.name = body.name;
  //   if (body.email !== undefined) update.email = body.email.toLowerCase();
  //   if (body.organizationName !== undefined)
  //     update.organizationName = body.organizationName;
  //   if (body.phoneNumber !== undefined) update.phoneNumber = body.phoneNumber;
  //   if (body.businessEmail !== undefined)
  //     update.businessEmail = body.businessEmail.toLowerCase();
  //   if (body.whatsAppNumber !== undefined)
  //     update.whatsAppNumber = body.whatsAppNumber;
  //   if (body.address !== undefined) update.address = body.address;
  //   if (body.slug !== undefined) update.slug = body.slug;
  //   if (body.paymentURL !== undefined) update.paymentURL = body.paymentURL;
  //   if (body.phoneNumber !== undefined) update.phoneNumber = body.phoneNumber;
  //   if (body.bio !== undefined) update.bio = body.bio;

  //   if (paymentQrPublicUrl) {
  //     update.paymentURL = paymentQrPublicUrl;
  //   }

  //   const updated = await this.organizerModel
  //     .findByIdAndUpdate(id, update, {
  //       new: true,
  //       runValidators: true,
  //     })
  //     .lean()
  //     .exec();

  //   if (!updated) {
  //     throw new NotFoundException("Organizer not found");
  //   }

  //   delete (updated as any).password; // if password exists

  //   return { message: "Profile updated", data: updated };
  // }

  async updateProfile(
    id: string,
    body: {
      ownerName?: string;
      organizationName?: string;
      email?: string;
      businessEmail?: string;
      whatsappNumber?: string;
      phone?: string;
      address?: string;
      description?: string;
      GSTNumber?: string;
      UENNumber?: string;
      whatsAppQRNumber?: string;
      instagramQR?: boolean;
      whatsAppQR?: boolean;
      instagramHandle?: string;
      dynamicQR?: boolean;
      hasDocVerification?: boolean;
      taxPercentage?: string | number;
      discountPercentage?: string | number;
      businessCategory?: string;
      receiptType?: ReceiptType | string;
      termsAndConditions?: string;
      paymentURL?: string;
      shopClosedFromDate?: Date; // Accept string from FormData
      shopClosedToDate?: Date; // Accept string from FormData
      country?: string; // IN/SG
      bankTransferEnabled?: boolean | string;
      bankName?: string;
      bankAccountNumber?: string;
      bankIfscCode?: string;
      bankSwiftCode?: string;
      bankBranchCode?: string;
      bankBranch?: string;
      accountHolderName?: string;
      bankAccountType?: string;
      payNowId?: string;
    },
    paymentQrPublicUrl?: string | null,
  ) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException("Invalid shopkeeper id");
      }

      const update: Record<string, any> = {};

      // ✅ EXISTING FIELDS
      if (body.ownerName !== undefined) update.name = body.ownerName;
      if (body.organizationName !== undefined)
        update.organizationName = body.organizationName;
      if (body.email !== undefined)
        update.email = this.normalizeEmail(body.email);
      if (body.businessEmail !== undefined)
        update.businessEmail = this.normalizeEmail(body.businessEmail);
      if (body.whatsappNumber !== undefined)
        update.whatsappNumber = body.whatsappNumber;
      if (body.phone !== undefined) update.phone = body.phone;
      if (body.address !== undefined) update.address = body.address;
      if (body.description !== undefined) update.description = body.description;

      // ✅ NEW FIELDS
      if (body.GSTNumber !== undefined) update.GSTNumber = body.GSTNumber;
      if (body.UENNumber !== undefined) update.UENNumber = body.UENNumber;
      if (body.hasDocVerification !== undefined) {
        // ✅ Type-safe boolean conversion
        update.hasDocVerification =
          typeof body.hasDocVerification === "boolean"
            ? body.hasDocVerification
            : body.hasDocVerification === "true";
      }
      if (body.dynamicQR !== undefined)
        update.dynamicQR =
          typeof body.dynamicQR === "boolean"
            ? body.dynamicQR
            : body.dynamicQR === "true";
      if (body.whatsAppQR !== undefined)
        update.whatsAppQR =
          typeof body.whatsAppQR === "boolean"
            ? body.whatsAppQR
            : body.whatsAppQR === "true";
      if (body.instagramHandle !== undefined)
        update.instagramHandle = body.instagramHandle;
      if (body.whatsAppQRNumber !== undefined)
        update.whatsAppQRNumber = body.whatsAppQRNumber;
      if (body.instagramQR !== undefined)
        update.instagramQR =
          typeof body.instagramQR === "boolean"
            ? body.instagramQR
            : body.instagramQR === "true";
      if (body.businessCategory !== undefined)
        update.businessCategory = body.businessCategory;

      if (body.termsAndConditions !== undefined)
        update.termsAndConditions = body.termsAndConditions;

      // ✅ TAX PERCENTAGE (handle string/number)
      if (body.taxPercentage !== undefined) {
        const taxNum =
          typeof body.taxPercentage === "string"
            ? parseFloat(body.taxPercentage)
            : body.taxPercentage;
        update.taxPercentage = isNaN(taxNum) ? 0 : taxNum;
      }

      // ✅ DISCOUNT PERCENTAGE (handle string/number)
      if (body.discountPercentage !== undefined) {
        const discountNum =
          typeof body.discountPercentage === "string"
            ? parseFloat(body.discountPercentage)
            : body.discountPercentage;
        update.discountPercentage = isNaN(discountNum) ? 0 : discountNum;
      }

      // ✅ DATES (handle string/Date from FormData)
      if (body.shopClosedFromDate !== undefined) {
        update.shopClosedFromDate =
          typeof body.shopClosedFromDate === "string"
            ? new Date(body.shopClosedFromDate)
            : body.shopClosedFromDate;
      }
      if (body.shopClosedToDate !== undefined) {
        update.shopClosedToDate =
          typeof body.shopClosedToDate === "string"
            ? new Date(body.shopClosedToDate)
            : body.shopClosedToDate;
      }

      // ✅ NEW: Country field
      if (body.country !== undefined) update.country = body.country;

      // ✅ Bank Transfer fields
      if (body.bankTransferEnabled !== undefined)
        update.bankTransferEnabled =
          typeof body.bankTransferEnabled === "boolean"
            ? body.bankTransferEnabled
            : body.bankTransferEnabled === "true";
      if (body.bankName !== undefined) update.bankName = body.bankName;
      if (body.bankAccountNumber !== undefined) update.bankAccountNumber = body.bankAccountNumber;
      if (body.bankIfscCode !== undefined) update.bankIfscCode = body.bankIfscCode;
      if (body.bankSwiftCode !== undefined) update.bankSwiftCode = body.bankSwiftCode;
      if (body.bankBranchCode !== undefined) update.bankBranchCode = body.bankBranchCode;
      if (body.bankBranch !== undefined) update.bankBranch = body.bankBranch;
      if (body.accountHolderName !== undefined) update.accountHolderName = body.accountHolderName;
      if (body.bankAccountType !== undefined) update.bankAccountType = body.bankAccountType;
      if (body.payNowId !== undefined) update.payNowId = body.payNowId;

      if (body.receiptType !== undefined) {
        const allowedValues = Object.values(ReceiptType);

        if (!allowedValues.includes(body.receiptType as ReceiptType)) {
          throw new BadRequestException(
            `Invalid receiptType. Allowed values: ${allowedValues.join(", ")}`,
          );
        }

        update.receiptType = body.receiptType;
      }

      // ✅ Persist uploaded QR public URL (overrides paymentURL if provided)
      if (paymentQrPublicUrl) {
        update.paymentURL = paymentQrPublicUrl;
      } else if (body.paymentURL !== undefined) {
        update.paymentURL = body.paymentURL;
      }

      const updated = await this.organizerModel
        .findByIdAndUpdate(id, update, { new: true, runValidators: true })
        .lean()
        .exec();

      if (!updated) {
        throw new NotFoundException("Organizer not found");
      }

      // ✅ Remove sensitive data
      delete (updated as any).password;
      delete (updated as any).__v;

      return {
        message: "Profile updated successfully",
        data: updated,
      };
    } catch (error) {
    }
  }

  async getOrganizerBySlug(slug: string) {
    try {
      const organizer = await this.organizerModel.findOne({ slug: slug });
      if (!organizer) {
        throw new NotFoundException("Organizer Not Found");
      }

      return { message: "Organizer Found", data: organizer };
    } catch (error) {
      throw error;
    }
  }

  async addSubscriptionPlan(id: string, planSelected: string) {
    try {
      const organizer = await this.organizerModel.findById(id);
      if (!organizer) {
        throw new NotFoundException("Organizer Not Found");
      }

      const plan = await this.planModel.findById(planSelected);
      if (!plan || !plan.isActive)
        throw new NotFoundException("Plan Not Found or Inactive");

      organizer.subscribed = true;
      organizer.planId = plan._id;
      organizer.planStartDate = new Date();
      organizer.planExpiryDate = new Date(
        organizer.planStartDate.getTime() +
          plan.validityInDays * 24 * 60 * 60 * 1000,
      );
      organizer.pricePaid = plan.price.toString();

      let message =
        `🔄 *Plan Activated*\n\n` +
        `Dear ${organizer.name},\n\n` +
        `Your Subscription Plan for *${plan.planName}* has been successfully Activated for *${organizer.organizationName}*.\n\n` +
        `• Plan Validity: ${plan.validityInDays} days\n` +
        `• Features Included:\n${plan.features.map((f) => `  - ${f}`).join("\n")}\n\n` +
        `Thank you for choosing us! We’re excited to support your journey.\n\n` +
        `Best regards,\n` +
        `The Eventsh Team`;

      await organizer.save();

      // await this.otpService.sendWhatsAppMessage(
      //   organizer.whatsAppNumber,
      //   message
      // );

      return { message: "Plan Added", data: organizer };
    } catch (error) {
      throw error;
    }
  }

  async cancelSubscription(id: string) {
    try {
      const organizer = await this.organizerModel.findById(id);

      if (!organizer) {
        throw new NotFoundException("Organizer Not Found");
      }

      organizer.subscribed = false;
      organizer.planId = null;
      // organizer.planStartDate = null;
      organizer.planExpiryDate = new Date();

      let message =
        `🔄 *Subscription Cancelled*\n\n` +
        `Dear ${organizer.name},\n\n` +
        `Your Subscription Plan for *${organizer.organizationName}* has been successfully Cancelled.\n\n`;

      await organizer.save();

      // await this.otpService.sendWhatsAppMessage(
      //   organizer.whatsAppNumber,
      //   message
      // );

      return { message: "Subscription Cancelled", data: organizer };
    } catch (error) {
      throw error;
    }
  }
}
