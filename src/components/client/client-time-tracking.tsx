'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MessageSquare, Zap, Calendar } from 'lucide-react'
import type { Client, DeploymentLog } from '@/lib/supabase/types'

const actionTypeLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  setup: { label: 'Setup', color: 'bg-blue-500', icon: <Zap className="h-3 w-3" /> },
  config: { label: 'Konfiguration', color: 'bg-amber-500', icon: <Zap className="h-3 w-3" /> },
  policy: { label: 'Policy', color: 'bg-purple-500', icon: <Zap className="h-3 w-3" /> },
  skill: { label: 'Skill', color: 'bg-teal-500', icon: <Zap className="h-3 w-3" /> },
  fix: { label: 'Fix', color: 'bg-red-500', icon: <Zap className="h-3 w-3" /> },
  update: { label: 'Update', color: 'bg-indigo-500', icon: <Zap className="h-3 w-3" /> },
  handover: { label: 'Übergabe', color: 'bg-green-500', icon: <Zap className="h-3 w-3" /> },
}

export function ClientTimeTracking({ client, logs }: { client: Client; logs: DeploymentLog[] }) {
  return (
    <div className="space-y-6">
      {/* Activity Log */}
      <div>
        <h3 className="text-sm font-semibold mb-4">Aktivitäten</h3>

        {logs.length > 0 ? (
          <div className="space-y-2">
            {logs.map((log) => {
              const typeInfo = actionTypeLabels[log.action_type]
              const date = new Date(log.created_at)
              return (
                <Card key={log.id} className="p-4 bg-card border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${typeInfo?.color || 'bg-muted'}`} />
                      <div>
                        <p className="text-sm font-medium">{log.action}</p>
                        {log.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5">{log.notes}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {date.toLocaleDateString('de-DE')}
                          </span>
                          {log.hours_spent > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {log.hours_spent}h
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] text-white shrink-0 ${typeInfo?.color}`}>
                      {typeInfo?.label}
                    </Badge>
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="p-8 bg-card border-border text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Noch keine Aktivitäten.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
