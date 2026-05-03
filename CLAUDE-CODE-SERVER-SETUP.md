# Claude Code Server Setup — 24/7 Telegram Bot

Schritt-für-Schritt Anleitung für neue Deployments. **Zeitaufwand: ~20min wenn alles glatt läuft.**

## Servers (laufend)
| User | Server | Bot | Claude Account | gog Account |
|------|--------|-----|----------------|-------------|
| Jozef | 178.104.79.158 | @jozefclaude_bot | Jozef's Abo | jkapicak3@gmail.com |
| David | 94.130.99.75 | @Alfred4everBot | alfred@myty.agency | alfred@myty.agency |
| Heino | 94.130.99.75 (parallel) | @Alina3726_bot | heinz@myty.agency | (kein gog) |

**Mehrere Bots auf einem Server:** Eindeutige Service-Namen (`claude-telegram-heinz`), eindeutige tmux-Sessions (`claude-bot-heinz`), eigene Linux-User (`heinzbot`). Plugin-Cache wird shared (Patches gelten für alle Bots auf dem Server).

## Voraussetzungen (vor Start besorgen)

1. **Server** mit SSH root-Zugang (Ubuntu 22+)
2. **Claude.ai Account** mit Pro/Max/Team Abo
3. **Für Team/Enterprise Accounts:** `channelsEnabled: true` in Org Settings aktiviert, ODER Workaround per Managed Settings (siehe Schritt 5)
4. **Google Cloud OAuth Client** (Desktop App Type, `client_secret_XXX.json`) — für gog
5. **Mac mit SSH-Schlüssel** auf dem Server (für Paste-Workarounds)

---

## Setup in 7 Schritten

### 1. Dependencies (3min)
```bash
ssh root@NEW_SERVER_IP

# Node 22, tmux, expect (für OAuth-Automation)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs tmux git expect python3-pip unzip
pip3 install pexpect --break-system-packages

# Bun (optional, für Plugins)
curl -fsSL https://bun.sh/install | bash

# Claude Code CLI
npm install -g @anthropic-ai/claude-code

# gog (Google Workspace CLI) — WICHTIG: richtige Architektur
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then GOG_ARCH=amd64; else GOG_ARCH=arm64; fi
curl -sL "https://github.com/steipete/gogcli/releases/download/v0.12.0/gogcli_0.12.0_linux_${GOG_ARCH}.tar.gz" -o /tmp/gog.tar.gz
tar -xzf /tmp/gog.tar.gz -C /tmp
mv /tmp/gog /usr/local/bin/gog
chmod +x /usr/local/bin/gog

# User für Bot
useradd -m -s /bin/bash claudebot
mkdir -p /home/claudebot/workspace/memory
chown -R claudebot:claudebot /home/claudebot
```

### 2. Claude Login (interactive flow) (5min)

**WICHTIG:** Claude Code CLI ist eine **Ink/React TUI** — kein simples stdin/paste. Nutze **pexpect**:

Auf deinem lokalen Mac `auth.py` erstellen:
```python
#!/usr/bin/env python3
import pexpect, re, time, os

env = os.environ.copy()
env['COLUMNS'] = '500'; env['LINES'] = '100'; env['TERM'] = 'dumb'

child = pexpect.spawn('claude setup-token', encoding='utf-8',
    timeout=120, env=env, dimensions=(100, 500))
output = ''

# 1) Capture URL
start = time.time()
while time.time() - start < 25:
    try: output += child.read_nonblocking(size=4096, timeout=1)
    except: pass
    clean = re.sub(r'\s+', '', re.sub(r'\x1b\[[0-9;?]*[a-zA-Z]', '', output))
    m = re.search(r'(https://claude\.com/cai/oauth/authorize\?[^\s]+?state=[A-Za-z0-9_-]+)', clean)
    if m:
        url = m.group(1).split('Pastecodehere')[0]
        open('/tmp/oauth_url.txt', 'w').write(url)
        break

# 2) Wait for callback code file
for _ in range(600):
    try:
        code = open('/tmp/oauth_code.txt').read().strip()
        if code: break
    except: pass
    time.sleep(1)

# 3) Send code + Enter
child.send(code); time.sleep(0.5); child.send('\r')
time.sleep(3)
print('DONE')
```

