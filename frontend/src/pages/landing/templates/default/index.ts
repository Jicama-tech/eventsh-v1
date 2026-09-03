import { LandingTemplate } from "../types";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { SeeItInAction } from "./SeeItInAction";
import { WhyChooseUs } from "./WhyChooseUs";
import { EverythingYouCanDo } from "./EverythingYouCanDo";
import { Steps } from "./Steps";
import { FAQ } from "./FAQ";
import { CTA } from "./CTA";

// The original eventsh landing page, split into swappable sections. It is no
// longer what eventsh.com serves — the genz template is — but it stays
// registered under the "default" key, so VITE_LANDING_TEMPLATE=default brings
// it back. See templates/index.ts.
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
