import { useEffect, useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { toast } from "sonner"

type Props = {
  onClose: () => void
}

export default function EditNodeDetailsForm({ onClose }: Props) {
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [remarks, setRemarks] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
      ; (async () => {
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
        const ev = new CustomEvent('nodesChanged', { detail: { id: nodeId, action: 'edited' } })
        window.dispatchEvent(ev)
      } catch { }
      try { toast.success('Item updated') } catch {}
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete() {
    if (!nodeId) return
    setError(null)
    try {
      setSubmitting(true)
      let parentId: string | null = null
      try {
        const det = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', nodeId)
        parentId = det?.ok ? (det.data?.parentId ?? null) : null
      } catch {}
      const res = await window.ipcRenderer.invoke('db:deleteNode', nodeId)
      if (!res?.ok) {
        setError(res?.error || 'Failed to delete node')
        return
      }
      try { await window.ipcRenderer.invoke('app:setSelectedNodeId', null) } catch {}
      try {
        const evSel = new CustomEvent('selectedNodeChanged', { detail: null })
        window.dispatchEvent(evSel)
      } catch {}
      try {
        const pidRes = await window.ipcRenderer.invoke('app:getSelectedProjectId')
        const pid: string | null = pidRes?.ok ? (pidRes.data ?? null) : null
        if (pid) {
          await window.ipcRenderer.invoke('db:editProject', pid, { lastSelectedNodeId: null })
        }
      } catch {}
      try {
        const ev = new CustomEvent('nodesChanged', { detail: { id: nodeId, parentId, action: 'deleted' } })
        window.dispatchEvent(ev)
      } catch {}
      try { toast.success('Item deleted') } catch {}
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!confirmingDelete ? (
        <>
          <div className="flex flex-col gap-1">
            <span>Node Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span>Remarks</span>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </>
      ) : (
        <div className="text-white/80 text-sm">Are you sure you want to delete the item?</div>
      )}
      {error ? <div className="text-red-400 text-sm">{error}</div> : null}
      <div className="mt-2 flex justify-between gap-2">
        {!confirmingDelete ? (
          <>
            <div className="flex items-center gap-2">
              <Button onClick={() => setConfirmingDelete(true)} disabled={submitting || !nodeId}>Delete</Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button onClick={onApply} disabled={submitting || !nodeId}>Apply</Button>
            </div>
          </>
        ) : (
          <>
            <div />
            <div className="flex gap-2">
              <Button onClick={() => setConfirmingDelete(false)} disabled={submitting}>Cancel Delete</Button>
              <Button onClick={onDelete} disabled={submitting || !nodeId}>Apply</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}