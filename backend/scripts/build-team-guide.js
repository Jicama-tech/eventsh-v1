// Builds the EventSH Operators & Volunteers guide.
//
// Covers:
//   - Organizer creating an Operator (Settings → Operator tab)
//   - The Operator's filtered dashboard (only allowed tabs visible)
//   - Organizer adding Volunteers per-event (CreateEventForm Volunteers tab)
//   - Volunteer login (email-OTP gate at /events/:id/scan-tickets)
//   - The Scanner mode-selection + Venue layout views
//
// Run from the repo root:
//   node backend/scripts/build-team-guide.js
//
// Flags:
//   HEADLESS=false    → watch the browser
//   PDF_ONLY=true     → reuse PNGs, only rebuild the PDF
//   CAPTURE_ONLY=true → capture but skip PDF
//   SKIP_SEED=true    → reuse whatever data is already in the DB

const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const puppeteer = require("puppeteer");
const PDFDocument = require("pdfkit");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// -------------------------------------------------------------------------
// Configuration
// -------------------------------------------------------------------------
const REPO_ROOT = path.resolve(__dirname, "../..");
const SCREENSHOT_DIR = path.join(REPO_ROOT, "docs", "team-screenshots");
const OUTPUT_PDF = path.join(REPO_ROOT, "docs", "EventSH-Operators-Volunteers-Guide.pdf");
const FRONTEND_BASE = process.env.FRONTEND_BASE || "http://localhost:8080";
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1 };

const ORG_EMAIL = "hello@eventsh.com";
const EVENT_TITLE = "EventSH Launch Showcase";

const OPERATOR = {
  name: "Alex Operator",
  email: "operator@eventsh.com",
  whatsAppNumber: "+10000000050",
  // Restrict to a subset so the filtered dashboard is visible.
  accessTabs: ["chatbot", "dashboard", "kiosk", "eventAttendees", "users"],
};

const VOLUNTEER = {
  name: "Sam Volunteer",
  email: "volunteer@eventsh.com",
  phoneNumber: "+10000000060",
};

const HEADLESS = process.env.HEADLESS !== "false";
const CAPTURE_ONLY = process.env.CAPTURE_ONLY === "true";
const PDF_ONLY = process.env.PDF_ONLY === "true";
const SKIP_SEED = process.env.SKIP_SEED === "true";

// -------------------------------------------------------------------------
// JWTs
// -------------------------------------------------------------------------
function mintOrganizerToken(org) {
  return jwt.sign(
    {
      name: org.name,
      email: org.email,
      sub: org._id.toString(),
      country: org.country || "SG",
      organizationName: org.organizationName,
      roles: ["organizer"],
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "2h" },
  );
}

// Operator token mirrors auth.controller.ts's operator login branch.
function mintOperatorToken(org, op) {
  return jwt.sign(
    {
      name: op.name,
      email: op.email,
      sub: org._id.toString(),
      operatorId: op._id.toString(),
      accessTabs: op.accessTabs || [],
      country: org.country || "SG",
      organizationName: org.organizationName,
      roles: ["organizer"],
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "2h" },
  );
}

