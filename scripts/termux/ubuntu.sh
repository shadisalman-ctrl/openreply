#!/usr/bin/env bash
set -euo pipefail
cd /opt/openreply
export NVM_DIR="$HOME/.nvm"
if [[ ${1:-} == install ]]; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y git curl ca-certificates openssl build-essential python3 wget postgresql redis-server
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh -o /tmp/openreply-nvm-install.sh
    bash /tmp/openreply-nvm-install.sh
  fi
  source "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm alias default 22
  if ! command -v ngrok >/dev/null; then
    curl -fsSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc -o /etc/apt/trusted.gpg.d/ngrok.asc
    echo 'deb https://ngrok-agent.s3.amazonaws.com bookworm main' > /etc/apt/sources.list.d/ngrok.list
    apt-get update
    apt-get install -y ngrok
  fi
  node scripts/termux/setup-env.mjs --validate
  service postgresql start
  if ! redis-cli ping >/dev/null 2>&1; then redis-server --daemonize yes --bind 127.0.0.1; fi
  node scripts/termux/setup-env.mjs
  npm ci
  npm run db:generate
  npm run db:migrate
  exit 0
fi
source "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null
if [[ ${1:-} == services ]]; then
  node scripts/termux/setup-env.mjs --validate
  service postgresql start
  if ! redis-cli ping >/dev/null 2>&1; then redis-server --daemonize yes --bind 127.0.0.1; fi
else
  exec node scripts/termux/run.mjs "${1:-}"
fi
