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
                const list = Array.isArray(res.data) ? (res.data as OverlayItem[]) : []
                setOverlays(list)
                const firstId = list.length > 0 ? list[0]._id : null
                // Choose first overlay if none selected or previous selection no longer exists
                if (!selectedId && firstId) {
                    setSelectedId(firstId)
                } else if (selectedId && !list.some(o => o._id === selectedId)) {
                    setSelectedId(firstId)
                }
            } else {
                setError(res?.error || 'Failed to load overlays')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
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
                try {
                    const ev = new CustomEvent('selectedOverlayLayerChanged', { detail: selectedId ?? null })
                    window.dispatchEvent(ev)
                } catch { }
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