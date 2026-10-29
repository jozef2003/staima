"""Dedupe leads gegen Vorwochen via fingerprint — mit Eskalations-Erkennung.

Markiert einen Lead als `is_duplicate=true` wenn sein fingerprint
(projekt+standort, sha1) schon in einem älteren Lead vorkommt.
Wir löschen nicht — Audit-Trail bleibt erhalten, Dashboard + Teams-Post
filtern auf is_duplicate=false.

ESKALATION (Briefing-Anforderung "ausser bei wesentlichen Neuigkeiten"):
Taucht ein bekanntes Projekt erneut auf, aber mit HÖHEREM Potenzial als
bisher (z.B. Mittel→Hoch weil jetzt Anwohnerproteste), ist das kein
Duplikat sondern genau der Moment für CRK → Lead bleibt im Briefing,
mit Eskalations-Hinweis. Gleiches/niedrigeres Potenzial → Duplikat wie bisher.
"""
from __future__ import annotations

import logging

import db

log = logging.getLogger(__name__)

# Kleiner = besser. Unbekannt/None = schlechtester Rang.
_RANK = {'Hoch': 0, 'Mittel': 1, 'Tief': 2}


def _rank(potenzial: str | None) -> int:
    return _RANK.get((potenzial or '').strip().capitalize(), 3)


def mark_duplicates() -> int:
    """Markiert jeden Lead, dessen fingerprint einem ÄLTEREN Lead entspricht —
    ausser sein Potenzial ist höher als alles bisher Gesehene zu diesem
    Projekt (Eskalation → bleibt sichtbar, Hinweis im Lead).

    Two-pass: lade alle leads sortiert nach id, merke pro fingerprint den
    besten bisherigen Rang, entscheide ab dem 2. Auftreten.
    """
    leads = db.select('crk_leads', {
        'select': 'id,fingerprint,is_duplicate,potenzial,recherche_hinweis',
        'order': 'id.asc',
        'fingerprint': 'not.is.null',
    })
    # fingerprint -> bester (niedrigster) bisher gesehener Rang
    best_seen: dict[str, int] = {}
    to_mark: list[int] = []
    escalations: list[tuple[int, str, int, int]] = []  # (id, fp, alt, neu)
    for lead in leads:
        fp = lead.get('fingerprint')
        if not fp:
            continue
        r = _rank(lead.get('potenzial'))
        if fp not in best_seen:
            best_seen[fp] = r
            continue
        if r < best_seen[fp]:
            # Eskalation: bekanntes Projekt, Potenzial gestiegen → KEIN Duplikat
            escalations.append((lead['id'], fp, best_seen[fp], r))
            best_seen[fp] = r
        elif not lead.get('is_duplicate'):
            to_mark.append(lead['id'])

    log.info('found %d new duplicates, %d escalations among %d leads',
             len(to_mark), len(escalations), len(leads))

    for lead_id in to_mark:
        try:
            db.update('crk_leads', {'id': lead_id}, {'is_duplicate': True})
        except Exception as e:
            log.warning('mark dup %d failed: %s', lead_id, e)

    _names = {v: k for k, v in _RANK.items()}
    for lead_id, fp, old_r, new_r in escalations:
        lead = next((l for l in leads if l['id'] == lead_id), {})
        note = (f'⬆️ Eskalation: Projekt bereits aus Vorwochen bekannt, '
                f'Potenzial gestiegen ({_names.get(old_r, "?")} → {_names.get(new_r, "?")}).')
        existing = (lead.get('recherche_hinweis') or '').strip()
        if existing and not existing.startswith('⬆️'):
            note = f'{note} {existing}'
        try:
            db.update('crk_leads', {'id': lead_id},
                      {'is_duplicate': False, 'recherche_hinweis': note[:500]})
        except Exception as e:
            log.warning('mark escalation %d failed: %s', lead_id, e)

    return len(to_mark)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    n = mark_duplicates()
    print(f'marked {n} duplicates')
