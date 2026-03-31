import React, { useState, useEffect, useRef, CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Star,
  Calendar,
  MapPin,
  Clock,
  Users,
  Ticket,
  Heart,
  Search,
  ArrowLeft,
  User,
  Phone,
  Mail,
  Globe,
  Trophy,
  TrendingUp,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Share2,
} from "lucide-react";
import { EventFront } from "./eventFront";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  FaFacebook,
  FaInstagram,
  FaTiktok,
  FaTwitter,
  FaWhatsapp,
} from "react-icons/fa";
import { Helmet } from "react-helmet-async";
import AnnouncementBar from "../ui/adBar";
import { useCurrency } from "@/hooks/useCurrencyhook";

interface Organizer {
  _id: string;
  name: string;
  email: string;
  organizationName: string;
  phoneNumber: string;
  businessEmail: string;
  whatsAppNumber: string;
  address: string;
  bio: string;
  country: string;
  paymentURL: string;
}

interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  time: string;
  location: string;
  price: number;
  originalPrice?: number;
  rating: number;
  attendees: number;
  maxAttendees: number;
  image: string;
  category: string;
  featured?: boolean;
  sale?: boolean;
  badge?: string;
}

interface EventfrontTemplateProps {
  onBack: () => void;
  onCustomize: () => void;
  onViewDetails: (eventId: string) => void;
}

export interface OrganizerStore {
  _id: string;
  organizerId: string;
  slug: string;
  settings: {
    general: {
      storeName: string;
      tagline: string;
      description: string;
      logo: string;
      favicon: string;
      contactInfo: {
        phone: string;
        email: string;
        address: string;
        hours: string;
        website: string;
        instagramLink: string;
        twitterLink: string;
        tiktokLink: string;
        facebookLink: string;
        showInstagram: boolean;
        showFacebook: boolean;
        showTiktok: boolean;
        showTwitter: boolean;
      };
    };
    design: {
      theme: string;
      primaryColor: string;
      secondaryColor: string;
      fontFamily: string;
      layout: {
        header: string;
        allProducts: string;
        visibleFeaturedProducts: boolean;
        visibleStatisticsSection: boolean;
        visibleAdvertismentBar: boolean;
        advertiseText: string;
        adBarBgcolor: string;
        adBarTextColor: string;
        visibleQuickPicks: boolean;
        visibleContactUs: boolean;
        visibleAboutUs: boolean;
        aboutUsHeading: string;
        aboutUsText: string;
        featuredProducts: string;
        quickPicks: string;
        banner: string;
        footer: string;
      };
      bannerImage: string;
      heroBannerImage: string;
      aboutUsImage: string;
      showBanner: boolean;
      bannerHeight: string;
    };
    features: {
      showSearch: boolean;
      showFilters: boolean;
      showReviews: boolean;
      showWishlist: boolean;
      showSocialMedia: boolean;
      enableChat: boolean;
      showNewsletter: boolean;
    };
    seo: {
      metaTitle: string;
      metaDescription: string;
      keywords: string;
      customCode: string;
    };
  };
  createdAt: string;
  updatedAt: string;
  __v: number;
}

interface FetchedEvent {
  _id: string;
  title: string;
  description: string;
  category: string;
  startDate: string;
  time: string;
  location: string;
  address: string;
  ticketPrice: string;
  totalTickets: string;
  image: string;
  visibility: string;
  tags: string[];
  organizer: {
    name: string;
    phone: string;
    email: string;
    businessEmail: string;
    website?: string;
    bio: string;
    address: string;
    createdAt: string;
    organizationName: string;
  };
  visitorTypes?: any[];
  venueTables?: any;
  speakerSlotTemplates?: any[];
  venueRoundTables?: any[];
}

