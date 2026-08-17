import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { PlatformRegistryController } from "./platform-registry.controller";
import { PlatformRegistryService } from "./platform-registry.service";
import { InstanceLicenseGuard } from "./guards/instance-license.guard";
import { AdminRolesGuard } from "../auth/guards/admin-roles.guard";
import {
  WhiteLabelInstance,
  WhiteLabelInstanceSchema,
} from "./schemas/white-label-instance.schema";
import {
  WhiteLabelSyncedUser,
  WhiteLabelSyncedUserSchema,
} from "./schemas/white-label-synced-user.schema";
import { Event, EventSchema } from "../events/schemas/event.schema";
import { Ticket, TicketSchema } from "../tickets/entities/ticket.entity";

// Receiving side of the central instance registry (Phase 2 of the
// white-label plan) — meaningfully populated only on the canonical
// eventsh.com deployment. See also the platform-sync module (sending side,
// runs on every deployment but no-ops unless PLATFORM_REGISTRY_URL /
// INSTANCE_LICENSE_KEY are set).
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhiteLabelInstance.name, schema: WhiteLabelInstanceSchema },
      {
        name: WhiteLabelSyncedUser.name,
        schema: WhiteLabelSyncedUserSchema,
      },
      // For the api-client billing join (getInstanceStats).
      { name: Event.name, schema: EventSchema },
      { name: Ticket.name, schema: TicketSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || "secretKey",
      signOptions: { expiresIn: "1d" },
    }),
  ],
  controllers: [PlatformRegistryController],
  providers: [PlatformRegistryService, InstanceLicenseGuard, AdminRolesGuard],
  exports: [MongooseModule],
})
export class PlatformRegistryModule {}
