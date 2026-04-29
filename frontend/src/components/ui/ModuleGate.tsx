import { ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";

interface ModuleGateProps {
  /**
   * The plan module key this section requires (e.g. "events", "stalls",
   * "analytics"). When the active plan does not include this module, the
   * children are blurred and a "Upgrade" overlay is shown.
   */
  moduleKey: string;
  /** Children rendered when the module is enabled (or as the locked layer). */
  children: ReactNode;
  /** Optional override for the upgrade message. */
  fallbackText?: string;
  /** Action to take on Upgrade click — defaults to navigating to settings. */
  onUpgradeClick?: () => void;
  /** Hide children entirely (vs blur) when locked. */
  hideWhenLocked?: boolean;
}

export function ModuleGate({
  moduleKey,
  children,
  fallbackText,
  onUpgradeClick,
  hideWhenLocked = false,
}: ModuleGateProps) {
  const { isModuleEnabled, subscription } = useSubscription();
  const enabled = isModuleEnabled(moduleKey);

  if (enabled) return <>{children}</>;

  const handleUpgrade =
    onUpgradeClick ||
    (() => {
      // Default: switch to subscription tab via URL hash.
      window.location.hash = "subscription";
      const evt = new CustomEvent("organizer:open-subscription-tab");
      window.dispatchEvent(evt);
    });

  const message =
    fallbackText ||
    (subscription?.fullyLapsed
      ? "Your subscription has expired. Renew to access this feature."
      : !subscription?.subscribed
        ? "This feature requires an active plan."
        : `Upgrade your plan to unlock ${moduleKey}.`);

  if (hideWhenLocked) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-8 text-center">
        <div className="mx-auto h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center mb-3">
          <Lock className="h-5 w-5 text-amber-600" />
        </div>
        <p className="text-sm font-medium text-amber-900">{message}</p>
        <Button
          variant="default"
          size="sm"
          className="mt-3"
          onClick={handleUpgrade}
        >
          <Sparkles className="h-4 w-4 mr-1" />
          Upgrade Plan
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Blurred underlying content */}
      <div className="blur-sm pointer-events-none select-none opacity-60">
        {children}
      </div>
      {/* Lock overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <div className="rounded-xl bg-white/95 backdrop-blur shadow-lg border border-amber-200 p-5 max-w-sm text-center">
          <div className="mx-auto h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center mb-2">
            <Lock className="h-5 w-5 text-amber-600" />
          </div>
          <p className="text-sm font-medium text-slate-900 mb-1">
            Locked feature
          </p>
          <p className="text-xs text-muted-foreground mb-3">{message}</p>
          <Button size="sm" onClick={handleUpgrade}>
            <Sparkles className="h-4 w-4 mr-1" />
            Upgrade Plan
          </Button>
        </div>
      </div>
    </div>
  );
}
