import { ScrollReveal } from "../shared/ScrollReveal";
import {
  CMP,
  CMP_TXT,
  BRAND,
  LEDGER,
  PAY_METHODS,
  PERSONAL_FORMATS,
  PRO_FORMATS,
} from "./data";

/**
 * Rendered in the template's `Screens` slot: the money story (one ledger,
 * four ways to take payment), the two worlds this platform covers, and the
 * comparison that says where a ticketing tool stops.
 *
 * Colour discipline in the table: lime means Eventsh and only Eventsh, so
 * the competitor's one honest "Yes" is left neutral. Break that and the
 * column stops reading at a glance.
 */
export function Money() {
  return (
    <>
      {/* ---------- money ---------- */}
      <section className="eh-sec tight" id="money">
        <div className="eh-wrap">
          <ScrollReveal>
            <div className="eh-head">
              <span className="eh-kick">Money</span>
              <h2>
                Know your profit before the{" "}
                <span className="eh-swoon eh-limet">last guest</span> leaves.
              </h2>
              <p className="eh-lede">
                Take money four ways, and watch every unit land in the same
                ledger as your supplier bills.
              </p>
            </div>
          </ScrollReveal>

          <div className="eh-ba">
            <ScrollReveal>
              <div className="eh-ledger">
                {LEDGER.map((r) => (
                  <div className={`eh-lrow ${r.c}`} key={r.l}>
                    <span>{r.l}</span>
                    <b>{r.v}</b>
                  </div>
                ))}
                <div className="eh-lrow t">
                  <span>Net position</span>
                  <b>$72,460</b>
                </div>
              </div>
              <div className="eh-pays">
                {PAY_METHODS.map((m) => (
                  <span className="eh-pay" key={m}>
                    {m}
                  </span>
                ))}
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="eh-notes">
                <div>
                  <h3>Invoices raise themselves.</h3>
                  <p className="eh-lede" style={{ fontSize: 15 }}>
                    Every booking issues a tax-ready invoice the moment it is
                    paid. Supplier bills go on the same sheet, so income and
                    expense never live in two places.
                  </p>
                </div>
                <div>
                  <h3>Refunds without the spreadsheet.</h3>
                  <p className="eh-lede" style={{ fontSize: 15 }}>
                    Cancel a booking and the stall goes back on the map, the
                    invoice reverses, and the ledger corrects itself.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ---------- two worlds ---------- */}
      <section className="eh-sec tight" id="worlds">
        <div className="eh-wrap">
          <ScrollReveal>
            <div className="eh-head">
              <span className="eh-kick violet">Two worlds</span>
              <h2>
                Boardrooms and{" "}
                <span className="eh-swoon eh-pinkt">ballrooms</span>. Same
                platform.
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="eh-worlds">
              <div className="eh-world">
                <span className="eh-kick">Professional</span>
                <h3>Sell the floor, fill the seats.</h3>
                <p className="eh-lede">
                  Stalls with live pricing and add-ons, delegate tiers, speaker
                  applications and sponsor packages — priced, sold and settled
                  in one ledger.
                </p>
                <ul>
                  {PRO_FORMATS.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>

              <div className="eh-world personal">
                <span className="eh-kick pink">Personal</span>
                <h3>Every guest, every table, every dollar.</h3>
                <p className="eh-lede">
                  RSVP links, room allotment, round-table seating and ceremony
                  timelines — with the budget tracked beside them, so the
                  celebration does not quietly overrun.
                </p>
                <ul>
                  {PERSONAL_FORMATS.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ---------- comparison ---------- */}
      <section className="eh-sec tight" id="compare">
        <div className="eh-wrap narrow">
          <ScrollReveal>
            <div className="eh-head">
              <span className="eh-kick cyan">Compare</span>
              <h2>
                Ticketing tools stop at the{" "}
                <span className="eh-swoon eh-cyant">ticket</span>.
              </h2>
              <p className="eh-lede">
                Most platforms sell you entry and hand the rest back. Here is
                where the job actually ends.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="eh-cmp">
              <div className="eh-cmp-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Capability</th>
                      <th className="c">Ticketing tools</th>
                      <th className="c us">{BRAND}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CMP.map(([label, v]) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td
                          className={`c ${v === "part" ? "part" : v === "no" ? "no" : ""}`}
                        >
                          {CMP_TXT[v]}
                        </td>
                        <td className="c yes">Yes</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
