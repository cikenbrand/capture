import { useEffect, useMemo, useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs"
import Webcam from "react-webcam"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { AudioMeterLive } from "./AudioMeter"

type ChannelKey = "channel-1" | "channel-2" | "channel-3" | "channel-4"
type TabKey = ChannelKey | "audio"
type ChannelConfig = {
    deviceLabel?: string
    deviceId?: string
    isMediaSource?: boolean
    rtmpUrl?: string
}

export default function VideoDeviceConfigurations() {
    const [activeTab, setActiveTab] = useState<TabKey>("channel-1")
    const [labelToDeviceId, setLabelToDeviceId] = useState<Record<string, string>>({})
    const [obsDevices, setObsDevices] = useState<{ id: string; name: string }[]>([])
    // Removed OBS-related states

    const CHANNEL_TO_LABEL: Record<string, string> = useMemo(() => ({
        "channel-1": "OBS-Camera",
        "channel-2": "OBS-Camera2",
        "channel-3": "OBS-Camera3",
        "channel-4": "OBS-Camera4",
    }), [])

    // Cache helpers to make UI instant using last-known state while OBS loads
    const CACHE_KEY = 'video-config:channel-configs'
    const readCachedConfigs = (): Partial<Record<ChannelKey, ChannelConfig>> => {
        try {
            const raw = localStorage.getItem(CACHE_KEY)
            if (!raw) return {}
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === 'object') return parsed as Partial<Record<ChannelKey, ChannelConfig>>
        } catch {}
        return {}
    }
    const writeCachedConfigs = (cfg: Record<ChannelKey, ChannelConfig>) => {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)) } catch {}
    }

    const initialConfigs: Record<ChannelKey, ChannelConfig> = useMemo(() => {
        const cached = readCachedConfigs()
        const base: Record<ChannelKey, ChannelConfig> = {
            "channel-1": { deviceLabel: "OBS-Camera", deviceId: "", isMediaSource: false, rtmpUrl: "" },
            "channel-2": { deviceLabel: "OBS-Camera2", deviceId: "", isMediaSource: false, rtmpUrl: "" },
            "channel-3": { deviceLabel: "OBS-Camera3", deviceId: "", isMediaSource: false, rtmpUrl: "" },
            "channel-4": { deviceLabel: "OBS-Camera4", deviceId: "", isMediaSource: false, rtmpUrl: "" },
        }
        const merged: Record<ChannelKey, ChannelConfig> = { ...base }
        ;(["channel-1", "channel-2", "channel-3", "channel-4"] as ChannelKey[]).forEach(k => {
            const c = (cached as any)?.[k]
            if (c && typeof c === 'object') {
                merged[k] = { ...merged[k], ...c }
            }
        })
        return merged
    }, [])

    const [channelConfigs, setChannelConfigs] = useState<Record<ChannelKey, ChannelConfig>>(initialConfigs)

    function applyDShowDevicesResponse(payload: any) {
        if (!payload || !payload.ok || !payload.data) return
        const list = Array.isArray(payload.data?.devices) ? payload.data.devices : []
        setObsDevices(list.filter((d: any) => d && (d.id || d.name)))

        const selected = payload.data?.selected || {}
        setChannelConfigs(prev => {
            const next = { ...prev }
            const clear = (key: ChannelKey) => {
                next[key] = { ...next[key], deviceId: '', deviceLabel: next[key]?.deviceLabel }
            }
            const apply = (key: ChannelKey, ent: any) => {
                if (!ent) return
                const id = String(ent?.id ?? '').trim()
                const name = String(ent?.name ?? '').trim()
                if (!id && !name) return
                next[key] = { ...next[key], deviceId: id || name, deviceLabel: name || next[key]?.deviceLabel }
            }
            clear('channel-1'); clear('channel-2'); clear('channel-3'); clear('channel-4')
            apply('channel-1', (selected as any).channel1)
            apply('channel-2', (selected as any).channel2)
            apply('channel-3', (selected as any).channel3)
            apply('channel-4', (selected as any).channel4)
            writeCachedConfigs(next as Record<ChannelKey, ChannelConfig>)
            return next
        })
    }

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
        ;(async () => {
            try {
                const res = await (window as any).ipcRenderer.invoke('obs:get-dshow-devices')
                console.log(res)
                if (!cancelled) applyDShowDevicesResponse(res)
            } catch {}
        })()
        return () => { cancelled = true }
    }, [])

    // Removed all OBS IPC effects

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
        setChannelConfigs(cfg => {
            const next = { ...cfg, [channel]: updater(cfg[channel]) }
            writeCachedConfigs(next as Record<ChannelKey, ChannelConfig>)
            return next
        })
    }

    function ChannelForm({ channelKey }: { channelKey: ChannelKey }) {
        const config = channelConfigs[channelKey] ?? {}
        return (
            <div className="w-full h-full flex flex-col gap-2">
                {renderPreviewForChannel(channelKey)}

                <div className="flex justify-end gap-2">
                    <Button onClick={async () => {
                        const channelNum = Number(String(channelKey).split('-')[1])
                        try {
                            const addRes = await (window as any).ipcRenderer.invoke('obs:add-media-to-channel', channelNum, 'dshow_input')
                            if (addRes && addRes.ok && addRes.data && addRes.data.added) {
                                const res = await (window as any).ipcRenderer.invoke('obs:get-dshow-devices')
                                applyDShowDevicesResponse(res)
                            }
                        } catch {}
                        updateChannelConfig(channelKey, p => ({ ...p, isMediaSource: false }))
                    }}>Add Video Capture Device</Button>
                    <Button onClick={async () => {
                        const channelNum = Number(String(channelKey).split('-')[1])
                        try {
                            const addRes = await (window as any).ipcRenderer.invoke('obs:add-media-to-channel', channelNum, 'ffmpeg_source')
                            if (addRes && addRes.ok && addRes.data && addRes.data.added) {
                                const res = await (window as any).ipcRenderer.invoke('obs:get-dshow-devices')
                                applyDShowDevicesResponse(res)
                            }
                        } catch {}
                        updateChannelConfig(channelKey, p => ({ ...p, isMediaSource: true }))
                    }}>Add Media Source</Button>
                    <Button onClick={async () => {
                        const channelNum = Number(String(channelKey).split('-')[1])
                        try {
                            const delRes = await (window as any).ipcRenderer.invoke('obs:delete-media-from-channel', channelNum)
                            if (delRes && delRes.ok) {
                                const res = await (window as any).ipcRenderer.invoke('obs:get-dshow-devices')
                                applyDShowDevicesResponse(res)
                            }
                        } catch {}
                    }}>Remove Media</Button>
                </div>

                {(String(config.deviceId ?? '').trim()) ? (
                    <div className="flex flex-col gap-1">
                        <span>Device Name</span>
                        <Select value={config.deviceId ?? ""} onValueChange={(val) => {
                            const value = String(val ?? '')
                            const chosen = obsDevices.find(d => String(d.id) === value || String(d.name) === value)
                            const deviceId = String(chosen?.id || value)
                            const deviceLabel = String(chosen?.name || '') || undefined
                            updateChannelConfig(channelKey, p => ({ ...p, deviceId, deviceLabel }))
                            const channelNum = Number(String(channelKey).split('-')[1])
                            ;(async () => {
                                try { await (window as any).ipcRenderer.invoke('obs:set-dshow-device', channelNum, deviceId) } catch {}
                            })()
                        }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select device" />
                            </SelectTrigger>
                            <SelectContent>
                                {obsDevices.map((d) => (
                                    <SelectItem key={String(d.id || d.name)} value={String(d.id || d.name)}>
                                        {String(d.name || d.id)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : null}

                {config.isMediaSource ? (
                    <div className="flex flex-col gap-1">
                        <span>RTMP Url</span>
                        <Input
                            placeholder="rtmp://server/app/streamKey"
                            value={config.rtmpUrl ?? ''}
                            onChange={(e) => updateChannelConfig(channelKey, p => ({ ...p, rtmpUrl: e.target.value }))}
                        />
                    </div>
                ) : null}
            </div>
        )
    }

    return (
        <div className="relative">
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
                        <Select onValueChange={() => { /* no-op */ }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select audio device" />
                            </SelectTrigger>
                            <SelectContent>{/* empty by request */}</SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span>Audio Meter</span>
                        <AudioMeterLive className="w-full" />
                    </div>
                </div>
            </TabsContent>
        </Tabs>
        </div>
    )
}