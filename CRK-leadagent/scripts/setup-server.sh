#!/bin/bash
# Einmaliges Server-Setup für Sämi auf Hetzner.
# Läuft als ROOT auf 178.104.247.183.
set -euo pipefail

HOST=178.104.247.183
USER=saemi

# 1) User anlegen
ssh root@$HOST "id $USER >/dev/null 2>&1 || adduser --disabled-password --gecos '' $USER && \
                mkdir -p /home/$USER/.ssh && \
                cp /root/.ssh/authorized_keys /home/$USER/.ssh/ && \
                chown -R $USER:$USER /home/$USER/.ssh"

# 2) Postgres + Python + Build-Deps
ssh root@$HOST "apt-get update && \
                DEBIAN_FRONTEND=noninteractive apt-get install -y \
                  postgresql postgresql-contrib python3.11 python3.11-venv \
                  python3-pip git curl build-essential"

# 3) Claude Code installieren (system-weit)
ssh root@$HOST "curl -fsSL https://claude.ai/install.sh | bash || \
                npm install -g @anthropic-ai/claude-code"

# 4) Postgres-DB + User anlegen
ssh root@$HOST "sudo -u postgres psql -c \"CREATE USER saemi WITH PASSWORD 'SET_AT_DEPLOY'\" || true
                sudo -u postgres psql -c 'CREATE DATABASE saemi OWNER saemi' || true"

echo
echo "Setup fertig. Nächste Schritte manuell:"
echo "  1. ssh $USER@$HOST"
echo "  2. claude /login   (CRK-Account)"
echo "  3. git clone <repo-url> ~/saemi"
echo "  4. psql -d saemi -f ~/saemi/db/0001_init.sql"
