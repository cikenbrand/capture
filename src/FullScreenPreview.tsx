import { useEffect, useMemo, useRef, useState } from 'react'

export default function FullScreenPreview() {
    const params = new URLSearchParams(location.search)
    const channelStr = params.get('channel') || '1'
    const channel = Math.max(1, Math.min(4, Number(channelStr) || 1))

    const [labelToDeviceId, setLabelToDeviceId] = useState<Record<string, string>>({})
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)

    const CHANNEL_TO_LABEL: Record<number, string> = useMemo(() => ({
        1: 'OBS-Camera',
        2: 'OBS-Camera2',
        3: 'OBS-Camera3',
        4: 'OBS-Camera4',
    }), [])

    useEffect(() => {
        let cancelled = false

        async function ensureDeviceLabelsAvailable() {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices()
                const hasLabels = devices.some(d => (d.label ?? '').trim().length > 0)
                if (!hasLabels) {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                        try { stream.getTracks().forEach(t => t.stop()) } catch { }
                    } catch { }
                }
            } catch { }
        }

        async function refreshDevices() {
            try {
                await ensureDeviceLabelsAvailable()
                const list = await navigator.mediaDevices.enumerateDevices()
                if (cancelled) return
                const map: Record<string, string> = {}
                for (const d of list) {
                    if (d.kind !== 'videoinput') continue
                    const label = (d.label ?? '').trim()
                    if (!label) continue
                    map[label] = d.deviceId
                }
                setLabelToDeviceId(map)

                const targetLabel = CHANNEL_TO_LABEL[channel]
                const id = map[targetLabel]
                if (id) setSelectedDeviceId(id)
            } catch { }
        }

        refreshDevices()
        const onDeviceChange = () => refreshDevices()
        try { navigator.mediaDevices.addEventListener('devicechange', onDeviceChange) } catch { }
        return () => { cancelled = true; try { navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange) } catch { } }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channel])

    useEffect(() => {
        let disposed = false
        async function start() {
            try {
                const prev = mediaStream
                if (prev) prev.getTracks().forEach(t => { try { t.stop() } catch {} })
            } catch {}
            setMediaStream(null)

            const preferredVideo: MediaTrackConstraints = {
                width: { min: 1280, ideal: 1920, max: 3840 },
                height: { min: 720, ideal: 1080, max: 2160 },
                frameRate: { ideal: 60, max: 60 },
            }
            const makeConstraints = (id?: string): MediaStreamConstraints => ({
                video: id ? ({ deviceId: { exact: id }, ...preferredVideo } as MediaTrackConstraints) : preferredVideo,
                audio: false,
            })

            try {
                const id = selectedDeviceId || undefined
                const s = await navigator.mediaDevices.getUserMedia(makeConstraints(id))
                if (!disposed) setMediaStream(s)
                return
            } catch {}

            try {
                const s = await navigator.mediaDevices.getUserMedia(makeConstraints(undefined))
                if (!disposed) setMediaStream(s)
            } catch {}
        }
        start()
        return () => { disposed = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDeviceId])

    useEffect(() => {
        const el = videoRef.current
        if (!el) return
        try {
            if (mediaStream) {
                ;(el as any).srcObject = mediaStream
                const play = async () => { try { await el.play() } catch {} }
                if (el.readyState >= 2) play(); else el.onloadedmetadata = play
            } else {
                ;(el as any).srcObject = null
            }
        } catch {}
    }, [mediaStream])

    return (
        <div className='w-screen h-screen bg-black'>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'auto' }}
            />
        </div>
    )
}


