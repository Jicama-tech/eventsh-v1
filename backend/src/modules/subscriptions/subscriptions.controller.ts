import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SubscriptionsService } from "./subscriptions.service";

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  // Organizer-facing — JWT user is the organizer.
  @Post("initiate")
  @UseGuards(JwtAuthGuard)
  initiate(@Body() body: { planId: string }, @Req() req: any) {
    const organizerId = req?.user?.userId || req?.user?.sub;
    return this.subs.initiate(organizerId, body);
  }

  @Post(":id/mark-paid")
  @UseGuards(JwtAuthGuard)
  markPaid(@Param("id") id: string, @Req() req: any) {
    const organizerId = req?.user?.userId || req?.user?.sub;
    return this.subs.markSubmitted(organizerId, id);
  }

  // Admin-facing — separated under /admin so guards/RBAC can diverge later.
  @Get("admin/pending")
  @UseGuards(JwtAuthGuard)
  pending() {
    return this.subs.listPending();
  }

  @Post("admin/:id/confirm")
  @UseGuards(JwtAuthGuard)
  confirm(@Param("id") id: string, @Req() req: any) {
    return this.subs.confirm(id, req?.user?.userId || req?.user?.sub);
  }

  @Post("admin/:id/reject")
  @UseGuards(JwtAuthGuard)
  reject(
    @Param("id") id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    return this.subs.reject(
      id,
      body?.reason,
      req?.user?.userId || req?.user?.sub,
    );
  }
}
