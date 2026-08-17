// Composite guard for organizer-authoring endpoints that need to accept
// BOTH the existing browser/JWT session AND a Phase-4 machine caller (a
// client with their own frontend + DB, e.g. SingAdvisor) — without touching
// the route's existing JWT behavior at all.
//
// - `Authorization: Bearer <jwt>` present → delegates to the exact same
//   passport "jwt" strategy `AuthGuard("jwt")` already used on these routes
//   (see events.controller.ts). Zero behavior change for every existing
//   browser flow.
// - No Bearer token → falls back to `x-organizer-id` + `x-api-key` headers
//   (same bcrypt-hash check as ApiKeyGuard). On success, synthesizes
//   `request.user` in the SAME shape passport's JwtStrategy.validate()
//   produces (`{ userId, name, email, roles }`) so downstream handlers that
//   branch on `req.user.userId`/`req.user.roles` (e.g.
//   events.controller.ts's createEvent) treat an API-key caller identically
//   to a human organizer session. organizerId always comes from this
//   guard's own DB lookup — never from anything the caller supplies in the
//   request body — so the exactly-one-Organizer constraint holds regardless
//   of which endpoint this guard protects.
//
// Deliberately NOT applied to any organizer-creation endpoint — those stay
// on their existing guards untouched.
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as bcrypt from "bcrypt";
import { Organizer, OrganizerDocument } from "../schemas/organizer.schema";

const JwtPassportGuard = AuthGuard("jwt");

@Injectable()
export class OrganizerOrApiKeyGuard implements CanActivate {
  // Instantiated directly (not DI-injected) — passport strategies register
  // themselves in passport's own global registry when Nest builds the
  // AuthModule at boot, independent of which class holds the AuthGuard("jwt")
  // reference, so a plain `new` here resolves the same "jwt" strategy every
  // `@UseGuards(AuthGuard("jwt"))` call site already uses.
  private readonly jwtGuard = new JwtPassportGuard();

  constructor(
    @InjectModel(Organizer.name)
    private readonly organizerModel: Model<OrganizerDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers?.authorization;

    if (authHeader && String(authHeader).startsWith("Bearer ")) {
      return (await this.jwtGuard.canActivate(context)) as boolean;
    }

    const organizerId = req.headers["x-organizer-id"];
    const apiKey = req.headers["x-api-key"];
    if (
      !organizerId ||
      typeof organizerId !== "string" ||
      !apiKey ||
      typeof apiKey !== "string" ||
      !Types.ObjectId.isValid(organizerId)
    ) {
      throw new UnauthorizedException(
        "No Bearer token and no x-organizer-id / x-api-key headers",
      );
    }

    const organizer = await this.organizerModel
      .findById(organizerId)
      .select("apiKeyHash name email country organizationName")
      .exec();
    if (!organizer?.apiKeyHash) {
      throw new UnauthorizedException("Unknown organizer or no active API key");
    }

    const valid = await bcrypt.compare(apiKey, organizer.apiKeyHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid API key");
    }

    req.user = {
      userId: organizerId,
      name: organizer.name,
      email: organizer.email,
      country: (organizer as any).country,
      organizationName: organizer.organizationName,
      roles: ["organizer"],
      apiKeyAuth: true,
    };
    req.organizerId = organizerId;
    return true;
  }
}
