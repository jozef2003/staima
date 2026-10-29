"""Tagesanzeiger Volltext-Scraper hinter Paywall.

CRK hat ein Abo Bern (Kunden-Nr. 11410349). Tamedia/id.tamedia.ch nutzt
**passwordless Login mit 6-stelligem Email-Code** — kein klassisches Passwort.
Workaround: Mensch loggt einmal headed ein (Email wird auto-gefüllt, Code-
Eingabe von Hand), wir speichern die Session-Cookies. Solange die Session
gültig ist (typischerweise Wochen), läuft Fulltext-Fetch ohne weitere Logins.

Workflow:
  1. `python -m crawlers.tagesanzeiger login` (headed, **einmalig**, manuell)
     → Browser öffnet sich, Email vorausgefüllt
     → User klickt "Weiter", erhält Code per Mail, tippt ihn ein
     → Script erkennt erfolgreichen Login, speichert Cookies in
       `server/cache/tamedia_state.json`
  2. `python -m crawlers.tagesanzeiger fetch <url>` (headless, automatisiert)
     → liest Cookies, öffnet Artikel, extrahiert Volltext
     → bei expired Session: klare Fehlermeldung "bitte erneut `login` laufen lassen"
  3. Pipeline-Integration: bei tagesanzeiger.ch URLs ohne Volltext → fetch_fulltext()

Wir bleiben höflich: 1 Request alle paar Sekunden, kein Burst. Nur Artikel die
über RSS-Feed eh schon als Index bekannt sind — kein Massen-Crawl.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.sync_api import BrowserContext, Page

log = logging.getLogger(__name__)

# Projekt-Root: dieses File liegt unter server/crawlers/, also drei hoch
PROJECT_ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = PROJECT_ROOT / 'server' / 'cache'
STATE_FILE = CACHE_DIR / 'tamedia_state.json'

# Login-Flow (Stand Juni 2026): Der "Anmelden"-Button auf tagesanzeiger.ch zeigt
# auf abo-digital.tagesanzeiger.ch/identity-service/auth/authorize?...&source=loginbutton
# Das leitet weiter auf id.tamedia.ch mit Email-Feld → "Anmelden" → Cloudflare-
# Turnstile-Check → 6-stelliger Code per Mail (OTP). Das alte /anmelden ist 404.
# WICHTIG: Cloudflare Turnstile blockt Automation/Datacenter-IPs — der Login
# klappt zuverlässig nur in einem echten Browser (headed, Wohnsitz-IP). Das
# spätere Artikel-Abrufen mit gespeicherter Session läuft dann server-seitig.
LOGIN_URL = ('https://abo-digital.tagesanzeiger.ch/identity-service/auth/authorize'
             '?source_client=web&response_type=token'
             '&redirect_uri=https%3A%2F%2Fwww.tagesanzeiger.ch%2F&source=loginbutton')
TAGI_HOME = 'https://www.tagesanzeiger.ch/'

NAV_TIMEOUT = 30_000   # 30s für normale Navigation
LOGIN_TIMEOUT = 420_000  # 7min für Turnstile + User tippt Code
ARTICLE_DELAY = 3.0    # Sekunden zwischen Artikeln im Batch-Mode

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')


def _strip_quotes(v: str) -> str:
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
        return v[1:-1]
    return v


def _env_value(key: str) -> str:
    """Holt einen Wert aus os.environ oder direkt aus .env (mit Quote-Stripping).

    Quotes werden gestrippt, weil das Passwort Sonderzeichen (*) enthält und
    in .env single-quoted abgelegt ist, damit `set -a; source .env` nicht globt.
    """
    val = os.environ.get(key, '').strip()
    if val:
        return _strip_quotes(val)
    env_path = PROJECT_ROOT / '.env'
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, _, v = line.partition('=')
            if k.strip() == key:
                return _strip_quotes(v)
    return ''


def _load_env() -> str:
    """Liest TAMEDIA_EMAIL aus .env oder Environment."""
    email = _env_value('TAMEDIA_EMAIL')
    if not email:
        raise RuntimeError('TAMEDIA_EMAIL muss in .env oder Environment gesetzt sein')
    return email


def _load_password() -> str:
    """Optionales TAMEDIA_PASSWORD. Leer = nur OTP-Flow."""
    return _env_value('TAMEDIA_PASSWORD')


def _accept_cookies(page: 'Page') -> None:
    for sel in [
        'button:has-text("Akzeptieren")',
        'button:has-text("Alle akzeptieren")',
        'button:has-text("Accept")',
        '#onetrust-accept-btn-handler',
    ]:
        try:
            btn = page.locator(sel).first
            if btn.is_visible(timeout=2000):
                btn.click()
                log.info('cookie banner accepted (%s)', sel)
                return
        except Exception:
            continue


def _do_login(page: 'Page', email: str, password: str = '') -> None:
    """Email-OTP-Login auf id.tamedia.ch (via abo-digital authorize-Redirect).

    Cloudflare-Turnstile + 6-stelliger Mail-Code → headed, der Mensch löst den
    Check + tippt den Code. Wir füllen nur die Email vor und warten auf den
    erfolgreichen Redirect zurück auf tagesanzeiger.ch. `password` wird hier
    nicht genutzt (Tamedia bietet keinen Passwort-Login für dieses Konto)."""
    log.info('opening login: %s', LOGIN_URL)
    page.goto(LOGIN_URL, wait_until='domcontentloaded', timeout=NAV_TIMEOUT)
    page.wait_for_timeout(3500)
    _accept_cookies(page)
    page.wait_for_timeout(1000)

    # Email-Feld (auf id.tamedia.ch ist es input#email, type=text) vorbefüllen
    log.info('filling email on: %s', page.url)
    email_field = page.locator(
        'input#email, input[name="email"], input[type="email"], '
        'input[type="text"]'
    ).first
    try:
        email_field.wait_for(state='visible', timeout=NAV_TIMEOUT)
        email_field.fill(email)
        log.info('email vorgefüllt: %s', email)
    except Exception as e:
        log.warning('Email-Feld nicht gefunden (%s) — bitte manuell eintippen', e)

    print()
    print('=' * 70)
    print('  TAGESANZEIGER LOGIN — manuelle Schritte im Browser-Fenster')
    print('=' * 70)
    print(f'  1. Cloudflare-Check ("Verifiziere…") abwarten bis grünes Häkchen')
    print(f'  2. "Anmelden" klicken (Email {email} ist vorausgefüllt)')
    print(f'  3. Postfach {email} checken — 6-stelliger Code kommt per Mail')
    print(f'  4. Code im Browser eintippen → es leitet zurück auf tagesanzeiger.ch')
    print(f'  Script wartet automatisch bis zu 7 Minuten auf den erfolgreichen Login.')
    print('=' * 70)
    print()

    # Warten bis URL zurück auf tagesanzeiger.ch (ohne /anmelden)
    try:
        page.wait_for_url(
            lambda url: 'tagesanzeiger.ch' in url
            and 'anmelden' not in url
            and 'id.tamedia.ch' not in url,
            timeout=LOGIN_TIMEOUT,
        )
        log.info('login successful — landed on %s', page.url)
    except Exception as e:
        raise RuntimeError(
            f'Login nicht erkannt (url={page.url}): {e}\n'
            f'Falls du eingeloggt bist aber das Script nicht erkennt: navigiere im '
            f'Browser manuell auf https://www.tagesanzeiger.ch/ und warte.'
        )


def login_and_save(headless: bool | None = None) -> None:
    """Login + Storage-State persistieren.

    Mit TAMEDIA_PASSWORD: versucht Passwort-Login → kann headless laufen
    (default headless=True). Ohne Passwort: Email-OTP, immer headed (User tippt
    den 6-stelligen Code). `headless` explizit überschreibt die Automatik.
    """
    from playwright.sync_api import sync_playwright

    email = _load_env()
    password = _load_password()
    if headless is None:
        headless = bool(password)  # Passwort → headless möglich; OTP → headed
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    log.info('login mode: %s (%s)',
             'PASSWORT' if password else 'OTP',
             'headless' if headless else 'headed')

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(user_agent=UA, locale='de-CH')
        page = context.new_page()

        try:
            _do_login(page, email, password)
            # Smoke-Test: Homepage laden um sicher zu sein dass Session live ist
            page.goto(TAGI_HOME, wait_until='domcontentloaded', timeout=NAV_TIMEOUT)
            time.sleep(2)
            context.storage_state(path=str(STATE_FILE))
            log.info('storage state gespeichert in %s', STATE_FILE)
        finally:
            context.close()
            browser.close()


def _open_session_context(p) -> tuple['BrowserContext', any]:
    """Browser-Context mit gespeicherter Storage-State öffnen. Headless."""
    if not STATE_FILE.exists():
        raise RuntimeError(
            f'Keine Session in {STATE_FILE}. '
            f'Bitte zuerst `python -m crawlers.tagesanzeiger login` ausführen.'
        )
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent=UA, locale='de-CH', storage_state=str(STATE_FILE)
    )
    return context, browser


class SessionExpiredError(RuntimeError):
    """Session abgelaufen → User muss erneut `login` laufen lassen."""


def _extract_article_text(page: 'Page') -> str:
    """Extrahiert Article-Body. Tamedia nutzt <article> tag + .ArticleBody-Klassen."""
    # Vorrangig <article>-Element, fallback auf main
    for sel in ['article', 'main article', '[itemprop="articleBody"]', 'main']:
        try:
            loc = page.locator(sel).first
            if loc.count() > 0:
                txt = loc.inner_text(timeout=5000)
                txt = ' '.join(txt.split())
                if len(txt) > 200:  # Sanity-Check
                    return txt
        except Exception:
            continue
    # Letzter Ausweg: ganze Page
    return ' '.join(page.locator('body').inner_text().split())


def _looks_like_session_expired(page: 'Page') -> bool:
    url = page.url
    if 'id.tamedia.ch' in url or 'anmelden' in url:
        return True
    # Paywall-Wall sichtbar? (Tamedia "Abo abschliessen"-Layer)
    try:
        if page.locator('text=Abo abschliessen').first.is_visible(timeout=500):
            return True
    except Exception:
        pass
    return False


def fetch_fulltext(url: str) -> str:
    """Holt den Volltext eines Tagesanzeiger-Artikels mit gespeicherter Session."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        context, browser = _open_session_context(p)
        try:
            page = context.new_page()
            page.goto(url, wait_until='domcontentloaded', timeout=NAV_TIMEOUT)
            time.sleep(2)
            if _looks_like_session_expired(page):
                raise SessionExpiredError(
                    f'Session abgelaufen (url={page.url}). '
                    f'Bitte `python -m crawlers.tagesanzeiger login` erneut laufen lassen.'
                )
            return _extract_article_text(page)
        finally:
            context.close()
            browser.close()