Deploy & start:
```bash
scp auth.py root@SERVER:/tmp/
ssh root@SERVER 'rm -f /tmp/oauth_*.txt; python3 /tmp/auth.py > /tmp/auth.log 2>&1 &
disown; sleep 8; cat /tmp/oauth_url.txt'
```

**WICHTIG:** Das ist NUR für `claude setup-token` (API-Style Token). Für interaktive Subscription brauchen wir unten Schritt 4 (tmux-Setup mit Login).

**Falls Enter im pexpect nicht submitted** (Ink ignoriert `\r` weil kitty keyboard protocol aktiv ist): Sende stattdessen die kitty-Enter-Sequenz `\x1b[13u`:
```python
child.send(code)
time.sleep(0.5)
child.send('\x1b[13u')   # kitty Enter — Ink akzeptiert das
```
Token erscheint dann im pexpect-Log (`logfile_read`), nicht in einer Datei — extrahieren mit Regex `sk-ant-oat[0-9_a-zA-Z\-]+`.

### 3. gog Google OAuth (5min)

```bash
# Credentials deployen
scp client_secret_XXX.json root@SERVER:/tmp/
ssh root@SERVER 'python3 -c "
import json
d = json.load(open(\"/tmp/client_secret_XXX.json\"))[\"installed\"]
open(\"/home/claudebot/.config/gogcli/credentials.json\", \"w\").write(
  json.dumps({\"client_id\": d[\"client_id\"], \"client_secret\": d[\"client_secret\"]}, indent=2))
"
mkdir -p /home/claudebot/.config/gogcli/keyring
echo "{\"keyring_backend\": \"file\"}" > /home/claudebot/.config/gogcli/config.json
chown -R claudebot:claudebot /home/claudebot/.config
chmod 700 /home/claudebot/.config/gogcli
'

# SSH Tunnel auf Mac öffnen
ssh -f -N -L 8081:localhost:8081 root@SERVER

# OAuth-Server starten auf Server
ssh root@SERVER 'GOG_KEYRING_PASSWORD=bot-password-hier HOME=/home/claudebot \
  nohup gog auth login --services=all --listen-addr=0.0.0.0:8081 > /tmp/gog.log 2>&1 &
disown'

# Browser: http://127.0.0.1:8081 → "Connect with Google" → mit Google-Account einloggen
```

Verifizieren:
```bash
ssh root@SERVER "GOG_KEYRING_PASSWORD=bot-password-hier HOME=/home/claudebot gog calendar list --limit 3"
```

### 4. systemd Service + Claude Subscription Login (5min)

Service-File `/etc/systemd/system/claude-telegram.service`:
```ini
[Unit]
Description=Claude Code with Telegram Channel
After=network.target

[Service]
Type=forking
Environment=HOME=/root
Environment=CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true
Environment=TELEGRAM_BOT_TOKEN=xxx:yyy
Environment=PATH=/root/.bun/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/tmux new-session -d -s claude-bot -c /home/claudebot/workspace claude --channels plugin:telegram@claude-plugins-official --permission-mode acceptEdits
ExecStop=/usr/bin/tmux kill-session -t claude-bot
RemainAfterExit=yes
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**NICHT** `CLAUDE_CODE_OAUTH_TOKEN` setzen — dieser Token (aus `claude setup-token`) ist für API-Billing, nicht Subscription. Er überschreibt den interaktiven Login und führt zu `401 Invalid bearer token`.

Enable:
```bash
systemctl daemon-reload
systemctl enable --now claude-telegram
```

**Ersten Boot durchlaufen** (interactive Login in tmux):
```bash
# Theme wählen
tmux send-keys -t claude-bot Enter
# Login method → "Claude account with subscription"
tmux send-keys -t claude-bot Enter
# OAuth URL zeigen
tmux capture-pane -t claude-bot -p | grep -oE 'https://claude.com/cai/oauth[^P]*' | tr -d '\n '
```

URL in Browser öffnen → mit Account einloggen → Callback-URL nehmen und Code extrahieren (`code#state`).

