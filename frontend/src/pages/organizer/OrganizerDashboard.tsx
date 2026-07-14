import { useEffect, useState } from "react";
import { useCountry } from "@/hooks/useCountry";
import { useSubscription } from "@/hooks/useSubscription";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  CalendarDays,
  Users,
  Ticket,
  Settings,
  LogOut,
  Store,
  UserCheck,
  Globe,
  Menu,
  X,
  Mic2,
  HelpCircle,
  Circle,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Receipt,
  LifeBuoy,
  Award,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { EventfrontTemplate } from "./EventfrontTemplate";
import DashboardOverview from "@/components/organizer/DashboardOverview";
import { OrganizerAnalyticsCharts } from "@/components/organizer/OrganizerAnalyticsCharts";
import { ChatbotWidget } from "@/components/organizer/ChatbotWidget";
import DemoPrompt from "@/components/user/DemoPrompt";
import { ModuleGate } from "@/components/ui/ModuleGate";
import { jwtDecode } from "jwt-decode";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useNavigate } from "react-router-dom";

// Lazy-load heavy tab components (only loaded when their tab is active)
const CreateEventForm = lazy(() =>
  import("@/components/organizer/CreateEventForm").then((m) => ({
    default: m.CreateEventForm,
  })),
);
// Personal → "Marriage Function" events use a dedicated wedding form instead
// of the commercial CreateEventForm. The chatbot (Individual flow) and the
// Events tab both route marriage picks here.
const MarriageEventForm = lazy(() =>
  import("@/components/organizer/MarriageEventForm").then((m) => ({
    default: m.MarriageEventForm,
  })),
);
const ShopkeeperRequestForm = lazy(() =>
  import("@/components/organizer/ShopkeeperRequestForm").then((m) => ({
    default: m.ShopkeeperRequestForm,
  })),
);
const EventQRCode = lazy(() =>
  import("@/components/organizer/EventQRCode").then((m) => ({
    default: m.EventQRCode,
  })),
);
const AddUserForm = lazy(() =>
  import("@/components/organizer/AddUserForm").then((m) => ({
    default: m.AddUserForm,
  })),
);
const UserDetailView = lazy(() =>
  import("@/components/organizer/UserDetailView").then((m) => ({
    default: m.UserDetailView,
  })),
);
const AddShopkeeperForm = lazy(() =>
  import("@/components/organizer/AddShopkeeperForm").then((m) => ({
    default: m.AddShopkeeperForm,
  })),
);
const ShopkeeperDetailView = lazy(() =>
  import("@/components/organizer/ShopkeeperDetailView").then((m) => ({
    default: m.ShopkeeperDetailView,
  })),
);
const TicketSalesManagement = lazy(() =>
  import("@/components/organizer/TicketSalesManagement").then((m) => ({
    default: m.TicketSalesManagement,
  })),
);
const KioskMode = lazy(() =>
  import("@/components/organizer/KioskMode").then((m) => ({
    default: m.KioskMode,
  })),
);
const OrganizerSettings = lazy(() =>
  import("@/components/organizer/OrganizerSettings").then((m) => ({
    default: m.OrganizerSettings,
  })),
);
const MyEvents = lazy(() => import("@/components/organizer/MyEvents"));
const OrganizerFeedbackList = lazy(
  () => import("@/components/organizer/OrganizerFeedbackList"),
);
const MyEventUsers = lazy(() => import("@/components/organizer/MyUsers"));
const VendorRequests = lazy(() => import("@/components/organizer/shopKeeper"));
const SpeakerRequests = lazy(() =>
  import("@/components/organizer/SpeakerRequests").then((m) => ({
    default: m.SpeakerRequests,
  })),
);
const HelpFAQ = lazy(() =>
  import("@/components/organizer/HelpFAQ").then((m) => ({
    default: m.HelpFAQ,
  })),
);
const EventAttendees = lazy(
  () => import("@/components/organizer/EventAttendees"),
);
const PlatformFeesPanel = lazy(() =>
  import("@/components/organizer/PlatformFeesPanel").then((m) => ({
    default: m.PlatformFeesPanel,
  })),
);
const OrganizerStorefrontCustomizer = lazy(() =>
  import("@/components/organizer/organizerStorefrontCustomizer").then((m) => ({
    default: m.OrganizerStorefrontCustomizer,
  })),
);
const RoundTableBookings = lazy(
  () => import("@/components/organizer/RoundTableBookings"),
);
const SupportPanel = lazy(
  () => import("@/components/organizer/SupportPanel"),
);
const MembershipPanel = lazy(() =>
  import("@/components/organizer/MembershipPanel").then((m) => ({
    default: m.MembershipPanel,
  })),
);

