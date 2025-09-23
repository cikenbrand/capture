import { useEffect, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

type Props = {
    onClose?: () => void
}

export default function RenameComponentForm({ onClose }: Props) {
    const [componentId, setComponentId] = useState<string | null>(null)
    const [overlayId, setOverlayId] = useState<string | null>(null)
    const [name, setName] = useState("")
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let done = false
        ; (async () => {
            try {
                const [compRes, ovlRes] = await Promise.all([
                    window.ipcRenderer.invoke('app:getSelectedOverlayComponentId'),
                    window.ipcRenderer.invoke('app:getSelectedOverlayLayerId'),
                ])
                const cid: string | null = compRes?.ok ? (compRes.data ?? null) : null
                const oid: string | null = ovlRes?.ok ? (ovlRes.data ?? null) : null
                if (!done) {
                    setComponentId(cid)
                    setOverlayId(oid)
                }
                if (cid && oid) {
                    try {
                        const res = await window.ipcRenderer.invoke('db:getAllOverlayComponents', { overlayId: oid })
                        if (res?.ok && Array.isArray(res.data)) {
                            const found = res.data.find((c: any) => c?._id === cid)
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
        if (!componentId) {
            setError("No component selected")
            return
        }
        if (!name.trim()) {
            setError("Component name is required")
            return
        }
        try {
            setSubmitting(true)
            const result = await window.ipcRenderer.invoke('db:editOverlayComponent', {
                id: componentId,
                updates: { name },
            })
            if (result?.ok) {
                try {
                    const ev = new CustomEvent('overlayComponentsChanged', { detail: { id: componentId, action: 'renamed' } })
                    window.dispatchEvent(ev)
                } catch { }
                onClose?.()
            } else {
                setError(result?.error || 'Failed to rename component')
            }
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return <div className="text-white/70">Loading…</div>
    }

    return (
        <div className="flex flex-col gap-3">
            {!componentId ? (
                <div className="text-white/80">No component selected.</div>
            ) : null}
            <div className="flex flex-col gap-1">
                <span>New Component Name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {error ? <div className="text-red-400 text-sm">{error}</div> : null}
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={() => onClose?.()} disabled={submitting}>Cancel</Button>
                <Button onClick={onRename} disabled={submitting || !componentId || !name.trim()}>Rename</Button>
            </div>
        </div>
    )
}