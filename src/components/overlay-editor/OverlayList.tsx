import { useEffect, useState } from "react";
import { Listbox } from "../ui/listbox";

type OverlayItem = {
    _id: string
    name: string
    createdAt: any
    updatedAt: any
}

export default function OverlayList() {
    const [overlays, setOverlays] = useState<OverlayItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)

    async function load() {
        setError(null)
        try {
            setLoading(true)
            const res = await window.ipcRenderer.invoke('db:getAllOverlay')
            if (res?.ok) {
                setOverlays(Array.isArray(res.data) ? res.data : [])
                // Keep selection if still present
                if (selectedId && !(res.data as OverlayItem[]).some(o => o._id === selectedId)) {
                    setSelectedId(null)
                }
            } else {
                setError(res?.error || 'Failed to load overlays')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // Load current selected overlay layer from main
        (async () => {
            try {
                const res = await window.ipcRenderer.invoke('app:getSelectedOverlayLayerId')
                if (res?.ok) setSelectedId(res.data ?? null)
            } catch { }
        })()
        load()
        const onChanged = (e: any) => {
            try {
                const id = e?.detail?.id as string | undefined
                load().then(() => {
                    if (id) setSelectedId(id)
                })
            } catch {
                load()
            }
        }
        window.addEventListener('overlaysChanged', onChanged as any)
        return () => window.removeEventListener('overlaysChanged', onChanged as any)
    }, [])

    // When user selects an overlay, persist selection in main
    useEffect(() => {
        (async () => {
            try {
                await window.ipcRenderer.invoke('app:setSelectedOverlayLayerId', selectedId ?? null)
            } catch { }
        })()
    }, [selectedId])

    if (loading) {
        return (
            <div className="w-full h-40 text-white/70 flex items-center justify-center border border-black bg-[#363D4A]">
                Loading…
            </div>
        )
    }

    if (error) {
        return (
            <div className="w-full p-2 text-red-400 text-sm border border-black bg-[#2b1f1f]">
                <div className="mb-2">{error}</div>
                <button className="px-2 py-1 bg-[#4C525E] hover:bg-[#5b616d] text-white/90" onClick={load}>Retry</button>
            </div>
        )
    }

    return (
        <div className="h-full">
            <Listbox
                items={overlays.map(o => ({ value: o._id, label: o.name }))}
                selectedValue={selectedId}
                onChange={setSelectedId}
            />
        </div>

    )
}