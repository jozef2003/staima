import Link from 'next/link'
import { getBriefing } from '@/lib/db'
import { LeadList } from '@/components/lead-list'
import { CriteriaPanel } from '@/components/criteria-panel'
import { ScrollToTop } from '@/components/scroll-to-top'

function isoWeekNum(weekIso: string): number {
  const d = new Date(weekIso)
  const target = new Date(d.valueOf())
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7))
  const week1 = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7)
}

function formatWeek(weekIso: string | null): string {
  if (!weekIso) return ''
  const d = new Date(weekIso)
  const day = d.toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' })
  return `KW ${isoWeekNum(weekIso)} · ${day}`
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week: requestedWeek } = await searchParams
  const { week, leads, weeks, feedback, status, error } = await getBriefing(requestedWeek)

  const subline = (() => {
    if (status === 'no-url') return 'Supabase-Credentials fehlen — Setup-Hinweise unten'
    if (status === 'no-schema') return 'Supabase OK — aber Schema noch nicht angelegt'
    if (status === 'unreachable') return 'Supabase antwortet nicht — Setup-Hinweise unten'
    if (leads.length > 0) return `${leads.length} qualifizierte Leads`
    return 'Pipeline noch nicht gelaufen — Briefing erscheint täglich morgens'
  })()

  return (
    <main className="min-h-screen bg-white">
      {/* CRK-Markenband: weiße Schrift auf Blau */}
      <header className="bg-[var(--color-crk-blue-dark)] text-white">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60 mb-2">
              <span className="font-bold text-white">CRK</span>
              <span className="text-white/40">·</span>
              Lead Briefing
            </div>
            {/* Transparenz: nach welchen Kriterien analysiert wird */}
            <CriteriaPanel />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{formatWeek(week) || 'Noch keine Daten'}</h1>
          <p className="text-sm text-[#8ed1fc] mt-1">{subline}</p>

          {weeks.length > 1 && (
            <nav className="mt-5 flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {weeks.map(w => {
                const active = w.week === week
                return (
                  <Link
                    key={w.week}
                    href={`/?week=${w.week}`}
                    scroll={false}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition ${
                      active
                        ? 'border-white bg-white text-[var(--color-crk-blue-dark)] font-semibold'
                        : 'border-white/25 text-white/80 hover:border-white/50 hover:text-white'
                    }`}
                  >
                    KW {isoWeekNum(w.week)}
                    <span className={active ? 'text-[var(--color-crk-blue)]' : 'text-white/40'}>{w.count}</span>
                  </Link>
                )
              })}
            </nav>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {status === 'no-url' && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5 text-[12px] text-amber-900 leading-relaxed">
            <div className="font-semibold text-amber-800 mb-2">Dashboard läuft, aber ohne DB-Verbindung.</div>
            <p className="mb-3">Lege eine <code className="text-amber-900 bg-amber-100 px-1 rounded">.env</code> an mit den Supabase-Credentials:</p>
            <pre className="bg-white border border-amber-200 rounded-md p-2 text-[11px] text-zinc-700 overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=https://xruzlivosammlmkrqtlo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key aus Supabase Settings → API>`}
            </pre>
          </div>
        )}

        {status === 'no-schema' && (
          <div className="mb-6 rounded-xl border border-[var(--color-crk-blue)]/30 bg-[var(--color-crk-blue-tint)] p-5 text-[12px] text-[var(--color-crk-blue-dark)] leading-relaxed">
            <div className="font-semibold mb-2">Fast da — Supabase antwortet, aber die crk_* Tabellen fehlen noch.</div>
            <p className="mb-3">
              1. Öffne den{' '}
              <a className="underline text-[var(--color-crk-blue)]" href="https://supabase.com/dashboard/project/xruzlivosammlmkrqtlo/sql/new" target="_blank" rel="noopener noreferrer">Supabase SQL Editor</a>
              <br />
              2. Kopiere den Inhalt von <code className="bg-white px-1 rounded border border-[var(--color-crk-border)]">db/0002_supabase_init.sql</code> rein
              <br />
              3. <kbd className="px-1 rounded bg-white border border-[var(--color-crk-border)]">Run</kbd> drücken
            </p>
          </div>
        )}

        {status === 'unreachable' && (
          <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 p-5 text-[12px] text-rose-900 leading-relaxed">
            <div className="font-semibold text-rose-700 mb-2">Supabase nicht erreichbar</div>
            {error && (
              <pre className="bg-white border border-rose-200 rounded-md p-2 text-[11px] text-zinc-700 overflow-x-auto">
                {error}
              </pre>
            )}
          </div>
        )}

        {leads.length === 0 && status === 'ok' && (
          <div className="rounded-xl border border-[var(--color-crk-border)] bg-zinc-50 p-10 text-center text-zinc-500 text-sm">
            Pipeline läuft täglich 06:00.
            <br />
            <span className="text-[11px] text-zinc-400">
              Manueller Lauf:{' '}
              <code className="text-zinc-600">ssh saemi@server &amp;&amp; ~/saemi/server/cron/weekly.sh</code>
            </span>
          </div>
        )}

        {leads.length > 0 && <LeadList leads={leads} initialFeedback={feedback} />}

        <footer className="mt-12 text-[11px] text-zinc-400 border-t border-[var(--color-crk-border)] pt-5">
          Sämi · CRK Lead Agent · Crawler auf Hetzner · Daten in Supabase · {leads.length === 0 ? 'kein Briefing in DB' : `${leads.length} Lead${leads.length === 1 ? '' : 's'} live`}
        </footer>
      </div>
      <ScrollToTop />
    </main>
  )
}
