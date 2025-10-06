import { useEffect, useMemo, useRef, useState } from "react"
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
  const [isRecordingStarted, setIsRecordingStarted] = useState(false)

  // WebSocket connections per overlay channel (1..4) to send selected task
  const socketsRef = useRef<Record<number, WebSocket | null>>({})
  const WS_HOST = '127.0.0.1'
  const WS_PORT = 3620

  function getSocket(channelIndex: number): WebSocket | null {
    const existing = socketsRef.current[channelIndex]
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return existing
    }
    try {
      const ws = new WebSocket(`ws://${WS_HOST}:${WS_PORT}/overlay?ch=${channelIndex}`)
      ws.addEventListener('close', () => {
        try { if (socketsRef.current[channelIndex] === ws) socketsRef.current[channelIndex] = null } catch {}
      })
      ws.addEventListener('error', () => { try { /* ignore */ } catch {} })
      socketsRef.current[channelIndex] = ws
      return ws
    } catch {
      return existing ?? null
    }
  }

  function broadcastTaskName(name: string) {
    const payload = JSON.stringify({ taskName: name })
    for (const ch of [1, 2, 3, 4]) {
      try {
        const ws = getSocket(ch)
        if (!ws || typeof (ws as any).send !== 'function') continue
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload)
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.addEventListener('open', () => {
            try { ws.send(payload) } catch {}
          }, { once: true })
        }
      } catch {}
    }
  }

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

  // Load and track recording state to disable selection while recording
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await window.ipcRenderer.invoke('recording:getState')
        if (!cancelled && res?.ok) setIsRecordingStarted(!!res.data?.isRecordingStarted)
      } catch {}
    })()
    const onChanged = async () => {
      try {
        const res = await window.ipcRenderer.invoke('recording:getState')
        if (res?.ok) setIsRecordingStarted(!!res.data?.isRecordingStarted)
      } catch {}
    }
    window.addEventListener('recordingStateChanged', onChanged as any)
    return () => {
      cancelled = true
      window.removeEventListener('recordingStateChanged', onChanged as any)
    }
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

    // persist on project as lastSelectedTaskId
    try {
      const res = await window.ipcRenderer.invoke('app:getSelectedProjectId')
      const pid = res?.ok ? (res.data ?? null) : null
      if (pid) {
        await window.ipcRenderer.invoke('db:editProject', pid, { lastSelectedTaskId: nextId })
      }
    } catch {}

    try {
      const name = tasks.find(t => t._id === nextId)?.name || ''
      broadcastTaskName(name)
    } catch {}
  }

  // Broadcast on initial load/whenever selection or task list changes
  useEffect(() => {
    if (!selectedTaskId) {
      // If cleared, broadcast empty to clear overlay task text
      broadcastTaskName('')
      return
    }
    const name = tasks.find(t => t._id === selectedTaskId)?.name || ''
    broadcastTaskName(name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId, tasks])

  const disabled = isRecordingStarted || !projectId || loading || !tasks.length

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