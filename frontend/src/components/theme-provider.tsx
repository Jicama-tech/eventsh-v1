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
 * The landing page is deliberately unaffected: it commits to its own dark
 * design and injects its own stylesheet with literal colours, so the `.dark`
 * class on <html> does not reach it either way.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
