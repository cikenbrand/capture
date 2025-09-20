import { useEffect, useMemo, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

type Task = {
  _id: string
  name: string
}

export default function TaskSelection() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  // Load current project id and keep in sync
  useEffect(() => {
    let done = false
    ;(async () => {
      try {
        const res = await window.ipcRenderer.invoke('app:getSelectedProjectId')
        if (!done && res?.ok) setProjectId(res.data ?? null)
      } catch {}
    })()
    const onProjectChanged = (e: any) => {
      try {
        const id = e?.detail ?? null
        setProjectId(id)
      } catch {}
    }
    window.addEventListener('selectedProjectChanged', onProjectChanged as any)
    return () => {
      done = true
      window.removeEventListener('selectedProjectChanged', onProjectChanged as any)
    }
  }, [])

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

  // Fetch tasks for the selected project
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!projectId) {
        setTasks([])
        return
      }
      setLoading(true)
      try {
        const res = await window.ipcRenderer.invoke('db:getAllTasks', projectId)
        if (!cancelled) {
          if (res?.ok) {
            setTasks((res.data || []) as Task[])
          } else {
            setTasks([])
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [projectId, refreshTick, selectedTaskId])

  // Listen for explicit refresh events
  useEffect(() => {
    const onTasksChanged = () => setRefreshTick((t) => t + 1)
    window.addEventListener('tasksChanged', onTasksChanged as any)
    return () => window.removeEventListener('tasksChanged', onTasksChanged as any)
  }, [])

  const placeholder = useMemo(() => {
    if (!projectId) return 'Select a project first'
    if (loading) return 'Loading tasks…'
    if (!tasks.length) return 'No tasks'
    return 'Select Task'
  }, [projectId, loading, tasks.length])

  async function onChange(nextId: string) {
    setSelectedTaskId(nextId)
    try {
      await window.ipcRenderer.invoke('app:setSelectedTaskId', nextId)
      try {
        const ev = new CustomEvent('selectedTaskChanged', { detail: nextId })
        window.dispatchEvent(ev)
      } catch {}
    } catch {}
  }

  const disabled = !projectId || loading || !tasks.length

  return (
    <Select value={selectedTaskId ?? undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {tasks.map(t => (
          <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}