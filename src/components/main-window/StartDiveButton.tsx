import { useEffect, useState } from "react"
import { FaPlay } from "react-icons/fa";

export default function StartDiveButton() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedDiveId, setSelectedDiveId] = useState<string | null>(null)
  const [selectedDiveName, setSelectedDiveName] = useState<string | null>(null)
  const [isStarted, setIsStarted] = useState<boolean>(false)

  useEffect(() => {
    let done = false
    ;(async () => {
      try {
        const p = await window.ipcRenderer.invoke('app:getSelectedProjectId')
        if (!done && p?.ok) setSelectedProjectId(p.data ?? null)
        const d = await window.ipcRenderer.invoke('app:getSelectedDiveId')
        if (!done && d?.ok) {
          const id = d.data ?? null
          setSelectedDiveId(id)
          if (id) {
            try {
              const det = await window.ipcRenderer.invoke('db:getSelectedDiveDetails', id)
              if (!done) setSelectedDiveName(det?.ok ? (det.data?.name ?? null) : null)
            } catch { if (!done) setSelectedDiveName(null) }
          }
        }
      } catch {}
    })()
    const onProjectChanged = (e: any) => setSelectedProjectId(e?.detail ?? null)
    const onDiveChanged = async (e: any) => {
      const id = e?.detail ?? null
      setSelectedDiveId(id)
      try {
        if (id) {
          const det = await window.ipcRenderer.invoke('db:getSelectedDiveDetails', id)
          setSelectedDiveName(det?.ok ? (det.data?.name ?? null) : null)
        } else {
          setSelectedDiveName(null)
        }
      } catch { setSelectedDiveName(null) }
    }
    window.addEventListener('selectedProjectChanged', onProjectChanged as any)
    window.addEventListener('selectedDiveChanged', onDiveChanged as any)
    return () => {
      done = true
      window.removeEventListener('selectedProjectChanged', onProjectChanged as any)
      window.removeEventListener('selectedDiveChanged', onDiveChanged as any)
    }
  }, [])

  // Keep started state in sync with current selected dive
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!selectedDiveId) {
        setIsStarted(false)
        return
      }
      try {
        const res = await window.ipcRenderer.invoke('dive:isStarted', selectedDiveId)
        if (!cancelled) setIsStarted(!!(res?.ok && res.data === true))
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

  async function onStart() {
    if (!selectedDiveId) return
    try {
      const res = await window.ipcRenderer.invoke('dive:setStarted', selectedDiveId, true)
      if (res?.ok) {
        try {
          const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId')
          const projectId = proj?.ok ? (proj.data ?? null) : null
          if (projectId) {
            await window.ipcRenderer.invoke('db:addProjectLog', {
              projectId,
              event: 'Start Dive',
              dive: selectedDiveName || null,
            })
            try { window.dispatchEvent(new Event('projectLogsChanged')) } catch {}
          }
        } catch {}
        try {
          const ev = new CustomEvent('divesChanged')
          window.dispatchEvent(ev)
        } catch {}
        setIsStarted(true)
      }
    } catch {}
  }

  const disabled = !selectedProjectId || !selectedDiveId || isStarted

  return (
    <button title="Start Dive" disabled={disabled} onClick={onStart} className="flex items-center justify-center gap-2 px-1.5 h-[28px] hover:bg-[#4C525E] active:bg-[#202832] rounded-[2px] text-white active:text-[#71BCFC] disabled:opacity-30 disabled:pointer-events-none">
      <FaPlay className="h-3 w-3" fill="#0F65EE"/>
      <span className="text-[14px] font-semibold">Start Dive</span>
    </button>
  )
}