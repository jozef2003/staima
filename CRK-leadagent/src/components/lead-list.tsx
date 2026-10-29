'use client'

import { useMemo, useState } from 'react'
import {
  MapPin, Calendar, ExternalLink, Building2, Phone, Lightbulb,
  AlertTriangle, UserRound, Linkedin, BadgeCheck, ArrowDownUp, Check,
} from 'lucide-react'
import type { Lead, FeedbackKind } from '@/lib/db'
import { FeedbackButtons } from '@/components/feedback-buttons'

// Potenzial-Badges — auf der Marke (blau) statt bunt: Hoch = CRK-Blau gefüllt.
const POTENZIAL_STYLE: Record<string, string> = {
  Hoch: 'bg-[var(--color-crk-blue)] text-white border-[var(--color-crk-blue)]',
  Mittel: 'bg-[var(--color-crk-blue-tint)] text-[var(--color-crk-blue)] border-[var(--color-crk-blue)]/25',
  Tief: 'bg-zinc-100 text-zinc-500 border-zinc-200',
}

type FeedbackUi = 'relevant' | 'not_relevant' | 'contacted'
type PotFilter = 'Alle' | 'Hoch' | 'Mittel' | 'Tief'
type Sort = 'potenzial' | 'datum'

const POT_FILTERS: PotFilter[] = ['Alle', 'Hoch', 'Mittel', 'Tief']
const POT_ORDER: Record<string, number> = { Hoch: 0, Mittel: 1, Tief: 2 }

function chip(active: boolean) {
  return `shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] transition ${
    active
      ? 'border-[var(--color-crk-blue)] bg-[var(--color-crk-blue)] text-white font-semibold'
      : 'border-[var(--color-crk-border)] bg-white text-zinc-500 hover:border-[var(--color-crk-blue)]/40 hover:text-[var(--color-crk-blue)]'
  }`
}

