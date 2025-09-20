// import VideoDrawOverlay from '@/features/drawing/components/DrawingCanvas'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Webcam from 'react-webcam'

export default function PreviewVirtualCam() {
  const webcamRef = useRef<Webcam>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drawEnabled, setDrawEnabled] = useState(false);

  const pickObsVirtualCam = useCallback(async () => {
    try {
      setError(null)
      // buka permission supaya labels muncul (takpe kalau fail)
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch(() => null)
      if (s) s.getTracks().forEach(t => t.stop())

      const devices = await navigator.mediaDevices.enumerateDevices()
      const found = devices.find(
        (d) => d.kind === 'videoinput' && (d.label || '').toLowerCase().includes('obs virtual camera')
      )
      if (!found) {
        setDeviceId(null)
        setError('OBS Virtual Camera not found')
        return
      }
      setDeviceId(found.deviceId)
    } catch {
      setError('Failed to enumerate devices')
    }
  }, [])

  useEffect(() => {
    pickObsVirtualCam()
    const onChange = () => pickObsVirtualCam()
    navigator.mediaDevices.addEventListener?.('devicechange', onChange)
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', onChange)
  }, [pickObsVirtualCam])

  const constraints = useMemo<MediaTrackConstraints | undefined>(() => {
    if (!deviceId) return undefined
    return {
      deviceId: { exact: deviceId },
      // Use ideal sizing to avoid OverconstrainedError on devices that don't support 1080p
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      aspectRatio: { ideal: 16 / 9 },
      // Prefer no internal resizing by the source if supported (non-standard across browsers)
      ...({ resizeMode: 'none' } as any),
    }
  }, [deviceId])

  useEffect(() => {
    function onToggle(e: any) {
      const enabled = Boolean(e?.detail?.enabled);
      setDrawEnabled(enabled);
      window.dispatchEvent(new CustomEvent('app:draw-overlay-changed', { detail: { enabled } }))
    }
    window.addEventListener('app:toggle-draw-overlay', onToggle as any);
    return () => window.removeEventListener('app:toggle-draw-overlay', onToggle as any);
  }, []);

  // High-DPI sharp preview: mirror <video> frame into a DPR-sized canvas
  useEffect(() => {
    let ro: ResizeObserver | null = null
    let stopped = false

    const sizeCanvas = () => {
      const container = containerRef.current
      const canvas = canvasRef.current
      if (!container || !canvas) return
      const rect = container.getBoundingClientRect()
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      const targetW = Math.floor(rect.width)
      const targetH = Math.floor(rect.height)
      // Avoid collapsing during live resize; keep previous buffer to prevent flash/black
      if (targetW < 2 || targetH < 2) return
      const pxW = Math.max(1, Math.floor(targetW * dpr))
      const pxH = Math.max(1, Math.floor(targetH * dpr))
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW
        canvas.height = pxH
      }
    }

    const drawFrame = () => {
      if (stopped) return
      const video: HTMLVideoElement | null = (webcamRef.current as any)?.video || null
      const canvas = canvasRef.current
      if (!video || !canvas) { raf(); return }
      // Ensure buffer matches latest container size each frame until stable
      sizeCanvas()
      if (video.readyState < 2) {
        raf()
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) { raf(); return }
      const vw = Math.max(1, video.videoWidth || 1)
      const vh = Math.max(1, video.videoHeight || 1)
      const cw = canvas.width
      const ch = canvas.height
      if (cw < 2 || ch < 2) { raf(); return }
      // object-contain fit
      const scale = Math.min(cw / vw, ch / vh)
      const dw = Math.max(1, Math.floor(vw * scale))
      const dh = Math.max(1, Math.floor(vh * scale))
      const dx = Math.floor((cw - dw) / 2)
      const dy = Math.floor((ch - dh) / 2)
      ctx.clearRect(0, 0, cw, ch)
      try { ctx.drawImage(video, 0, 0, vw, vh, dx, dy, dw, dh) } catch { }
      raf()
    }

    const raf = () => {
      const video: HTMLVideoElement | null = (webcamRef.current as any)?.video || null
      if (video && typeof (video as any).requestVideoFrameCallback === 'function') {
        try { (video as any).requestVideoFrameCallback(() => drawFrame()) } catch { requestAnimationFrame(drawFrame) }
      } else {
        requestAnimationFrame(drawFrame)
      }
    }

    // Size immediately and over a few frames to catch late layout
    sizeCanvas()
    requestAnimationFrame(() => sizeCanvas())
    setTimeout(() => sizeCanvas(), 0)
    setTimeout(() => sizeCanvas(), 120)
    // Batch resize updates to avoid rapid buffer resets while dragging
    let resizeTimer: any = null
    ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer)
      sizeCanvas()
      resizeTimer = setTimeout(() => {
        sizeCanvas()
        resizeTimer = null
      }, 50)
    })
    if (containerRef.current) ro.observe(containerRef.current)
    const onDprOrLoad = () => sizeCanvas()
    window.addEventListener('resize', onDprOrLoad)
    window.addEventListener('load', onDprOrLoad)
    raf()
    return () => {
      stopped = true
      try { ro && ro.disconnect() } catch { }
      window.removeEventListener('resize', onDprOrLoad)
      window.removeEventListener('load', onDprOrLoad)
    }
  }, [])

  return (
    // root MESTI ada height: penuh parent + relative supaya anak absolute boleh fill
    <div ref={containerRef} className="relative h-full w-full min-h-0">
      {deviceId ? (
        <>
          <Webcam
            key={deviceId}
            ref={webcamRef}
            audio={false}
            mirrored={false}
            playsInline
            screenshotFormat="image/jpeg"
            videoConstraints={constraints}
            // fill container & scale nicely (video kept hidden; canvas renders frames)
            className="absolute inset-0 w-full h-full object-contain"
            // Try to keep rendering sharp when upscaled
            style={{ imageRendering: 'crisp-edges' as any }}
            onUserMedia={() => setError(null)}
            onUserMediaError={(e) => setError((e as any)?.message || 'Failed to access camera')}
          />
          <canvas ref={canvasRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute inset-0">
            {/* <VideoDrawOverlay enabled={drawEnabled} onRequestDisable={() => setDrawEnabled(false)} /> */}
          </div>
        </>

      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
          {error || 'Waiting for OBS Virtual Camera...'}
        </div>
      )}
    </div>
  )
}
