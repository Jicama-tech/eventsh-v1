import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MembershipsService } from "./memberships.service";

@Injectable()
export class MembershipsCron implements OnModuleInit {
  private readonly logger = new Logger(MembershipsCron.name);

  constructor(private readonly memberships: MembershipsService) {}

  // Once a day at 02:00 server time — flips `active` memberships whose
  // endDate has passed to `expired`. Idempotent: re-running it does nothing
  // if no rows match.
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async expireSweep() {
    try {
      const n = await this.memberships.expireDueMemberships();
      if (n > 0) this.logger.log(`Expired ${n} memberships`);
    } catch (err: any) {
      this.logger.warn(`expireSweep failed: ${err?.message}`);
    }
  }

  // One-shot backfill on boot — propagates the Vendor.isMember flag
  // for every currently-active ExhibitorMembership. Existing pre-flag
  // members otherwise wouldn't see member pricing until their next
  // confirm/reject/expire event. Idempotent — re-running flips nothing
  // that's already in the right state.
  async onModuleInit() {
    try {
      const n = await this.memberships.backfillVendorMemberFlags();
      if (n > 0) this.logger.log(`Backfilled isMember on ${n} vendors`);
    } catch (err: any) {
      this.logger.warn(`isMember backfill failed: ${err?.message}`);
    }
  }
}
