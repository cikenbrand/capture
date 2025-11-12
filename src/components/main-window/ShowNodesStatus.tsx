import { useEffect, useState } from "react"
import { Input } from "../ui/input"

export default function ShowNodesStatus() {
  const [value, setValue] = useState<string>("")
  const [status, setStatus] = useState<'completed' | 'ongoing' | 'not-started' | ''>('')
  const [hasProject, setHasProject] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId')
        const projectId: string | null = proj?.ok ? (proj.data ?? null) : null
        if (!projectId) {
          if (!cancelled) { setHasProject(false); setValue('No Nodes Selected'); setStatus('') }
          return
        }
        if (!cancelled) setHasProject(true)
        const sel = await window.ipcRenderer.invoke('app:getSelectedNodeId')
        const nodeId: string | null = sel?.ok ? (sel.data ?? null) : null
        if (!nodeId) { if (!cancelled) setValue(""); return }
        const res = await window.ipcRenderer.invoke('db:getSelectedNodeDetails', nodeId)
        const st: string = res?.ok ? ((res.data?.status as string) ?? 'not-started') : 'not-started'
        const label = st === 'completed' ? 'Completed' : st === 'ongoing' ? 'Ongoing' : 'Not Started'
        if (!cancelled) { setValue(label); setStatus((st as any) || '') }
      } catch {
        if (!cancelled) { setHasProject(false); setValue('No Nodes Selected'); setStatus('') }
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

  const colorClass = status === 'completed' ? 'text-green-400' : status === 'ongoing' ? 'text-blue-400' : 'text-gray-400'
  return (
    <div className="flex flex-col gap-1 text-nowrap">
      <span className="text-slate-400">Status</span>
      <Input value={value} placeholder="Not Started" readOnly disabled={!hasProject} className={`select-none pointer-events-none caret-transparent ${colorClass}`}/>
    </div>
  )
}