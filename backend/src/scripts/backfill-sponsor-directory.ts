import * as dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

/**
 * One-off backfill for the sponsor directory.
 *
 * Sponsor applications now find-or-create a `sponsors` directory entry and
 * store its id on the request, so every applicant shows up in the organizer's
 * Sponsors CRM. Applications submitted before that link existed have neither,
 * so this script creates the missing entries and stamps `sponsorId`.
 *
 * Matching mirrors the service: email first (case-insensitive), then an exact
 * company-name match within the same organizer. Idempotent — re-running it
 * changes nothing.
 *
 * Run with:  npx ts-node src/scripts/backfill-sponsor-directory.ts
 */

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsh_dev";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Directory phones carry their dial code inline (matches the supplier CRM). */
function joinPhone(countryCode?: string, phone?: string): string {
  const n = String(phone || "").trim();
  const cc = String(countryCode || "").trim();
  if (!n) return "";
  if (n.startsWith("+") || !cc) return n;
  return `${cc}${n}`;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const requests = mongoose.connection.db.collection("sponsorrequests");
  const sponsors = mongoose.connection.db.collection("sponsors");

  const rows = await requests.find({}).toArray();
  let created = 0;
  let linked = 0;
  let alreadyOk = 0;

  for (const r of rows) {
    if (r.sponsorId) {
      alreadyOk++;
      continue;
    }

    const email = String(r.email || "").trim().toLowerCase();
    const company = String(r.companyName || "").trim();
    const or: any[] = [];
    if (email) or.push({ email });
    if (company) or.push({ companyName: new RegExp(`^${esc(company)}$`, "i") });

    let sponsor = or.length
      ? await sponsors.findOne({ organizerId: r.organizerId, $or: or })
      : null;

    if (!sponsor) {
      const now = new Date();
      const doc = {
        organizerId: r.organizerId,
        companyName: company,
        contactName: r.contactName || "",
        email,
        phone: joinPhone(r.countryCode, r.phone),
        countryCode: r.countryCode || "",
        website: r.website || "",
        logo: r.logo || "",
        notes: "",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      const res = await sponsors.insertOne(doc as any);
      sponsor = { ...doc, _id: res.insertedId } as any;
      created++;
      console.log(`created directory entry for "${company}" (${email || "no email"})`);
    }

    await requests.updateOne(
      { _id: r._id },
      { $set: { sponsorId: sponsor!._id } },
    );
    linked++;
  }

  console.log(
    `\nDone. ${rows.length} application(s) scanned — ${created} directory ` +
      `entr${created === 1 ? "y" : "ies"} created, ${linked} linked, ` +
      `${alreadyOk} already linked.`,
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
