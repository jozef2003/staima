"""NZZ Volltext-Scraper hinter Paywall — via importierter Browser-Session.

NZZ-Login läuft über Piano SSO + Google reCAPTCHA. Automatisierter Login
(headless ODER xvfb-headed, Server ODER Wohnsitz-IP) wird vom reCAPTCHA still
abgewiesen — der Bot-Schutz ist genau dafür da. Funktionierender Weg:

  1. Mensch loggt sich EINMAL im normalen Browser bei nzz.ch ein (da ist er
     Mensch → reCAPTCHA passiert).
  2. Cookies exportieren (z.B. Extension "Cookie-Editor" → Export as JSON).
  3. `python -m crawlers.nzz import <cookies.json>` → konvertiert in einen
     Playwright storage_state (server/cache/nzz_state.json).
  4. `python -m crawlers.nzz fetch <url>` bzw. die Pipeline holen den Volltext
     headless mit der Session (Artikel-Reads triggern KEINEN reCAPTCHA).

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
STATE_FILE = CACHE_DIR / 'nzz_state.json'

NAV_TIMEOUT = 30_000
ARTICLE_DELAY = 2.5
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

# Paywall-Marker — wenn die im Text auftauchen, ist die Session abgelaufen
_PAYWALL_MARKERS = (
    'benötigen Sie ein Abo', 'Jetzt abonnieren', 'Abo abschliessen',
    'um diesen Artikel zu lesen', 'NZZ-Konto',
)

_SAMESITE = {
    'no_restriction': 'None', 'none': 'None', 'unspecified': 'Lax',
    'lax': 'Lax', 'strict': 'Strict',
}


class SessionExpiredError(RuntimeError):
    """Session abgelaufen/ungültig → Cookies neu exportieren + importieren."""


def has_session() -> bool:
    return STATE_FILE.exists()


# CDN-Cookies mit teils kaputter Domain (z.B. _cfuvid ".www.<host>") bringen
# Playwrights storage_state komplett zum Scheitern → überspringen.
_SKIP_NAMES = {'_cfuvid', '__cf_bm'}


def _convert_cookie(c: dict) -> dict | None:
    """Cookie-Editor / Chrome-Export-Cookie → Playwright storage_state cookie."""
    name = c.get('name')
    value = c.get('value')
    domain = c.get('domain')
    if not name or value is None or not domain or name in _SKIP_NAMES:
        return None
    if domain.startswith('.www.'):     # führender Punkt + Subdomain → host-only
        domain = domain[1:]
    exp = c.get('expirationDate') or c.get('expires')
    out = {
        'name': name,
        'value': value,
        'domain': domain,
        'path': c.get('path') or '/',
        'expires': float(exp) if exp else -1,
        'httpOnly': bool(c.get('httpOnly')),
        'secure': bool(c.get('secure')),
        'sameSite': _SAMESITE.get(str(c.get('sameSite', 'lax')).lower(), 'Lax'),
    }
    return out


def import_cookies(src: str) -> int:
    """Liest einen Cookie-Editor/JSON-Export (Datei oder '-' für stdin) und
    schreibt einen Playwright storage_state nach STATE_FILE. Behält nur Cookies
    relevanter Domains (nzz.ch, piano.io). Returns Anzahl importierter Cookies."""
    raw = sys.stdin.read() if src == '-' else Path(src).read_text()
    data = json.loads(raw)
    # Cookie-Editor exportiert eine Liste; manche Tools wrappen in {"cookies":[...]}
    cookies_in = data.get('cookies') if isinstance(data, dict) else data
    if not isinstance(cookies_in, list):
        raise ValueError('Erwartet eine Cookie-Liste (Cookie-Editor "Export as JSON").')

    keep = []
    for c in cookies_in:
        conv = _convert_cookie(c)
        if not conv:
            continue
        dom = conv['domain'].lstrip('.')
        if 'nzz.ch' in dom or 'piano.io' in dom:
            keep.append(conv)
    if not keep:
        raise ValueError('Keine nzz.ch/piano.io Cookies im Export gefunden — '
                         'bist du auf nzz.ch eingeloggt gewesen?')

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps({'cookies': keep, 'origins': []}, ensure_ascii=False))
    log.info('%d Cookies importiert → %s', len(keep), STATE_FILE)
    return len(keep)


def _looks_paywalled(text: str) -> bool:
    return any(m.lower() in text.lower() for m in _PAYWALL_MARKERS)


# Unter so vielen Zeichen beim ersten Artikel gehen wir von Paywall/abgelaufener
# Session aus (eingeloggter Volltext hat tausende Zeichen, der Lead nur ~150-400).
_MIN_LOGGED_IN_LEN = 500

_CONSENT_BUTTONS = ('Alle akzeptieren und schließen', 'Alle akzeptieren',
                    'Akzeptieren', 'Einverstanden', 'Zustimmen', 'Accept all')


def _accept_consent(page) -> None:
    """NZZ-Cookie-Dialog (TCF-CMP) wegklicken — er überlagert sonst den
    Artikel-Body und verhindert dessen Rendering. Cookie wird gesetzt, sodass
    es bei Folgeartikeln nicht mehr erscheint."""
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
    """Alle echten Artikel-Absätze einsammeln (NZZ rendert den Body lazy in
    <p>-Elementen, nicht im klassischen <article>-Container)."""
    try:
        paras = page.eval_on_selector_all(
            'article p, section[class*=article] p, [class*=articlecomponent] p, main p, p',
            'els => els.map(e => e.innerText).filter(t => t && t.trim().length > 40)')
    except Exception:
        return fulltext.extract(page.content())
    # Duplikate (überlappende Selektoren) raus, Reihenfolge erhalten
    seen, out = set(), []
    for t in paras:
        t = ' '.join(t.split())
        if t not in seen:
            seen.add(t)
            out.append(t)
    return '\n'.join(out)


def fetch_fulltext(url: str) -> str:
    """Holt den Volltext eines NZZ-Artikels mit der importierten Session."""
    return fetch_many([url])[url]


def fetch_many(urls: list[str]) -> dict[str, str]:
    """Batch-Fetch mit einer Browser-Session. Bei Paywall/abgelaufener Session
    → SessionExpiredError beim ersten Artikel."""
    from playwright.sync_api import sync_playwright

    if not STATE_FILE.exists():
        raise SessionExpiredError(
            f'Keine NZZ-Session in {STATE_FILE}. Bitte Cookies importieren: '
            f'python -m crawlers.nzz import <cookies.json>'
        )

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
                    _accept_consent(page)         # blockiert sonst den Body
                    time.sleep(1.5)
                    for _ in range(4):            # lazy-loaded Body triggern
                        page.mouse.wheel(0, 4000)
                        time.sleep(0.5)
                    body = _extract_body(page)
                    if i == 0 and (len(body) < _MIN_LOGGED_IN_LEN or _looks_paywalled(body)):
                        raise SessionExpiredError(
                            f'NZZ-Session ungültig/abgelaufen (nur {len(body)} Zeichen '
                            f'bei {url}). Bitte Cookies neu exportieren + importieren.'
                        )
                    results[url] = body
                    log.info('[%d/%d] %d chars — %s', i + 1, len(urls),
                             len(body), url[:70])
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
    ap = argparse.ArgumentParser(description='NZZ Volltext-Scraper (Session-Cookies)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p_imp = sub.add_parser('import', help='Cookie-Editor JSON-Export → storage_state')
    p_imp.add_argument('src', help='Pfad zur cookies.json oder "-" für stdin')
    p_fetch = sub.add_parser('fetch', help='Artikel-Volltext holen (nutzt Session)')
    p_fetch.add_argument('url')
    sub.add_parser('status', help='Prüft ob die Session noch gültig ist')
    args = ap.parse_args()

    if args.cmd == 'import':
        n = import_cookies(args.src)
        print(f'OK — {n} Cookies importiert. Test: python -m crawlers.nzz status')
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
            txt = fetch_fulltext('https://www.nzz.ch/')
            print(f'Session-Datei OK ({len(txt)} chars von der Startseite).')
            return 0
        except SessionExpiredError as e:
            print(f'Session abgelaufen: {e}')
            return 2

    return 1


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    sys.exit(main())
