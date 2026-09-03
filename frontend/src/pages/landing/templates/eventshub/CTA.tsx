import { CTASectionProps } from "../types";

export function CTA({ onShowLogin, onContactUs }: CTASectionProps) {
  return (
    <section className="eh-sec tight">
      <div className="eh-wrap">
        <div className="eh-cta">
          <span className="eh-blob b1" aria-hidden="true" />
          <span className="eh-blob b2" aria-hidden="true" />

          <span className="eh-kick">Free to start</span>
          <h2>
            Your next event deserves{" "}
            <span className="eh-swoon eh-limet">one link</span>.
          </h2>
          <p className="eh-lede">
            Set it up in an afternoon, put it on your own domain, and take the
            first booking tonight.
          </p>
          <div className="eh-cta-btns">
            <button
              type="button"
              className="eh-btn eh-btn-p eh-btn-lg"
              onClick={onShowLogin}
            >
              Start free
            </button>
            <button
              type="button"
              className="eh-btn eh-btn-g eh-btn-lg"
              onClick={onContactUs}
            >
              Talk to a human
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
