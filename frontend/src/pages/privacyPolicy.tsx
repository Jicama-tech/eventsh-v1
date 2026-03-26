import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  Eye,
  Gavel,
  Zap,
  Cookie,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-50 selection:bg-primary/30">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[25%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-[25%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="container relative mx-auto px-4 py-16">
        {/* Back Button */}
        <div className="absolute top-6 left-4 md:left-8">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-white/10 text-slate-300"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </div>

        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
            Privacy Policy
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Your privacy is important to us. Please read our policy carefully.
          </p>
          <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
        </div>

        <Card className="max-w-4xl mx-auto bg-slate-900/50 border-slate-800 backdrop-blur-sm shadow-2xl">
          <CardHeader className="pt-10 border-b border-slate-800/50">
            <div className="flex items-center justify-center gap-3 mb-2">
              <ShieldCheck className="text-primary h-6 w-6" />
              <CardTitle className="text-2xl text-white">
                EventSH Privacy Statement
              </CardTitle>
            </div>
            <p className="text-center text-xs text-slate-500 uppercase tracking-widest">
              Last Updated: August 21, 2026
            </p>
          </CardHeader>

          <CardContent className="p-8 md:p-12 overflow-y-auto max-h-[70vh] custom-scrollbar prose prose-invert prose-slate max-w-none">
            <div className="space-y-8 text-slate-300">
              <section>
                <h3 className="text-white flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-primary" /> 1. Introduction
                </h3>
                <p>
                  This Privacy Policy describes how <strong>EventSH</strong>{" "}
                  ("we," "us," or "our") collects, uses, and discloses your
                  personal information when you use our website and services. By
                  using our services, you consent to the data practices
                  described in this policy.
                </p>
              </section>

              <section>
                <h3 className="text-white flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" /> 2. Information We
                  Collect
                </h3>
                <p>
                  We collect information to provide and improve our services to
                  you. The types of information we may collect include:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>Personal Information:</strong> Name, email address,
                    phone number, and billing information collected when you
                    register an account or make a purchase.
                  </li>
                  <li>
                    <strong>Usage Data:</strong> Information about how you
                    interact with our platform, such as your IP address, browser
                    type, pages visited, and the duration of your visit.
                  </li>
                  <li>
                    <strong>Event and Vendor Data:</strong> Information related
                    to events you create, attend, or products you sell.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" /> 3. How We Use Your
                  Information
                </h3>
                <p>
                  We use the information we collect for various purposes,
                  including to:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Provide, operate, and maintain our services.</li>
                  <li>
                    Process transactions and send you related information,
                    including invoices and confirmation emails.
                  </li>
                  <li>
                    Communicate with you about your account, events, and
                    promotional offers.
                  </li>
                  <li>
                    Improve our website and personalize your user experience.
                  </li>
                  <li>
                    Monitor and analyze usage and trends to improve the
                    platform's functionality.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-white flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" /> 4. Sharing and
                  Disclosure of Information
                </h3>
                <p>
                  We do not sell your personal information. We may share your
                  information with third parties in the following circumstances:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>Service Providers:</strong> With third-party vendors
                    and service providers who perform services on our behalf,
                    such as payment processing, data analysis, and email
                    delivery.
                  </li>
                  <li>
                    <strong>Legal Compliance:</strong> To comply with legal
                    obligations, protect our rights, or in response to a court
                    order or subpoena.
                  </li>
                  <li>
                    <strong>Business Transfers:</strong> In connection with a
                    merger, sale of company assets, or acquisition.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-white">5. Data Security</h3>
                <p>
                  We take reasonable measures to protect your personal
                  information from unauthorized access, use, or disclosure.
                  However, no method of transmission over the internet or
                  electronic storage is 100% secure. While we strive to use
                  commercially acceptable means to protect your data, we cannot
                  guarantee its absolute security.
                </p>
              </section>

              <section>
                <h3 className="text-white">6. Your Privacy Rights</h3>
                <p>Depending on your location, you may have the right to:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Access the personal information we hold about you.</li>
                  <li>
                    Request that we correct any inaccurate personal information.
                  </li>
                  <li>Request that we delete your personal information.</li>
                </ul>
                <p>
                  To exercise these rights, please contact us using the
                  information below.
                </p>
              </section>

              <section>
                <h3 className="text-white flex items-center gap-2">
                  <Cookie className="h-5 w-5 text-primary" /> 7. Cookies and
                  Tracking Technologies
                </h3>
                <p>
                  We use cookies and similar tracking technologies to track
                  activity on our service and hold certain information. You can
                  instruct your browser to refuse all cookies or to indicate
                  when a cookie is being sent. However, if you do not accept
                  cookies, you may not be able to use some portions of our
                  services.
                </p>
              </section>

              <section className="pt-8 border-t border-slate-800">
                <h3 className="text-white">8. Contact Us</h3>
                <p>
                  If you have any questions about this Privacy Policy, please
                  reach out to our team:
                </p>
                <div className="bg-[#111] p-4 rounded-lg border border-slate-800 text-sm">
                  <p className="m-0 text-primary">Email: hello@eventsh.com</p>
                  <p className="m-0">Subject: Privacy Inquiry - EventSH</p>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `,
        }}
      />
    </div>
  );
}
