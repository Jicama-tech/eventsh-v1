import { ScrollReveal } from "../shared/ScrollReveal";
import { PAINS, STATS } from "./data";

/**
 * Rendered in the template's `Replaces` slot: the four-figure stat strip
 * directly under the hero, then the problem the product exists to solve —
 * six real messages an organiser gets in the last week before an event.
 *
 * The strip is deliberately full-bleed (its own `.eh-strip` band rather than
 * a card inside `.eh-wrap`) so it reads as a rule between the hero and the
 * argument, the way it does in the campaign.
 */
export function Problem() {
  return (
    <>
      <section className="eh-strip">
        <div className="eh-strip-in">
          {STATS.map((s) => (
            <div className="eh-stat" key={s.n + s.t}>
              <b>{s.n}</b>
              <span>{s.t}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="eh-sec" id="problem">
        <div className="eh-wrap">
          <ScrollReveal>
            <div className="eh-head">
              <span className="eh-kick pink">The problem</span>
              <h2>
                Running an event is{" "}
                <span className="eh-swoon eh-pinkt">eleven jobs</span> at once.
              </h2>
              <p className="eh-lede">
                And every one of them lives somewhere else.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="eh-pains">
              {PAINS.map((p) => (
                <div className={`eh-pain ${p.cls ?? ""}`} key={p.msg}>
                  <div className="who">{p.who}</div>
                  <div className="msg">{p.msg}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
