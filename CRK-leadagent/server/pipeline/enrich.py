"""Enrichment + agentische Verifikation: aus Roh-Lead wird ein web-verifizierter,
kontaktierbarer Lead.

Statt aus dem Artikel zu RATEN, recherchiert Sämi hier wirklich im Web
(WebSearch + WebFetch). Pro qualifiziertem Lead — EIN Agent-Pass:

  1. VERIFIZIEREN  — existiert das Projekt, ist es aktuell, stimmt der Bauherr?
  2. RE-SCORING    — bestätigt oder korrigiert das Potenzial (Hoch/Mittel/Tief)
                     gegen echte Web-Evidenz (frühe Phase? echter, dringender
                     Kommunikationsbedarf? schon gebaut/erledigt?). Das score-
                     Rating beruht nur auf Artikeltext — hier prüft der Agent es.
  3. KONTAKT       — offizielle Firma, Website, konkrete Ansprechperson
                     (Geschäftsleitung / Leitung Kommunikation), LinkedIn.
  4. QUALIFIZIEREN — hat der Bauherr erkennbar SCHON eine Kommunikationsagentur
                     oder -abteilung? Dann schlechter Lead (CRK will unbegleitete
                     Projekte) → bereits_betreut=true → Rückstufung "Tief".
  5. AUFHÄNGER     — 1 Satz Erstkontakt-Aufhänger, konkret auf dieses Projekt.

Warum hier und nicht in score/classify: classify/score laufen über hunderte
Artikel — Web-Recherche pro Stück wäre Verschwendung. Dieser Pass läuft nur über
die ≤30 qualifizierten Leads/Woche, also bezahlbar, und macht Verifikation +
Enrichment in einem Aufruf statt zwei redundanten Web-Pässen.

Tools: nur WebSearch + WebFetch (read-only). Kein Bash/Write → headless safe.
Fällt bei Tool-/Netzfehler auf einen text-only Versuch zurück.
"""
from __future__ import annotations

import json
import logging
import sys

import db
from .classify import call_claude

log = logging.getLogger(__name__)

# Agentische Web-Recherche braucht länger als ein One-Shot-Call
AGENT_TIMEOUT = 300
AGENT_TOOLS = ['WebSearch', 'WebFetch']

