import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Agent, AgentDocument } from "./schemas/agent.schema";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { UpdateAgentDto } from "./dto/update-agent.dto";

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    @InjectModel("Event") private eventModel: Model<any>,
  ) {}

  private generateReferralCode(name: string): string {
    const prefix = name
      .replace(/[^a-zA-Z]/g, "")
      .substring(0, 4)
      .toUpperCase();
    const suffix = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}${suffix}`;
  }

  async create(dto: CreateAgentDto): Promise<Agent> {
    const existing = await this.agentModel.findOne({
      $or: [{ whatsAppNumber: dto.whatsAppNumber }, { email: dto.email }],
    });
    if (existing) {
      throw new BadRequestException(
        "Agent with this WhatsApp number or email already exists",
      );
    }

    let referralCode = dto.referralCode || this.generateReferralCode(dto.name);
    let attempts = 0;
    while (await this.agentModel.exists({ referralCode })) {
      referralCode = this.generateReferralCode(dto.name);
      attempts++;
      if (attempts > 10)
        throw new BadRequestException(
          "Failed to generate unique referral code",
        );
    }

    const agent = new this.agentModel({ ...dto, referralCode });
    return agent.save();
  }

  async findAll(): Promise<Agent[]> {
    return this.agentModel.find().sort({ createdAt: -1 }).lean();
  }

  async findActive(): Promise<Pick<Agent, "name" | "referralCode">[]> {
    return this.agentModel
      .find({ isActive: true })
      .select("name referralCode")
      .lean();
  }

  async findById(id: string): Promise<Agent> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid agent ID");
    }
    const agent = await this.agentModel.findById(id).lean();
    if (!agent) throw new NotFoundException("Agent not found");
    return agent;
  }

  async findByWhatsAppNumber(
    whatsAppNumber: string,
  ): Promise<AgentDocument | null> {
    const digits = whatsAppNumber.replace(/\D/g, "");
    return this.agentModel.findOne({
      whatsAppNumber: { $regex: digits + "$" },
      isActive: true,
    });
  }

  async findByReferralCode(code: string): Promise<Agent | null> {
    return this.agentModel
      .findOne({ referralCode: code, isActive: true })
      .lean();
  }

  async update(id: string, dto: UpdateAgentDto): Promise<Agent> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid agent ID");
    }
    const agent = await this.agentModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();
    if (!agent) throw new NotFoundException("Agent not found");
    return agent;
  }

  async remove(id: string): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid agent ID");
    }
    await this.agentModel.findByIdAndUpdate(id, { isActive: false });
    return { message: "Agent deactivated" };
  }

  async getAnalytics(agentId: string) {
    if (!Types.ObjectId.isValid(agentId)) {
      throw new BadRequestException("Invalid agent ID");
    }

    const agent = await this.agentModel.findById(agentId).lean();
    if (!agent) throw new NotFoundException("Agent not found");

    const organizers = await this.organizerModel
      .find({ provider: "Agent", providerId: agentId })
      .select("name organizationName email approved createdAt")
      .lean();

    const organizerIds = organizers.map((o: any) => o._id);

    const eventStats = await this.eventModel.aggregate([
      { $match: { organizer: { $in: organizerIds } } },
      {
        $group: {
          _id: "$organizer",
          totalEvents: { $sum: 1 },
        },
      },
    ]);

    const eventMap = new Map(
      eventStats.map((e: any) => [e._id.toString(), e.totalEvents]),
    );

    const organizersList = organizers.map((o: any) => {
      const eventsCount = eventMap.get(o._id.toString()) || 0;
      return {
        _id: o._id,
        name: o.name,
        organizationName: o.organizationName,
        email: o.email,
        approved: o.approved,
        registeredAt: o.createdAt,
        eventsCount,
      };
    });

    const totalEvents = organizersList.reduce(
      (sum, o) => sum + o.eventsCount,
      0,
    );

    return {
      agent: {
        name: agent.name,
        referralCode: agent.referralCode,
        salesTarget: agent.salesTarget,
      },
      referredCount: organizers.length,
      activeCount: organizers.filter((o: any) => o.approved).length,
      pendingCount: organizers.filter((o: any) => !o.approved).length,
      totalEvents,
      salesTargetProgress:
        agent.salesTarget > 0
          ? Math.round((organizers.length / agent.salesTarget) * 100)
          : 0,
      organizers: organizersList,
    };
  }
}
