import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export default function PlaybookPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Consulting Playbook</h1>
        <p className="text-sm text-muted-foreground">
          Der komplette Workflow für OpenClaw/NemoClaw Implementierungen
        </p>
      </div>

      {/* Phase 1 */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-4">
          <Badge className="bg-blue-500 text-white">Phase 1</Badge>
          <h2 className="text-lg font-bold">Discovery Call</h2>
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">Ziel: Anforderungen verstehen, Machbarkeit prüfen, Angebot erstellen</p>
          <h4 className="font-semibold mt-4 mb-2">Checkliste</h4>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Welche Workflows sollen automatisiert werden?</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Welche Tools werden aktuell genutzt? (CRM, E-Mail, PM-Tool)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Wie viele Mitarbeiter werden Marlene nutzen?</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Gibt es Datenschutz-Anforderungen? (DSGVO, On-Premise)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Budget-Rahmen klären</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Bevorzugter Kommunikations-Channel? (Slack/Telegram/WhatsApp/Teams)</span>
            </li>
          </ul>
        </div>
      </Card>

      {/* Phase 2 */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-4">
          <Badge className="bg-amber-500 text-white">Phase 2</Badge>
          <h2 className="text-lg font-bold">Infrastruktur klären</h2>
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">Entscheidungsbaum für die richtige Infrastruktur</p>

          <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
            <h4 className="font-semibold mb-3">Entscheidungsbaum</h4>
            <div className="space-y-2 text-sm font-mono">
              <p>Braucht GPU? → Cloud-GPU (Lambda, RunPod)</p>
              <p>DSGVO-kritisch? → On-Premise / Hetzner DE</p>
              <p>Budget {"<"} €20/Mo? → Contabo VPS</p>
              <p>Standard-Setup? → Hetzner CX31 (4 vCPU, 8GB RAM)</p>
              <p>Enterprise? → Dedizierter Server + Custom Setup</p>
            </div>
          </div>

          <h4 className="font-semibold mt-4 mb-2">Empfohlene VPS-Specs</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="font-medium text-xs">Starter</p>
              <p className="text-lg font-bold mt-1">2 vCPU</p>
              <p className="text-xs text-muted-foreground">4GB RAM, 40GB SSD</p>
              <p className="text-xs text-primary mt-1">~€8/Mo</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-primary/30">
              <p className="font-medium text-xs text-primary">Empfohlen</p>
              <p className="text-lg font-bold mt-1">4 vCPU</p>
              <p className="text-xs text-muted-foreground">8GB RAM, 80GB SSD</p>
              <p className="text-xs text-primary mt-1">~€15/Mo</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="font-medium text-xs">Enterprise</p>
              <p className="text-lg font-bold mt-1">8 vCPU</p>
              <p className="text-xs text-muted-foreground">16GB RAM, 160GB SSD</p>
              <p className="text-xs text-primary mt-1">~€30/Mo</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Phase 3 */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-4">
          <Badge className="bg-teal-500 text-white">Phase 3</Badge>
          <h2 className="text-lg font-bold">Remote Setup</h2>
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">Step-by-Step NemoClaw Installation und Konfiguration</p>

          <h4 className="font-semibold mt-4 mb-2">1. NemoClaw installieren</h4>
          <pre className="p-4 rounded-lg bg-[#0A0A0B] border border-border font-mono text-xs overflow-x-auto">
{`curl -fsSL https://nvidia.com/nemoclaw.sh | bash`}
          </pre>

          <h4 className="font-semibold mt-4 mb-2">2. Sandbox erstellen & verbinden</h4>
          <pre className="p-4 rounded-lg bg-[#0A0A0B] border border-border font-mono text-xs overflow-x-auto">
{`nemoclaw <sandbox-name> connect`}
          </pre>

          <h4 className="font-semibold mt-4 mb-2">3. Status prüfen</h4>
          <pre className="p-4 rounded-lg bg-[#0A0A0B] border border-border font-mono text-xs overflow-x-auto">
{`nemoclaw <sandbox-name> status`}
          </pre>

          <h4 className="font-semibold mt-4 mb-2">4. Logs verfolgen</h4>
          <pre className="p-4 rounded-lg bg-[#0A0A0B] border border-border font-mono text-xs overflow-x-auto">
{`nemoclaw <sandbox-name> logs --follow`}
          </pre>

          <h4 className="font-semibold mt-4 mb-2">5. Workflows konfigurieren</h4>
          <ul className="space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Skills installieren und testen</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Netzwerk-Policies definieren</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Messaging Channel verbinden</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Testlauf mit echten Daten</span>
            </li>
          </ul>
        </div>
      </Card>

      {/* Phase 4 */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-4">
          <Badge className="bg-purple-500 text-white">Phase 4</Badge>
          <h2 className="text-lg font-bold">Übergabe</h2>
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">Checkliste für die Übergabe an den Client</p>
          <ul className="space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Alle Workflows dokumentiert und getestet</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Team-Schulung durchgeführt (30-60 Min)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Zugangsdaten sicher übergeben</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Feedback-Channel eingerichtet</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>30-Tage Support-Phase gestartet</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">-</span>
              <span>Monatliche Support-Pauschale vereinbart</span>
            </li>
          </ul>
        </div>
      </Card>

      {/* Pricing */}
      <Card className="p-6 bg-card border-border border-primary/30">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-bold">Standard-Pricing</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Setup</p>
            <p className="text-2xl font-bold text-primary">€1.500 – €3.000</p>
            <p className="text-xs text-muted-foreground mt-1">Je nach Komplexität und Anzahl Workflows</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Support</p>
            <p className="text-2xl font-bold text-teal-500">€200 – €500/Mo</p>
            <p className="text-xs text-muted-foreground mt-1">Monitoring, Updates, Anpassungen</p>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="text-sm text-muted-foreground">
          <p><strong>Stundensatz:</strong> €80/h für zusätzliche Konfiguration</p>
          <p className="mt-1"><strong>Infra-Kosten:</strong> werden 1:1 weitergegeben (VPS, API-Keys)</p>
        </div>
      </Card>
    </div>
  )
}
