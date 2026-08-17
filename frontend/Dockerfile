# syntax=docker/dockerfile:1
#
# Multi-stage build for the eventsh frontend (Vite + React SPA), served by
# Nginx. Built PER white-label tenant (see docs/WHITE_LABEL_DEPLOYMENT.md) —
# the build ARGs below are baked directly into the JS bundle by Vite (see
# `define`/`import.meta.env` in vite.config.ts), not read at container
# runtime, so a distinct image build is required per tenant rather than one
# shared image reused with a swapped env file.

# ---- builder ------------------------------------------------------------------
FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
# --legacy-peer-deps matches the existing deploy script (deployment/autodeploy.sh,
# .github/workflows/deploy.yml) — this repo currently needs it to install clean.
RUN npm install --legacy-peer-deps

COPY . .

ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_APPYFLOW_KEY_SECRET
ARG VITE_PUBLIC_BASE
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_APPYFLOW_KEY_SECRET=$VITE_APPYFLOW_KEY_SECRET \
    VITE_PUBLIC_BASE=$VITE_PUBLIC_BASE

RUN npm run build

# ---- runtime ------------------------------------------------------------------
FROM nginx:alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
