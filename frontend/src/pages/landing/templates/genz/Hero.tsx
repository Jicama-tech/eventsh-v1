import { useEffect, useMemo, useState } from "react";

import { HeroSectionProps } from "../types";

// Left pane of the mock: what an organizer put on sale.
const TIERS = [
  {
    name: "Early bird",
    price: "25",
    dot: "linear-gradient(150deg,#c9ff3d,#6e9612)",
  },
  {
    name: "General",
    price: "40",
    dot: "linear-gradient(150deg,#a97bff,#4b2c8f)",
  },
  { name: "VIP", price: "120", dot: "linear-gradient(150deg,#ff4d9d,#8a2050)" },
  {
    name: "Student",
    price: "15",
    dot: "linear-gradient(150deg,#3de0ff,#136d80)",
  },
];

// Right pane: the sales feed, and the running gate total after each line.
const FEED = [
  { who: "Aarav", what: "Early bird", amt: "25" },
  { who: "Mei", what: "General", amt: "40" },
  { who: "Zoya", what: "VIP", amt: "120" },
  { who: "Dev", what: "Student", amt: "15" },
];
const TOTALS = ["25", "65", "185", "200"];

// A QR that only has to look like a QR. Fixed seed so it renders identically
// on every mount rather than flickering into a new pattern.
function useDecorativeQr(): boolean[] {
  return useMemo(() => {
    const g: boolean[][] = Array.from({ length: 9 }, () =>
      Array(9).fill(false),
    );
    const finder = (r0: number, c0: number) => {
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
          g[r0 + i][c0 + j] = i === 0 || i === 2 || j === 0 || j === 2;
      g[r0 + 1][c0 + 1] = true;
    };
    finder(0, 0);
    finder(0, 6);
    finder(6, 0);
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++) {
        const inFinder =
          (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
        if (!inFinder) g[r][c] = rnd() < 0.48;
      }
    return g.flat();
  }, []);
}

/**
 * The hero's device mock runs a looping four-beat story: tickets sell, the
 * gate total climbs, a pass is scanned, the guest is in. It is decorative, so
 * it is hidden from assistive tech and frozen at its end state when the
 * visitor has asked for reduced motion.
 */
function useCheckoutLoop(reduced: boolean) {
  const [step, setStep] = useState(reduced ? FEED.length : 0);
  const [scanning, setScanning] = useState(reduced);
  const [scanned, setScanned] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) =>
      timers.push(window.setTimeout(fn, ms));

    const cycle = () => {
      setStep(0);
      setScanning(false);
      setScanned(false);
      FEED.forEach((_, i) => at(700 + i * 900, () => setStep(i + 1)));
      at(4500, () => setScanning(true));
      at(6600, () => setScanned(true));
      at(9200, cycle);
    };
    cycle();

    return () => timers.forEach((t) => clearTimeout(t));
  }, [reduced]);

  return { step, scanning, scanned };
}

export function Hero({ onShowLogin }: HeroSectionProps) {
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const { step, scanning, scanned } = useCheckoutLoop(reduced);
  const qr = useDecorativeQr();

  return (
    <header className="hero" id="top">
      <span className="blob b1" aria-hidden="true" />
      <span className="blob b2" aria-hidden="true" />
      <span className="blob b3" aria-hidden="true" />

      <div className="wrap">
        <div>
          <p className="eyebrow">Events, but make it one tab</p>
          <h1>
            Your whole event.
            <br />
            <span className="swoon lime">One link.</span>
          </h1>
          <p className="lede">
            Tickets, exhibitor stalls, RSVPs and the door — all on one page,
            under your own name. No spreadsheet. No group-chat chaos.
          </p>

          <div className="herocta">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onShowLogin}
            >
              Start free
            </button>
            <a href="#screens" className="btn btn-ghost">
              See it working
            </a>
          </div>

          <div className="herofacts">
            {[
              "Free to start",
              "Live in an afternoon",
              "Runs on the phone you own",
            ].map((f) => (
              <span key={f}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {f}
              </span>
            ))}
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <span
            className="sticker"
            style={{
              top: -16,
              left: -10,
              background: "#ff4d9d",
              color: "#fff",
              transform: "rotate(-7deg)",
            }}
            aria-hidden="true"
          >
            live now
          </span>
          <span
            className="sticker"
            style={{
              bottom: -18,
              right: -6,
              background: "#c9ff3d",
              color: "#0a0710",
              transform: "rotate(5deg)",
            }}
            aria-hidden="true"
          >
            0% gate fee
          </span>

          <div className="device" aria-hidden="true">
            <div className="screen">
              <div className="pane left">
                <div className="paneh">
                  <span>Tickets</span>
                  <span>Summer Expo</span>
                </div>
                <div className="tiers">
                  {TIERS.map((t, i) => (
                    <div
                      key={t.name}
                      className={`tier${step === i + 1 ? " hit" : ""}`}
                    >
                      <div className="dot" style={{ background: t.dot }} />
                      <div className="nm">{t.name}</div>
                      <div className="pr">${t.price}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pane feed">
                <div className="paneh">
                  <span>Live</span>
                </div>
                <div className="feeditems">
                  {FEED.map((f, i) => (
                    <div key={f.who} className={`fi${step > i ? " on" : ""}`}>
                      <b>{f.who}</b>
                      <span>
                        {f.what} · ${f.amt}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="ftot">
                  <i>Gate today</i>
                  <b>${step > 0 ? TOTALS[step - 1] : "0"}</b>
                </div>
                <div className="fcta">Check people in</div>
              </div>

              <div className={`scanover${scanning ? " on" : ""}`}>
                <div className="qrbox">
                  {qr.map((on, i) => (
                    <i key={i} className={on ? "" : "o"} />
                  ))}
                </div>
                <div className="scanlabel">Scan the pass at the door</div>
                <div className={`scandone${scanned ? " on" : ""}`}>
                  <svg viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>Checked in</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
