'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        const from = new URLSearchParams(window.location.search).get('from')
        window.location.href = from && from.startsWith('/') ? from : '/'
        return
      }
      setError('Falsches Passwort. Bitte nochmal.')
    } catch {
      setError('Verbindungsfehler — bitte erneut versuchen.')
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-crk-blue-tint)] px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-[var(--color-crk-border)] shadow-xl shadow-[#0a2540]/10 overflow-hidden">
          {/* Markenband */}
          <div className="bg-[var(--color-crk-blue-dark)] px-8 pt-6 pb-7">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/55">
              <span className="font-bold text-white">CRK</span>
              <span className="text-white/35">·</span>
              Lead Briefing
            </div>
            <h1 className="text-white text-[22px] font-bold mt-2 leading-tight">Geschützter Bereich</h1>
            <p className="text-[13px] text-[#8ec5ff] mt-1">Bitte Passwort eingeben, um fortzufahren.</p>
          </div>

          {/* Formular */}
          <form onSubmit={submit} className="px-8 py-7">
            <label htmlFor="pw" className="block text-[13px] font-semibold text-[var(--color-crk-ink)] mb-1.5">
              Passwort
            </label>
            <input
              id="pw"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full rounded-lg border border-[var(--color-crk-border)] px-3.5 py-2.5 text-sm text-[var(--color-crk-ink)] outline-none transition focus:border-[var(--color-crk-blue)] focus:ring-4 focus:ring-[var(--color-crk-blue)]/12"
            />
            {error && <p className="mt-2.5 text-[12.5px] text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="mt-5 w-full rounded-lg bg-[var(--color-crk-blue)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-crk-blue-dark)] disabled:opacity-50"
            >
              {loading ? 'Anmelden …' : 'Anmelden'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-[11px] text-zinc-400">CRK Lead Agent · geschützter Zugang</p>
      </div>
    </main>
  )
}
