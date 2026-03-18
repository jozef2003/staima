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
import { Copy, Server, Terminal, Radio, Shield, Rocket, Loader2, Plus, Bot as BotIcon } from 'lucide-react'
import type { Client, Bot } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

const botStatusConfig: Record<string, { label: string; dotClass: string }> = {
  online: { label: 'Online', dotClass: 'status-active' },
  configuring: { label: 'Wird eingerichtet', dotClass: 'status-configuring' },
  error: { label: 'Fehler', dotClass: 'status-error' },
  offline: { label: 'Offline', dotClass: 'status-not-deployed' },
}

const aiModels = [
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4', description: 'Empfohlen' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: 'Schnell & günstig' },
  { value: 'gpt-4o', label: 'GPT-4o (OpenAI)', description: 'Alternative' },
  { value: 'local', label: 'Lokales Modell', description: 'Nemotron via NemoClaw' },
]

function BotDetail({ bot, client }: { bot: Bot; client: Client }) {
  const status = botStatusConfig[bot.status] || botStatusConfig.offline
  const serverIp = bot.server_ip || client.vps_ip

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex items-center gap-4 mb-5">
        <div className="relative">
          {bot.avatar_url ? (
            <Image
              src={bot.avatar_url}
              alt={bot.bot_name}
              width={56}
              height={56}
              className="rounded-full object-cover w-14 h-14 ring-2 ring-border"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {bot.bot_name.charAt(0)}
            </div>
          )}
          <div className={cn('absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card', status.dotClass)} />
        </div>
        <div>
          <h3 className="text-lg font-bold">{bot.bot_name}</h3>
          {bot.role && <p className="text-xs text-muted-foreground">{bot.role}</p>}
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-[10px]">{status.label}</Badge>
            {bot.assigned_to && <Badge variant="secondary" className="text-[10px]">{bot.assigned_to}</Badge>}
            {bot.messaging_channel && <Badge variant="secondary" className="text-[10px] capitalize">{bot.messaging_channel}</Badge>}
          </div>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3">
          <Server className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Modell:</span>
          <span className="font-mono text-xs">{bot.ai_model}</span>
        </div>
        {serverIp && (
          <div className="flex items-center gap-3">
            <Radio className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Server:</span>
            <code className="font-mono text-primary text-xs bg-primary/10 px-2 py-0.5 rounded">{serverIp}</code>
          </div>
        )}
        {bot.sandbox_name && (
          <div className="flex items-center gap-3">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Sandbox:</span>
            <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{bot.sandbox_name}</code>
          </div>
        )}
      </div>

      {serverIp && (
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" size="sm" className="gap-1.5 text-xs" onClick={() => copyToClipboard(`ssh root@${serverIp}`)}>
            <Copy className="h-3 w-3" />
            SSH kopieren
          </Button>
          {bot.sandbox_name && (
            <Button variant="secondary" size="sm" className="gap-1.5 text-xs" onClick={() => copyToClipboard(`nemoclaw ${bot.sandbox_name} status`)}>
              <Terminal className="h-3 w-3" />
              Status
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

function AddBotForm({ client, onAdded }: { client: Client; onAdded: () => void }) {
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
            <Input placeholder="z.B. Sarah Weber" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} />
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
    <div className="grid gap-6 md:grid-cols-2">
      {/* Bots */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BotIcon className="h-4 w-4 text-muted-foreground" />
            Bots ({bots.length})
          </h3>
        </div>

        {bots.length > 0 ? (
          <div className="space-y-3">
            {bots.map(bot => (
              <BotDetail key={bot.id} bot={bot} client={client} />
            ))}
          </div>
        ) : loaded ? (
          <Card className="p-6 bg-card border-border border-dashed text-center">
            <BotIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Noch keine Bots für diesen Client.</p>
          </Card>
        ) : null}

        <AddBotForm client={client} onAdded={loadBots} />
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
  )
}
