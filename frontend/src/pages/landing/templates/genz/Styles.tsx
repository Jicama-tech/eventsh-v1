import { useEffect } from "react";

import genzCss from "./genz.css?raw";

// Webfonts for the template. Bricolage Grotesque carries the oversized
// headlines, Space Grotesk the body, Space Mono the eyebrows/figures, and
// Instrument Serif supplies the one italic word per headline.
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Instrument+Serif:ital@1&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap";

/**
 * Route-scoped chrome for the genz template: the stylesheet and its webfonts
 * are added to <head> on mount and removed on unmount, so the rest of the app
 * (which is Tailwind, and light in places) is never repainted by them. The
 * stylesheet itself is nested under `.gz` — see genz.css.
 */
export function Styles() {
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-landing", "genz");
    style.textContent = genzCss;

    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.setAttribute("data-landing", "genz-fonts");
    fonts.href = FONTS_HREF;

    document.head.append(fonts, style);
    return () => {
      style.remove();
      fonts.remove();
    };
  }, []);

  // The grain overlay sits above the page but below nothing clickable.
  return <div className="gz-grain" aria-hidden="true" />;
}
