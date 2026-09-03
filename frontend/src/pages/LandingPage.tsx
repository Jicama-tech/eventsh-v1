import { useNavigate, useLocation } from "react-router-dom";
import Footer from "@/components/ui/footer";
import { TestimonialsCarousel } from "@/components/landing/TestimonialsCarousel";
import { PublicChatbot } from "@/components/landing/PublicChatbot";
import { startDemoDashboard } from "@/lib/demoDashboard";
import { useState, useEffect } from "react";
import { getLandingTemplate, ShowcaseEvent } from "@/pages/landing/templates";

// Phase 3a of the white-label plan: this page owns all shared state and
// data-fetching (nav open state, the live showcase-events fetch) and hands
// it down to whichever template's section components are selected — see
// pages/landing/templates. The original inline JSX had four sections
// already disabled via `{false && ...}` (Why Choose Us, Everything You Can
// Do, Steps, FAQ) plus two alternate "see it in action" layouts. The four
// disabled sections were preserved as available-but-unrendered template
// components (see templates/default) — a future toggle or a white-label
// template can render them (they'd need to own their own state, e.g. FAQ's
// open-accordion index, since this page no longer carries it). The two
// alternate showcase layouts were dropped as pure duplicates of what
// SeeItInAction already covers.
const template = getLandingTemplate();

// The public assistant is a floating bubble rather than a full-width band —
// the same shape as the organizer dashboard's ChatbotWidget, and the reason
// the band could be dropped: a popup costs no page height, so the chat is
// reachable from anywhere on the page without pushing the argument down a
// screen. Render <PublicChatbot /> with no mode to get the old band back.

const LandingPage = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Admin-curated live demo events shown in "See it in action". Clicking a card
  // opens its real (demo-mode) eventfront.
  const [showcaseEvents, setShowcaseEvents] = useState<ShowcaseEvent[]>([]);
  useEffect(() => {
    fetch(`${__API_URL__}/events/showcase`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setShowcaseEvents(Array.isArray(j?.data) ? j.data : []))
      .catch(() => setShowcaseEvents([]));
  }, []);

  const onShowLogin = () => {
    navigate("/organizer/login");
  };

  const contactUs = () => {
    navigate("/contact");
  };

  return (
    <div
      className={
        template.rootClassName ??
        "min-h-screen bg-[#1a1a1a] text-slate-200 selection:bg-primary/30"
      }
    >
      {/* Route-scoped stylesheet/webfonts, for a template that brings its own */}
      {template.Styles && <template.Styles />}

      <template.Nav
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        currentPath={location.pathname}
        onShowLogin={onShowLogin}
      />

      <template.Hero onShowLogin={onShowLogin} />

      {template.Replaces && <template.Replaces />}
      {template.Modules && <template.Modules />}
      {template.Screens && <template.Screens />}

      <template.SeeItInAction
        showcaseEvents={showcaseEvents}
        onOpenDemo={(eventId) => navigate(`/demo/events/${eventId}`)}
        onOpenDemoDashboard={(eventId) => startDemoDashboard(eventId)}
      />



      {template.HowItWorks && <template.HowItWorks />}

      {/* Feedback ("Used Eventsh? Tell us how it went.") is hidden for now —
          flip showFeedback back to true to bring the banner and its modal
          back. Featured testimonials still render when there are any. */}
      <TestimonialsCarousel showFeedback={false} />

      <template.CTA onShowLogin={onShowLogin} onContactUs={contactUs} />

      {template.Footer ? <template.Footer /> : <Footer />}

      {/* Public AI chatbot — FAQ + first-event onboarding (inline Google
          auth). Mounted last so the bubble sits above every section. */}
      <PublicChatbot mode="floating" />
    </div>
  );
};

export default LandingPage;
