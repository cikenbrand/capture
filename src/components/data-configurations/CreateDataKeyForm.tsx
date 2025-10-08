import { useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"

type Props = {
    onClose: () => void
}

export default function CreateDataKeyForm({ onClose }: Props) {
    const [name, setName] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function onCreate() {
        setError(null)
        const trimmed = name.trim()
        if (!trimmed) {
            setError('Key name is required')
            return
        }
        try {
            setSubmitting(true)
            const res = await window.ipcRenderer.invoke('db:createDataKey', trimmed)
            if (res?.ok) {
                onClose()
            } else {
                setError(res?.error || 'Failed to create data key')
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <span>Data Key</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Depth" />
            </div>
            {error ? <div className="text-red-400 text-sm">{error}</div> : null}
            <div className="mt-2 flex justify-end gap-2">
                <Button onClick={onClose} disabled={submitting}>Cancel</Button>
                <Button onClick={onCreate} disabled={submitting || !name.trim()}>OK</Button>
            </div>
        </div>
    )
}