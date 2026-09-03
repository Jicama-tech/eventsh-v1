import { ScrollReveal } from "../shared/ScrollReveal";
import { FAQS, STEPS } from "./data";

/**
 * Rendered in the template's `HowItWorks` slot: the five-step rollout with
 * its running total, then the FAQ.
 *
 * The FAQ is native <details>, not an accordion with state — it works with
 * JavaScript half-loaded, it is keyboard- and screen-reader-correct for
 * free, and it lets the page ship without threading open-index state back up
 * through LandingPage the way the default template's FAQ has to.
 */
export function Rollout() {
  return (
    <>
      <section className="eh-sec tight" id="rollout">
        <div className="eh-wrap">
          <ScrollReveal>
            <div className="eh-head">
              <span className="eh-kick">Go live today</span>
              <h2>
                Live before you{" "}
                <span className="eh-swoon eh-limet">finish lunch</span>.
              </h2>
              <p className="eh-lede">
                Setup to first booking, start to finish.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="eh-steps">
              {STEPS.map((s, i) => (
                <div className="eh-step" key={s.h}>
                  <span className="sn">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{s.h}</h3>
                    <p>{s.p}</p>
                  </div>
                  <span className="tm">{s.t}</span>
                </div>
              ))}
            </div>
            <div className="eh-total">
              <span>Setup, start to first booking</span>
              <b>≈ 1 hour</b>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="eh-sec tight" id="faq">
        <div className="eh-wrap narrow">
          <ScrollReveal>
            <div className="eh-head">
              <span className="eh-kick cyan">Questions</span>
              <h2>
                Before you <span className="eh-swoon eh-cyant">sign up</span>.
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="eh-faq">
              {FAQS.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
