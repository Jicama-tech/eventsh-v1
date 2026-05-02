# Eventsh — Server Deployment Guide

> Server: Ubuntu (eventshadmin@srv866262)
> Path: `/home/eventshadmin/eventsh/eventsh-v1/`
> Backend port: **3002** (kioscart uses 3000 — must not collide)
> Webhook port: **9001** (kioscart uses 9000)

---

## Table of Contents

1. [Initial Server Setup](#1-initial-server-setup)
2. [Backend Deployment](#2-backend-deployment)
3. [Frontend Deployment](#3-frontend-deployment)
4. [Nginx Configuration](#4-nginx-configuration)
5. [SSL with Certbot](#5-ssl-with-certbot)
6. [Auto-Deploy Setup](#6-auto-deploy-setup)
7. [Making Changes & Redeploying](#7-making-changes--redeploying)
8. [Useful Commands](#8-useful-commands)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Initial Server Setup

Most prerequisites are already installed (Node, PM2, Nginx, Certbot, MongoDB) since kioscart runs on the same VPS. Only need to:

```bash
# Create the eventsh project directory
sudo mkdir -p /home/eventshadmin/eventsh
sudo chown -R eventshadmin:eventshadmin /home/eventshadmin/eventsh

# Clone the repo
cd /home/eventshadmin/eventsh
git clone https://github.com/Jicama-tech/eventsh-v1.git
```

---

## 2. Backend Deployment

### Directory: `/home/eventshadmin/eventsh/eventsh-v1/backend/`

```bash
cd /home/eventshadmin/eventsh/eventsh-v1/backend

# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Create .env file
nano .env
# Required variables:
#   PORT=3002
#   MONGODB_URI=mongodb://localhost:27017/eventsh
#   JWT_SECRET=your_jwt_secret
#   FRONTEND_URL=https://eventsh.com
#   GOOGLE_CLIENT_ID=...
#   GOOGLE_CLIENT_SECRET=...
#   RAZORPAY_KEY_ID=...
#   RAZORPAY_KEY_SECRET=...
#   OPENAI_API_KEY=...
#   (add all other required env vars from your local .env)

# 3. Build the project
npm run build

# 4. Create uploads directory
mkdir -p uploads

# 5. Start with PM2
pm2 start dist/main.js --name eventsh-backend

# 6. Save PM2 process list (auto-restart on reboot)
pm2 save
pm2 startup  # follow the printed command if not already done for kioscart
```

---

## 3. Frontend Deployment

### Directory: `/home/eventshadmin/eventsh/eventsh-v1/frontend/`

```bash
cd /home/eventshadmin/eventsh/eventsh-v1/frontend

# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Create .env file
nano .env
# Required:
#   VITE_API_URL=https://eventsh.com/api
#   VITE_GOOGLE_CLIENT_ID=...
#   VITE_RAZORPAY_KEY_ID=...

# 3. Build for production
npm run build
# Creates a dist/ folder with static files
```

---

## 4. Nginx Configuration

### Create Nginx config:

```bash
sudo nano /etc/nginx/sites-available/eventsh
```

```nginx
server {
    listen 80;
    server_name eventsh.com www.eventsh.com;

    # Frontend — serve static files from dist/
    root /home/eventshadmin/eventsh/eventsh-v1/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Long-term cache for hashed Vite assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # API reverse proxy — routes /api/* to backend on port 3002
    location /api/ {
        proxy_pass http://localhost:3002/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }

    # GitHub deploy webhook — routes to webhook-server.js on port 9001
    location /api/deploy-webhook {
        proxy_pass http://localhost:9001/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Hub-Signature-256 $http_x_hub_signature_256;
    }

    # SPA fallback — all routes go to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/eventsh /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. SSL with Certbot

```bash
sudo certbot --nginx -d eventsh.com -d www.eventsh.com

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## 6. Auto-Deploy Setup

There are two complementary mechanisms — set up both:

### A. GitHub Actions (`.github/workflows/deploy.yml`)

Add these secrets in GitHub → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `VPS_HOST` | server IP or hostname |
| `VPS_USER` | `eventshadmin` |
| `VPS_PORT` | SSH port (usually `22`) |
| `VPS_SSH_KEY` | private SSH key (full contents of `~/.ssh/id_rsa` or equivalent) |

The workflow fires on every push to `main` and runs build + restart.

### B. Webhook server (`deployment/webhook-server.js`)

Smarter than the GitHub Action — only redeploys what changed (frontend/backend/both).

```bash
cd /home/eventshadmin/eventsh/eventsh-v1/deployment
chmod +x autodeploy.sh

# Start the webhook listener with PM2
WEBHOOK_SECRET=your_long_random_secret pm2 start webhook-server.js --name eventsh-webhook
pm2 save

# Then in GitHub: Repo → Settings → Webhooks → Add webhook
#   Payload URL:  https://eventsh.com/api/deploy-webhook
#   Content type: application/json
#   Secret:       <same as WEBHOOK_SECRET>
#   Events:       Just the push event
```

You can also trigger manually:
```bash
bash /home/eventshadmin/eventsh/eventsh-v1/deployment/autodeploy.sh both
bash /home/eventshadmin/eventsh/eventsh-v1/deployment/autodeploy.sh frontend
bash /home/eventshadmin/eventsh/eventsh-v1/deployment/autodeploy.sh backend
```

---

## 7. Making Changes & Redeploying

Just push to `main` — both auto-deploy mechanisms will fire. To verify:

```bash
# Watch deploy log
tail -f /home/eventshadmin/eventsh/deploy.log

# Watch webhook events
pm2 logs eventsh-webhook

# Watch backend after restart
pm2 logs eventsh-backend
```

---

## 8. Useful Commands

### PM2

```bash
pm2 status                        # all processes (eventsh-backend, eventsh-webhook, kioscart-backend, kioscart-webhook)
pm2 logs eventsh-backend          # backend logs
pm2 logs eventsh-webhook          # webhook logs
pm2 restart eventsh-backend       # restart backend
pm2 restart eventsh-webhook       # restart webhook listener
pm2 monit                         # real-time monitoring
```

### Nginx

```bash
sudo nginx -t                                   # test config
sudo systemctl reload nginx                     # reload (no downtime)
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### MongoDB

```bash
mongosh                                         # connect
mongosh --eval "use eventsh; db.stats()"        # quick DB stats
```

---

## 9. Troubleshooting

### Backend not starting?
```bash
pm2 logs eventsh-backend --lines 50
cat /home/eventshadmin/eventsh/eventsh-v1/backend/.env
```

### Port 3002 collision?
```bash
sudo lsof -i :3002     # confirm only eventsh-backend listens
```

### Frontend showing blank page?
```bash
ls -la /home/eventshadmin/eventsh/eventsh-v1/frontend/dist/
cat /home/eventshadmin/eventsh/eventsh-v1/frontend/.env
```

### Webhook not firing?
```bash
pm2 logs eventsh-webhook
# In GitHub: Settings → Webhooks → Recent Deliveries → check response
```

### CORS errors?
- Check `ALLOWED_DOMAINS` / CORS config in `backend/src/main.ts`
- Ensure both `https://eventsh.com` and `https://www.eventsh.com` are listed

### 502 Bad Gateway?
```bash
pm2 status
curl http://localhost:3002
```

### SSL expired?
```bash
sudo certbot renew
sudo systemctl reload nginx
```