// -------------------------------------------------------------------------
// Seed: operator + volunteer on the EventSH demo org/event
// -------------------------------------------------------------------------
async function seedAll() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const Organizer = mongoose.connection.collection("organizers");
    const Event = mongoose.connection.collection("events");
    const Operator = mongoose.connection.collection("operators");

    const org = await Organizer.findOne({ businessEmail: ORG_EMAIL });
    if (!org) throw new Error(`Demo org ${ORG_EMAIL} not found — run build-guide.js first.`);

    const ev = await Event.findOne({
      organizer: org._id.toString(),
      title: EVENT_TITLE,
    });
    if (!ev) throw new Error(`Demo event "${EVENT_TITLE}" not found — run build-stall-guide.js first.`);

    // Upsert operator. organizerId stored as string to match parent lookup
    // in the auth controller (which uses string equality).
    const now = new Date();
    await Operator.updateOne(
      { email: OPERATOR.email },
      {
        $set: { ...OPERATOR, organizerId: org._id.toString(), updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    const op = await Operator.findOne({ email: OPERATOR.email });
    console.log(`Operator: ${op._id}  (${op.name})  accessTabs=${JSON.stringify(op.accessTabs)}`);

    // Replace volunteers on the event with a single canonical entry.
    await Event.updateOne(
      { _id: ev._id },
      { $set: { volunteers: [VOLUNTEER], updatedAt: now } },
    );
    console.log(`Volunteer attached to event ${ev._id}: ${VOLUNTEER.email}`);

    return { org, event: ev, operator: op };
  } finally {
    await mongoose.disconnect();
  }
}

// -------------------------------------------------------------------------
// Capture phase
// -------------------------------------------------------------------------
async function capture(state) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const orgToken = mintOrganizerToken(state.org);
  const opToken = mintOperatorToken(state.org, state.operator);
  const eventId = state.event._id.toString();

  const browser = await puppeteer.launch({
    headless: HEADLESS ? "new" : false,
    defaultViewport: VIEWPORT,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
  });

  async function clickByLabel(page, label) {
    const handle = await page.evaluateHandle((lbl) => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const scopes = [
        document.querySelector('[role="dialog"][data-state="open"]'),
        ...Array.from(document.querySelectorAll('[role="dialog"]')),
        document.body,
      ].filter(Boolean);
      for (const scope of scopes) {
        const els = Array.from(scope.querySelectorAll('button, [role="tab"]'));
        const exact = els.find((b) => norm(b.textContent) === lbl);
        if (exact) return exact;
        const starts = els.find((b) => norm(b.textContent).startsWith(lbl));
        if (starts) return starts;
      }
      return null;
    }, label);
    const el = handle.asElement();
    if (!el) return false;
    try { await el.scrollIntoView(); } catch (e) {}
    try { await el.click(); return true; } catch (e) { return false; }
  }

  async function newPage({ token = null, guideBypass = null } = {}) {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    if (token) {
      await page.evaluateOnNewDocument((t) => {
        try { sessionStorage.setItem("token", t); } catch (e) {}
      }, token);
    }
    if (guideBypass) {
      await page.evaluateOnNewDocument((b) => {
        window.__guideBypass = b;
      }, guideBypass);
    }
    return page;
  }

  async function waitForSpinner(page) {
    try {
      await page.waitForFunction(
        () => !/loading events|loading\.\.\.|loading…/i.test(
          (document.body && document.body.innerText) || "",
        ),
        { timeout: 15_000 },
      );
    } catch (e) {}
  }

  async function shot(page, id, { fullPage = false } = {}) {
    const file = path.join(SCREENSHOT_DIR, `${id}.png`);
    await page.screenshot({ path: file, fullPage });
    const sz = fs.statSync(file).size;
    console.log(`  ✓ ${id}.png  (${(sz / 1024).toFixed(0)} KB)`);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    // ============== Organizer: operator list + create form ==============
    console.log("\n→ organizer: Settings → Operator (list + form)");
    {
      const page = await newPage({ token: orgToken });
      await page.goto(`${FRONTEND_BASE}/organizer-dashboard`, { waitUntil: "networkidle2", timeout: 60_000 });
      await waitForSpinner(page);
      await sleep(4500);
      await clickByLabel(page, "Settings");
      await sleep(2500);
      await clickByLabel(page, "Operator");
      // Wait for /operators/get-by-organizer to settle.
      await sleep(4500);
      await shot(page, "operator-list", { fullPage: true });
      // Open the create dialog so the actual form fields are visible.
      await clickByLabel(page, "Add Operator");
      await sleep(2500);
      await shot(page, "operator-form", { fullPage: true });
      await page.close();
    }

    // ============== Organizer: Volunteers tab inside CreateEventForm ==============
    console.log("\n→ organizer: Create Event → Volunteers tab");
    {
      const page = await newPage({ token: orgToken });
      await page.goto(`${FRONTEND_BASE}/organizer-dashboard`, { waitUntil: "networkidle2", timeout: 60_000 });
      await waitForSpinner(page);
      await sleep(4500);
      await clickByLabel(page, "Events/Coupons");
      await sleep(2500);
      await clickByLabel(page, "Create Event");
      await sleep(3500);
      await clickByLabel(page, "Volunteers");
      await sleep(2000);
      await shot(page, "volunteers-form", { fullPage: true });
      await page.close();
    }

    // ============== Operator: filtered dashboard ==============
    console.log("\n→ operator: filtered dashboard");
    {
      const page = await newPage({ token: opToken });
      await page.goto(`${FRONTEND_BASE}/organizer-dashboard`, { waitUntil: "networkidle2", timeout: 60_000 });
      await waitForSpinner(page);
      await sleep(4500);
      await shot(page, "operator-dashboard");
      // Also capture the Analytics tab to show what data the operator sees.
      await clickByLabel(page, "Analytics");
      await sleep(3500);
      await shot(page, "operator-analytics");
      await page.close();
    }

    // ============== Volunteer: scanner email-OTP gate (Step 1) ==============
    console.log("\n→ volunteer: email-OTP gate");
    {
      const page = await newPage();
      await page.goto(
        `${FRONTEND_BASE}/events/${eventId}/scan-tickets`,
        { waitUntil: "networkidle2", timeout: 60_000 },
      );
      await waitForSpinner(page);
      await sleep(3500);
      await shot(page, "volunteer-otp-gate", { fullPage: true });
      await page.close();
    }

    // ============== Volunteer: mode selection (post-OTP) ==============
    console.log("\n→ volunteer: scanner mode selection");
    {
      const page = await newPage({ guideBypass: { skipVolunteerOtp: true } });
      await page.goto(
        `${FRONTEND_BASE}/events/${eventId}/scan-tickets`,
        { waitUntil: "networkidle2", timeout: 60_000 },
      );
      await waitForSpinner(page);
      await sleep(3500);
      await shot(page, "volunteer-mode-selection", { fullPage: true });
      // Try clicking the Venue tab too, if present.
      const venueClicked = await clickByLabel(page, "Venue");
      if (venueClicked) {
        await sleep(3000);
        await shot(page, "volunteer-venue-view", { fullPage: true });
      }
      await page.close();
    }

    return true;
  } finally {
    await browser.close();
  }
}

