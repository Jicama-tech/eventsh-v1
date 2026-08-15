# Phase 4: SingAdvisor direct API integration

Status of the work described in the plan's Phase 4 (`C:\Users\Admin\.claude\plans\pure-jumping-thunder.md`):

- **4a — API-key auth, scoped to one Organizer: done, verified.**
- **4b — Field-mapping audit: done (this doc).**
- **4b.5 — Public read-side gaps found by re-reviewing both codebases:
  done, all 3 built and verified.** See "Public read-side gaps" below —
  these were missing endpoints eventsh needed regardless of any client-side
  fix, found by diffing SingAdvisor's actual call sites (`events-client.ts`,
  `events-admin-client.ts`) against eventsh's real routes, not just the
  create-side DTO.
- **4c — Deployment shape: documented below, not yet provisioned.**
- **4d — Consolidation cutover: not started.** Real changes to the SingAdvisor
  repo (swapping its client functions to send `x-organizer-id`/`x-api-key`,
  fixing paths, retiring its own Events/Tickets/Sponsors modules) —
  deliberately not done in this pass; needs its own testing pass in that repo.

## Public read-side gaps (found + closed)

SingAdvisor's own Backend serves exactly the shape its Frontend expects
(naturally, since it's their own code) — `GET /events` (bare list),
`GET /events/slug/:slug`, `POST /uploads/events`. None of those exist on
eventsh, which only ever exposed organizer-scoped routes. Since
SingAdvisor's `events-client.ts`/`events-admin-client.ts` are `"server-only"`
— they never run in a visitor's browser, only in SingAdvisor's own
Next.js server — they can carry an `x-organizer-id` header on every call,
even the "public" ones, without needing a real logged-in user. That's what
the 3 new endpoints below assume.

1. **`GET /events/organizer/:organizerId/slug/:slug`** (new, public,
   unauthenticated) — the by-slug lookup `fetchEventBySlug()` needs.
   Deliberately organizer-scoped, not a bare `/events/slug/:slug` — a slug is
   only unique per organizer in eventsh (see `createEvent.dto.ts`'s `slug`
   comment), so a global lookup would be architecturally wrong to add.
   `visibility: { $ne: "private" }` filtered, same as the list endpoint's
   `publicOnly`. Verified live: created an event with a slug via the API
   key, fetched it back by slug unauthenticated, got a 404 for a
   non-existent slug.
2. **`POST /uploads/events`** (new module, `backend/src/modules/uploads/`)
   — `fetchEventBySlug`'s sibling `uploadEventImage()` needs a standalone
   upload endpoint; eventsh only ever had inline multipart uploads bundled
   into create/update. Reuses the exact same disk storage/filename/filter as
   the inline uploads (`generateFileName`/`imageFilter`, now exported from
   `events.controller.ts`). `OrganizerOrApiKeyGuard`-protected, not public —
   an open upload endpoint is a disk-fill vector. Verified live: valid key
   uploads and the file is immediately served back at the returned URL; no
   auth is rejected with 401.
3. **`soldCount` enrichment** — SingAdvisor's `remainingCapacity()`/
   `fromPrice()` helpers do `maxCount - soldCount` per visitor type.
   eventsh's `VisitorType` sub-schema has no `soldCount` field at all —
   ticket sales live only in the separate `tickets` collection. Added
   `EventsService.attachSoldCounts()`: one aggregation (`$unwind` +
   `$group` by `eventId`+`tierId`, summing `ticketDetails.quantity` for
   non-cancelled tickets) covering every event in a response, not one query
   per event. Wired into the new slug endpoint and into
   `findByOrganizer`'s `publicOnly` branch **only** — deliberately not the
   organizer's own private dashboard fetch, which is the hottest path
   through this method on the shared SaaS and doesn't need this field.
   Verified live: inserted a real 3-unit ticket, confirmed `soldCount: 3`
   shows up on both the slug endpoint and the public list endpoint, and
   confirmed the private (`publicOnly=false`) dashboard fetch stays
   unenriched (no `soldCount` key at all — zero perf/shape change there).

Still open, not needed to unblock 4d (client-side fixes, not eventsh gaps):
`venue` (map to `location` client-side) and `currency` (derive from the
Organizer's `country`, fetched once) have no eventsh field and don't need
one — cheaper to resolve in SingAdvisor's own mapping code than to add
fields to eventsh's schema for one client.

## 4a — what was built and verified

- `Organizer.apiKeyHash` / `apiKeyGeneratedAt` (organizer.schema.ts) — same
  "generate once, store only the bcrypt hash" pattern as
  `WhiteLabelInstance.licenseKeyHash`.
- `POST /organizers/:id/api-key/generate` / `PATCH /organizers/:id/api-key/revoke`
  — admin-JWT-guarded (`JwtAuthGuard` + new `AdminRolesGuard`), returns the
  plaintext key once.
- `ApiKeyGuard` (organizers/guards) — strict machine-caller guard reading
  `x-organizer-id` + `x-api-key`, available for future dedicated routes.
- `OrganizerOrApiKeyGuard` (organizers/guards) — composite guard applied to
  the four endpoints SingAdvisor's admin needs first
  (`POST /events/create-event`, `PUT /events/:id`, `PATCH /events/:id/publish`,
  `DELETE /events/:id`): delegates to the *existing* passport `AuthGuard("jwt")`
  unchanged when a Bearer token is present (zero behavior change for every
  current browser flow — regression-tested below), falls back to the API-key
  check when it isn't. `organizerId` is always resolved server-side from the
  key lookup, never trusted from the request body/headers as an assertion.
- `AdminRolesGuard` — also closes the gap the Container-branch code review
  flagged: `platform-registry.controller.ts`'s `POST`/`GET /instances` were
  `JwtAuthGuard`-only (any logged-in organizer could hit them). Now requires
  `roles.includes("admin")`.
- `ThrottlerModule` registered (module-level only, not a global `APP_GUARD` —
  existing browser traffic is unaffected) and applied to the same API-key
  surface plus the key-generate/revoke endpoints.

**Verified against the running dev server** (not just `nest build`):
admin JWT can list/register instances (200) and generate a key; an organizer
JWT on the same instance endpoints now gets 403 (confirms the security-gap
fix); a generated API key on `create-event`/`publish` passes auth and reaches
real business logic (confirmed via a live `PATCH .../publish` round-trip
returning the real event document); a wrong key, a missing key, and a key
presented against a *different* organizer's id all get 401; revoking a key
immediately invalidates it; and — the regression check — an existing
organizer's real browser JWT still authenticates on the swapped-guard
`publish` endpoint exactly as before.

## 4b — Field-mapping audit: SingAdvisor `EventInput` vs eventsh `CreateEventDto`

Compared `Frontend/src/lib/events-admin-client.ts`'s `EventInput` (SingAdvisor)
against `backend/src/modules/events/dto/createEvent.dto.ts`'s `CreateEventDto`
(eventsh). As expected from `EventInput` being built *as* a port of eventsh's
shape, most fields line up directly by name and type. Concrete deltas found:

| # | Field | Issue | What to do in 4d |
|---|---|---|---|
| 1 | Request shape | SingAdvisor's `authedFetch` sends `Content-Type: application/json` + a JSON-stringified body straight to `POST /events`. eventsh's real endpoint is `POST /events/create-event`, guarded by a `FileFieldsInterceptor` (multipart) expecting `banner`/`gallery`/etc. as files. **Tested and fixed.** A plain JSON POST reached the handler with `files` as `undefined` (multer only runs for multipart bodies) and crashed on the unconditional `files.banner` read (`TypeError: Cannot read properties of undefined (reading 'banner')`, confirmed via a live request against the dev server). Fixed in `events.controller.ts`'s `createEvent`/`updateEvent` (`files = files \|\| {}`) — zero risk to the existing multipart/FormData path (regression-tested: an organizer JWT + real `FormData` create-event still returns 201 identically). Re-tested after the fix: a plain JSON POST via `x-organizer-id`/`x-api-key` now returns 201 with a real created event. | Done — no client change needed for this item; SingAdvisor's existing JSON-POST style works as-is once pointed at the right path (item 2). |
| 2 | Endpoint path | SingAdvisor calls `POST /events`, `PUT /events/:id`. Real paths are `POST /events/create-event`, `PUT /events/:id` (update path matches, create doesn't). | Update `events-admin-client.ts`'s paths. |
| 3 | `organizerId` | Not present in `EventInput` at all (SingAdvisor has no organizer concept). eventsh's DTO has `organizerId: string` as a required field, but the controller **overwrites** whatever's in the body with the server-resolved id from `req.user.userId`/`ApiKeyGuard` lookup for every path except the admin-demo-event branch. No client change needed — this already works correctly with the new guard. | None — confirmed compatible by design. |
| 4 | `endDate` | Required in `EventInput`, optional in `CreateEventDto`. Not a conflict (SingAdvisor can keep always sending it), but worth noting eventsh's own dashboard allows open-ended events SingAdvisor's form doesn't. | No change needed for 4d; informational. |
| 5 | `venue` | `EventInput.venue` has no eventsh analog — eventsh only has `location`/`address`. | Fold `venue` into `location` (or drop) when mapping. |
| 6 | `summary` | `EventInput.summary` (short excerpt) has no direct match — closest eventsh field is `showcaseBlurb` (landing-page showcase copy, a different purpose) or `description` (full text). | Map to `description` unless a short-excerpt field is specifically needed — don't conflate with `showcaseBlurb`, which drives the admin showcase carousel, not attendee-facing detail. |
| 7 | `currency` | `EventInput.currency` has no top-level `CreateEventDto` field. eventsh derives currency from the **organizer's `country`** (see `organizers.service.ts`'s `CURRENCY_MAP`), not a per-event setting. | Drop the field from what's sent; ensure the one Organizer created for SingAdvisor has the correct `country` set instead. |
| 8 | `agenda` | `EventInput.agenda: AgendaItem[]` has no matching field — closest concept in eventsh is `functions?: FunctionDto[]` (need to confirm `FunctionDto`'s shape against `AgendaItem` — not yet compared field-by-field). | Compare `FunctionDto` vs `AgendaItem` explicitly before 4d; likely needs a small shape adapter either way. |
| 9 | `speakers` vs `speakerProfiles` | `EventInput` sends **two** speaker-related fields: `speakers?: string[]` (plain strings) and `speakerProfiles?: SpeakerProfile[]` (full objects). eventsh has **one** field, `speakers?: SpeakerDto[]`, whose shape (`id, name, title, organization, bio, image, email, socialLinks, slots, isKeynote, order`) matches `speakerProfiles` closely, not the bare-string `speakers` array. | Send `speakerProfiles` content as eventsh's `speakers` field; drop the bare-string `speakers` list (no eventsh equivalent — was likely a legacy/simplified field in SingAdvisor before `speakerProfiles` was added). |
| 10 | `visitorTypes` | Required (non-optional) in `EventInput`; optional in `CreateEventDto`. Shape otherwise matches closely: `id, name, price, maxCount, description, featureAccess, isActive` all line up. `EventInput` additionally allows `soldCount` — eventsh treats that as server-computed (from real ticket sales), not a creation input. | Drop `soldCount` when sending to eventsh; everything else maps directly. |
| 11 | `sponsorTypes` | Shapes match well on the fields checked (`id, name, price, description, isActive`) — eventsh additionally supports `collectPayment`/`customOptions` (non-cash sponsorship tiers) that `EventInput`'s `SponsorType` should be checked against for parity, but no incompatibility found. | Minor — confirm `SponsorType` (SingAdvisor) includes `collectPayment`/`customOptions` if that non-cash-tier feature is wanted; otherwise no change needed. |
| 12 | `reelLinks`, `adBar`, `ageRestriction(s)`, `dresscode`, `dressCodeTheme`, `specialInstructions`, `refundPolicy`, `termsAndConditions`, `customSections`, `image`, `gallery`, `tags`, `features`, `socialMedia`, `visibility`, `slug`, `category`, `eventType`, `status`/`published` | All match directly by name and type (or a trivial rename, e.g. `status: "published"` vs the boolean `published` — eventsh has both). | None — confirmed compatible. |

**Bottom line**: this is genuinely a small diff, as expected — most of the
mismatch is 3 dropped/renamed fields (`venue`, `summary`, `currency`), one
duplicate field to collapse (`speakers`/`speakerProfiles` → `speakers`), and
one still-unverified shape (`agenda` vs `functions`). Item #1 (the
multipart-vs-JSON request shape) — the one real risk in the list — is now
tested, fixed, and verified end-to-end; nothing about the request format is
blocking 4d anymore.

## 4c — Deployment shape (backend-only)

No new Docker artifacts needed, per the plan — reuse `backend/Dockerfile`
from Phase 1 as-is and skip `frontend/Dockerfile` entirely (SingAdvisor keeps
its own Next.js frontend). To bring up just the backend + its own database
against the existing compose file:

```bash
docker compose -f docker-compose.whitelabel.yml --env-file .env.whitelabel \
  up -d mongo backend
```

(omit `frontend` from the service list). Set in that `.env.whitelabel`:

- `CORS_ORIGINS` — SingAdvisor's actual frontend domain(s).
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — per Phase 1's checklist.
- Everything else from `backend/.env.example` as normal for a single-tenant
  deployment (own Mongo, own SMTP, own OAuth apps if the human-login paths
  are used at all — SingAdvisor's own admins likely never touch eventsh's
  login UI directly, only the API, but the seeded admin account is still
  needed to generate the API key in step below).

Then, once the instance is up: register it via
`POST /platform-registry/instances` (Phase 2, now admin-role-guarded) so it
shows up centrally and is eligible for Phase 5's update notifications, and
generate its Organizer's API key via
`POST /organizers/:id/api-key/generate` (this doc's 4a) — hand the returned
key to whoever configures SingAdvisor's `EVENTSH_API_KEY`/`EVENTSH_ORGANIZER_ID`
env vars in 4d.
