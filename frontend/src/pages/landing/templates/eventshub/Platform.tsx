import { ScrollReveal } from "../shared/ScrollReveal";
import { AFTER, BEFORE, BRAND, VALUES } from "./data";

/**
 * Rendered in the template's `Modules` slot: the before/after pair, then the
 * twelve numbered value cells that are the actual product argument.
 *
 * The cells are a bordered grid rather than twelve floating cards on
 * purpose — twelve cards read as a feature dump, one ruled table reads as a
 * spec sheet, and the claim here is completeness.
 */
export function Platform() {
  return (
    <>
      <section className="eh-sec tight">
        <div className="eh-wrap">
          <ScrollReveal>
            <div className="eh-head">
              <span className="eh-kick cyan">Day to day</span>
              <h2>
                Stop being the{" "}
                <span className="eh-swoon eh-cyant">integration layer</span>.
              </h2>
              <p className="eh-lede">
                Right now you are the thing holding the tools together.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="eh-ba">
              <div className="eh-col">
                <div className="hd">Without it</div>
                <ul>
                  {BEFORE.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
              <div className="eh-col after">
                <div className="hd">With {BRAND}</div>
                <ul>
                  {AFTER.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="eh-sec tight" id="platform">
        <div className="eh-wrap">
          <ScrollReveal>
            <div className="eh-head">
              <span className="eh-kick">What it does</span>
              <h2>
                One link runs the{" "}
                <span className="eh-swoon eh-limet">whole event</span>.
              </h2>
              <p className="eh-lede">
                Every one of these is on every plan. Nothing here is an upsell.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="eh-vgrid">
              {VALUES.map((v, i) => (
                <div className={`eh-vcell${v.lead ? " lead" : ""}`} key={v.t}>
                  <span className="n">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{v.t}</h3>
                  <p>{v.d}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
