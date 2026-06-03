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
 * SAFETY: dry-run by default — it only PRINTS what it would change. Re-run
 * with `--apply` to actually write the updates.
 *
 *   node scripts/migrate-vendor-phone-country.js            # preview
 *   node scripts/migrate-vendor-phone-country.js --apply    # write
 *
 * Mongo connection comes from MONGO_URI (falls back to the local dev db).
 */
const path = require("path");
try {
  // Load backend/.env so MONGO_URI is picked up when run from the server.
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
} catch {
  /* dotenv optional */
}
const { MongoClient } = require("mongodb");

const APPLY = process.argv.includes("--apply");
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsh-dev";

// Phone-ish fields to normalize, in country-signal priority order. When two
// fields disagree on the detected country, the earlier one wins.
const PHONE_FIELDS = [
  "whatsAppNumber",
  "whatsappNumber",
  "phone",
  "phoneNumber",
];

// Returns { value, country } when the number should change, else null.
// Numbers already starting with "+" are assumed to carry a country code
// and are left untouched.
function normalizeNumber(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw || raw.startsWith("+")) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return { value: "+65" + digits, country: "SG" };
  if (digits.length === 10) return { value: "+91" + digits, country: "IN" };
  return null;
}

(async () => {
  console.log(
    `\n=== Vendor phone/country migration — ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"} ===`,
  );
  console.log(`Mongo: ${MONGO_URI}\n`);

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const vendors = client.db().collection("vendors");

  const cursor = vendors.find(
    {},
    {
      projection: {
        name: 1,
        phone: 1,
        phoneNumber: 1,
        whatsAppNumber: 1,
        whatsappNumber: 1,
        country: 1,
      },
    },
  );

  const stats = {
    scanned: 0,
    updated: 0,
    sg: 0,
    in: 0,
    conflicts: 0,
    unchanged: 0,
  };
  const ops = [];

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

    // Resolve country from the detected signals (priority order). Warn when
    // a single vendor's numbers point at different countries.
    const country = signals[0];
    const uniq = [...new Set(signals)];
    if (uniq.length > 1) {
      stats.conflicts++;
      console.warn(
        `  ! CONFLICT ${v._id} (${v.name || "?"}): mixed lengths ${uniq.join(
          "/",
        )} — using "${country}"`,
      );
    }
    set.country = country;

    if (country === "SG") stats.sg++;
    else if (country === "IN") stats.in++;
    stats.updated++;

    const changedFields = Object.keys(set)
      .map((k) => `${k}=${set[k]}`)
      .join(", ");
    console.log(`  ${v._id} (${v.name || "?"}): ${changedFields}`);

    ops.push({ updateOne: { filter: { _id: v._id }, update: { $set: set } } });
  }

  if (APPLY && ops.length) {
    const r = await vendors.bulkWrite(ops, { ordered: false });
    console.log(`\nWrote ${r.modifiedCount} document(s).`);
  }

  console.log("\n--- Summary ---");
  console.log(`Scanned:        ${stats.scanned}`);
  console.log(`Will update:    ${stats.updated}  (SG: ${stats.sg}, IN: ${stats.in})`);
  console.log(`Conflicts:      ${stats.conflicts}`);
  console.log(`Untouched:      ${stats.unchanged}`);
  if (!APPLY) {
    console.log(
      "\nDRY RUN only — no changes written. Re-run with --apply to commit.",
    );
  }

  await client.close();
})().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
