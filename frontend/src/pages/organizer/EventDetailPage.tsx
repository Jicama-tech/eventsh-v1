// File: EventDetailPage.tsx

import React, { useState, useEffect } from "react";
import { useCountry } from "@/hooks/useCountry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  CalendarDays,
  MapPin,
  Clock,
  Users,
  Ticket,
  ArrowLeft,
  Share2,
  Heart,
  Phone,
  Mail,
  Globe,
  Facebook,
  Instagram,
  Twitter,
  Star,
  DollarSign,
  TrendingUp,
  Camera,
  Wifi,
  Car,
  Utensils,
  Shield,
  Accessibility,
  ChevronLeft,
  ChevronRight,
  Download,
  MapIcon,
} from "lucide-react";
import { useCurrency } from "@/hooks/useCurrencyhook";

interface Organizer {
  _id: string;
  name: string;
  email: string;
  organizationName: string;
  phone: string;
  businessEmail: string;
  whatsAppNumber: string;
  address: string;
  bio: string;
  approved: boolean;
  rejected: boolean;
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
  endDate: string;
  endTime: string;
  organizer: Organizer;
  location: string;
  address: string;
  ticketPrice: string;
  totalTickets: string;
  visibility: string;
  inviteLink: string;
  tags: string[];
  features: {
    food: boolean;
    parking: boolean;
    wifi: boolean;
    photography: boolean;
    security: boolean;
    accessibility: boolean;
  };
  ageRestriction: string;
  dresscode: string;
  specialInstructions: string;
  image: string;
  gallery: string[];
  socialMedia: {
    facebook: string;
    instagram: string;
    twitter: string;
  };
  refundPolicy: string;
  termsAndConditions: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

interface EventDetailPageProps {
  eventId: string;
  onBack: () => void;
}

export function EventDetailPage({ eventId, onBack }: EventDetailPageProps) {
  const [eventData, setEventData] = useState<FetchedEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const apiURL = __API_URL__;
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`${apiURL}/events/${eventId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch event data.");
        }
        const result = await response.json();
        setEventData(result);
      } catch (err) {
        setError("Could not load event details. Please try again later.");
        console.error("Error fetching event:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p>Loading event details...</p>
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <p className="text-red-500 font-semibold mb-4">{error}</p>
        <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  const {
    title,
    description,
    startDate,
    endDate,
    time,
    location,
    address,
    category,
    ticketPrice: rawTicketPrice,
    totalTickets: rawTotalTickets,
    visitorTypes,
    image,
    gallery,
    tags,
    features,
    ageRestriction,
    dresscode,
    socialMedia,
    organizer,
    refundPolicy,
  } = eventData;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: window.location.href,
        });
      } catch (error) {}
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(window.location.href);
      // You could add a toast notification here
    }
  };

  const handleGetTickets = () => {
    // Implement ticket purchasing logic
    // You can integrate with your payment system here
  };

  // Compute ticket price and total from visitorTypes if available
  const ticketPrice = visitorTypes?.length > 0
    ? (() => { const prices = visitorTypes.map((v: any) => v.price || 0); const min = Math.min(...prices); const max = Math.max(...prices); return min === max ? String(min) : `${min}-${max}`; })()
    : (rawTicketPrice || "0");
  const totalTickets = visitorTypes?.length > 0
    ? String(visitorTypes.reduce((sum: number, v: any) => sum + (v.maxCount || 0), 0))
    : (rawTotalTickets || "0");
  const salesPercentage = 0;
  const availableTickets = totalTickets;

  const nextImage = () => {
    if (gallery && gallery.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === gallery.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevImage = () => {
    if (gallery && gallery.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? gallery.length - 1 : prev - 1
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={onBack}
                className="p-2 hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-gray-900 truncate max-w-md">
                  {title}
                </h1>
                <p className="text-sm text-gray-500">
                  by {organizer.organizationName}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFavorited(!isFavorited)}
                className="hover:bg-red-50"
              >
                <Heart
                  className={`h-5 w-5 ${
                    isFavorited ? "fill-red-500 text-red-500" : "text-gray-600"
                  }`}
                />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="hover:bg-blue-50"
              >
                <Share2 className="h-5 w-5 text-gray-600" />
              </Button>
            </div>
          </div>

          {/* Mobile title */}
          <div className="sm:hidden mt-2">
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500">by {organizer.name}</p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Hero Image */}
            <div className="relative">
              <img
                src={apiURL + image}
                alt={title}
                className="w-full h-64 sm:h-80 lg:h-96 object-cover rounded-xl shadow-lg"
              />
              <div className="absolute top-4 left-4 flex gap-2">
                <Badge className="bg-white/90 text-gray-800 shadow-sm">
                  {category}
                </Badge>
                <Badge className="bg-blue-600 text-white shadow-sm">
                  {availableTickets} tickets left
                </Badge>
              </div>
            </div>

            {/* Event Info */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                  {title}
                </h2>
                <p className="text-lg text-gray-600 leading-relaxed">
                  {description}
                </p>
              </div>

              {/* Key Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="p-4 border-l-4 border-l-blue-500">
                  <div className="flex items-center space-x-3">
                    <CalendarDays className="h-6 w-6 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">Event Dates</p>
                      <p className="text-gray-600">
                        {new Date(startDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                        {endDate &&
                          ` - ${new Date(endDate).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}`}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border-l-4 border-l-blue-500">
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-6 w-6 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">Location</p>
                      <p className="text-gray-600">{location}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border-l-4 border-l-blue-500">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-6 w-6 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">Time</p>
                      <p className="text-gray-600">
                        {time}
                        {eventData.endTime && ` - ${eventData.endTime}`}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border-l-4 border-l-blue-500">
                  <div className="flex items-center space-x-3">
                    <Ticket className="h-6 w-6 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">Ticket Price</p>
                      <p className="text-gray-600">
                        {ticketPrice === "0" ? "Free" : ticketPrice.includes("-") ? `${formatPrice(Number(ticketPrice.split("-")[0]))} - ${formatPrice(Number(ticketPrice.split("-")[1]))}` : formatPrice(Number(ticketPrice))}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="buttonOutline"
                    className="border-gray-300 text-gray-600"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator className="my-8" />

            {/* Gallery */}
            {gallery && gallery.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4">Event Gallery</h2>
                <div className="relative">
                  <img
                    src={gallery[currentImageIndex]}
                    alt={`Gallery image ${currentImageIndex + 1}`}
                    className="w-full h-80 object-cover rounded-xl shadow-lg"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/50 hover:bg-white"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </div>
              </section>
            )}

            {/* Other Details */}
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Event Details</TabsTrigger>
                <TabsTrigger value="organizer">Organizer</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="mt-4 space-y-6">
                {/* Features */}
                {features && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Key Features</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Utensils
                          className={`h-5 w-5 ${
                            features.food ? "text-green-500" : "text-gray-400"
                          }`}
                        />
                        <span className="text-sm font-medium">Food</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Car
                          className={`h-5 w-5 ${
                            features.parking
                              ? "text-green-500"
                              : "text-gray-400"
                          }`}
                        />
                        <span className="text-sm font-medium">Parking</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Wifi
                          className={`h-5 w-5 ${
                            features.wifi ? "text-green-500" : "text-gray-400"
                          }`}
                        />
                        <span className="text-sm font-medium">Wi-Fi</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Camera
                          className={`h-5 w-5 ${
                            features.photography
                              ? "text-green-500"
                              : "text-gray-400"
                          }`}
                        />
                        <span className="text-sm font-medium">Photography</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Shield
                          className={`h-5 w-5 ${
                            features.security
                              ? "text-green-500"
                              : "text-gray-400"
                          }`}
                        />
                        <span className="text-sm font-medium">Security</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Accessibility
                          className={`h-5 w-5 ${
                            features.accessibility
                              ? "text-green-500"
                              : "text-gray-400"
                          }`}
                        />
                        <span className="text-sm font-medium">
                          Accessibility
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Additional Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Additional Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {ageRestriction && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">
                          Age Restriction:
                        </span>
                        <Badge variant="secondary">{ageRestriction}</Badge>
                      </div>
                    )}
                    {dresscode && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">
                          Dress Code:
                        </span>
                        <p className="text-gray-600">{dresscode}</p>
                      </div>
                    )}
                    {refundPolicy && (
                      <div className="space-y-2">
                        <span className="font-medium text-gray-700">
                          Refund Policy:
                        </span>
                        <p className="text-gray-600">{refundPolicy}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="organizer" className="mt-4 space-y-6">
                {/* Organizer Info */}
                <Card>
                  <CardHeader className="flex flex-row items-center space-x-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage
                        src={`/lovable-uploads/organizers/profile/${organizer._id}.jpg`}
                        alt={organizer.name}
                      />
                      <AvatarFallback>
                        {organizer.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-xl">
                        {organizer.name}
                      </CardTitle>
                      <p className="text-sm text-gray-500">
                        {organizer.organizationName}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-gray-600 leading-relaxed">
                      {organizer.bio}
                    </p>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">
                          {organizer.phone}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">
                          {organizer.email}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">
                          {organizer.address}
                        </span>
                      </div>
                    </div>
                    {socialMedia && (
                      <div className="flex space-x-4 pt-2">
                        {socialMedia.facebook && (
                          <a
                            href={socialMedia.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:text-gray-900"
                          >
                            <Facebook className="h-5 w-5" />
                          </a>
                        )}
                        {socialMedia.instagram && (
                          <a
                            href={socialMedia.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:text-gray-900"
                          >
                            <Instagram className="h-5 w-5" />
                          </a>
                        )}
                        {socialMedia.twitter && (
                          <a
                            href={socialMedia.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:text-gray-900"
                          >
                            <Twitter className="h-5 w-5" />
                          </a>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6">
              <CardTitle className="text-xl font-bold mb-4">Tickets</CardTitle>
              <div className="flex items-center justify-between mb-4">
                <p className="text-3xl font-bold text-gray-900">
                  {ticketPrice === "0" ? "Free" : ticketPrice.includes("-") ? `${formatPrice(Number(ticketPrice.split("-")[0]))} - ${formatPrice(Number(ticketPrice.split("-")[1]))}` : formatPrice(Number(ticketPrice))}
                </p>
                <Badge variant="secondary">
                  {availableTickets} Tickets Left
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                This is a mock ticket purchase section.
              </p>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="ticket-quantity"
                    className="text-sm font-medium text-gray-700"
                  >
                    Quantity
                  </label>
                  <div className="flex items-center mt-1 space-x-2">
                    <Button
                      variant="buttonOutline"
                      size="icon"
                      onClick={() =>
                        setTicketQuantity((q) => Math.max(1, q - 1))
                      }
                    >
                      -
                    </Button>
                    <span className="w-12 text-center text-lg font-bold">
                      {ticketQuantity}
                    </span>
                    <Button
                      variant="buttonOutline"
                      size="icon"
                      onClick={() => setTicketQuantity((q) => q + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
                <Button
                  className="w-full text-lg py-6"
                  onClick={handleGetTickets}
                >
                  Get Tickets
                </Button>
              </div>
            </Card>

            {/* Contact Organizer */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Organizer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">
                    {organizer.phone}
                  </span>
                </div>

                <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">
                    {organizer.email}
                  </span>
                </div>

                <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">
                    {organizer.address}
                  </span>
                </div>

                {socialMedia && socialMedia.facebook && (
                  <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                    <Facebook className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      {socialMedia.facebook}
                    </span>
                  </div>
                )}
                {socialMedia && socialMedia.instagram && (
                  <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                    <Instagram className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      {socialMedia.instagram}
                    </span>
                  </div>
                )}
                {socialMedia && socialMedia.twitter && (
                  <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                    <Twitter className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      {socialMedia.twitter}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
