import { LandingTemplate } from "../types";
import { CTA } from "./CTA";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { Money } from "./Money";
import { Nav } from "./Nav";
import { Platform } from "./Platform";
import { Problem } from "./Problem";
import { Rollout } from "./Rollout";
import { SeeItInAction } from "./SeeItInAction";
import { Styles } from "./Styles";

/**
 * The eventshub template — the eventsh.com homepage.
 *
 * Structure and copy come from the EventsHub marketing campaign in
 * ../../../../../../eventshub-complete (the 50s reel and the Instagram
 * carousel): open on the cost of the current mess, show a floor plan selling
 * itself, lay out twelve capabilities as a spec sheet rather than a feature
 * dump, put income and expense in one ledger, cover both worlds the product
 * serves, say plainly where ticketing tools stop, then time the rollout.
 *
 * The paint is the genz palette rather than the campaign's warm graphite and
 * amber: acid lime and hot pink on near-black violet, Bricolage headlines
 * with one italic serif word each, sticker eyebrows, hard offset shadows and
 * a grain overlay. Amber's job — "this colour means us" — passes to lime, so
 * the accent is still spent on exactly one thing.
 *
 * The generic slots are named for the page, not for what they contain, so
 * the sections map onto them: Replaces → Problem, Modules → Platform,
 * Screens → Money, HowItWorks → Rollout.
 *
 * Like genz, this stays React components rather than one static HTML file,
 * because the page around it carries live pieces markup can't: the curated
 * showcase events, the public AI chatbot and the testimonials feed. Its look
 * lives in hub.css, injected for this route only by Styles and scoped under
 * `.eh` (rootClassName).
 */
export const eventshubTemplate: LandingTemplate = {
  rootClassName: "eh min-h-screen",
  Styles,
  Nav,
  Hero,
  Replaces: Problem,
  Modules: Platform,
  Screens: Money,
  SeeItInAction,
  HowItWorks: Rollout,
  CTA,
  Footer,
};
