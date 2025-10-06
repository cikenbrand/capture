import { useEffect, useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

type ProjectLog = {
    _id: string
    date: string
    time: string
    event: string
    dive?: string | null
    task?: string | null
    components?: unknown
    fileName?: string | null
    anomaly?: string | null
    remarks?: string | null
    data?: unknown
}

export default function AllLogsTable() {
    const [projectId, setProjectId] = useState<string | null>(null)
    const [logs, setLogs] = useState<ProjectLog[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let done = false
        ;(async () => {
            try {
                const res = await window.ipcRenderer.invoke('app:getSelectedProjectId')
                if (!done && res?.ok) setProjectId(res.data ?? null)
            } catch {}
        })()
        const onProjectChanged = (e: any) => {
            try { setProjectId(e?.detail ?? null) } catch {}
        }
        window.addEventListener('selectedProjectChanged', onProjectChanged as any)
        return () => {
            done = true
            window.removeEventListener('selectedProjectChanged', onProjectChanged as any)
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        async function load() {
            if (!projectId) { setLogs([]); return }
            setLoading(true)
            try {
                const res = await window.ipcRenderer.invoke('db:getProjectLogs', projectId, { limit: 500 })
                if (!cancelled) setLogs(res?.ok && Array.isArray(res.data) ? res.data : [])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        const onLogsChanged = () => load()
        window.addEventListener('projectLogsChanged', onLogsChanged as any)
        return () => { cancelled = true; window.removeEventListener('projectLogsChanged', onLogsChanged as any) }
    }, [projectId])

    const renderVal = (v: unknown) => {
        if (v == null) return ''
        if (typeof v === 'string') return v
        try { return JSON.stringify(v) } catch { return String(v) }
    }

    return (
        <div className="w-full h-full p-1 bg-[#21262E]">
            <div className="h-[200px] overflow-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead className="w-[90px]">Time</TableHead>
                        <TableHead className="w-[160px]">Event</TableHead>
                        <TableHead className="w-[180px]">Dive</TableHead>
                        <TableHead className="w-[180px]">Task</TableHead>
                        <TableHead className="w-[220px]">Components</TableHead>
                        <TableHead className="w-[240px]">File Name</TableHead>
                        <TableHead className="w-[160px]">Anomaly</TableHead>
                        <TableHead className="w-[240px]">Remarks</TableHead>
                        <TableHead className="w-[240px]">Data</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody >
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={9}>Loading…</TableCell>
                        </TableRow>
                    ) : logs.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={9}>No logs</TableCell>
                        </TableRow>
                    ) : (
                        logs.map((log) => (
                            <TableRow key={log._id}>
                                <TableCell className="max-w-[100px] whitespace-nowrap overflow-hidden text-ellipsis">{log.date}</TableCell>
                                <TableCell className="max-w-[90px] whitespace-nowrap overflow-hidden text-ellipsis">{log.time}</TableCell>
                                <TableCell className="max-w-[160px] whitespace-nowrap overflow-hidden text-ellipsis">{log.event}</TableCell>
                                <TableCell className="max-w-[180px] whitespace-nowrap overflow-hidden text-ellipsis">{renderVal(log.dive)}</TableCell>
                                <TableCell className="max-w-[180px] whitespace-nowrap overflow-hidden text-ellipsis">{renderVal(log.task)}</TableCell>
                                <TableCell className="max-w-[220px] whitespace-nowrap overflow-hidden text-ellipsis">{renderVal(log.components)}</TableCell>
                                <TableCell className="max-w-[240px] whitespace-nowrap overflow-hidden text-ellipsis">{renderVal(log.fileName)}</TableCell>
                                <TableCell className="max-w-[160px] whitespace-nowrap overflow-hidden text-ellipsis">{renderVal(log.anomaly)}</TableCell>
                                <TableCell className="max-w-[240px] whitespace-nowrap overflow-hidden text-ellipsis">{renderVal(log.remarks)}</TableCell>
                                <TableCell className="max-w-[240px] whitespace-nowrap overflow-hidden text-ellipsis">{renderVal(log.data)}</TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            </div>
        </div>
    )
}