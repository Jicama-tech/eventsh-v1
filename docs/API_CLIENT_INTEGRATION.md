# API Client integration

How to connect a client that keeps its **own frontend and database** and
wants to consume eventsh purely as a backend API — locked to exactly one
Organizer, unable to create additional organizers through the integration.
This is a different shape from the white-label Docker deployments covered in
`docs/WHITE_LABEL_DEPLOYMENT.md` (those hand a customer the *entire* eventsh
stack); here the client's own system is untouched except for whichever
Events/Tickets/Sponsors code it retires in favor of calling out to eventsh.

Everything below is generic — nothing here is specific to any one client.
SingAdvisor (repo at `C:\Users\Admin\Documents\GitHub\singadvisor`) is the
first real instance of this pattern and appears at the end as a worked
example, not as the frame for the whole document.

## The reusable recipe

1. **Decide the deployment target** (see below) — default to the shared
   eventsh backend unless this client specifically needs isolation.
2. **Register the integration centrally**: Super Admin → White-Label
   Instances → Register Instance → integration type "API Client" →
   supply the real `Organizer._id` this client is scoped to (create that
   Organizer first if one doesn't exist yet — same registration flow any
   organizer goes through, or create it directly if the client has no
   self-serve signup need).
3. **Generate the Organizer's API key**: Super Admin → Organizers → open
   the organizer → Direct API Access → Generate key. Shown once — hand it
   to whoever configures the client's environment.
4. **Point the client's backend URL** at the target from step 1, sending
   `x-organizer-id` (the Organizer's `_id`) and `x-api-key` (the key from
   step 3) on every authenticated call — no separate login flow, no shared
   JWT secret trick.
5. **Run a field-mapping audit** before wiring the client over for real:
   diff the client's own request/response types against eventsh's actual
   DTOs (`backend/src/modules/events/dto/createEvent.dto.ts` and the
   equivalents for tickets/sponsors) and its actual read routes — don't
   assume a shape matches just because it was modeled on eventsh's pattern.
   The SingAdvisor section below is a worked example of doing this
   diff and what came out of it, useful as a template for the *kind* of
   deltas to expect (dropped/renamed fields, endpoint paths that don't
   exist yet, request-shape assumptions like multipart vs JSON).
6. **Cut over gradually**: point the client's read paths at eventsh first
   (lower risk — no data mutation), verify, then writes, then retire
   whatever local Events/Tickets/Sponsors code the client had duplicating
   this functionality.

## Deployment target: shared backend by default, dedicated container as opt-in

Two ways any API-client integration can point its `BACKEND_URL`:

1. **The existing shared eventsh backend** (default) — the client is just
   one more `Organizer` row in the same production database every regular
   SaaS organizer already lives in. Isolation is enforced at the access
   layer: `ApiKeyGuard`/`OrganizerOrApiKeyGuard` always resolve
   `organizerId` server-side from the key lookup, so a client's key can
   only ever touch its own organizer's data. Zero new infrastructure —
   register, generate a key, done.
2. **A dedicated single-tenant backend container** — full data isolation,
   but real ongoing ops cost (own VPS/hosting, own Mongo, and it needs the
   self-update mechanism described in the plan's Phase 5, which doesn't
   exist yet, to ever get patched). Reuse `backend/Dockerfile` as-is; skip
   `frontend/Dockerfile` entirely since the client keeps its own frontend.
   ```bash
   docker compose -f docker-compose.whitelabel.yml --env-file .env.whitelabel \
     up -d mongo backend
   ```
   (omit `frontend` from the service list). Set `CORS_ORIGINS` to the
   client's actual frontend domain(s) and `SEED_ADMIN_EMAIL`/
   `SEED_ADMIN_PASSWORD` per the white-label checklist.

Pick (2) only when a client has a specific isolation/compliance/SLA need
that justifies the ops cost — the guard, the schema, and the client-side
request shape are identical either way; only which Mongo the `Organizer`
row lives in changes.

## What was built (generic — applies to every integration, not just one client)

