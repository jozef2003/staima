'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, Phone, Building2, User, Wifi, WifiOff, Server, Bot as BotIcon, Cpu, HardDrive, MemoryStick } from 'lucide-react'
import type { Client, Bot } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const botStatusConfig: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  online: { label: 'Online', dotClass: 'bg-teal-500', badgeClass: 'bg-teal-500/10 text-teal-500 border-teal-500/20' },
  configuring: { label: 'Wird eingerichtet', dotClass: 'bg-amber-500', badgeClass: 'bg-amber-500/10 text-amber-500' },
  error: { label: 'Fehler', dotClass: 'bg-red-500', badgeClass: 'bg-red-500/10 text-red-500' },
  offline: { label: 'Offline', dotClass: 'bg-zinc-500', badgeClass: '' },
}

const channelConfig: Record<string, { label: string; color: string }> = {
  telegram:  { label: 'Telegram',  color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  whatsapp:  { label: 'WhatsApp',  color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  twilio:    { label: 'Telefon',   color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  google:    { label: 'Google',    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  nemoclaw:  { label: 'NemoClaw',  color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
}

function BotCard({ bot, liveStatus }: { bot: Bot; liveStatus?: string }) {
  const status = botStatusConfig[liveStatus ?? bot.status] || botStatusConfig.offline
  const channels = (bot.messaging_channel ?? '').split(',').map(c => c.trim()).filter(Boolean)
  const hasNemoclaw = !!bot.sandbox_name

  return (
    <Card className="p-4 bg-card border-border hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {bot.avatar_url ? (
            <Image src={bot.avatar_url} alt={bot.bot_name} width={44} height={44}
              className="rounded-full object-cover w-11 h-11 ring-2 ring-border" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-base font-bold text-primary">
              {bot.bot_name.charAt(0)}
            </div>
          )}
          <div className={cn('absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card', status.dotClass)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm">{bot.bot_name}</h4>
            <Badge variant="secondary" className={cn('text-[10px] shrink-0', status.badgeClass)}>
              {status.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
            {bot.role && <span>{bot.role}</span>}
            {bot.assigned_to && <span className="text-muted-foreground/60">· {bot.assigned_to}</span>}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {channels.map(ch => channelConfig[ch] && (
              <span key={ch} className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', channelConfig[ch].color)}>
                {channelConfig[ch].label}
              </span>
            ))}
            {hasNemoclaw && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', channelConfig.nemoclaw.color)}>
                NemoClaw
              </span>
            )}
            {bot.ai_model && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground font-mono">
                {bot.ai_model}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

type ServerStats = {
  ram: { total: number; used: number; free: number }
  disk: { total: number; used: number; free: number }
  cpu: { used: number }
}

function StatBar({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  const color = value > 85 ? 'bg-red-500' : value > 65 ? 'bg-amber-500' : 'bg-teal-500'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">{icon}{label}</span>
        <span className={value > 85 ? 'text-red-500' : value > 65 ? 'text-amber-500' : 'text-teal-500'}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function fmt(bytes: number) {
  return bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)}GB` : `${(bytes / 1e6).toFixed(0)}MB`
}

function ServerHealthCheck({ client, bots, liveStatuses }: { client: Client; bots: Bot[]; liveStatuses: Record<string, string> }) {
  const [stats, setStats] = useState<ServerStats | null>(null)
  const onlineBots = bots.filter(b => (liveStatuses[b.id] ?? b.status) === 'online')
  const hasServer = client.vps_ip || bots.some(b => b.server_ip)
  const serverIp = client.vps_ip || bots.find(b => b.server_ip)?.server_ip
  const serverOnline = onlineBots.length > 0

  useEffect(() => {
    if (!serverIp) return
    const statsUrl = `https://myty.agency/twilio/stats`
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/server-stats?url=${encodeURIComponent(statsUrl)}`)
        if (res.ok) setStats(await res.json())
      } catch { /* ignore */ }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [serverIp])

  const ramPct = stats ? Math.round(stats.ram.used / stats.ram.total * 100) : null
  const diskPct = stats ? Math.round(stats.disk.used / stats.disk.total * 100) : null

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Server</h3>
        </div>
        <div className="flex items-center gap-2">
          {hasServer && serverOnline ? (
            <>
              <div className="status-dot status-active" />
              <Badge variant="secondary" className="bg-teal-500/10 text-teal-500 text-xs border-teal-500/20">
                <Wifi className="h-3 w-3 mr-1" />
                Live
              </Badge>
            </>
          ) : (
            <>
              <div className="status-dot status-not-deployed" />
              <Badge variant="secondary" className="text-xs text-muted-foreground">
                <WifiOff className="h-3 w-3 mr-1" />
                {hasServer ? 'Offline' : 'Kein Server'}
              </Badge>
            </>
          )}
        </div>
      </div>
      {serverIp && (
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-mono">{serverIp}</span>
          {client.vps_provider && <span>{client.vps_provider}</span>}
          <span>{onlineBots.length}/{bots.length} Bots online</span>
        </div>
      )}
      {stats && (
        <div className="mt-4 space-y-2.5">
          <StatBar value={stats.cpu.used} label={`CPU · ${stats.cpu.used}%`} icon={<Cpu className="h-3 w-3" />} />
          <StatBar value={ramPct!} label={`RAM · ${fmt(stats.ram.used)} / ${fmt(stats.ram.total)}`} icon={<MemoryStick className="h-3 w-3" />} />
          <StatBar value={diskPct!} label={`Disk · ${fmt(stats.disk.used)} / ${fmt(stats.disk.total)}`} icon={<HardDrive className="h-3 w-3" />} />
        </div>
      )}
    </Card>
  )
}

export function ClientOverview({ client, bots }: { client: Client; bots: Bot[] }) {
  const [liveStatuses, setLiveStatuses] = useState<Record<string, string>>({})

  useEffect(() => {
    const botsWithUrl = bots.filter(b => b.gateway_url)
    if (botsWithUrl.length === 0) return

    const check = async () => {
      try {
        const res = await fetch('/api/bot-health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bots: botsWithUrl.map(b => ({ id: b.id, gateway_url: b.gateway_url, gateway_token: b.gateway_token })) }),
        })
        if (!res.ok) return
        const results: Array<{ id: string; status: string }> = await res.json()
        setLiveStatuses(Object.fromEntries(results.map(r => [r.id, r.status])))
      } catch { /* ignore */ }
    }

    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [bots])

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Bots + Server */}
      <div className="space-y-6">
        {/* Bots */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BotIcon className="h-4 w-4 text-muted-foreground" />
              Bots ({bots.length})
            </h3>
          </div>
          {bots.length > 0 ? (
            <div className="space-y-2">
              {bots.map(bot => (
                <BotCard key={bot.id} bot={bot} liveStatus={liveStatuses[bot.id]} />
              ))}
            </div>
          ) : (
            <Card className="p-6 bg-card border-border border-dashed text-center">
              <BotIcon className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Noch keine Bots.</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">Erstelle einen über den Agent-Tab.</p>
            </Card>
          )}
        </div>

        {/* Server */}
        <ServerHealthCheck client={client} bots={bots} liveStatuses={liveStatuses} />
      </div>

      {/* Contact Info */}
      <div className="space-y-6">
        <Card className="p-5 bg-card border-border">
          <h3 className="text-sm font-semibold mb-4">Kontaktdaten</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{client.contact_name}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${client.contact_email}`} className="text-primary hover:underline">
                {client.contact_email}
              </a>
            </div>
            {client.contact_phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${client.contact_phone}`} className="hover:text-primary">
                  {client.contact_phone}
                </a>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{client.industry}</span>
            </div>
          </div>

          {client.notes && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Notizen</p>
              <p className="text-sm">{client.notes}</p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border flex gap-2">
            <Badge variant="secondary">{client.monthly_fee > 0 ? `€${client.monthly_fee}/Mo` : 'Kein MRR'}</Badge>
            {client.setup_fee > 0 && <Badge variant="secondary">Setup: €{client.setup_fee}</Badge>}
          </div>
        </Card>
      </div>
    </div>
  )
}
