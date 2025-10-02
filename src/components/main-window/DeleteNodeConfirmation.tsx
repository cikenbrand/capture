import { useEffect, useState } from "react"
import { Button } from "../ui/button"

type Props = {
  onClose: () => void
}

export default function DeleteNodeConfirmation({ onClose }: Props) {
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sel = await window.ipcRenderer.invoke('app:getSelectedNodeId')
        if (cancelled) return
        const id: string | null = sel?.ok ? sel.data ?? null : null
        setNodeId(id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function onConfirm() {
    if (!nodeId) return
    setError(null)
    try {
      setSubmitting(true)
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
      // Clear last selected node on the project as well
      try {
        const pidRes = await window.ipcRenderer.invoke('app:getSelectedProjectId')
        const pid: string | null = pidRes?.ok ? (pidRes.data ?? null) : null
        if (pid) {
          await window.ipcRenderer.invoke('db:editProject', pid, { lastSelectedNodeId: null })
        }
      } catch {}
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
      <div className="text-sm text-white/80">
        Are you sure you want to delete this node and all of its children?
      </div>
      {error ? <div className="text-red-400 text-sm">{error}</div> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={onConfirm} disabled={submitting || !nodeId}>OK</Button>
      </div>
    </div>
  )
}