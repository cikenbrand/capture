import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Props = {
    value?: string
    onChange?: (next: string) => void
}

export default function ComDeviceSelection({ value, onChange }: Props) {
    const [ports, setPorts] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let cancelled = false
        async function load() {
            setLoading(true)
            try {
                const res = await window.ipcRenderer.invoke('serial:getCOMPorts')
                if (!cancelled) setPorts((res?.ok ? (res.data || []) : []) as string[])
            } catch {
                if (!cancelled) setPorts([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [])

    const placeholder = loading ? 'Loading ports…' : (ports.length ? 'Select port' : 'No ports')

    return (
        <div className="flex flex-col gap-1">
            <span>COM Device</span>
            <Select value={value} onValueChange={onChange} disabled={!ports.length || loading}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {ports.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}