import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import OpenAI from "openai";

interface StallTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  color?: string;
  type?: string;
  rowNumber?: number;
  tablePrice?: number;
  bookingPrice?: number;
  depositPrice?: number;
  forSale?: boolean;
}

interface RoundTableTemplate {
  id: string;
  name: string;
  numberOfChairs: number;
  sellingMode: "table" | "chair";
  tablePrice: number;
  chairPrice: number;
  category?: string;
  color: string;
  tableDiameter: number;
}

interface SpeakerZoneTemplate {
  id: string;
  name: string;
  isMainStage?: boolean;
  width: number;
  height: number;
  startTime?: string;
  endTime?: string;
  slotPrice?: number;
  maxSpeakers?: number;
  maxVisitors?: number;
  description?: string;
}

interface VenueDims {
  width: number;
  height: number;
  name?: string;
  gridSize?: number;
  id?: string;
}

interface GenerateInput {
  brief: string;
  capacity?: number;
  eventType?: string;
  wallMargin?: number;
  stallGap?: number;
  /** Default stall orientation along walls. "horizontal" = stall's width is
   *  parallel to the wall (default for top/bottom walls). "vertical" = the
   *  stall is rotated 90° so its width axis runs perpendicular to the wall. */
  stallOrientation?: "horizontal" | "vertical";
  venueConfig: VenueDims;
  templates: {
    stalls?: StallTemplate[];
    roundTables?: RoundTableTemplate[];
    speakerZones?: SpeakerZoneTemplate[];
  };
}

interface ChatInput {
  messages: { role: "user" | "assistant"; content: string }[];
  wallMargin?: number;
  stallGap?: number;
  stallOrientation?: "horizontal" | "vertical";
  venueConfig: VenueDims;
  templates: {
    stalls?: StallTemplate[];
    roundTables?: RoundTableTemplate[];
    speakerZones?: SpeakerZoneTemplate[];
  };
}

type Side = "top" | "bottom" | "left" | "right" | "central" | "none";

type StallOrientation = "horizontal" | "vertical";

interface AiPlan {
  stage: { templateId: string | null; side: Side };
  rounds: { templateId: string; count: number; zone: Side }[];
  stalls: {
    templateId: string;
    count: number;
    wall: Side;
    orientation: StallOrientation;
  }[];
  speakerZones: { templateId: string; side: Side }[];
  hasMainStage: boolean;
  summary: string;
}

@Injectable()
export class VenueDesignerService {
  private readonly logger = new Logger(VenueDesignerService.name);
  private ai: OpenAI;
  private model: string;
  private provider: "qwen" | "groq";

  constructor() {
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
    this.model = useQwen
      ? process.env.QWEN_MODEL || "qwen-plus"
      : process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  }

  private hasApiKey() {
    return !!(process.env.QWEN_API_KEY || process.env.GROQ_API_KEY);
  }

  async generate(input: GenerateInput) {
    if (!this.hasApiKey()) {
      throw new BadRequestException(
        "AI provider not configured (set QWEN_API_KEY or GROQ_API_KEY).",
      );
    }
    const brief = String(input.brief || "").trim();
    if (!brief)
      throw new BadRequestException("Brief is required.");
    if (brief.length > 1000)
      throw new BadRequestException("Brief is too long (max 1000 chars).");

    const venue = input.venueConfig;
    if (!venue || !(venue.width > 0) || !(venue.height > 0))
      throw new BadRequestException("Invalid venue dimensions.");

    const stalls = input.templates?.stalls || [];
    const rounds = input.templates?.roundTables || [];
    const stages = input.templates?.speakerZones || [];
    if (stalls.length + rounds.length + stages.length === 0) {
      throw new BadRequestException(
        "Define at least one template (stall, round table, or speaker zone) before generating.",
      );
    }

    const plan = await this.askAiForPlan(input);
    const placement = this.placeFromPlan(plan, input);
    return placement;
  }

