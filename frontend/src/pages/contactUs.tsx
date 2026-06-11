import { Button } from "@/components/ui/button";
import {
  Mail,
  Phone,
  MapPin,
  Loader,
  Menu,
  X,
  Send,
  MessageSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import Footer from "@/components/ui/footer";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const Contact = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    organizationName: "",
    enquiryFor: "events",
    contactNumber: "",
    emailId: "",
    message: "",
  });

  const onShowOrganizerLogin = () => {
    navigate("/login");
  };

  const links = [
    { href: "/", label: "Home" },
    { href: "/contact", label: "Contact Us" },
  ];

  const contactCards = [
    {
      icon: Mail,
      title: "Email Us",
      value: "hello@eventsh.com",
      href: "mailto:hello@eventsh.com",
      color: "text-blue-400",
    },
    {
      icon: Phone,
      title: "Call / WhatsApp",
      value: "+91 702 151 2020",
      href: "https://wa.me/917021512020",
      color: "text-emerald-400",
    },
    {
      icon: MapPin,
      title: "Visit Us",
      value: "eventsh.com",
      href: "https://eventsh.com",
      color: "text-purple-400",
    },
  ];

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${__API_URL__}/enquiry/add-enquiry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          duration: 5000,
          title: "Enquiry Submitted Successfully",
          description: "Thank you! Your message has been sent successfully.",
          variant: "default",
        });

        setFormData({
          firstName: "",
          lastName: "",
          organizationName: "",
          enquiryFor: "events",
          contactNumber: "",
          emailId: "",
          message: "",
        });
      } else {
        toast({
          duration: 5000,
          title: "Enquiry Not Submitted",
          description: "Sorry Your Enquiry is Not Submitted",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        duration: 5000,
        title: "Error Occured",
        description: "Sorry Your Enquiry is Not Submitted",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Shared dark-theme input styling.
  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-white/10 bg-[#0a0a0c] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all";
  const labelClass = "block text-sm font-medium text-slate-300 mb-2";

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-slate-200 selection:bg-primary/30">
      {/* Navigation — matches the landing page */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <motion.div whileHover={{ scale: 1.05 }} className="flex items-center">
                <img
                  src="/EventshLogo.png"
                  alt="EventSH"
                  className="object-contain h-12 w-auto brightness-110"
                />
              </motion.div>
            </Link>

            {/* Desktop Navigation */}
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
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="default"
                  onClick={onShowOrganizerLogin}
                  className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)] transition-all duration-300"
                >
                  Get Started
                </Button>
              </motion.div>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
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
                    onShowOrganizerLogin();
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
      <section className="relative overflow-hidden pt-32 pb-20 min-h-[60vh] flex items-center">
        {/* Glow / gradient backdrop matching the landing page */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0c]/30 via-[#0a0a0c]/60 to-[#1a1a1a]" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-blue-500/15" />
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-[120px]" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center"
          >
            <img
              src="/EventshLogo.png"
              alt="EventSH"
              className="h-16 w-auto mx-auto mb-6 object-contain brightness-110"
            />
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm text-slate-300 mb-6">
              <MessageSquare className="w-4 h-4 text-primary" />
              We're here to help
            </span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
              Get In{" "}
              <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Touch
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Have questions about EventSH? We'd love to hear from you. Send us a
              message and we'll respond as soon as possible.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="pb-24 bg-[#1a1a1a]">
        <div className="container mx-auto px-4">
          {/* Contact info cards */}
          <div className="grid sm:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto -mt-10 relative z-10 mb-12">
            {contactCards.map((card) => (
              <motion.a
                key={card.title}
                href={card.href}
                target={card.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -4 }}
                className="bg-[#121216] rounded-2xl border border-white/5 p-6 hover:border-white/15 transition-all group block"
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4",
                    card.color,
                  )}
                >
                  <card.icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  {card.title}
                </h3>
                <p className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors break-all">
                  {card.value}
                </p>
              </motion.a>
            ))}
          </div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <div className="bg-[#121216] rounded-2xl p-6 md:p-10 border border-white/5 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Send us a Message
              </h2>
              <p className="text-slate-400 text-sm mb-8">
                Fill in the details below and our team will get back to you.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* First Name and Last Name */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      placeholder="John"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      placeholder="Doe"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Organization/Shop Name */}
                <div>
                  <label className={labelClass}>
                    Shop or Organization Name
                  </label>
                  <input
                    type="text"
                    name="organizationName"
                    value={formData.organizationName}
                    onChange={handleInputChange}
                    required
                    placeholder="Your Company Name"
                    className={inputClass}
                  />
                </div>

                {/* Enquiry For Dropdown */}
                <div>
                  <label className={labelClass}>Enquiry For</label>
                  <select
                    name="enquiryFor"
                    value={formData.enquiryFor}
                    onChange={handleInputChange}
                    className={cn(inputClass, "appearance-none cursor-pointer")}
                  >
                    <option value="events">Events Management</option>
                  </select>
                </div>

                {/* Contact Number and Email */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Contact Number</label>
                    <input
                      type="tel"
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleInputChange}
                      required
                      maxLength={15}
                      placeholder="+91 XXXXXXXXXX"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Email ID</label>
                    <input
                      type="email"
                      name="emailId"
                      value={formData.emailId}
                      onChange={handleInputChange}
                      required
                      placeholder="john@example.com"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className={labelClass}>Message</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={5}
                    placeholder="Tell us about your inquiry..."
                    className={cn(inputClass, "resize-none")}
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)]"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Message
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Contact;
