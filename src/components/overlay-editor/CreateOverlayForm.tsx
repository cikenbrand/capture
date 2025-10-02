import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type Props = {
    onClose: () => void
}

export default function CreateOverlayForm({ onClose }: Props) {
    const [name, setName] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function onCreate() {
        setError(null)
        if (!name.trim()) {
            setError("Overlay name is required")
            return
        }
        try {
            setSubmitting(true)
            const result = await window.ipcRenderer.invoke('db:createOverlay', {
                name,
            })
            if (result?.ok) {
                try {
                    const newId: string | undefined = result.data
                    const ev = new CustomEvent('overlaysChanged', { detail: { id: newId, action: 'created' } })
                    window.dispatchEvent(ev)
                } catch {}
                // Notify channel overlay selection to refresh (Electron event also emitted)
                try { (window as any).ipcRenderer?.send?.('noop') } catch {}
                onClose()
            } else {
                setError(result?.error || 'Failed to create overlay')
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <span>Overlay Name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {error ? <div className="text-red-400 text-sm">{error}</div> : null}
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button onClick={onCreate} disabled={submitting || !name.trim()}>
                    Create
                </Button>
            </div>
        </div>
    )
}