import { useEffect, useMemo, useRef, useState } from 'react'
import { VscChromeClose } from "react-icons/vsc"

export default function PictureInPicture() {
    const [labelToDeviceId, setLabelToDeviceId] = useState<Record<string, string>>({})
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
    const [retryTick, setRetryTick] = useState(0)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const retryCountRef = useRef(0)
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
    const [isHover, setIsHover] = useState(false)

    // Map channels to OBS virtual camera labels, same as VideoDeviceConfigurations
    const CHANNEL_TO_LABEL: Record<number, string> = useMemo(() => ({
        1: 'OBS-Camera',
        2: 'OBS-Camera2',
        3: 'OBS-Camera3',
        4: 'OBS-Camera4',
    }), [])

    type ChannelKey = 'channel-1' | 'channel-2' | 'channel-3' | 'channel-4'
    type InputType = 'live-device' | 'rtmp' | 'webrtc'
    type ChannelConfig = { inputType: InputType; deviceLabel?: string; rtmpUrl?: string; webrtcUrl?: string }

    const initialConfigs: Record<ChannelKey, ChannelConfig> = useMemo(() => ({
        'channel-1': { inputType: 'live-device', deviceLabel: 'OBS-Camera' },
        'channel-2': { inputType: 'live-device', deviceLabel: 'OBS-Camera2' },
        'channel-3': { inputType: 'live-device', deviceLabel: 'OBS-Camera3' },
        'channel-4': { inputType: 'live-device', deviceLabel: 'OBS-Camera4' },
    }), [])
    const [channelConfigs] = useState<Record<ChannelKey, ChannelConfig>>(initialConfigs)

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

                // Default to channel 1 device if none selected yet
                if (!selectedDeviceId) {
                    const ch1Label = (channelConfigs['channel-1']?.inputType === 'live-device' && channelConfigs['channel-1']?.deviceLabel)
                        ? (channelConfigs['channel-1']?.deviceLabel as string)
                        : CHANNEL_TO_LABEL[1]
                    const id = map[ch1Label]
                    if (id) setSelectedDeviceId(id)
                }
            } catch { }
        }

        refreshDevices()
        const onDeviceChange = () => refreshDevices()
        try { navigator.mediaDevices.addEventListener('devicechange', onDeviceChange) } catch { }
        return () => { cancelled = true; try { navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange) } catch { } }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const constraints = useMemo(() => ({
        video: selectedDeviceId
            ? ({ deviceId: { exact: selectedDeviceId }, width: { min: 1280, ideal: 1920, max: 3840 }, height: { min: 720, ideal: 1080, max: 2160 }, frameRate: { ideal: 60, max: 60 } } as MediaTrackConstraints)
            : ({ width: { min: 1280, ideal: 1920, max: 3840 }, height: { min: 720, ideal: 1080, max: 2160 }, frameRate: { ideal: 60, max: 60 } } as MediaTrackConstraints),
        audio: false,
    }), [selectedDeviceId])

    // Start/Restart the selected device stream explicitly
    useEffect(() => {
        let disposed = false
        async function start() {
            // Clean up any prior stream first
            try {
                const prev = mediaStream
                if (prev) prev.getTracks().forEach(t => { try { t.stop() } catch {} })
            } catch {}
            setMediaStream(null)

            const makeConstraints = (id?: string): MediaStreamConstraints => ({
                video: id ? ({ deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } } as MediaTrackConstraints) : true,
                audio: false,
            })

            // Try with exact device first
            try {
                const id = selectedDeviceId || undefined
                const s = await navigator.mediaDevices.getUserMedia(makeConstraints(id))
                if (!disposed) setMediaStream(s)
                retryCountRef.current = 0
                return
            } catch {}

            // Fallback: let the browser pick any camera, then keep it
            try {
                const s = await navigator.mediaDevices.getUserMedia(makeConstraints(undefined))
                if (!disposed) setMediaStream(s)
                retryCountRef.current = 0
            } catch {
                // Backoff retry a few times
                if (!disposed && retryCountRef.current < 3) {
                    retryCountRef.current += 1
                    setTimeout(() => { if (!disposed) start() }, 700)
                }
            }
        }
        start()
        return () => { disposed = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDeviceId])

    // Attach/detach stream to video element
    useEffect(() => {
        const el = videoRef.current
        if (!el) return
        let mounted = true
        try {
            if (mediaStream) {
                ;(el as any).srcObject = mediaStream
                const play = async () => { try { await el.play() } catch {} }
                if (el.readyState >= 2) play(); else el.onloadedmetadata = play
            } else {
                ;(el as any).srcObject = null
            }
        } catch {}
        return () => { mounted = false }
    }, [mediaStream])

    return (
        <div className='relative h-screen bg-black drag' onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
            <div className='absolute top-2 left-2 z-20 no-drag flex gap-1'>
                {([1,2,3,4] as const).map((ch) => {
                    const key = (`channel-${ch}` as ChannelKey)
                    const cfg = channelConfigs[key]
                    const targetLabel = (cfg?.inputType === 'live-device' && cfg?.deviceLabel)
                        ? (cfg.deviceLabel as string)
                        : CHANNEL_TO_LABEL[ch]
                    const deviceId = labelToDeviceId[targetLabel]
                    const isActive = !!deviceId && deviceId === selectedDeviceId
                    return (
                        <button
                          key={ch}
                          className={`h-7 px-2 rounded text-xs font-medium transition-opacity duration-200 ${isHover ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} ${isActive ? 'bg-blue-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                          onClick={() => { if (deviceId) setSelectedDeviceId(deviceId) }}
                          title={deviceId ? `Switch to ${targetLabel}` : `${targetLabel} not found`}
                        >
                          Ch {ch}
                        </button>
                    )
                })}
            </div>

            <button
                title="Close"
                className={`h-7 w-7 no-drag flex items-center justify-center text-white hover:bg-white/20 absolute top-2 right-2 z-10 rounded transition-opacity duration-200 ${isHover ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => window.ipcRenderer.invoke('pip-window:close')}
            >
                <VscChromeClose className="h-4 w-4 text-white/70 hover:text-white" />
            </button>
            <div className='absolute inset-0'>
                {mediaStream ? (
                    <video
                        key={(selectedDeviceId || 'default') + ':' + retryTick}
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div className='w-full h-full flex items-center justify-center text-white/70 text-sm'>
                        Loading camera…
                    </div>
                )}
            </div>
        </div>
    )
}