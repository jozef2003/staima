"""RSS-Crawler für Schweizer Quellen mit funktionierenden Feeds.

Pull alle Items aus den konfigurierten Feeds, dedupe via URL, return als
CrawledArticle-Liste. Volltext wird nicht aus dem Feed übernommen — den
holt der nächste Step über den Article-Link (oder wir lassen ihn weg
wenn paywall, Claude kommt mit dem Anteaser meist klar).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser

import feedparser
import httpx
from dateutil import parser as dateparser

from ._base import CrawledArticle

log = logging.getLogger(__name__)

# Quellen — alle bestätigt erreichbar (Stand Juni 2026).
# Deutschschweiz (NZZ/Tamedia/CH-Media) + Free-Quellen (SRF, Watson, Blick,
# 20min) + Romandie (24heures, TdG). Branchenmedien (Baublatt) haben keine
# offene RSS — siehe crawlers.baublatt. Paid-Quellen mit CRK-Abo:
#   - NZZ (inkl. NZZ am Sonntag)            → Volltext via crawlers.nzz (Session aktiv)
#   - Solothurner Zeitung (CH-Media)        → Volltext via crawlers.chmedia (Session aktiv)
#   - Tagi + Der Bund + Berner Zeitung (Tamedia) → Teaser, bis Tamedia-Session
# Volltext-Freischaltung läuft je Verlag über einen Cookie-Export (wie NZZ);
# eine Tamedia-Session deckt Tagi + Bund + BZ zusammen ab (gleiches Abo 11410349).
FEEDS: list[tuple[str, str]] = [
    # === NZZ (inkl. NZZ am Sonntag) — Fokus Zürich ===
    ('nzz_zuerich',              'https://www.nzz.ch/zuerich.rss'),
    ('nzz_schweiz',              'https://www.nzz.ch/schweiz.rss'),
    ('nzz_wirtschaft',           'https://www.nzz.ch/wirtschaft.rss'),
    ('nzz_am_sonntag',           'https://www.nzz.ch/nzz-am-sonntag.rss'),
    # === Tagesanzeiger (Abo Bern 11410349) — Zürcher Zeitung ===
    ('tagesanzeiger_zuerich',    'https://partner-feeds.publishing.tamedia.ch/rss/tagesanzeiger/zuerich'),
    ('tagesanzeiger_wirtschaft', 'https://partner-feeds.publishing.tamedia.ch/rss/tagesanzeiger/wirtschaft'),
    ('tagesanzeiger_news',       'https://partner-feeds.publishing.tamedia.ch/rss/tagesanzeiger/news'),
    ('tagesanzeiger_immobilien', 'https://partner-feeds.publishing.tamedia.ch/rss/tagesanzeiger/immobilien'),
    # === Der Bund (Tamedia, gleiches Abo 11410349 wie Tagi) — Region Bern ===
    ('derbund_bern',             'https://partner-feeds.publishing.tamedia.ch/rss/derbund/bern'),
    ('derbund_wirtschaft',       'https://partner-feeds.publishing.tamedia.ch/rss/derbund/wirtschaft'),
    ('derbund_schweiz',          'https://partner-feeds.publishing.tamedia.ch/rss/derbund/schweiz'),
    # === Berner Zeitung (Tamedia, gleiches Abo 11410349) — Region Bern ===
    ('bernerzeitung_bern',       'https://partner-feeds.publishing.tamedia.ch/rss/bernerzeitung/bern'),
    ('bernerzeitung_wirtschaft', 'https://partner-feeds.publishing.tamedia.ch/rss/bernerzeitung/wirtschaft'),
    # === Solothurner Zeitung (CH-Media, eigenes Abo) — Region Solothurn ===
    ('solothurnerzeitung_solothurn',  'https://www.solothurnerzeitung.ch/solothurn.rss'),
    ('solothurnerzeitung_wirtschaft', 'https://www.solothurnerzeitung.ch/wirtschaft.rss'),
    # === Free-Quellen (kein Abo nötig) — Reichweite + Konfliktberichterstattung ===
    ('srf_news',                 'https://www.srf.ch/news/bnf/rss/1646'),
    ('watson',                   'https://www.watson.ch/api/1.0/rss/index.xml'),
    ('blick_wirtschaft',         'https://www.blick.ch/wirtschaft/rss.xml'),
    ('20min',                    'https://partner-feeds.20min.ch/rss/20minuten'),
    # === Romandie (Tamedia Partner-Feeds; 'vaud'-Rubrik ist leer → suisse/economie) ===
    ('24heures_suisse',          'https://partner-feeds.publishing.tamedia.ch/rss/24heures/suisse'),
    ('24heures_economie',        'https://partner-feeds.publishing.tamedia.ch/rss/24heures/economie'),
    ('tdg_geneve',               'https://partner-feeds.publishing.tamedia.ch/rss/tdg/geneve'),
    # === Branchenmedien (Immobilien/Bau-Fachpresse, Volltext gratis im Feed/Web) ===
    #   - Immobilien Business: konkrete Projekte/Transaktionen, dated URLs
    #   - Wüest Partner: Markt-Research & Signale (eher Kontext als Einzel-Lead)
    ('immobilienbusiness',       'https://www.immobilienbusiness.ch/de/feed/'),
    ('wuestpartner',             'https://www.wuestpartner.com/ch-de/feed/'),
]

# Nur Artikel aus den letzten 14 Tagen aufnehmen (mehr ist nicht im Feed)
MAX_AGE_DAYS = 14

# Höfliches User-Agent, damit wir nicht als anonymer Bot geblockt werden
UA = 'Mozilla/5.0 (compatible; SaemiBot/1.0; +https://cr-k.ch)'


class _TextExtractor(HTMLParser):
    """Strippt HTML aus RSS-description ohne dependencies."""
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    @property
    def text(self) -> str:
        return ' '.join(' '.join(self.parts).split())


def _strip_html(s: str) -> str:
    p = _TextExtractor()
    try:
        p.feed(s or '')
    except Exception:
        return s or ''
    return p.text


def _parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        d = dateparser.parse(s)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d
    except Exception:
        return None


def fetch_feed(name: str, url: str) -> list[CrawledArticle]:
    try:
        r = httpx.get(url, headers={'User-Agent': UA}, timeout=15)
        r.raise_for_status()
    except Exception as e:
        log.warning('feed %s fetch failed: %s', name, e)
        return []

    parsed = feedparser.parse(r.content)
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)

    out: list[CrawledArticle] = []
    for entry in parsed.entries:
        link = (entry.get('link') or '').strip()
        title = (entry.get('title') or '').strip()
        if not link or not title:
            continue
        published = _parse_date(entry.get('published') or entry.get('updated'))
        if published and published < cutoff:
            continue

        # Volltext: description ist meist Anteaser. content:encoded falls da, sonst description.
        body = ''
        for k in ('content', 'summary_detail', 'summary', 'description'):
            v = entry.get(k)
            if isinstance(v, list) and v:
                body = v[0].get('value', '')
                break
            if isinstance(v, dict):
                body = v.get('value', '')
                break
            if isinstance(v, str):
                body = v
                break
        body = _strip_html(body)

        out.append(CrawledArticle(
            source=name,
            url=link,
            title=title,
            published=published,
            fulltext=body,
        ))

    log.info('feed %s: %d articles', name, len(out))
    return out


def fetch() -> list[CrawledArticle]:
    all_articles: list[CrawledArticle] = []
    seen: set[str] = set()
    for name, url in FEEDS:
        for a in fetch_feed(name, url):
            if a.url in seen:
                continue
            seen.add(a.url)
            all_articles.append(a)
    return all_articles


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    articles = fetch()
    print(f'\n→ {len(articles)} unique articles\n')
    for a in articles[:5]:
        date_str = a.published.strftime('%Y-%m-%d') if a.published else '????'
        print(f'  [{a.source:30s}] {date_str}  {a.title[:80]}')
    if len(articles) > 5:
        print(f'  ... +{len(articles) - 5} more')
