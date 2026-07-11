import { useEffect, useRef, useState, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import { useCountry } from "@/hooks/useCountry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineWalkinForm } from "./InlineWalkinForm";
import {
  InlinePlatformFeeForm,
  type PlatformFeeFormPayload,
} from "./InlinePlatformFeeForm";
import EventRsvpPanel from "./EventRsvpPanel";
import EmailSenderSettings from "./EmailSenderSettings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Bot,
  Send,
  Sparkles,
  X,
  Mic,
  MicOff,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Ticket,
  Calendar,
  Users,
  AlertCircle,
  Star,
  Building2,
  Mic2,
  Globe,
  Settings as SettingsIcon,
  User,
  Lightbulb,
  RotateCcw,
  Plus,
  Pencil,
  UserPlus,
  Store,
  Grid3x3,
  Crown,
  Clock,
  CalendarCheck,
  Zap,
  AlertTriangle,
  Receipt,
  MessageSquare,
  Copy,
  ExternalLink,
  BookOpen,
  Download,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiURL = __API_URL__;

const COUNTRY_CURRENCY: Record<string, { symbol: string; locale: string }> = {
  IN: { symbol: "₹", locale: "en-IN" },
  SG: { symbol: "SG$", locale: "en-SG" },
  US: { symbol: "$", locale: "en-US" },
  GB: { symbol: "£", locale: "en-GB" },
  AE: { symbol: "AED ", locale: "en-AE" },
  AU: { symbol: "A$", locale: "en-AU" },
  EU: { symbol: "€", locale: "en-IE" },
};
function formatMoney(amount: number, curr: { symbol: string; locale: string }) {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${curr.symbol}${new Intl.NumberFormat(curr.locale, { maximumFractionDigits: 0 }).format(safe)}`;
}

interface QuickAction {
  label: string;
  action: string;
}

interface EventPicker {
  intent: string;
  label: string;
  actionTemplate: string; // e.g. 'Show tickets for "{title}"'
  events: { id: string; title: string }[];
}

interface WalkinFormPayload {
  organizationName: string;
  country: string;
  whatsAppNumber?: string;
  paymentURL?: string;
  events: {
    id: string;
    title: string;
    startDate?: string;
    time?: string;
    venue?: string;
    visitorTypes: {
      id: string;
      name: string;
      price: number;
      description?: string;
      maxCount?: number;
    }[];
  }[];
}

type BotAction =
  | { type: "navigate"; tab: string }
  | { type: "openCreateEvent"; eventType?: string; category?: string }
  | { type: "openEditEvent"; eventId: string; eventTitle?: string }
  | { type: "openAddVisitor" }
  | { type: "openAddExhibitor" }
  | { type: "openOrganizerRegister" };

interface IndividualEventCard {
  id: string;
  title: string;
  date?: string;
  status?: string;
  ticketCount?: number;
  revenue?: number;
  currency?: string;
  ticketTypeCount?: number;
  ticketTypeNames?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  capacityTotal?: number;
  publicUrl?: string;
  storeUrl?: string;
  // Marriage / Personal events are RSVP-based — the count is attending RSVPs,
  // not tickets sold, so the card labels it differently.
  isRsvp?: boolean;
}

interface IndividualParticipant {
  id: string;
  name: string;
  email?: string;
  ticketType?: string;
  used?: boolean;
  // RSVP guests carry an explicit "Attending"/"Declined" label instead of the
  // ticket "Checked in"/"Pending" status.
  statusLabel?: string;
  statusOk?: boolean;
}

interface GuideTopicMeta {
  slug: string;
  title: string;
  summary: string;
}

interface GuidePayload {
  intro: string;
  topics: GuideTopicMeta[];
  /** Path the frontend appends `?slug=<slug|all>` to for the PDF download. */
  pdfBasePath: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  quickActions?: QuickAction[];
  eventPicker?: EventPicker;
  walkinForm?: WalkinFormPayload;
  platformFeeForm?: PlatformFeeFormPayload;
  botAction?: BotAction;
  // Individual-mode rich cards. Rendered inline as part of the chat
  // thread when the bot returns event/participant data.
  events?: IndividualEventCard[];
  participants?: IndividualParticipant[];
  // Organizer guide: topic catalog + downloadable PDF links (Guide pill).
  guide?: GuidePayload;
  // Deep-linkable pending rows (approvals/payments/edit/cancel). Each renders
  // as a tappable record that opens Participants on its event + pulses the row.
  records?: PendingRecord[];
  ts: number;
}

interface PendingRecord {
  ref?: string;
  vendor?: string;
  event?: string;
  amountFormatted?: string;
  reason?: string;
  stallId: string;
  eventId: string;
  category: "approval" | "payment" | "edit" | "cancel";
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
}

interface ChatbotWidgetProps {
  onNavigate?: (tab: string) => void;
  /** Open the event editor in the dashboard. Mode "create" → blank form (or
   *  pre-filled with an eventType/category when the chatbot picked a personal
   *  event type); mode "edit" → pre-filled with the given eventId. */
  onOpenEventForm?: (
    mode: "create" | "edit",
    payload?: {
      eventId?: string;
      eventTitle?: string;
      eventType?: string;
      category?: string;
    },
  ) => void;
  /** Open the Add Visitor (user) form in the Users tab. */
  onOpenAddVisitor?: () => void;
  /** Open the Add Exhibitor (shopkeeper) form in the Users tab. */
  onOpenAddExhibitor?: () => void;
  /** Navigate to the organizer registration form. Triggered for Individuals
   *  who ask the chatbot to register them as an organizer. */
  onOpenOrganizerRegister?: () => void;
  /** When true, the widget renders in "Individual onboarding" mode — the
   *  starter prompt and quick-action chips only offer "Create event" and
   *  "Become an organizer". */
  isIndividual?: boolean;
  greeting?: string;
  mode?: "floating" | "page";
  /** Sidebar nav items rendered as "jump to" pills. If omitted, a default
   *  set is used. Pass the dashboard's actual sidebar list to keep them
   *  in sync. */
  navItems?: NavItem[];
}

interface AnalyticsCard {
  label: string;
  value: string | number;
  icon: any;
  tint: string;
  textTint: string;
}

type SuggestionCard = {
  Icon: any;
  tint: string;
  title: string;
  sub: string;
  prompt: string;
  category: string;
};

const SUGGESTION_CARDS: SuggestionCard[] = [
  // ========== GUIDE ==========
  {
    category: "Guide",
    Icon: BookOpen,
    tint: "text-indigo-600 bg-indigo-50",
    title: "Guide",
    sub: "Full how-to: setup, tickets, stalls & more — download as PDF",
    prompt: "Show me the complete organizer guide",
  },
  {
    category: "Guide",
    Icon: Ticket,
    tint: "text-indigo-600 bg-indigo-50",
    title: "How visitors book tickets",
    sub: "Step-by-step ticket booking flow + PDF",
    prompt: "How do visitors book a ticket?",
  },
  {
    category: "Guide",
    Icon: Store,
    tint: "text-indigo-600 bg-indigo-50",
    title: "How vendors book stalls",
    sub: "Step-by-step stall rental flow + PDF",
    prompt: "How do vendors rent a stall?",
  },
  {
    category: "Guide",
    Icon: Grid3x3,
    tint: "text-indigo-600 bg-indigo-50",
    title: "How to reserve round tables",
    sub: "Step-by-step round-table seat booking + PDF",
    prompt: "How do visitors reserve round-table seats?",
  },
  {
    category: "Guide",
    Icon: Mic2,
    tint: "text-indigo-600 bg-indigo-50",
    title: "How speakers apply",
    sub: "Step-by-step speaker application flow + PDF",
    prompt: "How do speakers apply to speak?",
  },
  // ========== ANALYTICS / DASHBOARD ==========
  {
    category: "Analytics",
    Icon: TrendingUp,
    tint: "text-blue-600 bg-blue-50",
    title: "Today's revenue",
    sub: "Today's ticket sales + revenue",
    prompt: "Show me today's revenue and ticket sales",
  },
  {
    category: "Analytics",
    Icon: TrendingUp,
    tint: "text-blue-600 bg-blue-50",
    title: "This week's stats",
    sub: "Revenue + tickets this week",
    prompt: "Show this week's revenue and tickets",
  },
  {
    category: "Analytics",
    Icon: TrendingUp,
    tint: "text-blue-600 bg-blue-50",
    title: "This month's stats",
    sub: "Monthly performance",
    prompt: "Show this month's revenue and ticket count",
  },
  {
    category: "Analytics",
    Icon: TrendingUp,
    tint: "text-blue-600 bg-blue-50",
    title: "This year's stats",
    sub: "Year-to-date revenue + tickets",
    prompt: "Show this year's revenue and tickets",
  },
  {
    category: "Analytics",
    Icon: Star,
    tint: "text-amber-600 bg-amber-50",
    title: "Top events",
    sub: "Best performing by revenue",
    prompt: "Show me top events by revenue",
  },
  {
    category: "Analytics",
    Icon: AlertCircle,
    tint: "text-orange-600 bg-orange-50",
    title: "Pending approvals",
    sub: "Speakers + stalls awaiting review",
    prompt: "How many pending approvals do I have?",
  },
  {
    category: "Analytics",
    Icon: TrendingUp,
    tint: "text-emerald-600 bg-emerald-50",
    title: "Platform overview",
    sub: "Events / tickets / revenue summary",
    prompt: "Give me an overview of my platform",
  },
  {
    category: "Analytics",
    Icon: Calendar,
    tint: "text-emerald-600 bg-emerald-50",
    title: "Events breakdown",
    sub: "Status / visibility / occupancy / avg price",
    prompt: "Give me a detailed events analytics breakdown",
  },
  {
    category: "Analytics",
    Icon: Building2,
    tint: "text-orange-600 bg-orange-50",
    title: "Stalls analytics",
    sub: "Bookings, payments, revenue per event",
    prompt: "Show me stall analytics",
  },
  {
    category: "Analytics",
    Icon: Mic2,
    tint: "text-purple-600 bg-purple-50",
    title: "Speakers analytics",
    sub: "Requests, fees, keynotes, top events",
    prompt: "Show me speaker analytics",
  },
  {
    category: "Analytics",
    Icon: Users,
    tint: "text-cyan-600 bg-cyan-50",
    title: "Round tables analytics",
    sub: "Tables, chairs, occupancy, revenue",
    prompt: "Show me round table analytics",
  },

  // ========== EVENTS ==========
  {
    category: "Events",
    Icon: Plus,
    tint: "text-blue-600 bg-blue-50",
    title: "Create new event",
    sub: "Open the blank event form",
    prompt: "Create a new event",
  },
  {
    category: "Events",
    Icon: Pencil,
    tint: "text-purple-600 bg-purple-50",
    title: "Edit an event",
    sub: "Open editor pre-filled (give the title)",
    prompt: "Edit event ",
  },
  {
    category: "Events",
    Icon: Calendar,
    tint: "text-emerald-600 bg-emerald-50",
    title: "Upcoming events",
    sub: "What's coming up",
    prompt: "List my upcoming events",
  },
  {
    category: "Events",
    Icon: Calendar,
    tint: "text-emerald-600 bg-emerald-50",
    title: "All events",
    sub: "Every event including past",
    prompt: "List all my events",
  },
  {
    category: "Events",
    Icon: Calendar,
    tint: "text-slate-600 bg-slate-50",
    title: "Past events",
    sub: "Completed events",
    prompt: "Show me past events",
  },
  {
    category: "Events",
    Icon: Grid3x3,
    tint: "text-purple-600 bg-purple-50",
    title: "Space templates",
    sub: "Reusable Space configs from past events",
    prompt: "Show my space templates",
  },
  // {
  //   category: "Events",
  //   Icon: Sparkles,
  //   tint: "text-purple-600 bg-purple-50",
  //   title: "Create event (one-shot)",
  //   sub: "Full event with everything in one prompt",
  //   prompt:
  //     "Create a tech meetup on May 15, 2026 in Bangalore at MG Road. 3 ticket types: Regular ₹500, VIP ₹1500, Student ₹250. Add 10 round tables of 8 seats each at ₹1000 per chair, and 5 stalls at ₹2000 each",
  // },
  // {
  //   category: "Events",
  //   Icon: Calendar,
  //   tint: "text-blue-600 bg-blue-50",
  //   title: "Create blank event",
  //   sub: "Just title and date — refine later",
  //   prompt: "Create a basic event with title and date",
  // },
  // {
  //   category: "Events",
  //   Icon: Sparkles,
  //   tint: "text-emerald-600 bg-emerald-50",
  //   title: "Add ticket types",
  //   sub: "Add tiers to an existing event",
  //   prompt:
  //     "Add 3 ticket types to my latest event: Regular ₹500, VIP ₹1500, Student ₹250",
  // },
  // {
  //   category: "Events",
  //   Icon: Sparkles,
  //   tint: "text-purple-600 bg-purple-50",
  //   title: "Add round tables",
  //   sub: "Auto-place tables on the venue grid",
  //   prompt: "Add 10 round tables of 8 seats each to my latest event",
  // },
  // {
  //   category: "Events",
  //   Icon: Building2,
  //   tint: "text-orange-600 bg-orange-50",
  //   title: "Add stalls",
  //   sub: "Auto-place vendor booths",
  //   prompt: "Add 5 stalls at ₹2000 each to my latest event",
  // },
  // {
  //   category: "Events",
  //   Icon: Mic2,
  //   tint: "text-purple-600 bg-purple-50",
  //   title: "Add speakers",
  //   sub: "Add speaker profiles",
  //   prompt: "Add speaker John Doe from Microsoft to my latest event",
  // },
  // {
  //   category: "Events",
  //   Icon: Globe,
  //   tint: "text-indigo-600 bg-indigo-50",
  //   title: "Set venue size",
  //   sub: "Resize the venue canvas",
  //   prompt: "Set venue size to 1200x700 for my latest event",
  // },
  // {
  //   category: "Events",
  //   Icon: Sparkles,
  //   tint: "text-emerald-600 bg-emerald-50",
  //   title: "Publish event",
  //   sub: "Make a draft event live",
  //   prompt: "Publish my latest event",
  // }

  // ========== TICKETS ==========
  {
    category: "Tickets",
    Icon: Ticket,
    tint: "text-blue-600 bg-blue-50",
    title: "Walk-in booking",
    sub: "Book a ticket for an in-person customer",
    prompt: "Book a walk-in ticket",
  },
  {
    category: "Tickets",
    Icon: Ticket,
    tint: "text-purple-600 bg-purple-50",
    title: "Recent tickets",
    sub: "Last tickets sold",
    prompt: "Show me recent tickets sold",
  },
  {
    category: "Tickets",
    Icon: Ticket,
    tint: "text-amber-600 bg-amber-50",
    title: "Pending payments",
    sub: "Tickets with unconfirmed payments",
    prompt: "Show tickets with pending payments",
  },
  {
    category: "Tickets",
    Icon: Ticket,
    tint: "text-emerald-600 bg-emerald-50",
    title: "Confirmed tickets",
    sub: "Paid tickets ready to use",
    prompt: "Show confirmed tickets",
  },
  {
    category: "Tickets",
    Icon: Ticket,
    tint: "text-blue-600 bg-blue-50",
    title: "Tickets per event",
    sub: "Pick an event to see its tickets",
    prompt: "Show tickets per event",
  },

  // ========== ATTENDEES ==========
  {
    category: "Participants",
    Icon: UserPlus,
    tint: "text-emerald-600 bg-emerald-50",
    title: "Add visitor",
    sub: "Open the Add Customer form",
    prompt: "Add a new visitor",
  },
  {
    category: "Participants",
    Icon: Users,
    tint: "text-cyan-600 bg-cyan-50",
    title: "Attendees per event",
    sub: "Pick an event to see its attendees",
    prompt: "List attendees per event",
  },
  {
    category: "Participants",
    Icon: Users,
    tint: "text-cyan-600 bg-cyan-50",
    title: "Find attendee",
    sub: "Search by name or email",
    prompt: "Find attendee by name or email",
  },
  {
    category: "Participants",
    Icon: Users,
    tint: "text-emerald-600 bg-emerald-50",
    title: "Participation report",
    sub: "Visitors, exhibitors, speakers, round tables — pick an event",
    prompt: "Show participation report per event",
  },
  {
    category: "Participants",
    Icon: UserPlus,
    tint: "text-blue-600 bg-blue-50",
    title: "All my visitors",
    sub: "Every visitor across the org as a table",
    prompt: "List my visitors",
  },
  {
    category: "Participants",
    Icon: Store,
    tint: "text-orange-600 bg-orange-50",
    title: "All my exhibitors",
    sub: "Every exhibitor across the org as a table",
    prompt: "List my exhibitors",
  },

  // ========== STALLS / VENDORS ==========
  {
    category: "Stalls",
    Icon: Store,
    tint: "text-orange-600 bg-orange-50",
    title: "Add exhibitor",
    sub: "Open the Add Exhibitor form",
    prompt: "Add a new exhibitor",
  },
  {
    category: "Stalls",
    Icon: Building2,
    tint: "text-orange-600 bg-orange-50",
    title: "Pending stall requests",
    sub: "Vendors awaiting approval",
    prompt: "Show pending stall registrations",
  },
  {
    category: "Stalls",
    Icon: Building2,
    tint: "text-emerald-600 bg-emerald-50",
    title: "Approved stalls",
    sub: "Confirmed exhibitors",
    prompt: "Show approved stalls",
  },
  {
    category: "Stalls",
    Icon: Building2,
    tint: "text-blue-600 bg-blue-50",
    title: "Stalls per event",
    sub: "Pick an event to see its stalls",
    prompt: "Show stalls per event",
  },

  // ========== SPEAKERS ==========
  {
    category: "Speakers",
    Icon: Mic2,
    tint: "text-purple-600 bg-purple-50",
    title: "Pending speaker requests",
    sub: "Applicants awaiting review",
    prompt: "Show pending speaker requests",
  },
  {
    category: "Speakers",
    Icon: Mic2,
    tint: "text-purple-600 bg-purple-50",
    title: "Speakers per event",
    sub: "Pick an event to see its speakers",
    prompt: "Show speakers per event",
  },

  // ========== SETTINGS / PLAN ==========
  {
    category: "Settings",
    Icon: SettingsIcon,
    tint: "text-rose-600 bg-rose-50",
    title: "My subscription",
    sub: "Current plan + module access",
    prompt: "What's my subscription plan?",
  },
  {
    category: "Settings",
    Icon: SettingsIcon,
    tint: "text-blue-600 bg-blue-50",
    title: "All available plans",
    sub: "Plans I could switch to",
    prompt: "Show all available plans",
  },
  {
    category: "Settings",
    Icon: Users,
    tint: "text-cyan-600 bg-cyan-50",
    title: "My operators",
    sub: "Team members under my account",
    prompt: "List my operators",
  },
  {
    category: "Settings",
    Icon: SettingsIcon,
    tint: "text-slate-600 bg-slate-50",
    title: "My profile",
    sub: "Organizer details",
    prompt: "Show my profile",
  },
  {
    category: "Settings",
    Icon: SettingsIcon,
    tint: "text-emerald-600 bg-emerald-50",
    title: "Organization settings",
    sub: "Profile + plan + payments + operators",
    prompt: "Show all my organization settings",
  },

  // ========== PLATFORM FEES ==========
  {
    category: "Platform Fees",
    Icon: Receipt,
    tint: "text-amber-700 bg-amber-50",
    title: "What I owe EventSH",
    sub: "Per-event platform fees + QR checkout",
    prompt: "How much do I owe EventSH for my events?",
  },
  {
    category: "Platform Fees",
    Icon: Receipt,
    tint: "text-orange-600 bg-orange-50",
    title: "Explain platform fees",
    sub: "How fees are calculated and paid",
    prompt: "What are platform fees and how do I pay them?",
  },

  // ========== FEEDBACK ==========
  {
    category: "Feedback",
    Icon: MessageSquare,
    tint: "text-violet-600 bg-violet-50",
    title: "View event feedback",
    sub: "Visitors, exhibitors, speakers, round tables",
    prompt: "Show me feedback",
  },
  {
    category: "Feedback",
    Icon: MessageSquare,
    tint: "text-fuchsia-600 bg-fuchsia-50",
    title: "Why is an audience missing?",
    sub: "Feedback access depends on your plan",
    prompt: "Why can't I see Visitors feedback?",
  },

  // ========== NAVIGATION ==========
  {
    category: "Jump to",
    Icon: Calendar,
    tint: "text-blue-600 bg-blue-50",
    title: "Open Events",
    sub: "Switch to events tab",
    prompt: "Open the events tab",
  },
  {
    category: "Jump to",
    Icon: Receipt,
    tint: "text-amber-700 bg-amber-50",
    title: "Open Platform Fees",
    sub: "Per-event fees + QR payment",
    prompt: "Open the platform fees tab",
  },
  {
    category: "Jump to",
    Icon: MessageSquare,
    tint: "text-violet-600 bg-violet-50",
    title: "Open Feedback",
    sub: "Ratings and comments",
    prompt: "Open the feedback tab",
  },
  {
    category: "Jump to",
    Icon: Globe,
    tint: "text-indigo-600 bg-indigo-50",
    title: "Open Storefront",
    sub: "Customize the public site",
    prompt: "Open the storefront customizer",
  },
  {
    category: "Jump to",
    Icon: SettingsIcon,
    tint: "text-rose-600 bg-rose-50",
    title: "Open Settings",
    sub: "Profile / plan / operators",
    prompt: "Open the settings tab",
  },
];

// Page size for in-chat tables. Tables longer than this get prev/next + page
// counter controls so the chat doesn't blow up vertically when the bot
// returns hundreds of rows.
const TABLE_PAGE_SIZE = 20;

// React-rendered table that paginates rows past TABLE_PAGE_SIZE. Cell content
// still flows through `formatInline` (bold + code spans) which returns
// already-escaped HTML, so dangerouslySetInnerHTML on the cell is safe.
const PaginatedTable: React.FC<{ headers: string[]; rows: string[][] }> = ({
  headers,
  rows,
}) => {
  const [page, setPage] = useState(0);
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / TABLE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * TABLE_PAGE_SIZE;
  const end = Math.min(start + TABLE_PAGE_SIZE, total);
  const view = rows.slice(start, end);

  return (
    <div className="overflow-x-auto my-2 rounded-lg border border-slate-200">
      <table className="w-full text-xs">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h, idx) => (
              <th
                key={idx}
                className="px-2 py-1.5 text-left font-semibold text-slate-700 border-b border-slate-200"
                dangerouslySetInnerHTML={{ __html: formatInline(h) }}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {view.map((row, ri) => (
            <tr
              key={start + ri}
              className="hover:bg-slate-50/50 border-b border-slate-100 last:border-0"
            >
              {row.map((c, ci) => (
                <td
                  key={ci}
                  className="px-2 py-1.5 text-slate-700"
                  dangerouslySetInnerHTML={{ __html: formatInline(c) }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {total > TABLE_PAGE_SIZE && (
        <div className="flex items-center justify-between px-2 py-1.5 border-t border-slate-200 bg-slate-50/50 text-[11px] text-slate-600">
          <span>
            Showing <span className="font-medium">{start + 1}-{end}</span> of{" "}
            <span className="font-medium">{total}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="px-1">
              Page {safePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Markdown parser — bold, lists, tables, code spans. Returns React nodes so
// tables render as a stateful <PaginatedTable> instead of a static HTML
// string. Inline formatting (bold/code) still flows through formatInline()
// which returns safe HTML.
function renderMarkdown(text: string): React.ReactNode {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = escaped.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let listBuffer: { kind: "ul" | "ol"; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!listBuffer) return;
    const items = listBuffer.items;
    if (listBuffer.kind === "ul") {
      out.push(
        <ul key={`l-${key++}`} className="list-disc ml-5 my-1 space-y-0.5">
          {items.map((it, idx) => (
            <li
              key={idx}
              dangerouslySetInnerHTML={{ __html: formatInline(it) }}
            />
          ))}
        </ul>,
      );
    } else {
      out.push(
        <ol key={`l-${key++}`} className="list-decimal ml-5 my-1 space-y-0.5">
          {items.map((it, idx) => (
            <li
              key={idx}
              dangerouslySetInnerHTML={{ __html: formatInline(it) }}
            />
          ))}
        </ol>,
      );
    }
    listBuffer = null;
  };

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const isTableHeader =
      /^\s*\|.*\|\s*$/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1]);
    if (isTableHeader) {
      flushList();
      const headers = line
        .split("|")
        .map((c) => c.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i]
          .split("|")
          .map((c) => c.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        rows.push(cells);
        i++;
      }
      out.push(
        <PaginatedTable key={`t-${key++}`} headers={headers} rows={rows} />,
      );
      continue;
    }
    // Headings (#, ##, ###…). Rendered as weighted text rather than raw
    // <h*> so they sit naturally inside a chat bubble.
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      flushList();
      const lvl = headingMatch[1].length;
      const cls =
        lvl <= 1
          ? "text-base font-bold mt-2 mb-1 text-slate-900"
          : lvl === 2
            ? "text-sm font-semibold mt-2 mb-1 text-indigo-700"
            : "text-xs font-semibold mt-1.5 mb-0.5 text-slate-700";
      out.push(
        <p
          key={`h-${key++}`}
          className={cls}
          dangerouslySetInnerHTML={{ __html: formatInline(headingMatch[2]) }}
        />,
      );
      i++;
      continue;
    }
    // Horizontal rule.
    if (/^---+$/.test(line.trim())) {
      flushList();
      out.push(<hr key={`hr-${key++}`} className="my-2 border-slate-200" />);
      i++;
      continue;
    }
    // Blockquote. The leading ">" has already been HTML-escaped to "&gt;".
    const quoteMatch = line.match(/^&gt;\s?(.*)/);
    if (quoteMatch) {
      flushList();
      out.push(
        <blockquote
          key={`q-${key++}`}
          className="border-l-2 border-indigo-300 pl-2 my-1 text-slate-600 italic"
          dangerouslySetInnerHTML={{ __html: formatInline(quoteMatch[1]) }}
        />,
      );
      i++;
      continue;
    }
    const ulMatch = line.match(/^[\s]*[-*]\s+(.*)/);
    const olMatch = line.match(/^[\s]*\d+\.\s+(.*)/);
    if (ulMatch) {
      if (listBuffer && listBuffer.kind !== "ul") flushList();
      if (!listBuffer) listBuffer = { kind: "ul", items: [] };
      listBuffer.items.push(ulMatch[1]);
    } else if (olMatch) {
      if (listBuffer && listBuffer.kind !== "ol") flushList();
      if (!listBuffer) listBuffer = { kind: "ol", items: [] };
      listBuffer.items.push(olMatch[1]);
    } else {
      flushList();
      if (line) {
        out.push(
          <p
            key={`p-${key++}`}
            className="my-1"
            dangerouslySetInnerHTML={{ __html: formatInline(line) }}
          />,
        );
      }
    }
    i++;
  }
  flushList();
  return <>{out}</>;
}

function formatInline(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /`([^`]+)`/g,
      '<code class="bg-slate-100 px-1 py-0.5 rounded text-[0.85em] font-mono">$1</code>',
    );
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: TrendingUp },
  { id: "events", label: "Events", icon: Calendar },
  { id: "kiosk", label: "In-Person Booking", icon: Ticket },
  { id: "eventAttendees", label: "Participants", icon: Users },
  { id: "platformFees", label: "Platform Fees", icon: Receipt },
  { id: "speakerRequests", label: "Speakers", icon: Mic2 },
  { id: "users", label: "Exhibitors/Visitors", icon: Building2 },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "storefront", label: "Eventfront", icon: Globe },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export function ChatbotWidget({
  onNavigate,
  onOpenEventForm,
  onOpenAddVisitor,
  onOpenAddExhibitor,
  onOpenOrganizerRegister,
  isIndividual = false,
  greeting = "Hi! I am **EventSH AI** for **{ORG}**. Ask me about events, tickets, attendees, vendors, speakers — or just say hi.",
  mode = "floating",
  navItems = DEFAULT_NAV_ITEMS,
}: ChatbotWidgetProps) {
  const isPage = mode === "page";
  const { toast } = useToast();
  const [open, setOpen] = useState(isPage);
  // Individual (Marriage) flow — the event whose RSVP guest-list dialog is
  // open. Only marriage / personal (RSVP-based) event cards open this; ticketed
  // events keep their existing chat-based participants view untouched.
  const [rsvpEvent, setRsvpEvent] = useState<{
    id: string;
    title: string;
  } | null>(null);
  // Individual "send from my own email" settings dialog.
  const [emailSettingsOpen, setEmailSettingsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => {
    // Restore previous chat history for this organizer (per-tab session).
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return [];
      const decoded: any = jwtDecode(token);
      const key = `chatbot:msgs:${decoded.sub}`;
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Message[]) : [];
    } catch {
      return [];
    }
  });

  // Persist messages to sessionStorage so they survive tab navigation.
  // sessionStorage clears on logout / tab close — ideal for "while logged in".
  useEffect(() => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return;
      const decoded: any = jwtDecode(token);
      const key = `chatbot:msgs:${decoded.sub}`;
      // Cap to last 200 messages to avoid quota issues.
      const capped = messages.slice(-200);
      sessionStorage.setItem(key, JSON.stringify(capped));
    } catch {
      /* quota or decode error — best-effort persist */
    }
  }, [messages]);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  // Individuals get a stripped-down view — hide the analytics strip by
  // default (they can still toggle it on via the Stats button). Organizers
  // keep it expanded.
  const [showAnalytics, setShowAnalytics] = useState(!isIndividual);
  const [showPromptPanel, setShowPromptPanel] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsCard[] | null>(null);
  const [orgInfo, setOrgInfo] = useState<{
    name: string;
    organizationName: string;
    country: string;
  } | null>(null);
  // Counts of exhibitor stalls awaiting organizer action — surfaced as
  // flickering pills under the greeting so the team can act on priority.
  // Pending exhibitor queues, split by the action they need. Each item carries
  // its stall + event id so clicking a pill deep-links straight to that event's
  // Participants dialog and pulses the exact exhibitor rows.
  type PendItem = { stallId: string; eventId: string };
  const [pendApproval, setPendApproval] = useState<PendItem[]>([]);
  const [pendPayment, setPendPayment] = useState<PendItem[]>([]);
  const [pendEdit, setPendEdit] = useState<PendItem[]>([]);
  const [pendCancel, setPendCancel] = useState<PendItem[]>([]);

  useEffect(() => {
    if (isIndividual) return;
    let cancelled = false;
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return;
      const decoded: any = jwtDecode(token);
      const orgId = decoded?.organizerId || decoded?.sub;
      if (!orgId) return;
      const load = () => {
        fetch(`${apiURL}/stalls/organizer/${orgId}`)
          .then((r) => r.json())
          .then((j) => {
            if (cancelled) return;
            const stalls: any[] = Array.isArray(j) ? j : j?.data || [];
            const toItem = (s: any): PendItem => ({
              stallId: String(s?._id || ""),
              eventId: String(s?.eventId?._id || s?.eventId || ""),
            });
            // Yellow = awaiting approve/reject. Green = payment submitted,
            // awaiting the organizer's verification. Blue = edit/update request
            // awaiting confirm. Red = cancellation/delete request.
            setPendApproval(
              stalls.filter((s) => s?.status === "Pending").map(toItem),
            );
            setPendPayment(
              stalls.filter((s) => s?.status === "Processing").map(toItem),
            );
            setPendEdit(
              stalls
                .filter(
                  (s) =>
                    s?.pendingAmendment?.status === "paid_pending_confirm",
                )
                .map(toItem),
            );
            setPendCancel(
              stalls
                .filter(
                  (s) => s?.pendingCancellation?.status === "requested",
                )
                .map(toItem),
            );
          })
          .catch(() => {});
      };
      load();
      // Light polling so the pills stay fresh while the dashboard is open.
      const t = setInterval(load, 60000);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    } catch {
      /* token decode failed — no pills */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIndividual]);

  // Clicking a pending pill jumps to Participants and opens the event of the
  // first pending item, pulsing every exhibitor of that event in the same
  // category. sessionStorage survives the lazy-load of EventAttendees; the
  // window event handles the already-mounted case.
  const openPending = (items: PendItem[]) => {
    const withEvent = items.filter((i) => i.eventId);
    if (!withEvent.length) return;
    const eventId = withEvent[0].eventId;
    const stallIds = withEvent
      .filter((i) => i.eventId === eventId)
      .map((i) => i.stallId);
    try {
      sessionStorage.setItem(
        "eventsh:openParticipant",
        JSON.stringify({ eventId, stallIds, ts: Date.now() }),
      );
    } catch {
      /* storage blocked */
    }
    onNavigate?.("eventAttendees");
    setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent("open-participant-event"));
      } catch {
        /* no-op */
      }
    }, 150);
  };

  // Tapping a single pending record (from a chatbot list) opens that exact
  // exhibitor's event in Participants and pulses its row.
  const openRecord = (rec: PendingRecord) => {
    if (!rec?.eventId) return;
    try {
      sessionStorage.setItem(
        "eventsh:openParticipant",
        JSON.stringify({
          eventId: rec.eventId,
          stallIds: rec.stallId ? [rec.stallId] : [],
          ts: Date.now(),
        }),
      );
    } catch {
      /* storage blocked */
    }
    onNavigate?.("eventAttendees");
    setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent("open-participant-event"));
      } catch {
        /* no-op */
      }
    }, 150);
  };
  // Country resolution priority:
  //   1. orgInfo.country from JWT (newest source after login)
  //   2. useCountry() context (set by OrganizerDashboard from /organizers/profile)
  //   3. fallback to "US"
  const { country: ctxCountry } = useCountry();
  const effectiveCountry = (
    orgInfo?.country ||
    ctxCountry ||
    "US"
  ).toUpperCase();
  const currency = COUNTRY_CURRENCY[effectiveCountry] || COUNTRY_CURRENCY.US;

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Speech recognition setup
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
  }, []);

  // Read org info — first from JWT, then refresh from API for the latest
  // organizationName (in case the token is old or the field was renamed).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const token = sessionStorage.getItem("token");
        if (!token) return;
        const decoded: any = jwtDecode(token);
        if (cancelled) return;
        // Seed from JWT immediately so the greeting shows something fast
        setOrgInfo({
          name: decoded.name || "there",
          organizationName: decoded.organizationName || "",
          country: decoded.country || "",
        });

        // Authoritative source: fetch the organizer profile and use the
        // organizationName from there (handles old tokens gracefully).
        if (decoded?.sub) {
          const res = await fetch(
            `${apiURL}/organizers/profile-get/${decoded.sub}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (res.ok) {
            const json = await res.json();
            const data = json?.data || json;
            if (!cancelled && data) {
              setOrgInfo({
                name: data.name || decoded.name || "there",
                organizationName:
                  data.organizationName || decoded.organizationName || "",
                country: data.country || decoded.country || "",
              });
            }
          }
        }
      } catch {}
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch analytics for the header strip
  const fetchAnalytics = useCallback(async () => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return;
      const decoded: any = jwtDecode(token);
      const id = decoded?.sub;
      if (!id) return;
      const [analyticsRes, pendingRes] = await Promise.all([
        fetch(`${apiURL}/organizers/analytics/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiURL}/organizers/dashboard-data`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ]);
      if (!analyticsRes.ok) return;
      const a = await analyticsRes.json();
      const pending =
        pendingRes && pendingRes.ok
          ? await pendingRes.json().catch(() => null)
          : null;
      // Prefer backend-formatted revenue (uses organizer's country/locale).
      // Fall back to local formatter if older API response.
      const revenueDisplay =
        a.totals?.revenueFormatted ||
        formatMoney(Number(a.totals?.revenue || 0), currency);
      const cards: AnalyticsCard[] = [
        {
          label: "Total Revenue",
          value: revenueDisplay,
          icon: TrendingUp,
          tint: "from-emerald-50 to-emerald-100/60",
          textTint: "text-emerald-700",
        },
        {
          label: "Tickets",
          value: a.totals?.tickets || 0,
          icon: Ticket,
          tint: "from-blue-50 to-blue-100/60",
          textTint: "text-blue-700",
        },
        {
          label: "Events",
          value: a.totals?.events || 0,
          icon: Calendar,
          tint: "from-purple-50 to-purple-100/60",
          textTint: "text-purple-700",
        },
        {
          label: "Last 30d",
          value: (a.revenueTrend || []).reduce(
            (s: number, d: any) => s + (d.tickets || 0),
            0,
          ),
          icon: Users,
          tint: "from-amber-50 to-amber-100/60",
          textTint: "text-amber-700",
        },
      ];
      setAnalytics(cards);
    } catch {}
  }, []);

  useEffect(() => {
    if (open) fetchAnalytics();
    // Re-run when currency becomes available so revenue is formatted right.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currency.symbol]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setInput("");
      const userMsg: Message = {
        role: "user",
        content: trimmed,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      try {
        const token = sessionStorage.getItem("token");
        const res = await fetch(`${apiURL}/chatbot/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: trimmed }),
        });
        const data = await res.json();
        const botMsg: Message = {
          role: "assistant",
          content:
            data.text || "Sorry, I didn't catch that. Could you rephrase?",
          quickActions: data.quickActions,
          eventPicker: data.eventPicker,
          walkinForm: data.walkinForm,
          platformFeeForm: data.platformFeeForm,
          botAction: data.botAction,
          events: data.events,
          participants: data.participants,
          guide: data.guide,
          records: data.records,
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, botMsg]);
        // Auto-trigger UI driver actions after a short delay so the user can
        // read the bot's reply first.
        const ba = data.botAction as BotAction | undefined;
        // eslint-disable-next-line no-console
        console.log("[chatbot] botAction received:", ba, "onOpenEventForm?", !!onOpenEventForm);
        if (ba?.type === "navigate" && onNavigate) {
          setTimeout(() => onNavigate(ba.tab), 800);
        } else if (ba?.type === "openCreateEvent") {
          if (onOpenEventForm) {
            // Carry the chatbot-picked personal event type/category through so
            // the Create Event form opens pre-filled for that celebration.
            const preset =
              ba.eventType || ba.category
                ? { eventType: ba.eventType, category: ba.category }
                : undefined;
            setTimeout(() => {
              // eslint-disable-next-line no-console
              console.log("[chatbot] firing onOpenEventForm(create)", preset);
              onOpenEventForm("create", preset);
            }, 800);
          } else {
            // eslint-disable-next-line no-console
            console.warn("[chatbot] openCreateEvent received but onOpenEventForm prop is missing");
          }
        } else if (ba?.type === "openEditEvent") {
          if (onOpenEventForm) {
            setTimeout(() => {
              // eslint-disable-next-line no-console
              console.log("[chatbot] firing onOpenEventForm(edit)", ba);
              onOpenEventForm("edit", {
                eventId: ba.eventId,
                eventTitle: ba.eventTitle,
              });
            }, 800);
          } else {
            // eslint-disable-next-line no-console
            console.warn("[chatbot] openEditEvent received but onOpenEventForm prop is missing");
          }
        } else if (ba?.type === "openAddVisitor") {
          if (onOpenAddVisitor) {
            setTimeout(() => onOpenAddVisitor(), 800);
          }
        } else if (ba?.type === "openAddExhibitor") {
          if (onOpenAddExhibitor) {
            setTimeout(() => onOpenAddExhibitor(), 800);
          }
        } else if (ba?.type === "openOrganizerRegister") {
          if (onOpenOrganizerRegister) {
            setTimeout(() => onOpenOrganizerRegister(), 800);
          } else {
            // eslint-disable-next-line no-console
            console.warn(
              "[chatbot] openOrganizerRegister received but onOpenOrganizerRegister prop is missing",
            );
          }
        }
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Network error: ${err?.message || "couldn't reach the server"}`,
            ts: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [
      loading,
      onNavigate,
      onOpenEventForm,
      onOpenAddVisitor,
      onOpenAddExhibitor,
      onOpenOrganizerRegister,
    ],
  );

  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const performReset = useCallback(() => {
    setMessages([]);
    setInput("");
    try {
      const token = sessionStorage.getItem("token");
      if (token) {
        const decoded: any = jwtDecode(token);
        sessionStorage.removeItem(`chatbot:msgs:${decoded.sub}`);
      }
    } catch {
      /* ignore */
    }
    setResetDialogOpen(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (isListening) recognitionRef.current.stop();
    else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  const panelClasses = isPage
    ? "flex flex-col bg-gradient-to-b from-slate-50 to-white h-full w-full overflow-hidden"
    : "fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-50 flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden";
  const panelStyle = isPage
    ? undefined
    : {
        width: "min(400px, calc(100vw - 24px))",
        height: "min(640px, calc(100vh - 80px))",
      };

  return (
    <>
      {/* Floating bubble — when onNavigate is provided, route to the
          chatbot page instead of opening the floating panel. */}
      {!isPage && !open && (
        <button
          onClick={() => {
            if (onNavigate) onNavigate("chatbot");
            else setOpen(true);
          }}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
          title="Open EventSH AI"
        >
          <Bot className="h-7 w-7 text-white" />
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
        </button>
      )}

      {(open || isPage) && (
        <div className={panelClasses} style={panelStyle}>
          {/* HEADER */}
          <div
            className={
              isPage
                ? "border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0"
                : "bg-blue-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0"
            }
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  className={
                    isPage
                      ? "w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center shadow-md"
                      : "w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center"
                  }
                >
                  <Bot
                    className={
                      isPage
                        ? "h-5 w-5 sm:h-6 sm:w-6 text-white"
                        : "h-5 w-5 text-white"
                    }
                  />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div>
                <p
                  className={
                    isPage
                      ? "font-bold text-base sm:text-lg text-slate-900"
                      : "font-bold text-sm"
                  }
                >
                  EventSH AI
                </p>
                <p
                  className={
                    isPage
                      ? "text-[11px] sm:text-xs text-slate-500"
                      : "text-[10px] opacity-80"
                  }
                >
                  <span className="inline-block h-1.5 w-1.5 bg-emerald-400 rounded-full mr-1" />
                  Your smart event assistant · Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Individuals have no settings sidebar — surface "send from my
                  own email" here so they can configure a custom sender. */}
              {isIndividual && (
                <button
                  onClick={() => setEmailSettingsOpen(true)}
                  className={
                    isPage
                      ? "text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"
                      : "text-[11px] hover:bg-white/10 px-2 py-1 rounded flex items-center gap-1"
                  }
                  title="Send guest emails from your own address"
                >
                  <SettingsIcon className="h-3 w-3" />
                  Email
                </button>
              )}
              {analytics && (
                <button
                  onClick={() => setShowAnalytics((v) => !v)}
                  className={
                    isPage
                      ? "text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"
                      : "text-[11px] hover:bg-white/10 px-2 py-1 rounded flex items-center gap-1"
                  }
                  title={showAnalytics ? "Hide analytics" : "Show analytics"}
                >
                  {showAnalytics ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  Stats
                </button>
              )}
              {!isPage && (
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded hover:bg-white/10"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* PENDING-REQUESTS MARQUEE — quiet scrolling status bar showing how
              many exhibitor requests need attention (approval / payment /
              update / deletion). White background so it stays out of the way. */}
          {pendApproval.length +
            pendPayment.length +
            pendEdit.length +
            pendCancel.length >
            0 && (
            <div
              className="relative overflow-hidden border-b border-slate-200 bg-white px-2 py-2 flex-shrink-0"
              role="status"
              aria-label="Pending requests"
            >
              <div className="flex w-max animate-marquee whitespace-nowrap hover:[animation-play-state:paused]">
                <PendingMarqueeRow
                  pending={{
                    approval: pendApproval.length,
                    payment: pendPayment.length,
                    edit: pendEdit.length,
                    cancel: pendCancel.length,
                  }}
                />
                {/* second copy — required by the -50% keyframe so the loop
                    feels seamless instead of snapping back */}
                <PendingMarqueeRow
                  pending={{
                    approval: pendApproval.length,
                    payment: pendPayment.length,
                    edit: pendEdit.length,
                    cancel: pendCancel.length,
                  }}
                  ariaHidden
                />
              </div>
            </div>
          )}

          {/* ANALYTICS STRIP */}
          {analytics && showAnalytics && (
            <div
              className={
                isPage
                  ? "border-b border-slate-200 bg-white px-3 sm:px-4 lg:px-6 py-3 flex-shrink-0 w-full"
                  : "border-b border-slate-100 bg-white px-3 py-2 flex-shrink-0"
              }
            >
              <div
                className={
                  isPage
                    ? "grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full"
                    : "grid grid-cols-2 gap-1.5"
                }
              >
                {analytics.map((c) => (
                  <div
                    key={c.label}
                    className={`rounded-xl border border-slate-200 bg-gradient-to-br ${c.tint} ${
                      isPage ? "px-3 py-2.5" : "px-2.5 py-1.5"
                    } shadow-sm`}
                  >
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-[10px] uppercase tracking-wide font-semibold ${c.textTint}`}
                      >
                        {c.label}
                      </p>
                      <c.icon className={`h-3.5 w-3.5 ${c.textTint}`} />
                    </div>
                    <p
                      className={`font-bold ${c.textTint} ${
                        isPage ? "text-lg sm:text-xl mt-0.5" : "text-sm"
                      }`}
                    >
                      {c.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MESSAGES */}
          <div
            ref={scrollRef}
            className={
              isPage
                ? "flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4"
                : "flex-1 overflow-y-auto px-3 py-3 space-y-3"
            }
          >
            {messages.length === 0 && (
              <div
                className={
                  isPage
                    ? "min-h-full flex items-center justify-center px-2"
                    : "min-h-full flex items-center justify-center px-2"
                }
              >
                <div
                  className={
                    isPage
                      ? "max-w-[900px] w-full flex flex-col items-center text-center gap-3 sm:gap-4"
                      : "w-full flex flex-col items-center text-center gap-2"
                  }
                >
                  <div
                    className={
                      isPage
                        ? "relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center shadow-lg"
                        : "relative w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center shadow-lg"
                    }
                  >
                    <Bot
                      className={
                        isPage
                          ? "h-6 w-6 sm:h-7 sm:w-7 text-white"
                          : "h-5 w-5 text-white"
                      }
                    />
                    <span
                      className={
                        isPage
                          ? "absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-500 ring-2 ring-white"
                          : "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white"
                      }
                    />
                  </div>
                  <div>
                    <p
                      className={
                        isPage
                          ? "text-lg sm:text-xl font-semibold text-slate-900 tracking-tight"
                          : "text-base font-semibold text-slate-900 tracking-tight"
                      }
                    >
                      How can I help?
                    </p>
                    <div
                      className={
                        isPage
                          ? "text-xs sm:text-sm text-slate-500 mt-1"
                          : "text-xs text-slate-500 mt-1"
                      }
                    >
                      {renderMarkdown(
                        isIndividual
                          ? "Welcome to **EventSH**! I can help you **create an event**, **show your events & participants**, or **register as a full organizer**. What would you like to do?"
                          : greeting.replace(
                              /\{ORG\}/g,
                              orgInfo?.organizationName || "your organization",
                            ),
                      )}
                    </div>

                    {/* Action pills — pending exhibitor queues, colour-coded by
                        the action they need (Yellow=approval, Green=payment,
                        Blue=edit request, Red=cancel request). They flicker to
                        draw attention; clicking jumps straight to Participants,
                        opens the pending event and pulses that exhibitor. */}
                    {!isIndividual &&
                      (pendApproval.length > 0 ||
                        pendPayment.length > 0 ||
                        pendEdit.length > 0 ||
                        pendCancel.length > 0) && (
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                          {pendApproval.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openPending(pendApproval)}
                              className="animate-flicker inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 text-xs font-semibold hover:bg-amber-200 transition"
                              title="Open the event & approve/reject these exhibitors"
                            >
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              {pendApproval.length} Pending Approval
                              {pendApproval.length === 1 ? "" : "s"}
                            </button>
                          )}
                          {pendPayment.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openPending(pendPayment)}
                              className="animate-flicker inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 text-xs font-semibold hover:bg-emerald-200 transition"
                              title="Open the event & confirm these payments"
                            >
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              {pendPayment.length} Pending Payment
                              {pendPayment.length === 1 ? "" : "s"}
                            </button>
                          )}
                          {pendEdit.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openPending(pendEdit)}
                              className="animate-flicker inline-flex items-center gap-1.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 px-3 py-1 text-xs font-semibold hover:bg-blue-200 transition"
                              title="Open the event & review these edit requests"
                            >
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              {pendEdit.length} Edit Request
                              {pendEdit.length === 1 ? "" : "s"}
                            </button>
                          )}
                          {pendCancel.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openPending(pendCancel)}
                              className="animate-flicker inline-flex items-center gap-1.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 px-3 py-1 text-xs font-semibold hover:bg-rose-200 transition"
                              title="Open the event & review these cancellation requests"
                            >
                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                              {pendCancel.length} Cancel Request
                              {pendCancel.length === 1 ? "" : "s"}
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i}>
                <div
                  className={`flex items-start gap-2 ${
                    m.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`${
                      isPage ? "w-8 h-8" : "w-7 h-7"
                    } rounded-full flex items-center justify-center shrink-0 ${
                      m.role === "user"
                        ? "bg-slate-200 text-slate-600"
                        : "bg-gradient-to-br from-blue-500 to-sky-600"
                    }`}
                  >
                    {m.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <div
                    className={`${
                      m.role === "user"
                        ? "max-w-[85%] sm:max-w-[78%]"
                        : "max-w-[92%] sm:max-w-[88%] lg:max-w-[80%]"
                    } ${
                      isPage ? "px-4 py-3 text-[15px]" : "px-3 py-2 text-sm"
                    } leading-relaxed break-words ${
                      m.role === "user"
                        ? "bg-blue-600 text-white rounded-2xl rounded-br-sm"
                        : "bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm shadow-sm"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div>{renderMarkdown(m.content)}</div>
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                  </div>
                </div>
                {/* Pending records — tap one to open Participants on that
                    event with the exhibitor row highlighted. */}
                {m.role === "assistant" &&
                  m.records &&
                  m.records.length > 0 && (
                    <div className="ml-9 mt-2 space-y-1.5">
                      {m.records.map((rec, idx) => {
                        const palette: Record<
                          PendingRecord["category"],
                          { dot: string; label: string; border: string }
                        > = {
                          approval: {
                            dot: "bg-amber-500",
                            label: "Approval",
                            border: "border-l-amber-400",
                          },
                          payment: {
                            dot: "bg-emerald-500",
                            label: "Payment",
                            border: "border-l-emerald-400",
                          },
                          edit: {
                            dot: "bg-blue-500",
                            label: "Edit",
                            border: "border-l-blue-400",
                          },
                          cancel: {
                            dot: "bg-rose-500",
                            label: "Cancel",
                            border: "border-l-rose-400",
                          },
                        };
                        const p = palette[rec.category] || palette.approval;
                        return (
                          <button
                            key={`${rec.stallId}-${idx}`}
                            type="button"
                            onClick={() => openRecord(rec)}
                            title="Open this exhibitor in Participants"
                            className={`w-full text-left flex items-center gap-2 rounded-lg border border-slate-200 border-l-4 ${p.border} bg-white px-3 py-2 hover:bg-slate-50 transition`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${p.dot}`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-slate-800 truncate">
                                {rec.vendor || "Exhibitor"}
                              </span>
                              <span className="block text-xs text-slate-500 truncate">
                                {p.label} · {rec.event || "—"}
                                {rec.ref ? ` · #${rec.ref}` : ""}
                                {rec.amountFormatted
                                  ? ` · ${rec.amountFormatted}`
                                  : ""}
                                {rec.reason ? ` · ${rec.reason}` : ""}
                              </span>
                            </span>
                            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                {/* Quick actions inline */}
                {m.role === "assistant" &&
                  m.quickActions &&
                  m.quickActions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-9">
                      {m.quickActions.map((qa, idx) => (
                        <button
                          key={idx}
                          onClick={() => sendMessage(qa.action)}
                          disabled={loading}
                          className="text-xs px-3 py-1 rounded-full border border-blue-200 text-blue-700 bg-blue-50/60 hover:bg-blue-100 transition disabled:opacity-50 font-medium"
                        >
                          {qa.label}
                        </button>
                      ))}
                    </div>
                  )}
                {/* Organizer guide: download the whole thing or any topic */}
                {m.role === "assistant" && m.guide && (
                  <div className="ml-9 mt-2 space-y-2">
                    <button
                      onClick={() =>
                        window.open(
                          `${apiURL}${m.guide!.pdfBasePath}?slug=all`,
                          "_blank",
                        )
                      }
                      className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download complete guide (PDF)
                    </button>
                    <div className="grid grid-cols-1 gap-1.5">
                      {m.guide.topics.map((t) => (
                        <div
                          key={t.slug}
                          className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg p-2.5 bg-white"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                              <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span className="truncate">{t.title}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {t.summary}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              window.open(
                                `${apiURL}${m.guide!.pdfBasePath}?slug=${t.slug}`,
                                "_blank",
                              )
                            }
                            className="shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border border-indigo-200 text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 transition"
                          >
                            <Download className="h-3 w-3" />
                            PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Navigate hint */}
                {m.role === "assistant" && m.botAction?.type === "navigate" && (
                  <div className="ml-9 mt-1.5">
                    <button
                      onClick={() =>
                        onNavigate?.(
                          (m.botAction as { type: "navigate"; tab: string })
                            .tab,
                        )
                      }
                      className="text-xs px-3 py-1 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 transition font-medium inline-flex items-center gap-1"
                    >
                      <ChevronUp className="h-3 w-3 rotate-45" />
                      Open {(m.botAction as any).tab}
                    </button>
                  </div>
                )}
                {/* Open Create Event form pill */}
                {m.role === "assistant" &&
                  m.botAction?.type === "openCreateEvent" && (
                    <div className="ml-9 mt-1.5">
                      <button
                        onClick={() => onOpenEventForm?.("create")}
                        className="text-xs px-3 py-1 rounded-full border border-blue-200 text-blue-700 bg-blue-50/60 hover:bg-blue-100 transition font-medium inline-flex items-center gap-1"
                      >
                        <ChevronUp className="h-3 w-3 rotate-45" />
                        Open Create Event Form
                      </button>
                    </div>
                  )}
                {/* Open Edit Event form pill */}
                {m.role === "assistant" &&
                  m.botAction?.type === "openEditEvent" && (
                    <div className="ml-9 mt-1.5">
                      <button
                        onClick={() => {
                          const ba = m.botAction as {
                            type: "openEditEvent";
                            eventId: string;
                            eventTitle?: string;
                          };
                          onOpenEventForm?.("edit", {
                            eventId: ba.eventId,
                            eventTitle: ba.eventTitle,
                          });
                        }}
                        className="text-xs px-3 py-1 rounded-full border border-purple-200 text-purple-700 bg-purple-50/60 hover:bg-purple-100 transition font-medium inline-flex items-center gap-1"
                      >
                        <ChevronUp className="h-3 w-3 rotate-45" />
                        Edit "
                        {(m.botAction as { eventTitle?: string }).eventTitle ||
                          "event"}
                        "
                      </button>
                    </div>
                  )}
                {/* Open Add Visitor form pill */}
                {m.role === "assistant" &&
                  m.botAction?.type === "openAddVisitor" && (
                    <div className="ml-9 mt-1.5">
                      <button
                        onClick={() => onOpenAddVisitor?.()}
                        className="text-xs px-3 py-1 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 transition font-medium inline-flex items-center gap-1"
                      >
                        <ChevronUp className="h-3 w-3 rotate-45" />
                        Open Add Visitor Form
                      </button>
                    </div>
                  )}
                {/* Open Add Exhibitor form pill */}
                {m.role === "assistant" &&
                  m.botAction?.type === "openAddExhibitor" && (
                    <div className="ml-9 mt-1.5">
                      <button
                        onClick={() => onOpenAddExhibitor?.()}
                        className="text-xs px-3 py-1 rounded-full border border-orange-200 text-orange-700 bg-orange-50/60 hover:bg-orange-100 transition font-medium inline-flex items-center gap-1"
                      >
                        <ChevronUp className="h-3 w-3 rotate-45" />
                        Open Add Exhibitor Form
                      </button>
                    </div>
                  )}
                {/* Event picker dropdown form */}
                {m.role === "assistant" &&
                  m.eventPicker &&
                  m.eventPicker.events.length > 0 && (
                    <EventPickerForm
                      picker={m.eventPicker}
                      disabled={loading}
                      onSubmit={(title) =>
                        sendMessage(
                          m.eventPicker!.actionTemplate.replace("{title}", title),
                        )
                      }
                    />
                  )}
                {/* Walk-in booking inline form */}
                {m.role === "assistant" && m.walkinForm && (
                  <div className="ml-9">
                    <InlineWalkinForm
                      payload={m.walkinForm}
                      organizerId={(() => {
                        try {
                          const t = sessionStorage.getItem("token");
                          if (!t) return "";
                          const d: any = jwtDecode(t);
                          return d?.sub || "";
                        } catch {
                          return "";
                        }
                      })()}
                    />
                  </div>
                )}
                {/* Pay platform-fees inline form */}
                {m.role === "assistant" && m.platformFeeForm && (
                  <div className="ml-9">
                    <InlinePlatformFeeForm payload={m.platformFeeForm} />
                  </div>
                )}
                {/* Individual: event cards (My Events flow) */}
                {m.role === "assistant" && m.events && m.events.length > 0 && (
                  <div className="ml-9 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {m.events.map((ev) => (
                      <div
                        key={ev.id}
                        className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="font-semibold text-sm text-slate-900 truncate">
                            {ev.title}
                          </div>
                          {ev.status && (
                            <span
                              className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-medium ${
                                ev.status === "published"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {ev.status}
                            </span>
                          )}
                        </div>
                        {ev.date && (
                          <div className="text-xs text-slate-500 flex items-center gap-1 mb-2">
                            <Calendar className="h-3 w-3" />
                            {new Date(ev.date).toLocaleDateString()}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700">
                          <div className="flex items-center gap-1">
                            {ev.isRsvp ? (
                              <Users className="h-3 w-3 text-rose-500" />
                            ) : (
                              <Ticket className="h-3 w-3 text-blue-500" />
                            )}
                            <span className="font-medium">
                              {ev.ticketCount ?? 0}
                            </span>
                            <span className="text-slate-400">
                              {ev.isRsvp ? "RSVPs" : "sold"}
                            </span>
                          </div>
                          {(ev.ticketTypeCount ?? 0) > 0 && (
                            <div
                              className="flex items-center gap-1"
                              title={ev.ticketTypeNames?.join(", ")}
                            >
                              <Crown className="h-3 w-3 text-amber-500" />
                              <span className="font-medium">
                                {ev.ticketTypeCount}
                              </span>
                              <span className="text-slate-400">
                                {ev.ticketTypeCount === 1
                                  ? "ticket type"
                                  : "ticket types"}
                              </span>
                            </div>
                          )}
                          {typeof ev.minPrice === "number" &&
                            typeof ev.maxPrice === "number" && (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400">
                                  {ev.minPrice === ev.maxPrice
                                    ? ev.minPrice === 0
                                      ? "Free"
                                      : `${ev.currency || "$"}${ev.minPrice.toLocaleString()}`
                                    : `${ev.currency || "$"}${ev.minPrice}–${ev.maxPrice}`}
                                </span>
                              </div>
                            )}
                          {(ev.capacityTotal ?? 0) > 0 && (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-violet-500" />
                              <span className="font-medium">
                                {ev.capacityTotal}
                              </span>
                              <span className="text-slate-400">capacity</span>
                            </div>
                          )}
                          {typeof ev.revenue === "number" && ev.revenue > 0 && (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-emerald-500" />
                              <span className="font-medium">
                                {(ev.currency || "$")}
                                {ev.revenue.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          <button
                            onClick={() =>
                              onOpenEventForm?.("edit", {
                                eventId: ev.id,
                                eventTitle: ev.title,
                              })
                            }
                            disabled={loading || !onOpenEventForm}
                            className="text-[11px] px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-100 text-emerald-700 bg-emerald-50 font-medium disabled:opacity-50 flex items-center gap-1"
                            title="Edit event"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          {/* Ticketed events keep the in-chat participants
                              view; RSVP (marriage) events use the richer Guest
                              List dialog below instead, so Participants is
                              hidden for them to avoid a redundant button. */}
                          {!ev.isRsvp && (
                            <button
                              onClick={() =>
                                sendMessage(
                                  `Show me participants for ${ev.title}`,
                                )
                              }
                              disabled={loading}
                              className="text-[11px] px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-50"
                            >
                              Participants
                            </button>
                          )}
                          {/* Marriage / RSVP events get a richer guest-list
                              dialog (headcount totals, contacts, messages,
                              attending/declined split, CSV export) that the
                              lightweight in-chat "Participants" list can't
                              show. Ticketed events are unaffected. */}
                          {ev.isRsvp && (
                            <button
                              onClick={() =>
                                setRsvpEvent({ id: ev.id, title: ev.title })
                              }
                              disabled={loading}
                              className="text-[11px] px-2 py-1 rounded border border-rose-200 hover:bg-rose-100 text-rose-700 bg-rose-50 font-medium disabled:opacity-50 flex items-center gap-1"
                              title="View RSVP guest list, total headcount and export"
                            >
                              <Users className="h-3 w-3" />
                              Guest List
                            </button>
                          )}
                          {ev.publicUrl && (
                            <>
                              <a
                                href={ev.publicUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] px-2 py-1 rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 font-medium flex items-center gap-1"
                                title="Open public event page"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Open
                              </a>
                              {ev.storeUrl && (
                                <a
                                  href={ev.storeUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] px-2 py-1 rounded border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 font-medium flex items-center gap-1"
                                  title="Open your storefront page"
                                >
                                  <Store className="h-3 w-3" />
                                  Store
                                </a>
                              )}
                              <button
                                onClick={async () => {
                                  // Absolute URL so the link works when
                                  // pasted into WhatsApp / email / etc.
                                  const url = `${window.location.origin}${ev.publicUrl}`;
                                  try {
                                    await navigator.clipboard.writeText(url);
                                    toast({
                                      title: "Link copied",
                                      description: url,
                                    });
                                  } catch {
                                    // Clipboard API blocked (insecure
                                    // context, etc.) — fall back to a
                                    // selectable prompt.
                                    window.prompt("Copy this link:", url);
                                  }
                                }}
                                disabled={loading}
                                className="text-[11px] px-2 py-1 rounded border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 font-medium disabled:opacity-50 flex items-center gap-1"
                                title="Copy shareable link"
                              >
                                <Copy className="h-3 w-3" />
                                Copy link
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Individual: participants list */}
                {m.role === "assistant" &&
                  m.participants &&
                  m.participants.length > 0 && (
                    <div className="ml-9 mt-2 border border-slate-200 rounded-lg bg-white shadow-sm divide-y divide-slate-100">
                      {m.participants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-slate-900 truncate">
                              {p.name}
                            </div>
                            {p.email && (
                              <div className="text-xs text-slate-500 truncate">
                                {p.email}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {p.ticketType && (
                              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                {p.ticketType}
                              </span>
                            )}
                            <span
                              className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium ${
                                (p.statusLabel ? p.statusOk : p.used)
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {p.statusLabel
                                ? p.statusLabel
                                : p.used
                                  ? "Checked in"
                                  : "Pending"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2">
                <div
                  className={`${
                    isPage ? "w-8 h-8" : "w-7 h-7"
                  } rounded-full bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center shrink-0`}
                >
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div
                  className={`bg-white border border-slate-200 rounded-2xl rounded-bl-sm shadow-sm ${
                    isPage ? "px-4 py-3" : "px-3 py-2"
                  }`}
                >
                  <div className="flex gap-1">
                    <span
                      className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: "120ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: "240ms" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* JUMP TO SECTION — mirrors the dashboard sidebar tabs */}
          {isPage && messages.length === 0 && navItems.length > 0 && (
            <div className="border-t border-slate-200 bg-white/60 px-4 sm:px-6 py-2 flex flex-nowrap items-center gap-1.5 flex-shrink-0 overflow-x-auto">
              {navItems.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onNavigate?.(n.id)}
                  className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1"
                  title={`Open ${n.label}`}
                >
                  <n.icon className="h-3 w-3" />
                  {n.label}
                </button>
              ))}
            </div>
          )}

          {/* INDIVIDUAL PILLS — Individuals have no sidebar (navItems is
              empty), so surface their 4 starter prompts as pills in the same
              slot. Keeps the chatbot from feeling empty under the greeting. */}
          {isPage &&
            messages.length === 0 &&
            isIndividual &&
            navItems.length === 0 && (
              <div className="border-t border-slate-200 bg-white/60 px-4 sm:px-6 py-2 flex flex-nowrap items-center gap-1.5 flex-shrink-0 overflow-x-auto">
                {[
                  { Icon: Plus, label: "Create an event", prompt: "I want to create an event" },
                  { Icon: Calendar, label: "My events", prompt: "Show my events" },
                  { Icon: Users, label: "Participants", prompt: "Show me the participants" },
                  { Icon: Building2, label: "Become an organizer", prompt: "I want to register as an organizer" },
                ].map((p) => (
                  <button
                    key={p.label}
                    onClick={() => sendMessage(p.prompt)}
                    disabled={loading}
                    className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1 disabled:opacity-50"
                    title={p.prompt}
                  >
                    <p.Icon className="h-3 w-3" />
                    {p.label}
                  </button>
                ))}
              </div>
            )}

          {/* PROMPT PANEL — toggled by the lightbulb button below */}
          {showPromptPanel && (
            <div className="border-t border-slate-200 bg-amber-50/40 px-3 sm:px-4 py-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-600 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3 text-amber-500" />
                  Try a prompt
                </p>
                <button
                  type="button"
                  onClick={() => setShowPromptPanel(false)}
                  className="text-[11px] text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {(isIndividual
                  ? ([
                      {
                        category: "Onboarding",
                        Icon: Plus,
                        tint: "text-emerald-600 bg-emerald-50",
                        title: "Create an event",
                        sub: "Open the event creation form",
                        prompt: "I want to create an event",
                      },
                      {
                        category: "My Events",
                        Icon: Calendar,
                        tint: "text-blue-600 bg-blue-50",
                        title: "My events",
                        sub: "See published events, tickets, revenue",
                        prompt: "Show my events",
                      },
                      {
                        category: "My Events",
                        Icon: Users,
                        tint: "text-violet-600 bg-violet-50",
                        title: "Participants",
                        sub: "Who's coming to your event",
                        prompt: "Show me the participants",
                      },
                      {
                        category: "Onboarding",
                        Icon: Building2,
                        tint: "text-amber-600 bg-amber-50",
                        title: "Become an organizer",
                        sub: "Upgrade to a full organizer account",
                        prompt: "I want to register as an organizer",
                      },
                    ] as SuggestionCard[])
                  : SUGGESTION_CARDS
                ).map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setShowPromptPanel(false);
                      sendMessage(s.prompt);
                    }}
                    disabled={loading}
                    className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 transition disabled:opacity-50 flex items-center gap-1.5"
                    title={s.prompt}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${s.tint} shrink-0`}
                    >
                      <s.Icon className="h-2.5 w-2.5" />
                    </span>
                    <span className="truncate max-w-[180px]">{s.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* INPUT BAR */}
          <form
            onSubmit={handleSubmit}
            className={
              isPage
                ? "p-3 sm:p-4 border-t border-slate-200 bg-white flex gap-2 items-center flex-shrink-0"
                : "p-2 border-t bg-white flex gap-2 items-center flex-shrink-0"
            }
          >
            <Button
              type="button"
              variant={showPromptPanel ? "default" : "outline"}
              size="icon"
              className={`${
                isPage
                  ? "h-11 w-11 sm:h-12 sm:w-12 rounded-xl"
                  : "h-10 w-10 rounded-full"
              } shrink-0 ${showPromptPanel ? "bg-amber-500 hover:bg-amber-600 text-white border-0" : ""}`}
              onClick={() => setShowPromptPanel((v) => !v)}
              title="Show suggested prompts"
            >
              <Lightbulb className="h-4 w-4" />
            </Button>
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isPage ? "Message EventSH AI…" : "Ask EventSH AI anything…"
                }
                disabled={loading}
                className={
                  isPage
                    ? "w-full h-11 sm:h-12 rounded-xl bg-white border-slate-300 focus-visible:ring-1 focus-visible:ring-blue-500 text-sm sm:text-base pr-10"
                    : "w-full h-10 rounded-full bg-slate-100 border-0 focus-visible:ring-1 focus-visible:ring-blue-500 text-sm pr-10"
                }
              />
              <button
                type="button"
                disabled={loading || messages.length === 0}
                onClick={() => setResetDialogOpen(true)}
                title="Reset chat"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-500 hover:text-red-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            {recognitionRef.current && (
              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                className={`${
                  isPage
                    ? "h-11 w-11 sm:h-12 sm:w-12 rounded-xl"
                    : "h-10 w-10 rounded-full"
                } shrink-0 ${isListening ? "animate-pulse" : ""}`}
                onClick={toggleVoice}
                disabled={loading}
                title={isListening ? "Stop" : "Voice input"}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || loading}
              className={`${
                isPage
                  ? "h-11 w-11 sm:h-12 sm:w-12 rounded-xl"
                  : "h-10 w-10 rounded-full"
              } bg-blue-600 hover:bg-blue-700 shrink-0`}
              title="Send"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      )}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              All messages in this chat will be removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={performReset}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Clear chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Marriage RSVP guest-list dialog — reuses the same EventRsvpPanel the
          organizer Participants tab uses, so Individuals (who have no sidebar)
          can still manage their wedding guest list, headcount and CSV export
          straight from the chatbot event card. */}
      <Dialog
        open={!!rsvpEvent}
        onOpenChange={(o) => !o && setRsvpEvent(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-base">
              {rsvpEvent?.title
                ? `Guest list — ${rsvpEvent.title}`
                : "Guest list"}
            </DialogTitle>
          </DialogHeader>
          {rsvpEvent && (
            <EventRsvpPanel
              eventId={rsvpEvent.id}
              eventTitle={rsvpEvent.title}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Individual custom sender email settings — the only place Individuals
          can reach this (they have no settings sidebar). */}
      <Dialog open={emailSettingsOpen} onOpenChange={setEmailSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Email settings</DialogTitle>
          </DialogHeader>
          <EmailSenderSettings />
        </DialogContent>
      </Dialog>
    </>
  );
}

function EventPickerForm({
  picker,
  disabled,
  onSubmit,
}: {
  picker: EventPicker;
  disabled: boolean;
  onSubmit: (title: string) => void;
}) {
  const [selected, setSelected] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  return (
    <div className="ml-9 mt-2 max-w-md rounded-xl border border-blue-200 bg-blue-50/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 mb-1.5">
        Choose event
      </p>
      <div className="flex gap-2">
        <select
          className="flex-1 text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={disabled || submitted}
        >
          <option value="">— Select an event —</option>
          {picker.events.map((ev) => (
            <option key={ev.id} value={ev.title}>
              {ev.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled || submitted || !selected}
          onClick={() => {
            if (!selected) return;
            setSubmitted(true);
            onSubmit(selected);
          }}
          className="text-xs px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
        >
          {submitted ? "…" : "Show"}
        </button>
      </div>
    </div>
  );
}

/**
 * One pass of the scrolling pending-requests banner. Shows how many exhibitor
 * requests need attention, colour-keyed to the greeting pills. Two copies are
 * rendered inside the marquee container so the -50% translateX loop is seamless.
 */
function PendingMarqueeRow({
  pending,
  ariaHidden,
}: {
  /** Live pending-request counts. */
  pending: { approval: number; payment: number; edit: number; cancel: number };
  ariaHidden?: boolean;
}) {
  const Item = ({
    icon,
    children,
    tint,
  }: {
    icon: React.ReactNode;
    children: React.ReactNode;
    tint?: string;
  }) => (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
        tint || "bg-blue-50 text-blue-700"
      }`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );

  return (
    <div
      className="flex items-center gap-3 pr-8 shrink-0"
      aria-hidden={ariaHidden}
    >
      <Item
        icon={<Clock className="h-3.5 w-3.5" />}
        tint="bg-slate-100 text-slate-600"
      >
        Pending requests
      </Item>
      {/* Counts — same colour key as the greeting pills:
          Yellow=approval, Green=payment, Blue=update/edit, Red=deletion. */}
      {pending.approval > 0 && (
        <Item
          icon={<span className="w-2 h-2 rounded-full bg-amber-500" />}
          tint="bg-amber-50 text-amber-700"
        >
          {pending.approval} pending approval
          {pending.approval === 1 ? "" : "s"}
        </Item>
      )}
      {pending.payment > 0 && (
        <Item
          icon={<span className="w-2 h-2 rounded-full bg-emerald-500" />}
          tint="bg-emerald-50 text-emerald-700"
        >
          {pending.payment} pending payment
          {pending.payment === 1 ? "" : "s"}
        </Item>
      )}
      {pending.edit > 0 && (
        <Item
          icon={<span className="w-2 h-2 rounded-full bg-blue-500" />}
          tint="bg-blue-50 text-blue-700"
        >
          {pending.edit} pending update
          {pending.edit === 1 ? "" : "s"}
        </Item>
      )}
      {pending.cancel > 0 && (
        <Item
          icon={<span className="w-2 h-2 rounded-full bg-rose-500" />}
          tint="bg-rose-50 text-rose-700"
        >
          {pending.cancel} pending deletion
          {pending.cancel === 1 ? "" : "s"}
        </Item>
      )}
      <span className="text-slate-300">•</span>
    </div>
  );
}