- `Organizer.apiKeyHash` / `apiKeyGeneratedAt` (`organizer.schema.ts`) — same
  "generate once, store only the bcrypt hash" pattern as
  `WhiteLabelInstance.licenseKeyHash`.
- `POST /organizers/:id/api-key/generate` / `PATCH /organizers/:id/api-key/revoke`
  — admin-JWT-guarded (`JwtAuthGuard` + `AdminRolesGuard`), returns the
  plaintext key once. Self-service from the Super Admin's Organizers page
  (Direct API Access section) — no terminal command needed.
- `ApiKeyGuard` (`organizers/guards/api-key.guard.ts`) — strict machine-caller
  guard reading `x-organizer-id` + `x-api-key`, for endpoints that should
  only ever accept a machine caller.
- `OrganizerOrApiKeyGuard` (`organizers/guards/organizer-or-api-key.guard.ts`)
  — composite guard for endpoints that need to accept BOTH: delegates to the
  *existing* passport `AuthGuard("jwt")` unchanged when a Bearer token is
  present (zero behavior change for every browser flow), falls back to the
  API-key check otherwise. `organizerId` is always resolved server-side from
  the key lookup, never trusted from the request body/headers as an
  assertion. Applied to: `POST /events/create-event`, `PUT /events/:id`,
  `PATCH /events/:id/publish`, `DELETE /events/:id`, `POST /uploads/events`,
  and the Sponsors organizer-CRM routes (`create/update/delete/list/history
  -by-organizer`).
- `AdminRolesGuard` (`auth/guards/admin-roles.guard.ts`) — role check on top
  of `JwtAuthGuard` for admin-only endpoints (`platform-registry`'s instance
  management, API-key generate/revoke). Closed a real gap: those
  `platform-registry` endpoints were previously `JwtAuthGuard`-only, so any
  logged-in organizer/vendor could register instances or list every
  customer's domain + sync stats.
- Sponsors ownership check — `sponsors.controller.ts`'s organizer-CRM routes
  took `:organizerId` as a raw URL param with no cross-check against the
  caller's own identity; any logged-in organizer/vendor could manage a
  *different* organizer's sponsor directory. Fixed alongside the guard swap
  (`assertOwnsOrganizer` helper) — verified this really was exploitable
  before the fix, not just theorized.
- `ThrottlerModule` registered (module-level only, not a global `APP_GUARD`
  — existing browser traffic is unaffected) and applied to the whole
  API-key-reachable surface above.
- `WhiteLabelInstance.integrationType` (`"full-instance" | "api-client"`,
  default `"full-instance"`) + optional `organizerId` link — tracks API
  Client integrations on the same registry Phase 2 built for full Docker
  deployments, rather than a parallel system. `licenseKeyHash` is optional
  on this schema now: an API Client integration has no separate deployment
  to run the periodic sync job from, so that credential is simply inert for
  that type.
- Read-side gaps closed (see the worked example below for how these were
  found): `GET /events/organizer/:organizerId/slug/:slug` (new, public,
  organizer-scoped since slugs are only unique per-organizer), `POST
  /uploads/events` (new standalone module, `backend/src/modules/uploads/`),
  and `EventsService.attachSoldCounts()` (live per-tier sold-count
  enrichment from the `tickets` collection, since eventsh never stored this
  on the event itself — wired into the new slug endpoint and
  `findByOrganizer`'s `publicOnly` branch only, not the organizer's own
  private dashboard fetch).