SYSTEM_PROMPT = """\
Du bist Sämi, Lead-Agent der CRK Kommunikationsagentur (Zürich). Du bereitest
einen Immobilien-Lead so vor, dass das Business Development direkt die richtige
Person kontaktieren kann — und du verifizierst dabei den Lead.

Du hast WebSearch und WebFetch. NUTZE sie aktiv:
- Verifiziere, dass das Projekt real, aktuell und noch nicht abgeschlossen ist.
- RE-BEWERTE das Potenzial gegen echte Web-Evidenz: Das vorläufige Rating stammt
  nur aus einem Artikel. Bestätige es oder korrigiere es (Hoch/Mittel/Tief).
  HOCH nur wenn: frühe Projektphase, echter + dringender Kommunikationsbedarf,
  öffentlich/politisch relevant, und NOCH KEINE Kommunikationsbegleitung sichtbar.
  TIEF wenn: schon gebaut/erledigt, kein öffentlicher Bezug, oder bereits betreut.
- Suche den Bauherrn/Investor/Entwickler und seine offizielle Website.
- Für Schweizer Firmen: Handelsregister (zefix.ch) bestätigt Firma + Ort.
- Finde die konkret zuständige Person: Geschäftsleitung, oder besser
  Leitung Kommunikation / Marketing / Unternehmenskommunikation.

LINKEDIN — STRENG (ein falsches Profil ist schlimmer als gar keins):
- Nur die persönliche `/in/`-Profil-URL EXAKT der genannten Ansprechperson.
- Aufnehmen NUR, wenn du das Profil per WebFetch geöffnet und VERIFIZIERT hast,
  dass Name UND (Firma ODER Rolle ODER Region) zur Person passen.
- KEINE Firmen-/Company-Seiten (`/company/…`), KEINE Such-/Ergebnis-Links,
  KEIN geratenes Profil, KEIN gleichnamiger Fremder.
- Bei der KLEINSTEN Unsicherheit (nicht eindeutig dieselbe Person) → linkedin="".

- Prüfe, ob der Bauherr für DIESES Projekt schon eine Kommunikationsagentur oder
  eine eigene Kommunikationsabteilung hat (Impressum, Medienmitteilungen,
  "Medienkontakt"). Wenn ja → bereits_betreut=true (schlechter Lead für CRK).

REGELN:
- Erfinde NICHTS. Was du nicht belegen kannst → leeres Feld "" / null.
- Jede Kontaktangabe soll auf einer echten, GEÖFFNETEN Quelle beruhen (kontakt_quelle = URL).
- Halte dich kurz, max. ~6 Tool-Aufrufe. Lieber wenige sichere Fakten.

Antworte GANZ AM ENDE mit AUSSCHLIESSLICH diesem JSON (kein Codeblock, kein Text danach):
{
  "bauherr": "offizieller Firmenname, sonst ''",
  "bauherr_website": "https://… der Firma, sonst ''",
  "ansprechpartner": "Name der zuständigen Person, sonst ''",
  "ansprechpartner_rolle": "Rolle/Funktion, sonst ''",
  "linkedin": "verifizierte persönliche /in/-LinkedIn-URL der Ansprechperson, sonst ''",
  "kontakt_hinweis": "konkreter Kontaktweg für BD (1 Satz)",
  "kontakt_quelle": "URL wo du die Kontaktdaten gefunden hast, sonst ''",
  "aufhaenger": "1 Satz Erstkontakt-Aufhänger, konkret auf das Projekt bezogen",
  "bereits_betreut": true | false,
  "potenzial_verifiziert": "Hoch | Mittel | Tief — dein web-verifiziertes Rating",
  "verify_note": "1-2 Sätze: Projekt real/aktuell? Rating bestätigt/korrigiert (warum)? bereits betreut? Was unsicher?"
}
"""

USER_TEMPLATE = """\
Recherchiere und verifiziere diesen Lead.

Projekt:              {projekt}
Standort:             {standort}
Projekttyp:           {projekttyp}
Phase:                {phase}
Bekannte Akteure:     {akteure}
Kommunikationsbedarf: {kommunikationsbedarf}
Aktuelles Potenzial:  {potenzial}
Quelle:               {quelle_url}

ARTIKEL-VOLLTEXT (Ausgangspunkt):
{fulltext}
"""


def _clean_linkedin(url: str | None, name: str | None) -> str | None:
    """Letzte Sicherung gegen falsche LinkedIn-Profile: nur persönliche /in/-URLs,
    und der Vor- ODER Nachname muss im Profil-Slug stehen. Sonst lieber leer
    (ein falsches Profil = peinlicher Fehlkontakt für CRK)."""
    import re
    u = (url or '').strip()
    if not u or '/in/' not in u:
        return None  # Firma (/company), Such-Link oder leer → raus
    m = re.search(r'/in/([^/?#]+)', u)
    slug = (m.group(1) if m else '').replace('-', ' ').lower()
    parts = [p for p in re.split(r'\s+', (name or '').lower()) if len(p) > 2]
    if parts and not any(p in slug for p in parts):
        return None  # Name passt NICHT zum Slug → vermutlich fremde Person
    return u[:300]


def _run_agent(prompt: str) -> dict:
    """Agentischer Call; Fallback auf text-only wenn Tools/Netz scheitern."""
    try:
        return call_claude(prompt, system=SYSTEM_PROMPT,
                           timeout=AGENT_TIMEOUT, tools=AGENT_TOOLS)
    except Exception as e:
        log.warning('agent enrich failed (%s) — retry text-only', e)
        return call_claude(prompt, system=SYSTEM_PROMPT, timeout=120)


