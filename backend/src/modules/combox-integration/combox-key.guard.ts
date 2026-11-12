import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiKeyGuard } from "../organizers/guards/api-key.guard";
import { ComboxKeyService } from "./combox-key.service";

/**
 * Machine guard for the ComBox feed. Takes the organizer's own key
 * (`esk_...`, as `Authorization: Bearer` or `x-api-key`) and works out the
 * organizer from it, so ComBox needs no organizer ID. A request that carries
 * `x-organizer-id` instead is the older Super-Admin-issued key and goes to the
 * existing ApiKeyGuard unchanged.
 */
@Injectable()
export class ComboxKeyGuard implements CanActivate {
  constructor(
    private readonly keys: ComboxKeyService,
    private readonly legacy: ApiKeyGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (req.headers["x-organizer-id"]) {
      return this.legacy.canActivate(context);
    }
    const header: string | undefined = req.headers.authorization;
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const key = (bearer || (req.headers["x-api-key"] as string | undefined))?.trim();
    if (!key) throw new UnauthorizedException("API key required");

    const organizerId = await this.keys.resolveKey(key);
    if (!organizerId) throw new UnauthorizedException("Invalid API key");

    req.organizerId = organizerId;
    return true;
  }
}
