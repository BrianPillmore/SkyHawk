#!/usr/bin/env bash
set -euo pipefail

SERVER="root@89.167.94.69"
SSH_KEY="C:/Users/brian/GitHub/SkyHawk-1/.ssh/id_ed25519"
FRONTEND_DIR="/var/www/skyhawk"
SERVER_DIR="/var/www/skyhawk-server"
SSH_CMD="ssh -i $SSH_KEY $SERVER"

echo "==> Building frontend..."
npx vite build

echo "==> Building server..."
npx tsc -p tsconfig.server.json

echo "==> Cleaning old assets on server..."
$SSH_CMD "rm -rf $FRONTEND_DIR/assets/*"

echo "==> Deploying frontend..."
scp -r -i "$SSH_KEY" dist/* "$SERVER:$FRONTEND_DIR/"

echo "==> Deploying server..."
scp -r -i "$SSH_KEY" dist-server/* "$SERVER:$SERVER_DIR/"

echo "==> Restarting API server..."
$SSH_CMD "cd $SERVER_DIR && pm2 restart skyhawk-api"

echo "==> Deploy complete!"
