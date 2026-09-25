import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";

type ModuleMap = Record<string, { enabled?: boolean; limit?: number } | undefined>;

type Access = {
  /** The organizer exists and holds a plan that is live (or in its grace window). */
  active: boolean;
  /** Individual (wedding / party host) accounts are exempt from module gates. */
  individual: boolean;
  /** The effective module map: the organizer's plan's, else the default plan's. */
  modules: ModuleMap;
};

/** Plans are read at most this often per organizer. Sends and the WhatsApp
 * retry loop ask before every message, so this must not be a query each. */
const CACHE_TTL_MS = 30_000;

/** Same window as OrganizersService.GRACE_PERIOD_DAYS. */
const GRACE_PERIOD_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Does this organizer's plan include module X?", answered server-side.
 *
 * eventsh gates plan modules in the frontend (useSubscription.isModuleEnabled)
 * and, for the one server-side check that existed, inline in
 * OrganizersService.updateEmailConfig. The WhatsApp add-on is checked on every
 * send and reconnect, so the rule lives here once, with a short cache, and
 * follows the same reading of a plan as those two places:
 *
 *  - no subscription, or one past its 7-day grace window → nothing is enabled;
 *  - a plan with NO module configuration falls back to the default Organizer
 *    plan's modules; if that is empty too, everything is enabled (legacy data);
 *  - otherwise a module is enabled only when the plan says `enabled: true`.
 *    A module the plan does not mention is OFF — which is what makes a new
 *    paid add-on land switched off until an admin turns it on per plan.
 *  - Individual accounts pass, as they do for the custom email sender.
 */
@Injectable()
export class PlanAccessService {
  private readonly logger = new Logger(PlanAccessService.name);
  private readonly cache = new Map<string, { at: number; value: Access }>();

  constructor(
    @InjectModel("Organizer") private readonly organizerModel: Model<any>,
    @InjectModel("Plan") private readonly planModel: Model<any>,
  ) {}

  async isEnabled(organizerId: string, moduleKey: string): Promise<boolean> {
    const access = await this.load(String(organizerId ?? ""));
    if (access.individual) return true;
    if (!access.active) return false;
    if (!access.modules || Object.keys(access.modules).length === 0) return true;
    return access.modules[moduleKey]?.enabled === true;
  }

  /** Forget a cached read, e.g. right after a plan change. */
  invalidate(organizerId: string) {
    this.cache.delete(String(organizerId ?? ""));
  }

  private async load(organizerId: string): Promise<Access> {
    const now = Date.now();
    const hit = this.cache.get(organizerId);
    if (hit && now - hit.at < CACHE_TTL_MS) return hit.value;
    const value = await this.read(organizerId).catch((err) => {
      this.logger.warn(
        `Could not read the plan for organizer ${organizerId}: ${err?.message || err}`,
      );
      // A failed read is not a plan without the feature; the last good answer
      // stands, else nothing is enabled.
      return hit?.value ?? { active: false, individual: false, modules: {} };
    });
    this.cache.set(organizerId, { at: now, value });
    if (this.cache.size > 5_000) {
      for (const [key, entry] of this.cache) {
        if (now - entry.at >= CACHE_TTL_MS) this.cache.delete(key);
      }
    }
    return value;
  }

  private async read(organizerId: string): Promise<Access> {
    if (!Types.ObjectId.isValid(organizerId)) {
      return { active: false, individual: false, modules: {} };
    }
    const organizer: any = await this.organizerModel
      .findById(organizerId)
      .select("organizerType accountType subscribed planId planExpiryDate")
      .lean();
    if (!organizer) return { active: false, individual: false, modules: {} };

    const individual =
      organizer.organizerType === "individual" ||
      organizer.accountType === "Individual";

    let plan: any = organizer.planId
      ? await this.planModel.findById(organizer.planId).lean()
      : null;
    const planHasNoModules =
      !plan || !plan.modules || Object.keys(plan.modules).length === 0;
    if (planHasNoModules) {
      const fallback: any = await this.planModel
        .findOne({ moduleType: "Organizer", isDefault: true, isActive: true })
        .lean();
      if (fallback) {
        plan = plan ? { ...plan, modules: fallback.modules } : fallback;
      }
    }

    // Same expiry reading as OrganizersService.getSubscriptionDetail.
    const isDatePlan = plan?.validityType === "date" && !!plan?.validUntil;
    const expiryDate = isDatePlan
      ? new Date(plan.validUntil)
      : organizer.planExpiryDate
        ? new Date(organizer.planExpiryDate)
        : null;
    const expiry = expiryDate ? expiryDate.getTime() : 0;
    const subscribed = !!organizer.subscribed;
    const now = Date.now();
    const isExpired = subscribed && expiry > 0 && expiry < now;
    const inGrace = isExpired && expiry + GRACE_PERIOD_DAYS * DAY_MS > now;
    const active = subscribed && (!isExpired || inGrace);

    return {
      active,
      individual,
      modules: (plan?.modules as ModuleMap) || {},
    };
  }
}
