// Copy and content for the "eventshub" landing template.
//
// The structure and the words come from the EventsHub marketing campaign
// (the 50s reel and the Instagram carousel): a problem section, a
// before/after, twelve numbered value cells, the money ledger, two worlds,
// a capability comparison, a five-step rollout and an FAQ. The paint is the
// genz palette — see hub.css.
//
// The brand stays "Eventsh", not the campaign's "EventsHub": the logo, the
// domain and every other page in this app say Eventsh, and the campaign's
// own handoff note calls that mismatch the most damaging thing on the page.
// One spelling wins, and it is the one on the domain.

export const BRAND = "Eventsh";
export const SITE = "eventsh.com";

export const sectionLinks = [
  { href: "#problem", label: "The problem" },
  { href: "#platform", label: "What it does" },
  { href: "#compare", label: "Compare" },
  { href: "#rollout", label: "Get started" },
  { href: "#faq", label: "FAQ" },
];

export const STATS = [
  { n: "1", t: "link that sells, registers, takes payment and checks in" },
  { n: "11", t: "event formats configured out of the box" },
  { n: "5", t: "audiences, each with their own form" },
  { n: "0", t: "add-ons to buy separately" },
];

export interface Pain {
  who: string;
  msg: string;
  cls?: "alert" | "file";
}

export const PAINS: Pain[] = [
  { who: "WhatsApp · 23:41", msg: "Bro — is stall A-12 confirmed or not??" },
  { who: "Downloads", msg: "final_FINAL_v9.xlsx", cls: "file" },
  {
    who: "Caterer · 22:15",
    msg: "Need the final headcount by 9am.",
    cls: "alert",
  },
  { who: "Note to self", msg: "Which vendors have actually paid?" },
  { who: "Mum", msg: "Aunt Meera says 6 more are coming 🙂" },
  { who: "Budget", msg: "We're over. By how much?", cls: "alert" },
];

export const BEFORE = [
  "Chase payments across chats and email",
  "Rebuild the guest list every week",
  "The stall map lives in someone's laptop",
  "Costs surface after the event",
  "Print the list, tick names at the gate",
  "Reconcile it all by hand, afterwards",
];

export const AFTER = [
  "Payment reconciles to the booking itself",
  "The list updates as people register",
  "The map is the page people buy from",
  "Costs post the moment a PO is raised",
  "Scan a QR, they're in",
  "Books close the next morning",
];

export interface Value {
  t: string;
  d: string;
  lead?: boolean;
}

export const VALUES: Value[] = [
  {
    t: "One platform. Every kind of event.",
    d: "Professional or personal — the same system runs a 3,000-person expo and a 300-guest wedding.",
    lead: true,
  },
  {
    t: "Your domain. Not ours.",
    d: "events.yourbrand.com, fully branded, with no Eventsh badge anywhere on the page.",
  },
  {
    t: "Every event gets its own link.",
    d: "One URL that sells, registers, takes payment and checks people in. Share it and stop explaining.",
  },
  {
    t: "Eleven formats, zero rebuilds.",
    d: "Expo, conference, workshop, wedding, award night, job fair, reunion — pick one and it is already configured.",
  },
  {
    t: "Everyone registers. On their own terms.",
    d: "Exhibitors, visitors, delegates, speakers and sponsors — each with their own form, free or paid.",
  },
  {
    t: "Money in, before they arrive.",
    d: "Dynamic QR, bank transfer, cards and local wallets, in whatever currency you sell in.",
  },
  {
    t: "Your form. Your rules. Your flow.",
    d: "Every field, step, approval and discount is yours to set — per role, per event.",
  },
  {
    t: "Design the floor before you book it.",
    d: "Halls, aisles, stages, stalls and round tables. Multiple layouts per venue, saved and reusable.",
  },
  {
    t: "A floor plan that sells itself.",
    d: "Click a stall, see the price, add power and Wi-Fi, pay. Sold space greys out for everyone else instantly.",
  },
  {
    t: "Every step, on a timeline.",
    d: "From first announcement to final settlement — each stage dated, owned and visible to the people who need it.",
  },
  {
    t: "Suppliers in the same system.",
    d: "Caterers, fabricators, decorators and AV — quotes, purchase orders and payment status, not a WhatsApp thread.",
  },
  {
    t: "Know your profit before the last guest leaves.",
    d: "Income, expenses and tax-ready invoices in one ledger, live as the event runs.",
  },
];

export const LEDGER = [
  { l: "Stall bookings · 14", v: "+ $53,200", c: "p" as const },
  { l: "Delegate passes · 412", v: "+ $74,160", c: "p" as const },
  { l: "Sponsorships", v: "+ $30,000", c: "p" as const },
  { l: "Venue, catering, build", v: "− $84,900", c: "n" as const },
];

export const PAY_METHODS = [
  "Dynamic QR",
  "Bank transfer",
  "Cards",
  "Local wallets",
];

