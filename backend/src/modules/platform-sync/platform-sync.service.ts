// Sending side of the central instance registry (Phase 2 of the white-label
// plan). Ships in every deployment, but only activates where
// PLATFORM_REGISTRY_URL / INSTANCE_LICENSE_KEY / INSTANCE_ID are all set —
// which the canonical eventsh.com deployment never sets, so it's a safe
// no-op there. See platform-registry module for the receiving side.
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import fetch from "node-fetch"; // npm install node-fetch

function toRecord(doc: any, roleFallback?: string) {
  return {
    externalId: String(doc._id),
    name:
      doc.name ||
      [doc.firstName, doc.lastName].filter(Boolean).join(" ") ||
      undefined,
    email: doc.email,
    role: Array.isArray(doc.roles) ? doc.roles.join(",") : roleFallback,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
  };
}

@Injectable()
export class PlatformSyncService {
  private readonly logger = new Logger(PlatformSyncService.name);

  constructor(
    @InjectModel("Organizer") private readonly organizerModel: Model<any>,
    @InjectModel("Vendor") private readonly vendorModel: Model<any>,
    @InjectModel("User") private readonly userModel: Model<any>,
    @InjectModel("Operator") private readonly operatorModel: Model<any>,
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel("Ticket") private readonly ticketModel: Model<any>,
  ) {}

  private isConfigured(): boolean {
    return !!(
      process.env.PLATFORM_REGISTRY_URL &&
      process.env.INSTANCE_LICENSE_KEY &&
      process.env.INSTANCE_ID
    );
  }

  @Cron(CronExpression.EVERY_4_HOURS)
  async scheduledSync() {
    if (!this.isConfigured()) return;
    try {
      const result = await this.syncNow();
      if (result.skipped === false) {
        this.logger.log(
          `Synced ${result.usersSent} users to platform registry`,
        );
      }
    } catch (err: any) {
      // Never let a registry outage affect this instance's own operation —
      // it just retries on the next scheduled run.
      this.logger.warn(`platform sync failed: ${err?.message}`);
    }
  }

  async syncNow(): Promise<{ skipped: true } | { skipped: false; usersSent: number }> {
    if (!this.isConfigured()) return { skipped: true };

    const [organizers, vendors, attendees, operators, eventCount, ticketAgg] =
      await Promise.all([
        this.organizerModel.find().select("name email createdAt").lean(),
        this.vendorModel.find().select("name email createdAt").lean(),
        this.userModel
          .find()
          .select("name firstName lastName email createdAt roles")
          .lean(),
        this.operatorModel.find().select("name email createdAt").lean(),
        this.eventModel.countDocuments({}).exec(),
        // Revenue = sum of ticket totals where payment was confirmed — the
        // same aggregation the admin module's organizers-overview uses, so
        // the registry's number and the admin panel's number never drift.
        this.ticketModel.aggregate([
          { $match: { paymentConfirmed: true } },
          { $group: { _id: null, tickets: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
        ]),
      ]);

    const tickets = ticketAgg[0]?.tickets ?? 0;
    const revenue = ticketAgg[0]?.revenue ?? 0;

    const payload = {
      instanceId: process.env.INSTANCE_ID,
      stats: {
        organizerCount: organizers.length,
        vendorCount: vendors.length,
        attendeeCount: attendees.length,
        operatorCount: operators.length,
        eventCount,
        ticketCount: tickets,
        revenue,
      },
      users: {
        organizers: organizers.map((o) => toRecord(o, "organizer")),
        vendors: vendors.map((v) => toRecord(v, "vendor")),
        attendees: attendees.map((u) => toRecord(u, "attendee")),
        operators: operators.map((o) => toRecord(o, "operator")),
      },
    };

    const res = await fetch(
      `${process.env.PLATFORM_REGISTRY_URL}/platform-registry/sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-instance-license-key": process.env.INSTANCE_LICENSE_KEY as string,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`registry responded ${res.status}: ${text}`);
    }

    return {
      skipped: false,
      usersSent:
        organizers.length + vendors.length + attendees.length + operators.length,
    };
  }
}
