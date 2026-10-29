"""Teams-Notifications für Pipeline-Alerts (Fehler, Session-Expiry, Heartbeat).

Nutzt denselben Incoming-Webhook wie das Briefing (TEAMS_WEBHOOK_URL), optional
getrennter Alert-Kanal via TEAMS_ALERT_WEBHOOK_URL. Ohne Webhook: nur Log —
die Pipeline darf an einem fehlenden Webhook nie scheitern.

CLI (für weekly.sh):  python -m notify "⚠️ Nachricht"
"""
from __future__ import annotations

import logging
import os
import sys

import httpx

log = logging.getLogger(__name__)


def alert(text: str) -> bool:
    """Postet `text` in den Teams-Kanal. True wenn zugestellt."""
    url = os.environ.get('TEAMS_ALERT_WEBHOOK_URL') or os.environ.get('TEAMS_WEBHOOK_URL')
    if not url:
        log.warning('kein TEAMS_WEBHOOK_URL gesetzt — Alert nur im Log: %s', text)
        return False
    try:
        r = httpx.post(url, json={'text': text}, timeout=30)
        r.raise_for_status()
        return True
    except Exception as e:
        log.error('Teams-Alert fehlgeschlagen: %s — Text war: %s', e, text)
        return False


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    msg = ' '.join(sys.argv[1:]).strip()
    if not msg:
        print('usage: python -m notify "Nachricht"', file=sys.stderr)
        sys.exit(2)
    sys.exit(0 if alert(msg) else 1)
