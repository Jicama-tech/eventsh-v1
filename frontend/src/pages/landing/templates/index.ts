import { LandingTemplate } from "./types";
import { defaultTemplate } from "./default";
import { genzTemplate } from "./genz";

// Registry of swappable landing-page templates. A white-label deployment
// adds its own directory here (e.g. templates/acme/index.ts, same
// LandingTemplate shape) and selects it via VITE_LANDING_TEMPLATE at build
// time — the page itself (LandingPage.tsx) owns all the data/state and is
// unaffected by which template renders it.
const TEMPLATES: Record<string, LandingTemplate> = {
  genz: genzTemplate,
  default: defaultTemplate,
};

// eventsh.com runs the genz template. The previous page is still here under
// the "default" key — build with VITE_LANDING_TEMPLATE=default to get it back.
const FALLBACK = genzTemplate;

export function getLandingTemplate(): LandingTemplate {
  const key = (import.meta.env.VITE_LANDING_TEMPLATE as string) || "genz";
  return TEMPLATES[key] || FALLBACK;
}

// ShowcaseEvent comes through here too — LandingPage imports it from this
// barrel alongside getLandingTemplate.
export type { LandingTemplate, ShowcaseEvent } from "./types";
