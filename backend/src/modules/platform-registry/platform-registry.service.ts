import { BadRequestException, Injectable } from "@nestjs/common";
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
    // For the api-client billing join (data lives centrally in this DB).
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel("Ticket") private readonly ticketModel: Model<any>,
  ) {}

  // Registers a new white-label deployment ahead of provisioning it — OR
  // (integrationType "api-client", Phase 4.5) registers a tracking-only
  // entry for a client consuming eventsh purely as a backend API, linked to
  // its real Organizer row. Only "full-instance" (the default — every
  // registration before this type existed was one) generates a license
  // key: an api-client integration has no separate deployment to run
  // platform-sync.service.ts's periodic job from, so there's nothing for
  // that credential to authenticate. The plaintext licenseKey (when
  // generated) is returned exactly once — only its hash is ever stored
  // (bcrypt, same handling as every other secret in this codebase) — hand
  // both values to the customer's deployment as
  // PLATFORM_REGISTRY_URL/INSTANCE_LICENSE_KEY.
  async registerInstance(dto: RegisterInstanceDto) {
    const integrationType = dto.integrationType || "full-instance";
    if (integrationType === "api-client" && !dto.organizerId) {
      throw new BadRequestException(
        "organizerId is required when integrationType is \"api-client\"",
      );
    }

    const instanceId = crypto.randomBytes(8).toString("hex");

    if (integrationType === "api-client") {
      await this.instanceModel.create({
        instanceId,
        companyName: dto.companyName,
        domain: dto.domain,
        integrationType,
        organizerId: dto.organizerId,
        status: "active",
      });
      return { instanceId };
    }

    const licenseKey = crypto.randomBytes(24).toString("hex");
    const licenseKeyHash = await bcrypt.hash(licenseKey, 10);

    await this.instanceModel.create({
      instanceId,
      companyName: dto.companyName,
      domain: dto.domain,
      licenseKeyHash,
      integrationType,
      status: "active",
    });

    return { instanceId, licenseKey };
  }

  async listInstances() {
    return this.instanceModel
      .find()
      .select(
        "instanceId companyName domain status integrationType organizerId lastSyncAt lastSyncStats createdAt",
      )
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Per-instance billing view (events + tickets + revenue), for the Super
   * Admin's White-Label Instances page:
   *
   * - "api-client" rows: their organizer's data lives in THIS central
   *   database, so compute it live here (same aggregations as the admin
   *   module's organizers-overview — the two numbers never drift). Returns
   *   source: "central".
   * - "full-instance" rows: their data lives in their own deployment's
   *   database, which reports into lastSyncStats via the sync channel
   *   (platform-sync.service.ts now includes eventCount/ticketCount/
   *   revenue). Returns source: "sync" with whatever was last reported
   *   (null revenue when never synced).
   */
  async getInstanceStats(id: string) {
    const instance = await this.instanceModel.findById(id).lean();
    if (!instance) return null;

    if (instance.integrationType === "api-client" && instance.organizerId) {
      const [eventCount, ticketAgg] = await Promise.all([
        this.eventModel.countDocuments({ organizer: instance.organizerId }).exec(),
        this.ticketModel
          .aggregate([
            { $match: { organizerId: instance.organizerId, paymentConfirmed: true } },
            { $group: { _id: null, tickets: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
          ])
          .exec(),
      ]);
      return {
        instanceId: instance.instanceId,
        companyName: instance.companyName,
        source: "central",
        eventCount,
        ticketCount: ticketAgg[0]?.tickets ?? 0,
        revenue: ticketAgg[0]?.revenue ?? 0,
      };
    }

    return {
      instanceId: instance.instanceId,
      companyName: instance.companyName,
      source: "sync",
      eventCount: instance.lastSyncStats?.eventCount ?? null,
      ticketCount: instance.lastSyncStats?.ticketCount ?? null,
      revenue: instance.lastSyncStats?.revenue ?? null,
      lastSyncAt: instance.lastSyncAt ?? null,
    };
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
