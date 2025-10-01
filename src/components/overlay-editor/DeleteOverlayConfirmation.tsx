import { useEffect, useState } from "react";
import { Button } from "../ui/button";

type Props = {
    onClose: () => void
}

export default function DeleteOverlayConfirmation({ onClose }: Props) {
    const [overlayId, setOverlayId] = useState<string | null>(null)
    const [overlayName, setOverlayName] = useState<string>("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let done = false
        ; (async () => {
            try {
                const res = await window.ipcRenderer.invoke('app:getSelectedOverlayLayerId')
                const id: string | null = res?.ok ? (res.data ?? null) : null
                if (!done) setOverlayId(id)
                if (id) {
                    try {
                        const all = await window.ipcRenderer.invoke('db:getAllOverlay')
                        if (all?.ok && Array.isArray(all.data)) {
                            const found = all.data.find((o: any) => o?._id === id)
                            if (!done) setOverlayName(found?.name || "")
                        }
                    } catch { }
                }
            } catch { }
        })()
        return () => { done = true }
    }, [])

    async function onDelete() {
        setError(null)
        if (!overlayId) {
            setError("No overlay selected")
            return
        }
        try {
            setSubmitting(true)
            const result = await window.ipcRenderer.invoke('db:deleteOverlay', { id: overlayId })
            if (result?.ok) {
                try {
                    await window.ipcRenderer.invoke('app:setSelectedOverlayLayerId', null)
                } catch { }
                try {
                    await window.ipcRenderer.invoke('app:setSelectedOverlayComponentIds', [])
                } catch { }
                try {
                    const evSel = new CustomEvent('selectedOverlayLayerChanged', { detail: null })
                    window.dispatchEvent(evSel)
                } catch { }
                try {
                    const ev = new CustomEvent('overlaysChanged', { detail: { id: overlayId, action: 'deleted' } })
                    window.dispatchEvent(ev)
                } catch { }
                onClose()
            } else {
                setError(result?.error || 'Failed to delete overlay')
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="text-white/80">
                {overlayName ? (
                    <span>Are you sure you want to delete "{overlayName}"?</span>
                ) : (
                    <span>Are you sure you want to delete this overlay?</span>
                )}
            </div>
            {error ? <div className="text-red-400 text-sm">{error}</div> : null}
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose} disabled={submitting}>Cancel</Button>
                <Button onClick={onDelete} disabled={submitting || !overlayId}>Delete</Button>
            </div>
        </div>
    )
}