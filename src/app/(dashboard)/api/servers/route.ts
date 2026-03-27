import { NextResponse } from 'next/server'
import { createServer, listServers } from '@/lib/hetzner'

export async function GET() {
  try {
    const servers = await listServers()
    return NextResponse.json({ servers })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fehler beim Laden der Server' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const { name, aiModel, anthropicKey, openaiKey, messagingChannel } = await req.json()
    if (!name) {
      return NextResponse.json({ error: 'Server-Name fehlt' }, { status: 400 })
    }

    const serverName = `marlene-${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`
    const server = await createServer({
      name: serverName,
      aiModel,
      anthropicKey,
      openaiKey,
      messagingChannel,
    })

    return NextResponse.json({
      server: {
        id: server.id,
        name: server.name,
        status: server.status,
        ip: server.public_net.ipv4.ip,
        location: server.datacenter.location.city,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fehler beim Erstellen des Servers' },
      { status: 500 }
    )
  }
}
