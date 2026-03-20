'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Server, Shield, Bot as BotIcon, Zap, HardDrive } from 'lucide-react'
import type { Client, Bot } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

const botStatusConfig: Record<string, { label: string; dotClass: string; color: string }> = {
  online: { label: 'Online', dotClass: 'status-active', color: 'bg-emerald-500' },
  configuring: { label: 'Wird eingerichtet', dotClass: 'status-configuring', color: 'bg-amber-500' },
  error: { label: 'Fehler', dotClass: 'status-error', color: 'bg-red-500' },
  offline: { label: 'Offline', dotClass: 'status-not-deployed', color: 'bg-zinc-500' },
}

// ─── Organigramm ────────────────────────────────────────────

function OrgNode({ bot, isRoot }: { bot: Bot; isRoot?: boolean }) {
  const status = botStatusConfig[bot.status] || botStatusConfig.offline
  const port = bot.role?.match(/[Pp]ort\s+(\d{4,5})/)?.[1] ?? null

  return (
    <div className={cn(
      "relative flex flex-col items-center rounded-xl border bg-card px-5 py-4 shadow-sm transition-all hover:shadow-md",
      isRoot ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
    )} style={{ minWidth: 180 }}>
      {/* Avatar */}
      <div className="relative mb-2">
        {bot.avatar_url ? (
          <div className={cn(
            "rounded-full ring-2 ring-border overflow-hidden",
            isRoot ? "w-14 h-14" : "w-11 h-11"
          )}>
            <Image
              src={bot.avatar_url}
              alt={bot.bot_name}
              width={isRoot ? 112 : 88}
              height={isRoot ? 112 : 88}
              className="w-full h-full object-cover object-top"
            />
          </div>
        ) : (
          <div className={cn(
            "rounded-full flex items-center justify-center ring-2 ring-border",
            isRoot ? "w-14 h-14 bg-primary/10" : "w-11 h-11 bg-muted",
          )}>
            {isRoot ? (
              <span className="text-xl font-bold text-primary">{bot.bot_name.charAt(0)}</span>
            ) : (
              <Zap className="h-5 w-5 text-primary" />
            )}
          </div>
        )}
        {/* Status dot */}
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-card",
          isRoot ? "w-4 h-4" : "w-3.5 h-3.5",
          status.color,
        )} />
      </div>

      {/* Name */}
      <span className={cn("font-semibold", isRoot ? "text-base" : "text-sm")}>{bot.bot_name}</span>

      {/* Role */}
      {bot.role && (
        <span className="text-[11px] text-muted-foreground text-center mt-0.5 leading-tight max-w-[200px]">
          {bot.role.length > 60 ? bot.role.slice(0, 60) + '…' : bot.role}
        </span>
      )}

      {/* Badges */}
      <div className="flex flex-wrap items-center justify-center gap-1 mt-2">
        <Badge variant="secondary" className="text-[10px]">{status.label}</Badge>
        {bot.sandbox_name && (
          <Badge variant="secondary" className="text-[10px] font-mono">{bot.sandbox_name}</Badge>
        )}
      </div>

      {/* Model + Channel + Port */}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap justify-center">
        <span className="text-[10px] text-muted-foreground font-mono">{bot.ai_model}</span>
        {bot.messaging_channel && (
          <>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground capitalize">{bot.messaging_channel}</span>
          </>
        )}
        {port && (
          <>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] font-mono text-primary/70">:{port}</span>
          </>
        )}
      </div>
    </div>
  )
}

