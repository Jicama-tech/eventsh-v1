import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Ticket,
  LogOut,
  Home,
  Search,
  ChevronDown,
  Heart,
  Menu,
  X,
} from "lucide-react";
import { FollowedEventsSection } from "@/components/user/FollowedEventsSection";
import { DiscoverSection } from "@/components/user/DiscoverSection";
import { useAuth } from "@/hooks/useAuth";
import { jwtDecode } from "jwt-decode";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";

export function UserDashboard() {
  const [activeTab, setActiveTab] = useState("home");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("Organizer");
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Sidebar open state for mobile toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRoleChange = async (selectedRole: "organizer") => {
    setRole(selectedRole);
    setLoading(true);
    const token = sessionStorage.getItem("token");
    if (!token) {
      alert("Please login first.");
      return;
    }
    try {
      const response = await fetch(`${__API_URL__}/role/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: selectedRole }),
      });
      if (!response.ok) throw new Error("Failed to check role");
      const data = await response.json();
      if (data.found) {
        navigate(`/${selectedRole}-login`);
      } else {
        navigate(`/${selectedRole}-register`, {
          state: { name: data.user.name, email: data.user.email },
        });
      }
    } catch (err) {
      console.error(err);
      alert("Error checking role. Please try again.");
    }
  };

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const fetchAddress = async (latitude: number, longitude: number) => {
      try {
        const res = await fetch(
          `${__API_URL__}/users/reverse?lat=${latitude}&lng=${longitude}`
        );
        if (!res.ok) throw new Error("Reverse geocoding failed");

        const data = await res.json();
        // data = { country, state, city, postcode, fullAddress }

      } catch (err) {
        console.error("Error fetching address:", err);
      }
    };

    if (navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((result) => {
          if (result.state === "denied") {
            
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;

              fetchAddress(latitude, longitude); // ← call your API here
            },
            (err) => {
              console.error("Geo error:", err);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;

          fetchAddress(latitude, longitude); // ← and here for older browsers
        },
        (err) => console.error("Geo error:", err)
      );
    }
  }, []);
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        if (decoded?.name) setUsername(decoded.name);
      } catch (err) {
        console.error("Invalid token", err);
      }
    }
  }, []);

  // Sample mock data for demonstration
  const followedEvents = [
    {
      id: 1,
      name: "Tech Conference 2024",
      date: "March 15, 2024",
      time: "9:00 AM",
      location: "San Francisco, CA",
      price: "$50",
      category: "Technology",
      attendees: 150,
      organizerName: "TechEvents Inc",
      organizerId: 1,
      isFollowing: true,
      rating: 4.8,
    },
    {
      id: 2,
      name: "Music Festival",
      date: "April 20, 2024",
      time: "6:00 PM",
      location: "Austin, TX",
      price: "$75",
      category: "Music",
      attendees: 300,
      organizerName: "Music Collective",
      organizerId: 2,
      isFollowing: true,
      rating: 4.6,
    },
  ];

  const organizers = [
    {
      id: "3",
      name: "Sports Events Pro",
      description: "Premier sports event organizer",
      events: 25,
      followers: "5.2K",
      rating: 4.9,
      isFollowing: false,
      categories: ["Sports", "Fitness"],
    },
    {
      id: "4",
      name: "Art & Culture Hub",
      description: "Curating cultural experiences",
      events: 18,
      followers: "3.8K",
      rating: 4.7,
      isFollowing: false,
      categories: ["Art", "Culture"],
    },
  ];

  // const shopkeepers = [
  //   {
  //     id: "3",
  //     name: "Fashion Forward",
  //     description: "Trendy fashion and accessories",
  //     products: 120,
  //     followers: "8.5K",
  //     rating: 4.6,
  //     isFollowing: false,
  //     categories: ["Fashion", "Accessories"],
  //   },
  //   {
  //     id: "4",
  //     name: "Gourmet Delights",
  //     description: "Premium food and beverages",
  //     products: 85,
  //     followers: "4.3K",
  //     rating: 4.8,
  //     isFollowing: false,
  //     categories: ["Food", "Beverages"],
  //   },
  // ];

  const myTickets = [
    {
      id: 1,
      eventName: "Tech Conference 2024",
      date: "March 15, 2024",
      ticketType: "General Admission",
      qrCode: "TC2024-001",
      status: "Confirmed",
    },
    {
      id: 2,
      eventName: "Music Festival",
      date: "April 20, 2024",
      ticketType: "VIP Pass",
      qrCode: "MF2024-VIP",
      status: "Confirmed",
    },
  ];

  // Dummy handlers
  const handleFollowOrganizer = (id: string) => {};
  const handleViewEvent = (id: string) => {};

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card flex justify-between items-center h-16 px-4 md:px-6">
        <div className="flex items-center space-x-2">
          {/* Hamburger button visible on small screens */}
          <Button
            variant="ghost"
            className="md:hidden p-0 mr-2"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          >
            {sidebarOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
          <CalendarDays className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-bold">EventSH</h1>
        </div>

        <div className="flex items-center space-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center space-x-2 px-4 py-2 rounded-md text-sm text-muted-foreground hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <span>Welcome, {username || "User"}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 rounded-md border border-gray-200 bg-white shadow-lg py-1">
              <DropdownMenuItem
                onSelect={() => handleRoleChange("organizer")}
                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-indigo-100 hover:text-indigo-900 transition-colors duration-150"
              >
                Organizer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="buttonOutline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Layout wrapper for sidebar and main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-muted/30 border-r min-h-screen transform duration-300 transition-transform
          ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 md:relative md:static md:flex-shrink-0`}
        >
          <nav className="p-4 space-y-2 h-full">
            <Button
              variant={activeTab === "home" ? "default" : "buttonOutline"}
              className="w-full justify-start"
              onClick={() => {
                setActiveTab("home");
                setSidebarOpen(false);
              }}
            >
              <Home className="h-4 w-4 mr-2" /> Home Feed
            </Button>
            <Button
              variant={activeTab === "discover" ? "default" : "buttonOutline"}
              className="w-full justify-start"
              onClick={() => {
                setActiveTab("discover");
                setSidebarOpen(false);
              }}
            >
              <Search className="h-4 w-4 mr-2" /> Discover & Follow
            </Button>
            <Button
              variant={activeTab === "tickets" ? "default" : "buttonOutline"}
              className="w-full justify-start"
              onClick={() => {
                setActiveTab("tickets");
                setSidebarOpen(false);
              }}
            >
              <Ticket className="h-4 w-4 mr-2" /> My Tickets
            </Button>
            <Button
              variant={activeTab === "wishlist" ? "default" : "buttonOutline"}
              className="w-full justify-start"
              onClick={() => {
                setActiveTab("wishlist");
                setSidebarOpen(false);
              }}
            >
              <Heart className="h-4 w-4 mr-2" /> Wishlist
            </Button>
          </nav>
        </aside>

        {/* Overlay when sidebar is open on mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black opacity-25 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content area */}
        <main className="flex-1 p-6 overflow-auto">
          {activeTab === "home" && (
            <div className="space-y-8">
              <h2 className="text-3xl font-bold mb-2">Welcome Back!</h2>
              <p className="text-muted-foreground mb-6">
                Stay updated with events from your followed
                organizers
              </p>
              <FollowedEventsSection
                onFollowToggle={handleFollowOrganizer}
                onViewEvent={handleViewEvent}
              />
            </div>
          )}
          {activeTab === "discover" && (
            <DiscoverSection
              organizers={organizers}
              onFollowOrganizer={handleFollowOrganizer}
            />
          )}
          {activeTab === "tickets" && (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">My Tickets</h2>
              {myTickets.map((ticket) => (
                <Card key={ticket.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{ticket.eventName}</CardTitle>
                        <CardDescription>
                          {ticket.date} - {ticket.ticketType}
                        </CardDescription>
                      </div>
                      <Badge
                        variant="buttonOutline"
                        className={
                          ticket.status === "Confirmed"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-yellow-50 text-yellow-700 border-yellow-200"
                        }
                      >
                        {ticket.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        Ticket ID: {ticket.qrCode}
                      </p>
                      <div className="space-x-2">
                        <Button variant="buttonOutline" size="sm">
                          View QR Code
                        </Button>
                        <Button variant="buttonOutline" size="sm">
                          Download
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {activeTab === "wishlist" && (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">My Wishlist</h2>
              <Card className="py-12">
                <CardContent className="text-center">
                  <Heart className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold mb-2">
                    Your Wishlist is Empty
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Save items you love by clicking the heart icon on any
                    product.
                  </p>
                  <Button onClick={() => setActiveTab("home")}>
                    Start Shopping
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
