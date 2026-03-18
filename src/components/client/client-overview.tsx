'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, Phone, Building2, User, Wifi, WifiOff, Server, Bot as BotIcon, Plus } from 'lucide-react'
import type { Client, Bot } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const botStatusConfig: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  online: { label: 'Online', dotClass: 'bg-teal-500', badgeClass: 'bg-teal-500/10 text-teal-500 border-teal-500/20' },
  configuring: { label: 'Wird eingerichtet', dotClass: 'bg-amber-500', badgeClass: 'bg-amber-500/10 text-amber-500' },
  error: { label: 'Fehler', dotClass: 'bg-red-500', badgeClass: 'bg-red-500/10 text-red-500' },
  offline: { label: 'Offline', dotClass: 'bg-zinc-500', badgeClass: '' },
}

function BotCard({ bot }: { bot: Bot }) {
  const status = botStatusConfig[bot.status] || botStatusConfig.offline

  return (
    <Card className="p-4 bg-card border-border hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="relative">
          {bot.avatar_url ? (
            <Image
              src={bot.avatar_url}
              alt={bot.bot_name}
              width={48}
              height={48}
              className="rounded-full object-cover w-12 h-12 ring-2 ring-border"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {bot.bot_name.charAt(0)}
            </div>
          )}
          <div className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card',
            status.dotClass
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm truncate">{bot.bot_name}</h4>
            <Badge variant="secondary" className={cn('text-[10px] shrink-0', status.badgeClass)}>
              {status.label}
            </Badge>
          </div>
          {bot.role && (
            <p className="text-xs text-muted-foreground mt-0.5">{bot.role}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            {bot.assigned_to && <span>{bot.assigned_to}</span>}
            {bot.messaging_channel && <span className="capitalize">{bot.messaging_channel}</span>}
            {bot.ai_model && <span className="font-mono">{bot.ai_model}</span>}
          </div>
        </div>
      </div>
    </Card>
  )
}

function ServerHealthCheck({ client, bots }: { client: Client; bots: Bot[] }) {
  const onlineBots = bots.filter(b => b.status === 'online')
  const hasServer = client.vps_ip || bots.some(b => b.server_ip)
  const serverIp = client.vps_ip || bots.find(b => b.server_ip)?.server_ip

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Server</h3>
        </div>
        <div className="flex items-center gap-2">
          {hasServer ? (
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
                Kein Server
              </Badge>
            </>
          )}
        </div>
      </div>
      {serverIp && (
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-mono">{serverIp}</span>
          {client.vps_provider && <span>{client.vps_provider}</span>}
          <span>{onlineBots.length}/{bots.length} Bots online</span>
        </div>
      )}
    </Card>
  )
}

export function ClientOverview({ client, bots }: { client: Client; bots: Bot[] }) {
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
                <BotCard key={bot.id} bot={bot} />
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
        <ServerHealthCheck client={client} bots={bots} />
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