export function LeadList({
  leads,
  initialFeedback,
}: {
  leads: Lead[]
  initialFeedback: Record<number, FeedbackKind>
}) {
  const [pot, setPot] = useState<PotFilter>('Alle')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [sort, setSort] = useState<Sort>('potenzial')
  // Lokale Kopie, damit "nur offene" live auf Button-Klicks reagiert
  const [feedback, setFeedback] = useState<Record<number, FeedbackKind>>(initialFeedback)

  const visible = useMemo(() => {
    let out = leads.filter(l => {
      if (pot !== 'Alle' && l.potenzial !== pot) return false
      if (onlyOpen && feedback[l.id]) return false
      return true
    })
    out = [...out].sort((a, b) =>
      sort === 'datum'
        ? (b.datum ?? '').localeCompare(a.datum ?? '')
        : (POT_ORDER[a.potenzial ?? 'Tief'] ?? 3) - (POT_ORDER[b.potenzial ?? 'Tief'] ?? 3),
    )
    return out
  }, [leads, pot, onlyOpen, sort, feedback])

  return (
    <>
      {/* Eine Filter-Reihe: Potenzial · nur offene · Sortierung */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {POT_FILTERS.map(p => (
          <button key={p} onClick={() => setPot(p)} className={chip(pot === p)}>
            {p}
            {p !== 'Alle' && (
              <span className={pot === p ? 'text-white/70' : 'text-zinc-400'}>
                {leads.filter(l => l.potenzial === p).length}
              </span>
            )}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-[var(--color-crk-border)] shrink-0" />
        <button onClick={() => setOnlyOpen(o => !o)} className={chip(onlyOpen)} title="Bearbeitete Leads ausblenden">
          {onlyOpen && <Check className="h-3 w-3" />}
          Nur offene
        </button>
        <button
          onClick={() => setSort(sort === 'potenzial' ? 'datum' : 'potenzial')}
          className={chip(sort === 'datum')}
          title="Sortierung umschalten"
        >
          <ArrowDownUp className="h-3 w-3" />
          {sort === 'datum' ? 'Datum' : 'Potenzial'}
        </button>
      </div>

      <div className="mb-3 text-[11px] text-zinc-400">
        {visible.length === leads.length
          ? `${leads.length} Leads`
          : `${visible.length} von ${leads.length} Leads`}
      </div>

      {visible.length === 0 && (
        <div className="rounded-xl border border-[var(--color-crk-border)] bg-zinc-50 p-8 text-center text-zinc-500 text-sm">
          Keine Leads mit diesem Filter.
        </div>
      )}

      <ul className="space-y-3">
        {visible.map(lead => (
          <li
            key={lead.id}
            className="rounded-xl border border-[var(--color-crk-border)] bg-white p-5 shadow-sm hover:border-[var(--color-crk-blue)]/40 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-[var(--color-crk-ink)] leading-tight">{lead.projekt}</h2>
                <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1 flex-wrap">
                  {lead.standort && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {lead.standort}</span>}
                  {lead.projekttyp && (<><span className="text-zinc-300">·</span><span>{lead.projekttyp}</span></>)}
                  {lead.phase && (<><span className="text-zinc-300">·</span><span>{lead.phase}</span></>)}
                </div>
              </div>
              {lead.potenzial && (
                <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md border ${POTENZIAL_STYLE[lead.potenzial]}`}>
                  {lead.potenzial}
                </span>
              )}
            </div>

            {lead.zusammenfassung && (
              <p className="text-sm text-zinc-700 leading-relaxed mb-3">{lead.zusammenfassung}</p>
            )}

            {lead.kommunikationsbedarf && (
              <div className="rounded-lg bg-[var(--color-crk-blue-tint)] border border-[var(--color-crk-blue)]/20 p-3 mb-3">
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-crk-blue)] font-semibold mb-1">Kommunikationsbedarf</p>
                <p className="text-sm text-[var(--color-crk-blue-dark)]">{lead.kommunikationsbedarf}</p>
              </div>
            )}

            {(lead.bauherr || lead.ansprechpartner || lead.kontakt_hinweis || lead.aufhaenger) && (
              <div className="rounded-lg bg-zinc-50 border border-[var(--color-crk-border)] p-3 mb-3 space-y-1.5">
                {lead.bauherr && (
                  <div className="flex items-start gap-2 text-[13px] text-zinc-700">
                    <Building2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-zinc-400" />
                    <span>
                      {lead.bauherr}
                      {lead.bauherr_website && (
                        <a href={lead.bauherr_website.startsWith('http') ? lead.bauherr_website : `https://${lead.bauherr_website}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-[var(--color-crk-blue)] hover:underline inline-flex items-center gap-1">
                          Website <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </span>
                  </div>
                )}
                {lead.ansprechpartner && (
                  <div className="flex items-start gap-2 text-[13px] text-zinc-700">
                    <UserRound className="h-3.5 w-3.5 mt-0.5 shrink-0 text-zinc-400" />
                    <span>
                      {lead.ansprechpartner}
                      {lead.ansprechpartner_rolle && <span className="text-zinc-500"> · {lead.ansprechpartner_rolle}</span>}
                      {lead.linkedin && (
                        <a href={lead.linkedin.startsWith('http') ? lead.linkedin : `https://${lead.linkedin}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-[var(--color-crk-blue)] hover:underline inline-flex items-center gap-1">
                          <Linkedin className="h-3 w-3" />
                        </a>
                      )}
                    </span>
                  </div>
                )}
                {lead.kontakt_hinweis && (
                  <div className="flex items-start gap-2 text-[13px] text-zinc-600">
                    <Phone className="h-3.5 w-3.5 mt-0.5 shrink-0 text-zinc-400" />
                    <span>
                      {lead.kontakt_hinweis}
                      {lead.kontakt_quelle && (
                        <a href={lead.kontakt_quelle.startsWith('http') ? lead.kontakt_quelle : `https://${lead.kontakt_quelle}`} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-zinc-400 hover:text-[var(--color-crk-blue)] inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </span>
                  </div>
                )}
                {lead.aufhaenger && (
                  <div className="flex items-start gap-2 text-[13px] text-[var(--color-crk-blue-dark)]">
                    <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--color-crk-blue)]" />
                    <span>{lead.aufhaenger}</span>
                  </div>
                )}
                {lead.verify_note && (
                  <div className="flex items-start gap-2 text-[11px] text-zinc-400 pt-0.5">
                    <BadgeCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-zinc-300" />
                    <span>{lead.verify_note}</span>
                  </div>
                )}
              </div>
            )}

            {(lead.recherche_hinweis || lead.confidence === 'tief') && (
              <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{lead.recherche_hinweis || 'Angaben unvollständig — Nachrecherche empfohlen'}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] flex-wrap gap-2 pt-1">
              <div className="text-zinc-500">
                {lead.akteure && <span className="text-zinc-600">{lead.akteure}</span>}
                {lead.quelle && lead.quelle_url && (
                  <>
                    <span className="mx-2 text-zinc-300">·</span>
                    <a href={lead.quelle_url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-crk-blue)] hover:underline inline-flex items-center gap-1">
                      {lead.quelle} <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
                {lead.datum && (
                  <>
                    <span className="mx-2 text-zinc-300">·</span>
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {lead.datum.slice(0, 10)}</span>
                  </>
                )}
              </div>
              <FeedbackButtons
                leadId={lead.id}
                initialKind={(feedback[lead.id] as FeedbackUi) ?? null}
                onChange={k =>
                  setFeedback(prev => {
                    const next = { ...prev }
                    if (k) next[lead.id] = k
                    else delete next[lead.id]
                    return next
                  })
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
