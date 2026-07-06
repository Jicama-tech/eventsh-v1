import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import OpenAI from "openai";
import { buildDefaultStorefrontSettings } from "../organizer-stores/default-settings";

// Personal event sub-types offered to Individual accounts in the chatbot
// "create event" picker. Mirrors EVENT_TYPE_GROUPS.personal in
// frontend/src/lib/eventTypes.ts — keep the two lists in sync. The `keywords`
// let a user pick by typing naturally ("plan a wedding") as well as by tapping
// a pill ("Create a Marriage Function event").
const PERSONAL_EVENT_TYPES: Array<{ category: string; keywords: string[] }> = [
  { category: "Birthday Party", keywords: ["birthday", "bday"] },
  {
    category: "Housewarming Party",
    keywords: ["housewarming", "house warming", "griha pravesh"],
  },
  {
    category: "Marriage Function",
    keywords: ["marriage", "wedding", "shaadi", "nikah", "vivah"],
  },
  { category: "Engagement Ceremony", keywords: ["engagement", "roka"] },
  { category: "Anniversary", keywords: ["anniversary"] },
  { category: "Baby Shower", keywords: ["baby shower", "godh bharai"] },
  { category: "Reunion", keywords: ["reunion"] },
  { category: "Farewell Party", keywords: ["farewell", "send off", "send-off"] },
];

type ConvEntry = {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
  ts: number;
};

type Tab =
  | "dashboard"
  | "events"
  | "tickets"
  | "attendees"
  | "stalls"
  | "speakers"
  | "storefront"
  | "settings"
  | "platformFees"
  | "feedback"
  | "general";

/**
 * Operator access tabs — must mirror OPERATOR_TABS in
 * backend/src/modules/operators/entities/operator.entity.ts. Keep in sync
 * when adding/removing tabs in either place.
 */
type OperatorTab =
  | "chatbot"
  | "dashboard"
  | "kiosk"
  | "eventAttendees"
  | "users"
  | "events"
  | "storefront"
  | "settings";

/**
 * Each chatbot tab is gated by exactly one operator tab. `general` is the
 * fallback / catch-all tab and stays universally available — but the
 * individual tools the LLM can invoke within `general` are filtered
 * separately via TOOL_GUARDED_BY, so this isn't a leak.
 */
const CHATBOT_TAB_GUARDED_BY: Record<Tab, OperatorTab | null> = {
  dashboard: "dashboard",
  events: "events",
  tickets: "events",
  attendees: "eventAttendees",
  stalls: "events",
  speakers: "events",
  storefront: "storefront",
  settings: "settings",
  platformFees: "settings",
  feedback: "settings",
  general: null,
};

/**
 * Each named tool (per OpenAI function definition) is gated by exactly one
 * operator tab. When an operator's session has a restricted accessTabs list,
 * tools whose required tab is not in that list are stripped from the LLM's
 * toolbox before the request is sent — the model can't invoke what it
 * doesn't see, and the response can't leak data the operator shouldn't read.
 * Tools missing from this map are treated as universally allowed.
 */
const TOOL_GUARDED_BY: Record<string, OperatorTab> = {
  // Dashboard / analytics
  get_dashboard_stats: "dashboard",
  get_revenue_trend: "dashboard",
  get_top_events: "dashboard",
  get_pending_approvals: "dashboard",
  get_events_breakdown: "dashboard",
  get_stalls_analytics: "dashboard",
  get_speakers_analytics: "dashboard",
  get_round_tables_analytics: "dashboard",
  get_event_full_analytics: "dashboard",
  get_ticket_type_breakdown: "dashboard",
  get_attendance_analytics: "dashboard",
  get_event_participants: "dashboard",
  // Events
  list_events: "events",
  get_event_detail: "events",
  create_event: "events",
  create_full_event: "events",
  request_edit_event: "events",
  add_ticket_type: "events",
  add_round_tables: "events",
  add_stalls: "events",
  add_speakers: "events",
  set_venue_config: "events",
  publish_event: "events",
  list_space_templates: "events",
  list_stalls: "events",
  list_speakers: "events",
  // Attendees / tickets
  list_tickets: "eventAttendees",
  get_ticket_detail: "eventAttendees",
  mark_ticket_used: "eventAttendees",
  list_attendees: "eventAttendees",
  search_attendee: "eventAttendees",
  list_visitors: "users",
  list_exhibitors: "users",
  // Settings / billing
  get_subscription: "settings",
  list_plans: "settings",
  list_operators: "settings",
  get_organizer_info: "settings",
  get_organization_settings: "settings",
  // Storefront
  // (no dedicated tools today; navigate_to handles it)
  // Universal — navigation is allowed everywhere; the destination tab
  // is enforced by the frontend route guard.
  // navigate_to: intentionally absent from this map → unrestricted
};

/** Friendly module names shown to operators in refusal messages. */
const FRIENDLY_TAB_NAME: Record<OperatorTab, string> = {
  chatbot: "Chatbot",
  dashboard: "Dashboard",
  kiosk: "Kiosk",
  eventAttendees: "Event Attendees",
  users: "Users",
  events: "Events",
  storefront: "Storefront",
  settings: "Settings",
};

/**
 * Per-tab quick-action pills attached to each chatbot reply. The pill text
 * is sent as a follow-up message when clicked, so labels and `action`
 * strings should read naturally as user prompts. Each pill carries the
 * operator tab that gates it — pills whose tab the operator doesn't have
 * are filtered out entirely (hidden, not refused).
 */
type QuickActionSpec = {
  label: string;
  action: string;
  requires: OperatorTab | null;
};
const QUICK_ACTIONS_BY_TAB: Record<Tab, QuickActionSpec[]> = {
  dashboard: [
    { label: "Top events", action: "Show me my top events", requires: "dashboard" },
    { label: "Revenue this month", action: "What's my revenue this month?", requires: "dashboard" },
    { label: "Pending approvals", action: "Any pending approvals?", requires: "dashboard" },
  ],
  events: [
    { label: "Create event", action: "Create a new event", requires: "events" },
    { label: "List my events", action: "List all my events", requires: "events" },
    { label: "Upcoming events", action: "Show my upcoming events", requires: "events" },
  ],
  tickets: [
    { label: "List tickets", action: "List tickets for my latest event", requires: "events" },
    { label: "Mark ticket used", action: "I want to mark a ticket as used", requires: "eventAttendees" },
  ],
  attendees: [
    { label: "List attendees", action: "Show me all attendees", requires: "eventAttendees" },
    { label: "Find attendee", action: "Find an attendee by name", requires: "eventAttendees" },
    { label: "Visitors", action: "List my visitors", requires: "users" },
    { label: "Exhibitors", action: "List my exhibitors", requires: "users" },
  ],
  stalls: [
    { label: "Stall analytics", action: "Show stall analytics", requires: "events" },
    { label: "List exhibitors", action: "List my exhibitors", requires: "users" },
  ],
  speakers: [
    { label: "List speakers", action: "List my speakers", requires: "events" },
    { label: "Speaker analytics", action: "Show speaker analytics", requires: "events" },
  ],
  storefront: [
    { label: "Open storefront", action: "Take me to storefront customization", requires: "storefront" },
  ],
  settings: [
    { label: "My subscription", action: "Show my subscription", requires: "settings" },
    { label: "Operators", action: "List my operators", requires: "settings" },
    { label: "My profile", action: "Show my organization profile", requires: "settings" },
  ],
  platformFees: [
    { label: "What do I owe?", action: "How much do I owe in platform fees?", requires: "settings" },
    { label: "Open platform fees", action: "Take me to platform fees", requires: "settings" },
  ],
  feedback: [
    { label: "Open feedback", action: "Take me to feedback", requires: "settings" },
  ],
  general: [
    { label: "My events", action: "List my events", requires: "events" },
    { label: "Dashboard summary", action: "Give me a dashboard summary", requires: "dashboard" },
    { label: "Help", action: "What can you help me with?", requires: null },
  ],
};

// Country → currency lookup. Add new countries here as eventsh expands.
const COUNTRY_CURRENCY: Record<
  string,
  { symbol: string; code: string; locale: string }
> = {
  IN: { symbol: "₹", code: "INR", locale: "en-IN" },
  SG: { symbol: "SG$", code: "SGD", locale: "en-SG" },
  US: { symbol: "$", code: "USD", locale: "en-US" },
  GB: { symbol: "£", code: "GBP", locale: "en-GB" },
  AE: { symbol: "AED ", code: "AED", locale: "en-AE" },
  AU: { symbol: "A$", code: "AUD", locale: "en-AU" },
  EU: { symbol: "€", code: "EUR", locale: "en-IE" },
};
function currencyFor(country?: string) {
  const key = (country || "").toUpperCase();
  return COUNTRY_CURRENCY[key] || { symbol: "$", code: "USD", locale: "en-US" };
}
function formatMoney(
  amount: number,
  curr: { symbol: string; locale: string },
) {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat(curr.locale, {
    maximumFractionDigits: 0,
  }).format(safe);
  return `${curr.symbol}${formatted}`;
}

// Auto-grid placement for round tables — fills the venue left-to-right,
// top-to-bottom, respecting tableDiameter spacing.
function autoPlaceRoundTables(
  count: number,
  templateId: string,
  template: any,
  venueConfig: any,
  startIndex = 0,
): any[] {
  const diameter = template.tableDiameter || 120;
  const margin = 30;
  const spacing = diameter + 20;
  const cols = Math.max(
    1,
    Math.floor((venueConfig.width - margin * 2) / spacing),
  );
  const out: any[] = [];
  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    out.push({
      positionId: `pos_${Date.now()}_${idx}`,
      templateId,
      name: template.name,
      numberOfChairs: template.numberOfChairs,
      sellingMode: template.sellingMode,
      tablePrice: template.tablePrice,
      chairPrice: template.chairPrice,
      category: template.category,
      color: template.color,
      tableDiameter: diameter,
      x: margin + col * spacing + diameter / 2,
      y: margin + row * spacing + diameter / 2,
      rotation: 0,
      isPlaced: true,
      venueConfigId: venueConfig.venueConfigId,
      bookedChairs: [],
      isFullyBooked: false,
    });
  }
  return out;
}

