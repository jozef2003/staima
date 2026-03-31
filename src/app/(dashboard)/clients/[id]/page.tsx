import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createAuthClient } from '@/lib/supabase/ssr-client'
import { ClientOverview } from '@/components/client/client-overview'
import { ClientMarlene } from '@/components/client/client-marlene'
import { ClientChat } from '@/components/client/client-chat'
import { ClientWorkflows } from '@/components/client/client-workflows'
import { ClientTimeTracking } from '@/components/client/client-time-tracking'
import { ClientInvoices } from '@/components/client/client-invoices'
import type { Client, Bot, Server, Workflow, DeploymentLog, Invoice } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = user?.email === 'jozef@staima.ai'

  const clientRes = await supabase.from('clients').select('*').eq('id', id).single()
  const client = clientRes.data as Client | null
  if (!client) notFound()

  const [botsRes, serversRes, workflowsRes, logsRes, invoicesRes] = await Promise.all([
    supabase.from('bots').select('*').eq('client_id', id).order('created_at', { ascending: true }),
    supabase.from('servers').select('*').eq('client_id', id),
    supabase.from('workflows').select('*').eq('client_id', id).order('created_at', { ascending: true }),
    supabase.from('deployment_log').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('invoices').select('*').eq('client_id', id).order('created_at', { ascending: false }),
  ])
  const bots = (botsRes.data ?? []) as Bot[]
  const servers = (serversRes.data ?? []) as Server[]
  const workflows = (workflowsRes.data ?? []) as Workflow[]
  const logs = (logsRes.data ?? []) as DeploymentLog[]
  const invoices = (invoicesRes.data ?? []) as Invoice[]

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
        <TabsList className="bg-card border border-border flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="marlene">Agent</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="activity">Aktivitäten</TabsTrigger>
          {isAdmin && <TabsTrigger value="invoices">Rechnungen</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview">
          <ClientOverview client={client} bots={bots} isAdmin={isAdmin} servers={servers} />
        </TabsContent>

        <TabsContent value="marlene">
          <ClientMarlene client={client} bots={bots} servers={servers} />
        </TabsContent>

        <TabsContent value="chat">
          <ClientChat bots={bots} />
        </TabsContent>

        <TabsContent value="skills">
          <ClientWorkflows client={client} workflows={workflows} />
        </TabsContent>

        <TabsContent value="activity">
          <ClientTimeTracking client={client} logs={logs} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="invoices">
            <ClientInvoices client={client} invoices={invoices} />
          </TabsContent>
        )}

      </Tabs>
    </div>
  )
}
