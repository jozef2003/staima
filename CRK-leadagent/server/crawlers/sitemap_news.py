"""News-Sitemap-Crawler — für Paid-Quellen ohne RSS.

Handelszeitung: Die Redaktion ist auf bilanz.ch umgezogen (handelszeitung.ch ist
nur noch Shop/Abo-Portal). bilanz.ch bietet kein RSS, aber eine Google-News-
Sitemap mit aktuellen Artikeln (Titel + Datum + URL). Die parsen wir hier.

Liefert CrawledArticle-Liste analog rss_feeds.fetch(). Volltext kommt leer
(Sitemap hat nur Titel) — fetch_fulltext holt den Body später (Bilanz nutzt
Piano wie NZZ; Volltext via Cookie-Session nachrüstbar, sonst Teaser).
"""
from __future__ import annotations

import html
import logging
import re
from datetime import datetime, timezone, timedelta

import httpx
from dateutil import parser as dateparser

from ._base import CrawledArticle

log = logging.getLogger(__name__)

# (source_name, news-sitemap-url)
SITEMAPS: list[tuple[str, str]] = [
    ('bilanz_handelszeitung', 'https://www.bilanz.ch/sitemap-news.xml'),
]

MAX_AGE_DAYS = 14
UA = 'Mozilla/5.0 (compatible; SaemiBot/1.0; +https://cr-k.ch)'

_URL_BLOCK = re.compile(r'<url>(.*?)</url>', re.S)


def _tag(block: str, tag: str) -> str:
    m = re.search(rf'<{tag}>(.*?)</{tag}>', block, re.S)
    return html.unescape(m.group(1).strip()) if m else ''


def _parse_date(s: str):
    if not s:
        return None
    try:
        d = dateparser.parse(s)
        if d and d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d
    except Exception:
        return None


def fetch_sitemap(name: str, url: str) -> list[CrawledArticle]:
    try:
        r = httpx.get(url, headers={'User-Agent': UA}, timeout=20, follow_redirects=True)
        r.raise_for_status()
    except Exception as e:
        log.warning('sitemap %s fetch failed: %s', name, e)
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    out: list[CrawledArticle] = []
    for block in _URL_BLOCK.findall(r.text):
        loc = _tag(block, 'loc')
        title = _tag(block, 'news:title')
        if not loc or not title:
            continue
        published = _parse_date(_tag(block, 'news:publication_date'))
        if published and published < cutoff:
            continue
        out.append(CrawledArticle(
            source=name, url=loc, title=title, published=published, fulltext=''))
    log.info('sitemap %s: %d articles', name, len(out))
    return out


def fetch() -> list[CrawledArticle]:
    all_articles: list[CrawledArticle] = []
    seen: set[str] = set()
    for name, url in SITEMAPS:
        for a in fetch_sitemap(name, url):
            if a.url in seen:
                continue
            seen.add(a.url)
            all_articles.append(a)
    return all_articles


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    arts = fetch()
    print(f'\n→ {len(arts)} articles\n')
    for a in arts[:5]:
        d = a.published.strftime('%Y-%m-%d') if a.published else '????'
        print(f'  [{a.source}] {d}  {a.title[:80]}')
