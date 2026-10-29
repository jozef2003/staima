"""Score: bewertet relevante Artikel nach der CRK-Lead-Logik."""
from __future__ import annotations

import hashlib
import json
import logging
import re
import sys
from datetime import date, timedelta

import db
from .classify import call_claude

log = logging.getLogger(__name__)

# Wieviele Feedback-Beispiele wir in den System-Prompt einfliessen lassen
FEEDBACK_EXAMPLES_PER_KIND = 5

SYSTEM_PROMPT = """\
Du bist Sämi, der Lead-Agent der CRK Kommunikationsagentur in Zürich. CRK ist
eine Kommunikationsagentur mit Fokus auf integrierte Kommunikation:
Projektkommunikation, Stakeholder-Kommunikation, PR, Öffentlichkeitsarbeit,
Mitwirkungsverfahren, Medienarbeit, digitale Kommunikation.

Ein Projekt ist ein wertvoller Lead, wenn der Bauherr/Investor/Entwickler
professionelle Kommunikationsunterstützung benötigt oder davon profitieren
würde — z.B. weil:
- öffentlichkeitswirksam (Sichtbarkeit, politische Relevanz)
- Akzeptanzrisiken (Widerstände, Anwohnerproteste, Einsprachen)
- Mitwirkungsverfahren oder Volksabstimmung steht an
- komplexe Stakeholder-Landschaft (Gemeinden, Behörden, Investoren)
- noch keine erkennbare Kommunikationsstrategie sichtbar
- starke Marken-/Positionierungskomponente
- medial bereits kritisch begleitet

LEAD-TYPEN: Ent-/Wiedervermietung · Areal-Entwicklung · Leerkündigung ·
Belasteter Standort

PROJEKTPHASEN: Planung · Bewilligung · Ausschreibung · Bau · Lancierung

POTENZIAL HOCH wenn:
- Kommunikationsbedarf offensichtlich und dringend
- Noch keine Kommunikationsbegleitung sichtbar
- Politisch, gesellschaftlich oder medial relevant
- Frühe Kontaktaufnahme bietet Wettbewerbsvorteil

POTENZIAL TIEF wenn:
- Projekt hat erkennbar bereits Agentur/Kommunikationsabteilung
- Standard-Bauvorhaben ohne öffentliche Komponente
- Bereits lange im Bau, Kommunikationsphase vorbei

Antworte STRIKT als gültiges JSON ohne Codeblock:
{
  "projekt": "Projektname oder Beschreibung",
  "standort": "Gemeinde, Kanton",
  "projekttyp": "Ent-/Wiedervermietung | Areal-Entwicklung | Leerkündigung | Belasteter Standort",
  "phase": "Planung | Bewilligung | Ausschreibung | Bau | Lancierung",
  "akteure": "Bauherr, Investor, Architekt (kommagetrennt)",
  "kommunikationsbedarf": "1-3 konkrete Sätze warum DIESES Projekt CRK-Unterstützung gebraucht",
  "potenzial": "Hoch | Mittel | Tief",
  "begruendung": "Warum dieses Potenzial",
  "zusammenfassung": "2-3 Sätze zur Meldung + kommunikativer Ausgangslage",
  "confidence": "hoch | mittel | tief — wie belastbar ist die Datenlage (genug Substanz im Text)?",
  "recherche_hinweis": "Falls Angaben unvollständig: was fehlt / was BD nachrecherchieren sollte. Sonst ''"
}

Wenn der Text zu dünn ist für eine seriöse Bewertung: confidence='tief' und im
recherche_hinweis sagen was fehlt — niemals Akteure/Fakten erfinden.
"""

USER_TEMPLATE = """\
Titel: {title}
Datum: {published}
Quelle: {source}
Extrahierte Entitäten: {entities}

Volltext / Anteaser:
{fulltext}
"""


def _norm(s: str) -> str:
    return re.sub(r'\s+', ' ', (s or '').lower().strip())


# Füllwörter die Claude mal mitliefert, mal nicht ("Areal X" vs "Überbauung X").
# Rausstrippen, damit der Fingerprint auf dem Projekt-KERN basiert und Dedupe
# über Wochen hinweg zuverlässiger greift.
_FILLER = {
    'areal', 'überbauung', 'ueberbauung', 'projekt', 'neubau', 'umbau', 'bau',
    'quartier', 'siedlung', 'wohnüberbauung', 'wohnsiedlung', 'liegenschaft',
    'entwicklung', 'arealentwicklung', 'das', 'der', 'die', 'und', 'an', 'der',
    'im', 'in', 'am', 'zur', 'von',
}


def _core_tokens(s: str) -> str:
    """Normalisiert auf sortierte, füllwort-freie Kern-Tokens."""
    toks = re.findall(r'\w+', _norm(s))
    core = sorted({t for t in toks if t not in _FILLER and len(t) > 2})
    return ' '.join(core)


def fingerprint(projekt: str, standort: str) -> str:
    base = f'{_core_tokens(projekt)}|{_core_tokens(standort)}'
    return hashlib.sha1(base.encode('utf-8')).hexdigest()[:16]


def iso_monday() -> date:
    d = date.today()
    return d - timedelta(days=d.weekday())


