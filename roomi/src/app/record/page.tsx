'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Video, Mic, Monitor, Square, Download, Upload, ArrowLeft, Loader2, Pause, Play, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type RecorderState = 'idle' | 'preview' | 'recording' | 'paused' | 'done'
type Source = 'screen+cam' | 'screen' | 'cam'
type CamLayout = 'pip-br' | 'pip-bl' | 'pip-tr' | 'pip-tl' | 'circle-br' | 'circle-bl' | 'side-by-side' | 'cam-full'

export default function RecordPage() {
  const [state, setState] = useState<RecorderState>('idle')
  const [source, setSource] = useState<Source>('screen+cam')
  const [camLayout, setCamLayout] = useState<CamLayout>('pip-br')
  const [withMic, setWithMic] = useState(true)
  const camLayoutRef = useRef<CamLayout>('pip-br')
  useEffect(() => { camLayoutRef.current = camLayout }, [camLayout])
  const [duration, setDuration] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const blobRef = useRef<Blob | null>(null)

  // Streams
  const screenStreamRef = useRef<MediaStream | null>(null)
  const camStreamRef = useRef<MediaStream | null>(null)
  const combinedStreamRef = useRef<MediaStream | null>(null)

  // Canvas + video refs for compositing
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const screenVideoRef = useRef<HTMLVideoElement | null>(null)
  const camVideoRef = useRef<HTMLVideoElement | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  const previewAnimFrameRef = useRef<number>(0)

  // Recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const animationFrameRef = useRef<number>(0)
  const drawWorkerRef = useRef<Worker | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Timer
  useEffect(() => {
    if (state === 'recording') {
      timerIntervalRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [state])

  // Keyboard shortcuts during recording (1-8 for layouts)
  useEffect(() => {
    if (state !== 'recording' && state !== 'paused' && state !== 'preview') return
    if (source !== 'screen+cam') return
    const shortcutMap: Record<string, CamLayout> = {
      '1': 'pip-br', '2': 'pip-bl', '3': 'pip-tr', '4': 'pip-tl',
      '5': 'circle-br', '6': 'circle-bl', '7': 'side-by-side', '8': 'cam-full',
    }
    const handleKey = (e: KeyboardEvent) => {
      if (shortcutMap[e.key]) {
        e.preventDefault()
        setCamLayout(shortcutMap[e.key])
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [state, source])

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`
  }

  const cleanupStreams = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    camStreamRef.current?.getTracks().forEach(t => t.stop())
    combinedStreamRef.current?.getTracks().forEach(t => t.stop())
    screenStreamRef.current = null
    camStreamRef.current = null
    combinedStreamRef.current = null
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = 0
    }
    if (drawWorkerRef.current) {
      drawWorkerRef.current.terminate()
      drawWorkerRef.current = null
    }
  }, [])

  // Create a Web Worker that ticks at 30fps — survives tab backgrounding
  function createDrawTicker(callback: () => void) {
    const workerCode = `let id; self.onmessage = (e) => {
      if (e.data === 'start') { id = setInterval(() => self.postMessage('tick'), 1000/30); }
      else if (e.data === 'stop') { clearInterval(id); }
    };`
    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const worker = new Worker(URL.createObjectURL(blob))
    worker.onmessage = callback
    worker.postMessage('start')
    return worker
  }

  async function startPreview() {
    setError(null)
    try {
      if (source === 'screen' || source === 'screen+cam') {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: 30,
            width: { ideal: 3840 },
            height: { ideal: 2160 },
            displaySurface: 'monitor',
          },
          audio: true,
          selfBrowserSurface: 'exclude',
          surfaceSwitching: 'include',
          systemAudio: 'include',
        } as DisplayMediaStreamOptions)
        screenStreamRef.current = screenStream

        // Warn if user picked tab/window instead of entire screen
        const track = screenStream.getVideoTracks()[0]
        const settings = track.getSettings() as MediaTrackSettings & { displaySurface?: string }
        if (settings.displaySurface && settings.displaySurface !== 'monitor') {
          const msg = settings.displaySurface === 'browser'
            ? 'Du hast nur einen Browser-Tab ausgewählt. Tab-Wechsel wird NICHT aufgenommen.'
            : 'Du hast nur ein Fenster ausgewählt. Nur dieses eine Fenster wird aufgenommen.'
          setError(msg + ' Klicke „Abbrechen" und wähle neu „Ganzer Bildschirm".')
        }
      }
      if (source === 'cam' || source === 'screen+cam') {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: withMic,
        })
        camStreamRef.current = camStream
      } else if (withMic) {
        // Audio only mic
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        camStreamRef.current = micStream
      }
      setState('preview')
    } catch (e) {
      const err = e as Error
      setError(err.message === 'Permission denied'
        ? 'Zugriff verweigert. Bitte Screen-Sharing / Kamera erlauben.'
        : err.message)
      cleanupStreams()
      setState('idle')
    }
  }

  useEffect(() => {
    if (state !== 'preview' && state !== 'recording' && state !== 'paused') return
    if (screenStreamRef.current && screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current
      screenVideoRef.current.play().catch(() => {})
    }
    if (camStreamRef.current && camVideoRef.current) {
      camVideoRef.current.srcObject = camStreamRef.current
      camVideoRef.current.play().catch(() => {})
    }

    // Start live preview draw loop (small canvas showing final output)
    const previewCanvas = previewCanvasRef.current
    if (previewCanvas) {
      previewCanvas.width = 1280
      previewCanvas.height = 720
      const ctx = previewCanvas.getContext('2d', { alpha: false })
      if (ctx) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high' }
      if (ctx) {
        const drawPreview = () => {
          // Preview: mirror cam (selfie-view, feels natural)
          drawComposite(ctx, previewCanvas.width, previewCanvas.height, camLayoutRef.current, source, true)
          previewAnimFrameRef.current = requestAnimationFrame(drawPreview)
        }
        drawPreview()
      }
    }
    return () => {
      if (previewAnimFrameRef.current) cancelAnimationFrame(previewAnimFrameRef.current)
    }
  }, [state, source])

  // Shared composite drawing fn (used by both record canvas and preview canvas)
  // mirrorCam: true for preview (selfie view), false for recording (how others see you)
  function drawComposite(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, layout: CamLayout, src: Source, mirrorCam = false) {
    const screenReady = screenVideoRef.current && screenVideoRef.current.readyState >= 2
    const camReady = camVideoRef.current && camVideoRef.current.readyState >= 2

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvasW, canvasH)

    const drawCamFull = (x: number, y: number, w: number, h: number) => {
      if (!camReady) return
      const cam = camVideoRef.current!
      const camAR = cam.videoWidth / cam.videoHeight
      const boxAR = w / h
      // Cover-fit: fill box without stretching
      let dw = w, dh = h, dx = x, dy = y
      if (camAR > boxAR) {
        dh = h; dw = h * camAR; dx = x - (dw - w) / 2
      } else {
        dw = w; dh = w / camAR; dy = y - (dh - h) / 2
      }
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, w, h)
      ctx.clip()
      if (mirrorCam) {
        ctx.translate(dx + dw, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(cam, 0, dy, dw, dh)
      } else {
        ctx.drawImage(cam, dx, dy, dw, dh)
      }
      ctx.restore()
    }

    if (src === 'cam') {
      drawCamFull(0, 0, canvasW, canvasH)
      return
    }
    if (src === 'screen') {
      if (screenReady) ctx.drawImage(screenVideoRef.current!, 0, 0, canvasW, canvasH)
      return
    }

    // screen+cam
    if (layout === 'cam-full') {
      drawCamFull(0, 0, canvasW, canvasH)
    } else if (layout === 'side-by-side') {
      const halfW = canvasW / 2
      if (screenReady) ctx.drawImage(screenVideoRef.current!, 0, 0, halfW, canvasH)
      drawCamFull(halfW, 0, halfW, canvasH)
    } else {
      if (screenReady) ctx.drawImage(screenVideoRef.current!, 0, 0, canvasW, canvasH)
      if (camReady) {
        const scale = canvasW / 1920
        const padding = 32 * scale
        const boxW = (layout.startsWith('circle') ? 300 : 360) * scale
        const boxH = (layout.startsWith('circle') ? 300 : 270) * scale
        let x = 0, y = 0
        switch (layout) {
          case 'pip-br': case 'circle-br':
            x = canvasW - boxW - padding
            y = canvasH - boxH - padding
            break
          case 'pip-bl': case 'circle-bl':
            x = padding
            y = canvasH - boxH - padding
            break
          case 'pip-tr':
            x = canvasW - boxW - padding
            y = padding
            break
          case 'pip-tl':
            x = padding
            y = padding
            break
        }
        const isCircle = layout.startsWith('circle')
        ctx.save()
        ctx.beginPath()
        if (isCircle) ctx.arc(x + boxW / 2, y + boxH / 2, Math.min(boxW, boxH) / 2, 0, Math.PI * 2)
        else ctx.roundRect(x, y, boxW, boxH, 16)
        ctx.closePath()
        ctx.clip()
        const cam = camVideoRef.current!
        const camAR = cam.videoWidth / cam.videoHeight
        const boxAR = boxW / boxH
        let dw = boxW, dh = boxH, dx = x, dy = y
        if (camAR > boxAR) { dh = boxH; dw = boxH * camAR; dx = x - (dw - boxW) / 2 }
        else { dw = boxW; dh = boxW / camAR; dy = y - (dh - boxH) / 2 }
        if (mirrorCam) {
          ctx.translate(dx + dw, 0)
          ctx.scale(-1, 1)
          ctx.drawImage(cam, 0, dy, dw, dh)
        } else {
          ctx.drawImage(cam, dx, dy, dw, dh)
        }
        ctx.restore()
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
        ctx.lineWidth = 2 * scale
        ctx.beginPath()
        if (isCircle) ctx.arc(x + boxW / 2, y + boxH / 2, Math.min(boxW, boxH) / 2, 0, Math.PI * 2)
        else ctx.roundRect(x, y, boxW, boxH, 16)
        ctx.stroke()
      }
    }
  }

  function buildCombinedStream(): MediaStream {
    // For screen-only: stream is clean, no canvas needed
    if (source === 'screen' && screenStreamRef.current) {
      return screenStreamRef.current
    }

    // cam-only or screen+cam: use canvas so mirror + aspect-fit apply
    const canvas = canvasRef.current!
    if (source === 'cam') {
      const camTrack = camStreamRef.current?.getVideoTracks()[0]
      const camSettings = camTrack?.getSettings()
      canvas.width = camSettings?.width || 1920
      canvas.height = camSettings?.height || 1080
    } else {
      const screenTrack = screenStreamRef.current?.getVideoTracks()[0]
      const screenSettings = screenTrack?.getSettings()
      canvas.width = screenSettings?.width || 1920
      canvas.height = screenSettings?.height || 1080
    }
    const ctx = canvas.getContext('2d', { alpha: false })!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Use Web Worker timer to keep drawing even when tab is backgrounded
    const draw = () => {
      drawComposite(ctx, canvas.width, canvas.height, camLayoutRef.current, source, true)
    }
    draw() // initial frame
    drawWorkerRef.current = createDrawTicker(draw)

    const canvasStream = canvas.captureStream(30)
    const combined = new MediaStream()
    canvasStream.getVideoTracks().forEach(t => combined.addTrack(t))

    // Combine audio tracks
    const audioCtx = new AudioContext()
    const dest = audioCtx.createMediaStreamDestination()
    if (screenStreamRef.current && screenStreamRef.current.getAudioTracks().length) {
      const src = audioCtx.createMediaStreamSource(
        new MediaStream([screenStreamRef.current.getAudioTracks()[0]])
      )
      src.connect(dest)
    }
    if (withMic && camStreamRef.current && camStreamRef.current.getAudioTracks().length) {
      const src = audioCtx.createMediaStreamSource(
        new MediaStream([camStreamRef.current.getAudioTracks()[0]])
      )
      src.connect(dest)
    }
    dest.stream.getAudioTracks().forEach(t => combined.addTrack(t))

    return combined
  }

  async function startRecording() {
    try {
      const stream = buildCombinedStream()
      combinedStreamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm'

      // Higher bitrate for crisp quality (10 Mbps is Loom-quality for 1080p)
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 10_000_000,
        audioBitsPerSecond: 192_000,
      })
      chunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          setFileSize(chunksRef.current.reduce((acc, b) => acc + b.size, 0))
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        blobRef.current = blob
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setState('done')
        cleanupStreams()
      }

      // Stop if user stops sharing via browser UI
      if (screenStreamRef.current) {
        screenStreamRef.current.getVideoTracks()[0].addEventListener('ended', () => {
          if (recorder.state !== 'inactive') recorder.stop()
        })
      }

      recorder.start(1000) // chunk every 1s
      mediaRecorderRef.current = recorder
      setState('recording')
      setDuration(0)
      setFileSize(0)
    } catch (e) {
      const err = e as Error
      setError(err.message)
    }
  }

  function pauseRecording() {
    mediaRecorderRef.current?.pause()
    setState('paused')
  }

  function resumeRecording() {
    mediaRecorderRef.current?.resume()
    setState('recording')
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop()
    }
  }

  function downloadVideo() {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = `roomi-${Date.now()}.webm`
    a.click()
  }

  async function uploadAndShare() {
    if (!blobRef.current || uploading) return
    setUploading(true)
    setUploadProgress(0)
    setError(null)
    try {
      const shareId = Math.random().toString(36).slice(2, 10)
      const fileName = `${shareId}.webm`
      const storagePath = `public/${fileName}`

      const supabase = createClient()
      // Upload with progress via XHR (Supabase client doesn't expose progress)
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/roomi-recordings/${storagePath}`
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', url)
        xhr.setRequestHeader('Authorization', `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`)
        xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        xhr.setRequestHeader('x-upsert', 'true')
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText))
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.send(blobRef.current)
      })

      // Insert DB record
      const { error: dbErr } = await supabase.from('roomi_recordings').insert({
        share_id: shareId,
        title: `Aufnahme ${new Date().toLocaleDateString('de-DE')}`,
        duration_sec: duration,
        file_size: blobRef.current.size,
        storage_path: storagePath,
      })
      if (dbErr) throw dbErr

      const link = `${window.location.origin}/v/${shareId}`
      setShareUrl(link)
    } catch (e) {
      const err = e as Error
      setError(`Upload fehlgeschlagen: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  function copyShareLink() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setDuration(0)
    setFileSize(0)
    setShareUrl(null)
    setUploadProgress(0)
    chunksRef.current = []
    blobRef.current = null
    setState('idle')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Hidden video elements for canvas composition */}
      <video ref={screenVideoRef} className="hidden" muted playsInline />
      <video ref={camVideoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Video className="h-4 w-4 text-violet-500" />
            <span className="font-bold text-base">Roomi</span>
          </div>
          {state === 'recording' && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-mono text-red-400">REC {formatTime(duration)}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6 text-sm text-red-400">
            {error}
          </div>
        )}

        {state === 'idle' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">Neue Aufnahme</h1>
              <p className="text-sm text-zinc-500">Wähle was du aufnehmen willst.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
              {([
                { id: 'screen+cam', label: 'Screen + Cam', icon: <><Monitor className="h-5 w-5" /><Video className="h-5 w-5" /></> },
                { id: 'screen', label: 'Nur Screen', icon: <Monitor className="h-5 w-5" /> },
                { id: 'cam', label: 'Nur Cam', icon: <Video className="h-5 w-5" /> },
              ] as { id: Source; label: string; icon: React.ReactNode }[]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSource(opt.id)}
                  className={`rounded-xl p-6 flex flex-col items-center gap-3 border transition-colors ${
                    source === opt.id
                      ? 'border-violet-500/50 bg-violet-500/10'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex gap-1 text-violet-400">{opt.icon}</div>
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2">
              <input
                id="mic"
                type="checkbox"
                checked={withMic}
                onChange={e => setWithMic(e.target.checked)}
                className="accent-violet-500"
              />
              <label htmlFor="mic" className="text-sm text-zinc-400 flex items-center gap-1 cursor-pointer">
                <Mic className="h-3.5 w-3.5" /> Mikrofon aufnehmen
              </label>
            </div>

            <div className="flex justify-center">
              <Button onClick={startPreview} className="bg-violet-600 hover:bg-violet-700 text-white h-12 px-8 text-base gap-2">
                <Video className="h-4 w-4" /> Aufnahme starten
              </Button>
            </div>
            {(source === 'screen' || source === 'screen+cam') && (
              <div className="max-w-md mx-auto bg-amber-500/10 border border-amber-500/40 rounded-lg px-4 py-3 text-xs">
                <p className="font-semibold mb-2 text-amber-300">⚠️ Wichtig: Wähle „Ganzer Bildschirm"</p>
                <p className="text-amber-200/80 mb-2">
                  Wenn du „Tab" oder „Fenster" wählst, wird nur das eine Fenster aufgenommen.
                </p>
                <div className="flex items-center gap-2 text-amber-200/70 mt-2 pt-2 border-t border-amber-500/20">
                  <span className="bg-amber-500/20 px-2 py-0.5 rounded font-mono text-[10px]">Chrome/Safari</span>
                  <span>→ „Entire Screen" auswählen</span>
                </div>
              </div>
            )}
          </div>
        )}

        {state === 'preview' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Bereit?</h2>
              <p className="text-sm text-zinc-500">Live-Preview zeigt was aufgenommen wird. Layout wählen, dann auf Aufnehmen.</p>
            </div>

            <div className="max-w-2xl mx-auto rounded-xl overflow-hidden border border-zinc-800 bg-black">
              <canvas ref={previewCanvasRef} className="w-full h-auto" />
            </div>

            {source === 'screen+cam' && <LayoutPicker value={camLayout} onChange={setCamLayout} />}

            <div className="flex justify-center gap-3">
              <Button
                onClick={() => { cleanupStreams(); setState('idle') }}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 h-10 px-6"
              >
                Abbrechen
              </Button>
              <Button onClick={startRecording} className="bg-red-600 hover:bg-red-700 text-white h-10 px-6 gap-2">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" /> Aufnehmen
              </Button>
            </div>
          </div>
        )}

        {(state === 'recording' || state === 'paused') && (
          <div className="space-y-6">
            <div className="max-w-2xl mx-auto rounded-xl overflow-hidden border border-zinc-800 bg-black relative">
              <canvas ref={previewCanvasRef} className="w-full h-auto" />
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur px-3 py-1.5 rounded-full">
                {state === 'recording' ? (
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                )}
                <span className="text-xs font-mono">{formatTime(duration)}</span>
              </div>
              <div className="absolute top-3 right-3 text-[10px] text-zinc-400 bg-black/70 backdrop-blur px-2 py-1 rounded">
                {(fileSize / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>

            {source === 'screen+cam' && (
              <div>
                <div className="flex items-center justify-between mb-2 max-w-xl mx-auto px-1">
                  <p className="text-xs text-zinc-500">Layout live ändern (Shortcuts: 1-8)</p>
                  <p className="text-[10px] text-violet-400 font-mono">{camLayout}</p>
                </div>
                <LayoutPicker value={camLayout} onChange={setCamLayout} showShortcuts />
              </div>
            )}
            <div className="flex justify-center gap-3">
              {state === 'recording' ? (
                <Button onClick={pauseRecording} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 h-10 px-6 gap-2">
                  <Pause className="h-4 w-4" /> Pause
                </Button>
              ) : (
                <Button onClick={resumeRecording} className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-6 gap-2">
                  <Play className="h-4 w-4" /> Fortsetzen
                </Button>
              )}
              <Button onClick={stopRecording} className="bg-red-600 hover:bg-red-700 text-white h-10 px-6 gap-2">
                <Square className="h-4 w-4" /> Stoppen
              </Button>
            </div>
          </div>
        )}

        {state === 'done' && previewUrl && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center">Fertig</h2>
            <video
              ref={previewVideoRef}
              src={previewUrl}
              controls
              className="w-full rounded-xl bg-zinc-900"
            />

            {shareUrl && (
              <div className="bg-violet-500/5 border border-violet-500/30 rounded-xl p-4 space-y-3">
                <p className="text-xs text-violet-400 font-medium">Share-Link bereit</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-300"
                    onFocus={e => e.target.select()}
                  />
                  <Button onClick={copyShareLink} className="bg-violet-600 hover:bg-violet-700 text-white h-9 px-3 gap-1.5 text-xs">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Kopiert' : 'Kopieren'}
                  </Button>
                </div>
              </div>
            )}

            {uploading && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-400">Upload läuft...</span>
                  <span className="text-xs font-mono text-zinc-300">{uploadProgress}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded overflow-hidden">
                  <div className="h-full bg-violet-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button onClick={downloadVideo} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 h-10 px-6 gap-2 border border-zinc-700">
                <Download className="h-4 w-4" /> Download
              </Button>
              {!shareUrl && (
                <Button
                  onClick={uploadAndShare}
                  disabled={uploading}
                  className="bg-violet-600 hover:bg-violet-700 text-white h-10 px-6 gap-2 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Uploaden...' : 'Share-Link erstellen'}
                </Button>
              )}
              <Button onClick={reset} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 h-10 px-6">
                Neue Aufnahme
              </Button>
            </div>
            <p className="text-xs text-zinc-500 text-center">
              {formatTime(duration)} · {(fileSize / 1024 / 1024).toFixed(1)} MB · WebM
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

const LAYOUTS: { id: CamLayout; label: string; preview: React.ReactNode }[] = [
  { id: 'pip-br', label: 'PiP ↘', preview: <LayoutPreview position="br" shape="rect" /> },
  { id: 'pip-bl', label: 'PiP ↙', preview: <LayoutPreview position="bl" shape="rect" /> },
  { id: 'pip-tr', label: 'PiP ↗', preview: <LayoutPreview position="tr" shape="rect" /> },
  { id: 'pip-tl', label: 'PiP ↖', preview: <LayoutPreview position="tl" shape="rect" /> },
  { id: 'circle-br', label: 'Kreis ↘', preview: <LayoutPreview position="br" shape="circle" /> },
  { id: 'circle-bl', label: 'Kreis ↙', preview: <LayoutPreview position="bl" shape="circle" /> },
  { id: 'side-by-side', label: 'Neben', preview: <LayoutPreview position="side" shape="rect" /> },
  { id: 'cam-full', label: 'Nur Cam', preview: <LayoutPreview position="full" shape="rect" /> },
]

function LayoutPicker({ value, onChange, showShortcuts }: { value: CamLayout; onChange: (v: CamLayout) => void; showShortcuts?: boolean }) {
  return (
    <div>
      {!showShortcuts && <p className="text-xs text-zinc-500 mb-2 text-center">Layout</p>}
      <div className="grid grid-cols-4 gap-2 max-w-xl mx-auto">
        {LAYOUTS.map((l, i) => (
          <button
            key={l.id}
            onClick={() => onChange(l.id)}
            className={`rounded-lg p-2 border transition-colors relative ${
              value === l.id
                ? 'border-violet-500 bg-violet-500/10'
                : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
            }`}
          >
            {showShortcuts && (
              <span className="absolute top-1 right-1 text-[9px] font-mono text-zinc-500 bg-zinc-950 px-1 rounded">
                {i + 1}
              </span>
            )}
            {l.preview}
            <p className="text-[10px] text-zinc-400 mt-1">{l.label}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function LayoutPreview({ position, shape }: { position: 'br'|'bl'|'tr'|'tl'|'side'|'full'; shape: 'rect'|'circle' }) {
  if (position === 'full') {
    return <div className="h-12 bg-violet-500/30 rounded" />
  }
  if (position === 'side') {
    return (
      <div className="h-12 flex gap-0.5">
        <div className="flex-1 bg-zinc-700 rounded-l" />
        <div className="flex-1 bg-violet-500/30 rounded-r" />
      </div>
    )
  }
  const camClass = shape === 'circle' ? 'rounded-full' : 'rounded'
  const pos = {
    br: 'bottom-0.5 right-0.5',
    bl: 'bottom-0.5 left-0.5',
    tr: 'top-0.5 right-0.5',
    tl: 'top-0.5 left-0.5',
  }[position]
  return (
    <div className="h-12 bg-zinc-700 rounded relative">
      <div className={`absolute ${pos} w-4 h-3 bg-violet-500 ${camClass}`} />
    </div>
  )
}
