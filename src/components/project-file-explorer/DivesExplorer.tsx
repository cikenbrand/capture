import { useEffect, useMemo, useState } from "react"
import FileExplorerComponent from "@/components/FileExplorerComponent"
import { DraggableDialog } from "@/components/ui/draggable-dialog"

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
    const [exporting, setExporting] = useState<boolean>(false)
    const [exportMessage, setExportMessage] = useState<string>('Exporting… Please wait.')

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
                    onSaveToLocal={async (name, _isFolder, pathSegs) => {
                        try {
                            const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId')
                            const projectId: string | null = proj?.ok ? (proj.data ?? null) : null
                            if (!projectId) return
                            const pick = await window.ipcRenderer.invoke('dialog:selectDirectory')
                            if (!pick?.ok || !pick.data) return
                            const dest: string = pick.data
                            setExportMessage('Exporting… Please wait.')
                            setExporting(true)
                            try {
                                const res = await window.ipcRenderer.invoke('project:export-entry', projectId, pathSegs, name, dest)
                                if (res?.ok) {
                                    try { await window.ipcRenderer.invoke('system:notify', 'Export complete', `Saved "${name}"`) } catch {}
                                }
                            } finally {
                                setExporting(false)
                            }
                        } catch {
                            setExporting(false)
                        }
                    }}
                    rightActions={(
                        <button
                            className="h-8 px-3 rounded bg-[#2D3743] text-white/90 hover:bg-[#3A4654] disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={exporting}
                            onClick={async () => {
                                try {
                                    const proj = await window.ipcRenderer.invoke('app:getSelectedProjectId')
                                    const projectId: string | null = proj?.ok ? (proj.data ?? null) : null
                                    if (!projectId) return
                                    const pick = await window.ipcRenderer.invoke('dialog:selectDirectory')
                                    if (!pick?.ok || !pick.data) return
                                    const dest: string = pick.data
                                    setExportMessage('Exporting… Please wait.')
                                    setExporting(true)
                                    try {
                                        const exp = await window.ipcRenderer.invoke('project:export-entire', projectId, dest)
                                        if (exp?.ok) {
                                            try { await window.ipcRenderer.invoke('system:notify', 'Project exported', 'Your project has been exported successfully.') } catch {}
                                        } else {
                                            // optional: surface error
                                        }
                                    } finally {
                                        setExporting(false)
                                    }
                                } catch {
                                    setExporting(false)
                                }
                            }}
                        >
                            Export Project
                        </button>
                    )}
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
                            if (entry && (entry.type === 'video' || entry.type === 'image')) {
                                const filePath: string | undefined = typeof entry.path === 'string' ? entry.path : undefined
                                if (filePath) {
                                    await window.ipcRenderer.invoke('system:openFile', filePath)
                                }
                            }
                        } catch {}
                    }}
                />}
            {/* Blocking modal during export */}
            <DraggableDialog
                open={exporting}
                onOpenChange={() => {}}
                title="Exporting"
                disableBackdropClose
                useBackdrop
            >
                <div className="flex items-center gap-3 min-w-[260px]">
                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-transparent animate-spin" aria-hidden="true" />
                    <div className="text-white/90">{exportMessage}</div>
                </div>
            </DraggableDialog>
        </div>
    )
}


