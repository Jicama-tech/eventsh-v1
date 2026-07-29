#!/usr/bin/env node
/**
 * One-off backfill: fold speakers named in EXISTING events into each
 * organizer's speaker roster (the `speakers` collection behind the CRM).
 *
 * Going forward this happens automatically — creating or updating an event
 * syncs its line-up. But events saved BEFORE that existed never ran the sync,
 * so their speakers are missing from the CRM until someone re-saves each one.
 * This walks every event and does it in bulk.
 *
 * Identity matches the live upsert exactly: email when there is one, otherwise
 * the normalised name, scoped per organizer. So it's idempotent — running it
 * twice adds nothing the second time, and a speaker who ALSO applied through
 * an event page keeps their single merged profile.
 *
 * Applications are not invented: profiles created here get
 * totalApplications = 0 and origin = "event-form".
 *
 * DRY RUN BY DEFAULT — nothing is written unless you pass --apply.
 *
 *   node scripts/backfill-speaker-roster.js                 # report only
 *   node scripts/backfill-speaker-roster.js --apply         # write
 *   node scripts/backfill-speaker-roster.js --organizer=<id>
 */

const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ORG = (() => {
  const hit = args.find((a) => a.startsWith("--organizer="));
  return hit ? hit.slice("--organizer=".length) : null;
})();

const nameKeyOf = (name) =>
  String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set (looked in backend/.env).");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const events = db.collection("events");
  const speakers = db.collection("speakers");

  console.log(
    `Connected to ${mongoose.connection.name} — ${
      APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"
    }`,
  );

  const query = { "speakers.0": { $exists: true } };
  if (ORG) {
    // The events collection stores the owner as a string on some documents
    // and an ObjectId on others — match both.
    query.$or = [
      { organizer: ORG },
      { organizer: new mongoose.Types.ObjectId(ORG) },
      { organizerId: ORG },
      { organizerId: new mongoose.Types.ObjectId(ORG) },
    ];
  }

  const cursor = events.find(query).project({
    title: 1,
    organizer: 1,
    organizerId: 1,
    speakers: 1,
  });

  let scannedEvents = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const seen = new Set();

  while (await cursor.hasNext()) {
    const ev = await cursor.next();
    scannedEvents++;
    const owner = ev.organizer || ev.organizerId;
    if (!owner) {
      skipped++;
      continue;
    }
    let organizerId;
    try {
      organizerId = new mongoose.Types.ObjectId(String(owner));
    } catch {
      skipped++;
      continue;
    }

    for (const s of ev.speakers || []) {
      const name = String(s?.name || "").trim();
      if (!name) {
        skipped++;
        continue;
      }
      const email = String(s?.email || "")
        .trim()
        .toLowerCase();
      const nameKey = nameKeyOf(name);
      const filter = email
        ? { organizerId, email }
        : { organizerId, nameKey };

      // Report each distinct person once even if they're on several events.
      const dedupeKey = `${organizerId}|${email || nameKey}`;

      const existing = await speakers.findOne(filter);
      const set = { email, nameKey, name };
      const keep = (k, v) => {
        if (v !== undefined && v !== null && String(v).trim() !== "")
          set[k] = v;
      };
      keep("title", s.title);
      keep("organization", s.organization);
      keep("bio", s.bio);
      keep("image", s.image);
      if (s.socialLinks && Object.values(s.socialLinks).some(Boolean)) {
        set.socialLinks = s.socialLinks;
      }

      if (existing) {
        if (!seen.has(dedupeKey)) {
          console.log(
            `  ${APPLY ? "UPDATE" : "would update"} ${name}${
              email ? ` <${email}>` : " (no email — matched by name)"
            }  [${ev.title}]`,
          );
          updated++;
          seen.add(dedupeKey);
        }
        if (APPLY) await speakers.updateOne({ _id: existing._id }, { $set: set });
      } else {
        console.log(
          `  ${APPLY ? "CREATE" : "would create"} ${name}${
            email ? ` <${email}>` : " (no email — keyed by name)"
          }  [${ev.title}]`,
        );
        created++;
        seen.add(dedupeKey);
        if (APPLY) {
          await speakers.insertOne({
            organizerId,
            ...set,
            socialLinks: set.socialLinks || {
              linkedin: "",
              twitter: "",
              website: "",
            },
            totalApplications: 0,
            confirmedSessions: 0,
            origin: "event-form",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }
  }

  console.log(
    `\nScanned ${scannedEvents} event(s) with a speaker line-up.` +
      `\n  ${created} profile(s) ${APPLY ? "created" : "would be created"}` +
      `\n  ${updated} existing profile(s) ${APPLY ? "refreshed" : "would be refreshed"}` +
      `\n  ${skipped} entr(y/ies) skipped (no name or no organizer)`,
  );
  if (!APPLY && (created || updated)) {
    console.log("\nRe-run with --apply to write these changes.");
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Backfill failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    // already down
  }
  process.exit(1);
});
