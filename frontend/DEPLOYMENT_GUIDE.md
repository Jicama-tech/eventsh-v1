# EventFlow Production Deployment Guide
## Self-Hosting on Ubuntu Server

### 🖥️ Server Requirements

**Minimum Specifications:**
- Ubuntu 20.04 LTS or 22.04 LTS
- 4GB RAM (8GB+ recommended)
- 2 CPU cores (4+ recommended)
- 50GB storage (100GB+ recommended)
- Public IP address

---

## 📋 Pre-deployment Checklist

### 1. Initial Server Setup
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Create deployment user
sudo adduser eventflow
sudo usermod -aG sudo eventflow
su - eventflow
```

### 2. Security Configuration
```bash
# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Configure SSH (optional - disable password auth)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
# Set: PubkeyAuthentication yes
sudo systemctl restart ssh
```

---

## 🗄️ Database Setup (PostgreSQL)

### 1. Install PostgreSQL 15
```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/pub/repos/apt/ACME-GPG-KEY.txt | sudo apt-key add -
sudo apt update

# Install PostgreSQL
sudo apt install -y postgresql-15 postgresql-client-15 postgresql-contrib-15

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Configure PostgreSQL
```bash
# Switch to postgres user
sudo -u postgres psql

-- Create database and user
CREATE DATABASE eventflow_prod;
CREATE USER eventflow_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE eventflow_prod TO eventflow_user;
ALTER USER eventflow_user CREATEDB;

-- Enable required extensions
\c eventflow_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Exit psql
\q
```

### 3. Configure PostgreSQL for Production
```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/15/main/postgresql.conf

# Key settings to modify:
# listen_addresses = '*'
# max_connections = 100
# shared_buffers = 1GB (25% of RAM)
# effective_cache_size = 3GB (75% of RAM)
# work_mem = 10MB
# maintenance_work_mem = 256MB
# wal_buffers = 16MB
# checkpoint_completion_target = 0.9
# random_page_cost = 1.1

# Edit access control
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Add line for application access:
# host    eventflow_prod    eventflow_user    127.0.0.1/32    md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## 🔧 Backend Setup Options

### Option A: Self-hosted Supabase (Advanced)
```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker eventflow

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone Supabase
git clone --depth 1 https://github.com/supabase/supabase.git
cd supabase/docker

# Configure environment
cp .env.example .env
nano .env

# Key variables to set:
# POSTGRES_PASSWORD=your_secure_password
# JWT_SECRET=your_jwt_secret
# ANON_KEY=your_anon_key
# SERVICE_ROLE_KEY=your_service_role_key

# Start Supabase
docker-compose up -d
```

### Option B: Node.js Backend (Recommended for Production)
```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

---

## 🌐 Frontend Setup

### 1. Install and Configure Nginx
```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Create site configuration
sudo nano /etc/nginx/sites-available/eventflow

# Add configuration:
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    root /var/www/eventflow;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/eventflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Deploy Frontend Application
```bash
# Create deployment directory
sudo mkdir -p /var/www/eventflow
sudo chown eventflow:eventflow /var/www/eventflow

# Clone your repository
cd /home/eventflow
git clone https://github.com/your-username/eventflow.git
cd eventflow

# Install dependencies and build
npm install
npm run build

