# syntax=docker/dockerfile:1
#
# Multi-stage build for the eventsh backend (NestJS + MongoDB via Mongoose).
# See docs/WHITE_LABEL_DEPLOYMENT.md for how this is used to stand up a
# single-tenant white-label deployment.

# ---- builder ----------------------------------------------------------------
FROM node:20-slim AS builder
WORKDIR /app

# Builder never runs Puppeteer, only compiles TypeScript — skip the Chromium
# download here so it only happens once, in the runtime stage below.
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
# --legacy-peer-deps matches the existing deploy script (deployment/autodeploy.sh,
# .github/workflows/deploy.yml) — this repo currently needs it to install clean.
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# ---- runtime ------------------------------------------------------------------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Chromium's runtime shared-library dependencies. Puppeteer (7 modules: tickets,
# venue PDF export, PNL reports, chatbot guide, round-table/speaker/workshop
# confirmations) launches its own bundled Chromium with
# `--no-sandbox --disable-setuid-sandbox` and no executablePath override, so the
# binary it downloads on `npm install` below needs these present to actually run.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libgbm1 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libxcomposite1 \
      libxdamage1 \
      libxrandr2 \
      libxss1 \
      xdg-utils \
      wget \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer's default cache dir is `$HOME/.cache/puppeteer`. This `npm
# install` runs as root (before USER eventsh below), so without this it
# downloads Chrome into /root/.cache/puppeteer — unreadable once the app
# actually runs as the unprivileged `eventsh` system user below, whose
# $HOME resolves to /nonexistent (system users get no home dir). Pinning
# the cache to a fixed path under /app puts it inside the `chown -R
# eventsh:eventsh /app` a few lines down, so the same user that downloaded
# it can also read it. Confirmed via a real container run — Puppeteer
# failed with "Could not find Chrome" (cache path /nonexistent/.cache/...)
# without this.
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/dist ./dist
COPY Fonts ./Fonts

# uploads/ (multer disk storage, served by main.ts's /uploads static route)
# and whatsapp_auth/ (baileys session state, only relevant if WHATSAPP_ENABLED)
# are runtime state — docker-compose mounts named volumes over these paths.
# Creating + chowning them here (rather than letting the app lazily create
# them on first write) means a freshly-created volume inherits the right
# ownership instead of defaulting to root, and explicitly loosening /tmp
# closes off the exact class of bug that broke PDF generation on the old
# bare-VPS deployment (Puppeteer needs a writable /tmp to run at all).
#
# `--home /home/eventsh` matters beyond just having *a* home directory:
# Debian's `adduser --system` with no --home defaults new system accounts to
# HOME=/nonexistent (a literal nonexistent path, intentional upstream
# behaviour for service accounts that aren't expected to need one). Chrome's
# crashpad crash-handler needs a real, writable HOME to set up its crash
# database even when nothing is actually crashing — confirmed via a real
# container run: Puppeteer failed to launch at all ("chrome_crashpad_handler:
# --database is required") with HOME=/nonexistent, no combination of launch
# args (--disable-dev-shm-usage, --disable-crash-reporter) worked around it.
RUN mkdir -p uploads whatsapp_auth \
    && addgroup --system --gid 1001 eventsh \
    && adduser --system --home /home/eventsh --uid 1001 --gid 1001 eventsh \
    && chown -R eventsh:eventsh /app /home/eventsh \
    && chmod 1777 /tmp

ENV HOME=/home/eventsh
USER eventsh

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
