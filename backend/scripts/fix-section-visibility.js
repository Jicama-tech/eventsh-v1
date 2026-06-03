/**
 * One-off cleanup: repair events whose `sectionVisibility` got corrupted into
 * a giant array / non-boolean blob (a self-concatenation bug grew it into MBs
 * and blew MongoDB's 16MB document limit).
 *
 * It rewrites sectionVisibility to a clean { key: boolean } map — keeping any
 * genuine boolean flags, discarding the junk (corrupted docs have none, so
 * they collapse to {}).
 *
 * SAFETY
 *   - Dry-run by DEFAULT (prints what it would change).
 *   - On --apply it first backs up each event's original sectionVisibility to
 *     ./migration-backups/section-visibility-<ts>.jsonl  (undo with --rollback).
 *   - Only ever touches the sectionVisibility field.
 *
 *   node scripts/fix-section-visibility.js                   # preview all
 *   node scripts/fix-section-visibility.js --id=<eventId>    # preview one
 *   node scripts/fix-section-visibility.js --apply           # write + backup
 *   node scripts/fix-section-visibility.js --rollback=<file> # undo
 */
const path = require("path");
const fs = require("fs");
const readline = require("readline");
try {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
} catch {}
const { MongoClient, ObjectId } = require("mongodb");

const APPLY = process.argv.includes("--apply");
const ONLY_ID = (() => {
  const a = process.argv.find((x) => x.startsWith("--id="));
  return a ? a.split("=")[1] : "";
})();
const ROLLBACK = (() => {
  const a = process.argv.find((x) => x.startsWith("--rollback="));
  return a ? a.split("=").slice(1).join("=") : "";
})();
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsh-dev";

function clean(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "boolean") out[k] = val;
  }
  return out;
}
// A doc needs fixing if sectionVisibility is an array, or any value isn't a
// boolean (i.e. it's not already a clean map).
function isCorrupt(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return true;
  if (typeof v !== "object") return true;
  return Object.values(v).some((x) => typeof x !== "boolean");
}

async function rollback(client) {
  const events = client.db().collection("events");
  if (!fs.existsSync(ROLLBACK)) {
    console.error("Backup file not found:", ROLLBACK);
    process.exit(1);
  }
  const rl = readline.createInterface({ input: fs.createReadStream(ROLLBACK), crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    const rec = JSON.parse(t);
    const id = ObjectId.isValid(rec._id) ? new ObjectId(rec._id) : rec._id;
    await events.updateOne({ _id: id }, { $set: { sectionVisibility: rec.before } });
    n++;
  }
  console.log(`Rolled back sectionVisibility on ${n} event(s).`);
}

(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  console.log(`\n=== Fix sectionVisibility — ${APPLY ? "APPLY" : "DRY RUN"} ===`);
  console.log(`Database: ${db.databaseName}\n`);

  if (ROLLBACK) {
    await rollback(client);
    await client.close();
    return;
  }

  const events = db.collection("events");
  const query = ONLY_ID
    ? { _id: ObjectId.isValid(ONLY_ID) ? new ObjectId(ONLY_ID) : ONLY_ID }
    : { sectionVisibility: { $exists: true } };

  let backupStream = null;
  let backupPath = "";
  if (APPLY) {
    const dir = path.resolve(__dirname, "..", "migration-backups");
    fs.mkdirSync(dir, { recursive: true });
    backupPath = path.join(dir, `section-visibility-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    backupStream = fs.createWriteStream(backupPath, { flags: "a" });
    console.log(`Backup: ${backupPath}\n`);
  }

  const cursor = events.find(query, { projection: { title: 1, sectionVisibility: 1 } });
  let scanned = 0, fixed = 0;
  while (await cursor.hasNext()) {
    const ev = await cursor.next();
    scanned++;
    if (!isCorrupt(ev.sectionVisibility)) continue;
    const cleaned = clean(ev.sectionVisibility);
    const wasArray = Array.isArray(ev.sectionVisibility);
    console.log(`  ${ev._id} (${ev.title || "?"}): ${wasArray ? "array" : "object"} -> ${JSON.stringify(cleaned)}`);
    fixed++;
    if (APPLY) {
      backupStream.write(JSON.stringify({ _id: ev._id, before: ev.sectionVisibility }) + "\n");
      await events.updateOne({ _id: ev._id }, { $set: { sectionVisibility: cleaned } });
    }
  }
  if (backupStream) await new Promise((r) => backupStream.end(r));

  console.log(`\nScanned: ${scanned} | ${APPLY ? "Fixed" : "Would fix"}: ${fixed}`);
  if (APPLY && fixed) console.log(`Undo: node scripts/fix-section-visibility.js --rollback="${backupPath}"`);
  if (!APPLY) console.log("\nDRY RUN — re-run with --apply to write.");
  await client.close();
})().catch((e) => { console.error("Failed:", e); process.exit(1); });
