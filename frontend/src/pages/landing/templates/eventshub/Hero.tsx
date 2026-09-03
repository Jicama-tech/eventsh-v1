import { useEffect, useMemo, useRef, useState } from "react";

import { HeroSectionProps } from "../types";
import { FLOOR, SELLABLE, usd } from "./data";

/**
 * The ambient demo behind the hero: stalls sell themselves one at a time,
 * passes tick up, the net position climbs, and when the floor is full it
 * resets and starts again. It is a mock, not live data — the real live
 * events are further down the page in "See it in action".
 *
 * It stops while the tab is hidden (an interval that keeps firing in a
 * background tab is just wasted battery) and never starts at all under
 * prefers-reduced-motion, where the floor renders as a static half-sold plan.
 */
function useSellingFloor() {
  const seed = useMemo(() => [0, 2, 5, 7, 10], []);
  const [sold, setSold] = useState<number[]>(seed);
  const [passes, setPasses] = useState(306);
  const [spon, setSpon] = useState(16000);
  const paused = useRef(false);

  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    const onVis = () => (paused.current = document.hidden);
    document.addEventListener("visibilitychange", onVis);

    const id = window.setInterval(() => {
      if (paused.current) return;
      setSold((prev) => {
        const open = SELLABLE.map((_, i) => i).filter((i) => !prev.includes(i));
        if (!open.length) {
          setPasses(306);
          setSpon(16000);
          return seed;
        }
        if (Math.random() < 0.62) {
          return [...prev, open[Math.floor(Math.random() * open.length)]];
        }
        return prev;
      });
      setPasses((p) => p + 8 + Math.floor(Math.random() * 22));
      if (Math.random() < 0.18) setSpon((s) => s + 8000);
    }, 1200);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [seed]);

  const EXPENSE = 76800;
  const revenue =
    sold.reduce((t, i) => t + (SELLABLE[i].price ?? 0) + 600, 0) +
    passes * 180 +
    spon;

  return { sold, passes, net: revenue - EXPENSE };
}

export function Hero({ onShowLogin }: HeroSectionProps) {
  const { sold, passes, net } = useSellingFloor();

  return (
    <section className="eh-hero">
      <span className="eh-blob b1" aria-hidden="true" />
      <span className="eh-blob b2" aria-hidden="true" />

      <div className="eh-wrap eh-hero-grid">
        <div>
          <span className="eh-kick">Event operations platform</span>
          <h1>
            Nine days out.
            <br />
            <span className="eh-swoon eh-limet">Four spreadsheets.</span>
            <br />
            One of you.
          </h1>
          <p className="eh-lede">
            Eventsh replaces the whole stack with one link on your own domain —
            floor plans, registrations, payments, suppliers and profit.
          </p>
          <div className="eh-hero-btns">
            <button
              type="button"
              className="eh-btn eh-btn-p eh-btn-lg"
              onClick={onShowLogin}
            >
              Start free
            </button>
            <a href="#platform" className="eh-btn eh-btn-g eh-btn-lg">
              See how it works
            </a>
          </div>
          <p className="eh-hero-note">
            No card. No setup call. Live in about an hour.
          </p>
        </div>

        <div className="eh-demo-shell">
          <span className="eh-sticker">selling itself</span>

          <div className="eh-demo">
            <div className="eh-demo-bar">
              <div className="eh-dots">
                <i />
                <i />
                <i />
              </div>
              <div className="eh-url">
                events.yourbrand.com/<b>summit-2027</b>
              </div>
              <span className="eh-live">
                <i />
                Selling
              </span>
            </div>

            <div className="eh-floor">
              {FLOOR.map((c) => {
                const style = {
                  gridColumn: `${c.c} / span ${c.w}`,
                  gridRow: `${c.r} / span ${c.h}`,
                };
                if (c.zone) {
                  return (
                    <div
                      key={c.id}
                      className={`eh-zone${c.stage ? " stage" : ""}`}
                      style={style}
                    >
                      {c.label}
                    </div>
                  );
                }
                const idx = SELLABLE.findIndex((s) => s.id === c.id);
                const isSold = sold.includes(idx);
                return (
                  <div
                    key={c.id}
                    className={`eh-cell t${c.tier}${isSold ? " sold" : ""}`}
                    style={style}
                  >
                    <span>{c.id}</span>
                    <span className="px">{usd(c.price ?? 0)}</span>
                  </div>
                );
              })}
            </div>

            <div className="eh-demo-foot">
              <div>
                <span>Sold</span>
                <b className="g">
                  {sold.length} / {SELLABLE.length}
                </b>
              </div>
              <div>
                <span>Passes</span>
                <b>{passes}</b>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <span>Net position</span>
                <b className="a">{usd(net)}</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
