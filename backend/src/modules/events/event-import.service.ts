import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import OpenAI from "openai";
import * as fs from "fs/promises";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

interface ImportRequest {
  url: string;
}

export interface ImportedEvent {
  title?: string;
  category?: string;
  description?: string;
  startDate?: string;
  time?: string;
  endDate?: string;
  endTime?: string;
  location?: string;
  address?: string;
  visibility?: "public" | "private";
  tags?: string[];
  ageRestriction?: string;
  dresscode?: string;
  specialInstructions?: string;
  refundPolicy?: string;
  termsAndConditions?: string;
  // ----- Venue & space templates (Venue Setup / Spaces / Round Tables / Speakers tabs) -----
  venue?: {
    width?: number; // px on the canvas (1m ≈ 100px)
    height?: number;
    hasMainStage?: boolean;
  };
  stalls?: Array<{
    name: string;
    count?: number; // requested count if the page mentions one
    width?: number;
    height?: number;
    tablePrice?: number;
    bookingPrice?: number;
    depositPrice?: number;
  }>;
  roundTables?: Array<{
    name: string;
    count?: number;
    numberOfChairs?: number;
    sellingMode?: "table" | "chair";
    tablePrice?: number;
    chairPrice?: number;
    tableDiameter?: number;
  }>;
  speakerZones?: Array<{
    name: string;
    isMainStage?: boolean;
    width?: number;
    height?: number;
    slotPrice?: number;
    maxSpeakers?: number;
    maxVisitors?: number;
  }>;
}

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB
const FETCH_TIMEOUT_MS = 12_000;
const MAX_LLM_CONTEXT_CHARS = 18_000;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB
const IMAGE_FETCH_TIMEOUT_MS = 10_000;

@Injectable()
export class EventImportService {
  private readonly logger = new Logger(EventImportService.name);
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

  async importFromUrl(input: ImportRequest): Promise<{
    ok: true;
    fields: ImportedEvent;
    sourceUrl: string;
    notes: string[];
    /** Local URL (e.g. /uploads/imports/abc.png) the frontend can fetch to set as the event banner. */
    imageUrl?: string;
  }> {
    if (!this.hasApiKey()) {
      throw new BadRequestException(
        "AI provider not configured (set QWEN_API_KEY or GROQ_API_KEY).",
      );
    }
    const url = this.validateUrl(input.url);
    const notes: string[] = [];
    const html = await this.fetchHtml(url);
    const extracted = this.extractStructuredText(html);
    if (!extracted.combinedText.trim() && extracted.imageCandidates.length === 0) {
      throw new BadRequestException(
        "Couldn't read any text or images from that URL. The page may be JS-only or behind a login.",
      );
    }
    let fields: ImportedEvent = {};
    if (extracted.combinedText.trim()) {
      fields = await this.askLlmForFields(extracted.combinedText, url);
    }

    const textPassFieldNames = Object.keys(fields).filter(
      (k) => (fields as any)[k] !== undefined,
    );
    this.logger.log(
      `import-from-url text pass: fields=[${textPassFieldNames.join(",")}] (provider=${this.provider})`,
    );

    // OCR fallback. We trigger it more aggressively than before because the
    // text-only LLM frequently hallucinates date/venue/address values when the
    // page is image-heavy (e.g. Wild Apricot, FB events). Trigger when:
    //  - the page is a JS shell, OR
    //  - the text pass produced very few fields, OR
    //  - the page has at least one image candidate that looks event-related
    //    (flyer, poster, bazaar, slide, BC-1, etc) — in this case the real
    //    truth is almost certainly baked into that image.
    const meaningfulCount = this.countMeaningfulFields(fields);
    const hasContentImage = extracted.imageCandidates.some((u) =>
      /(event|flyer|poster|banner|bazaar|festival|conference|workshop|hero|featured|slide|bc-\d|page-\d)/i.test(
        u,
      ),
    );
    const shouldOcr =
      extracted.imageCandidates.length > 0 &&
      (extracted.shellOnly || meaningfulCount < 3 || hasContentImage);

    if (shouldOcr) {
      this.logger.log(
        `import-from-url: triggering OCR (textFields=${meaningfulCount}, shellOnly=${extracted.shellOnly}, hasContentImage=${hasContentImage}, candidates=${extracted.imageCandidates.length})`,
      );
      const ocr = await this.ocrEventFlyer(
        extracted.imageCandidates,
        url,
      ).catch((e: any) => {
        this.logger.warn(`OCR fallback failed: ${e?.message || e}`);
        return null;
      });
      if (ocr) {
        const ocrFieldNames = Object.keys(ocr).filter(
          (k) => (ocr as any)[k] !== undefined,
        );
        this.logger.log(
          `import-from-url OCR pass: fields=[${ocrFieldNames.join(",")}]`,
        );
        // Smart merge:
        //  - "ground-truth" fields baked into a flyer (dates, times, venue,
        //    address) — OCR wins. Text-pass values for these are commonly
        //    hallucinated when the page is image-heavy.
        //  - "narrative" fields (title, description, category, tags, policies)
        //    — text pass wins. HTML titles/descriptions are reliable, OCR
        //    titles are sometimes truncated by image cropping.
        fields = this.smartMerge(fields, ocr);
        notes.push(
          "Read key details (dates / venue / address) from the page's main image — the page text alone didn't reliably contain them. Review carefully.",
        );
      } else if (extracted.shellOnly) {
        notes.push(
          "This page renders most content with JavaScript and we couldn't read its main image — the import is partial.",
        );
      } else if (hasContentImage) {
        notes.push(
          "Couldn't read the flyer image on this page. Date / venue values may be unreliable — verify them.",
        );
      }
    } else if (extracted.shellOnly) {
      notes.push(
        "This page renders most content with JavaScript — the import is partial. Review the fields carefully.",
      );
    }

    // Try to also download a banner image. We pick the top-ranked candidate
    // (og:image > first content-keyword <img>) — that's typically the page's
    // intended hero/poster. Failure is non-fatal.
    let imageUrl: string | undefined;
    if (extracted.imageCandidates.length > 0) {
      imageUrl = await this.saveBannerImage(
        extracted.imageCandidates,
        url,
      ).catch((e) => {
        this.logger.warn(`Banner image save failed: ${e?.message || e}`);
        return undefined;
      });
      if (imageUrl) {
        this.logger.log(`import-from-url banner: saved ${imageUrl}`);
      }
    }

    this.logger.log(
      `import-from-url: ${url} → fields=${this.countMeaningfulFields(fields)} (provider=${this.provider}, ocrTried=${shouldOcr}, banner=${imageUrl ? "yes" : "no"})`,
    );
    return { ok: true, fields, sourceUrl: url, notes, imageUrl };
  }

