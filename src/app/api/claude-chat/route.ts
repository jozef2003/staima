import { NextRequest, NextResponse } from 'next/server'

// Chat with a Claude Code bot via Telegram Bot API
// The bot must be paired with the Telegram user ID configured here
// Uses sendMessage + getUpdates to relay messages

const CLAUDE_BOT_TOKENS: Record<string, { token: string; ownerChatId: string }> = {
  // server_ip -> bot config
  '94.130.99.75': {
    token: '8020042068:AAHNYV-jn-RsfDSmxhBjuM3i0tK4-0IjJgU',
    ownerChatId: '8669039113', // David's chat ID (paired)
  },
}

export async function POST(req: NextRequest) {
  try {
    const { serverIp, message } = await req.json()
    if (!serverIp || !message) {
      return NextResponse.json({ error: 'serverIp and message required' }, { status: 400 })
    }

    const config = CLAUDE_BOT_TOKENS[serverIp]
    if (!config) {
      return NextResponse.json({ error: `No bot config for server ${serverIp}` }, { status: 404 })
    }

    // Get latest update ID (so we only see NEW responses)
    const preUpdates = await fetch(
      `https://api.telegram.org/bot${config.token}/getUpdates?offset=-1&limit=1`,
      { cache: 'no-store' }
    ).then(r => r.json())
    const lastUpdateId = preUpdates.result?.[0]?.update_id || 0

    // Send the message AS the paired user to the bot
    // Since we can't impersonate, we use a different approach:
    // Dashboard admin sends directly to the bot's owner chat, bot responds
    const sendRes = await fetch(
      `https://api.telegram.org/bot${config.token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.ownerChatId,
          text: `[Dashboard-Test] ${message}`,
        }),
      }
    ).then(r => r.json())

    if (!sendRes.ok) {
      return NextResponse.json({
        response: `ℹ️ Um vom Dashboard zu chatten: Schicke Nachrichten direkt an @Alfred4everBot in Telegram. Der Bot ist gepaired und bereit.`,
      })
    }

    // Poll for bot's response
    const startTime = Date.now()
    let response = ''
    while (Date.now() - startTime < 45000) {
      await new Promise(r => setTimeout(r, 2000))
      const updates = await fetch(
        `https://api.telegram.org/bot${config.token}/getUpdates?offset=${lastUpdateId + 1}&timeout=2`,
        { cache: 'no-store' }
      ).then(r => r.json())

      for (const upd of updates.result || []) {
        // Look for bot messages (from_me or channel posts)
        const msg = upd.message || upd.channel_post
        if (msg && msg.chat?.id?.toString() === config.ownerChatId && msg.from?.is_bot) {
          response = msg.text || ''
          break
        }
      }
      if (response) break
    }

    return NextResponse.json({
      response: response || `ℹ️ Nachricht an Bot geschickt. Antworten kommen in Telegram @Alfred4everBot.`,
    })
  } catch (error) {
    const err = error as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
