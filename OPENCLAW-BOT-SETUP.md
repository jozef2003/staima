# OpenClaw Bot Setup — Full Workflow

Kompletter Ablauf um einen neuen OpenClaw Bot aufzusetzen: Telegram + Google OAuth (Gmail, Calendar, Drive, Sheets, Docs, Contacts) + Dashboard-Chat.

Beispiel-Bots die nach diesem Muster laufen: Sietch, Nora, James, Sämi.

---

## 0. Voraussetzungen

- **Server**: Ubuntu mit `openclaw` und `gog` CLI installiert (siehe Pfad mit `which openclaw gog`).
- **GCP-Projekt**: `capable-memory-489912-n6` (Jozefs eigenes). OAuth-Clients aus anderen Projekten funktionieren nicht, weil die Test-User-Liste nicht zugänglich ist.
- **OAuth Consent Screen**: https://console.cloud.google.com/apis/credentials/consent?project=capable-memory-489912-n6
  - Mode: "Testing"
  - Test Users müssen **vor** dem Login eingetragen werden.
- **Bot-Zielaccount**: z.B. `<botname>@myty.agency` (Google Workspace).
- **Dashboard**: Next.js `src/app/(dashboard)/api/bot-chat/route.ts` ist der WebSocket-Proxy — muss existieren.

---

## 1. Server-Setup

Jeder Bot hat auf dem Server ein eigenes Home-Verzeichnis + systemd Service:

```
/opt/<bot>/
  .openclaw/
    openclaw.json          # Gateway + Channels Config
    workspace/             # IDENTITY.md, SOUL.md, TOOLS.md, USER.md etc.
    agents/main/           # Agent state
    telegram/              # Telegram state
```

### openclaw.json (Minimal-Template)

```json
{
  "agents": { "defaults": { "model": { "primary": "anthropic/claude-haiku-4-5" } } },
  "commands": { "native": "auto", "nativeSkills": "auto", "restart": true },
  "channels": {
    "telegram": {
      "enabled": true,
      "dmPolicy": "pairing",
      "botToken": "<telegram-bot-token>",
      "allowFrom": [],
      "groupPolicy": "allowlist"
    }
  },
  "gateway": {
    "port": 18800,
    "mode": "local",
    "bind": "lan",
    "controlUi": {
      "allowedOrigins": ["http://localhost:3000", "http://localhost"],
      "dangerouslyAllowHostHeaderOriginFallback": true,
      "dangerouslyDisableDeviceAuth": true
    },
    "auth": { "mode": "token", "token": "<64-char-random-token>" },
    "trustedProxies": ["127.0.0.1", "::1"]
  }
}
```

**Wichtig:**
- `port` je Bot einzigartig (Sietch 8080, Nora 8081, Sämi 18801, James 18802 …).
- `auth.token` = 64+ zufällige Hex-Zeichen (`openssl rand -hex 32`). Kommt auch in die Supabase `bots.gateway_token`.
- `dangerouslyDisableDeviceAuth: true` umgeht ECDSA-Signierung (sonst muss die Dashboard-Route signieren).
- `dangerouslyAllowHostHeaderOriginFallback: true` erlaubt Host-Header als Origin-Fallback (Node.js `ws` sendet keinen Origin).

### systemd Service

`/etc/systemd/system/<bot>.service`:

```ini
[Unit]
Description=<Bot> OpenClaw Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/<bot>
Environment=HOME=/opt/<bot>
Environment=GOG_KEYRING_PASSWORD=openclaw-<bot>
Environment=ANTHROPIC_API_KEY=sk-ant-...
ExecStart=/usr/bin/openclaw gateway
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable <bot>
systemctl start <bot>
systemctl status <bot>
```

---

## 2. Telegram Setup

### Bot erstellen

1. In Telegram: `@BotFather` → `/newbot` → Name + Username → Token bekommen.
2. Token in `openclaw.json` eintragen (`channels.telegram.botToken`).
3. Service restart: `systemctl restart <bot>`.

### Pairing (Standard-Flow)

`dmPolicy: "pairing"` → User sendet dem Bot eine DM, durchläuft Pairing-Dialog, seine Telegram-ID wird in `allowFrom` gespeichert. Kein manuelles Eintragen nötig.

### Telegram deaktivieren (wenn noch kein Token vorhanden)

Vermeidet Crash beim Bot-Start:

```bash
sed -i 's/"enabled": true,$/"enabled": false,/' /opt/<bot>/.openclaw/openclaw.json
systemctl restart <bot>
```

---

## 3. Google OAuth Setup

