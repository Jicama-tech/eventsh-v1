import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import { Star, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppFeedbackModal } from "./AppFeedbackModal";

const apiURL = __API_URL__;

interface FeaturedItem {
  _id: string;
  name: string;
  role?: string;
  rating: number;
  comment: string;
  city?: string;
  createdAt: string;
}

interface FeaturedResponse {
  items: FeaturedItem[];
}

interface StatsResponse {
  count: number;
  avg: number;
}

const ROLE_LABEL: Record<string, string> = {
  organizer: "Organizer",
  vendor: "Vendor",
  visitor: "Visitor",
  speaker: "Speaker",
  general: "",
};

// Deterministic gradient for the avatar circle so the same name always gets
// the same background — adds visual variety without server-side avatars.
function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  const a = `hsl(${hue}, 70%, 55%)`;
  const b = `hsl(${(hue + 40) % 360}, 70%, 45%)`;
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TestimonialsCarousel() {
  const [items, setItems] = useState<FeaturedItem[] | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fRes, sRes] = await Promise.all([
          fetch(`${apiURL}/app-feedback/featured`),
          fetch(`${apiURL}/app-feedback/stats`),
        ]);
        if (fRes.ok) {
          const fJson: FeaturedResponse = await fRes.json();
          if (!cancelled) setItems(fJson.items || []);
        } else if (!cancelled) {
          setItems([]);
        }
        if (sRes.ok) {
          const sJson: StatsResponse = await sRes.json();
          if (!cancelled) setStats(sJson);
        }
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When there's nothing to feature yet we still surface the CTA so visitors
  // can leave the first feedback — but skip the carousel headline + slides.
  if (items !== null && items.length === 0) {
    return (
      <section className="py-20 sm:py-24 bg-[#0a0a0c]">
        <div className="container mx-auto px-4">
          <FeedbackCta onOpen={() => setModalOpen(true)} />
        </div>
        <AppFeedbackModal open={modalOpen} onOpenChange={setModalOpen} />
      </section>
    );
  }

  return (
    <section className="py-20 sm:py-24 bg-[#0a0a0c]">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase mb-3">
            What our community says
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">
            Real words from the people who run, exhibit, and attend events on
            Eventsh.
          </h2>
          {stats && stats.count > 0 && (
            <div className="mt-6 inline-flex items-center gap-2 text-sm text-slate-400">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold text-white">{stats.avg}</span>
              <span>/ 5</span>
              <span className="text-slate-600">·</span>
              <span>
                from {stats.count}{" "}
                {stats.count === 1 ? "review" : "reviews"}
              </span>
            </div>
          )}
        </div>

        {items && items.length > 0 && (
          <Swiper
            modules={[Autoplay, Pagination]}
            spaceBetween={24}
            slidesPerView={1}
            breakpoints={{
              640: { slidesPerView: 1 },
              768: { slidesPerView: 2 },
              1024: { slidesPerView: 3 },
            }}
            autoplay={{
              delay: 5000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }}
            pagination={{ clickable: true }}
            loop={items.length > 3}
            className="testimonial-swiper !pb-12"
          >
            {items.map((t) => (
              <SwiperSlide key={t._id} className="h-auto">
                <div className="h-full bg-[#121216] rounded-2xl p-6 sm:p-7 border border-white/5 hover:border-white/15 transition-all flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ring-2 ring-white/5"
                      style={{ background: gradientFor(t._id + t.name) }}
                    >
                      {initialsOf(t.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {t.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {[ROLE_LABEL[t.role || "general"], t.city]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-0.5 mb-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={16}
                        className={
                          t.rating >= n
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-slate-700"
                        }
                      />
                    ))}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed flex-1">
                    "{t.comment}"
                  </p>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        )}

        <FeedbackCta onOpen={() => setModalOpen(true)} />
        <AppFeedbackModal open={modalOpen} onOpenChange={setModalOpen} />
      </div>

      {/* Swiper-specific overrides — the default bullets are too dark against
          the page bg. Scoped via the testimonial-swiper class. */}
      <style>{`
        .testimonial-swiper .swiper-pagination-bullet {
          background: rgba(255, 255, 255, 0.25);
          opacity: 1;
        }
        .testimonial-swiper .swiper-pagination-bullet-active {
          background: rgba(255, 255, 255, 0.85);
        }
      `}</style>
    </section>
  );
}

// Banner CTA — sits below the carousel (or replaces the section entirely
// when there are no featured testimonials yet). Matches the dark theme of
// the rest of the landing page sections.
function FeedbackCta({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="mt-12 max-w-3xl mx-auto rounded-2xl border border-white/5 bg-[#121216] p-8 text-center hover:border-white/15 transition-colors">
      <MessageSquare className="h-8 w-8 mx-auto text-primary mb-3" />
      <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
        Used Eventsh? Tell us how it went.
      </h3>
      <p className="text-sm text-slate-400 mb-5 max-w-md mx-auto">
        Organizer, vendor, speaker, or visitor — your honest feedback shapes
        the next release.
      </p>
      <Button size="lg" onClick={onOpen}>
        Share your thoughts
      </Button>
    </div>
  );
}
