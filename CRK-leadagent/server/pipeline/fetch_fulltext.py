"""Pipeline-Step: Volltext nachladen.

Läuft NACH dem Prefilter (nur Artikel die den Keyword-Gate überlebt haben,
is_relevant IS NULL) und VOR classify/score. Holt für jeden noch nicht
abgeholten Artikel den echten Body über `crawlers.fulltext` und schreibt ihn
zurück in crk_articles.fulltext. Markiert fulltext_fetched=true, damit nächste
Wochen dieselben URLs nicht erneut gezogen werden.

Effizient: nur Survivor des Prefilters werden gefetcht — die ~70-80% Noise
(reine Wirtschafts-/Marktartikel) kosten keinen HTTP-Roundtrip.
"""
from __future__ import annotations

import logging
import sys
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

import db
import notify
from crawlers import fulltext, nzz, chmedia, tamedia

log = logging.getLogger(__name__)

# Unter dieser Länge gilt der vorhandene Text als blosser Teaser → nachladen
MIN_BODY_LEN = 600
# Parallele HTTP-Fetches (höflich, aber nicht im Schneckentempo)
WORKERS = 6


def _fetch_one(article: dict) -> tuple[dict, str]:
    body = fulltext.fetch(article['url'])
    return article, body


# Paywall-Verlage mit eigener Cookie-Session: (Name, url-matcher, Modul).
# matcher(url)->bool, damit ein Modul (Tamedia) mehrere Domains abdecken kann.
# Jedes Modul hat has_session(), fetch_many(urls), SessionExpiredError.
_PAYWALLS = [
    ('NZZ',     lambda u: 'nzz.ch' in (u or ''),                nzz),
    ('CHMedia', lambda u: 'solothurnerzeitung.ch' in (u or ''), chmedia),
    ('Tamedia', tamedia.matches,                                tamedia),
]


def _fetch_paywall(label: str, module, rows: list[dict]) -> dict[int, str]:
    """Artikel eines Paywall-Verlags über dessen Session (sequenziell, ein
    Browser). Ohne Session/bei Ablauf: leer → fallen auf Teaser zurück."""
    if not rows or not module.has_session():
        return {}
    url_to_id = {r['url']: r['id'] for r in rows}
    try:
        bodies = module.fetch_many(list(url_to_id))
    except module.SessionExpiredError as e:
        log.warning('%s-Session ungültig — Volltext übersprungen: %s', label, e)
        # Stiller Qualitätsverlust: ohne Session scored Claude nur auf Teasern.
        # → aktiv melden, damit jemand die Cookies neu importiert.
        notify.alert(
            f'⚠️ **Sämi: {label}-Paywall-Session abgelaufen** — {len(rows)} Artikel '
            f'fallen auf Teaser zurück (dünnere Leads). Fix: Cookies neu exportieren '
            f'+ `python -m crawlers.{module.__name__.split(".")[-1]} import <cookies.json>`')
        return {}
    except Exception as e:
        log.warning('%s-Fetch fehlgeschlagen: %s', label, e)
        return {}
    return {url_to_id[u]: b for u, b in bodies.items()}


def fetch_missing(limit: int | None = None, dry_run: bool = False) -> int:
    rows = db.select('crk_articles', {
        'is_relevant': 'is.null',
        'fulltext_fetched': 'is.false',
        'select': 'id,url,fulltext',
        'order': 'published.desc.nullslast',
        'limit': str(limit or 500),
    })
    if not rows:
        log.info('no articles need fulltext')
        return 0

    # Paywall-Verlage mit aktiver Session separat (Browser-Session), Rest
    # generisch via HTTP-ThreadPool. Ohne Session → Verlag landet bei generisch.
    paywall_rows: dict[str, list[dict]] = {}
    other_rows = list(rows)
    for label, match, module in _PAYWALLS:
        if not module.has_session():
            continue
        hit = [r for r in other_rows if match(r['url'])]
        if hit:
            paywall_rows[label] = hit
            other_rows = [r for r in other_rows if not match(r['url'])]

    summary = ', '.join(f'{len(v)} {k}' for k, v in paywall_rows.items()) or 'keine'
    log.info('fetching fulltext: %d generisch (%d workers) + paywall: %s',
             len(other_rows), WORKERS, summary)

    body_by_id: dict[int, str] = {}
    if other_rows:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            for article, body in pool.map(_fetch_one, other_rows):
                body_by_id[article['id']] = body
    for label, match, module in _PAYWALLS:
        if label in paywall_rows:
            body_by_id.update(_fetch_paywall(label, module, paywall_rows[label]))

    n = 0
    # Coverage-Monitoring: pro Domain zählen, wie viele Artikel am Ende echten
    # Volltext (>= MIN_BODY_LEN) haben vs. nur Teaser — macht Paywall-Lücken
    # sichtbar, BEVOR sie sich als dünne Leads im Briefing zeigen.
    stats: dict[str, list[int]] = {}  # domain -> [covered, total]
    for article in rows:
        body = body_by_id.get(article['id'], '')
        existing = article.get('fulltext') or ''
        # Nur ersetzen wenn der gefetchte Body wirklich reicher ist als der Teaser
        use_body = body if len(body) > len(existing) else existing
        improved = len(body) > len(existing) and len(body) >= MIN_BODY_LEN

        domain = (urlparse(article['url'] or '').hostname or '?').removeprefix('www.')
        s = stats.setdefault(domain, [0, 0])
        s[1] += 1
        if len(use_body) >= MIN_BODY_LEN:
            s[0] += 1

        if dry_run:
            log.info('[%s] %s — %d→%d chars',
                     'OK' if improved else 'keep', article['url'][:60],
                     len(existing), len(body))
            continue

        patch = {'fulltext_fetched': True}
        if improved:
            patch['fulltext'] = use_body
            n += 1
        try:
            db.update('crk_articles', {'id': article['id']}, patch)
        except Exception as e:
            log.warning('article %d update failed: %s', article['id'], e)

    log.info('fulltext improved for %d/%d articles', n, len(rows))
    for domain, (cov, tot) in sorted(stats.items(), key=lambda kv: -kv[1][1]):
        pct = 100 * cov // tot if tot else 0
        marker = '' if pct >= 50 else '  ⚠ überwiegend Teaser'
        log.info('coverage %-28s %3d%% (%d/%d)%s', domain, pct, cov, tot, marker)
    return n


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    args = sys.argv[1:]
    dry = '--dry-run' in args
    lim = None
    for a in args:
        if a.startswith('--limit='):
            lim = int(a.split('=')[1])
    n = fetch_missing(limit=lim, dry_run=dry)
    print(f'fulltext fetched {n}')
