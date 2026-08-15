import { motion } from "framer-motion";
import {
  Ticket,
  Store,
  Users,
  Calendar,
  Heart,
  CheckCircle2,
  Bed,
  QrCode,
  BarChart3,
  MessageSquare,
  TrendingUp,
  Shield,
} from "lucide-react";
import { ScrollReveal } from "../shared/ScrollReveal";

// Full capability toolkit grid — kept from the original (already disabled
// there via `{false && ...}`). Preserved as an available section for any
// template that wants the exhaustive feature breakdown.
const CAPABILITIES = [
  {
    icon: Ticket,
    color: "text-blue-400",
    title: "Ticketing & Registration",
    items: [
      "Multiple ticket types & pricing tiers",
      "Coupons & early-bird discounts",
      "Walk-in / kiosk booking",
      "QR e-tickets via email & WhatsApp",
      "Multi-role registration",
    ],
  },
  {
    icon: Store,
    color: "text-rose-400",
    title: "Exhibitors & Stalls",
    items: [
      "Live floor-plan stall booking",
      "Vendor onboarding & profiles",
      "Payment approval & security deposits",
      "Edit & cancellation requests",
      "GST / UEN verification",
    ],
  },
  {
    icon: Users,
    color: "text-emerald-400",
    title: "Speakers & Sessions",
    items: [
      "Speaker slots & applications",
      "Session schedules & timing",
      "Approve speakers & issue passes",
    ],
  },
  {
    icon: Calendar,
    color: "text-cyan-400",
    title: "Round Tables",
    items: [
      "Gala & dinner seating",
      "Book by whole table or per chair",
      "Live seat availability",
    ],
  },
  {
    icon: Heart,
    color: "text-rose-400",
    title: "Weddings & Personal",
    items: [
      "Multi-function schedules",
      "“Our Story” timeline & gallery",
      "Designer themes & fonts",
      "Live ceremony announcements",
      "Countdown & directions",
    ],
  },
  {
    icon: CheckCircle2,
    color: "text-purple-400",
    title: "RSVP & Guests",
    items: [
      "RSVP per function",
      "Age & side breakdowns",
      "Guest-list export",
      "Attendance tracking",
    ],
  },
  {
    icon: Bed,
    color: "text-blue-400",
    title: "Room Allotment",
    items: [
      "Assign hotel rooms to guests",
      "Share one room across families",
      "Email QR room passes",
      "Occupancy & capacity checks",
    ],
  },
  {
    icon: QrCode,
    color: "text-purple-400",
    title: "Check-in & On-site",
    items: [
      "Contactless QR check-in",
      "Operators & volunteer helpers",
      "Kiosk mode",
      "Re-issue lost tickets",
    ],
  },
  {
    icon: BarChart3,
    color: "text-amber-400",
    title: "Payments & Revenue",
    items: [
      "Integrated payments",
      "Deposits & refunds",
      "Revenue & sales tracking",
      "Platform-fee management",
    ],
  },
  {
    icon: MessageSquare,
    color: "text-purple-400",
    title: "Built-in AI Assistant",
    items: [
      "Manage events by chat",
      "Approvals & payment confirmations",
      "Guest lists & pending queues",
      "Answers grounded in your data",
    ],
  },
  {
    icon: TrendingUp,
    color: "text-cyan-400",
    title: "Analytics & Feedback",
    items: [
      "Live dashboards",
      "Per-event statistics",
      "Historical event analysis",
      "Post-event feedback",
    ],
  },
  {
    icon: Shield,
    color: "text-blue-400",
    title: "Team, Branding & Plans",
    items: [
      "Operators with scoped access",
      "White-label branded pages",
      "Custom store link & storefront",
      "Memberships, plans & add-ons",
    ],
  },
];

export function EverythingYouCanDo() {
  return (
    <section className="py-24 bg-[#0a0a0c]">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.25em] text-indigo-400 mb-4">
              Everything you can do
            </span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5 tracking-tight">
              A complete toolkit — no add-ons required
            </h2>
            <p className="text-base md:text-lg text-slate-400 leading-relaxed max-w-3xl mx-auto">
              Every capability, in one platform. Here's the full picture, so
              you always know what's possible.
            </p>
          </div>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {CAPABILITIES.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 3) * 0.06, duration: 0.4 }}
              className="rounded-xl border border-white/5 bg-[#121216] p-5 hover:border-white/15 transition-all"
            >
              <div
                className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-4 ${c.color}`}
              >
                <c.icon className="w-5 h-5" />
              </div>
              <h4 className="text-white font-bold mb-3">{c.title}</h4>
              <ul className="space-y-2">
                {c.items.map((it, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-2 text-sm text-slate-400 leading-relaxed"
                  >
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${c.color}`} />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
