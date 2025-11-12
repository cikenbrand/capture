import { useEffect, useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { toast } from "sonner"
import { RadioGroup, RadioGroupItem } from "../ui/radio-group"

type Props = {
  onClose: () => void
}

export default function EditNodeDetailsForm({ onClose }: Props) {
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [remarks, setRemarks] = useState("")
  const [status, setStatus] = useState<'completed' | 'ongoing' | 'not-started'>('not-started')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [allChildrenCompleted, setAllChildrenCompleted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId')
          if (!cancelled && proj?.ok) setProjectId(proj.data ?? null)
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
            setStatus((n as any).status || 'not-started')
          } else if (!res?.ok) {
            setError(res?.error || 'Failed to load node')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      })()
    return () => { cancelled = true }
  }, [])

  // Compute whether all direct children are completed; refresh on changes
  useEffect(() => {
    let cancelled = false
    async function compute() {
      try {
        if (!projectId || !nodeId) { if (!cancelled) setAllChildrenCompleted(false); return }
        const res = await window.ipcRenderer.invoke('db:getAllNodes', projectId)
        if (!res?.ok) { if (!cancelled) setAllChildrenCompleted(false); return }
        const roots: any[] = Array.isArray(res.data) ? res.data : []
        const stack = [...roots]
        let target: any = null
        while (stack.length) {
          const cur = stack.pop()
          if (!cur) continue
          if ((cur._id?.toString?.() ?? cur._id) === nodeId) { target = cur; break }
          if (Array.isArray(cur.children)) stack.push(...cur.children)
        }
        if (!target) { if (!cancelled) setAllChildrenCompleted(false); return }
        const children: any[] = Array.isArray(target.children) ? target.children : []
        if (children.length === 0) { if (!cancelled) setAllChildrenCompleted(false); return }
        const allDone = children.every((c) => ((c as any).status || 'not-started') === 'completed')
        if (!cancelled) setAllChildrenCompleted(allDone)
      } catch {
        if (!cancelled) setAllChildrenCompleted(false)
      }
    }
    compute()
    const onNodes = () => { void compute() }
    window.addEventListener('nodesChanged', onNodes as any)
    return () => { cancelled = true; window.removeEventListener('nodesChanged', onNodes as any) }
  }, [projectId, nodeId])

  async function onApply() {
    if (!nodeId) return
    setError(null)
    try {
      setSubmitting(true)
      const updates: any = { name, remarks, status }
      const res = await window.ipcRenderer.invoke('db:editNode', nodeId, updates, { cascade: true })
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
            <span className="text-slate-400">Node Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-slate-400">Status</span>
            <RadioGroup className="flex flex-row gap-4" value={status} onValueChange={(v) => setStatus((v as any) || 'not-started')}>
              <label className="inline-flex items-center gap-2">
                <RadioGroupItem value="completed" />
                <span className="text-slate-400">Completed</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <RadioGroupItem value="ongoing" disabled={allChildrenCompleted} />
                <span className="text-slate-400">Ongoing</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <RadioGroupItem value="not-started" disabled={allChildrenCompleted} />
                <span className="text-slate-400">Not Started</span>
              </label>
            </RadioGroup>
            {allChildrenCompleted ? (
              <span className="text-red-400 text-xs">All children completed. Change via children.</span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-slate-400">Remarks</span>
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
            <div />
            <div className="flex gap-2">
              <Button onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button onClick={onApply} disabled={submitting || !nodeId}>Apply</Button>
            </div>
          </>
        ) : (
          <>
            <div />
            <div className="flex gap-2">
              <Button onClick={() => setConfirmingDelete(false)} disabled={submitting}>Cancel</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}