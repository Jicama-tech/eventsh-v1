import { marqueeWords, replaces } from "./data";

/**
 * The band between the hero and the feature grid: a lime ticker naming the
 * kinds of event the platform runs, then the list of things it takes off an
 * organizer's desk. The ticker's word list is rendered twice so the
 * translateX(-50%) loop meets itself with no visible seam.
 */
export function Replaces() {
  return (
    <>
      <div className="marquee" aria-hidden="true">
        <div className="track">
          {[0, 1].map((copy) =>
            marqueeWords.map((w) => <span key={`${copy}-${w}`}>{w}</span>),
          )}
        </div>
      </div>

      <section className="gzs replaces">
        <div className="wrap">
          <h3>
            One dashboard <span className="swoon pinkt">replaces</span>
          </h3>
          <div className="strike">
            {replaces.map((r) => (
              <span key={r}>{r}</span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
