// A "landing template" is a set of section components rendered by
// LandingPage.tsx — the page owns all shared state/data-fetching (nav open
// state, FAQ accordion state, the steps carousel, the live showcase-events
// fetch) and passes it down as props, so a white-label customer can supply a
// completely different set of section components under their own template
// key (see templates/index.ts) without touching any data/logic.
import { ComponentType } from "react";

export interface NavSectionProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  currentPath: string;
  onShowLogin: () => void;
}

export interface HeroSectionProps {
  onShowLogin: () => void;
}

export interface ShowcaseEvent {
  _id: string;
  title?: string;
  image?: string;
  showcaseKind?: "professional" | "personal";
  showcaseMode?: "demo" | "dashboard" | "both";
  showcaseBlurb?: string;
}

export interface SeeItInActionSectionProps {
  showcaseEvents: ShowcaseEvent[];
  onOpenDemo: (eventId: string) => void;
  onOpenDemoDashboard: (eventId: string) => void;
}

export interface StepsSectionProps {
  activeStepIndex: number;
  setActiveStepIndex: (i: number | ((prev: number) => number)) => void;
  isCarouselPaused: boolean;
  setIsCarouselPaused: (paused: boolean) => void;
}

export interface FAQSectionProps {
  openFaqIndex: number | null;
  setOpenFaqIndex: (i: number | null) => void;
}

export interface CTASectionProps {
  onShowLogin: () => void;
  onContactUs: () => void;
}

// A section that needs nothing from the page — most of a template's own
// static content sections.
type StaticSection = ComponentType<Record<string, never>>;

export interface LandingTemplate {
  // Class on the page wrapper. A template whose look lives in its own scoped
  // stylesheet (see templates/genz) names its scope here; omitted, the page
  // keeps its original dark Tailwind shell.
  rootClassName?: string;
  // Rendered first, before any section: where a template injects a
  // route-scoped stylesheet, its webfonts and any fixed overlay it needs.
  Styles?: StaticSection;
  Nav: ComponentType<NavSectionProps>;
  Hero: ComponentType<HeroSectionProps>;
  // Optional sections between the hero and the showcase. A template that
  // doesn't supply one simply doesn't get it — the default template supplies
  // none of them, so its page is unchanged.
  Replaces?: StaticSection;
  Modules?: StaticSection;
  Screens?: StaticSection;
  SeeItInAction: ComponentType<SeeItInActionSectionProps>;
  // Rendered after the public chatbot, before the testimonials.
  HowItWorks?: StaticSection;
  CTA: ComponentType<CTASectionProps>;
  // Replaces the shared site footer for this route only. Without it the page
  // renders components/ui/footer as before.
  Footer?: StaticSection;
  // Available but not currently rendered by LandingPage.tsx — they were
  // already disabled pre-refactor (`{false && ...}`). Kept here (and their
  // section components kept in default/) so a future toggle, or a
  // white-label template that wants them, doesn't have to rebuild them from
  // scratch. The page would need to reintroduce their backing state
  // (openFaqIndex, activeStepIndex, isCarouselPaused) to actually use them.
  WhyChooseUs?: ComponentType<Record<string, never>>;
  EverythingYouCanDo?: ComponentType<Record<string, never>>;
  Steps?: ComponentType<StepsSectionProps>;
  FAQ?: ComponentType<FAQSectionProps>;
}