**All of the above verified against the running dev server**, not just
compiled — see git history on the `Container` branch for the specific
request/response pairs tested (auth accept/reject in every direction,
cross-organizer rejection, revocation, regression checks against existing
browser JWT flows, a real created event round-tripped through the new
endpoints, a real ticket's soldCount reflected correctly).

## Worked example: SingAdvisor

Status: **Events fully cut over and verified live (read, write, and the
admin UI, including two real bugs found and fixed along the way — see
below). Tickets cut over and verified live (purchase flow, admin-read
guard closure) — see its own section below. Sponsors not started.**

### Events cutover — done, verified live

4a (auth) done and verified. Field-mapping audit done. Read-side gaps found
and closed. Deployment documented. The actual SingAdvisor-repo cutover
(`events-client.ts`/`events-admin-client.ts` repointed at eventsh) is done
and verified against a live local eventsh instance: admin event list
renders real data, individual event pages render correctly including a
real uploaded image, and a real edit through the actual admin UI
round-tripped through eventsh and persisted correctly. Two real bugs were
found and fixed via that live testing, not assumed from reading code — see
"Two real bugs found" below.

### Field-mapping audit: SingAdvisor `EventInput` vs eventsh `CreateEventDto`

Compared `Frontend/src/lib/events-admin-client.ts`'s `EventInput` against
`backend/src/modules/events/dto/createEvent.dto.ts`'s `CreateEventDto`. As
expected from `EventInput` being built *as* a port of eventsh's shape, most
fields line up directly by name and type. Concrete deltas found:

| # | Field | Issue | What to do in the cutover |
|---|---|---|---|
| 1 | Request shape | SingAdvisor's `authedFetch` sends `Content-Type: application/json` straight to `POST /events`. eventsh's real endpoint is `POST /events/create-event`, guarded by a multipart `FileFieldsInterceptor`. **Tested and fixed**: a plain JSON POST left `files` as `undefined` and crashed on the unconditional `files.banner` read — fixed with `files = files \|\| {}` in `createEvent`/`updateEvent`, zero risk to the existing multipart/FormData path (regression-tested). Re-verified: JSON POST via API key now creates a real event (201). | Done — no client change needed; SingAdvisor's existing JSON-POST style works once pointed at the right path (item 2). |
| 2 | Endpoint path | SingAdvisor calls `POST /events`, `PUT /events/:id`. Real paths: `POST /events/create-event`, `PUT /events/:id` (update matches, create doesn't). | Update `events-admin-client.ts`'s create path. |
| 3 | `organizerId` | Absent from `EventInput` (SingAdvisor has no organizer concept). eventsh's DTO has it as a field, but the controller **overwrites** whatever's in the body with the server-resolved id from the guard. | None — confirmed compatible by design. |
| 4 | `endDate` | Required in `EventInput`, optional in `CreateEventDto`. | No change needed; informational. |
| 5 | `venue` | No eventsh analog — eventsh only has `location`/`address`. | Fold into `location` (or drop) when mapping. |
| 6 | `summary` | No direct match — closest is `showcaseBlurb` (landing-page showcase, different purpose) or `description` (full text). | Map to `description`; don't conflate with `showcaseBlurb`. |
| 7 | `currency` | eventsh derives currency from the **organizer's `country`** (`organizers.service.ts`'s `CURRENCY_MAP`), not a per-event field. | Drop from what's sent; set the right `country` on SingAdvisor's Organizer instead. |
| 8 | `agenda` | `AgendaItem[]` has no matching field — closest is `functions?: FunctionDto[]`, shapes not yet compared field-by-field. | Compare before the cutover; likely needs a small adapter either way. |
| 9 | `speakers` vs `speakerProfiles` | `EventInput` sends both a bare-string `speakers?: string[]` and a rich `speakerProfiles?: SpeakerProfile[]`. eventsh has one field, `speakers?: SpeakerDto[]`, matching `speakerProfiles`'s shape. | Send `speakerProfiles` content as eventsh's `speakers`; drop the bare-string list. |
| 10 | `visitorTypes` | Required in `EventInput`, optional in `CreateEventDto`; shapes otherwise match closely. `EventInput` allows `soldCount`, which eventsh treats as server-computed. | Drop `soldCount` when sending; everything else maps directly. |
| 11 | `sponsorTypes` | Shapes match on the fields checked; eventsh additionally supports `collectPayment`/`customOptions` (non-cash tiers). | Confirm SingAdvisor's `SponsorType` includes these if that feature is wanted; otherwise no change. |
| 12 | Everything else (`reelLinks`, `adBar`, age restrictions, `dresscode`, `specialInstructions`, `refundPolicy`, `termsAndConditions`, `customSections`, `image`, `gallery`, `tags`, `features`, `socialMedia`, `visibility`, `slug`, `category`, `eventType`, `status`/`published`) | Matches directly by name and type. | None. |

**Bottom line**: a genuinely small diff, as expected. 3 dropped/renamed
fields, one duplicate to collapse, one still-unverified shape (`agenda` vs
`functions`). The one real risk (#1, request shape) is tested, fixed, and
verified end-to-end.

### Public read-side gaps found and closed

SingAdvisor's own Backend serves exactly the shape its Frontend expects
(naturally, since it's their own code) — `GET /events` (bare list),
`GET /events/slug/:slug`, `POST /uploads/events`. None of those existed on
eventsh, which only ever exposed organizer-scoped routes. Since
SingAdvisor's client files are `"server-only"` — never run in a visitor's
browser — they can carry an `x-organizer-id` header on every call, even the
"public" ones, without needing a real logged-in user. That's what these 3
additions (listed generically above, under "What was built") assume, and
why they were built as organizer-scoped rather than bare/global routes.

Also found and closed: `venue` and `currency` have no eventsh field and
don't need one for SingAdvisor specifically — cheaper to resolve in its own
mapping code (`venue → location`, fetch the Organizer's `country` once)
than to add fields to eventsh's schema for one client.

### Two real bugs found via live testing (Events)

Both found by actually driving the real admin UI against a live eventsh
instance, not by reading code:

1. **`next/image` 500'd** the moment a real event had an image — eventsh's
   host wasn't in `next.config.ts`'s allow-list. Fixed by adding
   `NEXT_PUBLIC_EVENTSH_URL` alongside the existing `BACKEND_URL` entry,
   plus a new `withEventshUrl()` (`media-url.ts`) since event images come
   from a different origin than this app's own Backend uploads.
2. **"The end must be after the start" on every same-day event edit** —
   eventsh stores date and time-of-day as separate fields (`startDate`
   date-only + `time` "HH:mm"); this app's model uses one combined
   timestamp per field. Passing eventsh's date-only `startDate` straight
   through silently zeroed every event's time-of-day, making start === end
   for any single-day event. Fixed with `combineDateAndTime()`/
   `splitDateAndTime()` (`events-eventsh-adapter.ts` / `events-admin-client.ts`)
   in both directions, using UTC methods so the date portion never shifts to
   a different calendar day depending on the server's local timezone.

### Tickets cutover — purchase flow + admin-read guard closure, done, verified live

**The purchase flow is not a simple mechanical port like Events was.**
eventsh has no payment-gateway integration for tickets at all — its real
flow is manual: generate a UPI/PayNow QR from the Organizer's own bank
details, buyer pays outside the platform, buyer self-reports "I've paid"
(`POST /tickets/create-ticket` takes a bare `paymentConfirmed: boolean`
straight from the client, no independent verification — confirmed by
tracing the real flow, `ticketPaymentPage.tsx`, and checking every file in
the backend that references Razorpay: real Razorpay-linked-account charging
exists only for Memberships, nothing ticket-related). SingAdvisor's own
Backend, by contrast, does real Razorpay order-creation and independently
re-verifies the payment signature server-side before ever writing a ticket
— genuinely more secure than eventsh's own native flow. Migrating the
*buyer experience* onto eventsh's model would have been a real product
downgrade, not a technical detail — flagged and confirmed with the user
before writing any code, rather than assumed.

**What was actually built**: SingAdvisor's Backend keeps doing Razorpay
order-creation + signature verification exactly as before, completely
unchanged. Only what happens *after* a payment verifies changed — instead
of writing to its own local `tickets` collection, it now calls eventsh's
`POST /tickets/create-ticket` server-side (`Backend/src/modules/tickets/
tickets.service.ts`'s new `createEventshTicket()`), no API key needed since
create-ticket is eventsh's public buyer-purchase endpoint — this Backend
calls it the same unauthenticated way a buyer's browser already does,
just after independently verifying the payment first. eventsh becomes the
real system of record: QR code, confirmation email/WhatsApp, admin views,
and door-scanning all happen there automatically as part of that call.
`TicketPurchaseForm.tsx` (the buyer-facing component) needed **zero
changes** — it still calls this app's own Backend exactly as before; only
what the Backend does internally changed.

A local `tickets` collection record is still written after the eventsh call
succeeds — not a duplicate "record store," but the payment idempotency
guard (unique-indexed on `payment.razorpayOrderId`, protecting against the
client callback and the Razorpay webhook racing to confirm the same order
twice) and this app's own payment audit trail, both of which eventsh has no
equivalent concept for. `qrCodeUrl` is left empty on these records — the
real QR lives in eventsh now.

Also found and fixed along the way: `createOrder()` (Razorpay order
creation) and `claimFreeTicket()` both used to read tier price/capacity
from this app's own local `events` collection — no longer authoritative
now that Events live on eventsh. Both now fetch live from eventsh
(`fetchEventshEvent`/`fetchEventshTier`) before ever creating a Razorpay
order or free ticket, so pricing and capacity checks reflect reality
instead of a increasingly-stale local copy.

**Known, documented trade-off**: the old local-DB capacity check was a
single atomic `$inc` (race-safe — two buyers could never both succeed for
the last unit). eventsh exposes no equivalent atomic "reserve N" primitive
— capacity is now a best-effort read-then-check against eventsh's live
(computed-from-real-tickets) `soldCount`. This is *not* a regression
introduced here: eventsh's own native ticket-purchase flow has no
server-side capacity enforcement at all today. Flagged in code comments,
not silently accepted.

**eventsh-side guard closure** (mirrors the Sponsors fix in Phase 4.5d):
`tickets.controller.ts`'s `getOrganizerTickets`, `update`, `markAsUsed`,
`remove`, `markAttendance`, and `resend-email` were unguarded (or, for
resend-email, `AuthGuard("jwt")`-only with no ownership check) — any
logged-in organizer/vendor could manage or view a *different* organizer's
tickets. Fixed with `OrganizerOrApiKeyGuard` + an explicit
`assertOwnsTicket` ownership check (these identify a ticket by its own
id/ticketId, not an organizerId URL param, so ownership needs a lookup
first — same idea as Sponsors' `assertOwnsOrganizer`, different resolution
path). `create-ticket`, `findAll`, `findOne`, `findByTicketId`,
`getEventTickets` deliberately left alone — the public buyer-purchase and
door/QR-scan paths, unauthenticated by design.

**Verified live, not just compiled**: created a real free-tier ticket
through `POST /tickets/free` on SingAdvisor's own Backend — confirmed the
real ticket landed in eventsh with correctly mapped fields (name, email,
phone→whatsapp, tier, amount, `paymentConfirmed: true`) and a real QR code
generated; confirmed it's visible through the newly-guarded
`GET /tickets/organizer/:id`; confirmed the capacity check correctly
rejects an over-quantity request reading live eventsh data; confirmed the
guard rejects an unauthenticated request and a wrong-organizer's key.
`fetchTicketsAdmin`/`setTicketStatusAdmin`/`resendTicketEmailAdmin`
(`events-admin-client.ts`) were also added mirroring Events' admin client,
though there's no admin tickets page in SingAdvisor's Frontend yet to
exercise them against — built for when one exists, matching the same
pattern rather than inventing a different shape later.

Sponsors — same recipe, not started yet.

### Provisioning

Once a real Organizer exists for SingAdvisor (business email, WhatsApp
number, organization name — real values, not created with placeholders):
register it as a `WhiteLabelInstance` with `integrationType: "api-client"`
via the Super Admin, then generate its API key from the Organizers page.
Hand both the Organizer `_id` and the key to whoever configures
SingAdvisor's `BACKEND_URL`/`EVENTSH_*`/API-key env vars for the cutover
(both `Frontend/.env` and `Backend/.env` need the `EVENTSH_*` values now —
see each `.env.example` for what's needed where).
