import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  icon?: React.ReactNode
  className?: string
  highlight?: boolean
}

export function StatCard({ label, value, subtitle, icon, className, highlight }: StatCardProps) {
  return (
    <Card className={cn(
      'p-4 bg-card border-border',
      highlight && 'border-primary/30 bg-primary/5',
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className={cn(
            'text-2xl font-bold mt-1 tracking-tight',
            highlight ? 'text-primary' : 'text-foreground'
          )}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="text-muted-foreground/50">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
