// Builds the EventSH organizer user guide.
//
// What it does:
//   1. Mints a dev JWT for an existing organizer (set ORG_ID below).
//   2. Launches Puppeteer against localhost:8080 (frontend) and localhost:3000
//      (backend). The frontend and backend must already be running.
//   3. Captures one PNG per spec in CAPTURE_SPECS (some unauthenticated, some
//      authenticated via the minted token in sessionStorage).
//   4. Generates docs/EventSH-Guide.pdf with cover, TOC, and chapter pages
//      that embed the screenshots with captions.
//
// Run from the repo root:
//   node backend/scripts/build-guide.js
//
// Tunables — flip these to debug:
//   HEADLESS=false  → see the browser as captures happen
//   CAPTURE_ONLY=true → skip PDF rebuild, just refresh screenshots
//   PDF_ONLY=true → skip capture, rebuild PDF from existing screenshots

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
const SCREENSHOT_DIR = path.join(REPO_ROOT, "docs", "screenshots");
const OUTPUT_PDF = path.join(REPO_ROOT, "docs", "EventSH-Guide.pdf");
const FRONTEND_BASE = process.env.FRONTEND_BASE || "http://localhost:8080";
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1 };

// Demo organizer that gets upserted into the dev DB before captures so the
// guide shows what a brand-new account looks like (empty events list, no
// exhibitors, blank analytics) — but branded as EventSH itself, so the
// dashboard header / chatbot greeting / settings page all read as the
// product's own brand.
const DEMO_ORG = {
  name: "EventSH Team",
  email: "hello@eventsh.com",
  businessEmail: "hello@eventsh.com",
  organizationName: "EventSH",
  whatsAppNumber: "+10000000099",
  phone: "+10000000099",
  country: "SG",
  address: "EventSH HQ",
  bio: "EventSH — the all-in-one platform for ticketing, venue design, and event management.",
  approved: true,
  subscribed: true,
  provider: "self",
  // Plan window — keep the dashboard "live" while we screenshot.
  planStartDate: new Date(),
  planExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
};

// Sample event seeded into the dev DB under the demo organizer so the
// "events list" and "participants" screenshots have something to show.
const DEMO_EVENT = {
  title: "EventSH Launch Showcase",
  description:
    "A walkthrough showcase event for the EventSH guide — demonstrates how a typical event looks in the dashboard, participants view, and kiosk flow.",
  category: "Conference",
  location: "Marina Bay Sands · Singapore",
  address: "10 Bayfront Avenue, Singapore 018956",
  ticketPrice: "0",
  totalTickets: 250,
  originalTotalTickets: 250,
  visibility: "public",
  tags: ["Demo", "Launch"],
  features: {
    food: true,
    parking: true,
    wifi: true,
    photography: false,
    security: false,
    accessibility: true,
  },
};

const HEADLESS = process.env.HEADLESS !== "false";
const CAPTURE_ONLY = process.env.CAPTURE_ONLY === "true";
const PDF_ONLY = process.env.PDF_ONLY === "true";
const SKIP_SEED = process.env.SKIP_SEED === "true";

