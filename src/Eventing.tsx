import EventingTopBar from "./components/eventing/EventingTopBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import Timeline, { TimelineItem } from "./components/ui/Timeline";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "./components/ui/table";
import EventsGrid from "./components/eventing/EventsGrid";
import { useEffect, useState } from "react";

export default function Eventing() {
    const [recordingState, setRecordingState] = useState({ isRecordingStarted: false, isRecordingPaused: false, isRecordingStopped: false, isClipRecordingStarted: false })
    const [eventRows, setEventRows] = useState<{ eventName: string; eventCode: string; startTime: string; endTime: string }[]>([])
    const [timelineNowMs, setTimelineNowMs] = useState(0)

    useEffect(() => {
        const id = setInterval(() => setTimelineNowMs((v) => v + 1000), 1000)
        return () => clearInterval(id)
    }, [])
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await window.ipcRenderer.invoke('recording:getState')
                if (!cancelled && res?.ok) setRecordingState(res.data)
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
    return (
        <div className='h-screen flex flex-col bg-[#1D2229]'>
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
                                        // Use current timeline seconds as start/end sample for now
                                        const startMs = 0
                                        const endMs = 1000
                                        await window.ipcRenderer.invoke('db:addEventLog', {
                                            eventName: label,
                                            eventCode: code,
                                            startTime: startMs,
                                            endTime: endMs,
                                        })
                                        const res = await window.ipcRenderer.invoke('db:getEventLogsForActiveSession')
                                        if (res?.ok && Array.isArray(res.data)) {
                                            setEventRows(res.data.map((r: any) => ({ eventName: r.eventName, eventCode: r.eventCode, startTime: r.startTime, endTime: r.endTime })))
                                        }
                                    } catch {}
                                }}
                            />
                        </TabsContent>
                    </Tabs>

                    <Tabs defaultValue="timeline" className="flex-none h-[200px]">
                        <TabsList>
                            <TabsTrigger value="timeline">Timeline</TabsTrigger>
                        </TabsList>
                        <TabsContent value="timeline" className="flex flex-col gap-1">
                            <Timeline durationMs={50000}>
                                <TimelineItem id={1} timeMs={0} startMs={0} endMs={1000} color="green" label="CP Stab"/>
                                <TimelineItem id={2} timeMs={0} startMs={0} endMs={1000} color="yellow" label="Free Span"/>
                            </Timeline>
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
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {eventRows.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4}>No events</TableCell>
                                                </TableRow>
                                            ) : (
                                                eventRows.map((r, idx) => (
                                                    <TableRow key={idx} className="border-b border-white/10">
                                                        <TableCell>{r.eventName}</TableCell>
                                                        <TableCell>{r.eventCode}</TableCell>
                                                        <TableCell>{r.startTime}</TableCell>
                                                        <TableCell>{r.endTime}</TableCell>
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