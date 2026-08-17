import { LandingTemplate } from "./types";
import { defaultTemplate } from "./default";

// Registry of swappable landing-page templates. A white-label deployment
// adds its own directory here (e.g. templates/acme/index.ts, same
// LandingTemplate shape) and selects it via VITE_LANDING_TEMPLATE at build
// time — the page itself (LandingPage.tsx) owns all the data/state and is
// unaffected by which template renders it.
const TEMPLATES: Record<string, LandingTemplate> = {
  default: defaultTemplate,
};

export function getLandingTemplate(): LandingTemplate {
  const key = (import.meta.env.VITE_LANDING_TEMPLATE as string) || "default";
  return TEMPLATES[key] || defaultTemplate;
}

export type { LandingTemplate } from "./types";
