import {
  Injectable,
  NotFoundException,
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
import { JwtService } from "@nestjs/jwt";
import { EventDocument } from "../events/schemas/event.schema";
import { User } from "../users/schemas/user.schema";
import { MailService } from "../roles/mail.service";
import { encryptSecret, decryptSecret } from "../../common/secret-crypto.util";
import { CreateOrganizerDto } from "./dto/createOrganizer.dto";
import { Otp } from "../otp/entities/otp.entity";
import { Plan } from "../plans/entities/plan.entity";
import { computePlanExpiry } from "../plans/plan-validity.util";
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

  /**
   * Promote an existing Individual-tier (lazy-created) Organizer row to
   * a full Organizer using the data the user just submitted on the
   * registration form. Preserves the original _id (and therefore every
   * existing event, storefront, ticket, etc. that references it).
   *
   * Sets `organizerType: "upgraded"` so analytics can distinguish users
   * who started Individual then converted, from users who registered
   * Organizer directly.
   */
  private async upgradeIndividualToOrganizer(
    existing: any,
    dto: CreateOrganizerDto,
    normalized: {
      normalizedEmail: string;
      normalizedBusinessEmail: string;
      normalizedWhatsApp: string;
    },
  ) {
    // Pick the right default plan for the chosen tier — same logic as
    // the create path.
    const accountType = dto.accountType || "Organizer";
    const defaultPlan =
      (await this.planModel.findOne({
        moduleType: accountType,
        isDefault: true,
        isActive: true,
      })) ||
      (await this.planModel.findOne({
        moduleType: accountType,
        planName: { $regex: /^starter|^individual/i },
        isActive: true,
      }));
    const validity = Number(defaultPlan?.validityInDays);
    // Day-based plans need a positive day count; date-based plans need a
    // validUntil. Either qualifies the organizer for the default subscription.
    const hasValidity =
      !!defaultPlan &&
      ((defaultPlan.validityType === "date" && !!defaultPlan.validUntil) ||
        (Number.isFinite(validity) && validity > 0));
    const subscriptionFields = hasValidity
      ? {
          subscribed: true,
          planId: defaultPlan._id,
          planStartDate: new Date(),
          planExpiryDate: computePlanExpiry(defaultPlan),
          pricePaid: defaultPlan.price?.toString?.() ?? "0",
        }
      : {};

    const { agentReferralCode, ...rest } = dto;
    // Drop accountType from `rest` so we control it explicitly below.
    delete (rest as any).accountType;

    // Optional referral attribution — same as the create path.
    let provider = (existing as any).provider || "self";
    let providerId = (existing as any).providerId || null;
    if (agentReferralCode) {
      try {
        const agent = await this.organizerModel.db
          .collection("eventsh_agents")
          .findOne({ referralCode: agentReferralCode, isActive: true });
        if (agent) {
          provider = "Agent";
          providerId = agent._id.toString();
        }
      } catch (err) {
        this.logger.warn(`Referral lookup failed: ${err}`);
      }
    }

    try {
      const updated = await this.organizerModel
        .findByIdAndUpdate(
          existing._id,
          {
            $set: {
              ...rest,
              accountType,
              organizerType: "upgraded",
              email: normalized.normalizedEmail,
              businessEmail: normalized.normalizedBusinessEmail,
              whatsAppNumber: normalized.normalizedWhatsApp,
              approved: true,
              rejected: false,
              provider,
              providerId,
              ...subscriptionFields,
            },
          },
          { new: true, runValidators: true },
        )
        .exec();
      this.logger.log(
        `Upgraded Individual organizer ${existing._id} -> Organizer (${normalized.normalizedEmail})`,
      );
      try {
        await this.mailService.sendOrganizerWelcome({
          name: dto.name,
          email: normalized.normalizedEmail,
          organizationName: dto.organizationName,
          planName: defaultPlan?.planName || null,
          validityInDays: defaultPlan?.validityInDays || null,
        });
      } catch (err) {
        this.logger.warn(`Welcome mail failed on upgrade: ${err}`);
      }
      return updated;
    } catch (err: any) {
      if (err?.code === 11000) {
        const dupField =
          Object.keys(err.keyPattern || err.keyValue || {})[0] || "field";
        throw new ConflictException(
          `Cannot upgrade: another organizer already uses this ${dupField}`,
        );
      }
      throw err;
    }
  }

  async registerOrganizer(dto: CreateOrganizerDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const normalizedBusinessEmail = this.normalizeEmail(dto.businessEmail);
    const normalizedWhatsApp = (dto.whatsAppNumber || "").trim();

    // Check all three unique fields up-front so we can either:
    //   (a) UPGRADE in place when the matched row is an Individual-tier
    //       lazy-create (let the user upgrade by completing full
    //       Organizer registration — keeps their existing events +
    //       storefront intact), OR
    //   (b) Return a clean 409 when it's a real conflict (some other
    //       organizer already owns this email / business email / WhatsApp).
    const existing = await this.organizerModel.findOne({
      $or: [
        { email: normalizedEmail },
        { businessEmail: normalizedBusinessEmail },
        { whatsAppNumber: normalizedWhatsApp },
      ],
    });
    if (existing) {
      const matchByOwnEmail = existing.email === normalizedEmail;
      const isIndividualRow =
        (existing as any).accountType === "Individual" &&
        ((existing as any).organizerType === "individual" ||
          !(existing as any).organizerType);
      // Upgrade path: the matched row is the Individual lazy-create
      // belonging to the same user (same primary email). Replace its
      // form-supplied fields with what the user just submitted and
      // flip the tier + lineage. Any pre-existing whatsAppNumber /
      // businessEmail collision in this case is the placeholder we
      // wrote during lazy-create — safe to overwrite.
      if (matchByOwnEmail && isIndividualRow) {
        return this.upgradeIndividualToOrganizer(existing, dto, {
          normalizedEmail,
          normalizedBusinessEmail,
          normalizedWhatsApp,
        });
      }
      let field = "email";
      if (existing.businessEmail === normalizedBusinessEmail) field = "business email";
      else if (existing.whatsAppNumber === normalizedWhatsApp) field = "WhatsApp number";
      throw new ConflictException(
        `An organizer with this ${field} already exists`,
      );
    }

    // 1. Resolve referral attribution (optional)
    let provider = "self";
    let providerId: string | null = null;
    if (dto.agentReferralCode) {
      try {
        const agent = await this.organizerModel.db
          .collection("eventsh_agents")
          .findOne({ referralCode: dto.agentReferralCode, isActive: true });
        if (agent) {
          provider = "Agent";
          providerId = agent._id.toString();
        }
      } catch (err) {
        this.logger.warn(`Referral lookup failed: ${err}`);
      }
    }

    // 2. Find default plan for the chosen accountType (defaults to Organizer
    //    when not specified, preserving legacy behavior for clients that
    //    pre-date the accountType selector).
    const accountType = dto.accountType || "Organizer";
    const defaultPlan =
      (await this.planModel.findOne({
        moduleType: accountType,
        isDefault: true,
        isActive: true,
      })) ||
      (await this.planModel.findOne({
        moduleType: accountType,
        planName: { $regex: /^starter|^individual/i },
        isActive: true,
      }));

    const validity = Number(defaultPlan?.validityInDays);
    // Day-based plans need a positive day count; date-based plans need a
    // validUntil. Either qualifies the organizer for the default subscription.
    const hasValidity =
      !!defaultPlan &&
      ((defaultPlan.validityType === "date" && !!defaultPlan.validUntil) ||
        (Number.isFinite(validity) && validity > 0));
    const subscriptionFields = hasValidity
      ? {
          subscribed: true,
          planId: defaultPlan._id,
          planStartDate: new Date(),
          planExpiryDate: computePlanExpiry(defaultPlan),
          pricePaid: defaultPlan.price?.toString?.() ?? "0",
        }
      : {};

    // 3. Create organizer auto-approved (no manual gate).
    const { agentReferralCode, ...rest } = dto;
    let organizer;
    try {
      organizer = await new this.organizerModel({
        ...rest,
        accountType,
        // Direct full-form registration — no prior Individual row. If
        // there had been one, the upgrade branch above would have run
        // instead and set organizerType to "upgraded".
        organizerType: "organizer",
        email: normalizedEmail,
        businessEmail: normalizedBusinessEmail,
        whatsAppNumber: normalizedWhatsApp,
        approved: true,
        rejected: false,
        provider,
        providerId,
        ...subscriptionFields,
      }).save();
    } catch (err: any) {
      // Race-condition fallback for unique-index collisions that slipped past
      // the pre-check above.
      if (err?.code === 11000) {
        const dupField = Object.keys(err.keyPattern || err.keyValue || {})[0] || "field";
        throw new ConflictException(
          `An organizer with this ${dupField} already exists`,
        );
      }
      this.logger.error(
        `Organizer registration failed for ${normalizedEmail}: ${err?.message || err}`,
        err?.stack,
      );
      throw new BadRequestException(
        err?.message || "Failed to create organizer",
      );
    }

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

      const payload: Record<string, any> = {
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
      } as any);

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


      const orgLookup = operatorOrgs.reduce<Record<string, string>>(
        (acc, org) => {
          acc[org._id.toString()] = org.organizationName;
          return acc;
        },
        {},
      );


      // 4️⃣ Map to unified options
      const organizerOptions = organizers.map((o) => ({
        id: o._id.toString(),
        name: o.organizationName,
        type: "organizer",
        approved: o.approved,
      }));

      const operatorOptions = operators
        .filter((o) => !!o.organizerId)
        .map((o) => ({
          id: o.organizerId!.toString(),
          name: `${
            orgLookup[o.organizerId!.toString()] || "Unknown Organization"
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
          (o) => o._id.toString() === selectedOption!.id,
        );
        if (!organizer) {
          throw new NotFoundException("Organizer not found.");
        }

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
          (o) => o.organizerId?.toString() === selectedOption!.id,
        );
        if (!op || !op.organizerId) {
          throw new NotFoundException("Operator not found.");
        }

        const parentOrg = operatorOrgs.find(
          (o) => o._id.toString() === op.organizerId!.toString(),
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
      } as any);

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
      const organizer = await this.organizerModel.findOne({ _id }).lean();
      if (!organizer) {
        throw new NotFoundException("Not Found");
      }

      // Never echo the SMTP password back to the client; expose only whether
      // one is set (the dedicated email-config endpoint handles editing).
      const ec: any = (organizer as any).emailConfig;
      if (ec && typeof ec === "object") {
        (organizer as any).emailConfig = {
          ...ec,
          smtpPass: undefined,
          hasPassword: !!ec.smtpPass,
        };
      }

      return { message: "Organizer Found", data: organizer };
    } catch (error) {
      throw error;
    }
  }

  // ----- Personal / custom sending email -----------------------------------

  // Return the organizer's email config, including the DECRYPTED SMTP password
  // so the organizer can view what they saved (the field is encrypted at rest;
  // this route is JWT-guarded so only an authenticated user can read it).
  // `hasPassword` is kept for the UI's "saved" hint.
  async getEmailConfig(id: string) {
    const organizer = await this.organizerModel
      .findById(new Types.ObjectId(id))
      .lean();
    if (!organizer) throw new NotFoundException("Organizer Not Found");
    const cfg: any = (organizer as any).emailConfig || {};
    const { smtpPass, ...safe } = cfg;
    return {
      data: {
        ...safe,
        hasPassword: !!smtpPass,
        smtpPass: decryptSecret(smtpPass),
      },
    };
  }

  // Save the email config. A blank smtpPass means "keep the existing password"
  // so the organizer doesn't have to retype it on every edit.
  async updateEmailConfig(id: string, body: any) {
    const organizer = await this.organizerModel
      .findById(new Types.ObjectId(id))
      .lean();
    if (!organizer) throw new NotFoundException("Organizer Not Found");

    const existing: any = (organizer as any).emailConfig || {};
    const next: any = {
      enabled: !!body.enabled,
      fromName: (body.fromName || "").trim(),
      fromEmail: (body.fromEmail || "").trim(),
      smtpHost: (body.smtpHost || "").trim(),
      smtpPort: Number(body.smtpPort) || 465,
      smtpSecure:
        body.smtpSecure === undefined
          ? (Number(body.smtpPort) || 465) === 465
          : !!body.smtpSecure,
      smtpUser: (body.smtpUser || "").trim(),
      // Encrypted at rest (AES-256-GCM) so the password is unreadable in the
      // DB — even to admins. Re-saving an already-encrypted value is a no-op.
      smtpPass: body.smtpPass
        ? encryptSecret(String(body.smtpPass))
        : encryptSecret(existing.smtpPass || ""),
    };

    // Guard: can't enable without the essentials.
    if (
      next.enabled &&
      (!next.smtpHost || !next.smtpUser || !next.smtpPass ||
        !(next.fromEmail || next.smtpUser))
    ) {
      throw new BadRequestException(
        "To enable a personal email, fill in the From email and SMTP host, username and password.",
      );
    }

    // Plan gate: Customize Email is a subscription-plan feature. Mirrors the
    // frontend's isModuleEnabled logic (plan modules → default-plan fallback;
    // plans with no module config at all stay permissive for legacy data).
    if (next.enabled) {
      let plan: any = (organizer as any).planId
        ? await this.planModel.findById((organizer as any).planId).lean()
        : null;
      if (!plan?.modules || Object.keys(plan.modules).length === 0) {
        plan =
          (await this.planModel
            .findOne({ moduleType: "Organizer", isDefault: true, isActive: true })
            .lean()) || plan;
      }
      const modules: any = plan?.modules;
      if (
        modules &&
        Object.keys(modules).length > 0 &&
        !modules.customEmail?.enabled
      ) {
        throw new BadRequestException(
          "Customize Email isn't included in your current plan. Upgrade your subscription to send from your own email address.",
        );
      }
    }

    // $set only the emailConfig so we don't re-validate the whole document.
    await this.organizerModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { emailConfig: next } },
    );

    const { smtpPass, ...safe } = next;
    return {
      message: "Email settings saved",
      data: { ...safe, hasPassword: !!smtpPass },
    };
  }

  // Send a test email using the supplied config (merging the stored password
  // when the form left it blank).
  async sendTestEmailConfig(id: string, body: any, to: string) {
    if (!to) throw new BadRequestException("A recipient email is required");
    const organizer = await this.organizerModel
      .findById(new Types.ObjectId(id))
      .lean();
    if (!organizer) throw new NotFoundException("Organizer Not Found");

    const existing: any = (organizer as any).emailConfig || {};
    const config = {
      fromName: body.fromName || existing.fromName,
      fromEmail: body.fromEmail || existing.fromEmail,
      smtpHost: body.smtpHost || existing.smtpHost,
      smtpPort: Number(body.smtpPort) || existing.smtpPort || 465,
      smtpSecure:
        body.smtpSecure === undefined ? existing.smtpSecure : !!body.smtpSecure,
      smtpUser: body.smtpUser || existing.smtpUser,
      smtpPass: body.smtpPass || existing.smtpPass,
    };
    if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
      throw new BadRequestException(
        "SMTP host, username and password are required to send a test email.",
      );
    }
    try {
      await this.mailService.sendTestEmail(config, to);
      return { message: `Test email sent to ${to}` };
    } catch (err: any) {
      throw new BadRequestException(
        `Couldn't send test email: ${err?.message || "SMTP error"}`,
      );
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
      contactPhones?: string[] | string;
      contactPhoneNames?: string[] | string;
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
      // Multipart can't natively carry arrays — the frontend
      // JSON-stringifies the contactPhones list so the field survives
      // the FormData boundary. Accept both shapes (array if a JSON
      // client called us directly, string if it came through FormData)
      // and persist a normalised string[]. Empty arrays clear the
      // existing list.
      if (body.contactPhones !== undefined) {
        // Both fields arrive JSON-stringified through FormData. Parse each
        // into a string[], then zip them and drop empty-number rows TOGETHER
        // so numbers and their labels stay index-aligned.
        const parseArr = (v: string[] | string | undefined): string[] => {
          if (Array.isArray(v)) return v as string[];
          if (typeof v === "string") {
            try {
              const parsed = JSON.parse(v);
              if (Array.isArray(parsed)) return parsed as string[];
            } catch {
              return [v];
            }
          }
          return [];
        };
        const phonesRaw = parseArr(body.contactPhones);
        const namesRaw = parseArr(body.contactPhoneNames);
        const pairs = phonesRaw
          .map((p, i) => ({
            phone: String(p || "").trim(),
            name: String(namesRaw[i] || "").trim(),
          }))
          .filter((x) => x.phone.length > 0);
        update.contactPhones = pairs.map((x) => x.phone);
        update.contactPhoneNames = pairs.map((x) => x.name);
      }
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
    let orgObjId = new Types.ObjectId(id);
    // Look up the organizer's country to attach currency context — frontend
    // (and chatbot) can use this for proper money formatting.
    let orgForCurrency: any = await this.organizerModel
      .findById(orgObjId)
      .select("country")
      .lean();

    // Individual fallback: the JWT.sub for an Individual user is the User's
    // _id, but events/tickets are keyed on the lazy-created Organizer's _id.
    // Resolve user → email → organizer so the stats reflect their data.
    if (!orgForCurrency) {
      const user: any = await this.userModel
        .findById(id)
        .select("email")
        .lean()
        .catch(() => null);
      if (user?.email) {
        const escapedEmail = String(user.email).replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );
        const orgByEmail: any = await this.organizerModel
          .findOne({
            email: { $regex: `^${escapedEmail}$`, $options: "i" },
          })
          .select("_id country")
          .lean();
        if (orgByEmail?._id) {
          orgObjId = new Types.ObjectId(String(orgByEmail._id));
          orgForCurrency = orgByEmail;
        }
      }
    }

    const country = (orgForCurrency as any)?.country || "US";
    const CURRENCY_MAP: Record<
      string,
      { symbol: string; code: string; locale: string }
    > = {
      IN: { symbol: "₹", code: "INR", locale: "en-IN" },
      SG: { symbol: "SG$", code: "SGD", locale: "en-SG" },
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

    // Match both ObjectId and string forms — older docs may store either.
    const totalEvents = await this.eventModel.countDocuments({
      organizer: { $in: [orgObjId, String(orgObjId)] as any[] },
    });

    // Aggregate paid revenue from round-table bookings and stall registrations
    // so the analytics card reflects ALL income, not just ticket sales.
    const rtbCol = this.organizerModel.db.collection("roundtablebookings");
    const stallsCol = this.organizerModel.db.collection("stalls");
    const [rtbAgg, stallAgg] = await Promise.all([
      rtbCol
        .aggregate([
          {
            $match: {
              organizerId: orgObjId,
              paymentStatus: "Paid",
            },
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: { $ifNull: ["$amount", 0] } },
            },
          },
        ])
        .toArray()
        .catch(() => []),
      stallsCol
        .aggregate([
          {
            $match: {
              organizerId: orgObjId,
              paymentStatus: "Paid",
            },
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: { $ifNull: ["$grandTotal", 0] } },
            },
          },
        ])
        .toArray()
        .catch(() => []),
    ]);
    const ticketRev = totalsAgg[0]?.revenue || 0;
    const roundTableRev = (rtbAgg[0] as any)?.revenue || 0;
    const stallRev = (stallAgg[0] as any)?.revenue || 0;
    const totalRev = ticketRev + roundTableRev + stallRev;

    const fmt = (n: number) =>
      `${currency.symbol}${new Intl.NumberFormat(currency.locale, { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0)}`;
    return {
      window: { from: startOfWindow, to: now, days: 30 },
      currency,
      country,
      totals: {
        events: totalEvents,
        tickets: totalsAgg[0]?.tickets || 0,
        ticketRevenue: ticketRev,
        ticketRevenueFormatted: fmt(ticketRev),
        roundTableRevenue: roundTableRev,
        roundTableRevenueFormatted: fmt(roundTableRev),
        stallRevenue: stallRev,
        stallRevenueFormatted: fmt(stallRev),
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
    // For date-based plans the validity is a FIXED calendar date shared by
    // everyone, so derive the expiry from the plan's current validUntil at
    // read time — that way an admin editing the plan's date is reflected on
    // the organizer dashboard immediately, without re-activating. Day-based
    // plans keep their per-organizer expiry stamped at activation.
    const isDatePlan =
      (plan as any)?.validityType === "date" && !!(plan as any)?.validUntil;
    const effectiveExpiryDate = isDatePlan
      ? new Date((plan as any).validUntil)
      : organizer.planExpiryDate
        ? new Date(organizer.planExpiryDate)
        : null;
    const expiry = effectiveExpiryDate ? effectiveExpiryDate.getTime() : 0;
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
      validityType: (plan as any)?.validityType || "days",
      validUntil: (plan as any)?.validUntil || null,
      planStartDate: organizer.planStartDate || null,
      // Effective expiry — for date plans this is the plan's validUntil so it
      // tracks admin edits; for day plans it's the stored per-organizer expiry.
      planExpiryDate: effectiveExpiryDate || organizer.planExpiryDate || null,
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
      organizer.planExpiryDate = computePlanExpiry(
        plan,
        organizer.planStartDate,
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
