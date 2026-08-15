import { LandingTemplate } from "../types";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { SeeItInAction } from "./SeeItInAction";
import { WhyChooseUs } from "./WhyChooseUs";
import { EverythingYouCanDo } from "./EverythingYouCanDo";
import { Steps } from "./Steps";
import { FAQ } from "./FAQ";
import { CTA } from "./CTA";

// The original eventsh landing page, split into swappable sections. This is
// the template used when no VITE_LANDING_TEMPLATE is set (or it doesn't
// match a registered key) — see templates/index.ts.
export const defaultTemplate: LandingTemplate = {
  Nav,
  Hero,
  SeeItInAction,
  WhyChooseUs,
  EverythingYouCanDo,
  Steps,
  FAQ,
  CTA,
};