// Auto-grid placement for stalls (rectangles).
function autoPlaceStalls(
  count: number,
  templateId: string,
  template: any,
  venueConfig: any,
  startIndex = 0,
): any[] {
  const w = template.width || 80;
  const h = template.height || 60;
  const margin = 30;
  const gap = 20;
  const cols = Math.max(
    1,
    Math.floor((venueConfig.width - margin * 2) / (w + gap)),
  );
  const out: any[] = [];
  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    out.push({
      positionId: `pos_${Date.now()}_${idx}`,
      templateId,
      name: `${template.name} ${idx + 1}`,
      type: template.type,
      width: w,
      height: h,
      rowNumber: row + 1,
      tablePrice: template.tablePrice,
      bookingPrice: template.bookingPrice,
      depositPrice: template.depositPrice,
      color: template.color,
      forSale: template.forSale,
      isBooked: false,
      x: margin + col * (w + gap),
      y: margin + row * (h + gap),
      rotation: 0,
      venueConfigId: venueConfig.venueConfigId,
    });
  }
  return out;
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private ai: OpenAI;
  private provider: "qwen" | "groq" = "groq";

  // In-memory rolling history per organizer (max 12 messages, 30 min TTL).
  private history = new Map<string, ConvEntry[]>();
  private readonly HISTORY_LIMIT = 12;
  private readonly HISTORY_TTL_MS = 30 * 60 * 1000;

  constructor(
    @InjectModel("Organizer") private organizerModel: Model<any>,
    @InjectModel("Event") private eventModel: Model<any>,
    @InjectModel("Ticket") private ticketModel: Model<any>,
    @InjectModel("Plan") private planModel: Model<any>,
    @InjectModel("Operator") private operatorModel: Model<any>,
    @InjectModel("Vendor") private vendorModel: Model<any>,
    @InjectModel("Stall") private stallModel: Model<any>,
    @InjectModel("SpeakerRequest") private speakerRequestModel: Model<any>,
    @InjectModel("RoundTableBooking")
    private roundTableBookingModel: Model<any>,
    @InjectModel("Template") private templateModel: Model<any>,
    @InjectModel("User") private userModel: Model<any>,
    @InjectModel("Rsvp") private rsvpModel: Model<any>,
    @InjectModel("OrganizerStore") private organizerStoreModel: Model<any>,
  ) {
    const useQwen = !!process.env.QWEN_API_KEY;
    const apiKey = useQwen
      ? process.env.QWEN_API_KEY
      : process.env.GROQ_API_KEY || "";
    const baseURL = useQwen
      ? process.env.QWEN_BASE_URL ||
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
      : process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
    this.ai = new OpenAI({ apiKey, baseURL });
    this.provider = useQwen ? "qwen" : "groq";
    this.logger.log(`Chatbot AI provider: ${this.provider}`);
  }

  get activeProvider() {
    return this.provider;
  }

  private get model() {
    return this.provider === "qwen"
      ? process.env.QWEN_MODEL || "qwen-plus"
      : process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  }
  private get routerModel() {
    return this.provider === "qwen"
      ? process.env.QWEN_ROUTER_MODEL || "qwen-turbo"
      : process.env.GROQ_ROUTER_MODEL || "llama-3.1-8b-instant";
  }
  private get fallbackModel() {
    return this.provider === "qwen"
      ? "qwen-turbo"
      : "llama-3.1-8b-instant";
  }
  private isRateLimit(err: any) {
    const s = err?.status || err?.response?.status;
    return s === 429 || /rate limit|TPD/i.test(err?.message || "");
  }
  private hasApiKey() {
    return !!(process.env.QWEN_API_KEY || process.env.GROQ_API_KEY);
  }

  // ============================================================
  // TOOL DEFINITIONS (~20 tools)
  // ============================================================
  private tools: OpenAI.ChatCompletionTool[] = [
    // Dashboard
    {
      type: "function",
      function: {
        name: "get_dashboard_stats",
        description:
          "Get this organizer's overall stats: total events, tickets sold, total revenue, active subscriptions",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "get_revenue_trend",
        description: "Get revenue and ticket count for a period",
        parameters: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["today", "week", "month", "quarter", "year"],
            },
          },
          required: ["period"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_top_events",
        description: "Get top events by ticket revenue (top 5)",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },

    // Events
    {
      type: "function",
      function: {
        name: "list_events",
        description:
          "List the organizer's events. Use status='all' for 'list all events', 'every event', 'how many events'; status='upcoming' ONLY when the user explicitly says 'upcoming'/'future'; status='past' for 'past'/'previous'/'completed'. When in doubt, use 'all'.",
        parameters: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["upcoming", "past", "all"],
              description:
                "Default 'all'. Use 'upcoming' ONLY for explicit upcoming/future requests.",
            },
            limit: { type: "number", description: "Defaults to 100" },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_event_detail",
        description: "Get details of one event by title or id",
        parameters: {
          type: "object",
          properties: {
            event_name: { type: "string", description: "Title or partial title" },
          },
          required: ["event_name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "request_edit_event",
        description:
          "Open the Edit Event form pre-filled with the matching event's data. CALL THIS whenever the user says 'edit event X', 'update event X', 'change event X', 'modify event X'. " +
          "**MUST be called every single time the user makes such a request, even if you have already called this tool for the same event earlier in the conversation.** Each call re-opens the form fresh; never reply 'already opened' — always call the tool again. " +
          "Pass the event title (partial match OK).",
        parameters: {
          type: "object",
          properties: {
            event_name: {
              type: "string",
              description: "Title or partial title of the event to edit",
            },
          },
          required: ["event_name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_event",
        description:
          "Open the BLANK Create Event form in the Events tab. CALL THIS IMMEDIATELY whenever the user says anything like 'create event', 'create a new event', 'new event', 'add event', 'make an event'. " +
          "**MUST be called every single time the user makes such a request, even if you have already called this tool earlier in the same conversation.** Each call opens a fresh form for the user — there is no memory between calls and there is no harm in calling it repeatedly. " +
          "NEVER reply with text like 'I already opened the form' or 'Did you want to add something to it?'. ALWAYS call the tool. " +
          "NEVER ask for title/date/venue first — the form collects everything. Takes NO required arguments.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_full_event",
        description:
          "Same as create_event — opens the blank Create Event form. Call this for richer one-shot phrasings like 'create a tech meetup on May 15 with 200 attendees and 10 round tables'. Do NOT try to parse fields yourself; the form collects everything. Takes NO required arguments.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            startDate: { type: "string" },
            endDate: { type: "string" },
            time: { type: "string", description: "HH:MM 24h" },
            endTime: { type: "string", description: "HH:MM 24h" },
            location: { type: "string", description: "Venue name" },
            address: { type: "string" },
            visibility: {
              type: "string",
              enum: ["public", "private", "unlisted"],
            },
            ticketPrice: { type: "string" },
            totalTickets: { type: "number" },
            tags: { type: "array", items: { type: "string" } },
            ageRestriction: { type: "string" },
            dresscode: { type: "string" },
            specialInstructions: { type: "string" },
            refundPolicy: { type: "string" },
            termsAndConditions: { type: "string" },
            features: {
              type: "object",
              description:
                "Toggles like {food:true, parking:false, wifi:true, photography:true, security:true, accessibility:false}",
            },
            ticketTypes: {
              type: "array",
              description: "Visitor ticket tiers",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  price: { type: "number" },
                  maxCount: { type: "number" },
                  description: { type: "string" },
                },
                required: ["name", "price"],
              },
            },
            roundTables: {
              type: "object",
              description:
                "Round table config — bot creates a template AND auto-places `count` instances on a grid",
              properties: {
                count: { type: "number" },
                chairsPerTable: { type: "number" },
                pricePerChair: { type: "number" },
                pricePerTable: { type: "number" },
                sellingMode: {
                  type: "string",
                  enum: ["table", "chair"],
                },
                color: { type: "string" },
              },
            },
            stalls: {
              type: "object",
              description:
                "Stall/booth config — creates a template AND auto-places `count` instances",
              properties: {
                count: { type: "number" },
                width: { type: "number", description: "px (default 80)" },
                height: { type: "number" },
                bookingPrice: { type: "number" },
                depositPrice: { type: "number" },
              },
            },
            speakers: {
              type: "array",
              description: "Speakers (without images — UI required for those)",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  organization: { type: "string" },
                  title: { type: "string" },
                  bio: { type: "string" },
                  isKeynote: { type: "boolean" },
                },
                required: ["name"],
              },
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_ticket_type",
        description: "Add a ticket tier to an existing event by event title",
        parameters: {
          type: "object",
          properties: {
            event_name: { type: "string" },
            name: { type: "string" },
            price: { type: "number" },
            maxCount: { type: "number" },
            description: { type: "string" },
          },
          required: ["event_name", "name", "price"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_round_tables",
        description:
          "Add round tables to an existing event. Creates a template + auto-places `count` instances on a grid layout.",
        parameters: {
          type: "object",
          properties: {
            event_name: { type: "string" },
            count: { type: "number" },
            chairsPerTable: { type: "number" },
            pricePerChair: { type: "number" },
            pricePerTable: { type: "number" },
            sellingMode: { type: "string", enum: ["table", "chair"] },
            color: { type: "string" },
            templateName: { type: "string" },
          },
          required: ["event_name", "count", "chairsPerTable"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_stalls",
        description:
          "Add stalls/booths to an existing event. Creates a template + auto-places `count` instances on a grid.",
        parameters: {
          type: "object",
          properties: {
            event_name: { type: "string" },
            count: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            bookingPrice: { type: "number" },
            depositPrice: { type: "number" },
            templateName: { type: "string" },
          },
          required: ["event_name", "count", "bookingPrice"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_speakers",
        description: "Add speakers to an existing event (without photos)",
        parameters: {
          type: "object",
          properties: {
            event_name: { type: "string" },
            speakers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  organization: { type: "string" },
                  title: { type: "string" },
                  bio: { type: "string" },
                  isKeynote: { type: "boolean" },
                },
                required: ["name"],
              },
            },
          },
          required: ["event_name", "speakers"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "set_venue_config",
        description:
          "Set the venue dimensions / grid for an existing event. Round tables and stalls re-auto-place after this.",
        parameters: {
          type: "object",
          properties: {
            event_name: { type: "string" },
            width: { type: "number" },
            height: { type: "number" },
            gridSize: { type: "number" },
            hasMainStage: { type: "boolean" },
          },
          required: ["event_name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "publish_event",
        description: "Mark an event as published (organizer-visible to public).",
        parameters: {
          type: "object",
          properties: { event_name: { type: "string" } },
          required: ["event_name"],
        },
      },
    },

    // Tickets
    {
      type: "function",
      function: {
        name: "list_tickets",
        description:
          "List tickets for an event by event title (or recent tickets if none given)",
        parameters: {
          type: "object",
          properties: {
            event_name: { type: "string" },
            status: { type: "string", enum: ["pending", "confirmed", "all"] },
            limit: { type: "number" },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_ticket_detail",
        description: "Get one ticket by its ticketId",
        parameters: {
          type: "object",
          properties: { ticketId: { type: "string" } },
          required: ["ticketId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "mark_ticket_used",
        description:
          "Mark a ticket as used / attendance recorded by ticketId",
        parameters: {
          type: "object",
          properties: { ticketId: { type: "string" } },
          required: ["ticketId"],
        },
      },
    },

    // Attendees
    {
      type: "function",
      function: {
        name: "list_attendees",
        description: "List attendees for an event by event title",
        parameters: {
          type: "object",
          properties: {
            event_name: { type: "string" },
            limit: { type: "number" },
          },
          required: ["event_name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_attendee",
        description: "Search attendees across all events by name or email",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
    },

    // Stalls / Vendors
    {
      type: "function",
      function: {
        name: "list_stalls",
        description:
          "List stall registrations for the organizer. Optionally filter by event title (event_name) — returns per-event stall bookings with vendor + payment info.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["pending", "approved", "all"] },
            event_name: {
              type: "string",
              description: "Event title (or partial title) to filter stalls by event",
            },
            limit: { type: "number" },
          },
          required: [],
        },
      },
    },

    // Speakers
    {
      type: "function",
      function: {
        name: "list_speakers",
        description:
          "List speaker requests for the organizer. Optionally filter by event title or status",
        parameters: {
          type: "object",
          properties: {
            event_name: { type: "string" },
            status: { type: "string" },
          },
          required: [],
        },
      },
    },

    // Subscription / settings
    {
      type: "function",
      function: {
        name: "get_subscription",
        description:
          "Get the organizer's current subscription plan + module access summary",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "list_plans",
        description: "List all active organizer plans with price and validity",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "list_operators",
        description: "List operators created under this organizer",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "get_organizer_info",
        description:
          "Get this organizer's profile details (name, organization, email, country, settings)",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },

    // Pending approvals (handy meta tool)
    {
      type: "function",
      function: {
        name: "get_pending_approvals",
        description:
          "Get count of pending speaker requests + pending stall registrations the organizer needs to review",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },

    // Deep analytics — full breakdowns per area
    {
      type: "function",
      function: {
        name: "get_events_breakdown",
        description:
          "Comprehensive analytics across the organizer's events: counts by status / visibility / category, total capacity vs sold, average ticket price, occupancy rate. Use for 'detailed events analytics', 'event breakdown', 'how are my events performing'.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "get_stalls_analytics",
        description:
          "Comprehensive stall-booking analytics for the organizer: total bookings, by booking status (Pending/Approved/Rejected), by payment status (Unpaid/Partial/Paid), total stall revenue, top events by stall count. Use for 'stall analytics', 'stall stats', 'stall revenue'.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "get_speakers_analytics",
        description:
          "Comprehensive speaker analytics for the organizer: total requests, by status (Pending/Approved/Rejected), by payment status (Unpaid/Paid/Waived), total fees, keynote count, top events by speaker count. Use for 'speaker analytics', 'speaker stats'.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "get_round_tables_analytics",
        description:
          "Comprehensive round-table analytics across the organizer's events: total tables, total chairs (capacity), chairs booked, occupancy rate, total round-table revenue from bookings, top events by booking count. Use for 'round table analytics', 'round table stats'.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "get_organization_settings",
        description:
          "Comprehensive organization settings: profile, country, currency, plan, plan modules / module access, operators count, bank/payment settings, storefront slug, business email. Use for 'show all my settings', 'organization details', 'my org configuration'.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "get_event_full_analytics",
        description:
          "Single-event 360° analytics: tickets sold/attended/revenue, visitor-type breakdown, exhibitor/stall booking + payment status, speaker count by status, round-table chair occupancy + revenue, total combined revenue. Use for 'how is event X doing', 'analytics for event X', 'full breakdown of event X', 'tell me everything about event X'. Always pass event_name (partial match OK).",
        parameters: {
          type: "object",
          properties: {
            event_name: {
              type: "string",
              description: "Title or partial title of the event",
            },
          },
          required: ["event_name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_ticket_type_breakdown",
        description:
          "For one event, return tickets sold + revenue grouped by visitor type / ticket tier (e.g. Regular, VIP, Student). Use for 'which ticket type sells best for X', 'break down tickets for X by tier'.",
        parameters: {
          type: "object",
          properties: {
            event_name: {
              type: "string",
              description: "Title or partial title of the event",
            },
          },
          required: ["event_name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_event_participants",
        description:
          "Return the complete participant list for ONE event — visitors (ticket buyers), exhibitors (stalls), speakers, and round-table attendees — in a single payload. Use whenever the user asks for 'participants of <event>', 'participation report for <event>', 'show me all attendees for <event>', 'who is attending <event>', 'list everyone in <event>'.",
        parameters: {
          type: "object",
          properties: {
            event_name: {
              type: "string",
              description: "Title or partial title of the event",
            },
          },
          required: ["event_name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_attendance_analytics",
        description:
          "Across all events: tickets sold vs attended, attendance rate %, no-show count. Optionally narrow to upcoming/past events. Use for 'attendance rate', 'how many actually showed up', 'attendance statistics'.",
        parameters: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["all", "upcoming", "past"],
              description: "Limit to upcoming, past, or all events (default all)",
            },
          },
          required: [],
        },
      },
    },

    {
      type: "function",
      function: {
        name: "list_visitors",
        description:
          "Return the organizer's saved Visitors (User records created via the organizer's customer list, not per-event ticket buyers). Use for 'list my visitors', 'show all visitors', 'my customers'. Returns up to 1000 rows by default — call WITHOUT a `limit` argument so the user gets every visitor. Do NOT call navigate_to for these.",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description:
                "Optional cap. Leave UNSET to return all visitors (default 1000, max 2000). Only set if the user asked for a specific number.",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_exhibitors",
        description:
          "Return the organizer's saved Exhibitors (Vendor records under this organizer, both bulk-imported and manually created). Use for 'list my exhibitors', 'show all exhibitors', 'my vendors'. Returns up to 1000 rows by default — call WITHOUT a `limit` argument so the user gets every exhibitor. Do NOT call navigate_to for these.",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description:
                "Optional cap. Leave UNSET to return all exhibitors (default 1000, max 2000). Only set if the user asked for a specific number.",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_space_templates",
        description:
          "Return the organizer's saved Space templates (the reusable stall/table configs captured from past events). Use when the user asks 'show my templates', 'list space templates', 'what templates do I have', 'reusable spaces'.",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Max templates to return (default 50)",
            },
          },
          required: [],
        },
      },
    },

    // UI driver
    {
      type: "function",
      function: {
        name: "navigate_to",
        description:
          "Tell the dashboard to switch to a specific tab. Use when the user asks to 'open X' or 'go to X'.",
        parameters: {
          type: "object",
          properties: {
            tab: {
              type: "string",
              enum: [
                "dashboard",
                "events",
                "eventAttendees",
                "speakerRequests",
                "users",
                "roundTableBookings",
                "storefront",
                "settings",
              ],
            },
          },
          required: ["tab"],
        },
      },
    },
  ];

  // Per-tab tool subset (router → specialist)
  private static TAB_TOOLS: Record<Tab, string[]> = {
    dashboard: [
      "get_dashboard_stats",
      "get_revenue_trend",
      "get_top_events",
      "get_pending_approvals",
      "get_events_breakdown",
      "get_stalls_analytics",
      "get_speakers_analytics",
      "get_round_tables_analytics",
      "get_event_full_analytics",
      "get_ticket_type_breakdown",
      "get_attendance_analytics",
      "get_event_participants",
    ],
    events: [
      "list_events",
      "get_event_detail",
      "get_event_full_analytics",
      "get_ticket_type_breakdown",
      "get_event_participants",
      "get_events_breakdown",
      "create_event",
      "create_full_event",
      "request_edit_event",
      "add_ticket_type",
      "add_round_tables",
      "add_stalls",
      "add_speakers",
      "set_venue_config",
      "publish_event",
      "list_space_templates",
      "navigate_to",
    ],
    tickets: [
      "list_events",
      "list_tickets",
      "get_ticket_detail",
      "mark_ticket_used",
      "list_attendees",
    ],
    attendees: [
      "list_events",
      "list_attendees",
      "search_attendee",
      "list_visitors",
      "list_exhibitors",
    ],
    stalls: [
      "list_stalls",
      "get_stalls_analytics",
      "list_exhibitors",
      "navigate_to",
    ],
    speakers: [
      "list_events",
      "list_speakers",
      "get_speakers_analytics",
      "navigate_to",
    ],
    storefront: ["navigate_to"],
    settings: [
      "get_subscription",
      "list_plans",
      "list_operators",
      "get_organizer_info",
      "get_organization_settings",
      "navigate_to",
    ],
    // Platform Fees: no dedicated tools yet — the bot describes the tab,
    // routes the user there, and can surface event counts via existing
    // analytics tools when asked "how much do I owe per event?".
    platformFees: [
      "get_events_breakdown",
      "get_stalls_analytics",
      "get_speakers_analytics",
      "get_round_tables_analytics",
      "list_events",
      "navigate_to",
    ],
    // Feedback: same pattern — explain + navigate. List events so the bot
    // can answer "show feedback for event X" by sending the user to the
    // right place.
    feedback: ["list_events", "navigate_to"],
    general: [
      "get_dashboard_stats",
      "get_organizer_info",
      "list_events",
      "get_pending_approvals",
      "get_events_breakdown",
      "get_stalls_analytics",
      "get_speakers_analytics",
      "get_round_tables_analytics",
      "get_event_full_analytics",
      "get_ticket_type_breakdown",
      "get_attendance_analytics",
      "get_event_participants",
      "get_organization_settings",
      "create_event",
      "request_edit_event",
      "list_space_templates",
      "list_visitors",
      "list_exhibitors",
      "navigate_to",
    ],
  };

  // ============================================================
  // ANTI-HALLUCINATION + FORMAT RULES (prepended to every specialist)
  // ============================================================
  private static GLOBAL_RULES = `
=== STRICT OUTPUT RULES — FOLLOW EXACTLY ===

1. NEVER FABRICATE DATA
   - Do NOT invent any names, ticket IDs, prices, dates, quantities, emails, phone numbers, or events.
   - Every fact in your reply MUST come from a tool result. If you didn't call a tool, you don't have that data.
   - If a tool returns an empty list / no records, say "**No records found.**" — do NOT show example rows.
   - If a tool returns an error, quote the error plainly. Do NOT replace it with made-up data.
   - If the user asks something you have no tool for, say "I don't have that data — try the [relevant] tab" and call navigate_to with the matching tab. Never guess.

2. ALWAYS FORMAT AS A MARKDOWN TABLE FOR LISTS
   - Any list of 2+ records (events, tickets, attendees, stalls, speakers, plans, operators, top items) MUST be rendered as a GitHub-flavored markdown table:
       | Column | Column |
       |---|---|
       | value | value |
   - Pick 3-5 useful columns (no JSON dumps). Truncate long IDs to last 6 chars when shown.
   - For single-record answers, use bold key-value pairs:  **Plan:** Starter — $0 / 30 days
   - For analytics summaries, use a small 2-column table: metric → value.

3. KEEP IT SHORT
   - One sentence headline before the table (e.g. "Here are your **5 upcoming events**:").
   - No filler like "Sure!", "Of course!", "I'd be happy to!".
   - No closing pleasantries like "Let me know if you need more help".
   - If 0 results: just say "**No records found.**" and stop.

4. NUMBERS, DATES, MONEY
   - Money: ALWAYS prefix with the symbol "{CURRENCY}" (currency code: {CURRENCY_CODE}). Use locale-formatted comma separators. Round to nearest unit unless cents matter. NEVER use a different currency symbol than {CURRENCY}.
   - Dates: "Apr 28, 2026" format. Don't include time unless asked.
   - Counts: bold the number. E.g. **12 events**.

5. NEVER PASTE RAW TOOL OUTPUT (no JSON in replies, no curly braces, no array brackets).

6. NAVIGATION INTENT — ONLY call navigate_to when the user explicitly says "open the X tab", "go to X", "switch to X", "take me to X", or "open X customizer". Do NOT call navigate_to for prompts that say "list", "show me", "show all", "give me", "what are my", "how many" — those are LIST intents and must use the matching list_* / get_* tool instead. Map for navigation only: "events"→events, "settings"→settings, "storefront"→storefront, "attendees"→eventAttendees, "participants"→eventAttendees, "speakers"→speakerRequests, "users"→users, "exhibitors"→users, "visitors"→users, "stalls"→users, "round tables"→roundTableBookings, "kiosk"→kiosk, "in-person booking"→kiosk, "walk-in"→kiosk, "platform fees"→platformFees, "fees"→platformFees, "billing"→platformFees, "what I owe"→platformFees, "feedback"→feedback, "ratings"→feedback, "reviews"→feedback, "chatbot"→chatbot. Examples: "list my exhibitors" → list_exhibitors (NOT navigate_to). "open users tab" → navigate_to({tab:"users"}). "open platform fees" → navigate_to({tab:"platformFees"}). "show me feedback" → navigate_to({tab:"feedback"}).

7. AFTER TOOLS RUN — when you receive tool results, your job is to FORMAT them as the rendered reply (table or bold key-values). DO NOT request more tools, DO NOT emit any <tool_call>, <function_call>, JSON object, or function name in the response text. Just produce the final markdown reply.

8. EMPTY RESULTS ARE OK. If a list-type tool returns an empty array (e.g. no speakers for that event yet, no tickets sold, no stalls registered), render the table headers with an empty row (or just say "**No records found.**") and STOP. Do NOT call navigate_to to "send the user somewhere else" — empty just means zero items, not a system error.
=== END RULES ===
`;

  private static SPECIALIST_PROMPTS: Record<Tab, string> = {
    dashboard: `You are the Dashboard specialist for "{ORG}" on EventSH.
Focus: analytics, revenue, ticket sales, top events, pending review counts, deep breakdowns.
- For ANY metric question, you MUST call a tool first. Never guess numbers.
- Period words: "today" → get_revenue_trend(today); "this week" → week; "this month" → month; "this quarter" → quarter; "this year" → year.
- Format: 1-line headline + 2-column markdown table (Metric | Value).
- For top events, use a 3-column table: Event | Tickets | Revenue.
- "How is my platform doing" / "give me an overview" → call get_dashboard_stats AND get_pending_approvals, then a single combined table.

DEEP ANALYTICS TOOLS (use them when the user asks for detailed breakdowns):
- "Detailed events analytics" / "events breakdown" / "how are my events doing" → get_events_breakdown. Render 3 short tables: Status counts, Visibility counts, then a single Metrics row (Total Events, Capacity, Tickets Sold, Occupancy %, Avg Ticket Price, Revenue).
- "Stall analytics" / "stall stats" / "stall revenue" → get_stalls_analytics. Render: a By Status table, a By Payment Status table, totals (Total Stalls, Booking Value, Collected), then a Top Events by Stall Count table.
- "Speaker analytics" / "speaker stats" → get_speakers_analytics. Render: Status counts, Payment Status counts, totals (Total Requests, Keynote Count, Total Fees), then Top Events by Speaker Count.
- "Round table analytics" / "round table stats" → get_round_tables_analytics. Render: 1 metrics table (Tables, Chairs, Chairs Booked, Occupancy %, Paid Bookings, Revenue) + Top Events by Round Tables (table).
- "How is event X doing" / "analytics for event X" / "tell me everything about event X" → get_event_full_analytics(event_name). Render 4 tables: Tickets (Sold, Attended, Attendance %, Capacity, Occupancy %, Revenue), Stalls (totals + status counts), Speakers (status counts), Round Tables (Tables, Chairs, Chairs Booked, Occupancy %, Revenue), then a single bold "Total Revenue" line at the bottom.
- "Ticket type breakdown for X" / "which ticket tier sells best for X" → get_ticket_type_breakdown(event_name). Render a single table: Type | Sold | Capacity | Occupancy % | Revenue.
- "Attendance rate" / "how many actually showed up" / "no-shows" → get_attendance_analytics(status). Render: 1 metrics table (Tickets Sold, Attended, No-shows, Attendance %), then Top Events by Sold (table).
- "My space templates" / "list space templates" / "show reusable spaces" / "what templates do I have" → list_space_templates(). Render: headline "You have **N saved Space templates**." Then a markdown table with columns | # | Name | Size | Table Price | Booking Price | Deposit | (Size = "WxHcm" if both, else "—"). NEVER fabricate rows; only render what the tool returned.
- "List my visitors" / "show all visitors" / "my customers" / "show me visitors I added" → list_visitors() (call with NO arguments). Headline "You have **N visitors**." (use the EXACT total returned). Then a markdown table with columns | # | Name | Email | WhatsApp | Created |. Use "—" for missing values. **You MUST render every single row in the visitors[] array — do NOT truncate, do NOT say "and X more", do NOT cap at 50. The chat UI paginates the table to 20 rows per page automatically, so emit all rows.** NEVER call navigate_to for this.
- "List my exhibitors" / "show all exhibitors" / "my vendors" / "list exhibitors I added" → list_exhibitors() (call with NO arguments). Headline "You have **N exhibitors**." (use the EXACT total returned). Then a markdown table with columns | # | Name | Shop / Business | Email | WhatsApp | Category | Country |. Use "—" for missing values. **You MUST render every single row in the exhibitors[] array — do NOT truncate, do NOT say "and X more", do NOT cap at 50. The chat UI paginates the table to 20 rows per page automatically, so emit all rows.** NEVER call navigate_to for this.
- "Participants of event X" / "participation report for event X" / "everyone attending event X" / "list all attendees for X" → get_event_participants(event_name). Render in this order: 1) headline "**X has Y participants**" using totals.combined; 2) "Visitors (N)" markdown table | Name | Email | Phone | Tickets | Amount | Attended |; 3) "Exhibitors (N)" table | Name | Business | Phone | Status | Payment |; 4) "Speakers (N)" table | Name | Organization | Phone | Status | Fee |; 5) "Round Tables (N)" table | Name | Phone | Table | Seats | Payment |. Skip any section whose array is empty (don't render its header). NEVER fabricate rows — render only what the tool returned.
- For each, NEVER pick or invent extra columns; render only what the tool returned.`,

    events: `You are the Events specialist for "{ORG}" on EventSH. You build the entire event end-to-end via tools.
Currency: {CURRENCY} ({CURRENCY_CODE}).

LISTING / VIEWING:
- "List events" → list_events(status="all").
- "Upcoming events" → list_events(status="upcoming").
- "Past events" / "previous events" / "completed events" → list_events(status="past").
- "All events" / "list all my events" / "every event" / "how many events do I have" → list_events(status="all"). NEVER pass "upcoming" for these.
- Tool returns { total, shown, events[] } where each event has { id, title, startDate, endDate, venue, capacity, ticketsSold, status, visibility }.
- Headline: "You have **{total} events**." Then a markdown table with these EXACT columns and headers: | # | Title | Date | Venue | Sold / Capacity | Status |.
- "Date" = format startDate as "Apr 28, 2026" (use endDate too if present, e.g. "Apr 28 → Apr 30, 2026"). "Sold / Capacity" = e.g. "12 / 200" (use 0 / 0 if missing). "Status" = the status field as-is (draft / published / etc.).
- If venue is empty, write "—" in that cell. NEVER make up a venue.
- After rendering the table, STOP. Do NOT call list_attendees, list_tickets, or any other tool — the user only asked for the events list.
- "Event details for X" → get_event_detail. Bold key-value pairs.

CREATING:
- ANY phrasing like "create event", "create a new event", "new event", "add event", "make an event" → call **create_event()** with no arguments. The tool returns a botAction that opens the blank Create Event form. Reply with ONE short line: "**Opening the Create Event form for you.**"
- For richer one-shot phrasing ("create a tech meetup on May 15 ...") still call create_event — the form opens blank and the user fills it in. Don't try to parse fields yourself.
- **ALWAYS CALL create_event EVERY TIME THE USER ASKS — even if you called it earlier in this same conversation.** Each request needs a fresh tool call so the form actually opens again. NEVER reply with "I already opened the form" — instead, call create_event again.

EDITING:
- "Edit event X" / "Update event X" / "Modify event X" / "Change event X" → call **request_edit_event(event_name=X)**. The tool returns a botAction that opens the Edit form pre-filled.
- Reply with ONE short line: "**Opening the editor for \"<event title>\".**"
- If the tool returns an error (event not found), say "I couldn't find an event matching \"<X>\"." and call list_events(status="all") so the user can see their actual titles.
- **ALWAYS CALL request_edit_event EVERY TIME THE USER ASKS** — even if you've edited that same event earlier in the conversation.

LIMITATIONS (be honest):
- Image uploads, drag-drop layout, ticket type details — happen in the form itself, not chat.
- Don't pretend to "save" or "publish" from chat — the user finalises in the form.`,

    tickets: `You are the Tickets specialist for "{ORG}" on EventSH.
Focus: tickets sold, payment status, attendance check-in.
- "Recent tickets" / "recent tickets sold" / "latest tickets" → list_tickets() with NO event_name and NO status. Render as a table with these EXACT columns: | Ticket | Event | Customer | Amount | Paid | Attended |. Use the last 6 chars of ticketId. Format Amount with the currency symbol. "Paid" = ✓ or ✗. "Attended" = ✓ or ✗. After the table, STOP — do NOT call list_attendees, list_events, or any other tool.
- "Tickets for <event>" → list_tickets(event_name=<event>) — same column set.
- "Pending tickets" / "tickets with pending payments" → list_tickets(status="pending").
- "Confirmed tickets" → list_tickets(status="confirmed").
- "Mark ticket X used" → mark_ticket_used(ticketId=X). Confirm with one bold line.
- "Get ticket X" → get_ticket_detail. Render as bold key-value pairs.

LATEST-EVENT LOOKUP — for "my latest event" / "the latest event" / "current event":
  Step 1: call list_events with { status:"upcoming", limit:1 }.
  Step 2: Inspect the result. If result.events.length >= 1, set EVENT_TITLE = result.events[0].title. STOP this lookup — do NOT call list_events again.
  Step 3: ONLY if result.events.length === 0, fall back to list_events with { status:"all", limit:1 } and use that title.
  Step 4: After you have EVENT_TITLE, your VERY NEXT message MUST be a list_tickets tool call with event_name=EVENT_TITLE — emit ONLY that structured tool_call, no surrounding text, no explanation, no apology. The user is waiting for the table.

EMPTY RESULTS:
- If list_tickets returns an empty array, render this exact reply and STOP:
    "**No tickets found for {EVENT_TITLE}.**
    | Ticket | Event | Customer | Amount | Paid | Attended |
    |---|---|---|---|---|---|"
  Do NOT call navigate_to. Do NOT redirect. Empty just means zero tickets sold yet.
- NEVER say "I'm unable to retrieve" or "may not be accessible" — those phrases are forbidden.`,

    attendees: `You are the Attendees specialist for "{ORG}" on EventSH.
Focus: attendee rosters and lookups across all events.
- "Who came to <event>" / "list attendees for <event>" → list_attendees(event_name=<event>). Table: | Name | Email | WhatsApp | Paid | Attended |.
- "Find <name>" / "search <email>" → search_attendee(query=...). Table: | Event | Name | Email | WhatsApp |.
- If the user says "my latest event" with no name, FIRST call list_events(status=upcoming, limit=1) and use that title.
- For "find attendee by name or email" with no actual name, ask: "Who should I look up — name or email?".

EMPTY RESULTS:
- If list_attendees / search_attendee returns an empty array, render this exact reply and STOP:
    "**No attendees yet.**
    | Name | Email | WhatsApp | Paid | Attended |
    |---|---|---|---|---|"
  Do NOT call navigate_to. Do NOT redirect.`,

    stalls: `You are the Stalls/Exhibitors specialist for "{ORG}" on EventSH.
Focus: vendor registrations + stall analytics.
- "Show stall requests" / "pending stalls" → list_stalls(status=pending). Table: | Vendor | Business | Email | WhatsApp | Approved |.
- "All approved stalls" → list_stalls(status=approved).
- "Show stalls for <event>" / "stalls for <event>" → list_stalls(event_name=<event>). Render this EXACT table: | Vendor | Business | Status | Payment | Total | Paid |. Use the per-event tool result fields.
- "Stall analytics" / "stall stats" / "stall revenue" / "stall breakdown" / "how many stalls do I have" → get_stalls_analytics. Render: a "By Status" table, a "By Payment Status" table, a small totals table (Total Stalls / Booking Value / Collected), then a "Top Events by Stall Count" table.
- For approving/rejecting an individual stall, call navigate_to(users) (tell user "Open Exhibitors/Visitors tab to approve").

EMPTY RESULTS:
- If list_stalls returns an empty array, render this exact reply and STOP:
    "**No stalls registered for {EVENT_TITLE}.**
    | Vendor | Business | Status | Payment | Total | Paid |
    |---|---|---|---|---|---|"
  Do NOT call navigate_to. Do NOT redirect.`,

    speakers: `You are the Speakers specialist for "{ORG}" on EventSH.
Focus: speaker requests + speaker analytics.
- "Speaker requests" / "speakers for <event>" → list_speakers. Table: | Name | Email | Organization | Status | Fee |.
- "Pending speakers" → list_speakers(status="Pending").
- "Speaker analytics" / "speaker stats" / "speaker breakdown" / "how many speakers do I have" → get_speakers_analytics. Render: "By Status" table, "By Payment Status" table, a totals table (Total Requests / Keynote Count / Total Fees), then "Top Events by Speaker Count" table.
- If the user says "my latest event" with no name, FIRST call list_events(status=upcoming, limit=1) and use that title.
- For approving / setting fees / assigning slots, call navigate_to(speakerRequests).

EMPTY RESULTS:
- If list_speakers returns an empty array, render this exact reply and STOP:
    "**No speaker requests for {EVENT_TITLE}.**
    | Name | Email | Organization | Status | Fee |
    |---|---|---|---|---|"
  Do NOT call navigate_to. Do NOT redirect to another tab. The user explicitly asked for this event — give them the empty table here.`,

    storefront: `You are the Storefront specialist for "{ORG}" on EventSH.
The storefront customizer is the only place to actually edit settings — you cannot mutate them yourself.
- For ANY storefront edit request ("change banner", "switch theme color", "toggle Instagram section", etc.), reply with one short line naming the section AND call navigate_to(storefront).
- Do NOT pretend to apply changes. Do NOT show example settings.`,

    settings: `You are the Settings specialist for "{ORG}" on EventSH.
Focus: subscription plan, operators, profile, organization configuration.
- "What's my plan" / "subscription" → get_subscription. Render as bold key-value lines (Plan, Valid until, Modules count).
- "Show all plans" / "list plans" → list_plans. Table: | Plan | Price | Validity | Default |.
- "List operators" / "my operators" → list_operators. Table: | Name | Email | WhatsApp | Tabs |.
- "My profile" → get_organizer_info. Render as bold key-value pairs.
- "Show all my settings" / "organization details" / "my org configuration" / "organization settings" → get_organization_settings. Render as a 2-column key-value table with sections: Profile (Name / Org Name / Email / Country / WhatsApp), Plan (Plan Name / Price / Expiry / Subscribed), Payment Methods (UPI / Bank / PayNow / QR — show ✓ or ✗), Other (Operators count / Slug / Commission %). Use **bold** for section headers between rows or render as 4 separate small tables.
- To CHANGE plan / add operator / edit profile, call navigate_to(settings).`,

    platformFees: `You are the Platform Fees specialist for "{ORG}" on EventSH.
The Platform Fees tab shows what the organizer owes EventSH **per event** for their bookings (stalls, round-table seats, chairs, and confirmed speakers). The organizer pays via a dynamic QR (UPI for India, PayNow for Singapore) generated from the platform's PaymentConfig. After paying externally, the organizer clicks "I have paid" and an admin confirms the payment, after which a PDF receipt is sent to their WhatsApp + email.

Common questions:
- "What are platform fees?" / "How much do I owe?" / "Explain platform fees" → Answer in 2–3 sentences (what they are, how they're calculated, how to pay), then call navigate_to({tab:"platformFees"}) so they can see the per-event breakdown.
- "Open platform fees" / "Take me to billing" / "Go to fees" → call navigate_to({tab:"platformFees"}). No tool data needed.
- "How many stalls / speakers / round tables across all my events?" → call get_stalls_analytics / get_speakers_analytics / get_round_tables_analytics for the totals (these drive the fee calc).
- "Per-event breakdown of bookings" → call get_events_breakdown.
- "How do I pay?" → Explain: open Platform Fees tab → click Pay on the event row → scan the QR (UPI or PayNow based on your country) → click "I have paid" → admin verifies and a PDF receipt is sent via WhatsApp + email. Then navigate_to({tab:"platformFees"}).
- Never quote a specific owed amount — that's a live calculation shown only in the tab. Direct the user there.`,

    feedback: `You are the Feedback specialist for "{ORG}" on EventSH.
The Feedback tab shows ratings + comments collected from event participants. Audiences supported: **Visitors, Exhibitors, Speakers, Round Tables**. Which audiences a plan can collect feedback from is controlled by the subscription's Feedback module (admin sets per-audience flags on each plan).

Common questions:
- "What is feedback?" / "Show me feedback" / "View feedback" → Brief 2-line explanation, then call navigate_to({tab:"feedback"}).
- "Feedback for event X" / "Ratings for event X" → call list_events to confirm the event exists, then call navigate_to({tab:"feedback"}) — the tab opens the per-event feedback dialog.
- "Open feedback" / "Go to feedback" → call navigate_to({tab:"feedback"}).
- "Why can't I see Visitors feedback?" / "Why is the X audience missing?" → Explain: the plan's Feedback module controls per-audience access (Visitors / Exhibitors / Speakers / Round Tables). If an audience is missing, the active plan didn't include it — direct the user to Settings → Subscription to upgrade. Then optionally navigate_to({tab:"settings"}).
- Never invent ratings or counts — feedback data isn't exposed via tools yet; always send the user to the tab to view it.`,

    general: `You are the EventSH AI assistant for "{ORG}".
You help organizers with events, tickets, attendees, vendors, speakers, plans, settings, platform fees, and feedback.
- Always use a tool for factual questions. Never invent values.
- For UI changes, use navigate_to. Tab IDs include: dashboard, events, kiosk, eventAttendees, platformFees, users, feedback, speakerRequests, roundTableBookings, storefront, settings.
- For lists, always use a markdown table.
- For single record, use bold key-value pairs.
- Platform Fees: per-event amounts owed to EventSH (stalls/chairs/tables/speakers × platform rate); paid via country-aware QR; admin confirms; PDF receipt to WhatsApp+email. Direct users to the platformFees tab.
- Feedback: ratings + comments collected per event from visitors, exhibitors, speakers, and round-table guests. Which audiences are visible depends on the active plan's Feedback module. Direct users to the feedback tab.`,
  };

  // ============================================================
  // MAIN ENTRY
  // ============================================================
  /**
   * Returns true when the operator's access list allows the given operator
   * tab. A null/empty operatorAccessTabs means the caller is an organizer
   * (or admin) with full access — always returns true.
   */
  private isOperatorAllowed(
    operatorAccessTabs: string[] | null | undefined,
    required: OperatorTab | null,
  ): boolean {
    if (!required) return true;
    if (!operatorAccessTabs || operatorAccessTabs.length === 0) return true;
    return operatorAccessTabs.includes(required);
  }

  /** Friendly refusal text shown when an operator hits a gated module. */
  private accessRefusal(required: OperatorTab): {
    text: string;
    quickActions?: Array<{ label: string; action: string }>;
  } {
    const label = FRIENDLY_TAB_NAME[required] || "that module";
    return {
      text:
        `That's part of the **${label}** module, which isn't enabled on your operator profile. ` +
        `Ask your organizer admin to grant access if you need it — happy to help with anything else in the meantime!`,
    };
  }

  /**
   * Lightweight chat handler for Google-signed-in users who haven't completed
   * organizer registration yet. The main pipeline assumes an Organizer doc
   * exists; here we only support two intents — open the Create Event form
   * or open the organizer registration form — plus a friendly fallback.
   *
   * Returned shape matches what ChatbotWidget expects (text + quickActions +
   * botAction), so the same renderer handles both flows.
   */
  // Slug helpers — kept here (rather than imported from events.controller)
  // so the storefront-backfill path inside handleIndividualMessage is
  // self-contained.
  // True for Personal / Marriage events, which are RSVP-based rather than
  // ticketed. Used to switch the Individual "participants" + event-count
  // flows over to the RSVP collection.
  private isPersonalEvent(ev: any): boolean {
    if (!ev) return false;
    return (
      ev.eventType === "personal" ||
      ev.category === "Marriage Function" ||
      (Array.isArray(ev.categories) &&
        ev.categories.includes("Marriage Function"))
    );
  }

  private slugifyForStore(name: string, fallback: string): string {
    const cleaned = (name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    return cleaned || `org-${fallback.slice(-6)}`;
  }
  private async findFreeStoreSlug(base: string): Promise<string> {
    const clean = base || "store";
    const taken = await this.organizerStoreModel.exists({ slug: clean });
    if (!taken) return clean;
    for (let i = 0; i < 8; i++) {
      const candidate = `${clean}-${Math.random().toString(36).slice(2, 6)}`;
      const exists = await this.organizerStoreModel.exists({ slug: candidate });
      if (!exists) return candidate;
    }
    return `${clean}-${Date.now().toString(36)}`;
  }

  // TEMP one-shot: set the `country` field on an Organizer row by
  // email. Used to seed an Individual's currency without waiting for
  // them to re-sign-in through the locale-aware Google flow.
  async setOrganizerCountry({
    email,
    country,
  }: {
    email: string;
    country: string;
  }) {
    if (!email || !country) {
      return { error: "missing ?email and/or ?country query param" };
    }
    const e = email.toLowerCase();
    const c = country.toUpperCase();
    const escaped = e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const res = await this.organizerModel.updateMany(
      { email: { $regex: `^${escaped}$`, $options: "i" } },
      { $set: { country: c } },
    );
    return {
      email: e,
      country: c,
      matched: (res as any).matchedCount ?? (res as any).n,
      modified: (res as any).modifiedCount ?? (res as any).nModified,
    };
  }

  // TEMP backfill — populate `organizerType` (and `accountType` when
  // missing) on every existing organizer row.
  //   accountType "Individual" -> organizerType "individual"
  //   accountType "Organizer"  -> organizerType "organizer"
  // Legacy rows with neither field get accountType: "Organizer" (schema
  // default) + organizerType: "organizer".
  // Rows that already have an organizerType (including "upgraded") are
  // left alone so we don't clobber an Individual->Organizer conversion.
  async backfillOrganizerType() {
    const rows: any[] = await this.organizerModel
      .find({
        $or: [
          { organizerType: { $exists: false } },
          { organizerType: null },
          { organizerType: "" },
          { accountType: { $exists: false } },
          { accountType: null },
          { accountType: "" },
        ],
      })
      .lean();
    let individuals = 0;
    let organizers = 0;
    let accountTypeFilled = 0;
    for (const r of rows) {
      const update: any = {};
      if (!r.organizerType) {
        update.organizerType =
          r.accountType === "Individual" ? "individual" : "organizer";
      }
      if (!r.accountType) {
        update.accountType = "Organizer";
        accountTypeFilled++;
      }
      if (Object.keys(update).length === 0) continue;
      await this.organizerModel.updateOne({ _id: r._id }, { $set: update });
      if (update.organizerType === "individual") individuals++;
      else if (update.organizerType === "organizer") organizers++;
    }
    return {
      rowsScanned: rows.length,
      organizerTypeSetToIndividual: individuals,
      organizerTypeSetToOrganizer: organizers,
      accountTypeFilled,
    };
  }

  // TEMP heal: zero-out visitor-type prices on every event belonging to
  // Individual-tier organizers (or just a specific email). Matches the
  // new policy in events.controller: Individuals can't accept payment,
  // so all their tickets are free.
  async healIndividualTicketPrices({ email }: { email?: string }) {
    const orgQuery: any = { accountType: "Individual" };
    if (email) {
      const e = email.toLowerCase();
      const escaped = e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      orgQuery.email = { $regex: `^${escaped}$`, $options: "i" };
    }
    const orgs: any[] = await this.organizerModel.find(orgQuery).lean();
    const orgIds = orgs.map((o: any) => o._id);
    if (orgIds.length === 0) return { eventsScanned: 0, eventsHealed: 0 };
    const orgIdStrings = orgIds.map((id: any) => String(id));
    const events: any[] = await this.eventModel
      .find({
        organizer: { $in: [...orgIds, ...orgIdStrings] },
      })
      .lean();
    let healed = 0;
    for (const ev of events) {
      const vts: any[] = Array.isArray(ev.visitorTypes) ? ev.visitorTypes : [];
      if (vts.some((v: any) => Number(v?.price) > 0)) {
        const zeroed = vts.map((v: any) => ({ ...v, price: 0 }));
        await this.eventModel.updateOne(
          { _id: ev._id },
          { $set: { visitorTypes: zeroed, ticketPrice: "0" } },
        );
        healed++;
      }
    }
    return {
      organizersMatched: orgs.length,
      eventsScanned: events.length,
      eventsHealed: healed,
    };
  }

  // TEMP heal endpoint — for a given email, look up the canonical
  // Organizer row and re-link any orphaned events / storefronts that
  // point at deleted organizer IDs back to it. Handles the case where
  // a prior buggy create-then-delete left rows pointing at a stale _id.
  async healOrphansForEmail({ email }: { email: string }) {
    if (!email) return { error: "missing ?email query param" };
    const e = email.toLowerCase();
    const escaped = e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const canonical: any = await this.organizerModel
      .findOne({ email: { $regex: `^${escaped}$`, $options: "i" } })
      .lean();
    if (!canonical) return { error: "no organizer for email", email: e };
    const canonicalId = canonical._id;

    // 1. Find events whose `organizer` field doesn't resolve to a real org.
    const allOrgIds = (await this.organizerModel.find({}, { _id: 1 }).lean()).map(
      (o: any) => String(o._id),
    );
    const allOrgSet = new Set(allOrgIds);
    // Use a name-match heuristic: events whose `organizer` string-ID
    // isn't in the live org set AND whose lookup-by-email would map
    // back to this canonical row. We don't have a per-event email
    // hint, so heal ALL orphan events to this canonical row — only
    // safe if you know all orphans on this DB belong to this user.
    const orphanEvents: any[] = (await this.eventModel.find({}).lean()).filter(
      (ev: any) => ev.organizer && !allOrgSet.has(String(ev.organizer)),
    );
    let eventsLinked = 0;
    for (const ev of orphanEvents) {
      // Only heal events that were pointing at an org ID that started
      // with the same 12 hex chars as the canonical creation timestamp
      // OR whose pointer doesn't resolve. To be safer for the user's
      // immediate case we just relink ALL orphans.
      await this.eventModel.updateOne(
        { _id: ev._id },
        { $set: { organizer: canonicalId } },
      );
      eventsLinked++;
    }

    // 2. Find storefronts whose organizerId doesn't resolve.
    const orphanStores: any[] = (
      await this.organizerStoreModel.find({}).lean()
    ).filter(
      (s: any) => s.organizerId && !allOrgSet.has(String(s.organizerId)),
    );
    let storesLinked = 0;
    for (const s of orphanStores) {
      await this.organizerStoreModel.updateOne(
        { _id: s._id },
        { $set: { organizerId: canonicalId } },
      );
      storesLinked++;
    }

    return {
      canonicalOrganizerId: String(canonicalId),
      eventsLinked,
      storesLinked,
    };
  }

  // TEMP diagnostic — list ALL organizer rows for an email so we can
  // detect duplicates caused by case-sensitive lookups, race conditions
  // on lazy-create, or earlier buggy creation paths.
  async debugOrganizersForEmail({ email }: { email: string }) {
    if (!email) return { error: "missing ?email query param" };
    const e = email.toLowerCase();
    const escaped = e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rows: any[] = await this.organizerModel
      .find({ email: { $regex: `^${escaped}$`, $options: "i" } })
      .lean();
    return {
      lookupEmail: e,
      count: rows.length,
      rows: rows.map((r: any) => ({
        id: String(r._id),
        email: r.email,
        organizationName: r.organizationName,
        accountType: r.accountType,
        approved: r.approved,
        createdAt: r.createdAt,
      })),
    };
  }

  // TEMP diagnostic — list the 10 most recent events with their organizer
  // refs so we can find a "lost" event from any user. Also reports the
  // raw type of the organizer field (string vs ObjectId) which matters
  // for downstream queries.
  async debugRecentEvents() {
    const events = await this.eventModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    return {
      count: events.length,
      events: events.map((ev: any) => ({
        id: String(ev._id),
        title: ev.title,
        organizer: ev.organizer ? String(ev.organizer) : null,
        organizerType: ev.organizer === null
          ? "null"
          : typeof ev.organizer === "object"
            ? ev.organizer?.constructor?.name || "object"
            : typeof ev.organizer,
        createdAt: ev.createdAt,
      })),
    };
  }

  // TEMP diagnostic — pass either ?email=foo@bar.com OR ?organizerId=XXX.
  // Returns the Organizer row + event count + a sample event so we can
  // isolate whether "my events" returns nothing because of an org-lookup
  // miss vs. an event-query miss.
  async debugIndividualLookup({
    email,
    organizerId,
  }: {
    email?: string;
    organizerId?: string;
  }) {
    let org: any = null;
    if (organizerId) {
      try {
        org = await this.organizerModel.findById(organizerId).lean();
      } catch {
        // Invalid ObjectId — ignore, try email path
      }
    }
    if (!org && email) {
      const e = email.toLowerCase();
      const escaped = e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      org = await this.organizerModel
        .findOne({ email: { $regex: `^${escaped}$`, $options: "i" } })
        .lean();
    }
    if (!org) {
      return {
        error: "no organizer found",
        triedEmail: email || null,
        triedOrganizerId: organizerId || null,
      };
    }
    // Backfill / heal storefront — same logic as handleIndividualMessage
    // but exposed here so we can verify the slug + full default settings
    // without going through the chatbot.
    let store: any = await this.organizerStoreModel
      .findOne({ organizerId: org._id })
      .lean();
    if (store && (!store.settings?.design || !store.settings?.features)) {
      const merged = buildDefaultStorefrontSettings({
        storeName:
          store.settings?.general?.storeName ||
          org.organizationName ||
          org.name,
        email:
          store.settings?.general?.contactInfo?.email || org.email,
      });
      merged.general = { ...merged.general, ...(store.settings?.general || {}) };
      await this.organizerStoreModel
        .updateOne({ _id: store._id }, { $set: { settings: merged } })
        .catch(() => null);
      store = { ...store, settings: merged };
    }
    if (!store) {
      const base = this.slugifyForStore(
        org.organizationName || org.name || "",
        String(org._id),
      );
      const safeSlug = await this.findFreeStoreSlug(base);
      try {
        store = await new this.organizerStoreModel({
          organizerId: org._id,
          slug: safeSlug,
          settings: buildDefaultStorefrontSettings({
            storeName: org.organizationName || org.name,
            email: org.email,
          }),
        }).save();
      } catch {
        store = await this.organizerStoreModel
          .findOne({ organizerId: org._id })
          .lean();
      }
    }
    const events = await this.eventModel
      .find({ organizer: { $in: [org._id, String(org._id)] } })
      .lean();
    return {
      organizer: {
        id: String(org._id),
        email: org.email,
        organizationName: org.organizationName,
        accountType: org.accountType,
        organizerType: org.organizerType,
      },
      storefront: store
        ? {
            slug: (store as any).slug,
            url: `/${(store as any).slug}`,
          }
        : null,
      eventCount: events.length,
      events: events.slice(0, 5).map((ev: any) => ({
        id: String(ev._id),
        title: ev.title,
        organizer: String(ev.organizer),
        publicUrl: store
          ? `/${(store as any).slug}/events/${ev._id}`
          : `/events/${ev._id}`,
        createdAt: ev.createdAt,
      })),
    };
  }

  /**
   * Unauthenticated chatbot for the public landing page. Matches against a
   * small curated FAQ corpus and recognizes a "create event" intent that
   * the frontend turns into an inline Google sign-in prompt.
   *
   * Intentionally NOT routed through the LLM — every visit would be a
   * billed API call. If a question doesn't match any FAQ keyword, the
   * bot points them at the docs / contact page instead.
   */
  async handlePublicMessage({ message }: { message: string }): Promise<{
    text: string;
    quickActions?: Array<{ label: string; action: string }>;
    publicAction?: { type: "trigger_google_auth" };
  }> {
    const m = (message || "").toLowerCase().trim();
    const has = (...words: string[]) =>
      words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(m));

    const wantsCreateEvent =
      has("create", "start", "new", "make", "host", "plan", "publish") &&
      has("event", "events", "wedding", "birthday", "conference", "meetup");

    if (wantsCreateEvent || /^(create|host)\s+(my\s+)?(first\s+)?event/i.test(m)) {
      return {
        text:
          "Awesome — let's get you set up. I'll sign you in with Google in a sec and take you straight to your dashboard. If you already run an organization with us, you'll land on your full Organizer dashboard; otherwise you'll start as an Individual and publish your event from there.",
        publicAction: { type: "trigger_google_auth" },
      };
    }

    // Curated FAQ matcher. Order matters — more specific intents first.
    const faqs: { test: () => boolean; reply: string }[] = [
      {
        test: () => has("price", "pricing", "cost", "fee", "free", "plan", "plans"),
        reply:
          "EventSH has a free starter plan for one-off organizers and paid tiers for full multi-event accounts. Visit **/pricing** for the full breakdown — or just create your first event and pick a plan later.",
      },
      {
        test: () => has("ticket", "tickets", "selling", "sell"),
        reply:
          "You can sell tickets online (Razorpay/Stripe) and at the door via walk-in / QR scan. Refunds, multi-tier pricing, and coupons are all built in.",
      },
      {
        test: () => has("individual", "wedding", "birthday", "one-off", "single"),
        reply:
          "Yes — individuals running a single event (wedding, birthday, one-off conference) can publish without registering a full organization. Click **Create my first event** and you're going.",
      },
      {
        test: () => has("organizer", "organization", "business", "company"),
        reply:
          "Organizers get the full multi-event dashboard: stalls, vendor requests, custom storefront, CRM, analytics, custom domain. Sign in with Google — if we find your organization, you'll land directly on the Organizer dashboard.",
      },
      {
        test: () => has("login", "sign in", "signin", "log in"),
        reply:
          "Click **Create my first event** below — it triggers Google sign-in. If you already have an organizer account on your email, you'll be sent to your dashboard. Otherwise we'll set you up as an Individual.",
      },
      {
        test: () => has("storefront", "store", "shop", "domain"),
        reply:
          "Organizer accounts get a multi-event storefront at a custom URL (and optionally a custom domain). Individual accounts get a per-event **EventFront** page — perfect for a single wedding/conference.",
      },
      {
        test: () => has("attendee", "attendees", "participant", "participants", "guest"),
        reply:
          "Attendees register on the public event page, get a QR-coded ticket, and check in by scan at the door. The Participants tab in the dashboard shows the full list, with export to CSV.",
      },
      {
        test: () => has("scanner", "scan", "qr", "check-in", "checkin"),
        reply:
          "Every ticket carries a QR code. Use the in-browser scanner (Operators can have scoped scan-only access) — works on phones with no app install.",
      },
      {
        test: () => has("support", "help", "contact"),
        reply:
          "Hit **/contact** for support, or just describe the problem here and I'll point you to the right place.",
      },
      {
        test: () => has("hi", "hello", "hey", "yo"),
        reply:
          "Hey! I'm EventSH's assistant. I can answer FAQs about pricing, tickets, attendees, or get you started — click **Create my first event** below to begin.",
      },
    ];

    const hit = faqs.find((f) => f.test());
    const text = hit
      ? hit.reply
      : "I can answer questions about pricing, tickets, attendees, the storefront, individual vs organizer accounts — or kick off your first event right now. What would you like to do?";

    return {
      text,
      quickActions: [
        { label: "Create my first event", action: "I want to create my first event" },
        { label: "Pricing", action: "How much does it cost?" },
        { label: "How tickets work", action: "How do tickets work?" },
        { label: "Individual vs Organizer", action: "What's the difference between individual and organizer?" },
      ],
    };
  }

  async handleIndividualMessage({
    userName,
    userEmail,
    message,
  }: {
    userName: string;
    userEmail?: string;
    message: string;
  }): Promise<{
    text: string;
    quickActions?: Array<{ label: string; action: string }>;
    botAction?:
      | { type: "openCreateEvent"; eventType?: string; category?: string }
      | { type: "openOrganizerRegister" }
      | { type: "viewEvent"; eventId: string };
    events?: Array<{
      id: string;
      title: string;
      date?: string;
      status?: string;
      ticketCount?: number;
      revenue?: number;
      currency?: string;
      // Visitor-type summary surfaced on the chat card so the user can
      // confirm at-a-glance what tickets are on sale.
      ticketTypeCount?: number;
      ticketTypeNames?: string[];
      minPrice?: number | null;
      maxPrice?: number | null;
      capacityTotal?: number;
      // Store-scoped: /{slug}/events/{id} when a storefront exists,
      // otherwise the bare /events/{id}.
      publicUrl?: string;
      // The bare storefront URL (/{slug}) so the user can share their
      // whole event store in one link.
      storeUrl?: string;
    }>;
    participants?: Array<{
      id: string;
      name: string;
      email?: string;
      ticketType?: string;
      used?: boolean;
    }>;
  }> {
    const m = (message || "").toLowerCase();
    const wantsRegister =
      /\b(register|sign\s*up|become\s+(?:an\s+)?organizer|organi[sz]er|host\s+events?|create\s+(?:my\s+)?account|join)\b/.test(
        m,
      );
    const wantsCreateEvent =
      /\b(create|new|add|make|start|host|plan)\b/.test(m) &&
      /\b(event|meetup|conference|workshop|show|expo|exhibition|gathering)\b/.test(
        m,
      );
    const wantsMyEvents =
      /\b(my events|list (my )?events|show (my )?events|see (my )?events)\b/.test(
        m,
      ) ||
      /\bmy events\b/.test(m);
    const wantsParticipants =
      /\b(participant|participants|attendee|attendees|guests?|who.{0,15}coming|who.{0,15}registered)\b/.test(
        m,
      );
    // A specific personal event type named (by pill or natural phrasing) →
    // jump straight into the pre-filled Create Event form for that type.
    const chosenPersonalType = PERSONAL_EVENT_TYPES.find((t) =>
      t.keywords.some((k) => m.includes(k)),
    );

    // Resolve the backing Organizer record (lazy-created on first event
    // publish — see events.controller.ensureIndividualOrganizer). If
    // none exists yet, "my events" intents fall through to onboarding.
    const email = (userEmail || "").toLowerCase();
    // Case-insensitive lookup — older Organizer docs may have a mixed-case
    // email that won't match a lowercased equality check.
    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const backingOrg: any = email
      ? await this.organizerModel
          .findOne({ email: { $regex: `^${escapedEmail}$`, $options: "i" } })
          .lean()
      : null;

    // Legacy events (and writes that slipped past Mongoose's cast) store
    // `organizer` as a String even though the schema declares ObjectId.
    // Query both shapes so we don't miss either set.
    const orgMatch = backingOrg
      ? { $in: [backingOrg._id, String(backingOrg._id)] }
      : undefined;

    if (wantsMyEvents && backingOrg) {
      const events = await this.eventModel
        .find({ organizer: orgMatch })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      if (events.length === 0) {
        return {
          text:
            "You haven't published an event yet. Tap **Create an event** below and I'll open the form.",
          quickActions: [
            { label: "Create an event", action: "I want to create an event" },
          ],
        };
      }
      // Look up (or backfill / heal) the storefront slug — used to build
      // branded URLs for every event in the list. Existing Individuals
      // who were created before the storefront-on-publish wiring went in
      // get one here on first "my events" lookup. Also auto-heals rows
      // that were created with an incomplete settings shape (missing
      // design / features / seo) — common for records created during
      // early-iteration backfills.
      let store: any = await this.organizerStoreModel
        .findOne({ organizerId: backingOrg._id })
        .lean();
      if (store && (!store.settings?.design || !store.settings?.features)) {
        const merged = buildDefaultStorefrontSettings({
          storeName:
            store.settings?.general?.storeName ||
            backingOrg.organizationName ||
            backingOrg.name,
          email:
            store.settings?.general?.contactInfo?.email || backingOrg.email,
        });
        // Preserve anything the user may have already customized in
        // `general` — merge only the missing top-level branches.
        merged.general = { ...merged.general, ...(store.settings?.general || {}) };
        try {
          await this.organizerStoreModel.updateOne(
            { _id: store._id },
            { $set: { settings: merged } },
          );
          store = { ...store, settings: merged };
        } catch (err) {
          console.error(
            "[handleIndividualMessage] storefront heal failed:",
            (err as any)?.message,
          );
        }
      }
      if (!store) {
        const base = this.slugifyForStore(
          backingOrg.organizationName || backingOrg.name || "",
          String(backingOrg._id),
        );
        const safeSlug = await this.findFreeStoreSlug(base);
        try {
          store = await new this.organizerStoreModel({
            organizerId: backingOrg._id,
            slug: safeSlug,
            settings: buildDefaultStorefrontSettings({
              storeName: backingOrg.organizationName || backingOrg.name,
              email: backingOrg.email,
            }),
          }).save();
        } catch (err) {
          // Race / duplicate — re-read whatever landed.
          store = await this.organizerStoreModel
            .findOne({ organizerId: backingOrg._id })
            .lean();
        }
      }
      const slug = store?.slug || null;
      const storeUrl = slug ? `/${slug}` : undefined;
      const eventsWithStats = await Promise.all(
        events.map(async (ev: any) => {
          const ticketStats = await this.ticketModel
            .aggregate([
              { $match: { eventId: ev._id } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  revenue: { $sum: { $ifNull: ["$amount", 0] } },
                },
              },
            ])
            .catch(() => []);
          const stats = (ticketStats[0] || {}) as {
            count?: number;
            revenue?: number;
          };

          // Marriage / Personal events have no tickets — their "participants"
          // are RSVP guests. Count attending RSVPs so the card shows a real
          // number, and flag it so the UI labels it "RSVPs" not "sold".
          const isRsvp = this.isPersonalEvent(ev);
          let participantCount = stats.count || 0;
          if (isRsvp) {
            const rsvpStats = await this.rsvpModel
              .aggregate([
                {
                  $match: {
                    eventId: String(ev._id),
                    attending: { $ne: false },
                  },
                },
                { $group: { _id: null, responses: { $sum: 1 } } },
              ])
              .catch(() => []);
            participantCount = (rsvpStats[0]?.responses as number) || 0;
          }

          const visitorTypes: any[] = Array.isArray(ev.visitorTypes)
            ? ev.visitorTypes
            : [];
          const prices = visitorTypes
            .map((v: any) => Number(v?.price ?? 0))
            .filter((n: number) => Number.isFinite(n));
          const minPrice = prices.length ? Math.min(...prices) : null;
          const maxPrice = prices.length ? Math.max(...prices) : null;
          const capacityTotal = visitorTypes.reduce(
            (sum: number, v: any) =>
              sum + (Number.isFinite(Number(v?.maxCount)) ? Number(v.maxCount) : 0),
            0,
          );
          return {
            id: String(ev._id),
            title: ev.title || ev.name || "Untitled event",
            date: ev.startDate || ev.date,
            // The schema field is `status` (e.g. "published" | "draft");
            // `ev.published` is unset, so the old `ev.published ?` check
            // always tagged events as "draft" even after publish.
            status: ev.status || (ev.published ? "published" : "draft"),
            ticketCount: participantCount,
            isRsvp,
            revenue: stats.revenue || 0,
            currency: backingOrg.country
              ? COUNTRY_CURRENCY[backingOrg.country]?.symbol || "$"
              : "$",
            ticketTypeCount: visitorTypes.length,
            ticketTypeNames: visitorTypes
              .map((v: any) => String(v?.name || "").trim())
              .filter(Boolean)
              .slice(0, 3),
            minPrice,
            maxPrice,
            capacityTotal,
            publicUrl: slug
              ? `/${slug}/events/${ev._id}`
              : `/events/${ev._id}`,
            storeUrl,
          };
        }),
      );
      return {
        text: `Here ${eventsWithStats.length === 1 ? "is your event" : `are your ${eventsWithStats.length} events`}:`,
        events: eventsWithStats,
        quickActions: [
          { label: "See participants", action: "Show me the participants" },
          { label: "Create another event", action: "I want to create an event" },
        ],
      };
    }

    if (wantsParticipants && backingOrg) {
      // Default to the most recent event when no event is specified.
      const latestEvent: any = await this.eventModel
        .findOne({ organizer: orgMatch })
        .sort({ createdAt: -1 })
        .lean();
      if (!latestEvent) {
        return {
          text:
            "You don't have any events yet, so there are no participants to show. Create one first?",
          quickActions: [
            { label: "Create an event", action: "I want to create an event" },
          ],
        };
      }
      const eventTitle = (latestEvent as any).title || "your event";

      // Personal / Marriage events are RSVP-based — guests respond on the
      // public wedding page rather than buying tickets. Count those RSVPs as
      // participants (mirrors the organizer's Participants → RSVP panel).
      if (this.isPersonalEvent(latestEvent)) {
        const rsvps = await this.rsvpModel
          .find({ eventId: String(latestEvent._id) })
          .sort({ createdAt: -1 })
          .limit(25)
          .lean();
        const attending = rsvps.filter((r: any) => r.attending !== false);
        const totalGuests = attending.reduce(
          (sum: number, r: any) => sum + (Number(r.guestCount) || 0),
          0,
        );
        const participants = rsvps.map((r: any) => {
          const isAttending = r.attending !== false;
          const guests = Number(r.guestCount) || 1;
          return {
            id: String(r._id),
            name: r.name || "Guest",
            email: r.email,
            ticketType: isAttending
              ? `${guests} guest${guests === 1 ? "" : "s"}`
              : undefined,
            used: isAttending,
            statusLabel: isAttending ? "Attending" : "Declined",
            statusOk: isAttending,
          };
        });
        return {
          text:
            rsvps.length === 0
              ? `No RSVPs yet for **${eventTitle}**. Share the wedding page link so guests can respond.`
              : `**${rsvps.length}** RSVP${rsvps.length === 1 ? "" : "s"} for **${eventTitle}** — **${attending.length}** attending, **${totalGuests}** total guest${totalGuests === 1 ? "" : "s"}:`,
          participants,
          quickActions: [{ label: "My events", action: "Show my events" }],
        };
      }

      const tickets = await this.ticketModel
        .find({ eventId: latestEvent._id })
        .limit(25)
        .lean();
      const participants = tickets.map((t: any) => ({
        id: String(t._id),
        name: t.buyerName || t.attendeeName || t.name || "Guest",
        email: t.buyerEmail || t.email,
        ticketType: t.ticketType || t.type,
        used: !!t.used,
      }));
      return {
        text:
          participants.length === 0
            ? `No participants yet for **${eventTitle}**. Share the event link to start selling tickets.`
            : `Here are the ${participants.length === 25 ? "first 25 " : ""}participants for **${eventTitle}**:`,
        participants,
        quickActions: [
          { label: "My events", action: "Show my events" },
        ],
      };
    }

    if (wantsRegister) {
      return {
        text:
          "Great — let's set you up as a full organizer (custom domain, storefront, multi-event analytics). I'm opening the registration form now; it'll have your name and email pre-filled.",
        botAction: { type: "openOrganizerRegister" },
        quickActions: [
          { label: "Create an event", action: "I want to create an event" },
        ],
      };
    }
    // A specific personal type was chosen → open the Create Event form
    // pre-filled with it (eventType "personal" + the matching category, which
    // surfaces the type-specific fields, e.g. the Marriage functions).
    if (chosenPersonalType) {
      return {
        text: `Great choice — opening the Create Event form for your **${chosenPersonalType.category}**. As an Individual you can publish one free event; share the public link with your guests once it's live.`,
        botAction: {
          type: "openCreateEvent",
          eventType: "personal",
          category: chosenPersonalType.category,
        },
        quickActions: [
          { label: "Pick a different type", action: "I want to create an event" },
          {
            label: "Professional event instead",
            action: "Register my organization for professional events",
          },
        ],
      };
    }
    // Generic "create an event" → show the Personal Event List to pick from.
    // Each pill re-enters this handler with a specific type (handled above).
    if (wantsCreateEvent) {
      return {
        text:
          "What are you celebrating? Pick the kind of personal event and I'll open the form ready for it. Planning something professional with ticketing, stalls or exhibitors instead? Register an organization.",
        quickActions: [
          ...PERSONAL_EVENT_TYPES.map((t) => ({
            label: t.category,
            action: `Create a ${t.category} event`,
          })),
          {
            label: "Professional event (register org)",
            action: "Register my organization for professional events",
          },
        ],
      };
    }

    // Default greeting. If they already have at least one event, surface
    // "My events" as the primary pill alongside the onboarding ones.
    const hasEvents =
      !!backingOrg &&
      (await this.eventModel.countDocuments({ organizer: orgMatch })) >
        0;
    return {
      text:
        `Welcome${userName && userName !== "there" ? `, ${userName}` : ""}! ` +
        `I can help you ${
          hasEvents
            ? "manage your event, check participants, or publish another."
            : "publish your first event or set up a full organizer account."
        }\n\n` +
        `• **Create an event** — I'll open the form.\n` +
        (hasEvents
          ? `• **My events** — see what you've published, participants, and revenue.\n`
          : "") +
        `• **Become an organizer** — unlock the full multi-event dashboard with storefront and analytics.`,
      quickActions: hasEvents
        ? [
            { label: "My events", action: "Show my events" },
            { label: "See participants", action: "Show me the participants" },
            { label: "Create an event", action: "I want to create an event" },
            {
              label: "Become an organizer",
              action: "I want to register as an organizer",
            },
          ]
        : [
            { label: "Create an event", action: "I want to create an event" },
            {
              label: "Become an organizer",
              action: "I want to register as an organizer",
            },
          ],
    };
  }

  async handleMessage({
    organizerId,
    organizerName,
    operatorAccessTabs,
    message,
  }: {
    organizerId: string;
    organizerName: string;
    operatorAccessTabs?: string[] | null;
    message: string;
  }) {
    if (!this.hasApiKey()) {
      return {
        text:
          "AI is not configured on the server. Please contact the platform admin.",
      };
    }
    if (!message || !message.trim()) {
      return { text: "Say something and I'll help." };
    }

    const orgDoc = await this.organizerModel.findById(organizerId).lean();
    const orgName = (orgDoc as any)?.organizationName || "your organization";
    const country = (orgDoc as any)?.country || "US";
    const currency = currencyFor(country);

    const history = this.getHistory(organizerId);
    history.push({ role: "user", content: message, ts: Date.now() });

    // Deterministic short-circuit: walk-in / kiosk booking — render an
    // inline ticket-booking form in the chat bubble.
    const walkin = await this.maybeWalkinForm(message, organizerId);
    if (walkin) {
      history.push({ role: "assistant", content: walkin.text, ts: Date.now() });
      this.trimHistory(organizerId);
      return walkin;
    }

    // Deterministic short-circuit: pay platform fees — render an inline
    // payment widget in the chat bubble. Gated by the same `settings`
    // operator tab that protects the rest of the platform-fees module, so
    // operators without settings access get a friendly refusal instead.
    const feeForm = await this.maybePlatformFeeForm(message, organizerId, {
      orgName,
      operatorAccessTabs,
    });
    if (feeForm) {
      history.push({
        role: "assistant",
        content: feeForm.text,
        ts: Date.now(),
      });
      this.trimHistory(organizerId);
      return feeForm;
    }

    // Deterministic short-circuit: create / edit event form requests.
    // Bypasses the LLM completely so repeated requests always re-open the
    // form (the LLM otherwise tends to skip the second tool call thinking
    // it's already done).
    const formShortcut = await this.maybeEventFormShortcut(
      message,
      organizerId,
    );
    if (formShortcut) {
      history.push({
        role: "assistant",
        content: formShortcut.text,
        ts: Date.now(),
      });
      this.trimHistory(organizerId);
      return formShortcut;
    }

    // Deterministic short-circuit: per-event picker for tickets / stalls /
    // speakers / attendees / round tables when no specific event was named.
    const picker = await this.maybeEventPicker(message, organizerId);
    if (picker) {
      history.push({ role: "assistant", content: picker.text, ts: Date.now() });
      this.trimHistory(organizerId);
      return picker;
    }

    // Deterministic short-circuit: org-wide list intents (visitors,
    // exhibitors, space templates). Bypasses the LLM completely so 100+
    // rows render in ~100ms (Mongo query + string format) instead of
    // waiting on the LLM to token-generate every cell.
    const listShortcut = await this.maybeListShortcut(message, organizerId);
    if (listShortcut) {
      history.push({
        role: "assistant",
        content: listShortcut.text,
        ts: Date.now(),
      });
      this.trimHistory(organizerId);
      return listShortcut;
    }

    // Deterministic short-circuit: participation report for a specific
    // event. The LLM was returning only stats and skipping the tables when
    // any of the four sections was large; rendering directly guarantees
    // every row reaches the user.
    const partReport = await this.maybeParticipationReport(
      message,
      organizerId,
      currency,
    );
    if (partReport) {
      history.push({
        role: "assistant",
        content: partReport.text,
        ts: Date.now(),
      });
      this.trimHistory(organizerId);
      return partReport;
    }

    try {
      // 1. Route to a specialist
      const tab = await this.route(message, history);
      this.logger.debug(`Routed to ${tab}`);

      // 1a. Operator access gate. If the routed tab is gated by an operator
      // tab the caller doesn't have, return a friendly refusal without
      // calling the specialist (and without leaking data via tool calls).
      const requiredOperatorTab = CHATBOT_TAB_GUARDED_BY[tab];
      if (
        requiredOperatorTab &&
        !this.isOperatorAllowed(operatorAccessTabs, requiredOperatorTab)
      ) {
        const refusal = this.accessRefusal(requiredOperatorTab);
        history.push({
          role: "assistant",
          content: refusal.text,
          ts: Date.now(),
        });
        this.trimHistory(organizerId);
        return refusal;
      }

      // 2. Run specialist
      const result = await this.runSpecialist({
        tab,
        organizerId,
        orgName,
        organizerName,
        country,
        currency,
        history,
        userMessage: message,
        operatorAccessTabs,
      });

      // 3. Save assistant message
      history.push({ role: "assistant", content: result.text, ts: Date.now() });
      this.trimHistory(organizerId);

      return result;
    } catch (err: any) {
      this.logger.error(`Chatbot error: ${err?.message}`, err?.stack);
      return {
        text: `Sorry — I hit an error: ${err?.message || "unknown"}. Try again in a sec.`,
      };
    }
  }

  // Cheap classifier
  private async route(message: string, _history: ConvEntry[]): Promise<Tab> {
    // Deterministic shortcuts first
    const m = message.toLowerCase();

    // Analytics / dashboard metrics
    if (
      /\b(revenue|earned|earning|sales summary|top event|how am i doing|stats|analytics|overview|approval|approvals|pending review)\b/.test(
        m,
      )
    )
      return "dashboard";

    // Mutating event actions (create / add / publish / set venue / edit) →
    // events tab, even when the message also mentions tickets / stalls /
    // speakers / round tables. The events specialist owns these tools.
    if (
      /\b(create|add|publish|set\s+(?:the\s+)?venue|edit|update|delete|remove)\b/.test(
        m,
      ) &&
      /\b(event|ticket\s*type|ticket\s*tier|tier|round\s*table|stall|booth|speaker|venue|tag|category)\b/.test(
        m,
      )
    )
      return "events";

    // Platform fees + Feedback come BEFORE the generic event/settings rules
    // so prompts like "platform fees" don't get swallowed by "settings" or
    // "events".
    if (
      /\b(platform\s*fees?|owed|outstanding|billing|how\s+much\s+do\s+i\s+owe|what\s+do\s+i\s+owe|pay\s+(?:my\s+)?fees?|event\s+fees?|fees\s+to\s+(?:pay|eventsh))\b/.test(
        m,
      )
    )
      return "platformFees";
    if (
      /\b(feedback|rating|ratings|reviews?|comments\s+from|how\s+(?:was|did)\s+(?:my\s+)?event)\b/.test(
        m,
      )
    )
      return "feedback";

    // Specific subjects — read/query verbs win over the generic "event" word
    if (/\b(attendee|attendees|who came|visitors|guest list)\b/.test(m))
      return "attendees";
    if (/\b(ticket|attendance|check.?in|sold)\b/.test(m)) return "tickets";
    if (/\b(stall|vendor|exhibitor)\b/.test(m)) return "stalls";
    if (/\b(speaker|speech|session)\b/.test(m)) return "speakers";

    // Plain events queries (list / upcoming / past)
    if (/\bevent(s)?\b/.test(m)) return "events";

    if (/\b(storefront|theme|banner|color|design|customize)\b/.test(m))
      return "storefront";
    if (/\b(plan|subscription|operator|settings|profile)\b/.test(m))
      return "settings";

    // LLM fallback (12 tokens)
    try {
      const res = await this.ai.chat.completions.create({
        model: this.routerModel,
        messages: [
          {
            role: "system",
            content:
              'Classify the user message into ONE tab and reply with ONLY that word. Tabs: dashboard, events, tickets, attendees, stalls, speakers, storefront, settings, platformFees, feedback, general. platformFees covers fees owed to eventsh / billing / how much do i owe. feedback covers ratings / reviews / comments from attendees. Reply only the word.',
          },
          { role: "user", content: message },
        ],
        max_tokens: 8,
        temperature: 0,
      });
      const tab = (res.choices?.[0]?.message?.content || "general")
        .trim()
        // keep camelCase for platformFees — strip everything except letters
        .replace(/[^a-zA-Z]/g, "") as Tab;
      // Normalize common variants from the LLM
      const normalized =
        tab.toLowerCase() === "platformfees"
          ? ("platformFees" as Tab)
          : (tab.toLowerCase() as Tab);
      const valid: Tab[] = [
        "dashboard",
        "events",
        "tickets",
        "attendees",
        "stalls",
        "speakers",
        "storefront",
        "settings",
        "platformFees",
        "feedback",
        "general",
      ];
      return valid.includes(normalized) ? normalized : "general";
    } catch {
      return "general";
    }
  }

  // Specialist runner
  private async runSpecialist({
    tab,
    organizerId,
    orgName,
    organizerName,
    country,
    currency,
    history,
    userMessage,
    operatorAccessTabs,
  }: {
    tab: Tab;
    organizerId: string;
    orgName: string;
    organizerName: string;
    country: string;
    currency: { symbol: string; code: string; locale: string };
    history: ConvEntry[];
    userMessage: string;
    operatorAccessTabs?: string[] | null;
  }): Promise<{
    text: string;
    botAction?: any;
    quickActions?: Array<{ label: string; action: string }>;
  }> {
    const tabPrompt = (
      ChatbotService.SPECIALIST_PROMPTS[tab] ||
      ChatbotService.SPECIALIST_PROMPTS.general
    )
      .replace(/\{ORG\}/g, orgName)
      .replace(/\{PERSON\}/g, organizerName)
      .replace(/\{CURRENCY\}/g, currency.symbol)
      .replace(/\{CURRENCY_CODE\}/g, currency.code)
      .replace(/\{COUNTRY\}/g, country);
    // Prepend the strict no-hallucination + table rules to EVERY specialist.
    const globalWithCurrency = ChatbotService.GLOBAL_RULES.replace(
      /\{CURRENCY\}/g,
      currency.symbol,
    ).replace(/\{CURRENCY_CODE\}/g, currency.code);
    const specialistPrompt = globalWithCurrency + "\n" + tabPrompt;

    const allowedToolNames = ChatbotService.TAB_TOOLS[tab] || [];
    // Filter the toolbox by both the tab AND the operator's accessTabs.
    // Tools missing from TOOL_GUARDED_BY are universally allowed.
    const tools = this.tools.filter((t) => {
      const name = (t as any).function.name as string;
      if (!allowedToolNames.includes(name)) return false;
      const required = TOOL_GUARDED_BY[name];
      return this.isOperatorAllowed(operatorAccessTabs, required ?? null);
    });

    const systemMsg: OpenAI.Chat.ChatCompletionMessageParam = {
      role: "system",
      content: specialistPrompt,
    };
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      systemMsg,
      ...history.slice(-this.HISTORY_LIMIT).map((h) => ({
        role: h.role,
        content: h.content,
        ...(h.tool_call_id ? { tool_call_id: h.tool_call_id } : {}),
        ...(h.tool_calls ? { tool_calls: h.tool_calls } : {}),
      })) as any,
    ];

    let botAction: any = undefined;

    // Iterative agent loop. Allow up to N tool calls so legitimate chains
    // (e.g. list_events → list_tickets) work, then force tool_choice:"none"
    // so the model MUST format text — preventing runaway hallucinated calls.
    const MAX_ROUNDS = 5;
    const TOOL_CALL_BUDGET = 3;
    let finalContent = "";
    let toolsExecuted = 0;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const noMoreTools = toolsExecuted >= TOOL_CALL_BUDGET;
      const res = await this.callWithFallback({
        model: this.model,
        messages,
        tools: tools.length ? tools : undefined,
        tool_choice: tools.length
          ? noMoreTools
            ? ("none" as any)
            : "auto"
          : undefined,
        temperature: 0.1,
      });
      const msg = res.choices?.[0]?.message;
      if (!msg) break;
      this.logger.log(
        `Round ${round} [${tab}] toolCalls=${(msg.tool_calls || []).length} contentLen=${(msg.content || "").length} contentPrev=${(msg.content || "").slice(0, 200).replace(/\n/g, " | ")}`,
      );

      // Try to recover tool calls that the model emitted as plain text
      // (Qwen quirk). If found, synthesize structured tool_calls.
      let recovered = msg.tool_calls;
      if (!recovered?.length && typeof msg.content === "string") {
        const synthetic = this.parseTextToolCalls(msg.content);
        if (synthetic.length) {
          recovered = synthetic as any;
          (msg as any).tool_calls = synthetic;
          (msg as any).content = "";
          this.logger.log(
            `Recovered ${synthetic.length} text-form tool_call(s) from model output`,
          );
        }
      }

      if (!recovered?.length) {
        finalContent = (msg.content || "").trim();
        break;
      }

      // If tool_choice was "none" but the model leaked tool-call markup
      // anyway, drop the recovered calls — we want it to just format.
      if (noMoreTools) {
        finalContent = (msg.content || "").trim();
        break;
      }

      messages.push(msg as any);
      for (const call of recovered) {
        if (call.type !== "function") continue;
        const name = call.function.name;
        let args: any = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {}
        // Server-side override for list_events status — never trust the LLM
        // to translate the user's intent into the right enum. Explicit time
        // scope (upcoming/past) wins over the generic "all".
        // EXCEPT when limit === 1 — that's an internal "find the latest
        // event" lookup, where the model legitimately needs upcoming.
        if (name === "list_events" && Number(args.limit) !== 1) {
          const u = (userMessage || "").toLowerCase();
          if (/\b(upcoming|future|coming up)\b/.test(u)) {
            args.status = "upcoming";
          } else if (
            /\b(past|previous|completed|history|already happened)\b/.test(u)
          ) {
            args.status = "past";
          } else if (
            /\b(all|every)\b/.test(u) ||
            /\bhow many\s+events?\b/.test(u) ||
            /\bmy events\b/.test(u)
          ) {
            args.status = "all";
          }
        }
        toolsExecuted++;
        let toolResult: any = "";
        try {
          const r = await this.runTool(name, args, organizerId, currency);
          // Capture any UI driver actions emitted by tools (navigation, opening
          // a form, etc.) so the frontend can act on them after the reply.
          if (r?.botAction) {
            botAction = r.botAction;
          }
          const annotated =
            r && typeof r === "object" && !Array.isArray(r)
              ? { ...r, _currency: currency.symbol, _currencyCode: currency.code }
              : { result: r, _currency: currency.symbol, _currencyCode: currency.code };
          toolResult = JSON.stringify(annotated);
        } catch (e: any) {
          toolResult = JSON.stringify({ error: e?.message || "tool failed" });
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: toolResult,
        } as any);
      }
    }

    // Final defensive cleanup — strip any leaked markup the model still emitted
    let text = finalContent
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
      .replace(/<function_call>[\s\S]*?<\/function_call>/gi, "")
      .replace(/^\s*\{\s*"name"\s*:\s*"[^"]+"[\s\S]*\}\s*$/m, "")
      .trim();
    if (!text) {
      this.logger.warn(
        `Empty finalContent after strip. Raw model output (first 500): ${
          finalContent.slice(0, 500).replace(/\n/g, " | ") || "<empty>"
        }`,
      );
      text = "I couldn't render that response. Try rephrasing the question.";
    }
    this.logger.log(
      `Final assistant text: ${text.slice(0, 500).replace(/\n/g, " | ")}`,
    );
    // Tab-scoped follow-up pills, filtered by the caller's operator access.
    // Pills for modules the operator can't see are hidden entirely.
    const quickActions = (QUICK_ACTIONS_BY_TAB[tab] || [])
      .filter((qa) => this.isOperatorAllowed(operatorAccessTabs, qa.requires))
      .map(({ label, action }) => ({ label, action }));
    return {
      text,
      botAction,
      ...(quickActions.length ? { quickActions } : {}),
    };
  }

  /** Detect walk-in / kiosk booking intent and return an inline
   *  ticket-booking form payload that the chatbot widget renders inside the
   *  bubble. The form drives the same /tickets/create-ticket endpoint the
   *  Walk-in Booking tab uses, so backend logic stays in one place. */
  private async maybeWalkinForm(
    message: string,
    organizerId: string,
  ): Promise<{
    text: string;
    walkinForm: {
      organizationName: string;
      country: string;
      whatsAppNumber?: string;
      UENNumber?: string;
      payNowId?: string;
      paymentURL?: string;
      events: {
        id: string;
        title: string;
        startDate?: any;
        time?: string;
        venue?: string;
        visitorTypes: { id: string; name: string; price: number; description?: string; maxCount?: number }[];
      }[];
    };
  } | null> {
    const m = message.toLowerCase();
    const intent =
      /\b(walk[-\s]?in)\b/.test(m) ||
      /\b(kiosk(?:\s+(?:order|booking|ticket))?)\b/.test(m) ||
      /\bbook\s+(?:an?\s+)?(?:offline|in[-\s]?person|counter|on[-\s]?site)\s+ticket\b/.test(
        m,
      ) ||
      /\b(book\s+a?\s+ticket\s+for\s+(?:a\s+)?(?:walk[-\s]?in|in[-\s]?person|customer))\b/.test(
        m,
      );
    if (!intent) return null;

    const orgObjId = Types.ObjectId.isValid(organizerId)
      ? new Types.ObjectId(organizerId)
      : null;
    const [org, events] = await Promise.all([
      this.organizerModel
        .findById(orgObjId)
        .select(
          "organizationName country whatsAppNumber paymentURL UENNumber payNowId",
        )
        .lean(),
      this.eventModel
        .find({
          organizer: { $in: [orgObjId, String(organizerId)] as any[] },
          $or: [{ status: "published" }, { status: { $exists: false } }],
          visibility: { $ne: "private" },
          startDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        })
        .sort({ startDate: 1 })
        .limit(40)
        .select("title startDate time venue location visitorTypes")
        .lean(),
    ]);

    if (!events.length) {
      return {
        text: "**No upcoming published events.** Create one and publish it first, then come back to book a walk-in ticket.",
        walkinForm: {
          organizationName: (org as any)?.organizationName || "",
          country: (org as any)?.country || "",
          whatsAppNumber: (org as any)?.whatsAppNumber,
          UENNumber: (org as any)?.UENNumber,
          payNowId: (org as any)?.payNowId,
          paymentURL: (org as any)?.paymentURL,
          events: [],
        },
      };
    }

    return {
      text: "Sure — pick the event, ticket type, and customer details below.",
      walkinForm: {
        organizationName: (org as any)?.organizationName || "",
        country: (org as any)?.country || "",
        whatsAppNumber: (org as any)?.whatsAppNumber,
        UENNumber: (org as any)?.UENNumber,
        payNowId: (org as any)?.payNowId,
        paymentURL: (org as any)?.paymentURL,
        events: events.map((e: any) => ({
          id: String(e._id),
          title: e.title,
          startDate: e.startDate,
          time: e.time,
          venue: e.venue || e.location,
          visitorTypes: (e.visitorTypes || []).map((v: any) => ({
            id: v.id,
            name: v.name,
            price: Number(v.price) || 0,
            description: v.description,
            maxCount: v.maxCount,
          })),
        })),
      },
    };
  }

  /** Detect "pay platform fees" intent and return an inline payment-widget
   *  payload that ChatbotWidget renders as <InlinePlatformFeeForm/> inside
   *  the bubble. The widget then calls the existing organizer-facing billing
   *  endpoints (/billing-payments/me, /billing-payments/initiate,
   *  /billing-payments/:id/mark-paid) — no new routes required.
   *
   *  Gated by the `settings` operator tab: an operator without that access
   *  hits the same friendly refusal used by the rest of Phase A. Organizers
   *  (no operator profile) always pass. */
  private async maybePlatformFeeForm(
    message: string,
    organizerId: string,
    opts: {
      orgName: string;
      operatorAccessTabs?: string[] | null;
    },
  ): Promise<{
    text: string;
    platformFeeForm?: {
      organizerName: string;
    };
  } | null> {
    const m = message.toLowerCase();
    const intent =
      /\bpay\s+(?:my\s+|the\s+)?(?:platform\s+)?(?:fee|fees|dues?|charges?|bills?|invoices?)\b/.test(
        m,
      ) ||
      /\bsettle\s+(?:my\s+|the\s+)?(?:platform\s+)?(?:fee|fees|dues?|charges?|bills?|invoices?)\b/.test(
        m,
      ) ||
      /\bpay\s+(?:my\s+)?event\s+fee/.test(m) ||
      /\bpay\s+(?:my\s+)?eventsh\s+fee/.test(m) ||
      /\bpay\s+(?:my\s+)?(?:platform|admin)\s+(?:charge|charges)/.test(m);
    if (!intent) return null;

    // Operator access gate — same friendly refusal Phase A uses for any
    // settings-module request. Keeps the "platform fees lives under
    // settings" decision consistent across chat and dashboard.
    if (!this.isOperatorAllowed(opts.operatorAccessTabs, "settings")) {
      return this.accessRefusal("settings");
    }

    return {
      text:
        "Sure — pick the event below to pay its platform fee. " +
        "I'll generate a QR code; scan it from your bank app, then tap **I have paid** so the admin can verify and confirm.",
      platformFeeForm: {
        organizerName: opts.orgName,
      },
    };
  }

  /** Deterministic short-circuit for "create event" / "edit event X" prompts.
   *  Bypasses the LLM so repeated requests always re-open the form (the LLM
   *  otherwise tends to skip the second tool call after already calling it
   *  earlier in the same conversation). Returns null if the message doesn't
   *  match either pattern. */
  private async maybeEventFormShortcut(
    message: string,
    organizerId: string,
  ): Promise<{ text: string; botAction: any } | null> {
    const m = message.toLowerCase().trim();
    this.logger.log(`[shortcut] checking message: "${m}"`);

    // ---------- helpers ----------
    // Verbs that mean "open the form for me"
    const CREATE_VERBS =
      "create|new|add|make|start|build|open|launch|set\\s*up|set-up";
    const EDIT_VERBS = "edit|update|modify|change|rename";
    // Articles / qualifiers that may sit between the verb and the noun. Any
    // sequence of these (with single spaces) is allowed — covers "an", "the",
    // "my", "another", "one more", "new", "fresh", "blank", "please", etc.
    const FILLERS =
      "(?:\\s+(?:a|an|the|my|new|another|one|more|fresh|blank|empty|please|now|quick|just|kindly|some))*";

    // ---------- ADD VISITOR ----------
    const visitorRe = new RegExp(
      `\\b(?:${CREATE_VERBS})${FILLERS}\\s+(?:visitor|attendee|customer|user|guest|patron)s?\\b`,
      "i",
    );
    if (visitorRe.test(m)) {
      this.logger.log(`[shortcut] matched ADD VISITOR`);
      return {
        text: "**Opening the Add Customer form for you.**",
        botAction: { type: "openAddVisitor" },
      };
    }

    // ---------- ADD EXHIBITOR ----------
    const exhibitorRe = new RegExp(
      `\\b(?:${CREATE_VERBS})${FILLERS}\\s+(?:exhibitor|shopkeeper|vendor|seller|stall(?:\\s*holder)?)s?\\b`,
      "i",
    );
    if (exhibitorRe.test(m)) {
      this.logger.log(`[shortcut] matched ADD EXHIBITOR`);
      return {
        text: "**Opening the Add Exhibitor form for you.**",
        botAction: { type: "openAddExhibitor" },
      };
    }

    // ---------- EDIT EVENT (must run before CREATE EVENT) ----------
    // Captures the event name after "edit/update/modify/change [the/my] event".
    const editMatch = m.match(
      new RegExp(
        `\\b(?:${EDIT_VERBS})${FILLERS}\\s+(?:event\\s+)?["']?(.+?)["']?\\s*$`,
        "i",
      ),
    );
    if (editMatch && editMatch[1] && editMatch[1].length >= 2) {
      const name = editMatch[1].trim();
      const banned = ["event", "the event", "my event", "this event"];
      if (!banned.includes(name)) {
        const orgObjId = Types.ObjectId.isValid(organizerId)
          ? new Types.ObjectId(organizerId)
          : null;
        const ev = await this.eventModel
          .findOne({
            organizer: { $in: [orgObjId, String(organizerId)] as any[] },
            title: { $regex: name, $options: "i" },
          })
          .lean();
        if (ev) {
          this.logger.log(`[shortcut] matched EDIT EVENT for "${name}"`);
          const evObj: any = ev;
          return {
            text: `**Opening the editor for "${evObj.title}".**`,
            botAction: {
              type: "openEditEvent",
              eventId: String(evObj._id),
              eventTitle: evObj.title,
            },
          };
        }
        // Event not found — fall through to LLM so it can list events
        return null;
      }
    }

    // ---------- CREATE EVENT ----------
    const createEventRe = new RegExp(
      `\\b(?:${CREATE_VERBS})${FILLERS}\\s+event\\b`,
      "i",
    );
    if (createEventRe.test(m)) {
      this.logger.log(`[shortcut] matched CREATE EVENT`);
      return {
        text: "**Opening the Create Event form for you.**",
        botAction: { type: "openCreateEvent" },
      };
    }

    this.logger.log(`[shortcut] no match — falling through to LLM`);
    return null;
  }

  /** Detect "<thing> per event" / "show <thing> for an event" prompts and
   *  return a deterministic event picker payload. Frontend renders a
   *  dropdown form so the user picks the event explicitly — avoids the
   *  LLM guessing "latest". */
  /** Org-wide list intents (visitors / exhibitors / space templates) — pure
   *  data → markdown render. Skips the LLM entirely so 100+ rows return in
   *  ~100ms instead of 5-15s. */
  private async maybeListShortcut(
    message: string,
    organizerId: string,
  ): Promise<{ text: string } | null> {
    const m = message.toLowerCase().trim();
    const orgObjId = Types.ObjectId.isValid(organizerId)
      ? new Types.ObjectId(organizerId)
      : null;
    if (!orgObjId) return null;

    const escapeCell = (v: any) => {
      const s = v == null || v === "" ? "—" : String(v);
      // Pipes break markdown tables; replace with the visually identical Unicode bar.
      return s.replace(/\|/g, "│").replace(/\n/g, " ");
    };

    // ---- Visitors ----
    if (
      /\b(list|show( me)?|all)\b.*\b(visitors?|customers?)\b/.test(m) &&
      !/\b(per|for)\s+(an?\s+|the\s+)?event\b/.test(m)
    ) {
      const docs = await this.userModel
        .find({ provider: "Shopkeeper", providerId: String(organizerId) })
        .sort({ createdAt: -1 })
        .lean();
      if (!docs.length) {
        return { text: "**No visitors yet.** Add or import some from the Visitors tab." };
      }
      const header = "| # | Name | Email | WhatsApp | Created |";
      const sep = "| --- | --- | --- | --- | --- |";
      const rows = (docs as any[]).map((u, i) => {
        const name =
          u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim();
        const created = u.createdAt
          ? new Date(u.createdAt).toISOString().slice(0, 10)
          : "";
        return `| ${i + 1} | ${escapeCell(name)} | ${escapeCell(u.email)} | ${escapeCell(u.whatsAppNumber)} | ${escapeCell(created)} |`;
      });
      const text =
        `You have **${docs.length} visitors**.\n\n` +
        [header, sep, ...rows].join("\n");
      return { text };
    }

    // ---- Exhibitors ----
    if (
      /\b(list|show( me)?|all)\b.*\b(exhibitors?|vendors?)\b/.test(m) &&
      !/\b(per|for)\s+(an?\s+|the\s+)?event\b/.test(m) &&
      !/\bpending\b/.test(m) &&
      !/\bapproved\b/.test(m)
    ) {
      const [orgVendors, stalls] = await Promise.all([
        this.vendorModel.find({ organizerId: orgObjId }).lean(),
        this.stallModel
          .find({ organizerId: orgObjId })
          .populate(
            "shopkeeperId",
            "name email businessEmail whatsAppNumber whatsappNumber phone phoneNumber shopName businessName brandName businessCategory country createdAt",
          )
          .lean(),
      ]);
      const byId = new Map<string, any>();
      for (const v of orgVendors as any[]) byId.set(String(v._id), v);
      for (const s of stalls as any[]) {
        const v = s.shopkeeperId;
        if (!v?._id) continue;
        const k = String(v._id);
        if (!byId.has(k)) byId.set(k, v);
      }
      const merged = Array.from(byId.values()).sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
      if (!merged.length) {
        return { text: "**No exhibitors yet.** Add or import some from the Exhibitors tab." };
      }
      const header =
        "| # | Name | Shop / Business | Email | WhatsApp | Category | Country |";
      const sep = "| --- | --- | --- | --- | --- | --- | --- |";
      const rows = merged.map((v: any, i: number) => {
        const business = v.shopName || v.businessName || v.brandName || "";
        const email = v.email || v.businessEmail || "";
        const wa = v.whatsAppNumber || v.whatsappNumber || "";
        return `| ${i + 1} | ${escapeCell(v.name)} | ${escapeCell(business)} | ${escapeCell(email)} | ${escapeCell(wa)} | ${escapeCell(v.businessCategory)} | ${escapeCell(v.country)} |`;
      });
      const text =
        `You have **${merged.length} exhibitors**.\n\n` +
        [header, sep, ...rows].join("\n");
      return { text };
    }

    // ---- Space templates ----
    if (
      /\b(list|show( me)?|my|all)\b.*\b(space\s+templates?|templates?)\b/.test(m) &&
      !/\b(round\s*table|speaker)\s+template/.test(m)
    ) {
      const docs = await this.templateModel
        .find({ organizerId: orgObjId, type: "space" })
        .sort({ name: 1, createdAt: -1 })
        .lean();
      if (!docs.length) {
        return {
          text:
            "**No space templates yet.** They're saved automatically the next time you add Spaces to an event.",
        };
      }
      const header =
        "| # | Name | Size | Table Price | Booking Price | Deposit |";
      const sep = "| --- | --- | --- | --- | --- | --- |";
      const rows = (docs as any[]).map((t, i) => {
        const p = t.payload || {};
        const size =
          p.width && p.height ? `${p.width}×${p.height}cm` : "—";
        return `| ${i + 1} | ${escapeCell(t.name)} | ${escapeCell(size)} | ${escapeCell(p.tablePrice)} | ${escapeCell(p.bookingPrice)} | ${escapeCell(p.depositPrice)} |`;
      });
      const text =
        `You have **${docs.length} saved Space templates**.\n\n` +
        [header, sep, ...rows].join("\n");
      return { text };
    }

    return null;
  }

  /** Participation report for a single event — Visitors, Exhibitors,
   *  Speakers, Round-Table attendees as four detailed markdown tables.
   *  Skips the LLM so every row makes it to the user (the LLM was reliably
   *  emitting only the totals stats and dropping the tables when sections
   *  got large). */
  private async maybeParticipationReport(
    message: string,
    organizerId: string,
    currency: { symbol: string; code?: string; locale?: string },
  ): Promise<{ text: string } | null> {
    const orgObjId = Types.ObjectId.isValid(organizerId)
      ? new Types.ObjectId(organizerId)
      : null;
    if (!orgObjId) return null;

    // Recognise either the explicit follow-up form ('show participation
    // report for "<title>"') or natural variants ('participants of <title>').
    const m = message.trim();
    const lower = m.toLowerCase();
    const isParticipationIntent =
      /participation\s*report/.test(lower) ||
      /\bparticipants?\s+of\b/.test(lower) ||
      /\bwho\s+is\s+attending\b/.test(lower) ||
      /\blist\s+all\s+attendees\s+for\b/.test(lower) ||
      /\beveryone\s+attending\b/.test(lower);
    if (!isParticipationIntent) return null;

    // Pull the event name from a quoted span first; fall back to text after
    // the trigger phrase.
    let eventName: string | null = null;
    const quoted = m.match(/"([^"]+)"|'([^']+)'/);
    if (quoted) eventName = quoted[1] || quoted[2] || null;
    if (!eventName) {
      const after = m.match(
        /(?:report|participants?\s+of|attending|attendees\s+for)\s+(?:the\s+)?(.+)$/i,
      );
      if (after) eventName = after[1].replace(/[.?!]+$/, "").trim();
    }
    if (!eventName) return null;

    const ev = await this.eventModel
      .findOne({
        organizer: { $in: [orgObjId, String(organizerId)] as any[] },
        title: { $regex: this.escapeRegex(eventName), $options: "i" },
      })
      .lean();
    if (!ev) {
      return { text: `**No event matching "${eventName}".** Try the exact title.` };
    }
    const evObj: any = ev;

    const [tickets, stalls, speakers, roundBookings] = await Promise.all([
      this.ticketModel
        .find({
          eventId: evObj._id,
          organizerId: orgObjId,
          paymentConfirmed: true,
        })
        .sort({ purchaseDate: -1 })
        .lean(),
      this.stallModel
        .find({ eventId: evObj._id, organizerId: orgObjId })
        .populate("shopkeeperId", "name email whatsAppNumber whatsappNumber shopName")
        .lean(),
      this.speakerRequestModel
        .find({ eventId: evObj._id, organizerId: orgObjId })
        .lean(),
      this.roundTableBookingModel
        .find({ eventId: evObj._id, organizerId: orgObjId })
        .lean(),
    ]);

    const sym = currency?.symbol || "";
    const cell = (v: any) => {
      const s = v == null || v === "" ? "—" : String(v);
      return s.replace(/\|/g, "│").replace(/\n/g, " ");
    };
    const money = (v: number) => `${sym}${Number(v || 0).toLocaleString()}`;

    const sections: string[] = [];

    if (tickets.length) {
      sections.push(`### Visitors (${tickets.length})`);
      sections.push("| # | Name | Email | WhatsApp | Tickets | Amount | Attended |");
      sections.push("| --- | --- | --- | --- | --- | --- | --- |");
      (tickets as any[]).forEach((t, i) => {
        const qty =
          t.ticketDetails?.reduce(
            (s: number, d: any) => s + (d.quantity || 0),
            0,
          ) || 0;
        sections.push(
          `| ${i + 1} | ${cell(t.customerName)} | ${cell(t.customerEmail)} | ${cell(t.customerWhatsapp)} | ${qty} | ${money(t.totalAmount)} | ${t.attendance ? "✓" : "✗"} |`,
        );
      });
      sections.push("");
    }

    if (stalls.length) {
      sections.push(`### Exhibitors (${stalls.length})`);
      sections.push("| # | Name | Business | Phone | Status | Payment | Amount |");
      sections.push("| --- | --- | --- | --- | --- | --- | --- |");
      (stalls as any[]).forEach((s, i) => {
        const name =
          s.shopkeeperId?.name || s.nameOfApplicant || s.brandName || "";
        const biz =
          s.shopkeeperId?.shopName || s.businessName || s.brandName || "";
        const ph =
          s.shopkeeperId?.whatsAppNumber ||
          s.shopkeeperId?.whatsappNumber ||
          "";
        sections.push(
          `| ${i + 1} | ${cell(name)} | ${cell(biz)} | ${cell(ph)} | ${cell(s.status || "Pending")} | ${cell(s.paymentStatus || "Unpaid")} | ${money(s.grandTotal)} |`,
        );
      });
      sections.push("");
    }

    if (speakers.length) {
      sections.push(`### Speakers (${speakers.length})`);
      sections.push("| # | Name | Organization | Phone | Status | Fee |");
      sections.push("| --- | --- | --- | --- | --- | --- |");
      (speakers as any[]).forEach((sp, i) => {
        sections.push(
          `| ${i + 1} | ${cell(sp.name)} | ${cell(sp.organization)} | ${cell(sp.phone || sp.whatsAppNumber)} | ${cell(sp.status || "Pending")} | ${money(sp.isCharged ? sp.fee || 0 : 0)} |`,
        );
      });
      sections.push("");
    }

    if (roundBookings.length) {
      sections.push(`### Round Tables (${roundBookings.length})`);
      sections.push("| # | Name | Phone | Table | Seats | Payment | Amount |");
      sections.push("| --- | --- | --- | --- | --- | --- | --- |");
      (roundBookings as any[]).forEach((b, i) => {
        sections.push(
          `| ${i + 1} | ${cell(b.visitorName)} | ${cell(b.visitorPhone)} | ${cell(b.tableName)} | ${b.numberOfSeats || 0} | ${cell(b.paymentStatus || "Unpaid")} | ${money(b.amount)} |`,
        );
      });
      sections.push("");
    }

    const total =
      tickets.length + stalls.length + speakers.length + roundBookings.length;
    if (total === 0) {
      return {
        text: `**${evObj.title}** has no participants yet — no tickets sold, no stalls booked, no speakers, no round-table bookings.`,
      };
    }

    const header = `**${evObj.title}** has **${total} participants** across all categories.\n\n`;
    return { text: header + sections.join("\n") };
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private async maybeEventPicker(
    message: string,
    organizerId: string,
  ): Promise<{
    text: string;
    eventPicker: {
      intent: string;
      label: string;
      actionTemplate: string;
      events: { id: string; title: string }[];
    };
  } | null> {
    const m = message.toLowerCase();
    const intentRe =
      /\b(tickets?|stalls?|speakers?|attendees?|round\s*tables?|participation(?:\s*report)?)\s+(?:per|for)\s+(?:an?\s+|the\s+)?event\b/i;
    const match = m.match(intentRe);
    if (!match) return null;

    // Skip if the user already pointed at a specific event.
    if (
      /\bmy\s+latest\s+event\b|\bthe\s+latest\s+event\b|\bcurrent\s+event\b/i.test(
        m,
      )
    )
      return null;
    if (/"[^"]+"|'[^']+'/.test(message)) return null;

    const rawIntent = match[1].toLowerCase().replace(/\s+/g, " ");
    const intent = /round/.test(rawIntent)
      ? "round tables"
      : /participation/.test(rawIntent)
        ? "participation report"
        : rawIntent.replace(/s$/, "") + "s";

    const orgObjId = Types.ObjectId.isValid(organizerId)
      ? new Types.ObjectId(organizerId)
      : null;
    const events = await this.eventModel
      .find({
        organizer: { $in: [orgObjId, String(organizerId)] as any[] },
      })
      .sort({ startDate: -1 })
      .limit(50)
      .select("title")
      .lean();

    if (!events.length) {
      return {
        text: "**No events yet.** Create one first.",
        eventPicker: {
          intent,
          label: intent,
          actionTemplate: "",
          events: [],
        },
      };
    }

    const verb =
      intent === "tickets"
        ? "Show tickets for"
        : intent === "stalls"
          ? "Show stalls for"
          : intent === "speakers"
            ? "Show speakers for"
            : intent === "attendees"
              ? "List attendees for"
              : intent === "participation report"
                ? "Show participation report for"
                : "Show round tables for";

    return {
      text: `Pick an event to see its **${intent}**:`,
      eventPicker: {
        intent,
        label: intent,
        actionTemplate: `${verb} "{title}"`,
        events: events.map((e: any) => ({
          id: String(e._id),
          title: e.title,
        })),
      },
    };
  }

  /** Recover Qwen-style "<tool_call>{...}</tool_call>" markup from text and
   *  return it as a structured tool_calls array the agent loop can execute. */
  private parseTextToolCalls(content: string): any[] {
    const out: any[] = [];
    const tagPattern = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;
    let m: RegExpExecArray | null;
    while ((m = tagPattern.exec(content)) !== null) {
      try {
        const obj = JSON.parse(m[1]);
        if (obj?.name && obj?.arguments !== undefined) {
          out.push({
            id: `tc_${Date.now()}_${out.length}`,
            type: "function",
            function: {
              name: obj.name,
              arguments:
                typeof obj.arguments === "string"
                  ? obj.arguments
                  : JSON.stringify(obj.arguments),
            },
          });
        }
      } catch {
        /* ignore malformed */
      }
    }
    // Also look for a bare top-level {"name":..,"arguments":..} JSON
    if (!out.length) {
      const bare = content
        .trim()
        .match(/^\s*(\{[\s\S]*"name"\s*:\s*"[^"]+"[\s\S]*\})\s*$/);
      if (bare) {
        try {
          const obj = JSON.parse(bare[1]);
          if (obj?.name && obj?.arguments !== undefined) {
            out.push({
              id: `tc_${Date.now()}_0`,
              type: "function",
              function: {
                name: obj.name,
                arguments:
                  typeof obj.arguments === "string"
                    ? obj.arguments
                    : JSON.stringify(obj.arguments),
              },
            });
          }
        } catch {
          /* ignore */
        }
      }
    }
    return out;
  }

  // Resilient call (primary → fallback model on 429)
  private async callWithFallback(
    args: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  ) {
    try {
      return await this.ai.chat.completions.create({
        ...args,
        stream: false,
      });
    } catch (err: any) {
      if (this.isRateLimit(err) && args.model !== this.fallbackModel) {
        this.logger.warn(
          `Rate limit on ${args.model} → falling back to ${this.fallbackModel}`,
        );
        return await this.ai.chat.completions.create({
          ...args,
          model: this.fallbackModel,
          stream: false,
        });
      }
      throw err;
    }
  }

  // ============================================================
  // TOOL IMPLEMENTATIONS
  // ============================================================
  private async runTool(
    name: string,
    args: any,
    organizerId: string,
    currency: { symbol: string; code: string; locale: string } = {
      symbol: "$",
      code: "USD",
      locale: "en-US",
    },
  ): Promise<any> {
    const orgObjId = Types.ObjectId.isValid(organizerId)
      ? new Types.ObjectId(organizerId)
      : null;
    const fmt = (n: number) => formatMoney(n, currency);

    switch (name) {
      case "get_dashboard_stats": {
        const [events, ticketsAgg] = await Promise.all([
          this.eventModel.countDocuments({ organizer: orgObjId }),
          this.ticketModel.aggregate([
            { $match: { organizerId: orgObjId } },
            {
              $group: {
                _id: null,
                tickets: { $sum: 1 },
                revenue: {
                  $sum: { $cond: ["$paymentConfirmed", "$totalAmount", 0] },
                },
              },
            },
          ]),
        ]);
        const revenue = ticketsAgg[0]?.revenue || 0;
        return {
          events,
          tickets: ticketsAgg[0]?.tickets || 0,
          revenue,
          revenueFormatted: fmt(revenue),
        };
      }

      case "get_revenue_trend": {
        const period = args.period || "month";
        const now = new Date();
        const start = new Date();
        if (period === "today") start.setHours(0, 0, 0, 0);
        else if (period === "week") start.setDate(now.getDate() - 7);
        else if (period === "month") start.setMonth(now.getMonth() - 1);
        else if (period === "quarter") start.setMonth(now.getMonth() - 3);
        else if (period === "year") start.setFullYear(now.getFullYear() - 1);
        const agg = await this.ticketModel.aggregate([
          {
            $match: {
              organizerId: orgObjId,
              purchaseDate: { $gte: start },
            },
          },
          {
            $group: {
              _id: null,
              tickets: { $sum: 1 },
              revenue: {
                $sum: { $cond: ["$paymentConfirmed", "$totalAmount", 0] },
              },
            },
          },
        ]);
        const revenue = agg[0]?.revenue || 0;
        return {
          period,
          tickets: agg[0]?.tickets || 0,
          revenue,
          revenueFormatted: fmt(revenue),
          from: start.toISOString().slice(0, 10),
          to: now.toISOString().slice(0, 10),
        };
      }

      case "get_top_events": {
        const top = await this.ticketModel.aggregate([
          { $match: { organizerId: orgObjId } },
          {
            $group: {
              _id: "$eventId",
              eventTitle: { $first: "$eventTitle" },
              tickets: { $sum: 1 },
              revenue: {
                $sum: { $cond: ["$paymentConfirmed", "$totalAmount", 0] },
              },
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 5 },
        ]);
        return top.map((t: any) => ({
          eventTitle: t.eventTitle || "Untitled",
          tickets: t.tickets,
          revenue: t.revenue,
          revenueFormatted: fmt(t.revenue),
        }));
      }

      case "list_events": {
        const status = args.status || "all";
        const limit = Math.min(args.limit || 100, 200);
        const now = new Date();
        // Match both ObjectId and string forms — older docs may store either.
        const orgMatch = orgObjId
          ? { $in: [orgObjId, String(organizerId)] as any[] }
          : String(organizerId);
        const filter: any = { organizer: orgMatch };
        if (status === "upcoming") filter.startDate = { $gte: now };
        else if (status === "past") filter.startDate = { $lt: now };
        const events = await this.eventModel
          .find(filter)
          .sort({ startDate: 1 })
          .limit(limit)
          .lean();
        const totalCount = await this.eventModel.countDocuments(filter);
        this.logger.log(
          `list_events org=${organizerId} status=${status} found=${events.length} totalCount=${totalCount}`,
        );
        // Live ticket counts (paid) per event in one aggregation
        const eventIds = events.map((e: any) => e._id);
        const soldAgg = eventIds.length
          ? await this.ticketModel.aggregate([
              {
                $match: {
                  eventId: { $in: eventIds },
                  paymentConfirmed: true,
                },
              },
              { $group: { _id: "$eventId", sold: { $sum: 1 } } },
            ])
          : [];
        const soldByEvent = new Map(
          soldAgg.map((s: any) => [String(s._id), s.sold]),
        );
        return {
          total: totalCount,
          shown: events.length,
          events: events.map((e: any) => ({
            id: String(e._id),
            title: e.title,
            startDate: e.startDate,
            endDate: e.endDate,
            venue: e.location || "",
            capacity: e.totalTickets || 0,
            ticketsSold: soldByEvent.get(String(e._id)) || 0,
            status: e.status || "draft",
            visibility: e.visibility || "public",
          })),
        };
      }

      case "get_event_detail": {
        const ev = await this.eventModel
          .findOne({
            organizer: orgObjId,
            title: { $regex: args.event_name, $options: "i" },
          })
          .lean();
        if (!ev) return { error: `No event matching "${args.event_name}"` };
        const ticketsAgg = await this.ticketModel.aggregate([
          { $match: { eventId: (ev as any)._id } },
          {
            $group: {
              _id: null,
              tickets: { $sum: 1 },
              revenue: {
                $sum: { $cond: ["$paymentConfirmed", "$totalAmount", 0] },
              },
            },
          },
        ]);
        const evRev = ticketsAgg[0]?.revenue || 0;
        return {
          ...ev,
          ticketsSold: ticketsAgg[0]?.tickets || 0,
          revenue: evRev,
          revenueFormatted: fmt(evRev),
        };
      }

      case "create_event":
      case "create_full_event": {
        // Don't actually write to the DB from the chat — the user wanted us to
        // hand them off to the Create Event form so they can finish in the UI.
        return {
          message: "Opening the Create Event form for you.",
          botAction: { type: "openCreateEvent" },
        };
      }

      case "request_edit_event": {
        // Resolve event by partial title and tell the dashboard to open the
        // Edit form pre-filled with that event's data.
        const ev = await this.eventModel
          .findOne({
            organizer: { $in: [orgObjId, String(organizerId)] as any[] },
            title: { $regex: args.event_name, $options: "i" },
          })
          .lean();
        if (!ev) {
          return { error: `No event matching "${args.event_name}"` };
        }
        const evObj: any = ev;
        return {
          eventId: String(evObj._id),
          eventTitle: evObj.title,
          message: `Opening the editor for "${evObj.title}".`,
          botAction: {
            type: "openEditEvent",
            eventId: String(evObj._id),
            eventTitle: evObj.title,
          },
        };
      }

      case "list_tickets": {
        const limit = Math.min(args.limit || 10, 50);
        // Dual-form match — older tickets may have organizerId stored as string.
        const filter: any = {
          organizerId: orgObjId
            ? { $in: [orgObjId, String(organizerId)] as any[] }
            : String(organizerId),
        };
        if (args.event_name) {
          const ev = await this.eventModel.findOne({
            organizer: { $in: [orgObjId, String(organizerId)] as any[] },
            title: { $regex: args.event_name, $options: "i" },
          });
          if (ev) filter.eventId = (ev as any)._id;
        }
        if (args.status === "pending") filter.paymentConfirmed = false;
        if (args.status === "confirmed") filter.paymentConfirmed = true;
        const tickets = await this.ticketModel
          .find(filter)
          .sort({ purchaseDate: -1 })
          .limit(limit)
          .lean();
        this.logger.log(
          `list_tickets org=${organizerId} event=${args.event_name || ""} status=${args.status || "any"} returned=${tickets.length}`,
        );
        return tickets.map((t: any) => ({
          ticketId: t.ticketId,
          eventTitle: t.eventTitle,
          customer: t.customerName,
          email: t.customerEmail,
          amount: t.totalAmount,
          amountFormatted: fmt(t.totalAmount),
          paid: !!t.paymentConfirmed,
          attended: !!t.attendance,
          purchaseDate: t.purchaseDate,
        }));
      }

      case "get_ticket_detail": {
        const t = await this.ticketModel
          .findOne({ ticketId: args.ticketId, organizerId: orgObjId })
          .lean();
        if (!t) return { error: "Ticket not found" };
        return t;
      }

      case "mark_ticket_used": {
        const r = await this.ticketModel.findOneAndUpdate(
          { ticketId: args.ticketId, organizerId: orgObjId },
          { $set: { isUsed: true, attendance: true, usedAt: new Date() } },
          { new: true },
        );
        if (!r) return { error: "Ticket not found" };
        return { message: `Ticket ${args.ticketId} marked as used.` };
      }

      case "list_attendees": {
        const ev = await this.eventModel.findOne({
          organizer: orgObjId,
          title: { $regex: args.event_name, $options: "i" },
        });
        if (!ev) return { error: `No event matching "${args.event_name}"` };
        const tickets = await this.ticketModel
          .find({ eventId: (ev as any)._id, organizerId: orgObjId })
          .limit(Math.min(args.limit || 50, 100))
          .lean();
        return tickets.map((t: any) => ({
          name: t.customerName,
          email: t.customerEmail,
          whatsapp: t.customerWhatsapp,
          paid: !!t.paymentConfirmed,
          attended: !!t.attendance,
        }));
      }

      case "search_attendee": {
        const q = String(args.query || "").trim();
        if (!q) return { error: "Empty query" };
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const tickets = await this.ticketModel
          .find({
            organizerId: orgObjId,
            $or: [{ customerName: regex }, { customerEmail: regex }],
          })
          .limit(20)
          .lean();
        return tickets.map((t: any) => ({
          eventTitle: t.eventTitle,
          name: t.customerName,
          email: t.customerEmail,
          whatsapp: t.customerWhatsapp,
        }));
      }

      case "list_stalls": {
        const limit = Math.min(args.limit || 20, 50);
        // If event_name is given, query the Stall model (per-event bookings).
        // Otherwise fall back to the global Vendor list (legacy behavior).
        if (args.event_name) {
          const ev = await this.eventModel.findOne({
            organizer: { $in: [orgObjId, String(organizerId)] as any[] },
            title: { $regex: args.event_name, $options: "i" },
          });
          if (!ev) return { error: `No event matching "${args.event_name}"` };
          const stallFilter: any = {
            organizerId: orgObjId,
            eventId: (ev as any)._id,
          };
          if (args.status === "pending") stallFilter.status = "Pending";
          else if (args.status === "approved") stallFilter.status = "Approved";
          const stalls = await this.stallModel
            .find(stallFilter)
            .limit(limit)
            .lean();
          // Manual vendor lookup using the raw connection — sidesteps any
          // model-registration weirdness across modules.
          const vendorIds = Array.from(
            new Set(stalls.map((s: any) => String(s.shopkeeperId)).filter(Boolean)),
          );
          const objIds = vendorIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));
          const vendorsCol = this.stallModel.db.collection("vendors");
          const vendors = await vendorsCol
            .find({
              $or: [
                { _id: { $in: objIds as any[] } },
                { _id: { $in: vendorIds as any[] } },
              ],
            })
            .toArray();
          const vById = new Map(vendors.map((v: any) => [String(v._id), v]));
          this.logger.log(
            `list_stalls event="${args.event_name}" status=${args.status || "any"} returned=${stalls.length} vendors=${vendors.length} firstShopkeeperId=${vendorIds[0] || "none"}`,
          );
          return stalls.map((s: any) => {
            const v: any = vById.get(String(s.shopkeeperId)) || {};
            return {
              vendor: v.name || "—",
              business: v.businessName || v.shopName || "—",
              email: v.email || "—",
              whatsapp: v.whatsAppNumber || v.whatsappNumber || "—",
              status: s.status,
              paymentStatus: s.paymentStatus,
              total: s.grandTotal || 0,
              totalFormatted: fmt(s.grandTotal || 0),
              paid: s.paidAmount || 0,
              paidFormatted: fmt(s.paidAmount || 0),
            };
          });
        }
        const filter: any = {};
        if (args.status === "pending") filter.approved = false;
        else if (args.status === "approved") filter.approved = true;
        const vendors = await this.vendorModel
          .find(filter)
          .limit(limit)
          .lean();
        return vendors.map((v: any) => ({
          name: v.name,
          businessName: v.businessName || v.shopName,
          email: v.email,
          whatsapp: v.whatsAppNumber || v.whatsappNumber,
          approved: v.approved,
        }));
      }

      case "list_speakers": {
        const filter: any = { organizerId: orgObjId };
        if (args.event_name) {
          const ev = await this.eventModel.findOne({
            organizer: orgObjId,
            title: { $regex: args.event_name, $options: "i" },
          });
          if (ev) filter.eventId = (ev as any)._id;
        }
        if (args.status) filter.status = args.status;
        const speakers = await this.speakerRequestModel
          .find(filter)
          .limit(20)
          .lean();
        return speakers.map((s: any) => ({
          name: s.name,
          email: s.email,
          organization: s.organization,
          status: s.status,
          fee: s.fee,
        }));
      }

      case "get_subscription": {
        const org = await this.organizerModel.findById(orgObjId).lean();
        if (!org) return { error: "Organizer not found" };
        const plan = (org as any).planId
          ? await this.planModel.findById((org as any).planId).lean()
          : null;
        return {
          subscribed: !!(org as any).subscribed,
          planName: plan ? (plan as any).planName : null,
          validUntil: (org as any).planExpiryDate,
          modules: plan ? (plan as any).modules : null,
        };
      }

      case "list_plans": {
        // Match the per-organizer visibility filter used by
        // /plans/for-organizer/:id — plans whose `visibleToOrganizers`
        // is unset, empty, or contains this organizer's id.
        const plans = await this.planModel
          .find({
            moduleType: "Organizer",
            isActive: true,
            $or: [
              { visibleToOrganizers: { $exists: false } },
              { visibleToOrganizers: { $size: 0 } },
              { visibleToOrganizers: String(organizerId) },
            ],
          })
          .lean();
        return plans.map((p: any) => ({
          name: p.planName,
          price: p.price,
          priceFormatted: fmt(p.price),
          validityInDays: p.validityInDays,
          isDefault: !!p.isDefault,
          features: p.features,
        }));
      }

      case "list_operators": {
        const ops = await this.operatorModel
          .find({ organizerId: String(organizerId) })
          .lean();
        return ops.map((o: any) => ({
          name: o.name,
          email: o.email,
          whatsapp: o.whatsAppNumber,
          accessTabs: o.accessTabs,
        }));
      }

      case "get_organizer_info": {
        const org = await this.organizerModel
          .findById(orgObjId)
          .select(
            "name organizationName email country businessEmail whatsAppNumber commissionPercentage",
          )
          .lean();
        return org || { error: "Organizer not found" };
      }

      case "get_pending_approvals": {
        const [pendingSpeakers, pendingStalls] = await Promise.all([
          this.speakerRequestModel.countDocuments({
            organizerId: orgObjId,
            status: "Pending",
          }),
          this.stallModel.countDocuments({
            organizerId: orgObjId,
            status: "Pending",
          }),
        ]);
        return {
          pendingSpeakerRequests: pendingSpeakers,
          pendingStallRegistrations: pendingStalls,
        };
      }

      case "get_events_breakdown": {
        const orgMatch = {
          organizer: { $in: [orgObjId, String(organizerId)] as any[] },
        };
        const [statusBreak, visibilityBreak, categoryBreak, capacityAgg] =
          await Promise.all([
            this.eventModel.aggregate([
              { $match: orgMatch },
              { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
            this.eventModel.aggregate([
              { $match: orgMatch },
              { $group: { _id: "$visibility", count: { $sum: 1 } } },
            ]),
            this.eventModel.aggregate([
              { $match: orgMatch },
              { $group: { _id: "$category", count: { $sum: 1 } } },
            ]),
            this.eventModel.aggregate([
              { $match: orgMatch },
              {
                $group: {
                  _id: null,
                  totalEvents: { $sum: 1 },
                  totalCapacity: { $sum: { $ifNull: ["$totalTickets", 0] } },
                },
              },
            ]),
          ]);
        const totalEvents = capacityAgg[0]?.totalEvents || 0;
        const totalCapacity = capacityAgg[0]?.totalCapacity || 0;
        // Tickets sold across all events
        const sold = await this.ticketModel.aggregate([
          {
            $match: {
              organizerId: orgObjId,
              paymentConfirmed: true,
            },
          },
          {
            $group: {
              _id: null,
              ticketsSold: { $sum: 1 },
              revenue: { $sum: "$totalAmount" },
            },
          },
        ]);
        const ticketsSold = sold[0]?.ticketsSold || 0;
        const revenue = sold[0]?.revenue || 0;
        return {
          totalEvents,
          totalCapacity,
          ticketsSold,
          occupancyPercent: totalCapacity
            ? Math.round((ticketsSold / totalCapacity) * 100)
            : 0,
          averageTicketPrice: ticketsSold ? Math.round(revenue / ticketsSold) : 0,
          averageTicketPriceFormatted: fmt(
            ticketsSold ? Math.round(revenue / ticketsSold) : 0,
          ),
          revenue,
          revenueFormatted: fmt(revenue),
          byStatus: statusBreak.map((s: any) => ({
            status: s._id || "unknown",
            count: s.count,
          })),
          byVisibility: visibilityBreak.map((s: any) => ({
            visibility: s._id || "unknown",
            count: s.count,
          })),
          byCategory: categoryBreak
            .filter((c: any) => c._id)
            .map((c: any) => ({ category: c._id, count: c.count })),
        };
      }

      case "get_stalls_analytics": {
        const [statusBreak, paymentBreak, totals, perEvent] = await Promise.all([
          this.stallModel.aggregate([
            { $match: { organizerId: orgObjId } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ]),
          this.stallModel.aggregate([
            { $match: { organizerId: orgObjId } },
            { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
          ]),
          this.stallModel.aggregate([
            { $match: { organizerId: orgObjId } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                grandTotalSum: { $sum: { $ifNull: ["$grandTotal", 0] } },
                paidSum: { $sum: { $ifNull: ["$paidAmount", 0] } },
              },
            },
          ]),
          this.stallModel.aggregate([
            { $match: { organizerId: orgObjId } },
            {
              $group: {
                _id: "$eventId",
                count: { $sum: 1 },
                revenue: { $sum: { $ifNull: ["$paidAmount", 0] } },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: "events",
                localField: "_id",
                foreignField: "_id",
                as: "event",
              },
            },
            { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
          ]),
        ]);
        return {
          totalStalls: totals[0]?.total || 0,
          totalBookingValue: totals[0]?.grandTotalSum || 0,
          totalBookingValueFormatted: fmt(totals[0]?.grandTotalSum || 0),
          totalCollected: totals[0]?.paidSum || 0,
          totalCollectedFormatted: fmt(totals[0]?.paidSum || 0),
          byStatus: statusBreak.map((s: any) => ({
            status: s._id || "unknown",
            count: s.count,
          })),
          byPaymentStatus: paymentBreak.map((s: any) => ({
            paymentStatus: s._id || "unknown",
            count: s.count,
          })),
          topEventsByStallCount: perEvent.map((e: any) => ({
            eventTitle: e.event?.title || "Untitled",
            stallCount: e.count,
            collected: e.revenue,
            collectedFormatted: fmt(e.revenue),
          })),
        };
      }

      case "get_speakers_analytics": {
        const [statusBreak, paymentBreak, totals, perEvent] = await Promise.all([
          this.speakerRequestModel.aggregate([
            { $match: { organizerId: orgObjId } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ]),
          this.speakerRequestModel.aggregate([
            { $match: { organizerId: orgObjId } },
            { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
          ]),
          this.speakerRequestModel.aggregate([
            { $match: { organizerId: orgObjId } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                feeSum: { $sum: { $ifNull: ["$fee", 0] } },
                keynotes: {
                  $sum: { $cond: [{ $eq: ["$isKeynote", true] }, 1, 0] },
                },
              },
            },
          ]),
          this.speakerRequestModel.aggregate([
            { $match: { organizerId: orgObjId } },
            { $group: { _id: "$eventId", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: "events",
                localField: "_id",
                foreignField: "_id",
                as: "event",
              },
            },
            { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
          ]),
        ]);
        return {
          totalRequests: totals[0]?.total || 0,
          totalFees: totals[0]?.feeSum || 0,
          totalFeesFormatted: fmt(totals[0]?.feeSum || 0),
          keynoteCount: totals[0]?.keynotes || 0,
          byStatus: statusBreak.map((s: any) => ({
            status: s._id || "unknown",
            count: s.count,
          })),
          byPaymentStatus: paymentBreak.map((s: any) => ({
            paymentStatus: s._id || "unknown",
            count: s.count,
          })),
          topEventsBySpeakerCount: perEvent.map((e: any) => ({
            eventTitle: e.event?.title || "Untitled",
            speakerCount: e.count,
          })),
        };
      }

      case "get_round_tables_analytics": {
        // Round tables live embedded in event documents.
        const events = await this.eventModel
          .find({ organizer: { $in: [orgObjId, String(organizerId)] as any[] } })
          .select("title venueRoundTables")
          .lean();
        let totalTables = 0;
        let totalChairs = 0;
        let chairsBooked = 0;
        const perEvent: { title: string; tables: number; chairs: number; booked: number }[] = [];
        for (const e of events as any[]) {
          const rts: any[] = e.venueRoundTables || [];
          if (!rts.length) continue;
          let tables = 0,
            chairs = 0,
            booked = 0;
          for (const rt of rts) {
            tables++;
            chairs += rt.numberOfChairs || 0;
            booked += (rt.bookedChairs || []).length;
          }
          totalTables += tables;
          totalChairs += chairs;
          chairsBooked += booked;
          perEvent.push({ title: e.title, tables, chairs, booked });
        }
        // Real revenue from RoundTableBooking model (paid bookings)
        const bookingAgg = await this.roundTableBookingModel.aggregate([
          {
            $match: {
              organizerId: orgObjId,
              paymentStatus: "Paid",
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              revenue: { $sum: { $ifNull: ["$amount", 0] } },
            },
          },
        ]);
        const paidBookingsCount = bookingAgg[0]?.count || 0;
        const paidRevenue = bookingAgg[0]?.revenue || 0;
        return {
          totalRoundTables: totalTables,
          totalChairs,
          chairsBooked,
          occupancyPercent: totalChairs
            ? Math.round((chairsBooked / totalChairs) * 100)
            : 0,
          paidBookings: paidBookingsCount,
          revenue: paidRevenue,
          revenueFormatted: fmt(paidRevenue),
          topEventsByRoundTables: perEvent
            .sort((a, b) => b.tables - a.tables)
            .slice(0, 5),
        };
      }

      case "get_event_full_analytics": {
        const ev = await this.eventModel
          .findOne({
            organizer: { $in: [orgObjId, String(organizerId)] as any[] },
            title: { $regex: args.event_name, $options: "i" },
          })
          .lean();
        if (!ev)
          return { error: `No event matching "${args.event_name}"` };
        const evObj: any = ev;

        const [tickAgg, attendAgg, stallStatusAgg, stallTotals, spkAgg, rtBookings] =
          await Promise.all([
            this.ticketModel.aggregate([
              {
                $match: {
                  eventId: evObj._id,
                  organizerId: orgObjId,
                  paymentConfirmed: true,
                },
              },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
                },
              },
            ]),
            this.ticketModel.aggregate([
              {
                $match: {
                  eventId: evObj._id,
                  organizerId: orgObjId,
                  attendance: true,
                },
              },
              { $group: { _id: null, count: { $sum: 1 } } },
            ]),
            this.stallModel.aggregate([
              { $match: { eventId: evObj._id, organizerId: orgObjId } },
              { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
            this.stallModel.aggregate([
              { $match: { eventId: evObj._id, organizerId: orgObjId } },
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  booked: { $sum: { $ifNull: ["$paidAmount", 0] } },
                  value: { $sum: { $ifNull: ["$grandTotal", 0] } },
                },
              },
            ]),
            this.speakerRequestModel.aggregate([
              { $match: { eventId: evObj._id, organizerId: orgObjId } },
              { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
            this.roundTableBookingModel.aggregate([
              {
                $match: {
                  eventId: evObj._id,
                  organizerId: orgObjId,
                  paymentStatus: "Paid",
                },
              },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  revenue: { $sum: { $ifNull: ["$amount", 0] } },
                },
              },
            ]),
          ]);

        const ticketsSold = tickAgg[0]?.count || 0;
        const ticketRevenue = tickAgg[0]?.revenue || 0;
        const attended = attendAgg[0]?.count || 0;
        const stallRevenue = stallTotals[0]?.booked || 0;
        const rtRevenue = rtBookings[0]?.revenue || 0;
        // Capacity
        const capacity =
          (evObj.visitorTypes || []).reduce(
            (s: number, v: any) => s + (v.maxCount || 0),
            0,
          ) || Number(evObj.totalTickets || 0);

        const rtTables: any[] = evObj.venueRoundTables || [];
        const totalChairs = rtTables.reduce(
          (s, t: any) => s + (t.numberOfChairs || 0),
          0,
        );
        const chairsBooked = rtTables.reduce(
          (s, t: any) => s + (t.bookedChairs?.length || 0),
          0,
        );

        return {
          eventId: String(evObj._id),
          title: evObj.title,
          startDate: evObj.startDate,
          location: evObj.location,
          capacity,
          ticketsSold,
          attended,
          attendanceRate:
            ticketsSold > 0
              ? Math.round((attended / ticketsSold) * 100)
              : 0,
          ticketRevenue,
          ticketRevenueFormatted: fmt(ticketRevenue),
          occupancyPercent:
            capacity > 0
              ? Math.min(100, Math.round((ticketsSold / capacity) * 100))
              : null,
          stalls: {
            total: stallTotals[0]?.total || 0,
            byStatus: stallStatusAgg.map((s: any) => ({
              status: s._id || "unknown",
              count: s.count,
            })),
            collected: stallRevenue,
            collectedFormatted: fmt(stallRevenue),
          },
          speakers: {
            byStatus: spkAgg.map((s: any) => ({
              status: s._id || "unknown",
              count: s.count,
            })),
          },
          roundTables: {
            tables: rtTables.length,
            chairs: totalChairs,
            chairsBooked,
            occupancyPercent: totalChairs
              ? Math.round((chairsBooked / totalChairs) * 100)
              : 0,
            paidBookings: rtBookings[0]?.count || 0,
            revenue: rtRevenue,
            revenueFormatted: fmt(rtRevenue),
          },
          totalRevenue: ticketRevenue + stallRevenue + rtRevenue,
          totalRevenueFormatted: fmt(
            ticketRevenue + stallRevenue + rtRevenue,
          ),
        };
      }

      case "get_ticket_type_breakdown": {
        const ev = await this.eventModel
          .findOne({
            organizer: { $in: [orgObjId, String(organizerId)] as any[] },
            title: { $regex: args.event_name, $options: "i" },
          })
          .lean();
        if (!ev)
          return { error: `No event matching "${args.event_name}"` };
        const evObj: any = ev;
        const visitorTypes: any[] = evObj.visitorTypes || [];

        // Aggregate sold tickets per visitor-type name on this event
        const tickets: any[] = await this.ticketModel
          .find({
            eventId: evObj._id,
            organizerId: orgObjId,
            paymentConfirmed: true,
          })
          .select("ticketDetails totalAmount")
          .lean();

        const perType: Record<
          string,
          { name: string; quantity: number; revenue: number; capacity: number }
        > = {};
        for (const v of visitorTypes) {
          const key = v.name || "Unnamed";
          perType[key] = {
            name: key,
            quantity: 0,
            revenue: 0,
            capacity: v.maxCount || 0,
          };
        }
        for (const t of tickets) {
          for (const d of t.ticketDetails || []) {
            const key = d.name || d.type || "Unknown";
            if (!perType[key])
              perType[key] = {
                name: key,
                quantity: 0,
                revenue: 0,
                capacity: 0,
              };
            perType[key].quantity += d.quantity || 0;
            perType[key].revenue +=
              (d.price || 0) * (d.quantity || 0);
          }
        }
        return {
          eventTitle: evObj.title,
          breakdown: Object.values(perType).map((r) => ({
            name: r.name,
            sold: r.quantity,
            capacity: r.capacity || null,
            occupancyPercent:
              r.capacity > 0
                ? Math.min(
                    100,
                    Math.round((r.quantity / r.capacity) * 100),
                  )
                : null,
            revenue: r.revenue,
            revenueFormatted: fmt(r.revenue),
          })),
        };
      }

      case "get_event_participants": {
        const ev = await this.eventModel
          .findOne({
            organizer: { $in: [orgObjId, String(organizerId)] as any[] },
            title: { $regex: args.event_name, $options: "i" },
          })
          .lean();
        if (!ev) return { error: `No event matching "${args.event_name}"` };
        const evObj: any = ev;

        const [tickets, stalls, speakers, roundBookings] = await Promise.all([
          this.ticketModel
            .find({
              eventId: evObj._id,
              organizerId: orgObjId,
              paymentConfirmed: true,
            })
            .sort({ purchaseDate: -1 })
            .lean(),
          this.stallModel
            .find({ eventId: evObj._id, organizerId: orgObjId })
            .populate("shopkeeperId", "name email whatsAppNumber shopName")
            .lean(),
          this.speakerRequestModel
            .find({ eventId: evObj._id, organizerId: orgObjId })
            .lean(),
          this.roundTableBookingModel
            .find({ eventId: evObj._id, organizerId: orgObjId })
            .lean(),
        ]);

        const visitors = tickets.map((t: any) => ({
          name: t.customerName || "—",
          email: t.customerEmail || "",
          phone: t.customerWhatsapp || "",
          tickets:
            t.ticketDetails?.reduce(
              (s: number, d: any) => s + (d.quantity || 0),
              0,
            ) || 0,
          amount: t.totalAmount || 0,
          attended: !!t.attendance,
        }));
        const exhibitors = stalls.map((s: any) => ({
          name:
            s.shopkeeperId?.name ||
            s.nameOfApplicant ||
            s.brandName ||
            "—",
          business:
            s.shopkeeperId?.shopName || s.businessName || s.brandName || "",
          phone:
            s.shopkeeperId?.whatsAppNumber ||
            s.shopkeeperId?.whatsappNumber ||
            "",
          email: s.shopkeeperId?.email || "",
          tables: (s.selectedTables || [])
            .map((t: any) => t.name || t.tableName)
            .filter(Boolean),
          status: s.status || "Pending",
          paymentStatus: s.paymentStatus || "Unpaid",
          amount: s.grandTotal || 0,
        }));
        const speakerList = speakers.map((sp: any) => ({
          name: sp.name || "—",
          organization: sp.organization || "",
          email: sp.email || "",
          phone: sp.phone || sp.whatsAppNumber || "",
          isKeynote: !!sp.isKeynote,
          status: sp.status || "Pending",
          paymentStatus: sp.paymentStatus || "Unpaid",
          fee: sp.isCharged ? sp.fee || 0 : 0,
        }));
        const roundTableAttendees = roundBookings.map((b: any) => ({
          name: b.visitorName || "—",
          email: b.visitorEmail || "",
          phone: b.visitorPhone || "",
          tableName: b.tableName || "",
          seats: b.numberOfSeats || 0,
          isWholeTable: !!b.isWholeTable,
          paymentStatus: b.paymentStatus || "Unpaid",
          amount: b.amount || 0,
        }));

        const totals = {
          visitors: visitors.length,
          exhibitors: exhibitors.length,
          speakers: speakerList.length,
          roundTableAttendees: roundTableAttendees.length,
          combined:
            visitors.length +
            exhibitors.length +
            speakerList.length +
            roundTableAttendees.length,
        };

        return {
          eventTitle: evObj.title,
          totals,
          visitors,
          exhibitors,
          speakers: speakerList,
          roundTableAttendees,
        };
      }

      case "get_attendance_analytics": {
        const status = args.status || "all";
        const now = new Date();
        const eventFilter: any = {
          organizer: { $in: [orgObjId, String(organizerId)] as any[] },
        };
        if (status === "upcoming") eventFilter.startDate = { $gte: now };
        else if (status === "past") eventFilter.startDate = { $lt: now };
        const events = await this.eventModel
          .find(eventFilter)
          .select("_id title startDate")
          .lean();
        const ids = events.map((e: any) => e._id);
        const [soldAgg, attendedAgg, perEventAgg] = await Promise.all([
          this.ticketModel.aggregate([
            {
              $match: {
                eventId: { $in: ids },
                organizerId: orgObjId,
                paymentConfirmed: true,
              },
            },
            { $group: { _id: null, count: { $sum: 1 } } },
          ]),
          this.ticketModel.aggregate([
            {
              $match: {
                eventId: { $in: ids },
                organizerId: orgObjId,
                attendance: true,
              },
            },
            { $group: { _id: null, count: { $sum: 1 } } },
          ]),
          this.ticketModel.aggregate([
            {
              $match: {
                eventId: { $in: ids },
                organizerId: orgObjId,
                paymentConfirmed: true,
              },
            },
            {
              $group: {
                _id: "$eventId",
                sold: { $sum: 1 },
                attended: {
                  $sum: { $cond: ["$attendance", 1, 0] },
                },
              },
            },
            { $sort: { sold: -1 } },
            { $limit: 5 },
          ]),
        ]);
        const sold = soldAgg[0]?.count || 0;
        const attended = attendedAgg[0]?.count || 0;
        const titleById: Record<string, string> = {};
        events.forEach((e: any) => (titleById[String(e._id)] = e.title));
        return {
          scope: status,
          totalEvents: events.length,
          ticketsSold: sold,
          attended,
          noShows: Math.max(0, sold - attended),
          attendanceRate:
            sold > 0 ? Math.round((attended / sold) * 100) : 0,
          topEvents: perEventAgg.map((r: any) => ({
            eventTitle: titleById[String(r._id)] || "Untitled",
            sold: r.sold,
            attended: r.attended,
            attendanceRate:
              r.sold > 0 ? Math.round((r.attended / r.sold) * 100) : 0,
          })),
        };
      }

      case "get_organization_settings": {
        const org: any = await this.organizerModel.findById(orgObjId).lean();
        if (!org) return { error: "Organizer not found" };
        const plan = org.planId
          ? await this.planModel.findById(org.planId).lean()
          : null;
        const operatorCount = await this.operatorModel.countDocuments({
          organizerId: String(organizerId),
        });
        return {
          name: org.name,
          organizationName: org.organizationName,
          email: org.email,
          businessEmail: org.businessEmail,
          country: org.country,
          whatsAppNumber: org.whatsAppNumber,
          countryCode: org.countryCode,
          commissionPercentage: org.commissionPercentage,
          subscribed: !!org.subscribed,
          planExpiryDate: org.planExpiryDate,
          planName: plan ? (plan as any).planName : null,
          planPrice: plan ? (plan as any).price : null,
          planPriceFormatted: plan ? fmt((plan as any).price || 0) : null,
          modules: plan ? (plan as any).modules : null,
          slug: org.slug,
          bankConfigured: !!(
            org.bankAccountNumber ||
            org.upiId ||
            org.payNowNumber
          ),
          paymentMethods: {
            upi: !!org.upiId,
            bank:
              !!org.bankAccountNumber && !!org.bankIfscCode
                ? true
                : !!org.bankAccountNumber,
            payNow: !!org.payNowNumber,
            qr: !!org.qrCode,
          },
          operatorCount,
        };
      }

      case "navigate_to": {
        return {
          message: `Switching to ${args.tab}.`,
          botAction: { type: "navigate", tab: args.tab },
        };
      }

      case "list_visitors": {
        // Default to a high cap so we return everything by default — the
        // chat-side renderer paginates 20 rows per page, so there's no
        // perf concern with sending the full set.
        const limit = Math.min(Math.max(Number(args?.limit) || 1000, 1), 2000);
        const docs = await this.userModel
          .find({ provider: "Shopkeeper", providerId: String(organizerId) })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        return {
          total: docs.length,
          visitors: (docs as any[]).map((u) => ({
            name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim(),
            email: u.email || "",
            whatsapp: u.whatsAppNumber || "",
            createdAt: u.createdAt
              ? new Date(u.createdAt).toISOString().slice(0, 10)
              : "",
          })),
        };
      }

      case "list_exhibitors": {
        const limit = Math.min(Math.max(Number(args?.limit) || 1000, 1), 2000);

        // Mirror the MyUsers merge: Source A = vendors directly tied to this
        // organizer (manual + bulk-imported), Source B = vendors that show up
        // only because they have a stall under this organizer. Stall-only
        // vendors often have no organizerId set, so the second query is what
        // surfaces the rows missing from the previous version of this tool.
        const [orgVendors, stalls] = await Promise.all([
          this.vendorModel.find({ organizerId: orgObjId }).lean(),
          this.stallModel
            .find({ organizerId: orgObjId })
            .populate(
              "shopkeeperId",
              "name email businessEmail whatsAppNumber whatsappNumber phone phoneNumber shopName businessName brandName businessCategory country",
            )
            .lean(),
        ]);

        const byId = new Map<string, any>();
        for (const v of orgVendors as any[]) {
          byId.set(String(v._id), v);
        }
        for (const s of stalls as any[]) {
          const v = s.shopkeeperId;
          if (!v || !v._id) continue;
          const k = String(v._id);
          if (!byId.has(k)) byId.set(k, v);
        }

        const merged = Array.from(byId.values())
          .sort((a, b) => {
            const ta = new Date(a.createdAt || 0).getTime();
            const tb = new Date(b.createdAt || 0).getTime();
            return tb - ta;
          })
          .slice(0, limit);

        return {
          total: merged.length,
          exhibitors: merged.map((v: any) => ({
            name: v.name || "",
            business: v.shopName || v.businessName || v.brandName || "",
            email: v.email || v.businessEmail || "",
            whatsapp: v.whatsAppNumber || v.whatsappNumber || "",
            phone: v.phone || v.phoneNumber || "",
            category: v.businessCategory || "",
            country: v.country || "",
          })),
        };
      }

      case "list_space_templates": {
        const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 200);
        const tpls = await this.templateModel
          .find({
            organizerId: orgObjId,
            type: "space",
          })
          .sort({ name: 1, createdAt: -1 })
          .limit(limit)
          .lean();
        const rows = (tpls as any[]).map((t) => {
          const p = t.payload || {};
          return {
            name: t.name,
            width: p.width ?? null,
            height: p.height ?? null,
            tablePrice: p.tablePrice ?? null,
            bookingPrice: p.bookingPrice ?? null,
            depositPrice: p.depositPrice ?? null,
            color: p.color ?? null,
            rowNumber: p.rowNumber ?? null,
          };
        });
        return { total: rows.length, templates: rows };
      }

      // ========== FULL EVENT CREATION ==========
      case "create_full_event": {
        const { ticketTypes, roundTables, stalls, speakers, ...basics } = args;
        const venueConfigId = `vc_${Date.now()}`;
        const venueConfig = [
          {
            venueConfigId,
            name: "Main Venue",
            width: 1000,
            height: 600,
            scale: 0.75,
            gridSize: 20,
            showGrid: true,
            hasMainStage: false,
            totalRows: 0,
          },
        ];

        const visitorTypes = (ticketTypes || []).map((t: any, i: number) => ({
          id: `vt_${Date.now()}_${i}`,
          name: t.name,
          price: Number(t.price) || 0,
          maxCount: t.maxCount || undefined,
          description: t.description || "",
          featureAccess: {
            food: false,
            parking: false,
            wifi: true,
            photography: true,
            security: false,
            accessibility: false,
          },
          isActive: true,
        }));

        // Round tables — template + auto-placed grid
        let roundTableTemplates: any[] = [];
        let venueRoundTables: any[] = [];
        if (roundTables?.count > 0) {
          const tplId = `rt_${Date.now()}`;
          roundTableTemplates = [
            {
              id: tplId,
              name: "Round Table",
              numberOfChairs: roundTables.chairsPerTable || 8,
              sellingMode: roundTables.sellingMode || "chair",
              tablePrice: roundTables.pricePerTable || 0,
              chairPrice: roundTables.pricePerChair || 0,
              category: "Standard",
              color: roundTables.color || "#8B5CF6",
              tableDiameter: 120,
            },
          ];
          venueRoundTables = autoPlaceRoundTables(
            roundTables.count,
            tplId,
            roundTableTemplates[0],
            venueConfig[0],
          );
        }

        // Stalls — template + auto-placed grid
        let tableTemplates: any[] = [];
        let venueTables: any[] = [];
        if (stalls?.count > 0) {
          const tplId = `tt_${Date.now()}`;
          tableTemplates = [
            {
              id: tplId,
              name: "Stall",
              type: "Straight",
              width: stalls.width || 80,
              height: stalls.height || 60,
              tablePrice: stalls.bookingPrice || 0,
              bookingPrice: stalls.bookingPrice || 0,
              depositPrice: stalls.depositPrice || 0,
              color: "#10B981",
              forSale: true,
              isBooked: false,
            },
          ];
          venueTables = autoPlaceStalls(
            stalls.count,
            tplId,
            tableTemplates[0],
            venueConfig[0],
          );
        }

        const speakersArr = (speakers || []).map((s: any, i: number) => ({
          id: `sp_${Date.now()}_${i}`,
          name: s.name,
          organization: s.organization || "",
          title: s.title || "",
          bio: s.bio || "",
          isKeynote: !!s.isKeynote,
          slots: [],
        }));

        try {
          const created = await this.eventModel.create({
            organizer: orgObjId,
            ...basics,
            startDate: basics.startDate ? new Date(basics.startDate) : new Date(),
            endDate: basics.endDate ? new Date(basics.endDate) : undefined,
            visibility: basics.visibility || "public",
            status: "draft",
            visitorTypes,
            roundTableTemplates,
            venueRoundTables,
            tableTemplates,
            venueTables,
            speakers: speakersArr,
            venueConfig,
          });
          return {
            id: String((created as any)._id),
            title: (created as any).title,
            ticketTypesAdded: visitorTypes.length,
            roundTablesAdded: venueRoundTables.length,
            stallsAdded: venueTables.length,
            speakersAdded: speakersArr.length,
            status: "draft",
            message:
              "Event created as draft. Use publish_event to make it live, or open Events tab for image uploads + position fine-tuning.",
          };
        } catch (e: any) {
          return { error: e?.message };
        }
      }

      case "add_ticket_type": {
        const ev = await this.eventModel.findOne({
          organizer: orgObjId,
          title: { $regex: args.event_name, $options: "i" },
        });
        if (!ev) return { error: `No event matching "${args.event_name}"` };
        const newTier = {
          id: `vt_${Date.now()}`,
          name: args.name,
          price: Number(args.price) || 0,
          maxCount: args.maxCount || undefined,
          description: args.description || "",
          featureAccess: {
            food: false,
            parking: false,
            wifi: true,
            photography: true,
            security: false,
            accessibility: false,
          },
          isActive: true,
        };
        (ev as any).visitorTypes = [
          ...((ev as any).visitorTypes || []),
          newTier,
        ];
        await ev.save();
        return {
          message: `Added "${args.name}" tier — ${fmt(newTier.price)} on event "${(ev as any).title}".`,
          totalTiers: (ev as any).visitorTypes.length,
        };
      }

      case "add_round_tables": {
        const ev = await this.eventModel.findOne({
          organizer: orgObjId,
          title: { $regex: args.event_name, $options: "i" },
        });
        if (!ev) return { error: `No event matching "${args.event_name}"` };
        const evDoc: any = ev;
        // Ensure venueConfig exists
        if (!evDoc.venueConfig?.length) {
          evDoc.venueConfig = [
            {
              venueConfigId: `vc_${Date.now()}`,
              name: "Main Venue",
              width: 1000,
              height: 600,
              scale: 0.75,
              gridSize: 20,
              showGrid: true,
              hasMainStage: false,
              totalRows: 0,
            },
          ];
        }
        const tplId = `rt_${Date.now()}`;
        const template = {
          id: tplId,
          name: args.templateName || "Round Table",
          numberOfChairs: args.chairsPerTable,
          sellingMode: args.sellingMode || "chair",
          tablePrice: args.pricePerTable || 0,
          chairPrice: args.pricePerChair || 0,
          category: "Standard",
          color: args.color || "#8B5CF6",
          tableDiameter: 120,
        };
        evDoc.roundTableTemplates = [
          ...(evDoc.roundTableTemplates || []),
          template,
        ];
        const placed = autoPlaceRoundTables(
          args.count,
          tplId,
          template,
          evDoc.venueConfig[0],
          (evDoc.venueRoundTables || []).length,
        );
        evDoc.venueRoundTables = [
          ...(evDoc.venueRoundTables || []),
          ...placed,
        ];
        await ev.save();
        return {
          message: `Added **${args.count} round tables** (${args.chairsPerTable} seats each, ${fmt(args.pricePerChair || 0)}/chair) to "${evDoc.title}".`,
          totalRoundTables: evDoc.venueRoundTables.length,
        };
      }

      case "add_stalls": {
        const ev = await this.eventModel.findOne({
          organizer: orgObjId,
          title: { $regex: args.event_name, $options: "i" },
        });
        if (!ev) return { error: `No event matching "${args.event_name}"` };
        const evDoc: any = ev;
        if (!evDoc.venueConfig?.length) {
          evDoc.venueConfig = [
            {
              venueConfigId: `vc_${Date.now()}`,
              name: "Main Venue",
              width: 1000,
              height: 600,
              scale: 0.75,
              gridSize: 20,
              showGrid: true,
              hasMainStage: false,
              totalRows: 0,
            },
          ];
        }
        const tplId = `tt_${Date.now()}`;
        const template = {
          id: tplId,
          name: args.templateName || "Stall",
          type: "Straight",
          width: args.width || 80,
          height: args.height || 60,
          tablePrice: args.bookingPrice || 0,
          bookingPrice: args.bookingPrice || 0,
          depositPrice: args.depositPrice || 0,
          color: "#10B981",
          forSale: true,
          isBooked: false,
        };
        evDoc.tableTemplates = [...(evDoc.tableTemplates || []), template];
        const placed = autoPlaceStalls(
          args.count,
          tplId,
          template,
          evDoc.venueConfig[0],
          (evDoc.venueTables || []).length,
        );
        evDoc.venueTables = [...(evDoc.venueTables || []), ...placed];
        await ev.save();
        return {
          message: `Added **${args.count} stalls** at ${fmt(args.bookingPrice)} each to "${evDoc.title}".`,
          totalStalls: evDoc.venueTables.length,
        };
      }

      case "add_speakers": {
        const ev = await this.eventModel.findOne({
          organizer: orgObjId,
          title: { $regex: args.event_name, $options: "i" },
        });
        if (!ev) return { error: `No event matching "${args.event_name}"` };
        const evDoc: any = ev;
        const newSpeakers = (args.speakers || []).map((s: any, i: number) => ({
          id: `sp_${Date.now()}_${i}`,
          name: s.name,
          organization: s.organization || "",
          title: s.title || "",
          bio: s.bio || "",
          isKeynote: !!s.isKeynote,
          slots: [],
        }));
        evDoc.speakers = [...(evDoc.speakers || []), ...newSpeakers];
        await ev.save();
        return {
          message: `Added **${newSpeakers.length} speakers** to "${evDoc.title}".`,
          totalSpeakers: evDoc.speakers.length,
        };
      }

      case "set_venue_config": {
        const ev = await this.eventModel.findOne({
          organizer: orgObjId,
          title: { $regex: args.event_name, $options: "i" },
        });
        if (!ev) return { error: `No event matching "${args.event_name}"` };
        const evDoc: any = ev;
        const existing = evDoc.venueConfig?.[0] || {
          venueConfigId: `vc_${Date.now()}`,
          name: "Main Venue",
          scale: 0.75,
          showGrid: true,
          totalRows: 0,
        };
        evDoc.venueConfig = [
          {
            ...existing,
            width: args.width ?? existing.width ?? 1000,
            height: args.height ?? existing.height ?? 600,
            gridSize: args.gridSize ?? existing.gridSize ?? 20,
            hasMainStage: args.hasMainStage ?? existing.hasMainStage ?? false,
          },
        ];
        await ev.save();
        return {
          message: `Venue updated to ${evDoc.venueConfig[0].width}×${evDoc.venueConfig[0].height} for "${evDoc.title}".`,
        };
      }

      case "publish_event": {
        const r = await this.eventModel.findOneAndUpdate(
          {
            organizer: orgObjId,
            title: { $regex: args.event_name, $options: "i" },
          },
          { $set: { status: "published" } },
          { new: true },
        );
        if (!r) return { error: `No event matching "${args.event_name}"` };
        return {
          message: `Event "${(r as any).title}" is now **published** and visible to public.`,
        };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  // ============================================================
  // HISTORY MANAGEMENT
  // ============================================================
  private getHistory(organizerId: string): ConvEntry[] {
    const now = Date.now();
    let entries = this.history.get(organizerId) || [];
    entries = entries.filter((e) => now - e.ts < this.HISTORY_TTL_MS);
    this.history.set(organizerId, entries);
    return entries;
  }

  private trimHistory(organizerId: string) {
    const entries = this.history.get(organizerId) || [];
    if (entries.length > this.HISTORY_LIMIT) {
      this.history.set(
        organizerId,
        entries.slice(-this.HISTORY_LIMIT),
      );
    }
  }
}
