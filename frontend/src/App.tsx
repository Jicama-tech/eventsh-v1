import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { CountryProvider } from "./hooks/useCountry";
import { SubscriptionProvider } from "./hooks/useSubscription";
import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";

// Lazy load all route components for code splitting
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Events = lazy(() => import("./pages/Events"));
const Pricing = lazy(() => import("./pages/pricing"));
const Blog = lazy(() => import("./pages/Blog"));
const FAQ = lazy(() => import("./pages/faqs"));
const ContactUsPage = lazy(() => import("./pages/contactUs"));
const TablePaymentPage = lazy(() => import("./components/user/tablePaymentPage"));
const SpeakerPaymentPage = lazy(() => import("./components/user/speakerPaymentPage"));
const TicketPaymentPage = lazy(() => import("./components/user/ticketPaymentPage"));
const TicketCart = lazy(() => import("./components/user/ticketCart"));
const RoundTablePaymentPage = lazy(() => import("./components/user/roundTablePaymentPage"));

// Auth pages
const AdminLogs = lazy(() => import("./components/auth/loginAdmin").then(m => ({ default: m.AdminLogs })));
const OrganizerLogin = lazy(() => import("./components/auth/organizerLogin").then(m => ({ default: m.OrganizerLogin })));
const OrganizerRegister = lazy(() => import("./components/auth/organizerRegister").then(m => ({ default: m.OrganizerRegister })));
const OrganizerEShopLogin = lazy(() => import("./components/auth/organizerAuthlogin").then(m => ({ default: m.OrganizerEShopLogin })));
const AgentLogin = lazy(() => import("./components/auth/AgentLogin").then(m => ({ default: m.AgentLogin })));

// Public pages
const AboutUsPage = lazy(() => import("./pages/aboutUs").then(m => ({ default: m.AboutUsPage })));
const TermsAndConditionsPage = lazy(() => import("./pages/termsAndConditions").then(m => ({ default: m.TermsAndConditionsPage })));
const PrivacyPolicyPage = lazy(() => import("./pages/privacyPolicy").then(m => ({ default: m.PrivacyPolicyPage })));

// User-facing
const OrganizerStorefront = lazy(() => import("./components/user/organizerStoreFront").then(m => ({ default: m.OrganizerStorefront })));
const EventFront = lazy(() => import("./components/user/eventFront").then(m => ({ default: m.EventFront })));

// Dashboards (heavy components)
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const AgentDashboard = lazy(() => import("./pages/agent/AgentDashboard").then(m => ({ default: m.AgentDashboard })));
const OrganizerDashboard = lazy(() => import("./pages/organizer/OrganizerDashboard").then(m => ({ default: m.OrganizerDashboard })));
const UserDashboard = lazy(() => import("./pages/user/UserDashboard").then(m => ({ default: m.UserDashboard })));
const QRTicketScanner = lazy(() => import("./components/organizer/ORCodeScanner"));

// Loading screen while validating token
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-slate-600">Loading...</p>
      </div>
    </div>
  );
}

// Guard for "user" role
function RequireUserRole({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (user.roles[0] !== "user") return <Navigate to="/" replace />;
  return children;
}

function CleanStorefrontUrl() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const hostname = window.location.hostname;

    const isStorefrontPath = /^\/[^/]+$/.test(path);

    // 2. Define routes that should NEVER be cleaned (Safety Net)
    const protectedRoutes = [
      // Event / Organizer routes
      "/ticket-payment",
      "/ticket-cart",
      "/table-payment",
      "/speaker-payment",
      "/round-table-payment",
      "/events",
      "/organizer-dashboard",
      "/organizer",
      "/event-login",

      // Auth routes
      "/login",
      "/register",
      "/admin-login",
      "/admin-dashboard",

      // Public pages
      "/pricing",
      "/blog",
      "/faq",
      "/about",
      "/contact",
      "/terms",
      "/privacy-policy",
    ];

    const isProtected = protectedRoutes.some((route) => path.startsWith(route));

    // 3. Only run cleanup if it IS a storefront path AND NOT a protected route
    if (isStorefrontPath && !isProtected) {
      if (hostname === "xcionasia.com" || hostname === "www.xcionasia.com") {
        // This keeps the store data loaded but hides the slug in the URL bar
        window.history.replaceState(null, "", "/");
      }
    }
  }, [location]);

  return null;
}