  // ============ Chat (multi-turn) ============
  async chat(input: ChatInput) {
    if (!this.hasApiKey()) {
      throw new BadRequestException(
        "AI provider not configured (set QWEN_API_KEY or GROQ_API_KEY).",
      );
    }
    const venue = input.venueConfig;
    if (!venue || !(venue.width > 0) || !(venue.height > 0))
      throw new BadRequestException("Invalid venue dimensions.");

    const stalls = input.templates?.stalls || [];
    const rounds = input.templates?.roundTables || [];
    const stages = input.templates?.speakerZones || [];
    if (stalls.length + rounds.length + stages.length === 0) {
      throw new BadRequestException(
        "Define at least one template before chatting.",
      );
    }
    if (!input.messages?.length) {
      throw new BadRequestException("messages is required.");
    }

    const sys = `You are a friendly venue layout designer talking with an event organizer. The organizer has ALREADY configured the venue dimensions and all template definitions (stalls, round tables, speaker zones). You can see all of them in the CONTEXT block. Your job is ONLY to decide where to place those templates — counts per wall, stage side, round-table zone, orientation.

NEVER ask "do you have stalls / round tables / a stage" — that's already set up. Reference templates by their actual name.

You have two tools:
- ask_user_question: ask ONE focused clarifying question and wait for the answer.
- finalize_layout: emit the final layout plan when you have enough info.

WHEN TO ASK:
- The brief doesn't tell you which side the stage goes on.
- The brief doesn't say which walls get stalls or how many on each (when stalls templates exist).
- The brief mentions round tables but not the count or which zone (central / front / back).
- Two interpretations are equally plausible.
- 1-3 questions max; each ONE sentence and ideally proposing a default in parentheses (e.g. "Stage on the south side?").

WHEN TO FINALIZE:
- The brief is specific OR the user has answered enough questions.
- You can pick reasonable defaults (e.g. horizontal orientation, central round-table zone, 8 chairs per table) — use the user payload's defaults when available.
- Use ONLY templateIds present in the provided lists.
- Stage wall is OFF-LIMITS for stalls — never assign stalls to it.
- Each stalls[] entry must include orientation ("horizontal" | "vertical").
- Counts must respect the venue area; don't overpack.

finalize_layout schema:
{
  "stage": { "templateId": "<id-or-null>", "side": "top|bottom|left|right|none" },
  "rounds": [ { "templateId": "<id>", "count": <int>, "zone": "central|front|back" } ],
  "stalls": [ { "templateId": "<id>", "count": <int>, "wall": "top|bottom|left|right", "orientation": "horizontal|vertical" } ],
  "speakerZones": [ { "templateId": "<id>", "side": "top|bottom|left|right|central" } ],
  "hasMainStage": <bool>,
  "summary": "<1-2 short lines, no markdown>"
}

DO NOT emit any other free-text response — always pick exactly one tool per turn.`;

    const userContext = {
      defaultOrientation: input.stallOrientation || "horizontal",
      venue: { width: venue.width, height: venue.height, name: venue.name || null },
      templates: {
        stalls: stalls.map((s) => ({
          id: s.id,
          name: s.name,
          width: s.width,
          height: s.height,
        })),
        roundTables: rounds.map((r) => ({
          id: r.id,
          name: r.name,
          chairs: r.numberOfChairs,
          diameter: r.tableDiameter,
        })),
        speakerZones: stages.map((sz) => ({
          id: sz.id,
          name: sz.name,
          isMainStage: !!sz.isMainStage,
          width: sz.width,
          height: sz.height,
        })),
      },
    };

    const tools: OpenAI.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "ask_user_question",
          description:
            "Ask the organizer ONE focused clarifying question to improve layout accuracy.",
          parameters: {
            type: "object",
            properties: {
              question: { type: "string" },
            },
            required: ["question"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "finalize_layout",
          description:
            "Produce the final layout plan once enough info is gathered.",
          parameters: {
            type: "object",
            properties: {
              stage: {
                type: "object",
                properties: {
                  templateId: { type: ["string", "null"] },
                  side: {
                    type: "string",
                    enum: ["top", "bottom", "left", "right", "none"],
                  },
                },
                required: ["templateId", "side"],
              },
              rounds: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    templateId: { type: "string" },
                    count: { type: "number" },
                    zone: {
                      type: "string",
                      enum: ["central", "front", "back"],
                    },
                  },
                  required: ["templateId", "count", "zone"],
                },
              },
              stalls: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    templateId: { type: "string" },
                    count: { type: "number" },
                    wall: {
                      type: "string",
                      enum: ["top", "bottom", "left", "right"],
                    },
                    orientation: {
                      type: "string",
                      enum: ["horizontal", "vertical"],
                    },
                  },
                  required: ["templateId", "count", "wall", "orientation"],
                },
              },
              speakerZones: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    templateId: { type: "string" },
                    side: {
                      type: "string",
                      enum: ["top", "bottom", "left", "right", "central"],
                    },
                  },
                  required: ["templateId", "side"],
                },
              },
              hasMainStage: { type: "boolean" },
              summary: { type: "string" },
            },
            required: [
              "stage",
              "rounds",
              "stalls",
              "speakerZones",
              "hasMainStage",
              "summary",
            ],
          },
        },
      },
    ];

    // Inject context at the front of the user messages so the LLM has the
    // template / venue info on every turn without us having to track state.
    const contextMsg = `=== CONTEXT (do not mention to user) ===
${JSON.stringify(userContext)}
=== END CONTEXT ===`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: sys },
      { role: "system", content: contextMsg },
      ...input.messages.map((m) => ({ role: m.role, content: m.content }) as any),
    ];

    const res = await this.ai.chat.completions.create({
      model: this.model,
      messages,
      tools,
      tool_choice: "required" as any,
      temperature: 0.2,
    });

    const msg = res.choices?.[0]?.message;
    const rawCall = msg?.tool_calls?.[0] as any;
    const call =
      rawCall && rawCall.type === "function" ? rawCall : rawCall || null;
    const fn = call?.function;

    if (fn?.name === "ask_user_question") {
      let q = "";
      try {
        q = JSON.parse(fn.arguments || "{}").question || "";
      } catch {}
      return { type: "question" as const, text: q || "Could you tell me more?" };
    }

    if (fn?.name === "finalize_layout") {
      let parsed: any = {};
      try {
        parsed = JSON.parse(fn.arguments || "{}");
      } catch {}
      // Reuse the existing sanitizer + placer.
      const generateInput: GenerateInput = {
        brief: input.messages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join("\n"),
        wallMargin: input.wallMargin,
        stallGap: input.stallGap,
        stallOrientation: input.stallOrientation,
        venueConfig: input.venueConfig,
        templates: input.templates,
      };
      const sanitized = this.sanitizePlan(parsed, generateInput);
      const placement = this.placeFromPlan(sanitized, generateInput);
      return {
        type: "layout" as const,
        text: sanitized.summary || "Here's the layout I came up with.",
        layout: placement,
      };
    }

    // Fallback — model returned plain text or didn't pick a tool. Treat as a question.
    const fallbackText = (msg?.content || "").trim();
    return {
      type: "question" as const,
      text:
        fallbackText ||
        "Tell me more about how you'd like to arrange your venue.",
    };
  }

  // ============ LLM step ============
  private async askAiForPlan(input: GenerateInput): Promise<AiPlan> {
    const { venueConfig: v, templates, brief, capacity, eventType } = input;
    const stalls = templates?.stalls || [];
    const rounds = templates?.roundTables || [];
    const stages = templates?.speakerZones || [];

    const sys = `You are an expert venue layout planner. You output ONE JSON object — nothing else, no prose, no code fences.

You will be given a brief, a venue size, and lists of available TEMPLATES. You must:
1. Pick which templates to use (you may use a subset). NEVER invent templateIds. Use only ids from the provided lists.
2. Decide counts for each picked template, balancing the requested capacity.
3. Decide a high-level zone for each: stage on a side, round-tables in a zone, stalls along a wall.
4. The PLACEMENT itself (x,y coords) is done by deterministic code afterwards — you only choose intent. Do not output coords.

Output schema (return EXACTLY this JSON, all keys present):
{
  "stage": { "templateId": "<id-or-null>", "side": "top|bottom|left|right|none" },
  "rounds": [ { "templateId": "<id>", "count": <int>, "zone": "central|front|back" } ],
  "stalls": [ { "templateId": "<id>", "count": <int>, "wall": "top|bottom|left|right", "orientation": "horizontal|vertical" } ],
  "speakerZones": [ { "templateId": "<id>", "side": "top|bottom|left|right|central" } ],
  "hasMainStage": <bool>,
  "summary": "<1-2 short lines, no markdown>"
}

RULES:
- Use ONLY templateIds present in the provided lists. If a kind has no templates, return an empty array for it.
- "stage" picks the speakerZone template that has isMainStage:true, or null if none. If chosen, also include it in speakerZones.
- "front" = side adjacent to the stage; "back" = opposite side; "central" = middle.
- The wall on which the stage sits is OFF-LIMITS for stalls. NEVER assign stalls to that wall.
- The brief is the source of truth. If the user explicitly specifies "N stalls of <template> on the <wall> wall", emit one stalls[] entry with EXACTLY that templateId, count, and wall — do not redistribute.
- If the user specifies different templates per wall, emit one stalls[] entry per (templateId, wall) pair.
- Counts must respect the venue area. Do not exceed reasonable density (each round table ≈ 150x150 footprint incl. chairs; each stall = its template w×h).
- Approximate the requested capacity using round-table chairs. If capacity > rounds can hold, use the largest round template repeatedly.
- ORIENTATION: each stalls[] entry MUST include "orientation". "horizontal" = stall's width is parallel to the wall (typical for top/bottom walls). "vertical" = stall is rotated 90° so its width axis is perpendicular to the wall (good for left/right walls or when the user wants narrow stalls hugging a wall). If the user says "stalls horizontally / facing inward / standard", use "horizontal". If they say "stalls vertically / sideways / rotated", use "vertical". If they don't specify, use the value provided in the user payload's defaultOrientation field.
- Keep summary short and factual.`;

    const userPayload = {
      brief,
      capacity: capacity || null,
      eventType: eventType || null,
      defaultOrientation: input.stallOrientation || "horizontal",
      venue: { width: v.width, height: v.height, name: v.name || null },
      templates: {
        stalls: stalls.map((s) => ({
          id: s.id,
          name: s.name,
          width: s.width,
          height: s.height,
        })),
        roundTables: rounds.map((r) => ({
          id: r.id,
          name: r.name,
          chairs: r.numberOfChairs,
          diameter: r.tableDiameter,
        })),
        speakerZones: stages.map((sz) => ({
          id: sz.id,
          name: sz.name,
          isMainStage: !!sz.isMainStage,
          width: sz.width,
          height: sz.height,
        })),
      },
    };

    const res = await this.ai.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" } as any,
    });

    const raw = res.choices?.[0]?.message?.content?.trim() || "{}";
    let parsed: AiPlan;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn(`Bad AI JSON, using empty plan. Raw=${raw.slice(0, 200)}`);
      parsed = {
        stage: { templateId: null, side: "none" },
        rounds: [],
        stalls: [],
        speakerZones: [],
        hasMainStage: false,
        summary: "Could not parse AI response.",
      };
    }

    return this.sanitizePlan(parsed, input);
  }

  private sanitizePlan(plan: any, input: GenerateInput): AiPlan {
    const validStallIds = new Set(
      (input.templates?.stalls || []).map((s) => s.id),
    );
    const validRoundIds = new Set(
      (input.templates?.roundTables || []).map((r) => r.id),
    );
    const validZoneIds = new Set(
      (input.templates?.speakerZones || []).map((sz) => sz.id),
    );
    const sides: Side[] = ["top", "bottom", "left", "right", "central", "none"];
    const clampSide = (s: any, fallback: Side = "central"): Side =>
      sides.includes(s) ? s : fallback;

    const stage = plan?.stage || { templateId: null, side: "none" };
    const safeStage = {
      templateId:
        stage.templateId && validZoneIds.has(stage.templateId)
          ? stage.templateId
          : null,
      side: clampSide(stage.side, "none"),
    };

    const rounds = (Array.isArray(plan?.rounds) ? plan.rounds : [])
      .filter((r: any) => r && validRoundIds.has(r.templateId))
      .map((r: any) => ({
        templateId: String(r.templateId),
        count: Math.max(0, Math.min(500, Math.floor(Number(r.count) || 0))),
        zone: clampSide(r.zone, "central"),
      }))
      .filter((r) => r.count > 0);

    const stageSide = safeStage.side;
    const defaultOrientation: StallOrientation =
      input.stallOrientation === "vertical" ? "vertical" : "horizontal";
    const stallsArr = (Array.isArray(plan?.stalls) ? plan.stalls : [])
      .filter((s: any) => s && validStallIds.has(s.templateId))
      .map((s: any) => ({
        templateId: String(s.templateId),
        count: Math.max(0, Math.min(200, Math.floor(Number(s.count) || 0))),
        wall: clampSide(s.wall, "top"),
        orientation: (s.orientation === "vertical" || s.orientation === "horizontal"
          ? s.orientation
          : defaultOrientation) as StallOrientation,
      }))
      .filter((s) => s.count > 0)
      // Drop stalls that the AI assigned to the stage wall — the user
      // explicitly wants the stage wall kept clear.
      .filter((s) => s.wall !== stageSide);

    const speakerZones = (Array.isArray(plan?.speakerZones)
      ? plan.speakerZones
      : []
    )
      .filter((z: any) => z && validZoneIds.has(z.templateId))
      .map((z: any) => ({
        templateId: String(z.templateId),
        side: clampSide(z.side, "central"),
      }));

    return {
      stage: safeStage,
      rounds,
      stalls: stallsArr,
      speakerZones,
      hasMainStage: !!plan?.hasMainStage,
      summary: String(plan?.summary || "").slice(0, 300),
    };
  }

  // ============ Deterministic placer ============
  private placeFromPlan(plan: AiPlan, input: GenerateInput) {
    const v = input.venueConfig;
    const stallsT = new Map(
      (input.templates?.stalls || []).map((s) => [s.id, s]),
    );
    const roundsT = new Map(
      (input.templates?.roundTables || []).map((r) => [r.id, r]),
    );
    const stageT = new Map(
      (input.templates?.speakerZones || []).map((s) => [s.id, s]),
    );

    const margin = input.wallMargin ?? 20;
    const aisle = 40;
    const stallGap = input.stallGap ?? 6;
    const stageBand = 140; // px reserved on the stage side
    const stallBand = 100; // px reserved on each stall wall

    // Reserve regions
    let inner = {
      x: margin,
      y: margin,
      w: v.width - margin * 2,
      h: v.height - margin * 2,
    };

    // 1. Stage band
    let stageRegion: { x: number; y: number; w: number; h: number } | null =
      null;
    if (plan.stage.side !== "none" && plan.stage.templateId) {
      const tpl = stageT.get(plan.stage.templateId);
      if (tpl) {
        if (plan.stage.side === "top") {
          stageRegion = { x: inner.x, y: inner.y, w: inner.w, h: stageBand };
          inner.y += stageBand + aisle;
          inner.h -= stageBand + aisle;
        } else if (plan.stage.side === "bottom") {
          stageRegion = {
            x: inner.x,
            y: inner.y + inner.h - stageBand,
            w: inner.w,
            h: stageBand,
          };
          inner.h -= stageBand + aisle;
        } else if (plan.stage.side === "left") {
          stageRegion = { x: inner.x, y: inner.y, w: stageBand, h: inner.h };
          inner.x += stageBand + aisle;
          inner.w -= stageBand + aisle;
        } else if (plan.stage.side === "right") {
          stageRegion = {
            x: inner.x + inner.w - stageBand,
            y: inner.y,
            w: stageBand,
            h: inner.h,
          };
          inner.w -= stageBand + aisle;
        }
      }
    }

    // 2. Stall bands per wall — collect all stalls grouped by wall first
    const stallsByWall: Record<string, typeof plan.stalls> = {};
    for (const s of plan.stalls) {
      const wall = ["top", "bottom", "left", "right"].includes(s.wall)
        ? s.wall
        : "top";
      (stallsByWall[wall] ||= []).push({ ...s, wall });
    }

    const stallRegions: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const wall of Object.keys(stallsByWall)) {
      // If stage occupies this wall, skip the wall (move to top).
      const usableWall = wall === plan.stage.side ? "top" : wall;
      if (usableWall === "top") {
        stallRegions[wall] = {
          x: inner.x,
          y: inner.y,
          w: inner.w,
          h: stallBand,
        };
        inner.y += stallBand + aisle;
        inner.h -= stallBand + aisle;
      } else if (usableWall === "bottom") {
        stallRegions[wall] = {
          x: inner.x,
          y: inner.y + inner.h - stallBand,
          w: inner.w,
          h: stallBand,
        };
        inner.h -= stallBand + aisle;
      } else if (usableWall === "left") {
        stallRegions[wall] = {
          x: inner.x,
          y: inner.y,
          w: stallBand,
          h: inner.h,
        };
        inner.x += stallBand + aisle;
        inner.w -= stallBand + aisle;
      } else if (usableWall === "right") {
        stallRegions[wall] = {
          x: inner.x + inner.w - stallBand,
          y: inner.y,
          w: stallBand,
          h: inner.h,
        };
        inner.w -= stallBand + aisle;
      }
    }

    // 3. Round tables zone (the inner remaining)
    const centralZone = { ...inner };

    // ====== Place stage (one item) ======
    const positionedSpeakerZones: any[] = [];
    if (stageRegion && plan.stage.templateId) {
      const tpl = stageT.get(plan.stage.templateId)!;
      positionedSpeakerZones.push({
        ...tpl,
        templateId: tpl.id,
        positionId: `pz_${Date.now()}_stage`,
        x: Math.round(stageRegion.x + stageRegion.w / 2 - tpl.width / 2),
        y: Math.round(stageRegion.y + stageRegion.h / 2 - tpl.height / 2),
        rotation: 0,
        isPlaced: true,
        venueConfigId: v.id || "",
      });
    }

    // ====== Place additional speaker zones (non-main) ======
    const perZoneTemplateIdx = new Map<string, number>();
    // Seed counters with the stage so a re-use of the same template numbers correctly.
    if (positionedSpeakerZones[0]?.templateId) {
      perZoneTemplateIdx.set(positionedSpeakerZones[0].templateId, 1);
    }
    plan.speakerZones.forEach((sz, idx) => {
      if (
        plan.stage.templateId === sz.templateId &&
        positionedSpeakerZones.some((pz) => pz.templateId === sz.templateId)
      ) {
        return;
      }
      const tpl = stageT.get(sz.templateId);
      if (!tpl) return;
      const x =
        Math.round(centralZone.x + Math.min(idx * (tpl.width + 20), Math.max(0, centralZone.w - tpl.width)));
      const y = Math.round(centralZone.y);
      const nextIdx = (perZoneTemplateIdx.get(tpl.id) || 0) + 1;
      perZoneTemplateIdx.set(tpl.id, nextIdx);
      positionedSpeakerZones.push({
        ...tpl,
        templateId: tpl.id,
        positionId: `pz_${Date.now()}_${idx}`,
        name: `${tpl.name} ${nextIdx}`,
        x,
        y,
        rotation: 0,
        isPlaced: true,
        venueConfigId: v.id || "",
      });
    });

    // ====== Place stalls along walls ======
    const positionedStalls: any[] = [];
    let stallCounter = 0;
    // Per-template instance counter so each stall of a given template gets a
    // unique tableName / name suffix (Space 1 #1, Space 1 #2, …).
    const perTemplateIndex = new Map<string, number>();
    for (const wall of Object.keys(stallsByWall)) {
      const region = stallRegions[wall];
      if (!region) continue;
      const items = stallsByWall[wall];
      let cursorX = region.x;
      let cursorY = region.y;
      const horizontal = wall === "top" || wall === "bottom";
      for (const item of items) {
        const tpl = stallsT.get(item.templateId);
        if (!tpl) continue;
        // Vertical orientation rotates each stall 90°, swapping the footprint
        // dimensions and recording rotation so the canvas draws it rotated.
        const isRotated = item.orientation === "vertical";
        const rotationDeg = isRotated ? 90 : 0;
        const baseW = tpl.width || 80;
        const baseH = tpl.height || 60;
        const w = isRotated ? baseH : baseW;
        const h = isRotated ? baseW : baseH;
        for (let i = 0; i < item.count; i++) {
          if (horizontal) {
            if (cursorX + w > region.x + region.w) {
              cursorX = region.x;
              cursorY += h + stallGap;
              if (cursorY + h > region.y + region.h) break;
            }
          } else {
            if (cursorY + h > region.y + region.h) {
              cursorX += w + stallGap;
              cursorY = region.y;
              if (cursorX + w > region.x + region.w) break;
            }
          }
          const nextIdx = (perTemplateIndex.get(tpl.id) || 0) + 1;
          perTemplateIndex.set(tpl.id, nextIdx);
          positionedStalls.push({
            ...tpl,
            positionId: `pt_${Date.now()}_${stallCounter++}`,
            name: String(nextIdx),
            tableName: String(nextIdx),
            x: Math.round(cursorX),
            y: Math.round(cursorY),
            rotation: rotationDeg,
            isPlaced: true,
            rowNumber: tpl.rowNumber || 1,
          });
          if (horizontal) cursorX += w + stallGap;
          else cursorY += h + stallGap;
        }
      }
    }

    // ====== Place round tables in central zone ======
    const positionedRounds: any[] = [];
    let roundCounter = 0;
    const perRoundTemplateIdx = new Map<string, number>();
    let rtCursorX = centralZone.x;
    let rtCursorY = centralZone.y;
    let rtRowMaxH = 0;
    for (const r of plan.rounds) {
      const tpl = roundsT.get(r.templateId);
      if (!tpl) continue;
      const diameter = tpl.tableDiameter || 120;
      const footprint = diameter + 20; // include chair ring
      for (let i = 0; i < r.count; i++) {
        if (rtCursorX + footprint > centralZone.x + centralZone.w) {
          rtCursorX = centralZone.x;
          rtCursorY += (rtRowMaxH || footprint) + 20;
          rtRowMaxH = 0;
        }
        if (rtCursorY + footprint > centralZone.y + centralZone.h) {
          break;
        }
        const nextIdx = (perRoundTemplateIdx.get(tpl.id) || 0) + 1;
        perRoundTemplateIdx.set(tpl.id, nextIdx);
        positionedRounds.push({
          ...tpl,
          positionId: `pr_${Date.now()}_${roundCounter++}`,
          templateId: tpl.id,
          name: String(nextIdx),
          x: Math.round(rtCursorX),
          y: Math.round(rtCursorY),
          rotation: 0,
          isPlaced: true,
          venueConfigId: v.id || "",
          bookedChairs: [],
          isFullyBooked: false,
        });
        rtCursorX += footprint;
        rtRowMaxH = Math.max(rtRowMaxH, footprint);
      }
    }

    const warnings: string[] = [];
    const requestedRounds = plan.rounds.reduce((s, r) => s + r.count, 0);
    if (requestedRounds > positionedRounds.length) {
      warnings.push(
        `Could only fit ${positionedRounds.length}/${requestedRounds} round tables — venue is too small.`,
      );
    }
    const requestedStalls = plan.stalls.reduce((s, r) => s + r.count, 0);
    if (requestedStalls > positionedStalls.length) {
      warnings.push(
        `Could only fit ${positionedStalls.length}/${requestedStalls} stalls along the chosen walls.`,
      );
    }

    return {
      ok: true,
      summary: plan.summary,
      hasMainStage: plan.hasMainStage,
      positionedTables: positionedStalls,
      positionedRoundTables: positionedRounds,
      positionedSpeakerZones,
      warnings,
      provider: this.provider,
    };
  }
}
