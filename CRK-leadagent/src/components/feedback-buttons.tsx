'use client'

import { Phone, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'react'

type Kind = 'relevant' | 'not_relevant' | 'contacted'

const LABEL: Record<Kind, string> = {
  relevant: 'Relevant',
  not_relevant: 'Nicht relevant',
  contacted: 'Kontakt aufgenommen',
}

export function FeedbackButtons({
  leadId,
  initialKind = null,
  onChange,
}: {
  leadId: number
  initialKind?: Kind | null
  onChange?: (kind: Kind | null) => void
}) {
  const [active, setActive] = useState<Kind | null>(initialKind)
  const [pending, setPending] = useState(false)

  async function toggle(kind: Kind) {
    if (pending) return
    const isActive = active === kind
    const next = isActive ? null : kind
    const prev = active
    setPending(true)
    setActive(next)
    onChange?.(next)
    try {
      const r = await fetch('/api/feedback', {
        // Klick auf bereits aktiven Button → Toggle-off (DELETE)
        method: isActive ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isActive ? { lead_id: leadId } : { lead_id: leadId, kind }),
      })
      if (!r.ok) throw new Error(`${r.status}`)
    } catch (e) {
      console.error('feedback failed:', e)
      setActive(prev)
      onChange?.(prev)
    } finally {
      setPending(false)
    }
  }

  const cls = (kind: Kind, activeCls: string) =>
    `p-1.5 rounded-md border transition disabled:opacity-50 ${
      active === kind
        ? activeCls
        : 'border-transparent text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
    }`

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => toggle('relevant')}
        disabled={pending}
        title={LABEL.relevant}
        className={cls('relevant', 'text-emerald-600 bg-emerald-50 border-emerald-200')}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => toggle('not_relevant')}
        disabled={pending}
        title={LABEL.not_relevant}
        className={cls('not_relevant', 'text-rose-600 bg-rose-50 border-rose-200')}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => toggle('contacted')}
        disabled={pending}
        title={LABEL.contacted}
        className={cls('contacted', 'text-[var(--color-crk-blue)] bg-[var(--color-crk-blue-tint)] border-[var(--color-crk-blue)]/30')}
      >
        <Phone className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
