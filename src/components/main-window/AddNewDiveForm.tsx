import { useEffect, useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"

type Props = {
  onClose: () => void
}

export default function AddNewDive({ onClose }: Props) {
  const [name, setName] = useState("")
  const [projectId, setProjectId] = useState<string | null>(null)
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
      setError('Dive name is required')
      return
    }
    if (!projectId) {
      setError('No project selected')
      return
    }
    try {
      setSubmitting(true)
      const result = await window.ipcRenderer.invoke('db:createDive', {
        projectId,
        name,
        remarks,
      })
      if (result?.ok) {
        const newDiveId: string | undefined = result.data
        if (newDiveId) {
          await window.ipcRenderer.invoke('app:setSelectedDiveId', newDiveId)
          try {
            const ev = new CustomEvent('selectedDiveChanged', { detail: newDiveId })
            window.dispatchEvent(ev)
          } catch {}
          // persist last selected dive on project
          try {
            if (projectId) {
              await window.ipcRenderer.invoke('db:editProject', projectId, { lastSelectedDiveId: newDiveId })
            }
          } catch {}
        }
        onClose()
      } else {
        setError(result?.error || 'Failed to create dive')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-slate-400">Dive Name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-slate-400">Remarks</span>
        <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>
      {error ? <div className="text-red-400 text-sm">{error}</div> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={onCreate} disabled={submitting || !name.trim()}>Add</Button>
      </div>
    </div>
  )
}