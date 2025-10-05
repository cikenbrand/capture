import { useEffect, useRef, useState } from "react"

function formatHhMmSs(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function SessionTimer() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isStarted, setIsStarted] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isStopped, setIsStopped] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const prevStateRef = useRef({ isStarted: false, isPaused: false, isStopped: false })

  // Load initial recording state
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await window.ipcRenderer.invoke('recording:getState')
        if (!cancelled && res?.ok) {
          const s = res.data || {}
          setIsStarted(!!s.isRecordingStarted)
          setIsPaused(!!s.isRecordingPaused)
          setIsStopped(!!s.isRecordingStopped)
          prevStateRef.current = { isStarted: !!s.isRecordingStarted, isPaused: !!s.isRecordingPaused, isStopped: !!s.isRecordingStopped }
          if (s.isRecordingStopped) setElapsedSeconds(0)
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  // Subscribe to state changes
  useEffect(() => {
    const onChanged = async () => {
      try {
        const res = await window.ipcRenderer.invoke('recording:getState')
        if (res?.ok) {
          const next = res.data || {}
          const was = prevStateRef.current
          // Detect transitions for reset/start behavior
          if (!was.isStarted && !!next.isRecordingStarted) {
            setElapsedSeconds(0)
          }
          if (!!next.isRecordingStopped) {
            setElapsedSeconds(0)
          }
          setIsStarted(!!next.isRecordingStarted)
          setIsPaused(!!next.isRecordingPaused)
          setIsStopped(!!next.isRecordingStopped)
          prevStateRef.current = { isStarted: !!next.isRecordingStarted, isPaused: !!next.isRecordingPaused, isStopped: !!next.isRecordingStopped }
        }
      } catch {}
    }
    window.addEventListener('recordingStateChanged', onChanged as any)
    return () => window.removeEventListener('recordingStateChanged', onChanged as any)
  }, [])

  // Run/pause the ticking interval
  useEffect(() => {
    const shouldRun = isStarted && !isPaused && !isStopped
    if (shouldRun) {
      if (intervalRef.current == null) {
        intervalRef.current = window.setInterval(() => {
          setElapsedSeconds((s) => s + 1)
        }, 1000)
      }
    } else {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current != null && (!isStarted || isPaused || isStopped)) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isStarted, isPaused, isStopped])

  return (
    <div className="h-[30px] w-[140px] bg-black rounded-[3px] flex items-center justify-center">
      <span className="tracking-[5px] font-bold text-lg">{formatHhMmSs(elapsedSeconds)}</span>
    </div>
  )
}