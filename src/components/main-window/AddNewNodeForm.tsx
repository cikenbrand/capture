import { useEffect, useMemo, useState } from "react"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"

type Props = {
  onClose: () => void
}

export default function AddNewNodeForm({ onClose }: Props) {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)
  const [name, setName] = useState("")
  // remarks removed
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
      const names = name
        .split(',')
        .map(n => n.trim())
        .filter(n => n.length > 0)
      const res = await window.ipcRenderer.invoke('db:createNode', {
        projectId,
        names,
        parentId: parentId || undefined,
      })
      if (res?.ok) {
        const created = Array.isArray(res?.data) ? res.data : []
        const first = created[0]
        const newId: string | undefined = first?._id?.toString?.() ?? first?._id
        // Keep the parent selected after creation
        if (parentId) {
          try { await window.ipcRenderer.invoke('app:setSelectedNodeId', parentId) } catch {}
          try {
            const evSel = new CustomEvent('selectedNodeChanged', { detail: parentId })
            window.dispatchEvent(evSel)
          } catch {}
        }
        try {
          const ev = new CustomEvent('nodesChanged', { detail: { id: newId, parentId, action: 'created' } })
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

  function onPasteNames(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    try {
      const text = e.clipboardData.getData('text/plain') ?? ''
      if (!text) return
      // Detect multi-line paste (from Sheets/Excel); normalize into comma-separated list
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
      if (lines.length <= 1) return
      e.preventDefault()
      const joined = lines.join(', ')
      const target = e.currentTarget
      const start = typeof (target as any).selectionStart === 'number' ? (target as any).selectionStart as number : target.value.length
      const end = typeof (target as any).selectionEnd === 'number' ? (target as any).selectionEnd as number : target.value.length
      const before = target.value.slice(0, start)
      const after = target.value.slice(end)
      const next = `${before}${joined}${after}`
      setName(next)
    } catch { }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-slate-400">Node Name(s)</span>
        <Textarea value={name} onChange={(e) => setName(e.target.value)} onPaste={onPasteNames} autoFocus placeholder="Example: Item A, Item B, Item C" />
      </div>
      {/* Remarks input removed */}
      {error ? <div className="text-red-400 text-sm">{error}</div> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={onCreate} disabled={submitting || !canSave}>Create</Button>
      </div>
    </div>
  )
}