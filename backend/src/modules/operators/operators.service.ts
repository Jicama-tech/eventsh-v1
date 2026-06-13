import {
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

@Injectable()
export class OperatorsService {
  constructor(
    @InjectModel(Operator.name) private operatorModel: Model<OperatorDocument>,
    @InjectModel(Organizer.name)
    private organizerModel: Model<OrganizerDocument>,
  ) {}

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
      });

      const savedOperator = await newOperator.save();

      return {
        message: "Operator created successfully for Organizer",
        data: savedOperator,
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
      return { message: "Operators fetched successfully", data: operators };
    } catch (error) {
      throw error;
    }
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
