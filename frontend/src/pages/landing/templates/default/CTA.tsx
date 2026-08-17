import { Button } from "@/components/ui/button";
import { CTASectionProps } from "../types";

export function CTA({ onShowLogin, onContactUs }: CTASectionProps) {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/5" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center bg-[#121216] p-12 md:p-20 rounded-[3rem] border border-white/5 shadow-2xl">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-8">
            Ready to Scale?
          </h2>
          <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">
            Join thousands of organizers and businesses growing with Eventsh.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="xl"
              onClick={onShowLogin}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-12 py-7 rounded-2xl font-bold text-lg"
            >
              Get Started Now
            </Button>
            <Button
              size="xl"
              variant="outline"
              onClick={onContactUs}
              className="w-full sm:w-auto border-white/10 hover:bg-white/5 text-white px-12 py-7 rounded-2xl font-bold text-lg bg-black"
            >
              Contact Sales
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
