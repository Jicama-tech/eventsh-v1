import { Button } from "@/components/ui/button";
import Navbar from "@/components/ui/navbar";
import Footer from "@/components/ui/footer";
import FeatureCard from "@/components/ui/featureCard";
import PricingCard from "@/components/ui/PricingCard";
import StepCard from "@/components/ui/StepCard";
import SectionHeader from "@/components/ui/sectionHeader";
import {
  Calendar,
  Ticket,
  Users,
  BarChart3,
  Mail,
  QrCode,
  MapPin,
  Clock,
  ArrowRight,
  Smartphone,
  CreditCard,
  Bell,
  Share2,
  Globe,
  Phone,
} from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Check, Gift, Rocket } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

const Events = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const onShowLogin = () => {
    navigate("/login");
  };

  const onShowOrganizerLogin = () => {
    navigate("/login");
  };

  const contactUs = () => {
    navigate("/contact");
  };

  const links = [
    { href: "/", label: "Home" },
    { href: "/events", label: "Events" },
    { href: "/contact", label: "Contact Us" },
    // { href: "/pricing", label: "Pricing" },
    // { href: "/blog", label: "Blog" },
    // { href: "/faq", label: "FAQ" },
  ];

  const howItWorksRef = useRef<HTMLDivElement | null>(null);

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-auto flex items-center">
                <img
                  src="/EventshLogo.png"
                  alt="Eventsh - Build Sell Thrive"
                  className="object-contain h-20 sm:h-20 md:h-20 lg:h-30 w-auto"
                />
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {links.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "font-medium transition-colors hover:text-accent",
                    location.pathname === link.href
                      ? "text-accent"
                      : "text-muted-foreground",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-4">
              <Button variant="event" onClick={onShowOrganizerLogin}>
                Get Started
              </Button>
              {/* <Button variant="event">Get Started</Button> */}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {isOpen && (
            <div className="md:hidden py-4 border-t border-border animate-fade-up">
              {links.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "block py-3 font-medium transition-colors hover:text-accent",
                    location.pathname === link.href
                      ? "text-accent"
                      : "text-muted-foreground",
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-border">
                <Button variant="event" onClick={onShowOrganizerLogin}>
                  Sign In
                </Button>
                {/* <Button variant="buttonOutline" onClick={onShowLogin}>
                  Get Started
                </Button> */}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 gradient-event min-h-[85vh] flex items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 animate-fade-up">
              <Calendar className="w-4 h-4 text-accent-foreground" />
              <span className="text-accent-foreground text-sm font-medium">
                Event Management Platform
              </span>
            </div>

            <h1
              className="text-4xl md:text-6xl lg:text-6xl font-bold text-accent-foreground mb-6 animate-fade-up"
              style={{ animationDelay: "0.1s" }}
            >
              Create Unforgettable Events
            </h1>

            <p
              className="text-xl text-accent-foreground/80 mb-10 max-w-2xl mx-auto animate-fade-up"
              style={{ animationDelay: "0.2s" }}
            >
              From intimate gatherings to massive conferences. Manage
              registrations, sell tickets, and engage attendees with our
              powerful platform.
            </p>

            <div
              className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up"
              style={{ animationDelay: "0.3s" }}
            >
              {/* <Button variant="eventOutline" size="xl">
                Create Your Event <ArrowRight className="ml-2" />
              </Button> */}
              <Button
                variant="eventOutline"
                size="xl"
                className="bg-transparent"
                onClick={scrollToHowItWorks}
              >
                How it Works
              </Button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <SectionHeader
            title="Everything for Event Success"
            subtitle="Powerful tools to create, promote, and manage events of any size"
          />

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <FeatureCard
              icon={Ticket}
              title="Ticket Management"
              description="Create multiple ticket types, early bird pricing, and group discounts."
              iconClassName="gradient-event"
            />
            <FeatureCard
              icon={QrCode}
              title="QR Check-in"
              description="Fast, contactless check-in with QR codes and mobile scanning."
              iconClassName="gradient-event"
            />
            <FeatureCard
              icon={Users}
              title="Attendee Management"
              description="Track registrations, manage waitlists, and communicate easily."
              iconClassName="gradient-event"
            />
            <FeatureCard
              icon={CreditCard}
              title="Secure Payments"
              description="Accept payments globally with multiple payment gateways."
              iconClassName="gradient-event"
            />
            <FeatureCard
              icon={Mail}
              title="Email Marketing"
              description="Automated confirmations, reminders, and post-event follow-ups."
              iconClassName="gradient-event"
            />
            <FeatureCard
              icon={BarChart3}
              title="Live Analytics"
              description="Real-time insights on sales, attendance, and engagement."
              iconClassName="gradient-event"
            />
            <FeatureCard
              icon={MapPin}
              title="Venue Management"
              description="Manage physical and virtual venues with seating charts."
              iconClassName="gradient-event"
            />
            <FeatureCard
              icon={Bell}
              title="Push Notifications"
              description="Keep attendees informed with real-time updates and alerts."
              iconClassName="gradient-event"
            />
            <FeatureCard
              icon={Share2}
              title="Social Integration"
              description="Easy sharing and promotion across all social platforms."
              iconClassName="gradient-event"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/50" ref={howItWorksRef}>
        <div className="container mx-auto px-4">
          <SectionHeader
            title="How It Works"
            subtitle="Get your event up and running in four simple steps"
          />

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className={cn("flex items-start gap-4")}>
              <div className="w-12 h-12 gradient-event rounded-full flex items-center justify-center flex-shrink-0 shadow-card">
                <span className="text-accent-foreground font-bold text-lg">
                  1
                </span>
              </div>
              <div className="bg-card p-5 rounded-xl shadow-card flex-1 hover:shadow-hover transition-all duration-300">
                <h4 className="font-semibold text-foreground mb-1">
                  Create Your Event
                </h4>
                <p className="text-muted-foreground text-sm">
                  Set up your event details, customize the landing page, and add
                  ticket types.
                </p>
              </div>
            </div>
            <div className={cn("flex items-start gap-4")}>
              <div className="w-12 h-12 gradient-event rounded-full flex items-center justify-center flex-shrink-0 shadow-card">
                <span className="text-accent-foreground font-bold text-lg">
                  2
                </span>
              </div>
              <div className="bg-card p-5 rounded-xl shadow-card flex-1 hover:shadow-hover transition-all duration-300">
                <h4 className="font-semibold text-foreground mb-1">
                  Promote & Sell
                </h4>
                <p className="text-muted-foreground text-sm">
                  Share your event, enable online ticket sales, and track
                  registrations.
                </p>
              </div>
            </div>
            <div className={cn("flex items-start gap-4")}>
              <div className="w-12 h-12 gradient-event rounded-full flex items-center justify-center flex-shrink-0 shadow-card">
                <span className="text-accent-foreground font-bold text-lg">
                  3
                </span>
              </div>
              <div className="bg-card p-5 rounded-xl shadow-card flex-1 hover:shadow-hover transition-all duration-300">
                <h4 className="font-semibold text-foreground mb-1">
                  Manage Attendees
                </h4>
                <p className="text-muted-foreground text-sm">
                  Handle check-ins, send updates, and engage with your audience.
                </p>
              </div>
            </div>
            <div className={cn("flex items-start gap-4")}>
              <div className="w-12 h-12 gradient-event rounded-full flex items-center justify-center flex-shrink-0 shadow-card">
                <span className="text-accent-foreground font-bold text-lg">
                  4
                </span>
              </div>
              <div className="bg-card p-5 rounded-xl shadow-card flex-1 hover:shadow-hover transition-all duration-300">
                <h4 className="font-semibold text-foreground mb-1">
                  Analyze & Grow
                </h4>
                <p className="text-muted-foreground text-sm">
                  Review insights, gather feedback, and improve future events.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <SectionHeader
            title="Choose Your Plan"
            subtitle="Flexible pricing for events of all sizes"
          />

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* FREE Plan Card */}
            <div className="rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2 bg-card shadow-card border border-border">
              <div className="flex items-center gap-3 mb-2">
                <Gift className="w-8 h-8 text-accent" />
                <h3 className="font-bold text-2xl">FREE</h3>
              </div>
              <p className="mb-6 text-muted-foreground">Perfect to Start</p>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 text-accent" />
                  <span className="text-sm text-foreground">
                    1st Event Free
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 text-accent" />
                  <span className="text-sm text-foreground">
                    Unlimited Attendees per Event
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 text-accent" />
                  <span className="text-sm text-foreground">
                    Attendees Registration
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 text-accent" />
                  <span className="text-sm text-foreground">
                    Basic Analytics
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 text-accent" />
                  <span className="text-sm text-foreground">Email Support</span>
                </li>
              </ul>

              <Button variant="event" size="lg" className="w-full">
                Start Free
              </Button>
            </div>

            {/* PRO Plan Card - Events Theme */}
            <div className="rounded-2xl p-8 gradient-event text-accent-foreground shadow-glow transition-all duration-300 hover:-translate-y-2">
              <div className="flex items-center gap-3 mb-2">
                <Rocket className="w-8 h-8 text-accent-foreground" />
                <h3 className="font-bold text-2xl">PRO - Promotion</h3>
              </div>
              <p className="mb-6 text-accent-foreground/80">
                Everything Unlimited
              </p>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 text-accent-foreground" />
                  <span className="text-sm text-accent-foreground/90">
                    Unlimited Events
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 text-accent-foreground" />
                  <span className="text-sm text-accent-foreground/90">
                    Unlimited Attendees
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 text-accent-foreground" />
                  <span className="text-sm text-accent-foreground/90">
                    Advanced QR Check-in/Check-out
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 text-accent-foreground" />
                  <span className="text-sm text-accent-foreground/90">
                    Advanced Analytics
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 text-accent-foreground" />
                  <span className="text-sm text-accent-foreground/90">
                    Custom Domain
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 text-accent-foreground" />
                  <span className="text-sm text-accent-foreground/90">
                    Priority 24/7 Support
                  </span>
                </li>
              </ul>

              <Button variant="eventOutline" size="lg" className="w-full">
                Upgrade Now
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 gradient-event relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-accent-foreground mb-6">
              Ready to Host Amazing Events?
            </h2>
            <p className="text-xl text-accent-foreground/80 mb-10">
              Join thousands of event organizers who trust Eventsh for their
              events.
            </p>
            <Button variant="eventOutline" size="xl" onClick={contactUs}>
              Contact Us <ArrowRight className="ml-2" />
            </Button>
          </div>
        </div>
      </section>

      <footer className="gradient-event text-accent-foreground py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
                  <span className="text-accent-foreground font-bold text-xl">
                    E
                  </span>
                </div>
                <span className="font-bold text-xl">Eventsh</span>
              </div>
              <p className="text-accent-foreground/80 text-sm leading-relaxed">
                Your complete solution for event management and e-commerce.
                Scale your business effortlessly.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">SaaS Products</h4>
              <ul className="space-y-2 text-primary-foreground/80">
                <li>
                  <Link
                    to="/events"
                    className="hover:text-primary-foreground transition-colors"
                  >
                    Event Management
                  </Link>
                </li>
                {/* <li>
                            <a
                              href="#"
                              className="hover:text-primary-foreground transition-colors"
                            >
                              Analytics
                            </a>
                          </li>
                          <li>
                            <a
                              href="#"
                              className="hover:text-primary-foreground transition-colors"
                            >
                              Integrations
                            </a>
                          </li> */}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-primary-foreground/80">
                {/* <li>
                            <Link
                              to="/pricing"
                              className="hover:text-primary-foreground transition-colors"
                            >
                              Pricing
                            </Link>
                          </li>
                          <li>
                            <Link
                              to="/blog"
                              className="hover:text-primary-foreground transition-colors"
                            >
                              Blog
                            </Link>
                          </li>
                          <li>
                            <Link
                              to="/faq"
                              className="hover:text-primary-foreground transition-colors"
                            >
                              FAQ
                            </Link>
                          </li> */}
                <li>
                  <a
                    href="/about"
                    className="hover:text-primary-foreground transition-colors"
                  >
                    About Us
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-3 text-primary-foreground/80">
                <li className="flex items-center gap-2">
                  <a
                    href="https://eventsh.com"
                    className="flex items-center gap-1"
                  >
                    <Globe size={16} />
                    <span>eventsh.com</span>
                  </a>
                </li>

                <li className="flex items-center gap-2">
                  <a
                    href={`https://wa.me/${+917021512020}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    <FaWhatsapp size={16} />
                    <span>+91 702 151 2020</span>
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail size={16} />
                  <a href={`mailto:hello@eventsh.com`}>
                    <span>hello@eventsh.com</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-primary-foreground/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-accent-foreground/60 text-sm">
              © 2025 Eventsh. All rights reserved. Powered By{" "}
              <a href="https://jicama.tech" className="text-white text-l">
                Jicama.tech
              </a>
            </p>
            <div className="flex gap-6 text-sm text-accent-foreground/60">
              <a
                href="/privacy-policy"
                className="hover:text-accent-foreground transition-colors"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="hover:text-accent-foreground transition-colors"
              >
                Terms of Service
              </a>
              {/* <a
              href="#"
              className="hover:text-accent-foreground transition-colors"
            >
              Cookies
            </a> */}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Events;
