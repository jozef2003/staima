'use client'

import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Send, Bot as BotIcon, Loader2, MessageSquare, ExternalLink } from 'lucide-react'
import type { Bot } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

function BotSelector({ bots, selected, onSelect }: {
  bots: Bot[]
  selected: Bot | null
  onSelect: (bot: Bot) => void
}) {
  const chatBots = bots.filter(b => b.gateway_url && b.gateway_token)

  if (chatBots.length === 0) {
    return (
      <Card className="p-6 text-center border-dashed">
        <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Kein Bot mit Gateway konfiguriert.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Setze gateway_url + gateway_token im Bot-Setup.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {chatBots.map(bot => (
        <button
          key={bot.id}
          onClick={() => onSelect(bot)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all',
            selected?.id === bot.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card hover:border-primary/40 text-foreground'
          )}
        >
          <div className={cn(
            'w-2 h-2 rounded-full',
            bot.status === 'online' ? 'bg-emerald-500' : 'bg-amber-500'
          )} />
          {bot.bot_name}
          <Badge variant="secondary" className="text-[10px]">{bot.ai_model}</Badge>
        </button>
      ))}
    </div>
  )
}

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      )}>
        {isUser ? 'J' : <BotIcon className="h-3.5 w-3.5" />}
      </div>
      <div className={cn(
        'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
        isUser
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : 'bg-muted text-foreground rounded-tl-sm'
      )}>
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        <p className={cn(
          'text-[10px] mt-1 opacity-60',
          isUser ? 'text-right' : 'text-left'
        )}>
          {message.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

export function ClientChat({ bots }: { bots: Bot[] }) {
  const [selectedBot, setSelectedBot] = useState<Bot | null>(
    bots.find(b => b.gateway_url && b.gateway_token) ?? null
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset chat when bot changes
  useEffect(() => {
    setMessages([])
    setSessionKey(null)
  }, [selectedBot?.id])

  async function sendMessage() {
    if (!input.trim() || !selectedBot || loading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/bot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayUrl: selectedBot.gateway_url,
          gatewayToken: selectedBot.gateway_token,
          message: userMsg.content,
          sessionKey,
        }),
      })

      const data = await res.json()

      if (data.sessionKey && !sessionKey) setSessionKey(data.sessionKey)

      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply ?? data.error ?? 'Keine Antwort.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, botMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Verbindungsfehler zum Bot.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="space-y-4">
      {/* Bot Selector */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Bot auswählen</p>
        <BotSelector bots={bots} selected={selectedBot} onSelect={setSelectedBot} />
      </div>

      {selectedBot && (
        <Card className="flex flex-col bg-card border-border" style={{ height: 520 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                selectedBot.status === 'online' ? 'bg-emerald-500' : 'bg-amber-500'
              )} />
              <span className="font-medium text-sm">{selectedBot.bot_name}</span>
              <span className="text-xs text-muted-foreground font-mono">{selectedBot.ai_model}</span>
            </div>
            <a
              href={`${selectedBot.gateway_url}/#token=${selectedBot.gateway_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              OpenClaw
            </a>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <BotIcon className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Schreib etwas um den Bot zu testen</p>
                <p className="text-xs text-muted-foreground/60 mt-1">z.B. „Was war meine letzte E-Mail?"</p>
              </div>
            )}
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <BotIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border shrink-0">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={`Nachricht an ${selectedBot.bot_name}…`}
                rows={1}
                className="flex-1 resize-none bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                style={{ minHeight: 40, maxHeight: 120 }}
                disabled={loading}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-center">Enter = Senden · Shift+Enter = Neue Zeile</p>
          </div>
        </Card>
      )}
    </div>
  )
}