# Copy build files to web directory
sudo cp -r dist/* /var/www/eventflow/
sudo chown -R www-data:www-data /var/www/eventflow
```

---

## 🔐 SSL Certificate Setup

### 1. Install Certbot
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### 2. Configure SSL in Nginx (Auto-generated by Certbot)
The SSL configuration will be automatically added to your Nginx config.

---

## 🚀 Process Management with PM2

### 1. Install PM2 (for Node.js backend)
```bash
# Install PM2 globally
sudo npm install -g pm2

# Create ecosystem file
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'eventflow-api',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DATABASE_URL: 'postgresql://eventflow_user:your_secure_password@localhost:5432/eventflow_prod'
    }
  }]
};
```

```bash
# Start application with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 📊 Monitoring and Logging

### 1. Install Monitoring Tools
```bash
# Install htop for system monitoring
sudo apt install -y htop

# Install log rotation
sudo apt install -y logrotate

# Configure log rotation for application
sudo nano /etc/logrotate.d/eventflow
```

### 2. Setup Application Monitoring
```bash
# Install PM2 monitoring (for Node.js apps)
pm2 install pm2-logrotate

# Configure PostgreSQL logging
sudo nano /etc/postgresql/15/main/postgresql.conf
# Uncomment and set:
# log_statement = 'all'
# log_duration = on
# log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

---

## 🔧 Environment Configuration

### 1. Create Environment Files
```bash
# Backend environment
nano /home/eventflow/eventflow/.env.production

# Example content:
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://eventflow_user:your_secure_password@localhost:5432/eventflow_prod
JWT_SECRET=your_jwt_secret_here
STRIPE_SECRET_KEY=your_stripe_secret_key
CORS_ORIGIN=https://your-domain.com
```

### 2. Frontend Environment
```bash
# Create production environment for frontend
nano /home/eventflow/eventflow/.env.production

# Example content:
VITE_API_URL=https://your-domain.com/api
VITE_SUPABASE_URL=https://your-domain.com
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## 📈 Database Migration and Setup

### 1. Run Database Migrations
```bash
# Connect to database and run your schema
psql -h localhost -U eventflow_user -d eventflow_prod

-- Run your table creation scripts
-- Copy your existing Supabase schema here
```

### 2. Data Import (if migrating from Supabase)
```bash
# Export from Supabase (if needed)
# Import to local PostgreSQL
psql -h localhost -U eventflow_user -d eventflow_prod < backup.sql
```

---

## 🛠️ Deployment Automation

### 1. Create Deployment Script
```bash
nano /home/eventflow/deploy.sh
chmod +x /home/eventflow/deploy.sh
```

```bash
#!/bin/bash
set -e

echo "Starting deployment..."

# Pull latest changes
cd /home/eventflow/eventflow
git pull origin main

# Install dependencies
npm install

# Build frontend
npm run build

# Deploy frontend
sudo cp -r dist/* /var/www/eventflow/
sudo chown -R www-data:www-data /var/www/eventflow

# Restart backend (if using PM2)
pm2 reload ecosystem.config.js

# Restart Nginx
sudo systemctl reload nginx

echo "Deployment completed successfully!"
```

### 2. Setup Automated Backups
```bash
# Create backup script
nano /home/eventflow/backup.sh
chmod +x /home/eventflow/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/eventflow/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
pg_dump -h localhost -U eventflow_user eventflow_prod > $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_backup_$DATE.sql"
```

```bash
# Add to crontab for daily backups
crontab -e
# Add: 0 2 * * * /home/eventflow/backup.sh
```

---

## 🔍 Health Monitoring Setup

### 1. Basic Health Check Script
```bash
nano /home/eventflow/health-check.sh
chmod +x /home/eventflow/health-check.sh
```

```bash
#!/bin/bash

# Check Nginx
if ! systemctl is-active --quiet nginx; then
    echo "Nginx is down! Restarting..."
    sudo systemctl restart nginx
fi

# Check PostgreSQL
if ! systemctl is-active --quiet postgresql; then
    echo "PostgreSQL is down! Restarting..."
    sudo systemctl restart postgresql
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Disk usage is at ${DISK_USAGE}%"
fi

# Check memory usage
MEM_USAGE=$(free | awk 'NR==2{printf "%.2f", $3*100/$2}')
if (( $(echo "$MEM_USAGE > 90" | bc -l) )); then
    echo "Memory usage is at ${MEM_USAGE}%"
fi
```

---

## 🚀 Final Production Checklist

### 1. Security Hardening
- [ ] Firewall configured (only ports 22, 80, 443 open)
- [ ] SSH key-based authentication enabled
- [ ] Database access restricted to localhost
- [ ] SSL certificates installed and auto-renewal configured
- [ ] Regular security updates scheduled

### 2. Performance Optimization
- [ ] Nginx gzip compression enabled
- [ ] Database connection pooling configured
- [ ] Static asset caching configured
- [ ] CDN setup (optional)

### 3. Monitoring and Maintenance
- [ ] Log rotation configured
- [ ] Automated backups scheduled
- [ ] Health monitoring scripts in place
- [ ] Update procedures documented

### 4. Testing
- [ ] All application features working
- [ ] SSL certificate valid
- [ ] Database connections successful
- [ ] File permissions correct
- [ ] Backup and restore procedures tested

---

## 🛠️ Troubleshooting Common Issues

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Test connection
psql -h localhost -U eventflow_user -d eventflow_prod
```

### Nginx Issues
```bash
# Check Nginx status
sudo systemctl status nginx

# Test Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Application Issues
```bash
# Check PM2 processes
pm2 status
pm2 logs

# Check application logs
tail -f /home/eventflow/eventflow/logs/app.log
```

---

## 📋 Maintenance Commands

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
cd /home/eventflow/eventflow
npm update

# Rebuild and redeploy
./deploy.sh

# Check system health
./health-check.sh

# Manual backup
./backup.sh

# Check PM2 processes
pm2 monit
```

---

**⚠️ Important Notes:**

1. **Replace all placeholder values** (passwords, domains, keys) with your actual values
2. **Test the deployment** in a staging environment first
3. **Keep your secrets secure** and use environment variables
4. **Monitor your server** regularly for performance and security
5. **Have a rollback plan** ready in case of deployment issues

This setup provides a robust, production-ready deployment of your EventFlow platform on Ubuntu server! 🚀