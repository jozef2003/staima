#!/bin/bash
# Briefing-Step 3: Scoring + Enrichment. So 23:00.
set -euo pipefail
cd /home/saemi/saemi
set -a; source .env 2>/dev/null || true; set +a
cd server
source .venv/bin/activate
mkdir -p /home/saemi/saemi/logs
exec >>"/home/saemi/saemi/logs/score-$(date +%Y%m%d-%H%M).log" 2>&1
echo "── $(date -Is) score start"
python -m pipeline.score
python -m pipeline.enrich || echo "enrich: errors (continuing)"
echo "── $(date -Is) score done"
