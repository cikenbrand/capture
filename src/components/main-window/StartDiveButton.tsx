import { useEffect, useState } from "react"
import { FaStop } from "react-icons/fa";
import { FaPersonSwimming, FaWaterLadder } from "react-icons/fa6";

export default function StartDiveButton() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedDiveId, setSelectedDiveId] = useState<string | null>(null)
  const [selectedDiveName, setSelectedDiveName] = useState<string | null>(null)
  const [isStarted, setIsStarted] = useState<boolean>(false)
  const [isRecordingStarted, setIsRecordingStarted] = useState<boolean>(false)

  useEffect(() => {
    let done = false
      ; (async () => {
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
        } catch { }
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

  // Track recording state to prevent stopping a dive while recording
  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const res = await window.ipcRenderer.invoke('recording:getState')
          if (!cancelled && res?.ok) setIsRecordingStarted(!!res.data?.isRecordingStarted)
        } catch { }
      })()
    const onChanged = async () => {
      try {
        const res = await window.ipcRenderer.invoke('recording:getState')
        if (res?.ok) setIsRecordingStarted(!!res.data?.isRecordingStarted)
      } catch { }
    }
    window.addEventListener('recordingStateChanged', onChanged as any)
    return () => {
      cancelled = true
      window.removeEventListener('recordingStateChanged', onChanged as any)
    }
  }, [])

  async function onToggle() {
    if (!selectedDiveId) return
    try {
      if (!isStarted) {
        // Start dive
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
              try { window.dispatchEvent(new Event('projectLogsChanged')) } catch { }
            }
          } catch { }
          try { window.dispatchEvent(new CustomEvent('divesChanged')) } catch { }
          setIsStarted(true)
        }
      } else {
        // Prevent stopping while recording is active
        if (isRecordingStarted) return
        const res = await window.ipcRenderer.invoke('dive:setStarted', selectedDiveId, false)
        if (res?.ok) {
          try {
            const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId')
            const projectId = proj?.ok ? (proj.data ?? null) : null
            if (projectId) {
              await window.ipcRenderer.invoke('db:addProjectLog', {
                projectId,
                event: 'Stop Dive',
                dive: selectedDiveName || null,
              })
              try { window.dispatchEvent(new Event('projectLogsChanged')) } catch { }
            }
          } catch { }
          try { window.dispatchEvent(new CustomEvent('divesChanged')) } catch { }
          setIsStarted(false)
        }
      }
    } catch { }
  }

  const disabled = !selectedProjectId || !selectedDiveId || (isStarted && isRecordingStarted)
  const title = !isStarted ? 'Start Dive' : 'Stop Dive'
  const className = "hover:bg-[#1D2229] rounded flex items-center justify-center h-[28px] w-[100px] hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none"

  return (
    <button title={title} disabled={disabled} onClick={onToggle} className={className}>
      {!isStarted ? (
        <div className="flex items-center justify-center gap-2">
          <FaPersonSwimming className="h-5 w-5 text-blue-400" />
          <span className="text-slate-400">Start Dive</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <FaWaterLadder className="h-5 w-5 text-red-400" />
          <span className="text-slate-400">Stop Dive</span>
        </div>
      )}
    </button>
  )
}