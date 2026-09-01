import { useState } from "react";

import { ScrollReveal } from "../shared/ScrollReveal";

const TABS = [
  { id: "plan", label: "The floor plan" },
  { id: "door", label: "The door" },
  { id: "day", label: "The day" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Stall states for the floor-plan mock, laid out row by row. "aisle" is the
// walkway, "taken" is booked, "hot" is the stall being claimed right now.
const PLAN: Array<"free" | "taken" | "hot" | "aisle"> = [
  "taken",
  "taken",
  "free",
  "aisle",
  "taken",
  "free",
  "taken",
  "hot",
  "free",
  "aisle",
  "taken",
  "taken",
  "free",
  "free",
  "taken",
  "aisle",
  "free",
  "taken",
  "taken",
  "free",
  "taken",
  "aisle",
  "taken",
  "free",
];

const DOOR = [
  { who: "Aarav Menon", pass: "#EV-40921", type: "VIP", at: "18:04" },
  { who: "Mei Lin", pass: "#EV-40920", type: "General", at: "18:04" },
  { who: "Zoya Khan", pass: "#EV-40919", type: "Early bird", at: "18:03" },
  { who: "Dev Sharma", pass: "#EV-40918", type: "Student", at: "18:03" },
];

const KPIS = [
  { l: "Tickets sold", v: "1,284", d: "+12%" },
  { l: "Checked in", v: "961", d: "75% of gate" },
  { l: "Stalls booked", v: "38/44", d: "6 left" },
  { l: "Revenue", v: "48.2k", d: "+18%" },
];

const BARS = ["46%", "62%", "54%", "71%", "88%", "100%", "79%"];

/**
 * Three tabbed mock-ups covering an event day: sell the floor, open the door,
 * read the numbers back. These are CSS mock-ups, not screenshots — swap them
 * for real product captures once there are clean ones to use.
 */
export function Screens() {
  const [tab, setTab] = useState<TabId>("plan");

  return (
    <section className="gzs" id="screens">
      <div className="wrap">
        <ScrollReveal>
          <div className="shead">
            <p className="eyebrow cyan">See it</p>
            <h2>
              This is the <span className="swoon cyant">whole job</span>.
            </h2>
            <p className="lede">
              Three screens cover an event day: sell the floor, open the door,
              read the day back.
            </p>
          </div>
        </ScrollReveal>

        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="tab"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="shot">
          <div className="browserbar">
            <i style={{ background: "#ff4d9d" }} />
            <i style={{ background: "#ff8a3d" }} />
            <i style={{ background: "#c9ff3d" }} />
            <b>
              eventsh.com /{" "}
              {tab === "plan"
                ? "floor-plan"
                : tab === "door"
                  ? "check-in"
                  : "analytics"}
            </b>
          </div>

          {tab === "plan" && (
            <>
              <div className="floor">
                <div className="plan">
                  {PLAN.map((s, i) => (
                    <div key={i} className={`stall ${s}`}>
                      {s === "aisle" ? "" : `S${i + 1}`}
                    </div>
                  ))}
                </div>
                <div className="planside">
                  <div className="legend">
                    <div>
                      <i style={{ background: "rgba(255,77,157,.55)" }} />
                      Booked
                    </div>
                    <div>
                      <i style={{ background: "rgba(201,255,61,.6)" }} />
                      Being claimed now
                    </div>
                    <div>
                      <i style={{ background: "rgba(255,255,255,.14)" }} />
                      Still free
                    </div>
                  </div>
                  <div className="kpi">
                    <div className="l">Stall revenue</div>
                    <div className="v">31.4k</div>
                    <div className="d">6 stalls left</div>
                  </div>
                </div>
              </div>
              <p className="shotnote">
                Exhibitors pick their own stall on the live plan. Sold is sold —
                two vendors can't claim the same square.
              </p>
            </>
          )}

          {tab === "door" && (
            <>
              <div className="rows">
                <div className="row h">
                  <span>Guest</span>
                  <span className="hidesm">Pass</span>
                  <span className="amt">Ticket</span>
                  <span>Status</span>
                </div>
                {DOOR.map((d) => (
                  <div className="row" key={d.pass}>
                    <b>{d.who}</b>
                    <span className="mono hidesm">{d.pass}</span>
                    <span className="amt">{d.type}</span>
                    <span className="chipok">In · {d.at}</span>
                  </div>
                ))}
              </div>
              <p className="shotnote">
                Every pass is scanned once. The headcount on the dashboard moves
                in the same second.
              </p>
            </>
          )}

          {tab === "day" && (
            <>
              <div className="kpis">
                {KPIS.map((k) => (
                  <div className="kpi" key={k.l}>
                    <div className="l">{k.l}</div>
                    <div className="v">{k.v}</div>
                    <div className="d">{k.d}</div>
                  </div>
                ))}
              </div>
              <div className="bars">
                {BARS.map((h, i) => (
                  <i key={i} style={{ height: h }} />
                ))}
              </div>
              <div className="barlabels">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <p className="shotnote">
                The same numbers your finance person gets, exported to Excel in
                one click.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
