"""Pull articles from configured sources and persist to Supabase.

Idempotent: crk_articles.url is UNIQUE, conflict → skip.
"""
from __future__ import annotations

import logging

import db
from . import amtsblatt, rss_feeds, sitemap_news

log = logging.getLogger(__name__)


def upsert_source(name: str, kind: str, url: str) -> int:
    existing = db.select('crk_sources', {'name': f'eq.{name}', 'select': 'id'})
    if existing:
        sid = existing[0]['id']
        db.update('crk_sources', {'id': sid}, {'last_crawl': 'now()'})
        return sid
    created = db.insert('crk_sources',
                        {'name': name, 'kind': kind, 'url': url, 'last_crawl': 'now()'})
    return created[0]['id']


def run() -> tuple[int, int]:
    log.info('fetching RSS feeds...')
    articles = rss_feeds.fetch()
    log.info('got %d RSS articles', len(articles))
    log.info('fetching news-sitemaps...')
    articles += sitemap_news.fetch()
    log.info('fetching Amtsblatt-Baugesuche...')
    try:
        articles += amtsblatt.fetch()
    except Exception as e:
        log.warning('amtsblatt fetch failed (continuing): %s', e)
    log.info('got %d articles total (RSS + sitemap + amtsblatt)', len(articles))

    # Sources first (one row per feed/sitemap)
    source_ids: dict[str, int] = {}
    for name, url in rss_feeds.FEEDS:
        source_ids[name] = upsert_source(name, 'news', url)
    for name, url in sitemap_news.SITEMAPS:
        source_ids[name] = upsert_source(name, 'sitemap', url)
    for name, url in amtsblatt.SOURCES:
        source_ids[name] = upsert_source(name, 'amtsblatt', url)

    # Articles — batched insert with ignore-duplicates
    rows = []
    for a in articles:
        # PostgREST-Batch-Insert verlangt identische Keys in allen Rows →
        # fulltext_fetched ÜBERALL setzen. Amtsblatt liefert den Volltext
        # direkt aus der API (Detail-URL ist eine SPA, nichts nachzuladen).
        rows.append({
            'source_id': source_ids.get(a.source),
            'url': a.url,
            'title': a.title,
            'published': a.published.isoformat() if a.published else None,
            'fulltext': a.fulltext or '',
            'fulltext_fetched': a.source == amtsblatt.SOURCE_NAME,
        })
    if not rows:
        return 0, 0

    # Batch in chunks of 50 to keep request body small
    inserted = 0
    for i in range(0, len(rows), 50):
        chunk = rows[i:i + 50]
        try:
            result = db.insert('crk_articles', chunk,
                               on_conflict='url', ignore_duplicates=True)
            inserted += len(result)
        except Exception as e:
            log.warning('chunk %d insert failed: %s', i // 50, e)

    skipped = len(rows) - inserted
    log.info('done: %d inserted, %d skipped (duplicates)', inserted, skipped)
    return inserted, skipped


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    run()