def enrich_leads(limit: int | None = None, dry_run: bool = False) -> int:
    leads = db.select('crk_leads', {
        'enriched': 'is.false',
        'is_duplicate': 'is.false',
        'select': 'id,article_id,projekt,standort,projekttyp,phase,akteure,'
                  'kommunikationsbedarf,potenzial,quelle_url,recherche_hinweis',
        'order': 'created_at.desc',
        'limit': str(limit or 100),
    })
    if not leads:
        log.info('no leads to enrich')
        return 0

    # Volltext der zugehörigen Artikel laden (Recherche-Ausgangspunkt)
    article_ids = [str(l['article_id']) for l in leads if l.get('article_id')]
    fulltext_by_id: dict = {}
    if article_ids:
        arts = db.select('crk_articles', {
            'id': f'in.({",".join(article_ids)})',
            'select': 'id,fulltext',
        })
        fulltext_by_id = {a['id']: (a.get('fulltext') or '') for a in arts}

    log.info('enriching %d leads (agent: %s)', len(leads), ','.join(AGENT_TOOLS))
    n = 0
    for l in leads:
        ft = fulltext_by_id.get(l.get('article_id'), '')[:4000]
        prompt = USER_TEMPLATE.format(
            projekt=l.get('projekt') or '?',
            standort=l.get('standort') or '?',
            projekttyp=l.get('projekttyp') or '?',
            phase=l.get('phase') or '?',
            akteure=l.get('akteure') or '?',
            kommunikationsbedarf=l.get('kommunikationsbedarf') or '?',
            potenzial=l.get('potenzial') or '?',
            quelle_url=l.get('quelle_url') or '?',
            fulltext=ft or '(kein Volltext verfügbar — über Quelle/Web recherchieren)',
        )
        try:
            res = _run_agent(prompt)
        except Exception as e:
            log.warning('lead %d enrich failed: %s', l['id'], e)
            continue

        bereits = bool(res.get('bereits_betreut'))
        patch = {
            'bauherr': (res.get('bauherr') or '')[:300] or None,
            'bauherr_website': (res.get('bauherr_website') or '')[:300] or None,
            'ansprechpartner': (res.get('ansprechpartner') or '')[:200] or None,
            'ansprechpartner_rolle': (res.get('ansprechpartner_rolle') or '')[:200] or None,
            'linkedin': _clean_linkedin(res.get('linkedin'), res.get('ansprechpartner')),
            'kontakt_hinweis': (res.get('kontakt_hinweis') or '')[:500] or None,
            'kontakt_quelle': (res.get('kontakt_quelle') or '')[:300] or None,
            'aufhaenger': (res.get('aufhaenger') or '')[:500] or None,
            'bereits_betreut': bereits,
            'verify_note': (res.get('verify_note') or '')[:500] or None,
            'enriched': True,
        }
        # Web-verifiziertes Re-Scoring übernehmen (überschreibt das reine
        # Text-Rating aus score.py, wenn der Agent ein valides Rating liefert)
        verified = (res.get('potenzial_verifiziert') or '').strip().capitalize()
        if verified in ('Hoch', 'Mittel', 'Tief'):
            patch['potenzial'] = verified

        # Bereits betreut = schlechter Lead → harte Rückstufung auf Tief + Hinweis
        if bereits:
            patch['potenzial'] = 'Tief'
            note = l.get('recherche_hinweis') or ''
            flag = 'Bauherr hat erkennbar bereits Kommunikationsbegleitung.'
            patch['recherche_hinweis'] = (flag + (' ' + note if note else ''))[:500]

        if dry_run:
            log.info('[%s] %s → %s→%s betreut=%s bauherr=%s person=%s',
                     l['id'], (l.get('projekt') or '')[:32],
                     l.get('potenzial'), patch.get('potenzial', l.get('potenzial')),
                     bereits, patch['bauherr'], patch['ansprechpartner'])
            continue

        try:
            db.update('crk_leads', {'id': l['id']}, patch)
            n += 1
        except Exception as e:
            log.warning('lead %d update failed: %s', l['id'], e)
    log.info('enriched %d/%d leads', n, len(leads))
    return n


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    args = sys.argv[1:]
    dry = '--dry-run' in args
    lim = None
    for a in args:
        if a.startswith('--limit='):
            lim = int(a.split('=')[1])
    n = enrich_leads(limit=lim, dry_run=dry)
    print(f'enriched {n}')
