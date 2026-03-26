import { useEffect, useState, useRef } from "react";
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
import { CalendarDays, MapPin, Users, Heart, Star, Eye } from "lucide-react";

interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  startDate: string;
  time: string;
  location: string;
  organizerName: string;
  organizerId: string;
  isFollowing: boolean;
  rating: number;
  attendees: number;
  price: string;
  image: string;
  slug: string;
}

interface FollowedEventsSectionProps {
  onFollowToggle: (organizerId: string) => void;
  onViewEvent: (eventId: string) => void;
}

export function FollowedEventsSection({
  onFollowToggle,
  onViewEvent,
}: FollowedEventsSectionProps) {
  const apiURL = __API_URL__;
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const carouselRef = useRef<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${apiURL}/events/get-events`);
        if (!response.ok) throw new Error("Failed to load Data");
        const data = await response.json();

        const mappedEvents: Event[] = (data.data || []).map((e: any) => ({
          id: e._id,
          title: e.title,
          description: e.description,
          category: e.category,
          startDate: e.startDate,
          time: e.time,
          location: e.location ?? e.address,
          organizerName: e.organizer?.organizationName ?? "Organizer",
          organizerId: e.organizer?._id ?? "",
          isFollowing: false,
          rating: 4.5, // placeholder rating
          attendees: 0, // placeholder attendee count
          price: e.ticketPrice,
          image: e.image,
          slug: e.slug ?? e.organizer?.slug ?? "",
        }));
        setEvents(mappedEvents);
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [apiURL]);

  useEffect(() => {
    // Carousel timer
    carouselRef.current = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 4 >= events.length ? 0 : prev + 4));
    }, 3000);
    return () => {
      if (carouselRef.current) clearInterval(carouselRef.current);
    };
  }, [events]);

  const handleNavigateToOrganizer = (event: Event) => {
    const slug =
      event.slug ||
      event.organizerName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    navigate(`/event/${slug}`);
  };

  const visibleEvents = events.slice(currentIndex, currentIndex + 4);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">
          Events from Followed Organizers
        </h3>
        <Badge variant="buttonOutline">{events.length} events</Badge>
      </div>

      {/* Loading & Error */}
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">Error: {error}</div>}

      {/* Carousel */}
      <div className="relative">
        <div className="flex gap-4 overflow-hidden whitespace-nowrap">
          {visibleEvents.map((event) => (
            <Card
              key={event.id}
              className="group hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/20 hover:border-l-primary cursor-pointer flex-shrink-0 w-full max-w-[270px] min-w-[220px]"
            >
              {event.image && (
                <img
                  src={
                    event.image.startsWith("http")
                      ? event.image
                      : `${apiURL}${event.image}`
                  }
                  alt={event.title}
                  className="w-full h-48 object-cover rounded-t-md"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.jpg";
                  }}
                />
              )}
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="secondary" className="text-xs">
                    {event.category}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-medium">{event.rating}</span>
                  </div>
                </div>
                <CardTitle className="text-base leading-tight group-hover:text-primary transition-colors">
                  {event.title}
                </CardTitle>
                <CardDescription className="text-xs">
                  by {event.organizerName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3 w-3" />
                    <span>
                      {new Date(event.startDate).toLocaleDateString()} at{" "}
                      {event.time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{event.location}</span>
                  </div>
                  {/* <div className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    <span>{event.attendees} attendees</span>
                  </div> */}
                </div>
                {/* Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <span className="font-semibold text-primary">
                    ${event.price}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => handleNavigateToOrganizer(event)}
                      title="View organizer's page"
                    >
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Navigation Dots */}
        <div className="flex justify-center items-center mt-3 gap-2">
          {Array.from({ length: Math.ceil(events.length / 4) }).map(
            (_, idx) => (
              <div
                key={idx}
                className={`w-3 h-3 rounded-full ${
                  currentIndex === idx * 4 ? "bg-blue-500" : "bg-gray-400"
                }`}
                style={{ cursor: "pointer" }}
                onClick={() => setCurrentIndex(idx * 4)}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
