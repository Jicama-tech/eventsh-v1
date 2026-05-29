import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MembershipsService } from "./memberships.service";
import { MembershipsController } from "./memberships.controller";
import { MembershipsCron } from "./memberships.cron";
import {
  MembershipPlan,
  MembershipPlanSchema,
} from "./schemas/membership-plan.schema";
import {
  ExhibitorMembership,
  ExhibitorMembershipSchema,
} from "./schemas/exhibitor-membership.schema";
import {
  Organizer,
  OrganizerSchema,
} from "../organizers/schemas/organizer.schema";
import { Vendor, VendorSchema } from "../stalls/schemas/vendor.schema";
import {
  OrganizerStore,
  OrganizerStoreSchema,
} from "../organizer-stores/entities/organizer-store.entity";
import { MailModule } from "../roles/mail.module";
import { OtpModule } from "../otp/otp.module";
import { forwardRef } from "@nestjs/common";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MembershipPlan.name, schema: MembershipPlanSchema },
      { name: ExhibitorMembership.name, schema: ExhibitorMembershipSchema },
      { name: Organizer.name, schema: OrganizerSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: OrganizerStore.name, schema: OrganizerStoreSchema },
    ]),
    MailModule,
    // OtpService exposes `sendMediaMessage(whatsappNumber, filePath, …)`
    // — used to push the membership receipt PDF over WhatsApp on
    // confirm. forwardRef defends against a future cycle if OtpModule
    // ever needs to reach into memberships.
    forwardRef(() => OtpModule),
  ],
  controllers: [MembershipsController],
  providers: [MembershipsService, MembershipsCron],
  exports: [MembershipsService],
})
export class MembershipsModule {}
