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
import { MailService } from "../roles/mail.service";

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    @InjectModel(Organizer.name) private organizerModel: Model<Organizer>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Event.name) private eventModel: Model<Event>,
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
      const totalUsers = await this.userModel.countDocuments();
      const totalEvents = await this.eventModel.countDocuments();
      const activeOrganizers = await this.organizerModel.countDocuments({
        approved: true,
      });

      const startOfMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      );
      const thisMonthEvents = await this.eventModel.countDocuments({
        createdAt: { $gte: startOfMonth },
      });

      const organizers = await this.organizerModel.find({ approved: false });
      const totalPending = organizers.length;

      const twentyFourHoursAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const recentStatusUpdatesOrganizers = await this.organizerModel
        .find({ updatedAt: { $gte: twentyFourHoursAgo } })
        .sort({ updatedAt: -1 })
        .lean();

      const recentAddedAdmins = await this.adminModel
        .find({ createdAt: { $gte: twentyFourHoursAgo } })
        .sort({ createdAt: -1 })
        .lean();

      const recentOrganizerApplications = await this.organizerModel
        .find({ approved: false, createdAt: { $gte: twentyFourHoursAgo } })
        .sort({ createdAt: -1 })
        .lean();

      const recentEvents = await this.eventModel
        .find({ createdAt: { $gte: twentyFourHoursAgo } })
        .sort({ createdAt: -1 })
        .lean();

      const recentUsers = await this.userModel
        .find({ createdAt: { $gte: twentyFourHoursAgo } })
        .sort({ createdAt: -1 })
        .lean();

      const recentActivity = [
        ...recentAddedAdmins.map((a) => ({
          id: a._id,
          type: "admin",
          name: a.name || a.email,
          action: "added as admin",
          time: a.createdAt,
          status: "Admin Added",
        })),
        ...recentStatusUpdatesOrganizers.map((o) => ({
          id: o._id,
          type: "organizer",
          name: o.name,
          action: o.approved
            ? "approved for organizer role"
            : "rejected for organizer role",
          time: o.updatedAt,
          status: o.approved ? "Approved" : "Rejected",
        })),
        ...recentEvents.map((e) => ({
          id: e._id,
          type: "event",
          name: e.title,
          action: "event created",
          time: e.createdAt,
          status: "Live",
        })),
        ...recentUsers.map((u) => ({
          id: u._id,
          type: "user",
          name: u.name,
          action: "registered",
          time: u.createdAt,
          status: "Active",
        })),
      ];

      recentActivity.sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );

      return {
        message: "Admin dashboard data fetched successfully",
        stats: {
          totalUsers,
          totalEvents,
          activeOrganizers,
          pendingApprovals: totalPending,
          thisMonthEvents,
        },
        pendingApprovals: {
          organizers,
        },
        recentActivity,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
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
