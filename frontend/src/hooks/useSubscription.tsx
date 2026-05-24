import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { jwtDecode } from "jwt-decode";
import { useAuth } from "./useAuth";

type FeedbackAudienceKey = "visitor" | "exhibitor" | "speaker" | "roundTable";

interface ModuleConfig {
  enabled: boolean;
  limit?: number;
  audiences?: Partial<Record<FeedbackAudienceKey, boolean>>;
  sections?: Record<string, boolean>;
}

export interface SubscriptionState {
  subscribed: boolean;
  planId: string | null;
  planName: string | null;
  pricePaid: string | null;
  validityInDays: number | null;
  planStartDate: string | null;
  planExpiryDate: string | null;
  isExpired: boolean;
  daysLeft: number;
  gracePeriodDays: number;
  inGracePeriod: boolean;
  graceDaysLeft: number;
  fullyLapsed: boolean;
  planActive: boolean;
  features: string[];
  modules: Record<string, ModuleConfig>;
  description: string | null;
}

interface SubscriptionContextValue {
  subscription: SubscriptionState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /**
   * Check if a module is enabled in the active plan.
   * Returns false if plan is fully lapsed (past grace period) or if the module
   * isn't included in the plan. Returns true during grace period.
   */
  isModuleEnabled: (key: string) => boolean;
  getModuleLimit: (key: string) => number | null;
  /**
   * Fine-grained gate for the Feedback module — returns true if the active
   * plan can collect feedback from the requested audience. False during
   * fully-lapsed state, or if the audience flag isn't set on the plan.
   */
  isFeedbackAudienceEnabled: (audience: FeedbackAudienceKey) => boolean;
  /**
   * Check if a specific sub-section inside a module (e.g. the "venue" tab
   * inside the "events" module) is enabled in the active plan. Missing
   * sections default to enabled so legacy plans without section data keep
   * working.
   */
  isModuleSectionEnabled: (moduleKey: string, sectionKey: string) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(
  undefined,
);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionState | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // React to auth state — re-fetch when user logs in / out / switches.
  const { user } = useAuth();

  const apiURL = __API_URL__;

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = sessionStorage.getItem("token");
      if (!token) {
        setSubscription(null);
        return;
      }
      const decoded: any = jwtDecode(token);
      const roles: string[] = Array.isArray(decoded?.roles) ? decoded.roles : [];
      // Individuals (Google-signed-in, no Organizer record yet) get a
      // permissive synthetic subscription so ModuleGate doesn't lock the
      // create-event tabs behind an Upgrade overlay during onboarding.
      // Empty `modules` triggers the existing permissive fallback in
      // isModuleEnabled / isModuleSectionEnabled — everything reads as
      // enabled. Real plan-based gating kicks in once they publish their
      // first event (lazy-creates the Organizer row + Individual plan).
      if (roles.includes("individual") && !roles.includes("organizer")) {
        setSubscription({
          subscribed: true,
          planId: null,
          planName: "Individual (onboarding)",
          pricePaid: null,
          validityInDays: null,
          planStartDate: null,
          planExpiryDate: null,
          isExpired: false,
          daysLeft: 0,
          gracePeriodDays: 0,
          inGracePeriod: false,
          graceDaysLeft: 0,
          fullyLapsed: false,
          planActive: true,
          features: [],
          modules: {},
          description: null,
        });
        return;
      }
      // Only organizers have real subscription docs; bail for other roles.
      if (!roles.includes("organizer")) {
        setSubscription(null);
        return;
      }
      const id = decoded.sub;
      const res = await fetch(`${apiURL}/organizers/subscription/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
      const data = await res.json();
      setSubscription(data);
    } catch (err: any) {
      setError(err.message);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [apiURL]);

  useEffect(() => {
    fetchSubscription();
    // Re-fetch any time the authenticated user changes (login/logout/switch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.sub, user?.roles?.[0]]);

  const isModuleEnabled = useCallback(
    (key: string) => {
      if (!subscription) return false;
      // Past grace period — every premium module is locked.
      if (subscription.fullyLapsed) return false;
      // No active plan at all — locked.
      if (!subscription.subscribed) return false;
      // Permissive fallback: if the plan has no modules object at all (or it's
      // empty), treat the subscription as unrestricted. Plans only restrict
      // when they explicitly list module flags.
      if (
        !subscription.modules ||
        Object.keys(subscription.modules).length === 0
      ) {
        return true;
      }
      const cfg = subscription.modules?.[key];
      if (!cfg?.enabled) return false;
      // For the feedback module, "enabled but no audiences picked" means
      // the plan effectively can't collect any feedback. Treat as off so
      // generic gates (e.g. show/hide the tab) hide instead of dangling.
      if (key === "feedback" && cfg.audiences) {
        return Object.values(cfg.audiences).some(Boolean);
      }
      return true;
    },
    [subscription],
  );

  const isFeedbackAudienceEnabled = useCallback(
    (audience: FeedbackAudienceKey) => {
      if (!subscription || subscription.fullyLapsed) return false;
      if (!subscription.subscribed) return false;
      // Unrestricted-plan permissive fallback — matches isModuleEnabled.
      if (
        !subscription.modules ||
        Object.keys(subscription.modules).length === 0
      ) {
        return true;
      }
      const cfg = subscription.modules?.feedback;
      if (!cfg?.enabled) return false;
      // If the plan ships feedback enabled but with no audiences object at
      // all (e.g. legacy rows), let everything through. Only restrict when
      // the audiences object exists.
      if (!cfg.audiences) return true;
      return !!cfg.audiences[audience];
    },
    [subscription],
  );

  const getModuleLimit = useCallback(
    (key: string) => {
      const cfg = subscription?.modules?.[key];
      if (!cfg) return null;
      return typeof cfg.limit === "number" ? cfg.limit : null;
    },
    [subscription],
  );

  const isModuleSectionEnabled = useCallback(
    (moduleKey: string, sectionKey: string) => {
      if (!subscription) return false;
      if (subscription.fullyLapsed) return false;
      if (!subscription.subscribed) return false;
      // Plan with no module config at all → unrestricted (legacy plans).
      if (
        !subscription.modules ||
        Object.keys(subscription.modules).length === 0
      ) {
        return true;
      }
      const cfg = subscription.modules?.[moduleKey];
      if (!cfg?.enabled) return false;
      // Module enabled but no per-section overrides recorded → all sections on.
      if (!cfg.sections || Object.keys(cfg.sections).length === 0) return true;
      return !!cfg.sections[sectionKey];
    },
    [subscription],
  );

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        error,
        refresh: fetchSubscription,
        isModuleEnabled,
        getModuleLimit,
        isFeedbackAudienceEnabled,
        isModuleSectionEnabled,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error(
      "useSubscription must be used inside <SubscriptionProvider>",
    );
  }
  return ctx;
}
