import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/ui/navbar";
import Footer from "@/components/ui/footer";
import FeatureCard from "@/components/ui/featureCard";
import SectionHeader from "@/components/ui/sectionHeader";
import { motion, useScroll, useTransform, useSpring, AnimatePresence, Variants } from "framer-motion";
import {
  Calendar,
  ShoppingBag,
  BarChart3,
  Users,
  Shield,
  Zap,
  Globe,
  Smartphone,
  ArrowRight,
  CalendarDays,
  Store,
  TrendingUp,
  ChevronDown,
  CheckCircle2,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import { TestimonialsCarousel } from "@/components/landing/TestimonialsCarousel";
import { PublicChatbot } from "@/components/landing/PublicChatbot";
import { cn } from "@/lib/utils";
import { startDemoDashboard } from "@/lib/demoDashboard";
import { useState, useRef, ReactNode, useEffect } from "react";
import { Menu, X } from "lucide-react";

const faqs = [
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

const testimonials = [
  {
    name: "Rajesh, Event Organizer",
    description: "Founder of \"Tech Innovate 2024\"",
    text: `Eventsh made managing our conference a breeze. The analytics and attendee tools saved us countless hours.`,
  },
  {
    name: "Priya, Attendee",
    description: "Freelance Designer",
    text: `Discovering and registering for events is super smooth. Everything I need is in one place.`,
  },
];

const eventSteps = [
  {
    number: 1,
    title: "Register",
    image: "/step1.webp",
    icon: CalendarDays,
  },
  {
    number: 2,
    title: "Customize",
    image: "/step2.webp",
    icon: Sparkles,
  },
  {
    number: 3,
    title: "Create",
    image: "/step3.webp",
    icon: TrendingUp,
  },
  {
    number: 4,
    title: "Manage",
    image: "/step4.webp",
    icon: BarChart3,
  },
];

const whyChooseFeatures = [
  // ---- Professional events (expos, conferences, concerts) ----
  { icon: Ticket, title: "Ticketing & Early-Bird Pricing", desc: "Multiple ticket types, coupons and pricing tiers for expos, concerts and conferences.", color: "text-blue-400" },
  { icon: Store, title: "Exhibitor Stall Booking", desc: "Vendors claim stalls on a live, drag-and-drop venue floor plan.", color: "text-rose-400" },
  { icon: Users, title: "Multi-Role Registration", desc: "Branded onboarding for visitors, exhibitors, vendors and speakers.", color: "text-emerald-400" },
  { icon: QrCode, title: "Contactless QR Check-In", desc: "Attendees scan their own QR passes for instant, contactless entry.", color: "text-purple-400" },
  { icon: CalendarDays, title: "Speakers & Sessions", desc: "Manage speaker slots, applications and session schedules with ease.", color: "text-cyan-400" },
  { icon: BarChart3, title: "Revenue & Sales Analytics", desc: "Live ticket, stall and revenue insights across every event.", color: "text-amber-400" },
  // ---- Personal events (weddings & celebrations) ----
  { icon: Heart, title: "RSVP & Guest Lists", desc: "Collect RSVPs per function with age, side and attendance breakdowns.", color: "text-rose-400" },
  { icon: Bed, title: "Room Allotment", desc: "Assign rooms to guests — even share one room across two families.", color: "text-blue-400" },
  { icon: Palette, title: "Designer Wedding Themes", desc: "Beautiful themes, fonts and an “Our Story” timeline built in minutes.", color: "text-purple-400" },
  { icon: Calendar, title: "Ceremonies & Countdown", desc: "Multi-function schedules, live ceremony announcements and a countdown.", color: "text-emerald-400" },
  { icon: Camera, title: "Photo Galleries", desc: "Share your best moments in elegant, responsive photo galleries.", color: "text-cyan-400" },
  { icon: Mail, title: "QR Room & Entry Passes", desc: "Email guests QR passes for event check-in and hotel-room access.", color: "text-amber-400" },
  // ---- Works for both ----
  { icon: MessageSquare, title: "Built-in AI Assistant", desc: "Run any event by chat — bookings, approvals, guest lists and more.", color: "text-purple-400" },
  { icon: Globe, title: "Branded Event Pages", desc: "Every event gets a beautiful public page under your own brand.", color: "text-cyan-400" },
  { icon: LayoutGrid, title: "One Dashboard, Every Event", desc: "Manage professional and personal events side by side.", color: "text-blue-400" },
];

interface ScrollRevealProps {
  children: ReactNode;
  direction?: "up" | "down" | "left" | "right";
  delay?: number;
}

const ScrollReveal = ({
  children,
  direction = "up",
  delay = 0,
}: ScrollRevealProps) => {
  const variants: Variants = {
    hidden: {
      opacity: 0,
      y: direction === "up" ? 50 : direction === "down" ? -50 : 0,
      x: direction === "left" ? 50 : direction === "right" ? -50 : 0,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        delay,
        ease: "easeOut",
      },
    },
    exit: {
      opacity: 0,
      y: direction === "up" ? 20 : direction === "down" ? -20 : 0,
      scale: 0.98,
      transition: { duration: 0.3 },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, margin: "-100px" }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
};

const LandingPage = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Admin-curated live demo events shown in "See it in action". Clicking a card
  // opens its real (demo-mode) eventfront.
  const [showcaseEvents, setShowcaseEvents] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${__API_URL__}/events/showcase`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setShowcaseEvents(Array.isArray(j?.data) ? j.data : []))
      .catch(() => setShowcaseEvents([]));
  }, []);

  // Auto-advance carousel every 3000ms (pauses on hover)
  useEffect(() => {
    if (isCarouselPaused) return;

    const timer = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % eventSteps.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isCarouselPaused]);

  const onShowLogin = () => {
    navigate("/organizer/login");
  };

  const contactUs = () => {
    navigate("/contact");
  };

  const links = [
    { href: "/", label: "Home" },
    { href: "/contact", label: "Contact Us" },
  ];

  const features = [
    {
      icon: Globe,
      title: "Global Ready",
      desc: "Multi-language support and currency handling for worldwide business.",
      color: "text-blue-400",
    },
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      desc: "Data-driven decisions with comprehensive reporting dashboards.",
      color: "text-emerald-400",
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      desc: "Enterprise-grade security with automatic backups and encryption.",
      color: "text-purple-400",
    },
    {
      icon: Zap,
      title: "Full Customization",
      desc: "Automate orders, receipts, notifications, and everything else.",
      color: "text-amber-400",
    },
    {
      icon: Smartphone,
      title: "Mobile First",
      desc: "Beautiful responsive design that works perfectly on any device.",
      color: "text-rose-400",
    },
    {
      icon: Users,
      title: "24/7 Support",
      desc: "Expert support team ready to help you grow your business.",
      color: "text-cyan-400",
    },
  ];

  const bentoImages = [
    "/image1.webp",
    "/image2.webp",
    "/image3.webp",
    "/image4.webp",
    "/image5.webp",
    "/image6.webp",
  ];

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-slate-200 selection:bg-primary/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-auto flex items-center"
              >
                <img
                  src="/EventshLogo.png"
                  alt="Eventsh"
                  className="object-contain h-12 w-auto brightness-110"
                />
              </motion.div>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {links.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "text-sm font-medium transition-all hover:text-primary relative group",
                    location.pathname === link.href
                      ? "text-primary"
                      : "text-slate-400",
                  )}
                >
                  {link.label}
                  <span
                    className={cn(
                      "absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full",
                      location.pathname === link.href && "w-full",
                    )}
                  />
                </Link>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant="default"
                  onClick={onShowLogin}
                  className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)] transition-all duration-300"
                >
                  Get Started
                </Button>
              </motion.div>
            </div>

            <button
              className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-white/5 bg-[#0a0a0c]"
            >
              <div className="container mx-auto px-4 py-4 space-y-4">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={cn(
                      "block py-2 text-sm font-medium transition-colors",
                      location.pathname === link.href
                        ? "text-primary"
                        : "text-slate-400 hover:text-white",
                    )}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <Button
                  variant="default"
                  onClick={() => {
                    setIsOpen(false);
                    onShowLogin();
                  }}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  Get Started
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[100vh] flex items-center">
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <div className="absolute inset-0 flex flex-col gap-6 justify-center items-center" style={{ transform: "rotate(12deg) scale(1.5)" }}>
            {[...Array(8)].map((_, colIndex) => (
              <motion.div
                key={colIndex}
                className="flex gap-6"
                style={{ width: "max-content" }}
                animate={{
                  x: colIndex % 2 === 0 ? [0, -1600] : [-1600, 0]
                }}
                transition={{
                  duration: 60,
                  repeat: Infinity,
                  ease: "linear"
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
          Dark overlay gradient
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0c]/30 via-[#0a0a0c]/60 to-[#0a0a0c]/90" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-blue-500/15" />
        </div>

        <div className="container mx-auto px-4 relative z-10 pt-32 pb-20">
          <div className=" mx-auto text-center">
            <ScrollReveal>
              <h1 className="text-4xl sm:text-5xl md:text-8xl font-bold text-white mb-6 sm:mb-8 tracking-tight">
                EventsHub <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent text-4xl sm:text-5xl md:text-7xl"> <br></br>Where People Connect</span>
              </h1>
              <p className="text-base sm:text-xl md:text-2xl text-slate-400 mb-10 sm:mb-12 leading-relaxed max-w-2xl mx-auto px-2">
                EventsHub: Master organizer, exhibitor, and visitors in one seamless move. 
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
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

      {/* How it works — two guided journeys */}
      <section className="py-24 bg-[#1a1a1a]">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="inline-block text-xs font-semibold uppercase tracking-[0.25em] text-indigo-400 mb-4">
                How it works
              </span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5 tracking-tight">
                From idea to a live event — in minutes
              </h2>
              <p className="text-base md:text-lg text-slate-400 leading-relaxed max-w-3xl mx-auto">
                Two clear journeys, one platform. Follow the steps for a business
                event or a personal celebration — no training or documentation
                needed.
              </p>
            </div>
          </ScrollReveal>
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 max-w-6xl mx-auto">
            {[
              {
                kind: "professional",
                label: "For Businesses & Organizers",
                accent: "text-sky-400",
                ring: "border-sky-500/40 text-sky-300",
                img: "/landing/demo-dashboard.jpg",
                steps: [
                  { t: "Create your event", d: "Pick a type (expo, conference, concert…), add dates, venue and details." },
                  { t: "Set up ticketing", d: "Add multiple ticket types, coupons and early-bird pricing — or make it free." },
                  { t: "Design your venue", d: "Use the drag-and-drop floor plan to open exhibitor stalls, speaker slots and round tables." },
                  { t: "Publish a branded page", d: "Your logo, colours and gallery on a public page — share the link anywhere." },
                  { t: "Sell & manage", d: "Approve exhibitors, confirm payments, handle edit/cancellation requests — or just ask the AI." },
                  { t: "Check in & analyse", d: "Scan QR passes on the day; track revenue, tickets, stalls and attendance live." },
                ],
              },
              {
                kind: "personal",
                label: "For Personal Celebrations",
                accent: "text-rose-400",
                ring: "border-rose-500/40 text-rose-300",
                img: "/landing/demo-wedding.jpg",
                steps: [
                  { t: "Create your celebration", d: "Choose a wedding or personal event and add your couple, hosts and functions." },
                  { t: "Make it yours", d: "Pick a designer theme and fonts, then add your “Our Story” timeline and photo gallery." },
                  { t: "Publish & invite", d: "Share a beautiful, mobile invitation with directions, a countdown and RSVP." },
                  { t: "Collect RSVPs", d: "Guests respond per function; see exactly who's coming, with age and side breakdowns." },
                  { t: "Allot rooms", d: "Assign hotel rooms, share a room across two families, and email QR room passes." },
                  { t: "Go live", d: "Announce ceremonies as they start and manage the whole day by chat." },
                ],
              },
            ]
              // Each journey card is tied to its admin-curated demo event.
              // If that demo is hidden/unfeatured (no matching showcase event),
              // the whole card is hidden.
              .filter((col) =>
                showcaseEvents.some((e) => e.showcaseKind === col.kind),
              )
              .map((col, ci) => {
              const ev = showcaseEvents.find(
                (e) => e.showcaseKind === col.kind,
              );
              const evImg = ev?.image
                ? ev.image.startsWith("http")
                  ? ev.image
                  : `${__API_URL__}${
                      ev.image.startsWith("/") ? "" : "/"
                    }${ev.image}`
                : col.img;
              return (
              <motion.div
                key={ci}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: ci * 0.1, duration: 0.5 }}
                className="rounded-2xl border border-white/10 bg-[#121216] p-6 md:p-8"
              >
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.2em]",
                    col.accent,
                  )}
                >
                  {col.label}
                </span>
                {/* The demo eventfront created in the Super Admin — click to
                    open the real (demo-mode) page. */}
                <button
                  type="button"
                  onClick={() => ev && navigate(`/demo/events/${ev._id}`)}
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
                {/* The organizer dashboard (read-only) — shown when the admin
                    enabled it for this demo. */}
                {ev &&
                  (ev.showcaseMode === "dashboard" ||
                    ev.showcaseMode === "both") && (
                  <button
                    type="button"
                    onClick={() => startDemoDashboard(ev._id)}
                    className="mt-3 w-full rounded-lg border border-sky-500/40 bg-sky-500/10 py-2.5 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/20"
                  >
                    {col.kind === "personal"
                      ? "Try the couple's dashboard →"
                      : "Try the organizer dashboard →"}
                  </button>
                )}
                <div className="mt-7 space-y-6">
                  {col.steps.map((s, i) => (
                    <div key={i} className="flex gap-4">
                      <div
                        className={cn(
                          "flex-shrink-0 w-9 h-9 rounded-full border flex items-center justify-center text-sm font-bold",
                          col.ring,
                        )}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">{s.t}</h4>
                        <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                          {s.d}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* See it in action — LIVE admin-curated demo events. Clicking a card
          opens its real eventfront in demo mode. Hidden for now. */}
      {false && showcaseEvents.length > 0 && (
        <section className="py-24 bg-[#0a0a0c] relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[420px] rounded-full opacity-20 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(99,102,241,0.55), transparent)",
            }}
          />
          <div className="container mx-auto px-4 relative">
            <div className="text-center mb-14">
              <span className="inline-block text-xs font-semibold uppercase tracking-[0.25em] text-indigo-400 mb-4">
                See it in action
              </span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5 tracking-tight">
                Explore real event pages
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Tap any demo below to open the live page — a professional event
                or a personal celebration. It's exactly what your guests would
                see.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
              {showcaseEvents.map((e) => {
                const img = e.image
                  ? e.image.startsWith("http")
                    ? e.image
                    : `${__API_URL__}${
                        e.image.startsWith("/") ? "" : "/"
                      }${e.image}`
                  : "";
                const isPersonal = e.showcaseKind === "personal";
                return (
                  <button
                    key={e._id}
                    type="button"
                    onClick={() => navigate(`/demo/events/${e._id}`)}
                    className="group text-left rounded-2xl overflow-hidden border border-white/10 bg-[#111114] hover:border-indigo-400/60 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-[#1a1a1f]">
                      {img ? (
                        <img
                          src={img}
                          alt={e.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-indigo-500/30 to-pink-500/20" />
                      )}
                      <span
                        className={cn(
                          "absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur",
                          isPersonal
                            ? "bg-rose-500/80 text-white"
                            : "bg-indigo-500/80 text-white",
                        )}
                      >
                        {isPersonal ? "Personal" : "Professional"}
                      </span>
                    </div>
                    <div className="p-5">
                      <h3 className="text-xl font-bold text-white">
                        {e.title}
                      </h3>
                      {e.showcaseBlurb && (
                        <p className="mt-1.5 text-sm text-gray-400 line-clamp-2">
                          {e.showcaseBlurb}
                        </p>
                      )}
                      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400 group-hover:gap-2.5 transition-all">
                        Open live demo →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* See it in action — hidden for now */}
      {false && (
      <section className="py-24 bg-[#0a0a0c] relative overflow-hidden">
        {/* soft decorative glow — pure CSS, no image weight */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[420px] rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(99,102,241,0.55), transparent)",
          }}
        />
        <div className="container mx-auto px-4 relative">
          <ScrollReveal>
            <div className="text-center mb-14">
              <span className="inline-block text-xs font-semibold uppercase tracking-[0.25em] text-indigo-400 mb-4">
                See it in action
              </span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-5 tracking-tight">
                One platform, every kind of event
              </h2>
              <p className="text-base md:text-lg text-slate-400 leading-relaxed max-w-3xl mx-auto">
                From ticketed expos and exhibitor stalls to intimate weddings —
                run the whole thing from a branded page, a live dashboard and an
                AI assistant. Here's a real look at each.
              </p>
            </div>
          </ScrollReveal>

          <div className="max-w-6xl mx-auto space-y-20 md:space-y-28">
            {[
              {
                eyebrow: "For Businesses & Organizers",
                title: "A branded event page that sells",
                desc: "Give every event a beautiful public page — under your own brand, taking bookings the moment you publish.",
                points: [
                  "Multiple ticket types with early-bird pricing",
                  "Exhibitor stall booking on a live venue map",
                  "Speakers, sponsors & a built-in AI assistant",
                ],
                img: "/landing/demo-professional.jpg",
                url: "eventsh.com/…/events/dummy-event",
                accent: "text-sky-400",
              },
              {
                eyebrow: "For Businesses & Organizers",
                title: "Run everything from one dashboard",
                desc: "Track events, ticket sales, stalls and revenue at a glance — then drill into any event for the detail.",
                points: [
                  "Live revenue, tickets & stall analytics",
                  "Per-event cards with sales progress",
                  "Coupons, platform fees, feedback & more",
                ],
                img: "/landing/demo-dashboard.jpg",
                url: "eventsh.com/organizer-dashboard",
                accent: "text-indigo-400",
              },
              {
                eyebrow: "AI, built in",
                title: "Your AI event assistant",
                desc: "Manage the whole event by chat — ask for your events, approvals, payments or a guest list and act on it instantly.",
                points: [
                  '"Show me all my events" → actionable cards',
                  "Approve pending exhibitors & confirm payments",
                  "Answers grounded in your real event data",
                ],
                img: "/landing/demo-chatbot.jpg",
                url: "eventsh.com/…/assistant",
                accent: "text-violet-400",
              },
              {
                eyebrow: "For Personal Celebrations",
                title: "Weddings, beautifully done",
                desc: "A romantic, fully-themed invite you can build in minutes — your story, ceremonies, gallery and countdown.",
                points: [
                  'Designer themes, fonts & an "Our Story" timeline',
                  "Photo gallery & live ceremony announcements",
                  "Shareable invite with directions & RSVP",
                ],
                img: "/landing/demo-wedding.jpg",
                url: "eventsh.com/…/aarav-and-diya",
                accent: "text-rose-400",
              },
              {
                eyebrow: "For Personal Celebrations",
                title: "RSVP & guest management",
                desc: "Collect RSVPs per function, see exactly who's coming, and allot rooms — even share one room across two families.",
                points: [
                  "Guest list with age & per-function breakdown",
                  "Room allotment, incl. rooms shared across parties",
                  "Export lists & email QR room passes",
                ],
                img: "/landing/demo-rsvp.jpg",
                url: "eventsh.com/…/participants",
                accent: "text-emerald-400",
              },
            ].map((d, i) => {
              const flip = i % 2 === 1;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.55 }}
                  className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center"
                >
                  {/* Screenshot in a browser frame */}
                  <div
                    className={cn(
                      "group",
                      flip ? "lg:order-2" : "lg:order-1",
                    )}
                  >
                    <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#121216] shadow-2xl transition-all group-hover:border-white/20">
                      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/10 bg-[#16161b]">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                        <div className="ml-3 flex-1 rounded-md bg-white/5 px-3 py-1 text-[11px] text-slate-500 truncate">
                          {d.url}
                        </div>
                      </div>
                      <div className="overflow-hidden">
                        {/* Looping muted clip so the pitch feels alive; the JPG
                            poster paints instantly while the tiny mp4/webm loads. */}
                        <video
                          poster={d.img}
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="metadata"
                          aria-label={d.title}
                          className="w-full aspect-[16/10] object-cover object-top"
                        >
                          <source
                            src={d.img.replace(/\.jpg$/, ".webm")}
                            type="video/webm"
                          />
                          <source
                            src={d.img.replace(/\.jpg$/, ".mp4")}
                            type="video/mp4"
                          />
                        </video>
                      </div>
                    </div>
                  </div>
                  {/* Feature copy */}
                  <div className={cn(flip ? "lg:order-1" : "lg:order-2")}>
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase tracking-[0.2em]",
                        d.accent,
                      )}
                    >
                      {d.eyebrow}
                    </span>
                    <h3 className="text-2xl md:text-3xl font-bold text-white mt-3 mb-4 tracking-tight">
                      {d.title}
                    </h3>
                    <p className="text-base text-slate-400 leading-relaxed mb-6">
                      {d.desc}
                    </p>
                    <ul className="space-y-3">
                      {d.points.map((pt, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-3 text-slate-300"
                        >
                          <CheckCircle2
                            className={cn(
                              "w-5 h-5 mt-0.5 flex-shrink-0",
                              d.accent,
                            )}
                          />
                          <span className="text-sm md:text-base">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* Public AI chatbot — FAQ + first-event onboarding (inline Google auth) */}
      <PublicChatbot />

      {/* Why Choose Us — hidden for now */}
      {false && (
      <section className="py-24 bg-[#1a1a1a]">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
                Why Choose EventsHub?
              </h2>
              <p className="text-base md:text-lg text-slate-400 leading-relaxed max-w-3xl mx-auto">
                One platform for every occasion — from ticketed expos, conferences and exhibitions to weddings and personal celebrations. Everything you need to plan, sell and host, in one place.
              </p>
            </div>
          </ScrollReveal>

          {/* Feature Cards Grid - 5 columns x 6 rows */}
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
                  <div className={cn("w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-3 flex-shrink-0", feature.color)}>
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm md:text-base font-bold text-white mb-2 line-clamp-2">{feature.title}</h4>
                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed line-clamp-3">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}


      {/* Everything you can do — hidden for now */}
      {false && (
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
            {[
              { icon: Ticket, color: "text-blue-400", title: "Ticketing & Registration", items: ["Multiple ticket types & pricing tiers", "Coupons & early-bird discounts", "Walk-in / kiosk booking", "QR e-tickets via email & WhatsApp", "Multi-role registration"] },
              { icon: Store, color: "text-rose-400", title: "Exhibitors & Stalls", items: ["Live floor-plan stall booking", "Vendor onboarding & profiles", "Payment approval & security deposits", "Edit & cancellation requests", "GST / UEN verification"] },
              { icon: Users, color: "text-emerald-400", title: "Speakers & Sessions", items: ["Speaker slots & applications", "Session schedules & timing", "Approve speakers & issue passes"] },
              { icon: Calendar, color: "text-cyan-400", title: "Round Tables", items: ["Gala & dinner seating", "Book by whole table or per chair", "Live seat availability"] },
              { icon: Heart, color: "text-rose-400", title: "Weddings & Personal", items: ["Multi-function schedules", "“Our Story” timeline & gallery", "Designer themes & fonts", "Live ceremony announcements", "Countdown & directions"] },
              { icon: CheckCircle2, color: "text-purple-400", title: "RSVP & Guests", items: ["RSVP per function", "Age & side breakdowns", "Guest-list export", "Attendance tracking"] },
              { icon: Bed, color: "text-blue-400", title: "Room Allotment", items: ["Assign hotel rooms to guests", "Share one room across families", "Email QR room passes", "Occupancy & capacity checks"] },
              { icon: QrCode, color: "text-purple-400", title: "Check-in & On-site", items: ["Contactless QR check-in", "Operators & volunteer helpers", "Kiosk mode", "Re-issue lost tickets"] },
              { icon: BarChart3, color: "text-amber-400", title: "Payments & Revenue", items: ["Integrated payments", "Deposits & refunds", "Revenue & sales tracking", "Platform-fee management"] },
              { icon: MessageSquare, color: "text-purple-400", title: "Built-in AI Assistant", items: ["Manage events by chat", "Approvals & payment confirmations", "Guest lists & pending queues", "Answers grounded in your data"] },
              { icon: TrendingUp, color: "text-cyan-400", title: "Analytics & Feedback", items: ["Live dashboards", "Per-event statistics", "Historical event analysis", "Post-event feedback"] },
              { icon: Shield, color: "text-blue-400", title: "Team, Branding & Plans", items: ["Operators with scoped access", "White-label branded pages", "Custom store link & storefront", "Memberships, plans & add-ons"] },
            ].map((c, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 3) * 0.06, duration: 0.4 }}
                className="rounded-xl border border-white/5 bg-[#121216] p-5 hover:border-white/15 transition-all"
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-4",
                    c.color,
                  )}
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
                      <CheckCircle2
                        className={cn(
                          "w-4 h-4 mt-0.5 flex-shrink-0",
                          c.color,
                        )}
                      />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Steps Section — hidden for now (kept for later) */}
      {false && (
      <section className="py-16 md:py-24 bg-[#0a0a0c] relative z-10">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-8 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              Create Your Event in 4 Easy Steps
            </h2>
          </div>

          {/* Carousel Image Box - Aspect 17/10 */}
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

            {/* Navigation Buttons - Hidden on small mobile */}
            <div className="hidden sm:flex absolute inset-0 items-center justify-between px-4 md:px-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button
                onClick={() =>
                  setActiveStepIndex(
                    (prev) =>
                      (prev - 1 + eventSteps.length) % eventSteps.length,
                  )
                }
                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/70 hover:border-white/40 transition-all"
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <button
                onClick={() =>
                  setActiveStepIndex((prev) => (prev + 1) % eventSteps.length)
                }
                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/70 hover:border-white/40 transition-all"
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Browser Tab Layout / Steps Below */}
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
                  activeStepIndex === index
                    ? "bg-[#16161c]"
                    : "hover:bg-white/5",
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
                
                {/* Active Indicator Line */}
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
      )}

      {/* FAQ Section — hidden for now */}
      {false && (
      <section className="py-24 bg-[#0a0a0c]">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-12 text-center">Frequently Asked Questions</h2>
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
                      openFaqIndex === i && "rotate-180"
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
      )}

      <TestimonialsCarousel />

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center bg-[#121216] p-12 md:p-20 rounded-[3rem] border border-white/5 shadow-2xl">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-8">Ready to Scale?</h2>
            <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">
              Join thousands of organizers and businesses growing with Eventsh.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="xl" onClick={onShowLogin} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-12 py-7 rounded-2xl font-bold text-lg">
                Get Started Now
              </Button>
              <Button size="xl" variant="outline" onClick={contactUs} className="w-full sm:w-auto border-white/10 hover:bg-white/5 text-white px-12 py-7 rounded-2xl font-bold text-lg bg-black">
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
