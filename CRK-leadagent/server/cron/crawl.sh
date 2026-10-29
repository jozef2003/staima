#!/bin/bash
# Briefing-Step 1: Crawl, einzeln (manuell/debug). Produktiv läuft ALLES
# täglich über weekly.sh (crontab 04:00 UTC) — dieses Script wird vom Cron
# NICHT aufgerufen. Idempotent, mehrere Runs erlaubt.
set -euo pipefail
cd /home/saemi/saemi
set -a; source .env 2>/dev/null || true; set +a
cd server
source .venv/bin/activate
mkdir -p /home/saemi/saemi/logs
exec >>"/home/saemi/saemi/logs/crawl-$(date +%Y%m%d-%H%M).log" 2>&1
echo "── $(date -Is) crawl start"
python -m crawlers.run_all
echo "── $(date -Is) crawl done"
