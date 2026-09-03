import { ScrollReveal } from "../shared/ScrollReveal";
import { steps } from "./data";

export function HowItWorks() {
  return (
    <section className="gzs" id="steps">
      <div className="wrap">
        <ScrollReveal>
          <div className="shead">
            <p className="eyebrow violet">Launch</p>
            <h2>
              Open in <span className="swoon violett">four steps</span>.
            </h2>
            <p className="lede">
              Most organizers have their link out and their first registration
              in the same afternoon.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="steps">
            {steps.map((s) => (
              <div className="card step" key={s.n}>
                <div className="n">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.p}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
