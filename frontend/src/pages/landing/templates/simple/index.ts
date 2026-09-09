import { LandingTemplate } from "../types";
import { CTA } from "./CTA";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { Nav } from "./Nav";
import { SeeItInAction } from "./SeeItInAction";
import { Styles } from "./Styles";

/**
 * The "simple" template — the homepage stripped to one decision.
 *
 * A nav, one headline, three boxes, a thin footer. Around 130 words on the
 * whole page, against ~1,200 on the eventshub template. The argument it
 * replaces (twelve values, the comparison table, before/after, the ledger,
 * the FAQ) is not deleted — it belongs on /features, and the emotional pitch
 * belongs in the reel and the carousel, where attention has to be earned.
 * By the time someone is on the homepage they have already clicked: they
 * want to know what this is and see it working.
 *
 * The two demo boxes are the admin-curated showcase events, so the page shows
 * the product instead of describing it. The third box is the call to action,
 * which is why this template supplies no CTA band.
 *
 * Non-Latin scripts: the CSS keeps default letter-spacing and a 1.03 heading
 * line-height. If Hindi or Gujarati are switched on, matras will clip — add
 * the :lang() overrides from I18N-PLAN.md before shipping those locales.
 */
export const simpleTemplate: LandingTemplate = {
  rootClassName: "sp min-h-screen",
  Styles,
  Nav,
  Hero,
  SeeItInAction,
  CTA,
  Footer,
};
