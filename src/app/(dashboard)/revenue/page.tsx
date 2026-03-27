import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, Target, Euro, FileText } from 'lucide-react'
import { getClients, getAllInvoices } from '@/lib/data'
import { StatCard } from '@/components/stat-card'

export const dynamic = 'force-dynamic'

const MRR_GOAL = 5000

export default async function RevenuePage() {
  const [clients, invoices] = await Promise.all([
    getClients(),
    getAllInvoices(),
  ])

  const mrr = clients.reduce((sum, c) => sum + c.monthly_fee, 0)
  const totalSetupRevenue = clients.reduce((sum, c) => sum + c.setup_fee, 0)
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.total_amount, 0)
  const paidInvoices = invoices.filter(i => i.status === 'paid')
  const openInvoices = invoices.filter(i => i.status !== 'paid')
  const totalPaid = paidInvoices.reduce((sum, i) => sum + i.total_amount, 0)
  const totalOpen = openInvoices.reduce((sum, i) => sum + i.total_amount, 0)

  const mrrProgress = (mrr / MRR_GOAL) * 100
  const avgMrrPerClient = clients.length > 0 ? mrr / clients.length : 0
  const clientsNeeded = avgMrrPerClient > 0 ? Math.ceil((MRR_GOAL - mrr) / avgMrrPerClient) : 0
  const monthsToGoal = clientsNeeded > 0 ? Math.ceil(clientsNeeded / 1.5) : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Revenue</h1>
        <p className="text-sm text-muted-foreground">Umsatz-Übersicht und Prognosen</p>
      </div>

      {/* MRR Goal */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">MRR Ziel: €{MRR_GOAL.toLocaleString('de-DE')}/Monat</h2>
        </div>
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="text-muted-foreground">Aktuell</span>
          <span className="font-mono text-primary font-bold">€{mrr.toLocaleString('de-DE')}</span>
        </div>
        <Progress value={Math.min(mrrProgress, 100)} className="h-3 mb-4" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{mrrProgress.toFixed(0)}% erreicht</span>
          <span>Fehlen: €{(MRR_GOAL - mrr).toLocaleString('de-DE')}</span>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="MRR"
          value={`€${mrr.toLocaleString('de-DE')}`}
          icon={<TrendingUp className="h-4 w-4" />}
          highlight
        />
        <StatCard
          label="Setup Revenue"
          value={`€${totalSetupRevenue.toLocaleString('de-DE')}`}
          icon={<Euro className="h-4 w-4" />}
        />
        <StatCard
          label="Bezahlt"
          value={`€${totalPaid.toLocaleString('de-DE')}`}
          subtitle={`${paidInvoices.length} Rechnungen`}
        />
        <StatCard
          label="Offen"
          value={`€${totalOpen.toLocaleString('de-DE')}`}
          subtitle={`${openInvoices.length} Rechnungen`}
        />
      </div>

      {/* Revenue Split */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5 bg-card border-border">
          <h3 className="text-sm font-semibold mb-4">Setup vs. Recurring</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Setup Revenue</span>
                <span className="font-mono">€{totalSetupRevenue.toLocaleString('de-DE')}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-chart-5"
                  style={{ width: `${totalInvoiced > 0 ? (totalSetupRevenue / (totalSetupRevenue + mrr * 12)) * 100 : 50}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Recurring (annualisiert)</span>
                <span className="font-mono">€{(mrr * 12).toLocaleString('de-DE')}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal"
                  style={{ width: `${totalInvoiced > 0 ? ((mrr * 12) / (totalSetupRevenue + mrr * 12)) * 100 : 50}%` }}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Forecast */}
        <Card className="p-5 bg-card border-border">
          <h3 className="text-sm font-semibold mb-4">Prognose</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Durchschn. MRR/Client</span>
              <span className="font-mono">€{avgMrrPerClient.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Clients bis Ziel</span>
              <span className="font-mono">{clientsNeeded}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Geschätzte Zeit bis Ziel</span>
              <span className="font-mono text-primary">~{monthsToGoal} Monate</span>
            </div>
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Bei aktuellem Tempo (ca. 1.5 Clients/Monat) erreichst du €{MRR_GOAL.toLocaleString('de-DE')} MRR in ~{monthsToGoal} Monaten.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Invoices */}
      <div>
        <h3 className="text-sm font-semibold mb-4">Letzte Rechnungen</h3>
        <div className="space-y-2">
          {invoices.slice(0, 10).map((inv) => {
            const client = clients.find(c => c.id === inv.client_id)
            const statusConfig: Record<string, { label: string; class: string }> = {
              paid: { label: 'Bezahlt', class: 'bg-teal-500' },
              sent: { label: 'Gesendet', class: 'bg-blue-500' },
              draft: { label: 'Entwurf', class: 'bg-zinc-500' },
              overdue: { label: 'Überfällig', class: 'bg-red-500' },
            }
            const status = statusConfig[inv.status]

            return (
              <Card key={inv.id} className="p-4 bg-card border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{client?.company_name || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-medium">€{inv.total_amount.toLocaleString('de-DE')}</span>
                  <Badge variant="secondary" className={`text-[10px] text-white ${status.class}`}>
                    {status.label}
                  </Badge>
                </div>
              </Card>
            )
          })}

          {invoices.length === 0 && (
            <Card className="p-8 bg-card border-border text-center">
              <p className="text-muted-foreground text-sm">Noch keine Rechnungen vorhanden.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
