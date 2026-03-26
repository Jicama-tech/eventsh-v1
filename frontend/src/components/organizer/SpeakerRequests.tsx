import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectItem,
  SelectValue,
  SelectContent,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useCountry } from "@/hooks/useCountry";
import {
  Mic,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  DollarSign,
  ExternalLink,
  RefreshCw,
  Loader2,
  Eye,
  Calendar,
  MapPin,
  Users,
  CreditCard,
  Download,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface SpeakerRequestsProps {
  organizerId: string;
}

export function SpeakerRequests({ organizerId }: SpeakerRequestsProps) {
  const { toast } = useToast();
  const apiURL = __API_URL__;
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  // Events list
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Speaker requests for selected event
  const [speakerRequests, setSpeakerRequests] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [loadingSpeakers, setLoadingSpeakers] = useState(false);

  // Speaker detail dialog
  const [selectedSpeaker, setSelectedSpeaker] = useState<any>(null);
  const [showSpeakerDetail, setShowSpeakerDetail] = useState(false);

  // Fee dialog
  const [showFeeDialog, setShowFeeDialog] = useState(false);
  const [feeAmount, setFeeAmount] = useState(0);
  const [feeCharged, setFeeCharged] = useState(false);

  // Payment dialog (same as stalls)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentStatusUpdate, setPaymentStatusUpdate] = useState<"Partial" | "Paid">("Paid");
  const [actionNotes, setActionNotes] = useState("");

  // Stats
  const [stats, setStats] = useState({ totalEvents: 0, totalRequests: 0, pending: 0, confirmed: 0 });

  // ============ FETCH EVENTS ============
  const fetchEvents = async () => {
    if (!organizerId) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiURL}/events/organizer/${organizerId}`);
      const data = await res.json();
      const eventList = data.data || [];
      setEvents(eventList);

      // Fetch all speaker requests for stats
      const reqRes = await fetch(`${apiURL}/speaker-requests/organizer/${organizerId}`);
      const reqData = await reqRes.json();
      const allReqs = reqData.data || [];

      setStats({
        totalEvents: eventList.length,
        totalRequests: allReqs.length,
        pending: allReqs.filter((r: any) => r.status === "Pending").length,
        confirmed: allReqs.filter((r: any) => r.status === "Confirmed").length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [organizerId]);

  const refreshData = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
    toast({ title: "Refreshed", description: "Data updated successfully" });
  };

  // ============ VIEW SPEAKERS FOR EVENT ============
  const handleViewSpeakers = async (event: any) => {
    setSelectedEvent(event);
    setShowDetailsDialog(true);
    setLoadingSpeakers(true);

    try {
      const res = await fetch(`${apiURL}/speaker-requests/event/${event._id}`);
      const data = await res.json();
      const requests = data.data || [];

      // Deduplicate speakers by name (keep first occurrence only)
      const uniqueSpeakers: any[] = [];
      const seenNames = new Set<string>();
      for (const s of (event.speakers || [])) {
        if (!seenNames.has(s.name)) {
          seenNames.add(s.name);
          uniqueSpeakers.push(s);
        }
      }

      // Merge with speakers added directly in event creation
      const eventSpeakers = uniqueSpeakers.map((s: any) => {
        // Check if this speaker already has a request record (with pass)
        const matchingReq = requests.find(
          (r: any) => r.source === "organizer" && r.name === s.name
        );
        return {
          ...s,
          _id: matchingReq?._id || s.id || s._id,
          name: s.name,
          title: s.title,
          organization: s.organization,
          email: s.email,
          status: matchingReq?.status || "Confirmed",
          source: "organizer",
          paymentStatus: matchingReq?.paymentStatus || "Waived",
          sessions: matchingReq?.sessions || s.slots?.map((slot: any) => ({
            topic: slot.topic,
            confirmedStartTime: slot.startTime,
            confirmedEndTime: slot.endTime,
            preferredStartTime: slot.startTime,
            preferredEndTime: slot.endTime,
            description: slot.description,
          })) || [],
          isFromEvent: true,
          hasPass: !!matchingReq?.qrCodePath,
          passId: matchingReq?._id,
        };
      });

      // Avoid duplicates - don't show request records that already match event speakers
      const eventSpeakerNames = eventSpeakers.map((s: any) => s.name);
      const externalRequests = requests.filter(
        (r: any) => !(r.source === "organizer" && eventSpeakerNames.includes(r.name))
      );
      const uniqueEventSpeakers = eventSpeakers;

      setSpeakerRequests([...uniqueEventSpeakers, ...externalRequests]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSpeakers(false);
    }
  };

  // ============ ACTIONS ============
  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`${apiURL}/speaker-requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, changedBy: "organizer" }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: `Speaker ${status.toLowerCase()} successfully` });
        if (selectedEvent) handleViewSpeakers(selectedEvent);
        fetchEvents();
      }
    } catch (err) {
      toast({ title: "Error updating status", variant: "destructive" });
    }
  };

  const handleSetFee = async () => {
    if (!selectedSpeaker) return;
    try {
      const res = await fetch(`${apiURL}/speaker-requests/${selectedSpeaker._id}/fee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCharged: feeCharged, fee: feeAmount }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: data.message });
        setShowFeeDialog(false);
        if (selectedEvent) handleViewSpeakers(selectedEvent);
      }
    } catch (err) {
      toast({ title: "Error setting fee", variant: "destructive" });
    }
  };

  const handleConfirmPayment = async (id: string) => {
    try {
      const res = await fetch(`${apiURL}/speaker-requests/${id}/confirm-payment`, { method: "PATCH" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Payment confirmed" });
        if (selectedEvent) handleViewSpeakers(selectedEvent);
      }
    } catch (err) {
      toast({ title: "Error confirming payment", variant: "destructive" });
    }
  };

  const handleUpdatePaymentStatus = async () => {
    if (!selectedSpeaker) return;
    try {
      const res = await fetch(`${apiURL}/speaker-requests/${selectedSpeaker._id}/payment-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: paymentStatusUpdate, notes: actionNotes }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Payment status updated successfully" });
        setShowPaymentDialog(false);
        setActionNotes("");
        if (selectedEvent) handleViewSpeakers(selectedEvent);
        fetchEvents();
      }
    } catch (err) {
      toast({ title: "Error updating payment", variant: "destructive" });
    }
  };

  const handleGeneratePass = async (speaker: any) => {
    try {
      toast({ title: "Generating pass..." });
      const res = await fetch(`${apiURL}/speaker-requests/generate-pass/${selectedEvent._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(speaker),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Speaker pass generated!" });
        // Refresh to show download button
        if (selectedEvent) handleViewSpeakers(selectedEvent);
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error generating pass", variant: "destructive" });
    }
  };

  // ============ HELPERS ============
  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: any; icon: any }> = {
      Pending: { variant: "secondary", icon: Clock },
      Confirmed: { variant: "default", icon: CheckCircle2 },
      Rejected: { variant: "destructive", icon: XCircle },
      Cancelled: { variant: "destructive", icon: XCircle },
    };
    const config = map[status] || map.Pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />{status}
      </Badge>
    );
  };

  const getPaymentBadge = (paymentStatus: string) => {
    const map: Record<string, { variant: any; color: string }> = {
      Unpaid: { variant: "destructive", color: "text-red-600" },
      Partial: { variant: "secondary", color: "text-yellow-600" },
      Paid: { variant: "default", color: "text-green-600" },
      Waived: { variant: "outline", color: "text-gray-500" },
    };
    const config = map[paymentStatus] || map.Waived;
    return <Badge variant={config.variant}>{paymentStatus}</Badge>;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const formatTime = (t: string) => t || "—";

  const displayedEvents = events.filter((e) =>
    !searchQuery.trim() || e.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ============ RENDER ============
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalEvents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Speaker Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalRequests}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.pending} pending approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Confirmed Speakers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.confirmed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Event List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Speaker Management</CardTitle>
              <CardDescription>View and manage speakers for all your events</CardDescription>
            </div>
            <Button onClick={refreshData} disabled={refreshing} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Speaker Spaces</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedEvents.map((event) => (
                  <TableRow key={event._id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{event.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {event.description?.slice(0, 50)}...
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(event.startDate)}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTime(event.time)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mic className="h-3 w-3 text-purple-500" />
                        <span>{event.speakerSlotTemplates?.length || 0} spaces</span>
                        {event.speakers?.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {event.speakers.length} speaker{event.speakers.length > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {event.status === "published" ? (
                        <Badge className="bg-green-100 text-green-800">Live</Badge>
                      ) : (
                        <Badge variant="outline">{event.status || "Draft"}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleViewSpeakers(event)}>
                        <Eye className="h-3 w-3 mr-1" />
                        View Speakers
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {events.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <Mic className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No events found. Create your first event to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Speakers Dialog - opens on eye click */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Speakers - {selectedEvent?.title}
            </DialogTitle>
            <DialogDescription>
              All speakers and applications for this event
            </DialogDescription>
          </DialogHeader>

          {loadingSpeakers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : speakerRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mic className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No speakers yet</p>
              <p className="text-sm">Add speakers in the event creation form or wait for external applications</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Speaker</TableHead>
                    <TableHead>Session / Agenda</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {speakerRequests.map((req, idx) => (
                    <TableRow key={req._id || idx}>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            {req.name}
                            {req.isKeynote && (
                              <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1">KEYNOTE</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {req.title || req.organization ? `${req.title || ""}${req.organization ? ` · ${req.organization}` : ""}` : ""}
                          </div>
                          {req.email && <div className="text-xs text-muted-foreground">{req.email}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {req.sessions?.length > 0 ? (
                          <div>
                            <div className="font-medium text-sm">{req.sessions[0].topic || req.sessions[0].agenda}</div>
                            {req.sessions[0].description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">{req.sessions[0].description}</div>
                            )}
                          </div>
                        ) : req.slots?.length > 0 ? (
                          <div className="font-medium text-sm">{req.slots[0].topic}</div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {(() => {
                            const s = req.sessions?.[0] || req.slots?.[0];
                            if (!s) return "—";
                            const start = s.confirmedStartTime || s.preferredStartTime || s.startTime;
                            const end = s.confirmedEndTime || s.preferredEndTime || s.endTime;
                            return (start && end) ? `${start} - ${end}` : start ? start : "—";
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {req.isFromEvent ? "Added by you" : req.source === "organizer" ? "Added by you" : "Applied"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {req.isCharged ? (
                          <span className="font-semibold">{formatPrice(req.fee)}</span>
                        ) : (
                          <span className="text-muted-foreground">Free</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell>{getPaymentBadge(req.paymentStatus || "Waived")}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {/* View detail */}
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedSpeaker(req); setShowSpeakerDetail(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>

                          {/* Pending: Approve / Reject / Set Fee */}
                          {!req.isFromEvent && req.status === "Pending" && (
                            <>
                              <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleUpdateStatus(req._id, "Confirmed")}>
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleUpdateStatus(req._id, "Rejected")}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setSelectedSpeaker(req); setFeeCharged(req.isCharged || false); setFeeAmount(req.fee || 0); setShowFeeDialog(true); }}>
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            </>
                          )}

                          {/* Processing/Confirmed + Not Paid: Update Payment (same as stalls) */}
                          {!req.isFromEvent && (req.status === "Processing" || req.status === "Confirmed") && req.paymentStatus !== "Paid" && req.paymentStatus !== "Waived" && (
                            <Button size="sm" variant="default" onClick={() => { setSelectedSpeaker(req); setShowPaymentDialog(true); }}>
                              <CreditCard className="h-3 w-3" />
                            </Button>
                          )}

                          {/* Confirmed (external): Set Fee + Cancel */}
                          {!req.isFromEvent && req.status === "Confirmed" && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => { setSelectedSpeaker(req); setFeeCharged(req.isCharged || false); setFeeAmount(req.fee || 0); setShowFeeDialog(true); }}>
                                <DollarSign className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleUpdateStatus(req._id, "Cancelled")}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}

                          {/* Completed: Download Pass */}
                          {req.status === "Completed" && !req.isFromEvent && (
                            <Button size="sm" variant="ghost" className="text-purple-600" onClick={() => window.open(`${apiURL}/speaker-requests/download-speaker-pass/${req._id}`, "_blank")}>
                              <Download className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Organizer-added: Generate QR or Download */}
                          {req.isFromEvent && !req.hasPass && (
                            <Button size="sm" variant="default" className="text-xs" onClick={() => handleGeneratePass(req)}>
                              <Mic className="h-3 w-3 mr-1" /> Generate Pass
                            </Button>
                          )}
                          {req.isFromEvent && req.hasPass && (
                            <Button size="sm" variant="ghost" className="text-purple-600" onClick={() => window.open(`${apiURL}/speaker-requests/download-speaker-pass/${req._id}`, "_blank")}>
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Speaker Detail Dialog */}
      <Dialog open={showSpeakerDetail} onOpenChange={setShowSpeakerDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSpeaker?.name}</DialogTitle>
            <DialogDescription>
              {selectedSpeaker?.title}{selectedSpeaker?.organization ? ` at ${selectedSpeaker.organization}` : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedSpeaker && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {selectedSpeaker.email && <div className="text-sm"><span className="font-medium">Email:</span> {selectedSpeaker.email}</div>}
                {selectedSpeaker.phone && <div className="text-sm"><span className="font-medium">Phone:</span> {selectedSpeaker.phone}</div>}
              </div>

              {selectedSpeaker.bio && (
                <div><Label className="text-xs font-medium">Bio</Label><p className="text-sm text-muted-foreground mt-1">{selectedSpeaker.bio}</p></div>
              )}
              {selectedSpeaker.expertise && (
                <div><Label className="text-xs font-medium">Expertise</Label><p className="text-sm mt-1">{selectedSpeaker.expertise}</p></div>
              )}
              {selectedSpeaker.previousSpeakingExperience && (
                <div><Label className="text-xs font-medium">Previous Experience</Label><p className="text-sm mt-1">{selectedSpeaker.previousSpeakingExperience}</p></div>
              )}
              {selectedSpeaker.equipmentNeeded && (
                <div><Label className="text-xs font-medium">Equipment Needed</Label><p className="text-sm mt-1">{selectedSpeaker.equipmentNeeded}</p></div>
              )}

              {selectedSpeaker.socialLinks && (
                <div className="flex gap-4 flex-wrap">
                  {selectedSpeaker.socialLinks.linkedin && <a href={selectedSpeaker.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1"><ExternalLink className="h-3 w-3" />LinkedIn</a>}
                  {selectedSpeaker.socialLinks.twitter && <a href={selectedSpeaker.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:underline text-sm flex items-center gap-1"><ExternalLink className="h-3 w-3" />Twitter</a>}
                  {selectedSpeaker.socialLinks.instagram && <a href={selectedSpeaker.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline text-sm flex items-center gap-1"><ExternalLink className="h-3 w-3" />Instagram</a>}
                  {selectedSpeaker.socialLinks.youtube && <a href={selectedSpeaker.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline text-sm flex items-center gap-1"><ExternalLink className="h-3 w-3" />YouTube</a>}
                  {selectedSpeaker.socialLinks.facebook && <a href={selectedSpeaker.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline text-sm flex items-center gap-1"><ExternalLink className="h-3 w-3" />Facebook</a>}
                  {selectedSpeaker.socialLinks.website && <a href={selectedSpeaker.socialLinks.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-sm flex items-center gap-1"><ExternalLink className="h-3 w-3" />Website</a>}
                </div>
              )}

              {/* Sessions */}
              {(selectedSpeaker.sessions?.length > 0 || selectedSpeaker.slots?.length > 0) && (
                <div>
                  <Label className="text-xs font-medium">Sessions</Label>
                  <div className="space-y-2 mt-2">
                    {(selectedSpeaker.sessions || selectedSpeaker.slots || []).map((s: any, i: number) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-3 border text-sm">
                        <p className="font-medium">{s.topic || s.agenda}</p>
                        {s.description && <p className="text-muted-foreground text-xs mt-1">{s.description}</p>}
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          {(s.preferredStartTime || s.startTime) && (
                            <span>{s.preferredStartTime || s.startTime} - {s.preferredEndTime || s.endTime}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2 border-t">
                <span className="text-sm font-medium">Status:</span>
                {getStatusBadge(selectedSpeaker.status)}
              </div>
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            {selectedSpeaker && !selectedSpeaker.isFromEvent && selectedSpeaker.status === "Pending" && (
              <>
                <Button onClick={() => { handleUpdateStatus(selectedSpeaker._id, "Confirmed"); setShowSpeakerDetail(false); }}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button variant="destructive" onClick={() => { handleUpdateStatus(selectedSpeaker._id, "Rejected"); setShowSpeakerDetail(false); }}>
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee Dialog */}
      <Dialog open={showFeeDialog} onOpenChange={setShowFeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Speaker Fee</DialogTitle>
            <DialogDescription>Optionally charge this speaker for their session slot</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox checked={feeCharged} onCheckedChange={(c) => setFeeCharged(!!c)} />
              <Label>Charge this speaker for their slot</Label>
            </div>
            {feeCharged && (
              <div>
                <Label className="text-sm">Fee Amount</Label>
                <Input type="number" min={0} value={feeAmount} onChange={(e) => setFeeAmount(Number(e.target.value))} placeholder="Enter fee amount" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeeDialog(false)}>Cancel</Button>
            <Button onClick={handleSetFee}>Save Fee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog - same as stalls */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
            <DialogDescription>
              Update the payment status for this speaker booking
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Payment Status</Label>
              <Select value={paymentStatusUpdate} onValueChange={(v: "Partial" | "Paid") => setPaymentStatusUpdate(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Partial">Partial Payment</SelectItem>
                  <SelectItem value="Paid">Fully Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea placeholder="Add payment details or notes..." value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPaymentDialog(false); setActionNotes(""); }}>Cancel</Button>
            <Button onClick={handleUpdatePaymentStatus}>
              <CreditCard className="mr-2 h-4 w-4" /> Update Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
