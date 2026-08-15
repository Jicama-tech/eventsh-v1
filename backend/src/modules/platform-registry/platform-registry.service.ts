import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import {
  WhiteLabelInstance,
  WhiteLabelInstanceDocument,
} from "./schemas/white-label-instance.schema";
import {
  WhiteLabelSyncedUser,
  WhiteLabelSyncedUserDocument,
} from "./schemas/white-label-synced-user.schema";
import { RegisterInstanceDto } from "./dto/register-instance.dto";
import { SyncPayloadDto, SyncUserRecordDto } from "./dto/sync-payload.dto";

@Injectable()
export class PlatformRegistryService {
  constructor(
    @InjectModel(WhiteLabelInstance.name)
    private readonly instanceModel: Model<WhiteLabelInstanceDocument>,
    @InjectModel(WhiteLabelSyncedUser.name)
    private readonly syncedUserModel: Model<WhiteLabelSyncedUserDocument>,
  ) {}

  // Registers a new white-label deployment ahead of provisioning it. The
  // plaintext licenseKey is returned exactly once — only its hash is ever
  // stored (bcrypt, same handling as every other secret in this codebase) —
  // hand both values to the customer's deployment as
  // PLATFORM_REGISTRY_URL/INSTANCE_LICENSE_KEY.
  async registerInstance(dto: RegisterInstanceDto) {
    const instanceId = crypto.randomBytes(8).toString("hex");
    const licenseKey = crypto.randomBytes(24).toString("hex");
    const licenseKeyHash = await bcrypt.hash(licenseKey, 10);

    await this.instanceModel.create({
      instanceId,
      companyName: dto.companyName,
      domain: dto.domain,
      licenseKeyHash,
      status: "active",
    });

    return { instanceId, licenseKey };
  }

  async listInstances() {
    return this.instanceModel
      .find()
      .select(
        "instanceId companyName domain status lastSyncAt lastSyncStats createdAt",
      )
      .sort({ createdAt: -1 })
      .lean();
  }

  // Called by each white-label instance's platform-sync.service.ts. Upserts
  // (keyed on instanceId + sourceType + externalId, per the unique index on
  // WhiteLabelSyncedUser) so repeated syncs update existing records instead
  // of duplicating them, and stamps the reporting instance's latest stats.
  async sync(dto: SyncPayloadDto) {
    const groups: Array<
      [WhiteLabelSyncedUser["sourceType"], SyncUserRecordDto[] | undefined]
    > = [
      ["organizer", dto.users?.organizers],
      ["vendor", dto.users?.vendors],
      ["attendee", dto.users?.attendees],
      ["operator", dto.users?.operators],
    ];

    const ops: Promise<unknown>[] = [];
    let usersUpserted = 0;
    for (const [sourceType, records] of groups) {
      for (const record of records || []) {
        usersUpserted++;
        ops.push(
          this.syncedUserModel
            .updateOne(
              {
                instanceId: dto.instanceId,
                sourceType,
                externalId: record.externalId,
              },
              {
                $set: {
                  name: record.name,
                  email: record.email,
                  role: record.role,
                  sourceCreatedAt: record.createdAt
                    ? new Date(record.createdAt)
                    : undefined,
                  syncedAt: new Date(),
                },
              },
              { upsert: true },
            )
            .exec(),
        );
      }
    }
    await Promise.all(ops);

    await this.instanceModel
      .updateOne(
        { instanceId: dto.instanceId },
        { $set: { lastSyncAt: new Date(), lastSyncStats: dto.stats || {} } },
      )
      .exec();

    return { success: true, usersUpserted };
  }
}
