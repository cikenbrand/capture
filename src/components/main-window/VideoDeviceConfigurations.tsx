import { useEffect, useMemo, useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs"
import Webcam from "react-webcam"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select"
import { Input } from "../ui/input"

type ChannelKey = "channel-1" | "channel-2" | "channel-3" | "channel-4"
type InputType = "live-device" | "rtmp" | "webrtc"
type ChannelConfig = {
    inputType: InputType
    deviceLabel?: string
    rtmpUrl?: string
    webrtcUrl?: string
}

export default function VideoDeviceConfigurations() {
    const [activeTab, setActiveTab] = useState<ChannelKey>("channel-1")
    const [labelToDeviceId, setLabelToDeviceId] = useState<Record<string, string>>({})
    const [obsDevices, setObsDevices] = useState<Array<{ id: string; name: string }>>([])

    const CHANNEL_TO_LABEL: Record<string, string> = useMemo(() => ({
        "channel-1": "OBS-Camera",
        "channel-2": "OBS-Camera2",
        "channel-3": "OBS-Camera3",
        "channel-4": "OBS-Camera4",
    }), [])

    const initialConfigs: Record<ChannelKey, ChannelConfig> = useMemo(() => ({
        "channel-1": { inputType: "live-device", deviceLabel: "OBS-Camera" },
        "channel-2": { inputType: "live-device", deviceLabel: "OBS-Camera2" },
        "channel-3": { inputType: "live-device", deviceLabel: "OBS-Camera3" },
        "channel-4": { inputType: "live-device", deviceLabel: "OBS-Camera4" },
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
                        .filter(d => d.id && d.name)
                    setObsDevices(sanitized)
                }
            } catch {}
        }
        loadFromObs()
        return () => { disposed = true }
    }, [])

    function renderPreviewForChannel(channelKey: ChannelKey) {
        const config = channelConfigs[channelKey]
        const selectedLabel = config?.deviceLabel || CHANNEL_TO_LABEL[channelKey]
        const deviceId = labelToDeviceId[selectedLabel]
        if (!deviceId) {
            return (
                <div className="text-white/70 text-sm">
                    Device "{selectedLabel}" not found.
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

        return (
            <div className="w-full h-full flex flex-col gap-2">
                {renderPreviewForChannel(channelKey)}

                <div className="flex flex-col gap-1">
                    <span>Input Type</span>
                    <Select value={config.inputType} onValueChange={(v) => updateChannelConfig(channelKey, p => ({ ...p, inputType: v as InputType }))}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Source Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="live-device">Live Device</SelectItem>
                            <SelectItem value="rtmp">RTMP</SelectItem>
                            <SelectItem value="webrtc">WebRTC</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {showDeviceSelect ? (
                    <div className="flex flex-col gap-1">
                        <span>Device Name</span>
                        <Select value={config.deviceLabel ?? ""} onValueChange={(v) => updateChannelConfig(channelKey, p => ({ ...p, deviceLabel: v }))}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select device" />
                            </SelectTrigger>
                            <SelectContent>
                                {obsDevices.map(d => (
                                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChannelKey)}>
            <TabsList>
                <TabsTrigger value="channel-1">Channel 1</TabsTrigger>
                <TabsTrigger value="channel-2">Channel 2</TabsTrigger>
                <TabsTrigger value="channel-3">Channel 3</TabsTrigger>
                <TabsTrigger value="channel-4">Channel 4</TabsTrigger>
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
        </Tabs>
    )
}