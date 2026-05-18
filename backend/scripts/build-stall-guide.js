// Builds the EventSH stall-exhibitor user guide.
//
// Mirrors backend/scripts/build-guide.js but tells a different story —
// the *exhibitor's* journey from finding an event, registering for a
// stall, getting confirmed, picking spaces & add-ons, paying, and
// downloading their stall QR ticket. The dashboard side (organizer
// approving / confirming payment / releasing QR) is also captured.
//
// Run from the repo root:
//   node backend/scripts/build-stall-guide.js
//
// Flags:
//   HEADLESS=false    → watch the browser
//   PDF_ONLY=true     → reuse existing PNGs, only rebuild the PDF
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
const SCREENSHOT_DIR = path.join(REPO_ROOT, "docs", "stall-screenshots");
const OUTPUT_PDF = path.join(REPO_ROOT, "docs", "EventSH-Stall-Exhibitor-Guide.pdf");
const FRONTEND_BASE = process.env.FRONTEND_BASE || "http://localhost:8080";
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1 };

// EventSH demo organizer + event reused from the main guide.
const ORG_EMAIL = "hello@eventsh.com";
const EVENT_TITLE = "EventSH Launch Showcase";
const ORG_SLUG = "eventsh";

// Three vendors, all branded "EventSH" but with distinct WhatsApp numbers
// so each can drive a different state in the flow. The form-capture vendor
// is *new* (no stall record) so the dialog opens on the empty form. The
// confirmed and paid vendors have pre-seeded stalls in the right state.
const VENDOR_FRESH = {
  name: "EventSH",
  brandName: "EventSH",
  shopName: "EventSH",
  businessName: "EventSH",
  businessCategory: "Technology",
  businessEmail: "vendor-fresh@eventsh.com",
  email: "vendor-fresh@eventsh.com",
  whatsAppNumber: "+10000000031",
  whatsappNumber: "+10000000031",
  country: "SG",
  countryCode: "+65",
  phoneNumber: "10000000031",
  address: "Marina Bay",
  city: "Singapore",
  state: "Singapore",
  pincode: "018956",
  businessOwnerNationality: "Singaporean",
  residency: "Singapore",
  businessDescription:
    "EventSH — the all-in-one platform for ticketing, venue design, and event management.",
  productDescription: "EventSH demo booth showcasing the platform's capabilities.",
  isActive: true,
};
const VENDOR_CONFIRMED = {
  ...VENDOR_FRESH,
  businessEmail: "vendor-confirmed@eventsh.com",
  email: "vendor-confirmed@eventsh.com",
  whatsAppNumber: "+10000000032",
  whatsappNumber: "+10000000032",
  phoneNumber: "10000000032",
};
const VENDOR_PAID = {
  ...VENDOR_FRESH,
  businessEmail: "vendor-paid@eventsh.com",
  email: "vendor-paid@eventsh.com",
  whatsAppNumber: "+10000000033",
  whatsappNumber: "+10000000033",
  phoneNumber: "10000000033",
};

const HEADLESS = process.env.HEADLESS !== "false";
const CAPTURE_ONLY = process.env.CAPTURE_ONLY === "true";
const PDF_ONLY = process.env.PDF_ONLY === "true";
const SKIP_SEED = process.env.SKIP_SEED === "true";

// -------------------------------------------------------------------------
// JWT — organizer-side captures
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

