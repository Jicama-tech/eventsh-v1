#!/usr/bin/env node
/**
 * One-off backfill: restore the check-in QR payload for stalls that were
 * confirmed while the ticket-PDF render was failing.
 *
 * Background — until the accompanying fix, `qrCodeData` was only written after
 * a successful headless-Chromium render. When Chromium couldn't launch (e.g.
 * a /tmp that the service user can't write to), payment confirmation still
 * completed and the vendor still got a plain confirmation email, but the stall
 * was left with no payload — so `scanStallQR` rejected every scan, and neither
 * "Download ticket" nor "Resend ticket" repaired it.
 *
 * This script rebuilds the payload deterministically from data already on the
 * stall (ids + paymentConfirmedDate as issuedAt), so the QR it produces is the
 * same one a re-issue would produce, and stores it along with the QR image.
 * It does NOT render PDFs — the ticket PDF regenerates on demand the next time
 * the vendor or organizer downloads it.
 *
 * It also migrates legacy rows where `qrCodePath` holds a base64 data URL
 * instead of the PDF url: that value moves to `qrCodeImage` and the path is
 * cleared, matching the fields' new contract.
 *
 * DRY RUN BY DEFAULT — nothing is written unless you pass --apply.
 *
 *   node scripts/backfill-stall-qr.js                 # report only
 *   node scripts/backfill-stall-qr.js --apply         # write
 *   node scripts/backfill-stall-qr.js --apply --limit=50
 *   node scripts/backfill-stall-qr.js --event=<eventId>
 */

const path = require("path");
const mongoose = require("mongoose");
const QRCode = require("qrcode");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const APPLY = has("--apply");
const LIMIT = Number(valueOf("limit")) || 0;
const EVENT_ID = valueOf("event");

const MISSING = [{ $exists: false }, null, ""];

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

  // 1. Paid stalls with no check-in payload. Cancelled bookings are skipped:
  //    their QR is meant to be dead.
  const query = {
    paymentStatus: "Paid",
    status: { $ne: "Cancelled" },
    $or: MISSING.map((v) => ({ qrCodeData: v })),
  };
  if (EVENT_ID) query.eventId = new mongoose.Types.ObjectId(EVENT_ID);

  const cursor = stalls.find(query).sort({ paymentConfirmedDate: 1 });
  let scanned = 0;
  let fixed = 0;
  let skipped = 0;

  while (await cursor.hasNext()) {
    if (LIMIT && fixed >= LIMIT) break;
    const stall = await cursor.next();
    scanned++;

    if (!stall.shopkeeperId || !stall.eventId) {
      console.warn(`  SKIP ${stall._id} — missing shopkeeperId/eventId`);
      skipped++;
      continue;
    }

    // issuedAt must be stable: the same value a re-issue would stamp, so a QR
    // handed out later still matches. paymentConfirmedDate is the honest one.
    const issuedAt = new Date(
      stall.paymentConfirmedDate || stall.completionDate || stall.updatedAt || Date.now(),
    ).toISOString();

    const payload = {
      warning:
        "❌ Normal scanners not allowed. Please use the Eventsh app to scan this stall QR.",
      type: "eventsh-stall-checkin",
      stallId: String(stall._id),
      shopkeeperId: String(stall.shopkeeperId),
      eventId: String(stall.eventId),
      issuedAt,
    };
    const qrCodeData = JSON.stringify(payload);
    const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
      width: 200,
      margin: 2,
    });

    console.log(
      `  ${APPLY ? "FIX " : "WOULD FIX "}${stall._id}  issuedAt=${issuedAt}`,
    );

    if (APPLY) {
      const set = { qrCodeData, qrCodeImage };
      // A base64 blob parked in qrCodePath is legacy — it is not a PDF url.
      if (
        typeof stall.qrCodePath === "string" &&
        stall.qrCodePath.startsWith("data:")
      ) {
        set.qrCodePath = null;
      }
      await stalls.updateOne({ _id: stall._id }, { $set: set });
    }
    fixed++;
  }

  // 2. Rows that DO have a payload but still carry base64 in qrCodePath.
  const legacyQuery = {
    qrCodePath: { $regex: "^data:" },
    qrCodeData: { $nin: [null, ""] },
  };
  const legacy = await stalls.find(legacyQuery).toArray();
  for (const stall of legacy) {
    console.log(
      `  ${APPLY ? "MIGRATE " : "WOULD MIGRATE "}${stall._id} — base64 out of qrCodePath`,
    );
    if (APPLY) {
      await stalls.updateOne(
        { _id: stall._id },
        {
          $set: {
            qrCodeImage: stall.qrCodeImage || stall.qrCodePath,
            qrCodePath: null,
          },
        },
      );
    }
  }

  console.log(
    `\nScanned ${scanned} paid stall(s) with no payload — ${fixed} ${
      APPLY ? "restored" : "would be restored"
    }, ${skipped} skipped.` +
      `\nLegacy qrCodePath rows: ${legacy.length} ${APPLY ? "migrated" : "would be migrated"}.`,
  );
  if (!APPLY && (fixed || legacy.length)) {
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
