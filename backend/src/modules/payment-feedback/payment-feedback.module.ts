import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PaymentFeedbackController } from "./payment-feedback.controller";
import { PaymentFeedbackService } from "./payment-feedback.service";
import {
  PaymentFeedback,
  PaymentFeedbackSchema,
} from "./schemas/payment-feedback.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentFeedback.name, schema: PaymentFeedbackSchema },
    ]),
  ],
  controllers: [PaymentFeedbackController],
  providers: [PaymentFeedbackService],
  exports: [PaymentFeedbackService],
})
export class PaymentFeedbackModule {}
