import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
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
  private readonly logger = new Logger(OrganizersService.name);

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
    const normalizedEmail = this.normalizeEmail(dto.email);
    const existing = await this.organizerModel.findOne({
      email: normalizedEmail,
    });
    if (existing)
      throw new ConflictException("Organizer with this email already exists");

    // 1. Resolve referral attribution (optional)
    let provider = "self";
    let providerId: string | null = null;
    if (dto.agentReferralCode) {
      const agent = await this.organizerModel.db
        .collection("eventsh_agents")
        .findOne({ referralCode: dto.agentReferralCode, isActive: true });
      if (agent) {
        provider = "Agent";
        providerId = agent._id.toString();
      }
    }

    // 2. Find default Organizer plan and auto-assign with expiry.
    const defaultPlan =
      (await this.planModel.findOne({
        moduleType: "Organizer",
        isDefault: true,
        isActive: true,
      })) ||
      (await this.planModel.findOne({
        moduleType: "Organizer",
        planName: { $regex: /^starter/i },
        isActive: true,
      }));

    const subscriptionFields = defaultPlan
      ? {
          subscribed: true,
          planId: defaultPlan._id,
          planStartDate: new Date(),
          planExpiryDate: new Date(
            Date.now() + defaultPlan.validityInDays * 24 * 60 * 60 * 1000,
          ),
          pricePaid: defaultPlan.price.toString(),
        }
      : {};

    // 3. Create organizer auto-approved (no manual gate).
    const { agentReferralCode, ...rest } = dto;
    const organizer = await new this.organizerModel({
      ...rest,
      email: normalizedEmail,
      approved: true,
      rejected: false,
      provider,
      providerId,
      ...subscriptionFields,
    }).save();

    try {
      await this.mailService.sendOrganizerWelcome({
        name: dto.name,
        email: normalizedEmail,
        organizationName: dto.organizationName,
        planName: defaultPlan?.planName || null,
        validityInDays: defaultPlan?.validityInDays || null,
      });
    } catch {
      // Email failures shouldn't block registration.
    }

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
        country: organizer.country,
        organizationName: organizer.organizationName,
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
          organizationName: organizer.organizationName,
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
          accessTabs: (op as any).accessTabs || [],
          country: parentOrg.country,
          organizationName: parentOrg.organizationName,
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

  // 7-day grace window after expiry — kioscart parity.
  private readonly GRACE_PERIOD_DAYS = 7;

  /**
   * Daily 09:00 server-time job: send a warning email to any organizer whose
   * plan expires in exactly 3 days. Runs once a day so each organizer gets at
   * most one warning per cycle.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDailyExpiryWarnings() {
    try {
      const DAY = 24 * 60 * 60 * 1000;
      const now = Date.now();
      const targetWindowStart = new Date(now + 3 * DAY);
      const targetWindowEnd = new Date(now + 4 * DAY);

      const expiring = await this.organizerModel
        .find({
          subscribed: true,
          planExpiryDate: { $gte: targetWindowStart, $lt: targetWindowEnd },
        })
        .lean();

      for (const org of expiring as any[]) {
        try {
          const plan = org.planId
            ? await this.planModel.findById(org.planId).lean()
            : null;
          if (!plan) continue;
          const daysLeft = Math.ceil(
            (new Date(org.planExpiryDate).getTime() - now) / DAY,
          );
          await this.mailService.sendPlanExpiryWarning({
            name: org.name,
            email: org.email,
            organizationName: org.organizationName,
            planName: plan.planName,
            daysLeft,
            expiryDate: org.planExpiryDate,
          });
        } catch (err) {
          this.logger.warn(
            `Failed to send expiry warning to ${org.email}: ${err}`,
          );
        }
      }
      this.logger.log(
        `Sent expiry warnings to ${expiring.length} organizers.`,
      );
    } catch (err) {
      this.logger.error("Expiry warning cron failed", err as any);
    }
  }

  // Per-organizer analytics for the dashboard charts: revenue trend, ticket
  // sales over time, top events. 30-day window.
  async getAnalytics(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid organizer id");
    }
    const orgObjId = new Types.ObjectId(id);
    // Look up the organizer's country to attach currency context — frontend
    // (and chatbot) can use this for proper money formatting.
    const orgForCurrency = await this.organizerModel
      .findById(orgObjId)
      .select("country")
      .lean();
    const country = (orgForCurrency as any)?.country || "US";
    const CURRENCY_MAP: Record<
      string,
      { symbol: string; code: string; locale: string }
    > = {
      IN: { symbol: "₹", code: "INR", locale: "en-IN" },
      SG: { symbol: "S$", code: "SGD", locale: "en-SG" },
      US: { symbol: "$", code: "USD", locale: "en-US" },
      GB: { symbol: "£", code: "GBP", locale: "en-GB" },
      AE: { symbol: "AED ", code: "AED", locale: "en-AE" },
      AU: { symbol: "A$", code: "AUD", locale: "en-AU" },
      EU: { symbol: "€", code: "EUR", locale: "en-IE" },
    };
    const currency =
      CURRENCY_MAP[String(country).toUpperCase()] || CURRENCY_MAP.US;
    const DAY = 24 * 60 * 60 * 1000;
    const now = new Date();
    const startOfWindow = new Date(now.getTime() - 30 * DAY);

    // Need raw ticket model — already injected via OrganizersModule?
    // We don't currently inject TicketModel; load via raw collection.
    const ticketsCol = this.organizerModel.db.collection("tickets");

    const [dailyRevenue, topEvents, totalsAgg, statusBreakdown] =
      await Promise.all([
        ticketsCol
          .aggregate([
            {
              $match: {
                organizerId: orgObjId,
                purchaseDate: { $gte: startOfWindow },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$purchaseDate",
                  },
                },
                tickets: { $sum: 1 },
                revenue: {
                  $sum: {
                    $cond: ["$paymentConfirmed", "$totalAmount", 0],
                  },
                },
              },
            },
            { $sort: { _id: 1 } },
          ])
          .toArray(),
        ticketsCol
          .aggregate([
            { $match: { organizerId: orgObjId } },
            {
              $group: {
                _id: "$eventId",
                eventTitle: { $first: "$eventTitle" },
                tickets: { $sum: 1 },
                revenue: {
                  $sum: {
                    $cond: ["$paymentConfirmed", "$totalAmount", 0],
                  },
                },
              },
            },
            { $sort: { revenue: -1 } },
            { $limit: 5 },
          ])
          .toArray(),
        ticketsCol
          .aggregate([
            { $match: { organizerId: orgObjId } },
            {
              $group: {
                _id: null,
                tickets: { $sum: 1 },
                revenue: {
                  $sum: {
                    $cond: ["$paymentConfirmed", "$totalAmount", 0],
                  },
                },
              },
            },
          ])
          .toArray(),
        ticketsCol
          .aggregate([
            { $match: { organizerId: orgObjId } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ])
          .toArray(),
      ]);

    // Ensure 30 contiguous days, filling 0s for missing dates.
    const trend: { date: string; tickets: number; revenue: number }[] = [];
    const map = new Map<
      string,
      { tickets: number; revenue: number }
    >(
      dailyRevenue.map((d: any) => [
        d._id,
        { tickets: d.tickets, revenue: d.revenue || 0 },
      ]),
    );
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY);
      const key = d.toISOString().slice(0, 10);
      const v = map.get(key) || { tickets: 0, revenue: 0 };
      trend.push({ date: key, tickets: v.tickets, revenue: v.revenue });
    }

    const totalEvents = await this.eventModel.countDocuments({
      organizer: orgObjId,
    });

    const fmt = (n: number) =>
      `${currency.symbol}${new Intl.NumberFormat(currency.locale, { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0)}`;
    const totalRev = totalsAgg[0]?.revenue || 0;
    return {
      window: { from: startOfWindow, to: now, days: 30 },
      currency,
      country,
      totals: {
        events: totalEvents,
        tickets: totalsAgg[0]?.tickets || 0,
        revenue: totalRev,
        revenueFormatted: fmt(totalRev),
      },
      revenueTrend: trend.map((t: any) => ({
        ...t,
        revenueFormatted: fmt(t.revenue),
      })),
      topEvents: topEvents.map((e: any) => ({
        eventId: String(e._id),
        eventTitle: e.eventTitle || "Untitled",
        tickets: e.tickets,
        revenue: e.revenue || 0,
        revenueFormatted: fmt(e.revenue || 0),
      })),
      statusBreakdown: statusBreakdown.map((s: any) => ({
        status: s._id || "unknown",
        count: s.count,
      })),
    };
  }

  async getSubscriptionDetail(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid organizer id");
    }
    const organizer = await this.organizerModel.findById(id).lean();
    if (!organizer) throw new NotFoundException("Organizer not found");

    let plan = organizer.planId
      ? await this.planModel.findById(organizer.planId).lean()
      : null;

    // Fallback: if the organizer has no plan, OR their plan has no module
    // configuration, look up the default plan in eventsh_plans and use that.
    // This ensures legacy organizers (created before module-gating) and any
    // edge cases all get sensible module access.
    const planHasNoModules =
      !plan ||
      !(plan as any).modules ||
      Object.keys((plan as any).modules || {}).length === 0;
    if (planHasNoModules) {
      const defaultPlan = await this.planModel
        .findOne({
          moduleType: "Organizer",
          isDefault: true,
          isActive: true,
        })
        .lean();
      if (defaultPlan) {
        plan = plan
          ? // Keep the user's plan name/price/expiry but use default's modules + features
            { ...plan, modules: (defaultPlan as any).modules, features: defaultPlan.features }
          : (defaultPlan as any);
      }
    }

    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expiry = organizer.planExpiryDate
      ? new Date(organizer.planExpiryDate).getTime()
      : 0;
    const subscribed = !!organizer.subscribed;
    const isExpired = subscribed && expiry > 0 && expiry < now;
    const daysLeft = expiry > now ? Math.ceil((expiry - now) / DAY) : 0;

    // Grace window: from expiry to expiry + 7 days. Plan is "expired" but
    // organizer keeps access until grace runs out.
    const graceEnd = expiry > 0 ? expiry + this.GRACE_PERIOD_DAYS * DAY : 0;
    const inGracePeriod = isExpired && graceEnd > now;
    const graceDaysLeft = inGracePeriod
      ? Math.ceil((graceEnd - now) / DAY)
      : 0;
    const fullyLapsed = isExpired && !inGracePeriod;
    const planActive = subscribed && (!isExpired || inGracePeriod);

    return {
      subscribed,
      planId: organizer.planId ? String(organizer.planId) : null,
      planName: plan?.planName || null,
      pricePaid: organizer.pricePaid || null,
      validityInDays: plan?.validityInDays || null,
      planStartDate: organizer.planStartDate || null,
      planExpiryDate: organizer.planExpiryDate || null,
      isExpired,
      daysLeft,
      // Grace window fields (kioscart parity)
      gracePeriodDays: this.GRACE_PERIOD_DAYS,
      inGracePeriod,
      graceDaysLeft,
      fullyLapsed,
      planActive,
      features: plan?.features || [],
      modules: (plan as any)?.modules || {},
      description: plan?.description || null,
    };
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

      await organizer.save();

      try {
        await this.mailService.sendPlanPurchaseConfirmation({
          name: organizer.name,
          email: organizer.email,
          organizationName: organizer.organizationName,
          planName: plan.planName,
          pricePaid: plan.price.toString(),
          validityInDays: plan.validityInDays,
          expiryDate: organizer.planExpiryDate,
        });
      } catch {
        // Email failures shouldn't block plan switch.
      }

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

      const previousPlanId = organizer.planId;
      organizer.subscribed = false;
      organizer.planId = null;
      organizer.planExpiryDate = new Date();

      await organizer.save();

      try {
        const previousPlan = previousPlanId
          ? await this.planModel.findById(previousPlanId).lean()
          : null;
        await this.mailService.sendSubscriptionCancelled({
          name: organizer.name,
          email: organizer.email,
          organizationName: organizer.organizationName,
          planName: previousPlan?.planName || null,
        });
      } catch {
        // Email failures shouldn't block cancellation.
      }

      return { message: "Subscription Cancelled", data: organizer };
    } catch (error) {
      throw error;
    }
  }
}
