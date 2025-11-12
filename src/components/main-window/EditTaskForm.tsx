import { useEffect, useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"

type Props = {
  onClose: () => void
}

export default function EditTaskForm({ onClose }: Props) {
  const [taskId, setTaskId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [remarks, setRemarks] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sel = await window.ipcRenderer.invoke('app:getSelectedTaskId')
        const id: string | null = sel?.ok ? sel.data ?? null : null
        if (!id) return
        if (cancelled) return
        setTaskId(id)
        const res = await window.ipcRenderer.invoke('db:getSelectedTaskDetails', id)
        if (cancelled) return
        if (res?.ok && res.data) {
          const t = res.data
          setName(t.name || "")
          setRemarks(t.remarks || "")
        } else if (!res?.ok) {
          setError(res?.error || 'Failed to load task')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function onApply() {
    if (!taskId) return
    setError(null)
    try {
      setSubmitting(true)
      const updates: any = { name, remarks }
      const res = await window.ipcRenderer.invoke('db:editTask', taskId, updates)
      if (!res?.ok) {
        setError(res?.error || 'Failed to update task')
        return
      }
      try {
        const ev = new CustomEvent('tasksChanged')
        window.dispatchEvent(ev)
      } catch {}
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete() {
    if (!taskId) return
    setError(null)
    try {
      setSubmitting(true)
      const res = await window.ipcRenderer.invoke('db:deleteTask', taskId)
      if (!res?.ok) {
        setError(res?.error || 'Failed to delete task')
        return
      }
      try { await window.ipcRenderer.invoke('app:setSelectedTaskId', null) } catch {}
      try {
        const ev1 = new CustomEvent('selectedTaskChanged', { detail: null })
        window.dispatchEvent(ev1)
      } catch {}
      try {
        const ev2 = new CustomEvent('tasksChanged')
        window.dispatchEvent(ev2)
      } catch {}
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-slate-400">Task Name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-slate-400">Remarks</span>
        <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>
      {error ? <div className="text-red-400 text-sm">{error}</div> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={onApply} disabled={submitting || !taskId}>Apply</Button>
      </div>
    </div>
  )
}