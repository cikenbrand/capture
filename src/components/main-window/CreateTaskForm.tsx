import { useEffect, useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"

type Props = {
  onClose: () => void
}

export default function CreateTaskForm({ onClose }: Props) {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [remarks, setRemarks] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await window.ipcRenderer.invoke('app:getSelectedProjectId')
        if (!cancelled && res?.ok) setProjectId(res.data ?? null)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  async function onCreate() {
    setError(null)
    if (!name.trim()) {
      setError('Task name is required')
      return
    }
    if (!projectId) {
      setError('No project selected')
      return
    }
    try {
      setSubmitting(true)
      const result = await window.ipcRenderer.invoke('db:createTask', {
        projectId,
        name,
        remarks,
      })
      if (result?.ok) {
        const newTaskId: string | undefined = result.data
        if (newTaskId) {
          await window.ipcRenderer.invoke('app:setSelectedTaskId', newTaskId)
          try {
            const ev = new CustomEvent('selectedTaskChanged', { detail: newTaskId })
            window.dispatchEvent(ev)
            const ev2 = new CustomEvent('tasksChanged')
            window.dispatchEvent(ev2)
          } catch {}
          // persist last selected task on project
          try {
            await window.ipcRenderer.invoke('db:editProject', projectId, { lastSelectedTaskId: newTaskId })
          } catch {}
        }
        onClose()
      } else {
        setError(result?.error || 'Failed to create task')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span>Task Name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <span>Remarks</span>
        <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>
      {error ? <div className="text-red-400 text-sm">{error}</div> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={onCreate} disabled={submitting || !name.trim()}>Create</Button>
      </div>
    </div>
  )
}
