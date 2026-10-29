"""Volltext-Fetcher: holt den Artikel-Body über den Link und extrahiert den
Haupttext. RSS liefert nur den Anteaser (1-2 Sätze) — Bauherr, Akzeptanzrisiken
und Projektphase stehen aber erst im Artikelkörper. Ohne diesen Step bewertet
die Pipeline auf Schnipseln.

Bewusst dependency-arm: httpx + BeautifulSoup (beide schon vorhanden), simple
Readability-Heuristik statt schwerer trafilatura-Dependency. Liefert '' zurück
wenn nichts Brauchbares extrahierbar ist — der Caller behält dann den Teaser.
"""
from __future__ import annotations

import logging
import re

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

UA = 'Mozilla/5.0 (compatible; SaemiBot/1.0; +https://cr-k.ch)'

# Tags die nie Artikel-Inhalt sind
_STRIP_TAGS = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'form',
               'figure', 'figcaption', 'noscript', 'iframe', 'svg', 'button']

# Container die typischerweise den Artikelkörper halten (in Präferenz-Reihenfolge)
_CONTENT_SELECTORS = [
    'article',
    '[itemprop="articleBody"]',
    '.article-body', '.articlebody', '.article__body',
    '.story-body', '.content-body', 'main',
]

# Paragraphen kürzer als das sind meist Bildlegenden / Navigation / Teaser
_MIN_PARA_LEN = 45
# Mehr brauchen wir nicht — Claude-Prompt cappt eh bei ~4000 Zeichen
_MAX_CHARS = 8000


def _clean(soup: BeautifulSoup) -> None:
    for tag in soup(_STRIP_TAGS):
        tag.decompose()


def _paragraphs(container) -> list[str]:
    out: list[str] = []
    for p in container.find_all('p'):
        txt = p.get_text(' ', strip=True)
        txt = re.sub(r'\s+', ' ', txt)
        if len(txt) >= _MIN_PARA_LEN:
            out.append(txt)
    return out


def extract(html: str) -> str:
    """Extrahiert den Haupttext aus rohem HTML. Best-effort, '' bei Misserfolg."""
    if not html:
        return ''
    soup = BeautifulSoup(html, 'html.parser')
    _clean(soup)

    # 1) Bekannte Artikel-Container probieren, längsten Treffer nehmen
    best: list[str] = []
    for sel in _CONTENT_SELECTORS:
        for node in soup.select(sel):
            paras = _paragraphs(node)
            if sum(len(p) for p in paras) > sum(len(p) for p in best):
                best = paras

    # 2) Fallback: alle <p> der Seite
    if not best:
        best = _paragraphs(soup)

    text = '\n'.join(best).strip()
    return text[:_MAX_CHARS]


def fetch(url: str, timeout: int = 12) -> str:
    """Lädt eine Artikel-URL und gibt den extrahierten Haupttext zurück.

    Gibt '' zurück bei Netzwerkfehler, Paywall-Stub, oder wenn nichts
    Brauchbares extrahierbar ist — der Caller behält dann den RSS-Teaser.
    """
    try:
        r = httpx.get(url, headers={'User-Agent': UA}, timeout=timeout,
                      follow_redirects=True)
        r.raise_for_status()
    except Exception as e:
        log.debug('fulltext fetch failed %s: %s', url, e)
        return ''
    ctype = r.headers.get('content-type', '')
    if 'html' not in ctype:
        return ''
    try:
        return extract(r.text)
    except Exception as e:
        log.debug('fulltext extract failed %s: %s', url, e)
        return ''


if __name__ == '__main__':
    import sys
    logging.basicConfig(level=logging.DEBUG, format='%(levelname)s %(message)s')
    for u in sys.argv[1:]:
        body = fetch(u)
        print(f'\n=== {u}\n{len(body)} chars\n{body[:500]}')
