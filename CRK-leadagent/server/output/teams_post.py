"""Format current-week leads als Markdown + optional via Teams Incoming-Webhook posten.

ENV (Phase 2):
  TEAMS_WEBHOOK_URL — Incoming Webhook (am einfachsten, kein Graph-Setup nötig)

Wenn TEAMS_WEBHOOK_URL nicht gesetzt: druckt Markdown auf stdout
(Phase-1 Modus, manuell in Channel kopieren).
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta, timezone

import httpx

import db

log = logging.getLogger(__name__)

POTENZIAL_ORDER = {'Hoch': 0, 'Mittel': 1, 'Tief': 2}


def _iso_monday() -> date:
    d = date.today()
    return d - timedelta(days=d.weekday())


def fetch_new_leads() -> list[dict]:
    """Liest die HEUTE neu erzeugten Leads (created_at >= heute 00:00 UTC),
    nicht-dupliziert, sortiert nach Potenzial. Tägliches Briefing → nur die
    frischen Leads, kein Wiederholen der ganzen Woche. Dedupe (läuft davor)
    sorgt dafür, dass Projekte aus Vortagen nicht erneut auftauchen."""
    cutoff = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0).isoformat()
    rows = db.select('crk_leads', {
        'created_at': f'gte.{cutoff}',
        'is_duplicate': 'is.false',
        'select': '*',
        'order': 'datum.desc.nullslast',
    })
    rows.sort(key=lambda r: POTENZIAL_ORDER.get(r.get('potenzial') or 'Tief', 3))
    return rows


def render_markdown(leads: list[dict], day: date) -> str:
    """Rendert die Lead-Liste als Markdown im CRK-Format (Tages-Briefing)."""
    lines = [
        f'# Sämi · Lead-Briefing {day.strftime("%-d. %B %Y")}',
        f'{len(leads)} neue qualifizierte Leads',
        '',
    ]
    last_pot = None
    for lead in leads:
        pot = lead.get('potenzial') or 'Tief'
        if pot != last_pot:
            lines.append(f'\n## {pot}\n')
            last_pot = pot
        lines.append(f'### {lead.get("projekt")}')
        lines.append(f'- **Standort:** {lead.get("standort") or "—"}')
        lines.append(
            f'- **Typ:** {lead.get("projekttyp") or "—"} · '
            f'**Phase:** {lead.get("phase") or "—"}'
        )
        lines.append(f'- **Akteure:** {lead.get("akteure") or "—"}')
        lines.append(
            f'- **Kommunikationsbedarf:** {lead.get("kommunikationsbedarf") or "—"}'
        )
        # Enrichment (agentisch recherchiert) — macht den Lead kontaktierbar
        if lead.get('bauherr'):
            bh = lead['bauherr']
            if lead.get('bauherr_website'):
                bh += f' ({lead["bauherr_website"]})'
            lines.append(f'- **Bauherr:** {bh}')
        if lead.get('ansprechpartner'):
            ap = lead['ansprechpartner']
            if lead.get('ansprechpartner_rolle'):
                ap += f', {lead["ansprechpartner_rolle"]}'
            if lead.get('linkedin'):
                ap += f' · [LinkedIn]({lead["linkedin"]})'
            lines.append(f'- **Ansprechpartner:** {ap}')
        if lead.get('kontakt_hinweis'):
            kw = lead['kontakt_hinweis']
            if lead.get('kontakt_quelle'):
                kw += f' ([Quelle]({lead["kontakt_quelle"]}))'
            lines.append(f'- **Kontaktweg:** {kw}')
        if lead.get('aufhaenger'):
            lines.append(f'- **Aufhänger:** {lead["aufhaenger"]}')
        if lead.get('zusammenfassung'):
            lines.append(f'- **Zusammenfassung:** {lead["zusammenfassung"]}')
        if (lead.get('confidence') or '').lower() == 'tief' or lead.get('recherche_hinweis'):
            hint = lead.get('recherche_hinweis') or 'Angaben unvollständig — Nachrecherche empfohlen'
            lines.append(f'- _⚠ {hint}_')
        datum = (lead.get('datum') or '')[:10] or '—'
        lines.append(
            f'- **Quelle:** [{lead.get("quelle") or "?"}]({lead.get("quelle_url") or "#"}) · {datum}'
        )
        lines.append('')
    return '\n'.join(lines)


# Potenzial → Farbe + Badge für die Adaptive Card
_POT_STYLE = {
    'Hoch':   ('good',     '🟢 HOCH',   'Good'),
    'Mittel': ('warning',  '🟡 MITTEL', 'Warning'),
    'Tief':   ('default',  '⚪ TIEF',    'Default'),
}


def _tb(text, **kw):
    return {'type': 'TextBlock', 'text': text, 'wrap': True, **kw}


def _clip(s: str, n: int) -> str:
    s = s.strip()
    return s if len(s) <= n else s[:n].rsplit(' ', 1)[0] + '…'


def _lead_block(lead: dict) -> dict:
    pot = lead.get('potenzial') or 'Tief'
    style, badge, color = _POT_STYLE.get(pot, _POT_STYLE['Tief'])

    facts = []
    if lead.get('bauherr'):
        facts.append({'title': 'Bauherr', 'value': lead['bauherr']})
    if lead.get('ansprechpartner'):
        ap = lead['ansprechpartner']
        if lead.get('ansprechpartner_rolle'):
            ap += f', {lead["ansprechpartner_rolle"]}'
        facts.append({'title': 'Kontakt', 'value': ap})
    if lead.get('kontakt_hinweis'):
        facts.append({'title': 'Weg', 'value': lead['kontakt_hinweis']})

    items = [
        {'type': 'ColumnSet', 'columns': [
            {'type': 'Column', 'width': 'stretch', 'items': [
                _tb(lead.get('projekt') or '—', weight='Bolder', size='Medium')]},
            {'type': 'Column', 'width': 'auto', 'items': [
                _tb(badge, weight='Bolder', color=color)]},
        ]},
        _tb(f'📍 {lead.get("standort") or "—"}  ·  {lead.get("projekttyp") or "—"}  ·  '
            f'Phase: {lead.get("phase") or "—"}', isSubtle=True, spacing='None', size='Small'),
    ]
    if facts:
        items.append({'type': 'FactSet', 'facts': facts})
    if lead.get('kommunikationsbedarf'):
        items.append(_tb('💬 ' + _clip(lead['kommunikationsbedarf'], 320), spacing='Small'))
    if lead.get('aufhaenger'):
        items.append(_tb('🎯 ' + _clip(lead['aufhaenger'], 200), isSubtle=True, size='Small'))
    if (lead.get('confidence') or '').lower() == 'tief' or lead.get('recherche_hinweis'):
        hint = lead.get('recherche_hinweis') or 'Angaben unvollständig — Nachrecherche empfohlen'
        items.append(_tb('⚠️ ' + hint, color='Warning', size='Small'))

    actions = []
    if lead.get('quelle_url'):
        actions.append({'type': 'Action.OpenUrl', 'title': '📰 Artikel',
                        'url': lead['quelle_url']})
    if lead.get('bauherr_website'):
        actions.append({'type': 'Action.OpenUrl', 'title': '🌐 Website',
                        'url': lead['bauherr_website']})
    if lead.get('linkedin'):
        actions.append({'type': 'Action.OpenUrl', 'title': '🔗 LinkedIn',
                        'url': lead['linkedin']})
    if actions:
        items.append({'type': 'ActionSet', 'actions': actions})

    return {'type': 'Container', 'separator': True, 'spacing': 'Medium',
            'style': style, 'bleed': True, 'items': items}


_CARD_LIMIT = 26_000  # Teams kappt Cards ~28KB → mit Puffer


def _card(body: list) -> dict:
    return {
        'type': 'AdaptiveCard',
        '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
        'version': '1.4',
        'msteams': {'width': 'Full'},
        'body': body,
    }


def render_cards(leads: list[dict], day: date) -> list[dict]:
    """Eine oder mehrere Cards — bei vielen Leads wird gesplittet, damit keine
    das Teams-Größenlimit reißt (sonst kommt GAR nichts an)."""
    import json as _json
    cards, part = [], []
    total = len(leads)

    def header() -> list:
        sub = (f'{day.strftime("%-d. %B %Y")}  ·  {total} neue qualifizierte Leads'
               + (f'  ·  Teil {len(cards) + 1}' if cards else ''))
        return [_tb('🎯 Sämi · Lead-Briefing', weight='Bolder', size='ExtraLarge'),
                _tb(sub, isSubtle=True, spacing='None')]

    for lead in leads:
        block = _lead_block(lead)
        trial = header() + part + [block]
        if part and len(_json.dumps(trial, ensure_ascii=False)) > _CARD_LIMIT:
            cards.append(_card(header() + part))
            part = [block]
        else:
            part.append(block)
    if part:
        cards.append(_card(header() + part))

    # Fußnote auf die letzte Card
    if cards:
        cards[-1]['body'].append(
            _tb('Sämi bereitet vor — Kontaktentscheid trifft CRK BD.',
                isSubtle=True, size='Small', separator=True))
    return cards


def post_to_teams_webhook(card: dict, webhook_url: str) -> None:
    payload = {
        'type': 'message',
        'attachments': [{
            'contentType': 'application/vnd.microsoft.card.adaptive',
            'content': card,
        }],
    }
    r = httpx.post(webhook_url, json=payload, timeout=30)
    r.raise_for_status()
    log.info('teams adaptive card ok')


def main() -> None:
    leads = fetch_new_leads()
    if not leads:
        log.info('keine neuen Leads heute — nichts zu posten')
        return
    webhook = os.environ.get('TEAMS_WEBHOOK_URL')
    if webhook:
        for card in render_cards(leads, date.today()):
            post_to_teams_webhook(card, webhook)
    else:
        print(render_markdown(leads, date.today()))


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
    main()
