import { useEffect, useState } from "react";
import { useCountry } from "@/hooks/useCountry";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
} from "lucide-react";
import { lazy, Suspense } from "react";
import { EventfrontTemplate } from "./EventfrontTemplate";
import DashboardOverview from "@/components/organizer/DashboardOverview";
import { jwtDecode } from "jwt-decode";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useNavigate } from "react-router-dom";

// Lazy-load heavy tab components (only loaded when their tab is active)
const CreateEventForm = lazy(() => import("@/components/organizer/CreateEventForm").then(m => ({ default: m.CreateEventForm })));
const ShopkeeperRequestForm = lazy(() => import("@/components/organizer/ShopkeeperRequestForm").then(m => ({ default: m.ShopkeeperRequestForm })));
const EventQRCode = lazy(() => import("@/components/organizer/EventQRCode").then(m => ({ default: m.EventQRCode })));
const AddUserForm = lazy(() => import("@/components/organizer/AddUserForm").then(m => ({ default: m.AddUserForm })));
const UserDetailView = lazy(() => import("@/components/organizer/UserDetailView").then(m => ({ default: m.UserDetailView })));
const AddShopkeeperForm = lazy(() => import("@/components/organizer/AddShopkeeperForm").then(m => ({ default: m.AddShopkeeperForm })));
const ShopkeeperDetailView = lazy(() => import("@/components/organizer/ShopkeeperDetailView").then(m => ({ default: m.ShopkeeperDetailView })));
const TicketSalesManagement = lazy(() => import("@/components/organizer/TicketSalesManagement").then(m => ({ default: m.TicketSalesManagement })));
const OrganizerSettings = lazy(() => import("@/components/organizer/OrganizerSettings").then(m => ({ default: m.OrganizerSettings })));
const MyEvents = lazy(() => import("@/components/organizer/MyEvents"));
const MyEventUsers = lazy(() => import("@/components/organizer/MyUsers"));
const VendorRequests = lazy(() => import("@/components/organizer/shopKeeper"));
const SpeakerRequests = lazy(() => import("@/components/organizer/SpeakerRequests").then(m => ({ default: m.SpeakerRequests })));
const HelpFAQ = lazy(() => import("@/components/organizer/HelpFAQ").then(m => ({ default: m.HelpFAQ })));
const EventAttendees = lazy(() => import("@/components/organizer/EventAttendees"));
const OrganizerStorefrontCustomizer = lazy(() => import("@/components/organizer/organizerStorefrontCustomizer").then(m => ({ default: m.OrganizerStorefrontCustomizer })));

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
}

