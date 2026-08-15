import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
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
  @Post("instances")
  @UseGuards(JwtAuthGuard)
  registerInstance(@Body() dto: RegisterInstanceDto) {
    return this.registryService.registerInstance(dto);
  }

  // Admin-only. Lists registered instances + their latest sync stats, for
  // the Super Admin UI.
  @Get("instances")
  @UseGuards(JwtAuthGuard)
  listInstances() {
    return this.registryService.listInstances();
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
