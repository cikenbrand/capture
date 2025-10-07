import { useEffect, useState } from "react"
import { Input } from "../ui/input"

export default function ShowSelectedComponent() {
  const [name, setName] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const sel = await window.ipcRenderer.invoke('app:getSelectedNodeId')
        const nodeId: string | null = sel?.ok ? (sel.data ?? null) : null
        if (!nodeId) { if (!cancelled) setName(""); return }
        const res = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', nodeId)
        const nm: string = res?.ok ? ((res.data?.name as string) ?? '') : ''
        if (!cancelled) setName(nm)
      } catch {
        if (!cancelled) setName("")
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

  return (
    <div className="flex gap-2 items-center text-nowrap">
      <span>Component :</span>
      <Input className="h-6.5" readOnly value={name} placeholder="(none)" />
    </div>
  )
}