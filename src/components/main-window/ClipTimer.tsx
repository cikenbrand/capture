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

export default function ClipTimer() {
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [isClipStarted, setIsClipStarted] = useState(false)
    const intervalRef = useRef<number | null>(null)
    const prevStartedRef = useRef(false)

    // Load initial clip state
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await window.ipcRenderer.invoke('recording:getState')
                if (!cancelled && res?.ok) {
                    const s = res.data || {}
                    const started = !!s.isClipRecordingStarted
                    setIsClipStarted(started)
                    prevStartedRef.current = started
                    if (!started) setElapsedSeconds(0)
                }
            } catch {}
        })()
        return () => { cancelled = true }
    }, [])

    // Subscribe to global recording state changes
    useEffect(() => {
        const onChanged = async () => {
            try {
                const res = await window.ipcRenderer.invoke('recording:getState')
                if (res?.ok) {
                    const started = !!(res.data?.isClipRecordingStarted)
                    const wasStarted = prevStartedRef.current
                    if (!wasStarted && started) {
                        // clip just started -> reset and start ticking
                        setElapsedSeconds(0)
                    }
                    if (wasStarted && !started) {
                        // clip just stopped -> reset
                        setElapsedSeconds(0)
                    }
                    setIsClipStarted(started)
                    prevStartedRef.current = started
                }
            } catch {}
        }
        window.addEventListener('recordingStateChanged', onChanged as any)
        return () => window.removeEventListener('recordingStateChanged', onChanged as any)
    }, [])

    // Run/stop ticking based on clip started
    useEffect(() => {
        if (isClipStarted) {
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
            if (!isClipStarted && intervalRef.current != null) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [isClipStarted])

    return (
        <div className="h-[30px] w-[140px] bg-black rounded-[3px] flex items-center justify-center">
            <span className="tracking-[5px] font-bold text-lg">{formatHhMmSs(elapsedSeconds)}</span>
        </div>
    )
}