import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ComboxKeyService } from "./combox-key.service";

/**
 * Organizer dashboard: create / rotate / revoke the key ComBox connects with.
 * Operators (staff) may see the status (prefix and dates, never the secret).
 */
@Controller("integration/combox/api-key")
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class ComboxKeyController {
  constructor(private readonly keys: ComboxKeyService) {}

  private organizerId(req: any, { ownerOnly = true } = {}): string {
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [];
    if (!roles.includes("organizer")) {
      throw new ForbiddenException("Only an organizer can manage this key");
    }
    if (ownerOnly && req.user?.operatorId) {
      throw new ForbiddenException("Only the organizer can manage the ComBox key");
    }
    // JwtAuthGuard leaves the raw token on req.user (organizer id = sub); AuthGuard("jwt") maps it to userId
    const id = String(req.user?.userId ?? req.user?.sub ?? "");
    if (!/^[a-f0-9]{24}$/i.test(id)) {
      throw new ForbiddenException("Could not tell which organizer you are. Log in again.");
    }
    return id;
  }

  @Get()
  info(@Req() req: any) {
    return this.keys.getKeyInfo(this.organizerId(req, { ownerOnly: false }));
  }

  @Post()
  rotate(@Req() req: any) {
    return this.keys.rotateKey(this.organizerId(req));
  }

  @Delete()
  revoke(@Req() req: any) {
    return this.keys.revokeKey(this.organizerId(req));
  }
}
