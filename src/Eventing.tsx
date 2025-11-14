import EventingTopBar from "./components/eventing/EventingTopBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import Timeline, { TimelineItem } from "./components/ui/Timeline";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "./components/ui/table";
import EventsGrid from "./components/eventing/EventsGrid";
import { useEffect, useState } from "react";
import { FaCircle, FaPause, FaPlay, FaStop } from "react-icons/fa";
import { BsCameraFill } from "react-icons/bs";
import { MdCameraRoll } from "react-icons/md";
import { TbLayoutBottombarExpand, TbLayoutBottombarCollapse } from "react-icons/tb";

export default function Eventing() {
    const [recordingState, setRecordingState] = useState({ isRecordingStarted: false, isRecordingPaused: false, isRecordingStopped: false, isClipRecordingStarted: false })
    const [eventRows, setEventRows] = useState<{ id: string; eventName: string; eventCode: string; startTime: string; endTime: string; data?: unknown }[]>([])
    const [timelineNowMs, setTimelineNowMs] = useState(0)
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
    const [isEventLogCollapsed, setIsEventLogCollapsed] = useState(false)

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
            ; (async () => {
                try {
                    const res = await window.ipcRenderer.invoke('recording:getState')
                    if (!cancelled && res?.ok) setRecordingState(res.data)
                } catch { }
                try {
                    const rows = await window.ipcRenderer.invoke('db:getEventLogsForActiveSession')
                    if (!cancelled && rows?.ok && Array.isArray(rows.data)) {
                        const getId = (v: any) => {
                            if (typeof v === 'string') return v
                            if (v && typeof v === 'object') {
                                try { const h = (v as any).toHexString?.(); if (typeof h === 'string' && h) return h } catch { }
                                if (typeof v.$oid === 'string') return v.$oid
                                try { const s = v.toString?.(); if (typeof s === 'string' && s && s !== '[object Object]') return s } catch { }
                            }
                            return ''
                        }
                        const mapped = rows.data.map((r: any) => ({
                            id: getId(r._id),
                            eventName: r.eventName,
                            eventCode: r.eventCode,
                            startTime: r.startTime,
                            endTime: r.endTime,
                            data: r.data
                        }))
                        mapped.sort((a, b) => {
                            const aMs = parseHMS(a.startTime || '00:00:00')
                            const bMs = parseHMS(b.startTime || '00:00:00')
                            if (bMs !== aMs) return bMs - aMs
                            const aEnd = parseHMS(a.endTime || '00:00:00')
                            const bEnd = parseHMS(b.endTime || '00:00:00')
                            return bEnd - aEnd
                        })
                        setEventRows(mapped)
                    }
                } catch { }
            })()
        const onRecordingStateChanged = () => { (async () => { try { const res = await window.ipcRenderer.invoke('recording:getState'); if (res?.ok) setRecordingState(res.data) } catch { } })() }
        window.addEventListener('recordingStateChanged', onRecordingStateChanged as any)
        // Also listen for cross-window IPC broadcast
        try { window.ipcRenderer.on('recordingStateChanged' as any, onRecordingStateChanged as any) } catch { }
        return () => {
            cancelled = true
            window.removeEventListener('recordingStateChanged', onRecordingStateChanged as any)
            try { window.ipcRenderer.off('recordingStateChanged' as any, onRecordingStateChanged as any) } catch { }
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
                        try { const h = (v as any).toHexString?.(); if (typeof h === 'string' && h) return h } catch { }
                        if (typeof v.$oid === 'string') return v.$oid
                        try { const s = v.toString?.(); if (typeof s === 'string' && s && s !== '[object Object]') return s } catch { }
                    }
                    return ''
                }
                const mapped = res.data.map((r: any) => ({
                    id: getId(r._id),
                    eventName: r.eventName,
                    eventCode: r.eventCode,
                    startTime: r.startTime,
                    endTime: r.endTime,
                    data: r.data
                }))
                mapped.sort((a, b) => {
                    const aMs = parseHMS(a.startTime || '00:00:00')
                    const bMs = parseHMS(b.startTime || '00:00:00')
                    if (bMs !== aMs) return bMs - aMs
                    const aEnd = parseHMS(a.endTime || '00:00:00')
                    const bEnd = parseHMS(b.endTime || '00:00:00')
                    return bEnd - aEnd
                })
                setEventRows(mapped)
            }
        } catch { }
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
            <div className="flex-1 flex">
                <div className="flex-1 flex flex-col">
                    <Tabs defaultValue="events" className="flex-1">
                        <TabsList>
                            <TabsTrigger value="events">Events</TabsTrigger>
                        </TabsList>
                        <TabsContent value="events" className="flex flex-col p-2 border-b border-slate-700">
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
                                                            .map((f: any, i: number) => ({ key: f.key ?? `f${i + 1}`, value: f.value }))
                                                        if (entries.length) return entries
                                                    }
                                                } catch { }
                                                return undefined
                                            })(),
                                        })
                                        await refreshEventLogs()
                                        try {
                                            const id = addRes?.ok ? (addRes.data ?? null) : null
                                            if (typeof id === 'string' && id) setSelectedEventId(id)
                                        } catch { }
                                    } catch { }
                                }}
                            />
                        </TabsContent>
                    </Tabs>
                    <Tabs defaultValue="timeline" className="flex-none h-[250px] border-b border-slate-600">
                        <TabsList>
                            <TabsTrigger value="timeline">Timeline</TabsTrigger>
                        </TabsList>
                        <TabsContent value="timeline" className="flex flex-col p-0">
                            <div className="h-full w-full">
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
                                                } catch { }
                                            }}
                                        />
                                    ))}
                                </Timeline>
                            </div>
                            <div className="flex items-center justify-center gap-2 bg-[#363D4A] h-[50px]">
                                <button
                                    title="Start Session"
                                    disabled
                                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[120px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                                    <FaCircle className="h-4 w-4" fill="#E06061" />
                                    <span className="text-slate-400">Start Session</span>
                                </button>
                                <button
                                    title="Stop Session"
                                    disabled={!recordingState.isRecordingStarted}
                                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[120px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                                    <FaStop className="h-4 w-4" fill="#DE4D3A" />
                                    <span className="text-slate-400">Stop Session</span>
                                </button>
                                <button
                                    title="Pause Session"
                                    disabled={!recordingState.isRecordingStarted}
                                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[120px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                                    <FaPause className="h-4 w-4" fill="#E0CC5F" />
                                    <span className="text-slate-400">Pause Session</span>
                                </button>
                                <button
                                    title="Resume Session"
                                    disabled
                                    onClick={() => { try { window.ipcRenderer.invoke('obs:resume-recording'); window.ipcRenderer.invoke('recording:updateState', { isRecordingPaused: false }); setRecordingState(prev => ({ ...prev, isRecordingPaused: false })); window.dispatchEvent(new Event('recordingStateChanged')); (async () => { try { const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId'); const projectId = proj?.ok ? (proj.data ?? null) : null; if (projectId) { const [diveRes, taskRes, nodeRes, fmt] = await Promise.all([window.ipcRenderer.invoke('app:getSelectedDiveId'), window.ipcRenderer.invoke('app:getSelectedTaskId'), window.ipcRenderer.invoke('app:getSelectedNodeId'), window.ipcRenderer.invoke('obs:get-file-name-formatting').catch(() => null),]); const diveId = diveRes?.ok ? (diveRes.data ?? null) : null; const taskId = taskRes?.ok ? (taskRes.data ?? null) : null; const nodeId = nodeRes?.ok ? (nodeRes.data ?? null) : null; let diveName = ''; let taskName = ''; let nodeName = ''; try { if (diveId) { const d = await window.ipcRenderer.invoke('db:getSelectedDiveDetails', diveId); diveName = d?.ok ? (d.data?.name ?? '') : '' } } catch { } try { if (taskId) { const t = await window.ipcRenderer.invoke('db:getSelectedTaskDetails', taskId); taskName = t?.ok ? (t.data?.name ?? '') : '' } } catch { } try { if (nodeId) { const n = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', nodeId); nodeName = n?.ok ? (n.data?.name ?? '') : '' } } catch { } const fileNames: string[] = []; try { const previewFmt = fmt && typeof fmt.preview === 'string' ? fmt.preview : ''; const ch1Fmt = fmt && typeof fmt.ch1 === 'string' ? fmt.ch1 : ''; const ch2Fmt = fmt && typeof fmt.ch2 === 'string' ? fmt.ch2 : ''; const ch3Fmt = fmt && typeof fmt.ch3 === 'string' ? fmt.ch3 : ''; const ch4Fmt = fmt && typeof fmt.ch4 === 'string' ? fmt.ch4 : ''; if (previewFmt) fileNames.push(previewFmt); if (ch1Fmt) fileNames.push(ch1Fmt); if (ch2Fmt) fileNames.push(ch2Fmt); if (ch3Fmt) fileNames.push(ch3Fmt); if (ch4Fmt) fileNames.push(ch4Fmt); } catch { } await window.ipcRenderer.invoke('db:addProjectLog', { projectId, event: 'Recording Resumed', dive: diveName || null, task: taskName || null, components: nodeName ? `(${nodeName})` : null, fileName: fileNames.length ? fileNames.join(', ') : null, }); try { window.dispatchEvent(new Event('projectLogsChanged')) } catch { } } } catch { } })() } catch { } }}
                                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[130px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                                    <FaPlay className="h-4 w-4" fill="#93E05F" />
                                    <span className="text-slate-400">Resume Session</span>
                                </button>
                                <div className="h-[26px] w-[140px] bg-black rounded flex items-center justify-center">
                                    <span className="text-slate-400 text-lg tracking-[5px] font-bold">
                                        {(() => {
                                            const s = (recordingState as any)?.sessionTimerSeconds ?? 0
                                            const hh = String(Math.floor(s / 3600)).padStart(2, '0')
                                            const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
                                            const ss = String(s % 60).padStart(2, '0')
                                            return `${hh}:${mm}:${ss}`
                                        })()}
                                    </span>
                                </div>
                                <div className="h-[30px] w-[1px] bg-white/20 mx-1" />
                                <button
                                    title="Start Clip"
                                    disabled
                                    onClick={() => {
                                        ; (async () => {
                                            try { await window.ipcRenderer.invoke('obs:start-clip-recording') } catch { }
                                            try { await window.ipcRenderer.invoke('recording:updateState', { isClipRecordingStarted: true }) } catch { }
                                            try { setRecordingState(prev => ({ ...prev, isClipRecordingStarted: true })) } catch { }
                                            try { window.dispatchEvent(new Event('recordingStateChanged')) } catch { }
                                            // Add project log: Clip Started (best-effort)
                                            try {
                                                const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId')
                                                const projectId = proj?.ok ? (proj.data ?? null) : null
                                                if (projectId) {
                                                    const [diveRes, taskRes, nodeRes] = await Promise.all([
                                                        window.ipcRenderer.invoke('app:getSelectedDiveId'),
                                                        window.ipcRenderer.invoke('app:getSelectedTaskId'),
                                                        window.ipcRenderer.invoke('app:getSelectedNodeId'),
                                                    ])
                                                    const diveId = diveRes?.ok ? (diveRes.data ?? null) : null
                                                    const taskId = taskRes?.ok ? (taskRes.data ?? null) : null
                                                    const nodeId = nodeRes?.ok ? (nodeRes.data ?? null) : null
                                                    let diveName = ''
                                                    let taskName = ''
                                                    let nodeName = ''
                                                    try { if (diveId) { const d = await window.ipcRenderer.invoke('db:getSelectedDiveDetails', diveId); diveName = d?.ok ? (d.data?.name ?? '') : '' } } catch { }
                                                    try { if (taskId) { const t = await window.ipcRenderer.invoke('db:getSelectedTaskDetails', taskId); taskName = t?.ok ? (t.data?.name ?? '') : '' } } catch { }
                                                    try { if (nodeId) { const n = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', nodeId); nodeName = n?.ok ? (n.data?.name ?? '') : '' } } catch { }
                                                    let clipFileName = ''
                                                    try {
                                                        const fmt = await window.ipcRenderer.invoke('obs:get-clip-file-name-formatting')
                                                        clipFileName = typeof fmt === 'string' ? fmt : ''
                                                    } catch { }
                                                    try {
                                                        await window.ipcRenderer.invoke('db:addProjectLog', {
                                                            projectId,
                                                            event: 'Clip Started',
                                                            dive: diveName || null,
                                                            task: taskName || null,
                                                            components: nodeName ? `(${nodeName})` : null,
                                                            fileName: clipFileName || null,
                                                        })
                                                        window.dispatchEvent(new Event('projectLogsChanged'))
                                                    } catch { }
                                                }
                                            } catch { }
                                        })()
                                    }}
                                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[90px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                                    <MdCameraRoll className="h-4 w-4" />
                                    <span className="text-slate-400">Start Clip</span>
                                </button>
                                <button
                                    title="Stop Clip"
                                    disabled
                                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[90px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                                    <FaStop className="h-4 w-4" />
                                    <span className="text-slate-400">Stop Clip</span>
                                </button>
                                <div className="h-[26px] w-[140px] bg-black rounded flex items-center justify-center">
                                    <span className="text-slate-400 text-lg tracking-[5px] font-bold">
                                        {(() => {
                                            const s = (recordingState as any)?.sessionTimerSeconds ?? 0
                                            const hh = String(Math.floor(s / 3600)).padStart(2, '0')
                                            const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
                                            const ss = String(s % 60).padStart(2, '0')
                                            return `${hh}:${mm}:${ss}`
                                        })()}
                                    </span>
                                </div>
                                <div className="h-[30px] w-[1px] bg-white/20 mx-1" />
                                <button
                                    title="Take Snapshot"
                                    disabled
                                    className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[110px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none gap-2">
                                    <BsCameraFill className="h-4 w-4" />
                                    <span className="text-slate-400">Take Snapshot</span>
                                </button>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className={`flex-none ${isEventLogCollapsed ? 'h-[35px]' : 'h-[300px]'} overflow-hidden w-full`}>
                        <Tabs defaultValue="eventlog" className="h-full">
                            <TabsList className="w-full">
                                <TabsTrigger value="eventlog" className={`${isEventLogCollapsed ? 'hidden' : ''}`}>Event Log</TabsTrigger>
                                <div className="w-full flex items-center justify-end h-[32px]">
                                    <button
                                        title={isEventLogCollapsed ? 'Expand' : 'Collapse'}
                                        onClick={() => setIsEventLogCollapsed(prev => !prev)}
                                        className="hover:bg-[#1D2229] rounded flex items-center justify-center h-[25px] w-[25px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none mr-2">
                                        {isEventLogCollapsed ? (
                                            <TbLayoutBottombarExpand className="h-4 w-4 text-slate-400" />
                                        ) : (
                                            <TbLayoutBottombarCollapse className="h-4 w-4 text-slate-400" />
                                        )}
                                    </button>
                                </div>
                            </TabsList>
                            <TabsContent value="eventlog" className="flex flex-col p-0">
                                <div className="w-full h-full bg-[#21262E]">
                                    <div className="h-[260px] overflow-auto logs-scroll">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-b border-white/10">
                                                    <TableHead className="w-[200px] text-slate-400">Event Name</TableHead>
                                                    <TableHead className="w-[100px] text-slate-400">Event Code</TableHead>
                                                    <TableHead className="w-[120px] text-slate-400">Start Time</TableHead>
                                                    <TableHead className="w-[120px] text-slate-400">End Time</TableHead>
                                                    <TableHead className="w-[120px] text-slate-400">Data</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {eventRows.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-slate-400">No events</TableCell>
                                                    </TableRow>
                                                ) : (
                                                    eventRows.map((r, idx) => (
                                                        <TableRow key={idx} className={`${selectedEventId === r.id ? 'bg-[#374F66]' : 'text-slate-400'}`}>
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
                                                                                const k = (e && typeof e.key === 'string' && e.key.trim()) ? e.key : `f${i + 1}`
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
        </div>
    )
}