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

interface ChatVisionInput extends ChatInput {
  blueprint: { buffer: Buffer; mimeType: string };
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
  private visionModel: string;
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
    this.visionModel = useQwen
      ? process.env.QWEN_VISION_MODEL || "qwen-vl-plus"
      : process.env.GROQ_VISION_MODEL ||
        "meta-llama/llama-4-scout-17b-16e-instruct";
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

  // ============ Chat with blueprint image ============
  async chatVision(input: ChatVisionInput) {
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
        "Define at least one template before generating from a blueprint.",
      );
    }
    if (!input.blueprint?.buffer?.length) {
      throw new BadRequestException("blueprint image is required.");
    }

    const userText = (input.messages || [])
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n")
      .trim();

    const sys = `You are an expert venue layout planner reading an architect's blueprint image. You ALWAYS produce a usable layout — never refuse.

PROCEDURE — follow strictly:
1. Look at the image. Identify the rough rectangular shape of the venue (it may be hand-drawn, low-contrast, photographed at an angle, partially cropped, or a CAD line drawing — that's fine). If you can see ANY rectangle, treat it as the venue and proceed.
2. From that shape, make your BEST GUESS at:
   - which side has the entrance (look for door swings, "ENTRY"/"EXIT" labels, a corridor, an opening, or just the side closest to a labeled lobby/road).
   - which walls are LONGEST and clearest (no doors, no interior columns).
3. Map blueprint orientation → canvas orientation: canvas "top" = top of image, "bottom" = bottom, etc. If the blueprint's long axis runs differently from the canvas, mentally rotate.
4. Decide placements:
   - stage.side: opposite the entrance, on the longest clear wall.
   - stalls.wall: along the LONGEST clear walls. NEVER on the stage wall. Avoid the entrance wall unless the organizer explicitly asks.
   - rounds.zone: "central" by default.
5. Honor any organizer text request OVER your visual guesses.
6. Counts — be GENEROUS, NOT conservative. The deterministic placer downstream already prevents overlap and trims excess that won't fit, so aim HIGH. Defaults when the organizer didn't specify a number:
   - Stalls: aim to FILL each long clear wall — typically 12–25 stalls per wall.
   - Round tables: ~10–20 in the central area. ALWAYS include round tables if they exist in templates and the venue has any central open space — only omit if the organizer explicitly said no tables or the centre is unusably small.
   - Speaker zones: at minimum, include the main stage; add additional zones only if the organizer asked.
7. USE THE TEMPLATES PROVIDED. If the templates list includes round tables AND stalls, your output MUST include both unless the organizer specifically said otherwise. Returning only stalls (or only one wall of stalls) when other templates are available is a FAILURE.

CRITICAL — TEMPLATE IDS:
- The user payload contains a "templates" block with the EXACT ids. COPY ids verbatim — do not invent, abbreviate, or rename them.
- If a kind has no templates available, return [] for it.
- For "stage", pick the speakerZone whose isMainStage is true; otherwise null.

OUTPUT FORMAT — return ONLY one JSON object, no prose, no markdown, no code fences:
{
  "stage": { "templateId": "<exact-id-or-null>", "side": "top|bottom|left|right|none" },
  "rounds": [ { "templateId": "<exact-id>", "count": <int>, "zone": "central|front|back" } ],
  "stalls": [ { "templateId": "<exact-id>", "count": <int>, "wall": "top|bottom|left|right", "orientation": "horizontal|vertical" } ],
  "speakerZones": [ { "templateId": "<exact-id>", "side": "top|bottom|left|right|central" } ],
  "hasMainStage": <bool>,
  "summary": "<1-2 short lines: name 1-2 visible features (entrance side, longest wall) and how you used them. If you had to guess heavily, say so honestly>"
}

ORIENTATION:
- "top"/"bottom" walls are horizontal → use orientation:"horizontal" for stalls there.
- "left"/"right" walls are vertical → use orientation:"vertical" for stalls there.

DO NOT REFUSE. The ONLY case where you may return entirely empty arrays is if the image is COMPLETELY BLANK or shows something that is unmistakably NOT a venue (e.g. a photo of a person, a logo, an animal). Low contrast, hand-drawn sketch, partial crop, photo of a printed plan, CAD line drawing — all of these MUST get a reasonable layout. When in doubt, place items along reasonable walls and explain your guesses in the summary. Returning an empty plan when a rectangular space is visible is a FAILURE.`;

    const userPayload = {
      organizerRequest: userText || "(no text — go off the blueprint alone)",
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

    const dataUri = `data:${input.blueprint.mimeType};base64,${input.blueprint.buffer.toString("base64")}`;
    this.logger.log(
      `chatVision incoming: mime=${input.blueprint.mimeType} bytes=${input.blueprint.buffer.length} venue=${venue.width}x${venue.height} userText="${userText.slice(0, 80)}"`,
    );

    // Try primary provider; if its plan is empty/broken, try the other one.
    const primary = await this.callVisionProvider({
      provider: this.provider,
      apiKey:
        this.provider === "qwen"
          ? process.env.QWEN_API_KEY!
          : process.env.GROQ_API_KEY!,
      baseURL:
        this.provider === "qwen"
          ? process.env.QWEN_BASE_URL ||
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
          : process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
      model: this.visionModel,
      sys,
      userPayload,
      dataUri,
    });

    let parsed = primary.parsed;
    let providerUsed = this.provider;
    let modelUsed = this.visionModel;
    const warnings: string[] = [];
    if (primary.error) warnings.push(primary.error);

    const planIsEmpty = (p: any) =>
      !p ||
      ((!p.stalls || p.stalls.length === 0) &&
        (!p.rounds || p.rounds.length === 0) &&
        (!p.speakerZones || p.speakerZones.length === 0));

    if (planIsEmpty(parsed)) {
      const altProvider: "qwen" | "groq" =
        this.provider === "groq" ? "qwen" : "groq";
      const altKey =
        altProvider === "qwen"
          ? process.env.QWEN_API_KEY
          : process.env.GROQ_API_KEY;
      if (altKey) {
        const altModel =
          altProvider === "qwen"
            ? process.env.QWEN_VISION_MODEL || "qwen-vl-plus"
            : process.env.GROQ_VISION_MODEL ||
              "meta-llama/llama-4-scout-17b-16e-instruct";
        const altBase =
          altProvider === "qwen"
            ? process.env.QWEN_BASE_URL ||
              "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
            : process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
        this.logger.log(
          `Primary vision provider (${this.provider}) returned empty plan; falling back to ${altProvider}/${altModel}`,
        );
        const fb = await this.callVisionProvider({
          provider: altProvider,
          apiKey: altKey,
          baseURL: altBase,
          model: altModel,
          sys,
          userPayload,
          dataUri,
        });
        if (fb.parsed && !planIsEmpty(fb.parsed)) {
          parsed = fb.parsed;
          providerUsed = altProvider;
          modelUsed = altModel;
        } else if (fb.error) {
          warnings.push(`Fallback ${altProvider}: ${fb.error}`);
        }
      }
    }

    const generateInput: GenerateInput = {
      brief: userText,
      wallMargin: input.wallMargin,
      stallGap: input.stallGap,
      stallOrientation: input.stallOrientation,
      venueConfig: input.venueConfig,
      templates: input.templates,
    };

    // If both vision providers refused, fall back to the text-only planner so
    // the user always gets a usable starter layout — they can drag from there.
    let usedFallback = false;
    if (!parsed || planIsEmpty(parsed)) {
      this.logger.warn(
        `Both vision providers refused; falling back to text-only planner. providerUsed=${providerUsed}/${modelUsed}`,
      );
      try {
        const textPlan = await this.askAiForPlan({
          ...generateInput,
          brief:
            userText ||
            `Generate a sensible default venue layout for "${venue.name || "this venue"}" — stage on the side opposite the entrance, stalls along the longest walls, round tables in the centre.`,
        });
        parsed = textPlan;
        usedFallback = true;
        warnings.push(
          "Couldn't read your blueprint clearly — generated a generic layout from your description instead. Drag items to align with your floor plan.",
        );
      } catch (e: any) {
        this.logger.warn(`Text-only fallback also failed: ${e?.message || e}`);
        parsed = {
          stage: { templateId: null, side: "none" },
          rounds: [],
          stalls: [],
          speakerZones: [],
          hasMainStage: false,
          summary: "Could not interpret the blueprint.",
        };
      }
    }

    // Resolve fuzzy / mis-cased / hallucinated templateIds back to real ones.
    parsed = this.resolveTemplateIds(parsed, input.templates);

    const sanitized = this.sanitizePlan(parsed, generateInput);
    const placement = this.placeFromPlan(sanitized, generateInput);
    if (warnings.length)
      placement.warnings = [...(placement.warnings || []), ...warnings];

    if (planIsEmpty(sanitized)) {
      this.logger.warn(
        `chatVision produced empty plan after sanitize. provider=${providerUsed}/${modelUsed} usedFallback=${usedFallback}`,
      );
    }

    return {
      type: "layout" as const,
      text: usedFallback
        ? "I couldn't read your blueprint clearly, so I generated a starter layout from your description. Drag items to align with your floor plan, or upload a sharper / higher-contrast image."
        : sanitized.summary ||
          "Here's a draft layout based on your blueprint — drag any item to fine-tune.",
      layout: placement,
    };
  }

  /**
   * Call a vision-capable LLM endpoint, parse its (possibly fenced) response
   * into a plan. Returns { parsed, error } — never throws so the caller can
   * cleanly fall back to the other provider.
   */
  private async callVisionProvider(args: {
    provider: "qwen" | "groq";
    apiKey: string;
    baseURL: string;
    model: string;
    sys: string;
    userPayload: any;
    dataUri: string;
  }): Promise<{ parsed: any; error?: string }> {
    const client = new OpenAI({ apiKey: args.apiKey, baseURL: args.baseURL });
    let raw = "";
    try {
      const res = await client.chat.completions.create({
        model: args.model,
        messages: [
          { role: "system", content: args.sys },
          {
            role: "user",
            content: [
              { type: "text", text: JSON.stringify(args.userPayload) },
              { type: "image_url", image_url: { url: args.dataUri } } as any,
            ] as any,
          },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      } as any);
      raw = (res.choices?.[0]?.message?.content || "").trim();
    } catch (e: any) {
      const msg = e?.message || String(e);
      this.logger.warn(
        `Vision call ${args.provider}/${args.model} threw: ${msg}`,
      );
      return { parsed: null, error: `${args.provider} call failed: ${msg}` };
    }

    if (!raw) {
      this.logger.warn(`Vision call ${args.provider}/${args.model} returned empty response.`);
      return { parsed: null, error: `${args.provider} returned no content` };
    }

    const jsonText = this.extractJsonObject(raw);
    if (!jsonText) {
      this.logger.warn(
        `Vision raw not parseable (${args.provider}/${args.model}). First 400 chars: ${raw.slice(0, 400)}`,
      );
      return { parsed: null, error: `${args.provider} returned non-JSON content` };
    }
    try {
      const parsed = JSON.parse(jsonText);
      const stallTotal = (parsed?.stalls || []).reduce(
        (s: number, e: any) => s + (Number(e?.count) || 0),
        0,
      );
      const roundTotal = (parsed?.rounds || []).reduce(
        (s: number, e: any) => s + (Number(e?.count) || 0),
        0,
      );
      this.logger.log(
        `Vision ${args.provider}/${args.model} → stage=${parsed?.stage?.side || "?"}, stallEntries=${(parsed?.stalls || []).length} stallTotal=${stallTotal}, roundEntries=${(parsed?.rounds || []).length} roundTotal=${roundTotal}, summary="${String(parsed?.summary || "").slice(0, 160)}"`,
      );
      return { parsed };
    } catch (e: any) {
      this.logger.warn(
        `Vision JSON.parse failed (${args.provider}/${args.model}): ${e?.message}. First 400: ${jsonText.slice(0, 400)}`,
      );
      return { parsed: null, error: `${args.provider} returned malformed JSON` };
    }
  }

  /**
   * Pull a JSON object out of a possibly-fenced / prose-wrapped LLM response.
   * Strategy: strip ```json``` fences first, then find the first balanced {...}
   * span by depth-counting (handles cases where the model adds prose around it).
   */
  private extractJsonObject(raw: string): string | null {
    let s = raw.trim();
    // Strip ```json ... ``` or ``` ... ``` wrappers.
    const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
    if (fence) s = fence[1].trim();
    // If it looks like an object already, return it.
    if (s.startsWith("{") && s.endsWith("}")) return s;
    // Otherwise scan for the first balanced {...} block.
    let depth = 0;
    let start = -1;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && start >= 0) {
          return s.slice(start, i + 1);
        }
      }
    }
    return null;
  }

  /**
   * Repair templateIds the model may have invented or mis-cased. For each entry,
   * if its templateId already matches a real id we keep it; otherwise we try to
   * find the closest real template by (a) case-insensitive id match, (b) name
   * substring, (c) numeric index hint ("stall 2"), (d) fall back to the first
   * template of that kind. This keeps the layout from collapsing to empty when
   * the LLM returns near-correct IDs.
   */
  private resolveTemplateIds(
    plan: any,
    templates: ChatVisionInput["templates"],
  ): any {
    const stalls = templates?.stalls || [];
    const rounds = templates?.roundTables || [];
    const zones = templates?.speakerZones || [];

    const fuzzyMatch = (
      bad: any,
      pool: { id: string; name?: string }[],
    ): string | null => {
      if (!pool.length) return null;
      const idStr = String(bad ?? "").trim();
      if (!idStr) return pool[0].id;
      // Exact match — already fine.
      const exact = pool.find((t) => t.id === idStr);
      if (exact) return exact.id;
      // Case-insensitive id match.
      const ci = pool.find((t) => t.id.toLowerCase() === idStr.toLowerCase());
      if (ci) return ci.id;
      // Name substring match.
      const lower = idStr.toLowerCase();
      const byName = pool.find(
        (t) =>
          t.name &&
          (t.name.toLowerCase() === lower ||
            t.name.toLowerCase().includes(lower) ||
            lower.includes(t.name.toLowerCase())),
      );
      if (byName) return byName.id;
      // Numeric hint: "stall_2" / "template 1" → index 1 (0-based) or 0.
      const num = idStr.match(/(\d+)/);
      if (num) {
        const idx = Math.max(0, Math.min(pool.length - 1, parseInt(num[1], 10) - 1));
        return pool[idx].id;
      }
      // Last resort: first of kind.
      return pool[0].id;
    };

    const out = { ...plan };
    if (out.stage?.templateId) {
      out.stage = {
        ...out.stage,
        templateId: fuzzyMatch(out.stage.templateId, zones) || null,
      };
    }
    out.stalls = (Array.isArray(out.stalls) ? out.stalls : []).map((s: any) => ({
      ...s,
      templateId: fuzzyMatch(s.templateId, stalls),
    }));
    out.rounds = (Array.isArray(out.rounds) ? out.rounds : []).map((r: any) => ({
      ...r,
      templateId: fuzzyMatch(r.templateId, rounds),
    }));
    out.speakerZones = (Array.isArray(out.speakerZones) ? out.speakerZones : []).map(
      (z: any) => ({ ...z, templateId: fuzzyMatch(z.templateId, zones) }),
    );
    return out;
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
