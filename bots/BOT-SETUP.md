# Bot Setup Guide

Schritt-für-Schritt Anleitung zum Anlegen eines neuen Bots auf dem Server `159.69.221.169`.
SSH-Key: `~/.ssh/id_ed25519`

---

## 1. NemoClaw Sandbox anlegen

```bash
ssh -i ~/.ssh/id_ed25519 root@159.69.221.169
```

In `/root/.nemoclaw/sandboxes.json` neuen Eintrag hinzufügen:
```json
"botname": {
  "name": "botname",
  "createdAt": "2026-XX-XXTXX:XX:XX.000Z",
  "model": null,
  "nimContainer": null,
  "provider": null,
  "gpuEnabled": false,
  "policies": ["telegram"]
}
```

---

## 2. Verzeichnis & OpenClaw Config

```bash
mkdir -p /opt/botname/.openclaw/workspace
mkdir -p /opt/botname/.config/gogcli/keyring
```

**`/opt/botname/.openclaw/openclaw.json`** — Vorlage von Nora/Joe kopieren und anpassen:
- `workspace`: `/opt/botname/.openclaw/workspace`
- `gateway.port`: freier Port (Nora=18793, Joe=18795, nächster: 18797, 18799, ...)
- `channels.telegram.botToken`: Telegram Bot Token
- `channels.telegram.allowFrom`: Telegram User-ID des Nutzers
- `gateway.auth.token`: zufälliger 48-Zeichen Hex-Token
- `gateway.bind`: `lan` (öffentlich) oder `loopback` (nur intern)

```bash
# Zufälligen Gateway-Token generieren:
openssl rand -hex 24
```

---

## 3. Systemd Service

**`/etc/systemd/system/openclaw-botname.service`:**
```ini
[Unit]
Description=OpenClaw BotName Bot
After=network.target

[Service]
Environment=HOME=/opt/botname
Environment=ANTHROPIC_API_KEY=sk-ant-api03-...
Environment=OPENCLAW_GATEWAY_PORT=18797
Environment=NODE_OPTIONS=--max-old-space-size=1024
Environment=GOG_KEYRING_PASSWORD=openclaw-botname-keyring-2026
Environment=GOG_ACCOUNT=botname@myty.agency   # WICHTIG: ohne das findet gog keinen Auth!
Type=simple
WorkingDirectory=/opt/botname/.openclaw/workspace
ExecStart=/usr/bin/openclaw gateway run --port 18797 --bind loopback
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable openclaw-botname
systemctl start openclaw-botname
systemctl status openclaw-botname
```

---

## 4. Nginx Proxy (für Dashboard-Zugriff via myty.agency)

In Nginx-Config `/etc/nginx/sites-available/myty.agency` hinzufügen:
```nginx
location /bots/botname/ {
    proxy_pass http://127.0.0.1:18797/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

```bash
nginx -t && systemctl reload nginx
```

---

## 5. Google OAuth (Gmail/Calendar) einrichten

Nur nötig wenn der Bot E-Mails/Kalender braucht.

### 5a. OAuth Credentials anlegen (Google Cloud Console)
- Neue OAuth 2.0 Client-ID erstellen (Typ: Desktop)
- `client_id` und `client_secret` notieren

### 5b. Credentials auf Server speichern
```bash
cat > /opt/botname/.config/gogcli/credentials.json << 'EOF'
{
  "client_id": "XXXX.apps.googleusercontent.com",
  "client_secret": "GOCSPX-XXXX"
}
EOF

cat > /opt/botname/.config/gogcli/config.json << 'EOF'
{"keyring_backend": "file"}
EOF
```

### 5c. OAuth Flow (auf Mac ausführen!)

Script `/tmp/oauth-botname.py` lokal ausführen — öffnet Browser automatisch:

```python
#!/usr/bin/env python3
import http.server, webbrowser, urllib.parse, urllib.request, json, threading, sys

CLIENT_ID = "XXXX.apps.googleusercontent.com"
CLIENT_SECRET = "GOCSPX-XXXX"
REDIRECT_URI = "http://127.0.0.1:46669/oauth2/callback"
AUTH_URL = (
    "https://accounts.google.com/o/oauth2/auth"
    "?access_type=offline&response_type=code"
    "&client_id=" + CLIENT_ID +
    "&redirect_uri=" + urllib.parse.quote(REDIRECT_URI) +
    "&scope=" + urllib.parse.quote("email openid profile "
        "https://www.googleapis.com/auth/gmail.modify "
        "https://www.googleapis.com/auth/calendar "
        "https://www.googleapis.com/auth/drive "
        "https://www.googleapis.com/auth/contacts "
        "https://www.googleapis.com/auth/spreadsheets "
        "https://www.googleapis.com/auth/tasks") +
    "&prompt=consent&login_hint=botname@myty.agency"
)

token = {}

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        code = params.get("code", [None])[0]
        if not code:
            self.send_response(400); self.end_headers(); return
        data = urllib.parse.urlencode({
            "code": code, "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI, "grant_type": "authorization_code"
        }).encode()
        req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data)
        resp = json.loads(urllib.request.urlopen(req).read())
        token.update(resp)
        self.send_response(200); self.end_headers()
        self.wfile.write(b"<h1>Fertig!</h1>")
        threading.Thread(target=server.shutdown).start()