function AppContent() {
  const navigate = useNavigate();

  useEffect(() => {
    const domain = window.location.hostname;
    let ogTitle = "EventSH - Online Platform for Events Management"; // default

    // Customize based on domain
    if (domain.includes("eventsh.com")) {
      ogTitle = "EventSH - Online Platform for Events Management";
    } else if (domain.includes("xcionasia.com")) {
      ogTitle = "XcionAsia - Events Management Company";
    } else if (domain.includes("localhost")) {
      ogTitle = "EventSH Development - Events Management Platform";
    }

    // Update or create og:title meta tag
    let ogTitleTag = document.querySelector(
      'meta[property="og:title"]',
    ) as HTMLMetaElement;
    if (!ogTitleTag) {
      ogTitleTag = document.createElement("meta");
      ogTitleTag.setAttribute("property", "og:title");
      document.head.appendChild(ogTitleTag);
    }
    ogTitleTag.setAttribute("content", ogTitle);

    // Also update document title for consistency
    document.title = ogTitle;

    // Optional: Update og:description dynamically too
    let ogDescTag = document.querySelector(
      'meta[property="og:description"]',
    ) as HTMLMetaElement;
    if (!ogDescTag) {
      ogDescTag = document.createElement("meta");
      ogDescTag.setAttribute("property", "og:description");
      document.head.appendChild(ogDescTag);
    }

    const description = domain.includes("jicama.tech")
      ? "Professional event management platform by Jicama.Tech"
      : "Comprehensive platform for event organizers to manage their business online";

    ogDescTag.setAttribute("content", description);
  }, []);

  useEffect(() => {
    const domain = window.location.hostname;
    const domainToStoreMap = { "xcionasia.com": "xcionasia" };
    const shopName = domainToStoreMap[domain];

    // Only redirect if at /
    if (shopName && window.location.pathname === "/") {
      navigate(`/${shopName}`);
    }
  }, [navigate]);

  const { user, logout, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <CleanStorefrontUrl />

      {!user ? (
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/events" element={<Events />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/about" element={<AboutUsPage />} />
          <Route path="/organizer/login" element={<OrganizerEShopLogin />} />
          <Route path="/register" element={<OrganizerRegister />} />
          <Route path="/contact" element={<ContactUsPage />} />
          <Route path="/terms" element={<TermsAndConditionsPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/admin-login" element={<AdminLogs />} />
          <Route path="/agent-login" element={<AgentLogin />} />
          <Route
            path="/events/:eventId/scan-tickets"
            element={<QRTicketScanner />}
          />
          <Route path="/ticket-payment" element={<TicketPaymentPage />} />
          <Route path="/table-payment" element={<TablePaymentPage />} />
          <Route path="/speaker-payment" element={<SpeakerPaymentPage />} />
          <Route path="/round-table-payment" element={<RoundTablePaymentPage />} />
          <Route path="/event-login" element={<OrganizerLogin />} />
          <Route
            path="/:organizationName"
            element={<OrganizerStorefront onBack={() => navigate(-1)} />}
          />
          <Route path="/ticket-cart/:organizerId" element={<TicketCart />} />
          <Route
            path="/:organizationName/events/:id"
            element={<EventFront eventId={""} onBack={() => {}} />}
          />
          <Route path="/login" element={<OrganizerLogin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        (() => {
          switch (user.roles[0]) {
            case "admin":
              return (
                <Routes>
                  <Route
                    path="/"
                    element={<Navigate to="/admin-dashboard" replace />}
                  />
                  <Route
                    path="/admin-dashboard"
                    element={<AdminDashboard onLogout={logout} />}
                  />
                  <Route
                    path="*"
                    element={<Navigate to="/admin-dashboard" replace />}
                  />
                </Routes>
              );
            case "organizer":
              return (
                <Routes>
                  <Route
                    path="/"
                    element={<Navigate to="/organizer-dashboard" replace />}
                  />
                  <Route
                    path="/events/:eventId/scan-tickets"
                    element={<QRTicketScanner />}
                  />
                  <Route
                    path="/:organizationName"
                    element={
                      <OrganizerStorefront onBack={() => navigate(-1)} />
                    }
                  />
                  <Route
                    path="/ticket-cart/:organizerId"
                    element={<TicketCart />}
                  />
                  <Route
                    path="/:organizationName/events/:id"
                    element={<EventFront eventId={""} onBack={() => {}} />}
                  />
                  <Route
                    path="/ticket-payment"
                    element={<TicketPaymentPage />}
                  />
                  <Route path="/table-payment" element={<TablePaymentPage />} />
          <Route path="/speaker-payment" element={<SpeakerPaymentPage />} />
          <Route path="/round-table-payment" element={<RoundTablePaymentPage />} />
                  <Route
                    path="/organizer-dashboard"
                    element={
                      <OrganizerDashboard
                        onLogout={logout}
                        onViewEvent={() => {}}
                      />
                    }
                  />
                  <Route
                    path="*"
                    element={<Navigate to="/organizer-dashboard" replace />}
                  />
                </Routes>
              );
            case "agent":
              return (
                <Routes>
                  <Route
                    path="/"
                    element={<Navigate to="/agent-dashboard" replace />}
                  />
                  <Route
                    path="/agent-dashboard"
                    element={<AgentDashboard onLogout={logout} />}
                  />
                  <Route
                    path="*"
                    element={<Navigate to="/agent-dashboard" replace />}
                  />
                </Routes>
              );
            case "user":
              return (
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route
                    path="/organizer/login"
                    element={<OrganizerEShopLogin />}
                  />
                  <Route path="/user-dashboard" element={<UserDashboard />} />
                  <Route
                    path="/:organizationName/events/:id"
                    element={<EventFront eventId={""} onBack={() => {}} />}
                  />
                  <Route
                    path="/:organizationName"
                    element={
                      <OrganizerStorefront onBack={() => navigate(-1)} />
                    }
                  />
                  <Route
                    path="/ticket-cart/:organizerId"
                    element={<TicketCart />}
                  />
                  <Route
                    path="/ticket-payment"
                    element={<TicketPaymentPage />}
                  />
                  <Route path="/table-payment" element={<TablePaymentPage />} />
          <Route path="/speaker-payment" element={<SpeakerPaymentPage />} />
          <Route path="/round-table-payment" element={<RoundTablePaymentPage />} />

                  <Route
                    path="/login"
                    element={
                      <RequireUserRole>
                        <OrganizerLogin />
                      </RequireUserRole>
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      <RequireUserRole>
                        <OrganizerRegister />
                      </RequireUserRole>
                    }
                  />
                  <Route
                    path="*"
                    element={<Navigate to="/user-dashboard" replace />}
                  />
                </Routes>
              );
            default:
              return (
                <Routes>
                  <Route
                    path="*"
                    element={
                      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
                        <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md">
                          <h1 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                            Welcome, {user.roles[0]}!
                          </h1>
                          <p className="text-gray-600 mb-6">
                            Your dashboard is coming soon...
                          </p>
                          <button
                            onClick={logout}
                            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
                          >
                            Logout
                          </button>
                        </div>
                      </div>
                    }
                  />
                </Routes>
              );
          }
        })()
      )}
    </Suspense>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min before refetch
      gcTime: 10 * 60 * 1000,   // 10 min cache retention
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const App = () => (
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <CountryProvider>
                <SubscriptionProvider>
                  <AppContent />
                </SubscriptionProvider>
              </CountryProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </GoogleOAuthProvider>
);

export default App;
