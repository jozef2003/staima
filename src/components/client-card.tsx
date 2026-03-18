import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { Client } from '@/lib/supabase/types'
import { CLIENT_STATUSES } from '@/lib/constants'
import { cn } from '@/lib/utils'

function MarleneIndicator({ status }: { status: Client['marlene_status'] }) {
  const statusClass = {
    active: 'status-active',
    configuring: 'status-configuring',
    error: 'status-error',
    paused: 'status-paused',
    not_deployed: 'status-not-deployed',
  }[status]

  return <div className={cn('status-dot', statusClass)} title={`Marlene: ${status}`} />
}

export function ClientCard({ client }: { client: Client }) {
  const statusInfo = CLIENT_STATUSES.find(s => s.value === client.status)

  return (
    <Link href={`/clients/${client.id}`}>
      <Card className="group relative overflow-hidden border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {client.company_name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{client.industry}</p>
          </div>
          <MarleneIndicator status={client.marlene_status} />
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] px-2 py-0 font-medium text-white',
              statusInfo?.color
            )}
          >
            {statusInfo?.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {client.contact_name}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Fortschritt</span>
            <span className="font-mono text-primary">{client.score}%</span>
          </div>
          <Progress value={client.score} className="h-1.5" />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>€{client.monthly_fee.toLocaleString('de-DE')}/Mo</span>
          {client.messaging_channel && (
            <span className="capitalize">{client.messaging_channel}</span>
          )}
        </div>
      </Card>
    </Link>
  )
}

export function EmptyClientSlot({ index }: { index: number }) {
  return (
    <Link href="/clients/new">
      <Card className="flex h-full min-h-[180px] items-center justify-center border-2 border-dashed border-border/50 bg-transparent p-4 transition-all hover:border-primary/30 hover:bg-card/30 cursor-pointer">
        <div className="text-center">
          <div className="text-2xl mb-1 opacity-30">+</div>
          <p className="text-xs text-muted-foreground/50">Slot {index + 1}</p>
          <p className="text-[10px] text-muted-foreground/30">Verfügbar</p>
        </div>
      </Card>
    </Link>
  )
}
