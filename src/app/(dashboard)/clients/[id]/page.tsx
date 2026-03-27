import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getClient, getClientBots, getClientServers } from '@/lib/data'
import { createAuthClient } from '@/lib/supabase/ssr-client'
import { ClientOverview } from '@/components/client/client-overview'
import { ClientMarlene } from '@/components/client/client-marlene'
import { ClientChat } from '@/components/client/client-chat'

export const dynamic = 'force-dynamic'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = user?.email === 'jozef@staima.ai'

  const [client, bots, servers] = await Promise.all([
    getClient(id),
    getClientBots(id),
    getClientServers(id),
  ])

  if (!client) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {isAdmin && (
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{client.company_name}</h1>
          <p className="text-sm text-muted-foreground">{client.industry} — {client.contact_name}</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="marlene">Agent</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ClientOverview client={client} bots={bots} isAdmin={isAdmin} servers={servers} />
        </TabsContent>

        <TabsContent value="marlene">
          <ClientMarlene client={client} servers={servers} />
        </TabsContent>

        <TabsContent value="chat">
          <ClientChat bots={bots} />
        </TabsContent>

      </Tabs>
    </div>
  )
}
