#!/bin/bash
# Deploy Fabio (Lead Scraper Bot) to Hetzner VPS
# Usage: ./deploy.sh <server-ip>

set -euo pipefail

SERVER_IP="${1:?Usage: ./deploy.sh <server-ip>}"
BOT_DIR="/opt/bots/lead-scraper"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Deploying Fabio to ${SERVER_IP} ==="

# 1. Ensure Python3 + venv on server
echo "--- Installing Python runtime ---"
ssh root@${SERVER_IP} "apt-get update -qq && apt-get install -y -qq python3 python3-pip python3-venv"

# 2. Create bot directory
echo "--- Creating bot directory ---"
ssh root@${SERVER_IP} "mkdir -p ${BOT_DIR}/scrapers ${BOT_DIR}/logs"

# 3. Copy bot files
echo "--- Uploading bot files ---"
scp "${LOCAL_DIR}/main.py" root@${SERVER_IP}:${BOT_DIR}/
scp "${LOCAL_DIR}/config.py" root@${SERVER_IP}:${BOT_DIR}/
scp "${LOCAL_DIR}/sheets.py" root@${SERVER_IP}:${BOT_DIR}/
scp "${LOCAL_DIR}/requirements.txt" root@${SERVER_IP}:${BOT_DIR}/
scp "${LOCAL_DIR}/scrapers/__init__.py" root@${SERVER_IP}:${BOT_DIR}/scrapers/
scp "${LOCAL_DIR}/scrapers/google_maps.py" root@${SERVER_IP}:${BOT_DIR}/scrapers/
scp "${LOCAL_DIR}/scrapers/web_scraper.py" root@${SERVER_IP}:${BOT_DIR}/scrapers/

# 4. Copy secrets
echo "--- Uploading credentials ---"
scp "${LOCAL_DIR}/.env" root@${SERVER_IP}:${BOT_DIR}/
scp "${LOCAL_DIR}/credentials.json" root@${SERVER_IP}:${BOT_DIR}/
if [ -f "${LOCAL_DIR}/authorized_user.json" ]; then
  scp "${LOCAL_DIR}/authorized_user.json" root@${SERVER_IP}:${BOT_DIR}/
fi

# 5. Setup venv + install deps
echo "--- Setting up Python venv ---"
ssh root@${SERVER_IP} "python3 -m venv ${BOT_DIR}/venv && ${BOT_DIR}/venv/bin/pip install -q -r ${BOT_DIR}/requirements.txt"

# 6. Create NemoClaw sandbox
echo "--- Creating NemoClaw sandbox ---"
ssh root@${SERVER_IP} "nemoclaw lead-scraper-prod connect || true"

# 7. Create systemd service + timer
echo "--- Setting up systemd service + timer ---"
ssh root@${SERVER_IP} "cat > /etc/systemd/system/lead-scraper.service << 'EOF'
[Unit]
Description=Fabio (Lead Scraper Bot) (OpenClaw + NemoClaw)
After=network.target

[Service]
Type=oneshot
WorkingDirectory=${BOT_DIR}
EnvironmentFile=${BOT_DIR}/.env
ExecStart=${BOT_DIR}/venv/bin/python ${BOT_DIR}/main.py
StandardOutput=append:${BOT_DIR}/logs/service.log
StandardError=append:${BOT_DIR}/logs/service.log

[Install]
WantedBy=multi-user.target
EOF"

ssh root@${SERVER_IP} "cat > /etc/systemd/system/lead-scraper.timer << 'EOF'
[Unit]
Description=Fabio - Täglich um 8:00 CET

[Timer]
OnCalendar=*-*-* 08:00:00 Europe/Berlin
Persistent=true

[Install]
WantedBy=timers.target
EOF"

# 8. Enable timer
ssh root@${SERVER_IP} "systemctl daemon-reload && systemctl enable --now lead-scraper.timer"

# 9. Test run
echo "--- Running test (dry-run, 3 leads) ---"
ssh root@${SERVER_IP} "${BOT_DIR}/venv/bin/python ${BOT_DIR}/main.py --dry-run --count 3"

echo ""
echo "=== Deploy complete! ==="
echo "Timer status:  ssh root@${SERVER_IP} 'systemctl status lead-scraper.timer'"
echo "Manual run:    ssh root@${SERVER_IP} 'systemctl start lead-scraper'"
echo "Logs:          ssh root@${SERVER_IP} 'cat ${BOT_DIR}/logs/service.log'"
echo "NemoClaw:      ssh root@${SERVER_IP} 'nemoclaw lead-scraper-prod status'"
