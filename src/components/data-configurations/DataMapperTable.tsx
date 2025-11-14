import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Input } from "../ui/input";

export default function DataMapperTable () {
    const [rows, setRows] = React.useState<{ key: string | null, value: string }[]>([] as any)
    const [keys, setKeys] = React.useState<{ _id: string; name: string }[]>([])

    React.useEffect(() => {
        let cancelled = false
        const id = setInterval(async () => {
            try {
                const res = await window.ipcRenderer.invoke('serial:getDeviceState')
                if (!cancelled && res?.ok && res.data) {
                    const fields = Array.isArray(res.data.currentFields) ? res.data.currentFields as { key: string | null, value: string }[] : []
                    setRows(fields)
                }
            } catch {}
        }, 500)
        return () => { cancelled = true; clearInterval(id) }
    }, [])

    React.useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await window.ipcRenderer.invoke('db:fetchDataKeys')
                if (!cancelled && res?.ok) {
                    const list = Array.isArray(res.data) ? res.data as any[] : []
                    setKeys(list.map(k => ({ _id: String(k._id), name: String(k.name) })))
                }
            } catch {}
        })()
        const onCreated = (e: Event) => {
            try {
                const detail = (e as CustomEvent).detail as { _id: string; name: string }
                if (!detail || !detail._id || !detail.name) return
                setKeys(prev => {
                    const exists = prev.some(k => k._id === detail._id || k.name === detail.name)
                    if (exists) return prev
                    return [...prev, { _id: String(detail._id), name: String(detail.name) }]
                })
            } catch {}
        }
        window.addEventListener('data-key-created', onCreated as EventListener)
        return () => { cancelled = true; window.removeEventListener('data-key-created', onCreated as EventListener) }
    }, [])
    return (
        <Table className="table-fixed">
            <TableHeader>
                <TableRow className="border-b border-white/10">
                    <TableHead className="w-[60px] text-slate-400">Field</TableHead>
                    <TableHead className="w-[140px] text-slate-400">Received</TableHead>
                    <TableHead className="w-[120px] text-slate-400">Type</TableHead>
                    <TableHead className="text-slate-400">Name</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {(rows.length ? rows : Array.from({ length: 10 }).map(() => ({ key: null, value: '' })) ).map((row, idx) => (
                    <TableRow key={idx} className="border-b border-white/10">
                        <TableCell className="text-slate-400">{idx}</TableCell>
                        <TableCell>
                            {/* Received checkbox placeholder */}
                            <div className="flex items-center gap-2">
                                <Input className="h-6 w-full" placeholder="" value={row.value} readOnly />
                            </div>
                        </TableCell>
                        <TableCell>
                            <Select>
                                <SelectTrigger className="h-6 w-full">
                                    <SelectValue placeholder="text" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="text">text</SelectItem>
                                    <SelectItem value="number">number</SelectItem>
                                    <SelectItem value="heading">heading</SelectItem>
                                </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell>
                            <Select value={row.key ?? 'undefined'} onValueChange={async (v) => { const key = v === 'undefined' ? null : v; setRows(prev => { const copy = [...prev]; if (copy[idx]) copy[idx] = { ...copy[idx], key: (key as any) }; return copy }); try { await window.ipcRenderer.invoke('serial:setFieldKey', idx, key) } catch {} }}>
                                <SelectTrigger className="h-6 w-full">
                                    <SelectValue placeholder={`field ${idx + 1}`} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="undefined">undefined</SelectItem>
                                    {keys.map(k => (
                                        <SelectItem key={k._id} value={k.name}>{k.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}