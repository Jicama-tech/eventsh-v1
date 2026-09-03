import { Bot } from "lucide-react";

import { ScrollReveal } from "../shared/ScrollReveal";
import { extras, modules, pillars } from "./data";

/**
 * "Everything's included" — three pillars, the module grid, and the wide AI
 * card that closes it. ScrollReveal wraps whole blocks rather than individual
 * cards: it renders a motion.div, which between a grid and its children would
 * break the grid.
 */
export function Modules() {
  return (
    <section className="gzs" id="modules">
      <div className="wrap">
        <ScrollReveal>
          <div className="shead">
            <p className="eyebrow">Everything's included</p>
            <h2>
              Six tools. <span className="swoon lime">One login.</span>
            </h2>
            <p className="lede">
              Nothing here is an add-on, and nothing costs extra to switch on.
              Professional expos and personal celebrations run on the same
              account.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="pillars">
            {pillars.map((p) => (
              <div className="pillar" key={p.k}>
                <div className="k">{p.k}</div>
                <h4>{p.t}</h4>
                <p>{p.p}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="mods">
            {modules.map((m) => (
              <article className="card mod" key={m.title}>
                <div className="ic" style={{ background: `${m.color}1f` }}>
                  <m.icon color={m.color} strokeWidth={2.1} />
                </div>
                <span className="tag">{m.tag}</span>
                <h3>{m.title}</h3>
                <p>{m.body}</p>
                <ul>
                  {m.chips.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </article>
            ))}

            <article className="card mod wide">
              <div
                className="ic"
                style={{
                  background: "#a97bff1f",
                  width: 56,
                  height: 56,
                  flex: "none",
                }}
              >
                <Bot color="#a97bff" strokeWidth={2.1} />
              </div>
              <div className="txt">
                <span className="tag">Built in</span>
                <h3 style={{ margin: "8px 0" }}>Just tell the assistant</h3>
                <p>
                  Ask it the way you'd say it out loud. It reads your own event
                  — bookings, approvals, guest lists — and answers with the
                  number, not a chart you have to decode.
                </p>
              </div>
              <div className="askcard">
                <p style={{ fontSize: "14.5px", color: "var(--muted)" }}>
                  "How many VIPs still haven't checked in?"
                </p>
                <p
                  style={{
                    fontSize: "15.5px",
                    color: "#dccfff",
                    fontWeight: 700,
                    marginTop: 10,
                  }}
                >
                  11 of 84 — mostly the 6pm arrivals.
                </p>
              </div>
            </article>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="extras">
            {extras.map((e) => (
              <span key={e}>{e}</span>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
