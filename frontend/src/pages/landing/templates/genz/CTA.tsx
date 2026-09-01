import { CTASectionProps } from "../types";

export function CTA({ onShowLogin, onContactUs }: CTASectionProps) {
  return (
    <section className="gzs finalcta">
      <span
        className="blob b1"
        style={{ left: "12%", top: "-200px" }}
        aria-hidden="true"
      />
      <span
        className="blob b2"
        style={{ right: "10%", bottom: "-220px" }}
        aria-hidden="true"
      />
      <div className="wrap">
        <h2>
          Put your event
          <br />
          <span className="swoon lime">on Eventsh.</span>
        </h2>
        <p className="lede">
          Free to start. Talk to us when you outgrow it — not before.
        </p>
        <div className="herocta">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onShowLogin}
          >
            Start free
          </button>
          <button type="button" className="btn btn-ghost" onClick={onContactUs}>
            Talk to a human
          </button>
        </div>
      </div>
    </section>
  );
}
