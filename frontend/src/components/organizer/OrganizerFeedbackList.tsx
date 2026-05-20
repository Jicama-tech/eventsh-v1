import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  Eye,
  MessageSquare,
  Calendar,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { EventFeedbackDialog } from "./EventFeedbackDialog";

const apiURL = __API_URL__;

interface EventRow {
  _id: string;
  title: string;
  startDate: string;
  endDate?: string;
  status?: string;
}

export function OrganizerFeedbackList() {
  const { toast } = useToast();
  const { isModuleEnabled } = useSubscription();
  const canCollectFeedback = isModuleEnabled("feedback");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EventRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem("token");
        if (!token) throw new Error("Not signed in");
        const decoded: any = jwtDecode(token);
        const organizerId = decoded?.sub;
        if (!organizerId) throw new Error("Token missing organizer id");
        const res = await fetch(
          `${apiURL}/events/organizer/${organizerId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const json = await res.json();
        if (!res.ok)
          throw new Error(json?.message || "Failed to load events");
        if (!cancelled) setEvents(json?.data || []);
      } catch (err: any) {
        if (!cancelled) {
          toast({
            title: "Could not load events",
            description: err?.message,
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const filtered = events.filter((e) =>
    e.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  // Past events bubble to the top — feedback typically arrives once the event
  // ends, so completed events are the most likely targets.
  const sorted = [...filtered].sort((a, b) => {
    const aEnded = a.endDate
      ? new Date(a.endDate).getTime() < Date.now()
      : false;
    const bEnded = b.endDate
      ? new Date(b.endDate).getTime() < Date.now()
      : false;
    if (aEnded !== bEnded) return aEnded ? -1 : 1;
    return (
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" /> Feedback
          </h2>
          <p className="text-muted-foreground text-sm">
            Pick an event to view ratings + comments from visitors,
            exhibitors, speakers, and round-table guests.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {!canCollectFeedback ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Lock className="h-8 w-8 mx-auto text-slate-400" />
            <div>
              <p className="font-medium text-slate-700">
                Feedback isn't included in your current plan
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Upgrade your subscription to collect ratings and comments
                from visitors, exhibitors, speakers, or round-table guests.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading events…
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {events.length === 0
              ? "You haven't created any events yet."
              : "No events match that search."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sorted.map((event) => {
            const ended = event.endDate
              ? new Date(event.endDate) < new Date()
              : false;
            return (
              <Card key={event._id}>
                <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{event.title}</h3>
                      {ended && (
                        <Badge variant="outline" className="bg-emerald-50">
                          Ended
                        </Badge>
                      )}
                      {event.status && event.status !== "published" && (
                        <Badge variant="outline">{event.status}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(event.startDate), "MMM d, yyyy")}
                      {event.endDate &&
                        event.endDate !== event.startDate &&
                        ` – ${format(new Date(event.endDate), "MMM d, yyyy")}`}
                    </div>
                  </div>
                  <Button
                    variant="buttonOutline"
                    size="sm"
                    onClick={() => setSelected(event)}
                  >
                    <Eye className="h-4 w-4 mr-1" /> View feedback
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <EventFeedbackDialog
        eventId={selected?._id ?? null}
        eventTitle={selected?.title}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}

export default OrganizerFeedbackList;
