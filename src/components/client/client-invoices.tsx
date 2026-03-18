'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, FileText } from 'lucide-react'
import type { Client, Invoice } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const invoiceStatusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Entwurf', className: 'bg-zinc-500 text-white' },
  sent: { label: 'Gesendet', className: 'bg-blue-500 text-white' },
  paid: { label: 'Bezahlt', className: 'bg-teal-500 text-white' },
  overdue: { label: 'Überfällig', className: 'bg-red-500 text-white' },
}

export function ClientInvoices({ client, invoices }: { client: Client; invoices: Invoice[] }) {
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total_amount, 0)
  const totalOpen = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + i.total_amount, 0)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-card border-border">
          <p className="text-xs text-muted-foreground mb-1">Bezahlt</p>
          <p className="text-xl font-bold text-teal-500">€{totalPaid.toLocaleString('de-DE')}</p>
        </Card>
        <Card className="p-4 bg-card border-border">
          <p className="text-xs text-muted-foreground mb-1">Offen</p>
          <p className="text-xl font-bold text-amber-500">€{totalOpen.toLocaleString('de-DE')}</p>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" />
          Neue Rechnung
        </Button>
      </div>

      {/* Table */}
      {invoices.length > 0 ? (
        <Card className="bg-card border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-xs">Nummer</TableHead>
                <TableHead className="text-xs">Zeitraum</TableHead>
                <TableHead className="text-xs text-right">Setup</TableHead>
                <TableHead className="text-xs text-right">Stunden</TableHead>
                <TableHead className="text-xs text-right">Support</TableHead>
                <TableHead className="text-xs text-right">Infra</TableHead>
                <TableHead className="text-xs text-right">Gesamt</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const status = invoiceStatusConfig[inv.status]
                return (
                  <TableRow key={inv.id} className="border-border">
                    <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(inv.period_start).toLocaleDateString('de-DE')} — {new Date(inv.period_end).toLocaleDateString('de-DE')}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {inv.setup_amount > 0 ? `€${inv.setup_amount.toLocaleString('de-DE')}` : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">€{inv.hours_amount.toLocaleString('de-DE')}</TableCell>
                    <TableCell className="text-right text-sm">€{inv.support_amount.toLocaleString('de-DE')}</TableCell>
                    <TableCell className="text-right text-sm">€{inv.infra_amount.toLocaleString('de-DE')}</TableCell>
                    <TableCell className="text-right text-sm font-medium">€{inv.total_amount.toLocaleString('de-DE')}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn('text-[10px]', status.className)}>
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-8 bg-card border-border text-center">
          <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Noch keine Rechnungen.</p>
        </Card>
      )}
    </div>
  )
}
