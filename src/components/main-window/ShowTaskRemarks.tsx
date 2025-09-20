import { useEffect, useState } from "react"
import { Input } from "../ui/input"

export default function ShowTaskRemarks() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [remarks, setRemarks] = useState("")

  // Load current selected task id and keep in sync
  useEffect(() => {
    let done = false
    ;(async () => {
      try {
        const res = await window.ipcRenderer.invoke('app:getSelectedTaskId')
        if (!done && res?.ok) setSelectedTaskId(res.data ?? null)
      } catch {}
    })()
    const onTaskChanged = (e: any) => {
      try {
        const id = e?.detail ?? null
        setSelectedTaskId(id)
      } catch {}
    }
    window.addEventListener('selectedTaskChanged', onTaskChanged as any)
    return () => {
      done = true
      window.removeEventListener('selectedTaskChanged', onTaskChanged as any)
    }
  }, [])

  // Fetch remarks for the selected task; also refetch when tasks change (edited/created)
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!selectedTaskId) {
        setRemarks("")
        return
      }
      try {
        const res = await window.ipcRenderer.invoke('db:getSelectedTaskDetails', selectedTaskId)
        if (!cancelled) {
          if (res?.ok && res.data) setRemarks(res.data.remarks || "")
          else setRemarks("")
        }
      } catch {
        if (!cancelled) setRemarks("")
      }
    }
    load()
    const onTasksChanged = () => load()
    window.addEventListener('tasksChanged', onTasksChanged as any)
    return () => {
      cancelled = true
      window.removeEventListener('tasksChanged', onTasksChanged as any)
    }
  }, [selectedTaskId])

  return (
    <Input value={remarks} readOnly disabled={!selectedTaskId} placeholder={selectedTaskId ? "" : "No task selected"} />
  )
}