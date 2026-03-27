import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Server, Wifi, WifiOff, Bot as BotIcon } from 'lucide-react'
import { getClients, getAllBots, getAllServers } from '@/lib/data'
import Link from 'next/link'
import type { Client, Bot } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

type ServerEntry = { ip: string; label: string | null; provider: string | null; status: string; client: Client }

function ServerCard({ entry, bots }: { entry: ServerEntry; client: Client; bots: Bot[] }) {
  const serverBots = bots.filter(b => b.server_ip === entry.ip && b.client_id === entry.client.id)
  const onlineBots = serverBots.filter(b => b.status === 'online')
  const isActive = entry.status === 'active'

  return (
    <Link href={`/clients/${entry.client.id}`}>
      <Card className="p-5 bg-card border-border hover:border-primary/30 transition-colors cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Server className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{entry.client.company_name}</h3>
                {entry.label && <Badge variant="secondary" className="text-[10px]">{entry.label}</Badge>}
                <Badge variant="secondary" className={`text-[10px] text-white ${isActive ? 'bg-teal-500' : 'bg-zinc-500'}`}>
                  {isActive ? 'Online' : entry.status}
                </Badge>
                {entry.provider && <Badge variant="secondary" className="text-[10px]">{entry.provider}</Badge>}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground font-mono">{entry.ip}</div>
              {serverBots.length > 0 ? (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <BotIcon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{onlineBots.length}/{serverBots.length} Bots online</span>
                  <div className="flex gap-1 flex-wrap">
                    {serverBots.map(bot => (
                      <Badge key={bot.id} variant="secondary" className="text-[10px]">{bot.bot_name}</Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50 mt-1.5">Noch keine Bots</p>
              )}
            </div>
          </div>
          {isActive ? <Wifi className="h-4 w-4 text-teal-500" /> : <WifiOff className="h-4 w-4 text-zinc-500" />}
        </div>
      </Card>
    </Link>
  )
}

export default async function ServersPage() {
  const [clients, bots, extraServers] = await Promise.all([getClients(), getAllBots(), getAllServers()])

  const entries: ServerEntry[] = []
  const seen = new Set<string>()

  // From clients vps_ip
  for (const client of clients) {
    if (client.vps_ip) {
      const key = `${client.id}-${client.vps_ip}`
      if (!seen.has(key)) {
        seen.add(key)
        entries.push({ ip: client.vps_ip, label: null, provider: client.vps_provider, status: client.vps_status === 'active' ? 'active' : client.vps_status, client })
      }
    }
    // From bot server_ips
    for (const bot of bots.filter(b => b.client_id === client.id && b.server_ip)) {
      const key = `${client.id}-${bot.server_ip!}`
      if (!seen.has(key)) {
        seen.add(key)
        entries.push({ ip: bot.server_ip!, label: null, provider: null, status: 'active', client })
      }
    }
  }

  // From servers table
  for (const s of extraServers) {
    const client = clients.find(c => c.id === s.client_id)
    if (!client) continue
    const key = `${client.id}-${s.ip}`
    if (!seen.has(key)) {
      seen.add(key)
      entries.push({ ip: s.ip, label: s.label, provider: s.provider, status: s.status, client })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Server</h1>
        <p className="text-sm text-muted-foreground">{entries.length} Server · Alle verbundenen Instanzen</p>
      </div>
      {entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map(entry => (
            <ServerCard key={`${entry.client.id}-${entry.ip}`} entry={entry} client={entry.client} bots={bots} />
          ))}
        </div>
      ) : (
        <Card className="p-8 bg-card border-border text-center">
          <Server className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Noch keine Server verbunden.</p>
        </Card>
      )}
    </div>
  )
}
