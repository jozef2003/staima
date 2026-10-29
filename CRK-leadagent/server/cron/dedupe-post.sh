#!/bin/bash
# Briefing-Step 4+5: Dedupe + Teams-Post. Mo 06:00 → Mo 08:00.
set -euo pipefail
cd /home/saemi/saemi
set -a; source .env 2>/dev/null || true; set +a
cd server
source .venv/bin/activate
mkdir -p /home/saemi/saemi/logs
exec >>"/home/saemi/saemi/logs/dedupe-post-$(date +%Y%m%d-%H%M).log" 2>&1
echo "── $(date -Is) dedupe+post start"
python -m pipeline.dedupe
python -m output.teams_post
echo "── $(date -Is) dedupe+post done"
