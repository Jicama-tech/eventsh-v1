import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AppFeedbackService } from "./app-feedback.service";
import {
  RequestOtpDto,
  SubmitAppFeedbackDto,
  UpdateAppFeedbackDto,
} from "./dto/app-feedback.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("app-feedback")
export class AppFeedbackController {
  constructor(private readonly service: AppFeedbackService) {}

  // ─── Public submission flow ────────────────────────────────────────────
  @Post("request-otp")
  async requestOtp(@Body() body: RequestOtpDto) {
    return this.service.requestOtp(body.email);
  }

  @Post()
  async submit(@Body() body: SubmitAppFeedbackDto) {
    return this.service.submit(body);
  }

  // ─── Public read endpoints — power the landing page ────────────────────
  @Get("featured")
  async getFeatured() {
    return this.service.getFeatured();
  }

  @Get("stats")
  async getStats() {
    return this.service.getStats();
  }

  // ─── Super-admin curation. JwtAuthGuard matches the existing admin
  // module's pattern; only admin/super-admin JWTs reach the dashboard. ───
  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @Query("filter")
    filter: "all" | "pending" | "featured" | "hidden" = "pending",
  ) {
    return this.service.listAll(filter);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  async update(
    @Param("id") id: string,
    @Body() patch: UpdateAppFeedbackDto,
    @Req() req: any,
  ) {
    return this.service.update(id, patch, req?.user?.sub);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
