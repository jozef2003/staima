import { Users, Zap, Clock, Activity, TrendingUp } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { ClientCard, EmptyClientSlot } from '@/components/client-card'
import { StatCard } from '@/components/stat-card'
import { LevelDisplay } from '@/components/level-display'
import { getDashboardStats } from '@/lib/data'
import { MAX_CLIENTS } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const stats = await getDashboardStats()
  const emptySlots = MAX_CLIENTS - stats.clientCount

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold tracking-tight">Staima</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Dein OpenClaw/NemoClaw Consulting Dashboard
        </p>
      </div>

      {/* Quick Stats */}
      <div className="flex items-center gap-6 text-sm">
        <span className="text-muted-foreground">Kunden: <span className="text-foreground font-semibold">{stats.clientCount}</span></span>
        <span className="text-muted-foreground">Bots: <span className="text-foreground font-semibold">{stats.botCount}</span></span>
        <span className="text-muted-foreground">Server: <span className="text-foreground font-semibold">{stats.serverCount}</span></span>
      </div>


      {/* Client Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Client Board</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {stats.clients.map((client) => {
            const clientBots = stats.bots.filter(b => b.client_id === client.id)
            const onlineBots = clientBots.filter(b => b.status === 'online')
            return (
              <ClientCard key={client.id} client={client} botCount={clientBots.length} onlineBotCount={onlineBots.length} />
            )
          })}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <EmptyClientSlot key={`empty-${i}`} index={stats.clientCount + i} />
          ))}
        </div>
      </div>
    </div>
  )
}
