"""Keyword-Vorfilter: billiger Gate VOR dem teuren LLM.

Problem: die RSS-Feeds sind grösstenteils "Wirtschaft" allgemein — hunderte
Markt-/Zins-/Börsenartikel, die der Classifier ohnehin verwirft, aber erst nach
einem teuren `claude -p`-Call pro Stück. Dieser Step kickt offensichtlichen
Noise per Keyword-Match raus (kein LLM, kein Volltext-Fetch) und spart so 70-80%
der LLM-Calls.

Konservativ by design: im Zweifel DURCHLASSEN. Wir markieren nur Artikel als
irrelevant, deren Titel + Teaser KEIN einziges Bau-/Immo-Signal enthalten.
Alles andere bleibt is_relevant=NULL und geht den normalen Weg
(fetch_fulltext → classify → score).
"""
from __future__ import annotations

import logging
import re
import sys

import db

log = logging.getLogger(__name__)

# Bau-/Immobilien-/Kommunikations-Signale. Bewusst breit. Wortstämme, damit
# Flexionen/Komposita greifen (z.B. "überbau" matcht Überbauung, überbaut).
KEYWORDS = [
    # Projekt & Bau
    'bau', 'überbau', 'neubau', 'umbau', 'sanier', 'abriss', 'rückbau',
    'areal', 'überbauung', 'quartier', 'siedlung', 'liegenschaft', 'parzelle',
    'grundstück', 'immobilie', 'immobilien', 'wohnung', 'wohnbau', 'wohnraum',
    'mietwohnung', 'genossenschaft', 'hochhaus', 'turm', 'arealentwick',
    'stadtentwick', 'transformationsareal', 'zwischennutzung',
    # Akteure
    'bauherr', 'investor', 'entwickler', 'generalunternehm', 'architekt',
    'bauträger', 'pensionskasse', 'immobilienfirma', 'baugenossenschaft',
    # Verfahren / Politik / Akzeptanz
    'baugesuch', 'baubewilligung', 'einsprache', 'rekurs', 'gestaltungsplan',
    'mitwirkung', 'mitwirkungsverfahren', 'volksabstimmung', 'abstimmung',
    'referendum', 'initiative', 'umzonung', 'einzonung', 'richtplan',
    'nutzungsplan', 'baurekurs', 'bauprojekt', 'baustart', 'spatenstich',
    # Konfliktsignale
    'leerkündig', 'kündig', 'massenkündig', 'mieterprotest', 'mieter',
    'altlast', 'kontaminier', 'belasteter standort', 'anwohner', 'widerstand',
    'protest', 'einsprech',
    # Französisch (Romandie-Feeds: 24heures, TdG) — gleiche Signale auf FR
    'immobilier', 'chantier', 'logement', 'locataire', 'résiliation',
    'permis de construire', "mise à l'enquête", 'opposition', 'bâtiment',
    'construction', 'promoteur', "maître d'ouvrage", 'urbanisme',
    "plan d'affectation", 'votation', 'réaménagement', 'démolition',
    'rénovation', 'lotissement', 'coopérative', 'gravats', 'friche',
]

# Vorkompiliert für Speed: ein OR-Regex über alle Keywords
_PATTERN = re.compile('|'.join(re.escape(k) for k in KEYWORDS), re.IGNORECASE)


def matches(text: str) -> bool:
    return bool(_PATTERN.search(text or ''))


def run(limit: int | None = None, dry_run: bool = False) -> int:
    rows = db.select('crk_articles', {
        'is_relevant': 'is.null',
        'select': 'id,title,fulltext',
        'limit': str(limit or 2000),
    })
    if not rows:
        log.info('nothing to prefilter')
        return 0

    dropped = 0
    for a in rows:
        blob = f"{a.get('title') or ''} {a.get('fulltext') or ''}"
        if matches(blob):
            continue  # Survivor — bleibt NULL, geht weiter
        dropped += 1
        if dry_run:
            log.info('[drop] %s', (a.get('title') or '')[:70])
            continue
        try:
            db.update('crk_articles', {'id': a['id']}, {
                'is_relevant': False,
                'reasoning': 'Prefilter: kein Bau-/Immobilien-Signal in Titel/Teaser.',
            })
        except Exception as e:
            log.warning('prefilter update %d failed: %s', a['id'], e)

    kept = len(rows) - dropped
    log.info('prefilter: %d dropped, %d kept for LLM (of %d)', dropped, kept, len(rows))
    return dropped


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    args = sys.argv[1:]
    dry = '--dry-run' in args
    lim = None
    for a in args:
        if a.startswith('--limit='):
            lim = int(a.split('=')[1])
    n = run(limit=lim, dry_run=dry)
    print(f'prefiltered (dropped) {n}')