// -------------------------------------------------------------------------
// Mongo: upsert the demo organizer + sample event so screenshots have content
// -------------------------------------------------------------------------
async function seedDemoOrganizerAndEvent() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI not set in backend/.env");
  await mongoose.connect(uri);
  try {
    const Organizer = mongoose.connection.collection("organizers");
    const Event = mongoose.connection.collection("events");
    const now = new Date();

    await Organizer.updateOne(
      { businessEmail: DEMO_ORG.businessEmail },
      {
        $set: { ...DEMO_ORG, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    const orgDoc = await Organizer.findOne({
      businessEmail: DEMO_ORG.businessEmail,
    });
    console.log(`Demo org id: ${orgDoc._id}  (${orgDoc.organizationName})`);

    // Upsert a sample event keyed on (organizer, title). Existing events
    // store `organizer` as a string, and the events service queries with a
    // string — mongoose isn't casting either way — so we match the prevailing
    // pattern instead of fighting it.
    const orgIdStr = orgDoc._id.toString();
    const startDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    // Clean up any older ObjectId-typed copies from previous runs so the
    // upsert below remains the single source of truth.
    await Event.deleteMany({
      organizer: orgDoc._id,
      title: DEMO_EVENT.title,
    });
    await Event.updateOne(
      { organizer: orgIdStr, title: DEMO_EVENT.title },
      {
        $set: {
          ...DEMO_EVENT,
          organizer: orgIdStr,
          startDate,
          endDate,
          time: "10:00",
          endTime: "18:00",
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    const eventDoc = await Event.findOne({
      organizer: orgIdStr,
      title: DEMO_EVENT.title,
    });
    console.log(`Sample event id: ${eventDoc._id}  (${eventDoc.title})`);

    return { org: orgDoc, event: eventDoc };
  } finally {
    await mongoose.disconnect();
  }
}

// -------------------------------------------------------------------------
// JWT
// -------------------------------------------------------------------------
function mintToken(org) {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET not set in backend/.env");
  }
  return jwt.sign(
    {
      name: org.name,
      email: org.email,
      sub: org._id.toString(),
      country: org.country,
      organizationName: org.organizationName,
      roles: ["organizer"],
    },
    secret,
    { expiresIn: "2h" },
  );
}

// -------------------------------------------------------------------------
// Capture specs. Each one becomes a screenshot file and is also referenced
// from the guide content. Keep IDs stable — they're the filename stems.
// -------------------------------------------------------------------------
// Each script is a sequence of (wait | click | screenshot) steps executed in
// a single browser page. Click steps target buttons by visible text — both
// sidebar/tab buttons and Radix tab triggers render their label as
// textContent, so a text match is enough.
const SCRIPTS = [
  // ---- Public / pre-login ----
  { url: "/", auth: false, steps: [
    { wait: 2500 },
    { shot: "landing", fullPage: true },
  ]},
  { url: "/register", auth: false, steps: [
    { wait: 2500 },
    { shot: "register", fullPage: true },
  ]},
  { url: "/organizer/login", auth: false, steps: [
    { wait: 2000 },
    { shot: "login" },
  ]},

  // ---- Dashboard overview ----
  { url: "/organizer-dashboard", auth: true, steps: [
    { wait: 4500 },
    { shot: "dashboard-overview" },
    { click: "Analytics" },
    { wait: 3500 },
    { shot: "dashboard-analytics" },
  ]},

  // ---- Settings: profile + payments ----
  { url: "/organizer-dashboard", auth: true, steps: [
    { wait: 4500 },
    { click: "Settings" },
    { wait: 2500 },
    { shot: "settings-profile" },
    { click: "Payments" },
    { wait: 2000 },
    { shot: "settings-payments" },
  ]},

  // ---- Create event: walk every form tab ----
  { url: "/organizer-dashboard", auth: true, steps: [
    { wait: 4500 },
    { click: "Events/Coupons" },
    { wait: 2500 },
    { shot: "events-list" },
    { click: "Create Event" },
    { wait: 3500 },
    { shot: "createevent-basic" },
    { click: "Images" },
    { wait: 1500 },
    { shot: "createevent-images" },
    { click: "Visitors" },
    { wait: 1500 },
    { shot: "createevent-visitors" },
    { click: "Volunteers" },
    { wait: 1500 },
    { shot: "createevent-volunteers" },
    { click: "Venue Setup" },
    { wait: 1500 },
    { shot: "createevent-venue" },
    // Enable the three optional module toggles so the gated tabs appear.
    { toggle: "Spaces / AddOns" },
    { wait: 400 },
    { toggle: "Round Tables" },
    { wait: 400 },
    { toggle: "Speaker Spaces" },
    { wait: 1200 },
    { click: "Space / AddOns" },
    { wait: 1500 },
    { shot: "createevent-spaces" },
    { click: "Speakers" },
    { wait: 1500 },
    { shot: "createevent-speakers" },
    { click: "Round Tables" },
    { wait: 1500 },
    { shot: "createevent-roundtables" },
    { click: "Space Layout" },
    { wait: 2500 },
    { shot: "createevent-layout" },
  ]},

  // ---- Participants — showing the seeded event ----
  { url: "/organizer-dashboard", auth: true, steps: [
    { wait: 4500 },
    { click: "Participants" },
    { wait: 4500 },
    { shot: "participants" },
  ]},

  // ---- Kiosk in-person booking ----
  { url: "/organizer-dashboard", auth: true, steps: [
    { wait: 4500 },
    { click: "In-Person Booking" },
    { wait: 3500 },
    { shot: "kiosk" },
  ]},

  // ---- CRM (Exhibitors/Visitors) ----
  { url: "/organizer-dashboard", auth: true, steps: [
    { wait: 4500 },
    { click: "Exhibitors/Visitors" },
    { wait: 3500 },
    { shot: "crm" },
  ]},

  // ---- Chatbot (default landing tab) ----
  { url: "/organizer-dashboard", auth: true, steps: [
    { wait: 4500 },
    { shot: "chatbot" },
  ]},
];

// -------------------------------------------------------------------------
// Capture phase
// -------------------------------------------------------------------------
async function capture(org) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  const token = mintToken(org);
  console.log("Minted token (first 30 chars):", token.slice(0, 30) + "…");

  const browser = await puppeteer.launch({
    headless: HEADLESS ? "new" : false,
    defaultViewport: VIEWPORT,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1440,900",
    ],
  });

  // A click step matches Radix tab triggers + plain buttons. We use
  // page.evaluateHandle so Puppeteer dispatches a *real* pointer click —
  // Radix tab triggers ignore programmatic Element.click() but respond to
  // proper mouse events.
  async function clickByLabel(page, label) {
    const handle = await page.evaluateHandle((lbl) => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const els = Array.from(
        document.querySelectorAll('button, [role="tab"]'),
      );
      return (
        els.find((b) => norm(b.textContent) === lbl) ||
        els.find((b) => norm(b.textContent).startsWith(lbl)) ||
        null
      );
    }, label);
    const el = handle.asElement();
    if (!el) return false;
    try {
      await el.scrollIntoView();
    } catch (e) {}
    try {
      await el.click();
      return true;
    } catch (e) {
      return false;
    }
  }

  // Toggle a Radix Switch by finding the <label> whose visible text starts
  // with `label`, then clicking the [role="switch"] inside it.
  async function toggleSwitch(page, label) {
    const handle = await page.evaluateHandle((lbl) => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const labels = Array.from(document.querySelectorAll("label"));
      for (const lab of labels) {
        const text = norm(lab.textContent);
        if (text.startsWith(lbl)) {
          const sw = lab.querySelector('[role="switch"]');
          if (sw) return sw;
        }
      }
      return null;
    }, label);
    const el = handle.asElement();
    if (!el) return false;
    try {
      await el.scrollIntoView();
    } catch (e) {}
    try {
      await el.click();
      return true;
    } catch (e) {
      return false;
    }
  }

  try {
    for (const script of SCRIPTS) {
      // Fresh page per script so sessionStorage / scroll position / open
      // dialogs from a prior script don't leak in.
      const page = await browser.newPage();
      await page.setViewport(VIEWPORT);
      if (script.auth) {
        await page.evaluateOnNewDocument(
          (t) => {
            try {
              sessionStorage.setItem("token", t);
            } catch (e) {}
          },
          token,
        );
      }

      const target = `${FRONTEND_BASE}${script.url}`;
      console.log(`\n→ ${script.url}`);
      try {
        await page.goto(target, {
          waitUntil: "networkidle2",
          timeout: 60_000,
        });
      } catch (e) {
        console.warn(`  goto failed: ${e.message}`);
      }
      // Block on spinner text so we don't catch a mid-load frame.
      try {
        await page.waitForFunction(
          () => {
            const txt = (document.body && document.body.innerText) || "";
            return !/loading events|loading\.\.\.|loading…/i.test(txt);
          },
          { timeout: 15_000 },
        );
      } catch (e) {}

      for (const step of script.steps) {
        if (step.wait) {
          await new Promise((r) => setTimeout(r, step.wait));
        } else if (step.click) {
          const ok = await clickByLabel(page, step.click);
          if (!ok) console.warn(`  could not click "${step.click}"`);
        } else if (step.toggle) {
          const ok = await toggleSwitch(page, step.toggle);
          if (!ok) console.warn(`  could not toggle "${step.toggle}"`);
        } else if (step.shot) {
          const outPath = path.join(SCREENSHOT_DIR, `${step.shot}.png`);
          await page.screenshot({
            path: outPath,
            fullPage: !!step.fullPage,
          });
          const sz = fs.statSync(outPath).size;
          console.log(
            `  ✓ ${step.shot}.png  (${(sz / 1024).toFixed(0)} KB)`,
          );
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

// -------------------------------------------------------------------------
// Guide content. Each chapter pairs body copy with one or more screenshots.
// -------------------------------------------------------------------------
const GUIDE = {
  title: "EventSH Organizer Guide",
  subtitle: "Onboarding, your first event, and the dashboard tour",
  edition: "Edition 1 · 2026",
  chapters: [
    {
      title: "Welcome",
      blurb:
        "EventSH is your all-in-one toolkit for running events — selling tickets, accepting bookings, tracking participants, and managing exhibitors. This guide walks a brand-new organizer through onboarding, the dashboard, creating their first event, and using kiosk / CRM / chatbot to run it on the day.",
      sections: [
        {
          heading: "Who this is for",
          body:
            "Event organizers who just signed up. You'll see the product exactly as a fresh account does — empty stats, helpful CTAs, no data yet — and pick up everything you need to launch your first event.",
        },
      ],
      shots: ["landing"],
    },

    {
      title: "Create your account",
      blurb:
        "Registration takes about two minutes. There's no password — your WhatsApp number is the credential, used for both sign-in OTPs and event notifications.",
      sections: [
        {
          heading: "Fill in the form",
          body:
            "Go to eventsh.com/register. Pick your country, then verify your business email and WhatsApp number — both fields have a Send OTP button next to them. Add your full name, organization name, primary email, and address.",
        },
        {
          heading: "Submit",
          body:
            "Hit Register. Your starter plan is assigned automatically — no manual approval needed. You'll be redirected to the login page where you can sign in immediately.",
        },
      ],
      shots: ["register"],
    },

    {
      title: "Your dashboard at a glance",
      blurb:
        "After login you land on the organizer dashboard. The left sidebar groups every workflow — Chatbot, Analytics, In-Person Booking, Participants, Exhibitors/Visitors, Events/Coupons, Feedback, and Settings.",
      sections: [
        {
          heading: "What you see first",
          body:
            "A fresh account opens on the Chatbot tab with empty stat cards: S$0 revenue, 0 tickets, 0 events. That changes the moment your first event goes live.",
        },
        {
          heading: "Analytics tab",
          body:
            "The Analytics tab gives you a numeric breakdown — Total Events, Total Tickets Sold, Total Revenue, Total Stalls Booked, plus a per-event progress card. Use it as your daily check-in once your events are live.",
        },
      ],
      shots: ["dashboard-overview", "dashboard-analytics"],
    },

    {
      title: "Settings — set up your payouts",
      blurb:
        "Before you sell anything, hop into Settings and finish two things: confirm your profile, and connect a payment method so money flows to your bank.",
      sections: [
        {
          heading: "Profile",
          body:
            "Confirm your organization name, business email, WhatsApp number, and country. These appear on receipts, the public storefront, and OTP messages.",
        },
        {
          heading: "Payments",
          body:
            "Pick the Payments sub-tab to link your payout account — Razorpay for India, PayNow / bank transfer for Singapore, or any other supported method for your region. Without this, ticket payments can't be released to you.",
        },
      ],
      shots: ["settings-profile", "settings-payments"],
    },

    {
      title: "Create your first event",
      blurb:
        "Events are created from Events/Coupons → Create Event. The form is a single dialog with focused tabs — fill in the ones that matter for your event, skip the rest.",
      sections: [
        {
          heading: "Basic Info",
          body:
            "Title, description, dates, location, capacity. This is the public-facing information your audience will see.",
        },
        {
          heading: "Images",
          body:
            "Upload a banner and gallery shots. Strong imagery is the single biggest driver of conversions on your event page.",
        },
        {
          heading: "Visitors",
          body:
            "Define one or more visitor tiers (General, VIP, Early Bird, etc.) with price, sale window, and what each tier can access on the day.",
        },
        {
          heading: "Volunteers",
          body:
            "Add volunteer roles if you'll have a team on the ground. Volunteers get scoped dashboard access to the operations they own.",
        },
        {
          heading: "Venue Setup",
          body:
            "Capacity, parking, food, Wi-Fi, accessibility — checkboxes drive what shows up on your event page as amenities. Flip on Spaces / Round Tables / Speakers here to unlock the remaining tabs.",
        },
        {
          heading: "Space / AddOns",
          body:
            "Define stalls and add-ons (extra chairs, power outlets, signage). Used when you sell exhibitor space alongside tickets.",
        },
        {
          heading: "Speakers",
          body:
            "If your event has a speaker programme, list the sessions, slots, and any speaker requirements here.",
        },
        {
          heading: "Round Tables",
          body:
            "Configure banquet / gala round-table seating. Visitors can book a seat at a specific table from your event page.",
        },
        {
          heading: "Space Layout",
          body:
            "Drag and drop tables, doors, walls, and zones on a scaled venue plan — or let the AI Venue Designer suggest a layout from a venue photo or floor-plan URL.",
        },
      ],
      shots: [
        "createevent-basic",
        "createevent-images",
        "createevent-visitors",
        "createevent-volunteers",
        "createevent-venue",
        "createevent-spaces",
        "createevent-speakers",
        "createevent-roundtables",
        "createevent-layout",
      ],
    },

    {
      title: "Track participants",
      blurb:
        "Once your event is live, the Participants tab is your single pane of glass for everyone who's booked — visitors, exhibitors, speakers.",
      sections: [
        {
          heading: "Events list",
          body:
            "Events/Coupons is your portfolio. Each row shows status, dates, and quick actions: Edit, Share, Scanner, Feedback, Delete.",
        },
        {
          heading: "Participants by event",
          body:
            "Pick an event and you'll see every ticket sale, stall booking, speaker confirmation, and round-table reservation with their current state. Export the list or send bulk reminders directly from this view.",
        },
      ],
      shots: ["events-list", "participants"],
    },

    {
      title: "Walk-in booking (Kiosk mode)",
      blurb:
        "On event day, run a tablet at the entrance in Kiosk mode for cash-or-card sales without the admin chrome.",
      sections: [
        {
          heading: "Pick an event, take payment",
          body:
            "Kiosk mode opens with a touch-friendly event picker. Tap an event, pick a ticket type, take payment — UPI / PayNow QR, card, or cash — and the buyer gets the same QR ticket they'd have received online.",
        },
      ],
      shots: ["kiosk"],
    },

    {
      title: "Your CRM",
      blurb:
        "Exhibitors/Visitors is your contact book across every event you've run.",
      sections: [
        {
          heading: "Add and bulk-import",
          body:
            "Add exhibitors one at a time, or upload a spreadsheet to import dozens at once. Download the template from the import dialog so column names line up.",
        },
        {
          heading: "Coupons",
          body:
            "Generate single- or multi-use codes for early-bird discounts, partner perks, and comps. Coupons attach to specific events and visitor types so you stay in control of how they apply.",
        },
      ],
      shots: ["crm"],
    },

    {
      title: "The built-in chatbot",
      blurb:
        "The default landing tab is the EventSH AI chatbot — ask it anything about your events in natural language.",
      sections: [
        {
          heading: "Ask about your data",
          body:
            "\"How many tickets did the Launch Showcase sell yesterday?\", \"What's my best visitor tier?\", \"Show me last week's revenue\" — the chatbot answers from your live data. It's pre-tuned with quick-prompt pills for the questions organizers ask most.",
        },
      ],
      shots: ["chatbot"],
    },

    {
      title: "You're all set",
      blurb:
        "That's the loop: register → set up payouts → create an event → track participants → run the day. Drop a question into the chatbot any time you're stuck.",
      sections: [
        {
          heading: "Need help?",
          body:
            "Use the in-app chatbot for instant answers, or reach the team at help@eventsh.com.",
        },
      ],
      shots: [],
    },
  ],
};

const _UNUSED_GUIDE_PLACEHOLDER = {
  chapters: [
    {
      title: "Welcome to EventSH",
      blurb:
        "EventSH is your all-in-one toolkit for running events end-to-end — selling tickets, designing the venue floor, managing exhibitors and operators, and tracking visitors on the day. This guide walks you through the whole flow so you can launch your first event in under an hour.",
      sections: [
        {
          heading: "What you'll learn",
          body:
            "How to register as an organizer, set up your first event from scratch, share it with your audience, and use the dashboard to manage participants, exhibitors, and feedback after launch.",
        },
        {
          heading: "Before you start",
          body:
            "You'll need a WhatsApp number (we use it for sign-in OTPs and notifications), a business email, and a few minutes' worth of details about your event — title, description, venue, dates, and ticket types.",
        },
      ],
      shots: ["landing"],
    },
    {
      title: "Create your account",
      blurb:
        "Registration takes about two minutes. Sign-in uses a WhatsApp OTP so there's no password to manage.",
      sections: [
        {
          heading: "Step 1 — Visit the Register page",
          body:
            "Go to eventsh.com/register. Fill in your name, organization name, business email, and WhatsApp number. You'll verify both the email and the WhatsApp number with one-time codes before submitting.",
        },
        {
          heading: "Step 2 — Pick your country",
          body:
            "Pick the country you'll run events in. This drives the default currency and a few region-specific features (UPI payments in India, PayNow in Singapore, etc.).",
        },
        {
          heading: "Step 3 — Submit",
          body:
            "Hit Register. Your starter plan is assigned automatically — no manual approval needed. Head over to the login page and sign in with your WhatsApp number to start using your dashboard.",
        },
      ],
      shots: ["register"],
    },
    {
      title: "Sign in",
      blurb:
        "Once approved, signing in is a two-tap flow over WhatsApp — there's no password to remember and no chance of getting locked out.",
      sections: [
        {
          heading: "Enter your WhatsApp number",
          body:
            "Pick your country code, type your WhatsApp number, and hit Send OTP. The 6-digit code arrives in your WhatsApp within a few seconds.",
        },
        {
          heading: "Verify the OTP",
          body:
            "Paste the code, hit Verify, and you'll be redirected to your organizer dashboard. If you manage multiple organizations, you'll be asked to pick which one to work on for this session.",
        },
      ],
      shots: ["login"],
    },
    {
      title: "Your dashboard at a glance",
      blurb:
        "The organizer dashboard is the home base for everything you'll do — events, participants, exhibitors, payments, feedback, settings.",
      sections: [
        {
          heading: "Sidebar navigation",
          body:
            "The left sidebar groups every feature: Chatbot, Analytics, In-Person Booking, Participants, Exhibitors/Visitors, Events/Coupons, Feedback, Eventfront, and Settings. The features available to you depend on the modules included in your plan.",
        },
        {
          heading: "Built-in chatbot",
          body:
            "The default landing tab is the Chatbot — ask it anything about your events (\"How many tickets did Festive Bazaar sell yesterday?\", \"What's my best-selling visitor type?\") and it answers from your live data.",
        },
      ],
      shots: ["dashboard-default", "dashboard-analytics"],
    },
    {
      title: "Create your first event",
      blurb:
        "Events are created from the Events/Coupons tab. The create form is a single page with focused sections — fill in what you need, leave the rest for later.",
      sections: [
        {
          heading: "Basics",
          body:
            "Title, description, dates, location, capacity, banner image. This is the public-facing information your audience will see on your storefront.",
        },
        {
          heading: "Visitor types",
          body:
            "Define one or more visitor tiers (e.g. General, VIP, Early Bird) with their price, sale dates, and what each tier can access. You can sell tickets through Eventsh or generate QR-coded passes for free events.",
        },
        {
          heading: "Venue layout",
          body:
            "If you sell stalls or seat speakers/round tables, design the floor in the Layout tab. Drag tables, doors, walls, and add-ons into a scaled venue plan. You can even import a venue photo and let the AI Venue Designer suggest a layout for you.",
        },
        {
          heading: "Save & publish",
          body:
            "Hit Save Event. You can keep iterating; nothing is shared until you copy and send the Eventfront link from Events/Coupons.",
        },
      ],
      shots: ["dashboard-events"],
    },
    {
      title: "Share your event",
      blurb:
        "Every organizer gets a personal Eventfront — a public storefront that lists all your events. Your event also gets its own deep-linkable page.",
      sections: [
        {
          heading: "Your storefront",
          body:
            "Click the Eventfront tab in the sidebar to open your public page in a new tab. Share that link wherever your audience hangs out — Instagram bio, WhatsApp groups, posters, ads.",
        },
        {
          heading: "Per-event deep link",
          body:
            "Each event also has its own URL like eventsh.com/<your-org>/events/<event-id>. Visitors who land there can buy tickets, register for free events, or book stalls directly.",
        },
      ],
      shots: ["event-front"],
    },
    {
      title: "Track participants",
      blurb:
        "The Participants tab is where you watch ticket sales, stall bookings, speaker requests, and round-table reservations in real time.",
      sections: [
        {
          heading: "Visitor tickets",
          body:
            "See every ticket purchase: name, contact, visitor type, payment status, and a QR for the on-site scanner. Export the list or send bulk reminders.",
        },
        {
          heading: "Exhibitors and stalls",
          body:
            "Every stall booking shows up here with its current status (Pending, Confirmed, Paid, Completed). Open a stall to see payment history, the timeline of who did what, and the QR you'll release at check-in.",
        },
        {
          heading: "Notes timeline",
          body:
            "From the stall detail dialog you (or your operator, volunteer, or the exhibitor themselves) can drop a free-form note onto the timeline at any time — useful for capturing payment promises, document hand-offs, or on-the-day issues without losing the audit trail.",
        },
      ],
      shots: ["dashboard-participants"],
    },
    {
      title: "Manage exhibitors and visitors",
      blurb:
        "The Exhibitors/Visitors tab gives you a contact book across all your events.",
      sections: [
        {
          heading: "Add manually or bulk-import",
          body:
            "Add exhibitors one at a time, or upload a spreadsheet to import dozens in one go. The import dialog ships with a downloadable template so column names always line up.",
        },
        {
          heading: "Coupon codes",
          body:
            "Generate single-use or multi-use codes for early-bird discounts, partner perks, or comps. Coupons attach to events and visitor types so you stay in control of how they apply.",
        },
      ],
      shots: ["dashboard-exhibitors"],
    },
    {
      title: "In-person booking (Kiosk mode)",
      blurb:
        "On the day, run a tablet at the entrance in Kiosk mode to sell tickets and stall passes with a tap.",
      sections: [
        {
          heading: "Kiosk tab",
          body:
            "Switch into Kiosk mode from the sidebar to get a touch-friendly UI that hides admin controls. Take cash, swipe cards, or accept UPI / PayNow QR — each sale is logged the same way as an online purchase.",
        },
      ],
      shots: ["dashboard-kiosk"],
    },
    {
      title: "Feedback",
      blurb:
        "Once your event ends, EventSH automatically opens a feedback flow for ticketholders. The Feedback tab is where you read responses and reply.",
      sections: [
        {
          heading: "Per-event feedback",
          body:
            "Filter by event to see star ratings, written comments, and any opt-in testimonials. High-rated comments can be promoted to your Eventfront with one click.",
        },
        {
          heading: "App-level feedback",
          body:
            "The landing page also collects feedback about Eventsh itself; you'll see those in the admin console (separate from event feedback).",
        },
      ],
      shots: ["dashboard-feedback"],
    },
    {
      title: "Settings and account",
      blurb:
        "Finally, the Settings tab holds your profile, plan, brand assets (logo, hero images), and pay-out configuration.",
      sections: [
        {
          heading: "Profile",
          body:
            "Update your business email, WhatsApp number, organization name, and bio. The bio appears on your public Eventfront, so keep it tight and on-brand.",
        },
        {
          heading: "Plan & billing",
          body:
            "See your current plan, what modules it unlocks (events, stalls, storefront, etc.), and the renewal date. Upgrade in-app if a feature you need is locked.",
        },
        {
          heading: "Payouts",
          body:
            "Hook up Razorpay (India) or your payment processor of choice so ticket money flows straight to your bank.",
        },
      ],
      shots: ["dashboard-settings"],
    },
    {
      title: "You're all set",
      blurb:
        "That's the loop: create → share → run → review. Drop a note in the dashboard chatbot if you hit anything that's not covered here — it understands your data and your account.",
      sections: [
        {
          heading: "Need help?",
          body:
            "Use the in-app chatbot for instant answers, or reach the team at help@eventsh.com. We read every message.",
        },
        {
          heading: "Keep going",
          body:
            "Every section above has more depth — bulk imports, operator/volunteer access, AI venue design, advanced ticket rules. Explore at your own pace; the docs grow as the product does.",
        },
      ],
      shots: [],
    },
  ],
};

// -------------------------------------------------------------------------
// PDF builder
// -------------------------------------------------------------------------
function buildPDF() {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: {
      Title: GUIDE.title,
      Author: "EventSH",
      Subject: GUIDE.subtitle,
    },
    bufferPages: true,
  });

  const out = fs.createWriteStream(OUTPUT_PDF);
  doc.pipe(out);

  const ACCENT = "#7c3aed"; // EventSH purple-ish
  const INK = "#1f2937";
  const MUTED = "#6b7280";

  // ---- Cover page ----
  doc.fillColor(ACCENT)
    .rect(0, 0, doc.page.width, 240)
    .fill();
  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(36)
    .text(GUIDE.title, 56, 120, { width: doc.page.width - 112 });
  doc
    .fillColor("white")
    .font("Helvetica")
    .fontSize(16)
    .text(GUIDE.subtitle, 56, 175, { width: doc.page.width - 112 });

  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(11)
    .text(GUIDE.edition, 56, 280);

  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(12)
    .text(
      "This guide walks an organizer through the full EventSH experience, from creating an account to running and reviewing events. Each chapter pairs short instructions with the actual screen you'll see in the product.",
      56,
      320,
      { width: doc.page.width - 112, align: "left" },
    );

  // Table of contents
  doc.addPage();
  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(22)
    .text("Contents", { underline: false });
  doc.moveDown(0.8);

  doc.font("Helvetica").fontSize(12).fillColor(INK);
  GUIDE.chapters.forEach((ch, i) => {
    doc.text(`${String(i + 1).padStart(2, "0")}.  ${ch.title}`, {
      lineGap: 4,
    });
  });

  // ---- Chapters ----
  GUIDE.chapters.forEach((chapter, idx) => {
    doc.addPage();

    // Chapter header band
    doc
      .fillColor(ACCENT)
      .rect(0, doc.y - 8, doc.page.width, 36)
      .fill();
    doc
      .fillColor("white")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(`CHAPTER ${idx + 1}`, 56, doc.y + 2);

    doc.moveDown(2);
    doc.x = 56;
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(22)
      .text(chapter.title);

    doc.moveDown(0.4);
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(12)
      .text(chapter.blurb, { lineGap: 2 });

    doc.moveDown(0.8);

    // Sections
    chapter.sections.forEach((sec) => {
      doc
        .fillColor(ACCENT)
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(sec.heading);
      doc.moveDown(0.2);
      doc
        .fillColor(INK)
        .font("Helvetica")
        .fontSize(11)
        .text(sec.body, { lineGap: 2, align: "left" });
      doc.moveDown(0.6);
    });

    // Screenshots — embed at the current cursor so PDFKit auto-advances y.
    chapter.shots.forEach((shotId) => {
      const file = path.join(SCREENSHOT_DIR, `${shotId}.png`);
      if (!fs.existsSync(file)) {
        console.warn(`  missing screenshot for ${shotId}`);
        return;
      }
      const imgWidth = doc.page.width - 112;
      const img = doc.openImage(file);
      const imgHeight = imgWidth * (img.height / img.width);
      const bottomMargin = 80;
      const spaceLeft = doc.page.height - doc.y - bottomMargin;
      if (imgHeight > spaceLeft) doc.addPage();
      doc.moveDown(0.4);
      try {
        doc.image(img, { width: imgWidth });
      } catch (e) {
        console.warn(`  failed to embed ${shotId}: ${e.message}`);
        return;
      }
      doc.moveDown(0.4);
      doc
        .fillColor(MUTED)
        .font("Helvetica-Oblique")
        .fontSize(9)
        .text(`Figure: ${shotId}`, { align: "center" });
      doc.moveDown(0.6);
    });
  });

  // Page numbers in the footer
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    if (i === 0) continue; // skip cover
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(9)
      .text(
        `${i + 1} / ${range.count}`,
        56,
        doc.page.height - 30,
        { width: doc.page.width - 112, align: "right" },
      );
  }

  doc.end();
  return new Promise((resolve) => out.on("finish", resolve));
}

// -------------------------------------------------------------------------
// Entrypoint
// -------------------------------------------------------------------------
(async () => {
  try {
    let org = null;
    if (!PDF_ONLY) {
      if (!SKIP_SEED) {
        const seeded = await seedDemoOrganizerAndEvent();
        org = seeded.org;
      } else {
        org = {
          _id: "6915a3fa28972c4362c262be",
          name: "Vansh Sharma",
          email: "vasharma2002@gmail.com",
          organizationName: "Jicama.tech",
          country: "IN",
        };
      }
      await capture(org);
    }
    if (!CAPTURE_ONLY) {
      console.log("\nBuilding PDF…");
      await buildPDF();
      const sz = fs.statSync(OUTPUT_PDF).size;
      console.log(
        `\n✓ ${OUTPUT_PDF}\n  ${(sz / 1024).toFixed(0)} KB · ${GUIDE.chapters.length} chapters`,
      );
    }
  } catch (e) {
    console.error("Build failed:", e);
    process.exit(1);
  }
})();
