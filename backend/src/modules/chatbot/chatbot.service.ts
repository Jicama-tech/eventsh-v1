import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import OpenAI from "openai";

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
  | "general";

// Country → currency lookup. Add new countries here as eventsh expands.
const COUNTRY_CURRENCY: Record<
  string,
  { symbol: string; code: string; locale: string }
> = {
  IN: { symbol: "₹", code: "INR", locale: "en-IN" },
  SG: { symbol: "S$", code: "SGD", locale: "en-SG" },
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
    attendees: ["list_events", "list_attendees", "search_attendee"],
    stalls: ["list_stalls", "get_stalls_analytics", "navigate_to"],
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

6. NAVIGATION INTENT — when the user says "open the X tab", "go to X", "switch to X", or "open X customizer", call navigate_to({tab: X}) IMMEDIATELY. Do NOT list / fetch / show anything first. Map "events"→events, "settings"→settings, "storefront"→storefront, "attendees"→eventAttendees, "speakers"→speakerRequests, "users"→users, "stalls"→users, "round tables"→roundTableBookings.

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

    general: `You are the EventSH AI assistant for "{ORG}".
You help organizers with events, tickets, attendees, vendors, speakers, plans, settings.
- Always use a tool for factual questions. Never invent values.
- For UI changes, use navigate_to.
- For lists, always use a markdown table.
- For single record, use bold key-value pairs.`,
  };

  // ============================================================
  // MAIN ENTRY
  // ============================================================
  async handleMessage({
    organizerId,
    organizerName,
    message,
  }: {
    organizerId: string;
    organizerName: string;
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

    try {
      // 1. Route to a specialist
      const tab = await this.route(message, history);
      this.logger.debug(`Routed to ${tab}`);

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
              'Classify the user message into ONE tab and reply with ONLY that word. Tabs: dashboard, events, tickets, attendees, stalls, speakers, storefront, settings, general. Reply only the word.',
          },
          { role: "user", content: message },
        ],
        max_tokens: 8,
        temperature: 0,
      });
      const tab = (res.choices?.[0]?.message?.content || "general")
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, "") as Tab;
      const valid: Tab[] = [
        "dashboard",
        "events",
        "tickets",
        "attendees",
        "stalls",
        "speakers",
        "storefront",
        "settings",
        "general",
      ];
      return valid.includes(tab) ? tab : "general";
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
  }: {
    tab: Tab;
    organizerId: string;
    orgName: string;
    organizerName: string;
    country: string;
    currency: { symbol: string; code: string; locale: string };
    history: ConvEntry[];
    userMessage: string;
  }): Promise<{ text: string; botAction?: any }> {
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
    const tools = this.tools.filter((t) =>
      allowedToolNames.includes((t as any).function.name),
    );

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
    return { text, botAction };
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
        .select("organizationName country whatsAppNumber paymentURL")
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
        const plans = await this.planModel
          .find({ moduleType: "Organizer", isActive: true })
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
