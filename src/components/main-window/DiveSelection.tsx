import { useEffect, useMemo, useState } from "react"
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
  }

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