Bot bekommt Zugriff auf Gmail, Calendar, Drive, Sheets, Docs, Contacts via OAuth Refresh Token.

### 3.1 OAuth Client in GCP erstellen

1. https://console.cloud.google.com/apis/credentials?project=capable-memory-489912-n6
2. **+ Create Credentials** → **OAuth client ID** → Type: **Desktop app** → Name: `<bot>` → Create.
3. **Download JSON** → nach `bots/sietch/client_secret_<bot>.json`.

### 3.2 Test User eintragen

https://console.cloud.google.com/apis/credentials/consent?project=capable-memory-489912-n6

→ **Test users** → **+ Add Users** → `<bot>@myty.agency` → Save.

### 3.3 OAuth-Skript anlegen

Vorlage: `bots/sietch/get_james_token.py`. Kopieren, anpassen:

```python
CLIENT_SECRET_FILE = os.path.join(BOT_DIR, "client_secret_<bot>.json")
AUTHORIZED_USER_FILE = os.path.join(BOT_DIR, "<bot>_authorized_user.json")
GOGCLI_TOKEN_FILE = os.path.join(BOT_DIR, "<bot>_gogcli_token.json")
BOT_EMAIL = "<bot>@myty.agency"
```

Scopes in der Vorlage sind bereits vollständig (Gmail, Calendar, Drive, Sheets, Docs, Contacts).

### 3.4 OAuth-Flow ausführen

```bash
cd bots/sietch
python3 -u -W ignore get_<bot>_token.py
```

- Skript druckt einen Link aus.
- **Link auf dem gleichen Mac** öffnen (Callback geht an `localhost:<random-port>`).
- Mit `<bot>@myty.agency` einloggen, alle Scopes bestätigen.
- Am Ende: "Bad Gateway" / "Seite nicht erreichbar" = **Erfolg** (Callback wurde vom lokalen Server empfangen, Token in JSON gespeichert).

### 3.5 Token auf Server uploaden

```bash
scp bots/sietch/<bot>_gogcli_token.json root@<SERVER>:/tmp/<bot>_token.json
scp bots/sietch/<bot>_authorized_user.json root@<SERVER>:/opt/<bot>/.openclaw/authorized_user.json

ssh root@<SERVER> "
  HOME=/opt/<bot> GOG_KEYRING_PASSWORD=openclaw-<bot> \
    gog auth tokens import /tmp/<bot>_token.json && \
  rm /tmp/<bot>_token.json
"
```

### 3.6 Testen

```bash
ssh root@<SERVER> "HOME=/opt/<bot> GOG_KEYRING_PASSWORD=openclaw-<bot> \
  gog --account <bot>@myty.agency gmail messages list 'in:inbox' --max 3"
```

Bei mehreren Tokens im Keyring ist `--account <email>` **Pflicht** (sonst `missing --account`).

### 3.7 Alte/ungültige Tokens entfernen

```bash
gog auth tokens delete <old-email> --force
```

---

## 4. Dashboard-Aktivierung

### 4.1 Supabase `bots` Tabelle

```sql
UPDATE bots SET
  gateway_url = 'http://<SERVER>:<PORT>/',
  gateway_token = '<64-char-token aus openclaw.json>',
  status = 'online'
WHERE id = '<bot-uuid>';
```

Via REST API (Service-Role-Key):

```bash
SRK="<supabase-service-role-key>"
curl -X PATCH "https://xruzlivosammlmkrqtlo.supabase.co/rest/v1/bots?id=eq.<bot-uuid>" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  -H "Content-Type: application/json" \
  -d '{"gateway_url":"http://<SERVER>:<PORT>/","gateway_token":"<token>","status":"online"}'
```

**Zum URL-Schema:**
- Direkter Zugriff: `http://<IP>:<PORT>/` → wird zu `ws://...` konvertiert.
- Via Reverse Proxy (wie Sietch/Nora auf myty.agency): `https://myty.agency/bots/<bot>` → wird zu `wss://...`.

### 4.2 Test

```bash
curl -s -X POST "http://localhost:3002/api/bot-chat" \
  -H "Content-Type: application/json" \
  -d '{"gatewayUrl":"http://<SERVER>:<PORT>/","gatewayToken":"<token>","message":"hi","botId":"<bot-uuid>"}'
```

Erwartung: `{"reply":"...","sessionKey":"agent:main:main"}`.

### 4.3 UI

Im Dashboard: Client-Detailseite → Tab **Chat** → Bot auswählen → schreiben.

---

## 5. Test-Daten erstellen (optional)

Damit der Bot beim ersten Test was zum Lesen hat:

