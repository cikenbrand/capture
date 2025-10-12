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
    const [currentPath, setCurrentPath] = useState<string[]>([])

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
                : <FileExplorerComponent
                    hierarchy={hierarchy as any}
                    items={[]}
                    onOpenPath={(p) => setCurrentPath(p)}
                    onSelect={async (id) => {
                        try {
                            setSelectedId(id)
                            // Resolve the selected entry in the hierarchy using currentPath
                            let cursor: any = hierarchy
                            for (const seg of currentPath) {
                                if (!cursor || typeof cursor !== 'object') { cursor = {}; break }
                                if (cursor.children && seg in cursor.children) {
                                    cursor = cursor.children[seg]
                                } else if (seg in cursor) {
                                    cursor = cursor[seg]
                                } else {
                                    cursor = {}
                                    break
                                }
                            }
                            const nodeChildren = (cursor && cursor.children) ? cursor.children : cursor
                            const entry = nodeChildren?.[id]
                            if (entry && entry.type === 'video') {
                                const filePath: string | undefined = typeof entry.path === 'string' ? entry.path : undefined
                                if (filePath) {
                                    await window.ipcRenderer.invoke('system:openFile', filePath)
                                }
                            }
                        } catch {}
                    }}
                />}
        </div>
    )
}


