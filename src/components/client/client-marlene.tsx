'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Copy, Server, Terminal, Radio, Shield, Rocket, Loader2, Plus, Bot as BotIcon, Zap } from 'lucide-react'
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

const aiModels = [
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4', description: 'Empfohlen' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: 'Schnell & günstig' },
  { value: 'gpt-4o', label: 'GPT-4o (OpenAI)', description: 'Alternative' },
  { value: 'local', label: 'Lokales Modell', description: 'Nemotron via NemoClaw' },
]

// ─── Organigramm ────────────────────────────────────────────

function OrgNode({ bot, isRoot }: { bot: Bot; isRoot?: boolean }) {
  const status = botStatusConfig[bot.status] || botStatusConfig.offline

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

      {/* Model + Channel */}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] text-muted-foreground font-mono">{bot.ai_model}</span>
        {bot.messaging_channel && (
          <>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground capitalize">{bot.messaging_channel}</span>
          </>
        )}
      </div>
    </div>
  )
}

function OrgChart({ bots, client }: { bots: Bot[]; client: Client }) {
  // Find root bots (not assigned to another bot) and sub-bots
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

  return (
    <div className="flex flex-col items-center gap-0">
      {rootBots.map(root => {
        const children = getChildren(root.bot_name)
        return (
          <div key={root.id} className="flex flex-col items-center">
            {/* Root node */}
            <OrgNode bot={root} isRoot />

            {/* Connector line down from root */}
            {children.length > 0 && (
              <div className="w-px h-6 bg-border" />
            )}

            {/* Children row */}
            {children.length > 0 && (
              <div className="relative flex items-start">
                {/* Horizontal connector bar */}
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
                        {/* Vertical connector from horizontal bar to child */}
                        <div className="w-px h-4 bg-border" />
                        <OrgNode bot={child} />

                        {/* Grandchildren */}
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
      })}
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
      <div className="flex items-center gap-2">
        {serverIp && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => copyToClipboard(`ssh root@${serverIp}`)}>
            <Copy className="h-3 w-3" />
            SSH
          </Button>
        )}
        {bot.sandbox_name && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => copyToClipboard(`nemoclaw ${bot.sandbox_name} status`)}>
            <Terminal className="h-3 w-3" />
            Status
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Add Bot Form ───────────────────────────────────────────

function AddBotForm({ client, bots, onAdded }: { client: Client; bots: Bot[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [botName, setBotName] = useState('')
  const [role, setRole] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [aiModel, setAiModel] = useState('claude-sonnet-4')
  const [channel, setChannel] = useState('telegram')

  async function handleSubmit() {
    if (!botName) return
    setSaving(true)
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const { supabase } = await import('@/lib/supabase/client')
        await (supabase.from('bots') as any).insert({
          client_id: client.id,
          bot_name: botName,
          ai_model: aiModel,
          status: 'offline',
          server_ip: client.vps_ip,
          messaging_channel: channel,
          assigned_to: assignedTo || null,
          role: role || null,
        })
      }
      setBotName('')
      setRole('')
      setAssignedTo('')
      setOpen(false)
      onAdded()
    } catch {
      alert('Fehler beim Erstellen')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" className="w-full gap-2 border-dashed" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Neuen Bot hinzufügen
      </Button>
    )
  }

  return (
    <Card className="p-5 bg-card border-primary/30">
      <h4 className="text-sm font-semibold mb-4">Neuen Bot erstellen</h4>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Bot-Name *</Label>
            <Input placeholder="z.B. Clara" value={botName} onChange={e => setBotName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Rolle</Label>
            <Input placeholder="z.B. Sales Assistentin" value={role} onChange={e => setRole(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Zugewiesen an</Label>
            <Select value={assignedTo} onValueChange={v => setAssignedTo(v || '')}>
              <SelectTrigger><SelectValue placeholder="Eigenständig" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Eigenständig</SelectItem>
                {bots.map(b => (
                  <SelectItem key={b.id} value={b.bot_name}>{b.bot_name} (Sub-Bot)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">AI-Modell</Label>
            <Select value={aiModel} onValueChange={v => v && setAiModel(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {aiModels.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Channel</Label>
          <Select value={channel} onValueChange={v => v && setChannel(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="telegram">Telegram</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="discord">Discord</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSubmit} disabled={saving || !botName} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
            {saving ? 'Wird erstellt...' : 'Bot erstellen'}
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>Abbrechen</Button>
        </div>
      </div>
    </Card>
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
        <Card className="p-8 bg-card border-border overflow-x-auto">
          <OrgChart bots={bots} client={client} />
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
          <AddBotForm client={client} bots={bots} onAdded={loadBots} />
        </div>

        {/* Server Info & Policies */}
        <div className="space-y-6">
          <Card className="p-5 bg-card border-border">
            <h3 className="text-sm font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {serverIp ? (
                <>
                  <Button variant="secondary" className="w-full justify-start gap-2 text-sm" onClick={() => copyToClipboard(`ssh root@${serverIp}`)}>
                    <Copy className="h-3.5 w-3.5" />
                    SSH zu VPS kopieren
                  </Button>
                  <Button variant="secondary" className="w-full justify-start gap-2 text-sm" onClick={() => copyToClipboard(`nemoclaw list`)}>
                    <Terminal className="h-3.5 w-3.5" />
                    Alle Sandboxes listen
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Kein Server zugewiesen.</p>
              )}
            </div>

            {serverIp && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Befehle</p>
                <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">{`ssh root@${serverIp}
nemoclaw list
openclaw status
openclaw channels status`}</pre>
              </div>
            )}
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
