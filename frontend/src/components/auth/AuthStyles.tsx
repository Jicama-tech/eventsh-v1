import { useEffect } from "react";

import authCss from "./auth-theme.css?raw";

// The same four faces the landing template loads, so sign-in reads as the
// same site: Bricolage Grotesque for the headline, Space Grotesk for body,
// Space Mono for eyebrows and labels, Instrument Serif for the italic word.
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Instrument+Serif:ital@1&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap";

/**
 * Route-scoped chrome for the sign-in screen: the stylesheet and its webfonts
 * go into <head> on mount and come out on unmount, so the dashboard — which
 * is Tailwind and themeable — is never repainted by them.
 *
 * The fonts load as a <link>, never as a CSS `@import` inside the injected
 * stylesheet: Vite turns an @import in a lazy-chunk stylesheet into a preload
 * dependency, and a slow or blocked font request then rejects the chunk and
 * renders a blank screen instead of falling back to a system font.
 */
export function AuthStyles() {
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-auth-theme", "eventsh");
    style.textContent = authCss;

    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.setAttribute("data-auth-theme", "eventsh-fonts");
    fonts.href = FONTS_HREF;

    document.head.append(fonts, style);
    return () => {
      style.remove();
      fonts.remove();
    };
  }, []);

  return null;
}
