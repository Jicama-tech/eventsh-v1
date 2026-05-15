import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";
import { Feedback, FeedbackSchema } from "./schemas/feedback.schema";
import { Event, EventSchema } from "../events/schemas/event.schema";
import { Ticket, TicketSchema } from "../tickets/entities/ticket.entity";
import { Stall, StallSchema } from "../stalls/entities/stall.entity";
import {
  SpeakerRequest,
  SpeakerRequestSchema,
} from "../speaker-requests/entities/speaker-request.entity";
import {
  RoundTableBooking,
  RoundTableBookingSchema,
} from "../round-table-bookings/entities/round-table-booking.entity";
import { OtpModule } from "../otp/otp.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Feedback.name, schema: FeedbackSchema },
      { name: Event.name, schema: EventSchema },
      { name: Ticket.name, schema: TicketSchema },
      { name: Stall.name, schema: StallSchema },
      { name: SpeakerRequest.name, schema: SpeakerRequestSchema },
      { name: RoundTableBooking.name, schema: RoundTableBookingSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || "secretKey",
    }),
    OtpModule,
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
