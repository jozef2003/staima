import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export default function PlaybookPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Playbook</h1>
        <p className="text-sm text-muted-foreground">
          Wie Staima-Bots aufgesetzt werden, warum sie sicher sind, und wie die Architektur funktioniert.
        </p>
      </div>

      {/* Architektur */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-4">
          <Badge className="bg-blue-500 text-white">Architektur</Badge>
          <h2 className="text-lg font-bold">Wie ein Bot funktioniert</h2>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Jeder Bot ist eine eigenständige <strong className="text-foreground">OpenClaw-Instanz</strong> auf einem dedizierten Hetzner VPS.</p>
          <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border font-mono text-xs space-y-1">
            <p className="text-foreground">Telegram/WhatsApp</p>
            <p>{'  ↓'}</p>
            <p className="text-foreground">OpenClaw Gateway (Port 187xx)</p>
            <p>{'  ↓'}</p>
            <p className="text-foreground">Claude API (Anthropic)</p>
            <p>{'  ↓'}</p>
            <p className="text-foreground">Skills: Gmail, Calendar, Drive, Web (via gog CLI)</p>
            <p>{'  ↓'}</p>
            <p className="text-foreground">Antwort zurück an User</p>
          </div>
          <h4 className="font-semibold text-foreground mt-4">Komponenten</h4>
          <ul className="space-y-1.5">
            <li><strong className="text-foreground">OpenClaw</strong> — Bot-Framework, managed Sessions, Skills, Cron-Jobs</li>
            <li><strong className="text-foreground">NemoClaw</strong> — Sandbox-Isolation, Policy-Engine (optional)</li>
            <li><strong className="text-foreground">gog CLI</strong> — Google Workspace Zugriff (Gmail, Calendar, Drive, Sheets)</li>
            <li><strong className="text-foreground">Systemd</strong> — Auto-Restart bei Crash oder Server-Reboot</li>
            <li><strong className="text-foreground">Staima Dashboard</strong> — Monitoring, Chat, Cost-Tracking</li>
          </ul>
        </div>
      </Card>

      {/* Bot Setup */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-4">
          <Badge className="bg-teal-500 text-white">Setup</Badge>
          <h2 className="text-lg font-bold">Bot aufsetzen — Step by Step</h2>
        </div>
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <h4 className="font-semibold">1. Server vorbereiten</h4>
            <p className="text-muted-foreground">Hetzner VPS erstellen (CAX21 empfohlen: 4 vCPU, 8GB RAM, ~€7/Mo). SSH Key hinterlegen.</p>
            <pre className="p-3 rounded-lg bg-[#0A0A0B] border border-border font-mono text-xs overflow-x-auto">{`ssh root@SERVER_IP
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g openclaw`}</pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">2. Bot konfigurieren</h4>
            <p className="text-muted-foreground">OpenClaw Config erstellen mit Gateway, Telegram und AI-Model.</p>
            <pre className="p-3 rounded-lg bg-[#0A0A0B] border border-border font-mono text-xs overflow-x-auto">{`mkdir -p /opt/BOTNAME/.openclaw
# openclaw.json: gateway port, telegram token, auth token
# agents.defaults.model: anthropic/claude-sonnet-4-6`}</pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">3. Google Workspace verbinden</h4>
            <p className="text-muted-foreground">OAuth Token lokal generieren, auf Server hochladen, in gog importieren.</p>
            <pre className="p-3 rounded-lg bg-[#0A0A0B] border border-border font-mono text-xs overflow-x-auto">{`# Lokal: python3 get_oauth_token.py → gogcli_token.json
scp gogcli_token.json root@SERVER:/tmp/
ssh root@SERVER 'GOG_KEYRING_PASSWORD=xxx HOME=/opt/BOTNAME \\
  gog auth tokens import /tmp/gogcli_token.json'`}</pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">4. Systemd Service erstellen</h4>
            <p className="text-muted-foreground">Auto-Start bei Reboot, Environment-Variablen für API Key und Keyring.</p>
            <pre className="p-3 rounded-lg bg-[#0A0A0B] border border-border font-mono text-xs overflow-x-auto">{`[Service]
WorkingDirectory=/opt/BOTNAME
Environment=HOME=/opt/BOTNAME
Environment=ANTHROPIC_API_KEY=sk-ant-...
Environment=GOG_KEYRING_PASSWORD=xxx
ExecStart=/usr/bin/openclaw gateway
Restart=always`}</pre>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">5. Firewall + Dashboard</h4>
            <p className="text-muted-foreground">Gateway-Port in Hetzner Cloud Firewall freigeben. Bot in Supabase DB registrieren.</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">6. Telegram Pairing</h4>
            <p className="text-muted-foreground">User schreibt /start an den Bot, Pairing-Code wird generiert, Admin genehmigt.</p>
            <pre className="p-3 rounded-lg bg-[#0A0A0B] border border-border font-mono text-xs overflow-x-auto">{`openclaw pairing approve telegram CODE`}</pre>
          </div>
        </div>
      </Card>

      {/* Sicherheit */}
      <Card className="p-6 bg-card border-border border-red-500/20">
        <div className="flex items-center gap-3 mb-4">
          <Badge className="bg-red-500 text-white">Sicherheit</Badge>
          <h2 className="text-lg font-bold">Prompt Injection Schutz</h2>
        </div>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            AI-Bots mit Tool-Zugriff (E-Mail, Calendar, Shell) sind potenzielle Angriffsvektoren.
            So schützen wir dagegen:
          </p>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-semibold text-teal-500 mb-1">Sandbox-Isolation (NemoClaw)</h4>
              <p className="text-muted-foreground text-xs">Jeder Bot läuft in einer isolierten Sandbox. Kein Zugriff auf andere Bots oder System-Dateien. Policy-Engine kontrolliert welche Tools erlaubt sind.</p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-semibold text-teal-500 mb-1">Keine Shell-Befehle</h4>
              <p className="text-muted-foreground text-xs">Die <code>claude_code</code> Policy ist entfernt — Bots können keine beliebigen Shell-Commands ausführen. Nur vordefinierte Skills (gog, weather, etc.).</p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-semibold text-teal-500 mb-1">Output-Filter</h4>
              <p className="text-muted-foreground text-xs">Die Dashboard-API filtert sensible Daten aus Bot-Antworten: API Keys, Bearer Tokens, Passwörter, Private Keys werden automatisch blockiert.</p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-semibold text-teal-500 mb-1">Telegram Pairing</h4>
              <p className="text-muted-foreground text-xs">Nur gepaarte Telegram-User können mit dem Bot kommunizieren. DM-Policy auf "pairing" — fremde User werden abgewiesen.</p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-semibold text-teal-500 mb-1">Token-Auth auf Gateway</h4>
              <p className="text-muted-foreground text-xs">Jeder Gateway ist mit einem zufällig generierten Token gesichert. Ohne Token kein WebSocket-Zugriff. Origin-Checks verhindern Cross-Site Requests.</p>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-semibold text-teal-500 mb-1">SECURITY.md im Workspace</h4>
              <p className="text-muted-foreground text-xs">Jeder Bot hat eine SECURITY.md im Workspace die den AI-Agent instruiert, Prompt Injection Versuche zu erkennen und zu ignorieren. Der Agent wird darauf trainiert, Social-Engineering-Angriffe abzuwehren.</p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">Was noch offen ist (mittlere Priorität)</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>- Budget-Caps auf Anthropic API Level (auto-stop bei Limit)</li>
              <li>- API Keys in Secrets Manager statt Systemd Environment</li>
              <li>- Rate Limiting pro User auf Gateway-Level</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Kosten */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-4">
          <Badge className="bg-amber-500 text-white">Kosten</Badge>
          <h2 className="text-lg font-bold">Was kostet ein Bot?</h2>
        </div>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">Server (Hetzner)</p>
              <p className="text-lg font-bold mt-1">~€7/Mo</p>
              <p className="text-xs text-muted-foreground">CAX21, 4 vCPU, 8GB</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">AI (Haiku)</p>
              <p className="text-lg font-bold mt-1">~€5-15/Mo</p>
              <p className="text-xs text-muted-foreground">~0.3¢ pro Nachricht</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">AI (Sonnet)</p>
              <p className="text-lg font-bold mt-1">~€15-50/Mo</p>
              <p className="text-xs text-muted-foreground">~1¢ pro Nachricht</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <h4 className="font-semibold mb-2">Kosten pro Modell (Durchschnitt pro Nachricht)</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-teal-500">0.3¢</p>
                <p className="text-xs text-muted-foreground">Haiku 4.5</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-500">1¢</p>
                <p className="text-xs text-muted-foreground">Sonnet 4.6</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-500">5¢</p>
                <p className="text-xs text-muted-foreground">Opus 4.6</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Mehrere Bots können auf demselben Server laufen (verschiedene Ports).
            Google Workspace APIs sind kostenlos. Telegram Bot API ist kostenlos.
          </p>
        </div>
      </Card>

      {/* Monitoring */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-4">
          <Badge className="bg-purple-500 text-white">Monitoring</Badge>
          <h2 className="text-lg font-bold">Automatisiertes Monitoring</h2>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Jeder Bot kann automatisch überwacht werden:</p>
          <ul className="space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-teal-500 font-bold">~</span>
              <span><strong className="text-foreground">Server-Monitoring</strong> — alle 10 Min: Gateway erreichbar? Telegram verbunden?</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-500 font-bold">~</span>
              <span><strong className="text-foreground">Kosten-Alert</strong> — stündlich: Budget-Warnung bei &gt;80% Auslastung</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-500 font-bold">~</span>
              <span><strong className="text-foreground">API Usage Tracking</strong> — alle 5 Min: Token-Verbrauch aus OpenClaw Logs → Supabase</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-500 font-bold">~</span>
              <span><strong className="text-foreground">Server Stats</strong> — CPU, RAM, Disk live im Dashboard (Stats-Server auf Port 3002)</span>
            </li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
