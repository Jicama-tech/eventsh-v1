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
import { BillingPaymentsService } from "./billing-payments.service";

@Controller("billing-payments")
export class BillingPaymentsController {
  constructor(private readonly svc: BillingPaymentsService) {}

  // ---- organizer-facing (JWT user is the organizer) ----
  @Get("me")
  @UseGuards(JwtAuthGuard)
  myBilling(@Req() req: any) {
    return this.svc.getMyBilling(req?.user?.userId || req?.user?.sub);
  }

  @Post("initiate")
  @UseGuards(JwtAuthGuard)
  initiate(@Body() body: { eventId: string }, @Req() req: any) {
    return this.svc.initiate(req?.user?.userId || req?.user?.sub, body);
  }

  @Post(":id/mark-paid")
  @UseGuards(JwtAuthGuard)
  markPaid(@Param("id") id: string, @Req() req: any) {
    return this.svc.markSubmitted(
      req?.user?.userId || req?.user?.sub,
      id,
    );
  }

  // ---- admin-facing ----
  @Get("admin/pending")
  @UseGuards(JwtAuthGuard)
  pending() {
    return this.svc.listPending();
  }

  @Post("admin/:id/confirm")
  @UseGuards(JwtAuthGuard)
  confirm(@Param("id") id: string, @Req() req: any) {
    return this.svc.confirm(id, req?.user?.userId || req?.user?.sub);
  }

  @Post("admin/:id/reject")
  @UseGuards(JwtAuthGuard)
  reject(
    @Param("id") id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    return this.svc.reject(
      id,
      body?.reason,
      req?.user?.userId || req?.user?.sub,
    );
  }
}
