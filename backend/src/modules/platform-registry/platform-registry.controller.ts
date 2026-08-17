import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminRolesGuard } from "../auth/guards/admin-roles.guard";
import { InstanceLicenseGuard } from "./guards/instance-license.guard";
import { PlatformRegistryService } from "./platform-registry.service";
import { RegisterInstanceDto } from "./dto/register-instance.dto";
import { SyncPayloadDto } from "./dto/sync-payload.dto";

@Controller("platform-registry")
export class PlatformRegistryController {
  constructor(private readonly registryService: PlatformRegistryService) {}

  // Admin-only. Registers a new white-label instance ahead of provisioning
  // it — see PlatformRegistryService.registerInstance for the licenseKey
  // handling.
  //
  // AdminRolesGuard added alongside the pre-existing JwtAuthGuard: a code
  // review on the Container branch found JwtAuthGuard alone only proves
  // "some valid eventsh JWT" — organizer/vendor tokens are also valid JWTs,
  // so any logged-in organizer could previously register instances or list
  // every white-label customer's domain + sync stats below.
  @Post("instances")
  @UseGuards(JwtAuthGuard, AdminRolesGuard)
  registerInstance(@Body() dto: RegisterInstanceDto) {
    return this.registryService.registerInstance(dto);
  }

  // Admin-only. Lists registered instances + their latest sync stats, for
  // the Super Admin UI.
  @Get("instances")
  @UseGuards(JwtAuthGuard, AdminRolesGuard)
  listInstances() {
    return this.registryService.listInstances();
  }

  // Admin-only. Per-instance billing view: events + tickets + revenue.
  // api-client rows are joined against the CENTRAL database (their
  // organizer's data lives here); full-instance rows surface the stats
  // their own deployment reported via the sync channel. See
  // PlatformRegistryService.getInstanceStats for the exact shapes.
  @Get("instances/:id/stats")
  @UseGuards(JwtAuthGuard, AdminRolesGuard)
  async getInstanceStats(@Param("id") id: string) {
    const stats = await this.registryService.getInstanceStats(id);
    if (!stats) throw new NotFoundException("No instance with that id");
    return stats;
  }

  // Server-to-server (a white-label instance's own platform-sync.service.ts
  // reporting home) — guarded by the instance's own license key, not the
  // normal admin JWT.
  @Post("sync")
  @UseGuards(InstanceLicenseGuard)
  sync(@Body() dto: SyncPayloadDto) {
    return this.registryService.sync(dto);
  }
}
