import { motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "../shared/ScrollReveal";
import { whyChooseFeatures } from "../shared/data";
import { SeeItInActionSectionProps } from "../types";

// "One platform, two kinds of events" — two feature-comparison cards plus an
// auto-rotating carousel of the admin-curated live demo events
// (showcaseEvents, fetched by the page and passed down).
export function SeeItInAction({
  showcaseEvents,
  onOpenDemo,
  onOpenDemoDashboard,
}: SeeItInActionSectionProps) {
  return (
    <section className="py-24 bg-[#1a1a1a]">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.25em] text-indigo-400 mb-4">
              Everything you need
            </span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5 tracking-tight">
              One platform, two kinds of events
            </h2>
            <p className="text-base md:text-lg text-slate-400 leading-relaxed max-w-3xl mx-auto">
              From ticketed expos and exhibitor stalls to intimate weddings —
              here's exactly what each one includes.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid gap-6 lg:grid-cols-2 max-w-5xl mx-auto mb-20">
          {[
            {
              eyebrow: "For Businesses & Organizers",
              title: "Professional Events",
              sub: "Expos · Conferences · Concerts · Exhibitions",
              accent: "text-sky-400",
              ring: "border-sky-500/30",
              feats: whyChooseFeatures.slice(0, 6),
            },
            {
              eyebrow: "For Personal Celebrations",
              title: "Personal Events",
              sub: "Weddings · Engagements · Family functions",
              accent: "text-rose-400",
              ring: "border-rose-500/30",
              feats: whyChooseFeatures.slice(6, 12),
            },
          ].map((col) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className={cn("rounded-2xl border bg-[#121216] p-6 md:p-8", col.ring)}
            >
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.2em]",
                  col.accent,
                )}
              >
                {col.eyebrow}
              </span>
              <h3 className="mt-2 text-2xl font-bold text-white">{col.title}</h3>
              <p className="mb-6 text-sm text-slate-400">{col.sub}</p>
              <ul className="space-y-4">
                {col.feats.map((f) => (
                  <li key={f.title} className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/5",
                        f.color,
                      )}
                    >
                      <f.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{f.title}</p>
                      <p className="text-xs leading-relaxed text-slate-400">
                        {f.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {showcaseEvents.length > 0 && (
          <>
            <ScrollReveal>
              <div className="text-center mb-10">
                <span className="inline-block text-xs font-semibold uppercase tracking-[0.25em] text-indigo-400 mb-3">
                  See it in action
                </span>
                <h3 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                  Explore our live demos
                </h3>
                <p className="mt-3 text-sm md:text-base text-slate-400 max-w-2xl mx-auto">
                  Tap any demo to open the real, live page — some include a
                  read-only dashboard too.
                </p>
              </div>
            </ScrollReveal>
            <Swiper
              modules={[Autoplay]}
              slidesPerView="auto"
              spaceBetween={24}
              loop
              autoplay={{
                delay: 3000,
                disableOnInteraction: false,
                pauseOnMouseEnter: true,
              }}
              className="demos-marquee w-full !py-2"
            >
              {[...showcaseEvents, ...showcaseEvents].map((ev, ci) => {
                const isPersonal = ev.showcaseKind === "personal";
                const label = isPersonal
                  ? "For Personal Celebrations"
                  : "For Businesses & Organizers";
                const accent = isPersonal ? "text-rose-400" : "text-sky-400";
                const evImg = ev?.image
                  ? ev.image.startsWith("http")
                    ? ev.image
                    : `${__API_URL__}${ev.image.startsWith("/") ? "" : "/"}${ev.image}`
                  : isPersonal
                    ? "/landing/demo-wedding.jpg"
                    : "/landing/demo-dashboard.jpg";
                return (
                  <SwiperSlide
                    key={`${ev._id}-${ci}`}
                    className="!h-auto !w-[85%] sm:!w-[360px]"
                  >
                    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#121216] p-6">
                      <span
                        className={cn(
                          "text-xs font-semibold uppercase tracking-[0.2em]",
                          accent,
                        )}
                      >
                        {label}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenDemo(ev._id)}
                        className="group mt-4 block w-full overflow-hidden rounded-xl border border-white/10"
                      >
                        <img
                          src={evImg}
                          alt={ev?.title || ""}
                          loading="lazy"
                          decoding="async"
                          className="w-full aspect-[16/9] object-cover object-top transition-transform duration-500 group-hover:scale-105"
                        />
                        <span className="flex items-center justify-center gap-1.5 bg-black/40 py-2 text-xs font-semibold text-white">
                          Open the live demo →
                        </span>
                      </button>
                      {(ev.showcaseMode === "dashboard" || ev.showcaseMode === "both") && (
                        <button
                          type="button"
                          onClick={() => onOpenDemoDashboard(ev._id)}
                          className="mt-4 w-full rounded-lg border border-sky-500/40 bg-sky-500/10 py-2.5 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/20"
                        >
                          {isPersonal
                            ? "Try the couple's dashboard →"
                            : "Try the organizer dashboard →"}
                        </button>
                      )}
                    </div>
                  </SwiperSlide>
                );
              })}
            </Swiper>
          </>
        )}
      </div>
    </section>
  );
}
