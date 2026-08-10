import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { CreateOperatorDto } from "./dto/create-operator.dto";
import { UpdateOperatorDto } from "./dto/update-operator.dto";
import { InjectModel } from "@nestjs/mongoose";
import { Operator, OperatorDocument } from "./entities/operator.entity";
import { Model, Types } from "mongoose";
import {
  Organizer,
  OrganizerDocument,
} from "../organizers/schemas/organizer.schema";

/** Shape the JWT strategy puts on `req.user` — mirrors expenses.service.ts's JwtActor. */
export interface JwtActor {
  userId?: string;
  name?: string;
  email?: string;
  roles?: string[];
}

@Injectable()
export class OperatorsService {
  constructor(
    @InjectModel(Operator.name) private operatorModel: Model<OperatorDocument>,
    @InjectModel(Organizer.name)
    private organizerModel: Model<OrganizerDocument>,
  ) {}

  // 7-char uppercase alphanumeric, excluding visually-ambiguous characters
  // (0/O, 1/I) so visitors can read/type it off a poster without confusion.
  private generateReferralCode(): string {
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 7; i++) {
      code += charset[Math.floor(Math.random() * charset.length)];
    }
    return code;
  }

  // Generates a referral code guaranteed unique across all operators.
  private async generateUniqueReferralCode(): Promise<string> {
    let code = this.generateReferralCode();
    let attempts = 0;
    while (await this.operatorModel.exists({ referralCode: code })) {
      code = this.generateReferralCode();
      attempts++;
      if (attempts > 10) {
        throw new BadRequestException(
          "Failed to generate unique referral code",
        );
      }
    }
    return code;
  }

  // The exists() check inside generateUniqueReferralCode is an optimization,
  // not a guarantee — two concurrent requests (e.g. two operators created
  // back-to-back, or two lazy backfills) can both pass it before either
  // save() actually commits. The sparse unique index on referralCode is the
  // real backstop; this is what reacts when it rejects a collided write,
  // regenerating and retrying rather than letting a raw duplicate-key error
  // surface as an unhandled 500 on what's otherwise a routine save.
  private async saveWithUniqueReferralCode(
    doc: OperatorDocument,
    attempts = 3,
  ): Promise<void> {
    for (let i = 0; i < attempts; i++) {
      doc.referralCode = await this.generateUniqueReferralCode();
      try {
        await doc.save();
        return;
      } catch (err: any) {
        if (err?.code === 11000 && i < attempts - 1) continue;
        throw err;
      }
    }
  }

  // Pre-existing operators (created before referral codes existed) won't
  // have one yet — backfill lazily on read instead of a one-off migration.
  private async ensureReferralCode(
    operator: OperatorDocument,
  ): Promise<OperatorDocument> {
    if (!operator.referralCode) {
      await this.saveWithUniqueReferralCode(operator);
    }
    return operator;
  }

  // Create operator by Organizer
  async createByOrganizer(
    createOperatorDto: CreateOperatorDto,
    organizerId: string,
  ) {
    try {
      if (!Types.ObjectId.isValid(organizerId)) {
        throw new BadRequestException("Invalid organizer ID");
      }

      const organizer = await this.organizerModel.findById(organizerId);
      if (!organizer) {
        throw new NotFoundException("Organizer Not Found");
      }

      const whatsApp = (createOperatorDto.whatsAppNumber || "").trim();

      // Only de-dupe on WhatsApp when one is actually provided — otherwise
      // multiple operators without a number would falsely collide.
      if (whatsApp) {
        const existingOperator = await this.operatorModel.findOne({
          whatsAppNumber: whatsApp,
          organizerId: organizerId,
        });
        if (existingOperator) {
          throw new BadRequestException(
            "Operator with this WhatsApp number already exists for this Organizer",
          );
        }
      }

      const normalizedEmail = createOperatorDto.email
        ? createOperatorDto.email.trim().toLowerCase()
        : undefined;

      const normalizedCompanyEmail = createOperatorDto.companyEmail
        ? createOperatorDto.companyEmail.trim().toLowerCase()
        : undefined;

      // Email is the login identity (Google Auth) — de-dupe on it.
      if (normalizedEmail) {
        const existingByEmail = await this.operatorModel.findOne({
          email: normalizedEmail,
          organizerId: organizerId,
        });
        if (existingByEmail) {
          throw new BadRequestException(
            "Operator with this email already exists for this Organizer",
          );
        }
      }

      const newOperator = new this.operatorModel({
        name: createOperatorDto.name,
        ...(whatsApp ? { whatsAppNumber: whatsApp } : {}),
        organizerId: organizerId,
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        ...(normalizedCompanyEmail
          ? { companyEmail: normalizedCompanyEmail }
          : {}),
        ...(createOperatorDto.accessTabs
          ? { accessTabs: createOperatorDto.accessTabs }
          : {}),
        ...(typeof createOperatorDto.allowEmails === "boolean"
          ? { allowEmails: createOperatorDto.allowEmails }
          : {}),
        ...(typeof createOperatorDto.referralEnabled === "boolean"
          ? { referralEnabled: createOperatorDto.referralEnabled }
          : {}),
      });

      await this.saveWithUniqueReferralCode(newOperator);

      return {
        message: "Operator created successfully for Organizer",
        data: newOperator,
      };
    } catch (error) {
      throw error;
    }
  }

  // Get all operators (admin use)
  async findAll() {
    try {
      const operators = await this.operatorModel.find();
      return { message: "Operators fetched successfully", data: operators };
    } catch (error) {
      throw error;
    }
  }

  // Get one operator by ID
  async findOne(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException("Invalid operator ID");
      }

      const operator = await this.operatorModel.findById(id);
      if (!operator) {
        throw new NotFoundException("Operator not found");
      }
      await this.ensureReferralCode(operator);

      return { message: "Operator found", data: operator };
    } catch (error) {
      throw error;
    }
  }

  // Get all operators by Organizer ID
  async findByOrganizerId(organizerId: string) {
    try {
      if (!Types.ObjectId.isValid(organizerId)) {
        throw new BadRequestException("Invalid organizer ID");
      }

      const operators = await this.operatorModel.find({ organizerId });
      const withCodes = await Promise.all(
        operators.map((op) => this.ensureReferralCode(op)),
      );
      return { message: "Operators fetched successfully", data: withCodes };
    } catch (error) {
      throw error;
    }
  }

  // Look up an operator by referral code, scoped to an organizer — used to
  // gate Scheduled Space visibility for visitors on the public event page.
  // Scoping to organizerId means codes only need to be globally unique, not
  // separately re-validated per event. Only matches operators with
  // referralEnabled on — an organizer switching it off for an operator
  // stops that code from working for visitors immediately, not just
  // hiding it from the operator list.
  async findByReferralCode(organizerId: string, code: string) {
    const normalized = (code || "").trim().toUpperCase();
    if (!normalized) return null;
    return this.operatorModel.findOne({
      organizerId,
      referralCode: normalized,
      referralEnabled: true,
    });
  }

  // Issue a fresh code for an operator (e.g. after a leak) — old code stops
  // working immediately since it's simply overwritten, not archived. Only
  // the operator's own organizer (identified from the caller's token, never
  // trusted from the request body — mirrors expenses.service.ts's
  // assertCanApprove) or an admin may trigger this, since it silently
  // invalidates whatever code that operator has printed/handed out.
  async regenerateReferralCode(id: string, actor: JwtActor) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid operator ID");
    }
    const operator = await this.operatorModel.findById(id);
    if (!operator) {
      throw new NotFoundException("Operator not found");
    }
    const actorId = String(actor?.userId || "");
    const isOwner = !!actorId && actorId === String(operator.organizerId);
    const isAdmin = !!actor?.roles?.includes("admin");
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        "You don't have permission to manage this operator.",
      );
    }
    await this.saveWithUniqueReferralCode(operator);
    return { message: "Referral code regenerated", data: operator };
  }

  // Update operator by ID
  async update(id: string, updateOperatorDto: UpdateOperatorDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException("Invalid operator ID");
      }

      const update: Record<string, any> = { ...updateOperatorDto };
      if (typeof update.email === "string") {
        update.email = update.email.trim().toLowerCase();
      }
      if (typeof update.companyEmail === "string") {
        update.companyEmail = update.companyEmail.trim().toLowerCase();
      }

      const operator = await this.operatorModel.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true, runValidators: true },
      );

      if (!operator) {
        throw new NotFoundException("Operator not found");
      }

      return { message: "Operator updated successfully", data: operator };
    } catch (error) {
      throw error;
    }
  }

  // Delete operator by ID
  async remove(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException("Invalid operator ID");
      }

      const operator = await this.operatorModel.findByIdAndDelete(id);
      if (!operator) {
        throw new NotFoundException("Operator not found");
      }

      return { message: "Operator deleted successfully" };
    } catch (error) {
      throw error;
    }
  }
}
