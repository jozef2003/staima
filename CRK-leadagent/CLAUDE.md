# CRK Lead Agent — Sämi

## Was hier passiert

Lead-Recherche-Agent für die Kommunikationsagentur **CRK**. Läuft TÄGLICH
(crontab auf dem Server: `0 4 * * *` UTC → ~06:00 CEST, alles in
`server/cron/weekly.sh`): crawlt Schweizer Immobilien-Berichterstattung +
Amtsblatt-Baugesuche, bewertet jedes Projekt nach der CRK-Lead-Logik und
postet das Tages-Briefing (nur neue Leads) in einen Teams-Kanal.

Quellen: NZZ, Tamedia (Tagi/Bund/BZ/24heures/TdG/20min), CH-Media (SoZ),
SRF, Watson, Blick, Bilanz + **amtsblattportal.ch** (Baugesuche BE/ZH via
JSON-API — früheste Lead-Quelle, vor jeder Medienberichterstattung).

Fehler-Alerts: bricht ein kritischer Pipeline-Step ab oder läuft eine
Paywall-Session ab, postet `server/notify.py` eine Warnung in den
Teams-Kanal (`TEAMS_WEBHOOK_URL`, optional `TEAMS_ALERT_WEBHOOK_URL`).

Das vollständige Briefing liegt in [`docs/briefing.md`](docs/briefing.md) — das
ist die Single Source of Truth für Lead-Logik, Quellen, Format und Kriterien.
Vor jeder Änderung an Prompts oder Bewertungs-Code dort spicken.

## Architektur

```
Crawlers (RSS, nur Teaser) ──► Postgres (articles)
                                        │
                          Prefilter (Keyword-Gate, kein LLM) ──► droppt Noise
                                        │
                          Fulltext-Fetcher (httpx+bs4) ──► füllt article.fulltext
                                        │
                          Classifier (claude -p) ──► article.relevant
                                        │
                          Scorer (claude -p) ──► Postgres (leads) + confidence
                                        │
                          Enrichment + Verify (AGENT: WebSearch+WebFetch)
                            └► verifiziert Projekt, RE-BEWERTET Potenzial gegen
                               Web-Evidenz, recherchiert echte Kontakte (Bauherr,
                               Website, Ansprechperson, LinkedIn);
                               "schon betreut?" → Rückstufung auf Tief
                            (classify/score bleiben text-basiert: zu viele Artikel)
                                        │
                          Dedup vs. Vorwochen (core-token fingerprint)
                                        │
              ┌─────────────────────────┴──────────────────┐
              ▼                                            ▼
     Teams-Post (täglich ~07-08h,         Dashboard (Next.js)
      nur neue Leads des Tages)
                                                          │
                                          👍/👎/kontaktiert ─┘
                                          fliesst zurück
                                          in Scorer-Prompt
```

Pipeline: `crawl → prefilter → fetch_fulltext → classify → score → enrich → dedupe → post`.
Schema-Migrationen in Reihenfolge: `0002_supabase_init.sql` → `0003_enrich.sql`
→ `0004_agent_enrich.sql`.

Agent-Tooling: `enrich.py` läuft via `claude -p --allowedTools WebSearch,WebFetch`.
Der Helper `call_claude(prompt, tools=[...])` in `pipeline/classify.py` ist
generisch — classify/score lassen sich genauso zu Agenten aufrüsten. Nur
read-only Tools (kein Bash/Write) → headless ohne Permission-Prompts & safe.

## Repo-Layout

```
CRK-leadagent/
├── src/              # Next.js Dashboard (npm run dev)
├── server/           # Python Pipeline auf Hetzner
│   ├── crawlers/     # ein Modul pro Quelle
│   ├── pipeline/     # classify, score, dedupe
│   ├── output/       # teams_post
│   └── cron/         # systemd-timer / shell-wrapper
├── db/               # SQL-Migrations
├── docs/             # briefing.md (CRK Source of Truth)
└── scripts/          # Setup, Deploy, Monitoring
```

## Wichtige Regeln

- **Lead-Logik kommt aus `docs/briefing.md`** — wenn Code und Briefing
  auseinanderlaufen, gewinnt das Briefing. Bei Konflikt: nachfragen.
- **Niemals Mensch ersetzen, nur vorbereiten.** Output = Empfehlung. Wer
  kontaktiert wird entscheidet CRK BD.
- **Begründung pflicht.** Jeder Lead hat ein `kommunikationsbedarf` Feld das
  konkret sagt warum genau dieses Projekt — generische Phrasen vermeiden.
- **Quelle + Datum + Direkt-Link** zu jedem Lead, immer. Audit-Trail.

## Stack

- Frontend: Next.js 16 (App Router) + Tailwind v4
- Backend: Python 3.11, Playwright, asyncpg
- LLM: Claude Code (CRK Max-Plan) via `claude -p` headless
- DB: Postgres (Hetzner-lokal oder Supabase, tbd)
- Hosting: Hetzner VPS (178.104.247.183), User `saemi`
- Deploy: KEIN Git auf dem Server — `rsync -az --exclude .venv --exclude __pycache__ --exclude cache server/ saemi@178.104.247.183:/home/saemi/saemi/server/`

## Paywall-Volltext (Cookie-Sessions)
Module `crawlers/{nzz,chmedia,tamedia}.py` holen Volltext hinter Paywall via
importierter Browser-Session (Playwright storage_state in `server/cache/*_state.json`).
`fetch_fulltext.py` routet URLs per Matcher an das passende Modul.
- **Tamedia** (`tamedia.py`) deckt Tagi + Bund + BZ + 24heures + TdG ab — EIN
  Piano-Abo (`kommunikation@cr-k.ch`). ABER: Cookies sind **pro Domain**. Der
  Export von tagesanzeiger.ch schaltet nur Tagi-Volltext frei; für derbund.ch /
  bernerzeitung.ch / 24heures.ch / tdg.ch je einmal dort einloggen + Cookies
  mit-exportieren.
- **Stand 12.06.2026: tagesanzeiger.ch + derbund.ch + bernerzeitung.ch importiert
  & verifiziert (Volltext läuft). Offen: 24heures.ch / tdg.ch (Romandie).**
- `import_cookies` **merged** in die bestehende Session (dedupe per domain+name),
  ersetzt sie NICHT — mehrere Domains nacheinander importierbar.
- Setup: `python -m crawlers.tamedia import <cookies.json>` (Cookie-Editor JSON).
- Extraktion filtert Consent-/Footer-Müll (`_JUNK_MARKERS`) + 2-fach-Retry für
  Piano (manchmal lädt der Volltext verzögert).
- Session abgelaufen → `notify.py` postet Teams-Alert (alle Volltext fällt auf Teaser).
- Teams-Integration: Microsoft Graph API

## Lokale Entwicklung

```bash
npm install
npm run dev        # Dashboard auf :3000
```

Python-Pipeline ist Server-only — lokal nur die Crawler-Tests, nicht der ganze
Cron-Lauf. Siehe `server/README.md`.
