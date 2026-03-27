'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const industries = [
  'Marketing Agentur',
  'Performance Agentur',
  'PR Agentur',
  'Social Media Agentur',
  'Design Agentur',
  'Arztpraxis',
  'Kanzlei',
  'E-Commerce',
  'SaaS',
  'Beratung',
  'Sonstiges',
]

const vpsProviders = ['Hetzner', 'DigitalOcean', 'Contabo', 'AWS', 'GCP', 'Eigener Server']
const channels = ['slack', 'telegram', 'whatsapp', 'teams', 'email']

export default function NewClientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const form = new FormData(e.currentTarget)
    const data = {
      company_name: form.get('company_name') as string,
      contact_name: form.get('contact_name') as string,
      contact_email: form.get('contact_email') as string,
      contact_phone: (form.get('contact_phone') as string) || null,
      industry: form.get('industry') as string,
      status: 'lead' as const,
      score: 0,
      monthly_fee: parseFloat(form.get('monthly_fee') as string) || 0,
      setup_fee: parseFloat(form.get('setup_fee') as string) || 0,
      vps_provider: (form.get('vps_provider') as string) || null,
      vps_ip: null,
      vps_status: 'not_setup' as const,
      sandbox_name: null,
      messaging_channel: (form.get('messaging_channel') as string) || null,
      marlene_status: 'not_deployed' as const,
      notes: (form.get('notes') as string) || null,
    }

    try {
      const useSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      if (useSupabase) {
        const { supabase } = await import('@/lib/supabase/client')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newClient, error } = await (supabase.from('clients') as any).insert(data).select().single()
        if (error) throw error
        router.push(`/clients/${newClient.id}`)
      } else {
        // Mock mode — just redirect to dashboard
        alert('Demo-Modus: Client würde erstellt werden. Verbinde Supabase für echte Daten.')
        router.push('/')
      }
    } catch {
      alert('Fehler beim Erstellen des Clients')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Neuer Client</h1>
          <p className="text-sm text-muted-foreground">Einen neuen Client-Slot belegen</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 bg-card border-border space-y-6">
          {/* Company Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Unternehmen</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Firmenname *</Label>
                <Input id="company_name" name="company_name" required placeholder="z.B. Agentur XYZ GmbH" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Branche *</Label>
                <Select name="industry" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Branche wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map(ind => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Kontakt</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_name">Ansprechpartner *</Label>
                <Input id="contact_name" name="contact_name" required placeholder="Max Mustermann" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_email">E-Mail *</Label>
                <Input id="contact_email" name="contact_email" type="email" required placeholder="max@firma.de" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Telefon</Label>
                <Input id="contact_phone" name="contact_phone" placeholder="+49 170 ..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="messaging_channel">Messaging Channel</Label>
                <Select name="messaging_channel">
                  <SelectTrigger>
                    <SelectValue placeholder="Channel wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map(ch => (
                      <SelectItem key={ch} value={ch} className="capitalize">{ch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pricing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="setup_fee">Setup-Fee (€)</Label>
                <Input id="setup_fee" name="setup_fee" type="number" step="0.01" placeholder="2500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly_fee">Monatliche Pauschale (€)</Label>
                <Input id="monthly_fee" name="monthly_fee" type="number" step="0.01" placeholder="350" />
              </div>
            </div>
          </div>

          {/* Infrastructure */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Infrastruktur</h3>
            <div className="space-y-2">
              <Label htmlFor="vps_provider">VPS Provider</Label>
              <Select name="vps_provider">
                <SelectTrigger>
                  <SelectValue placeholder="Provider wählen (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {vpsProviders.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Zusätzliche Informationen..." />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => router.push('/')}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? 'Wird erstellt...' : 'Client erstellen'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
