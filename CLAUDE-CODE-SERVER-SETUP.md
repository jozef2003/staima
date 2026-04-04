# Claude Code Server Setup — 24/7 Telegram Bot

## Übersicht
Claude Code läuft als 24/7 Service auf einem Hetzner Server und ist über Telegram erreichbar.
Nutzt das Claude Pro/Max Abo — **keine API Kosten**.

## Server
- **IP**: 178.104.79.158 (marlene-jozef-test)
- **Telegram Bot**: @jozefclaude_bot
- **Service**: claude-telegram.service (systemd + tmux)
- **Modell**: Sonnet 4.6 (via Claude Abo)
- **Workspace**: /home/claudebot/workspace

## Features

### Telegram Channel
- 24/7 erreichbar über @jozefclaude_bot
- Pairing-basiert (nur autorisierte User)
- Permission: `mcp__plugin_telegram_telegram__reply` auto-allowed

### Gmail / Calendar / Drive
- Über `gog` CLI (gleich wie OpenClaw Bots)
- Befehl: `GOG_KEYRING_PASSWORD=openclaw-surfer gog gmail search "newer_than:1d"`
- Konto: jkapicak3@gmail.com

### Morgen-Briefing (Cron)
- **Zeitplan**: Täglich 8:03 CET
- **Script**: /home/claudebot/workspace/morgen_briefing.sh
- **Inhalt**: Termine + E-Mails + AI News → Telegram

### Memory System
- `workspace/CLAUDE.md` — Hauptinstruktionen
- `workspace/memory/user.md` — User-Infos
- `workspace/memory/projects.md` — Projekte
- `workspace/memory/contacts.md` — Kontakte
- `workspace/memory/notes.md` — Notizen
- `workspace/memory/decisions.md` — Entscheidungen

### Agent Teams
- Experimentelles Feature für parallele Sub-Agenten
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true`
- Claude kann Tasks an spezialisierte Agenten delegieren

## Vergleich: Claude Code vs OpenClaw

| Feature | Claude Code | OpenClaw |
|---|---|---|
| **Kosten** | 0€ (Pro Abo) | API Tokens (~5-50€/Mo) |
| **Modell** | Sonnet 4.6 | Haiku/Sonnet (wählbar) |
| **Telegram** | Channel Plugin | Built-in |
| **Gmail/Calendar** | gog CLI | gog CLI (Built-in) |
| **Cron-Jobs** | Crontab/Scheduled Tasks | Built-in |
| **CLI-Power** | Volle Bash/Read/Edit/Web | Eingeschränkt auf Skills |
| **Agent Teams** | Sub-Agenten spawnen | Nicht verfügbar |
| **Memory** | MD Files + CLAUDE.md | Session-basiert |
| **Setup-Aufwand** | Höher (Auth, Plugins) | Niedriger (Config-basiert) |
| **Flexibilität** | Sehr hoch | Bot-fokussiert |

## Systemd Service

```ini
[Unit]
Description=Claude Code with Telegram Channel
After=network.target

[Service]
Type=forking
Environment=HOME=/root
Environment=CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
Environment=CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true
Environment=TELEGRAM_BOT_TOKEN=8753466695:...
Environment=PATH=/root/.bun/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/tmux new-session -d -s claude-bot -c /home/claudebot/workspace claude --channels plugin:telegram@claude-plugins-official --permission-mode acceptEdits
ExecStop=/usr/bin/tmux kill-session -t claude-bot
RemainAfterExit=yes
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Setup-Schritte (Kurzfassung)

1. Node.js + Bun installieren
2. `npm install -g @anthropic-ai/claude-code`
3. `claude setup-token` (OAuth Token generieren)
4. Telegram Plugin: `/plugin install telegram@claude-plugins-official`
5. Token in `~/.claude/channels/telegram/.env`
6. Systemd Service erstellen
7. Trust-Prompt bestätigen nach Start
8. Telegram Pairing: `/telegram:access pair CODE`

## Agent Teams — Was kann man damit machen?

Agent Teams erlaubt Claude, **mehrere Sub-Agenten parallel** zu spawnen:

- **Recherche-Team**: Ein Agent sucht AI News, ein anderer checkt Emails, ein dritter prüft Kalender — alle gleichzeitig
- **Code-Review**: Mehrere Agenten prüfen verschiedene Dateien parallel
- **Daten-Analyse**: Ein Agent scrapt Webseiten, ein anderer analysiert die Daten
- **Multi-Projekt**: Gleichzeitig an verschiedenen Repos arbeiten
- **Vergleichsanalysen**: Mehrere Wettbewerber parallel recherchieren

Beispiel via Telegram:
> "Recherchiere parallel: 1) Was macht Anthropic diese Woche? 2) OpenAI News? 3) Google AI Updates?"

Claude spawnt 3 Sub-Agenten die gleichzeitig arbeiten und fasst die Ergebnisse zusammen.