function RoundTableBookingsTab({ apiURL }: { apiURL: string }) {
  const [rtEvents, setRtEvents] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = sessionStorage.getItem("token");
        if (!token) return;
        const decoded: any = jwtDecode(token);
        const organizerId = decoded.sub;
        const res = await fetch(`${apiURL}/events/organizer/${organizerId}`);
        if (res.ok) {
          const data = await res.json();
          setRtEvents(data.data || []);
        }
      } catch {
        // ignore
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchEvents();
  }, [apiURL]);

  if (loadingEvents) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl sm:text-3xl font-bold">Round Table Bookings</h2>
      <p className="text-gray-500 text-sm">
        View and manage round table seat bookings across your events.
      </p>

      {rtEvents.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {rtEvents.map((event: any) => (
              <Button
                key={event._id}
                size="sm"
                variant={selectedId === event._id ? "default" : "outline"}
                onClick={() => setSelectedId(event._id)}
                className="text-xs"
              >
                {event.title}
              </Button>
            ))}
          </div>

          {selectedId ? (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              }
            >
              <RoundTableBookings eventId={selectedId} />
            </Suspense>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                Select an event above to view its round table bookings.
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No events found. Create an event first.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

interface OrganizerDashboardProps {
  onLogout: () => void;
  onViewEvent: (eventId: number) => void;
}

export interface organizerToken {
  sub: string;
  email: string;
  organizationName?: string;
  operatorId?: string;
}

export function OrganizerDashboard({
  onLogout,
  onViewEvent,
}: OrganizerDashboardProps) {
  const { toast } = useToast();
  const { country, setCountry } = useCountry();
  const apiURL = __API_URL__;
  const { isModuleEnabled, subscription } = useSubscription();
  // In a read-only demo, any action click surfaces the register/contact prompt.
  const [showDemoPrompt, setShowDemoPrompt] = useState(false);

  // Read operator restrictions from JWT (set when an operator logs in via WhatsApp).
  const operatorAccessTabs: string[] = (() => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return [];
      const decoded: any = jwtDecode(token);
      if (decoded.operatorId && Array.isArray(decoded.accessTabs)) {
        return decoded.accessTabs as string[];
      }
      return [];
    } catch {
      return [];
    }
  })();
  const isOperator = operatorAccessTabs.length > 0;
  const isTabAllowedForOperator = (tabId: string) =>
    !isOperator || operatorAccessTabs.includes(tabId);

  // Individual onboarding mode — user signed in via Google but hasn't
  // completed organizer registration. Sidebar is fully hidden; they can
  // only interact via the chatbot which is restricted to two actions:
  // open Create Event or open the organizer registration form.
  const userRoles: string[] = (() => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return [];
      const decoded: any = jwtDecode(token);
      return Array.isArray(decoded.roles) ? (decoded.roles as string[]) : [];
    } catch {
      return [];
    }
  })();
  const isIndividual =
    userRoles.includes("individual") && !userRoles.includes("organizer");
  // Read-only demo session (prospect exploring the demo org from the landing).
  // Writes are blocked in the UI (and by the backend DemoReadonlyGuard).
  const demoMode = (() => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return false;
      const decoded: any = jwtDecode(token);
      return decoded?.demo === true;
    } catch {
      return false;
    }
  })();
  // In a demo session ALL sidebar tabs are shown (so prospects see everything
  // the platform offers) — but clicking any of them opens the register/contact
  // prompt instead of navigating (handled by the demo click interceptor).
  const isTabVisible = (_id: string) => true;
  const individualName: string = (() => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return "";
      const decoded: any = jwtDecode(token);
      return decoded.name || "";
    } catch {
      return "";
    }
  })();
  const individualEmail: string = (() => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return "";
      const decoded: any = jwtDecode(token);
      return decoded.email || "";
    } catch {
      return "";
    }
  })();
  const handleOpenOrganizerRegister = () => {
    const params = new URLSearchParams();
    if (individualName) params.set("name", individualName);
    if (individualEmail) params.set("email", individualEmail);
    const qs = params.toString();
    navigate(`/register${qs ? `?${qs}` : ""}`);
  };

  // UI State
  const [organizerId, setOrganizerId] = useState("");
  // Chatbot is the landing tab — organizer sees AI panel first.
  const [activeTab, setActiveTab] = useState("chatbot");
  const [selectedRTEventId, setSelectedRTEventId] = useState<string | null>(
    null,
  );
  const [showEventfront, setShowEventfront] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop-only collapse — narrows the sidebar to icon-only rail. Persisted
  // so the user's preference survives reloads.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("organizerSidebarCollapsed") === "true";
  });
  useEffect(() => {
    localStorage.setItem("organizerSidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);
  const [loading, setLoading] = useState(false);
  const [OrganizationName, setOrganizationName] = useState(() => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return "EventFlow Organizer";
      const decoded = jwtDecode<organizerToken>(token);
      return decoded.organizationName || "EventFlow Organizer";
    } catch {
      return "EventFlow Organizer";
    }
  });
  const [whatsAppNumber, setWhatsAppNumber] = useState("");

  // Organizer Specific Modal States
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showShopkeeperForm, setShowShopkeeperForm] = useState(false);
  const [showQRCode, setShowQRCode] = useState<any>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  // Pre-fill seed for a brand-new event when the chatbot picked a personal
  // event type (e.g. { eventType: "personal", category: "Marriage Function" }).
  const [createDefaults, setCreateDefaults] = useState<any>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showUserDetail, setShowUserDetail] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showAddShopkeeper, setShowAddShopkeeper] = useState(false);
  const [showShopkeeperDetail, setShowShopkeeperDetail] = useState<any>(null);
  const [editingShopkeeper, setEditingShopkeeper] = useState<any>(null);
  const [storeSlug, setStoreSlug] = useState("");
  const { formatPrice, getSymbol } = useCurrency(country);
  const navigate = useNavigate();

  // Data States
  const [shopkeepers, setShopkeepers] = useState<any[]>([]); // Preserving your dummy data structure logic
  const [users, setUsers] = useState<any[]>([]); // Preserving your dummy data structure logic

  // --- Logic & Effects ---

  const defaultSettings = {
    slug: `${OrganizationName.toLowerCase().replace(/\s+/g, "-")}-${Math.floor(Math.random() * 1000) || "My Org"}`,
    general: {
      storeName: OrganizationName,
      tagline: "Welcome to my amazing Organization",
      description: "Discover our wonderful Events",
      logo: "",
      favicon: "",
      contactInfo: {
        phone: "",
        email: "",
        address: "",
        hours: "Mon-Fri: 9AM-6PM",
        website: "",
        showInstagram: false,
        showFacebook: false,
        showTwitter: false,
        showTiktok: false,
        instagramLink: "",
        facebookLink: "",
        twitterLink: "",
        tiktokLink: "",
      },
    },
    design: {
      theme: "light",
      primaryColor: "#6366f1",
      secondaryColor: "#8b5cf6",
      fontFamily: "Inter",
      layout: {
        header: "modern",
        allProducts: "modern",
        visibleAdvertismentBar: false,
        advertiseText: "Flat 10% Off",
        visibleFeaturedProducts: true,
        visibleStatisticsSection: true,
        visibleContactUs: true,
        visibleAboutUs: true,
        aboutUsHeading: "About Us",
        aboutUsText: "Learn more about our organization and what we do.",
        adBarBgcolor: "#000000",
        adBarTextColor: "#ffffff",
        visibleQuickPicks: true,
        featuredProducts: "modern",
        quickPicks: "modern",
        banner: "modern",
        footer: "modern",
      },
      bannerImage:
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8",
      heroBannerImage:
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8",
      aboutUsImage:
        "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
      showBanner: true,
      bannerHeight: "large",
    },
    features: {
      showSearch: true,
      showFilters: true,
      showReviews: false,
      showWishlist: false,
      showQuickView: true,
      showSocialMedia: true,
      enableChat: false,
      showNewsletter: false,
    },
    seo: {
      metaTitle: "My Store - Quality Products",
      metaDescription:
        "Discover quality products at My Store. Best prices and service guaranteed.",
      keywords: "store, shop, products, quality",
      customCode: "",
    },
  };

  const createDefaultSettings = async (organizerId: string, token: string) => {
    // Never write in a read-only demo session (the backend would 403 anyway).
    if (demoMode) return;
    const createData = {
      organizerId,
      ...defaultSettings,
    };

    const createResponse = await fetch(
      `${apiURL}/organizer-stores/add-store-settings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createData),
      },
    );

    if (createResponse.ok) {
      const result = await createResponse.json();
      toast({
        duration: 5000,
        title: "Store Initialized",
        description:
          "Your store has been created with default settings. You can customize it anytime!",
      });
      return result;
    } else {
      const errorData = await createResponse.json();
      throw new Error(errorData.message || "Failed to create store settings");
    }
  };

  // Logout flows through the AuthContext (passed in as onLogout). The old
  // local implementation cleared the token + navigated, but never called
  // setUser(null) on the context — so the in-memory user stayed put and the
  // role-based route table immediately bounced the user back to the
  // dashboard. Delegating to onLogout fixes that and also clears the
  // chatbot history keys for free.
  async function logout() {
    setCountry("IN");
    onLogout();
  }

  const handleViewStorefront = async () => {
    setLoading(true);
    setSidebarOpen(false);

    try {
      const token = sessionStorage.getItem("token");
      if (!token) {
        toast({
          duration: 5000,
          title: "Authorization Error",
          description: "Please login first.",
          variant: "destructive",
        });
        return;
      }

      const decoded = jwtDecode<organizerToken>(token);
      const orgId = decoded.sub;
      setOrganizerId(orgId);

      const checkResponse = await fetch(
        `${apiURL}/organizer-stores/organizer-store-detail`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (checkResponse.ok) {
        const existingData = await checkResponse.json();
        if (existingData && existingData.data && existingData.data.settings) {
          setActiveTab("storefront");
        } else {
          await createDefaultSettings(orgId, token);
          setActiveTab("storefront");
        }
      } else {
        // 404 or any other non-ok status — create default settings
        await createDefaultSettings(orgId, token);
        setActiveTab("storefront");
      }
    } catch (error: any) {
      toast({
        duration: 5000,
        title: "Error",
        description:
          error.message || "Failed to initialize storefront. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function fetchDashboardName() {
      const token = sessionStorage.getItem("token");
      if (!token) return;

      try {
        const decoded = jwtDecode<organizerToken>(token);
        if (decoded.sub) setOrganizerId(decoded.sub);

        let orgData: any = null;

        // Operator session: JWT.sub is already the parent organizer's id, so
        // fetch by id directly. Skipping the email-based lookup is critical —
        // if the operator's gmail is ALSO registered as a separate organizer,
        // looking up by email would return that unrelated organizer instead.
        if (decoded.operatorId) {
          if (decoded.sub) {
            const idRes = await fetch(
              `${apiURL}/organizers/profile-get/${decoded.sub}`,
            );
            if (idRes.ok) {
              try {
                const idResult = await idRes.json();
                if (idResult.data?.organizationName) orgData = idResult.data;
              } catch {
                // empty body — fall through
              }
            }
          }
        } else {
          // Organizer session: look up by email first, then by id as fallback.
          const orgEmail = decoded.email;
          if (orgEmail) {
            const res = await fetch(`${apiURL}/organizers/${orgEmail}`, {
              method: "GET",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              try {
                const result = await res.json();
                if (result.data?.organizationName) orgData = result.data;
              } catch {
                // empty body — fall through
              }
            }
          }

          if (!orgData && decoded.sub) {
            const idRes = await fetch(
              `${apiURL}/organizers/profile-get/${decoded.sub}`,
            );
            if (idRes.ok) {
              try {
                const idResult = await idRes.json();
                if (idResult.data?.organizationName) orgData = idResult.data;
              } catch {
                // empty body — fall through
              }
            }
          }
        }

        if (orgData) {
          setCountry(orgData.country || "IN");
          setOrganizationName(orgData.organizationName);
          setWhatsAppNumber(orgData.whatsAppNumber || "");
        }
      } catch (error) {
        console.error("Error loading Name:", error);
      }
    }

    async function fetchSlug() {
      try {
        const token = sessionStorage.getItem("token");
        if (!token) return;
        const decoded = jwtDecode<organizerToken>(token);
        const organizerId = decoded.sub;

        const response = await fetch(
          `${apiURL}/organizer-stores/organizer-store-detail/${organizerId}`,
          {
            method: "GET",
          },
        );

        if (response.ok) {
          const data = await response.json();
          if (data) {
            setStoreSlug(data.data.slug);
          }
        }
      } catch (error) {
        console.error("Error fetching slug:", error);
      }
    }

    fetchSlug();
    fetchDashboardName();
  }, [apiURL]);

  // --- Handlers (Preserved from original) ---

  // Dummy data for handlers
  const pastEvents: any[] = [];
  const currentEvents: any[] = [];
  const upcomingEvents: any[] = [];
  const allEvents = [...currentEvents, ...upcomingEvents].map((event) => ({
    id: event.id,
    name: event.name,
    date: event.date,
    category: event.category,
  }));

  const handleCreateEvent = async (eventData: FormData) => {
    // CreateEventForm assembles the FormData and delegates the POST to
    // this callback. (When the form is opened from the Events tab,
    // MyEvents.tsx supplies its own onSave; here in the chatbot-launched
    // path we do it ourselves.) The backend lazy-creates the Organizer
    // record for Individuals on first publish.
    const token = sessionStorage.getItem("token");
    if (!token) {
      toast({
        duration: 5000,
        title: "Not signed in",
        description: "Sign in and try again.",
        variant: "destructive",
      });
      return;
    }
    const res = await fetch(`${apiURL}/events/create-event`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: eventData,
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        detail = j?.message || detail;
      } catch {
        // ignore — fall back to HTTP status
      }
      throw new Error(detail);
    }
    setShowCreateEvent(false);
  };

  const handleEditEvent = (event: any) => {
    setEditingEvent(event);
    setShowCreateEvent(true);
  };

  const handleUpdateEvent = async (eventData: FormData) => {
    // CreateEventForm delegates the actual PUT to this callback when in
    // edit mode. Same pattern as handleCreateEvent above — the form
    // assembles the FormData; we own the network call.
    if (!editingEvent?._id) {
      setShowCreateEvent(false);
      return;
    }
    const token = sessionStorage.getItem("token");
    if (!token) {
      toast({
        duration: 5000,
        title: "Not signed in",
        description: "Sign in and try again.",
        variant: "destructive",
      });
      return;
    }
    const res = await fetch(`${apiURL}/events/${editingEvent._id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: eventData,
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        detail = j?.message || detail;
      } catch {
        // ignore — fall back to HTTP status
      }
      throw new Error(detail);
    }
    // Refresh editingEvent with the backend's fresh data so any
    // future re-hydration uses the saved snapshot (including the
    // just-added add-ons / speakers / venue tables). The form's
    // hydration effect is keyed on `initialData?._id` which doesn't
    // change here, so this update doesn't disturb the form's
    // visible local state — it just keeps the parent's cache fresh
    // in case Radix Dialog or React causes a remount later.
    try {
      const j = await res.json();
      const updatedEvent = j?.data || j;
      if (updatedEvent?._id) {
        setEditingEvent(updatedEvent);
      }
    } catch {
      // Non-JSON success body — leave editingEvent as-is.
    }
    // Intentionally do NOT clear editingEvent or close the dialog —
    // when the form stays open after Update, the form's local state
    // (newly-added add-ons, speakers, venue tables, etc.) needs to
    // survive. Clearing editingEvent here would unmount the Dialog
    // and the CreateEventForm inside it, throwing away every local
    // edit the user just saved. The form shows its own "Event
    // updated" toast; the Cancel / X buttons are the only way to
    // close, both of which already clear these states via onClose.
  };

  // Triggered by the chatbot when the user asks to create/edit an event.
  // 1) Switch to Events tab (so closing the dialog leaves them on Events,
  //    not back on the chatbot panel).
  // 2) Open the form (Radix Dialog renders into a portal on top of whatever
  //    tab is mounted, so the user sees Events behind the dialog).
  // Triggered by the chatbot when the user asks to add a visitor.
  // The Add Customer form lives inside MyUsers.tsx (component-local state),
  // so we navigate to the Users tab and emit a window event that MyUsers
  // listens for to flip its own showAddCustomer state.
  const handleOpenAddVisitor = () => {
    handleTabChange("users");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("open-add-customer"));
    }, 50);
  };

  // Triggered by the chatbot when the user asks to add an exhibitor.
  // Same pattern as handleOpenAddVisitor — the form lives inside MyUsers.tsx.
  const handleOpenAddExhibitor = () => {
    handleTabChange("users");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("open-add-exhibitor"));
    }, 50);
  };

  const handleOpenEventForm = async (
    mode: "create" | "edit",
    payload?: {
      eventId?: string;
      eventTitle?: string;
      eventType?: string;
      category?: string;
    },
  ) => {
    // eslint-disable-next-line no-console
    console.log("[dashboard] handleOpenEventForm called:", mode, payload);
    if (mode === "create") {
      setEditingEvent(null);
      // When the chatbot picked a personal event type, seed the form with it
      // (eventType "personal" + the chosen category) so it opens pre-filled.
      setCreateDefaults(
        payload?.eventType || payload?.category
          ? {
              eventType: payload?.eventType,
              category: payload?.category,
              categories: payload?.category ? [payload.category] : [],
            }
          : null,
      );
      // Individuals have no events-module access — switching to the Events
      // tab would surface the ModuleGate's "Upgrade Plan" lock card behind
      // the modal, and they'd be stranded there after closing (no sidebar
      // to navigate back). Keep them on the chatbot tab; the Dialog renders
      // into a portal so it appears on top regardless of the active tab.
      if (!isIndividual) {
        handleTabChange("events");
      }
      setShowCreateEvent(true);
      // eslint-disable-next-line no-console
      console.log("[dashboard] setShowCreateEvent(true) for create");
      return;
    }
    if (mode === "edit" && payload?.eventId) {
      try {
        const res = await fetch(`${apiURL}/events/${payload.eventId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const ev = json?.data || json;
        setEditingEvent(ev);
        if (!isIndividual) {
          handleTabChange("events");
        }
        setShowCreateEvent(true);
      } catch (e: any) {
        toast({
          title: "Couldn't load event",
          description:
            e?.message ||
            `Failed to fetch event "${payload.eventTitle || payload.eventId}"`,
          variant: "destructive",
        });
      }
    }
  };

  const handleShopkeeperRequest = (requestData: any) => {
    setShowShopkeeperForm(false);
  };

  const handleAddUser = (userData: any) => {
    // Logic to add user locally for demo
    const newUser = {
      id: users.length + 1,
      name: userData.fullName,
      email: userData.email,
      phone: userData.phone,
      // ... rest of fields
      status: "active",
    };
    setUsers([...users, newUser]);
    setShowAddUser(false);
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setShowAddUser(true);
  };

  const handleUpdateUser = (userData: any) => {
    // Logic update local state
    setEditingUser(null);
    setShowAddUser(false);
  };

  const handleDeleteUser = (userId: number) => {
    setUsers(users.filter((user) => user.id !== userId));
    setShowUserDetail(null);
  };

  const handleAddShopkeeper = (shopkeeperData: any) => {
    // Logic add local state
    setShowAddShopkeeper(false);
  };

  const handleEditShopkeeper = (shopkeeper: any) => {
    setEditingShopkeeper(shopkeeper);
    setShowAddShopkeeper(true);
  };

  const handleUpdateShopkeeper = (shopkeeperData: any) => {
    setEditingShopkeeper(null);
    setShowAddShopkeeper(false);
  };

  const handleDeleteShopkeeper = (id: number) => {
    setShopkeepers(shopkeepers.filter((s) => s.id !== id));
    setShowShopkeeperDetail(null);
  };

  const handleUpdateTicket = (ticketData: any) => {};
  const handleSaveSettings = (settingsData: any) => {};

  // In a demo, only these tabs open their content; every other tab click
  // surfaces the register/contact prompt instead of navigating.
  const DEMO_VIEW_TABS = ["chatbot", "dashboard", "eventAttendees", "events"];
  const handleTabChange = (tab: string) => {
    if (demoMode && !DEMO_VIEW_TABS.includes(tab)) {
      setShowDemoPrompt(true);
      return;
    }
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  // --- Configuration ---

  const navigationItems = [
    { id: "chatbot", label: "Chatbot", icon: Bot, moduleKey: null },
    { id: "dashboard", label: "Analytics", icon: Store, moduleKey: "analytics" },
    {
      id: "kiosk",
      label: "In-Person Booking",
      icon: Ticket,
      moduleKey: "kiosk",
    },
    {
      id: "eventAttendees",
      label: "Participants",
      icon: Users,
      moduleKey: "participants",
    },
    {
      id: "platformFees",
      label: "Platform Fees",
      icon: Receipt,
      moduleKey: null,
    },
    {
      id: "users",
      label: "Exhibitors/Visitors",
      icon: Users,
      moduleKey: "stalls",
    },
    {
      id: "events",
      label: "Events/Coupons",
      icon: CalendarDays,
      moduleKey: "events",
    },
    {
      id: "feedback",
      label: "Feedback",
      icon: MessageSquare,
      moduleKey: "feedback",
    },
    {
      // Top-level Membership tab — hidden by ModuleGate when the
      // organizer's subscription doesn't include the membership module,
      // so plans without it don't see an empty sidebar entry.
      id: "membership",
      label: "Membership",
      icon: Award,
      moduleKey: "membership",
    },
    {
      id: "support",
      label: "Support",
      icon: LifeBuoy,
      moduleKey: null,
    },
    {
      id: "storefront",
      label: "Eventfront",
      icon: Globe,
      isAction: true,
      moduleKey: "storefront",
    },
    { id: "settings", label: "Settings", icon: Settings, moduleKey: null },
  ];

  if (showPreview) {
    return (
      <div className="min-h-screen bg-white">
        <EventfrontTemplate onBack={() => setShowPreview(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <DemoPrompt
        open={showDemoPrompt}
        onClose={() => setShowDemoPrompt(false)}
      />
      {/* Read-only demo banner — a prospect exploring the demo organization.
          Browsing works; any change is blocked (UI + backend) and points here. */}
      {demoMode && (
        <div className="flex flex-shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white">
          <span>
            👀 You're exploring a read-only demo — changes are disabled.
          </span>
          <span className="flex items-center gap-2">
            <button
              onClick={() => (window.location.href = "/register")}
              className="rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              Register free
            </button>
            <button
              onClick={() => (window.location.href = "/contact")}
              className="rounded-full border border-white/70 px-3 py-0.5 text-xs font-semibold hover:bg-white/10"
            >
              Contact us
            </button>
          </span>
        </div>
      )}
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 flex-shrink-0">
        <div className="flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center space-x-2">
            {/* Mobile menu button — hidden for Individuals (no sidebar) */}
            {!isIndividual && (
              <Button
                variant="buttonOutline"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            )}

            <CalendarDays className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-lg sm:text-xl font-bold hidden sm:block">
              {isIndividual ? "Welcome to EventSH" : OrganizationName}
            </h1>
            <h1 className="text-base font-bold sm:hidden truncate max-w-[150px]">
              {isIndividual ? "EventSH" : OrganizationName}
            </h1>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {!isIndividual && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm text-muted-foreground hidden sm:flex items-center gap-1 hover:text-primary"
                onClick={() => setActiveTab("help")}
              >
                <HelpCircle className="h-4 w-4" />
                Need Help?
              </Button>
            )}
            <Button variant="buttonOutline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main container with fixed sidebar and scrollable content. In a demo,
          the 4 allowed tabs open their content normally; other tabs open the
          register/contact prompt (see handleTabChange). Writes are still
          blocked by the backend DemoReadonlyGuard. */}
      <div className="flex flex-1 overflow-hidden z-40">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && !isIndividual && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — fully hidden for Individuals (chatbot-only onboarding) */}
        {!isIndividual && (
        <aside
          className={`
            fixed lg:static lg:translate-x-0
            w-64 ${sidebarCollapsed ? "lg:w-16" : "lg:w-64"}
            border-r bg-card/95 backdrop-blur-sm lg:bg-muted/30
            h-full z-50 transition-all duration-300 ease-in-out
            flex-shrink-0
            ${
              sidebarOpen
                ? "translate-x-0"
                : "-translate-x-full lg:translate-x-0"
            }
          `}
        >
          <div className="h-full flex flex-col">
            <nav className="p-3 sm:p-4 space-y-1 sm:space-y-2 flex-1 overflow-y-auto">
              <TooltipProvider delayDuration={0}>
                {navigationItems
                  .filter(
                    (item) =>
                      isTabAllowedForOperator(item.id) && isTabVisible(item.id),
                  )
                  .map((item) => {
                    // Items without a moduleKey (Dashboard, Settings) are always available.
                    const locked =
                      !!item.moduleKey && !isModuleEnabled(item.moduleKey);
                    const button = (
                      <Button
                        key={item.id}
                        variant={
                          activeTab === item.id ? "default" : "buttonOutline"
                        }
                        className={`w-full text-sm ${
                          sidebarCollapsed
                            ? "lg:justify-center lg:px-2 justify-start"
                            : "justify-start"
                        } ${locked ? "opacity-60" : ""}`}
                        onClick={() => {
                          // Demo: only the allowed tabs open; the rest (incl.
                          // the storefront action) prompt to register/contact.
                          if (demoMode && !DEMO_VIEW_TABS.includes(item.id)) {
                            setShowDemoPrompt(true);
                            return;
                          }
                          if (item.id === "storefront") {
                            handleViewStorefront();
                          } else {
                            handleTabChange(item.id);
                          }
                        }}
                        disabled={item.id === "storefront" && loading}
                        title={
                          locked ? "Upgrade your plan to unlock" : undefined
                        }
                      >
                        <item.icon
                          className={`h-4 w-4 flex-shrink-0 ${
                            sidebarCollapsed ? "lg:mr-0 mr-2" : "mr-2"
                          }`}
                        />
                        <span
                          className={`truncate flex-1 text-left ${
                            sidebarCollapsed ? "lg:hidden" : ""
                          }`}
                        >
                          {item.id === "storefront" && loading
                            ? "Loading..."
                            : item.label}
                        </span>
                        {locked && (
                          <Lock
                            className={`h-3 w-3 ml-1 text-muted-foreground ${
                              sidebarCollapsed ? "lg:hidden" : ""
                            }`}
                          />
                        )}
                      </Button>
                    );
                    return sidebarCollapsed ? (
                      <Tooltip key={item.id}>
                        <TooltipTrigger asChild>{button}</TooltipTrigger>
                        <TooltipContent
                          side="right"
                          className="hidden lg:block"
                        >
                          {item.label}
                          {locked && " (locked)"}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      button
                    );
                  })}
              </TooltipProvider>
            </nav>
            {/* Desktop collapse toggle — pinned to bottom of sidebar */}
            <div className="hidden lg:flex border-t p-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed((v) => !v)}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="h-8 w-8 p-0"
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </aside>
        )}

        {/* Main Content - Scrollable */}
        <main
          className="flex-1 overflow-hidden flex flex-col"
          // Demo: the 4 allowed tabs render their content so prospects can look
          // around, but clicking any control inside (Create Event, View, filters,
          // chatbot input…) opens the register/contact prompt instead of acting.
          onClickCapture={
            demoMode
              ? (e) => {
                  const el = (e.target as HTMLElement)?.closest?.(
                    'button, a, input, select, textarea, [role="button"], [contenteditable]',
                  );
                  if (el) {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDemoPrompt(true);
                  }
                }
              : undefined
          }
        >
          <div
            className={
              activeTab === "chatbot"
                ? "flex-1 overflow-hidden"
                : "flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6"
            }
          >
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className={activeTab === "chatbot" ? "h-full" : "w-full"}
            >
              {/* AI Assistant — landing tab. Fills the entire main area. */}
              <TabsContent
                value="chatbot"
                className="mt-0 h-full data-[state=inactive]:hidden"
              >
                <ChatbotWidget
                  mode="page"
                  isIndividual={isIndividual}
                  onOpenOrganizerRegister={handleOpenOrganizerRegister}
                  navItems={
                    isIndividual
                      ? []
                      : navigationItems
                          .filter((n) => n.id !== "chatbot")
                          .filter((n) => isTabAllowedForOperator(n.id) && isTabVisible(n.id))
                          .map((n) => ({
                            id: n.id,
                            label: n.label,
                            icon: n.icon,
                          }))
                  }
                  onNavigate={(tab) => {
                    if (isIndividual) return; // locked to chatbot
                    if (tab === "storefront") handleViewStorefront();
                    else handleTabChange(tab);
                  }}
                  onOpenEventForm={handleOpenEventForm}
                  onOpenAddVisitor={handleOpenAddVisitor}
                  onOpenAddExhibitor={handleOpenAddExhibitor}
                />
              </TabsContent>

              <TabsContent value="dashboard" className="mt-0">
                <ModuleGate moduleKey="analytics" hideWhenLocked>
                <div className="space-y-4 sm:space-y-6">
                  {/* Quick Actions */}
                  {/* <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg sm:text-xl">
                        Quick Actions
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Manage your organization efficiently
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4">
                        <Button
                          onClick={() => handleTabChange("events")}
                          variant="buttonOutline"
                          className="h-14 sm:h-16 flex flex-col gap-1 sm:gap-2 text-xs sm:text-sm"
                        >
                          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                          Events
                        </Button>
                        <Button
                          onClick={() => handleTabChange("users")}
                          variant="buttonOutline"
                          className="h-14 sm:h-16 flex flex-col gap-1 sm:gap-2 text-xs sm:text-sm"
                        >
                          <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                          Users
                        </Button>
                        <Button
                          onClick={() => handleTabChange("eventAttendees")}
                          variant="buttonOutline"
                          className="h-14 sm:h-16 flex flex-col gap-1 sm:gap-2 text-xs sm:text-sm"
                        >
                          <User2Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                          Participants
                        </Button>
                        <Button
                          onClick={() => handleTabChange("shopkeepers")}
                          variant="buttonOutline"
                          className="h-14 sm:h-16 flex flex-col gap-1 sm:gap-2 text-xs sm:text-sm"
                        >
                          <UserCheck className="h-4 w-4 sm:h-5 sm:w-5" />
                          Shopkeepers
                        </Button>
                        <Button
                          onClick={() => handleTabChange("tickets")}
                          variant="buttonOutline"
                          className="h-14 sm:h-16 flex flex-col gap-1 sm:gap-2 text-xs sm:text-sm"
                        >
                          <Ticket className="h-4 w-4 sm:h-5 sm:w-5" />
                          Tickets
                        </Button>
                        <Button
                          onClick={handleViewStorefront}
                          disabled={loading}
                          variant="buttonOutline"
                          className="h-14 sm:h-16 flex flex-col gap-1 sm:gap-2 text-xs sm:text-sm col-span-1 sm:col-span-1"
                        >
                          <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="truncate">
                            {loading ? "Loading..." : "Eventfront"}
                          </span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card> */}

                  {/* Dashboard Overview Component */}
                  <DashboardOverview
                    setShowCreateEvent={setShowCreateEvent}
                    setShowShopkeeperForm={setShowShopkeeperForm}
                    onViewEvent={onViewEvent}
                    handleEditEvent={handleEditEvent}
                  />

                  {/* Analytics charts (Recharts) */}
                  {/* <OrganizerAnalyticsCharts /> */}
                </div>
                </ModuleGate>
              </TabsContent>

              <TabsContent value="events" className="mt-0">
                <ModuleGate moduleKey="events" hideWhenLocked>
                  <Suspense fallback={<TabLoader />}>
                    <div className="space-y-4">
                      <MyEvents />
                    </div>
                  </Suspense>
                </ModuleGate>
              </TabsContent>

              <TabsContent value="feedback" className="mt-0">
                <ModuleGate moduleKey="feedback" hideWhenLocked>
                  <Suspense fallback={<TabLoader />}>
                    <OrganizerFeedbackList />
                  </Suspense>
                </ModuleGate>
              </TabsContent>

              <TabsContent value="kiosk" className="mt-0">
                <ModuleGate moduleKey="kiosk" hideWhenLocked>
                  <Suspense fallback={<TabLoader />}>
                    <KioskMode />
                  </Suspense>
                </ModuleGate>
              </TabsContent>

              <TabsContent value="users" className="mt-0">
                <ModuleGate moduleKey="stalls" hideWhenLocked>
                  <Suspense fallback={<TabLoader />}>
                    <div className="space-y-4">
                      <MyEventUsers setShowAddUser={setShowAddUser} />
                    </div>
                  </Suspense>
                </ModuleGate>
              </TabsContent>

              <TabsContent value="eventAttendees" className="mt-0">
                <ModuleGate moduleKey="participants" hideWhenLocked>
                  <Suspense fallback={<TabLoader />}>
                    <div className="space-y-4">
                      <EventAttendees />
                    </div>
                  </Suspense>
                </ModuleGate>
              </TabsContent>

              <TabsContent value="platformFees" className="mt-0">
                <Suspense fallback={<TabLoader />}>
                  <PlatformFeesPanel />
                </Suspense>
              </TabsContent>

              <TabsContent value="speakerRequests" className="mt-0">
                <ModuleGate moduleKey="speakerRequests" hideWhenLocked>
                  <Suspense fallback={<TabLoader />}>
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h2 className="text-2xl sm:text-3xl font-bold">
                          Speaker Requests
                        </h2>
                        <p className="text-muted-foreground">
                          Manage speaker applications for your events and track
                          session assignments
                        </p>
                      </div>
                      <SpeakerRequests organizerId={organizerId} />
                    </div>
                  </Suspense>
                </ModuleGate>
              </TabsContent>

              <TabsContent value="shopkeepers" className="mt-0">
                <ModuleGate moduleKey="stalls" hideWhenLocked>
                  <Suspense fallback={<TabLoader />}>
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h2 className="text-2xl sm:text-3xl font-bold">
                          Shopkeeper & Vendor Requests
                        </h2>
                      </div>

                      <VendorRequests
                        setShowAddShopkeeper={setShowAddShopkeeper}
                        setShowShopkeeperForm={setShowShopkeeperForm}
                        handleViewShopkeeper={(shopkeeper: any) =>
                          setShowShopkeeperDetail(shopkeeper)
                        }
                        handleEditShopkeeper={(shopkeeper: any) => {
                          setEditingShopkeeper(shopkeeper);
                          setShowAddShopkeeper(true);
                        }}
                      />
                    </div>
                  </Suspense>
                </ModuleGate>
              </TabsContent>

              <TabsContent value="tickets" className="mt-0">
                <ModuleGate moduleKey="tickets" hideWhenLocked>
                  <Suspense fallback={<TabLoader />}>
                    <div className="space-y-4">
                      <TicketSalesManagement
                        events={[
                          ...currentEvents,
                          ...upcomingEvents,
                          ...pastEvents,
                        ]}
                        onUpdateTicket={handleUpdateTicket}
                      />
                    </div>
                  </Suspense>
                </ModuleGate>
              </TabsContent>

              <TabsContent value="roundTableBookings" className="mt-0">
                <ModuleGate moduleKey="roundTableBookings" hideWhenLocked>
                  <Suspense fallback={<TabLoader />}>
                    <RoundTableBookingsTab apiURL={apiURL} />
                  </Suspense>
                </ModuleGate>
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <Suspense fallback={<TabLoader />}>
                  <div>
                    <OrganizerSettings onSave={handleSaveSettings} />
                  </div>
                </Suspense>
              </TabsContent>

              <TabsContent value="membership" className="mt-0">
                <ModuleGate moduleKey="membership" hideWhenLocked>
                  <Suspense fallback={<TabLoader />}>
                    {/* Verification queue + active members. Plan-tier CRUD
                        stays in Organizer Settings → Membership tab. */}
                    <MembershipPanel view="verification" />
                  </Suspense>
                </ModuleGate>
              </TabsContent>

              <TabsContent value="support" className="mt-0">
                <Suspense fallback={<TabLoader />}>
                  <SupportPanel />
                </Suspense>
              </TabsContent>

              <TabsContent value="storefront" className="mt-0 outline-none">
                <ModuleGate moduleKey="storefront" hideWhenLocked>
                  <Suspense fallback={<TabLoader />}>
                    <div className="space-y-4">
                      <OrganizerStorefrontCustomizer
                        onBack={() => setActiveTab("dashboard")}
                        onSave={() => setShowPreview(true)}
                      />
                    </div>
                  </Suspense>
                </ModuleGate>
              </TabsContent>

              <TabsContent value="help" className="mt-0">
                <Suspense fallback={<TabLoader />}>
                  <div className="space-y-4">
                    <HelpFAQ />
                  </div>
                </Suspense>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* --- Modals and Forms (lazy-loaded on demand) --- */}
      <Suspense fallback={null}>
        {/* Wrap CreateEventForm in a Dialog so it appears as a constrained
            modal (matches the MyEvents flow), not a fullscreen takeover. */}
        <Dialog
          open={showCreateEvent}
          onOpenChange={(open) => {
            if (!open) {
              setShowCreateEvent(false);
              setEditingEvent(null);
            }
          }}
        >
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
            <div className="overflow-y-auto max-h-[90vh]">
              {showCreateEvent &&
                (() => {
                  const activeInitial = editingEvent ?? createDefaults;
                  // Personal → "Marriage Function" events use the dedicated
                  // wedding form; everything else uses the commercial form.
                  // Mirrors the switch in MyEvents.tsx so the Individual
                  // (chatbot) flow gets the same marriage experience.
                  const isMarriage =
                    activeInitial?.eventType === "personal" &&
                    (activeInitial?.category === "Marriage Function" ||
                      activeInitial?.categories?.includes?.(
                        "Marriage Function",
                      ));
                  const FormComponent = isMarriage
                    ? MarriageEventForm
                    : CreateEventForm;
                  return (
                    <FormComponent
                      onClose={() => {
                        setShowCreateEvent(false);
                        setEditingEvent(null);
                        setCreateDefaults(null);
                      }}
                      onSave={
                        editingEvent ? handleUpdateEvent : handleCreateEvent
                      }
                      editMode={!!editingEvent}
                      initialData={activeInitial}
                    />
                  );
                })()}
            </div>
          </DialogContent>
        </Dialog>

        {showShopkeeperForm && (
          <ShopkeeperRequestForm
            onClose={() => setShowShopkeeperForm(false)}
            onSubmit={handleShopkeeperRequest}
            events={allEvents}
          />
        )}

        {showQRCode && (
          <EventQRCode
            event={showQRCode}
            apiURL={apiURL}
            onClose={() => setShowQRCode(null)}
          />
        )}

        {showAddUser && (
          <AddUserForm
            onClose={() => {
              setShowAddUser(false);
              setEditingUser(null);
            }}
            onSubmit={editingUser ? handleUpdateUser : handleAddUser}
            editMode={!!editingUser}
            initialData={editingUser}
          />
        )}

        {showUserDetail && (
          <UserDetailView
            user={showUserDetail}
            onClose={() => setShowUserDetail(null)}
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
          />
        )}

        {showAddShopkeeper && (
          <AddShopkeeperForm
            isOpen={showAddShopkeeper}
            onClose={() => {
              setShowAddShopkeeper(false);
              setEditingShopkeeper(null);
            }}
            onSubmit={
              editingShopkeeper ? handleUpdateShopkeeper : handleAddShopkeeper
            }
            editingShopkeeper={editingShopkeeper}
          />
        )}

        {showShopkeeperDetail && (
          <ShopkeeperDetailView
            shopkeeper={showShopkeeperDetail}
            isOpen={!!showShopkeeperDetail}
            onClose={() => setShowShopkeeperDetail(null)}
            onEdit={handleEditShopkeeper}
            onDelete={handleDeleteShopkeeper}
          />
        )}
      </Suspense>

      {/* Floating EventSH AI bubble — only on non-chatbot tabs (chatbot tab has the full panel) */}
      {activeTab !== "chatbot" && (
        <ChatbotWidget
          navItems={navigationItems
            .filter((n) => n.id !== "chatbot")
            .filter((n) => isTabAllowedForOperator(n.id) && isTabVisible(n.id))
            .map((n) => ({ id: n.id, label: n.label, icon: n.icon }))}
          onNavigate={(tab) => {
            if (tab === "storefront") handleViewStorefront();
            else handleTabChange(tab);
          }}
          onOpenEventForm={handleOpenEventForm}
        />
      )}
    </div>
  );
}

