import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { faqs } from "../shared/data";
import { FAQSectionProps } from "../types";

// Kept from the original (already disabled there via `{false && ...}`).
// Preserved as an available section for any template that wants it.
export function FAQ({ openFaqIndex, setOpenFaqIndex }: FAQSectionProps) {
  return (
    <section className="py-24 bg-[#0a0a0c]">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-12 text-center">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-[#121216] border border-white/5 rounded-2xl overflow-hidden"
            >
              <button
                className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
              >
                <span className="text-lg font-bold text-white">{faq.question}</span>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-slate-400 transition-transform duration-300",
                    openFaqIndex === i && "rotate-180",
                  )}
                />
              </button>
              <AnimatePresence>
                {openFaqIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="px-8 pb-6 text-slate-400 leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
