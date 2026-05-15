import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FeedbackService } from "./feedback.service";
import {
  SubmitTokenFeedbackDto,
  SubmitVisitorFeedbackDto,
} from "./dto/submit-feedback.dto";

@Controller()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // Resolve a feedback token into the details the form needs to render.
  // Public — the token IS the auth.
  @Get("feedback/eligibility")
  async eligibility(@Query("token") token: string) {
    return this.feedbackService.getEligibility(token);
  }

  @Post("events/:eventId/feedback/exhibitor")
  async submitExhibitor(
    @Param("eventId") eventId: string,
    @Body() dto: SubmitTokenFeedbackDto,
  ) {
    return this.feedbackService.submitTokenFeedback("exhibitor", eventId, dto);
  }

  @Post("events/:eventId/feedback/speaker")
  async submitSpeaker(
    @Param("eventId") eventId: string,
    @Body() dto: SubmitTokenFeedbackDto,
  ) {
    return this.feedbackService.submitTokenFeedback("speaker", eventId, dto);
  }

  @Post("events/:eventId/feedback/round-table")
  async submitRoundTable(
    @Param("eventId") eventId: string,
    @Body() dto: SubmitTokenFeedbackDto,
  ) {
    return this.feedbackService.submitTokenFeedback(
      "round_table",
      eventId,
      dto,
    );
  }

  @Post("events/:eventId/feedback/visitor")
  async submitVisitor(
    @Param("eventId") eventId: string,
    @Body() dto: SubmitVisitorFeedbackDto,
  ) {
    return this.feedbackService.submitVisitorFeedback(eventId, dto);
  }

  // Public per-event stats for the "By the numbers" section on EventFront.
  // Reveals counts + average ratings but not individual comments or emails.
  @Get("events/:eventId/stats")
  async statsForEvent(@Param("eventId") eventId: string) {
    return this.feedbackService.statsForEvent(eventId);
  }

  // Organizer-only views.
  @Get("events/:eventId/feedback")
  @UseGuards(AuthGuard("jwt"))
  async listForEvent(@Param("eventId") eventId: string) {
    return this.feedbackService.listForEvent(eventId);
  }

  @Patch("feedback/:id/refund-status")
  @UseGuards(AuthGuard("jwt"))
  async setRefund(
    @Param("id") id: string,
    @Body() body: { status: "pending" | "refunded" | "not_applicable" },
  ) {
    return this.feedbackService.setRefundStatus(id, body.status);
  }
}
