#!/bin/bash
# Briefing-Step 2: Vorfilter → Volltext → Relevanzprüfung. So 22:00.
set -euo pipefail
cd /home/saemi/saemi
set -a; source .env 2>/dev/null || true; set +a
cd server
source .venv/bin/activate
mkdir -p /home/saemi/saemi/logs
exec >>"/home/saemi/saemi/logs/classify-$(date +%Y%m%d-%H%M).log" 2>&1
echo "── $(date -Is) classify start"
python -m pipeline.prefilter      || echo "prefilter: errors (continuing)"
python -m pipeline.fetch_fulltext || echo "fetch_fulltext: errors (continuing)"
python -m pipeline.classify
echo "── $(date -Is) classify done"
