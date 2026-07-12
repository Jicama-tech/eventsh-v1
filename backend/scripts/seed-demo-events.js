/**
 * Seed two polished demo events for the landing-page screenshots:
 *   - "Dummy Event"   — a professional expo (cloned from a rich existing event)
 *                       under the Dummy Organization, with banner + gallery.
 *   - "Dummy Wedding" — a marriage event (cloned from an existing wedding)
 *                       under the individual account, with hero + gallery +
 *                       an "Our Story" image timeline.
 *
 * Rerunnable: it deletes any prior "Dummy Event" / "Dummy Wedding" first.
 * Images are expected at backend/uploads/events/dummy-event-*.jpg and
 * dummy-wedding-*.jpg (staged separately). Run: node scripts/seed-demo-events.js
 */
const { MongoClient, ObjectId } = require("mongodb");

const URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsh-dev";

// Known ids from the local DB (see inspect output).
const DUMMY_ORG_ID = "6994181635af75137d4bb459"; // "Dummy Organization" (organizer)
const INDIVIDUAL_ORG_ID = "6a43372c7eb467a76be6cb89"; // ks6918754 (individual)
const NEXUS_EVENT_ID = "6a4d25a48a95ea84b6244bff"; // rich commercial expo to clone
const WEDDING_EVENT_ID = "6a43372c7eb467a76be6cb8f"; // existing marriage event to clone

const daysFromNow = (n) => new Date(Date.now() + n * 86400000);

(async () => {
  const c = new MongoClient(URI);
  await c.connect();
  const db = c.db();
  const events = db.collection("events");

  const nexus = await events.findOne({ _id: new ObjectId(NEXUS_EVENT_ID) });
  const wedding = await events.findOne({ _id: new ObjectId(WEDDING_EVENT_ID) });
  if (!nexus) throw new Error("Source expo event not found: " + NEXUS_EVENT_ID);
  if (!wedding) throw new Error("Source wedding not found: " + WEDDING_EVENT_ID);

  // ---- Dummy Event (professional expo) ----
  const { _id: _n, slug: _ns, ...nexusRest } = nexus;
  const dummyEvent = {
    ...nexusRest,
    title: "Dummy Event",
    description:
      "<p>A flagship technology expo bringing together innovators, exhibitors and visitors for three days of demos, talks and networking. Book your pass, reserve an exhibitor stall, or apply to speak.</p>",
    organizer: DUMMY_ORG_ID,
    published: true,
    visibility: "public",
    status: "published",
    startDate: daysFromNow(30),
    endDate: daysFromNow(32),
    image: "/uploads/events/dummy-event-1.jpg",
    bannerImage: "/uploads/events/dummy-event-1.jpg",
    gallery: [
      "/uploads/events/dummy-event-2.jpg",
      "/uploads/events/dummy-event-3.jpg",
      "/uploads/events/dummy-event-4.jpg",
      "/uploads/events/dummy-event-5.jpg",
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // ---- Dummy Wedding (marriage) ----
  const { _id: _w, slug: _ws, ...weddingRest } = wedding;
  const marriage = { ...(wedding.marriage || {}) };
  marriage.partner1Name = "Aarav";
  marriage.partner2Name = "Diya";
  marriage.ourStory =
    "From a chance meeting to forever — we can't wait to celebrate our love story with the people who mean the most to us.";
  marriage.storyTimeline = [
    {
      id: "m1",
      date: "Spring 2019",
      title: "How we met",
      content:
        "<p>A rainy evening, one shared umbrella, and a conversation that never really ended.</p>",
      image: "/uploads/events/dummy-wedding-2.jpg",
    },
    {
      id: "m2",
      date: "Winter 2022",
      title: "The proposal",
      content:
        "<p>Under a sky full of stars, with trembling hands and a very simple question.</p>",
      image: "/uploads/events/dummy-wedding-3.jpg",
    },
    {
      id: "m3",
      date: "2026",
      title: "Our wedding",
      content: "<p>And now — the beginning of forever. We'd love you there.</p>",
      image: "/uploads/events/dummy-wedding-4.jpg",
    },
  ];
  // Showcase the new centred-spine "Our Story" template.
  marriage.theme = {
    ...(marriage.theme || {}),
    preset: (marriage.theme && marriage.theme.preset) || "classicRose",
    storyLayout: "spine",
    galleryLayout:
      (marriage.theme && marriage.theme.galleryLayout) || "masonry",
    sections: {
      countdown: true,
      welcome: true,
      story: true,
      ceremonies: true,
      gallery: true,
      contact: true,
      ...(marriage.theme && marriage.theme.sections),
    },
  };

  const dummyWedding = {
    ...weddingRest,
    title: "Dummy Wedding",
    organizer: INDIVIDUAL_ORG_ID,
    published: true,
    visibility: "public",
    status: "published",
    startDate: daysFromNow(45),
    endDate: daysFromNow(46),
    image: "/uploads/events/dummy-wedding-1.jpg",
    bannerImage: "/uploads/events/dummy-wedding-1.jpg",
    gallery: [
      "/uploads/events/dummy-wedding-2.jpg",
      "/uploads/events/dummy-wedding-3.jpg",
      "/uploads/events/dummy-wedding-4.jpg",
      "/uploads/events/dummy-wedding-5.jpg",
      "/uploads/events/dummy-wedding-6.jpg",
    ],
    marriage,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Rerunnable — clear prior demo events, then insert fresh.
  await events.deleteMany({ title: { $in: ["Dummy Event", "Dummy Wedding"] } });
  const r1 = await events.insertOne(dummyEvent);
  const r2 = await events.insertOne(dummyWedding);

  console.log("Dummy Event   :", String(r1.insertedId));
  console.log("  /events/" + String(r1.insertedId));
  console.log("Dummy Wedding :", String(r2.insertedId));
  console.log("  /events/" + String(r2.insertedId));

  await c.close();
})().catch((e) => {
  console.error("SEED FAILED:", e.message);
  process.exit(1);
});
