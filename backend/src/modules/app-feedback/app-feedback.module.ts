import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { AppFeedbackService } from "./app-feedback.service";
import { AppFeedbackController } from "./app-feedback.controller";
import {
  AppFeedback,
  AppFeedbackSchema,
} from "./schemas/app-feedback.schema";
import { OtpModule } from "../otp/otp.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AppFeedback.name, schema: AppFeedbackSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || "secretKey",
    }),
    OtpModule,
  ],
  controllers: [AppFeedbackController],
  providers: [AppFeedbackService],
})
export class AppFeedbackModule {}
