import { useEffect, useMemo, useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs"
import Webcam from "react-webcam"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select"
import { Input } from "../ui/input"
import AudioMeter, { AudioMeterLive } from "./AudioMeter"

type ChannelKey = "channel-1" | "channel-2" | "channel-3" | "channel-4"
type TabKey = ChannelKey | "audio"
type InputType = "live-device" | "rtmp" | "webrtc" | "none"
type ChannelConfig = {
    inputType: InputType
    deviceLabel?: string
    deviceId?: string
    rtmpUrl?: string
    webrtcUrl?: string
}

export default function VideoDeviceConfigurations() {
    const [activeTab, setActiveTab] = useState<TabKey>("channel-1")
    const [labelToDeviceId, setLabelToDeviceId] = useState<Record<string, string>>({})
    const [obsDevices, setObsDevices] = useState<Array<{ id: string; name: string }>>([])
    const [audioDevices, setAudioDevices] = useState<Array<{ id: string; name: string }>>([])
    const [sceneNameByChannel, setSceneNameByChannel] = useState<Record<ChannelKey, string>>({
        'channel-1': 'channel 1',
        'channel-2': 'channel 2',
        'channel-3': 'channel 3',
        'channel-4': 'channel 4',
    })

    const CHANNEL_TO_LABEL: Record<string, string> = useMemo(() => ({
        "channel-1": "OBS-Camera",
        "channel-2": "OBS-Camera2",
        "channel-3": "OBS-Camera3",
        "channel-4": "OBS-Camera4",
    }), [])

    const initialConfigs: Record<ChannelKey, ChannelConfig> = useMemo(() => ({
        "channel-1": { inputType: "live-device", deviceLabel: "OBS-Camera", deviceId: "" },
        "channel-2": { inputType: "live-device", deviceLabel: "OBS-Camera2", deviceId: "" },
        "channel-3": { inputType: "live-device", deviceLabel: "OBS-Camera3", deviceId: "" },
        "channel-4": { inputType: "live-device", deviceLabel: "OBS-Camera4", deviceId: "" },
    }), [])

    const [channelConfigs, setChannelConfigs] = useState<Record<ChannelKey, ChannelConfig>>(initialConfigs)

    useEffect(() => {
        let cancelled = false

        async function ensureDeviceLabelsAvailable() {
            try {
                // If labels are empty (no permission), request a lightweight stream to unlock labels
                const devices = await navigator.mediaDevices.enumerateDevices()
                const hasLabels = devices.some(d => (d.label ?? "").trim().length > 0)
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
                const devices = await navigator.mediaDevices.enumerateDevices()
                if (cancelled) return
                const map: Record<string, string> = {}
                for (const d of devices) {
                    if (d.kind !== "videoinput") continue
                    const label = (d.label ?? "").trim()
                    if (!label) continue
                    map[label] = d.deviceId
                }
                setLabelToDeviceId(map)
            } catch { }
        }

        refreshDevices()
        return () => { cancelled = true }
    }, [])

    // Fetch OBS live devices list for the target input via IPC
    useEffect(() => {
        let disposed = false
        async function loadFromObs() {
            try {
                const list = await (window as any)?.ipcRenderer?.invoke?.('obs:get-live-devices')
                if (!disposed && Array.isArray(list)) {
                    const sanitized = list
                        .map((d: any) => ({ id: String(d?.id ?? ''), name: String(d?.name ?? '') }))
                        .filter(d => d.id && d.name && !/obs/i.test(d.name))
                    setObsDevices(sanitized)
                }
            } catch { }
        }
        loadFromObs()
        return () => { disposed = true }
    }, [])

    // Resolve per-channel scene names and load active types/devices for each
    useEffect(() => {
        let cancelled = false
        function candidatesForChannel(n: number): string[] {
            const base = [`Channel ${n}`, `channel ${n}`, `CHANNEL ${n}`]
            const variants = [
                `single_channel-${n}`,
                `single-channel-${n}`,
                `single channel ${n}`,
                `Single Channel ${n}`,
            ]
            return [...base, ...variants]
        }

        async function resolveSceneNameForChannel(n: number): Promise<string> {
            const candidates = candidatesForChannel(n)
            for (const name of candidates) {
                try {
                    const cap = await (window as any)?.ipcRenderer?.invoke?.('obs:get-active-capture-inputs', name)
                    const capData = cap?.ok ? cap.data : cap
                    // Accept only if this scene actually has entries for this channel index
                    if (capData && typeof capData === 'object' && capData[n] != null) {
                        return name
                    }
                } catch { }
            }
            return `channel ${n}`
        }

        async function loadActiveTypes() {
            try {
                const channels: ChannelKey[] = ['channel-1', 'channel-2', 'channel-3', 'channel-4']
                const resolved: Record<ChannelKey, string> = { ...sceneNameByChannel }
                for (const ck of channels) {
                    const n = ck === 'channel-1' ? 1 : ck === 'channel-2' ? 2 : ck === 'channel-3' ? 3 : 4
                    resolved[ck] = await resolveSceneNameForChannel(n)
                }
                if (!cancelled) setSceneNameByChannel(resolved)

                // Gather updates for each channel
                const updates: Partial<Record<ChannelKey, Partial<ChannelConfig>>> = {}
                const pickType = (st: any, fallback: InputType): InputType => {
                    try {
                        if (st?.rtmp) return 'rtmp'
                        if (st?.webrtc) return 'webrtc'
                        if (st?.videoCaptureDevice) return 'live-device'
                        if (st && !st?.rtmp && !st?.webrtc && !st?.videoCaptureDevice) return 'none'
                    } catch { }
                    return fallback
                }

                for (const ck of channels) {
                    const n = ck === 'channel-1' ? 1 : ck === 'channel-2' ? 2 : ck === 'channel-3' ? 3 : 4
                    try {
                        const res = await (window as any)?.ipcRenderer?.invoke?.('obs:get-active-video-items-for-scene', resolved[ck])
                        const data = res?.ok ? res.data : res
                        if (data && typeof data === 'object') {
                            updates[ck] = { ...(updates[ck] || {}), inputType: pickType(data[n], 'live-device') }
                        }
                    } catch { }

                    try {
                        const cap = await (window as any)?.ipcRenderer?.invoke?.('obs:get-active-capture-inputs', resolved[ck])
                        const capData = cap?.ok ? cap.data : cap
                        const info = capData?.[n]
                        if (info?.enabled) {
                            if (info?.deviceId) updates[ck] = { ...(updates[ck] || {}), deviceId: info.deviceId }
                            if (info?.deviceName) updates[ck] = { ...(updates[ck] || {}), deviceLabel: info.deviceName }
                        }
                    } catch { }
                }

                if (!cancelled) {
                    setChannelConfigs(prev => {
                        const next: Record<ChannelKey, ChannelConfig> = { ...prev }
                        for (const ck of Object.keys(updates) as ChannelKey[]) {
                            next[ck] = { ...next[ck], ...(updates[ck] as Partial<ChannelConfig>) }
                        }
                        return next
                    })
                }
            } catch { }
        }
        loadActiveTypes()
        return () => { cancelled = true }
    }, [])

    // Load audio input devices from OBS (from 'audio input device')
    useEffect(() => {
        let disposed = false
        async function loadAudioInputs() {
            try {
                const list = await (window as any)?.ipcRenderer?.invoke?.('obs:get-audio-inputs')
                if (!disposed && Array.isArray(list)) {
                    const sanitized = list
                        .map((d: any) => ({ id: String(d?.id ?? ''), name: String(d?.name ?? '') }))
                        .filter(d => d.id && d.name)
                    setAudioDevices(sanitized)
                }
            } catch { }
        }
        loadAudioInputs()
        return () => { disposed = true }
    }, [])

    // Removed default selection and OBS-side syncing; keep UI read-only list of live devices

    // Removed debug logs that fetched active inputs

    function renderPreviewForChannel(channelKey: ChannelKey) {
        // Decouple preview from the selected OBS device name. Always preview a stable browser device.
        // Prefer the default channel label mapping; if not found, fall back to the first available camera.
        const previewLabel = CHANNEL_TO_LABEL[channelKey]
        const deviceId = labelToDeviceId[previewLabel] || Object.values(labelToDeviceId)[0]
        if (!deviceId) {
            return (
                <div className="text-white/70 text-sm">
                    Preview not available.
                </div>
            )
        }

        const constraints: MediaStreamConstraints["video"] = {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
        }

        return (
            <div className="p-1 w-full">
                <Webcam
                    videoConstraints={constraints as MediaTrackConstraints}
                    audio={false}
                    style={{ width: "100%", height: "auto", borderRadius: 4, background: "black" }}
                />
            </div>
        )
    }

    function updateChannelConfig(channel: ChannelKey, updater: (prev: ChannelConfig) => ChannelConfig) {
        setChannelConfigs(cfg => ({ ...cfg, [channel]: updater(cfg[channel]) }))
    }

    function ChannelForm({ channelKey }: { channelKey: ChannelKey }) {
        const config = channelConfigs[channelKey] ?? { inputType: "live-device" }
        const showDeviceSelect = config.inputType === "live-device"
        const showRtmp = config.inputType === "rtmp"
        const showWebrtc = config.inputType === "webrtc"

        // Build filtered device list so that a device chosen by another channel
        // is not available to select here. Keep current selection visible.
        const selectedDeviceIdsOnOtherChannels = new Set(
            (Object.keys(channelConfigs) as ChannelKey[])
                .filter(k => k !== channelKey)
                .map(k => channelConfigs[k]?.deviceId)
                .filter((id): id is string => !!id && id !== 'none')
        )
        const filteredObsDevices = obsDevices.filter(d => {
            const currentId = config.deviceId ?? ''
            return d.id === currentId || !selectedDeviceIdsOnOtherChannels.has(d.id)
        })

        return (
            <div className="w-full h-full flex flex-col gap-2">
                {renderPreviewForChannel(channelKey)}

                <div className="flex flex-col gap-1">
                    <span>Input Type</span>
                    <Select value={config.inputType} onValueChange={async (v) => {
                        const nextType = v as InputType
                        updateChannelConfig(channelKey, p => ({ ...p, inputType: nextType }))
                        try {
                            const idx = channelKey === 'channel-1' ? 1 : channelKey === 'channel-2' ? 2 : channelKey === 'channel-3' ? 3 : 4
                            const sceneName = sceneNameByChannel[channelKey] || `channel ${idx}`
                            await (window as any)?.ipcRenderer?.invoke?.('obs:set-active-video-item', sceneName, idx, nextType)
                        } catch { }
                    }}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Source Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="live-device">Live Device</SelectItem>
                            <SelectItem value="rtmp">RTMP</SelectItem>
                            <SelectItem value="webrtc">WebRTC</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {showDeviceSelect ? (
                    <div className="flex flex-col gap-1">
                        <span>Device Name</span>
                        <Select value={config.deviceId ?? ""} onValueChange={async (v) => {
                            updateChannelConfig(channelKey, p => ({ ...p, deviceId: v, deviceLabel: (obsDevices.find(d => d.id === v)?.name || p.deviceLabel) }))
                            try {
                                const idx = channelKey === 'channel-1' ? 1 : channelKey === 'channel-2' ? 2 : channelKey === 'channel-3' ? 3 : 4
                                const sceneName = sceneNameByChannel[channelKey] || `channel ${idx}`
                                await (window as any)?.ipcRenderer?.invoke?.('obs:set-capture-device-input', sceneName, idx, v)
                            } catch { }
                        }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select device" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {filteredObsDevices.map(d => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : null}

                {showRtmp ? (
                    <div className="flex flex-col gap-1">
                        <span>RTMP URL</span>
                        <Input
                            placeholder="rtmp://server/app/streamKey"
                            value={config.rtmpUrl ?? ""}
                            onChange={(e) => updateChannelConfig(channelKey, p => ({ ...p, rtmpUrl: e.target.value }))}
                        />
                    </div>
                ) : null}

                {showWebrtc ? (
                    <div className="flex flex-col gap-1">
                        <span>WebRTC URL</span>
                        <Input
                            placeholder="https://host/webrtc/stream"
                            value={config.webrtcUrl ?? ""}
                            onChange={(e) => updateChannelConfig(channelKey, p => ({ ...p, webrtcUrl: e.target.value }))}
                        />
                    </div>
                ) : null}
            </div>
        )
    }

    return (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
            <TabsList>
                <TabsTrigger value="channel-1">Channel 1</TabsTrigger>
                <TabsTrigger value="channel-2">Channel 2</TabsTrigger>
                <TabsTrigger value="channel-3">Channel 3</TabsTrigger>
                <TabsTrigger value="channel-4">Channel 4</TabsTrigger>
                <TabsTrigger value="audio">Audio</TabsTrigger>
            </TabsList>
            <TabsContent value="channel-1" className="flex flex-col items-center gap-2">
                {activeTab === "channel-1" ? <ChannelForm channelKey="channel-1" /> : null}
            </TabsContent>
            <TabsContent value="channel-2" className="flex flex-col items-center gap-2">
                {activeTab === "channel-2" ? <ChannelForm channelKey="channel-2" /> : null}
            </TabsContent>
            <TabsContent value="channel-3" className="flex flex-col items-center gap-2">
                {activeTab === "channel-3" ? <ChannelForm channelKey="channel-3" /> : null}
            </TabsContent>
            <TabsContent value="channel-4" className="flex flex-col items-center gap-2">
                {activeTab === "channel-4" ? <ChannelForm channelKey="channel-4" /> : null}
            </TabsContent>
            <TabsContent value="audio" className="flex flex-col items-center gap-2">
                <div className="flex flex-col gap-2 w-full">
                    <div className="flex flex-col gap-1">
                        <span>Audio Device</span>
                        <Select defaultValue={audioDevices[0]?.id}
                            onValueChange={async (val) => {
                                try {
                                    await (window as any)?.ipcRenderer?.invoke?.('obs:set-audio-input', val)
                                } catch { }
                            }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select audio device" />
                            </SelectTrigger>
                            <SelectContent>
                                {audioDevices.map(d => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span>Audio Meter</span>
                        <AudioMeterLive className="w-full" />
                    </div>
                </div>
            </TabsContent>
        </Tabs>
    )
}