import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Server, Wifi, WifiOff, Copy, Bot as BotIcon } from 'lucide-react'
import { getClients, getAllBots } from '@/lib/data'
import Link from 'next/link'
import type { Client, Bot } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

function ServerCard({ client, bots }: { client: Client; bots: Bot[] }) {
  const clientBots = bots.filter(b => b.server_ip === client.vps_ip || b.client_id === client.id)
  const onlineBots = clientBots.filter(b => b.status === 'online')
  const isActive = client.vps_status === 'active'

  return (
    <Link href={`/clients/${client.id}`}>
      <Card className="p-5 bg-card border-border hover:border-primary/30 transition-colors cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="mt-0.5">
              <Server className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{client.company_name}</h3>
                <Badge
                  variant="secondary"
                  className={`text-[10px] text-white ${isActive ? 'bg-teal-500' : 'bg-zinc-500'}`}
                >
                  {isActive ? 'Online' : client.vps_status}
                </Badge>
                {client.vps_provider && (
                  <Badge variant="secondary" className="text-[10px]">
                    {client.vps_provider}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                <span className="font-mono">{client.vps_ip}</span>
                {client.sandbox_name && <span className="font-mono">{client.sandbox_name}</span>}
              </div>
              {clientBots.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <BotIcon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {onlineBots.length}/{clientBots.length} Bots online
                  </span>
                  <div className="flex gap-1">
                    {clientBots.map(bot => (
                      <Badge key={bot.id} variant="secondary" className="text-[10px]">
                        {bot.bot_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isActive ? (
              <Wifi className="h-4 w-4 text-teal-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-zinc-500" />
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}

export default async function ServersPage() {
  const [clients, bots] = await Promise.all([
    getClients(),
    getAllBots(),
  ])

  const serversClients = clients.filter(c => c.vps_ip)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Server</h1>
        <p className="text-sm text-muted-foreground">Alle verbundenen Server und ihre Bots</p>
      </div>

      {serversClients.length > 0 ? (
        <div className="space-y-3">
          {serversClients.map(client => (
            <ServerCard key={client.id} client={client} bots={bots} />
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
