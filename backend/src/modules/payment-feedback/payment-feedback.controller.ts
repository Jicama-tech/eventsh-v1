import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { PaymentFeedbackService } from "./payment-feedback.service";
import { CreatePaymentFeedbackDto } from "./dto/payment-feedback.dto";

@Controller("payment-feedback")
export class PaymentFeedbackController {
  constructor(private readonly service: PaymentFeedbackService) {}

  // Public — submitted by the payer right after any payment completes.
  @Post()
  create(@Body() dto: CreatePaymentFeedbackDto) {
    return this.service.create(dto);
  }

  // Organizer's own feedback (their dashboard feedback section).
  @Get("organizer/:organizerId")
  listForOrganizer(@Param("organizerId") organizerId: string) {
    return this.service.listForOrganizer(organizerId);
  }

  // Eventsh admin — all payment feedback platform-wide.
  @Get()
  listAll(
    @Query("paymentType") paymentType?: string,
    @Query("minRating") minRating?: string,
  ) {
    return this.service.listAll(
      paymentType,
      minRating ? Number(minRating) : undefined,
    );
  }
}
