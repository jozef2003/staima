"""Tamedia Volltext-Scraper hinter Paywall — via importierter Browser-Session.

Deckt ALLE Tamedia-Titel mit EINEM Abo (Piano/gateway.tamedia.ch) ab:
Tagesanzeiger, Der Bund, Berner Zeitung sowie Romandie (24heures, TdG).
Login läuft wie bei NZZ über Piano SSO — automatisierter Login wird vom
Bot-Schutz abgewiesen, daher der Cookie-Session-Weg:

  1. Mensch loggt sich EINMAL im Browser bei tagesanzeiger.ch ein.
  2. Cookies exportieren (Cookie-Editor → "Export as JSON").
  3. python -m crawlers.tamedia import <cookies.json>
  4. python -m crawlers.tamedia fetch <url>  (bzw. die Pipeline)

Die Auth-Cookies (entitlementToken, __tac, refreshToken, x-user-info) gelten
für `.tagesanzeiger.ch`; das Piano-Entitlement deckt aber alle Tamedia-Titel.
Für Volltext auf derbund.ch / bernerzeitung.ch / 24heures.ch / tdg.ch ggf.
einmal dort eingeloggt sein und mit-exportieren — import behält alle
Tamedia-Domains aus dem Export.

Session hält typischerweise Wochen; bei Ablauf Schritte 1-3 wiederholen.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

from . import fulltext

log = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = PROJECT_ROOT / 'server' / 'cache'
STATE_FILE = CACHE_DIR / 'tamedia_state.json'

# Alle Tamedia-Titel, die fetch_fulltext über dieses Modul routet
DOMAINS = (
    'tagesanzeiger.ch', 'derbund.ch', 'bernerzeitung.ch',
    '24heures.ch', 'tdg.ch', 'lematin.ch',
)
# Cookies dieser Domains behalten wir beim Import (Titel + Piano-Gateway)
KEEP_DOMAINS = DOMAINS + ('tamedia.ch', 'piano.io')

NAV_TIMEOUT = 30_000
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

_MIN_LOGGED_IN_LEN = 500
_PAYWALL_MARKERS = (
    # DE
    'jetzt abonnieren', 'abo abschliessen', 'um diesen artikel zu lesen',
    'nur für abonnentinnen', 'nur für abonnenten', 'jetzt weiterlesen',
    'abonnieren sie', 'testen sie jetzt',
    # FR (Romandie)
    "s'abonner", 'cet article est réservé', 'réservé aux abonnés',
    'abonnez-vous', 'pour lire la suite',
)
_CONSENT_BUTTONS = ('Alle akzeptieren und schließen', 'Alle akzeptieren',
                    'Akzeptieren', 'Einverstanden', 'Zustimmen', 'Accept all',
                    'Tout accepter', "J'accepte")
_SAMESITE = {
    'no_restriction': 'None', 'none': 'None', 'unspecified': 'Lax',
    'lax': 'Lax', 'strict': 'Strict',
}

# CDN/Bot-Cookies mit teils kaputter Domain → Playwright storage_state-Killer
_SKIP_NAMES = {'_cfuvid', '__cf_bm'}


class SessionExpiredError(RuntimeError):
    """Session abgelaufen/ungültig → Cookies neu exportieren + importieren."""


def has_session() -> bool:
    return STATE_FILE.exists()


def matches(url: str) -> bool:
    return any(d in (url or '') for d in DOMAINS)


def _convert_cookie(c: dict) -> dict | None:
    name, value, domain = c.get('name'), c.get('value'), c.get('domain')
    if not name or value is None or not domain or name in _SKIP_NAMES:
        return None
    if domain.startswith('.www.'):     # führender Punkt + Subdomain → host-only
        domain = domain[1:]
    exp = c.get('expirationDate') or c.get('expires')
    return {
        'name': name, 'value': value, 'domain': domain,
        'path': c.get('path') or '/',
        'expires': float(exp) if exp else -1,
        'httpOnly': bool(c.get('httpOnly')),
        'secure': bool(c.get('secure')),
        'sameSite': _SAMESITE.get(str(c.get('sameSite', 'lax')).lower(), 'Lax'),
    }


def import_cookies(src: str) -> int:
    raw = sys.stdin.read() if src == '-' else Path(src).read_text()
    data = json.loads(raw)
    cookies_in = data.get('cookies') if isinstance(data, dict) else data
    if not isinstance(cookies_in, list):
        raise ValueError('Erwartet eine Cookie-Liste (Cookie-Editor "Export as JSON").')
    keep = []
    for c in cookies_in:
        conv = _convert_cookie(c)
        if conv and any(d in conv['domain'].lstrip('.') for d in KEEP_DOMAINS):
            keep.append(conv)
    if not keep:
        raise ValueError('Keine Tamedia-Cookies im Export gefunden — auf '
                         'tagesanzeiger.ch / derbund.ch / bernerzeitung.ch eingeloggt gewesen?')
    # MERGEN statt ersetzen: bestehende Session-Cookies (z.B. tagesanzeiger.ch)
    # behalten, neue Domain dazu. Dedupe per (domain, name) — neu gewinnt.
    existing = []
    if STATE_FILE.exists():
        try:
            existing = json.loads(STATE_FILE.read_text()).get('cookies', [])
        except (OSError, ValueError):
            existing = []
    merged = {(c.get('domain'), c.get('name')): c for c in existing}
    for c in keep:
        merged[(c.get('domain'), c.get('name'))] = c
    out = list(merged.values())
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps({'cookies': out, 'origins': []}, ensure_ascii=False))
    doms = sorted({c['domain'].lstrip('.') for c in out})
    log.info('%d neue + bestehende → %d Cookies, Domains: %s', len(keep), len(out), doms)
    return len(out)


def _looks_paywalled(text: str) -> bool:
    return any(m in text.lower() for m in _PAYWALL_MARKERS)


def _accept_consent(page) -> None:
    for fr in page.frames:
        for t in _CONSENT_BUTTONS:
            try:
                loc = fr.get_by_role('button', name=t)
                if loc.count() and loc.first.is_visible(timeout=1200):
                    loc.first.click()
                    return
            except Exception:
                continue


# Consent-/CMP-/Navigations-Boilerplate, das NICHT zum Artikel gehört. Ohne
# diesen Filter landeten 700+ Zeichen Cookie-Banner-Text als „Volltext" in der DB.
_JUNK_MARKERS = (
    'speichern von oder zugriff auf informationen', 'liste der partner',
    'personalisierte werbung', 'mehr aus dieser kategorie', 'datenschutzerkl',
    'cookie', 'newsletter', 'folgen sie uns', 'einwilligung', 'akzeptieren',
    'zustimmen', 'jetzt anmelden', 'zur startseite',
)


def _extract_body(page) -> str:
    # Erst NUR den Artikel-Container abgreifen (kein globales 'p' → kein Footer/
    # Consent-Müll). Nur wenn das nichts Substanzielles liefert, breit fallbacken.
    paras: list[str] = []
    for sel in ('article p', '[class*=ArticleBody] p', '[class*=articlecomponent] p',
                'section[class*=article] p', 'main article p'):
        try:
            cand = page.eval_on_selector_all(
                sel, 'els => els.map(e => e.innerText).filter(t => t && t.trim().length > 40)')
        except Exception:
            cand = []
        if cand and sum(len(c) for c in cand) > 300:
            paras = cand
            break
    if not paras:
        try:
            paras = page.eval_on_selector_all(
                'p', 'els => els.map(e => e.innerText).filter(t => t && t.trim().length > 40)')
        except Exception:
            return fulltext.extract(page.content())
    seen, out = set(), []
    for t in paras:
        t = ' '.join(t.split())
        low = t.lower()
        if t in seen or any(m in low for m in _JUNK_MARKERS):
            continue
        seen.add(t)
        out.append(t)
    return '\n'.join(out)


def fetch_fulltext(url: str) -> str:
    return fetch_many([url])[url]


def fetch_many(urls: list[str]) -> dict[str, str]:
    from playwright.sync_api import sync_playwright

    if not STATE_FILE.exists():
        raise SessionExpiredError(
            f'Keine Tamedia-Session in {STATE_FILE}. Bitte Cookies importieren: '
            f'python -m crawlers.tamedia import <cookies.json>')

    # Multi-Domain: die Cookies gelten nur für eine Tamedia-Domain (meist
    # tagesanzeiger.ch). Artikel anderer Titel ohne eigene Cookies kommen als
    # Teaser zurück — das ist KEIN Session-Ablauf, also NICHT den ganzen Batch
    # abbrechen. Paywall-Treffer → '' (fällt auf Teaser zurück). Nur wenn KEIN
    # einziger Artikel durchkommt, gilt die Session als tot → SessionExpiredError.
    results: dict[str, str] = {}
    good = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=UA, locale='de-CH', storage_state=str(STATE_FILE))
        try:
            page = context.new_page()
            for i, url in enumerate(urls):
                body = ''
                # Bis zu 2 Versuche: Piano braucht manchmal länger, bis der
                # Volltext freigeschaltet im DOM steht (sonst → Teaser-Fehlalarm).
                for attempt in range(2):
                    try:
                        page.goto(url, wait_until='domcontentloaded', timeout=NAV_TIMEOUT)
                        time.sleep(2.0 if attempt == 0 else 4.0)
                        _accept_consent(page)
                        time.sleep(1.5)
                        for _ in range(5):
                            page.mouse.wheel(0, 4000)
                            time.sleep(0.4)
                        body = _extract_body(page)
                        if len(body) >= _MIN_LOGGED_IN_LEN and not _looks_paywalled(body):
                            break  # Volltext da — kein Retry nötig
                    except Exception as e:
                        log.warning('fetch failed (try %d) %s: %s', attempt + 1, url, e)
                paywalled = len(body) < _MIN_LOGGED_IN_LEN or _looks_paywalled(body)
                results[url] = '' if paywalled else body
                if not paywalled:
                    good += 1
                log.info('[%d/%d] %d chars%s — %s', i + 1, len(urls), len(body),
                         ' (paywall→teaser)' if paywalled else '', url[:70])
        finally:
            context.close()
            browser.close()

    if urls and good == 0:
        raise SessionExpiredError(
            f'Tamedia-Session ungültig/abgelaufen — kein einziger von {len(urls)} '
            f'Artikeln lieferte Volltext. Bitte Cookies neu exportieren + importieren.')
    return results


def main() -> int:
    ap = argparse.ArgumentParser(description='Tamedia Volltext-Scraper (Session-Cookies)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p_imp = sub.add_parser('import', help='Cookie-Editor JSON-Export → storage_state')
    p_imp.add_argument('src', help='Pfad zur cookies.json oder "-" für stdin')
    p_fetch = sub.add_parser('fetch', help='Artikel-Volltext holen (nutzt Session)')
    p_fetch.add_argument('url')
    sub.add_parser('status', help='Prüft ob die Session noch gültig ist')
    args = ap.parse_args()

    if args.cmd == 'import':
        n = import_cookies(args.src)
        print(f'OK — {n} Cookies importiert. Test: python -m crawlers.tamedia status')
        return 0
    if args.cmd == 'fetch':
        try:
            text = fetch_fulltext(args.url)
        except SessionExpiredError as e:
            print(f'ERROR: {e}', file=sys.stderr)
            return 2
        print(f'\n--- {len(text)} chars ---\n{text[:2000]}')
        return 0
    if args.cmd == 'status':
        if not STATE_FILE.exists():
            print('Keine Session — bitte zuerst Cookies importieren.')
            return 2
        try:
            txt = fetch_fulltext('https://www.tagesanzeiger.ch/')
            print(f'Session-Datei OK ({len(txt)} chars von der Startseite).')
            return 0
        except SessionExpiredError as e:
            print(f'Session abgelaufen: {e}')
            return 2
    return 1


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    sys.exit(main())