export function OrganizerStorefront({ onBack }: { onBack: () => void }) {
  const apiURL = __API_URL__;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [settings, setsettings] = useState<OrganizerStore | null>(null);
  const [sortBy, setSortBy] = useState("featured");
  const { organizationName } = useParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [organizerInfo, setOrganizerInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [organizerId, setOrganizerId] = useState("");
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  const [happAttendees, setAttendees] = useState(0);
  const [isNavBarSticky, setIsNavBarSticky] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [whatsAppNumber, setWhatsappNumber] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile =
    typeof window !== "undefined" ? window.innerWidth < 768 : false;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [country, setCountry] = useState("");
  const { formatPrice, getSymbol } = useCurrency(country);

  const howItWorksRef = useRef<HTMLDivElement | null>(null);

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const updateCartCountForOrganizer = async (currentOrganizerId) => {
    try {
      // 1. Get the raw data from localStorage
      const rawData = localStorage.getItem("ticketCart");
      if (!rawData) {
        setCartCount(0);
        return;
      }

      // 2. Parse the object
      const cartData = JSON.parse(rawData);

      // 3. Access the 'items' array
      const items = cartData.items || [];

      // 4. Filter items that match the currentOrganizerId
      // We check the organizerId inside the eventInfo or the items themselves
      const organizerItems = items.filter(
        (item) =>
          // Adjust this key if your item structure stores organizerId differently
          item.organizerId === currentOrganizerId ||
          cartData.eventInfo?.organizerId === currentOrganizerId,
      );

      // 5. Update the state with the length of the filtered items
      setCartCount(organizerItems.length);
    } catch (err) {
      console.error("Failed to parse cart from localStorage", err);
      setCartCount(0);
    }
  };

  const getImageUrl = (imagePath: string | undefined): string => {
    if (!imagePath) return "/placeholder-product.jpg";

    // Already a full URL
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      return imagePath;
    }

    // Relative path - add API URL
    const fullPath = imagePath.startsWith("/") ? imagePath : "/" + imagePath;
    return `${apiURL}${fullPath}`;
  };

  useEffect(() => {
    updateCartCountForOrganizer(organizerId);

    // Optional: If you want to listen for changes in localStorage from other tabs/windows:
    const storageListener = (event: StorageEvent) => {
      if (event.key === "ticketCart") {
        updateCartCountForOrganizer(organizerId);
      }
    };
    window.addEventListener("storage", storageListener);

    return () => window.removeEventListener("storage", storageListener);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const navBarThreshold = 140; // Height of top bar
      setIsNavBarSticky(window.scrollY > navBarThreshold);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getRandomEvents = () => {
    if (!events || events.length === 0) return [];
    const shuffled = [...events].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 8);
  };

  const carouselEvents = getRandomEvents();
  const totalSlides = Math.ceil(carouselEvents.length / 2);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const slugify = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "") // Remove invalid chars
      .replace(/\s+/g, "-") // Replace spaces with dashes
      .replace(/-+/g, "-");

  useEffect(() => {
    async function fetchStoreData() {
      setIsLoading(true);
      setError(null);

      try {
        const slug = slugify(organizationName);
        // Fetch storefront details by shopName/slug
        const storefrontRes = await fetch(
          `${apiURL}/organizer-stores/organizer-stores-detail/${slug}`,
          { method: "GET" },
        );
        if (!storefrontRes.ok)
          throw new Error("Failed to load storefront details");

        const storefrontData = await storefrontRes.json();
        setsettings(storefrontData.data || storefrontData);

        const organizerId =
          storefrontData.data?.organizerId || storefrontData.organizerId;

        if (!organizerId) throw new Error("No shopkeeperId in storefront data");
        // Fetch shopkeeper WhatsApp number directly
        try {
          const res = await fetch(
            `${__API_URL__}/organizers/profile-get/${organizerId}`,
          );
          const data = await res.json();
          setWhatsappNumber(data?.data?.whatsAppNumber || "");
          setOrganizerInfo(data?.data);
          setOrganizerId(data?.data._id);
          setCountry(data?.data.country);
        } catch {
          setWhatsappNumber("");
        }

        const response = await fetch(
          `${apiURL}/events/organizer/${organizerId}`,
          {
            method: "GET",
          },
        );

        if (!response.ok) {
          throw error;
        }

        const eventsdata = await response.json();

        if (eventsdata.data && eventsdata.data.length > 0) {
          const mappedEvents = eventsdata.data.map((event: FetchedEvent) => ({
            id: event._id,
            name: event.title,
            description: event.description,
            date: new Date(event.startDate).toLocaleDateString(),
            time: event.time,
            location: event.address,
            price: event.visitorTypes?.length > 0
              ? Math.min(...event.visitorTypes.map((v: any) => v.price || 0))
              : (event.ticketPrice ? parseFloat(event.ticketPrice) : null),
            rating: 4.5,
            attendees: 0,
            maxAttendees: event.visitorTypes?.length > 0
              ? event.visitorTypes.reduce((sum: number, v: any) => sum + (v.maxCount || 0), 0)
              : (parseInt(event.totalTickets) || 0),
            image: event.image?.startsWith("/") ? `${apiURL?.replace("/api", "")}${event.image}` : (event.image || ""),
            category: event.category,
            featured: false,
            sale: false,
            badge: "",
            hasTickets: event.visitorTypes?.length > 0,
            hasStalls: event.venueTables && (Array.isArray(event.venueTables) ? event.venueTables.length > 0 : Object.keys(event.venueTables).length > 0),
            hasSpeakers: event.speakerSlotTemplates?.length > 0,
            hasRoundTables: event.venueRoundTables?.length > 0,
          }));

          const sortedEvents = mappedEvents.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          );

          if (sortedEvents.length > 0) {
            sortedEvents[0].featured = true;
            sortedEvents[0].badge = "Latest";
          }

          setEvents(sortedEvents);
        }

        const ticketResponse = await fetch(
          `${apiURL}/tickets/organizer/${organizerId}`,
          {
            method: "GET",
          },
        );

        if (!ticketResponse.ok) {
          throw error;
        }

        const ticketData = await ticketResponse.json();

        setAttendees(ticketData.length);
        updateCartCountForOrganizer(organizerId);

        const storageListener = (event: StorageEvent) => {
          if (event.key === "ticketCart") {
            updateCartCountForOrganizer(organizerId);
          }
        };
        window.addEventListener("storage", storageListener);

        return () => window.removeEventListener("storage", storageListener);
      } catch (err: any) {
        setError(err.message || "Error loading storefront.");
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchEvents() {
      try {
        setIsLoading(true);
        if (!organizerId) {
          return;
        }

        setIsLoading(false);
      } catch (error) {
        throw error;
      }
    }

    if (organizationName) {
      fetchStoreData();
      fetchEvents();
    }
  }, []);

  const handleEventClick = (eventSlug: string) => {
    // setSelectedEvent(eventId);
    // setShowEventDetail(true);
    navigate(`/${organizationName}/events/${eventSlug}`);
  };

  const handleGetTickets = (event: string) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
  };

  const handleBackToList = () => {
    setShowEventDetail(false);
    setSelectedEvent(null);
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setSidebarOpen(false);
  };

  if (showEventDetail && selectedEvent && organizerInfo) {
    return <EventFront eventId={selectedEvent} onBack={handleBackToList} />;
  }

  const categories =
    events && events.length > 0
      ? ["all", ...Array.from(new Set(events.map((e) => e.category)))]
      : ["all"];

  const featuredEvent =
    events && events.length > 0
      ? events.find((e) => e.featured) || events[0]
      : null;

  const filteredEvents = events.filter((event) => {
    const matchesSearch = event.name.includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-base sm:text-lg font-medium">Loading events...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center bg-card rounded-xl shadow-lg p-6 sm:p-8 max-w-md w-full border">
          <p className="text-red-600 mb-4 text-base sm:text-lg">{error}</p>
          <Button
            onClick={onBack}
            className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const design = settings?.settings?.design;
  const features = settings?.settings?.features;
  const general = settings?.settings?.general;

  const getThemeColors = () => {
    return {
      "--background": "#f9fafb",
      "--foreground": "#111827",
      "--card": "#ffffff",
      "--card-foreground": "#111827",
      "--muted": "#f3f4f6",
      "--muted-foreground": "#6b7280",
      "--border": "#e5e7eb",
      "--primary": design.primaryColor,
      "--secondary": design.secondaryColor,
    };
  };

  const themeStyles: CSSProperties = {
    ...getThemeColors(),
    fontFamily: design.fontFamily,
  } as CSSProperties;

  const getBannerHeight = () => {
    switch (design.bannerHeight) {
      case "small":
        return "300px";
      case "medium":
        return "400px";
      case "large":
        return "500px";
      case "xl":
        return "600px";
      default:
        return "400px";
    }
  };

  const header = settings?.settings?.design.layout.header || "modern";
  const banner = settings?.settings?.design.showBanner
    ? settings?.settings?.design?.layout.banner
    : "";
  const allProducts = settings?.settings?.design.layout.allProducts || "modern";
  const footer = settings?.settings?.design?.layout.footer || "modern";

  const infoBadgeStyle = {
    backgroundColor: settings?.settings?.design.secondaryColor,
    color: "#fff",
    fontFamily: settings?.settings?.design.fontFamily,
  };

  const gradientHeadingStyle: React.CSSProperties = {
    color: design.secondaryColor,
    fontFamily: design.fontFamily,
    fontWeight: 700,
  };

  // Use this for event card titles
  const cardTitleStyle: React.CSSProperties = {
    fontFamily: design.fontFamily,
    fontWeight: 600,
    color: "#111827",
    transition: "color 0.25s ease",
  };

  const onShare = async () => {
    const shareUrl = `https://eventsh.com/${settings.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Check out ${general.storeName} on EventSH`,
          url: shareUrl,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      // Fallback for browsers that don't support navigator.share
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Store link copied to clipboard: " + shareUrl);
      } catch {
        alert("Sharing is not supported on this device.");
      }
    }
  };

  const handleCartClick = () => {
    if (!settings?.organizerId) return;
    navigate(`/ticket-cart/${settings.organizerId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Animations ── */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-card-glow { }
        .anim-card-glow-white { }
        .anim-float { }
        .anim-fade-up { animation: fadeSlideUp 0.55s ease-out both; }
        .anim-border-glow { }
        .card-title-hover:hover { color: ${design.secondaryColor} !important; }
        .featured-small-card:hover .card-hover-name { color: ${design.secondaryColor}; }
      `}</style>
      {/* SEO Head */}
      <Helmet>
        <title>
          {settings?.settings?.general.storeName || "Event Organizer"}
        </title>
        <meta
          name="description"
          content={settings?.settings?.general.description || "Event Organizer"}
        />
        <meta
          property="og:title"
          content={settings?.settings?.general.storeName || "Event Organizer"}
        />
        <meta
          property="og:description"
          content={settings?.settings?.general.description || "Event Organizer"}
        />
      </Helmet>
      {settings?.settings?.seo.customCode && (
        <div
          dangerouslySetInnerHTML={{
            __html: settings?.settings?.seo.customCode,
          }}
        />
      )}

      {/* STOREFRONT CONTENT */}
      <div style={themeStyles} className="text-foreground">
        {settings?.settings?.design.layout.visibleAdvertismentBar &&
          settings?.settings?.design.layout.advertiseText && (
            <AnnouncementBar
              message={settings?.settings?.design.layout.advertiseText}
              backgroundColor={
                settings?.settings?.design.layout.adBarBgcolor || "#000000"
              }
              textColor={
                settings?.settings?.design.layout.adBarTextColor || "#ffffff"
              }
              speed="100s"
              fontFamily={settings?.settings?.design.fontFamily || "Arial"}
            />
          )}
        {/* Navigation - Modern Header */}
        {header === "modern" && (
          <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 sm:top-0 z-40">
            <div className="max-w-7xl mx-auto px-2 sm:px-4">
              <div className="flex justify-between items-center h-14 sm:h-16">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden p-1 sm:p-2"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>

                <div className="flex items-center space-x-3 sm:space-x-6 lg:space-x-8">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    {general.logo ? (
                      <img
                        src={getImageUrl(general.logo)}
                        alt="Logo"
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling?.classList.remove(
                            "hidden",
                          );
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-lg ${
                        general.logo ? "hidden" : ""
                      }`}
                      style={{ backgroundColor: design.primaryColor }}
                    >
                      {general.storeName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h1
                        className="font-bold text-base sm:text-lg lg:text-xl text-gray-900 truncate max-w-auto sm:max-w-none"
                        style={{ fontFamily: design.fontFamily }}
                      >
                        {general.storeName}
                      </h1>
                    </div>
                  </div>
                  <div className="hidden md:flex mr-15 space-x-4 lg:space-x-8">
                    <button
                      onClick={() => scrollToSection("home")}
                      className="text-gray-900 hover:text-primary font-medium transition-colors text-sm lg:text-base"
                    >
                      Home
                    </button>
                    <button
                      onClick={() => scrollToSection("events")}
                      className="text-gray-600 hover:text-primary transition-colors text-sm lg:text-base"
                    >
                      Events
                    </button>
                    <button
                      onClick={() => scrollToSection("about")}
                      className="text-gray-600 hover:text-primary transition-colors text-sm lg:text-base"
                    >
                      About
                    </button>
                    <button
                      onClick={() => scrollToSection("contact")}
                      className="text-gray-600 hover:text-primary transition-colors text-sm lg:text-base"
                    >
                      Contact
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-1 sm:space-x-3">
                  {features.showWishlist && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-600 hover:text-primary p-1 sm:p-2"
                    >
                      <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  )}
                  <Button
                    variant="buttonOutline"
                    size="lg"
                    onClick={handleCartClick}
                    className="relative"
                  >
                    <Ticket className="h-5 w-5" />

                    {cartCount > 0 && (
                      <span
                        className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: design.primaryColor }}
                      >
                        {cartCount > 99 ? "99+" : cartCount}
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </nav>
        )}
        {/* Navigation - Minimal Header */}
        {header === "minimal" && (
          <>
            <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
              <div className="w-full px-3 sm:px-4 md:px-6">
                <div className="flex justify-between items-center h-14 sm:h-16 md:h-18">
                  <div className="hidden md:flex space-x-4 lg:space-x-6 flex-shrink-0">
                    <button
                      onClick={() => scrollToSection("home")}
                      className="text-gray-900 hover:text-primary font-medium hover:font-bold transition-all duration-200 text-xs lg:text-sm whitespace-nowrap"
                    >
                      Home
                    </button>
                    <button
                      onClick={() => scrollToSection("events")}
                      className="text-gray-600 hover:text-primary font-medium hover:font-bold transition-all duration-200 text-xs lg:text-sm whitespace-nowrap"
                    >
                      Events
                    </button>
                    <button
                      onClick={() => scrollToSection("about")}
                      className="text-gray-600 hover:text-primary font-medium hover:font-bold transition-all duration-200 text-xs lg:text-sm whitespace-nowrap"
                    >
                      About
                    </button>
                    <button
                      onClick={() => scrollToSection("contact")}
                      className="text-gray-600 hover:text-primary font-medium hover:font-bold transition-all duration-200 text-xs lg:text-sm whitespace-nowrap"
                    >
                      Contact
                    </button>
                  </div>

                  <div className="md:absolute md:left-1/2 md:transform md:-translate-x-1/2 flex items-center space-x-2 sm:space-x-3 md:space-x-4 flex-shrink-0">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      {general.logo ? (
                        <img
                          src={getImageUrl(general.logo)}
                          alt="Logo"
                          className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextElementSibling?.classList.remove(
                              "hidden",
                            );
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-base md:text-lg ${
                          general.logo ? "hidden" : ""
                        }`}
                        style={{ backgroundColor: design.primaryColor }}
                      >
                        {general.storeName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h1
                          className="font-bold text-sm sm:text-base md:text-lg lg:text-xl text-gray-900 truncate max-w-auto sm:max-w-auto md:max-w-none"
                          style={{ fontFamily: design.fontFamily }}
                        >
                          {general.storeName}
                        </h1>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 sm:space-x-2 ml-auto flex-shrink-0">
                    <button
                      onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                      className="md:hidden text-gray-600 hover:text-primary transition-colors p-1.5 sm:p-2"
                      aria-label="Toggle menu"
                    >
                      {isMobileMenuOpen ? (
                        <X className="h-5 w-5 sm:h-6 sm:w-6" />
                      ) : (
                        <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
                      )}
                    </button>

                    {features.showWishlist && (
                      <button
                        className="hidden sm:flex text-gray-600 hover:text-primary p-1.5 sm:p-2 flex-shrink-0"
                        aria-label="Wishlist"
                      >
                        <Heart className="h-4 w-4 sm:h-5 sm:w-5 md:h-5 md:w-5" />
                      </button>
                    )}

                    <button
                      className="relative text-gray-600 hover:text-primary transition-colors p-1.5 sm:p-2 flex-shrink-0"
                      aria-label="My tickets"
                    >
                      <Ticket className="h-5 w-5 sm:h-6 sm:w-6 md:h-6 md:w-6" />
                    </button>
                  </div>
                </div>

                {isMobileMenuOpen && (
                  <div className="md:hidden bg-gray-50 border-t border-gray-200 animate-in fade-in duration-200">
                    <div className="px-3 sm:px-4 py-2 sm:py-3 space-y-2 sm:space-y-3">
                      <button
                        onClick={() => {
                          scrollToSection("home");
                          closeMobileMenu();
                        }}
                        className="block w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 text-gray-900 hover:bg-gray-200 font-semibold transition-colors rounded text-sm sm:text-base"
                      >
                        Home
                      </button>
                      <button
                        onClick={() => {
                          scrollToSection("events");
                          closeMobileMenu();
                        }}
                        className="block w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 text-gray-600 hover:bg-gray-200 font-semibold transition-colors rounded text-sm sm:text-base"
                      >
                        Events
                      </button>
                      <button
                        onClick={() => {
                          scrollToSection("about");
                          closeMobileMenu();
                        }}
                        className="block w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 text-gray-600 hover:bg-gray-200 font-semibold transition-colors rounded text-sm sm:text-base"
                      >
                        About
                      </button>
                      <button
                        onClick={() => {
                          scrollToSection("contact");
                          closeMobileMenu();
                        }}
                        className="block w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 text-gray-600 hover:bg-gray-200 font-semibold transition-colors rounded text-sm sm:text-base"
                      >
                        Contact
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </>
        )}
        {/* Mobile Sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed left-0 top-0 h-full w-72 sm:w-80 bg-white border-r border-gray-200 p-4 sm:p-6 shadow-2xl overflow-y-auto">
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <span className="font-bold text-lg sm:text-xl text-gray-900">
                  {general.storeName}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="space-y-4 sm:space-y-6">
                <button
                  onClick={() => scrollToSection("home")}
                  className="block w-full text-left py-3 text-base sm:text-lg font-semibold text-gray-900 hover:text-primary transition-colors border-b border-gray-100"
                >
                  Home
                </button>
                <button
                  onClick={() => scrollToSection("events")}
                  className="block w-full text-left py-3 text-base sm:text-lg text-gray-600 text-gray-600 hover:text-primary transition-colors border-b border-gray-100"
                >
                  Events
                </button>
                <button
                  onClick={() => scrollToSection("about")}
                  className="block w-full text-left py-3 text-base sm:text-lg text-gray-600 text-gray-600 hover:text-primary transition-colors border-b border-gray-100"
                >
                  About
                </button>
                <button
                  onClick={() => scrollToSection("contact")}
                  className="block w-full text-left py-3 text-base sm:text-lg text-gray-600 text-gray-600 hover:text-primary transition-colors border-b border-gray-100"
                >
                  Contact
                </button>
              </nav>
            </div>
          </div>
        )}

        {banner === "modern" && design.showBanner && (
          <section
            id="home"
            className="relative overflow-hidden"
            style={{ height: getBannerHeight() }}
          >
            {design.bannerImage && (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                  style={{
                    backgroundImage: `url("${getImageUrl(
                      design.bannerImage,
                    )}")`,
                  }}
                />
                <div className="absolute inset-0 bg-black/50" />
              </>
            )}

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
              <div className="max-w-xl sm:max-w-2xl lg:max-w-3xl text-white">
                <h1
                  className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight"
                  style={{ fontFamily: design.fontFamily }}
                >
                  {general.storeName}
                </h1>
                <p className="text-sm sm:text-lg lg:text-xl mb-6 sm:mb-8 opacity-90 leading-relaxed">
                  {general.tagline}
                </p>
                <div className="flex">
                  <Button
                    size="lg"
                    className="px-10 sm:px-16 lg:px-20 py-3 sm:py-4 rounded-xl text-sm sm:text-base lg:text-lg font-bold shadow-xl transition-all hover:scale-105 w-full sm:w-auto"
                    style={{ backgroundColor: design.primaryColor }}
                    onClick={() => scrollToSection("events")}
                  >
                    Browse Events
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Hero Banner - Minimal (EventHub-style) */}
        {banner === "minimal" && design.showBanner && (
          <section
            id="home"
            className="relative overflow-hidden bg-black"
            style={{ minHeight: getBannerHeight() }}
          >
            {/* Background image with dark overlay */}
            {design.bannerImage && (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                  style={{
                    backgroundImage: `url("${getImageUrl(design.bannerImage)}")`,
                  }}
                />
                <div className="absolute inset-0 bg-black/65" />
              </>
            )}
            {!design.bannerImage && (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800" />
            )}

            {/* Content */}
            <div
              className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center"
              style={{ minHeight: getBannerHeight() }}
            >
              <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center py-12 lg:py-0">
                {/* LEFT: Text + stats */}
                <div className="flex flex-col space-y-6 sm:space-y-8">
                  {/* Discovery badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm w-fit">
                    <span className="text-yellow-400 text-sm">✦</span>
                    <span className="text-white text-sm font-medium">
                      Discover Amazing Events Near You
                    </span>
                  </div>

                  {/* Headline */}
                  <h1
                    className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-tight text-white"
                    style={{ fontFamily: design.fontFamily }}
                  >
                    Unforgettable
                    <br />
                    <span style={{ color: design.primaryColor }}>
                      {general.storeName}
                    </span>
                    <br />
                    Await You
                  </h1>

                  <p className="text-base sm:text-lg text-white/75 leading-relaxed max-w-xl">
                    {general.tagline ||
                      "Book tickets for concerts, festivals, conferences, and more. Your next adventure is just a click away."}
                  </p>

                  {/* CTA Buttons */}
                  <div className="flex flex-col xs:flex-row gap-4">
                    <Button
                      size="lg"
                      className="px-8 py-4 rounded-2xl text-base font-bold shadow-xl transition-all hover:scale-105"
                      style={{
                        backgroundColor: design.primaryColor,
                        color: "#fff",
                      }}
                      onClick={() => scrollToSection("events")}
                    >
                      Explore Events →
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="px-8 py-4 rounded-2xl text-base font-bold border-white/30 text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
                      onClick={scrollToHowItWorks}
                    >
                      How It Works
                    </Button>
                  </div>

                  {/* Stats row */}
                  {settings?.settings?.design.layout
                    .visibleStatisticsSection && (
                    <div className="flex flex-wrap gap-8 pt-4">
                      <div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-white">
                          {events?.length || 0}+
                        </div>
                        <div className="text-white/60 text-sm mt-0.5">
                          Events
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-white">
                          120+
                        </div>
                        <div className="text-white/60 text-sm mt-0.5">
                          Cities
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl sm:text-3xl font-extrabold text-white">
                          {happAttendees > 0 ? `${happAttendees}+` : "2M+"}
                        </div>
                        <div className="text-white/60 text-sm mt-0.5">
                          Happy Attendees
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: Featured event card */}
                {featuredEvent && (
                  <div className="flex justify-center lg:justify-end">
                    <div
                      className="w-full max-w-sm rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                      style={{
                        backgroundColor: "rgba(20,20,20,0.85)",
                        backdropFilter: "blur(16px)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                      onClick={() => handleEventClick(featuredEvent.id)}
                    >
                      <img
                        src={getImageUrl(featuredEvent.image)}
                        alt={featuredEvent.name}
                        className="w-full h-48 sm:h-56 object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder-event.jpg";
                          e.currentTarget.onerror = null;
                        }}
                      />
                      <div className="p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-orange-400">🔥</span>
                          <Badge
                            className="text-white text-xs font-semibold px-3 py-1"
                            style={{ backgroundColor: design.primaryColor }}
                          >
                            {featuredEvent.badge || "Hot Event"}
                          </Badge>
                        </div>
                        <h3 className="text-white font-bold text-lg leading-snug">
                          {featuredEvent.name}
                        </h3>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-white/60 text-sm">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{featuredEvent.date}</span>
                          </div>
                          <div className="flex items-center gap-2 text-white/60 text-sm">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{featuredEvent.location}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span
                            className="text-xl font-extrabold"
                            style={{ color: design.primaryColor }}
                          >
                            {featuredEvent.price != null ? (featuredEvent.price === 0 ? "Free" : formatPrice(featuredEvent.price)) : ""}
                          </span>
                          <span className="text-white/50 text-sm">
                            {featuredEvent.maxAttendees > 0
                              ? `${featuredEvent.maxAttendees.toLocaleString()} attending`
                              : "Open event"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
        {/* Hero Banner - Mega */}
        {banner === "mega" && design.showBanner && (
          <section
            id="home"
            className="w-full px-4 sm:px-6 lg:px-8 py-8"
            style={{ height: getBannerHeight() }}
          >
            <div
              className="w-full h-full rounded-[2rem] sm:rounded-[3rem] overflow-hidden flex items-center relative"
              style={{
                backgroundColor: design.primaryColor,
                backgroundImage: design.heroBannerImage
                  ? `url("${getImageUrl(design.heroBannerImage)}")`
                  : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              {design.heroBannerImage && (
                <div className="absolute inset-0 bg-black/30" />
              )}

              <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[0.8fr_1.2fr] gap-4 sm:gap-8 items-center relative z-10">
                <div className="flex justify-center md:justify-end w-full order-1 lg:order-2">
                  <div className="w-full max-w-[16rem] md:max-w-[14rem] lg:max-w-[32rem] h-56 sm:h-64 md:h-72 lg:h-[24rem] bg-gray-200 rounded-3xl overflow-hidden shadow-2xl relative">
                    {design.bannerImage && (
                      <img
                        src={getImageUrl(design.bannerImage)}
                        alt="Hero image"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center md:items-start space-y-4 sm:space-y-6 lg:space-y-8 max-w-lg lg:max-w-sm mx-auto lg:mx-0 order-2 lg:order-1">
                  {general.logo && (
                    <img
                      src={getImageUrl(general.logo)}
                      alt={`${general.storeName} logo`}
                      className="h-10 w-auto sm:h-12 lg:h-16 drop-shadow-lg"
                    />
                  )}
                  <h1
                    className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-white text-center md:text-left drop-shadow-lg"
                    style={{ fontFamily: design.fontFamily }}
                  >
                    {general.storeName}
                  </h1>
                  <div className="w-full sm:w-auto flex justify-center md:justify-start">
                    <Button
                      size="lg"
                      className="px-4 sm:px-6 lg:px-10 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs lg:text-base font-bold shadow-lg w-full sm:w-auto transition-transform hover:scale-105 hover:shadow-xl"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.95)",
                        color: design.primaryColor,
                        backdropFilter: "blur(10px)",
                      }}
                      onClick={() => scrollToSection("events")}
                    >
                      Browse Events
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {settings?.settings?.design.layout.visibleStatisticsSection && (
          <section className="py-10 sm:py-14 lg:py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Section label */}
              <div className="flex items-center gap-3 mb-8 sm:mb-10">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-semibold tracking-[0.25em] text-gray-400 uppercase">
                  By the numbers
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* Bento grid: 2×2 on mobile, 4-across on lg */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Card 1 — Events */}
                <div className="rounded-2xl sm:rounded-3xl p-5 sm:p-7 flex flex-col justify-between border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <Trophy
                    className="h-5 w-5 mb-6 sm:mb-8"
                    style={{ color: design.primaryColor }}
                  />
                  <div>
                    <div
                      className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-1"
                      style={{ color: design.secondaryColor }}
                    >
                      {events?.length || 0}+
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 tracking-wide mt-2">
                      Events Organized
                    </div>
                  </div>
                </div>

                {/* Card 2 — Attendees */}
                <div className="rounded-2xl sm:rounded-3xl p-5 sm:p-7 flex flex-col justify-between border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <Users
                    className="h-5 w-5 mb-6 sm:mb-8"
                    style={{ color: design.primaryColor }}
                  />
                  <div>
                    <div
                      className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-1"
                      style={{ color: design.secondaryColor }}
                    >
                      {happAttendees > 0 ? `${happAttendees}+` : "50K+"}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 tracking-wide mt-2">
                      Happy Attendees
                    </div>
                  </div>
                </div>

                {/* Card 3 — Rating */}
                <div className="rounded-2xl sm:rounded-3xl p-5 sm:p-7 flex flex-col justify-between border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <Star className="h-5 w-5 text-yellow-500 mb-6 sm:mb-8 fill-yellow-500" />
                  <div>
                    <div className="flex items-end gap-1.5">
                      <span
                        className="text-3xl sm:text-4xl lg:text-5xl font-bold"
                        style={{ color: design.secondaryColor }}
                      >
                        {organizerInfo?.rating || 4.9}
                      </span>
                      <span className="text-gray-400 text-lg mb-1">/5</span>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 tracking-wide mt-2">
                      Average Rating
                    </div>
                  </div>
                </div>

                {/* Card 4 — Established */}
                <div className="rounded-2xl sm:rounded-3xl p-5 sm:p-7 flex flex-col justify-between border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <TrendingUp
                    className="h-5 w-5 mb-6 sm:mb-8"
                    style={{ color: design.primaryColor }}
                  />
                  <div>
                    <div
                      className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-1"
                      style={{ color: design.secondaryColor }}
                    >
                      {organizerInfo?.createdAt
                        ? new Date(organizerInfo.createdAt).getFullYear()
                        : "2018"}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 tracking-wide mt-2">
                      Established
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
        {/* Featured Event — Bento Grid (big left + 2×2 right) */}
        {featuredEvent &&
          settings?.settings?.design.layout.visibleFeaturedProducts && (
            <section className="py-8 sm:py-12 lg:py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section heading */}
                <div className="flex items-center gap-4 mb-8 sm:mb-10">
                  <div>
                    <p
                      className="text-xs font-semibold tracking-[0.2em] uppercase mb-1"
                      style={{ color: design.primaryColor }}
                    >
                      Don't miss it
                    </p>
                    <h2
                      className="text-3xl sm:text-4xl lg:text-5xl font-bold"
                      style={gradientHeadingStyle}
                    >
                      Featured Event
                    </h2>
                  </div>
                  <div className="h-px flex-1 bg-gray-200 hidden sm:block" />
                </div>

                {/* Bento grid: big left card + 2×2 smaller cards right */}
                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-3 sm:gap-4">
                  {/* ── BIG LEFT CARD ── */}
                  <div
                    className="relative rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer group anim-fade-up shadow-sm hover:shadow-xl transition-shadow duration-300"
                    style={{ minHeight: "480px" }}
                    onClick={() => handleEventClick(featuredEvent.id)}
                  >
                    <img
                      src={getImageUrl(featuredEvent.image)}
                      alt={featuredEvent.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder-event.jpg";
                        e.currentTarget.onerror = null;
                      }}
                    />
                    {/* Gradient scrim */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/30 to-transparent" />

                    {/* Content pinned to bottom */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                      {/* Featured badge */}
                      <div className="mb-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: design.primaryColor }}
                        >
                          ✦ {featuredEvent.badge || "Featured"}
                        </span>
                      </div>

                      <h3
                        className="text-white font-semibold text-2xl sm:text-3xl lg:text-4xl leading-tight mb-2 line-clamp-2"
                        style={{ fontFamily: design.fontFamily }}
                      >
                        {featuredEvent.name}
                      </h3>
                      <p className="text-white/60 text-sm leading-relaxed mb-5 line-clamp-2">
                        {featuredEvent.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">
                            From
                          </p>
                          <span
                            className="text-2xl sm:text-3xl font-bold"
                            style={{ color: design.secondaryColor }}
                          >
                            {featuredEvent.price != null ? (featuredEvent.price === 0 ? "Free" : formatPrice(featuredEvent.price)) : ""}
                          </span>
                        </div>
                        <button
                          className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEventClick(featuredEvent.id);
                          }}
                        >
                          <span>Order</span>
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition-all duration-200">
                            →
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── 2×2 SMALL CARDS GRID ── */}
                  {events.length > 1 && (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {events
                        .filter((e) => e.id !== featuredEvent.id)
                        .slice(0, 4)
                        .map((event, idx) => (
                          <div
                            key={event.id}
                            className="featured-small-card relative rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer group anim-fade-up shadow-sm hover:shadow-lg transition-shadow duration-300"
                            style={{
                              minHeight: "220px",
                              animationDelay: `${0.1 + idx * 0.08}s`,
                            }}
                            onClick={() => handleEventClick(event.id)}
                          >
                            <img
                              src={getImageUrl(event.image)}
                              alt={event.name}
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder-event.jpg";
                                e.currentTarget.onerror = null;
                              }}
                            />
                            {/* Scrim */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                              <h3 className="card-hover-name text-white font-medium text-sm sm:text-base leading-snug mb-1 line-clamp-1 transition-colors duration-250">
                                {event.name}
                              </h3>
                              <span
                                className="text-sm font-bold"
                                style={{ color: design.secondaryColor }}
                              >
                                {event.price != null ? (event.price === 0 ? "Free" : formatPrice(event.price)) : ""}
                              </span>
                            </div>
                          </div>
                        ))}

                      {/* Fill remaining slots with placeholder if fewer than 4 side events */}
                      {events.filter((e) => e.id !== featuredEvent.id).length <
                        4 &&
                        Array.from({
                          length:
                            4 -
                            Math.min(
                              events.filter((e) => e.id !== featuredEvent.id)
                                .length,
                              4,
                            ),
                        }).map((_, i) => (
                          <div
                            key={`ph-${i}`}
                            className="rounded-2xl sm:rounded-3xl border border-dashed border-gray-200 flex items-center justify-center"
                            style={{ minHeight: "220px" }}
                          >
                            <p className="text-gray-300 text-xs">More soon</p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        {/* Quick Picks — Horizontal Scroll Strip */}
        {settings?.settings?.design.layout.visibleQuickPicks && (
          <section className="py-8 sm:py-12 lg:py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Header row */}
              <div className="flex items-end justify-between mb-8 sm:mb-10">
                <div>
                  <p
                    className="text-xs font-semibold tracking-[0.2em] uppercase mb-1"
                    style={{ color: design.primaryColor }}
                  >
                    Handpicked for you
                  </p>
                  <h2
                    className="text-3xl sm:text-4xl font-bold"
                    style={gradientHeadingStyle}
                  >
                    Quick Picks
                  </h2>
                </div>
                {totalSlides > 1 && (
                  <div className="flex gap-2">
                    <button
                      onClick={prevSlide}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition-all duration-200 shadow-sm"
                    >
                      <ChevronLeft className="h-4 w-4 text-gray-600" />
                    </button>
                    <button
                      onClick={nextSlide}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition-all duration-200 shadow-sm"
                    >
                      <ChevronRight className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>

              {carouselEvents.length > 0 && (
                <div className="relative overflow-hidden">
                  <div
                    className="flex gap-4 transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                  >
                    {Array.from({ length: totalSlides }).map(
                      (_, slideIndex) => (
                        <div key={slideIndex} className="w-full flex-shrink-0">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {carouselEvents
                              .slice(slideIndex * 2, slideIndex * 2 + 2)
                              .map((event, index) => (
                                <div
                                  key={event.id}
                                  className={`relative rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl transition-shadow duration-300 ${index === 1 ? "hidden sm:block" : "block"}`}
                                  style={{ height: "360px" }}
                                  onClick={() => handleEventClick(event.id)}
                                >
                                  {/* BG image */}
                                  <img
                                    alt={event.name}
                                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                    onError={(e) => {
                                      e.currentTarget.src =
                                        "/placeholder-event.jpg";
                                      e.currentTarget.onerror = null;
                                    }}
                                    src={getImageUrl(event.image)}
                                  />
                                  {/* Gradient scrim */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                                  {/* Rating pill top-right */}
                                  <div className="absolute top-4 right-4 flex items-center gap-1 bg-black/50 backdrop-blur-sm border border-white/15 rounded-full px-2.5 py-1">
                                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                                    <span className="text-white text-xs">
                                      {event.rating}
                                    </span>
                                  </div>

                                  {/* Content */}
                                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                                    <Badge
                                      className="mb-2 text-white text-xs border-0 rounded-full"
                                      style={{
                                        backgroundColor: design.secondaryColor,
                                      }}
                                    >
                                      {event.category}
                                    </Badge>
                                    <h3
                                      className="text-white font-semibold text-lg sm:text-xl leading-snug mb-3 line-clamp-2"
                                      style={{ fontFamily: design.fontFamily }}
                                    >
                                      {event.name}
                                    </h3>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4">
                                      <span className="flex items-center gap-1 text-white/60 text-xs">
                                        <Calendar className="h-3 w-3" />
                                        {event.date}
                                      </span>
                                      <span className="flex items-center gap-1 text-white/60 text-xs">
                                        <MapPin className="h-3 w-3" />
                                        <span className="line-clamp-1 max-w-[100px]">
                                          {event.location}
                                        </span>
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span
                                        className="text-xl font-bold"
                                        style={{ color: design.secondaryColor }}
                                      >
                                        {event.price != null ? (event.price === 0 ? "Free" : formatPrice(event.price)) : ""}
                                      </span>
                                      <Button
                                        className="rounded-xl px-4 py-2 text-xs font-light border-0 transition-all hover:scale-105"
                                        style={{
                                          backgroundColor: design.primaryColor,
                                          color: "#fff",
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEventClick(event.id);
                                        }}
                                      >
                                        View Event
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            {carouselEvents.slice(
                              slideIndex * 2,
                              slideIndex * 2 + 2,
                            ).length === 1 && (
                              <div className="hidden sm:flex h-[360px] rounded-2xl sm:rounded-3xl border border-dashed border-gray-200 items-center justify-center">
                                <p className="text-gray-300 text-sm">
                                  More events coming soon
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Dot indicators */}
              {totalSlides > 1 && (
                <div className="flex justify-center mt-6 gap-2">
                  {Array.from({ length: totalSlides }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: index === currentSlide ? "24px" : "8px",
                        height: "8px",
                        backgroundColor:
                          index === currentSlide
                            ? design.primaryColor
                            : "rgba(0,0,0,0.15)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
        {/* All Events - Modern Layout (Big-Small Bento Grid) */}
        {allProducts === "modern" && (
          <section id="events" className="py-8 sm:py-12 lg:py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Header */}
              <div className="flex items-end justify-between mb-8 sm:mb-10">
                <div>
                  <p
                    className="text-xs font-semibold tracking-[0.2em] uppercase mb-1"
                    style={{ color: design.primaryColor }}
                  >
                    Upcoming
                  </p>
                  <h2
                    className="text-3xl sm:text-4xl font-bold"
                    style={gradientHeadingStyle}
                  >
                    All Events
                  </h2>
                </div>
              </div>

              {/* Search/filter bar */}
              {(features.showSearch || features.showFilters) && (
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-8 p-3 sm:p-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
                  {features.showSearch && (
                    <div className="flex-grow min-w-[180px] relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 sm:h-11 w-full rounded-xl bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                      />
                    </div>
                  )}
                  {features.showFilters && (
                    <div className="min-w-[150px]">
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="h-10 sm:h-11 rounded-xl bg-gray-50 border-gray-200 text-gray-700">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="featured">Featured</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="price-low">
                            Price: Low to High
                          </SelectItem>
                          <SelectItem value="price-high">
                            Price: High to Low
                          </SelectItem>
                          <SelectItem value="rating">Highest Rated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Bento grid: first item spans full width on mobile, left half on lg */}
              {filteredEvents.length > 0 && (
                <div className="space-y-4">
                  {/* Group events in sets: 1 big + up to 2 small */}
                  {Array.from({
                    length: Math.ceil(filteredEvents.length / 3),
                  }).map((_, groupIdx) => {
                    const bigEvent = filteredEvents[groupIdx * 3];
                    const smallEvents = filteredEvents.slice(
                      groupIdx * 3 + 1,
                      groupIdx * 3 + 3,
                    );
                    return (
                      <div
                        key={groupIdx}
                        className={`grid gap-4 ${smallEvents.length > 0 ? "grid-cols-1 lg:grid-cols-5" : "grid-cols-1"}`}
                      >
                        {/* Big card */}
                        <div
                          className={`relative rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl transition-shadow duration-300 ${smallEvents.length > 0 ? "lg:col-span-3" : "lg:col-span-5"}`}
                          style={{ minHeight: "320px" }}
                          onClick={() => handleEventClick(bigEvent.id)}
                        >
                          <img
                            src={getImageUrl(bigEvent.image)}
                            alt={bigEvent.name}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            onError={(e) => {
                              e.currentTarget.src = "/placeholder-event.jpg";
                              e.currentTarget.onerror = null;
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                          <div className="absolute top-4 left-4">
                            <Badge
                              className="text-white text-xs border-0 rounded-full"
                              style={{ backgroundColor: design.secondaryColor }}
                            >
                              {bigEvent.category}
                            </Badge>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
                            <h3
                              className="text-white font-semibold text-xl sm:text-2xl lg:text-3xl leading-snug mb-3 line-clamp-2"
                              style={{ fontFamily: design.fontFamily }}
                            >
                              {bigEvent.name}
                            </h3>
                            <div className="flex flex-wrap gap-3 mb-4">
                              <span className="flex items-center gap-1.5 text-white/60 text-xs">
                                <Calendar className="h-3 w-3" />
                                {bigEvent.date}
                              </span>
                              <span className="flex items-center gap-1.5 text-white/60 text-xs">
                                <MapPin className="h-3 w-3" />
                                <span className="line-clamp-1 max-w-[150px]">
                                  {bigEvent.location}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span
                                className="text-2xl font-bold"
                                style={{ color: design.secondaryColor }}
                              >
                                {bigEvent.price != null ? (bigEvent.price === 0 ? "Free" : formatPrice(bigEvent.price)) : ""}
                              </span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="rounded-xl px-5 font-medium text-sm border-0"
                                  style={{
                                    backgroundColor: design.primaryColor,
                                    color: "#fff",
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEventClick(bigEvent.id);
                                  }}
                                >
                                  <Ticket className="h-3.5 w-3.5 mr-1.5" />
                                  {bigEvent.hasTickets ? "Get Tickets" : bigEvent.hasRoundTables ? "Book Seats" : "View Event"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl px-4 font-medium text-sm border-white/20 bg-white/10 text-white hover:bg-white/20"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEventClick(bigEvent.id);
                                  }}
                                >
                                  Details
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Small cards */}
                        {smallEvents.length > 0 && (
                          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                            {smallEvents.map((event) => (
                              <div
                                key={event.id}
                                className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-lg transition-shadow duration-300"
                                style={{ minHeight: "148px" }}
                                onClick={() => handleEventClick(event.id)}
                              >
                                <img
                                  src={getImageUrl(event.image)}
                                  alt={event.name}
                                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                  onError={(e) => {
                                    e.currentTarget.src =
                                      "/placeholder-event.jpg";
                                    e.currentTarget.onerror = null;
                                  }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                  <Badge
                                    className="mb-1.5 text-white text-xs border-0 rounded-full"
                                    style={{
                                      backgroundColor: design.secondaryColor,
                                    }}
                                  >
                                    {event.category}
                                  </Badge>
                                  <h3
                                    className="text-white font-medium text-sm leading-snug mb-1.5 line-clamp-1"
                                    style={{ fontFamily: design.fontFamily }}
                                  >
                                    {event.name}
                                  </h3>
                                  <div className="flex items-center justify-between">
                                    <span
                                      className="text-sm font-bold"
                                      style={{ color: design.secondaryColor }}
                                    >
                                      {event.price != null ? (event.price === 0 ? "Free" : formatPrice(event.price)) : ""}
                                    </span>
                                    <span className="text-white/60 text-xs">
                                      {event.date}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
        {/* All Events - Minimal Layout (Masonry / Staggered Grid) */}
        {allProducts === "minimal" && (
          <section id="events" className="py-8 sm:py-12 lg:py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Header */}
              <div className="flex items-end justify-between mb-8 sm:mb-10">
                <div>
                  <p
                    className="text-xs font-semibold tracking-[0.2em] uppercase mb-1"
                    style={{ color: design.primaryColor }}
                  >
                    Browse
                  </p>
                  <h2
                    className="text-3xl sm:text-4xl font-bold"
                    style={gradientHeadingStyle}
                  >
                    All Events
                  </h2>
                </div>
              </div>

              {/* Filters */}
              {(features.showSearch || features.showFilters) && (
                <div className="flex flex-wrap items-center gap-3 mb-8 p-3 rounded-2xl border border-gray-200 bg-white shadow-sm">
                  {features.showSearch && (
                    <div className="flex-grow min-w-[180px] relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 rounded-xl bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                      />
                    </div>
                  )}
                  {features.showFilters && (
                    <div className="min-w-[150px]">
                      <Select
                        value={selectedCategory}
                        onValueChange={setSelectedCategory}
                      >
                        <SelectTrigger className="h-10 rounded-xl bg-gray-50 border-gray-200 text-gray-700">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Staggered 2-col masonry-style: odd rows normal, even rows offset */}
              {filteredEvents.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  {filteredEvents.map((event, idx) => {
                    // Alternate tall and short heights for masonry feel
                    const isTall = idx % 3 === 0;
                    const cardH = isTall ? "420px" : "300px";
                    return (
                      <div
                        key={event.id}
                        className="relative rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl transition-shadow duration-300"
                        style={{ height: cardH }}
                        onClick={() => handleEventClick(event.id)}
                      >
                        <img
                          src={getImageUrl(event.image)}
                          alt={event.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder-event.jpg";
                            e.currentTarget.onerror = null;
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                        {/* Top: rating */}
                        <div className="absolute top-4 right-4 flex items-center gap-1 bg-black/40 backdrop-blur-sm border border-white/15 rounded-full px-2.5 py-1">
                          <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-white text-xs">
                            {event.rating}
                          </span>
                        </div>

                        {/* Bottom content */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                          <Badge
                            className="mb-2 text-white text-xs border-0 rounded-full"
                            style={{ backgroundColor: design.secondaryColor }}
                          >
                            {event.category}
                          </Badge>
                          <h3
                            className="text-white font-semibold text-base sm:text-lg leading-snug mb-2 line-clamp-2"
                            style={{ fontFamily: design.fontFamily }}
                          >
                            {event.name}
                          </h3>
                          <div className="flex gap-3 mb-3">
                            <span className="flex items-center gap-1 text-white/55 text-xs">
                              <Calendar className="h-3 w-3" />
                              {event.date}
                            </span>
                            <span className="flex items-center gap-1 text-white/55 text-xs">
                              <MapPin className="h-3 w-3" />
                              <span className="line-clamp-1 max-w-[90px]">
                                {event.location}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span
                              className="text-lg font-bold"
                              style={{ color: design.secondaryColor }}
                            >
                              {event.price != null ? (event.price === 0 ? "Free" : formatPrice(event.price)) : ""}
                            </span>
                            <Button
                              className="rounded-xl px-4 py-2 text-xs font-medium border-0 transition-all hover:scale-105"
                              style={{
                                backgroundColor: design.primaryColor,
                                color: "#fff",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event.id);
                              }}
                            >
                              View Event
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
        {/* All Events - Mega Layout (3-col dark cards with info overlay) */}
        {allProducts === "mega" && (
          <section id="events" className="py-8 sm:py-10 lg:py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Header */}
              <div className="flex items-end justify-between mb-8 sm:mb-10">
                <div>
                  <p
                    className="text-xs font-semibold tracking-[0.2em] uppercase mb-1"
                    style={{ color: design.primaryColor }}
                  >
                    All upcoming
                  </p>
                  <h2
                    className="text-3xl sm:text-4xl font-bold"
                    style={gradientHeadingStyle}
                  >
                    All Events
                  </h2>
                </div>
              </div>

              {/* Filters */}
              {(features.showSearch || features.showFilters) && (
                <div className="flex flex-wrap items-center gap-3 mb-8 p-3 rounded-2xl border border-gray-200 bg-white shadow-sm">
                  {features.showSearch && (
                    <div className="flex-grow min-w-[180px] relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 rounded-xl bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400"
                      />
                    </div>
                  )}
                  {features.showFilters && (
                    <div className="min-w-[150px]">
                      <Select
                        value={selectedCategory}
                        onValueChange={setSelectedCategory}
                      >
                        <SelectTrigger className="h-10 rounded-xl bg-gray-50 border-gray-200 text-gray-700">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {filteredEvents.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      className="group cursor-pointer rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-200 bg-white flex flex-col transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-lg"
                      onClick={() => handleEventClick(event.id)}
                    >
                      {/* Image */}
                      <div className="relative h-52 sm:h-56 overflow-hidden">
                        <img
                          src={getImageUrl(event.image)}
                          alt={event.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder-event.jpg";
                            e.currentTarget.onerror = null;
                          }}
                        />
                        {/* Rating pill */}
                        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm border border-white/15 rounded-full px-2 py-1">
                          <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-white text-xs">
                            {event.rating}
                          </span>
                        </div>
                        {/* Category pill */}
                        <div className="absolute top-3 left-3">
                          <Badge
                            className="text-white text-xs border-0 rounded-full"
                            style={{ backgroundColor: design.secondaryColor }}
                          >
                            {event.category}
                          </Badge>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="p-4 sm:p-5 flex flex-col flex-1 gap-3">
                        <h3
                          className="card-title-hover font-semibold text-base sm:text-lg leading-snug line-clamp-2 transition-colors duration-250"
                          style={cardTitleStyle}
                        >
                          {event.name}
                        </h3>
                        <div className="flex flex-col gap-1.5">
                          <span className="flex items-center gap-2 text-gray-500 text-xs">
                            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                            {event.date} {event.time && `· ${event.time}`}
                          </span>
                          <span className="flex items-center gap-2 text-gray-500 text-xs">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="line-clamp-1">
                              {event.location}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
                          <span
                            className="text-lg font-bold"
                            style={{ color: design.secondaryColor }}
                          >
                            {event.price != null ? (event.price === 0 ? "Free" : formatPrice(event.price)) : ""}
                          </span>
                          <Button
                            className="rounded-xl px-4 py-2 text-xs font-medium border-0 transition-all hover:scale-105"
                            style={{
                              backgroundColor: design.primaryColor,
                              color: "#fff",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(event.id);
                            }}
                          >
                            View Event
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
        {/* Newsletter — Bold Gradient Panel */}
        {features.showNewsletter && (
          <section className="py-10 sm:py-14 lg:py-20 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12 lg:p-16 border border-gray-200 bg-white shadow-sm">
                {/* Decorative accent */}
                <div
                  className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none opacity-20"
                  style={{
                    background: `radial-gradient(circle, ${design.primaryColor} 0%, transparent 70%)`,
                  }}
                />

                <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
                  {/* Left text */}
                  <div className="flex-1 text-center lg:text-left">
                    <p
                      className="text-xs font-semibold tracking-[0.2em] uppercase mb-2"
                      style={{ color: design.primaryColor }}
                    >
                      Newsletter
                    </p>
                    <h2
                      className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3"
                      style={gradientHeadingStyle}
                    >
                      Stay Updated
                    </h2>
                    <p className="text-gray-500 text-base sm:text-lg leading-relaxed">
                      Subscribe for the latest event announcements, exclusive
                      offers, and insider picks.
                    </p>
                  </div>

                  {/* Right form */}
                  <div className="w-full lg:w-auto lg:min-w-[380px]">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        placeholder="Enter your email"
                        value={newsletterEmail}
                        onChange={(e) => setNewsletterEmail(e.target.value)}
                        className="flex-1 h-12 rounded-2xl bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 text-sm"
                      />
                      <Button
                        className="h-12 px-7 rounded-2xl font-medium text-sm border-0 whitespace-nowrap transition-all hover:scale-105"
                        style={{
                          backgroundColor: design.primaryColor,
                          color: "#fff",
                        }}
                      >
                        Subscribe
                      </Button>
                    </div>
                    <p className="text-gray-400 text-xs mt-2 text-center sm:text-left">
                      No spam. Unsubscribe anytime.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* About Us — Bento Grid */}
        {settings.settings.design.layout.visibleAboutUs && (
          <section id="about" className="py-10 sm:py-14 lg:py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Section label */}
              <div className="mb-8 sm:mb-10">
                <p
                  className="text-xs font-semibold tracking-[0.2em] uppercase mb-1"
                  style={{ color: design.primaryColor }}
                >
                  Our story
                </p>
                <h2
                  className="text-3xl sm:text-4xl font-bold"
                  style={gradientHeadingStyle}
                >
                  {settings.settings.design.layout.aboutUsHeading ||
                    "Who We Are"}
                </h2>
              </div>

              {/* Bento grid: 3-col on lg */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Big image card — spans 2 cols on lg */}
                <div
                  className="relative rounded-2xl sm:rounded-3xl overflow-hidden sm:col-span-2 lg:col-span-2 shadow-sm"
                  style={{ minHeight: "320px" }}
                >
                  <img
                    src={
                      getImageUrl(settings.settings.design.aboutUsImage) ||
                      "https://images.unsplash.com/photo-1540575467063-178a50c2df87"
                    }
                    alt="About Us"
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://images.unsplash.com/photo-1540575467063-178a50c2df87";
                      e.currentTarget.onerror = null;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                    <Badge style={infoBadgeStyle} className="mb-3 rounded-full">
                      About Us
                    </Badge>
                    <p className="text-white/80 text-sm sm:text-base leading-relaxed line-clamp-3">
                      {settings.settings.design.layout.aboutUsText ||
                        "Creating unforgettable experiences through exceptional events."}
                    </p>
                  </div>
                </div>

                {/* Right column: 2 stat cards stacked */}
                <div className="flex flex-col gap-4">
                  {/* Attendees card */}
                  <div
                    className="flex-1 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
                    style={{ minHeight: "148px" }}
                  >
                    <Users
                      className="h-5 w-5 mb-3"
                      style={{ color: design.primaryColor }}
                    />
                    <div>
                      <div
                        className="text-3xl sm:text-4xl font-bold mb-1"
                        style={{ color: design.secondaryColor }}
                      >
                        {happAttendees > 0 ? `${happAttendees}+` : "0+"}
                      </div>
                      <div className="text-gray-500 text-xs tracking-wide">
                        Happy Attendees
                      </div>
                    </div>
                  </div>

                  {/* Events card */}
                  <div
                    className="flex-1 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
                    style={{ minHeight: "148px" }}
                  >
                    <TrendingUp
                      className="h-5 w-5 mb-3"
                      style={{ color: design.primaryColor }}
                    />
                    <div>
                      <div
                        className="text-3xl sm:text-4xl font-bold mb-1"
                        style={{ color: design.secondaryColor }}
                      >
                        {events.length || 0}+
                      </div>
                      <div className="text-gray-500 text-xs tracking-wide">
                        Events Organized
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Contact Us — Glassmorphism 3-Panel */}
        <section id="contact" className="py-10 sm:py-14 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8 sm:mb-12 flex items-end gap-4">
              <div>
                <p
                  className="text-xs font-semibold tracking-[0.2em] uppercase mb-1"
                  style={{ color: design.primaryColor }}
                >
                  Reach out
                </p>
                <h2
                  className="text-3xl sm:text-4xl font-bold"
                  style={gradientHeadingStyle}
                >
                  Get In Touch
                </h2>
              </div>
              <div className="h-px flex-1 bg-gray-200 hidden sm:block" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Phone */}
              <div className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center gap-4 border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-gray-200 bg-gray-50">
                  <Phone
                    className="h-5 w-5"
                    style={{ color: design.primaryColor }}
                  />
                </div>
                <div>
                  <h3 className="text-gray-900 font-semibold text-base mb-1">
                    Phone
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {organizerInfo?.phoneNumber || "N/A"}
                  </p>
                </div>
              </div>

              {/* Email */}
              <a
                href={`mailto:${organizerInfo?.email || ""}`}
                className="block focus:outline-none"
              >
                <div className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center gap-4 border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-gray-200 bg-gray-50">
                    <Mail
                      className="h-5 w-5"
                      style={{ color: design.primaryColor }}
                    />
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-semibold text-base mb-1">
                      Email
                    </h3>
                    <p className="text-gray-500 text-sm break-all">
                      {organizerInfo?.email || "N/A"}
                    </p>
                  </div>
                </div>
              </a>

              {/* WhatsApp */}
              <a
                href={`https://wa.me/${(organizerInfo?.whatsAppNumber || "").replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block focus:outline-none"
              >
                <div className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center gap-4 border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-gray-200 bg-gray-50">
                    <FaWhatsapp className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-semibold text-base mb-1">
                      WhatsApp
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {organizerInfo?.whatsAppNumber || "N/A"}
                    </p>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* Footer - Modern */}
        {footer === "modern" && (
          <footer
            id="about"
            className="bg-card border-t py-8 sm:py-12 lg:py-16"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Main Footer Details */}
              <div
                id="contact"
                className="flex flex-col lg:grid lg:grid-cols-4 gap-4 mb-4 sm:mb-8"
              >
                {/* Logo & Social - Centered on Mobile/Tablet, Left-aligned on Desktop */}
                <div className="lg:col-span-2 flex flex-col items-center lg:items-start space-y-6">
                  {/* Logo and Store Name */}
                  <div className="flex items-center justify-center lg:justify-start space-x-3">
                    {general.logo ? (
                      <img
                        src={getImageUrl(general.logo)}
                        alt="Logo"
                        className="w-10 h-10 sm:w-12 sm:h-12 brightness-0 invert"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling?.classList.remove(
                            "hidden",
                          );
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-lg ${
                        general.logo ? "hidden" : ""
                      }`}
                      style={{ backgroundColor: design.primaryColor }}
                    >
                      {general.storeName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3
                        className="font-bold text-lg sm:text-xl text-black"
                        style={{ fontFamily: design.fontFamily }}
                      >
                        {general.storeName}
                      </h3>
                      {/* {shopkeeperInfo.GSTNumber && (
                        <p className="text-sm text-muted-foreground mt-1">
                          GST Number: {shopkeeperInfo.GSTNumber}
                        </p>
                      )} */}
                    </div>
                  </div>

                  {/* MOBILE/TABLET: Contact Section (Visible on sm and md, hidden on lg) */}
                  <div className="flex flex-col items-center lg:hidden w-full">
                    <h4 className="text-lg font-semibold text-gray-700">
                      Contact Us
                    </h4>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {general.contactInfo.phone && (
                        <a
                          href={`tel:${general.contactInfo.phone}`}
                          className="p-3 lg:p-4 transition-all"
                          aria-label="Phone"
                        >
                          <Phone className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                        </a>
                      )}

                      {general.contactInfo.email && (
                        <a
                          href={`mailto:${general.contactInfo.email}`}
                          className="p-3 lg:p-4 transition-all"
                          aria-label="Email"
                        >
                          <Mail className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                        </a>
                      )}

                      {general.contactInfo.address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(
                            general.contactInfo.address,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 lg:p-4 transition-all"
                          aria-label="Location"
                        >
                          <MapPin className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                        </a>
                      )}

                      {general.contactInfo.website && (
                        <a
                          href={
                            general.contactInfo.website.startsWith("http")
                              ? general.contactInfo.website
                              : `https://${general.contactInfo.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 lg:p-4 transition-all"
                          aria-label="Website"
                        >
                          <Globe className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* MOBILE/TABLET: Social Media Section (Visible on sm and md, hidden on lg) */}
                  {features.showSocialMedia && (
                    <div className="flex flex-col items-center lg:hidden w-full">
                      <h4 className="text-lg font-bold text-black">
                        Follow Us
                      </h4>
                      <div className="flex items-center justify-center gap-3">
                        {whatsAppNumber && (
                          <a
                            href={`https://wa.me/${whatsAppNumber?.replace(
                              /\D/g,
                              "",
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="WhatsApp"
                            className="p-3 lg:p-4 transition-all"
                          >
                            <FaWhatsapp className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                          </a>
                        )}

                        {general.contactInfo.instagramLink &&
                          general.contactInfo.showInstagram && (
                            <a
                              href={general.contactInfo.instagramLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Instagram"
                              className="p-3 lg:p-4 transition-all"
                            >
                              <FaInstagram className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                            </a>
                          )}

                        {general.contactInfo.showFacebook &&
                          general.contactInfo.facebookLink && (
                            <a
                              href={general.contactInfo.facebookLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Facebook"
                              className="p-3 lg:p-4 transition-all"
                            >
                              <FaFacebook className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                            </a>
                          )}

                        {general.contactInfo.showTwitter &&
                          general.contactInfo.twitterLink && (
                            <a
                              href={general.contactInfo.twitterLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="X (Twitter)"
                              className="p-3 lg:p-4 transition-all"
                            >
                              <FaTwitter className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                            </a>
                          )}

                        {general.contactInfo.showTiktok &&
                          general.contactInfo.tiktokLink && (
                            <a
                              href={general.contactInfo.tiktokLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="TikTok"
                              className="p-3 lg:p-4 transition-all"
                            >
                              <FaTiktok className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                            </a>
                          )}

                        <Button
                          variant="outline1"
                          className="p-3 lg:p-4 transition-all"
                          onClick={onShare}
                          aria-label="Share store link"
                        >
                          <Share2 className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* DESKTOP: Social Media Layout (Hidden on sm and md, visible on lg) */}
                  {features.showSocialMedia && (
                    <div className="hidden lg:flex space-x-3">
                      {general.contactInfo.instagramLink &&
                        general.contactInfo.showInstagram && (
                          <a
                            href={general.contactInfo.instagramLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 lg:p-4 transition-all"
                            aria-label="Instagram"
                          >
                            <FaInstagram className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                          </a>
                        )}

                      {general.contactInfo.showFacebook &&
                        general.contactInfo.facebookLink && (
                          <a
                            href={general.contactInfo.facebookLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Facebook"
                            className="p-3 lg:p-4 transition-all"
                          >
                            <FaFacebook className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                          </a>
                        )}

                      {general.contactInfo.showTwitter &&
                        general.contactInfo.twitterLink && (
                          <a
                            href={general.contactInfo.twitterLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="X (Twitter)"
                            className="p-3 lg:p-4 transition-all"
                          >
                            <FaTwitter className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                          </a>
                        )}

                      {general.contactInfo.showTiktok &&
                        general.contactInfo.tiktokLink && (
                          <a
                            href={general.contactInfo.tiktokLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="TikTok"
                            className="p-3 lg:p-4 transition-all"
                          >
                            <FaTiktok className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                          </a>
                        )}

                      <Button
                        variant="outline1"
                        className="p-3 mt-2 lg:p-4 transition-all"
                        onClick={onShare}
                        aria-label="Share store link"
                      >
                        <Share2 className="h-5 w-5 lg:h-6 lg:w-6 transition-all" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Contact Info - DESKTOP ONLY (Hidden on sm and md, visible on lg) */}
                <div className="hidden lg:block">
                  <h4 className="font-semibold mb-4 text-lg text-black">
                    Contact Info
                  </h4>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    {general.contactInfo.phone && (
                      <div className="flex items-center space-x-3">
                        <Phone
                          className="h-4 w-4"
                          style={{ color: design.primaryColor }}
                        />
                        <span>{general.contactInfo.phone}</span>
                      </div>
                    )}
                    {whatsAppNumber && (
                      <div className="flex items-center space-x-3">
                        <FaWhatsapp className="h-5 w-5 text-green-600" />
                        <a
                          href={`https://wa.me/${whatsAppNumber.replace(
                            /\D/g,
                            "",
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 font-medium"
                        >
                          Chat on WhatsApp
                        </a>
                      </div>
                    )}
                    {general.contactInfo.email && (
                      <div className="flex items-center space-x-3">
                        <Mail
                          className="h-4 w-4"
                          style={{ color: design.primaryColor }}
                        />
                        <span className="break-all">
                          {general.contactInfo.email}
                        </span>
                      </div>
                    )}
                    {general.contactInfo.address && (
                      <div className="flex items-center space-x-3">
                        <MapPin
                          className="h-4 w-4 flex-shrink-0"
                          style={{ color: design.primaryColor }}
                        />
                        <span>{general.contactInfo.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Store Hours/Website - DESKTOP ONLY (Hidden on sm and md, visible on lg) */}
                <div className="hidden lg:block">
                  <h4 className="font-semibold mb-4 text-lg text-black">
                    Store Hours
                  </h4>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    {general.contactInfo.hours && (
                      <div className="flex items-start space-x-3">
                        <Clock
                          className="h-4 w-4 mt-0.5 flex-shrink-0"
                          style={{ color: design.primaryColor }}
                        />
                        <div className="flex flex-col gap-1">
                          {general.contactInfo.hours
                            .split(",")
                            .map((slot: string, index: number) => (
                              <span key={index} className="leading-relaxed">
                                {slot.trim()}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                    {general.contactInfo.website && (
                      <div className="flex items-center space-x-3">
                        <Globe
                          className="h-4 w-4"
                          style={{ color: design.primaryColor }}
                        />
                        <a
                          href={
                            general.contactInfo.website.startsWith("http")
                              ? general.contactInfo.website
                              : `https://${general.contactInfo.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-black-600"
                        >
                          {general.contactInfo.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Bar with Admin Login */}
              <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row items-center justify-between text-sm text-gray-500">
                <p>
                  &copy; 2025 {general.storeName}. All rights reserved. Powered
                  by{" "}
                  <span style={{ color: design.primaryColor }}>
                    <a href="https://eventsh.com">EventSH</a>
                  </span>
                </p>
                <a
                  href="/login"
                  className="text-black font-semibold hover:underline mt-2 md:mt-0"
                >
                  Organizer Login
                </a>
              </div>
            </div>
          </footer>
        )}

        {footer === "minimal" && (
          <footer
            id="about"
            className="bg-white border-t border-gray-200 py-8 sm:py-12"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col lg:flex-row items-center justify-between lg:gap-12 mb-4 gap-4 lg:gap-0">
                {/* Left: Contact - flex-1 for equal spacing, CENTERED on mobile */}
                <div className="flex flex-col items-center justify-center lg:justify-start gap-4 w-full lg:w-auto lg:flex-1 order-2 lg:order-1">
                  {/* MOBILE/TABLET VERSION - Contact Section with Title + Icons */}
                  <div className="flex flex-col items-center gap-1 lg:hidden w-full">
                    <h4 className="text-lg font-bold text-gray-900">
                      Contact Us
                    </h4>
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      <a
                        href={`tel:${general.contactInfo.phone}`}
                        className="p-3 hover:bg-white-700/50 transition-all"
                        aria-label="Phone"
                      >
                        <Phone className="h-5 w-5 text-gray-500 hover:text-gray-900 transition-colors" />
                      </a>

                      <a
                        href={`mailto:${general.contactInfo.email}`}
                        className="p-3 hover:bg-white-700/50 transition-all"
                        aria-label="Email"
                      >
                        <Mail className="h-5 w-5 text-gray-500 hover:text-gray-900 transition-colors" />
                      </a>

                      <a
                        href={
                          general.contactInfo.address
                            ? `https://maps.google.com/?q=${encodeURIComponent(
                                general.contactInfo.address,
                              )}`
                            : "#"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 hover:bg-white-700/50 transition-all"
                        aria-label="Location"
                      >
                        <MapPin className="h-5 w-5 text-gray-500 hover:text-gray-900 transition-colors" />
                      </a>

                      <a
                        href={general.contactInfo.website || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 hover:bg-white-700/50 transition-all"
                        aria-label="Website"
                      >
                        <Globe className="h-5 w-5 text-gray-500 hover:text-gray-900 transition-colors" />
                      </a>
                    </div>
                  </div>

                  {/* DESKTOP VERSION - Original Contact Buttons */}
                  <div className="hidden lg:flex items-center justify-start gap-6 w-full">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {general.contactInfo.phone && (
                        <a
                          href={`tel:${general.contactInfo.phone}`}
                          className="p-3 hover:bg-white-700/50 transition-all"
                          aria-label="Phone"
                        >
                          <Phone className="h-5 w-5 lg:h-6 lg:w-6 text-gray-400 group-hover:text-primary transition-all duration-200" />
                        </a>
                      )}

                      {general.contactInfo.email && (
                        <a
                          href={`mailto:${general.contactInfo.email}`}
                          className="p-3 hover:bg-white-700/50 transition-all"
                          aria-label="Email"
                        >
                          <Mail className="h-5 w-5 lg:h-6 lg:w-6 text-gray-400 group-hover:text-primary transition-all duration-200" />
                        </a>
                      )}

                      {general.contactInfo.address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(
                            general.contactInfo.address,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 hover:bg-white-700/50 transition-all"
                          aria-label="Location"
                        >
                          <MapPin className="h-5 w-5 lg:h-6 lg:w-6 text-gray-400 group-hover:text-primary transition-all duration-200" />
                        </a>
                      )}

                      {general.contactInfo.website && (
                        <a
                          href={
                            general.contactInfo.website.startsWith("http")
                              ? general.contactInfo.website
                              : `https://${general.contactInfo.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 hover:bg-white-700/50 transition-all"
                          aria-label="Website"
                        >
                          <Globe className="h-5 w-5 lg:h-6 lg:w-6 text-gray-400 group-hover:text-primary transition-all duration-200" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Center: Logo & Store Name */}
                <div className="flex flex-col items-center gap-3 order-1 lg:order-2 w-full lg:w-auto lg:flex-none">
                  <div className="flex items-center justify-center space-x-3">
                    {general.logo ? (
                      <img
                        src={getImageUrl(general.logo)}
                        alt={`${general.storeName} Logo`}
                        className="w-16 h-16 lg:w-20 lg:h-20 rounded-xl shadow-xl brightness-0 hover:brightness-100 transition-all duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling?.classList.remove(
                            "hidden",
                          );
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-16 h-16 lg:w-20 lg:h-20 rounded-xl flex items-center justify-center text-3xl lg:text-4xl font-black shadow-xl ${
                        general.logo ? "hidden" : ""
                      }`}
                      style={{
                        backgroundColor: design.primaryColor,
                        color: "white",
                        boxShadow: `0 10px 30px ${design.primaryColor}20`,
                      }}
                    >
                      {general.storeName.charAt(0).toUpperCase()}
                    </div>
                  </div>

                  <h3
                    className="font-black text-2xl lg:text-3xl xl:text-4xl text-black tracking-tight text-center leading-tight px-4"
                    style={{ fontFamily: design.fontFamily }}
                  >
                    {general.storeName}
                  </h3>
                </div>

                {/* Right: Social Media - flex-1 for equal spacing, CENTERED on mobile */}
                {features.showSocialMedia && (
                  <div className="flex flex-col items-center justify-center lg:justify-end gap-2 order-3 w-full lg:w-auto lg:flex-1">
                    {/* MOBILE/TABLET VERSION - "Follow Us" Title */}
                    <h4 className="text-lg font-bold text-gray-900 lg:hidden">
                      Follow Us
                    </h4>

                    {/* Social Icons (Same for all views) */}
                    <div className="flex items-center justify-center lg:justify-end gap-3 lg:gap-4">
                      {whatsAppNumber && (
                        <a
                          href={`https://wa.me/${whatsAppNumber?.replace(
                            /\D/g,
                            "",
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="WhatsApp"
                          className="p-3 hover:bg-white-700/50 transition-all"
                        >
                          <FaWhatsapp className="h-5 w-5 lg:h-6 lg:w-6 text-gray-400 group-hover:text-primary transition-all duration-200" />
                        </a>
                      )}

                      {settings.settings.general.contactInfo.showInstagram && (
                        <a
                          href={general.contactInfo.instagramLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Instagram"
                          className="p-3 hover:bg-white-700/50 transition-all"
                        >
                          <FaInstagram className="h-5 w-5 lg:h-6 lg:w-6 text-gray-400 group-hover:text-primary transition-all duration-200" />
                        </a>
                      )}

                      {settings.settings.general.contactInfo.showFacebook && (
                        <a
                          href="#"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Facebook"
                          className="p-3 hover:bg-white-700/50 transition-all"
                        >
                          <FaFacebook className="h-5 w-5 text-gray-400 transition-all duration-200" />
                        </a>
                      )}

                      {settings.settings.general.contactInfo.showTwitter && (
                        <a
                          href="#"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="X (Twitter)"
                          className="p-3 hover:bg-white-700/50 transition-all"
                        >
                          <FaTwitter className="h-5 w-5 text-gray-400 transition-all duration-200" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-800 pt-6 sm:pt-4 mt-4">
                <div className="text-center space-y-1">
                  <p className="text-sm sm:text-base text-gray-400">
                    © 2025 {general.storeName}. All rights reserved.
                  </p>
                  <p className="text-sm sm:text-base text-gray-500">
                    Powered by
                    <span
                      className="ml-1 font-semibold"
                      style={{ color: design.primaryColor }}
                    >
                      EventSH
                    </span>
                  </p>
                </div>

                <div className="flex justify-center">
                  <a
                    href="/login"
                    className="font-semibold text-xs mt-2 text-gray-600 text-center hover:underline"
                  >
                    Organizer Login
                  </a>
                </div>
              </div>
            </div>
          </footer>
        )}

        {footer === "mega" && (
          <footer
            id="about"
            className="relative border-t pt-6 sm:pt-8 lg:pt-10 bg-card"
          >
            <div
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ backgroundColor: design.primaryColor }}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-base sm:text-lg">
              {/* About Us - DESKTOP ONLY */}
              <div className="mb-6 sm:mb-8 lg:mb-10 hidden lg:block">
                <div className="text-center mb-6 sm:mb-8">
                  <h2
                    className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 tracking-wide"
                    style={{ fontFamily: design.fontFamily }}
                  >
                    {general.storeName}
                  </h2>
                  <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    {general.description ||
                      `Welcome to ${general.storeName}! We are dedicated to providing you with the best products and exceptional customer service.`}
                  </p>
                </div>
              </div>

              {/* M A I N  F O O T E R */}
              <div
                id="contact"
                className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8 justify-items-center lg:justify-items-center"
              >
                {/* C O L U M N 1 : Logo, Shop Name, Social Media */}
                <div className="space-y-4 sm:space-y-5 text-center lg:text-left w-fit mx-auto lg:mx-0">
                  {/* Logo and Store Name - ORDER 1 on mobile */}
                  <div className="flex items-center justify-center lg:justify-start space-x-3 order-1 lg:order-none">
                    {general.logo ? (
                      <img
                        src={getImageUrl(general.logo)}
                        alt="Logo"
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 shadow-lg"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling?.classList.remove(
                            "hidden",
                          );
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-black font-bold text-lg sm:text-xl shadow-lg ${
                        general.logo ? "hidden" : ""
                      }`}
                      style={{ backgroundColor: design.primaryColor }}
                    >
                      {general.storeName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3
                        className="font-bold text-lg sm:text-xl"
                        style={{ fontFamily: design.fontFamily }}
                      >
                        {general.storeName}
                      </h3>
                      {/* {shopkeeperInfo.GSTNumber && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {shopkeeperInfo.GSTNumber}
                        </p>
                      )} */}
                    </div>
                  </div>

                  {/* MOBILE/TABLET: Contact Section with Title + Icons (ORDER 2) */}
                  {features.showSocialMedia && (
                    <div className="flex flex-col items-center gap-4 lg:hidden w-full order-2">
                      <h4 className="text-lg font-bold">Contact Us</h4>
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        {general.contactInfo.phone && (
                          <a
                            href={`tel:${general.contactInfo.phone}`}
                            className="p-3 hover:bg-white-700/50 transition-all"
                            aria-label="Phone"
                          >
                            <Phone className="h-5 w-5 transition-colors" />
                          </a>
                        )}

                        {general.contactInfo.email && (
                          <a
                            href={`mailto:${general.contactInfo.email}`}
                            className="p-3 hover:bg-white-700/50 transition-all"
                            aria-label="Email"
                          >
                            <Mail className="h-5 w-5 transition-colors" />
                          </a>
                        )}

                        {general.contactInfo.address && (
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(
                              general.contactInfo.address,
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 hover:bg-white-700/50 transition-all"
                            aria-label="Location"
                          >
                            <MapPin className="h-5 w-5 transition-colors" />
                          </a>
                        )}

                        {general.contactInfo.website && (
                          <a
                            href={
                              general.contactInfo.website.startsWith("http")
                                ? general.contactInfo.website
                                : `https://${general.contactInfo.website}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 hover:bg-white-700/50 transition-all"
                            aria-label="Website"
                          >
                            <Globe className="h-5 w-5 transition-colors" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* MOBILE/TABLET: Social Media Section with "Follow Us" Title (ORDER 3) */}
                  {features.showSocialMedia && (
                    <div className="flex flex-col items-center gap-4 lg:hidden w-full order-3">
                      <h4 className="text-lg font-bold">Follow Us</h4>
                      <div className="flex items-center justify-center gap-3">
                        <a
                          href={`https://wa.me/${whatsAppNumber?.replace(
                            /\D/g,
                            "",
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="WhatsApp"
                          className="p-3 hover:bg-white-700/50 transition-all"
                        >
                          <FaWhatsapp className="h-5 w-5 transition-colors" />
                        </a>

                        {settings.settings.general.contactInfo
                          .instagramLink && (
                          <a
                            href={
                              settings.settings.general.contactInfo
                                .instagramLink
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Instagram"
                            className="p-3 hover:bg-white-700/50 transition-all"
                          >
                            <FaInstagram className="h-5 w-5 transition-colors" />
                          </a>
                        )}

                        {settings.settings.general.contactInfo.facebookLink && (
                          <a
                            href={
                              settings.settings.general.contactInfo.facebookLink
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Facebook"
                            className="p-3 hover:bg-white-700/50 transition-all"
                          >
                            <FaFacebook className="h-5 w-5 transition-colors" />
                          </a>
                        )}

                        {settings.settings.general.contactInfo.twitterLink && (
                          <a
                            href={
                              settings.settings.general.contactInfo.twitterLink
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="X (Twitter)"
                            className="p-3 hover:bg-white-700/50 transition-all"
                          >
                            <FaTwitter className="h-5 w-5 transition-colors" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* DESKTOP: Original Social Media Layout (hidden on mobile/tablet) */}
                  {features.showSocialMedia && (
                    <div className="hidden lg:flex items-center justify-center lg:justify-end gap-3 lg:gap-4 w-full lg:w-auto lg:flex-1">
                      <a
                        href={`https://wa.me/${whatsAppNumber?.replace(
                          /\D/g,
                          "",
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="WhatsApp"
                        className="p-3 transition-all"
                      >
                        <FaWhatsapp className="h-5 w-5 text-gray-600 transition-colors" />
                      </a>

                      {settings.settings.general.contactInfo.instagramLink && (
                        <a
                          href={
                            settings.settings.general.contactInfo.instagramLink
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Instagram"
                          className="p-3 transition-all"
                        >
                          <FaInstagram className="h-5 w-5 text-gray-600 transition-colors" />
                        </a>
                      )}

                      {settings.settings.general.contactInfo.facebookLink && (
                        <a
                          href={
                            settings.settings.general.contactInfo.facebookLink
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Facebook"
                          className="p-3 transition-all"
                        >
                          <FaFacebook className="h-5 w-5 text-gray-600 transition-colors"></FaFacebook>
                        </a>
                      )}

                      {settings.settings.general.contactInfo.twitterLink && (
                        <a
                          href={
                            settings.settings.general.contactInfo.twitterLink
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="X (Twitter)"
                          className="p-3 transition-all"
                        >
                          <FaTwitter className="h-5 w-5 text-gray-600 transition-colors"></FaTwitter>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* C O L U M N 2 : Contact Info - DESKTOP ONLY */}
                <div className="text-left w-fit mx-auto hidden lg:block">
                  <h4 className="font-semibold mb-4 text-base sm:text-lg uppercase tracking-wide text-center">
                    Contact Info
                  </h4>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    {general.contactInfo.address && (
                      <div className="flex items-start space-x-3">
                        <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-gray-500" />
                        <span className="leading-relaxed">
                          {general.contactInfo.address}
                        </span>
                      </div>
                    )}
                    {general.contactInfo.email && (
                      <div className="flex items-center space-x-3">
                        <Mail className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <span className="break-all">
                          {general.contactInfo.email}
                        </span>
                      </div>
                    )}
                    {general.contactInfo.phone && (
                      <div className="flex items-center space-x-3">
                        <Phone className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <span>{general.contactInfo.phone}</span>
                      </div>
                    )}
                    {whatsAppNumber && (
                      <div className="flex items-center space-x-3">
                        <FaWhatsapp className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 flex-shrink-0" />
                        <a
                          href={`https://wa.me/${whatsAppNumber.replace(
                            /\D/g,
                            "",
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline"
                        >
                          Chat on WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* C O L U M N 3 : Store Details - DESKTOP ONLY */}
                <div className="text-left w-fit mx-auto hidden lg:block">
                  <h4 className="font-semibold mb-4 text-base sm:text-lg uppercase tracking-wide text-center">
                    Store Details
                  </h4>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    {general.contactInfo.hours && (
                      <div className="flex items-start space-x-3">
                        <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500" />
                        <div className="flex flex-col gap-1">
                          {general.contactInfo.hours
                            .split(",")
                            .map((slot: string, index: number) => (
                              <span key={index} className="leading-relaxed">
                                {slot.trim()}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                    {general.contactInfo.website && (
                      <div className="flex items-center space-x-3">
                        <Globe className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <a
                          href={
                            general.contactInfo.website.startsWith("http")
                              ? general.contactInfo.website
                              : `https://${general.contactInfo.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all font-medium hover:underline"
                        >
                          {general.contactInfo.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* F O O T E R  B A R */}
              <div className="border-t border-border/70 pt-7 sm:pt-9 pb-4 sm:pb-6 flex flex-col md:flex-row items-center justify-between text-sm sm:text-base text-muted-foreground">
                <p className="text-center md:text-left mb-2 md:mb-0">
                  © 2025 {general.storeName}. All rights reserved. Powered by{" "}
                  <span style={{ color: design.primaryColor }}>EventSH</span>
                </p>
                <a href="/login" className="font-semibold hover:underline">
                  Organizer login
                </a>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
