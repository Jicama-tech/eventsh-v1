import { useEffect, useRef, useState, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import { useCountry } from "@/hooks/useCountry";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineWalkinForm } from "./InlineWalkinForm";
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
} from "lucide-react";

const apiURL = __API_URL__;

const COUNTRY_CURRENCY: Record<string, { symbol: string; locale: string }> = {
  IN: { symbol: "₹", locale: "en-IN" },
  SG: { symbol: "S$", locale: "en-SG" },
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
  | { type: "openCreateEvent" }
  | { type: "openEditEvent"; eventId: string; eventTitle?: string }
  | { type: "openAddVisitor" }
  | { type: "openAddExhibitor" };

interface Message {
  role: "user" | "assistant";
  content: string;
  quickActions?: QuickAction[];
  eventPicker?: EventPicker;
  walkinForm?: WalkinFormPayload;
  botAction?: BotAction;
  ts: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
}

interface ChatbotWidgetProps {
  onNavigate?: (tab: string) => void;
  /** Open the event editor in the dashboard. Mode "create" → blank form;
   *  mode "edit" → pre-filled with the given eventId. */
  onOpenEventForm?: (
    mode: "create" | "edit",
    payload?: { eventId: string; eventTitle?: string },
  ) => void;
  /** Open the Add Visitor (user) form in the Users tab. */
  onOpenAddVisitor?: () => void;
  /** Open the Add Exhibitor (shopkeeper) form in the Users tab. */
  onOpenAddExhibitor?: () => void;
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
  { id: "eventAttendees", label: "Participants", icon: Users },
  { id: "speakerRequests", label: "Speakers", icon: Mic2 },
  { id: "users", label: "Exhibitors/Visitors", icon: Building2 },
  { id: "storefront", label: "Eventfront", icon: Globe },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export function ChatbotWidget({
  onNavigate,
  onOpenEventForm,
  onOpenAddVisitor,
  onOpenAddExhibitor,
  greeting = "Hi! I am **EventSH AI** for **{ORG}**. Ask me about events, tickets, attendees, vendors, speakers — or just say hi.",
  mode = "floating",
  navItems = DEFAULT_NAV_ITEMS,
}: ChatbotWidgetProps) {
  const isPage = mode === "page";
  const [open, setOpen] = useState(isPage);
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
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showPromptPanel, setShowPromptPanel] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsCard[] | null>(null);
  const [orgInfo, setOrgInfo] = useState<{
    name: string;
    organizationName: string;
    country: string;
  } | null>(null);
  // Country resolution priority:
  //   1. orgInfo.country from JWT (newest source after login)
  //   2. useCountry() context (set by OrganizerDashboard from /organizers/profile)
  //   3. fallback to "US"
  const { country: ctxCountry } = useCountry();
  const { subscription } = useSubscription();
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
          botAction: data.botAction,
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
            setTimeout(() => {
              // eslint-disable-next-line no-console
              console.log("[chatbot] firing onOpenEventForm(create)");
              onOpenEventForm("create");
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
    [loading, onNavigate, onOpenEventForm, onOpenAddVisitor, onOpenAddExhibitor],
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

          {/* SUBSCRIPTION MARQUEE — quiet scrolling status bar. White
              background so it stays out of the way; blue text + faint pill
              fills so the info is legible without competing with chat. */}
          {subscription && subscription.subscribed && (
            <div
              className="relative overflow-hidden border-b border-slate-200 bg-white text-blue-700 px-2 py-2 flex-shrink-0"
              role="status"
              aria-label={`Subscription: ${subscription.planName}, ${
                subscription.fullyLapsed
                  ? "expired"
                  : `${subscription.daysLeft} days left`
              }`}
            >
              <div className="flex w-max animate-marquee whitespace-nowrap hover:[animation-play-state:paused]">
                <SubscriptionMarqueeRow
                  subscription={subscription}
                  country={ctxCountry}
                />
                {/* second copy — required by the -50% keyframe so the loop
                    feels seamless instead of snapping back */}
                <SubscriptionMarqueeRow
                  subscription={subscription}
                  country={ctxCountry}
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
                        greeting.replace(
                          /\{ORG\}/g,
                          orgInfo?.organizationName || "your organization",
                        ),
                      )}
                    </div>
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
                {SUGGESTION_CARDS.map((s, i) => (
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
 * One pass of the scrolling subscription banner. We render two copies inside
 * the marquee container so the -50% translateX loop feels seamless.
 */
function SubscriptionMarqueeRow({
  subscription,
  country,
  ariaHidden,
}: {
  subscription: {
    planName: string | null;
    pricePaid: string | null;
    planExpiryDate: string | null;
    daysLeft: number;
    fullyLapsed: boolean;
    inGracePeriod: boolean;
    graceDaysLeft: number;
  };
  country?: string;
  ariaHidden?: boolean;
}) {
  const symbol = country === "IN" ? "₹" : country === "SG" ? "S$" : "$";
  const validTill = subscription.planExpiryDate
    ? new Date(subscription.planExpiryDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  // Status pill — color + label vary with the lifecycle stage so a renewal
  // nudge is loud when the plan is expiring.
  let statusIcon = <Clock className="h-3.5 w-3.5" />;
  let statusLabel = `${subscription.daysLeft} day${
    subscription.daysLeft === 1 ? "" : "s"
  } left`;
  let statusTint = "bg-blue-50 text-blue-700";
  if (subscription.fullyLapsed) {
    statusIcon = <AlertTriangle className="h-3.5 w-3.5" />;
    statusLabel = "Plan expired — renew now";
    statusTint = "bg-rose-50 text-rose-700";
  } else if (subscription.inGracePeriod) {
    statusIcon = <AlertTriangle className="h-3.5 w-3.5" />;
    statusLabel = `Grace period — ${subscription.graceDaysLeft} day${
      subscription.graceDaysLeft === 1 ? "" : "s"
    } to renew`;
    statusTint = "bg-amber-50 text-amber-700";
  } else if (subscription.daysLeft <= 7) {
    statusTint = "bg-amber-50 text-amber-700";
  }

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
      <Item icon={<Crown className="h-3.5 w-3.5" />}>
        {subscription.planName || "—"}
      </Item>
      {subscription.pricePaid ? (
        <Item icon={<Zap className="h-3.5 w-3.5" />}>
          {symbol}
          {subscription.pricePaid} paid
        </Item>
      ) : null}
      <Item icon={statusIcon} tint={statusTint}>
        {statusLabel}
      </Item>
      <Item icon={<CalendarCheck className="h-3.5 w-3.5" />}>
        Valid till {validTill}
      </Item>
      <span className="text-slate-300">•</span>
    </div>
  );
}
