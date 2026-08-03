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
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted text-foreground">
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
          <DialogTitle className="text-3xl font-extrabold tracking-tight text-foreground">
            {event.title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground mt-1">
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
          <Card className="bg-gradient-to-br from-primary/10 to-primary/15">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-primary font-medium">
                    Tickets Sold
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {ticketsSold}
                  </p>
                  <p className="text-xs text-primary">
                    of {event.totalTickets || "∞"}
                  </p>
                </div>
                <Ticket className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 dark:text-purple-300 font-medium">
                    Stalls Booked
                  </p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                    {stallsBooked}
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-300">
                    {stallsPending} pending
                  </p>
                </div>
                <Building className="h-8 w-8 text-purple-600 dark:text-purple-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-success/10 to-success/15">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-success font-medium">
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold text-success">
                    {event.revenue || formatPrice(totalRevenue)}
                  </p>
                  <p className="text-xs text-success">Combined</p>
                </div>
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 dark:text-orange-300 font-medium">
                    Sales Progress
                  </p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">
                    {salesPercentage.toFixed(0)}%
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-300">Ticket capacity</p>
                </div>
                <Users className="h-8 w-8 text-orange-600 dark:text-orange-300" />
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
                <CardTitle className="text-xl flex items-center gap-2 text-foreground">
                  <Info className="h-5 w-5 text-primary" />
                  Event Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-semibold">Dates</p>
                      <p className="text-muted-foreground">
                        {format(new Date(event.startDate), "PPP")} -{" "}
                        {format(new Date(event.endDate), "PPP")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-semibold">Time</p>
                      <p className="text-muted-foreground">
                        {event.time} - {event.endTime}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-semibold">Location</p>
                      <p className="text-muted-foreground">{event.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-semibold">Tickets</p>
                      <p className="text-muted-foreground">
                        Total: {event.totalTickets || "Unlimited"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-semibold">Price</p>
                      <p className="text-muted-foreground">${event.ticketPrice}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <p className="font-semibold">Age Restriction</p>
                      <p className="text-muted-foreground">{event.ageRestriction}</p>
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
                  <CardTitle className="text-xl flex items-center gap-2 text-foreground">
                    <DollarSign className="h-5 w-5 text-success" />
                    Revenue Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <p className="text-sm text-primary font-medium mb-1">
                        Tickets Revenue
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        ${ticketsRevenue.toLocaleString()}
                      </p>
                      <p className="text-xs text-primary mt-1">
                        {totalRevenue > 0
                          ? ((ticketsRevenue / totalRevenue) * 100).toFixed(1)
                          : 0}
                        % of total
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                      <p className="text-sm text-purple-600 dark:text-purple-300 font-medium mb-1">
                        Stalls Revenue
                      </p>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                        ${stallsRevenue.toLocaleString()}
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-300 mt-1">
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
                      <span className="font-bold text-2xl text-success">
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
                <CardTitle className="text-xl flex items-center gap-2 text-foreground">
                  <Tag className="h-5 w-5 text-orange-600 dark:text-orange-300" />
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
                  <CardTitle className="text-xl flex items-center gap-2 text-foreground">
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
                  <CardTitle className="text-xl flex items-center gap-2 text-foreground">
                    <FileText className="h-5 w-5 text-indigo-600" />
                    Policies & Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {event.dresscode && (
                    <div>
                      <p className="font-semibold text-sm mb-1">Dress Code</p>
                      <p className="text-sm text-muted-foreground">{event.dresscode}</p>
                    </div>
                  )}
                  {event.refundPolicy && (
                    <div>
                      <p className="font-semibold text-sm mb-1">
                        Refund Policy
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {event.refundPolicy}
                      </p>
                    </div>
                  )}
                  {event.termsAndConditions && (
                    <div>
                      <p className="font-semibold text-sm mb-1">
                        Terms & Conditions
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {event.termsAndConditions}
                      </p>
                    </div>
                  )}
                  {event.specialInstructions && (
                    <div>
                      <p className="font-semibold text-sm mb-1">
                        Special Instructions
                      </p>
                      <p className="text-sm text-muted-foreground">
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
                <CardTitle className="text-lg flex items-center gap-2 text-foreground">
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
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${event.organizerDetails.email}`}
                    className="text-primary hover:underline"
                  >
                    {event.organizerDetails.email}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {event.organizerDetails.phone}
                  </span>
                </div>
                {event.organizerDetails.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={event.organizerDetails.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
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
                  <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                    <Globe className="h-5 w-5 text-primary" />
                    Social Media
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {event.socialMedia.facebook && (
                    <a
                      href={event.socialMedia.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
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
              <Card className="shadow-sm bg-purple-50 dark:bg-purple-900/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-purple-900 dark:text-purple-200">
                    <Building className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                    Stall Bookings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Confirmed</span>
                    <span className="text-lg font-bold text-purple-600 dark:text-purple-300">
                      {stallsBooked}
                    </span>
                  </div>
                  {stallsPending > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Pending</span>
                      <span className="text-lg font-bold text-orange-600 dark:text-orange-300">
                        {stallsPending}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-sm font-medium">Revenue</span>
                    <span className="text-lg font-bold text-success">
                      ${stallsRevenue.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Needed */}
            {stallsPending > 0 && (
              <Card className="shadow-sm bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-orange-900 dark:text-orange-200">
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                    Action Needed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-orange-800 dark:text-orange-200">
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