// -------------------------------------------------------------------------
// Guide content
// -------------------------------------------------------------------------
const GUIDE = {
  title: "EventSH Operators & Volunteers Guide",
  subtitle: "Setting up your event-day team — who they are, what they do, how they sign in",
  edition: "Edition 1 · 2026",
  chapters: [
    {
      title: "Your event-day team",
      blurb:
        "EventSH gives you two kinds of helpers beyond the main organizer account: Operators and Volunteers. They share the same dashboard chrome but get different scopes — operators can run most of the business-side workflow, volunteers focus on entry / scanning on the day.",
      sections: [
        {
          heading: "Operator",
          body:
            "A staff member or trusted teammate who needs to see and act on dashboard tabs you choose — Analytics, Kiosk, Participants, Exhibitors, Events, etc. Logs in with their own WhatsApp number; sees only the tabs you've granted.",
        },
        {
          heading: "Volunteer",
          body:
            "A short-term helper attached to a specific event. Signs in with email OTP at the event's scanner URL, can scan QR tickets and view the venue layout — but cannot reach the organizer dashboard.",
        },
        {
          heading: "Who can do what",
          body:
            "Operator = persistent JWT session, granular tab access set by the organizer. Volunteer = ephemeral session per visit, fixed to Scanner + Venue. Neither can take destructive admin actions (return deposit, confirm payment) — those stay with the main organizer account.",
        },
      ],
      shots: [],
    },

    {
      title: "Create an Operator",
      blurb:
        "Operators are managed from Settings → Operator. You'll set their identity (name, WhatsApp, email) and pick the dashboard tabs they should see.",
      sections: [
        {
          heading: "Where to find it",
          body:
            "Organizer dashboard → Settings (left sidebar) → Operator tab.",
        },
        {
          heading: "Fields",
          body:
            "Operator Name, WhatsApp Number (used for OTP login), Operator Email, and a Tab Access grid. Leave the grid empty for full access, or tick specific tabs to scope them down. Save to create the operator — they're notified on WhatsApp.",
        },
        {
          heading: "Editing later",
          body:
            "The Operator tab also lists existing operators with edit / delete actions, so you can revoke or change access as your team rotates.",
        },
      ],
      shots: ["operator-list", "operator-form"],
    },

    {
      title: "How an Operator logs in",
      blurb:
        "Operators use the exact same login flow as the organizer — /organizer/login with WhatsApp OTP. The backend recognises their number as an operator record and issues a JWT with their scoped access tabs.",
      sections: [
        {
          heading: "What they see",
          body:
            "Same dashboard chrome you see, minus the tabs you didn't grant. If you only ticked Analytics + Kiosk + Participants, the sidebar shows just those.",
        },
      ],
      shots: ["operator-dashboard", "operator-analytics"],
    },

    {
      title: "Add Volunteers to an event",
      blurb:
        "Volunteers are per-event (not per-organizer). You add them in the event's create / edit form on the Volunteers tab.",
      sections: [
        {
          heading: "Where to find it",
          body:
            "Events/Coupons → Create Event (or Edit on an existing event) → Volunteers tab.",
        },
        {
          heading: "Fields",
          body:
            "Name, Email (the Google sign-in / email-OTP address), Phone. Add as many rows as you need; the event saves them into its volunteers array.",
        },
        {
          heading: "Why per-event",
          body:
            "Volunteers usually help with one specific event. Scoping them per-event means a volunteer can't accidentally check tickets for the wrong event.",
        },
      ],
      shots: ["volunteers-form"],
    },

    {
      title: "How a Volunteer signs in",
      blurb:
        "Volunteers don't log into the dashboard. Instead they open the event's scanner URL on a phone / tablet and verify their email.",
      sections: [
        {
          heading: "The scanner URL",
          body:
            "https://<your-host>/events/<eventId>/scan-tickets — share this with each volunteer (it's the same URL for every volunteer on that event).",
        },
        {
          heading: "Email OTP",
          body:
            "The page asks for their email, mails a one-time code, and they enter it back. Only emails listed on the event's volunteers array can pass — anyone else is rejected.",
        },
      ],
      shots: ["volunteer-otp-gate"],
    },

    {
      title: "What the Volunteer can do",
      blurb:
        "After verification they land on a mode-selection screen with four scan modes — Event Ticket, Exhibitor Ticket, Speaker Pass, Round Table Ticket — and a Venue tab that mirrors the organizer's stall layout.",
      sections: [
        {
          heading: "Scan modes",
          body:
            "Event Ticket scans visitor QRs for check-in / check-out. Exhibitor Ticket scans stall QRs to verify booth assignments and add-ons. Speaker Pass for the speaker programme. Round Table Ticket for banquet-style seating.",
        },
        {
          heading: "Venue view",
          body:
            "A read-only floor plan that highlights every booked stall, its vendor, contact, paid amount, and the add-ons attached. Tap a stall for full details.",
        },
        {
          heading: "What they can't do",
          body:
            "Volunteers can't confirm payments, return deposits, or change event settings. The dialog they see omits those buttons by design.",
        },
      ],
      shots: ["volunteer-mode-selection", "volunteer-venue-view"],
    },

    {
      title: "On the day",
      blurb:
        "Practical tips: operators run the kiosk and check on stats from the dashboard; volunteers stand at the door scanning. Together they cover the operations layer so the organizer can focus on the event itself.",
      sections: [
        {
          heading: "Suggested split",
          body:
            "1 operator running Kiosk (walk-in tickets), 1 operator monitoring Participants for live attendance, 1–2 volunteers per entrance scanning. Scale up for bigger events.",
        },
        {
          heading: "Need help?",
          body:
            "Ask the in-app chatbot from the dashboard or email help@eventsh.com.",
        },
      ],
      shots: [],
    },
  ],
};