function BotTree({ root, getChildren }: { root: Bot; getChildren: (name: string) => Bot[] }) {
  const children = getChildren(root.bot_name)
  return (
    <div className="flex flex-col items-center">
      <OrgNode bot={root} isRoot />

      {children.length > 0 && <div className="w-px h-6 bg-border" />}

      {children.length > 0 && (
        <div className="relative flex items-start">
          {children.length > 1 && (
            <div
              className="absolute top-0 bg-border"
              style={{
                height: 1,
                left: `calc(50% / ${children.length})`,
                right: `calc(50% / ${children.length})`,
              }}
            />
          )}
          <div className="flex gap-6">
            {children.map(child => {
              const grandchildren = getChildren(child.bot_name)
              return (
                <div key={child.id} className="flex flex-col items-center">
                  <div className="w-px h-4 bg-border" />
                  <OrgNode bot={child} />
                  {grandchildren.length > 0 && (
                    <>
                      <div className="w-px h-4 bg-border" />
                      <div className="flex gap-4">
                        {grandchildren.map(gc => (
                          <div key={gc.id} className="flex flex-col items-center">
                            <div className="w-px h-4 bg-border" />
                            <OrgNode bot={gc} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function OrgChart({ bots, client }: { bots: Bot[]; client: Client }) {
  const rootBots = bots.filter(b => {
    const assignedTo = (b.assigned_to || '').toLowerCase()
    return !bots.some(parent => parent.bot_name.toLowerCase() === assignedTo)
  })
  const getChildren = (parentName: string) =>
    bots.filter(b => (b.assigned_to || '').toLowerCase() === parentName.toLowerCase())

  if (bots.length === 0) {
    return (
      <Card className="p-8 bg-card border-border border-dashed text-center">
        <BotIcon className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Noch keine Bots für diesen Client.</p>
      </Card>
    )
  }

  // Single root: center it
  if (rootBots.length === 1) {
    return (
      <div className="flex justify-center">
        <BotTree root={rootBots[0]} getChildren={getChildren} />
      </div>
    )
  }

  // Multiple independent roots: side by side with divider between each
  return (
    <div className="flex items-start justify-center gap-0 flex-wrap">
      {rootBots.map((root, idx) => (
        <div key={root.id} className="flex items-start">
          {/* Each independent system in its own padded column */}
          <div className="flex flex-col items-center px-8">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-4 font-medium">
              System {idx + 1}
            </span>
            <BotTree root={root} getChildren={getChildren} />
          </div>

          {/* Vertical divider between systems */}
          {idx < rootBots.length - 1 && (
            <div className="self-stretch flex items-center">
              <div className="w-px bg-border/60 mx-2" style={{ minHeight: 120 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Bot Detail (for expanded view below org chart) ─────────

function BotDetail({ bot, client }: { bot: Bot; client: Client }) {
  const status = botStatusConfig[bot.status] || botStatusConfig.offline
  const serverIp = bot.server_ip || client.vps_ip

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border text-sm">
      <div className="flex items-center gap-3">
        <div className={cn("w-2 h-2 rounded-full", status.color)} />
        <span className="font-medium">{bot.bot_name}</span>
        {bot.sandbox_name && <code className="text-[10px] font-mono text-muted-foreground">{bot.sandbox_name}</code>}
      </div>
      {serverIp && (
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => copyToClipboard(`ssh root@${serverIp}`)}>
          <Copy className="h-3 w-3" />
          SSH
        </Button>
      )}
    </div>
  )
}

// ─── Main Export ─────────────────────────────────────────────

export function ClientMarlene({ client }: { client: Client }) {
  const [bots, setBots] = useState<Bot[]>([])
  const [loaded, setLoaded] = useState(false)

  async function loadBots() {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { supabase } = await import('@/lib/supabase/client')
      const { data } = await supabase.from('bots').select('*').eq('client_id', client.id).order('created_at', { ascending: true })
      setBots((data as Bot[]) || [])
    }
    setLoaded(true)
  }

  if (!loaded) {
    loadBots()
  }

  const serverIp = client.vps_ip

  return (
    <div className="space-y-8">
      {/* Organigramm */}
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-5">
          <BotIcon className="h-4 w-4 text-muted-foreground" />
          Bot-Organigramm
        </h3>
        <Card className="bg-card border-border overflow-x-auto">
          {/* Server Label */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
            <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-mono text-muted-foreground">
              {client.vps_provider && <span className="text-foreground/70 mr-2">{client.vps_provider}</span>}
              {client.vps_ip ?? 'Kein Server'}
            </span>
            {client.vps_ip && (
              <span className={cn(
                'ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                client.vps_status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-muted text-muted-foreground'
              )}>
                {client.vps_status}
              </span>
            )}
          </div>
          <div className="p-8">
            <OrgChart bots={bots} client={client} />
          </div>
        </Card>
      </div>

      {/* Bot list + Server info side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick list */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            Alle Bots ({bots.length})
          </h3>
          <div className="space-y-2">
            {bots.map(bot => (
              <BotDetail key={bot.id} bot={bot} client={client} />
            ))}
          </div>
        </div>

        {/* Server Info & Policies */}
        <div className="space-y-6">
          <Card className="p-5 bg-card border-border">
            <h3 className="text-sm font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {serverIp ? (
                <Button variant="secondary" className="w-full justify-start gap-2 text-sm" onClick={() => copyToClipboard(`ssh root@${serverIp}`)}>
                  <Copy className="h-3.5 w-3.5" />
                  SSH zu VPS kopieren
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Kein Server zugewiesen.</p>
              )}
            </div>

          </Card>

          <Card className="p-5 bg-card border-border">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">NemoClaw Policies</h3>
            </div>
            {serverIp ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>SSH (Port 22)</span>
                  <Badge variant="secondary" className="bg-teal-500/10 text-teal-500 text-[10px]">Aktiv</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>HTTP/HTTPS (80/443)</span>
                  <Badge variant="secondary" className="bg-teal-500/10 text-teal-500 text-[10px]">Aktiv</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Outbound API</span>
                  <Badge variant="secondary" className="bg-teal-500/10 text-teal-500 text-[10px]">Aktiv</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Sandboxes isoliert</span>
                  <Badge variant="secondary" className="bg-teal-500/10 text-teal-500 text-[10px]">Aktiv</Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Policies werden aktiv sobald ein Server zugewiesen ist.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
