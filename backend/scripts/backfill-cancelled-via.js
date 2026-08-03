#!/usr/bin/env node
/**
 * One-off backfill: tag pre-existing "Cancelled" stalls with `cancelledVia` so
 * the Restore Stall feature can tell them apart.
 *
 * Background — the Restore button only shows for stalls cancelled by the
 * timer-expiry auto-release or a manual delete, since organizer-approved
 * vendor cancellations and plain status-updates carry side effects (zeroed
 * coupon, promised refund) that a blind restore shouldn't undo. That check
 * reads `cancelledVia`, which is only written going forward — any stall that
 * was already Cancelled before this feature shipped has no such field, so it
 * fails safe and hides the button.
 *
 * This script infers `cancelledVia` for those legacy rows from the exact
 * statusHistory note text each cancel path hardcodes:
 *   "Auto-released..."            -> auto-timeout
 *   "Stall deleted by..."         -> manual-delete
 *   "Cancellation approved by..." -> organizer-decision
 *   anything else                 -> status-update
 * `pendingCancellation.status === "approved"` overrides to organizer-decision
 * as an extra safety net, since that field predates this change too.
 *
 * DRY RUN BY DEFAULT — nothing is written unless you pass --apply.
 *
 *   node scripts/backfill-cancelled-via.js                 # report only
 *   node scripts/backfill-cancelled-via.js --apply
 *   node scripts/backfill-cancelled-via.js --apply --limit=50
 */

const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const APPLY = has("--apply");
const LIMIT = Number(valueOf("limit")) || 0;

function inferCancelledVia(stall) {
  if (stall?.pendingCancellation?.status === "approved") {
    return "organizer-decision";
  }
  const history = stall.statusHistory || [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].status === "Cancelled") {
      const note = String(history[i].note || "");
      if (note.startsWith("Auto-released")) return "auto-timeout";
      if (note.startsWith("Stall deleted by")) return "manual-delete";
      if (note.startsWith("Cancellation approved by")) return "organizer-decision";
      return "status-update";
    }
  }
  return null; // no Cancelled entry in statusHistory — can't infer, skip it
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set (looked in backend/.env).");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const stalls = mongoose.connection.db.collection("stalls");
  console.log(
    `Connected to ${mongoose.connection.name} — ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}`,
  );

  const query = {
    status: "Cancelled",
    $or: [{ cancelledVia: { $exists: false } }, { cancelledVia: null }],
  };

  const cursor = stalls.find(query);
  let scanned = 0;
  let tagged = 0;
  let skipped = 0;
  const byReason = {};

  while (await cursor.hasNext()) {
    if (LIMIT && tagged >= LIMIT) break;
    const stall = await cursor.next();
    scanned++;

    const via = inferCancelledVia(stall);
    if (!via) {
      console.warn(`  SKIP ${stall._id} — no "Cancelled" entry in statusHistory to infer from`);
      skipped++;
      continue;
    }

    byReason[via] = (byReason[via] || 0) + 1;
    console.log(`  ${APPLY ? "TAG " : "WOULD TAG "}${stall._id} -> ${via}`);

    if (APPLY) {
      await stalls.updateOne({ _id: stall._id }, { $set: { cancelledVia: via } });
    }
    tagged++;
  }

  console.log(
    `\nScanned ${scanned} untagged Cancelled stall(s) — ${tagged} ${
      APPLY ? "tagged" : "would be tagged"
    }, ${skipped} skipped (couldn't infer).`,
  );
  console.log("By reason:", byReason);
  console.log(
    `\nRestorable (auto-timeout + manual-delete): ${
      (byReason["auto-timeout"] || 0) + (byReason["manual-delete"] || 0)
    }`,
  );
  if (!APPLY && tagged) {
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
