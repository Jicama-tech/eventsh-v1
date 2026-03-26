import React from "react";
import { useCountry } from "@/hooks/useCountry";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  MapPin,
  Tag,
  Ticket,
  DollarSign,
  Users,
  Shield,
  Utensils,
  Car,
  Wifi,
  Camera,
  Accessibility,
  Facebook,
  Instagram,
  Twitter,
  Info,
  Building,
  TrendingUp,
  Mail,
  Phone,
  Globe,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { useCurrency } from "@/hooks/useCurrencyhook";

interface Event {
  _id: string;
  title: string;
  description: string;
  category: string;
  startDate: string;
  endDate: string;
  time: string;
  endTime: string;
  location: string;
  totalTickets: number;
  ticketsSold?: number;
  ticketPrice: string;
  ageRestriction: string;
  dresscode?: string;
  refundPolicy?: string;
  termsAndConditions?: string;
  specialInstructions?: string;
  features: {
    food: boolean;
    parking: boolean;
    wifi: boolean;
    photography: boolean;
    security: boolean;
    accessibility: boolean;
  };
  tags: string[];
  organizerDetails: {
    name: string;
    email: string;
    phone: string;
    website?: string;
  };
  socialMedia: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  // Enhanced metrics
  stallsBooked?: number;
  stallsPending?: number;
  stallsTotal?: number;
  ticketsRevenue?: number;
  stallsRevenue?: number;
  rawRevenue?: number;
  revenue?: string;
  salesPercent?: number;
  image?: string;
  gallery?: string[];
}

interface EventDetailsDialogProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  hidePromoteButton?: boolean;
  hideEditButton?: boolean;
  apiURL?: string;
}

const FeatureIcon = ({
  feature,
  label,
  icon,
}: {
  feature: boolean;
  label: string;
  icon: React.ReactNode;
}) => {
  if (!feature) return null;
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-gray-100 text-gray-700">
      {icon}
      <span className="text-sm">{label}</span>
    </div>
  );
};

