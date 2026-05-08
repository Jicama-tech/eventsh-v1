/**
 * One-shot diagnostic: runs the same OCR pipeline our /events/import-from-url
 * route uses, against a few specific slides of the IWA bazaar page, and prints
 * the JSON each one returns. Use to diagnose what the vision LLM is actually
 * extracting before going through the auth-guarded API.
 *
 * Run from backend dir:  npx ts-node --transpile-only scripts/test-iwa-import.ts
 */
import "dotenv/config";
import OpenAI from "openai";

const OCR_SYS = `You are an OCR-and-extraction assistant. The user is going to send you ONE image — typically a flyer, poster, banner, or screenshot for an event — and you must extract event details from any text visible in the image.

Return ONLY a single JSON object — no prose, no code fences. Schema (every key OPTIONAL — omit if you can't find it):
{
  "title": "<event name>",
  "category": "<one of: Conference, Workshop, Concert, Festival, Exhibition, Networking, Sports, Webinar, Meetup, Other — pick best fit>",
  "description": "<2–4 sentence summary, plain text>",
  "startDate": "YYYY-MM-DD",
  "time": "HH:mm (24h)",
  "endDate": "YYYY-MM-DD",
  "endTime": "HH:mm (24h)",
  "location": "<short venue name>",
  "address": "<full street address if visible>",
  "tags": ["short", "lowercase", "tags"],
  "ageRestriction": "<short string e.g. '18+' or 'All ages'>",
  "dresscode": "<short string e.g. 'Formal'>",
  "specialInstructions": "<vendor rules, deadlines, registration timeline, late-application policy, application guidelines, requirements>",
  "refundPolicy": "<refund / deposit / cancellation rules. Mention deposit amount + refundability.>",
  "termsAndConditions": "<terms / agreement language if explicitly written on the flyer>",
  "stalls": [
    { "name": "Standard Stall", "count": 60, "width": 200, "height": 200, "tablePrice": 500 }
  ],
  "roundTables": [
    { "name": "Gala Table", "count": 20, "numberOfChairs": 8, "sellingMode": "table", "tablePrice": 2000 }
  ],
  "speakerZones": [
    { "name": "Main Stage", "isMainStage": true, "width": 240, "height": 140 }
  ],
  "venue": { "width": 1200, "height": 800 }
}

EXTRACTION RULES:
- Read EVERY visible text element in the image: title, dates, times, venue, address, tagline, sponsor names if relevant.
- Convert dates to YYYY-MM-DD. If a year is missing, use the next future year that makes the month/day plausible.
- Convert times to 24h HH:mm.
- DO NOT invent details that aren't visible. Omit anything you're not confident about.
- If the image is not an event flyer (e.g. a logo, a person photo, a stock background), return {} (empty object).`;

async function fetchImageBase64(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = (res.headers.get("content-type") || "image/png").split(";")[0].trim();
  return { dataUri: `data:${ct};base64,${buf.toString("base64")}`, bytes: buf.length, mime: ct };
}

async function ocrSlide(client: OpenAI, model: string, slideName: string, url: string) {
  console.log(`\n=========== ${slideName} (${url}) ===========`);
  const img = await fetchImageBase64(url);
  console.log(`  downloaded: ${img.bytes} bytes (${img.mime})`);
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: OCR_SYS },
      {
        role: "user",
        content: [
          { type: "text", text: `Source URL: ${url}\nExtract event details from this image.` },
          { type: "image_url", image_url: { url: img.dataUri } } as any,
        ] as any,
      },
    ],
    temperature: 0.1,
    max_tokens: 1500,
  } as any);
  const raw = (res.choices?.[0]?.message?.content || "").trim();
  console.log(`  raw response (first 200 chars): ${raw.slice(0, 200).replace(/\n/g, " ⏎ ")}`);
  let parsed: any = null;
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : raw;
    parsed = JSON.parse(candidate);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch {}
    }
  }
  if (parsed) {
    console.log(`  PARSED (keys: ${Object.keys(parsed).join(",")}):`);
    console.log(JSON.stringify(parsed, null, 2));
  } else {
    console.log(`  ❌ COULD NOT PARSE JSON`);
  }
  return parsed;
}

async function main() {
  // Override via PROVIDER=groq|qwen env var; defaults to groq for testing.
  const provider = (process.env.PROVIDER || "groq").toLowerCase();
  const apiKey = provider === "qwen" ? process.env.QWEN_API_KEY : process.env.GROQ_API_KEY;
  const baseURL =
    provider === "qwen"
      ? process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
      : process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
  const model =
    provider === "qwen"
      ? process.env.QWEN_VISION_MODEL || "qwen-vl-plus"
      : process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

  console.log(`Provider: ${provider}  Model: ${model}\n`);
  const client = new OpenAI({ apiKey, baseURL });

  const base = "https://www.iwasingapore.org/resources/Pictures/Bazaar%202026/Summer%20Bazaar/";
  const slides = ["BC-1.png", "BC-2.png", "BC-3.png", "BC-5.png"];
  const results: any[] = [];
  for (const s of slides) {
    try {
      const r = await ocrSlide(client, model, s, base + s);
      results.push({ slide: s, fields: r || {} });
    } catch (e: any) {
      console.log(`  ❌ ERROR on ${s}: ${e?.message || e}`);
      results.push({ slide: s, error: e?.message });
    }
  }

  console.log("\n=========== MERGE SUMMARY (which slide gave which field) ===========");
  const allKeys = new Set<string>();
  for (const r of results) Object.keys(r.fields || {}).forEach((k) => allKeys.add(k));
  for (const k of Array.from(allKeys).sort()) {
    const sources = results
      .filter((r) => r.fields && r.fields[k] !== undefined)
      .map((r) => r.slide)
      .join(", ");
    console.log(`  ${k.padEnd(22)} ← ${sources}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
