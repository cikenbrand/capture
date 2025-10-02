import { useEffect, useMemo, useRef, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

type Dive = {
  _id: string
  name: string
}

export default function DiveSelection() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [dives, setDives] = useState<Dive[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [selectedDiveId, setSelectedDiveId] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [isStarted, setIsStarted] = useState(false)

  // WebSocket connections per overlay channel (1..4) to send selected dive
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

  function broadcastDiveName(name: string) {
    const payload = JSON.stringify({ diveName: name })
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

  // Load current selected dive id and keep in sync
  useEffect(() => {
    let done = false
    ;(async () => {
      try {
        const res = await window.ipcRenderer.invoke('app:getSelectedDiveId')
        if (!done && res?.ok) setSelectedDiveId(res.data ?? null)
      } catch {}
    })()
    const onDiveChanged = (e: any) => {
      try {
        const id = e?.detail ?? null
        setSelectedDiveId(id)
      } catch {}
    }
    window.addEventListener('selectedDiveChanged', onDiveChanged as any)
    return () => {
      done = true
      window.removeEventListener('selectedDiveChanged', onDiveChanged as any)
    }
  }, [])

  // Fetch dives for the selected project; also refetch when selection changes (e.g., after creating a new dive)
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!projectId) {
        setDives([])
        return
      }
      setLoading(true)
      try {
        const res = await window.ipcRenderer.invoke('db:getAllDives', projectId)
        if (!cancelled) {
          if (res?.ok) {
            setDives((res.data || []) as Dive[])
          } else {
            setDives([])
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [projectId, selectedDiveId, refreshTick])

  // Listen for explicit refresh events (e.g., when a dive is edited)
  useEffect(() => {
    const onDivesChanged = () => setRefreshTick((t) => t + 1)
    window.addEventListener('divesChanged', onDivesChanged as any)
    return () => window.removeEventListener('divesChanged', onDivesChanged as any)
  }, [])

  // Track whether the selected dive is started; update on selection and when dives change
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!selectedDiveId) {
        setIsStarted(false)
        return
      }
      try {
        const res = await window.ipcRenderer.invoke('db:getSelectedDiveDetails', selectedDiveId)
        if (!cancelled) setIsStarted(!!(res?.ok && res.data && res.data.started))
      } catch {
        if (!cancelled) setIsStarted(false)
      }
    }
    load()
    const onDivesChanged = () => load()
    window.addEventListener('divesChanged', onDivesChanged as any)
    return () => {
      cancelled = true
      window.removeEventListener('divesChanged', onDivesChanged as any)
    }
  }, [selectedDiveId])

  const placeholder = useMemo(() => {
    if (!projectId) return 'Select a project first'
    if (loading) return 'Loading dives…'
    if (!dives.length) return 'No dives'
    return 'Select Dive'
  }, [projectId, loading, dives.length])

  async function onChange(nextId: string) {
    setSelectedDiveId(nextId)
    try {
      await window.ipcRenderer.invoke('app:setSelectedDiveId', nextId)
      try {
        const ev = new CustomEvent('selectedDiveChanged', { detail: nextId })
        window.dispatchEvent(ev)
      } catch {}
    } catch {}

    // persist on project as lastSelectedDiveId
    try {
      if (projectId) {
        await window.ipcRenderer.invoke('db:editProject', projectId, { lastSelectedDiveId: nextId })
      }
    } catch {}

    try {
      const name = dives.find(d => d._id === nextId)?.name || ''
      broadcastDiveName(name)
    } catch {}
  }

  // Broadcast on initial load/whenever selection or dive list changes
  useEffect(() => {
    if (!selectedDiveId) {
      // If cleared, broadcast empty to clear overlay dive text
      broadcastDiveName('')
      return
    }
    const name = dives.find(d => d._id === selectedDiveId)?.name || ''
    broadcastDiveName(name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDiveId, dives])

  const disabled = !projectId || loading || !dives.length || isStarted

  return (
    <Select value={selectedDiveId ?? undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {dives.map(d => (
          <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}