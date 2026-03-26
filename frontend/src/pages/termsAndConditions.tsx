import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Scale,
  FileText,
  Globe,
  AlertTriangle,
  CreditCard,
  ShieldOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export function TermsAndConditionsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-50 selection:bg-primary/30">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[25%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-[25%] -right-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px]" />
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
            Terms & Conditions
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Please read these terms carefully before using our services.
          </p>
          <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
        </div>

        <Card className="max-w-4xl mx-auto bg-slate-900/50 border-slate-800 backdrop-blur-sm shadow-2xl">
          <CardHeader className="pt-10 border-b border-slate-800/50">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Scale className="text-primary h-6 w-6" />
              <CardTitle className="text-2xl text-white">
                EventSH Service Agreement
              </CardTitle>
            </div>
            <p className="text-center text-xs text-slate-500 uppercase tracking-widest font-semibold">
              Last Updated: August 11, 2024
            </p>
          </CardHeader>

          <CardContent className="p-8 md:p-12 overflow-y-auto max-h-[70vh] custom-scrollbar prose prose-invert prose-slate max-w-none">
            <div className="space-y-10 text-slate-300">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="h-5 w-5 text-primary" />
                  <h3 className="text-white m-0">
                    1. Introduction and Acceptance of Terms
                  </h3>
                </div>
                <p>
                  Welcome to <strong>EventSH!</strong> These Terms of Service
                  ("Terms") constitute a legally binding agreement between you
                  ("User," "you") and <strong>EventSH</strong> ("we," "us,"
                  "our") governing your access to and use of our website and all
                  related services. By accessing or using our services, you
                  confirm that you have read, understood, and agree to be bound
                  by these Terms. If you do not agree with all of these Terms,
                  then you are expressly prohibited from using our services and
                  must discontinue use immediately.
                </p>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="text-white m-0">
                    2. User Accounts and Registration
                  </h3>
                </div>
                <p>
                  To access certain features of our platform, you must register
                  for an account. When creating your account, you agree to:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Provide accurate, current, and complete information.</li>
                  <li>
                    Maintain the security of your password and accept all risks
                    of unauthorized access to your account.
                  </li>
                  <li>
                    Be responsible for all activities that occur under your
                    account.
                  </li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="text-white m-0">3. User Content</h3>
                </div>
                <p>
                  Our services allow you to post, link, store, share, and
                  otherwise make available certain information, text, graphics,
                  videos, or other material ("User Content"). You are solely
                  responsible for the User Content you post and warrant that it
                  is not illegal, offensive, or in violation of any third-party
                  rights. By posting User Content, you grant us a non-exclusive,
                  worldwide, royalty-free license to use, modify, publicly
                  display, and distribute such content on the platform.
                </p>
              </section>

              <section className="bg-slate-800/30 p-6 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h3 className="text-primary mt-0 m-0">
                    4. Payments, Fees, and Refunds
                  </h3>
                </div>
                <p className="m-0">
                  <strong>EventSH</strong> may offer paid services, including
                  event ticketing, vendor subscriptions, or premium features.
                  All fees are quoted in the local currency and are due at the
                  time of purchase. You agree to pay all applicable fees and
                  taxes. Our refund policy will be clearly stated at the point
                  of sale for each service.
                </p>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <h3 className="text-white m-0">5. Prohibited Activities</h3>
                </div>
                <p>
                  You agree not to use the platform for any of the following:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Illegal or fraudulent activities.</li>
                  <li>Harassing, threatening, or impersonating other users.</li>
                  <li>
                    Spamming, transmitting viruses, or other malicious code.
                  </li>
                  <li>
                    Infringing on any third-party copyrights or trademarks.
                  </li>
                  <li>
                    Collecting or harvesting any personally identifiable
                    information from the service.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-white">6. Intellectual Property</h3>
                <p>
                  All intellectual property rights in the{" "}
                  <strong>EventSH</strong> platform, including our trademarks,
                  logos, and software, are owned by us. Your use of the service
                  does not grant you any rights to our intellectual property.
                  You retain ownership of your User Content, subject to the
                  license you grant us in Section 3.
                </p>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <ShieldOff className="h-5 w-5 text-primary" />
                  <h3 className="text-white m-0">
                    7. Disclaimer of Warranties
                  </h3>
                </div>
                <p>
                  The service is provided on an "as is" and "as available"
                  basis. We make no warranties, express or implied, regarding
                  the operation of the service, the information, content, or
                  materials included therein. We do not warrant that the service
                  will be uninterrupted, error-free, or secure.
                </p>
              </section>

              <section>
                <h3 className="text-white">8. Limitation of Liability</h3>
                <p>
                  To the fullest extent permitted by law,{" "}
                  <strong>EventSH</strong> will not be liable for any indirect,
                  incidental, punitive, or consequential damages resulting from
                  your use of or inability to use the service. Our total
                  liability to you for any damages shall not exceed the amount
                  you have paid us in the past twelve months.
                </p>
              </section>

              <section>
                <h3 className="text-white">9. Termination</h3>
                <p>
                  We reserve the right to terminate or suspend your account and
                  access to the service at our sole discretion, without notice,
                  for any reason, including your breach of these Terms. You may
                  also terminate your account at any time.
                </p>
              </section>

              <section className="pt-8 border-t border-slate-800">
                <h3 className="text-white">10. Governing Law</h3>
                <p>
                  These Terms shall be governed by and construed in accordance
                  with the laws of <strong>Singapore</strong>, without regard to
                  its conflict of law principles. Any disputes arising from the
                  use of <strong>EventSH</strong> services shall be subject to
                  the exclusive jurisdiction of the courts of Singapore.
                </p>
                <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="m-0 text-sm italic text-slate-400">
                    For legal inquiries or questions about these Terms, contact:{" "}
                    <span className="text-primary font-semibold">
                      hello@eventsh.com
                    </span>
                  </p>
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
