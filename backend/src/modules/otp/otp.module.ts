import { Module, forwardRef } from "@nestjs/common";
import { OtpService } from "./otp.service";
import { OtpController } from "./otp.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { MailModule } from "../roles/mail.module";
import { Otp, OtpSchema } from "./entities/otp.entity";
import { OrganizersModule } from "../organizers/organizers.module";
import { Agent, AgentSchema } from "../agents/schemas/agent.schema";
import { JwtService } from "@nestjs/jwt";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Otp.name, schema: OtpSchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
    MailModule,
    forwardRef(() => OrganizersModule),
  ],
  controllers: [OtpController],
  providers: [OtpService, JwtService],
  exports: [OtpService, MongooseModule],
})
export class OtpModule {}
