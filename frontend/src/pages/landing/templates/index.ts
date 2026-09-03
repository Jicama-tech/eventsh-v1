import { LandingTemplate } from "./types";
import { defaultTemplate } from "./default";
import { eventshubTemplate } from "./eventshub";
import { genzTemplate } from "./genz";

// Registry of swappable landing-page templates. A white-label deployment
// adds its own directory here (e.g. templates/acme/index.ts, same
// LandingTemplate shape) and selects it via VITE_LANDING_TEMPLATE at build
// time — the page itself (LandingPage.tsx) owns all the data/state and is
// unaffected by which template renders it.
const TEMPLATES: Record<string, LandingTemplate> = {
  eventshub: eventshubTemplate,
  genz: genzTemplate,
  default: defaultTemplate,
};

// eventsh.com runs the eventshub template — the marketing campaign's page,
// painted in the genz palette. The two earlier designs are still here:
// build with VITE_LANDING_TEMPLATE=genz for the previous homepage, or
// =default for the one before that.
const FALLBACK = eventshubTemplate;

export function getLandingTemplate(): LandingTemplate {
  const key = (import.meta.env.VITE_LANDING_TEMPLATE as string) || "eventshub";
  return TEMPLATES[key] || FALLBACK;
}

// ShowcaseEvent comes through here too — LandingPage imports it from this
// barrel alongside getLandingTemplate.
export type { LandingTemplate, ShowcaseEvent } from "./types";
