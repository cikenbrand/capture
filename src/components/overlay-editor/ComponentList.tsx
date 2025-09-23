import { useEffect, useState } from "react";
import { Listbox } from "../ui/listbox";

type ComponentItem = {
    _id: string
    name: string
}

export default function ComponentList() {
    const [overlayId, setOverlayId] = useState<string | null>(null)
    const [items, setItems] = useState<ComponentItem[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function loadForOverlay(id: string | null) {
        setError(null)
        if (!id) {
            setItems([])
            setSelectedId(null)
            return
        }
        try {
            setLoading(true)
            const res = await window.ipcRenderer.invoke('db:getAllOverlayComponents', { overlayId: id })
            if (res?.ok) {
                const list: ComponentItem[] = Array.isArray(res.data) ? res.data : []
                setItems(list)
                if (selectedId && !list.some(c => c._id === selectedId)) setSelectedId(null)
            } else {
                setError(res?.error || 'Failed to load components')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        let done = false
        ; (async () => {
            try {
                const res = await window.ipcRenderer.invoke('app:getSelectedOverlayLayerId')
                const id: string | null = res?.ok ? (res.data ?? null) : null
                if (!done) {
                    setOverlayId(id)
                    await loadForOverlay(id)
                }
            } catch { }
        })()
        const onOverlaysChanged = async () => {
            try {
                const res = await window.ipcRenderer.invoke('app:getSelectedOverlayLayerId')
                const id: string | null = res?.ok ? (res.data ?? null) : null
                setOverlayId(id)
                await loadForOverlay(id)
            } catch { }
        }
        const onSelectedOverlayChanged = async (e: any) => {
            try {
                const id = e?.detail ?? null
                setOverlayId(id)
                await loadForOverlay(id)
            } catch { }
        }
        window.addEventListener('overlaysChanged', onOverlaysChanged as any)
        window.addEventListener('selectedOverlayLayerChanged', onSelectedOverlayChanged as any)
        return () => {
            done = true
            window.removeEventListener('overlaysChanged', onOverlaysChanged as any)
            window.removeEventListener('selectedOverlayLayerChanged', onSelectedOverlayChanged as any)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (loading) {
        return <div className="h-full text-white/70 flex items-center justify-center">Loading…</div>
    }
    if (error) {
        return (
            <div className="h-full p-2 text-red-400 text-sm">
                <div className="mb-2">{error}</div>
                <button className="px-2 py-1 bg-[#4C525E] hover:bg-[#5b616d] text-white/90" onClick={() => loadForOverlay(overlayId)}>Retry</button>
            </div>
        )
    }

    return (
        <div className="h-full">
            <Listbox
                items={items.map(i => ({ value: i._id, label: i.name }))}
                selectedValue={selectedId}
                onChange={setSelectedId}
            />
        </div>
    )
}