// -------------------------------------------------------------------------
// Mongo: seed everything the guide needs
// -------------------------------------------------------------------------
async function seedAll() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const Organizer = mongoose.connection.collection("organizers");
    const Event = mongoose.connection.collection("events");
    const Vendor = mongoose.connection.collection("vendors");
    const Stall = mongoose.connection.collection("stalls");
    const Store = mongoose.connection.collection("organizer_stores");
    const now = new Date();

    // ---- Org: ensure the slug is set so the public URL resolves ----
    await Organizer.updateOne(
      { businessEmail: ORG_EMAIL },
      { $set: { slug: ORG_SLUG, updatedAt: now } },
    );
    const org = await Organizer.findOne({ businessEmail: ORG_EMAIL });
    if (!org) throw new Error(`Demo org ${ORG_EMAIL} not found — run build-guide.js first.`);

    // ---- Organizer store: required for the EventFront page to render ----
    // organizerId is stored as a STRING in existing records (mongoose isn't
    // casting on save here); the controller's findOne uses the URL string
    // directly, so match the prevailing pattern.
    const orgIdStr = org._id.toString();
    await Store.deleteMany({ organizerId: org._id }); // remove any prior ObjectId-typed copy
    await Store.updateOne(
      { organizerId: orgIdStr },
      {
        $set: {
          organizerId: orgIdStr,
          slug: ORG_SLUG,
          settings: {
            general: {
              storeName: "EventSH",
              tagline: "The all-in-one event management platform.",
              description: "Demo storefront used in the stall exhibitor guide.",
              logo: "",
              favicon: "",
              contactInfo: {
                phone: "+10000000099",
                email: ORG_EMAIL,
                address: "EventSH HQ, Singapore",
                hours: "Mon-Fri 9-6",
                website: "https://eventsh.com",
              },
            },
            design: {
              theme: "light",
              primaryColor: "#7c3aed",
              secondaryColor: "#a855f7",
              fontFamily: "Inter",
            },
          },
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    // ---- Event: ensure it has stalls + tables + add-ons ----
    const venueConfigId = "vc-eventsh-1";
    const venueConfig = [{
      venueConfigId,
      width: 800,
      height: 500,
      scale: 0.75,
      gridSize: 20,
      showGrid: true,
      hasMainStage: true,
      totalRows: 3,
    }];
    const spaceTemplates = [
      { id: "tpl-corner", name: "Corner Booth", width: 120, height: 100, isMainStage: false, slotPrice: 350, maxSpeakers: 0, maxVisitors: 0, description: "Premium corner with two open sides.", openForApplications: true },
      { id: "tpl-standard", name: "Standard Booth", width: 100, height: 80, isMainStage: false, slotPrice: 250, maxSpeakers: 0, maxVisitors: 0, description: "Single-front booth ideal for first-time exhibitors.", openForApplications: true },
    ];
    const venueTables = [
      { venueConfigId, positionId: "pos-a1", id: "pos-a1", tableName: "A1 — Corner", name: "A1 — Corner", type: "Straight", width: 120, height: 100, x: 80, y: 80, rotation: 0, isPlaced: true, tablePrice: 350, bookingPrice: 350, depositPrice: 100, color: "#22c55e", forSale: true, isBooked: false },
      { venueConfigId, positionId: "pos-a2", id: "pos-a2", tableName: "A2 — Standard", name: "A2 — Standard", type: "Straight", width: 100, height: 80, x: 220, y: 80, rotation: 0, isPlaced: true, tablePrice: 250, bookingPrice: 250, depositPrice: 75, color: "#22c55e", forSale: true, isBooked: false },
      { venueConfigId, positionId: "pos-b1", id: "pos-b1", tableName: "B1 — Standard", name: "B1 — Standard", type: "Straight", width: 100, height: 80, x: 80, y: 220, rotation: 0, isPlaced: true, tablePrice: 250, bookingPrice: 250, depositPrice: 75, color: "#22c55e", forSale: true, isBooked: false },
      { venueConfigId, positionId: "pos-b2", id: "pos-b2", tableName: "B2 — Standard", name: "B2 — Standard", type: "Straight", width: 100, height: 80, x: 220, y: 220, rotation: 0, isPlaced: true, tablePrice: 250, bookingPrice: 250, depositPrice: 75, color: "#22c55e", forSale: true, isBooked: false },
    ];
    const addOnItems = [
      { id: "ao-1", name: "Extra Chair", price: 15, description: "Additional chair for your booth.", color: "#8b5cf6" },
      { id: "ao-2", name: "Power Outlet", price: 25, description: "Dedicated power outlet (5A).", color: "#06b6d4" },
      { id: "ao-3", name: "Signage Print", price: 60, description: "Custom A2 signage above your booth.", color: "#f97316" },
    ];

    await Event.updateOne(
      { organizer: org._id.toString(), title: EVENT_TITLE },
      {
        $set: {
          venueConfig,
          spaceTemplates,
          venueTables,
          addOnItems,
          features: {
            food: true,
            parking: true,
            wifi: true,
            photography: false,
            security: false,
            accessibility: true,
            hasStalls: true,
          },
          status: "published",
          visibility: "public",
          updatedAt: now,
        },
      },
    );
    const eventDoc = await Event.findOne({
      organizer: org._id.toString(),
      title: EVENT_TITLE,
    });
    console.log(`Event id: ${eventDoc._id}  (${eventDoc.title})`);

    // ---- Vendors: upsert all three EventSH-branded vendors ----
    async function upsertVendor(v) {
      await Vendor.updateOne(
        { businessEmail: v.businessEmail },
        {
          $set: {
            ...v,
            organizerId: org._id,
            approved: true,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
      return await Vendor.findOne({ businessEmail: v.businessEmail });
    }
    const vFresh = await upsertVendor(VENDOR_FRESH);
    const vConfirmed = await upsertVendor(VENDOR_CONFIRMED);
    const vPaid = await upsertVendor(VENDOR_PAID);
    console.log(`Vendors: fresh=${vFresh._id}  confirmed=${vConfirmed._id}  paid=${vPaid._id}`);

    // ---- Stalls: wipe & re-seed so each run starts clean ----
    await Stall.deleteMany({
      eventId: eventDoc._id,
      shopkeeperId: { $in: [vFresh._id, vConfirmed._id, vPaid._id] },
    });

    // Vendor "fresh" intentionally has NO stall — keeps the form view empty
    // when the exhibitor opens it from EventFront.

    // ---- Stall: CONFIRMED + Partial payment (for table-selection + payment-due views)
    const confirmedTables = [{
      tableId: venueTables[0].id,
      positionId: venueTables[0].positionId,
      name: venueTables[0].name,
      tableName: venueTables[0].tableName,
      tableType: venueTables[0].type,
      layoutName: "Hall A",
      price: venueTables[0].tablePrice,
      depositAmount: venueTables[0].depositPrice,
    }];
    const confirmedAddOns = [{
      addOnId: addOnItems[0].id,
      name: addOnItems[0].name,
      price: addOnItems[0].price,
      quantity: 2,
    }, {
      addOnId: addOnItems[1].id,
      name: addOnItems[1].name,
      price: addOnItems[1].price,
      quantity: 1,
    }];
    const confirmedTotals = {
      tablesTotal: 350,
      depositTotal: 100,
      addOnsTotal: 15 * 2 + 25,
      grandTotal: 350 + 15 * 2 + 25,
      paidAmount: 100,
      remainingAmount: 350 + 15 * 2 + 25 - 100,
    };
    await Stall.insertOne({
      shopkeeperId: vConfirmed._id,
      eventId: eventDoc._id,
      organizerId: org._id,
      preferredTemplateId: spaceTemplates[0].id,
      preferredTemplateName: spaceTemplates[0].name,
      status: "Confirmed",
      paymentStatus: "Partial",
      selectedTables: confirmedTables,
      selectedAddOns: confirmedAddOns,
      ...confirmedTotals,
      nameOfApplicant: "EventSH Booth Lead",
      brandName: "EventSH",
      businessOwnerNationality: "Singaporean",
      residency: "Singapore",
      noOfOperators: "2",
      paymentMethod: "qr",
      transactionId: "TXN-EVENTSH-001",
      statusHistory: [
        { status: "Pending", note: "Initial stall application received.", changedAt: new Date(now.getTime() - 5 * 86400000), changedBy: "system" },
        { status: "Approved", note: "Approved after review.", changedAt: new Date(now.getTime() - 4 * 86400000), changedBy: "organizer" },
        { status: "Confirmed", note: "Tables and add-ons selected.", changedAt: new Date(now.getTime() - 3 * 86400000), changedBy: "EventSH (vendor)" },
        { status: "Partial", note: "Deposit paid via PayNow.", changedAt: new Date(now.getTime() - 2 * 86400000), changedBy: "EventSH (vendor)" },
      ],
      createdAt: new Date(now.getTime() - 6 * 86400000),
      updatedAt: now,
    });

    // ---- Stall: PAID + Completed (for QR / ticket views)
    const paidTables = [
      confirmedTables[0],
      {
        tableId: venueTables[1].id,
        positionId: venueTables[1].positionId,
        name: venueTables[1].name,
        tableName: venueTables[1].tableName,
        tableType: venueTables[1].type,
        layoutName: "Hall A",
        price: venueTables[1].tablePrice,
        depositAmount: venueTables[1].depositPrice,
      },
    ];
    const paidTotals = {
      tablesTotal: 350 + 250,
      depositTotal: 100 + 75,
      addOnsTotal: 15 * 2 + 25 + 60,
      grandTotal: 350 + 250 + 15 * 2 + 25 + 60,
      paidAmount: 350 + 250 + 15 * 2 + 25 + 60,
      remainingAmount: 0,
    };
    await Stall.insertOne({
      shopkeeperId: vPaid._id,
      eventId: eventDoc._id,
      organizerId: org._id,
      preferredTemplateId: spaceTemplates[0].id,
      preferredTemplateName: spaceTemplates[0].name,
      status: "Completed",
      paymentStatus: "Paid",
      selectedTables: paidTables,
      selectedAddOns: [
        ...confirmedAddOns,
        { addOnId: addOnItems[2].id, name: addOnItems[2].name, price: addOnItems[2].price, quantity: 1 },
      ],
      ...paidTotals,
      nameOfApplicant: "EventSH Booth Lead",
      brandName: "EventSH",
      businessOwnerNationality: "Singaporean",
      residency: "Singapore",
      noOfOperators: "3",
      paymentMethod: "qr",
      transactionId: "TXN-EVENTSH-002",
      paymentConfirmedDate: new Date(now.getTime() - 1 * 86400000),
      completionDate: new Date(now.getTime() - 1 * 86400000),
      // A small placeholder QR — actual base64 image not required for the
      // dashboard to render the "Paid" state; the Download button will hit
      // the backend which regenerates it from this data.
      qrCodePath: "",
      statusHistory: [
        { status: "Pending", note: "Initial stall application received.", changedAt: new Date(now.getTime() - 8 * 86400000), changedBy: "system" },
        { status: "Approved", note: "Approved after review.", changedAt: new Date(now.getTime() - 7 * 86400000), changedBy: "organizer" },
        { status: "Confirmed", note: "Tables and add-ons selected.", changedAt: new Date(now.getTime() - 6 * 86400000), changedBy: "EventSH (vendor)" },
        { status: "Paid", note: "Full payment received.", changedAt: new Date(now.getTime() - 2 * 86400000), changedBy: "organizer" },
        { status: "Completed", note: "Payment confirmed. Stall completed. QR ticket released.", changedAt: new Date(now.getTime() - 1 * 86400000), changedBy: "organizer" },
      ],
      createdAt: new Date(now.getTime() - 10 * 86400000),
      updatedAt: now,
    });

    return {
      org,
      eventId: eventDoc._id.toString(),
      vendors: { fresh: vFresh, confirmed: vConfirmed, paid: vPaid },
    };
  } finally {
    await mongoose.disconnect();
  }
}

// -------------------------------------------------------------------------
// Capture phase
// -------------------------------------------------------------------------
async function capture(state) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const token = mintOrganizerToken(state.org);
  const eventUrl = `/${ORG_SLUG}/events/${state.eventId}`;

  const browser = await puppeteer.launch({
    headless: HEADLESS ? "new" : false,
    defaultViewport: VIEWPORT,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
  });

  // Shared helpers ---------------------------------------------------------
  // Prefer buttons inside an open dialog so we don't click a duplicate-named
  // control elsewhere on the page (e.g. there's a "Send OTP" for both the
  // WhatsApp dialog and the business-email field on the same eventfront).
  async function clickByLabel(page, label) {
    const handle = await page.evaluateHandle((lbl) => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const scopes = [
        document.querySelector('[role="dialog"][data-state="open"]'),
        document.querySelector('[role="dialog"]'),
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

  // Find an input by visible heuristics: matching placeholder, aria-label,
  // name attribute, or the PhoneInput's .form-control class. Returns the
  // first hit inside an open dialog if one exists, otherwise the first hit
  // anywhere.
  async function findInput(page, needle) {
    return await page.evaluateHandle((q) => {
      const norm = (s) => (s || "").toLowerCase();
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      // Prefer an OPEN Radix dialog. Fallback chain handles vanilla pages.
      const scopes = [
        document.querySelector('[role="dialog"][data-state="open"]'),
        ...Array.from(document.querySelectorAll('[role="dialog"]')).filter(visible),
        document.body,
      ].filter(Boolean);
      const wanted = q.toLowerCase();
      for (const scope of scopes) {
        const inputs = Array.from(
          scope.querySelectorAll("input, textarea"),
        ).filter(visible);
        const hit =
          inputs.find((i) => norm(i.placeholder).includes(wanted)) ||
          inputs.find((i) => norm(i.getAttribute("aria-label")).includes(wanted)) ||
          inputs.find((i) => norm(i.name).includes(wanted)) ||
          (wanted === "whatsapp" || wanted === "phone"
            ? inputs.find((i) => i.classList.contains("form-control"))
            : null);
        if (hit) return hit;
      }
      return null;
    }, needle);
  }

  // Set an input via the native value setter + input/change events. Works
  // for plain controlled inputs (the OTP textbox), but NOT for libraries
  // that maintain their own state (react-phone-input-2). Use typeInto for
  // those — it sends real keystrokes.
  async function setReactValue(page, needle, value) {
    const handle = await findInput(page, needle);
    const el = handle.asElement();
    if (!el) return false;
    await page.evaluate((node, val) => {
      const tag = node.tagName;
      const proto =
        tag === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(node, val);
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    }, el, value);
    return true;
  }

  // Focus + real keystrokes. Necessary for react-phone-input-2's PhoneInput
  // which intercepts keydown events to format the number — it won't react
  // to a synthesized input event. Click via mouse coords so focus actually
  // lands on the input (some wrappers trap focus elsewhere when you call
  // .focus() directly).
  async function typeInto(page, needle, value) {
    const handle = await findInput(page, needle);
    const el = handle.asElement();
    if (!el) return false;
    try {
      await el.scrollIntoView();
    } catch (e) {}
    const box = await el.boundingBox();
    if (!box) return false;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    // Tiny pause so the click's focus commit propagates.
    await new Promise((r) => setTimeout(r, 80));
    // Clear any auto-prefilled prefix.
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(value, { delay: 80 });
    return true;
  }

  // Mock OTP endpoints so the exhibitor flow can proceed unattended.
  // Frontend expects exact response messages — match them precisely.
  async function mockOtp(page) {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/otp/send-whatsapp-otp")) {
        return req.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "OTP sent to WhatsApp" }),
        });
      }
      if (url.includes("/otp/verify-chat-otp")) {
        return req.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "OTP verified" }),
        });
      }
      req.continue();
    });
  }

  async function newPage({ auth = false } = {}) {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    if (auth) {
      await page.evaluateOnNewDocument((t) => {
        try { sessionStorage.setItem("token", t); } catch (e) {}
      }, token);
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
    // ============== Exhibitor-side: EventFront ==============
    console.log("\n→ eventfront landing");
    {
      const page = await newPage();
      await page.goto(`${FRONTEND_BASE}${eventUrl}`, { waitUntil: "networkidle2", timeout: 60_000 });
      await waitForSpinner(page);
      await sleep(3500);
      await shot(page, "eventfront-landing", { fullPage: true });
      await page.close();
    }

    console.log("\n→ stall registration form gate (Step 1: WhatsApp verify)");
    {
      const page = await newPage();
      await mockOtp(page);
      await page.goto(`${FRONTEND_BASE}${eventUrl}`, { waitUntil: "networkidle2", timeout: 60_000 });
      await waitForSpinner(page);
      await sleep(3500);
      await clickByLabel(page, "Rent a Stall");
      await sleep(1500);
      await shot(page, "stall-form-otp");
      await page.close();
    }

    // Step 2 of the form: the actual fields. Use the dev-only guide bypass
    // (window.__guideBypass) baked into eventFront.tsx to skip the OTP
    // gate that Puppeteer can't drive through react-phone-input-2.
    console.log("\n→ stall registration form fields");
    {
      const page = await newPage();
      await page.evaluateOnNewDocument((wa) => {
        window.__guideBypass = { whatsapp: wa, openForm: true };
      }, VENDOR_FRESH.whatsAppNumber);
      await page.goto(`${FRONTEND_BASE}${eventUrl}`, { waitUntil: "networkidle2", timeout: 60_000 });
      await waitForSpinner(page);
      await sleep(4000);
      await shot(page, "stall-form-fields", { fullPage: true });
      await page.close();
    }

    // Select Spaces — the table-selection dialog. Same bypass mechanism.
    console.log("\n→ stall table selection dialog (Select Spaces)");
    {
      const page = await newPage();
      await page.evaluateOnNewDocument((wa) => {
        window.__guideBypass = {
          whatsapp: wa,
          openTableSelection: true,
        };
      }, VENDOR_CONFIRMED.whatsAppNumber);
      await page.goto(`${FRONTEND_BASE}${eventUrl}`, { waitUntil: "networkidle2", timeout: 60_000 });
      await waitForSpinner(page);
      await sleep(4500);
      await shot(page, "stall-table-dialog", { fullPage: true });
      await page.close();
    }

    // Payment page — render with mock orderData via window.__guideOrderData.
    console.log("\n→ payment page (mock order data)");
    {
      const page = await newPage();
      await page.evaluateOnNewDocument((data) => {
        window.__guideOrderData = data;
      }, {
        stallRequestId: "demo-stall-request-eventsh",
        eventId: state.eventId,
        eventInfo: {
          id: state.eventId,
          organizerId: state.org._id.toString(),
          name: "EventSH Launch Showcase",
          startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        vendorName: "EventSH",
        shopkeeperId: state.vendors.confirmed._id.toString(),
        selectedTables: [
          { tableId: "pos-a1", positionId: "pos-a1", name: "A1 — Corner", tableName: "A1 — Corner", tableType: "Straight", layoutName: "Hall A", price: 350, depositAmount: 100 },
          { tableId: "pos-a2", positionId: "pos-a2", name: "A2 — Standard", tableName: "A2 — Standard", tableType: "Straight", layoutName: "Hall A", price: 250, depositAmount: 75 },
        ],
        selectedAddOns: [
          { addOnId: "ao-1", name: "Extra Chair", price: 15, quantity: 2 },
          { addOnId: "ao-2", name: "Power Outlet", price: 25, quantity: 1 },
        ],
        priceSummary: {
          tablesTotal: 600,
          depositTotal: 175,
          addOnsTotal: 55,
          grandTotal: 655,
        },
        minimumPayment: 175,
        country: "SG",
      });
      await page.goto(`${FRONTEND_BASE}/table-payment`, { waitUntil: "networkidle2", timeout: 60_000 });
      await waitForSpinner(page);
      await sleep(4500);
      await shot(page, "stall-payment-page", { fullPage: true });
      await page.close();
    }

    // Public Venue Layout tab on the event page shows every defined stall
    // with price + availability — exactly what an exhibitor sees when
    // deciding which space to pick. No auth or OTP gate needed.
    console.log("\n→ select spaces: public Venue Layout tab");
    {
      const page = await newPage();
      await page.goto(`${FRONTEND_BASE}${eventUrl}`, { waitUntil: "networkidle2", timeout: 60_000 });
      await waitForSpinner(page);
      await sleep(3500);
      const clicked = await clickByLabel(page, "Venue Layout");
      if (!clicked) console.warn("  no Venue Layout tab found on eventfront");
      await sleep(2500);
      await shot(page, "stall-select-space", { fullPage: true });
      await page.close();
    }

    // Organizer's Venue Layout sub-tab inside the Event Attendance modal —
    // same spaces, but with bookings overlaid (which stalls are booked,
    // by whom, and any add-ons attached).
    console.log("\n→ organizer's venue layout (with bookings)");
    {
      const page = await newPage({ auth: true });
      await page.goto(
        `${FRONTEND_BASE}/organizer-dashboard`,
        { waitUntil: "networkidle2", timeout: 60_000 },
      );
      await waitForSpinner(page);
      await sleep(4500);
      await clickByLabel(page, "Participants");
      await sleep(3500);
      await clickByLabel(page, "View");
      await sleep(2500);
      await clickByLabel(page, "Venue Layout");
      await sleep(2500);
      await shot(page, "dashboard-venue-layout", { fullPage: true });
      await page.close();
    }

    // ============== Organizer-side: Dashboard ==============
    console.log("\n→ dashboard exhibitors tab (both stalls visible)");
    {
      const page = await newPage({ auth: true });
      await page.goto(
        `${FRONTEND_BASE}/organizer-dashboard`,
        { waitUntil: "networkidle2", timeout: 60_000 },
      );
      await waitForSpinner(page);
      await sleep(4500);
      await clickByLabel(page, "Participants");
      await sleep(3500);
      await shot(page, "dashboard-participants");
      // Click first "View" to open the event-attendance modal.
      await clickByLabel(page, "View");
      await sleep(3000);
      await clickByLabel(page, "Exhibitors");
      await sleep(2500);
      await shot(page, "dashboard-exhibitors-tab", { fullPage: true });
      await page.close();
    }

    // Open a stall row by the vendor's email → ExhibitorDetailDialog. Two
    // separate page sessions to keep state clean.
    async function captureStallDetailByEmail(email, shotId) {
      const page = await newPage({ auth: true });
      await page.goto(
        `${FRONTEND_BASE}/organizer-dashboard`,
        { waitUntil: "networkidle2", timeout: 60_000 },
      );
      await waitForSpinner(page);
      await sleep(4500);
      await clickByLabel(page, "Participants");
      await sleep(3500);
      await clickByLabel(page, "View");
      await sleep(2500);
      await clickByLabel(page, "Exhibitors");
      await sleep(2500);
      const opened = await page.evaluate((needle) => {
        // Scan every visible row in every table and pick the first one whose
        // text contains the unique email, then click its first button.
        const rows = Array.from(document.querySelectorAll("table tr"));
        for (const r of rows) {
          if ((r.textContent || "").includes(needle)) {
            const btn = r.querySelector("button");
            if (btn) { btn.click(); return true; }
          }
        }
        return false;
      }, email);
      if (opened) {
        await sleep(3500);
        await shot(page, shotId, { fullPage: true });
      } else {
        console.warn(`  could not find row with ${email} for ${shotId}`);
      }
      await page.close();
    }

    console.log("\n→ stall detail (Confirmed/Partial)");
    await captureStallDetailByEmail(VENDOR_CONFIRMED.businessEmail, "stall-detail-confirmed");

    console.log("\n→ stall detail (Paid/Completed)");
    await captureStallDetailByEmail(VENDOR_PAID.businessEmail, "stall-detail-paid");

    // Stall ticket PDF — fetch directly, save to disk, render via file://.
    // (The /download-stall-ticket endpoint serves with Content-Disposition:
    // attachment, so direct navigation aborts in Chrome.)
    console.log("\n→ stall ticket PDF (download → file:// render)");
    {
      await mongoose.connect(process.env.MONGO_URI);
      const s = await mongoose.connection
        .collection("stalls")
        .findOne({ shopkeeperId: state.vendors.paid._id });
      await mongoose.disconnect();
      if (!s?._id) {
        console.warn("  could not find paid stall id");
      } else {
        const stallPaidId = s._id.toString();
        const resp = await fetch(
          `http://localhost:3000/stalls/download-stall-ticket/${stallPaidId}`,
        );
        if (!resp.ok) {
          console.warn(`  ticket fetch ${resp.status}`);
        } else {
          const buf = Buffer.from(await resp.arrayBuffer());
          const pdfPath = path.join(SCREENSHOT_DIR, "stall-ticket.pdf");
          fs.writeFileSync(pdfPath, buf);
          console.log(`  wrote ${pdfPath} (${(buf.length / 1024).toFixed(0)} KB)`);
          const page = await newPage();
          await page.goto(`file://${pdfPath.replace(/\\/g, "/")}`, {
            waitUntil: "networkidle2",
            timeout: 30_000,
          });
          await sleep(2500);
          await shot(page, "stall-ticket-pdf");
          await page.close();
        }
      }
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
  title: "EventSH Stall Exhibitor Guide",
  subtitle: "Renting a stall, paying, and collecting your QR ticket",
  edition: "Edition 1 · 2026",
  chapters: [
    {
      title: "Welcome, exhibitor",
      blurb:
        "This guide walks you through booking a stall at an EventSH event — finding the event, registering your business, choosing your space, paying, and downloading the QR ticket you'll scan on the day.",
      sections: [
        {
          heading: "What you'll need",
          body:
            "A WhatsApp number (for sign-in OTPs), your business details (name, registration number, address), a logo & a couple of product photos, and the URL or organizer page of the event you want to exhibit at.",
        },
      ],
      shots: ["eventfront-landing"],
    },

    {
      title: "Apply for a stall",
      blurb:
        "From the event page, hit Rent a Stall and verify your WhatsApp number. Once verified, the application form opens for you to fill in business and contact details.",
      sections: [
        {
          heading: "Verify your number",
          body:
            "Type your WhatsApp number, request the OTP, and enter the 6-digit code you receive. This proves you're the person behind the business and is how EventSH will reach you about your application.",
        },
        {
          heading: "Fill in the form",
          body:
            "Business name, owner name, nationality, residency, business category, registration number, contact details, plus optional uploads (logo, registration certificate, product photos). Hit submit and your application lands in the organizer's dashboard as Pending.",
        },
      ],
      shots: ["stall-form-otp", "stall-form-fields"],
    },

    {
      title: "The organizer reviews your request",
      blurb:
        "The organizer sees every incoming stall request from the dashboard's Participants → event view → Exhibitors tab. They can approve, leave notes on the timeline, or cancel.",
      sections: [
        {
          heading: "Participants list",
          body:
            "Participants groups everything by event. Each row shows the event, dates, venue, and a View action.",
        },
        {
          heading: "Exhibitor bookings",
          body:
            "Inside an event's attendance view, the Exhibitors tab lists every stall booking with the exhibitor name, contact, tables, amount, payment status, and booking status.",
        },
      ],
      shots: ["dashboard-participants", "dashboard-exhibitors-tab"],
    },

    {
      title: "Pick your space & add-ons",
      blurb:
        "Once approved, the exhibitor returns to the event page, picks tables on the venue layout, and chooses optional add-ons. The stall detail in the organizer dashboard then shows exactly what was selected.",
      sections: [
        {
          heading: "Venue layout",
          body:
            "Green tables are available, blue is your current selection, grey is already booked. Each booth lists its price and deposit.",
        },
        {
          heading: "Add-ons",
          body:
            "Pick optional add-ons — extra chairs, power outlets, custom signage — and the running total updates. This screenshot shows the stall detail as the organizer sees it after the exhibitor finishes selection: tables, add-ons, and the partial payment received.",
        },
      ],
      shots: ["stall-select-space", "stall-table-dialog", "dashboard-venue-layout", "stall-detail-confirmed"],
    },

    {
      title: "Pay your deposit or in full",
      blurb:
        "After selecting tables and add-ons, Continue to Payment opens the payment page. You can pay only the deposit to hold your booth, or settle the full amount up front.",
      sections: [
        {
          heading: "Payment options",
          body:
            "UPI / PayNow QR for instant transfers, or a bank transfer with transaction ID + screenshot. The page calculates totals, applies any coupon code you've been given, and holds the booking for 24 hours while you complete payment.",
        },
        {
          heading: "Partial vs. full",
          body:
            "A partial payment (deposit) moves you to Partial status — the balance is due before the event. A full payment marks you as Paid and triggers QR ticket generation as soon as the organizer confirms the transaction.",
        },
      ],
      shots: ["stall-payment-page"],
    },

    {
      title: "Organizer confirms your payment",
      blurb:
        "When you've paid, the organizer confirms the transaction from the dashboard. The Exhibitor Bookings table shows live status — Partial during deposit period, Paid + Completed once the full amount is in.",
      sections: [
        {
          heading: "Partial payment",
          body:
            "Paid only the deposit? The dashboard shows the remaining balance against the event's deadline. The QR ticket is held back until the full amount is confirmed.",
        },
        {
          heading: "Full payment & QR release",
          body:
            "Once paid in full, the organizer opens the stall and hits Confirm Payment. The system generates the stall QR — scannable at check-in — and stamps the timeline with Paid / Completed.",
        },
      ],
      shots: ["stall-detail-paid"],
    },

    {
      title: "Get your QR stall ticket",
      blurb:
        "Your stall ticket bundles the booth assignment, payment summary, and a QR code your operators will scan on the day. Once payment is confirmed, the ticket PDF is regenerated on demand from the backend.",
      sections: [
        {
          heading: "Download from the event page",
          body:
            "Verify your WhatsApp again on the event page → your stall status card now shows a Download Stall Ticket button. Save the PDF and bring it (printed or on your phone) to check-in.",
        },
        {
          heading: "What the ticket looks like",
          body:
            "Brand, booth assignments, paid amount, add-ons, and the scannable QR — everything the operator needs to verify you at the door.",
        },
      ],
      shots: ["stall-ticket-pdf"],
    },

    {
      title: "On the day",
      blurb:
        "Walk in with your QR ticket. The operator's scanner verifies your booth, your add-ons, and the number of operators you registered.",
      sections: [
        {
          heading: "What gets checked",
          body:
            "Booth number, exhibitor name, add-ons (chairs, power, signage), and operator count. Anything that doesn't match — extra people, missing add-ons — is flagged in real time on the organizer's dashboard.",
        },
        {
          heading: "Need help?",
          body:
            "Reach the organizer through the event page's WhatsApp link, or the EventSH team at help@eventsh.com.",
        },
      ],
      shots: [],
    },
  ],
};

// -------------------------------------------------------------------------
// PDF builder — same long-form layout as the organizer guide
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
  doc.fillColor("white").font("Helvetica-Bold").fontSize(36)
    .text(GUIDE.title, 56, 120, { width: doc.page.width - 112 });
  doc.fillColor("white").font("Helvetica").fontSize(16)
    .text(GUIDE.subtitle, 56, 175, { width: doc.page.width - 112 });
  doc.fillColor(INK).font("Helvetica").fontSize(11).text(GUIDE.edition, 56, 280);
  doc.fillColor(INK).font("Helvetica").fontSize(12)
    .text(
      "Everything an exhibitor needs to rent a stall on EventSH — from your first visit to the event page through to walking in with your QR ticket on the day.",
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

  // Page numbers (skip cover)
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
        // Minimal fallback — re-derive state by querying.
        await mongoose.connect(process.env.MONGO_URI);
        const org = await mongoose.connection.collection("organizers").findOne({ businessEmail: ORG_EMAIL });
        const ev = await mongoose.connection.collection("events").findOne({ organizer: org._id.toString(), title: EVENT_TITLE });
        const Vendor = mongoose.connection.collection("vendors");
        const fresh = await Vendor.findOne({ businessEmail: VENDOR_FRESH.businessEmail });
        const confirmed = await Vendor.findOne({ businessEmail: VENDOR_CONFIRMED.businessEmail });
        const paid = await Vendor.findOne({ businessEmail: VENDOR_PAID.businessEmail });
        await mongoose.disconnect();
        state = {
          org,
          eventId: ev._id.toString(),
          vendors: { fresh, confirmed, paid },
        };
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
