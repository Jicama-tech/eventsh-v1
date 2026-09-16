import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";

/**
 * Light/dark theming for the dashboard, ported from kioscart-v1.
 *
 * Everything is driven by the CSS custom properties already declared in
 * index.css — `:root` for light, `.dark` for dark — which Tailwind reads
 * through its `darkMode: ["class"]` config. next-themes only puts the right
 * class on <html> and remembers the choice.
 *
 * The organizer's choice applies to the organizer dashboard only — the one
 * screen that has ThemeToggle. next-themes stores a single, site-wide
 * preference and puts `.dark` on <html>, so without scoping, picking dark in
 * the dashboard also turned every public page dark for that browser: event
 * pages, stall/speaker forms, ticket cart, payment pages, storefronts. Those
 * are what visitors, exhibitors and speakers see, so everywhere else is
 * forced light. `forcedTheme` only overrides what is painted; the stored
 * preference is untouched and comes straight back on the dashboard.
 *
 * Screens that open *inside* the dashboard but face a visitor (kiosk mode,
 * the storefront template view) opt out with useForceLightTheme(); a single
 * customer-facing card inside a dashboard screen uses `.theme-light-only`.
 *
 * The landing page is deliberately unaffected: it commits to its own dark
 * design in literal colours and uses no theme tokens or `dark:` utilities, so
 * neither the `.dark` class nor this forcing reaches it either way.
 */

// Paths where the organizer's own light/dark choice is honoured.
const THEMED_PATHS = ["/organizer-dashboard"];

const followsUserTheme = (pathname: string) =>
  THEMED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

// Registers a visitor-facing screen that must render light while mounted;
// returns the matching unregister. A counter, so overlapping screens nest.
const ForceLightContext = createContext<() => () => void>(() => () => {});

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const { pathname } = useLocation();
  const [forceLightCount, setForceLightCount] = useState(0);

  const registerForceLight = useCallback(() => {
    setForceLightCount((n) => n + 1);
    return () => setForceLightCount((n) => Math.max(0, n - 1));
  }, []);

  const forcedTheme =
    followsUserTheme(pathname) && forceLightCount === 0 ? undefined : "light";

  return (
    <NextThemesProvider {...props} forcedTheme={forcedTheme}>
      <ForceLightContext.Provider value={registerForceLight}>
        {children}
      </ForceLightContext.Provider>
    </NextThemesProvider>
  );
}

/**
 * Keeps the page light while the calling component is mounted (and `active`),
 * even inside the dashboard — for screens a visitor looks at. Portalled
 * dialogs and toasts follow too, since the whole document is switched rather
 * than one subtree.
 */
export function useForceLightTheme(active = true) {
  const registerForceLight = useContext(ForceLightContext);
  useEffect(() => {
    if (!active) return;
    return registerForceLight();
  }, [active, registerForceLight]);
}
