import { useEffect } from "react";

import simpleCss from "./simple.css?raw";

// Two faces only: Familjen Grotesk for everything that reads, Martian Mono
// for the small uppercase tags. Loaded here rather than via a CSS @import —
// an @import inside a lazily-loaded stylesheet makes Vite's preload reject
// when fonts are slow, which blanks the whole page.
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;600;700&family=Martian+Mono:wght@400;500&display=swap";

/**
 * Route-scoped chrome for the simple template. The stylesheet and its
 * webfonts are added to <head> on mount and removed on unmount, so the rest
 * of the app is never repainted. Everything in simple.css is nested under
 * `.sp` as a second line of defence.
 */
export function Styles() {
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-landing", "simple");
    style.textContent = simpleCss;

    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.setAttribute("data-landing", "simple-fonts");
    fonts.href = FONTS_HREF;

    document.head.append(fonts, style);
    return () => {
      style.remove();
      fonts.remove();
    };
  }, []);

  return null;
}
