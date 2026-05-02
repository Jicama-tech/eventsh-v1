#!/bin/bash
# Auto-deploy script for Eventsh
# Triggered by GitHub webhook or manually: bash autodeploy.sh [frontend|backend|both]

set -eo pipefail

PROJ="/home/eventshadmin/eventsh/eventsh-v1"
LOG="/home/eventshadmin/eventsh/deploy.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"
}

sync_repo() {
  # Hard-reset to origin/main so runtime-generated files (e.g. uploads,
  # whatsapp-qr.png) never block the pull. Anything not committed will be
  # discarded — this server is a deployment target, not a workspace.
  git fetch origin main 2>&1 | tee -a "$LOG"
  git reset --hard origin/main 2>&1 | tee -a "$LOG"
  git clean -fd 2>&1 | tee -a "$LOG"
}

deploy_frontend() {
  log "=== Deploying Frontend ==="
  cd "$PROJ/frontend"
  sync_repo
  npm install --legacy-peer-deps 2>&1 | tee -a "$LOG"
  rm -rf dist
  npm run build 2>&1 | tee -a "$LOG"
  log "Frontend deployed!"
}

deploy_backend() {
  log "=== Deploying Backend ==="
  cd "$PROJ/backend"
  sync_repo
  npm install --legacy-peer-deps 2>&1 | tee -a "$LOG"
  npm run build 2>&1 | tee -a "$LOG"
  pm2 restart eventsh-backend 2>&1 | tee -a "$LOG"
  log "Backend deployed!"
}

case "${1:-both}" in
  frontend) deploy_frontend ;;
  backend)  deploy_backend ;;
  both)     deploy_frontend && deploy_backend ;;
  *)        echo "Usage: bash autodeploy.sh [frontend|backend|both]" ;;
esac

log "=== Deploy complete ==="
