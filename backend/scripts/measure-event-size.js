/**
 * Diagnose why an event document is too big to save (MongoDB's hard limit is
 * 16 MB per document). Prints the total BSON size and the size of each
 * top-level field, biggest first, and flags base64 image blobs.
 *
 *   node scripts/measure-event-size.js <eventId>
 *
 * MONGO_URI comes from backend/.env (or the local dev fallback).
 */
const path = require("path");
try {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
} catch {}
const { MongoClient, ObjectId } = require("mongodb");
const BSON = require("bson");

const ID = process.argv[2];
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsh-dev";

const fmt = (b) =>
  b >= 1024 * 1024
    ? (b / 1024 / 1024).toFixed(2) + " MB"
    : b >= 1024
      ? (b / 1024).toFixed(1) + " KB"
      : b + " B";

// Rough count of base64 / data-URI payload bytes inside a value (recursive).
function base64Bytes(v) {
  let n = 0;
  const walk = (x) => {
    if (typeof x === "string") {
      if (/^data:|^[A-Za-z0-9+/=]{200,}$/.test(x.slice(0, 64) + x) && x.length > 200) {
        // crude: long string that looks like base64 / data URI
      }
      if (x.startsWith("data:") || (x.length > 500 && /^[A-Za-z0-9+/=\s]+$/.test(x))) {
        n += x.length;
      }
    } else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") Object.values(x).forEach(walk);
  };
  walk(v);
  return n;
}

(async () => {
  if (!ID) {
    console.error("Usage: node scripts/measure-event-size.js <eventId>");
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

  const total = BSON.calculateObjectSize(ev);
  console.log(`\nEvent ${ID}  (title: ${ev.title || "?"})`);
  console.log(`Total document size: ${fmt(total)}  (Mongo limit: 16.00 MB)`);
  console.log(total > 16 * 1024 * 1024 ? "❌ OVER THE 16 MB LIMIT\n" : "✅ within limit\n");

  const rows = Object.keys(ev).map((k) => {
    const size = BSON.calculateObjectSize({ [k]: ev[k] });
    const b64 = base64Bytes(ev[k]);
    let extra = "";
    if (Array.isArray(ev[k])) extra = `array[${ev[k].length}]`;
    if (b64 > 1024) extra += `${extra ? ", " : ""}~${fmt(b64)} base64/inline`;
    return { k, size, extra };
  });
  rows.sort((a, b) => b.size - a.size);

  console.log("Top fields by size:");
  for (const r of rows.slice(0, 15)) {
    console.log(`  ${fmt(r.size).padStart(10)}  ${r.k}${r.extra ? "  (" + r.extra + ")" : ""}`);
  }

  console.log(
    "\nTip: fields with large 'base64/inline' are images stored INSIDE the document.",
  );
  console.log(
    "Those should be uploaded as files (stored as /uploads/... URLs), not embedded.",
  );
  await client.close();
})().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