server = http.server.HTTPServer(("127.0.0.1", 46669), Handler)
webbrowser.open(AUTH_URL)
server.serve_forever()

result = {
    "refresh_token": token["refresh_token"],
    "token_uri": "https://oauth2.googleapis.com/token",
    "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
    "scopes": ["https://www.googleapis.com/auth/calendar",
               "https://www.googleapis.com/auth/contacts",
               "https://www.googleapis.com/auth/contacts.other.readonly",
               "https://www.googleapis.com/auth/documents",
               "https://www.googleapis.com/auth/drive",
               "https://www.googleapis.com/auth/gmail.modify",
               "https://www.googleapis.com/auth/gmail.settings.basic",
               "https://www.googleapis.com/auth/gmail.settings.sharing",
               "https://www.googleapis.com/auth/spreadsheets",
               "https://www.googleapis.com/auth/userinfo.email", "openid"],
    "universe_domain": "googleapis.com",
    "account": "botname@myty.agency"
}
with open("/tmp/botname-token.json", "w") as f:
    json.dump(result, f, indent=2)
print("Token gespeichert: /tmp/botname-token.json")
```

### 5d. Token auf Server hochladen & in Keyring speichern

```bash
# Token hochladen
scp -i ~/.ssh/id_ed25519 /tmp/botname-token.json root@159.69.221.169:/tmp/botname-token.json

# Keyring-File erstellen (auf Server)
ssh -i ~/.ssh/id_ed25519 root@159.69.221.169 "node -e \"
const jose = require('/usr/lib/node_modules/openclaw/node_modules/jose');
const fs = require('fs');
async function main() {
  const tokenData = JSON.parse(fs.readFileSync('/tmp/botname-token.json', 'utf8'));
  const keyringItem = {
    Key: 'token:botname@myty.agency',
    Data: Buffer.from(JSON.stringify(tokenData)).toString('base64'),
    Label: 'gogcli', Description: '',
    KeychainNotTrustApplication: false, KeychainNotSynchronizable: false
  };
  const password = new TextEncoder().encode('openclaw-botname-keyring-2026');
  const jwe = await new jose.CompactEncrypt(
    new TextEncoder().encode(JSON.stringify(keyringItem))
  ).setProtectedHeader({ alg: 'PBES2-HS256+A128KW', enc: 'A256GCM', p2c: 8192,
    p2s: jose.base64url.encode(crypto.getRandomValues(new Uint8Array(12))) })
   .encrypt(password);
  const dir = '/opt/botname/.config/gogcli/keyring';
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(dir + '/token:default:botname@myty.agency', jwe, { mode: 0o600 });
  fs.writeFileSync(dir + '/token:botname@myty.agency', jwe, { mode: 0o600 });
  console.log('OK');
}
main().catch(e => { console.error(e.message); process.exit(1); });
\""

# Testen
ssh -i ~/.ssh/id_ed25519 root@159.69.221.169 \
  "HOME=/opt/botname GOG_KEYRING_PASSWORD='openclaw-botname-keyring-2026' \
   gog gmail search 'newer_than:3d' --max 3 --no-input -a botname@myty.agency"
```

### 5e. TOOLS.md im Workspace anlegen

```bash
cat > /opt/botname/.openclaw/workspace/TOOLS.md << 'EOF'
# TOOLS.md

## Google Workspace
- Account: botname@myty.agency (OAuth eingerichtet, file-keyring)
- Gmail: gog gmail search "newer_than:7d" --max 10 --no-input
- Mail senden: gog gmail send --to x@y.com --subject "Betreff" --body "Text" --no-input
- Kalender: gog calendar events primary --from 2026-XX-XX --to 2026-XX-XX --no-input
- Drive: gog drive search "query" --max 10 --no-input
EOF
```

---

## 6. Supabase Eintrag

In der `bots` Tabelle eintragen:
```json
{
  "bot_name": "BotName",
  "client_id": "UUID des Clients",
  "role": "Beschreibung",
  "sandbox_name": "botname",
  "server_ip": "159.69.221.169",
  "ai_model": "claude-sonnet-4-6",
  "status": "online",
  "gateway_url": "https://myty.agency/bots/botname",
  "gateway_token": "48-Zeichen-Hex-Token",
  "messaging_channel": "telegram",
  "telegram_token": "TELEGRAM_BOT_TOKEN",
  "assigned_to": "Kundenname"
}
```

---

## Bestehende Bots — Ports & Passwörter

| Bot    | Port  | GOG_KEYRING_PASSWORD              | Google Account        |
|--------|-------|-----------------------------------|-----------------------|
| Nora   | 18793 | openclaw-nora-keyring-2026        | nora@myty.agency      |
| Joe    | 18795 | openclaw-joe-keyring-2026         | joe@myty.agency       |
| Sietch | —     | —                                 | —                     |
| David  | —     | —                                 | —                     |
| Wilma  | —     | —                                 | —                     |