  /**
   * Download the best-ranked image candidate, persist it under
   * ./uploads/imports/<uuid>.<ext>, and return its public URL path. Tries up to
   * 3 candidates so a flaky/auth-walled first link doesn't block the rest.
   */
  private async saveBannerImage(
    candidates: string[],
    sourceUrl: string,
  ): Promise<string | undefined> {
    for (const candidate of candidates.slice(0, 3)) {
      const absolute = this.resolveImageUrl(candidate, sourceUrl);
      if (!absolute) continue;
      try {
        this.validateUrl(absolute);
      } catch {
        continue;
      }
      const img = await this.downloadImage(absolute).catch(() => null);
      if (!img) continue;
      try {
        // uploads/ lives at the project root next to dist/. main.ts mounts
        // /uploads → <backend-root>/uploads/, so we write to the same place.
        const dir = path.join(process.cwd(), "uploads", "imports");
        await fs.mkdir(dir, { recursive: true });
        const ext = this.mimeToExt(img.mimeType);
        const filename = `${uuidv4()}.${ext}`;
        await fs.writeFile(path.join(dir, filename), img.buffer);
        return `/uploads/imports/${filename}`;
      } catch (e: any) {
        this.logger.warn(`Failed to write imported image: ${e?.message || e}`);
        continue;
      }
    }
    return undefined;
  }

  private mimeToExt(mime: string): string {
    if (/jpeg|jpg/i.test(mime)) return "jpg";
    if (/png/i.test(mime)) return "png";
    if (/webp/i.test(mime)) return "webp";
    return "img";
  }

  /**
   * Field-aware merge for text-pass + OCR-pass results.
   * - Ground-truth fields baked into flyers (date, time, venue, address) →
   *   OCR wins when present, falling back to text pass.
   * - Narrative fields (title, description, category, tags, policies) →
   *   text pass wins, OCR fills only what text pass left blank.
   */
  private smartMerge(
    textPass: ImportedEvent,
    ocrPass: ImportedEvent,
  ): ImportedEvent {
    const out: ImportedEvent = { ...textPass };
    const isEmpty = (v: any) =>
      v === undefined ||
      v === null ||
      v === "" ||
      (Array.isArray(v) && v.length === 0);
    const groundTruth: (keyof ImportedEvent)[] = [
      "startDate",
      "time",
      "endDate",
      "endTime",
      "location",
      "address",
      // Vendor stalls / round tables / speaker zones / venue dims are
      // typically baked into flyers — when OCR finds them, prefer those.
      "venue",
      "stalls",
      "roundTables",
      "speakerZones",
    ];
    for (const k of groundTruth) {
      if (!isEmpty(ocrPass[k])) (out as any)[k] = ocrPass[k];
    }
    const narrative: (keyof ImportedEvent)[] = [
      "title",
      "description",
      "category",
      "tags",
      "ageRestriction",
      "dresscode",
      "specialInstructions",
      "refundPolicy",
      "termsAndConditions",
      "visibility",
    ];
    for (const k of narrative) {
      if (isEmpty(out[k]) && !isEmpty(ocrPass[k])) {
        (out as any)[k] = ocrPass[k];
      }
    }
    return out;
  }

  private countMeaningfulFields(fields: ImportedEvent): number {
    return Object.values(fields).filter((v) => {
      if (Array.isArray(v)) return v.length > 0;
      return v !== undefined && v !== null && v !== "";
    }).length;
  }

