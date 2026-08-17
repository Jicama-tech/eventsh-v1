import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { OrganizersService } from "./organizers.service";
import { OrganizersController } from "./organizers.controller";
import { Organizer, OrganizerSchema } from "./schemas/organizer.schema";
import { JwtService } from "@nestjs/jwt";
import { EventSchema } from "../events/schemas/event.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { MailService } from "../roles/mail.service";
import { OtpSchema } from "../otp/entities/otp.entity";
import { OtpModule } from "../otp/otp.module";
import { MailModule } from "../roles/mail.module";
import { PlanSchema } from "../plans/entities/plan.entity";
import { OtpService } from "../otp/otp.service";
import { OperatorsModule } from "../operators/operators.module";
import { OperatorSchema } from "../operators/entities/operator.entity";
import { ApiKeyGuard } from "./guards/api-key.guard";
import { OrganizerOrApiKeyGuard } from "./guards/organizer-or-api-key.guard";
import { AdminRolesGuard } from "../auth/guards/admin-roles.guard";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Organizer", schema: OrganizerSchema },
      { name: "Event", schema: EventSchema },
      { name: "User", schema: UserSchema },
      { name: "Otp", schema: OtpSchema },
      { name: "Plan", schema: PlanSchema },
      { name: "Operator", schema: OperatorSchema },
    ]),
    forwardRef(() => OtpModule),
    forwardRef(() => OperatorsModule),
    MailModule,
  ],
  providers: [
    OrganizersService,
    JwtService,
    MailService,
    ApiKeyGuard,
    OrganizerOrApiKeyGuard,
    AdminRolesGuard,
  ],
  controllers: [OrganizersController],
  // MongooseModule re-export lets any module importing OrganizersModule
  // (e.g. EventsModule) inject the Organizer model — including inside
  // ApiKeyGuard/OrganizerOrApiKeyGuard, which both need it. Exporting the
  // guards themselves means other modules can reference the class directly
  // in @UseGuards() without re-declaring them as their own providers.
  exports: [OrganizersService, MongooseModule, ApiKeyGuard, OrganizerOrApiKeyGuard],
})
export class OrganizersModule {}
