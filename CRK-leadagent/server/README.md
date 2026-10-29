# Server-Pipeline

Läuft auf Hetzner-VPS `178.104.247.183` als User `saemi`. Python 3.11.

## Komponenten

- `crawlers/rss_feeds.py` — 20 RSS-Quellen (NZZ, Tagesanzeiger DE/ZH,
  20minuten, Berner Zeitung, BZ Basel, Aargauer Zeitung, Luzerner Zeitung,
  SRF, 24heures, Tribune de Genève, 20minutes Romandie, Inside Paradeplatz).
  Schreibt rohe Artikel in `crk_articles`. Idempotent via `crk_articles.url` UNIQUE.
- `crawlers/tagesanzeiger.py` — Volltext-Scraper hinter Paywall (Playwright,
  Email-OTP, one-time manueller Login + Session-Cache). Stand: ready, OTP-Flow
  noch in Validierung.
- `crawlers/baublatt.py` — Placeholder. Baublatt hat keine offene RSS; manueller
  Scraper kommt später.
- `crawlers/fulltext.py` — holt den Artikel-Body über den Link und extrahiert den
  Haupttext (httpx + BeautifulSoup-Heuristik). RSS liefert nur Anteaser; ohne
  diesen Step bewertet die Pipeline auf 1-2 Sätzen.
- `crawlers/nzz.py` — **NZZ Paywall-Volltext via importierter Browser-Session.**
  NZZ-Login (Piano SSO + reCAPTCHA) lässt sich nicht automatisieren; daher: Mensch
  loggt sich 1× im echten Browser ein, exportiert die Cookies (Cookie-Editor →
  JSON), `python -m crawlers.nzz import <cookies.json>` schreibt einen
  Playwright-storage_state (`server/cache/nzz_state.json`, gitignored, mode 600).
  `fetch_fulltext.py` routet nzz.ch-URLs dann automatisch hierdurch (Consent-
  Klick + Scroll + Body-Extraktion, ~8k Zeichen/Artikel). Bei Ablauf →
  `SessionExpiredError` → NZZ fällt auf Teaser zurück, Cookies neu importieren.
  Tagi (`crawlers/tagesanzeiger.py`) bräuchte denselben Weg, ist aber wegen
  Mail-OTP + Cloudflare-Turnstile noch nicht aktiv.
- `pipeline/prefilter.py` — billiger Keyword-Gate VOR dem LLM. Kickt Artikel
  ohne jedes Bau-/Immo-Signal raus (is_relevant=false), spart 70-80% der
  teuren `claude -p`-Calls. Konservativ: im Zweifel durchlassen.
- `pipeline/fetch_fulltext.py` — lädt den Volltext NUR für Prefilter-Survivor
  nach (6 parallele Fetches), schreibt ihn in `crk_articles.fulltext`,
  markiert `fulltext_fetched=true`.
- `pipeline/classify.py` — Claude-Aufruf (`claude -p`) entscheidet ob ein Artikel
  ein konkretes Schweizer Bauprojekt mit Lead-Potenzial beschreibt.
- `pipeline/score.py` — bewertet relevante Artikel nach CRK-Lead-Logik aus
  `docs/briefing.md` und füllt die `crk_leads`-Tabelle. Lädt zusätzlich jüngste
  👍/👎-Feedbacks aus `crk_lead_feedback` als Kalibrierungs-Block in den Prompt.
- `pipeline/enrich.py` — **AGENT-Modus**: `claude -p` mit `--allowedTools
  WebSearch,WebFetch`. Ein Web-Pass pro Lead, der zugleich:
  (a) das Projekt **verifiziert** (real/aktuell/nicht erledigt),
  (b) das **Potenzial web-verifiziert re-bewertet** (`potenzial_verifiziert`
      überschreibt das reine Text-Rating aus score.py),
  (c) **echte Kontakte** recherchiert — offizielle Firma (zefix), Website,
      Ansprechperson + Rolle + LinkedIn, Kontaktweg mit Quelle,
  (d) prüft ob der Bauherr **schon betreut** ist (→ harte Rückstufung "Tief").
  Read-only Tools, kein Bash/Write → headless safe. Fallback auf text-only bei
  Tool-/Netzfehler. Läuft nur über ≤30 qualifizierte Leads/Woche.
  `call_claude(..., tools=[...])` in `classify.py` ist der generische Agent-
  Helper. classify bleibt bewusst text-basiert (Web-Recherche über hunderte
  Artikel wäre Verschwendung — Prefilter killt den Noise schon).
