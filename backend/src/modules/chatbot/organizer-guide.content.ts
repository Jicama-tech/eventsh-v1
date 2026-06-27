/**
 * Organizer Guide — the single source of truth for the chatbot "Guide" pill.
 *
 * Each topic's `markdown` is rendered two ways from this one definition:
 *   1. inline in the chat bubble (the chatbot streams the intro + topic list), and
 *   2. as a downloadable PDF (see guide-pdf.util.ts), per-topic or the full guide.
 *
 * Keep the markdown to the small subset our renderer supports: `#`/`##`/`###`
 * headings, `**bold**`, `` `code` ``, `- ` bullets, `1.` numbered lists, `---`
 * rules, blockquotes, nested lists, and blank-line-separated paragraphs.
 */

export interface GuideTopic {
  slug: string;
  title: string;
  /** One-line description shown next to the download button in chat. */
  summary: string;
  markdown: string;
}

export const GUIDE_INTRO =
  "Here's the complete organizer guide — a full tour of everything the " +
  "platform can do, from setting up an event to selling tickets, stalls, " +
  "round tables and speaker passes, running memberships and pricing, and " +
  "reading your analytics. It also includes detailed booking guides written " +
  "for your visitors, vendors and speakers, so you can follow (or share) " +
  "exactly how they book. Read a topic below, or download any of them (or the " +
  "whole thing) as a detailed PDF.";

