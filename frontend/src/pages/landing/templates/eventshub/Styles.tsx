import { useEffect } from "react";

import hubCss from "./hub.css?raw";

// Same four faces as the genz template: Bricolage Grotesque for the
// oversized headlines, Space Grotesk for body, Space Mono for eyebrows and
// figures, Instrument Serif for the one italic word per headline.
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Instrument+Serif:ital@1&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap";

/**
 * Route-scoped chrome for the eventshub template: the stylesheet and its
 * webfonts are added to <head> on mount and removed on unmount, so the rest
 * of the app (Tailwind, and light in places) is never repainted by them.
 *
 * The fonts go in as a <link>, never as a CSS `@import` inside the injected
 * stylesheet — Vite turns an @import in a lazy-chunk stylesheet into a
 * preload dependency, and a slow or blocked font request then rejects the
 * whole chunk and renders the landing page blank rather than falling back.
 */
export function Styles() {
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-landing", "eventshub");
    style.textContent = hubCss;

    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.setAttribute("data-landing", "eventshub-fonts");
    fonts.href = FONTS_HREF;

    document.head.append(fonts, style);
    return () => {
      style.remove();
      fonts.remove();
    };
  }, []);

  // The grain sits above the page but below anything clickable.
  return <div className="eh-grain" aria-hidden="true" />;
}
