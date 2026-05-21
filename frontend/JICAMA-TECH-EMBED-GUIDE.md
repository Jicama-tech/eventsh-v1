# jicama.tech `/events` Embed — Implementation & Deployment Guide

## What this delivers

When a visitor opens **`https://jicama.tech/events`**, the page shows the
existing eventsh.com storefront for the organizer slug
**`jicama-tech-singapore`** — without leaving the `jicama.tech` URL. Clicking
into an event takes them to **`https://jicama.tech/events/<event-id>`**.
Internally, the page is the same React SPA already deployed at
`https://eventsh.com/jicama-tech-singapore`; we just expose it under a
partner path.

The existing `jicama.tech` homepage at `/` is **not** affected.
The existing `eventsh.com/events` listing page and every other eventsh.com
route is **not** affected — the new behaviour only activates when the
hostname is `jicama.tech`.

---

## How it works (one paragraph)

The Hostinger Nginx that serves `jicama.tech` adds one `location /events`
block that reverse-proxies to `https://eventsh.com`. The eventsh React app
detects `window.location.hostname === "jicama.tech"` at runtime and routes
`/events` → `<OrganizerStorefront organizationName="jicama-tech-singapore">`
and `/events/:id` → `<EventFront>`. The Vite production build uses
`https://eventsh.com/` as its asset base, so the HTML proxied by Nginx
references absolute asset URLs (`<script src="https://eventsh.com/assets/…">`)
and browsers fetch JS/CSS straight from eventsh.com — Nginx never has to
proxy our hashed bundles.

---

## Step-by-step — what's in this PR

### 1. New helper — `frontend/src/lib/embedHost.ts`

Single source of truth for partner domains. One map:

```ts
const EMBED_HOSTS: Record<string, string> = {
  "jicama.tech": "jicama-tech-singapore",
};
```

Exports:

- `getEmbedOrgSlug()` — returns `"jicama-tech-singapore"` on jicama.tech,
  `null` on eventsh.com. The router uses this.
- `getEventBasePath(orgSlug)` — returns `/events` when the slug matches the
  embed host, otherwise the canonical `/<orgSlug>/events`. The storefront
  uses this when generating event-detail links so URLs stay inside
  jicama.tech.

Add a new partner later by appending one line to `EMBED_HOSTS`. No other
file needs to change.

### 2. Router — `frontend/src/App.tsx`

Added two conditional routes inside the not-logged-in block and the
`user`-role block, gated on `getEmbedOrgSlug()`:

```jsx
<Route
  path="/events"
  element={embedOrgSlug
    ? <OrganizerStorefront organizationName={embedOrgSlug} onBack={…}/>
    : <Events />}
/>
{embedOrgSlug && <Route path="/events/:id" element={<EventFront …/>} />}
```

On **eventsh.com**, `embedOrgSlug` is `null`, so `/events` renders the
existing `<Events />` listing exactly as before and `/events/:id` is not
registered (404 → catch-all `/`, same as today).

On **jicama.tech**, `embedOrgSlug` is `"jicama-tech-singapore"`, so the
two routes render the storefront and event-detail components.

### 3. Storefront — `frontend/src/components/user/organizerStoreFront.tsx`

Two small changes:

- The component now accepts an optional `organizationName` prop that
  overrides the `:organizationName` URL param. This lets the partner-embed
  route pass the slug in directly, since `/events` has no slug in the path.
- The "click into an event" handler now calls `getEventBasePath()` so the
  navigate target is `/events/<id>` on jicama.tech and the canonical
  `/<slug>/events/<id>` on eventsh.com.

`EventFront` did not need changes — it already reads the event id from
`useParams().id` and fetches by id alone.

### 4. Build base — `frontend/vite.config.ts`

```ts
base: mode === "production" ? "https://eventsh.com/" : "/",
```

Production HTML now references assets as absolute eventsh.com URLs.
Development is unchanged (`/`). Override via `VITE_PUBLIC_BASE` if the
bundle ever moves.

---

## Step-by-step — what to deploy on the jicama.tech Nginx

Edit your existing `server { server_name jicama.tech; … }` block on the
Hostinger VPS and add **one location block before any `location /`
catch-all**:

