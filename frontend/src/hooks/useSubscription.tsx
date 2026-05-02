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

interface ModuleConfig {
  enabled: boolean;
  limit?: number;
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
      // Only organizers have subscriptions; bail for other roles.
      if (!decoded?.roles?.includes("organizer")) {
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
      return !!cfg?.enabled;
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

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        error,
        refresh: fetchSubscription,
        isModuleEnabled,
        getModuleLimit,
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
