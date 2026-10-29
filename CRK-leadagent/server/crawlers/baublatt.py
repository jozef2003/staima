"""Baublatt — placeholder (geprüft Juni 2026, bewusst zurückgestellt).

Befund: kein RSS (rss.xml/feed/rss alle 404), sitemap.xml ist stale
(lastmod 2025-08, keine Artikel-URLs), /news-Index ist JS-gerendert →
bräuchte Playwright-Scraper analog crawlers.chmedia. Aufwand/Nutzen aktuell
schlecht, da Grossprojekte via Amtsblatt (crawlers.amtsblatt) + Tagespresse
abgedeckt sind. Bei Bedarf: Playwright auf https://www.baublatt.ch/news,
Artikel-Cards extrahieren, letzte 7 Tage zurückgeben.
"""
from __future__ import annotations

from ._base import CrawledArticle


def fetch() -> list[CrawledArticle]:
    # Placeholder — replace with real implementation
    return []


if __name__ == "__main__":
    for a in fetch():
        print(a.url, a.title)
