import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { AdminService } from "./admin.service";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { LocalDto } from "../auth/dto/local.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

function paymentConfigQrStorage() {
  return diskStorage({
    destination: "./uploads/paymentConfig",
    filename: (_req, file, cb) => {
      const ts = Date.now();
      const ext = extname(file.originalname || "") || ".png";
      cb(null, `platform-upi-${ts}${ext}`);
    },
  });
}
// import { UpdateAdminDto } from './dto/update-admin.dto';

@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post("create-admin")
  @UseGuards(JwtAuthGuard)
  async create(@Body() createAdminDto: CreateAdminDto) {
    return this.adminService.create(createAdminDto);
  }

  @Post("login-admin")
  login(@Body() dto: LoginDto) {
    try {
      return this.adminService.login(dto);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  @Get("dashboard-stats")
  @UseGuards(JwtAuthGuard)
  pendingApprovals() {
    try {
      return this.adminService.getDashboardData();
    } catch (error) {
      throw error;
    }
  }

  @Get("users-overview")
  @UseGuards(JwtAuthGuard)
  usersOverview() {
    return this.adminService.getUsersOverview();
  }

  @Get("organizers-overview")
  @UseGuards(JwtAuthGuard)
  organizersOverview() {
    return this.adminService.getOrganizersOverview();
  }

  // ===========================================================================
  //  Super-admin billing — rate configuration + per-organizer aggregation.
  // ===========================================================================
  @Get("billing-rates")
  @UseGuards(JwtAuthGuard)
  getBillingRates() {
    return this.adminService.getBillingRates();
  }

  @Patch("billing-rates")
  @UseGuards(JwtAuthGuard)
  updateBillingRates(
    @Body()
    body: {
      stallRate?: number;
      roundTableRate?: number;
      chairRate?: number;
      speakerRate?: number;
      currency?: string;
    },
    @Req() req: any,
  ) {
    return this.adminService.updateBillingRates(
      body,
      req?.user?.userId || req?.user?.sub,
    );
  }

  @Get("payment-config")
  @UseGuards(JwtAuthGuard)
  getPaymentConfig() {
    return this.adminService.getPaymentConfig();
  }

  @Patch("payment-config")
  @UseGuards(JwtAuthGuard)
  updatePaymentConfig(
    @Body()
    body: {
      companyName?: string;
      companyUEN?: string;
    },
    @Req() req: any,
  ) {
    return this.adminService.updatePaymentConfig(
      body,
      req?.user?.userId || req?.user?.sub,
    );
  }

  @Post("payment-config/upi-qr")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", { storage: paymentConfigQrStorage() }),
  )
  uploadPlatformUPIQr(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.adminService.uploadPlatformUPIQr(
      file,
      req?.user?.userId || req?.user?.sub,
    );
  }

  @Get("organizers/:id/billing")
  @UseGuards(JwtAuthGuard)
  organizerBilling(@Param("id") id: string) {
    return this.adminService.getOrganizerBilling(id);
  }

  @Get("organizers/:id/events/:eventId/breakdown")
  @UseGuards(JwtAuthGuard)
  organizerEventBreakdown(
    @Param("id") id: string,
    @Param("eventId") eventId: string,
  ) {
    return this.adminService.getEventBookingBreakdown(id, eventId);
  }

  @Post("organizers/:id/payments")
  @UseGuards(JwtAuthGuard)
  recordOrganizerPayment(
    @Param("id") id: string,
    @Body() body: { amount: number; paidOn?: string; note?: string },
    @Req() req: any,
  ) {
    return this.adminService.recordOrganizerPayment(
      id,
      body,
      req?.user?.userId || req?.user?.sub,
    );
  }

  @Patch("approve/:id")
  @UseGuards(JwtAuthGuard)
  approveApplicant(
    @Param("id") id: string,
    @Body("role") role: "Organizer",
  ) {
    try {
      return this.adminService.approveApplicant(id, role);
    } catch (error) {
      throw error;
    }
  }

  // Reject Applicant
  @Patch("reject/:id")
  @UseGuards(JwtAuthGuard)
  rejectApplicant(
    @Param("id") id: string,
    @Body("role") role: "Organizer",
  ) {
    try {
      return this.adminService.rejectApplicant(id, role);
    } catch (error) {
      throw error;
    }
  }

  @Get()
  findAll() {
    return this.adminService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.adminService.findOne(id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateAdminDto: UpdateAdminDto) {
  //   return this.adminService.update(+id, updateAdminDto);
  // }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  remove(@Param("id") id: string) {
    return this.adminService.remove(id);
  }
}