Code einsenden:
```bash
tmux send-keys -t claude-bot -l 'CODE#STATE'
tmux send-keys -t claude-bot Enter
# Dann mehrmals Enter durchklicken für Security notes, Trust workspace
```

**Trust-Folder Prompt nach jedem Service-Restart:** Wenn Service neu gestartet wird kann ein Prompt "Is this a project you trust?" auftauchen, der die Bot-Initialisierung blockiert. Check + Bestätigung:
```bash
tmux capture-pane -t claude-bot -p | grep -q "Yes, I trust" && tmux send-keys -t claude-bot Enter
```

### 5. Channels enablen (für Team/Enterprise Orgs) (1min)

Falls `Channels are not enabled for your org` auftaucht:

```bash
ssh root@SERVER "mkdir -p /etc/claude-code && cat > /etc/claude-code/managed-settings.json << 'EOF'
{
  \"channelsEnabled\": true
}
EOF
systemctl restart claude-telegram"
```

### 6. Telegram Plugin installieren (2min)

Nach dem Claude Login:
```bash
tmux send-keys -t claude-bot '/plugin install telegram@claude-plugins-official'
tmux send-keys -t claude-bot Enter
# User scope wählen
tmux send-keys -t claude-bot Enter
systemctl restart claude-telegram
```

### 6b. Permission-Settings (1min)

Ohne diese Files nervt der Bot bei **jedem** Bash/Read/Edit Call um Permission.

```bash
ssh root@SERVER '
mkdir -p /home/claudebot/.claude /home/claudebot/workspace/.claude

cat > /home/claudebot/.claude/settings.json << EOF
{
  "permissions": {
    "allow": ["Read", "Edit", "Write", "Bash", "Glob", "Grep", "WebFetch", "WebSearch"]
  }
}
EOF

cat > /home/claudebot/workspace/.claude/settings.json << EOF
{
  "permissions": {
    "allow": ["Read", "Edit", "Write", "Bash", "Glob", "Grep", "WebFetch", "WebSearch",
              "Task", "TodoWrite", "mcp__plugin_telegram_telegram"]
  }
}
EOF
# mcp__plugin_telegram_telegram ohne Suffix = Wildcard für ALLE Telegram MCP-Tools
# (reply, download_attachment, get_updates, send_message, etc.)

chown -R claudebot:claudebot /home/claudebot/.claude /home/claudebot/workspace/.claude
systemctl restart claude-telegram'
```

### 7. Telegram Pairing (1min)

1. User schickt beliebige Nachricht an den Bot in Telegram
2. Bot antwortet mit 6-char Pairing Code
3. Admin führt im tmux aus: `/telegram:access pair ABC123`
4. Permission-Prompts mit Enter durchklicken
5. Fertig — Bot hört jetzt auf diesen User

### 8. Watchdog für Auto-Recovery (PFLICHT, 2min)

**Problem:** Wenn jemand `claude` manuell innerhalb tmux startet (z.B. nach Trust-Folder Prompt), erbt der Prozess **nicht** die systemd `Environment=`-Variablen → `TELEGRAM_BOT_TOKEN required` → Plugin crasht stumm. Bot bleibt für User unsichtbar offline. Claude Code kann sein eigenes MCP-Plugin nicht selbst neustarten — externer Watchdog nötig.

**Doppelte Absicherung:**

**(a) Token-Fallback `.env`** — Plugin liest auch ohne systemd-Env:
```bash
ssh root@SERVER "echo 'TELEGRAM_BOT_TOKEN=BOT_TOKEN_HIER' > $HOME_OF_BOT/.claude/channels/telegram/.env
chmod 600 $HOME_OF_BOT/.claude/channels/telegram/.env
chown BOT_USER:BOT_USER $HOME_OF_BOT/.claude/channels/telegram/.env"
```