export const ORGANIZER_GUIDE_TOPICS: GuideTopic[] = [
  {
    slug: "getting-started",
    title: "Getting Started & Platform Overview",
    summary: "The full feature map, core concepts, and how to run an event end to end.",
    markdown: `# Getting Started & Platform Overview

Welcome to Eventsh — an all-in-one event platform. This guide is a complete tour: read it once to see everything the product can do, then keep it as a reference. There's a lot here, which is exactly the point — almost anything you need to run a professional event is built in.

## Everything the platform can do (at a glance)

This is the breadth you're working with. Each item is covered in detail in its own topic:

- **Events** — unlimited events, each with its own public page (EventFront), branding, media gallery, video reels, announcement bar, custom sections and per-section visibility.
- **Tickets** — multiple ticket/visitor types, tiered pricing, capacities, coupons/discounts, tax & currency by country, online checkout, QR tickets by email + WhatsApp, walk-in/kiosk sales, and door scanning.
- **Stalls** — sellable space templates, add-ons, deposits, member pricing, an application-and-approval workflow, visual table selection on a floor plan, linked vendor accounts, and QR stall tickets.
- **Round tables** — banquet/gala seating with per-chair or whole-table booking, per-guest tickets, and organizer payment confirmation.
- **Speakers** — speaker slot templates, an application flow with photo/bio/expertise, approval, self-service time-slot scheduling, optional paid slots, and QR speaker passes.
- **Memberships & pricing** — exhibitor memberships with member pricing and receipts, your own subscription plan, prorated co-terminus add-ons, and platform-fee payments with receipts.
- **Venue designer** — drag-and-drop floor plans with stalls, round tables, speaker zones, doors and annotations, shareable with your team and exhibitors.
- **Analytics** — live revenue by day/week/month/year, top events, capacity usage, pending approvals, participant lists and participation reports.
- **Team & operations** — operators with per-tab access control, event volunteers for door duty, bulk import/export of visitors and exhibitors.
- **Storefront** — a public page listing all your published events under your brand.
- **The chatbot** — an assistant (that's me) that pulls analytics, opens forms, lists data, takes walk-in bookings, processes platform fees and generates this guide.
- **Notifications** — automated email and WhatsApp delivery of tickets, passes, receipts and status updates, optionally from your own sender address.

## The three pillars

Everything hangs off three things:

1. **Your organization** — your brand: name, logo, description, contact details, country/currency, subscription plan, and a public **storefront**.
2. **Your events** — each event is self-contained, with its own tickets, stalls, speakers, round tables, venue layout, terms, branding and **EventFront** (public page).
3. **Your people** — **visitors** buy tickets and round-table seats, **exhibitors/vendors** rent stalls, and **speakers** apply to present. Each has its own flow and its own records.

## Glossary

- **EventFront** — a single event's public page (where people buy and book).
- **Storefront** — your organization's public page listing all published events.
- **Ticket / visitor type** — a category of ticket with its own price and capacity.
- **Space template** — a type of stall/table you sell to vendors.
- **Speaker slot template** — a type of speaking session you offer.
- **Round-table template** — a category of banquet table/seat you sell.
- **Add-on** — an optional paid extra (power, furniture, signage…).
- **Operator** — a team member with access limited to specific tabs.
- **Volunteer** — a Google-signed-in helper for a specific event (e.g. scanning).
- **Member** — an exhibitor enrolled in one of your memberships, who gets member pricing.

## Your first 15 minutes

1. Open **Settings** and complete your **organization profile** — name, logo, description, contact details, and especially your **country/currency** (this drives tax and price formatting everywhere).
2. Create your **first event** (see "Setting Up an Event").
3. Add at least one **ticket type** so visitors can buy.
4. If you host exhibitors, add a **space template** marked "for sale".
5. **Publish** the event to make its EventFront live.
6. Open **My Events**, copy the EventFront link, and share it.

## The event lifecycle

1. **Set up** — create the event; add tickets, stalls, speakers and round tables; design the venue; write your terms.
2. **Publish & promote** — flip the publish switch; share your EventFront and storefront links.
3. **Sell** — visitors buy tickets and seats; vendors submit stall requests; speakers apply.
4. **Operate** — approve requests, take walk-ins, scan QR codes at the door.
5. **Review** — read analytics, export participant lists, reconcile payments.

## Working with the chatbot

The chatbot is the fastest way to get things done:

- **Analytics** — "show today's revenue", "top events this month".
- **Open forms** — "create a new event", "book a walk-in ticket".
- **List data** — "show my events", "show participants for <event>", "pending stall requests".
- **This guide** — tap a **Guide** pill or ask "how do I manage an event", then download any topic as a PDF.

> Tip: the suggestion pills under the chat input are shortcuts to the most common tasks. Start there when you're not sure what to ask.

## Features at a glance

- One platform for tickets, stalls, round tables and speakers.
- QR-based entry for every product type, delivered by email + WhatsApp.
- Country-aware tax, currency and payment (UPI / PayNow / static QR).
- Team access control, volunteers, bulk import/export.
- A built-in assistant and downloadable guides.`,
  },
  {
    slug: "create-event",
    title: "Setting Up an Event",
    summary: "Create an event end to end: details, media, what you sell, venue, terms, publishing.",
    markdown: `# Setting Up an Event

This is the most important workflow on the platform, and one of the most capable — a single event can carry tickets, stalls, round tables, speakers, a designed venue, custom content and its own branding. You can always come back and edit; nothing is permanent.

## Step 1 — Create the event

1. Go to **My Events → Create Event** (or ask the chatbot to "create a new event").
2. Enter the **basics**:
   - **Title** — clear and specific; the headline on the public page.
   - **Description** — your main selling copy: what it is, who it's for, what attendees get.
   - **Category** — helps attendees find the event and groups it on your storefront.
   - **Start and end date & time** — leave end blank to default to the start date.
3. Set the **location** — a physical address, or an online link for virtual events.

## Step 2 — Add media

- **Banner image** — the hero image at the top of the EventFront. Use a high-quality, wide image; it's the first thing visitors see.
- **Gallery images** — up to **5** showcase images. You can add more later: editing the event and uploading additional images **adds to the gallery, not replaces it**, so existing images are kept.
- **Instagram reels** — add reel links to bring a video carousel onto the page.

> Best practice: design your banner for landscape display and keep key content away from the edges, which may be cropped on small screens.

## Step 3 — Configure what you'll sell

This is where the platform's breadth shows. Set up any combination of these — each has its own dedicated topic:

- **Ticket types** — visitor types with prices and capacities. See "Selling Tickets".
- **Stalls / space templates** — the stall types vendors rent, marked for sale, with prices, add-ons and deposits. See "Stalls & Vendor Booking".
- **Round-table seating** — banquet tables and seats. See "Settings & Venue Designer" to lay them out and "Reserving Round-Table Seats" for the buyer flow.
- **Speakers** — speaker slot templates so speakers can apply. See "Speakers".
- **Coupons / discounts** — promo codes that reduce checkout totals.

## Step 4 — Design the venue (optional but powerful)

If your event has a physical floor plan, use the **venue designer** to lay out stalls and tables, round tables, speaker zones, entrance/exit doors, and text annotations. A designed layout lets vendors and visitors **pick their exact spot** and gives attendees a map. See "Settings, Team & Venue Designer".

## Step 5 — Terms, sections and visibility

- **Terms & conditions for stalls** — add terms vendors must accept; mark individual terms **mandatory** so they can't submit without ticking them.
- **Custom sections** — add your own Basic-Info sections to the EventFront for anything the standard fields don't cover.
- **Section visibility** — show or hide individual sections (gallery, speakers, stalls, round tables…) so the page shows only what's relevant.
- **Announcement / ad bar** — an optional banner strip for promotions or urgent notices.

## Step 6 — Publish & share

1. Review every section.
2. Toggle **Publish** — on the event card in My Events, or via the form's publish switch.
3. The **EventFront** is now live. Use **My Events → Copy link** to grab the public URL.
4. Your event also appears on your **storefront**, the public page listing all your published events.

## Editing, duplicating and unpublishing

- **Edit** any event anytime from **My Events → Edit**; changes apply on submit and the public page updates immediately.
- **Reuse** a well-structured event as a template for your next one to save setup time.
- **Unpublish** to hide the EventFront without deleting the event or any data — handy while you make larger changes.

## Common questions

- **Why isn't my event public?** Confirm it's **published** and the relevant **sections are visible**.
- **My new gallery images replaced the old ones.** That bug is fixed — uploads now merge with the existing gallery.
- **Can one event do tickets AND stalls AND speakers?** Yes — all modules are independent and can run together on the same event.

## Features at a glance

- Rich media: banner, 5-image gallery (additive), Instagram reels, ad bar.
- Sell tickets, stalls, round tables and speaker slots from one event.
- Custom sections + per-section visibility for a tailored public page.
- Mandatory stall terms, coupons, and a full venue designer.
- Publish/unpublish, copy-link sharing and an auto-built storefront.`,
  },
  {
    slug: "tickets",
    title: "Selling Tickets",
    summary: "Ticket types, tiered pricing, coupons, the buyer flow, walk-ins, scanning and payments.",
    markdown: `# Selling Tickets

Tickets are how visitors register and pay to attend — and the ticketing engine is full-featured: multiple tiers, coupons, country-aware payments, QR delivery, walk-in sales and door scanning.

## Step 1 — Set up ticket types

1. In the event editor, open the **Tickets / Visitor Types** section.
2. Add a ticket type with:
   - **Name** — e.g. Delegate, Student, VIP, Early Bird.
   - **Price** — in your organization's currency.
   - **Capacity** — the maximum available for that type.
3. Add as many types as you need — each has its own independent price and capacity, so you can run **tiered pricing**.
4. Save and publish.

> **Individual vs Organizer accounts:** Individual-tier accounts can't accept payment, so every visitor-type price is forced to 0. To charge for tickets, use an Organizer account. See "Memberships, Plans & Platform Fees".

### Pricing strategy

- Use **Early Bird** tiers (lower price, small capacity) to drive early sales.
- Keep names short — they appear on the page and on the ticket.
- The system stops sales for a type once its capacity is reached.
- Issue **coupon codes** for discounts; buyers apply them at checkout.

## Step 2 — The buyer flow

Here's what a visitor experiences (full detail in "For Visitors: Booking a Ticket"):

1. They open your **EventFront**, choose a ticket type and quantity, and tap **Buy Tickets**.
2. In the cart they verify their **email** and **WhatsApp**, enter their name (or sign in with **Google**), and optionally apply a **coupon**.
3. They pay via a **QR code** — UPI in India, PayNow in Singapore, or a static QR fallback.
4. On success they receive a **ticket PDF with a QR code** by **email and WhatsApp**, and can download it on the spot.

Each booking immediately feeds your sales and revenue numbers, with **tax and currency** handled automatically from your country setting.

## Step 3 — Walk-in / kiosk bookings

For sales at the door or a registration desk:

1. Ask the chatbot to **"book a walk-in ticket"** — an inline booking form opens right in the chat.
2. Pick the **event**, the **ticket type**, and enter the buyer's details.
3. Submit — the ticket is issued instantly, QR code and all, exactly like an online purchase.

This is the fastest path for on-site staff and avoids sending people to their phones.

## Step 4 — Scan tickets at the door

1. Open **Events → Scan Tickets** for the event.
2. Scan each attendee's QR code.
3. The system marks the ticket **used** so it can't be reused, and shows the holder's details.

Add **volunteers** specifically for scanning duty — see "Settings, Team & Venue Designer".

## Step 5 — Manage tickets after the sale

- **Resend a ticket** — if a buyer lost their email, find the booking and resend the PDF.
- **Pending / unpaid payments** — ask the chatbot to list them so you can follow up.
- **Recent sales & revenue** — ask for "today's", "this week's", "this month's" or "this year's" figures.
- **Participant lists** — "show participants for <event>" lists attendees, their ticket type, and check-in status.
- **Exports** — export your visitor list for offline use or mail-merges.

## Troubleshooting

- **No ticket email received** — confirm the address, then resend; check your custom sender email in Settings.
- **Prices show as 0** — your account may be Individual-tier; upgrade to charge.
- **A ticket type isn't selectable** — it's at capacity; raise the capacity or add a new type.

## Features at a glance

- Unlimited tiered ticket types with independent price + capacity.
- Coupons/discounts, automatic tax and currency by country.
- QR tickets delivered by email **and** WhatsApp, plus PDF download.
- Walk-in/kiosk sales from the chatbot; door scanning marks tickets used.
- Resend, pending-payment tracking, participant lists and exports.`,
  },
  {
    slug: "stalls",
    title: "Stalls & Vendor Booking",
    summary: "Space templates, add-ons, member pricing, the vendor workflow, approvals and CRM.",
    markdown: `# Stalls & Vendor Booking

Stalls let exhibitors and vendors rent space — and this is one of the deepest modules: sellable templates, add-ons, deposits, member pricing, a full application-and-approval workflow, visual table selection, linked vendor accounts, and an exhibitor CRM.

## Step 1 — Offer stalls

1. In the event editor, define **space templates** — the stall/table types you offer (Standard Booth, Premium Corner, Food Stall…).
2. Mark which are **for sale** — only sellable templates appear to vendors.
3. Set the **price** per template, plus:
   - **Add-ons** — optional extras (power, furniture, signage) with their own prices,
   - **Deposits** — an upfront or refundable amount,
   - **Member pricing** — a discounted price shown to members (see "Memberships").
4. Optionally lay out the floor in the **venue designer** so vendors pick an exact spot.

## Step 2 — Add your terms

- Add **terms & conditions for stalls** that vendors must read.
- Mark critical terms **mandatory** — vendors can't submit without accepting them.

## Step 3 — The vendor flow (what the exhibitor sees)

Full detail in "For Vendors: Renting a Stall". In short:

1. A vendor opens your **EventFront** and clicks **Rent a Stall**.
2. They verify via **Google** (or WhatsApp).
3. The system looks up their email and routes them: a fresh registration, continue with one profile, or **pick among multiple linked profiles**.
4. They complete the request: business details, **preferred space type(s)** (more than one allowed as a combination), table selection on the layout, add-ons, and mandatory terms.
5. They submit, and it lands in your dashboard as **Pending**.

### Linked vendor accounts

One vendor email can own **multiple vendor profiles** — great for someone running several brands. When a vendor with a completed booking starts another request, they choose **who it's for**:

- **Register for yourself** — book again under the same profile.
- **Register for a new vendor** — create a separate linked account under the same email. From then on that email sees a "choose a profile" picker at every event.

## Step 4 — Approve and fulfil

1. Review **pending stall requests** (ask the chatbot, or use the Stalls tab).
2. **Approve** the ones you want — the vendor is then prompted to **select tables/add-ons**.
3. The vendor **pays** (UPI / PayNow / static QR). Once paid, the booking is **Completed**.
4. A **stall ticket PDF with a QR code** is generated and sent to the vendor.

### Request statuses

- **Pending** — submitted, awaiting your approval.
- **Approved / Confirmed** — approved; the vendor selects space.
- **Processing** — space selected, awaiting payment.
- **Completed** — paid and finalised.
- **Cancelled** — withdrawn or rejected.

A **Cancelled** or **Completed** request never blocks a fresh one, so repeat exhibitors can re-book freely.

## Step 5 — Your exhibitor CRM

- List **approved** stalls, **pending** requests, or all exhibitors.
- **Export** your exhibitor list, or **bulk-import** exhibitors from a template.
- Every exhibitor is stamped with your organization, so they appear in your CRM/exports even if they registered through a single event.
- Vendors receive **WhatsApp/email** updates at each step (approval, payment, ticket).

## Best practices

- Keep space templates few and clear — too many options slows vendors down.
- Use **member pricing** to reward exhibitors who buy a membership.
- Design the venue **before** opening stall sales so vendors pick spots and you avoid double-booking.

## Troubleshooting

- **Vendor sees no stalls** — ensure at least one template is **for sale** and the Stalls section is visible.
- **Vendor stuck after approval** — they must select tables/add-ons and pay; it stays in Processing until payment completes.
- **Duplicate vendor profiles** — by design (linked accounts); the vendor picks the right one at sign-in.

## Features at a glance

- Sellable space templates with add-ons, deposits and member pricing.
- Visual table selection on a designed floor plan.
- Application → approval → space selection → payment → QR stall ticket.
- Linked vendor accounts and multi-preference space types.
- Exhibitor CRM with bulk import/export and automated notifications.`,
  },
  {
    slug: "speakers",
    title: "Speakers",
    summary: "Speaker slots, applications & invites, approvals, self-scheduling, passes and analytics.",
    markdown: `# Speakers

If your event has talks, panels or sessions, the speakers module runs the whole pipeline: define opportunities, collect applications, approve, let speakers schedule themselves, optionally charge for slots, and issue QR speaker passes.

## Step 1 — Define speaking opportunities

1. In the event editor, create **speaker slot templates** describing the sessions you offer:
   - **Session type** — keynote, talk, panel, workshop,
   - **Duration**,
   - **Zone / stage** — if you run multiple stages.
2. Optionally place **speaker zones** on the venue layout so attendees know where each session happens.
3. Publish so the speaker section appears on your EventFront.

## Step 2 — Collect speakers

- **Inbound (applications)** — speakers open your EventFront and apply with their **photo, bio, expertise, experience, social links and session topic** (full flow in "For Speakers: Applying to Speak").
- **Outbound (invitations)** — add or invite speakers directly when you already know who you want.

## Step 3 — Approve and schedule

1. Review **pending speaker requests** (ask the chatbot, or use the Speakers tab).
2. **Approve** the speakers you want.
3. Approved speakers **schedule their own session** — they pick a topic, description and a start/end time, with already-booked slots shown so they avoid clashes.
4. If a slot is **paid**, the speaker pays (UPI / PayNow / static QR); if **free**, they simply confirm.

## Step 4 — Passes and the agenda

- Confirmed speakers receive a **speaker pass PDF with a QR code** by WhatsApp, downloadable too.
- Approved speakers appear on the public **agenda**, mapped to their zones if placed on the venue layout.
- Track **speaker analytics** — total requests, status breakdown, and slot coverage.

## Best practices

- Keep slot templates realistic so the agenda doesn't overflow your schedule.
- Use clear, public-facing session names — they show on the agenda.
- Revisit pending requests regularly so applicants aren't left waiting.

## Common questions

- **Can speakers also be exhibitors or attendees?** Yes — modules are independent; the same person can hold a stall, a ticket and a speaking slot.
- **Do I have to charge speakers?** No — slots can be free (confirm only) or paid.
- **How do attendees see the lineup?** Approved speakers appear in the EventFront speaker section and agenda.

## Features at a glance

- Speaker slot templates with types, durations and stage zones.
- Inbound applications (rich profile) and outbound invitations.
- Self-service time-slot scheduling with clash avoidance.
- Free or paid slots, with QR speaker passes by WhatsApp + PDF.
- Speaker analytics and a public agenda.`,
  },
  {
    slug: "memberships-pricing",
    title: "Memberships, Plans & Platform Fees",
    summary: "Exhibitor memberships, member pricing, your subscription, prorated add-ons and fees.",
    markdown: `# Memberships, Plans & Platform Fees

Three money systems live here: **memberships** you sell to exhibitors, **your own subscription plan** and add-ons, and **platform fees**. They're separate — read each part for what it does.

## Part 1 — Exhibitor memberships

Memberships reward loyal exhibitors with discounted pricing.

- A membership is **scoped to your organization** and has a **plan name**, a **colour**, and **validity dates** (start and end).
- Members are shown a **member price** alongside the regular price on the EventFront — for **stalls and add-ons**.
- On enrolment, a member receives a **membership receipt PDF**.
- Member status follows the exhibitor across your events, so once they're a member they get member pricing everywhere you offer it.

### Setting up member pricing

1. Create the membership plan(s) you want to offer.
2. On each **space template** and **add-on**, set the **member price** alongside the regular price.
3. On the EventFront, members see both prices clearly, with the member price highlighted.

> Tip: price the membership so it pays for itself across two or three stalls — a strong incentive for repeat exhibitors.

## Part 2 — Your subscription plan

Your organization runs on a **plan**:

- It has a **start date** and an **expiry date** — watch the expiry so your account doesn't lapse mid-event.
- Higher plans unlock more capacity and features.
- Ask the chatbot **"show my subscription"** for your current plan and expiry, or **"show all plans"** to compare.

### Plan add-ons (prorated)

- Buy **add-on modules** on top of your base plan.
- Add-ons are **co-terminus** — billed **prorated** so they always expire on the same day as your main plan.
- This keeps billing aligned to a single renewal date instead of many staggered ones.

## Part 3 — Platform fees

Some platform activity accrues **platform fees**.

1. Ask the chatbot to **"pay platform fees"** — an inline payment widget opens right in the chat.
2. Complete the payment.
3. A **receipt** is generated for your records.

> Operators need the **settings** permission to pay platform fees; without it they get a friendly refusal. See "Settings, Team & Venue Designer".

## Common questions

- **Do members pay less automatically?** Yes — once their membership is active and you've set member prices, the discount shows on the EventFront with no extra steps.
- **What happens when my plan expires?** Renew before the expiry date to avoid interruption. Check "show my subscription" for the exact date.
- **Where are my receipts?** Membership, subscription and platform-fee payments each generate a receipt — keep the PDFs for accounting.

## Features at a glance

- Exhibitor memberships with colours, validity dates and member pricing.
- Member pricing on stalls and add-ons, with membership receipts.
- Subscription plans with prorated, co-terminus add-on modules.
- In-chat platform-fee payments with receipts.
- Operator-gated access to financial actions.`,
  },
  {
    slug: "analytics-participants",
    title: "Analytics, Participants & Walk-ins",
    summary: "Live revenue, top events, capacity, approvals, attendee lists, reports and exports.",
    markdown: `# Analytics, Participants & Walk-ins

Once your event is live, this is your command centre. The fastest way to any number is to ask the chatbot in plain language — it pulls everything live from your data.

## Read your numbers

Ask for any of these:

- **Revenue** — "show today's revenue", or this **week**, **month**, or **year**.
- **Ticket sales** — counts alongside revenue for any period.
- **Top events** — which events sell best.
- **Capacity used** — how full each event is.
- **Pending approvals** — outstanding stall and speaker requests needing your attention.

> Tip: start your day with "how am I doing?" or "show this week's stats" for a quick pulse on sales and approvals.

## Participants & attendees

- **My events** returns rich cards per event — **sold counts, revenue, ticket types, capacity** and quick links (edit, open, store, copy link).
- **"Show participants for <event>"** lists every attendee with their **ticket type** and **check-in status** (used / not used).
- Use these lists to plan catering, seating, badges and door staffing.

## Participation reports

Ask for a participation report on a specific event to get a structured breakdown across its sections (tickets, stalls, speakers, attendees) in one go — ideal for a post-event summary.

## Walk-ins

Issue on-site tickets instantly with **"book a walk-in"** (see "Selling Tickets"). Walk-ins count toward live revenue and participant numbers just like online sales.

## Exports & bulk import

- **Export** your **visitor** and **exhibitor** lists for offline use, mail-merges, or your records.
- Use **bulk-import templates** to add many visitors or exhibitors at once.

## Reconciliation & follow-up

- Clear **pending payments** before the event so you're not chasing money on the day.
- Pull a **participant list** the night before and share it with door staff.
- After the event, **export** everything and review which ticket types and events performed best.

## Features at a glance

- Live revenue by day/week/month/year and top-events ranking.
- Capacity tracking and a single view of pending approvals.
- Rich per-event cards and full participant lists with check-in status.
- One-shot participation reports across all sections.
- Visitor/exhibitor exports and bulk-import templates.`,
  },
  {
    slug: "settings-team",
    title: "Settings, Team & Venue Designer",
    summary: "Branding, currency, sender email, operators, volunteers and the floor-plan designer.",
    markdown: `# Settings, Team & Venue Designer

This is the configuration that applies across all your events: your brand and account settings, the team you bring on, and the venue designer for floor plans.

## Organization settings

Your settings shape how your storefront, EventFronts and emails look and behave.

- **Name, logo and description** — appear on your storefront and on emails to attendees. Keep them polished; this is your brand.
- **Contact details** — phone, email, address and social links.
- **Country / currency** — important: drives **tax** and how **prices are formatted** everywhere. Set it correctly before you start selling.
- **Custom sender email** — optionally send attendee emails from **your own address** instead of the platform default, so messages come from you. If unset, it falls back to the default.

## Operators (your team)

Operators are team members you invite, with **scoped access**.

- Each operator is granted access to only **specific tabs** — e.g. tickets and attendees but not settings or finances.
- When an operator signs in, their dashboard and chatbot are **limited to their permissions**; out-of-scope actions are politely refused.
- Delegate day-to-day work without handing over full control.

> Example: give front-desk staff access to tickets and scanning, but not to settings or platform fees.

## Volunteers

- Add **volunteers** (who sign in with **Google**) for a specific event — typically **door duty and ticket scanning**.
- Volunteers get just enough access to do their job at that event, nothing more.

## Venue designer

The venue designer turns a blank floor into an interactive map. Place and arrange:

- **Stalls and tables** (mapped to your space templates),
- **Round tables** (for banquet seating),
- **Speaker zones**,
- **Entrance and exit doors**,
- **Text annotations** and labels.

Why it's worth it:

- Vendors **pick their exact spot** when booking a stall — no double-booking.
- Visitors get a clear **map**, and can **reserve specific seats** at round tables.
- You can **share** the layout with your team and exhibitors.

## Account housekeeping

- Keep your **subscription plan** active — watch the expiry (ask "show my subscription").
- Review your **branding** before each major event so the public page and emails look right.
- Double-check **country/currency** if prices or tax ever look wrong.

## Common questions

- **Can I limit what a team member sees?** Yes — that's exactly what operator access tabs are for.
- **Why are my prices showing the wrong symbol?** Your country/currency setting is off; fix it in Settings.
- **Do volunteers need a full account?** No — they sign in with Google and get scoped access to the event they're helping with.

## Features at a glance

- Full branding: name, logo, description, contacts and socials.
- Country-aware tax/currency and an optional custom sender email.
- Operators with per-tab access control; event volunteers for door duty.
- Drag-and-drop venue designer: stalls, round tables, zones, doors, labels.
- Shareable layouts that power stall and round-table selection.`,
  },
  {
    slug: "book-tickets",
    title: "For Visitors: Booking a Ticket",
    summary: "The visitor's step-by-step flow to buy a ticket and receive their QR pass.",
    markdown: `# For Visitors: Booking a Ticket

This describes exactly what a **visitor** does to buy a ticket from your event's public page (the EventFront). Share it with attendees, or read it so you can support them.

## Before you start

You'll need a working **email** and a **WhatsApp number** — your ticket QR is delivered to both, and you can download a PDF copy too.

## Step 1 — Choose your ticket

1. Open the event's **EventFront** link.
2. Scroll to the **Ticket Types** section.
3. Pick a **ticket type** (e.g. Delegate, Student) — if there's only one, it's already selected.
4. Set the **quantity** with the + / − controls. You can see the price per ticket and how many remain.
5. Click **Buy Tickets**.

## Step 2 — Enter your details (the cart)

1. **Verify your email** — enter it and tap Verify. If you've booked before, your name is filled in automatically.
2. Enter your **WhatsApp number** (country code + number).
3. Enter your **first and last name** if not already filled.
   - **Shortcut:** use **Sign in with Google** to fill your email, name and number in one step.
4. Optionally enter a **coupon code** for a discount.
5. Click **Proceed to Payment**.

## Step 3 — Pay

1. The payment page shows your order summary (subtotal, tax, any discount, total).
2. A **payment QR code** is displayed:
   - In **India**, scan it with any UPI app (Google Pay, PhonePe, Paytm…).
   - In **Singapore**, scan it with **PayNow**.
   - You can also tap the pay button if shown.
3. Complete the payment in your banking/payment app.
4. Back on the page, click **I Have Completed Payment**.

## Step 4 — Get your ticket

- Your ticket is generated instantly with a **secure QR code**.
- It's sent to your **email and WhatsApp**, and you can **download the ticket PDF** right there.
- Keep the QR handy — it's your entry pass.

## At the event

Show your **QR code** (on your phone or the printed PDF) at the door. Staff scan it once to admit you; it can't be reused.

## Troubleshooting

- **Didn't get the email/WhatsApp?** Re-check the address/number you entered; you can re-download the PDF from the confirmation page.
- **Payment didn't go through?** Don't tap "completed" until your app confirms; if it failed, retry the QR.
- **A ticket type is greyed out?** It's sold out — pick another type.`,
  },
  {
    slug: "book-stall",
    title: "For Vendors: Renting a Stall",
    summary: "The vendor's step-by-step flow to request, get approved, pay and receive a stall ticket.",
    markdown: `# For Vendors: Renting a Stall

This is the **vendor/exhibitor** journey to book a stall from the EventFront. It has more steps than a ticket because the organizer approves the request before payment.

## Before you start

Have your **business details** ready (name, category, tax/registration number, address) and any required **documents/images**. You sign in with **Google**.

## Step 1 — Start the request

1. On the EventFront, find the **Book a Stall** card.
2. Click **Rent a Stall / Preview Request**.
3. In the dialog, click **Continue with Google** and choose your account.

## Step 2 — Pick your vendor profile

The system looks up your email and one of these happens:

- **New to this organizer** → you fill in a fresh vendor registration.
- **One existing profile** → you continue with it.
- **Several linked profiles** → choose which **vendor account** to use.

If you already have a **completed, paid** stall for this event, you're asked whether to **preview** it or **register a new request** — and if new, whether it's **for yourself** (same profile) or **for a new vendor** (a separate linked account).

## Step 3 — Complete the stall form

1. Fill in **business details**: business name, category, tax/registration number, address.
2. Fill in **applicant details**: name, nationality, residency, number of operators.
3. Choose your **preferred space type(s)** — you can select more than one as a combination. If the organizer published a **floor layout**, click the **table(s)** you want on the map.
4. Add any **add-ons** (power, furniture, signage…).
5. Tick the **mandatory terms & conditions** — you can't submit without these.
6. Click **Submit Stall Request**.

You'll see: *"Stall request submitted successfully. Waiting for organizer approval."*

## Step 4 — Wait for approval

- Your request sits as **Pending** until the organizer reviews it.
- You'll be notified when it's **Approved**.

## Step 5 — Select space & pay

1. After approval, reopen the flow — you can now **select your tables/add-ons**.
2. Review the **grand total** (tables + add-ons + any deposit).
3. Pay via the **QR code** (UPI in India, PayNow in Singapore) and confirm.

## Step 6 — Get your stall ticket

- Once payment is confirmed, your booking is **Completed**.
- Download your **stall ticket PDF** (with a QR code) from the **Download Stall Ticket** button; it's also sent to you.

## Troubleshooting

- **No stalls to choose?** The organizer may not have any space types on sale yet.
- **Stuck after approval?** You still need to select tables/add-ons and pay — the booking stays in "Processing" until payment completes.
- **Need a second stall / a different brand?** Use "register a new request" and pick "for a new vendor" to create a separate linked account.`,
  },
  {
    slug: "book-round-tables",
    title: "For Visitors: Reserving Round-Table Seats",
    summary: "How attendees reserve round-table seats (or a whole table) and add guests.",
    markdown: `# For Visitors: Reserving Round-Table Seats

Some events sell **round-table seating** — for galas, dinners and banquets. This is how a visitor reserves seats (or a whole table) from the EventFront.

## Step 1 — Open the seating plan

1. On the EventFront, go to the **Venue** tab.
2. Find the **Reserve Your Seats** card.
3. You'll see the prompt to *click on available chairs to select your seating*.

## Step 2 — Choose a table category

1. Browse the **category cards** (e.g. VIP, Standard, Budget).
2. Each shows the number of tables, the **price per seat**, and availability.
3. Click a category to expand its tables.

## Step 3 — Pick your seats

1. The round tables appear with their **chairs**.
2. Click individual **chairs** to add them to your selection, **or** click a **whole table** to book it entirely.
3. Selected chairs highlight, and a **running total** updates ("X seat(s) • price").

## Step 4 — Enter your details

1. Enter your **full name**, **email** and **phone** (country code + number) — these are required.
2. Optionally expand **Add Guest Details** and, for each seat, enter the guest's **name, WhatsApp number and email**.
   - Each guest with details gets their **own QR ticket** by WhatsApp.

## Step 5 — Book and pay

1. Review the total, then click **Book**.
2. On the payment page you'll see your table names, seat counts and the total.
3. Pay via the **QR code** (UPI in India, PayNow in Singapore).
4. Click **I Have Paid — Submit for Confirmation**.

You'll see: *"Payment Submitted! The organizer will review and confirm your payment. Your ticket will be sent via WhatsApp."*

## Step 6 — Get your tickets

- The organizer **confirms your payment**.
- Your **QR ticket(s)** are then sent via **WhatsApp/email** — one per guest if you added guest details.

## Troubleshooting

- **No "Reserve Your Seats" card?** This event doesn't sell round-table seating, or none are available.
- **A chair won't select?** It's already taken — pick another.
- **Booking a whole table:** use the whole-table option instead of clicking each chair.`,
  },
  {
    slug: "apply-speaker",
    title: "For Speakers: Applying to Speak",
    summary: "How a speaker applies, gets approved, picks a time slot and receives their pass.",
    markdown: `# For Speakers: Applying to Speak

This is the **speaker's** journey — from applying on the EventFront to receiving a speaker pass. It's a multi-stage flow because the organizer approves applications before scheduling.

## Before you start

Have a **headshot photo**, a short **bio**, your **session topic**, and a **WhatsApp number** ready (you'll verify it by OTP).

## Step 1 — Verify your WhatsApp

1. On the EventFront, open **Apply as Speaker**.
2. Enter your **WhatsApp number** and tap **Send OTP via WhatsApp**.
3. Enter the **6-digit code** you receive and tap **Verify OTP**.

The system then checks whether you already have an application:

- **Pending** → "Your application is under review" — wait for approval.
- **Approved/Confirmed** → jump to selecting a time slot.
- **Completed** → your speaker pass is ready to download.

## Step 2 — Fill in your application (new applicants)

1. Upload your **photo** (tap the circular area).
2. Enter your **full name**, **email**, **title/role** and **organization**.
3. Write your **bio** and **area of expertise**.
4. Optionally add **previous speaking experience** and **equipment needed**.
5. Add **social links** (LinkedIn, Twitter, website).
6. Optionally choose a **speaker space/slot**, then enter your **session topic** (required) and **description**.
7. Click **Submit Application**.

You'll see: *"Application submitted! The organizer will review your application."*

## Step 3 — After approval: pick your time slot

1. When approved, you're asked to schedule your session.
2. Enter your **session topic** and **description**.
3. Choose a **start time** and **end time** — already-booked slots are shown so you avoid clashes.
4. Click **Confirm Time Slot**.

## Step 4 — Confirm (and pay if required)

- If your slot is **free**, simply **confirm** it.
- If the slot is **paid**, a **payment QR** appears (UPI in India, PayNow in Singapore). Pay, then click **I've Completed the Payment**.

## Step 5 — Get your speaker pass

- Your **speaker pass** (with a QR code) is sent to your **WhatsApp**.
- You can also tap **Download Speaker Pass** to save the PDF.

## Troubleshooting

- **OTP didn't arrive?** Re-check the number and resend; OTP comes via WhatsApp.
- **Can't pick a time?** Your application may still be pending — approval comes first.
- **Lost your pass?** Re-open the flow after verifying your WhatsApp and download it again.`,
  },
];

export function getGuideTopic(slug: string): GuideTopic | undefined {
  return ORGANIZER_GUIDE_TOPICS.find((t) => t.slug === slug);
}

/** Lightweight catalog (no markdown) for the chat payload + UI list. */
export function getGuideCatalog(): Array<
  Pick<GuideTopic, "slug" | "title" | "summary">
> {
  return ORGANIZER_GUIDE_TOPICS.map(({ slug, title, summary }) => ({
    slug,
    title,
    summary,
  }));
}

/** Concatenate every topic into one document for the "full guide" PDF. */
export function buildFullGuideMarkdown(): string {
  const header = `# Organizer Guide\n\n${GUIDE_INTRO}\n`;
  const body = ORGANIZER_GUIDE_TOPICS.map((t) => t.markdown).join("\n\n---\n\n");
  return `${header}\n---\n\n${body}`;
}
