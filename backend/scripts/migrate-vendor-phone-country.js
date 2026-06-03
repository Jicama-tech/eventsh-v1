/**
 * One-off migration: normalize vendor phone / WhatsApp numbers and country.
 *
 * For every document in the `vendors` collection, looks at the phone-ish
 * fields (phone, phoneNumber, whatsAppNumber, whatsappNumber):
 *   • 8 local digits  -> prefix "+65" and set country "SG" (Singapore)
 *   • 10 local digits -> prefix "+91" and set country "IN" (India)
 * Any other length, or a value that already starts with "+", is left as-is.
 *
 * country is written as the ISO code ("SG" / "IN") because the rest of the
 * app (currency, ticket/stall/membership pricing) matches on those codes.
 *
 * DATA SAFETY
 *   - Only ever $set's the 5 fields above — never replaces/removes documents
 *     or any other field.
 *   - Dry-run by DEFAULT: prints a summary + sample of what WOULD change.
 *   - Idempotent: re-running skips numbers that already start with "+".
 *   - Streamed in batches (constant memory), so it scales to large collections.
 *   - AUTOMATIC UNDO: on --apply it first writes the ORIGINAL values of every
 *     record it's about to change to a backup file under ./migration-backups/.
 *     You can restore them exactly with --rollback=<that file>.
 *
 *   Belt & suspenders — a full collection dump before applying is still wise:
 *     mongodump --uri="<MONGO_URI>" --db=<db> --collection=vendors --out=backup/
 *
 * USAGE
 *   node scripts/migrate-vendor-phone-country.js                      # preview (all)
 *   node scripts/migrate-vendor-phone-country.js --limit=200          # preview subset
 *   node scripts/migrate-vendor-phone-country.js --apply              # write + auto-backup
 *   node scripts/migrate-vendor-phone-country.js --rollback=<file>    # undo from a backup
 *
 * Mongo connection comes from MONGO_URI (falls back to the local dev db).
 */
const path = require("path");
const fs = require("fs");
const readline = require("readline");
try {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
} catch {
  /* dotenv optional */
}
const { MongoClient, ObjectId } = require("mongodb");

const APPLY = process.argv.includes("--apply");
const ROLLBACK = (() => {
  const a = process.argv.find((x) => x.startsWith("--rollback="));
  return a ? a.split("=").slice(1).join("=") : "";
})();
const LIMIT = (() => {
  const a = process.argv.find((x) => x.startsWith("--limit="));
  const n = a ? parseInt(a.split("=")[1], 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
})();
const BATCH_SIZE = 1000;
const SAMPLE_LOG = 25;

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsh-dev";

const PHONE_FIELDS = ["whatsAppNumber", "whatsappNumber", "phone", "phoneNumber"];
const TOUCHED_FIELDS = [...PHONE_FIELDS, "country"];

function normalizeNumber(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw || raw.startsWith("+")) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return { value: "+65" + digits, country: "SG" };
  if (digits.length === 10) return { value: "+91" + digits, country: "IN" };
  return null;
}

function maskUri(u) {
  return u.replace(/:\/\/[^@]*@/, "://***@");
}

// ───────────────────────────────── ROLLBACK ─────────────────────────────────
async function runRollback(client) {
  const vendors = client.db().collection("vendors");
  if (!fs.existsSync(ROLLBACK)) {
    console.error(`Backup file not found: ${ROLLBACK}`);
    process.exit(1);
  }
  console.log(`\n=== ROLLBACK from ${ROLLBACK} ===`);
  console.log(`Database: ${client.db().databaseName}\n`);

  const rl = readline.createInterface({
    input: fs.createReadStream(ROLLBACK),
    crlfDelay: Infinity,
  });
  let batch = [];
  let restored = 0;
  let lines = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const r = await vendors.bulkWrite(batch, { ordered: false });
    restored += r.modifiedCount || 0;
    batch = [];
  };

  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    lines++;
    let rec;
    try {
      rec = JSON.parse(t);
    } catch {
      console.warn(`  ! skipping unparseable line ${lines}`);
      continue;
    }
    const idVal =
      typeof rec._id === "string" && ObjectId.isValid(rec._id)
        ? new ObjectId(rec._id)
        : rec._id;
    const update = {};
    if (rec.before && Object.keys(rec.before).length) update.$set = rec.before;
    if (Array.isArray(rec.absent) && rec.absent.length) {
      update.$unset = Object.fromEntries(rec.absent.map((k) => [k, ""]));
    }
    if (!update.$set && !update.$unset) continue;
    batch.push({ updateOne: { filter: { _id: idVal }, update } });
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();
  console.log(`Restored ${restored} document(s) from ${lines} backup line(s).`);
}

