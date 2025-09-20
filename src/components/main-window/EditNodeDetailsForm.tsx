import { useEffect, useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"

type Props = {
  onClose: () => void
}

export default function EditNodeDetailsForm({ onClose }: Props) {
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [remarks, setRemarks] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sel = await window.ipcRenderer.invoke('app:getSelectedNodeId')
        const id: string | null = sel?.ok ? sel.data ?? null : null
        if (!id) return
        if (cancelled) return
        setNodeId(id)
        const res = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', id)
        if (cancelled) return
        if (res?.ok && res.data) {
          const n = res.data
          setName(n.name || "")
          setRemarks(n.remarks || "")
        } else if (!res?.ok) {
          setError(res?.error || 'Failed to load node')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function onApply() {
    if (!nodeId) return
    setError(null)
    try {
      setSubmitting(true)
      const updates: any = { name, remarks }
      const res = await window.ipcRenderer.invoke('db:editNode', nodeId, updates)
      if (!res?.ok) {
        setError(res?.error || 'Failed to update node')
        return
      }
      try {
        const ev = new CustomEvent('nodesChanged')
        window.dispatchEvent(ev)
      } catch {}
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span>Node Name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <span>Remarks</span>
        <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>
      {error ? <div className="text-red-400 text-sm">{error}</div> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={onApply} disabled={submitting || !nodeId}>Apply</Button>
      </div>
    </div>
  )
}