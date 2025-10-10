import { useEffect, useMemo, useState } from "react"
import FileExplorerComponent from "@/components/FileExplorerComponent"

type Dive = {
    _id: string
    name: string
}

export default function DivesExplorer() {
    const [projectId, setProjectId] = useState<string | null>(null)
    const [dives, setDives] = useState<Dive[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [hierarchy, setHierarchy] = useState<Record<string, any> | null>(null)

    useEffect(() => {
        let done = false
        ;(async () => {
            try {
                const res = await window.ipcRenderer.invoke('app:getSelectedProjectId')
                if (!done && res?.ok) setProjectId(res.data ?? null)
            } catch { }
        })()
        const onProjectChanged = (e: any) => {
            try {
                const id = e?.detail ?? null
                setProjectId(id)
            } catch { }
        }
        window.addEventListener('selectedProjectChanged', onProjectChanged as any)
        return () => {
            done = true
            window.removeEventListener('selectedProjectChanged', onProjectChanged as any)
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        async function load() {
            if (!projectId) { setHierarchy(null); return }
            setLoading(true)
            try {
                const res = await window.ipcRenderer.invoke('db:getExportedProjectHierarchy', projectId)
                if (!cancelled) {
                    if (res?.ok && res.data && typeof res.data === 'object') setHierarchy(res.data as Record<string, any>)
                    else setHierarchy({})
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [projectId])

    const emptyText = useMemo(() => {
        if (!projectId) return 'Select a project to view items'
        if (loading) return 'Loading…'
        if (!hierarchy || Object.keys(hierarchy).length === 0) return 'No items found'
        return ''
    }, [projectId, loading, hierarchy])

    return (
        <div className="h-full flex flex-col min-h-0">
            {emptyText
                ? <div className="p-4 text-white/60 text-sm">{emptyText}</div>
                : <FileExplorerComponent hierarchy={hierarchy as any} items={[]} onSelect={(id) => setSelectedId(id)} />}
        </div>
    )
}


