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
    @InjectModel("SpeakerRequest") private speakerRequestModel: Model<any>,
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
        description: "List the organizer's events. Optionally filter by status",
        parameters: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["upcoming", "past", "all"],
              description: "Defaults to all",
            },
            limit: { type: "number", description: "Defaults to 10" },
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
        name: "create_event",
        description:
          "Create a basic event with title, description, date, venue. The shopkeeper can refine details in the UI later.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            startDate: { type: "string", description: "ISO date" },
            endDate: { type: "string", description: "ISO date — optional" },
            venue: { type: "string" },
            ticketPrice: { type: "number" },
            attendeeLimit: { type: "number" },
          },
          required: ["title", "startDate"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_full_event",
        description:
          "Create an event with the complete set of fields including ticket types, venue config, stalls, round tables, speakers — everything except images and drag-drop layout positioning. Round tables and stalls are auto-placed on a grid. Returns the new event's id.",
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
          required: ["title", "startDate"],
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
        description: "List stall registrations for the organizer",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["pending", "approved", "all"] },
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
    ],
    events: [
      "list_events",
      "get_event_detail",
      "create_event",
      "create_full_event",
      "add_ticket_type",
      "add_round_tables",
      "add_stalls",
      "add_speakers",
      "set_venue_config",
      "publish_event",
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
    stalls: ["list_stalls", "navigate_to"],
    speakers: ["list_events", "list_speakers", "navigate_to"],
    storefront: ["navigate_to"],
    settings: [
      "get_subscription",
      "list_plans",
      "list_operators",
      "get_organizer_info",
      "navigate_to",
    ],
    general: [
      "get_dashboard_stats",
      "get_organizer_info",
      "list_events",
      "get_pending_approvals",
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
=== END RULES ===
`;

  private static SPECIALIST_PROMPTS: Record<Tab, string> = {
    dashboard: `You are the Dashboard specialist for "{ORG}" on EventSH.
Focus: analytics, revenue, ticket sales, top events, pending review counts.
- For ANY metric question, you MUST call a tool first. Never guess numbers.
- Period words: "today" → get_revenue_trend(today); "this week" → week; "this month" → month; "this quarter" → quarter; "this year" → year.
- Format: 1-line headline + 2-column markdown table (Metric | Value).
- For top events, use a 3-column table: Event | Tickets | Revenue.
- "How is my platform doing" / "give me an overview" → call get_dashboard_stats AND get_pending_approvals, then a single combined table.`,

    events: `You are the Events specialist for "{ORG}" on EventSH. You build the entire event end-to-end via tools.
Currency: {CURRENCY} ({CURRENCY_CODE}).

LISTING / VIEWING:
- "List events" / "upcoming events" → list_events. Tool returns { total, shown, events[] }. Headline: "You have **{total} events**." Then a markdown table: | # | Title | Date | Venue | Attendees |.
- If "all events" or the user asks how many, render every row in the events array (the tool returns up to 200).
- "Event details for X" → get_event_detail. Bold key-value pairs.

CREATING — FULL AI FLOW (preferred):
When the user describes an event in one shot ("create a tech meetup on May 15 at MG Road, Bangalore, 200 attendees, ticket {CURRENCY}500, with 10 round tables of 8 seats each and 5 stalls"), call create_full_event with EVERYTHING parsed in one call — title, dates, venue, ticketTypes[], roundTables{}, stalls{}, speakers[], etc. The tool auto-places round tables and stalls on a grid layout.

CREATING — STEP BY STEP:
If the user gives partial info, use create_event for the basic shell first, then add layers as the user describes them:
- "Add 3 ticket types: Regular {CURRENCY}500, VIP {CURRENCY}1500, Student {CURRENCY}250" → call add_ticket_type 3 times.
- "Add 10 round tables, 8 seats, {CURRENCY}1000 per chair" → add_round_tables(count=10, chairsPerTable=8, pricePerChair=1000).
- "Add 5 stalls 8x6 ft at {CURRENCY}2000 each" → add_stalls(count=5, width=80, height=60, bookingPrice=2000).
- "Add speakers: John Doe MS, Jane Google" → add_speakers([{name:"John Doe", organization:"MS"}, {name:"Jane", organization:"Google"}]).
- "Set venue 1000x600" → set_venue_config(width=1000, height=600).
- "Publish it" → publish_event.

REQUIRED CLARIFICATIONS:
- If date missing, ask: "What date and time?"
- If round tables count missing, ask once.
- If user just says "publish event X" with no edits — call publish_event directly.
- If the user says "my latest event" / "current event" / "the new event" with no name, FIRST call list_events(status=upcoming, limit=1). Use the returned title for event_name in subsequent tool calls. If no upcoming events, fall back to list_events(status=all, limit=1).
- For "Add speakers to my latest event" with no speaker names, look up the event then ask "Who are the speakers? Give me name + organization for each".
- For "Create a basic event with title and date" with no specifics, ask: "What's the event title and start date?".

LIMITATIONS (be honest):
- Image uploads (banner, gallery, speaker photos) — say: "I can't upload images via chat. Open the Events tab to upload."  Call navigate_to(events).
- Drag-drop layout positioning — say: "Tables/stalls are auto-placed on a grid. Open Events tab to fine-tune positions."

After creating, ALWAYS confirm with a 2-line bold summary (event title + ID) and offer next steps as quickActions.`,

    tickets: `You are the Tickets specialist for "{ORG}" on EventSH.
Focus: tickets sold, payment status, attendance check-in.
- "Tickets for <event>" → list_tickets(event_name=<event>). Render as table: | Ticket | Customer | Amount | Paid | Attended |.
- "Recent tickets" → list_tickets() with no event filter.
- "Mark ticket X used" → mark_ticket_used(ticketId=X). Confirm with one bold line.
- "Get ticket X" → get_ticket_detail. Render as bold key-value pairs.
- If the user says "my latest event" / "the latest event" / "current event" with no name, FIRST call list_events(status=upcoming, limit=1). Use the returned title as event_name. If no upcoming events, fall back to list_events(status=all, limit=1).`,

    attendees: `You are the Attendees specialist for "{ORG}" on EventSH.
Focus: attendee rosters and lookups across all events.
- "Who came to <event>" / "list attendees for <event>" → list_attendees(event_name=<event>). Table: | Name | Email | WhatsApp | Paid | Attended |.
- "Find <name>" / "search <email>" → search_attendee(query=...). Table: | Event | Name | Email | WhatsApp |.
- If the user says "my latest event" with no name, FIRST call list_events(status=upcoming, limit=1) and use that title.
- For "find attendee by name or email" with no actual name, ask: "Who should I look up — name or email?".`,

    stalls: `You are the Stalls/Exhibitors specialist for "{ORG}" on EventSH.
Focus: vendor registrations.
- "Show stall requests" / "pending stalls" → list_stalls(status=pending). Table: | Vendor | Business | Email | WhatsApp | Approved |.
- "All approved stalls" → list_stalls(status=approved).
- For approving/rejecting an individual stall, call navigate_to(users) (tell user "Open Exhibitors/Visitors tab to approve").`,

    speakers: `You are the Speakers specialist for "{ORG}" on EventSH.
Focus: speaker requests.
- "Speaker requests" / "speakers for <event>" → list_speakers. Table: | Name | Email | Organization | Status | Fee |.
- "Pending speakers" → list_speakers(status="Pending").
- If the user says "my latest event" with no name, FIRST call list_events(status=upcoming, limit=1) and use that title.
- For approving / setting fees / assigning slots, call navigate_to(speakerRequests).`,

    storefront: `You are the Storefront specialist for "{ORG}" on EventSH.
The storefront customizer is the only place to actually edit settings — you cannot mutate them yourself.
- For ANY storefront edit request ("change banner", "switch theme color", "toggle Instagram section", etc.), reply with one short line naming the section AND call navigate_to(storefront).
- Do NOT pretend to apply changes. Do NOT show example settings.`,

    settings: `You are the Settings specialist for "{ORG}" on EventSH.
Focus: subscription plan, operators, profile.
- "What's my plan" / "subscription" → get_subscription. Render as bold key-value lines (Plan, Valid until, Modules count).
- "Show all plans" / "list plans" → list_plans. Table: | Plan | Price | Validity | Default |.
- "List operators" / "my operators" → list_operators. Table: | Name | Email | WhatsApp | Tabs |.
- "My profile" → get_organizer_info. Render as bold key-value pairs.
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
    if (
      /\b(revenue|earned|earning|sales summary|top event|how am i doing|stats|analytics|overview|approval|approvals|pending review)\b/.test(
        m,
      )
    )
      return "dashboard";
    if (/\b(event|create event|new event|add event)\b/.test(m)) return "events";
    if (/\b(ticket|attendance|check.?in|sold)\b/.test(m)) return "tickets";
    if (/\b(attendee|attendees|who came|visitors|guest list)\b/.test(m))
      return "attendees";
    if (/\b(stall|vendor|exhibitor)\b/.test(m)) return "stalls";
    if (/\b(speaker|speech|session)\b/.test(m)) return "speakers";
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
  }: {
    tab: Tab;
    organizerId: string;
    orgName: string;
    organizerName: string;
    country: string;
    currency: { symbol: string; code: string; locale: string };
    history: ConvEntry[];
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

    // First call — may produce tool_calls
    const first = await this.callWithFallback({
      model: this.model,
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? "auto" : undefined,
      temperature: 0.1,
    });
    const firstMsg = first.choices?.[0]?.message;

    // If tool calls present, execute them
    if (firstMsg?.tool_calls?.length) {
      messages.push(firstMsg as any);
      for (const call of firstMsg.tool_calls) {
        if (call.type !== "function") continue;
        const name = call.function.name;
        let args: any = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {}
        let toolResult: any = "";
        try {
          const r = await this.runTool(name, args, organizerId, currency);
          if (name === "navigate_to" && r?.botAction) {
            botAction = r.botAction;
          }
          // Annotate every tool result with currency context so the LLM
          // can never accidentally render the wrong symbol.
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
      // Follow-up to format result — keep temperature low to prevent the
      // model from "rephrasing" tool data with new (made-up) values.
      const second = await this.callWithFallback({
        model: this.model,
        messages,
        temperature: 0.1,
      });
      const text = second.choices?.[0]?.message?.content?.trim() || "Done.";
      return { text, botAction };
    }

    return {
      text: firstMsg?.content?.trim() || "How can I help you today?",
      botAction,
    };
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
        const filter: any = { organizer: orgObjId };
        if (status === "upcoming") filter.startDate = { $gte: now };
        else if (status === "past") filter.startDate = { $lt: now };
        const events = await this.eventModel
          .find(filter)
          .sort({ startDate: 1 })
          .limit(limit)
          .lean();
        const totalCount = await this.eventModel.countDocuments(filter);
        return {
          total: totalCount,
          shown: events.length,
          events: events.map((e: any) => ({
            id: String(e._id),
            title: e.title,
            startDate: e.startDate,
            endDate: e.endDate,
            venue: e.venue,
            attendees: e.attendees,
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

      case "create_event": {
        try {
          const created = await this.eventModel.create({
            organizer: orgObjId,
            title: args.title,
            description: args.description || "",
            startDate: args.startDate
              ? new Date(args.startDate)
              : new Date(),
            endDate: args.endDate ? new Date(args.endDate) : undefined,
            venue: args.venue || "",
            ticketPrice: args.ticketPrice || 0,
            attendeeLimit: args.attendeeLimit || 0,
          });
          return {
            id: String((created as any)._id),
            title: (created as any).title,
            message: "Event created. Edit further in the Events tab.",
          };
        } catch (e: any) {
          return { error: e?.message };
        }
      }

      case "list_tickets": {
        const limit = Math.min(args.limit || 10, 50);
        const filter: any = { organizerId: orgObjId };
        if (args.event_name) {
          const ev = await this.eventModel.findOne({
            organizer: orgObjId,
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
        return tickets.map((t: any) => ({
          ticketId: t.ticketId,
          eventTitle: t.eventTitle,
          customer: t.customerName,
          amount: t.totalAmount,
          amountFormatted: fmt(t.totalAmount),
          paid: !!t.paymentConfirmed,
          attendance: !!t.attendance,
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
          this.vendorModel.countDocuments({ approved: false }),
        ]);
        return {
          pendingSpeakerRequests: pendingSpeakers,
          pendingStallRegistrations: pendingStalls,
        };
      }

      case "navigate_to": {
        return {
          message: `Switching to ${args.tab}.`,
          botAction: { type: "navigate", tab: args.tab },
        };
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
