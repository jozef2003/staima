import { NextRequest, NextResponse } from 'next/server'
import { WebSocket } from 'ws'

const WS_TIMEOUT = 45_000

function toWsUrl(gatewayUrl: string): string {
  // Keep trailing slash — nginx proxy requires it
  const url = gatewayUrl.endsWith('/') ? gatewayUrl : gatewayUrl + '/'
  return url
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://')
}

function frame(id: string, method: string, params: Record<string, unknown>) {
  return JSON.stringify({ type: 'req', id, method, params })
}

export async function POST(request: NextRequest) {
  const { gatewayUrl, gatewayToken, message, sessionKey: existingKey } = await request.json()

  if (!gatewayUrl || !gatewayToken || !message) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const wsUrl = toWsUrl(gatewayUrl)
  // Extract host for Origin fallback (e.g. "myty.agency")
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
      // Set Origin header so OpenClaw's origin check passes
      // (browser sends this automatically; Node.js doesn't, so we set it explicitly)
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

    ws.on('open', () => {
      // Wait for connect.challenge event from server before sending anything
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

      // Server event notifications
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
            // Device object required by schema; dangerouslyDisableDeviceAuth=true on server skips sig check
            device: { id: 'staima-api', publicKey: 'staima', signature: 'staima', signedAt: Date.now(), nonce },
            caps: ['tool-events'],
            userAgent: 'Staima/1.0',
            locale: 'de-DE',
          }))
          return
        }

        // Streaming chat output (delta)
        if (event === 'chat' && phase === 'wait') {
          const p = msg.payload as Record<string, unknown> | undefined
          if (p?.state === 'delta') {
            const textContent = extractText(p.message)
            if (textContent) reply = textContent  // delta has full text so far
          } else if (p?.state === 'final' || p?.state === 'aborted') {
            const textContent = extractText(p.message)
            if (textContent) reply = textContent
            const check = filterOutput(reply)
            if (!check.safe) {
              done(NextResponse.json({ error: check.reason }, { status: 403 }))
            } else {
              done(NextResponse.json({ reply: reply || 'Bot hat geantwortet.', sessionKey }))
            }
          } else if (p?.state === 'error') {
            done(NextResponse.json({ error: `Bot-Fehler: ${p.errorMessage ?? 'unbekannt'}` }, { status: 502 }))
          }
          return
        }
        return
      }

      // Response to our requests
      if (msg.type === 'res' && msg.id !== undefined) {
        if (!msg.ok) {
          const errMsg = (msg.error as { message?: string })?.message ?? 'Unknown error'
          done(NextResponse.json({ error: `Gateway-Fehler: ${errMsg}` }, { status: 502 }))
          return
        }

        const payload = msg.payload as Record<string, unknown> | undefined

        if (phase === 'connect') {
          // Get the default session key from hello payload if we don't have one
          if (!sessionKey) {
            const snapshot = (payload as { snapshot?: { sessionDefaults?: { mainSessionKey?: string } } })?.snapshot
            sessionKey = snapshot?.sessionDefaults?.mainSessionKey ?? 'agent:main:main'
          }
          phase = 'send'
          sendChat()
        } else if (phase === 'send') {
          phase = 'wait'
          // Waiting for chat event with state=final/aborted
        }
      }
    })

    ws.on('error', (err) => {
      done(NextResponse.json({ error: `WebSocket-Fehler: ${err.message}` }, { status: 502 }))
    })

    ws.on('close', (code, reason) => {
      if (phase === 'wait' && reply) {
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

// Output filter: block responses containing sensitive patterns
const SENSITIVE_PATTERNS = [
  /sk-ant-[a-zA-Z0-9\-_]{20,}/i,       // Anthropic API keys
  /Bearer\s+[a-zA-Z0-9\-_]{20,}/i,     // Bearer tokens
  /-----BEGIN [A-Z ]+-----/,            // Private keys / certs
  /(?:password|passwort)\s*[:=]\s*\S+/i, // Passwords in output
]

function filterOutput(text: string): { safe: boolean; reason?: string } {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, reason: 'Antwort enthält möglicherweise sensible Daten und wurde blockiert.' }
    }
  }
  return { safe: true }
}
