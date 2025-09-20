import { useEffect, useState } from "react"
import { Input } from "../ui/input"

export default function ShowDiveRemarks() {
  const [selectedDiveId, setSelectedDiveId] = useState<string | null>(null)
  const [remarks, setRemarks] = useState("")
  const [isStarted, setIsStarted] = useState(false)

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

  // Fetch remarks for the selected dive; also refetch when dives change (edited)
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!selectedDiveId) {
        setRemarks("")
        setIsStarted(false)
        return
      }
      try {
        const res = await window.ipcRenderer.invoke('db:getSelectedDiveDetails', selectedDiveId)
        if (!cancelled) {
          if (res?.ok && res.data) {
            setRemarks(res.data.remarks || "")
            setIsStarted(!!res.data.started)
          } else {
            setRemarks("")
            setIsStarted(false)
          }
        }
      } catch {
        if (!cancelled) {
          setRemarks("")
          setIsStarted(false)
        }
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

  return (
    <Input value={remarks} readOnly disabled={!selectedDiveId || isStarted} placeholder={selectedDiveId ? "" : "No dive selected"} />
  )
}