"""CH-Media Volltext-Scraper hinter Paywall — via importierter Browser-Session.

Aktuell: Solothurner Zeitung (solothurnerzeitung.ch). CH-Media nutzt Blaize/Zephr
fürs Paywall-Gating (Cookies: blaize_session, chmZephrData, chmd, sp). Login im
echten Browser, Cookies exportieren (Cookie-Editor → JSON), dann:

  python -m crawlers.chmedia import <cookies.json>
  python -m crawlers.chmedia fetch <url>

Identisches Muster wie crawlers.nzz. fetch_fulltext.py routet
solothurnerzeitung.ch-URLs automatisch hierdurch.
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
STATE_FILE = CACHE_DIR / 'chmedia_state.json'

# Domains, deren Cookies wir behalten (CH-Media-Paywall)
KEEP_DOMAINS = ('solothurnerzeitung.ch', 'chmedia')

NAV_TIMEOUT = 30_000
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

_MIN_LOGGED_IN_LEN = 500
_PAYWALL_MARKERS = (
    'nur für abonnenten', 'jetzt abonnieren', 'abo abschliessen',
    'um diesen artikel zu lesen', 'jetzt anmelden', 'abo lösen',
)
_CONSENT_BUTTONS = ('Alle akzeptieren und schließen', 'Alle akzeptieren',
                    'Akzeptieren', 'Einverstanden', 'Zustimmen', 'Accept all')
_SAMESITE = {
    'no_restriction': 'None', 'none': 'None', 'unspecified': 'Lax',
    'lax': 'Lax', 'strict': 'Strict',
}


class SessionExpiredError(RuntimeError):
    """Session abgelaufen/ungültig → Cookies neu exportieren + importieren."""


def has_session() -> bool:
    return STATE_FILE.exists()


# Cloudflare/CDN-Cookies: nicht Auth-relevant und teils mit kaputter Domain
# (z.B. _cfuvid mit ".www.<host>") — die brachten Playwrights storage_state
# komplett zum Scheitern. Überspringen.
_SKIP_NAMES = {'_cfuvid', '__cf_bm'}


def _convert_cookie(c: dict) -> dict | None:
    name, value, domain = c.get('name'), c.get('value'), c.get('domain')
    if not name or value is None or not domain or name in _SKIP_NAMES:
        return None
    # ".www.host.ch" (führender Punkt + Subdomain) lehnt Playwright ab → host-only
    if domain.startswith('.www.'):
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
        raise ValueError('Keine CH-Media-Cookies im Export gefunden — '
                         'auf solothurnerzeitung.ch eingeloggt gewesen?')
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps({'cookies': keep, 'origins': []}, ensure_ascii=False))
    log.info('%d Cookies importiert → %s', len(keep), STATE_FILE)
    return len(keep)


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


def _extract_body(page) -> str:
    try:
        paras = page.eval_on_selector_all(
            'article p, section[class*=article] p, [class*=articlecomponent] p, main p, p',
            'els => els.map(e => e.innerText).filter(t => t && t.trim().length > 40)')
    except Exception:
        return fulltext.extract(page.content())
    seen, out = set(), []
    for t in paras:
        t = ' '.join(t.split())
        if t not in seen:
            seen.add(t)
            out.append(t)
    return '\n'.join(out)


def fetch_fulltext(url: str) -> str:
    return fetch_many([url])[url]


def fetch_many(urls: list[str]) -> dict[str, str]:
    from playwright.sync_api import sync_playwright

    if not STATE_FILE.exists():
        raise SessionExpiredError(
            f'Keine CH-Media-Session in {STATE_FILE}. Bitte Cookies importieren: '
            f'python -m crawlers.chmedia import <cookies.json>')

    results: dict[str, str] = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=UA, locale='de-CH', storage_state=str(STATE_FILE))
        try:
            page = context.new_page()
            for i, url in enumerate(urls):
                try:
                    page.goto(url, wait_until='domcontentloaded', timeout=NAV_TIMEOUT)
                    time.sleep(1.5)
                    _accept_consent(page)
                    time.sleep(1.5)
                    for _ in range(4):
                        page.mouse.wheel(0, 4000)
                        time.sleep(0.5)
                    body = _extract_body(page)
                    if i == 0 and (len(body) < _MIN_LOGGED_IN_LEN or _looks_paywalled(body)):
                        raise SessionExpiredError(
                            f'CH-Media-Session ungültig/abgelaufen (nur {len(body)} Zeichen '
                            f'bei {url}). Bitte Cookies neu exportieren + importieren.')
                    results[url] = body
                    log.info('[%d/%d] %d chars — %s', i + 1, len(urls), len(body), url[:70])
                except SessionExpiredError:
                    raise
                except Exception as e:
                    log.warning('fetch failed %s: %s', url, e)
                    results[url] = ''
        finally:
            context.close()
            browser.close()
    return results


def main() -> int:
    ap = argparse.ArgumentParser(description='CH-Media Volltext-Scraper (Session-Cookies)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p_imp = sub.add_parser('import', help='Cookie-Editor JSON-Export → storage_state')
    p_imp.add_argument('src', help='Pfad zur cookies.json oder "-" für stdin')
    p_fetch = sub.add_parser('fetch', help='Artikel-Volltext holen (nutzt Session)')
    p_fetch.add_argument('url')
    sub.add_parser('status', help='Prüft ob die Session noch gültig ist')
    args = ap.parse_args()

    if args.cmd == 'import':
        n = import_cookies(args.src)
        print(f'OK — {n} Cookies importiert. Test: python -m crawlers.chmedia status')
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
            txt = fetch_fulltext('https://www.solothurnerzeitung.ch/')
            print(f'Session-Datei OK ({len(txt)} chars von der Startseite).')
            return 0
        except SessionExpiredError as e:
            print(f'Session abgelaufen: {e}')
            return 2
    return 1


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    sys.exit(main())
