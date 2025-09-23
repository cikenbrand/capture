import { useEffect, useState } from "react";
import { MultiSelectListbox } from "../ui/MultiSelectListbox";

type ComponentItem = {
    _id: string
    name: string
}

export default function ComponentList() {
    const [overlayId, setOverlayId] = useState<string | null>(null)
    const [items, setItems] = useState<ComponentItem[]>([])
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)

    async function loadForOverlay(id: string | null) {
        setError(null)
        if (!id) {
            setItems([])
            setSelectedIds([])
            return
        }
        try {
            const res = await window.ipcRenderer.invoke('db:getAllOverlayComponents', { overlayId: id })
            if (res?.ok) {
                const list: ComponentItem[] = Array.isArray(res.data) ? res.data : []
                setItems(list)
                setSelectedIds((prev) => prev.filter((id) => list.some(c => c._id === id)))
            } else {
                setError(res?.error || 'Failed to load components')
            }
        } finally {
            // no-op
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
        const onComponentsChanged = async () => {
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
        window.addEventListener('overlayComponentsChanged', onComponentsChanged as any)
        window.addEventListener('selectedOverlayLayerChanged', onSelectedOverlayChanged as any)
        return () => {
            done = true
            window.removeEventListener('overlaysChanged', onOverlaysChanged as any)
            window.removeEventListener('overlayComponentsChanged', onComponentsChanged as any)
            window.removeEventListener('selectedOverlayLayerChanged', onSelectedOverlayChanged as any)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Persist selected component ids when user clicks items and broadcast changes
    useEffect(() => {
        (async () => {
            try {
                await window.ipcRenderer.invoke('app:setSelectedOverlayComponentIds', selectedIds)
                try {
                    const last = selectedIds.length ? selectedIds[selectedIds.length - 1] : null
                    const evSingle = new CustomEvent('selectedOverlayComponentChanged', { detail: last })
                    window.dispatchEvent(evSingle)
                    const evPlural = new CustomEvent('selectedOverlayComponentIdsChanged', { detail: selectedIds })
                    window.dispatchEvent(evPlural)
                } catch { }
            } catch { }
        })()
    }, [selectedIds])

    // React to external multi-selection changes
    useEffect(() => {
        const onSelectedIdsExternal = (e: any) => {
            try {
                const ids = e?.detail
                if (Array.isArray(ids)) setSelectedIds(ids)
            } catch {}
        }
        window.addEventListener('selectedOverlayComponentIdsChanged', onSelectedIdsExternal as any)
        return () => {
            window.removeEventListener('selectedOverlayComponentIdsChanged', onSelectedIdsExternal as any)
        }
    }, [])

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
            <MultiSelectListbox
                items={items.map(i => ({ value: i._id, label: i.name }))}
                selectedValues={selectedIds}
                onChange={(vals) => {
                    try { console.log('Selected component IDs:', vals) } catch {}
                    setSelectedIds(vals)
                }}
            />
        </div>
    )
}