export const PRO_FORMATS = [
  "Expo",
  "Trade show",
  "Conference",
  "Workshop",
  "Award night",
  "Job fair",
  "Sports meet",
  "Concert",
];

export const PERSONAL_FORMATS = [
  "Wedding",
  "Reception",
  "Engagement",
  "Birthday",
  "Anniversary",
  "Reunion",
  "Family function",
];

export const STEPS = [
  { h: "Pick a format", p: "Eleven ready to go — expo to wedding", t: "2 min" },
  {
    h: "Point your domain",
    p: "events.yourbrand.com, no our-name badge",
    t: "10 min",
  },
  {
    h: "Draw and price the floor",
    p: "Drag a layout, set the tiers",
    t: "25 min",
  },
  {
    h: "Open registration",
    p: "Five forms, free or paid, your fields",
    t: "15 min",
  },
  {
    h: "Share the link",
    p: "It sells, registers, charges and checks in",
    t: "now",
  },
];

export type CmpValue = "yes" | "no" | "part";

export const CMP: [string, CmpValue][] = [
  ["Sell tickets and passes", "yes"],
  ["Your own domain, unbranded", "no"],
  ["A permanent link per event", "part"],
  ["Venue layout designer", "no"],
  ["Clickable floor plan with prices", "no"],
  ["Stall add-ons priced into checkout", "no"],
  ["A separate form per audience", "no"],
  ["Custom fields, approvals and caps", "part"],
  ["Supplier quotes and purchase orders", "no"],
  ["Event timeline with owners", "no"],
  ["Income, expense and invoicing", "no"],
  ["Live net position", "no"],
  ["Weddings and personal events", "no"],
];

export const CMP_TXT: Record<CmpValue, string> = {
  yes: "Yes",
  no: "—",
  part: "Partial",
};

export const FAQS = [
  {
    q: "Can I use my own domain?",
    a: "Yes. Point your domain at Eventsh and every event page runs on it — events.yourbrand.com/summit-2027. Your colours, your logo, your copy. Our name appears nowhere on the page.",
  },
  {
    q: "Do vendors, visitors and delegates need an account?",
    a: "No. Each role gets its own registration link and its own form. Exhibitors book stalls, delegates buy passes, visitors register free, speakers apply — none of them create an Eventsh login.",
  },
  {
    q: "How do people pay?",
    a: "Dynamic QR, bank transfer, cards and local wallets, in the currencies you sell in. Every payment reconciles to the booking that created it and posts straight to your event ledger.",
  },
  {
    q: "Can I change the registration flow?",
    a: "Every field, step and approval is yours to set — per role, per event. Add a document upload for exhibitors, an approval gate for speakers, a capacity cap for a workshop.",
  },
  {
    q: "Does it really handle income and expenses?",
    a: "Yes. Stall revenue, pass sales and sponsorships sit against venue, catering, fabrication and AV costs in one sheet, with tax-ready invoices raised automatically and reversed on cancellation.",
  },
  {
    q: "Does it work for weddings as well as expos?",
    a: "It is built for both. Personal events get RSVP links, room allotment, round-table seating, ceremony timelines and shared galleries, on the same budget tracking underneath.",
  },
  {
    q: "What does it cost?",
    a: "There is a free tier to get your first events live, and paid plans priced per organiser in your currency. Paid registrations carry a platform fee on the transaction; free registrations are always free.",
  },
];

/* ---------------- the hero's floor-plan model ---------------- */

export interface Cell {
  id: string;
  tier?: "A" | "B" | "C";
  price?: number;
  zone?: boolean;
  stage?: boolean;
  label?: string;
  c: number;
  r: number;
  w: number;
  h: number;
}

export const FLOOR: Cell[] = [
  {
    id: "stage",
    zone: true,
    stage: true,
    label: "Main stage",
    c: 1,
    r: 1,
    w: 12,
    h: 1,
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `A-0${i + 1}`,
    tier: "A" as const,
    price: 3200,
    c: 1 + i * 2,
    r: 2,
    w: 2,
    h: 1,
  })),
  { id: "aisle", zone: true, label: "Aisle", c: 1, r: 3, w: 12, h: 1 },
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `B-0${i + 1}`,
    tier: "B" as const,
    price: 4800,
    c: 1 + i * 3,
    r: 4,
    w: 3,
    h: 1,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `C-0${i + 1}`,
    tier: "C" as const,
    price: 2200,
    c: 1 + i * 2,
    r: 5,
    w: 2,
    h: 1,
  })),
  { id: "fnb", zone: true, label: "F&B", c: 9, r: 5, w: 4, h: 1 },
  {
    id: "entry",
    zone: true,
    label: "Entry · registration",
    c: 1,
    r: 6,
    w: 12,
    h: 1,
  },
];

export const SELLABLE = FLOOR.filter((c) => !c.zone);

export const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
