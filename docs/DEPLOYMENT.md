# SkyHawk Deployment Guide

## Server: Hetzner VPS (89.167.94.69)

### Prerequisites

On the server:

```bash
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx

# Install PM2 globally
npm install -g pm2
```

### Initial Setup

1. Create the app directory:
```bash
mkdir -p /var/www/skyhawk
```

2. Create `.env` on the server:
```bash
cat > /var/www/skyhawk/.env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
CORS_ORIGIN=http://89.167.94.69
NODE_ENV=production
EOF
```

3. Run the deploy script from your local machine:
```bash
bash scripts/deploy.sh
```

### Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_GOOGLE_MAPS_API_KEY` | Frontend `.env` | Google Maps (browser-visible, restrict by domain) |
| `ANTHROPIC_API_KEY` | Server `.env` | Claude API key (never sent to browser) |
| `PORT` | Server `.env` | Express listen port (default 3001) |
| `CORS_ORIGIN` | Server `.env` | Allowed frontend origin |

### Architecture

```
Browser  -->  Nginx (:80)
                |
                ├── /api/*  --> Express (:3001) --> Anthropic API
                └── /*      --> Static files (dist/)
```

### Useful Commands

```bash
# Check server status
ssh root@89.167.94.69 "pm2 status"

# View server logs
ssh root@89.167.94.69 "pm2 logs skyhawk-api"

# Restart server
ssh root@89.167.94.69 "cd /var/www/skyhawk && pm2 restart ecosystem.config.cjs"
```
