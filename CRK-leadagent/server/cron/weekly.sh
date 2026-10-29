#!/bin/bash
# TÄGLICHER Voll-Lauf (per crontab 04:00 UTC). Alles sequenziell in einem:
# crawl -> prefilter -> fulltext -> classify -> score -> enrich -> dedupe -> post.
# Sequenziell = keine Race-Conditions zwischen den Steps. Jeder Step idempotent.
# Teams-Post zeigt nur die HEUTE neuen Leads (output/teams_post.py).
#
# Fehler-Verhalten: tolerante Steps (crawl/prefilter/fulltext/enrich) loggen +
# laufen weiter. Kritische Steps (classify/score/dedupe/post) brechen ab —
# dann feuert der ERR-Trap einen Teams-Alert, damit ein stiller Ausfall
# nicht erst nach Tagen auffällt (TEAMS_WEBHOOK_URL / TEAMS_ALERT_WEBHOOK_URL).
set -euo pipefail
cd /home/saemi/saemi
set -a; source .env 2>/dev/null || true; set +a
cd server
source .venv/bin/activate

mkdir -p /home/saemi/saemi/logs
LOG=/home/saemi/saemi/logs/weekly-$(date +%Y%m%d-%H%M).log
exec >>"$LOG" 2>&1

STEP="init"
on_error() {
    echo "── $(date -Is) FAILED at step: $STEP"
    TAIL=$(tail -n 12 "$LOG" | head -n 10)
    python -m notify "⚠️ **Sämi-Pipeline fehlgeschlagen** — Step: \`$STEP\` ($(date -Is)). Kein Briefing heute! Log: \`$LOG\`

\`\`\`
$TAIL
\`\`\`" || true
}
trap on_error ERR

echo "── $(date -Is) weekly run start"

STEP="crawl";          python -m crawlers.run_all        || echo "crawl: errors (continuing)"
STEP="prefilter";      python -m pipeline.prefilter      || echo "prefilter: errors (continuing)"
STEP="fetch_fulltext"; python -m pipeline.fetch_fulltext || echo "fetch_fulltext: errors (continuing)"
STEP="classify";       python -m pipeline.classify
STEP="score";          python -m pipeline.score
STEP="enrich";         python -m pipeline.enrich         || echo "enrich: errors (continuing)"
STEP="dedupe";         python -m pipeline.dedupe
STEP="post";           python -m output.teams_post

echo "── $(date -Is) weekly run done"