export function EnhancedEventsDetailDialog({
  event,
  isOpen,
  onClose,
  hidePromoteButton,
  hideEditButton,
  apiURL = "",
}: EventDetailsDialogProps) {
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  if (!event) return null;

  // Calculate sales percentage with fallback
  const salesPercentage =
    event.salesPercent ||
    (!event.totalTickets || event.totalTickets === 0
      ? 100
      : ((event.ticketsSold || 0) / event.totalTickets) * 100);

  const ticketsSold = event.ticketsSold || 0;
  const stallsBooked = event.stallsBooked || 0;
  const stallsPending = event.stallsPending || 0;
  const ticketsRevenue = event.ticketsRevenue || 0;
  const stallsRevenue = event.stallsRevenue || 0;
  const totalRevenue = event.rawRevenue || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[95%] md:max-w-[900px] lg:max-w-[1200px] max-h-[95vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-4 mb-4">
          <DialogTitle className="text-3xl font-extrabold tracking-tight text-gray-900">
            {event.title}
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-1">
            {event.description}
          </DialogDescription>
        </DialogHeader>

        {/* Event Banner/Image */}
        {event.image && (
          <div className="w-full h-64 rounded-lg overflow-hidden mb-6">
            <img
              src={`${apiURL}${event.image}`}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Performance Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">
                    Tickets Sold
                  </p>
                  <p className="text-2xl font-bold text-blue-900">
                    {ticketsSold}
                  </p>
                  <p className="text-xs text-blue-600">
                    of {event.totalTickets || "∞"}
                  </p>
                </div>
                <Ticket className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">
                    Stalls Booked
                  </p>
                  <p className="text-2xl font-bold text-purple-900">
                    {stallsBooked}
                  </p>
                  <p className="text-xs text-purple-600">
                    {stallsPending} pending
                  </p>
                </div>
                <Building className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold text-green-900">
                    {event.revenue || formatPrice(totalRevenue)}
                  </p>
                  <p className="text-xs text-green-600">Combined</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">
                    Sales Progress
                  </p>
                  <p className="text-2xl font-bold text-orange-900">
                    {salesPercentage.toFixed(0)}%
                  </p>
                  <p className="text-xs text-orange-600">Ticket capacity</p>
                </div>
                <Users className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Event Details */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2 text-gray-800">
                  <Info className="h-5 w-5 text-blue-600" />
                  Event Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <div className="text-sm">
                      <p className="font-semibold">Dates</p>
                      <p className="text-gray-600">
                        {format(new Date(event.startDate), "PPP")} -{" "}
                        {format(new Date(event.endDate), "PPP")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <div className="text-sm">
                      <p className="font-semibold">Time</p>
                      <p className="text-gray-600">
                        {event.time} - {event.endTime}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <div className="text-sm">
                      <p className="font-semibold">Location</p>
                      <p className="text-gray-600">{event.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-gray-500" />
                    <div className="text-sm">
                      <p className="font-semibold">Tickets</p>
                      <p className="text-gray-600">
                        Total: {event.totalTickets || "Unlimited"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-500" />
                    <div className="text-sm">
                      <p className="font-semibold">Price</p>
                      <p className="text-gray-600">${event.ticketPrice}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <div className="text-sm">
                      <p className="font-semibold">Age Restriction</p>
                      <p className="text-gray-600">{event.ageRestriction}</p>
                    </div>
                  </div>
                </div>

                {/* Sales Progress Bar */}
                <div className="pt-4 border-t">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">
                      Ticket Sales Progress
                    </span>
                    <span className="text-sm font-bold">
                      {salesPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={salesPercentage} className="h-3" />
                </div>
              </CardContent>
            </Card>

            {/* Revenue Breakdown */}
            {(ticketsRevenue > 0 || stallsRevenue > 0) && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2 text-gray-800">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Revenue Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600 font-medium mb-1">
                        Tickets Revenue
                      </p>
                      <p className="text-2xl font-bold text-blue-900">
                        ${ticketsRevenue.toLocaleString()}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        {totalRevenue > 0
                          ? ((ticketsRevenue / totalRevenue) * 100).toFixed(1)
                          : 0}
                        % of total
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600 font-medium mb-1">
                        Stalls Revenue
                      </p>
                      <p className="text-2xl font-bold text-purple-900">
                        ${stallsRevenue.toLocaleString()}
                      </p>
                      <p className="text-xs text-purple-600 mt-1">
                        {totalRevenue > 0
                          ? ((stallsRevenue / totalRevenue) * 100).toFixed(1)
                          : 0}
                        % of total
                      </p>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg">Total Revenue</span>
                      <span className="font-bold text-2xl text-green-600">
                        {formatPrice(totalRevenue)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Features & Tags */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2 text-gray-800">
                  <Tag className="h-5 w-5 text-orange-600" />
                  Features & Tags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <FeatureIcon
                    feature={event.features.food}
                    label="Food"
                    icon={<Utensils className="h-4 w-4" />}
                  />
                  <FeatureIcon
                    feature={event.features.parking}
                    label="Parking"
                    icon={<Car className="h-4 w-4" />}
                  />
                  <FeatureIcon
                    feature={event.features.wifi}
                    label="Wi-Fi"
                    icon={<Wifi className="h-4 w-4" />}
                  />
                  <FeatureIcon
                    feature={event.features.photography}
                    label="Photography"
                    icon={<Camera className="h-4 w-4" />}
                  />
                  <FeatureIcon
                    feature={event.features.security}
                    label="Security"
                    icon={<Shield className="h-4 w-4" />}
                  />
                  <FeatureIcon
                    feature={event.features.accessibility}
                    label="Accessibility"
                    icon={<Accessibility className="h-4 w-4" />}
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Badge className="bg-purple-600 text-white font-medium">
                    {event.category}
                  </Badge>
                  {event.tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Event Gallery */}
            {event.gallery && event.gallery.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2 text-gray-800">
                    <Camera className="h-5 w-5 text-pink-600" />
                    Event Gallery
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {event.gallery.map((img, idx) => (
                      <div
                        key={idx}
                        className="aspect-video rounded-lg overflow-hidden"
                      >
                        <img
                          src={`${apiURL}${img}`}
                          alt={`Gallery ${idx + 1}`}
                          className="w-full h-full object-cover hover:scale-110 transition-transform"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Policies & Instructions */}
            {(event.dresscode ||
              event.refundPolicy ||
              event.termsAndConditions ||
              event.specialInstructions) && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2 text-gray-800">
                    <FileText className="h-5 w-5 text-indigo-600" />
                    Policies & Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {event.dresscode && (
                    <div>
                      <p className="font-semibold text-sm mb-1">Dress Code</p>
                      <p className="text-sm text-gray-600">{event.dresscode}</p>
                    </div>
                  )}
                  {event.refundPolicy && (
                    <div>
                      <p className="font-semibold text-sm mb-1">
                        Refund Policy
                      </p>
                      <p className="text-sm text-gray-600">
                        {event.refundPolicy}
                      </p>
                    </div>
                  )}
                  {event.termsAndConditions && (
                    <div>
                      <p className="font-semibold text-sm mb-1">
                        Terms & Conditions
                      </p>
                      <p className="text-sm text-gray-600">
                        {event.termsAndConditions}
                      </p>
                    </div>
                  )}
                  {event.specialInstructions && (
                    <div>
                      <p className="font-semibold text-sm mb-1">
                        Special Instructions
                      </p>
                      <p className="text-sm text-gray-600">
                        {event.specialInstructions}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Organizer Details */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
                  <Users className="h-5 w-5 text-teal-600" />
                  Organizer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-semibold text-sm">
                    {event.organizerDetails.name}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <a
                    href={`mailto:${event.organizerDetails.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {event.organizerDetails.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    {event.organizerDetails.phone}
                  </span>
                </div>
                {event.organizerDetails.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-gray-500" />
                    <a
                      href={event.organizerDetails.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Website
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Social Media */}
            {(event.socialMedia.facebook ||
              event.socialMedia.instagram ||
              event.socialMedia.twitter) && (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
                    <Globe className="h-5 w-5 text-blue-600" />
                    Social Media
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {event.socialMedia.facebook && (
                    <a
                      href={event.socialMedia.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      <Facebook className="h-4 w-4" />
                      Facebook
                    </a>
                  )}
                  {event.socialMedia.instagram && (
                    <a
                      href={event.socialMedia.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-pink-600 hover:underline"
                    >
                      <Instagram className="h-4 w-4" />
                      Instagram
                    </a>
                  )}
                  {event.socialMedia.twitter && (
                    <a
                      href={event.socialMedia.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-sky-600 hover:underline"
                    >
                      <Twitter className="h-4 w-4" />
                      Twitter
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Stall Information */}
            {(stallsBooked > 0 || stallsPending > 0) && (
              <Card className="shadow-sm bg-purple-50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-purple-900">
                    <Building className="h-5 w-5 text-purple-600" />
                    Stall Bookings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Confirmed</span>
                    <span className="text-lg font-bold text-purple-600">
                      {stallsBooked}
                    </span>
                  </div>
                  {stallsPending > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Pending</span>
                      <span className="text-lg font-bold text-orange-600">
                        {stallsPending}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-sm font-medium">Revenue</span>
                    <span className="text-lg font-bold text-green-600">
                      ${stallsRevenue.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Needed */}
            {stallsPending > 0 && (
              <Card className="shadow-sm bg-orange-50 border-orange-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-orange-900">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    Action Needed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-orange-800">
                    You have <strong>{stallsPending}</strong> pending stall
                    request{stallsPending > 1 ? "s" : ""} awaiting your
                    approval.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
