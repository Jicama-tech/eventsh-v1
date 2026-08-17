// Auth for POST /platform-registry/sync — server-to-server (a white-label
// instance's own backend calling home), not a logged-in admin, so this
// checks a per-instance license key header instead of the normal JWT guard.
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcrypt";
import {
  WhiteLabelInstance,
  WhiteLabelInstanceDocument,
} from "../schemas/white-label-instance.schema";

@Injectable()
export class InstanceLicenseGuard implements CanActivate {
  constructor(
    @InjectModel(WhiteLabelInstance.name)
    private readonly instanceModel: Model<WhiteLabelInstanceDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const licenseKey = req.headers["x-instance-license-key"];
    const instanceId = req.body?.instanceId;

    if (!licenseKey || typeof licenseKey !== "string" || !instanceId) {
      throw new UnauthorizedException(
        "Missing x-instance-license-key header or instanceId",
      );
    }

    const instance = await this.instanceModel.findOne({ instanceId }).exec();
    if (!instance || instance.status !== "active") {
      throw new UnauthorizedException("Unknown or inactive instance");
    }

    const valid = await bcrypt.compare(licenseKey, instance.licenseKeyHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid license key");
    }

    return true;
  }
}
