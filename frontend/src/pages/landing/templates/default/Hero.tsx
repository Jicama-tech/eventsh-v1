import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ScrollReveal } from "../shared/ScrollReveal";
import { bentoImages } from "../shared/data";
import { HeroSectionProps } from "../types";

export function Hero({ onShowLogin }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden min-h-[100vh] flex items-center">
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <div
          className="absolute inset-0 flex flex-col gap-6 justify-center items-center"
          style={{ transform: "rotate(12deg) scale(1.5)" }}
        >
          {[...Array(8)].map((_, colIndex) => (
            <motion.div
              key={colIndex}
              className="flex gap-6"
              style={{ width: "max-content" }}
              animate={{
                x: colIndex % 2 === 0 ? [0, -1600] : [-1600, 0],
              }}
              transition={{
                duration: 60,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-96 h-56 rounded-2xl overflow-hidden border border-white/10"
                  style={{
                    backgroundImage: `url(${bentoImages[(i + colIndex) % bentoImages.length]})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    opacity: 1,
                  }}
                />
              ))}
            </motion.div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0c]/30 via-[#0a0a0c]/60 to-[#0a0a0c]/90" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-blue-500/15" />
      </div>

      <div className="container mx-auto px-4 relative z-10 pt-32 pb-20">
        <div className=" mx-auto text-center">
          <ScrollReveal>
            <h1 className="text-4xl sm:text-5xl md:text-8xl font-bold text-white mb-6 sm:mb-8 tracking-tight">
              EventsHub{" "}
              <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent text-4xl sm:text-5xl md:text-7xl">
                {" "}
                <br></br>Where People Connect
              </span>
            </h1>
            <p className="text-base sm:text-xl md:text-2xl text-slate-400 mb-10 sm:mb-12 leading-relaxed max-w-2xl mx-auto px-2">
              EventsHub: Master organizer, exhibitor, and visitors in one
              seamless move.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  size="xl"
                  onClick={onShowLogin}
                  className="bg-primary hover:bg-primary/90 text-white px-10 py-7 rounded-2xl font-bold text-lg shadow-[0_0_30px_rgba(var(--primary),0.3)]"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
