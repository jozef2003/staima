"""Amtsblattportal (SHAB/KAB) — Baugesuche als FRÜHE Lead-Quelle.

Warum: Medien berichten über Grossprojekte oft erst Wochen nach der
Baupublikation. Das Amtsblattportal (amtsblattportal.ch) publiziert Baugesuche
strukturiert via offener JSON-API — kein Paywall, kein Scraping-Risiko. Ein
Baugesuch für ein Areal/MFH taucht hier VOR jedem Zeitungsartikel auf →
genau der Wettbewerbsvorteil "frühe Kontaktaufnahme" aus dem CRK-Briefing.

Coverage (Stand Juni 2026): Kanton BE vollständig, ZH teilweise. Andere
Kantone publizieren (noch) in eigenen Portalen — bei Bedarf je Kanton ein
eigenes Modul nachrüsten (z.B. amtsblatt.zh.ch).

Volumen-Gate: ~40 Baugesuche/Tag, das meiste EFH-Umbauten ohne Lead-Wert.
Der Keyword-Gate hier lässt nur Grossprojekt-/Konflikt-Signale durch
(Mehrfamilienhaus, Areal, Abbruch, Gewerbe, ...) — der generische Prefilter
würde mit 'bau' ALLES durchlassen und classify fluten.

API:
  Liste:  GET /api/v1/publications?publicationStates=PUBLISHED
              &subRubrics=AM-DA50&publicationDate.start=…&pageRequest.size=100
  Detail: GET /api/v1/publications/{id}/xml  (Bauherrschaft, Vorhaben, Ort)
"""
from __future__ import annotations

import html
import logging
import re
from datetime import date, datetime, timedelta, timezone

import httpx

from ._base import CrawledArticle

log = logging.getLogger(__name__)

API = 'https://www.amtsblattportal.ch/api/v1/publications'
# Öffentlicher Detail-Link (fürs Briefing / Audit-Trail)
PUBLIC_URL = 'https://www.amtsblattportal.ch/#!/search/publications/detail/{id}'

# Für run_all.upsert_source — analog rss_feeds.FEEDS / sitemap_news.SITEMAPS
SOURCES: list[tuple[str, str]] = [
    ('amtsblatt_baugesuche', 'https://www.amtsblattportal.ch'),
]
SOURCE_NAME = SOURCES[0][0]

# Baugesuche der letzten N Tage (täglicher Lauf + Puffer; URL ist unique → idempotent)
LOOKBACK_DAYS = 3

UA = 'Mozilla/5.0 (compatible; SaemiBot/1.0; +https://cr-k.ch)'

# Grossprojekt-/Konflikt-Signale im Titel ODER Detail-Text. Ein EFH-"Umbau
# bestehende Wohnung" matcht bewusst NICHT ('wohnungen' nur Plural).
SIZE_SIGNALS = [
    # Wohnungsbau in relevanter Grösse
    'mehrfamilien', 'mfh', 'wohnungen', 'wohnüberbauung', 'überbauung',
    'wohnsiedlung', 'siedlung', 'areal', 'arealentwicklung', 'quartier',
    'terrassenh', 'hochhaus', 'turm', 'genossenschaft',
    # Abbruch/Ersatzneubau = oft Entmietung → CRK-Kernthema
    'abbruch', 'rückbau', 'ersatzneubau', 'gesamtsanierung', 'totalsanierung',
    # Gewerbe / öffentlich / sichtbar
    'gewerbe', 'büro', 'hotel', 'einkauf', 'industrie', 'logistik',
    'parkhaus', 'schulhaus', 'schule', 'kindergarten', 'alterszentrum',
    'pflegeheim', 'alterswohn', 'spital', 'klinik', 'stadion', 'sporthalle',
    'asylunterkunft', 'deponie', 'antenne', 'mobilfunk', 'windenergie',
    'solaranlage', 'wasserkraft', 'umzonung', 'gestaltungsplan',
]
_GATE = re.compile('|'.join(re.escape(s) for s in SIZE_SIGNALS), re.IGNORECASE)

_TAG = re.compile(r'<[^>]+>')


def _strip_xml(xml: str) -> str:
    """XML → Klartext: Tags raus, Whitespace normalisieren."""
    text = _TAG.sub(' ', xml)
    return ' '.join(html.unescape(text).split())


def _fetch_detail(client: httpx.Client, pub_id: str) -> str:
    try:
        r = client.get(f'{API}/{pub_id}/xml')
        r.raise_for_status()
    except Exception as e:
        log.warning('detail %s fetch failed: %s', pub_id, e)
        return ''
    # Meta-Block (IDs, Schemas) interessiert nicht — ab <content> wäre ideal,
    # aber Struktur variiert je subRubric → ganzer Text minus Tags reicht
    # als Recherche-Ausgangspunkt für classify/score.
    return _strip_xml(r.text)[:8000]


def fetch(lookback_days: int = LOOKBACK_DAYS) -> list[CrawledArticle]:
    start = (date.today() - timedelta(days=lookback_days)).isoformat()
    end = date.today().isoformat()

    out: list[CrawledArticle] = []
    gated = 0
    with httpx.Client(headers={'User-Agent': UA, 'Accept': 'application/json'},
                      timeout=20) as client:
        page = 0
        while True:
            try:
                r = client.get(API, params={
                    'publicationStates': 'PUBLISHED',
                    'subRubrics': 'AM-DA50',
                    'publicationDate.start': start,
                    'publicationDate.end': end,
                    'pageRequest.size': 100,
                    'pageRequest.page': page,
                })
                r.raise_for_status()
                data = r.json()
            except Exception as e:
                log.warning('amtsblatt list page %d failed: %s', page, e)
                break

            content = data.get('content') or []
            if not content:
                break

            for pub in content:
                meta = pub.get('meta') or {}
                pub_id = meta.get('id')
                title = ((meta.get('title') or {}).get('de')
                         or (meta.get('title') or {}).get('fr') or '').strip()
                if not pub_id or not title:
                    continue
                # Gate: nur Grossprojekt-/Konflikt-Signale → Rest ist EFH-Noise
                if not _GATE.search(title):
                    gated += 1
                    continue
                cantons = ','.join(meta.get('cantons') or [])
                published = None
                try:
                    published = datetime.fromisoformat(
                        (meta.get('publicationDate') or '').replace('Z', '+00:00'))
                    if published.tzinfo is None:
                        published = published.replace(tzinfo=timezone.utc)
                except Exception:
                    pass

                detail = _fetch_detail(client, pub_id)
                out.append(CrawledArticle(
                    source=SOURCE_NAME,
                    url=PUBLIC_URL.format(id=pub_id),
                    title=f'[Baugesuch {cantons}] {title}',
                    published=published,
                    fulltext=detail,
                ))

            if page >= int(data.get('total', 0)) // 100:
                break
            page += 1

    log.info('amtsblatt: %d Baugesuche behalten, %d gated (EFH-Noise), Fenster %s→%s',
             len(out), gated, start, end)
    return out


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    arts = fetch(lookback_days=7)
    print(f'\n→ {len(arts)} Baugesuche\n')
    for a in arts[:10]:
        d = a.published.strftime('%Y-%m-%d') if a.published else '????'
        print(f'  {d}  {a.title[:100]}')