```bash
ssh root@<SERVER> "
  HOME=/opt/<bot> GOG_KEYRING_PASSWORD=openclaw-<bot> \
    gog --account <bot>@myty.agency calendar create primary \
      --summary 'Test-Meeting' \
      --from '2026-04-26T14:00:00+02:00' --to '2026-04-26T15:00:00+02:00' \
      --location 'Zoom' --description 'Testevent'

  HOME=/opt/<bot> GOG_KEYRING_PASSWORD=openclaw-<bot> \
    gog --account <bot>@myty.agency docs create 'Test-Dokument'

  HOME=/opt/<bot> GOG_KEYRING_PASSWORD=openclaw-<bot> \
    gog --account <bot>@myty.agency sheets create 'Test-Sheet'

  HOME=/opt/<bot> GOG_KEYRING_PASSWORD=openclaw-<bot> \
    gog --account <bot>@myty.agency gmail send \
      --to <bot>@myty.agency \
      --subject 'Test' --body 'Hallo Bot!'
"
```

Dann im Dashboard testen: *"Was steht morgen im Kalender?"*, *"Welche Docs hab ich?"*.

---

## 6. Bekannte Fallstricke

| Fehler | Ursache | Fix |
|--------|---------|-----|
| `invalid_grant` beim Gmail-Test | Refresh-Token abgelaufen (Testing-App: 7 Tage) | OAuth-Flow neu ausführen |
| `Fehler 403: access_denied` | Ziel-Account nicht als Test-User eingetragen | GCP Console → OAuth Consent Screen → Test Users → Add |
| Consent-Screen zeigt fremden App-Namen | `client_secret` aus fremdem GCP-Projekt | Neuen OAuth-Client in `capable-memory-489912-n6` erstellen |
| "Bad Gateway" sofort nach Login auf Handy | OAuth-Callback geht an `localhost:<port>` — das Handy hat keinen lokalen Python-Server | Link auf dem Mac öffnen wo das Skript läuft |
| Bot antwortet nicht im Dashboard | Gateway nicht erreichbar / falscher Token / falsche URL | `nc -zv <ip> <port>`; `systemctl status <bot>`; Token gegen `openclaw.json` prüfen |
| `missing --account` bei gog | Mehrere Tokens im Keyring | `--account <email>` explizit setzen |
| Gateway-Timeout im Chat | Tool-Use dauert lange, WS_TIMEOUT=120s in route.ts | Längere Operations in Background/Queue, oder Timeout erhöhen |
| Zeit im Kalender falsch | Server UTC, Bot zeigt UTC statt Local | In `TOOLS.md` des Bots Zeitzone hinterlegen (z.B. `Europe/Zurich`) |

---

## 7. Referenz-Dateien im Repo

- `bots/sietch/get_james_token.py` — OAuth-Skript-Vorlage
- `bots/sietch/client_secret_*.json` — OAuth-Client-Secrets pro Bot
- `bots/sietch/*_gogcli_token.json` — gog-Format Token (→ server `/tmp/`)
- `bots/sietch/*_authorized_user.json` — Python-Format Token (→ server `/opt/<bot>/.openclaw/`)
- `src/app/(dashboard)/api/bot-chat/route.ts` — WebSocket-Proxy für Dashboard-Chat
- `src/components/client/client-chat.tsx` — Chat-UI
- `supabase/migrations/20260320000000_add_gateway_to_bots.sql` — `gateway_url` + `gateway_token` Spalten

---

## 8. Quick Reference — Standard-Commands

```bash
# Server
systemctl {start|stop|restart|status} <bot>
journalctl -u <bot> -n 50 --no-pager
nc -zv <server-ip> <gateway-port>

# gog (auf Server, env-Vars erforderlich)
HOME=/opt/<bot> GOG_KEYRING_PASSWORD=openclaw-<bot> gog auth tokens list
HOME=/opt/<bot> GOG_KEYRING_PASSWORD=openclaw-<bot> gog auth tokens delete <email> --force
HOME=/opt/<bot> GOG_KEYRING_PASSWORD=openclaw-<bot> gog --account <email> gmail messages list 'in:inbox' --max 5
HOME=/opt/<bot> GOG_KEYRING_PASSWORD=openclaw-<bot> gog --account <email> calendar list

# openclaw CLI (auf Server)
HOME=/opt/<bot> GOG_KEYRING_PASSWORD=openclaw-<bot> openclaw channels status
HOME=/opt/<bot> GOG_KEYRING_PASSWORD=openclaw-<bot> openclaw doctor
```
