// Copy and content for the genz landing template. Kept beside the template
// (rather than in templates/shared/data.ts) because the voice and the section
// rhythm are this template's own — the default template's copy is unchanged.
import {
  BarChart3,
  Globe,
  Heart,
  QrCode,
  Store,
  Ticket,
  type LucideIcon,
} from "lucide-react";

export const sectionLinks = [
  { href: "#modules", label: "Features" },
  { href: "#screens", label: "See it" },
  { href: "#steps", label: "How it works" },
];

// The lime ticker under the hero. Rendered twice back-to-back so the
// translateX(-50%) loop meets itself seamlessly.
export const marqueeWords = [
  "expos",
  "weddings",
  "conferences",
  "concerts",
  "sangeets",
  "trade shows",
  "meetups",
  "engagements",
  "festivals",
  "workshops",
];

export const replaces = [
  "the WhatsApp group",
  "the guest-list spreadsheet",
  "the printed passes",
  "the floor-plan printout",
  "the RSVP phone calls",
  "the separate ticketing site",
];

export const pillars = [
  {
    k: "01",
    t: "Set it up",
    p: "One event, one page, live on a link you can post anywhere.",
  },
  {
    k: "02",
    t: "Sell & collect",
    p: "Tickets, stalls and RSVPs land in the same place.",
  },
  {
    k: "03",
    t: "Run the day",
    p: "Scan people in and watch the numbers move live.",
  },
];

export interface Module {
  icon: LucideIcon;
  color: string;
  tag: string;
  title: string;
  body: string;
  chips: string[];
}

export const modules: Module[] = [
  {
    icon: Ticket,
    color: "#c9ff3d",
    tag: "Money in",
    title: "Ticketing",
    body: "Tiers, early-bird pricing and coupons, without a third-party checkout taking a cut of your gate.",
    chips: ["Ticket types", "Early bird", "Coupons"],
  },
  {
    icon: Store,
    color: "#ff4d9d",
    tag: "Exhibitors",
    title: "Stalls & floor plan",
    body: "Vendors pick their own stall on a live drag-and-drop plan. Sold is sold — no double booking.",
    chips: ["Drag-and-drop plan", "Self-serve booking"],
  },
  {
    icon: QrCode,
    color: "#3de0ff",
    tag: "The door",
    title: "QR check-in",
    body: "Everyone gets a pass by email. Point a phone at it and they are in — no clipboard, no queue.",
    chips: ["Self-scan", "Room passes", "Live headcount"],
  },
  {
    icon: Heart,
    color: "#ff8a3d",
    tag: "Personal",
    title: "Weddings & RSVPs",
    body: "Per-function RSVPs, room allotment and an Our Story timeline, in a theme that does not look like software.",
    chips: ["Per-function RSVP", "Room allotment", "Themes"],
  },
  {
    icon: Globe,
    color: "#a97bff",
    tag: "Online",
    title: "Branded event page",
    body: "A real page for the event under your own brand — the thing you actually paste into the group chat.",
    chips: ["Your branding", "Any screen", "Shareable link"],
  },
  {
    icon: BarChart3,
    color: "#c9ff3d",
    tag: "Numbers",
    title: "Live analytics",
    body: "Tickets, stalls and revenue as they happen, across every event you are running at once.",
    chips: ["Revenue", "Attendance", "Excel export"],
  },
];

export const extras = [
  "Multi-role registration",
  "Speakers & sessions",
  "Sponsor applications",
  "Email invites",
  "Photo galleries",
  "Countdown & announcements",
  "Guest lists by side",
  "One dashboard, every event",
];

export const steps = [
  { n: "01", t: "Sign up", p: "Your name, your event. About two minutes." },
  { n: "02", t: "Build it", p: "Tickets or RSVPs, stalls, schedule, theme." },
  { n: "03", t: "Share the link", p: "Post it. People register themselves." },
  { n: "04", t: "Scan them in", p: "Open the door and watch the count climb." },
];