  private mergeFields(
    primary: ImportedEvent,
    fallback: ImportedEvent,
  ): ImportedEvent {
    const out: ImportedEvent = { ...primary };
    const isEmpty = (v: any) =>
      v === undefined ||
      v === null ||
      v === "" ||
      (Array.isArray(v) && v.length === 0);
    const isFiller = (s: string) =>
      /^\s*(not (specified|provided|available|listed|mentioned)|n\/?a|none|unknown|tbd|tba)\s*(in (the )?image)?\s*\.?\s*$/i.test(
        s,
      );
    // Strings that look like the prompt's filler/placeholder text — drop them
    // before merging so they don't crowd out real values from a later slide.
    const cleanString = (v: any): string | undefined => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      if (!t || isFiller(t)) return undefined;
      return t;
    };

    // Three categories of merge behaviour:
    //  - concatTextKeys: append "\n\n" between slides — a bazaar's rules,
    //    application guidelines, and booth rules each live on a different
    //    slide; we want all of them.
    //  - concatArrayKeys: dedup by name, append; one slide's stall tiers
    //    plus another's round-table tiers both end up in the final list.
    //  - everything else: first non-empty wins (titles, dates, venue, etc.).
    const concatTextKeys: (keyof ImportedEvent)[] = [
      "description",
      "specialInstructions",
      "refundPolicy",
      "termsAndConditions",
    ];
    const concatArrayKeys: (keyof ImportedEvent)[] = [
      "stalls",
      "roundTables",
      "speakerZones",
      "tags",
    ];

