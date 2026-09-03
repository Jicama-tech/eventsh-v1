import { LandingTemplate } from "../types";
import { CTA } from "./CTA";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Modules } from "./Modules";
import { Nav } from "./Nav";
import { Replaces } from "./Replaces";
import { Screens } from "./Screens";
import { SeeItInAction } from "./SeeItInAction";
import { Styles } from "./Styles";

/**
 * The genz template — the eventsh.com homepage.
 *
 * It borrows the structure that works on kioscart.com (sticky nav, a hero
 * with a self-running product mock, a ticker, a "this replaces" strip, the
 * module grid, tabbed screens, four steps, a final call to action) and
 * repaints it: acid lime and hot pink on near-black, oversized Bricolage
 * headlines with one italic serif word each, sticker badges and hard offset
 * shadows.
 *
 * Unlike kioscart's landing — one static HTML file mounted verbatim — this
 * stays React components, because the page around it carries live pieces the
 * markup can't: the curated showcase events, the public AI chatbot and the
 * testimonials feed. Its look lives in genz.css, injected for this route only
 * by Styles and scoped under `.gz` (rootClassName).
 */
export const genzTemplate: LandingTemplate = {
  rootClassName: "gz min-h-screen",
  Styles,
  Nav,
  Hero,
  Replaces,
  Modules,
  Screens,
  SeeItInAction,
  HowItWorks,
  CTA,
  Footer,
};
