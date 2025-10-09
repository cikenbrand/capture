import EventingTopBar from "./components/eventing/EventingTopBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import Timeline, { TimelineItem } from "./components/ui/Timeline";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "./components/ui/table";
import EventsGrid from "./components/eventing/EventsGrid";
import { useEffect, useState } from "react";

export default function Eventing() {
    const [recordingState, setRecordingState] = useState({ isRecordingStarted: false, isRecordingPaused: false, isRecordingStopped: false, isClipRecordingStarted: false })
    const [eventRows, setEventRows] = useState<{ id: string; eventName: string; eventCode: string; startTime: string; endTime: string; data?: unknown }[]>([])
    const [timelineNowMs, setTimelineNowMs] = useState(0)
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

    useEffect(() => {
        const id = setInterval(() => setTimelineNowMs((v) => v + 1000), 1000)
        return () => clearInterval(id)
    }, [])
    useEffect(() => {
        if (recordingState.isRecordingStopped) {
            setEventRows([])
        }
    }, [recordingState.isRecordingStopped])
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await window.ipcRenderer.invoke('recording:getState')
                if (!cancelled && res?.ok) setRecordingState(res.data)
            } catch {}
            try {
                const rows = await window.ipcRenderer.invoke('db:getEventLogsForActiveSession')
                if (!cancelled && rows?.ok && Array.isArray(rows.data)) {
                    const getId = (v: any) => {
                        if (typeof v === 'string') return v
                        if (v && typeof v === 'object') {
                            try { const h = (v as any).toHexString?.(); if (typeof h === 'string' && h) return h } catch {}
                            if (typeof v.$oid === 'string') return v.$oid
                            try { const s = v.toString?.(); if (typeof s === 'string' && s && s !== '[object Object]') return s } catch {}
                        }
                        return ''
                    }
                    setEventRows(rows.data.map((r: any) => ({ id: getId(r._id), eventName: r.eventName, eventCode: r.eventCode, startTime: r.startTime, endTime: r.endTime, data: r.data })))
                }
            } catch {}
        })()
        const onRecordingStateChanged = () => { (async () => { try { const res = await window.ipcRenderer.invoke('recording:getState'); if (res?.ok) setRecordingState(res.data) } catch {} })() }
        window.addEventListener('recordingStateChanged', onRecordingStateChanged as any)
        // Also listen for cross-window IPC broadcast
        try { window.ipcRenderer.on('recordingStateChanged' as any, onRecordingStateChanged as any) } catch {}
        return () => {
            cancelled = true
            window.removeEventListener('recordingStateChanged', onRecordingStateChanged as any)
            try { window.ipcRenderer.off('recordingStateChanged' as any, onRecordingStateChanged as any) } catch {}
        }
    }, [])

    function formatHMSFromMs(ms: number): string {
        const total = Math.max(0, Math.floor(ms / 1000))
        const hh = String(Math.floor(total / 3600)).padStart(2, '0')
        const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
        const ss = String(total % 60).padStart(2, '0')
        return `${hh}:${mm}:${ss}`
    }
    function parseHMS(hms: string): number {
        const parts = String(hms || '').split(':')
        if (parts.length !== 3) return 0
        const [h, m, s] = parts.map((p) => Number(p) || 0)
        return ((h * 3600) + (m * 60) + s) * 1000
    }
    async function refreshEventLogs() {
        try {
            const res = await window.ipcRenderer.invoke('db:getEventLogsForActiveSession')
            if (res?.ok && Array.isArray(res.data)) {
                const getId = (v: any) => {
                    if (typeof v === 'string') return v
                    if (v && typeof v === 'object') {
                        try { const h = (v as any).toHexString?.(); if (typeof h === 'string' && h) return h } catch {}
                        if (typeof v.$oid === 'string') return v.$oid
                        try { const s = v.toString?.(); if (typeof s === 'string' && s && s !== '[object Object]') return s } catch {}
                    }
                    return ''
                }
                setEventRows(res.data.map((r: any) => ({ id: getId(r._id), eventName: r.eventName, eventCode: r.eventCode, startTime: r.startTime, endTime: r.endTime, data: r.data })))
            }
        } catch {}
    }
    function colorForCode(code: string): string {
        const c = String(code || '').toUpperCase()
        switch (c) {
            case 'CP': return '#1BAA63'
            case 'AN': return '#A855F7'
            case 'PD': return '#15803D'
            case 'FS': return '#F59E0B'
            case 'EX': return '#D97706'
            case 'BU': return '#B45309'
            case 'CD': return '#EF4444'
            case 'FJ': return '#EC4899'
            case 'DN': return '#F43F5E'
            case 'CPH': return '#F472B6'
            case 'DB': return '#3B82F6'
            case 'CR': return '#10B981'
            case 'TPD': return '#84CC16'
            case 'FN': return '#06B6D4'
            default: return '#6B7280'
        }
    }
    return (
        <div className='h-screen flex flex-col bg-[#1D2229] overflow-clip'>
            <EventingTopBar />
            <div className="flex-1 flex p-2 gap-1">
                <div className="flex-1 flex flex-col gap-1">
                    <Tabs defaultValue="events" className="flex-1">
                        <TabsList>
                            <TabsTrigger value="events">Events</TabsTrigger>
                        </TabsList>
                        <TabsContent value="events" className="flex flex-col gap-1 p-1">
                            <EventsGrid
                                disabled={recordingState.isRecordingStopped || !recordingState.isRecordingStarted}
                                onChipClick={async ({ label, code }) => {
                                    try {
                                        const curS = (recordingState as any)?.sessionTimerSeconds ?? 0
                                        const startMs = curS * 1000
                                        const endMs = startMs + 1000
                                        const addRes = await window.ipcRenderer.invoke('db:addEventLog', {
                                            eventName: label,
                                            eventCode: code,
                                            startTime: startMs,
                                            endTime: endMs,
                                            data: await (async () => {
                                                try {
                                                    const ser = await window.ipcRenderer.invoke('serial:getDeviceState')
                                                    if (ser?.ok && ser.data?.isOpen && Array.isArray(ser.data.currentFields)) {
                                                        const entries = ser.data.currentFields
                                                            .filter((f: any) => f && typeof f.value === 'string' && f.value.length > 0)
                                                            .map((f: any, i: number) => ({ key: f.key ?? `f${i+1}`, value: f.value }))
                                                        if (entries.length) return entries
                                                    }
                                                } catch {}
                                                return undefined
                                            })(),
                                        })
                                        await refreshEventLogs()
                                        try {
                                            const id = addRes?.ok ? (addRes.data ?? null) : null
                                            if (typeof id === 'string' && id) setSelectedEventId(id)
                                        } catch {}
                                    } catch {}
                                }}
                            />
                        </TabsContent>
                    </Tabs>
                    <Tabs defaultValue="timeline" className="flex-none h-[250px]">
                        <TabsList>
                            <TabsTrigger value="timeline">Timeline</TabsTrigger>
                        </TabsList>
                        <TabsContent value="timeline" className="flex flex-col gap-1">
                            <Timeline
                                durationMs={Math.max(60_000, ((recordingState as any)?.sessionTimerSeconds ?? 0) * 1000 + 1_000)}
                                valueMs={((recordingState as any)?.isRecordingStarted ? ((recordingState as any)?.sessionTimerSeconds ?? 0) * 1000 : 1_000)}
                                initialViewDurationMs={60_000}
                                disablePlayheadDrag
                                autoPanToCurrent
                            >
                                {eventRows.map((ev) => (
                                    <TimelineItem
                                        key={ev.id}
                                        id={ev.id}
                                        startMs={parseHMS(ev.startTime)}
                                        endMs={parseHMS(ev.endTime)}
                                        color={colorForCode(ev.eventCode)}
                                        label={ev.eventName}
                                        onSelect={() => setSelectedEventId(ev.id)}
                                        onChange={async ({ startMs, endMs }) => {
                                            try {
                                                await window.ipcRenderer.invoke('db:editEventLog', ev.id, { startTime: formatHMSFromMs(startMs), endTime: formatHMSFromMs(endMs) })
                                                await refreshEventLogs()
                                            } catch {}
                                        }}
                                    />
                                ))}
                            </Timeline>
                            <span className="text-white/80 text-sm">
                                {(() => {                                           
                                    const s = (recordingState as any)?.sessionTimerSeconds ?? 0
                                    const hh = String(Math.floor(s / 3600)).padStart(2, '0')
                                    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
                                    const ss = String(s % 60).padStart(2, '0')               
                                    return `${hh}:${mm}:${ss}`
                                })()}
                            </span>
                        </TabsContent>
                    </Tabs>

                    <Tabs defaultValue="eventlog" className="flex-1">
                        <TabsList>
                            <TabsTrigger value="eventlog">Event Log</TabsTrigger>
                        </TabsList>
                        <TabsContent value="eventlog" className="flex flex-col gap-1">
                            <div className="w-full h-full p-1 bg-[#21262E]">
                                <div className="h-[220px] overflow-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-b border-white/10">
                                                <TableHead className="w-[200px]">Event Name</TableHead>
                                                <TableHead className="w-[100px]">Event Code</TableHead>
                                                <TableHead className="w-[120px]">Start Time</TableHead>
                                                <TableHead className="w-[120px]">End Time</TableHead>
                                                <TableHead className="w-[120px]">Data</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {eventRows.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5}>No events</TableCell>
                                                </TableRow>
                                            ) : (
                                                eventRows.map((r, idx) => (
                                                    <TableRow key={idx} className={`border-b border-white/10 ${selectedEventId === r.id ? 'bg-[#1f2a37]' : ''}`}>
                                                        <TableCell>{r.eventName}</TableCell>
                                                        <TableCell>{r.eventCode}</TableCell>
                                                        <TableCell>{r.startTime}</TableCell>
                                                        <TableCell>{r.endTime}</TableCell>
                                                        <TableCell>
                                                            {(() => {
                                                                const v = r.data
                                                                if (v == null) return ''
                                                                try {
                                                                    if (Array.isArray(v)) {
                                                                        return (v as any[]).map((e: any, i) => {
                                                                            const k = (e && typeof e.key === 'string' && e.key.trim()) ? e.key : `f${i+1}`
                                                                            const val = String(e?.value ?? '')
                                                                            return `${k}=${val}`
                                                                        }).join(', ')
                                                                    }
                                                                    if (typeof v === 'object') return JSON.stringify(v)
                                                                    return String(v)
                                                                } catch { return String(v) }
                                                            })()}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}