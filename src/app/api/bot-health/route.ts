import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { bots } = await req.json() as {
    bots: Array<{ id: string; gateway_url: string | null; gateway_token: string | null }>
  }

  const results = await Promise.all(
    bots.map(async (bot) => {
      if (!bot.gateway_url) return { id: bot.id, status: 'offline' }
      try {
        const url = bot.gateway_url.replace(/\/$/, '') + '/health'
        const headers: Record<string, string> = {}
        if (bot.gateway_token) headers['Authorization'] = `Bearer ${bot.gateway_token}`
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(4000) })
        return { id: bot.id, status: res.ok ? 'online' : 'error' }
      } catch {
        return { id: bot.id, status: 'offline' }
      }
    })
  )

  return NextResponse.json(results)
}
