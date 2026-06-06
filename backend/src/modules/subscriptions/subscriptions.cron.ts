import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SubscriptionsService } from "./subscriptions.service";

@Injectable()
export class SubscriptionsCron {
  private readonly logger = new Logger(SubscriptionsCron.name);

  constructor(private readonly subs: SubscriptionsService) {}

  // Once a day at 02:00 server time (memberships sweep pattern) — flips
  // `active` add-on purchases whose endDate has passed to `expired`.
  // Entitlement reads also filter by endDate, so this is bookkeeping only.
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async expireAddOnsSweep() {
    try {
      const n = await this.subs.expireDueAddOns();
      if (n > 0) this.logger.log(`Expired ${n} add-on purchases`);
    } catch (err: any) {
      this.logger.warn(`expireAddOnsSweep failed: ${err?.message}`);
    }
  }
}