def _load_feedback_examples() -> str:
    """Holt jüngste 👍/👎-Beispiele aus crk_lead_feedback und formatiert sie
    als zusätzlichen Kalibrierungs-Block für den Score-Prompt.

    Returns '' wenn noch kein Feedback existiert.
    """
    try:
        fbs = db.select('crk_lead_feedback', {
            'select': 'kind,note,lead_id,created_at',
            'order': 'created_at.desc',
            'limit': '40',
        })
    except Exception as e:
        log.warning('feedback fetch failed: %s', e)
        return ''
    if not fbs:
        return ''

    # Lade die zugehörigen Lead-Snippets
    lead_ids = list({fb['lead_id'] for fb in fbs if fb.get('lead_id')})
    if not lead_ids:
        return ''
    leads = db.select('crk_leads', {
        'select': 'id,projekt,standort,potenzial,kommunikationsbedarf',
        'id': f'in.({",".join(str(i) for i in lead_ids)})',
    })
    by_id = {l['id']: l for l in leads}

    # 'contacted'/'assigned' = stärkstes Positiv-Signal: CRK BD hat den Lead
    # tatsächlich aufgegriffen → genau solche Leads wollen wir mehr.
    won: list[str] = []
    rel: list[str] = []
    notrel: list[str] = []
    for fb in fbs:
        lead = by_id.get(fb.get('lead_id'))
        if not lead:
            continue
        line = (
            f'- {lead.get("projekt") or "?"} ({lead.get("standort") or "?"}) '
            f'[{lead.get("potenzial") or "?"}] — '
            f'{(lead.get("kommunikationsbedarf") or "")[:160]}'
        )
        kind = fb.get('kind')
        if kind in ('contacted', 'assigned') and len(won) < FEEDBACK_EXAMPLES_PER_KIND:
            won.append(line)
        elif kind == 'relevant' and len(rel) < FEEDBACK_EXAMPLES_PER_KIND:
            rel.append(line)
        elif kind == 'not_relevant' and len(notrel) < FEEDBACK_EXAMPLES_PER_KIND:
            notrel.append(line)

    if not won and not rel and not notrel:
        return ''
    out = ['\nKALIBRIERUNG (Team-Feedback aus Vorwochen):']
    if won:
        out.append('\n🎯 VOM BD AUFGEGRIFFEN (Goldstandard — solche Leads klar bevorzugen, eher "Hoch"):')
        out.extend(won)
    if rel:
        out.append('\n👍 RELEVANT befunden (so bewerten wir richtig):')
        out.extend(rel)
    if notrel:
        out.append('\n👎 NICHT RELEVANT (solche Leads tiefer einstufen oder vermeiden):')
        out.extend(notrel)
    return '\n'.join(out) + '\n'


def score_articles(limit: int | None = None, dry_run: bool = False) -> int:
    # Pull relevant articles that don't have a lead yet
    relevant = db.select('crk_articles', {
        'is_relevant': 'eq.true',
        'select': 'id,url,title,published,fulltext,entities,source_id',
        'order': 'published.desc.nullslast',
        'limit': str(limit or 200),
    })
    existing_leads = db.select('crk_leads', {'select': 'article_id'})
    have = {l.get('article_id') for l in existing_leads if l.get('article_id')}
    todo = [a for a in relevant if a['id'] not in have]

    sources = {s['id']: s['name'] for s in db.select('crk_sources', {'select': 'id,name'})}
    week = iso_monday()
    feedback_block = _load_feedback_examples()
    system = SYSTEM_PROMPT + feedback_block
    if feedback_block:
        log.info('feedback-loop active (system prompt +%d chars)', len(feedback_block))

    log.info('scoring %d articles for week %s', len(todo), week)
    n = 0
    for a in todo:
        source = sources.get(a.get('source_id'), '?')
        prompt = USER_TEMPLATE.format(
            title=a['title'],
            published=a.get('published') or '?',
            source=source,
            entities=json.dumps(a.get('entities') or {}, ensure_ascii=False),
            fulltext=(a.get('fulltext') or '')[:4000],
        )
        try:
            lead = call_claude(prompt, system=system)
        except Exception as e:
            log.warning('article %d: %s', a['id'], e)
            continue

        projekt = (lead.get('projekt') or a['title'])[:200]
        standort = lead.get('standort') or ''
        fp = fingerprint(projekt, standort)

        if dry_run:
            log.info('[%s] %s — %s', lead.get('potenzial', '?'), projekt[:60], standort)
            continue

        try:
            db.insert('crk_leads', {
                'week': week.isoformat(),
                'article_id': a['id'],
                'projekt': projekt,
                'standort': standort,
                'projekttyp': lead.get('projekttyp'),
                'phase': lead.get('phase'),
                'akteure': lead.get('akteure'),
                'kommunikationsbedarf': lead.get('kommunikationsbedarf'),
                'potenzial': lead.get('potenzial'),
                'quelle': source,
                'quelle_url': a['url'],
                'datum': (a.get('published') or '')[:10] or None,
                'zusammenfassung': lead.get('zusammenfassung'),
                'confidence': (lead.get('confidence') or '').lower() or None,
                'recherche_hinweis': lead.get('recherche_hinweis') or None,
                'fingerprint': fp,
            })
            n += 1
            if n % 5 == 0:
                log.info('progress %d/%d', n, len(todo))
        except Exception as e:
            log.warning('insert lead failed for article %d: %s', a['id'], e)
    return n


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    args = sys.argv[1:]
    dry = '--dry-run' in args
    lim = None
    for a in args:
        if a.startswith('--limit='):
            lim = int(a.split('=')[1])
    n = score_articles(limit=lim, dry_run=dry)
    print(f'scored {n}')
