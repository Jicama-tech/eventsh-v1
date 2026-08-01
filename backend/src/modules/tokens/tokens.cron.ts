import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { TokensService } from "./tokens.service";

@Injectable()
export class TokensCron {
  private readonly logger = new Logger(TokensCron.name);

  constructor(private readonly tokens: TokensService) {}

  // Backstop for the lazy on-read reconciliation strategy — sweeps events
  // updated in the last 24h so a wallet doesn't sit stale just because
  // nobody opened the organizer/admin dashboard. Idempotent (delta-based).
  @Cron(CronExpression.EVERY_30_MINUTES)
  async reconcileSweep() {
    try {
      const { eventsReconciled, organizersSwept } =
        await this.tokens.sweepRecentActivity(24);
      if (eventsReconciled > 0) {
        this.logger.log(
          `Reconciled ${eventsReconciled} events across ${organizersSwept} organizers`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`reconcileSweep failed: ${err?.message}`);
    }
  }
}
