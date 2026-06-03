/**
 * Inspect a single field of an event document — type, structure, per-element
 * sizes, base64 content, and short previews. Used to understand why a field
 * is unexpectedly huge.
 *
 *   node scripts/inspect-event-field.js <eventId> <fieldName>
 *   e.g. node scripts/inspect-event-field.js 6a0d... sectionVisibility
 */
const path = require("path");
try {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
} catch {}
const { MongoClient, ObjectId } = require("mongodb");
const BSON = require("bson");

const ID = process.argv[2];
const FIELD = process.argv[3];
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsh-dev";

const fmt = (b) =>
  b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(2) + " MB" : (b / 1024).toFixed(1) + " KB";

// Count base64 bytes anywhere in a value (incl. inside HTML like
// <img src="data:image/png;base64,....">).
function base64Bytes(v) {
  let n = 0;
  const re = /data:[^;]+;base64,[A-Za-z0-9+/=]+/g;
  const walk = (x) => {
    if (typeof x === "string") {
      const m = x.match(re);
      if (m) for (const s of m) n += s.length;
    } else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") Object.values(x).forEach(walk);
  };
  walk(v);
  return n;
}

function preview(v) {
  let s;
  try {
    s = typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    s = String(v);
  }
  // redact base64 blobs so the preview is readable
  s = s.replace(/data:[^;]+;base64,[A-Za-z0-9+/=]{40,}/g, "data:<…base64 redacted…>");
  return s.length > 400 ? s.slice(0, 400) + " …" : s;
}

(async () => {
  if (!ID || !FIELD) {
    console.error("Usage: node scripts/inspect-event-field.js <eventId> <fieldName>");
    process.exit(1);
  }
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const ev = await client
    .db()
    .collection("events")
    .findOne({ _id: ObjectId.isValid(ID) ? new ObjectId(ID) : ID });
  if (!ev) {
    console.error("Event not found:", ID);
    process.exit(1);
  }
  const val = ev[FIELD];
  console.log(`\nField "${FIELD}" of event ${ID}`);
  console.log(`  type        : ${Array.isArray(val) ? "array" : typeof val}`);
  console.log(`  total size  : ${fmt(BSON.calculateObjectSize({ [FIELD]: val }))}`);
  console.log(`  base64 bytes: ${fmt(base64Bytes(val))}`);

  if (Array.isArray(val)) {
    console.log(`  elements    : ${val.length}`);
    val.forEach((el, i) => {
      console.log(`\n  [${i}] size=${fmt(BSON.calculateObjectSize({ x: el }))}  type=${Array.isArray(el) ? "array" : typeof el}  base64=${fmt(base64Bytes(el))}`);
      if (el && typeof el === "object" && !Array.isArray(el)) {
        console.log(`      keys: ${Object.keys(el).slice(0, 30).join(", ")}`);
      }
      console.log(`      preview: ${preview(el)}`);
    });
  } else if (val && typeof val === "object") {
    const keys = Object.keys(val);
    console.log(`  keys (${keys.length}):`);
    keys
      .map((k) => ({ k, size: BSON.calculateObjectSize({ [k]: val[k] }), b64: base64Bytes(val[k]) }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 30)
      .forEach((r) => console.log(`    ${fmt(r.size).padStart(10)}  ${r.k}${r.b64 > 1024 ? `  (~${fmt(r.b64)} base64)` : ""}`));
  } else {
    console.log(`  preview: ${preview(val)}`);
  }

  await client.close();
})().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