    (Object.keys(fallback) as (keyof ImportedEvent)[]).forEach((k) => {
      const p = (out as any)[k];
      const fRaw = (fallback as any)[k];
      if (isEmpty(fRaw)) return;

      // Drop filler strings ("Not specified in the image.") before considering.
      let f = fRaw;
      if (concatTextKeys.includes(k) || k === "title" || k === "location" || k === "address") {
        f = cleanString(fRaw);
        if (!f) return;
      }

      if (concatTextKeys.includes(k)) {
        const pStr = cleanString(p) || "";
        // Drop fallback if it's a substring of primary (avoid duplication
        // when the same paragraph appears on multiple slides).
        if (
          pStr &&
          (pStr.toLowerCase().includes((f as string).toLowerCase()) ||
            (f as string).toLowerCase().includes(pStr.toLowerCase()))
        ) {
          // Keep whichever is longer.
          (out as any)[k] = pStr.length >= (f as string).length ? pStr : f;
          return;
        }
        (out as any)[k] = pStr ? `${pStr}\n\n${f}` : f;
        return;
      }

      if (concatArrayKeys.includes(k) && Array.isArray(p) && Array.isArray(fRaw)) {
        const seen = new Set(
          p.map((e: any) =>
            typeof e === "string" ? e.toLowerCase() : (e?.name || "").toLowerCase(),
          ),
        );
        const merged = [
          ...p,
          ...(fRaw as any[]).filter((e: any) => {
            const n =
              typeof e === "string" ? e.toLowerCase() : (e?.name || "").toLowerCase();
            if (!n || seen.has(n)) return false;
            seen.add(n);
            return true;
          }),
        ];
        (out as any)[k] = merged;
        return;
      }

      if (isEmpty(p)) (out as any)[k] = f;
    });
    return out;
  }

  // ============ URL validation ============
  private validateUrl(raw: string): string {
    if (!raw || typeof raw !== "string")
      throw new BadRequestException("URL is required.");
    if (raw.length > 2048)
      throw new BadRequestException("URL is too long.");
    let parsed: URL;
    try {
      parsed = new URL(raw.trim());
    } catch {
      throw new BadRequestException("Invalid URL.");
    }
    if (!/^https?:$/.test(parsed.protocol))
      throw new BadRequestException("Only http and https URLs are allowed.");
    // Block localhost / private ranges to prevent SSRF.
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host.endsWith(".localhost") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === "::1"
    ) {
      throw new BadRequestException("Internal URLs are not allowed.");
    }
    return parsed.toString();
  }

  // ============ Fetch HTML ============
  private async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          // Pretend to be a friendly browser so sites don't 403 us.
          "User-Agent":
            "Mozilla/5.0 (compatible; EventshImporter/1.0; +https://eventsh.app)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en",
        },
      });
      if (!res.ok) {
        throw new BadRequestException(
          `Couldn't fetch URL (${res.status} ${res.statusText}).`,
        );
      }
      const ct = res.headers.get("content-type") || "";
      if (
        !/text\/html|application\/xhtml|application\/xml|text\/plain/i.test(ct)
      ) {
        throw new BadRequestException(
          `Unsupported content type: ${ct}. Provide a regular web page URL.`,
        );
      }
      // Read the body but cap it.
      const reader = res.body?.getReader();
      if (!reader) return await res.text();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value);
        received += value.length;
        if (received > MAX_HTML_BYTES) {
          this.logger.warn(
            `import-from-url: truncating ${url} at ${MAX_HTML_BYTES} bytes`,
          );
          break;
        }
      }
      return Buffer.concat(chunks).toString("utf8");
    } catch (e: any) {
      if (e?.name === "AbortError") {
        throw new BadRequestException(
          "Timed out fetching that URL. Try a different page.",
        );
      }
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(
        `Couldn't fetch URL: ${e?.message || "unknown error"}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  // ============ HTML → structured text ============
  /**
   * Pulls the high-signal parts out of the HTML: <title>, meta tags (OG/Twitter
   * cards + standard description/keywords), JSON-LD blocks, and the visible
   * body text with scripts/styles/nav/footer stripped. The combined text is
   * what we feed to the LLM.
   */
  private extractStructuredText(html: string): {
    combinedText: string;
    shellOnly: boolean;
    imageCandidates: string[];
  } {
    if (!html) return { combinedText: "", shellOnly: true, imageCandidates: [] };

    const parts: string[] = [];
    const imageCandidates: string[] = [];

    // <title>
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) parts.push(`TITLE: ${this.decodeText(titleMatch[1])}`);

    // <meta name="..." content="..."> and <meta property="og:..." content="...">
    const metaRegex =
      /<meta[^>]+?(?:name|property)\s*=\s*["']([^"']+)["'][^>]+?content\s*=\s*["']([^"']*)["'][^>]*>/gi;
    const metaPairs: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = metaRegex.exec(html))) {
      const key = m[1].toLowerCase();
      const val = this.decodeText(m[2]).trim();
      if (!val) continue;
      if (
        key === "description" ||
        key === "keywords" ||
        key.startsWith("og:") ||
        key.startsWith("twitter:") ||
        key === "author" ||
        key === "article:published_time"
      ) {
        metaPairs.push(`${key}: ${val}`);
      }
      // OG/Twitter image candidates — highest priority for the OCR fallback.
      if (key === "og:image" || key === "twitter:image") {
        imageCandidates.push(val);
      }
    }
    if (metaPairs.length) parts.push(`META:\n${metaPairs.join("\n")}`);

    // JSON-LD (often has @type:Event with the cleanest data)
    const jsonLdRegex =
      /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const jsonLdBlocks: string[] = [];
    let j: RegExpExecArray | null;
    while ((j = jsonLdRegex.exec(html))) {
      const raw = j[1].trim();
      if (raw && raw.length < 8000) jsonLdBlocks.push(raw);
    }
    if (jsonLdBlocks.length)
      parts.push(`JSON-LD:\n${jsonLdBlocks.join("\n---\n")}`);

    // Body text (strip scripts/styles, then tags)
    const bodyText = this.htmlToText(html);
    if (bodyText) parts.push(`BODY:\n${bodyText}`);

    // <img> candidates as a backup for OCR. Skip obvious icons, sprites, and
    // tiny tracking pixels. Then re-rank so URLs that look like real content
    // (event/flyer/banner/poster keywords or numbered slides) come first.
    const imgRegex = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let im: RegExpExecArray | null;
    const collected: string[] = [];
    const seen = new Set(imageCandidates.map((u) => u.toLowerCase()));
    while ((im = imgRegex.exec(html))) {
      const src = im[1].trim();
      const lower = src.toLowerCase();
      if (
        !src ||
        seen.has(lower) ||
        /^data:/i.test(src) ||
        /(logo|icon|sprite|favicon|avatar|emoji|pixel|tracking|spacer|placeholder)/i.test(
          src,
        ) ||
        // Wild Apricot's site-title renderer + similar dynamic text-as-image
        // generators — these are decorative chrome, not content.
        /\/(arttext|sitetitle|site-title|titlebar)\//i.test(src) ||
        /\.(svg)(\?|$)/i.test(src)
      ) {
        continue;
      }
      collected.push(src);
      seen.add(lower);
      if (collected.length >= 16) break;
    }
    // Re-rank: paths matching event-relevant keywords float to the top.
    const isContenty = (u: string) =>
      /(event|flyer|poster|banner|bazaar|festival|conference|workshop|hero|featured|slide|bc-\d|page-\d|\b\d{4}\b)/i.test(
        u,
      );
    const ranked = [
      ...collected.filter(isContenty),
      ...collected.filter((u) => !isContenty(u)),
    ];
    for (const src of ranked) {
      imageCandidates.push(src);
      if (imageCandidates.length >= 12) break;
    }

    // Heuristic for "JS-only" pages: lots of HTML but very little visible body
    // text and few meta tags suggests a SPA shell.
    const shellOnly =
      html.length > 3000 && bodyText.length < 400 && metaPairs.length < 4;

    let combinedText = parts.join("\n\n");
    if (combinedText.length > MAX_LLM_CONTEXT_CHARS) {
      combinedText = combinedText.slice(0, MAX_LLM_CONTEXT_CHARS);
    }
    return { combinedText, shellOnly, imageCandidates };
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .split("\n")
      .map((l) => this.decodeText(l).trim())
      .filter((l) => l.length > 0)
      .join("\n")
      .trim();
  }

  private decodeText(s: string): string {
    return s
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  }

  // ============ LLM extraction ============
  private async askLlmForFields(
    pageText: string,
    sourceUrl: string,
  ): Promise<ImportedEvent> {
    const sys = `You extract event details from a web page and produce a single JSON object that fills our event-creation form. Return ONLY the JSON — no prose, no code fences.

OUTPUT SCHEMA (every key is OPTIONAL — omit a key entirely if you can't find a confident value, do NOT make up data):
{
  "title": "<event name>",
  "category": "<one of: Conference, Workshop, Concert, Festival, Exhibition, Networking, Sports, Webinar, Meetup, Other — pick best fit>",
  "description": "<2–6 sentence plain-text summary, no markdown>",
  "startDate": "YYYY-MM-DD",
  "time": "HH:mm (24h)",
  "endDate": "YYYY-MM-DD",
  "endTime": "HH:mm (24h)",
  "location": "<short venue name, e.g. 'Hyatt Regency'>",
  "address": "<full street address including city/country if available>",
  "visibility": "public" | "private",
  "tags": ["short", "lowercase", "tags"],
  "ageRestriction": "<short string e.g. '18+' or 'All ages'>",
  "dresscode": "<short string e.g. 'Formal'>",
  "specialInstructions": "<short plain text — only if explicitly stated>",
  "refundPolicy": "<short plain text — only if explicitly stated>",
  "termsAndConditions": "<short plain text — only if explicitly stated>",

  // VENUE — only include if the page MENTIONS dimensions or a clear capacity
  // hint. Convert metres to pixels at 1m = 100px.
  "venue": { "width": 1200, "height": 800, "hasMainStage": true },

  // STALL / BOOTH templates — include when the page describes vendor stalls,
  // booths, exhibition spaces, food stalls. One entry PER PRICING TIER (not
  // one per physical stall). "count" = how many of THIS tier the page says
  // are available. Sizes default to 80x80 px (≈0.8m×0.8m on canvas) if no
  // dimensions given. Prices are numbers in the page's currency.
  "stalls": [
    { "name": "Standard Stall", "count": 60, "width": 80, "height": 80, "tablePrice": 500, "bookingPrice": 500, "depositPrice": 0 }
  ],

  // ROUND TABLES — for sit-down events (galas, weddings, banquets) where
  // round tables are sold per-table or per-chair.
  "roundTables": [
    { "name": "Gala Table", "count": 20, "numberOfChairs": 8, "sellingMode": "table", "tablePrice": 2000, "chairPrice": 0, "tableDiameter": 120 }
  ],

  // SPEAKER ZONES — main stage and any breakout / panel zones a conference
  // mentions. isMainStage:true ONLY for the primary stage.
  "speakerZones": [
    { "name": "Main Stage", "isMainStage": true, "width": 240, "height": 140, "slotPrice": 0, "maxSpeakers": 4, "maxVisitors": 200 }
  ]
}

EXTRACTION RULES (read carefully — hallucination is the #1 problem):
- ONLY return a field if its value is LITERALLY VISIBLE in the page text I'm sending you. If it's not in the text, OMIT THE KEY. Do not guess based on the page's general topic, the URL, the title, or what a "Summer Bazaar" usually looks like.
- "About us" / "Our mission" descriptions about the organisation are NOT event details. Do not pull dates or addresses from them unless they're explicitly tied to THIS event.
- Prefer JSON-LD blocks (especially @type Event) over visible body text — they are authoritative.
- If a JSON-LD has startDate / endDate as ISO strings, split them into date (YYYY-MM-DD) + time (HH:mm).
- If only a date is given (no time), omit "time".
- For "category", pick the best fit from the enum ONLY if the page clearly indicates the event type; otherwise omit.
- For "tags", emit at most 6 short, lowercase, single-word-or-hyphenated tags drawn from words actually on the page.
- "visibility" defaults to "public" only when the page is a public landing — omit if uncertain.
- DO NOT invent dates, times, addresses, venues, dresscodes, age restrictions, or policies that aren't on the page. RETURNING A FABRICATED VALUE IS A FAILURE — better to omit a field than to guess.
- It is COMPLETELY ACCEPTABLE to return only {"title": "..."} if that's all the page reliably contains.
- The page text is provided after the marker "=== PAGE ===". The source URL is provided for context only — do NOT use the URL slug to invent values.`;

    const userPayload = `Source URL: ${sourceUrl}

=== PAGE ===
${pageText}
=== END PAGE ===`;

    let raw = "";
    try {
      const res = await this.ai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userPayload },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" } as any,
      });
      raw = res.choices?.[0]?.message?.content?.trim() || "";
    } catch (e: any) {
      this.logger.warn(
        `import-from-url LLM call failed (${this.provider}/${this.model}): ${e?.message || e}`,
      );
      throw new BadRequestException(
        `AI extraction failed: ${e?.message || "unknown error"}.`,
      );
    }

    const jsonText = this.extractJsonObject(raw);
    if (!jsonText) {
      this.logger.warn(
        `import-from-url: model returned non-JSON. First 300: ${raw.slice(0, 300)}`,
      );
      throw new BadRequestException(
        "AI returned an unparseable response. Try a different URL.",
      );
    }
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new BadRequestException("AI returned malformed JSON.");
    }
    return this.sanitize(parsed);
  }

  // ============ OCR fallback (vision LLM on a flyer image) ============
  private async ocrEventFlyer(
    candidateUrls: string[],
    sourceUrl: string,
  ): Promise<ImportedEvent | null> {
    // Try up to 6 candidates and accumulate fields across them — this lets us
    // pick title from one slide, dates from another, address from a third for
    // multi-slide flyer pages (e.g. Wild Apricot bazaar pages with BC-1..BC-21).
    let merged: ImportedEvent = {};
    let attempts = 0;
    for (const candidate of candidateUrls.slice(0, 6)) {
      const absolute = this.resolveImageUrl(candidate, sourceUrl);
      if (!absolute) continue;
      let img: { buffer: Buffer; mimeType: string } | null = null;
      try {
        this.validateUrl(absolute);
        img = await this.downloadImage(absolute);
      } catch (e: any) {
        this.logger.warn(
          `OCR: skipping candidate ${absolute}: ${e?.message || e}`,
        );
        continue;
      }
      if (!img) continue;
      attempts++;
      try {
        const fields = await this.askVisionForFields(
          img.buffer,
          img.mimeType,
          sourceUrl,
        );
        if (fields && this.countMeaningfulFields(fields) > 0) {
          merged = this.mergeFields(merged, fields);
          // Stop early once we have a "core" set: title + at least one date or
          // location. No need to keep paying for vision calls.
          if (
            merged.title &&
            (merged.startDate || merged.location || merged.address)
          ) {
            this.logger.log(
              `OCR: collected core fields after ${attempts} image(s); stopping early.`,
            );
            return merged;
          }
        }
      } catch (e: any) {
        this.logger.warn(
          `OCR vision call failed for ${absolute}: ${e?.message || e}`,
        );
      }
    }
    return this.countMeaningfulFields(merged) > 0 ? merged : null;
  }

  private resolveImageUrl(src: string, baseUrl: string): string | null {
    if (!src) return null;
    try {
      // Already absolute http(s).
      if (/^https?:\/\//i.test(src)) return src;
      // Protocol-relative.
      if (src.startsWith("//")) return `https:${src}`;
      // Relative — resolve against the page URL.
      return new URL(src, baseUrl).toString();
    } catch {
      return null;
    }
  }

  private async downloadImage(
    url: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      IMAGE_FETCH_TIMEOUT_MS,
    );
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; EventshImporter/1.0; +https://eventsh.app)",
          Accept: "image/png,image/jpeg,image/webp,image/*;q=0.9,*/*;q=0.5",
        },
      });
      if (!res.ok) return null;
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const mimeType = ct.split(";")[0].trim();
      if (!/^image\/(png|jpe?g|webp)$/.test(mimeType)) return null;

      const reader = res.body?.getReader();
      if (!reader) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_IMAGE_BYTES) return null;
        return { buffer: buf, mimeType };
      }
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value);
        received += value.length;
        if (received > MAX_IMAGE_BYTES) {
          this.logger.warn(`Image ${url} exceeded ${MAX_IMAGE_BYTES} bytes; skipping`);
          return null;
        }
      }
      return { buffer: Buffer.concat(chunks), mimeType };
    } catch (e: any) {
      if (e?.name === "AbortError") return null;
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async askVisionForFields(
    buffer: Buffer,
    mimeType: string,
    sourceUrl: string,
  ): Promise<ImportedEvent> {
    const sys = `You are an OCR assistant. You will see ONE image — a flyer, poster, banner, or screenshot for an event. Read the visible text and return a JSON object describing what's THERE. Do not invent.

CRITICAL ANTI-HALLUCINATION RULES:
- Only emit a field if its value is LITERALLY written or drawn on this specific image. If the slide doesn't show a date, OMIT date keys. If it doesn't show an address, OMIT address. If it doesn't show booth pricing, OMIT the stalls array.
- Do NOT echo placeholder values from the schema. The schema below shows the SHAPE; values must come from the image.
- Do NOT write "Not specified" / "Not provided" / "N/A" / placeholder addresses like "123 Market Street". OMIT THE KEY ENTIRELY.
- Returning {} (empty object) is BETTER than returning made-up data. Many slides only have a fragment of info; that is fine.

OUTPUT — return ONLY one JSON object, no prose, no code fences. SHAPE (every key OPTIONAL):
{
  "title": <string>,
  "category": <one of "Conference" | "Workshop" | "Concert" | "Festival" | "Exhibition" | "Networking" | "Sports" | "Webinar" | "Meetup" | "Other">,
  "description": <2–4 plain sentences derived ONLY from visible text>,
  "startDate": <"YYYY-MM-DD">,
  "time": <"HH:mm" 24h>,
  "endDate": <"YYYY-MM-DD">,
  "endTime": <"HH:mm" 24h>,
  "location": <short venue name VISIBLE on slide>,
  "address": <full address VISIBLE on slide>,
  "tags": <array of short lowercase strings drawn from words actually on the image, max 6>,
  "ageRestriction": <string>,
  "dresscode": <string>,
  "specialInstructions": <bullets of rules / guidelines / deadlines / requirements VISIBLY written on the slide. Verbatim or close paraphrase only.>,
  "refundPolicy": <refund / deposit / cancellation rules visible on slide>,
  "termsAndConditions": <terms text visible on slide>,
  "stalls": <array — ONLY if the slide shows a pricing table OR an explicit list of booth tiers. ONE entry per visible tier. Each: {name, count, width, height, tablePrice, bookingPrice, depositPrice}. If no pricing table is visible, OMIT this whole array.>,
  "roundTables": <array — ONLY if slide shows round-table tiers. Each: {name, count, numberOfChairs, sellingMode, tablePrice, chairPrice, tableDiameter}>,
  "speakerZones": <array — ONLY if slide shows stage/panel info. Each: {name, isMainStage, width, height, slotPrice, maxSpeakers, maxVisitors}>,
  "venue": <{width, height} — ONLY if a hall measurement (e.g. "20m × 15m" or "10,000 sq ft") is shown. Otherwise OMIT.>
}

EXAMPLES OF WHAT NOT TO DO:
- Slide shows ONLY the cover (title, date, venue) → returning {"stalls":[{"name":"Standard Stall","count":60,"width":200,"height":200,"tablePrice":500}]} is WRONG. Those are example numbers, not data on the image. Correct: omit stalls.
- Slide shows ONLY application guidelines text → returning {"startDate":"2026-07-15","address":"123 Market Street, Singapore"} is WRONG. The slide has neither. Correct: omit those keys.
- Slide says "S$ 150 deposit (refundable)" → put it in refundPolicy as a sentence; do NOT invent a stall row to attach it to.

EXTRACTION HINTS:
- Convert dates to YYYY-MM-DD. If only month + day shown, infer next future plausible year.
- Convert times to 24h HH:mm.
- For pricing tables: each ROW becomes one entry. If the table shows multiple price columns (e.g. Member / Non-Member), pick the NON-MEMBER (default) price for tablePrice.
- For booth dimensions in feet: width(px) = feet × 30. In metres: × 100. Square spaces have width = height.
- For stall counts: ONLY emit "count" if the slide explicitly states a number of that tier. Otherwise omit count.

If the image is not an event-related slide (logo, mascot, person photo, decorative background), return {}.`;

    const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
    let raw = "";
    try {
      const res = await this.ai.chat.completions.create({
        model: this.visionModel,
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Source URL: ${sourceUrl}\nExtract event details from this image.`,
              },
              { type: "image_url", image_url: { url: dataUri } } as any,
            ] as any,
          },
        ],
        temperature: 0.1,
        max_tokens: 1200,
      } as any);
      raw = (res.choices?.[0]?.message?.content || "").trim();
    } catch (e: any) {
      this.logger.warn(
        `Vision OCR call failed (${this.provider}/${this.visionModel}): ${e?.message || e}`,
      );
      return {};
    }
    const jsonText = this.extractJsonObject(raw);
    if (!jsonText) {
      this.logger.warn(
        `Vision OCR returned non-JSON. First 300: ${raw.slice(0, 300)}`,
      );
      return {};
    }
    try {
      const parsed = JSON.parse(jsonText);
      this.logger.log(
        `Vision OCR ${this.provider}/${this.visionModel} → fields=${this.countMeaningfulFields(parsed)}`,
      );
      return this.sanitize(parsed);
    } catch {
      return {};
    }
  }

  private extractJsonObject(raw: string): string | null {
    let s = raw.trim();
    const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
    if (fence) s = fence[1].trim();
    if (s.startsWith("{") && s.endsWith("}")) return s;
    let depth = 0;
    let start = -1;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && start >= 0) return s.slice(start, i + 1);
      }
    }
    return null;
  }

  private sanitize(p: any): ImportedEvent {
    const out: ImportedEvent = {};
    const str = (v: any, max = 5000): string | undefined => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t ? t.slice(0, max) : undefined;
    };
    const date = (v: any): string | undefined => {
      const s = str(v, 50);
      if (!s) return undefined;
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
    };
    const time = (v: any): string | undefined => {
      const s = str(v, 20);
      if (!s) return undefined;
      const m = s.match(/^(\d{1,2}):(\d{2})/);
      if (!m) return undefined;
      const hh = String(Math.min(23, parseInt(m[1], 10))).padStart(2, "0");
      const mm = String(Math.min(59, parseInt(m[2], 10))).padStart(2, "0");
      return `${hh}:${mm}`;
    };

    const dropFiller = (v: any, max = 4000): string | undefined => {
      const s = str(v, max);
      if (!s) return undefined;
      if (
        /^\s*(not (specified|provided|available|listed|mentioned)|n\/?a|none|unknown|tbd|tba)\s*(in (the )?image)?\s*\.?\s*$/i.test(
          s,
        )
      ) {
        return undefined;
      }
      return s;
    };

    out.title = str(p.title, 200);
    out.category = str(p.category, 50);
    out.description = dropFiller(p.description, 4000);
    out.startDate = date(p.startDate);
    out.time = time(p.time);
    out.endDate = date(p.endDate);
    out.endTime = time(p.endTime);
    out.location = str(p.location, 200);
    out.address = str(p.address, 500);
    if (p.visibility === "public" || p.visibility === "private")
      out.visibility = p.visibility;
    if (Array.isArray(p.tags)) {
      out.tags = p.tags
        .map((t: any) => str(t, 40))
        .filter((t: any): t is string => !!t)
        .slice(0, 6);
      if (out.tags.length === 0) delete out.tags;
    }
    out.ageRestriction = str(p.ageRestriction, 50);
    out.dresscode = str(p.dresscode, 100);
    out.specialInstructions = dropFiller(p.specialInstructions, 4000);
    out.refundPolicy = dropFiller(p.refundPolicy, 4000);
    out.termsAndConditions = dropFiller(p.termsAndConditions, 4000);

    const num = (v: any, lo: number, hi: number): number | undefined => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return undefined;
      return Math.round(Math.max(lo, Math.min(hi, n)));
    };

    // Venue dims (px on the canvas). Reasonable bounds: 200–4000 px each side.
    if (p.venue && typeof p.venue === "object") {
      const w = num(p.venue.width, 200, 4000);
      const h = num(p.venue.height, 200, 4000);
      const venue: NonNullable<ImportedEvent["venue"]> = {};
      if (w) venue.width = w;
      if (h) venue.height = h;
      if (typeof p.venue.hasMainStage === "boolean")
        venue.hasMainStage = p.venue.hasMainStage;
      if (Object.keys(venue).length) out.venue = venue;
    }

    if (Array.isArray(p.stalls)) {
      const stalls = p.stalls
        .filter((s: any) => s && typeof s === "object")
        .map((s: any) => {
          const e: NonNullable<ImportedEvent["stalls"]>[number] = {
            name: str(s.name, 60) || "Standard Stall",
          };
          const c = num(s.count, 1, 500);
          if (c) e.count = c;
          const w = num(s.width, 20, 1000);
          const h = num(s.height, 20, 1000);
          if (w) e.width = w;
          if (h) e.height = h;
          const tp = num(s.tablePrice, 0, 1_000_000);
          const bp = num(s.bookingPrice, 0, 1_000_000);
          const dp = num(s.depositPrice, 0, 1_000_000);
          if (tp !== undefined) e.tablePrice = tp;
          if (bp !== undefined) e.bookingPrice = bp;
          if (dp !== undefined) e.depositPrice = dp;
          return e;
        })
        .slice(0, 8);
      if (stalls.length) out.stalls = stalls;
    }

    if (Array.isArray(p.roundTables)) {
      const rounds = p.roundTables
        .filter((r: any) => r && typeof r === "object")
        .map((r: any) => {
          const e: NonNullable<ImportedEvent["roundTables"]>[number] = {
            name: str(r.name, 60) || "Round Table",
          };
          const c = num(r.count, 1, 200);
          if (c) e.count = c;
          const ch = num(r.numberOfChairs, 1, 30);
          if (ch) e.numberOfChairs = ch;
          if (r.sellingMode === "table" || r.sellingMode === "chair")
            e.sellingMode = r.sellingMode;
          const tp = num(r.tablePrice, 0, 1_000_000);
          const cp = num(r.chairPrice, 0, 1_000_000);
          const td = num(r.tableDiameter, 50, 400);
          if (tp !== undefined) e.tablePrice = tp;
          if (cp !== undefined) e.chairPrice = cp;
          if (td) e.tableDiameter = td;
          return e;
        })
        .slice(0, 6);
      if (rounds.length) out.roundTables = rounds;
    }

    if (Array.isArray(p.speakerZones)) {
      const zones = p.speakerZones
        .filter((z: any) => z && typeof z === "object")
        .map((z: any) => {
          const e: NonNullable<ImportedEvent["speakerZones"]>[number] = {
            name: str(z.name, 60) || "Main Stage",
          };
          if (typeof z.isMainStage === "boolean") e.isMainStage = z.isMainStage;
          const w = num(z.width, 50, 800);
          const h = num(z.height, 50, 600);
          if (w) e.width = w;
          if (h) e.height = h;
          const sp = num(z.slotPrice, 0, 1_000_000);
          const ms = num(z.maxSpeakers, 1, 50);
          const mv = num(z.maxVisitors, 1, 5000);
          if (sp !== undefined) e.slotPrice = sp;
          if (ms) e.maxSpeakers = ms;
          if (mv) e.maxVisitors = mv;
          return e;
        })
        .slice(0, 6);
      if (zones.length) out.speakerZones = zones;
    }

    // Drop empty keys for a clean payload.
    Object.keys(out).forEach((k) => {
      if ((out as any)[k] === undefined) delete (out as any)[k];
    });
    return out;
  }
}
