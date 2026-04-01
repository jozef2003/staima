import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { botIds } = await request.json() as { botIds: string[] }
  if (!botIds?.length) return NextResponse.json([])

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json([])

  const sb = createClient(url, key)

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const results = await Promise.all(botIds.map(async (botId) => {
    const [todayRes, monthRes, lifetimeRes] = await Promise.all([
      sb.from('bot_usage').select('cost_usd,input_tokens,output_tokens').eq('bot_id', botId).gte('created_at', todayStart),
      sb.from('bot_usage').select('cost_usd').eq('bot_id', botId).gte('created_at', monthStart),
      sb.from('bot_usage').select('cost_usd').eq('bot_id', botId),
    ])

    const sum = (rows: { cost_usd: number }[] | null) =>
      (rows ?? []).reduce((s, r) => s + Number(r.cost_usd), 0)

    const todayTokens = (todayRes.data ?? []).reduce((s, r) => ({
      input: s.input + r.input_tokens,
      output: s.output + r.output_tokens,
    }), { input: 0, output: 0 })

    return {
      botId,
      today: { costUsd: sum(todayRes.data), ...todayTokens },
      month: { costUsd: sum(monthRes.data) },
      lifetime: { costUsd: sum(lifetimeRes.data) },
    }
  }))

  return NextResponse.json(results)
}
