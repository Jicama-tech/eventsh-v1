import Navbar from "@/components/ui/navbar";
import Footer from "@/components/ui/footer";
import SectionHeader from "@/components/ui/sectionHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ = () => {
  const generalFaqs = [
    {
      question: "What is Eventsh?",
      answer:
        "Eventsh is a platform for event management. It helps businesses create, manage, and sell tickets to events.",
    },
    {
      question: "Is there a free trial?",
      answer:
        "We offer a generous free plan for Event Management. You can start using Eventsh immediately without any credit card required.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept all major credit cards, PayPal, and bank transfers for subscription payments. For your customers, we support multiple payment gateways including Stripe, PayPal, and more.",
    },
  ];

  const eventFaqs = [
    {
      question: "How many events can I create?",
      answer:
        "Free plan allows up to 3 events per month. Pro plan offers unlimited events with no restrictions on frequency or timing.",
    },
    {
      question: "Can I customize my event pages?",
      answer:
        "Yes! Both plans allow basic customization. Pro users get access to advanced branding options, custom domains, and white-label solutions.",
    },
    {
      question: "How do ticket sales and payments work?",
      answer:
        "We handle all payment processing securely. Funds are transferred to your account within 2-5 business days after the event, minus a small transaction fee.",
    },
    {
      question: "Can I offer different ticket types?",
      answer:
        "Absolutely! You can create multiple ticket types (Early Bird, VIP, General Admission, etc.) with different prices and availability windows.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-24 pb-16 gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-primary-foreground/80">
              Find answers to common questions about Eventsh
            </p>
          </div>
        </div>
      </section>

      {/* General FAQs */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <SectionHeader title="General Questions" />
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              {generalFaqs.map((faq, index) => (
                <AccordionItem key={index} value={`general-${index}`}>
                  <AccordionTrigger className="text-left font-semibold">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Event FAQs */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <SectionHeader title="Event Management" />
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              {eventFaqs.map((faq, index) => (
                <AccordionItem key={index} value={`event-${index}`}>
                  <AccordionTrigger className="text-left font-semibold">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default FAQ;
