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
        <div className="w-full h-full bg-[#21262E]">
            <div className="h-[246px] overflow-auto logs-scroll">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px] text-slate-400">Date</TableHead>
                        <TableHead className="w-[90px] text-slate-400">Time</TableHead>
                        <TableHead className="w-[160px] text-slate-400">Event</TableHead>
                        <TableHead className="w-[180px] text-slate-400">Dive</TableHead>
                        <TableHead className="w-[180px] text-slate-400">Task</TableHead>
                        <TableHead className="w-[220px] text-slate-400">Components</TableHead>
                        <TableHead className="w-[240px] text-slate-400">File Name</TableHead>
                        <TableHead className="w-[160px] text-slate-400">Anomaly</TableHead>
                        <TableHead className="w-[240px] text-slate-400">Data</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody >
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={9}>Loading…</TableCell>
                        </TableRow>
                    ) : (
                        logs.map((log, idx) => (
                            <TableRow key={log._id} className={idx === 0 ? 'bg-[#374F66] text-white' : 'text-slate-400'}>
                                <TableCell className="max-w-[100px] whitespace-nowrap overflow-hidden text-ellipsis">{log.date}</TableCell>
                                <TableCell className="max-w-[90px] whitespace-nowrap overflow-hidden text-ellipsis">{log.time}</TableCell>
                                <TableCell className="max-w-[160px] whitespace-nowrap overflow-hidden text-ellipsis">{log.event}</TableCell>
                                <TableCell className="max-w-[180px] whitespace-nowrap overflow-hidden text-ellipsis">{renderVal(log.dive)}</TableCell>
                                <TableCell className="max-w-[180px] whitespace-nowrap overflow-hidden text-ellipsis">{renderVal(log.task)}</TableCell>
                                <TableCell className="max-w-[220px] whitespace-nowrap overflow-hidden text-ellipsis">{renderVal(log.components)}</TableCell>
                                <TableCell className="max-w-[240px] whitespace-nowrap overflow-hidden text-ellipsis">{renderVal(log.fileName)}</TableCell>
                                <TableCell className="max-w-[160px] whitespace-nowrap overflow-hidden text-ellipsis">{renderVal(log.anomaly)}</TableCell>
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