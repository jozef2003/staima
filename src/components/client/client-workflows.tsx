'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap, Clock, Search, FileText, Mail, BarChart3, Users, Brain } from 'lucide-react'
import type { Client, Workflow } from '@/lib/supabase/types'

const workflowStatusColors: Record<string, string> = {
  active: 'bg-teal-500',
  configuring: 'bg-amber-500',
  planned: 'bg-blue-500',
  paused: 'bg-zinc-500',
  broken: 'bg-red-500',
}

const workflowStatusLabels: Record<string, string> = {
  active: 'Aktiv',
  configuring: 'Wird konfiguriert',
  planned: 'Geplant',
  paused: 'Pausiert',
  broken: 'Fehlerhaft',
}

const skillIcons: Record<string, React.ReactNode> = {
  'web-recherche': <Search className="h-4 w-4" />,
  'dokumente': <FileText className="h-4 w-4" />,
  'email': <Mail className="h-4 w-4" />,
  'reporting': <BarChart3 className="h-4 w-4" />,
  'kommunikation': <Users className="h-4 w-4" />,
  'analyse': <Brain className="h-4 w-4" />,
}

const botCapabilities = [
  { name: 'Web-Recherche', description: 'Brave Search, Webseiten analysieren, Lead Research', icon: <Search className="h-4 w-4 text-primary" /> },
  { name: 'Dokumente', description: 'PDFs lesen, Texte schreiben, Angebote erstellen', icon: <FileText className="h-4 w-4 text-primary" /> },
  { name: 'E-Mail & Messaging', description: 'Telegram, WhatsApp, Discord, Slack', icon: <Mail className="h-4 w-4 text-primary" /> },
  { name: 'Reporting', description: 'Daten sammeln, aufbereiten, Reports generieren', icon: <BarChart3 className="h-4 w-4 text-primary" /> },
  { name: 'Sub-Agents', description: 'Komplexe Tasks an spezialisierte Agenten delegieren', icon: <Users className="h-4 w-4 text-primary" /> },
  { name: 'Memory', description: 'Merkt sich Infos, lernt Präferenzen über Sessions', icon: <Brain className="h-4 w-4 text-primary" /> },
]

export function ClientWorkflows({ client, workflows }: { client: Client; workflows: Workflow[] }) {
  return (
    <div className="space-y-6">
      {/* Active Workflows */}
      {workflows.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-4">Aktive Workflows ({workflows.length})</h3>
          <div className="space-y-3">
            {workflows.map((wf) => (
              <Card key={wf.id} className="p-4 bg-card border-border">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">{wf.workflow_name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{wf.workflow_type}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] text-white ${workflowStatusColors[wf.status]}`}
                  >
                    {workflowStatusLabels[wf.status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  {wf.estimated_hours_saved_weekly && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{wf.estimated_hours_saved_weekly}h/Woche gespart</span>
                    </div>
                  )}
                  {wf.skills_used && wf.skills_used.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Zap className="h-3 w-3" />
                      <span>{wf.skills_used.length} Skills</span>
                    </div>
                  )}
                </div>
                {wf.skills_used && wf.skills_used.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {wf.skills_used.map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-[10px] font-mono">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Bot Capabilities */}
      <div>
        <h3 className="text-sm font-semibold mb-4">Bot-Fähigkeiten</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {botCapabilities.map((cap) => (
            <Card key={cap.name} className="p-4 bg-card border-border">
              <div className="flex items-center gap-3 mb-2">
                {cap.icon}
                <h4 className="font-medium text-sm">{cap.name}</h4>
              </div>
              <p className="text-xs text-muted-foreground">{cap.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {workflows.length === 0 && (
        <Card className="p-8 bg-card border-border text-center">
          <Zap className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Noch keine Workflows konfiguriert.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Schreib dem Bot in Telegram um ihn zu konfigurieren.</p>
        </Card>
      )}
    </div>
  )
}
