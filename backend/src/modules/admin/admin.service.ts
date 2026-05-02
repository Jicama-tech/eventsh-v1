import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { InjectModel } from "@nestjs/mongoose/dist";
import { Admin } from "./entities/admin.entity";
import { Model } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { LoginDto } from "./dto/login.dto";
import { Organizer } from "../organizers/schemas/organizer.schema";
import { User } from "../users/schemas/user.schema";
import { Event } from "../events/schemas/event.schema";
import { Ticket } from "../tickets/entities/ticket.entity";
import { Plan } from "../plans/entities/plan.entity";
import { Agent } from "../agents/schemas/agent.schema";
import { MailService } from "../roles/mail.service";

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    @InjectModel(Organizer.name) private organizerModel: Model<Organizer>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Event.name) private eventModel: Model<Event>,
    @InjectModel(Ticket.name) private ticketModel: Model<Ticket>,
    @InjectModel(Plan.name) private planModel: Model<Plan>,
    @InjectModel(Agent.name) private agentModel: Model<Agent>,
    @InjectModel("Operator") private operatorModel: Model<any>,
    @InjectModel("Vendor") private vendorModel: Model<any>,
    @InjectModel("SpeakerRequest") private speakerRequestModel: Model<any>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService
  ) {}

  async create(createAdminDto: CreateAdminDto) {
    try {
      const existingAdmin = await this.adminModel.findOne({
        email: createAdminDto.email,
      });
      if (existingAdmin) {
        throw new ConflictException("Admin Already Exists");
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(
        createAdminDto.password,
        saltRounds
      );

      let creatorName = "System";

      const adminToCreate = {
        ...createAdminDto,
        password: hashedPassword,
      };

      const adminData = await this.adminModel.create(adminToCreate);

      await this.mailService.sendNewAdminCredentials({
        name: createAdminDto.name,
        email: createAdminDto.email,
        password: createAdminDto.password,
        createdBy: creatorName,
      });

      return {
        message: "Admin Created Successfully",
        adminData: { id: adminData._id, email: adminData.email },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async approveApplicant(id: string, role: "Organizer") {
    let applicant: any;
    if (role === "Organizer") {
      applicant = await this.organizerModel.findById(id);
    }
    if (!applicant) throw new NotFoundException(`${role} not found`);

    applicant.approved = true;
    applicant.rejected = false;
    applicant.statusUpdatedAt = new Date();
    await applicant.save();

    await this.mailService.sendStatusUpdate({
      name: applicant.name,
      email: applicant.email,
      role,
      status: "Approved",
    });

    return { message: `${role} approved successfully` };
  }

  async rejectApplicant(id: string, role: "Organizer") {
    let applicant: any;
    if (role === "Organizer") {
      applicant = await this.organizerModel.findById(id);
    }
    if (!applicant) throw new NotFoundException(`${role} not found`);

    applicant.approved = false;
    applicant.rejected = true;
    applicant.statusUpdatedAt = new Date();
    await applicant.save();

    await this.mailService.sendStatusUpdate({
      name: applicant.name,
      email: applicant.email,
      role,
      status: "Rejected",
    });

    return { message: `${role} rejected successfully` };
  }

  async getDashboardData() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        totalEvents,
        thisMonthEvents,
        totalOrganizers,
        activeOrganizers,
        thisMonthOrganizers,
        pendingOrganizers,
        totalAgents,
        activeAgents,
        totalPlans,
        activePlans,
        totalTickets,
        activeSubscriptions,
        revenueAgg,
      ] = await Promise.all([
        this.userModel.countDocuments(),
        this.eventModel.countDocuments(),
        this.eventModel.countDocuments({ createdAt: { $gte: startOfMonth } }),
        this.organizerModel.countDocuments(),
        this.organizerModel.countDocuments({ approved: true }),
        this.organizerModel.countDocuments({
          createdAt: { $gte: startOfMonth },
        }),
        this.organizerModel.find({ approved: false, rejected: false }).lean(),
        this.agentModel.countDocuments(),
        this.agentModel.countDocuments({ isActive: true }),
        this.planModel.countDocuments(),
        this.planModel.countDocuments({ isActive: true }),
        this.ticketModel.countDocuments(),
        this.organizerModel.countDocuments({
          subscribed: true,
          planExpiryDate: { $gt: now },
        }),
        this.ticketModel.aggregate([
          { $match: { paymentConfirmed: true } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
      ]);

      const totalRevenue = revenueAgg[0]?.total || 0;

      const [
        recentStatusUpdatesOrganizers,
        recentAddedAdmins,
        recentEvents,
        recentUsers,
        recentTickets,
        recentAgents,
      ] = await Promise.all([
        this.organizerModel
          .find({ updatedAt: { $gte: sevenDaysAgo } })
          .sort({ updatedAt: -1 })
          .limit(20)
          .lean(),
        this.adminModel
          .find({ createdAt: { $gte: sevenDaysAgo } })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        this.eventModel
          .find({ createdAt: { $gte: sevenDaysAgo } })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        this.userModel
          .find({ createdAt: { $gte: sevenDaysAgo } })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        this.ticketModel
          .find({ purchaseDate: { $gte: sevenDaysAgo } })
          .sort({ purchaseDate: -1 })
          .limit(20)
          .lean(),
        this.agentModel
          .find({ createdAt: { $gte: sevenDaysAgo } })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
      ]);

      const recentActivity = [
        ...recentAddedAdmins.map((a: any) => ({
          id: a._id,
          type: "admin",
          name: a.name || a.email,
          action: "added as admin",
          time: a.createdAt,
          status: "added",
        })),
        ...recentStatusUpdatesOrganizers.map((o: any) => ({
          id: o._id,
          type: "organizer",
          name: o.name,
          action: o.approved
            ? "organizer activated"
            : o.rejected
              ? "organizer rejected"
              : "organizer pending",
          time: o.updatedAt,
          status: o.approved ? "approved" : o.rejected ? "rejected" : "pending",
        })),
        ...recentEvents.map((e: any) => ({
          id: e._id,
          type: "event",
          name: e.title || "Untitled Event",
          action: "event created",
          time: e.createdAt,
          status: "live",
        })),
        ...recentUsers.map((u: any) => ({
          id: u._id,
          type: "user",
          name: u.name || u.email,
          action: "user registered",
          time: u.createdAt,
          status: "active",
        })),
        ...recentTickets.map((t: any) => ({
          id: t._id,
          type: "ticket",
          name: t.customerName || t.eventTitle || "Ticket",
          action: `ticket purchased — ${t.eventTitle}`,
          time: t.purchaseDate,
          status: t.paymentConfirmed ? "approved" : "pending",
        })),
        ...recentAgents.map((a: any) => ({
          id: a._id,
          type: "agent",
          name: a.name,
          action: "agent created",
          time: a.createdAt,
          status: "active",
        })),
      ];

      recentActivity.sort(
        (a: any, b: any) =>
          new Date(b.time).getTime() - new Date(a.time).getTime()
      );

      return {
        message: "Admin dashboard data fetched successfully",
        stats: {
          totalUsers,
          totalEvents,
          thisMonthEvents,
          totalOrganizers,
          activeOrganizers,
          thisMonthOrganizers,
          pendingApprovals: pendingOrganizers.length,
          totalAgents,
          activeAgents,
          totalPlans,
          activePlans,
          totalTickets,
          totalRevenue,
          activeSubscriptions,
        },
        pendingApprovals: {
          organizers: pendingOrganizers,
        },
        recentActivity: recentActivity.slice(0, 30),
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getOrganizersOverview() {
    const [organizers, eventsAgg, ticketsAgg, plans, agents] =
      await Promise.all([
        this.organizerModel.find().lean(),
        this.eventModel.aggregate([
          { $group: { _id: "$organizer", count: { $sum: 1 } } },
        ]),
        this.ticketModel.aggregate([
          {
            $group: {
              _id: "$organizerId",
              count: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: ["$paymentConfirmed", "$totalAmount", 0],
                },
              },
            },
          },
        ]),
        this.planModel.find().select("planName").lean(),
        this.agentModel.find().select("name referralCode").lean(),
      ]);

    const eventsMap = new Map<string, number>(
      eventsAgg.map((e: any) => [String(e._id), e.count]),
    );
    const ticketsMap = new Map<
      string,
      { count: number; revenue: number }
    >(
      ticketsAgg.map((t: any) => [
        String(t._id),
        { count: t.count, revenue: t.revenue || 0 },
      ]),
    );
    const planMap = new Map<string, string>(
      plans.map((p: any) => [String(p._id), p.planName]),
    );
    const agentMap = new Map<
      string,
      { name: string; referralCode: string }
    >(
      agents.map((a: any) => [
        String(a._id),
        { name: a.name, referralCode: a.referralCode },
      ]),
    );

    const now = Date.now();
    const list = (organizers as any[]).map((o: any) => {
      const id = String(o._id);
      const t = ticketsMap.get(id) || { count: 0, revenue: 0 };
      const planName = o.planId ? planMap.get(String(o.planId)) : null;
      const agent =
        o.provider === "Agent" && o.providerId
          ? agentMap.get(String(o.providerId)) || null
          : null;
      const planActive =
        !!o.subscribed &&
        !!o.planExpiryDate &&
        new Date(o.planExpiryDate).getTime() > now;
      const status = o.approved
        ? "active"
        : o.rejected
          ? "rejected"
          : "pending";
      return {
        _id: id,
        name: o.name,
        organizationName: o.organizationName,
        email: o.email,
        businessEmail: o.businessEmail,
        phone: o.phone,
        whatsAppNumber: o.whatsAppNumber,
        country: o.country,
        address: o.address,
        bio: o.bio,
        approved: !!o.approved,
        rejected: !!o.rejected,
        status,
        subscribed: !!o.subscribed,
        planId: o.planId ? String(o.planId) : null,
        planName: planName || null,
        planStartDate: o.planStartDate || null,
        planExpiryDate: o.planExpiryDate || null,
        planActive,
        pricePaid: o.pricePaid || null,
        commissionPercentage: o.commissionPercentage,
        provider: o.provider || "self",
        providerId: o.providerId || null,
        referredByAgent: agent,
        eventsCreated: eventsMap.get(id) || 0,
        ticketsSold: t.count,
        revenue: t.revenue,
        bankTransferEnabled: !!o.bankTransferEnabled,
        razorpayStatus: o.razorpay?.status || null,
        receiptType: o.receiptType,
        operationsPausedFromDate: o.operationsPausedFromDate || null,
        operationsPausedToDate: o.operationsPausedToDate || null,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      };
    });

    list.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );

    const summary = {
      total: list.length,
      active: list.filter((o) => o.status === "active").length,
      pending: list.filter((o) => o.status === "pending").length,
      rejected: list.filter((o) => o.status === "rejected").length,
      subscribed: list.filter((o) => o.planActive).length,
      referred: list.filter((o) => o.provider === "Agent").length,
      totalRevenue: list.reduce((s, o) => s + (o.revenue || 0), 0),
      totalEvents: list.reduce((s, o) => s + (o.eventsCreated || 0), 0),
      totalTickets: list.reduce((s, o) => s + (o.ticketsSold || 0), 0),
    };

    return { summary, organizers: list };
  }

  async getUsersOverview() {
    const [
      organizers,
      users,
      operators,
      vendors,
      speakers,
      tickets,
      agents,
      eventsByOrg,
    ] = await Promise.all([
      this.organizerModel
        .find()
        .select(
          "name email organizationName phone whatsAppNumber country approved rejected createdAt updatedAt subscribed planExpiryDate provider providerId",
        )
        .lean(),
      this.userModel
        .find()
        .select("name email firstName lastName whatsAppNumber roles createdAt")
        .lean(),
      this.operatorModel
        .find()
        .select("name email whatsAppNumber organizerId createdAt")
        .lean(),
      this.vendorModel
        .find()
        .select(
          "name email whatsAppNumber whatsappNumber phoneNumber businessName shopName approved isActive createdAt",
        )
        .lean(),
      this.speakerRequestModel
        .find()
        .select(
          "name email phone organization status eventId organizerId createdAt",
        )
        .lean(),
      this.ticketModel
        .find()
        .select(
          "customerName customerEmail customerWhatsapp totalAmount paymentConfirmed eventTitle organizerId purchaseDate",
        )
        .lean(),
      this.agentModel
        .find()
        .select("name email whatsAppNumber referralCode salesTarget isActive createdAt")
        .lean(),
      this.eventModel.aggregate([
        { $group: { _id: "$organizer", count: { $sum: 1 } } },
      ]),
    ]);

    const eventsCountByOrganizer = new Map<string, number>(
      eventsByOrg.map((e: any) => [String(e._id), e.count]),
    );

    type Entry = {
      key: string;
      name: string;
      email: string;
      phone: string;
      whatsAppNumber: string;
      country?: string;
      organizationName?: string;
      roles: Set<string>;
      eventsCreated: number;
      ticketsPurchased: number;
      ticketRevenue: number;
      stallsRegistered: number;
      speakerRequests: number;
      operatorOf: string[];
      referralCode?: string;
      referredOrganizers: number;
      subscribed: boolean;
      planExpiryDate?: Date | null;
      approvedOrganizer?: boolean | null;
      firstSeen: Date;
      lastSeen: Date;
      sources: { type: string; id: string }[];
    };

    const merge = (entry: Entry, candidate: Partial<Entry>) => {
      if (!entry.name && candidate.name) entry.name = candidate.name as string;
      if (!entry.phone && candidate.phone)
        entry.phone = candidate.phone as string;
      if (!entry.whatsAppNumber && candidate.whatsAppNumber)
        entry.whatsAppNumber = candidate.whatsAppNumber as string;
      if (!entry.country && candidate.country)
        entry.country = candidate.country as string;
      if (!entry.organizationName && candidate.organizationName)
        entry.organizationName = candidate.organizationName as string;
      if (!entry.referralCode && candidate.referralCode)
        entry.referralCode = candidate.referralCode as string;
      if (
        candidate.firstSeen &&
        (!entry.firstSeen || candidate.firstSeen < entry.firstSeen)
      )
        entry.firstSeen = candidate.firstSeen as Date;
      if (
        candidate.lastSeen &&
        (!entry.lastSeen || candidate.lastSeen > entry.lastSeen)
      )
        entry.lastSeen = candidate.lastSeen as Date;
      if (candidate.subscribed) entry.subscribed = true;
      if (candidate.planExpiryDate)
        entry.planExpiryDate = candidate.planExpiryDate as Date;
      if (typeof candidate.approvedOrganizer === "boolean")
        entry.approvedOrganizer = candidate.approvedOrganizer;
    };

    const map = new Map<string, Entry>();
    const keyFor = (email?: string, whatsApp?: string) => {
      const e = (email || "").toLowerCase().trim();
      if (e) return `e:${e}`;
      const w = (whatsApp || "").replace(/\D/g, "");
      if (w) return `w:${w}`;
      return null;
    };
    const upsert = (
      key: string | null,
      base: Partial<Entry>,
      role: string,
      source: { type: string; id: string },
    ) => {
      if (!key) return null;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          key,
          name: base.name || "",
          email: base.email || "",
          phone: base.phone || "",
          whatsAppNumber: base.whatsAppNumber || "",
          country: base.country,
          organizationName: base.organizationName,
          roles: new Set<string>(),
          eventsCreated: 0,
          ticketsPurchased: 0,
          ticketRevenue: 0,
          stallsRegistered: 0,
          speakerRequests: 0,
          operatorOf: [],
          referralCode: base.referralCode,
          referredOrganizers: 0,
          subscribed: !!base.subscribed,
          planExpiryDate: base.planExpiryDate ?? null,
          approvedOrganizer: base.approvedOrganizer ?? null,
          firstSeen: base.firstSeen as Date,
          lastSeen: (base.lastSeen as Date) || (base.firstSeen as Date),
          sources: [],
        };
        map.set(key, entry);
      } else {
        merge(entry, base);
      }
      entry.roles.add(role);
      entry.sources.push(source);
      return entry;
    };

    // Referral counts per agent
    const referralCounts = new Map<string, number>();
    for (const o of organizers) {
      if (o.provider === "Agent" && o.providerId) {
        const id = String(o.providerId);
        referralCounts.set(id, (referralCounts.get(id) || 0) + 1);
      }
    }

    // Organizers
    for (const o of organizers as any[]) {
      const key = keyFor(o.email, o.whatsAppNumber);
      const entry = upsert(
        key,
        {
          name: o.name,
          email: (o.email || "").toLowerCase().trim(),
          phone: o.phone || "",
          whatsAppNumber: o.whatsAppNumber || "",
          country: o.country,
          organizationName: o.organizationName,
          subscribed: !!o.subscribed,
          planExpiryDate: o.planExpiryDate || null,
          approvedOrganizer: !!o.approved,
          firstSeen: o.createdAt,
          lastSeen: o.updatedAt || o.createdAt,
        },
        "Organizer",
        { type: "organizer", id: String(o._id) },
      );
      if (entry)
        entry.eventsCreated += eventsCountByOrganizer.get(String(o._id)) || 0;
    }

    // Users (visitors)
    for (const u of users as any[]) {
      const key = keyFor(u.email, u.whatsAppNumber);
      const composedName =
        u.name ||
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
        u.email ||
        "";
      const role =
        Array.isArray(u.roles) && u.roles.includes("admin")
          ? "Admin"
          : "Visitor";
      upsert(
        key,
        {
          name: composedName,
          email: (u.email || "").toLowerCase().trim(),
          whatsAppNumber: u.whatsAppNumber || "",
          firstSeen: u.createdAt,
          lastSeen: u.createdAt,
        },
        role,
        { type: "user", id: String(u._id) },
      );
    }

    // Operators
    for (const op of operators as any[]) {
      const key = keyFor(op.email, op.whatsAppNumber);
      const entry = upsert(
        key,
        {
          name: op.name,
          email: (op.email || "").toLowerCase().trim(),
          whatsAppNumber: op.whatsAppNumber || "",
          firstSeen: op.createdAt,
          lastSeen: op.createdAt,
        },
        "Operator",
        { type: "operator", id: String(op._id) },
      );
      if (entry && op.organizerId)
        entry.operatorOf.push(String(op.organizerId));
    }

    // Vendors / Exhibitors
    for (const v of vendors as any[]) {
      const wa = v.whatsAppNumber || v.whatsappNumber || v.phoneNumber || "";
      const key = keyFor(v.email, wa);
      const entry = upsert(
        key,
        {
          name: v.name,
          email: (v.email || "").toLowerCase().trim(),
          whatsAppNumber: wa,
          organizationName: v.businessName || v.shopName,
          firstSeen: v.createdAt,
          lastSeen: v.createdAt,
        },
        "Exhibitor",
        { type: "vendor", id: String(v._id) },
      );
      if (entry) entry.stallsRegistered += 1;
    }

    // Speakers
    for (const s of speakers as any[]) {
      const key = keyFor(s.email, s.phone);
      const entry = upsert(
        key,
        {
          name: s.name,
          email: (s.email || "").toLowerCase().trim(),
          phone: s.phone || "",
          organizationName: s.organization,
          firstSeen: s.createdAt,
          lastSeen: s.createdAt,
        },
        "Speaker",
        { type: "speaker", id: String(s._id) },
      );
      if (entry) entry.speakerRequests += 1;
    }

    // Ticket buyers
    for (const t of tickets as any[]) {
      const key = keyFor(t.customerEmail, t.customerWhatsapp);
      const entry = upsert(
        key,
        {
          name: t.customerName || t.customerEmail || "Ticket Buyer",
          email: (t.customerEmail || "").toLowerCase().trim(),
          whatsAppNumber: t.customerWhatsapp || "",
          firstSeen: t.purchaseDate,
          lastSeen: t.purchaseDate,
        },
        "Ticket Buyer",
        { type: "ticket", id: String(t._id) },
      );
      if (entry) {
        entry.ticketsPurchased += 1;
        if (t.paymentConfirmed && typeof t.totalAmount === "number") {
          entry.ticketRevenue += t.totalAmount;
        }
      }
    }

    // Agents
    for (const a of agents as any[]) {
      const key = keyFor(a.email, a.whatsAppNumber);
      const entry = upsert(
        key,
        {
          name: a.name,
          email: (a.email || "").toLowerCase().trim(),
          whatsAppNumber: a.whatsAppNumber || "",
          referralCode: a.referralCode,
          firstSeen: a.createdAt,
          lastSeen: a.createdAt,
        },
        "Agent",
        { type: "agent", id: String(a._id) },
      );
      if (entry) {
        entry.referredOrganizers = referralCounts.get(String(a._id)) || 0;
      }
    }

    const list = Array.from(map.values()).map((e) => ({
      ...e,
      roles: Array.from(e.roles),
    }));

    list.sort(
      (a, b) =>
        new Date(b.lastSeen || 0).getTime() -
        new Date(a.lastSeen || 0).getTime(),
    );

    const summary = {
      totalUnique: list.length,
      organizers: list.filter((u) => u.roles.includes("Organizer")).length,
      visitors: list.filter((u) => u.roles.includes("Visitor")).length,
      exhibitors: list.filter((u) => u.roles.includes("Exhibitor")).length,
      speakers: list.filter((u) => u.roles.includes("Speaker")).length,
      ticketBuyers: list.filter((u) => u.roles.includes("Ticket Buyer")).length,
      operators: list.filter((u) => u.roles.includes("Operator")).length,
      agents: list.filter((u) => u.roles.includes("Agent")).length,
      multiRole: list.filter((u) => u.roles.length > 1).length,
    };

    return { summary, users: list };
  }

  async login(dto: LoginDto) {
    try {
      const admin = await this.adminModel.findOne({
        email: dto.email,
      });

      if (!admin) {
        throw new NotFoundException("Admin Not Found");
      }

      const isValidPassword = await bcrypt.compare(
        dto.password,
        admin.password
      );

      if (!isValidPassword) {
        throw new UnauthorizedException("Invalid Password");
      }

      const payload = {
        sub: admin._id,
        email: admin.email,
        name: admin.name,
        roles: admin.role || [],
      };
      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "1h",
      });

      return { message: "login Successfull", data: token };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  findAll() {
    return `This action returns all admin`;
  }

  async findOne(id: string) {
    const admin = await this.adminModel.findById(id).select("-password").exec();
    if (!admin) {
      throw new NotFoundException(`Admin with ID ${id} not found`);
    }
    return admin;
  }

  async remove(id: string) {
    const deleted = await this.adminModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`Admin with ID ${id} not found`);
    }
    return { message: "Admin deleted successfully" };
  }
}