**(b) Health-Watchdog** — alle 2 min Auto-Restart bei Crash:

```bash
ssh root@SERVER 'cat > /usr/local/bin/claude-bot-watchdog.sh << "EOF"
#!/bin/bash
SVC="${1:?service name required}"
SVCFILE="/etc/systemd/system/$SVC.service"
[ -f "$SVCFILE" ] || { echo "no service: $SVC"; exit 1; }
HOMEDIR=$(grep -oP "Environment=HOME=\K\S+" "$SVCFILE" | head -1)
[ -z "$HOMEDIR" ] && HOMEDIR="/root"
WS=$(grep -oP "tmux new-session.*-c \K\S+" "$SVCFILE" | head -1)
[ -z "$WS" ] && WS="/home/claudebot/workspace"
CACHEKEY=$(echo "$WS" | sed "s|/|-|g")
LOGDIR="$HOMEDIR/.cache/claude-cli-nodejs/${CACHEKEY}/mcp-logs-plugin-telegram-telegram"
LATEST=$(ls -t "$LOGDIR"/*.jsonl 2>/dev/null | head -1)

restart() {
  logger -t "$SVC-watchdog" "UNHEALTHY ($1) → systemctl restart $SVC"
  systemctl restart "$SVC"; exit 0
}

systemctl is-active --quiet "$SVC" || restart "service inactive"
pgrep -fa "bun.*plugins.*telegram" 2>/dev/null | grep -q "$HOMEDIR/.claude/plugins" || restart "plugin process missing"
if [ -n "$LATEST" ]; then
  tail -30 "$LATEST" 2>/dev/null | grep -qE "TELEGRAM_BOT_TOKEN required|Connection failed: MCP|Connection closed" \
    && tail -1 "$LATEST" | grep -qE "Connection failed|required" \
    && restart "fatal error in latest log"
fi
TOKEN=$(grep -oP "TELEGRAM_BOT_TOKEN=\K\S+" "$SVCFILE" | head -1 | tr -d "\"")
[ -n "$TOKEN" ] && curl -sf --max-time 5 "https://api.telegram.org/bot$TOKEN/getMe" > /dev/null \
  || logger -t "$SVC-watchdog" "WARN: Telegram API unreachable"
logger -t "$SVC-watchdog" "healthy"
EOF
chmod +x /usr/local/bin/claude-bot-watchdog.sh

cat > /etc/systemd/system/claude-bot-watchdog@.service << "EOF"
[Unit]
Description=Claude bot health watchdog (%i)
[Service]
Type=oneshot
ExecStart=/usr/local/bin/claude-bot-watchdog.sh %i
EOF

cat > /etc/systemd/system/claude-bot-watchdog@.timer << "EOF"
[Unit]
Description=Run claude bot watchdog every 2 min (%i)
[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
Unit=claude-bot-watchdog@%i.service
[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now claude-bot-watchdog@SERVICE_NAME.timer'
```

`SERVICE_NAME` ist z.B. `claude-telegram` oder `claude-telegram-heinz`. Bei mehreren Bots pro Server für jeden separat enablen.

**Verifizieren:**
```bash
systemctl list-timers "claude-bot-watchdog@*"
journalctl -t SERVICE_NAME-watchdog --since "5 min ago"
```

**Failure-Test (optional):** `pkill -f "bun.*telegram"` → binnen 2 min sollte Plugin wieder laufen.

**Wichtig:** Watchdog sendet **keine** Telegram-Nachrichten an User. Loggt nur via `logger`. Max-Downtime bei Plugin-Crash: 2 min statt unbegrenzt.

---

## CLAUDE.md Template

