import { NextRequest, NextResponse } from 'next/server'
import { WebSocket } from 'ws'
import { createClient } from '@supabase/supabase-js'

const WS_TIMEOUT = 120_000

// Sonnet 4.6 pricing per million tokens
const PRICE_INPUT = 3.0
const PRICE_OUTPUT = 15.0
const PRICE_CACHE_READ = 0.30
const PRICE_CACHE_CREATE = 3.75

function toWsUrl(gatewayUrl: string): string {
  const url = gatewayUrl.endsWith('/') ? gatewayUrl : gatewayUrl + '/'
  return url
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://')
}

function frame(id: string, method: string, params: Record<string, unknown>) {
  return JSON.stringify({ type: 'req', id, method, params })
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function logUsage(botId: string, usage: { input: number; output: number; cacheRead: number; cacheCreate: number }) {
  const sb = getSupabase()
  if (!sb || !botId) return

  const costUsd =
    (usage.input / 1_000_000) * PRICE_INPUT +
    (usage.output / 1_000_000) * PRICE_OUTPUT +
    (usage.cacheRead / 1_000_000) * PRICE_CACHE_READ +
    (usage.cacheCreate / 1_000_000) * PRICE_CACHE_CREATE

  await sb.from('bot_usage').insert({
    bot_id: botId,
    input_tokens: usage.input,
    output_tokens: usage.output,
    cost_usd: costUsd,
  })

  // Update monthly_spend on the bot
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { data } = await sb
    .from('bot_usage')
    .select('cost_usd')
    .eq('bot_id', botId)
    .gte('created_at', monthStart)

  if (data) {
    const totalUsd = data.reduce((sum, r) => sum + Number(r.cost_usd), 0)
    const totalEur = totalUsd * 0.92 // rough USD to EUR
    await sb.from('bots').update({ monthly_spend: Math.round(totalEur * 100) / 100 }).eq('id', botId)
  }
}

export async function POST(request: NextRequest) {
  const { gatewayUrl, gatewayToken, message, sessionKey: existingKey, botId } = await request.json()

  if (!gatewayUrl || !gatewayToken || !message) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const wsUrl = toWsUrl(gatewayUrl)
  const host = new URL(gatewayUrl).host

  return new Promise<NextResponse>((resolve) => {
    let resolved = false
    const done = (res: NextResponse) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      try { ws?.close() } catch { /* ignore */ }
      resolve(res)
    }

    const timeout = setTimeout(() => {
      done(NextResponse.json({ error: 'Timeout — Bot antwortet nicht.' }, { status: 504 }))
    }, WS_TIMEOUT)

    let ws: WebSocket
    try {
      const scheme = wsUrl.startsWith('wss') ? 'https' : 'http'
      ws = new WebSocket(wsUrl, {
        headers: {
          Origin: `${scheme}://${host}`,
        },
      })
    } catch {
      clearTimeout(timeout)
      resolve(NextResponse.json({ error: 'WebSocket-Verbindung fehlgeschlagen.' }, { status: 502 }))
      return
    }

    let msgId = 1
    let sessionKey = existingKey as string | null
    let phase: 'challenge' | 'connect' | 'send' | 'wait' = 'challenge'
    let reply = ''
    const instanceId = crypto.randomUUID()
    let totalUsage = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 }

    ws.on('open', () => {
      // Wait for connect.challenge event from server
    })

    ws.on('message', (raw) => {
      let msg: {
        type?: string
        id?: string
        event?: string
        method?: string
        payload?: unknown
        result?: unknown
        ok?: boolean
        error?: unknown
        params?: unknown
      }
      try { msg = JSON.parse(raw.toString()) } catch { return }

      if (msg.type === 'event') {
        const event = msg.event ?? ''

        if (event === 'connect.challenge' && phase === 'challenge') {
          const nonce = (msg.payload as { nonce?: string })?.nonce ?? ''
          phase = 'connect'
          ws.send(frame(String(msgId++), 'connect', {
            minProtocol: 3,
            maxProtocol: 3,
            auth: { token: gatewayToken, deviceToken: '', password: '' },
            client: {
              id: 'openclaw-control-ui',
              version: '1.0.0',
              platform: 'web',
              mode: 'webchat',
              instanceId,
            },
            role: 'operator',
            scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
            device: { id: 'staima-api', publicKey: 'staima', signature: 'staima', signedAt: Date.now(), nonce },
            caps: ['tool-events'],
            userAgent: 'Staima/1.0',
            locale: 'de-DE',
          }))
          return
        }

        // Streaming chat output
        if (event === 'chat' && phase === 'wait') {
          const p = msg.payload as Record<string, unknown> | undefined

          // Extract usage from any event that has it
          if (p?.usage && typeof p.usage === 'object') {
            const u = p.usage as Record<string, number>
            if (u.input_tokens) totalUsage.input = u.input_tokens
            if (u.output_tokens) totalUsage.output = u.output_tokens
            if (u.cache_read_input_tokens) totalUsage.cacheRead = u.cache_read_input_tokens
            if (u.cache_creation_input_tokens) totalUsage.cacheCreate = u.cache_creation_input_tokens
          }

          if (p?.state === 'delta') {
            const textContent = extractText(p.message) || extractText(p)
            if (textContent) reply = textContent
          } else if (p?.state === 'final' || p?.state === 'aborted') {
            const textContent = extractText(p.message)
            if (textContent) reply = textContent

            // Estimate usage if not provided by OpenClaw
            if (totalUsage.input === 0 && totalUsage.output === 0) {
              // Rough estimate: 1 token ≈ 4 chars
              totalUsage.input = Math.ceil(message.length / 4) + 500 // +500 for system prompt overhead
              totalUsage.output = Math.ceil((reply || '').length / 4)
            }

            // Log usage async (don't block response)
            if (botId) {
              logUsage(botId, totalUsage).catch(() => {})
            }

            const check = filterOutput(reply)
            if (!check.safe) {
              done(NextResponse.json({ error: check.reason }, { status: 403 }))
            } else {
              done(NextResponse.json({ reply: reply || 'Keine Textantwort vom Bot.', sessionKey }))
            }
          } else if (p?.state === 'error') {
            done(NextResponse.json({ error: `Bot-Fehler: ${p.errorMessage ?? 'unbekannt'}` }, { status: 502 }))
          }
          return
        }
        return
      }

      if (msg.type === 'res' && msg.id !== undefined) {
        if (!msg.ok) {
          const errMsg = (msg.error as { message?: string })?.message ?? 'Unknown error'
          done(NextResponse.json({ error: `Gateway-Fehler: ${errMsg}` }, { status: 502 }))
          return
        }

        const payload = msg.payload as Record<string, unknown> | undefined

        if (phase === 'connect') {
          if (!sessionKey) {
            const snapshot = (payload as { snapshot?: { sessionDefaults?: { mainSessionKey?: string } } })?.snapshot
            sessionKey = snapshot?.sessionDefaults?.mainSessionKey ?? 'agent:main:main'
          }
          phase = 'send'
          sendChat()
        } else if (phase === 'send') {
          phase = 'wait'
        }
      }
    })

    ws.on('error', (err) => {
      done(NextResponse.json({ error: `WebSocket-Fehler: ${err.message}` }, { status: 502 }))
    })

    ws.on('close', (code, reason) => {
      if (phase === 'wait' && reply) {
        if (botId) logUsage(botId, totalUsage).catch(() => {})
        done(NextResponse.json({ reply, sessionKey }))
      } else if (!resolved) {
        done(NextResponse.json(
          { error: `Verbindung getrennt (${code}): ${reason?.toString() || 'unbekannt'}` },
          { status: 502 }
        ))
      }
    })

    function sendChat() {
      ws.send(frame(String(msgId++), 'chat.send', {
        sessionKey,
        message,
        deliver: false,
        idempotencyKey: crypto.randomUUID(),
        attachments: [],
      }))
    }
  })
}

function extractText(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const m = message as Record<string, unknown>
  if (typeof m.text === 'string') return m.text
  if (Array.isArray(m.content)) {
    return m.content
      .filter((c): c is { type: string; text: string } => c?.type === 'text')
      .map(c => c.text)
      .join('')
  }
  return ''
}

const SENSITIVE_PATTERNS = [
  /sk-ant-[a-zA-Z0-9\-_]{20,}/i,
  /Bearer\s+[a-zA-Z0-9\-_]{20,}/i,
  /-----BEGIN [A-Z ]+-----/,
  /(?:password|passwort)\s*[:=]\s*\S+/i,
]

function filterOutput(text: string): { safe: boolean; reason?: string } {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, reason: 'Antwort enthält möglicherweise sensible Daten und wurde blockiert.' }
    }
  }
  return { safe: true }
}
