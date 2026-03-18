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

      {/* Client Capacity */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Clients</span>
          <span className="text-sm font-mono text-primary font-bold">{stats.clientCount}/{MAX_CLIENTS}</span>
        </div>
        <Progress value={(stats.clientCount / MAX_CLIENTS) * 100} className="h-2" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label="MRR"
          value={`€${stats.mrr.toLocaleString('de-DE')}`}
          icon={<TrendingUp className="h-4 w-4" />}
          highlight
        />
        <StatCard
          label="Clients"
          value={`${stats.clientCount}`}
          subtitle={`von ${MAX_CLIENTS}`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Stunden (gesamt)"
          value={`${stats.hoursThisWeek}h`}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Workflows aktiv"
          value={`${stats.activeWorkflowCount}`}
          subtitle={`von ${stats.totalWorkflows}`}
          icon={<Zap className="h-4 w-4" />}
        />
        <StatCard
          label="Stunden gespart/Wo"
          value={`${stats.totalHoursSavedWeekly}h`}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      {/* Level Display */}
      <LevelDisplay
        clientCount={stats.clientCount}
        totalWorkflows={stats.totalWorkflows}
        totalHoursLogged={stats.hoursThisWeek}
      />

      {/* Client Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Client Board</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {stats.clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <EmptyClientSlot key={`empty-${i}`} index={stats.clientCount + i} />
          ))}
        </div>
      </div>
    </div>
  )
}
