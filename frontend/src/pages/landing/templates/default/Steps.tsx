import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { eventSteps } from "../shared/data";
import { StepsSectionProps } from "../types";

// "Create Your Event in 4 Easy Steps" carousel — kept from the original
// (already disabled there via `{false && ...}`). Preserved as an available
// section for any template that wants it.
export function Steps({
  activeStepIndex,
  setActiveStepIndex,
  isCarouselPaused,
  setIsCarouselPaused,
}: StepsSectionProps) {
  return (
    <section className="py-16 md:py-24 bg-[#0a0a0c] relative z-10">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-8 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Create Your Event in 4 Easy Steps
          </h2>
        </div>

        <div
          className="relative w-full aspect-[16/10] md:aspect-[17/10] rounded-t-2xl md:rounded-t-3xl overflow-hidden border-x border-t border-white/10 bg-[#121216] shadow-2xl group"
          onMouseEnter={() => setIsCarouselPaused(true)}
          onMouseLeave={() => setIsCarouselPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={activeStepIndex}
              src={eventSteps[activeStepIndex].image}
              loading="lazy"
              decoding="async"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              className="w-full h-full object-cover"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c]/40 to-transparent" />

          <div className="hidden sm:flex absolute inset-0 items-center justify-between px-4 md:px-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={() =>
                setActiveStepIndex(
                  (prev) => (prev - 1 + eventSteps.length) % eventSteps.length,
                )
              }
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/70 hover:border-white/40 transition-all"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setActiveStepIndex((prev) => (prev + 1) % eventSteps.length)}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/70 hover:border-white/40 transition-all"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-x border-white/10 rounded-b-2xl md:rounded-b-3xl bg-[#0d0d11] overflow-hidden">
          {eventSteps.map((step, index) => (
            <button
              key={index}
              onClick={() => setActiveStepIndex(index)}
              className={cn(
                "relative py-4 md:py-6 px-2 md:px-4 flex flex-col items-center gap-1 md:gap-2 transition-all group border-r border-white/5 last:border-r-0",
                "md:border-b-0 border-b border-b-white/5",
                "[&:nth-child(1)]:border-b md:[&:nth-child(1)]:border-b-0",
                "[&:nth-child(2)]:border-b md:[&:nth-child(2)]:border-b-0",
                "[&:nth-child(2)]:border-r-0 md:[&:nth-child(2)]:border-r",
                activeStepIndex === index ? "bg-[#16161c]" : "hover:bg-white/5",
              )}
            >
              <div
                className={cn(
                  "flex flex-col md:flex-row items-center gap-1 md:gap-3 transition-colors",
                  activeStepIndex === index
                    ? "text-primary"
                    : "text-slate-500 group-hover:text-slate-300",
                )}
              >
                <step.icon className="w-4 h-4 md:w-5 md:h-5" />
                <span className="font-bold text-xs sm:text-sm md:text-base uppercase tracking-wider text-center">
                  {step.title}
                </span>
              </div>

              {activeStepIndex === index && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-primary"
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
