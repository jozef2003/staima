'use client'

import { useState } from 'react'

/**
 * Transparenz-Panel: macht sichtbar, nach welchen Kriterien Sämi jeden Artikel
 * analysiert (Relevanz-Gate → Potenzial-Scoring → Pipeline). Quelle der Wahrheit:
 * server/pipeline/{classify,score}.py + docs/briefing.md.
 */
export function CriteriaPanel() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-[12px] text-white/90 transition hover:border-white/60 hover:text-white"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        Bewertungskriterien
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Kopf */}
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-crk-border)] px-6 py-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-crk-blue)]">
                  Transparenz
                </div>
                <h2 className="mt-1 text-lg font-bold text-zinc-900">Nach welchen Kriterien Sämi analysiert</h2>
                <p className="mt-0.5 text-[12px] text-zinc-500">
                  Jeder Artikel durchläuft dieselben Schritte. Nichts ist Zufall.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Schliessen"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6">
              {/* Pipeline */}
              <Section step="0" title="Wie ein Artikel zum Lead wird">
                <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-[12px] text-zinc-600">
                  {['Crawl (Teaser)', 'Keyword-Gate', 'Volltext holen', 'Relevanz (KI)', 'Potenzial (KI)', 'Web-Verifikation', 'Dedup'].map((s, i, a) => (
                    <span key={s} className="inline-flex items-center gap-1">
                      <span className="rounded-md bg-[var(--color-crk-blue-tint)] px-2 py-1 font-medium text-[var(--color-crk-blue-dark)]">{s}</span>
                      {i < a.length - 1 && <span className="text-zinc-300">→</span>}
                    </span>
                  ))}
                </ol>
              </Section>

              {/* Relevanz */}
              <Section step="1" title="Relevanz-Gate — ist es überhaupt ein Bauprojekt?">
                <Crit good label="Relevant" items={[
                  'Konkretes Schweizer Immobilien-/Bauprojekt',
                  'Erkennbarer Standort (CH-Gemeinde)',
                  'Erkennbarer Bauherr / Investor / Entwickler',
                  'Sanierung, Neubau, Areal-Entwicklung, Leerkündigung, Altlasten, Mitwirkungsverfahren oder öffentliche Diskussion',
                ]} />
                <Crit bad label="Nicht relevant" items={[
                  'Marktberichte, Zinsthemen, Wirtschaftslage allgemein',
                  'Reine Architektur-Awards / Designkritiken',
                  'Ausländische Projekte',
                  'Personalrochaden ohne Projektbezug',
                  'Allgemeine Politik / Recht',
                ]} />
              </Section>

              {/* Potenzial */}
              <Section step="2" title="Potenzial — braucht der Bauherr CRK-Kommunikation?">
                <Crit good label="Potenzial HOCH" items={[
                  'Kommunikationsbedarf offensichtlich & dringend',
                  'Noch keine Kommunikationsbegleitung sichtbar',
                  'Politisch, gesellschaftlich oder medial relevant',
                  'Akzeptanzrisiken (Widerstände, Einsprachen, Proteste)',
                  'Mitwirkungsverfahren / Volksabstimmung steht an',
                  'Frühe Kontaktaufnahme = Wettbewerbsvorteil',
                ]} />
                <Crit bad label="Potenzial TIEF" items={[
                  'Hat erkennbar bereits Agentur / Kommunikationsabteilung',
                  'Standard-Bauvorhaben ohne öffentliche Komponente',
                  'Bereits lange im Bau — Kommunikationsphase vorbei',
                ]} />
              </Section>

              {/* Dimensionen */}
              <Section step="3" title="Wie jeder Lead eingeordnet wird">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Tags title="Lead-Typ" tags={['Ent-/Wiedervermietung', 'Areal-Entwicklung', 'Leerkündigung', 'Belasteter Standort']} />
                  <Tags title="Projektphase" tags={['Planung', 'Bewilligung', 'Ausschreibung', 'Bau', 'Lancierung']} />
                  <Tags title="Potenzial" tags={['Hoch', 'Mittel', 'Tief']} />
                  <Tags title="Datenlage (Confidence)" tags={['hoch', 'mittel', 'tief']} />
                </div>
              </Section>

              <p className="border-t border-[var(--color-crk-border)] pt-4 text-[11px] leading-relaxed text-zinc-400">
                Sämi bereitet nur vor — wer kontaktiert wird, entscheidet CRK BD. Jeder Lead trägt
                Quelle, Datum, Direkt-Link und eine konkrete Begründung (kein generisches Blabla).
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-crk-blue-dark)] text-[11px] font-bold text-white">{step}</span>
        <h3 className="text-[13px] font-bold text-zinc-900">{title}</h3>
      </div>
      <div className="space-y-2.5 pl-7">{children}</div>
    </section>
  )
}

function Crit({ good, bad, label, items }: { good?: boolean; bad?: boolean; label: string; items: string[] }) {
  return (
    <div>
      <div className={`mb-1 inline-flex items-center gap-1.5 text-[12px] font-semibold ${good ? 'text-emerald-700' : 'text-rose-600'}`}>
        <span>{good ? '✓' : '✕'}</span>{label}
      </div>
      <ul className="space-y-1">
        {items.map(t => (
          <li key={t} className="flex gap-2 text-[12.5px] leading-snug text-zinc-600">
            <span className={good ? 'text-emerald-400' : 'text-rose-300'}>•</span>{t}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Tags({ title, tags }: { title: string; tags: string[] }) {
  return (
    <div className="rounded-lg border border-[var(--color-crk-border)] bg-zinc-50 p-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(t => (
          <span key={t} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-zinc-600 ring-1 ring-[var(--color-crk-border)]">{t}</span>
        ))}
      </div>
    </div>
  )
}
