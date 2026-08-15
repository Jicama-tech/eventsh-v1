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

export interface LandingTemplate {
  Nav: ComponentType<NavSectionProps>;
  Hero: ComponentType<HeroSectionProps>;
  SeeItInAction: ComponentType<SeeItInActionSectionProps>;
  CTA: ComponentType<CTASectionProps>;
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