def fetch_many(urls: list[str]) -> dict[str, str]:
    """Batch-Fetch mit einer Browser-Session — schont Server und Overhead.

    Bricht ab sobald Session abgelaufen ist (kein automatisches Re-Login).
    """
    from playwright.sync_api import sync_playwright

    results: dict[str, str] = {}
    with sync_playwright() as p:
        context, browser = _open_session_context(p)
        try:
            page = context.new_page()
            for i, url in enumerate(urls):
                try:
                    page.goto(url, wait_until='domcontentloaded', timeout=NAV_TIMEOUT)
                    time.sleep(ARTICLE_DELAY)
                    if _looks_like_session_expired(page):
                        raise SessionExpiredError(
                            f'Session abgelaufen bei Artikel {i + 1}/{len(urls)} '
                            f'({url}). Bitte erneut `login` laufen lassen.'
                        )
                    results[url] = _extract_article_text(page)
                    log.info('[%d/%d] %d chars — %s', i + 1, len(urls),
                             len(results[url]), url[:80])
                except SessionExpiredError:
                    raise
                except Exception as e:
                    log.warning('fetch failed for %s: %s', url, e)
                    results[url] = ''
        finally:
            context.close()
            browser.close()
    return results


def main() -> int:
    ap = argparse.ArgumentParser(description='Tagesanzeiger Volltext-Scraper')
    sub = ap.add_subparsers(dest='cmd', required=True)

    p_login = sub.add_parser('login', help='Login (Passwort headless / OTP headed), speichert Session-Cookies')
    p_login.add_argument('--headless', action='store_true', help='Headless erzwingen (für Passwort-Login/Server)')
    p_login.add_argument('--headed', action='store_true', help='Headed erzwingen (für manuellen OTP-Code)')

    p_fetch = sub.add_parser('fetch', help='Artikel-Volltext scrapen (headless, nutzt Session)')
    p_fetch.add_argument('url')

    sub.add_parser('status', help='Prüft ob gespeicherte Session noch gültig ist')

    args = ap.parse_args()

    if args.cmd == 'login':
        headless = None
        if args.headless:
            headless = True
        elif args.headed:
            headless = False
        login_and_save(headless=headless)
        print(f'\nOK — Session gespeichert in {STATE_FILE}')
        print('Jetzt testen: python -m crawlers.tagesanzeiger fetch <artikel-url>')
        return 0

    if args.cmd == 'fetch':
        try:
            text = fetch_fulltext(args.url)
        except SessionExpiredError as e:
            print(f'ERROR: {e}', file=sys.stderr)
            return 2
        print(f'\n--- {len(text)} chars ---\n')
        print(text[:2000])
        if len(text) > 2000:
            print(f'\n... +{len(text) - 2000} chars more')
        return 0

    if args.cmd == 'status':
        if not STATE_FILE.exists():
            print('Keine Session — bitte zuerst `login` ausführen.')
            return 2
        # Test-Fetch auf Homepage; wenn login-redirect → expired
        try:
            text = fetch_fulltext(TAGI_HOME)
            print(f'Session OK ({len(text)} chars von der Homepage).')
            return 0
        except SessionExpiredError as e:
            print(f'Session abgelaufen: {e}')
            return 2

    return 1


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    sys.exit(main())
