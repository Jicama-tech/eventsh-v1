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
import { cn } from "@/lib/utils";
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
    image: "/assets/step1.png",
    icon: CalendarDays,
  },
  {
    number: 2,
    title: "Customize",
    image: "/assets/step2.png",
    icon: Sparkles,
  },
  {
    number: 3,
    title: "Create",
    image: "/assets/step3.png",
    icon: TrendingUp,
  },
  {
    number: 4,
    title: "Manage",
    image: "/assets/step4.png",
    icon: BarChart3,
  },
];

const whyChooseFeatures = [
  { icon: Users, title: "Multi-Role Registration", desc: "Separate, branded onboarding flows for Visitors, Exhibitors, and Vendors.", color: "text-blue-400" },
  { icon: Smartphone, title: "Instant Digital Badging", desc: "Auto-generates unique Dynamic QR Codes delivered via email, SMS, or WhatsApp.", color: "text-purple-400" },
  { icon: CheckCircle2, title: "Contactless Check-In", desc: "Visitors scan their own QR codes for instant attendance tracking.", color: "text-emerald-400" },
  { icon: BarChart3, title: "Session Tracking", desc: "Scan QR codes at seminar entrances to track high-demand topics.", color: "text-amber-400" },
  { icon: Globe, title: "Interactive Real-Time Floor Plans", desc: "Drag-and-drop builder to design venue layouts with ease.", color: "text-cyan-400" },
  { icon: ShoppingBag, title: "Booth Booking System", desc: "Premium vendors view live floor plans and claim preferred booth locations.", color: "text-blue-400" },
  { icon: Store, title: "Add-On Purchase System", desc: "Seamless marketplace for vendors to purchase event extras.", color: "text-rose-400" },
  { icon: ShoppingBag, title: "Dynamic QR Code Invoicing", desc: "Automated invoicing with QR codes for add-on purchases.", color: "text-blue-400" },
  { icon: Smartphone, title: "Instant Payment Processing", desc: "Deposit funds directly through integrated payment systems.", color: "text-purple-400" },
  { icon: Users, title: "Advanced CRM System", desc: "Manage all attendee and exhibitor relationships in one platform.", color: "text-emerald-400" },
  { icon: BarChart3, title: "Historical Event Analysis", desc: "Comprehensive data from past events to inform future planning.", color: "text-amber-400" },
  { icon: Globe, title: "Real-Time Analytics Dashboard", desc: "Live insights into event metrics, attendance, and engagement.", color: "text-cyan-400" },
  { icon: Store, title: "Revenue Tracking", desc: "Monitor ticket sales, add-on purchases, and total event revenue.", color: "text-rose-400" },
  { icon: Globe, title: "Multi-Event Management", desc: "Manage multiple events simultaneously from a single dashboard.", color: "text-cyan-400" },
  { icon: Store, title: "Customizable Branding", desc: "White-label solutions for events with custom branding.", color: "text-rose-400" },
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
    "/assets/image1.jpg",
    "/assets/image2.jpg",
    "/assets/image3.jpg",
    "/assets/image4.jpg",
    "/assets/image5.jpg",
    "/assets/image6.jpg"
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
              <h1 className="text-6xl md:text-8xl font-bold text-white mb-8 tracking-tight">
                EventsHub <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent text-7xl"> <br></br>Where People Connect</span>
              </h1>
              <p className="text-xl md:text-2xl text-slate-400 mb-12 leading-relaxed max-w-2xl mx-auto">
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

      {/* Why Choose Us */}
      <section className="py-24 bg-[#1a1a1a]">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
                Why Choose EventsHub?
              </h2>
              <p className="text-base md:text-lg text-slate-400 leading-relaxed max-w-3xl mx-auto">
                Everything you need to succeed, all in one place. Our platform is built to scale with your business, whether you're hosting global events or launching a niche online store.
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

      {/* Steps Section - Image Carousel with Browser Tab Layout */}
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

      {/* FAQ Section */}
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
