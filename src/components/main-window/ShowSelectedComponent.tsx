import { useEffect, useState } from "react"
import { Input } from "../ui/input"

export default function ShowSelectedComponent() {
  const [name, setName] = useState("")
  const [hasProject, setHasProject] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId')
        const projectId: string | null = proj?.ok ? (proj.data ?? null) : null
        if (!projectId) {
          if (!cancelled) { setHasProject(false); setName("No Nodes Selected") }
          return
        }
        if (!cancelled) setHasProject(true)
        const sel = await window.ipcRenderer.invoke('app:getSelectedNodeId')
        const nodeId: string | null = sel?.ok ? (sel.data ?? null) : null
        if (!nodeId) { if (!cancelled) setName(""); return }
        const res = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', nodeId)
        const nm: string = res?.ok ? ((res.data?.name as string) ?? '') : ''
        if (!cancelled) setName(nm)
      } catch {
        if (!cancelled) { setHasProject(false); setName("No Nodes Selected") }
      }
    }
    load()
    const onSel = () => { void load() }
    const onNodes = () => { void load() }
    const onProject = () => { void load() }
    window.addEventListener('selectedNodeChanged', onSel as any)
    window.addEventListener('nodesChanged', onNodes as any)
    window.addEventListener('selectedProjectChanged', onProject as any)
    return () => {
      cancelled = true
      window.removeEventListener('selectedNodeChanged', onSel as any)
      window.removeEventListener('nodesChanged', onNodes as any)
      window.removeEventListener('selectedProjectChanged', onProject as any)
    }
  }, [])

  return (
    <div className="flex gap-2 items-center text-nowrap">
      <span>Component :</span>
      <Input className="h-6.5" readOnly disabled={!hasProject} value={name} placeholder="(none)" />
    </div>
  )
}