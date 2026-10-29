import Link from 'next/link'
import { Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: recording } = await supabase
    .from('roomi_recordings')
    .select('*')
    .eq('share_id', id)
    .single()

  if (!recording) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold mb-2">Video nicht gefunden</p>
          <Link href="/" className="text-xs text-violet-400 hover:text-violet-300">Zur Startseite</Link>
        </div>
      </div>
    )
  }

  // Increment view count (fire and forget)
  supabase.from('roomi_recordings')
    .update({ view_count: (recording.view_count || 0) + 1 })
    .eq('share_id', id)
    .then(() => {})

  const videoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/roomi-recordings/${recording.storage_path}`

  const minutes = Math.floor((recording.duration_sec || 0) / 60)
  const seconds = (recording.duration_sec || 0) % 60
  const durationText = minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`
  const mbSize = ((recording.file_size || 0) / 1024 / 1024).toFixed(1)

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Video className="h-5 w-5 text-violet-500" />
          <span className="font-bold">Roomi</span>
        </Link>
        <Link
          href="/record"
          className="text-xs text-zinc-400 hover:text-white transition-colors"
        >
          Eigene Aufnahme →
        </Link>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-lg font-semibold">{recording.title || 'Aufnahme'}</h1>
          <p className="text-xs text-zinc-500 mt-1">
            {durationText} · {mbSize} MB · {new Date(recording.created_at).toLocaleDateString('de-DE')}
          </p>
        </div>

        <video
          src={videoUrl}
          controls
          autoPlay
          className="w-full rounded-xl bg-black aspect-video"
        />

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] text-zinc-600">
            {(recording.view_count || 0) + 1} Aufrufe
          </p>
          <a
            href={videoUrl}
            download
            className="text-xs text-violet-400 hover:text-violet-300"
          >
            Download
          </a>
        </div>
      </main>
    </div>
  )
}