```nginx
location ^~ /events {
    proxy_pass https://eventsh.com;
    proxy_http_version 1.1;
    proxy_set_header Host eventsh.com;
    proxy_set_header X-Forwarded-Host jicama.tech;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Real-IP $remote_addr;

    # eventsh.com is HTTPS — required for the upstream TLS handshake.
    proxy_ssl_server_name on;

    # Don't rewrite Location headers; we want eventsh.com's responses
    # passed through verbatim so React Router sees the original path.
    proxy_redirect off;

    # SPA returns HTML; do not cache between users.
    proxy_buffering off;
}
```

Reload Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

That is the only server-side change. The eventsh.com deployment serves the
React bundle as usual.

### Why `^~ /events`?

`^~` makes Nginx prefer this prefix-match over any regex location in the
same server, so partner traffic never accidentally falls into a PHP/static
handler meant for the jicama.tech homepage.

### Why no `sub_filter`?

Because step 4 of the React change makes the SPA emit absolute asset URLs
(`https://eventsh.com/assets/…`). The browser fetches scripts straight
from eventsh.com, so we don't need Nginx to rewrite HTML. This keeps the
config short and avoids needing the optional `ngx_substitutions_filter`
module on Hostinger.

---

## Step-by-step — adding the "Events" button on jicama.tech

In the jicama.tech homepage HTML/template, the existing CTA should point at:

```html
<a href="/events">Events</a>
```

That's it — no JavaScript, no iframe, no new domain. The user stays on
jicama.tech; Nginx proxies the page; React Router handles the in-page
navigation from there.

---

## Verification checklist

After deploying the frontend bundle and reloading Nginx:

1. **eventsh.com regression check** — open the items below and confirm
   each still works exactly as it did before:
   - `https://eventsh.com/` (landing page)
   - `https://eventsh.com/events` (events listing — must NOT show the
     jicama storefront)
   - `https://eventsh.com/jicama-tech-singapore` (canonical storefront)
   - `https://eventsh.com/jicama-tech-singapore/events/<any-event-id>`
   - Organizer login + dashboard
2. **Partner embed check:**
   - `https://jicama.tech/` — homepage unchanged.
   - `https://jicama.tech/events` — shows jicama-tech-singapore
     storefront; URL bar reads `jicama.tech/events`.
   - Click any event — URL becomes `jicama.tech/events/<event-id>`,
     event detail page renders.
   - DevTools → Network — JS/CSS load from `eventsh.com/assets/*` (200 OK).
   - DevTools → Network — `/api/*` requests go to the eventsh backend
     (`VITE_API_URL`).
3. **Mobile sanity** — open the URLs on a phone; confirm the storefront
   is responsive and the "Buy Ticket" flow reaches the payment page.

---

## Adding another partner later

1. Append one line to `EMBED_HOSTS` in `embedHost.ts`:
   ```ts
   "another-domain.com": "another-organizer-slug",
   ```
2. Add the same `location ^~ /events { … }` block on that partner's Nginx,
   pointed at `https://eventsh.com`.
3. Rebuild and redeploy the eventsh frontend.

No other code or server config changes are needed.

---

## Rollback

If anything misbehaves:

- **Server-side:** comment out the `location ^~ /events { … }` block on
  jicama.tech and `systemctl reload nginx`. Traffic to `jicama.tech/events`
  falls back to the default jicama.tech behaviour (likely 404), and
  eventsh.com is unaffected.
- **App-side:** revert this PR. `getEmbedOrgSlug()` always returns `null`,
  so `/events` becomes the eventsh.com listing again. Existing
  eventsh.com routes never depended on the new code, so reverting is
  zero-risk.

---

## Known caveats (acknowledged)

- **SEO duplicate content** — `jicama.tech/events` and
  `eventsh.com/jicama-tech-singapore` serve the same HTML. Recommended
  follow-up: set `<link rel="canonical" href="https://eventsh.com/…">` in
  the storefront `<Helmet>` so search engines credit eventsh.com.
- **Asset origin visible** — DevTools shows assets loading from
  `eventsh.com`. Acceptable per the requirements.
- **Slug rename** — if the organizer slug ever changes from
  `jicama-tech-singapore`, update `EMBED_HOSTS` and redeploy.