- `pipeline/dedupe.py` — markiert Leads mit gleichem fingerprint als
  `is_duplicate=true`. Fingerprint basiert seit 0003 auf füllwort-freien
  Kern-Tokens (Projekt+Standort), damit "Areal X" und "Überbauung X" über
  Wochen zuverlässiger zusammenfallen.
- `output/teams_post.py` — rendert Markdown-Briefing; mit `TEAMS_WEBHOOK_URL`
  postet es direkt in den Teams-Kanal, sonst stdout.

Alle Module nutzen `db.py` als einzigen DB-Layer (Supabase REST, kein psycopg).

## Cron / systemd-timer

Aktiver User-Crontab auf dem Server (`crontab -l`, Zeiten in UTC; CEST=UTC+2):
```
täglich 04:00 UTC (Mo-So) → cron/weekly.sh   (sequenzieller Voll-Lauf, alle Steps)
```
Ein täglicher All-in-One-Lauf statt zeitlich getrennter Steps → keine Race-
Conditions, jeder Step idempotent. Teams-Post zeigt nur die **heute neuen** Leads
(`output/teams_post.py` → `fetch_new_leads`, created_at >= heute 00:00 UTC);
`dedupe` davor sorgt dafür, dass Projekte aus Vortagen nicht erneut auftauchen.
Die Einzel-Scripts (crawl/classify/score/dedupe-post) bleiben für manuelle Läufe.

Pipeline-Reihenfolge (idempotent, jeder Step nimmt nur was der vorige offen liess):
`crawl → prefilter → fetch_fulltext → classify → score → enrich → dedupe → post`

`cron/weekly.sh` ist ein "alles-in-einem"-Fallback.

## Lokales Entwickeln

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install playwright httpx feedparser python-dateutil pydantic beautifulsoup4
playwright install chromium

# .env muss NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY enthalten
set -a && source ../.env && set +a

# Einzelne Steps laufen lassen (Reihenfolge!)
python -m crawlers.run_all              # crawl (RSS, nur Teaser)
python -m pipeline.prefilter            # Keyword-Gate, droppt Noise
python -m pipeline.prefilter --dry-run  # zeigt was gedroppt würde
python -m pipeline.fetch_fulltext       # Volltext für Survivor nachladen
python -m pipeline.fetch_fulltext --dry-run --limit=10
python -m pipeline.classify             # Relevanzprüfung (LLM)
python -m pipeline.classify --dry-run --limit=5   # ohne DB-write
python -m pipeline.score                # nur relevante Artikel ohne Lead
python -m pipeline.enrich               # Bauherr/Kontakt/Aufhänger pro Lead
python -m pipeline.enrich --dry-run --limit=5
python -m pipeline.dedupe               # markiert duplicates
python -m output.teams_post             # Markdown auf stdout (oder Webhook)

# Volltext-Extraktion einzeln testen
python -m crawlers.fulltext https://www.nzz.ch/zuerich/<artikel>

# DB-Migrationen müssen eingespielt sein (Supabase SQL Editor, in Reihenfolge):
#   db/0003_enrich.sql        Volltext-Tracking + Enrichment-Spalten
#   db/0004_agent_enrich.sql  Agent-Felder (ansprechpartner, linkedin, verify, …)
#
# Agent-Enrichment braucht eine claude-CLI mit WebSearch/WebFetch (Max-Plan-Login
# auf dem saemi-Server). Ohne Web-Tools fällt enrich automatisch auf text-only.
```

## Tagesanzeiger Volltext-Scraper (optional)

```bash
python -m crawlers.tagesanzeiger login    # headed, 6-stelliger OTP-Code per Mail
python -m crawlers.tagesanzeiger fetch <artikel-url>
python -m crawlers.tagesanzeiger status   # prüft ob Session noch gültig
```
