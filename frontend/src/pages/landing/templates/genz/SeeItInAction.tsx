import { ScrollReveal } from "../shared/ScrollReveal";
import { SeeItInActionSectionProps } from "../types";

// Fallback art for a showcase event that has no image of its own.
const FALLBACK = {
  personal: "/landing/demo-wedding.jpg",
  professional: "/landing/demo-dashboard.jpg",
};

function imageFor(image: string | undefined, isPersonal: boolean): string {
  if (!image) return isPersonal ? FALLBACK.personal : FALLBACK.professional;
  if (image.startsWith("http")) return image;
  return `${__API_URL__}${image.startsWith("/") ? "" : "/"}${image}`;
}

/**
 * The admin-curated live demos. These are real events served by the real
 * backend in demo mode — the fetch lives in LandingPage, this only renders
 * what came back. With nothing curated the whole section goes: a heading
 * promising demos over an empty row costs more trust than no section at all,
 * which is also why "#demos" is deliberately not in the nav.
 */
export function SeeItInAction({
  showcaseEvents,
  onOpenDemo,
  onOpenDemoDashboard,
}: SeeItInActionSectionProps) {
  if (showcaseEvents.length === 0) return null;

  return (
    <section className="gzs" id="demos">
      <div className="wrap">
        <ScrollReveal>
          <div className="shead">
            <p className="eyebrow pink">Not a mock-up</p>
            <h2>
              Poke at a <span className="swoon pinkt">real one</span>.
            </h2>
            <p className="lede">
              These are live events running on Eventsh right now. Open one the
              way a guest would — some let you into the organizer's dashboard
              too.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="demos">
            {showcaseEvents.map((ev) => {
              const isPersonal = ev.showcaseKind === "personal";
              const hasDashboard =
                ev.showcaseMode === "dashboard" || ev.showcaseMode === "both";
              return (
                <article className="card demo" key={ev._id}>
                  <button
                    type="button"
                    className="shotimg"
                    onClick={() => onOpenDemo(ev._id)}
                    aria-label={`Open the live demo for ${ev.title || "this event"}`}
                  >
                    <img
                      src={imageFor(ev.image, isPersonal)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                  <div className="body">
                    <span
                      className="kind"
                      style={{
                        color: isPersonal ? "var(--pink)" : "var(--cyan)",
                      }}
                    >
                      {isPersonal
                        ? "Personal celebration"
                        : "Professional event"}
                    </span>
                    <h4>{ev.title || "Live event"}</h4>
                    {ev.showcaseBlurb && <p>{ev.showcaseBlurb}</p>}
                    <div className="open">
                      <button
                        type="button"
                        className="hi"
                        onClick={() => onOpenDemo(ev._id)}
                      >
                        Open the live page →
                      </button>
                      {hasDashboard && (
                        <button
                          type="button"
                          onClick={() => onOpenDemoDashboard(ev._id)}
                        >
                          {isPersonal
                            ? "Try the couple's dashboard →"
                            : "Try the organizer dashboard →"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
