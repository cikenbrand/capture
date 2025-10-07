import { useEffect, useMemo, useRef, useState } from 'react'
import Webcam from 'react-webcam'
import { VscChromeMinimize, VscChromeClose } from "react-icons/vsc"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'

type MediaDevice = { deviceId: string; label: string }

export default function PictureInPicture() {
    const [devices, setDevices] = useState<MediaDevice[]>([])
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
    const videoRef = useRef<Webcam | null>(null)

    useEffect(() => {
        let cancelled = false
        async function load() {
            try {
                const list = await navigator.mediaDevices.enumerateDevices()
                const cams = list.filter(d => d.kind === 'videoinput').map(d => ({ deviceId: d.deviceId, label: d.label }))
                if (!cancelled) {
                    setDevices(cams)
                    if (!selectedDeviceId && cams.length) setSelectedDeviceId(cams[0].deviceId)
                }
            } catch { }
        }
        load()
        const onDeviceChange = () => load()
        try { navigator.mediaDevices.addEventListener('devicechange', onDeviceChange) } catch { }
        return () => { cancelled = true; try { navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange) } catch { } }
    }, [selectedDeviceId])

    const constraints = useMemo(() => ({ video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true, audio: false }), [selectedDeviceId])

    // Stop previous stream when switching device to ensure react-webcam reinitializes
    useEffect(() => {
        try {
            const stream = (videoRef.current?.video as any)?.srcObject as MediaStream | null
            if (stream) stream.getTracks().forEach(t => { try { t.stop() } catch { } })
        } catch { }
    }, [selectedDeviceId])

    return (
        <div className='relative h-screen bg-black drag'>
            <div className='absolute top-2 left-2 z-20 no-drag flex gap-1'>
                {([1,2,3,4] as const).map((ch) => {
                    const targetLabel = ch === 1 ? 'OBS-Camera' : `OBS-Camera${ch}`
                    const device = devices.find(d => (d.label || '').toLowerCase() === targetLabel.toLowerCase())
                    const isActive = device && device.deviceId === selectedDeviceId
                    return (
                        <button
                          key={ch}
                          className={`h-7 px-2 rounded text-xs font-medium ${isActive ? 'bg-blue-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                          onClick={() => { if (device) setSelectedDeviceId(device.deviceId) }}
                          title={device ? `Switch to ${targetLabel}` : `${targetLabel} not found`}
                        >
                          Ch {ch}
                        </button>
                    )
                })}
            </div>

            <button
                title="Close"
                className='group h-7 w-7 no-drag flex items-center justify-center text-white hover:bg-white/20 absolute top-2 right-2 z-10 rounded'
                onClick={() => window.ipcRenderer.invoke('pip-window:close')}
            >
                <VscChromeClose className="h-4 w-4 text-white/70 group-hover:text-white" />
            </button>
            <div className='absolute inset-0'>
                <Webcam
                    key={selectedDeviceId || 'default'}
                    ref={videoRef as any}
                    videoConstraints={constraints as any}
                    audio={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>
        </div>
    )
}