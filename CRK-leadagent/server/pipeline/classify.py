"""Classify: ist ein Artikel ein konkretes Schweizer Bauprojekt?"""
from __future__ import annotations

import json
import logging
import subprocess
import sys

import db

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
Du bist ein Klassifikator für die CRK Kommunikationsagentur in Zürich.

Aufgabe: Entscheide ob der vorliegende Artikel ein KONKRETES Schweizer
Immobilien- oder Bauprojekt beschreibt, das für CRK relevant sein könnte
(Lead-Logik aus dem Briefing).

NICHT relevant:
- Marktberichte / Zinsthemen / Wirtschaftslage allgemein
- Reine Architektur-Awards / Designkritiken
- Ausländische Projekte
- Personalrochaden bei Firmen ohne Projektbezug
- Allgemeine Politik / Recht (z.B. Reform Stockwerkeigentum)

RELEVANT sind konkrete Bauprojekte mit:
- Erkennbarem Standort (Schweizer Gemeinde)
- Erkennbarem Bauherr/Investor/Entwickler
- Hinweisen auf Sanierung, Neubau, Areal-Entwicklung, Leerkündigung, Altlasten,
  Mitwirkungsverfahren, oder politische/öffentliche Diskussion

Antworte STRIKT als gültiges JSON ohne Codeblock-Wrapper:
{
  "is_relevant": true | false,
  "reasoning": "1-2 Sätze auf Deutsch warum (oder warum nicht).",
  "entities": {
    "projekt": "Projektname falls genannt, sonst ''",
    "ort": "Gemeinde, sonst ''",
    "kanton": "2-stellig falls erkennbar, sonst ''",
    "akteure": ["Bauherr/Investor/Entwickler-Namen, sonst []"]
  }
}
"""

USER_TEMPLATE = """\
Titel: {title}
Datum: {published}
Quelle: {source}

Volltext / Anteaser:
{fulltext}
"""


def call_claude(prompt: str, system: str = SYSTEM_PROMPT, timeout: int = 90,
                tools: list[str] | None = None) -> dict:
    """Ruft Claude headless auf und parst die JSON-Antwort.

    Ohne `tools`: reiner Klassifikator/Scorer-Modus (--system-prompt überschreibt
    den Default, kein Tool-Zugriff — günstig & deterministisch).

    Mit `tools` (z.B. ['WebSearch','WebFetch']): AGENT-Modus. Claude darf die
    genannten Tools nutzen (z.B. im Web recherchieren). Wir hängen unsere
    Instruktion via --append-system-prompt an, damit der tool-fähige Default-
    Prompt erhalten bleibt. Nur whitelisted Tools — kein Bash/Write, daher safe
    auch ohne Permission-Prompts im headless Modus.
    """
    cmd = ['claude', '-p', prompt,
           '--output-format', 'json',
           '--disable-slash-commands']
    if tools:
        cmd += ['--allowedTools', ','.join(tools),
                '--append-system-prompt', system]
    else:
        cmd += ['--system-prompt', system]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f'claude timeout after {timeout}s')
    if r.returncode != 0:
        raise RuntimeError(f'claude rc={r.returncode}: {r.stderr[:300]}')
    try:
        envelope = json.loads(r.stdout)
        body = envelope.get('result', r.stdout)
    except json.JSONDecodeError:
        body = r.stdout
    body = body.strip()
    if body.startswith('```'):
        body = body.split('\n', 1)[1].rsplit('\n', 1)[0]
        if body.startswith('json\n'):
            body = body[5:]
    if not body.startswith('{'):
        i, j = body.find('{'), body.rfind('}')
        if i >= 0 and j > i:
            body = body[i:j + 1]
    return json.loads(body)


def classify_articles(limit: int | None = None, dry_run: bool = False) -> int:
    # Pull unclassified articles via Supabase REST
    rows = db.select('crk_articles', {
        'is_relevant': 'is.null',
        'select': 'id,url,title,published,fulltext,source_id',
        'order': 'published.desc.nullslast',
        'limit': str(limit or 1000),
    })

    # Source name lookup
    sources = {s['id']: s['name'] for s in db.select('crk_sources', {'select': 'id,name'})}

    log.info('classifying %d articles', len(rows))
    n = 0
    for a in rows:
        prompt = USER_TEMPLATE.format(
            title=a.get('title') or '(kein Titel)',
            published=a.get('published') or 'unbekannt',
            source=sources.get(a.get('source_id'), '?'),
            fulltext=(a.get('fulltext') or '')[:3000],
        )
        try:
            result = call_claude(prompt)
        except Exception as e:
            log.warning('article %d: %s', a['id'], e)
            continue

        is_rel = bool(result.get('is_relevant'))
        reasoning = (result.get('reasoning') or '')[:500]
        entities = result.get('entities') or {}

        if dry_run:
            tag = 'REL' if is_rel else 'skip'
            log.info('[%s] %s — %s', tag, (a.get('title') or '')[:60], reasoning[:80])
            continue

        try:
            db.update('crk_articles', {'id': a['id']}, {
                'is_relevant': is_rel,
                'reasoning': reasoning,
                'entities': entities,
            })
            n += 1
            if n % 10 == 0:
                log.info('progress %d/%d', n, len(rows))
        except Exception as e:
            log.warning('article %d update failed: %s', a['id'], e)
    return n


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    args = sys.argv[1:]
    dry = '--dry-run' in args
    lim = None
    for a in args:
        if a.startswith('--limit='):
            lim = int(a.split('=')[1])
    n = classify_articles(limit=lim, dry_run=dry)
    print(f'classified {n}')
