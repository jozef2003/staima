import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createAuthClient } from '@/lib/supabase/ssr-client'
import { ClientOverview } from '@/components/client/client-overview'
import { ClientMarlene } from '@/components/client/client-marlene'
import { ClientChat } from '@/components/client/client-chat'
import type { Client, Bot, Server } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = user?.email === 'jozef@staima.ai'

  const clientRes = await supabase.from('clients').select('*').eq('id', id).single()
  const client = clientRes.data as Client | null
  if (!client) notFound()

  const [botsRes, serversRes] = await Promise.all([
    supabase.from('bots').select('*').eq('client_id', id).order('created_at', { ascending: true }),
    supabase.from('servers').select('*').eq('client_id', id),
  ])
  const bots = (botsRes.data ?? []) as Bot[]
  const servers = (serversRes.data ?? []) as Server[]

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
