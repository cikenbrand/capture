import { useEffect, useState } from "react"
import { Input } from "../ui/input"

export default function ShowNodesStatus() {
  const [value, setValue] = useState<string>("")
  const [status, setStatus] = useState<'completed' | 'ongoing' | 'not-started' | ''>('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const sel = await window.ipcRenderer.invoke('app:getSelectedNodeId')
        const nodeId: string | null = sel?.ok ? (sel.data ?? null) : null
        if (!nodeId) { if (!cancelled) setValue(""); return }
        const res = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', nodeId)
        const st: string = res?.ok ? ((res.data?.status as string) ?? 'not-started') : 'not-started'
        const label = st === 'completed' ? 'Completed' : st === 'ongoing' ? 'Ongoing' : 'Not Started'
        if (!cancelled) { setValue(label); setStatus((st as any) || '') }
      } catch {
        if (!cancelled) { setValue(""); setStatus('') }
      }
    }
    load()
    const onSel = () => { void load() }
    const onNodes = () => { void load() }
    window.addEventListener('selectedNodeChanged', onSel as any)
    window.addEventListener('nodesChanged', onNodes as any)
    return () => {
      cancelled = true
      window.removeEventListener('selectedNodeChanged', onSel as any)
      window.removeEventListener('nodesChanged', onNodes as any)
    }
  }, [])

  const colorClass = status === 'completed' ? 'text-green-400' : status === 'ongoing' ? 'text-blue-400' : 'text-gray-400'
  return (
    <div className="flex gap-2 items-center text-nowrap">
      <span>Status :</span>
      <Input value={value} placeholder="Not Started" readOnly className={`h-6.5 uppercase font-medium ${colorClass}`}/>
    </div>
  )
}