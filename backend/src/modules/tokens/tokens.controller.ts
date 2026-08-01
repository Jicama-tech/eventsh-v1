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
import { TokensService } from "./tokens.service";

@Controller("tokens")
export class TokensController {
  constructor(private readonly svc: TokensService) {}

  // ---- organizer-facing (JWT user is the organizer) ----
  @Get("me")
  @UseGuards(JwtAuthGuard)
  myWallet(@Req() req: any) {
    return this.svc.getOrganizerWalletSummary(
      req?.user?.userId || req?.user?.sub,
    );
  }

  @Get("estimate/:eventId")
  @UseGuards(JwtAuthGuard)
  estimate(@Param("eventId") eventId: string) {
    return this.svc.estimatePublishTurnover(eventId);
  }

  @Post("topup")
  @UseGuards(JwtAuthGuard)
  topup(@Body() body: { tokensRequested: number }, @Req() req: any) {
    return this.svc.createTopUpRequest(
      req?.user?.userId || req?.user?.sub,
      body?.tokensRequested,
    );
  }

  @Post("topup/:id/mark-paid")
  @UseGuards(JwtAuthGuard)
  markPaid(@Param("id") id: string, @Req() req: any) {
    return this.svc.markTopUpSubmitted(
      req?.user?.userId || req?.user?.sub,
      id,
    );
  }

  // ---- admin-facing ----
  @Get("admin/pending")
  @UseGuards(JwtAuthGuard)
  pending() {
    return this.svc.listPendingTopUps();
  }

  @Post("admin/:id/confirm")
  @UseGuards(JwtAuthGuard)
  confirm(@Param("id") id: string, @Req() req: any) {
    return this.svc.confirmTopUp(id, req?.user?.userId || req?.user?.sub);
  }

  @Post("admin/:id/reject")
  @UseGuards(JwtAuthGuard)
  reject(
    @Param("id") id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    return this.svc.rejectTopUp(
      id,
      body?.reason,
      req?.user?.userId || req?.user?.sub,
    );
  }

  @Get("admin/organizer/:organizerId")
  @UseGuards(JwtAuthGuard)
  organizerWallet(@Param("organizerId") organizerId: string) {
    return this.svc.getOrganizerWalletSummary(organizerId);
  }

  @Post("admin/organizer/:organizerId/adjust")
  @UseGuards(JwtAuthGuard)
  adjust(
    @Param("organizerId") organizerId: string,
    @Body() body: { delta: number; note?: string },
    @Req() req: any,
  ) {
    return this.svc.adminAdjustWallet(
      organizerId,
      body?.delta,
      body?.note || "",
      req?.user?.userId || req?.user?.sub,
    );
  }
}
