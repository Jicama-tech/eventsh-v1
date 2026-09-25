import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { TABS_KEY } from "./tabs.decorator";

type RequestUser = {
  userId?: string;
  operatorId?: string;
};

/** How a tab is named in the refusal, so the message says what was refused. */
const TAB_NAMES: Record<string, string> = {
  whatsapp: "WhatsApp",
  settings: "Settings",
  users: "CRM",
};

/**
 * Enforces operator access tabs on the API.
 *
 * `accessTabs` has only ever been a display rule: the dashboard uses it to
 * hide sidebar items, and nothing on the server checks it. That is not
 * authorization — an operator could take the token out of their own browser
 * and call anything the owner can. This guard makes the tab a real permission
 * on the routes that declare one with @Tabs().
 *
 * OWNERS ARE EXEMPT, and that is not a loophole: only operator-minted tokens
 * carry an `operatorId` (OrganizersService signs them with the parent
 * organizer as `sub`). An owner's token has none.
 *
 * AN EMPTY `accessTabs` MEANS FULL ACCESS, exactly as the dashboard reads it
 * ("Leave all unchecked for full access" in the operator form). Only a
 * non-empty list restricts.
 *
 * THE OPERATOR RECORD IS RE-READ on every request instead of trusting the
 * token's `accessTabs` claim, because that claim is a snapshot taken at login.
 * When an owner takes a tab away — or deletes the operator — they expect it to
 * stop working now, not when the token expires. It is one indexed lookup on
 * routes that are called rarely.
 *
 * A route with no @Tabs() is not restricted by this guard, so it is safe to
 * apply at controller level.
 */
@Injectable()
export class TabsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectModel("Operator") private readonly operatorModel: Model<any>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(TABS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: RequestUser }>();
    const user = request.user;
    const refusal = new ForbiddenException(
      `Your account does not have access to ${describeTabs(required)}.`,
    );

    // No identity at all means the route was wired without the JWT guard in
    // front of this one. Failing closed keeps that mistake from quietly
    // opening a tab-restricted route to the world.
    if (!user?.userId) throw refusal;

    // Owners: see the note above.
    if (!user.operatorId) return true;

    if (!Types.ObjectId.isValid(String(user.operatorId))) throw refusal;
    const operator: any = await this.operatorModel
      .findById(String(user.operatorId))
      .select("accessTabs organizerId")
      .lean();

    // The organizer check matters as much as the tab check: an operator
    // record that belongs to another organizer grants nothing here.
    if (
      !operator ||
      String(operator.organizerId || "") !== String(user.userId)
    ) {
      throw refusal;
    }

    const held = Array.isArray(operator.accessTabs) ? operator.accessTabs : [];
    if (held.length === 0) return true;
    if (!required.some((tab) => held.includes(tab))) throw refusal;
    return true;
  }
}

function describeTabs(tabs: string[]): string {
  const names = tabs.map((t) => TAB_NAMES[t]).filter(Boolean);
  return names.length ? names.join(" or ") : "that section";
}
