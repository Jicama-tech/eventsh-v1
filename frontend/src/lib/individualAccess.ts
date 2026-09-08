/**
 * Single source of truth for what an Individual account can do.
 *
 * An Individual is a Google sign-in that has not completed organizer
 * registration: `roles` carries "individual" but not "organizer". They are
 * mid-onboarding, so they get a deliberately small slice of the platform that
 * still works end to end — create a personal event, share it, collect RSVPs —
 * with everything past that pointing at organizer registration.
 *
 * Every "can an Individual do X" decision is meant to live here. Adding or
 * removing a capability should be a one-line edit in this file rather than a
 * hunt through the dashboard, the event form and the subscription hook, all
 * three of which used to decode the token and answer the question themselves.
 */
import { jwtDecode } from "jwt-decode";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Users,
  Settings,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

/** Roles on the current session token, or [] when signed out / unreadable. */
export function accountRoles(): string[] {
  try {
    const token = sessionStorage.getItem("token");
    if (!token) return [];
    const decoded: any = jwtDecode(token);
    return Array.isArray(decoded?.roles) ? (decoded.roles as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Individual = signed in, but no organizer account behind them yet. Read at
 * call time rather than module load: the token arrives after this module is
 * first imported, and it changes on login/logout without a reload.
 */
export function isIndividualAccount(roles: string[] = accountRoles()): boolean {
  return roles.includes("individual") && !roles.includes("organizer");
}

export interface IndividualNavItem {
  /** Tab id — matches a TabsContent value in OrganizerDashboard. */
  id: string;
  /** i18n key for the sidebar label. */
  labelKey: string;
  icon: LucideIcon;
  /**
   * Not a tab: selecting it runs an action (see goToTab in
   * OrganizerDashboard) instead of switching the panel. Mirrors the
   * `isAction` flag the organizer's own storefront entry uses.
   */
  isAction?: boolean;
}

/** Nav id for the upgrade action — opens organizer registration. */
export const BECOME_ORGANIZER_TAB = "become-organizer";

/**
 * The Individual dashboard sidebar, in order. Each id must have a matching
 * `<TabsContent value=…>` in OrganizerDashboard and a `navi.*` key in both
 * en.ts and hi.ts. Nothing here is plan-gated — Individuals hold no
 * subscription modules, so none of these can render locked.
 *
 * To give Individuals another tab: add it here, and make sure that tab's
 * content has an Individual-safe branch.
 */
export const INDIVIDUAL_NAV_ITEMS: IndividualNavItem[] = [
  // No "chatbot" entry: the assistant is the floating bubble, the same as it
  // is for organizers, so it is reachable from every tab instead of being one.
  // "dashboard" is the analytics tab, same id organizers use — the dashboard
  // renders IndividualAnalytics behind it rather than DashboardOverview.
  { id: "dashboard", labelKey: "nav.dashboard", icon: BarChart3 },
  { id: "events", labelKey: "navi.events", icon: CalendarDays },
  { id: "guest-list", labelKey: "navi.guest-list", icon: Users },
  { id: "email-settings", labelKey: "navi.email-settings", icon: Settings },
  { id: "help", labelKey: "navi.help", icon: HelpCircle },
  // Last, and an action rather than a tab: it leaves the dashboard for the
  // organizer registration form. The assistant offers the same thing, but an
  // Individual should not have to ask a chatbot to find the upgrade path.
  {
    id: BECOME_ORGANIZER_TAB,
    labelKey: "navi.become-organizer",
    icon: Building2,
    isAction: true,
  },
];

/**
 * The tab an Individual lands on — analytics, matching where organizers land.
 * (Not the assistant: that is a bubble available from every tab now, so it
 * does not need to be the landing page.) Must be one of INDIVIDUAL_NAV_ITEMS.
 */
export const INDIVIDUAL_HOME_TAB = "dashboard";

/**
 * Just the tab ids — action entries are excluded, since they never become the
 * active tab and nothing should treat them as a destination.
 */
export const INDIVIDUAL_TABS = INDIVIDUAL_NAV_ITEMS.filter(
  (i) => !i.isAction,
).map((i) => i.id);

/**
 * Sections of the commercial event form an Individual can fill in. Every
 * other section still appears in the form (seeing what an organizer account
 * unlocks is the point) but renders the upgrade panel instead of its fields.
 *
 * These three are exactly the ones that mean something without an organizer
 * behind them: what the event is, what it looks like, and who is coming.
 */
export const INDIVIDUAL_EVENT_SECTIONS = ["basic", "media", "visitors"];

/**
 * Capability flags, kept explicit so the limits are readable in one place
 * instead of being implied by scattered conditionals.
 */
export const INDIVIDUAL_CAN = {
  /**
   * Charge for tickets. False: Individuals have no payment integration
   * (no Razorpay / Stripe / bank details), so visitor-type prices are forced
   * to 0 in the UI. events.controller mirrors this server-side — the UI
   * lock is a convenience, not the enforcement.
   */
  chargeForTickets: false,
  /**
   * Send from their own address. True — the one organizer-grade feature they
   * get, because RSVP mail going out as a stranger's address reads as spam.
   * See organizers.service.updateEmailConfig, which exempts Individuals from
   * the customEmail plan gate.
   */
  customSenderEmail: true,
  /**
   * Create commercial (non-personal) events as well as personal ones —
   * limited to the sections above.
   */
  commercialEvents: true,
};
