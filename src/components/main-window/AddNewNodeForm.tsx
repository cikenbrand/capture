import { useEffect, useMemo, useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"

type Props = {
  onClose: () => void
}

export default function AddNewNodeForm({ onClose }: Props) {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [remarks, setRemarks] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let done = false
    ;(async () => {
      try {
        const p = await window.ipcRenderer.invoke('app:getSelectedProjectId')
        if (!done && p?.ok) setProjectId(p.data ?? null)
      } catch {}
      try {
        const n = await window.ipcRenderer.invoke('app:getSelectedNodeId')
        if (!done && n?.ok) setParentId(n.data ?? null)
      } catch {}
    })()
    const onProjectChanged = (e: any) => {
      try { setProjectId(e?.detail ?? null) } catch {}
    }
    const onNodeChanged = (e: any) => {
      try { setParentId(e?.detail ?? null) } catch {}
    }
    window.addEventListener('selectedProjectChanged', onProjectChanged as any)
    window.addEventListener('selectedNodeChanged', onNodeChanged as any)
    return () => {
      done = true
      window.removeEventListener('selectedProjectChanged', onProjectChanged as any)
      window.removeEventListener('selectedNodeChanged', onNodeChanged as any)
    }
  }, [])

  const canSave = useMemo(() => !!projectId && name.trim().length > 0 && !submitting, [projectId, name, submitting])

  async function onCreate() {
    setError(null)
    if (!name.trim()) {
      setError('Node name is required')
      return
    }
    if (!projectId) {
      setError('No project selected')
      return
    }
    try {
      setSubmitting(true)
      const res = await window.ipcRenderer.invoke('db:createNode', {
        projectId,
        name: name.trim(),
        parentId: parentId || undefined,
        remarks: remarks.trim() || undefined,
      })
      if (res?.ok) {
        const newId: string | undefined = (res?.data?._id?.toString?.() ?? res?.data?._id) as string | undefined
        if (newId) {
          try {
            await window.ipcRenderer.invoke('app:setSelectedNodeId', newId)
          } catch {}
          try {
            const evSel = new CustomEvent('selectedNodeChanged', { detail: newId })
            window.dispatchEvent(evSel)
          } catch {}
        }
        try {
          const ev = new CustomEvent('nodesChanged')
          window.dispatchEvent(ev)
        } catch {}
        onClose()
      } else {
        setError(res?.error || 'Failed to create node')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span>Node Name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Node name" />
      </div>
      <div className="flex flex-col gap-1">
        <span>Remarks</span>
        <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional remarks" />
      </div>
      {error ? <div className="text-red-400 text-sm">{error}</div> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={onCreate} disabled={submitting || !canSave}>Create</Button>
      </div>
    </div>
  )
}