export function OrganizerDashboard({
  onLogout,
  onViewEvent,
}: OrganizerDashboardProps) {
  const { toast } = useToast();
  const { country, setCountry } = useCountry();
  const apiURL = __API_URL__;

  // UI State
  const [organizerId, setOrganizerId] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showEventfront, setShowEventfront] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [OrganizationName, setOrganizationName] = useState(
    "EventFlow Organizer",
  );
  const [whatsAppNumber, setWhatsAppNumber] = useState("");

  // Organizer Specific Modal States
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showShopkeeperForm, setShowShopkeeperForm] = useState(false);
  const [showQRCode, setShowQRCode] = useState<any>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);
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

  async function logout() {
    sessionStorage.removeItem("token");
    setCountry("IN");
    if (storeSlug) {
      navigate(`/${storeSlug}`);
    } else {
      navigate(`/`);
    }
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
      }

      if (checkResponse.status === 404) {
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
      let orgEmail;

      try {
        const decoded = jwtDecode<organizerToken>(token);
        orgEmail = decoded.email;
        // Set organizerId for child components (SpeakerRequests, etc.)
        if (decoded.sub) setOrganizerId(decoded.sub);

        const res = await fetch(`${apiURL}/organizers/${orgEmail}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const shopData = await res.json();
          if (shopData.data.organizationName) {
            setCountry(shopData.data.country);
            setOrganizationName(shopData.data.organizationName);
            setWhatsAppNumber(shopData.data.whatsAppNumber);
          }
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

  const handleCreateEvent = async (eventData: any) => {
    // Implement API call logic here
    setShowCreateEvent(false);
  };

  const handleEditEvent = (event: any) => {
    setEditingEvent(event);
    setShowCreateEvent(true);
  };

  const handleUpdateEvent = (eventData: any) => {
    setEditingEvent(null);
    setShowCreateEvent(false);
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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  // --- Configuration ---

  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: Store },
    { id: "eventAttendees", label: "Attendees", icon: Users },
    { id: "speakerRequests", label: "Speaker Requests", icon: Mic2 },
    // { id: "shopkeepers", label: "Shopkeepers", icon: UserCheck },
    // { id: "tickets", label: "Sales", icon: Ticket },
    { id: "users", label: "Exhibitors/Visitors", icon: Users },
    { id: "events", label: "Events", icon: CalendarDays },
    { id: "storefront", label: "Eventfront", icon: Globe, isAction: true },
    { id: "settings", label: "Settings", icon: Settings },
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
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 flex-shrink-0">
        <div className="flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center space-x-2">
            {/* Mobile menu button */}
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

            <CalendarDays className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-lg sm:text-xl font-bold hidden sm:block">
              {OrganizationName}
            </h1>
            <h1 className="text-base font-bold sm:hidden truncate max-w-[150px]">
              {OrganizationName}
            </h1>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm text-muted-foreground hidden sm:flex items-center gap-1 hover:text-primary"
              onClick={() => setActiveTab("help")}
            >
              <HelpCircle className="h-4 w-4" />
              Need Help?
            </Button>
            <Button variant="buttonOutline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main container with fixed sidebar and scrollable content */}
      <div className="flex flex-1 overflow-hidden z-40">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static lg:translate-x-0 
            w-64 border-r bg-card/95 backdrop-blur-sm lg:bg-muted/30 
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
              {navigationItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "buttonOutline"}
                  className="w-full justify-start text-sm"
                  onClick={() => {
                    if (item.id === "storefront") {
                      handleViewStorefront();
                    } else {
                      handleTabChange(item.id);
                    }
                  }}
                  disabled={item.id === "storefront" && loading}
                >
                  <item.icon className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">
                    {item.id === "storefront" && loading
                      ? "Loading..."
                      : item.label}
                  </span>
                </Button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-4 lg:p-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsContent value="dashboard" className="mt-0">
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
                          Attendees
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
                </div>
              </TabsContent>

              <TabsContent value="events" className="mt-0">
                <Suspense fallback={<TabLoader />}>
                  <div className="space-y-4">
                    <MyEvents />
                  </div>
                </Suspense>
              </TabsContent>

              <TabsContent value="users" className="mt-0">
                <Suspense fallback={<TabLoader />}>
                  <div className="space-y-4">
                    <MyEventUsers setShowAddUser={setShowAddUser} />
                  </div>
                </Suspense>
              </TabsContent>

              <TabsContent value="eventAttendees" className="mt-0">
                <Suspense fallback={<TabLoader />}>
                  <div className="space-y-4">
                    <EventAttendees />
                  </div>
                </Suspense>
              </TabsContent>

              <TabsContent value="speakerRequests" className="mt-0">
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
              </TabsContent>

              <TabsContent value="shopkeepers" className="mt-0">
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
              </TabsContent>

              <TabsContent value="tickets" className="mt-0">
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
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <Suspense fallback={<TabLoader />}>
                  <div>
                    <OrganizerSettings onSave={handleSaveSettings} />
                  </div>
                </Suspense>
              </TabsContent>

              <TabsContent value="storefront" className="mt-0 outline-none">
                <Suspense fallback={<TabLoader />}>
                  <div className="space-y-4">
                    <OrganizerStorefrontCustomizer
                      onBack={() => setActiveTab("dashboard")}
                      onSave={() => setShowPreview(true)}
                    />
                  </div>
                </Suspense>
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
        {showCreateEvent && (
          <CreateEventForm
            onClose={() => {
              setShowCreateEvent(false);
              setEditingEvent(null);
            }}
            onSave={editingEvent ? handleUpdateEvent : handleCreateEvent}
            editMode={!!editingEvent}
            initialData={editingEvent}
          />
        )}

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
    </div>
  );
}
