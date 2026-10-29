import Link from 'next/link'
import { Video, Monitor, Mic, Download, Zap, Shield, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-violet-500" />
          <span className="font-bold">Roomi</span>
        </div>
        <Link href="/record">
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white h-8 px-4 text-xs">
            Jetzt aufnehmen
          </Button>
        </Link>
      </nav>

      <section className="max-w-3xl mx-auto px-4 pt-16 sm:pt-24 pb-16 text-center">
        <p className="text-xs text-violet-400 font-medium tracking-wide uppercase mb-4">
          Loom-Alternative · 100% kostenlos · Kein Wasserzeichen
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 leading-tight">
          Screen & Face Cam aufnehmen.
        </h1>
        <p className="text-base text-zinc-400 max-w-lg mx-auto mb-8">
          Bildschirm + Webcam + Mikrofon in einem Video. Direkt im Browser, ohne Install,
          ohne Zeit-Limit, ohne Abo.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/record">
            <Button className="bg-violet-600 hover:bg-violet-700 text-white h-10 px-6 text-sm gap-2">
              Aufnehmen starten <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#features">
            <Button className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white h-10 px-6 text-sm border border-zinc-700">
              Features
            </Button>
          </a>
        </div>
        <p className="text-[11px] text-zinc-600 mt-6">
          Kein Account nötig zum Starten. Teilen via Share-Link (bald).
        </p>
      </section>

      <section id="features" className="border-y border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto px-4 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <Feature icon={<Monitor />} title="Screen + Cam" desc="Bildschirm und Webcam gleichzeitig — Picture-in-Picture Overlay." />
          <Feature icon={<Mic />} title="Mit Audio" desc="System-Sound + Mikrofon kombiniert in einem Track." />
          <Feature icon={<Download />} title="Download" desc="WebM direkt auf dein Gerät. Kein Upload nötig." />
          <Feature icon={<Shield />} title="Privat" desc="Alles läuft im Browser. Videos verlassen deinen Rechner nur wenn du willst." />
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-2">Warum Roomi?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 text-left">
          <Comparison
            name="Loom Free"
            items={[
              { ok: false, text: '5 Min Zeit-Limit' },
              { ok: false, text: 'Wasserzeichen' },
              { ok: false, text: '25 Videos max' },
            ]}
          />
          <Comparison
            name="Roomi"
            highlighted
            items={[
              { ok: true, text: 'Unlimitierte Zeit' },
              { ok: true, text: 'Kein Wasserzeichen' },
              { ok: true, text: 'Unlimitierte Videos' },
            ]}
          />
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-3">Bereit?</h2>
        <Link href="/record">
          <Button className="bg-violet-600 hover:bg-violet-700 text-white h-10 px-6 text-sm gap-2 mt-4">
            Kostenlos starten <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>

      <footer className="border-t border-zinc-800/50">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between text-[11px] text-zinc-600">
          <div className="flex items-center gap-1.5">
            <Video className="h-3 w-3 text-violet-500" />
            Roomi by Staima
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-zinc-400">Impressum</a>
            <a href="#" className="hover:text-zinc-400">Datenschutz</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <p className="text-xs text-zinc-500">{desc}</p>
    </div>
  )
}

function Comparison({ name, items, highlighted }: {
  name: string
  items: { ok: boolean; text: string }[]
  highlighted?: boolean
}) {
  return (
    <div className={`rounded-xl p-5 ${
      highlighted
        ? 'bg-violet-500/5 border border-violet-500/30'
        : 'bg-zinc-900 border border-zinc-800'
    }`}>
      <h3 className={`font-semibold text-sm mb-3 ${highlighted ? 'text-violet-400' : 'text-zinc-400'}`}>{name}</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className={item.ok ? 'text-emerald-500' : 'text-red-500'}>
              {item.ok ? '✓' : '✗'}
            </span>
            <span className={item.ok ? 'text-zinc-200' : 'text-zinc-500 line-through'}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