```markdown
# Claude Code — {Name}s AI Assistent

## Wer bin ich?
Du bist {Name}s persönlicher Claude Code Assistent. Du läufst 24/7 auf einem
Hetzner Server und bist über Telegram erreichbar (@BotUsername).

## Memory System
Speichere wichtige Informationen in Markdown-Dateien im `memory/` Ordner:
- `memory/user.md` — Infos über {Name}
- `memory/projects.md` — Aktuelle Projekte
- `memory/contacts.md` — Wichtige Kontakte
- `memory/notes.md` — Notizen und Todos
- `memory/decisions.md` — Entscheidungen

## Google Workspace (Gmail, Calendar, Drive, Sheets)
Account: email@domain.com

Nutze `gog` für Google Workspace. Immer diese Env-Variablen:
\`\`\`bash
GOG_KEYRING_PASSWORD=bot-password-hier HOME=/home/claudebot gog <befehl>
\`\`\`

## Status-Updates bei längeren Tasks
- Sofort kurz bestätigen was du tust
- Bei Sub-Agenten: Zwischenstatus alle 1-2 Minuten
- NIEMALS Stille nach Arbeitsstart
- Ergebnisse sofort zusammenfassen

## Regeln
- Antworte auf Deutsch, kurz und direkt
- {Name} steuert vom Handy — kompakt halten
```

---

## Troubleshooting

| Problem | Ursache | Fix |
|---------|---------|-----|
| `Raw mode is not supported` | Keine TTY | tmux new-session nutzen, nicht `echo \| claude` |
| `Invalid bearer token (401)` | CLAUDE_CODE_OAUTH_TOKEN gesetzt | Env-Var entfernen, Subscription-Login nutzen |
| `Channels not enabled for your org` | Team/Enterprise-Policy | `/etc/claude-code/managed-settings.json` mit `channelsEnabled: true` |
| `Invalid code` (OAuth) | Code verbraucht (Single-Use) | Neuen OAuth-Flow starten |
| tmux-Session stirbt | SSH-Session Ende | `nohup tmux new-session -d` mit `disown` |
| URL abgeschnitten | Terminal 80 chars | `pexpect.spawn(dimensions=(100, 500))` |
| Token nicht in Output | Async print | 60s warten, dann mit Regex `sk-ant-oat[0-9_a-zA-Z\-]+` |
| `#` im OAuth-Code | Terminal interpretiert als Comment | Via File: `echo 'code#state' > /tmp/code` |
| gog `Exec format error` | Falsche Architektur | x86 vs ARM — richtiges Binary holen |
| `claude setup-token` Enter funktioniert nicht | Kitty keyboard protocol | `child.send('\x1b[13u')` statt `\r` |
| Service "active" aber Bot nicht erreichbar | Trust-Folder Prompt nach 1. Start | `tmux send-keys -t SESSION Enter` (siehe Schritt 4) |
| 2. Bot auf gleichem Server zerstört 1. | tmux Session-Name oder HOME überschneidet | Eindeutige Service-/Session-Namen + getrennte Linux-User |
| Plugin crasht stumm, Bot reagiert nicht mehr auf Telegram | Manueller `claude` Aufruf in tmux ohne env-Vars → `TELEGRAM_BOT_TOKEN required` | Watchdog (Schritt 8) heilt automatisch + `.env` Fallback |

---

## Was der Bot kann (alles funktioniert ab Schritt 7)

- **Sub-Agents** (Agent Teams) — parallele Research/Tasks
- **Memory** — automatisches Speichern in MD-Files
- **Web Search + Fetch** — built-in
- **Google Workspace** — Gmail, Calendar, Drive, Sheets via `gog`
- **Bash/Read/Edit/Grep** — volle CLI-Power
- **Telegram Streaming** — Antworten mit Teilausgabe während Claude arbeitet
- **Autostart bei Reboot** via systemd
- **Auto-Restart bei Crash** (`Restart=always`)

---

## Kosten

| Item | Kosten |
|------|--------|
| Hetzner Server (8GB RAM reicht) | ~€8-15/mo |
| Claude Code Abo (Pro/Max) | via Claude-Subscription (0€ extra) |
| Telegram Bot | Gratis |
| Google Workspace API | Gratis (OAuth Desktop App) |
| **Gesamt** | **~€10-15/mo pro Bot** |