// ───────────────────────────────── MIGRATE ──────────────────────────────────
async function runMigrate(client) {
  const db = client.db();
  const vendors = db.collection("vendors");
  const total = await vendors.estimatedDocumentCount();

  console.log(
    `\n=== Vendor phone/country migration — ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"} ===`,
  );
  console.log(`Mongo URI : ${maskUri(MONGO_URI)}`);
  console.log(`Database  : ${db.databaseName}`);
  console.log(`Collection: vendors (~${total} docs)`);
  if (LIMIT) console.log(`Limit     : first ${LIMIT} docs (test subset)`);
  if (APPLY && /eventsh-dev/.test(MONGO_URI)) {
    console.log(
      "NOTE: target looks like the DEV database (eventsh-dev). Set MONGO_URI to your prod URI for live data.",
    );
  }

  // Open the auto-backup file (apply mode only). Original values are written
  // here BEFORE each change, so --rollback can restore them exactly.
  let backupPath = "";
  let backupStream = null;
  if (APPLY) {
    const dir = path.resolve(__dirname, "..", "migration-backups");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = path.join(dir, `vendor-phone-${stamp}.jsonl`);
    backupStream = fs.createWriteStream(backupPath, { flags: "a" });
    console.log(`Backup    : ${backupPath}`);
  }
  console.log("");

  let q = vendors.find(
    {},
    { projection: { name: 1, phone: 1, phoneNumber: 1, whatsAppNumber: 1, whatsappNumber: 1, country: 1 } },
  );
  if (LIMIT) q = q.limit(LIMIT);
  const cursor = q;

  const stats = { scanned: 0, willUpdate: 0, sg: 0, in: 0, conflicts: 0, unchanged: 0, modified: 0 };
  let batch = [];
  let logged = 0;

  const flush = async () => {
    if (!APPLY || batch.length === 0) return;
    const r = await vendors.bulkWrite(batch, { ordered: false });
    stats.modified += r.modifiedCount || 0;
    batch = [];
  };

  while (await cursor.hasNext()) {
    const v = await cursor.next();
    stats.scanned++;

    const set = {};
    const signals = [];
    for (const field of PHONE_FIELDS) {
      const res = normalizeNumber(v[field]);
      if (res) {
        set[field] = res.value;
        signals.push(res.country);
      }
    }
    if (signals.length === 0) {
      stats.unchanged++;
      continue;
    }
    const country = signals[0];
    const uniq = [...new Set(signals)];
    if (uniq.length > 1) {
      stats.conflicts++;
      console.warn(`  ! CONFLICT ${v._id} (${v.name || "?"}): mixed lengths ${uniq.join("/")} — using "${country}"`);
    }
    set.country = country;
    if (country === "SG") stats.sg++;
    else if (country === "IN") stats.in++;
    stats.willUpdate++;

    if (logged < SAMPLE_LOG) {
      logged++;
      console.log(`  ${v._id} (${v.name || "?"}): ${Object.entries(set).map(([k, val]) => `${k}=${val}`).join(", ")}`);
      if (logged === SAMPLE_LOG) console.log("  … (further per-row lines suppressed; see summary)");
    }

    if (APPLY) {
      // Snapshot ORIGINAL values of exactly the fields we're about to change
      // (so rollback restores them; fields that were absent get $unset back).
      const before = {};
      const absent = [];
      for (const k of Object.keys(set)) {
        if (v[k] === undefined) absent.push(k);
        else before[k] = v[k];
      }
      backupStream.write(JSON.stringify({ _id: v._id, before, absent }) + "\n");

      batch.push({ updateOne: { filter: { _id: v._id }, update: { $set: set } } });
      if (batch.length >= BATCH_SIZE) await flush();
    }
  }
  await flush();
  if (backupStream) await new Promise((res) => backupStream.end(res));

  console.log("\n--- Summary ---");
  console.log(`Scanned    : ${stats.scanned}`);
  console.log(`Will update: ${stats.willUpdate}  (SG: ${stats.sg}, IN: ${stats.in})`);
  console.log(`Conflicts  : ${stats.conflicts}`);
  console.log(`Untouched  : ${stats.unchanged}`);
  if (APPLY) {
    console.log(`Modified   : ${stats.modified} document(s) written.`);
    console.log(`\nUndo this run with:\n  node scripts/migrate-vendor-phone-country.js --rollback="${backupPath}"`);
  } else {
    console.log("\nDRY RUN only — no changes written. Review the counts, take a backup, then re-run with --apply.");
  }
}

(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  try {
    if (ROLLBACK) await runRollback(client);
    else await runMigrate(client);
  } finally {
    await client.close();
  }
})().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
