# White-label deployment guide

How to stand up a new single-tenant eventsh instance for a white-label
customer — its own Docker containers, its own MongoDB, fully isolated from
the shared eventsh.com SaaS deployment. Same codebase, a second deployment
mode.

See `C:\Users\Admin\.claude\plans\pure-jumping-thunder.md` (or wherever this
plan lives in your notes) for the full design rationale. This doc is just the
practical walkthrough.

## Before you start: things this customer needs to bring

Each white-label deployment uses **its own** third-party credentials, not
eventsh's:

- **Google OAuth app** (console.cloud.google.com) — used for organizer/buyer/
  volunteer/member login. You'll need a Client ID + Secret, and to register
  every `GOOGLE_*_REDIRECT_URI` below as an Authorized redirect URI on it.
- **Instagram app** (developers.facebook.com) — used for the Instagram embed
  feature. Client ID + Secret.
- **Razorpay account** — payments settle here, not to eventsh's account.
- **SMTP credentials** — for transactional email (nodemailer).
- **A domain**, pointed at wherever you're hosting this stack.

## 1. Register the instance for central tracking (optional but recommended)

Before provisioning, register this deployment with the central Super Admin so
its usage/aggregate stats show up there (Phase 2 of the plan —
`platform-registry` module):

```
POST /platform-registry/instances   (on the eventsh.com deployment, admin JWT)
```

Save the returned `instanceId` and `licenseKey` — you'll set them as
`INSTANCE_ID`/`INSTANCE_LICENSE_KEY` (plus `PLATFORM_REGISTRY_URL`, pointed at
the eventsh.com deployment's API origin) in step 2. Skip this if you don't
want this instance reporting home — the sync service no-ops unless all three
are set.

## 2. Copy and fill in the env file

```bash
cp .env.whitelabel.example .env.whitelabel
```

Fill in every value — see the comments in that file and in
`backend/.env.example`/`frontend/.env.example` for what each one does.
**Do not skip these**, or the deployment breaks/leaks in predictable ways:

- `MONGO_URI` — leave as the default (`mongodb://mongo:27017/eventsh`) if
  using the bundled `mongo` service below; point elsewhere for an external
  managed Mongo.
- `FRONTEND_BASE_URL` / `CORS_ORIGINS` / `VITE_API_URL` / `VITE_PUBLIC_BASE` —
  all need this tenant's real domain, not eventsh.com's.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — **must** be set before first
  boot, or this deployment gets seeded with the same default admin login
  (`admin@eventsh.com` / `admin123`) every unconfigured eventsh instance
  shares.
- `ADMIN_EMAIL` / `SUPPORT_EMAIL` — where this tenant's internal
  notifications and support links go.
- `GOOGLE_*` / `INSTAGRAM_*` / `RAZORPAY_*` — this tenant's own credentials
  (see above).
- `WHATSAPP_ENABLED` / `WHATSAPP_OTP_ENABLED` — leave `false` unless this
  tenant specifically wants WhatsApp (needs its own pairing either way —
  uncomment the `whatsapp-auth-data` volume in
  `docker-compose.whitelabel.yml` first).

## 3. Build and run

```bash
docker compose -f docker-compose.whitelabel.yml --env-file .env.whitelabel build
docker compose -f docker-compose.whitelabel.yml --env-file .env.whitelabel up -d
```

The frontend image is built **per tenant** — its API URL and OAuth client ID
are baked into the JS bundle at build time, not read at container runtime. A
rebuild (not just a restart) is needed whenever any `VITE_*` value changes.

## 4. Seed the admin login

`src/seed/seed.ts` is **not** run automatically on boot — it's a standalone
script. Run it once, after the stack is up, to create the admin login you
set as `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`:

```bash
docker compose -f docker-compose.whitelabel.yml exec backend node dist/src/seed/seed.js
```

It's idempotent (exits without changes if that admin already exists), so
safe to re-run.

## 5. Verify

Run through the checklist in the plan's Verification section:

- `docker compose logs backend` shows `Nest application successfully
  started` and no Puppeteer/Chromium launch errors.
- Frontend loads at its mapped port; a deep link to a page (e.g. an event
  page URL) survives a hard refresh instead of a raw 404 — confirms the
  Nginx SPA fallback in `frontend/nginx.conf` is working.
- Generate a PDF (a ticket, or a venue layout export) end-to-end — confirms
  the Chromium deps in `backend/Dockerfile` and the writable `/tmp` are
  correct.
- Upload a file, `docker compose restart backend`, confirm it's still
  served — confirms the `uploads-data` volume persists.
- Log in with the `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` you set — not the
  eventsh.com defaults.
- From the tenant's actual frontend origin, confirm API requests succeed
  (CORS is correctly reading `CORS_ORIGINS`).

## Updating a deployment later

```bash
git pull
docker compose -f docker-compose.whitelabel.yml --env-file .env.whitelabel build
docker compose -f docker-compose.whitelabel.yml --env-file .env.whitelabel up -d
```

## What's NOT covered by this deployment mode

- **Cosmetic branding** — footer/legal-page/PDF-watermark/chatbot-persona
  text still says "EventSH" today. Tracked as a separate follow-up pass, not
  part of this Docker packaging work.
- **Custom functionality beyond core eventsh** — handled case by case in the
  customer's own fork, not a built-in extensibility system.
- **Fully custom frontend redesign for the event page (eventFront.tsx)** —
  only the landing page and organizer storefront have (or will have) a
  swappable-template system; eventFront.tsx is a large separate refactor,
  not yet started.
