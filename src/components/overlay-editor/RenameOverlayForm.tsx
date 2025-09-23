import { useEffect, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

type Props = {
    onClose: () => void
}

export default function RenameOverlayForm({ onClose }: Props) {
    const [overlayId, setOverlayId] = useState<string | null>(null)
    const [name, setName] = useState("")
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let done = false
        ; (async () => {
            try {
                const res = await window.ipcRenderer.invoke('app:getSelectedOverlayLayerId')
                const id: string | null = res?.ok ? (res.data ?? null) : null
                if (!done) setOverlayId(id)
                // Try to prefill current name
                if (id) {
                    try {
                        const all = await window.ipcRenderer.invoke('db:getAllOverlay')
                        if (all?.ok && Array.isArray(all.data)) {
                            const found = all.data.find((o: any) => o?._id === id)
                            if (found?.name && !done) setName(found.name)
                        }
                    } catch { }
                }
            } catch { }
            if (!done) setLoading(false)
        })()
        return () => { done = true }
    }, [])

    async function onRename() {
        setError(null)
        if (!overlayId) {
            setError("No overlay selected")
            return
        }
        if (!name.trim()) {
            setError("Overlay name is required")
            return
        }
        try {
            setSubmitting(true)
            const result = await window.ipcRenderer.invoke('db:renameOverlay', {
                id: overlayId,
                name,
            })
            if (result?.ok) {
                try {
                    const ev = new CustomEvent('overlaysChanged', { detail: { id: overlayId, action: 'renamed' } })
                    window.dispatchEvent(ev)
                } catch { }
                onClose()
            } else {
                setError(result?.error || 'Failed to rename overlay')
            }
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="text-white/70">Loading…</div>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            {!overlayId ? (
                <div className="text-white/80">No overlay selected.</div>
            ) : null}
            <div className="flex flex-col gap-1">
                <span>New Overlay Name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {error ? <div className="text-red-400 text-sm">{error}</div> : null}
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button onClick={onRename} disabled={submitting || !overlayId || !name.trim()}>
                    Rename
                </Button>
            </div>
        </div>
    )
}