// -------------------------------------------------------------------------
// PDF builder — full-width screenshots + captions, matching the organizer guide.
// -------------------------------------------------------------------------
function buildPDF() {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: { Title: GUIDE.title, Author: "EventSH", Subject: GUIDE.subtitle },
    bufferPages: true,
  });
  const out = fs.createWriteStream(OUTPUT_PDF);
  doc.pipe(out);

  const ACCENT = "#7c3aed";
  const INK = "#1f2937";
  const MUTED = "#6b7280";

  // Cover
  doc.fillColor(ACCENT).rect(0, 0, doc.page.width, 240).fill();
  doc.fillColor("white").font("Helvetica-Bold").fontSize(34)
    .text(GUIDE.title, 56, 110, { width: doc.page.width - 112 });
  doc.fillColor("white").font("Helvetica").fontSize(15)
    .text(GUIDE.subtitle, 56, 185, { width: doc.page.width - 112 });
  doc.fillColor(INK).font("Helvetica").fontSize(11).text(GUIDE.edition, 56, 280);
  doc.fillColor(INK).font("Helvetica").fontSize(12)
    .text(
      "How EventSH organizers stand up an event-day team — creating Operators with scoped dashboard access and adding Volunteers per event — plus what those teammates see and do once they sign in.",
      56, 320, { width: doc.page.width - 112 },
    );

  // TOC
  doc.addPage();
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(22).text("Contents");
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(12).fillColor(INK);
  GUIDE.chapters.forEach((ch, i) => {
    doc.text(`${String(i + 1).padStart(2, "0")}.  ${ch.title}`, { lineGap: 4 });
  });

  // Chapters
  GUIDE.chapters.forEach((chapter, idx) => {
    doc.addPage();
    doc.fillColor(ACCENT).rect(0, doc.y - 8, doc.page.width, 36).fill();
    doc.fillColor("white").font("Helvetica-Bold").fontSize(11)
      .text(`CHAPTER ${idx + 1}`, 56, doc.y + 2);
    doc.moveDown(2);
    doc.x = 56;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(22).text(chapter.title);
    doc.moveDown(0.4);
    doc.fillColor(MUTED).font("Helvetica").fontSize(12)
      .text(chapter.blurb, { lineGap: 2 });
    doc.moveDown(0.8);

    chapter.sections.forEach((sec) => {
      doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(13).text(sec.heading);
      doc.moveDown(0.2);
      doc.fillColor(INK).font("Helvetica").fontSize(11)
        .text(sec.body, { lineGap: 2, align: "left" });
      doc.moveDown(0.6);
    });

    chapter.shots.forEach((shotId) => {
      const file = path.join(SCREENSHOT_DIR, `${shotId}.png`);
      if (!fs.existsSync(file)) {
        console.warn(`  missing screenshot for ${shotId}`);
        return;
      }
      const imgWidth = doc.page.width - 112;
      const img = doc.openImage(file);
      const imgHeight = imgWidth * (img.height / img.width);
      const spaceLeft = doc.page.height - doc.y - 80;
      if (imgHeight > spaceLeft) doc.addPage();
      doc.moveDown(0.4);
      try {
        doc.image(img, { width: imgWidth });
      } catch (e) {
        console.warn(`  embed failed for ${shotId}: ${e.message}`);
        return;
      }
      doc.moveDown(0.4);
      doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9)
        .text(`Figure: ${shotId}`, { align: "center" });
      doc.moveDown(0.6);
    });
  });

  // Page numbers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    if (i === 0) continue;
    doc.fillColor(MUTED).font("Helvetica").fontSize(9)
      .text(`${i + 1} / ${range.count}`, 56, doc.page.height - 30,
        { width: doc.page.width - 112, align: "right" });
  }

  doc.end();
  return new Promise((resolve) => out.on("finish", resolve));
}

// -------------------------------------------------------------------------
// Entrypoint
// -------------------------------------------------------------------------
(async () => {
  try {
    let state = null;
    if (!PDF_ONLY) {
      if (!SKIP_SEED) {
        state = await seedAll();
      } else {
        await mongoose.connect(process.env.MONGO_URI);
        const org = await mongoose.connection.collection("organizers").findOne({ businessEmail: ORG_EMAIL });
        const ev = await mongoose.connection.collection("events").findOne({ organizer: org._id.toString(), title: EVENT_TITLE });
        const op = await mongoose.connection.collection("operators").findOne({ email: OPERATOR.email });
        await mongoose.disconnect();
        state = { org, event: ev, operator: op };
      }
      await capture(state);
    }
    if (!CAPTURE_ONLY) {
      console.log("\nBuilding PDF…");
      await buildPDF();
      const sz = fs.statSync(OUTPUT_PDF).size;
      console.log(`\n✓ ${OUTPUT_PDF}\n  ${(sz / 1024).toFixed(0)} KB · ${GUIDE.chapters.length} chapters`);
    }
  } catch (e) {
    console.error("Build failed:", e);
    process.exit(1);
  }
})();
