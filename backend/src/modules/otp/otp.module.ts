import { Module, forwardRef } from "@nestjs/common";
import { OtpService } from "./otp.service";
import { OtpController } from "./otp.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { MailModule } from "../roles/mail.module";
import { Otp, OtpSchema } from "./entities/otp.entity";
import { OrganizersModule } from "../organizers/organizers.module";
import { Agent, AgentSchema } from "../agents/schemas/agent.schema";
import { JwtService } from "@nestjs/jwt";
import { WhatsappModule } from "../whatsapp/whatsapp.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminRolesGuard } from "../auth/guards/admin-roles.guard";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Otp.name, schema: OtpSchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
    MailModule,
    forwardRef(() => OrganizersModule),
    // Attendee-facing messages go out from the organizer's own linked number
    // when it has one; OtpService also registers the platform number with
    // OrganizerWhatsappService. WhatsappModule is a leaf, so this cannot
    // cycle back here.
    WhatsappModule,
  ],
  controllers: [OtpController],
  providers: [OtpService, JwtService, JwtAuthGuard, AdminRolesGuard],
  exports: [OtpService, MongooseModule],
})
export class OtpModule {}
