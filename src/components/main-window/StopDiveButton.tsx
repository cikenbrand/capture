import { useEffect, useState } from "react"
import { FaStop } from "react-icons/fa";

export default function StopDiveButton() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedDiveId, setSelectedDiveId] = useState<string | null>(null)
  const [isStarted, setIsStarted] = useState<boolean>(false)

  useEffect(() => {
    let done = false
    ;(async () => {
      try {
        const p = await window.ipcRenderer.invoke('app:getSelectedProjectId')
        if (!done && p?.ok) setSelectedProjectId(p.data ?? null)
        const d = await window.ipcRenderer.invoke('app:getSelectedDiveId')
        if (!done && d?.ok) setSelectedDiveId(d.data ?? null)
      } catch {}
    })()
    const onProjectChanged = (e: any) => setSelectedProjectId(e?.detail ?? null)
    const onDiveChanged = (e: any) => setSelectedDiveId(e?.detail ?? null)
    window.addEventListener('selectedProjectChanged', onProjectChanged as any)
    window.addEventListener('selectedDiveChanged', onDiveChanged as any)
    return () => {
      done = true
      window.removeEventListener('selectedProjectChanged', onProjectChanged as any)
      window.removeEventListener('selectedDiveChanged', onDiveChanged as any)
    }
  }, [])

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

  async function onStop() {
    if (!selectedDiveId) return
    try {
      const res = await window.ipcRenderer.invoke('db:editDive', selectedDiveId, { started: false })
      if (res?.ok) {
        try {
          const ev = new CustomEvent('divesChanged')
          window.dispatchEvent(ev)
        } catch {}
        setIsStarted(false)
      }
    } catch {}
  }

  const disabled = !selectedProjectId || !selectedDiveId || !isStarted

  return (
    <button title="Stop Dive" disabled={disabled} onClick={onStop} className="flex items-center justify-center h-[28px] aspect-square hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-50 disabled:pointer-events-none">
      <FaStop className="h-3.5 w-3.5" />
    </button>
  )
}