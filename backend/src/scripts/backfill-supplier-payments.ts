import * as dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

/**
 * One-off backfill for supplier part-payments.
 *
 * Before part-payments existed, `recordPayment` stamped a request `Paid` no
 * matter how much was actually transferred, stored a single flat payment blob,
 * and never tracked a balance. This script brings those records onto the new
 * model:
 *
 *   - seeds `payment.installments` from the legacy flat payment fields
 *   - sets `payment.balanceDue` = quotationTotal − amountPaid (floored at 0)
 *   - demotes `Paid` → `Partially Paid` where a balance is genuinely still owed
 *
 * Idempotent: re-running it changes nothing. Requests the supplier has already
 * confirmed (`Completed`) are left alone — that timeline is closed.
 *
 * Run with:  npx ts-node src/scripts/backfill-supplier-payments.ts
 */

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsh_dev";

async function run() {
  await mongoose.connect(MONGO_URI);
  const col = mongoose.connection.db.collection("supplierrequests");

  const docs = await col.find({}).toArray();
  let seeded = 0;
  let balanced = 0;
  let demoted = 0;

  for (const doc of docs) {
    const payment = doc.payment || {};
    const total = Number(doc.quotationTotal) || 0;
    const amountPaid = Number(payment.amountPaid) || 0;
    const set: Record<string, any> = {};

    // Nothing was ever paid → just make sure the balance reads correctly.
    if (amountPaid <= 0) {
      if (payment.balanceDue == null && total > 0) {
        set["payment.balanceDue"] = total;
        balanced++;
      }
    } else {
      // Seed a single instalment from the legacy flat fields.
      if (!Array.isArray(payment.installments) || payment.installments.length === 0) {
        set["payment.installments"] = [
          {
            amount: amountPaid,
            paidDate: payment.paidDate || doc.updatedAt || new Date(),
            method: payment.method || "",
            reference: payment.reference || "",
            proofScreenshot: payment.proofScreenshot || "",
            notes: payment.notes || "",
            recordedBy: "Organizer",
          },
        ];
        seeded++;
      }

      const balanceDue = Math.max(0, total - amountPaid);
      if (payment.balanceDue !== balanceDue) {
        set["payment.balanceDue"] = balanceDue;
        balanced++;
      }

      // `Paid` with money still outstanding is the old behaviour leaking
      // through — reclassify so the organizer can record the balance.
      if (balanceDue > 0 && doc.status === "Paid") {
        set.status = "Partially Paid";
        demoted++;
      }
    }

    if (Object.keys(set).length > 0) {
      await col.updateOne({ _id: doc._id }, { $set: set });
      console.log(
        `updated ${doc._id}  ${Object.keys(set).join(", ")}` +
          (set.status ? `  (Paid → Partially Paid)` : ""),
      );
    }
  }

  console.log(
    `\nDone. ${docs.length} request(s) scanned — ${seeded} instalment seed(s), ` +
      `${balanced} balance(s) set, ${demoted} demoted from Paid.`,
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
