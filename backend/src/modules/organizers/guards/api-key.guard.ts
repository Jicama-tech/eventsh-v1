// Strict API-key guard for machine callers — a white-label client with its
// own frontend + database (Phase 4; first case: SingAdvisor) consuming
// eventsh purely as a backend API. Modeled directly on
// platform-registry/guards/instance-license.guard.ts's "header + bcrypt.compare"
// shape, scoped to a single Organizer instead of a WhiteLabelInstance.
//
// Reads `x-organizer-id` + `x-api-key` headers, resolves the organizerId
// SERVER-SIDE from that lookup, and attaches it to `request.organizerId` —
// callers must never be trusted to just assert their own organizerId (that's
// the whole point of the guard). Every integration is locked to exactly one
// Organizer: this guard only ever proves "this key belongs to this
// organizer", it never creates or lists organizers, and it is deliberately
// NOT applied to any organizer-creation endpoint (POST /organizers,
// POST /organizers/register, the individual lazy-create path in
// events.controller.ts's createEvent).
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as bcrypt from "bcrypt";
import {
  Organizer,
  OrganizerDocument,
} from "../schemas/organizer.schema";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectModel(Organizer.name)
    private readonly organizerModel: Model<OrganizerDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
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
        "Missing or invalid x-organizer-id / x-api-key headers",
      );
    }

    const organizer = await this.organizerModel
      .findById(organizerId)
      .select("apiKeyHash")
      .exec();
    if (!organizer?.apiKeyHash) {
      throw new UnauthorizedException("Unknown organizer or no active API key");
    }

    const valid = await bcrypt.compare(apiKey, organizer.apiKeyHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid API key");
    }

    req.organizerId = organizerId;
    return true;
  }
}
