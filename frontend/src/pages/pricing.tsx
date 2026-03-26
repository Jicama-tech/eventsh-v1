import Navbar from "@/components/ui/navbar";
import Footer from "@/components/ui/footer";
import SectionHeader from "@/components/ui/sectionHeader";
import PricingCard from "@/components/ui/PricingCard";
import { Button } from "@/components/ui/button";
import { Check, HelpCircle } from "lucide-react";

const Pricing = () => {
  const eventFeatures = {
    free: [
      "Up to 3 events per month",
      "100 attendees per event",
      "Basic ticket types",
      "Email notifications",
      "Standard support",
    ],
    pro: [
      "Unlimited events",
      "Unlimited attendees",
      "Custom ticket types & pricing",
      "Advanced analytics",
      "Priority support",
      "Custom branding",
      "API access",
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-24 pb-16 gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-primary-foreground/80">
              Choose the plan that fits your needs. Start free and upgrade as
              you grow.
            </p>
          </div>
        </div>
      </section>

      {/* Event Management Pricing */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <SectionHeader
            title="Event Management Plans"
            subtitle="Everything you need to create and manage successful events"
          />
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <PricingCard
              plan="free"
              title="Free"
              subtitle="Perfect for getting started"
              features={eventFeatures.free}
            />
            <PricingCard
              plan="pro"
              title="Pro"
              subtitle="For growing businesses"
              features={eventFeatures.pro}
              highlighted
            />
          </div>
        </div>
      </section>

      {/* FAQ Teaser */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <HelpCircle className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Have Questions?
          </h2>
          <p className="text-muted-foreground mb-6">
            Check out our FAQ for answers to common questions.
          </p>
          <Button variant="hero" asChild>
            <a href="/faq">View FAQ</a>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Pricing;
