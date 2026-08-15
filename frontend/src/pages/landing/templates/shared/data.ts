// Static content shared across landing page templates. Extracted verbatim
// from the original monolithic LandingPage.tsx (Phase 3a of the white-label
// plan) — same data, now reusable by any template's section components.
import {
  Calendar,
  BarChart3,
  Users,
  Globe,
  CalendarDays,
  Store,
  TrendingUp,
  Sparkles,
  Heart,
  Ticket,
  QrCode,
  Bed,
  Palette,
  Camera,
  Mail,
  MessageSquare,
  LayoutGrid,
} from "lucide-react";

export const faqs = [
  {
    question: "How much does it cost to use Eventsh?",
    answer:
      "Eventsh offers flexible pricing, including a starter plan for small events and growing brands. Higher tiers unlock deeper analytics, automation, and advanced support.",
  },
  {
    question: "Can I sell tickets and products on the platform?",
    answer:
      "Yes. Eventsh lets you sell event tickets and physical or digital products from one unified dashboard, with inventory, orders, and payments managed in a single place.",
  },
  {
    question: "Is Eventsh suitable for virtual and hybrid events?",
    answer:
      "Eventsh supports in‑person, virtual, and hybrid events, with tools for registrations, ticketing, communications, and attendee engagement across formats.",
  },
];

export const eventSteps = [
  { number: 1, title: "Register", image: "/step1.webp", icon: CalendarDays },
  { number: 2, title: "Customize", image: "/step2.webp", icon: Sparkles },
  { number: 3, title: "Create", image: "/step3.webp", icon: TrendingUp },
  { number: 4, title: "Manage", image: "/step4.webp", icon: BarChart3 },
];

export const whyChooseFeatures = [
  // ---- Professional events (expos, conferences, concerts) ----
  {
    icon: Ticket,
    title: "Ticketing & Early-Bird Pricing",
    desc: "Multiple ticket types, coupons and pricing tiers for expos, concerts and conferences.",
    color: "text-blue-400",
  },
  {
    icon: Store,
    title: "Exhibitor Stall Booking",
    desc: "Vendors claim stalls on a live, drag-and-drop venue floor plan.",
    color: "text-rose-400",
  },
  {
    icon: Users,
    title: "Multi-Role Registration",
    desc: "Branded onboarding for visitors, exhibitors, vendors and speakers.",
    color: "text-emerald-400",
  },
  {
    icon: QrCode,
    title: "Contactless QR Check-In",
    desc: "Attendees scan their own QR passes for instant, contactless entry.",
    color: "text-purple-400",
  },
  {
    icon: CalendarDays,
    title: "Speakers & Sessions",
    desc: "Manage speaker slots, applications and session schedules with ease.",
    color: "text-cyan-400",
  },
  {
    icon: BarChart3,
    title: "Revenue & Sales Analytics",
    desc: "Live ticket, stall and revenue insights across every event.",
    color: "text-amber-400",
  },
  // ---- Personal events (weddings & celebrations) ----
  {
    icon: Heart,
    title: "RSVP & Guest Lists",
    desc: "Collect RSVPs per function with age, side and attendance breakdowns.",
    color: "text-rose-400",
  },
  {
    icon: Bed,
    title: "Room Allotment",
    desc: "Assign rooms to guests — even share one room across two families.",
    color: "text-blue-400",
  },
  {
    icon: Palette,
    title: "Designer Wedding Themes",
    desc: "Beautiful themes, fonts and an “Our Story” timeline built in minutes.",
    color: "text-purple-400",
  },
  {
    icon: Calendar,
    title: "Ceremonies & Countdown",
    desc: "Multi-function schedules, live ceremony announcements and a countdown.",
    color: "text-emerald-400",
  },
  {
    icon: Camera,
    title: "Photo Galleries",
    desc: "Share your best moments in elegant, responsive photo galleries.",
    color: "text-cyan-400",
  },
  {
    icon: Mail,
    title: "QR Room & Entry Passes",
    desc: "Email guests QR passes for event check-in and hotel-room access.",
    color: "text-amber-400",
  },
  // ---- Works for both ----
  {
    icon: MessageSquare,
    title: "Built-in AI Assistant",
    desc: "Run any event by chat — bookings, approvals, guest lists and more.",
    color: "text-purple-400",
  },
  {
    icon: Globe,
    title: "Branded Event Pages",
    desc: "Every event gets a beautiful public page under your own brand.",
    color: "text-cyan-400",
  },
  {
    icon: LayoutGrid,
    title: "One Dashboard, Every Event",
    desc: "Manage professional and personal events side by side.",
    color: "text-blue-400",
  },
];

export const bentoImages = [
  "/image1.webp",
  "/image2.webp",
  "/image3.webp",
  "/image4.webp",
  "/image5.webp",
  "/image6.webp",
];

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/contact", label: "Contact Us" },
];
