import { Progress } from '@/components/ui/progress'
import { getLevel, getXP, getXPForNextLevel } from '@/lib/constants'

interface LevelDisplayProps {
  clientCount: number
  totalWorkflows: number
  totalHoursLogged: number
}

export function LevelDisplay({ clientCount, totalWorkflows, totalHoursLogged }: LevelDisplayProps) {
  const level = getLevel(clientCount)
  const xp = getXP({ clients: clientCount, workflows: totalWorkflows, hoursLogged: totalHoursLogged })
  const xpNeeded = getXPForNextLevel(level.level)
  const xpProgress = Math.min((xp / xpNeeded) * 100, 100)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{level.emoji}</span>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Level {level.level}</p>
            <p className="text-lg font-bold text-foreground">{level.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">XP</p>
          <p className="font-mono text-sm text-primary font-bold">{xp.toLocaleString('de-DE')}</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Fortschritt zum nächsten Level</span>
          <span className="font-mono">{xp}/{xpNeeded} XP</span>
        </div>
        <div className="relative">
          <Progress value={xpProgress} className="h-2.5 animate-xp-fill" />
        </div>
      </div>
    </div>
  )
}
