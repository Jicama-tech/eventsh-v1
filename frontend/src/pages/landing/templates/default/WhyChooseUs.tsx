import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "../shared/ScrollReveal";
import { whyChooseFeatures } from "../shared/data";

// Full feature-grid — kept from the original (it was already disabled there
// via `{false && ...}`, superseded on-page by SeeItInAction's condensed
// two-card comparison). Preserved as an available section for any template
// that wants the fuller grid instead.
export function WhyChooseUs() {
  return (
    <section className="py-24 bg-[#1a1a1a]">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
              Why Choose EventsHub?
            </h2>
            <p className="text-base md:text-lg text-slate-400 leading-relaxed max-w-3xl mx-auto">
              One platform for every occasion — from ticketed expos,
              conferences and exhibitions to weddings and personal
              celebrations. Everything you need to plan, sell and host, in one
              place.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
          {whyChooseFeatures.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 5) * 0.05, duration: 0.4 }}
              className="bg-[#121216] rounded-xl border border-white/5 p-4 hover:border-white/10 transition-all group h-full"
              whileHover={{
                boxShadow: `0 0 20px 1px rgba(99,102,241,0.1)`,
                borderColor: "rgba(255,255,255,0.15)",
              }}
            >
              <div className="flex flex-col items-center text-center h-full">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-3 flex-shrink-0",
                    feature.color,
                  )}
                >
                  <feature.icon className="w-5 h-5" />
                </div>
                <h4 className="text-sm md:text-base font-bold text-white mb-2 line-clamp-2">
                  {feature.title}
                </h4>
                <p className="text-xs md:text-sm text-slate-400 leading-relaxed line-clamp-3">
                  {feature.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
