import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import {
  ModuleType,
  Plan,
  PlanDocument,
} from "../plans/entities/plan.entity";

@Injectable()
export class PlansService {
  constructor(@InjectModel(Plan.name) private planModel: Model<PlanDocument>) {}

  async create(createPlanDto: CreatePlanDto): Promise<Plan> {
    try {
      // Lock to organizer plans only — eventsh isolation guarantee.
      const payload = {
        ...createPlanDto,
        moduleType: ModuleType.ORGANIZER,
      };
      const createdPlan = new this.planModel(payload);
      return await createdPlan.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException("Plan with this name already exists");
      }
      throw error;
    }
  }

  async findAll(): Promise<Plan[]> {
    return await this.planModel
      .find({ moduleType: ModuleType.ORGANIZER })
      .exec();
  }

  async findAllActive(): Promise<Plan[]> {
    return await this.planModel
      .find({ moduleType: ModuleType.ORGANIZER, isActive: true })
      .exec();
  }

  async findByModule(_moduleType: string): Promise<Plan[]> {
    // Eventsh only serves Organizer plans regardless of caller.
    return await this.planModel
      .find({ moduleType: ModuleType.ORGANIZER, isActive: true })
      .exec();
  }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.planModel.findById(id).exec();
    if (!plan || plan.moduleType !== ModuleType.ORGANIZER) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
    return plan;
  }

  async update(id: string, updatePlanDto: UpdatePlanDto): Promise<Plan> {
    const safeUpdate = { ...updatePlanDto, moduleType: ModuleType.ORGANIZER };
    const updatedPlan = await this.planModel
      .findByIdAndUpdate(id, safeUpdate, { new: true })
      .exec();
    if (!updatedPlan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
    return updatedPlan;
  }

  async remove(id: string): Promise<void> {
    const result = await this.planModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
  }

  async toggleActive(id: string): Promise<Plan> {
    const plan = await this.findOne(id);
    return await this.planModel
      .findByIdAndUpdate(id, { isActive: !plan.isActive }, { new: true })
      .exec();
  }

  async setDefault(id: string): Promise<Plan> {
    await this.planModel.updateMany(
      { moduleType: ModuleType.ORGANIZER },
      { isDefault: false },
    );
    const plan = await this.planModel
      .findByIdAndUpdate(id, { isDefault: true }, { new: true })
      .exec();
    if (!plan) throw new NotFoundException(`Plan with ID ${id} not found`);
    return plan;
  }

  async findDefault(): Promise<Plan | null> {
    return this.planModel
      .findOne({
        moduleType: ModuleType.ORGANIZER,
        isDefault: true,
        isActive: true,
      })
      .exec();
  }
}
