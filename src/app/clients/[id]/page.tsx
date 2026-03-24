import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getClient, getClientWorkflows, getClientDeploymentLogs, getClientBots } from '@/lib/data'
import { ClientOverview } from '@/components/client/client-overview'
import { ClientMarlene } from '@/components/client/client-marlene'
import { ClientChat } from '@/components/client/client-chat'
import { ClientWorkflows } from '@/components/client/client-workflows'
import { ClientTimeTracking } from '@/components/client/client-time-tracking'

export const dynamic = 'force-dynamic'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [client, bots, workflows, logs] = await Promise.all([
    getClient(id),
    getClientBots(id),
    getClientWorkflows(id),
    getClientDeploymentLogs(id),
  ])

  if (!client) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
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
          <TabsTrigger value="workflows">Skills</TabsTrigger>
          <TabsTrigger value="time">Aktivitäten</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ClientOverview client={client} bots={bots} />
        </TabsContent>

        <TabsContent value="marlene">
          <ClientMarlene client={client} />
        </TabsContent>

        <TabsContent value="chat">
          <ClientChat bots={bots} />
        </TabsContent>

        <TabsContent value="workflows">
          <ClientWorkflows client={client} workflows={workflows} />
        </TabsContent>

        <TabsContent value="time">
          <ClientTimeTracking client={client} logs={logs} />
        </TabsContent>

      </Tabs>
    </div>
  )
}
